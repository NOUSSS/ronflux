'use strict';
// Banc d'essai de Ronflux, sans dépendance.
//
// Exécute src/ronflux.user.js dans une page Twitch simulée (contexte vm de Node) : faux DOM
// (conteneur du lecteur, <video>, racine React), horloge et minuteurs pilotés par le test,
// requestAnimationFrame qui ne tourne que sur demande (comme dans un onglet caché).
//
// Quand le test « crée le worker du lecteur », c'est l'enveloppe de Ronflux qui construit son
// script (workerMain sérialisé par toString() + code Twitch d'origine) ; ce script tourne dans
// un second contexte vm, séparé de la page, avec un `self` simulé (fetch, postMessage,
// addEventListener). Une référence de workerMain à une variable de la page y lève donc une
// erreur, comme dans le navigateur. Le fetch de ce worker interroge un faux réseau Twitch :
// GraphQL (jetons), usher (playlists maîtresses) et playlists média, avec ou sans pub selon
// `net.adFor(chaîne, type)`.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'src', 'ronflux.user.js'), 'utf8');
const VERBOSE = !!process.env.VERBOSE;

const AD_MARKER = 'CLASS="twitch-stitched-ad"';
const QUALITIES = [
  { name: '1080p60', width: 1920, height: 1080, fps: 60, bandwidth: 6500000 },
  { name: '720p60', width: 1280, height: 720, fps: 60, bandwidth: 3400000 },
  { name: '480p30', width: 852, height: 480, fps: 30, bandwidth: 1400000 },
];

// --- Horloge ------------------------------------------------------------------------------
// Date.now, minuteurs et images (requestAnimationFrame) n'avancent que sur demande du test.
function createClock() {
  let now = Date.UTC(2026, 10, 6, 20, 0, 0);
  let lastId = 0;
  const timers = new Map();
  const frames = [];
  return {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++lastId;
      timers.set(id, { at: now + Math.max(0, Number(ms) || 0), every: 0, fn });
      return id;
    },
    setInterval: (fn, ms) => {
      const every = Math.max(1, Number(ms) || 0);
      const id = ++lastId;
      timers.set(id, { at: now + every, every, fn });
      return id;
    },
    clearTimer: (id) => { timers.delete(id); },
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    // Dessine les images en attente, comme au retour sur un onglet caché.
    runFrames() { for (const fn of frames.splice(0)) fn(now); },
    // Avance le temps en exécutant les minuteurs échus, dans l'ordre.
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let id = null;
        let next = null;
        for (const [k, t] of timers) if (t.at <= end && (!next || t.at < next.at)) { id = k; next = t; }
        if (!next) break;
        now = next.at;
        if (next.every) next.at += next.every;
        else timers.delete(id);
        next.fn();
      }
      now = end;
    },
  };
}

function setClock(context, clock) {
  vm.runInContext('Date', context).now = clock.now;
}

// --- Journal --------------------------------------------------------------------------------
function makeConsole(logs, where) {
  const out = {};
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    out[level] = (...args) => {
      const text = args.map((a) => {
        if (typeof a === 'string') return a;
        if (a && a.stack) return a.stack;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(' ');
      logs.push({ where, level, text });
      if (VERBOSE) console.log('  [' + where + ':' + level + ']', text);
    };
  }
  return out;
}

// --- Faux réseau Twitch ---------------------------------------------------------------------
function mediaUrl(channel, type, quality) {
  return 'https://use1.playlist.ttvnw.net/v1/playlist/' + channel + '/' + encodeURIComponent(type) + '/' + quality + '.m3u8';
}

function masterPlaylist(channel, type) {
  // Format du lecteur IVS (2026) : pas de #EXT-X-MEDIA, nom de qualité dans IVS-NAME.
  const lines = ['#EXTM3U', '#EXT-X-TWITCH-INFO:NODE="video-edge-test",MANIFEST-CLUSTER="test"'];
  for (const q of QUALITIES) {
    lines.push(
      '#EXT-X-STREAM-INF:BANDWIDTH=' + q.bandwidth + ',RESOLUTION=' + q.width + 'x' + q.height +
      ',CODECS="avc1.64002A,mp4a.40.2",FRAME-RATE=' + q.fps + '.000,IVS-NAME="' + q.name +
      '",STABLE-VARIANT-ID="' + q.name + '"'
    );
    lines.push(mediaUrl(channel, type, q.name));
  }
  return lines.join('\n') + '\n';
}

function mediaPlaylist(channel, type, quality, ad) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:2', '#EXT-X-MEDIA-SEQUENCE:500'];
  if (ad) {
    lines.push(
      '#EXT-X-DATERANGE:ID="stitched-ad-1",' + AD_MARKER + ',START-DATE="2026-11-06T20:00:00.000Z",' +
      'DURATION=30.000,X-TV-TWITCH-AD-ROLL-TYPE="' + (ad === 'preroll' ? 'PREROLL' : 'MIDROLL') + '"'
    );
    lines.push('#EXTINF:2.000,Amazon', 'https://ads.test/segment-1.ts');
  } else {
    lines.push('#EXTINF:2.000,live', 'https://video-edge.test/' + channel + '/' + encodeURIComponent(type) + '/' + quality + '/1.ts');
  }
  return lines.join('\n') + '\n';
}

// Ce que le lecteur a reçu : une pub, ou le live de telle chaîne, tel type, telle qualité.
function describe(text) {
  if (text.includes(AD_MARKER)) return { ad: true };
  const m = text.match(/https:\/\/video-edge\.test\/([^/]+)\/([^/]+)\/([^/]+)\/\d+\.ts/);
  if (!m) throw new Error('playlist inattendue :\n' + text);
  return { ad: false, channel: m[1], type: decodeURIComponent(m[2]), quality: m[3] };
}

function createNetwork() {
  const text = (body) => new Response(body, { status: 200, headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
  const net = {
    // (chaîne, type) -> false | 'midroll' | 'preroll'. Type « main » : le flux du lecteur ;
    // « popout/web », « site/ios »… : les flux de secours demandés par Ronflux.
    adFor: () => false,
    log: [],
    count(kind) { return net.log.filter((r) => r.kind === kind).length; },
    async fetch(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const u = new URL(url);
      if (u.hostname === 'gql.twitch.tv') {
        const v = JSON.parse(init.body).variables;
        const type = v.playerType + '/' + v.platform;
        net.log.push({ kind: 'gql', channel: v.login, type });
        const token = { value: JSON.stringify({ channel: v.login, type }), signature: 'sig-test', __typename: 'PlaybackAccessToken' };
        return new Response(JSON.stringify({ data: { streamPlaybackAccessToken: token } }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      if (u.hostname === 'usher.ttvnw.net') {
        const m = u.pathname.match(/\/channel\/hls\/([^./]+)\.m3u8$/);
        if (!m) return new Response('', { status: 404 });
        let type = 'main';
        try { type = JSON.parse(u.searchParams.get('token')).type; } catch (e) { /* jeton de la page */ }
        net.log.push({ kind: 'master', channel: m[1], type });
        return text(masterPlaylist(m[1], type));
      }
      const m = u.pathname.match(/^\/v1\/playlist\/([^/]+)\/([^/]+)\/([^/]+)\.m3u8$/);
      if (u.hostname.endsWith('.playlist.ttvnw.net') && m) {
        const type = decodeURIComponent(m[2]);
        net.log.push({ kind: 'media', channel: m[1], type, quality: m[3] });
        return text(mediaPlaylist(m[1], type, m[3], net.adFor(m[1], type)));
      }
      return new Response('', { status: 404 });
    },
  };
  return net;
}

// --- Faux DOM ---------------------------------------------------------------------------------
function matches(el, sel) {
  let m;
  if ((m = sel.match(/^\.([\w-]+)$/))) return el.classes.has(m[1]);
  if ((m = sel.match(/^#([\w-]+)$/))) return el.id === m[1];
  if ((m = sel.match(/^\[([\w-]+)="([^"]*)"\]$/))) return el.attrs[m[1]] === m[2];
  if (/^[a-z]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
  throw new Error('sélecteur non géré par le faux DOM : ' + sel);
}

class FakeElement {
  constructor(tagName, attrs) {
    this.tagName = tagName.toUpperCase();
    this.attrs = Object.assign({}, attrs);
    this.id = this.attrs.id || '';
    this.parentElement = null;
    this.children = [];
    this.style = {};
    this.classes = new Set(String(this.attrs.class || '').split(/\s+/).filter(Boolean));
    this.classAdds = [];
    const el = this;
    this.classList = {
      add(c) { el.classes.add(c); el.classAdds.push(c); },
      remove(c) { el.classes.delete(c); },
      contains(c) { return el.classes.has(c); },
    };
    this.ownText = '';
    this.html = '';
  }
  get className() { return Array.from(this.classes).join(' '); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this.ownText + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.ownText = String(v); this.children = []; }
  get innerHTML() { return this.html; }
  set innerHTML(v) {
    this.html = String(v);
    this.ownText = this.html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
    this.children = [];
  }
  get offsetWidth() { return 320; }
  get isConnected() {
    let n = this;
    while (n.parentElement) n = n.parentElement;
    return n.tagName === 'HTML';
  }
  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
    return child;
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (matches(c, sel)) return c;
      const found = c.querySelector(sel);
      if (found) return found;
    }
    return null;
  }
}

function createDom() {
  const html = new FakeElement('html');
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  html.appendChild(head);
  html.appendChild(body);
  const root = new FakeElement('div', { id: 'root' });
  const container = new FakeElement('div', { class: 'video-player__container' });
  const video = new FakeElement('video');
  video.muted = false;
  video.readyState = 4;
  body.appendChild(root);
  root.appendChild(container);
  container.appendChild(video);
  // Racine React avec le composant du lecteur, que reloadPlayer() cherche.
  const reloads = [];
  const playerState = { setSrc: (o) => reloads.push(o), setInitialPlaybackSettings() {} };
  root._reactRootContainer = { _internalRoot: { current: { stateNode: null, child: { stateNode: playerState } } } };
  const document = {
    cookie: '',
    documentElement: html,
    head,
    body,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => html.querySelector('#' + id),
    querySelector: (sel) => html.querySelector(sel),
  };
  return { document, container, video, reloads };
}

// --- Environnement complet : page + worker du lecteur -------------------------------------------
function createEnv() {
  const clock = createClock();
  const net = createNetwork();
  const logs = [];
  const dom = createDom();
  const blobs = new Map(); // URL blob: -> code
  let blobId = 0;

  function createWorkerScope(code, toPage) {
    const listeners = [];
    const g = {
      console: makeConsole(logs, 'worker'),
      fetch: (input, init) => net.fetch(input, init),
      postMessage: (data) => toPage(structuredClone(data)),
      addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); },
      Response, Request, Headers, URL,
      crypto: globalThis.crypto,
    };
    g.self = g;
    const context = vm.createContext(g);
    setClock(context, clock);
    vm.runInContext(code, context, { filename: 'worker-du-lecteur.js' });
    return {
      global: g,
      receive(data) {
        const copy = structuredClone(data);
        setImmediate(() => { for (const fn of listeners) fn({ data: copy }); });
      },
      // Requête du lecteur : passe par le fetch du worker, donc par le hook de Ronflux.
      async load(url) { return (await g.fetch(url)).text(); },
    };
  }

  // Worker du navigateur. Exécute le script de son URL blob: s'il est connu.
  class FakeWorker {
    constructor(url) {
      this.terminated = false;
      this.pageListeners = [];
      this.scope = null;
      const code = blobs.get(String(url));
      if (code != null) {
        this.scope = createWorkerScope(code, (data) => setImmediate(() => {
          if (this.terminated) return;
          for (const fn of this.pageListeners.slice()) fn.call(this, { data, target: this, currentTarget: this });
        }));
      }
    }
    addEventListener(type, fn) { if (type === 'message') this.pageListeners.push(fn); }
    removeEventListener(type, fn) { this.pageListeners = this.pageListeners.filter((f) => f !== fn); }
    postMessage(data) { if (!this.terminated && this.scope) this.scope.receive(data); }
    terminate() { this.terminated = true; }
  }

  class FakeBlob {
    constructor(parts, options) { this.content = parts.join(''); this.type = options && options.type; }
  }
  class PageURL extends URL {
    static createObjectURL(blob) {
      const url = 'blob:https://www.twitch.tv/ronflux-' + (++blobId);
      blobs.set(url, blob.content);
      return url;
    }
    static revokeObjectURL() {}
  }
  class FakeXHR {
    open(method, url) { this.url = url; }
    overrideMimeType() {}
    send() {
      const code = blobs.get(this.url);
      this.status = code == null ? 404 : 200;
      this.responseText = code == null ? '' : code;
    }
  }

  const win = {
    console: makeConsole(logs, 'page'),
    document: dom.document,
    location: { href: 'https://www.twitch.tv/chan1' },
    fetch: async () => new Response('{}', { status: 200 }),
    Worker: FakeWorker,
    XMLHttpRequest: FakeXHR,
    Blob: FakeBlob,
    URL: PageURL,
    Headers, Request, Response,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimer,
    setInterval: clock.setInterval,
    clearInterval: clock.clearTimer,
    requestAnimationFrame: clock.requestAnimationFrame,
    getComputedStyle: (el) => ({ position: el.style.position || 'static' }),
  };
  win.window = win;
  win.self = win;
  const pageContext = vm.createContext(win);
  setClock(pageContext, clock);
  vm.runInContext(SOURCE, pageContext, { filename: 'ronflux.user.js' });

  const env = {
    clock,
    net,
    logs,
    dom,
    window: win,
    // Laisse passer les messages entre worker et page (remis de façon asynchrone).
    async settle() { for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r)); },
    // Texte du masque affiché sur le lecteur, ou null.
    overlay() {
      const el = dom.document.querySelector('.ronflux-overlay');
      return el ? el.textContent : null;
    },
    // Texte du message visible dans le lecteur, ou null.
    toast() {
      const el = dom.document.querySelector('.ronflux-toast');
      return el && el.classes.has('ronflux-show') ? el.textContent : null;
    },
    // Nombre de fois où un message a été affiché.
    toastCount() {
      const el = dom.document.querySelector('.ronflux-toast');
      return el ? el.classAdds.filter((c) => c === 'ronflux-show').length : 0;
    },
    warnings(where) {
      return logs.filter((l) => (l.level === 'warn' || l.level === 'error') && (!where || l.where === where)).map((l) => l.text);
    },
    // La page Twitch crée le worker du lecteur (blob: + code d'origine), comme le lecteur IVS.
    startPlayer() {
      const url = 'blob:https://www.twitch.tv/ivs-worker-' + (++blobId);
      blobs.set(url, 'self.__twitchWorkerLoaded = true;');
      return new Player(env, new win.Worker(url));
    },
  };
  return env;
}

// Lecteur Twitch simulé : ses requêtes passent par le fetch du worker enveloppé.
class Player {
  constructor(env, worker) {
    this.env = env;
    this.worker = worker;
    this.channel = null;
    if (!worker.scope) throw new Error('le worker du lecteur n’a pas été enveloppé');
  }
  get global() { return this.worker.scope.global; }
  async loadChannel(channel, { v2 = false } = {}) {
    this.channel = channel;
    const url = 'https://usher.ttvnw.net/api/' + (v2 ? 'v2/' : '') + 'channel/hls/' + channel + '.m3u8' +
      '?allow_source=true&p=1234567&play_session_id=0123456789abcdef0123456789abcdef&sig=main-sig&token=main-token';
    await this.worker.scope.load(url);
    await this.env.settle();
  }
  // Une lecture de la playlist média, comme le lecteur toutes les deux secondes.
  async poll(quality = '1080p60') {
    const text = await this.worker.scope.load(mediaUrl(this.channel, 'main', quality));
    await this.env.settle();
    return describe(text);
  }
  terminate() { this.worker.terminate(); }
}

// Règles des textes affichés dans le lecteur : espace insécable avant « : ; ? ! » et à
// l'intérieur des guillemets, apostrophe typographique, « … », ni tiret cadratin ni point
// d'exclamation.
function uiTextProblems(text) {
  const problems = [];
  if (/!/.test(text)) problems.push('point d’exclamation');
  if (/—/.test(text)) problems.push('tiret cadratin');
  if (/'/.test(text)) problems.push('apostrophe droite');
  if (/\.\.\./.test(text)) problems.push('« ... » au lieu de « … »');
  if (/(^|[^  ])[:;?]/.test(text)) problems.push('pas d’espace insécable avant « : ; ? »');
  if (/«[^  ]|[^  ]»/.test(text)) problems.push('pas d’espace insécable dans les guillemets');
  return problems;
}

module.exports = { createEnv, uiTextProblems, AD_MARKER };
