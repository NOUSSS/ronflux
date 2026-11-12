// ==UserScript==
// @name         Ronflux
// @namespace    ronflux
// @version      1.2.0
// @description  Bloque les publicités vidéo (pre-roll et mid-roll) des lives Twitch en basculant sur un flux de secours sans pub.
// @author       Ronflux
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

/*
 * Ronflux : cœur partagé (userscript Tampermonkey/Violentmonkey + extension de navigateur)
 *
 * Comment ça marche
 * -----------------
 * Twitch n'affiche pas ses pubs vidéo via un lecteur séparé : elles sont « cousues » (stitched)
 * directement dans la playlist HLS du live. On ne peut donc pas les bloquer par domaine.
 *
 * Le lecteur Twitch tourne dans un Web Worker. Ce script :
 *   0. demande le flux principal avec le type de lecteur « popout » (pas de pre-roll) au lieu de
 *      « site », en réécrivant la requête GraphQL PlaybackAccessToken de la page ;
 *   1. remplace window.Worker pour envelopper le worker du lecteur et y injecter un hook sur fetch() ;
 *   2. dans le worker, lit chaque playlist .m3u8 ; si elle contient des marqueurs de pub
 *      (#EXT-X-DATERANGE ... CLASS="twitch-stitched-ad"), il demande un jeton d'accès pour un autre
 *      « playerType » (embed, autoplay, picture-by-picture…) qui ne reçoit pas de pub, récupère la
 *      playlist correspondante à la même qualité et la renvoie au lecteur à la place ;
 *   3. à la fin de la pub, revient au flux d'origine, renuméroté comme le flux de secours, et,
 *      après un mid-roll, recharge le lecteur pour resynchroniser (jamais après un pre-roll : le
 *      rechargement en ferait servir un autre) ;
 *   4. si aucun flux de secours n'est trouvé, masque le lecteur et coupe le son le temps de la pub.
 *
 * Tout est configurable dans CONFIG ci-dessous. Journal dans la console (F12), préfixe [Ronflux].
 * API de diagnostic : window.__ronflux
 */
(function () {
  'use strict';

  const VERSION = '1.2.0';
  const TAG = '[Ronflux]';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  const CONFIG = {
    // Journal détaillé dans la console. Les événements importants sont toujours affichés.
    debug: false,

    // Petite notification dans le lecteur quand une pub est bloquée.
    showNotifications: true,

    // Si aucun flux de secours sans pub n'est trouvé : masquer le lecteur et couper le son
    // le temps de la pub (au lieu de la regarder).
    hidePlayerOnUnblockedAd: true,

    // Recharger le lecteur à la fin d'un mid-roll pendant lequel un flux de secours a servi,
    // pour resynchroniser la lecture : 'always' | 'quality-changed' | 'never'. Jamais après un
    // pre-roll (voir maybeReloadAfterAd).
    reloadPlayerAfterAd: 'always',

    // Délai minimal entre deux rechargements automatiques du lecteur (évite les boucles).
    minReloadIntervalMs: 45000,

    // Nouvelle recherche de flux de secours après ce délai si toutes les tentatives ont échoué.
    retryIntervalMs: 10000,

    // Client-ID public du site web Twitch (requêtes GraphQL).
    clientId: 'kimne78kx3ncx6brgo4mv6wki5h1ko',

    // Type de lecteur demandé pour le flux PRINCIPAL à la place de « site » (jeton d'accès du
    // lecteur de la page de chaîne). Twitch ne sert pas de pre-roll au type « popout » (constaté
    // 2026-10-03), ce qui évite la plupart des pubs sans même avoir à basculer de flux ; les
    // mid-rolls restent traités par le flux de secours. null pour désactiver.
    forceMainPlayerType: 'popout',

    // Types de lecteur essayés, dans l'ordre, pour obtenir un flux sans pub.
    // Twitch change régulièrement lesquels reçoivent des pubs : réordonner / compléter si besoin.
    // Le dernier type qui a fonctionné sur une chaîne est automatiquement réessayé en premier.
    // État constaté le 2026-10-03 : popout, frontpage, site/android, site/ios → pas de pre-roll,
    // toutes qualités ; embed → sans pub sur certaines chaînes, pre-roll sur d'autres ;
    // autoplay → pas de pub mais 360p max ; picture-by-picture et thunderdome → pre-roll servi
    // (gardés en dernier recours).
    backupPlayerTypes: [
      { playerType: 'popout', platform: 'web' },
      { playerType: 'frontpage', platform: 'web' },
      { playerType: 'site', platform: 'android' },
      { playerType: 'site', platform: 'ios' },
      { playerType: 'embed', platform: 'web' },
      { playerType: 'autoplay', platform: 'web' },
      { playerType: 'picture-by-picture', platform: 'web' },
      { playerType: 'thunderdome', platform: 'web' },
    ],
  };

  if (window.__ronflux) {
    console.info(TAG, 'déjà installé (userscript + extension ?), cette instance se désactive.');
    return;
  }

  const log = (...a) => { if (CONFIG.debug) console.log(TAG, ...a); };
  const info = (...a) => console.info(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  // ===========================================================================
  // Code exécuté DANS le worker du lecteur.
  // Il est sérialisé avec toString() : il doit rester autonome (aucune référence
  // à une variable extérieure, tout passe par `cfg`).
  // ===========================================================================
  function workerMain(cfg) {
    'use strict';
    const TAG = '[Ronflux:worker]';
    const realFetch = self.fetch.bind(self);
    const AD_RE = /stitched-ad|twitch-ad-quartile|x-tv-twitch-ad/i;
    const MIDROLL_RE = /midroll/i;

    const state = {
      headers: Object.assign({}, cfg.headers),
      channel: null,
      usherUrl: null,
      qualities: [],
      byUrl: new Map(),        // url de playlist média -> qualité
      ad: null,                // pub en cours
      lastGoodType: new Map(), // chaîne -> dernier type de lecteur sans pub
      warnedNoMaster: false,   // avertissement « pub sans playlist maîtresse » déjà émis
      servedBackup: false,     // le lecteur a reçu un flux de secours depuis la playlist maîtresse
    };

    const log = (...a) => { if (cfg.debug) console.log(TAG, ...a); };
    const info = (...a) => console.info(TAG, ...a);
    const warn = (...a) => console.warn(TAG, ...a);
    const post = (msg) => { try { self.postMessage(msg); } catch (e) { /* ignoré */ } };

    self.addEventListener('message', (ev) => {
      const d = ev.data;
      if (!d || typeof d.key !== 'string') return;
      if (d.key === 'RONFLUX_HEADERS' && d.headers) Object.assign(state.headers, d.headers);
      else if (d.key === 'RONFLUX_CONFIG' && d.config) Object.assign(cfg, d.config);
    });

    // --- Analyse des playlists -----------------------------------------------

    function parseAttrs(s) {
      const out = {};
      const re = /([A-Za-z0-9-]+)=(?:"([^"]*)"|([^,]*))/g;
      let m;
      while ((m = re.exec(s)) !== null) out[m[1].toUpperCase()] = m[2] !== undefined ? m[2] : m[3];
      return out;
    }

    function parseMaster(text) {
      const qualities = [];
      let media = null;
      let inf = null;
      for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#EXT-X-MEDIA:')) { media = parseAttrs(line.slice(13)); continue; }
        if (line.startsWith('#EXT-X-STREAM-INF:')) { inf = parseAttrs(line.slice(18)); continue; }
        if (line.startsWith('#')) continue;
        if (inf) {
          const res = String(inf.RESOLUTION || '0x0').split('x');
          const width = parseInt(res[0], 10) || 0;
          const height = parseInt(res[1], 10) || 0;
          const fps = Math.round(parseFloat(inf['FRAME-RATE'] || '0')) || 0;
          qualities.push({
            // Ancien format : NAME du #EXT-X-MEDIA ("1080p60 (source)").
            // Format du lecteur IVS (2026) : IVS-NAME / STABLE-VARIANT-ID ("1080p60") sur le #EXT-X-STREAM-INF.
            name: (media && media.NAME) || inf['IVS-NAME'] || inf['STABLE-VARIANT-ID'] || inf.VIDEO ||
              (height ? height + 'p' + (fps || '') : 'audio_only'),
            groupId: (media && media['GROUP-ID']) || inf.VIDEO || inf['STABLE-VARIANT-ID'] || '',
            width,
            height,
            fps,
            bandwidth: parseInt(inf.BANDWIDTH || '0', 10) || 0,
            url: line,
          });
        }
        media = null;
        inf = null;
      }
      return qualities;
    }

    function normName(n) { return String(n || '').replace(/\s*\(source\)\s*/i, '').trim().toLowerCase(); }

    // Choisit dans `list` la qualité la plus proche de `want` (même nom, sinon même
    // résolution/fps, sinon la plus haute inférieure ou égale, sinon la meilleure).
    function pickQuality(list, want) {
      if (!list.length) return null;
      if (want) {
        let q = list.find((x) => normName(x.name) === normName(want.name));
        if (q) return q;
        q = list.find((x) => x.height === want.height && x.fps === want.fps);
        if (q) return q;
        const lower = list
          .filter((x) => x.height && want.height && x.height <= want.height)
          .sort((a, b) => b.height - a.height || b.fps - a.fps);
        if (lower.length) return lower[0];
      }
      return list.slice().sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth)[0];
    }

    // --- Flux de secours -------------------------------------------------------

    async function getAccessToken(channel, type) {
      const headers = Object.assign(
        { 'Client-ID': cfg.clientId, 'Content-Type': 'text/plain;charset=UTF-8' },
        state.headers
      );
      const body = JSON.stringify({
        operationName: 'PlaybackAccessToken_Template',
        query:
          'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!, $platform: String!) {' +
          '  streamPlaybackAccessToken(channelName: $login, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }' +
          '  videoPlaybackAccessToken(id: $vodID, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}',
        variables: {
          isLive: true,
          login: channel,
          isVod: false,
          vodID: '',
          playerType: type.playerType,
          platform: type.platform,
        },
      });
      const resp = await realFetch('https://gql.twitch.tv/gql', { method: 'POST', headers, body });
      if (!resp.ok) throw new Error('GQL HTTP ' + resp.status);
      const json = await resp.json();
      const tok = json && json.data && json.data.streamPlaybackAccessToken;
      if (!tok || !tok.value || !tok.signature) {
        throw new Error('GQL sans jeton : ' + JSON.stringify((json && json.errors) || json).slice(0, 200));
      }
      return tok;
    }

    // Récupère, pour un type de lecteur donné, la playlist média de la qualité la plus proche
    // de `want`. On réutilise l'URL usher d'origine (mêmes codecs/paramètres), seuls le
    // jeton et la signature changent.
    function randomHex(bytes) {
      const arr = new Uint8Array(bytes);
      (self.crypto || {}).getRandomValues ? self.crypto.getRandomValues(arr) : arr.forEach((_, i) => { arr[i] = Math.floor(Math.random() * 256); });
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    async function tryType(channel, type, want) {
      const tok = await getAccessToken(channel, type);
      const u = new URL(state.usherUrl);
      u.searchParams.set('sig', tok.signature);
      u.searchParams.set('token', tok.value);
      // Nouvelle session de lecture pour ne pas hériter de la décision publicitaire de la session d'origine.
      u.searchParams.set('p', String(Math.floor(Math.random() * 1e7)));
      if (u.searchParams.has('play_session_id')) u.searchParams.set('play_session_id', randomHex(16));
      const mResp = await realFetch(u.toString());
      if (!mResp.ok) throw new Error('usher HTTP ' + mResp.status);
      const qualities = parseMaster(await mResp.text());
      const q = pickQuality(qualities, want);
      if (!q) throw new Error('aucune qualité dans la playlist maîtresse');
      const pResp = await realFetch(q.url);
      if (!pResp.ok) throw new Error('playlist média HTTP ' + pResp.status);
      const text = await pResp.text();
      return { type, quality: q, text, hasAd: AD_RE.test(text) };
    }

    function typeKey(t) { return t.playerType + '/' + t.platform; }

    async function findBackup(ad, want) {
      const types = [];
      const last = state.lastGoodType.get(ad.channel);
      if (last) types.push(last);
      for (const t of cfg.backupPlayerTypes) if (!types.some((x) => typeKey(x) === typeKey(t))) types.push(t);

      for (const type of types) {
        const key = typeKey(type);
        if (ad.tried.has(key)) continue;
        ad.tried.add(key);
        try {
          const res = await tryType(ad.channel, type, want);
          if (res.hasAd) { log('flux', key, ': contient aussi une pub'); continue; }
          info('pub ' + (ad.isMidroll ? 'mid-roll' : 'pre-roll') + ' bloquée → flux de secours', key, '(' + res.quality.name + ')');
          state.lastGoodType.set(ad.channel, type);
          ad.backup = { type, quality: res.quality };
          return res.text;
        } catch (e) {
          log('flux', key, ': échec,', e && e.message);
        }
      }
      return null;
    }

    // Prévient la page à chaque changement d'état de la pub en cours : flux de secours trouvé
    // (message « Pub bloquée ») ou aucun (masque). Un changement de type de secours en cours de
    // pub ne donne pas de second message.
    function notify(ad, found) {
      if (state.ad !== ad) return;
      const sig = found ? 'found' : 'none';
      if (ad.lastNotified === sig) return;
      ad.lastNotified = sig;
      post({
        key: 'RONFLUX_AD_STATE',
        active: true,
        channel: ad.channel,
        isMidroll: ad.isMidroll,
        backupFound: found,
        backupType: found ? ad.backup.type : null,
        backupQuality: found ? ad.backup.quality.name : null,
        originalQuality: ad.originalQuality ? ad.originalQuality.name : null,
      });
    }

    async function searchBackup(ad, want) {
      if (ad.backup) {
        try {
          const r = await realFetch(ad.backup.quality.url);
          if (r.ok) {
            const t = await r.text();
            if (!AD_RE.test(t)) return t;
            log('le flux de secours contient maintenant une pub, on en cherche un autre');
          }
        } catch (e) {
          log('erreur flux de secours :', e && e.message);
        }
        ad.backup = null;
      }
      if (ad.nextSearchAt && Date.now() < ad.nextSearchAt) return null;
      const text = await findBackup(ad, want);
      if (text != null) { notify(ad, true); return text; }
      ad.tried.clear();
      ad.nextSearchAt = Date.now() + cfg.retryIntervalMs;
      warn('aucun flux de secours sans pub trouvé, nouvel essai dans', Math.round(cfg.retryIntervalMs / 1000), 's');
      notify(ad, false);
      return null;
    }

    // Renvoie le texte d'une playlist sans pub pour la pub en cours, ou null. Les demandes
    // simultanées partagent la même recherche (ad.pending).
    function getBackupPlaylist(ad, want) {
      if (!ad.pending) {
        // ad.pending se vide dans .finally(), qui passe toujours après l'affectation ci-dessous.
        // Un `finally` dans la fonction async s'exécuterait avant elle quand la recherche se
        // termine sans aucun `await` (nouvel essai pas encore permis) : la promesse déjà
        // résolue à null resterait alors en cache jusqu'à la fin de la pub, sans plus aucune
        // recherche.
        const p = searchBackup(ad, want).finally(() => { if (ad.pending === p) ad.pending = null; });
        ad.pending = p;
      }
      return ad.pending;
    }

    // Termine la pub en cours et prévient la page, qui retire le masque et rend le son.
    // channelChanged : la pub est abandonnée parce que le lecteur est passé sur une autre
    // chaîne (navigation, raid) ; la page ne recharge pas alors le lecteur, qui démarre déjà.
    function endAd(channelChanged) {
      const ad = state.ad;
      if (!ad) return;
      state.ad = null;
      const qualityChanged = !!(
        ad.backup && ad.originalQuality &&
        (ad.backup.quality.height !== ad.originalQuality.height || ad.backup.quality.fps !== ad.originalQuality.fps)
      );
      const durationMs = Date.now() - ad.startedAt;
      if (channelChanged) info('changement de chaîne pendant la pub de', ad.channel, ': pub abandonnée');
      else info('fin de la pub après', Math.round(durationMs / 1000), 's');
      post({
        key: 'RONFLUX_AD_STATE',
        active: false,
        channel: ad.channel,
        isMidroll: ad.isMidroll,
        usedBackup: !!ad.backup,
        qualityChanged,
        channelChanged: !!channelChanged,
        durationMs,
      });
    }

    // --- Interception des playlists -------------------------------------------

    function onMaster(url, text) {
      try {
        // /api/channel/hls/<chaîne>.m3u8 (ancien) ou /api/v2/channel/hls/<chaîne>.m3u8 (usherV2,
        // activé compte par compte par Twitch) : seule la partie « /channel/hls/ » est stable.
        const m = url.match(/\/channel\/hls\/([^./?]+)\.m3u8/i);
        const channel = m ? decodeURIComponent(m[1]).toLowerCase() : null;
        if (!channel) { warn('playlist maîtresse non reconnue, pubs non bloquables :', url.split('?')[0]); return; }
        if (state.channel !== channel) endAd(true);
        state.channel = channel;
        state.usherUrl = url;
        state.servedBackup = false;
        state.qualities = parseMaster(text);
        state.byUrl = new Map(state.qualities.map((q) => [q.url, q]));
        log('playlist maîtresse', channel, state.qualities.map((q) => q.name));
      } catch (e) {
        warn('onMaster', e);
      }
    }

    async function handleMedia(input, init, url) {
      const resp = await realFetch(input, init);
      if (!resp.ok) return resp;
      const text = await resp.text();
      const wrap = (t) => new Response(t, { status: resp.status, statusText: resp.statusText, headers: resp.headers });

      if (!AD_RE.test(text)) {
        endAd(false);
        return wrap(state.servedBackup ? toLiveSequence(text) : text);
      }
      if (!state.channel || !state.usherUrl) {
        // Ne jamais laisser passer une pub en silence : sans playlist maîtresse connue, on ne peut
        // pas construire de flux de secours.
        if (!state.warnedNoMaster) {
          state.warnedNoMaster = true;
          warn('pub détectée mais aucune playlist maîtresse connue (URL usher non reconnue ?), pub non bloquée :', url.split('?')[0]);
        }
        return wrap(text);
      }

      const quality = state.byUrl.get(url) || null;
      if (!state.ad) {
        state.ad = {
          channel: state.channel,
          startedAt: Date.now(),
          isMidroll: MIDROLL_RE.test(text),
          originalQuality: quality,
          backup: null,
          tried: new Set(),
          pending: null,
          nextSearchAt: 0,
          lastNotified: null,
        };
        info('pub détectée (' + (state.ad.isMidroll ? 'mid-roll' : 'pre-roll') + ')', quality ? quality.name : '');
      }
      const backup = await getBackupPlaylist(state.ad, quality);
      if (backup != null) state.servedBackup = true;
      return wrap(backup != null ? backup : text);
    }

    // Une session qui reçoit un pre-roll numérote ses segments à partir de 0, quand le flux de
    // secours suit la numérotation du live. Revenu sur le flux d'origine après la pub, le lecteur
    // attendrait des segments plus récents que ceux du secours (image figée, parfois plus d'une
    // minute). La session donne la correspondance avec le live dans #EXT-X-TWITCH-LIVE-SEQUENCE
    // (constaté 2026-11-11) : on la reprend comme numéro de séquence.
    function toLiveSequence(text) {
      const live = text.match(/^#EXT-X-TWITCH-LIVE-SEQUENCE:(\d+)\s*$/m);
      if (!live) return text;
      return text.replace(/^#EXT-X-MEDIA-SEQUENCE:\d+\s*$/m, '#EXT-X-MEDIA-SEQUENCE:' + live[1]);
    }

    // Playlist maîtresse : usher.ttvnw.net/api/channel/hls/<chaîne>.m3u8 (ancien lecteur)
    // ou usher.ttvnw.net/api/v2/channel/hls/<chaîne>.m3u8 (lecteur IVS, 2026).
    function isMasterPlaylistUrl(url) {
      return url.includes('usher.ttvnw.net') && /\/channel\/hls\//i.test(url);
    }

    // Playlist média : URL listée dans la playlist maîtresse, ou formes connues
    // (<cluster>.playlist.ttvnw.net/v1/playlist/… depuis 2026, video-weaver….m3u8 auparavant).
    function isMediaPlaylistUrl(url) {
      if (state.byUrl.has(url)) return true;
      if (url.includes('ttvnw.net') && /\/v1\/playlist\//i.test(url)) return true;
      return url.includes('video-weaver') && url.includes('.m3u8');
    }

    self.fetch = async function (input, init) {
      let url = '';
      try {
        url = typeof input === 'string' ? input : (input && input.url) || String(input);
      } catch (e) { /* ignoré */ }
      try {
        if (isMasterPlaylistUrl(url)) {
          const resp = await realFetch(input, init);
          if (!resp.ok) return resp;
          const text = await resp.text();
          onMaster(url, text);
          return new Response(text, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
        }
        if (isMediaPlaylistUrl(url)) {
          return await handleMedia(input, init, url);
        }
      } catch (e) {
        warn('erreur dans le hook fetch, requête relancée telle quelle :', e);
      }
      return realFetch(input, init);
    };

    info('hook installé dans le worker du lecteur');
  }

  // ===========================================================================
  // Côté page
  // ===========================================================================

  // --- En-têtes GraphQL (Authorization, Client-Integrity, Device-Id…) -----------
  // Capturées sur les requêtes gql.twitch.tv de la page et transmises aux workers,
  // pour que les demandes de jeton de secours ressemblent à celles du site.
  const WANTED_HEADERS = ['authorization', 'client-integrity', 'client-session-id', 'client-version', 'x-device-id', 'device-id'];
  const capturedHeaders = {};

  function cookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  (function seedHeadersFromCookies() {
    try {
      const auth = cookie('auth-token');
      if (auth) capturedHeaders['authorization'] = 'OAuth ' + auth;
      const dev = cookie('unique_id');
      if (dev) capturedHeaders['x-device-id'] = dev;
    } catch (e) { /* ignoré */ }
  })();

  const workers = new Set();
  function broadcastHeaders() {
    for (const w of workers) {
      try { w.postMessage({ key: 'RONFLUX_HEADERS', headers: capturedHeaders }); } catch (e) { /* ignoré */ }
    }
  }

  // Réécrit la demande de jeton du lecteur principal (playerType « site ») vers
  // CONFIG.forceMainPlayerType. Renvoie le nouveau corps de requête, ou null si rien à changer.
  function rewriteMainTokenBody(body) {
    const want = CONFIG.forceMainPlayerType;
    if (!want || typeof body !== 'string' || !body.includes('PlaybackAccessToken')) return null;
    const json = JSON.parse(body);
    const entries = Array.isArray(json) ? json : [json];
    let replaced = null;
    for (const entry of entries) {
      const vars = entry && entry.variables;
      if (vars && vars.isLive !== false && vars.playerType === 'site' && vars.playerType !== want) {
        replaced = vars.playerType;
        vars.playerType = want;
      }
    }
    if (!replaced) return null;
    info('flux principal demandé en « ' + want + ' » au lieu de « ' + replaced + ' » (pas de pre-roll)');
    return JSON.stringify(json);
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.startsWith('https://gql.twitch.tv/')) {
        const h = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
        let changed = false;
        for (const name of WANTED_HEADERS) {
          const v = h.get(name);
          if (v && capturedHeaders[name] !== v) { capturedHeaders[name] = v; changed = true; }
        }
        if (changed) broadcastHeaders();
        const body = rewriteMainTokenBody(init && init.body);
        if (body != null) return origFetch.call(this, input, Object.assign({}, init, { body }));
      }
    } catch (e) { /* ignoré */ }
    return origFetch.apply(this, arguments);
  };

  // --- Enveloppe du worker du lecteur ------------------------------------------

  function isTwitchWorkerUrl(u) {
    try {
      const parsed = new URL(u, location.href);
      let host = parsed.hostname;
      if (parsed.protocol === 'blob:') host = new URL(parsed.pathname).hostname;
      return /(^|\.)(twitch\.tv|twitchcdn\.net|jtvnw\.net|ttvnw\.net)$/i.test(host);
    } catch (e) {
      return false;
    }
  }

  function fetchSync(u) {
    const x = new XMLHttpRequest();
    x.open('GET', u, false);
    x.overrideMimeType('text/plain'); // évite que Firefox tente d'interpréter le code comme du XML
    x.send();
    if (x.status === 0 || (x.status >= 200 && x.status < 300)) return x.responseText;
    throw new Error('HTTP ' + x.status);
  }

  function workerConfig() {
    return {
      debug: CONFIG.debug,
      clientId: CONFIG.clientId,
      backupPlayerTypes: CONFIG.backupPlayerTypes,
      retryIntervalMs: CONFIG.retryIntervalMs,
      headers: capturedHeaders,
    };
  }

  let wrappedCount = 0; // workers enveloppés depuis le chargement, terminés compris
  const OrigWorker = window.Worker;
  window.Worker = class Worker extends OrigWorker {
    constructor(url, options) {
      const urlStr = String(url);
      let script = null;
      if (isTwitchWorkerUrl(urlStr)) {
        const isModule = !!(options && options.type === 'module');
        let original = null;
        try { original = fetchSync(urlStr); } catch (e) { log('lecture du script worker impossible, importScripts en secours :', e.message); }
        const prefix = '(' + workerMain.toString() + ')(' + JSON.stringify(workerConfig()) + ');\n';
        const body = original != null
          ? original
          : (isModule ? 'import ' + JSON.stringify(urlStr) + ';' : 'importScripts(' + JSON.stringify(urlStr) + ');');
        script = prefix + body;
      }
      if (script == null) { super(url, options); return; }
      const blobUrl = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
      super(blobUrl, options);
      workers.add(this);
      wrappedCount++;
      this.addEventListener('message', (ev) => onWorkerMessage(this, ev));
      info('worker Twitch enveloppé');
    }
    terminate() {
      workers.delete(this);
      // Un worker terminé pendant une pub n'enverra plus la fin de la pub : on retire nous-mêmes
      // le masque et la coupure du son qu'il avait demandés.
      setMasked(this, false);
      return super.terminate();
    }
  };

  // --- Interface : overlay, notifications, rechargement -------------------------

  const STYLE_ID = 'ronflux-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '.ronflux-overlay{position:absolute;inset:0;z-index:2147483000;background:#0e0e10;color:#efeff1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font:15px/1.4 Inter,Roobert,Helvetica,Arial,sans-serif;text-align:center;padding:16px}' +
      '.ronflux-overlay b{font-size:20px}' +
      '.ronflux-toast{position:absolute;left:12px;bottom:72px;z-index:2147483001;background:rgba(14,14,16,.92);color:#efeff1;padding:8px 12px;border-radius:6px;font:13px Inter,Roobert,Helvetica,Arial,sans-serif;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);opacity:0;transition:opacity .3s}' +
      '.ronflux-toast.ronflux-show{opacity:1}';
    (document.head || document.documentElement).appendChild(s);
  }

  function getPlayerContainer() {
    const video = document.querySelector('video');
    const c =
      document.querySelector('.video-player__container') ||
      document.querySelector('[data-a-target="video-player"]') ||
      (video && video.parentElement);
    if (c && getComputedStyle(c).position === 'static') c.style.position = 'relative';
    return c || null;
  }

  let overlayEl = null;
  let mutedByUs = false;
  function showOverlay() {
    ensureStyle();
    const c = getPlayerContainer();
    if (!c) return;
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'ronflux-overlay';
      overlayEl.innerHTML = '<b>Pub masquée</b><span>Le live et le son reviennent à la fin de la pub.</span>';
    }
    if (overlayEl.parentElement !== c) c.appendChild(overlayEl);
    const video = document.querySelector('video');
    if (video && !video.muted) { video.muted = true; mutedByUs = true; }
  }
  function hideOverlay() {
    if (overlayEl && overlayEl.parentElement) overlayEl.parentElement.removeChild(overlayEl);
    if (mutedByUs) {
      const video = document.querySelector('video');
      if (video) video.muted = false;
      mutedByUs = false;
    }
  }

  // Workers dont la pub en cours n'a pas de flux de secours : le masque reste tant qu'il y en a un.
  const maskingWorkers = new Set();
  function setMasked(worker, masked) {
    if (masked) maskingWorkers.add(worker);
    else maskingWorkers.delete(worker);
    if (maskingWorkers.size > 0 && CONFIG.hidePlayerOnUnblockedAd) showOverlay();
    else hideOverlay();
  }

  let toastEl = null;
  let toastTimer = 0;
  function toast(text, durationMs) {
    if (!CONFIG.showNotifications) return;
    ensureStyle();
    const c = getPlayerContainer();
    if (!c) return;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ronflux-toast'; }
    toastEl.textContent = text;
    if (toastEl.parentElement !== c) c.appendChild(toastEl);
    // Pas de requestAnimationFrame ici : le navigateur le suspend dans un onglet caché ou une
    // fenêtre recouverte, mais pas les minuteurs. Le masquage passait alors avant l'affichage et
    // le message restait à l'écran au retour sur l'onglet. Lire offsetWidth applique l'opacité 0
    // de départ, pour que la transition d'apparition joue quand même.
    void toastEl.offsetWidth;
    toastEl.classList.add('ronflux-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (toastEl) toastEl.classList.remove('ronflux-show'); }, durationMs || 4000);
  }

  function findReactRoot() {
    const el = document.querySelector('#root');
    if (!el) return null;
    if (el._reactRootContainer && el._reactRootContainer._internalRoot) return el._reactRootContainer._internalRoot.current;
    const key = Object.keys(el).find((k) => k.startsWith('__reactContainer'));
    return key ? el[key] : null;
  }

  function findReactNode(root, predicate) {
    const stack = [root];
    let n = 0;
    while (stack.length && n++ < 500000) {
      const fiber = stack.pop();
      if (!fiber) continue;
      try {
        if (fiber.stateNode && predicate(fiber.stateNode)) return fiber.stateNode;
      } catch (e) { /* ignoré */ }
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    return null;
  }

  // Recharge le lecteur via l'état React interne de Twitch (même mécanisme que le bouton
  // « qualité »). Si l'interne a changé, on se contente d'un avertissement.
  function reloadPlayer() {
    try {
      const root = findReactRoot();
      if (!root) { warn('racine React introuvable, lecteur non rechargé'); return false; }
      const playerState = findReactNode(root, (s) => typeof s.setSrc === 'function' && typeof s.setInitialPlaybackSettings === 'function');
      if (playerState) {
        playerState.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
        info('lecteur rechargé');
        return true;
      }
      warn('composant lecteur introuvable, lecteur non rechargé');
    } catch (e) {
      warn('rechargement du lecteur impossible :', e);
    }
    return false;
  }

  // Le rechargement demande un nouveau jeton, donc une nouvelle session de lecture, et Twitch
  // sert un pre-roll à chaque nouvelle session tant qu'aucune pub n'a été vue. Recharger après
  // un pre-roll en ferait servir un autre, sans fin, et le lecteur resterait sur le flux de
  // secours (360p) : on ne recharge pas après un pre-roll. Si un pre-roll suit l'un de nos
  // rechargements, cette page en reçoit un à chaque session : on ne recharge plus non plus après
  // un mid-roll.
  const PREROLL_AFTER_RELOAD_MS = 30000;
  let lastReloadAt = 0;
  let reloadBringsPreroll = false;
  function notePrerollAfterReload(d) {
    if (reloadBringsPreroll || d.isMidroll || !lastReloadAt) return;
    if (Date.now() - lastReloadAt > PREROLL_AFTER_RELOAD_MS) return;
    reloadBringsPreroll = true;
    info('pre-roll servi après le rechargement du lecteur : plus de rechargement après les pubs sur cette page');
  }
  function maybeReloadAfterAd(d) {
    const mode = CONFIG.reloadPlayerAfterAd;
    if (mode === 'never' || !d.usedBackup) return;
    if (mode === 'quality-changed' && !d.qualityChanged) return;
    if (!d.isMidroll) { log('pas de rechargement après un pre-roll'); return; }
    if (reloadBringsPreroll) { log('rechargement ignoré (il ferait servir un pre-roll)'); return; }
    const now = Date.now();
    if (now - lastReloadAt < CONFIG.minReloadIntervalMs) { log('rechargement ignoré (trop récent)'); return; }
    lastReloadAt = now;
    reloadPlayer();
  }

  // Le détail (type de pub, flux de secours, qualité) est dans la console du worker ; le lecteur
  // n'affiche qu'un message court.
  function onWorkerMessage(worker, ev) {
    const d = ev.data;
    if (!d || d.key !== 'RONFLUX_AD_STATE') return;
    if (d.active) notePrerollAfterReload(d);
    if (d.active && !d.backupFound) { setMasked(worker, true); return; }
    setMasked(worker, false);
    if (d.active) toast('Pub bloquée');
    else if (!d.channelChanged) maybeReloadAfterAd(d);
  }

  // --- Détection d'une injection trop tardive ----------------------------------
  // Twitch crée le worker du lecteur dans la première seconde du chargement. Si le lecteur
  // tourne alors qu'aucun worker n'a été enveloppé, le script s'est exécuté après : rien ne
  // peut être bloqué sur cette page. On le signale clairement (console + message dans le lecteur).
  (function watchLateInjection() {
    let checks = 0;
    const timer = setInterval(() => {
      if (wrappedCount > 0 || ++checks > 24) { clearInterval(timer); return; }
      const video = document.querySelector('video');
      if (!video || video.readyState === 0) return;
      clearInterval(timer);
      warn('le lecteur tourne mais aucun worker n’a été enveloppé : le script a été chargé trop tard. ' +
        'Avec Tampermonkey, choisir le mode d’injection « Instantané » (Paramètres), ou installer ' +
        'l’extension Ronflux à la place du userscript (voir le README).');
      toast('Ronflux s’est lancé trop tard. Rechargez la page pour bloquer les pubs.', 8000);
    }, 5000);
  })();

  // --- API de diagnostic --------------------------------------------------------
  window.__ronflux = {
    version: VERSION,
    config: CONFIG,
    get workerCount() { return workers.size; },
    get headers() { return Object.assign({}, capturedHeaders); },
    setDebug(v) {
      CONFIG.debug = !!v;
      for (const w of workers) { try { w.postMessage({ key: 'RONFLUX_CONFIG', config: { debug: CONFIG.debug } }); } catch (e) { /* ignoré */ } }
    },
    reloadPlayer,
  };

  info('v' + VERSION + ' chargé');
})();
