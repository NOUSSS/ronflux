# Ronflux

Bloque les publicités vidéo (pre-roll et mid-roll) des lives Twitch. Disponible en trois formats
qui partagent exactement le même code, téléchargeables sur le site (`https://ronflux.feitanx.com`,
adresse réglée dans `distribution.json`) :

| Paquet | Pour | Mises à jour |
|---|---|---|
| `ronflux-firefox.xpi` | Firefox 140+ et dérivés (Zen, LibreWolf…), signé par Mozilla | automatiques (`updates.json` du site) |
| `ronflux-chrome.zip` | Chrome 111+, Brave, Edge, Opera : Chrome Web Store ou mode développeur | automatiques par le store, à la main en mode développeur |
| `ronflux.user.js` | Tampermonkey / Violentmonkey | automatiques (`@updateURL`) |

La source unique est `src/ronflux.user.js` : `build.ps1` en tire les trois paquets dans `dist/`
(ignoré par git).

N'installez **qu'un seul** des trois : si plusieurs sont présents, un seul reste actif.

## Comment ça marche

Twitch ne charge pas ses pubs vidéo depuis un domaine publicitaire : elles sont « cousues »
(*stitched*) directement dans la playlist HLS du live, ce qui rend inefficace un blocage par
domaine classique. Le script agit donc au niveau du lecteur :

0. La page demande un jeton d'accès GraphQL (`PlaybackAccessToken`) avec le type de lecteur
   `site`. Le script réécrit cette requête pour demander le type `popout`, auquel Twitch ne sert
   pas de pre-roll (constaté le 3 octobre 2026) : la plupart des pubs disparaissent avant même
   d'avoir à changer de flux. Option `forceMainPlayerType`.
1. Le lecteur Twitch (Amazon IVS Player SDK depuis 2026) tourne dans un Web Worker créé une seule
   fois au démarrage de la page. Le script remplace `window.Worker` pour envelopper ce worker et y
   installer un hook sur `fetch()`. Il doit donc s'exécuter avant tout script Twitch
   (`@run-at document-start` / `run_at: document_start`).
2. Dans le worker, chaque playlist est inspectée : playlist maîtresse
   (`usher.ttvnw.net/api/v2/channel/hls/<chaîne>.m3u8` quand Twitch active `usherV2` sur le
   compte, sinon `/api/channel/hls/`) et playlists média (`*.playlist.ttvnw.net/v1/playlist/…`,
   ou `video-weaver….m3u8`).
   Si une playlist média contient des marqueurs de pub
   (`#EXT-X-DATERANGE … CLASS="twitch-stitched-ad"`), le script demande un jeton d'accès pour un
   autre type de lecteur (`embed`, `popout`, `frontpage`…) qui ne reçoit pas de pub, récupère la
   playlist correspondante à la même qualité et la renvoie au lecteur à la place.
3. À la fin de la pub, le flux d'origine reprend et le lecteur est rechargé pour se resynchroniser.
4. Si aucun flux de secours sans pub n'est trouvé, le lecteur est masqué et le son coupé le temps
   de la pub, et une nouvelle recherche est lancée toutes les 10 s (configurable).

Les extensions bloquent en plus, sur les pages Twitch uniquement, quelques domaines de
bannières et de mesure publicitaire (`rules.json`).

## Installation

Les liens ci-dessous partent du site, `https://ronflux.feitanx.com`.

### Firefox (et Zen, LibreWolf, Floorp…)

1. Ouvrir `https://ronflux.feitanx.com/telecharger/ronflux-firefox.xpi` (le lien Firefox du site).
2. Firefox indique qu'il a bloqué l'installation depuis ce site : « Continuer vers
   l'installation », puis « Ajouter ».
3. Recharger les onglets Twitch.

Le paquet est signé par Mozilla sur le canal non répertorié d'addons.mozilla.org (signé, sans
fiche publique) : il s'installe sur Firefox stable sans rien changer dans `about:config`. Firefox
consulte chaque jour `https://ronflux.feitanx.com/updates.json` et installe seul les nouvelles
versions (`about:addons` → roue dentée → « Rechercher des mises à jour » pour ne pas attendre).

Firefox 140 ou plus récent (142 sur Android).

### Chrome, Brave, Edge, Opera

**Chrome Web Store**, dès que la fiche est acceptée : ouvrir le lien de la fiche depuis le site,
puis « Ajouter à Chrome ». La fiche est non répertoriée : la recherche du store ne la montre pas,
seul ce lien y mène. Les mises à jour arrivent toutes seules. Brave l'installe directement, Edge
demande d'autoriser les extensions d'autres boutiques, Opera passe par son module « Install Chrome
Extensions ».

**Mode développeur**, en attendant la fiche ou sans le store :

1. Télécharger `ronflux-chrome.zip` et le décompresser dans un dossier qui restera en place : le
   navigateur recharge l'extension depuis ce dossier à chaque démarrage.
2. Ouvrir `chrome://extensions` (`brave://extensions`, `edge://extensions`,
   `opera://extensions`) et activer le « Mode développeur ».
3. « Charger l'extension non empaquetée » → choisir le dossier (celui qui contient
   `manifest.json`).
4. Recharger les onglets Twitch.

Pas de mise à jour automatique dans ce mode : pour une nouvelle version, remplacer le contenu du
dossier par celui du nouveau ZIP, puis cliquer sur « Actualiser » (flèche circulaire) sur la carte
de Ronflux. Chrome peut rappeler au démarrage que des extensions en mode développeur sont
actives.

Chrome 111 ou plus récent (nécessaire pour `world: "MAIN"`).

### Userscript (Tampermonkey / Violentmonkey)

1. Installer [Tampermonkey](https://www.tampermonkey.net/) ou [Violentmonkey](https://violentmonkey.github.io/).
2. Ouvrir `https://ronflux.feitanx.com/telecharger/ronflux.user.js` : l'extension propose
   l'installation.
3. Recharger Twitch.

Le gestionnaire consulte régulièrement cette même adresse (`@updateURL`) et met le script à jour.
Greasemonkey n'est pas pris en charge (il isole le script de la page, ce qui empêche d'envelopper
le worker). Pour Tampermonkey, voir aussi le mode d'injection dans Diagnostic.

### Développement

- **Firefox, chargement temporaire** : `about:debugging#/runtime/this-firefox` → « Charger un
  module complémentaire temporaire… » → `dist/firefox/manifest.json`. Disparaît à la fermeture de
  Firefox.
- **Chrome** : « Charger l'extension non empaquetée » sur `dist/chrome/`, puis « Actualiser »
  après chaque build.
- **Zen, build locale permanente** : Zen n'impose pas la signature (sa build est compilée avec
  `MOZ_REQUIRE_SIGNING=false`). Passer une fois `xpinstall.signatures.required` à `false` dans
  `about:config`, puis à chaque modification :

  ```powershell
  powershell -ExecutionPolicy Bypass -File .\install.ps1
  ```

  Le script reconstruit, ferme Zen proprement, copie `dist/ronflux-firefox.xpi` dans le profil,
  relance Zen réduit, sans lui donner le focus, et vérifie la version installée. Options :
  `-DryRun` (affiche sans rien modifier), `-NoRelaunch`, `-Browser firefox` (profil Firefox, qui
  doit lui aussi avoir `xpinstall.signatures.required=false`). La build locale porte l'identifiant
  de la version publiée : une version signée plus récente, publiée sur le site, la remplace par
  mise à jour automatique.

## Construction

```powershell
npm ci                                                  # une fois, Node.js 20+
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

`build.ps1` lit `src/ronflux.user.js` et `extension/`, et écrit dans `dist/` :

| Sortie | Contenu |
|---|---|
| `dist/firefox/`, `dist/ronflux-firefox.xpi` | extension Firefox non signée, manifeste avec `update_url` |
| `dist/chrome/`, `dist/ronflux-chrome.zip` | extension Chrome, icônes PNG de 16 à 128 px |
| `dist/ronflux.user.js` | userscript avec `@updateURL` et `@downloadURL` |

- **Manifestes** : `extension/manifest.base.json` (commun), complété par `manifest.firefox.json`
  ou `manifest.chrome.json` ; `tools/manifest.mjs` les fusionne.
- **Logo** : `extension/icon.svg` est le seul fichier source. Firefox l'utilise tel quel, le
  build en tire les PNG de Chrome (`tools/icons.mjs`) et le site son favicon et le signe de la
  page. Pour changer de logo, remplacer ce fichier par un SVG carré qui garde la forme décrite
  dans `site/README.md` (« Logo et favicon »).
- **Adresses** : seule l'adresse de base du site se règle, `siteUrl` dans `distribution.json`.
  Les chemins sont fixes (`tools/common.ps1`) et partagés avec le site :
  `/telecharger/ronflux-firefox.xpi`, `/telecharger/ronflux-chrome.zip`,
  `/telecharger/ronflux.user.js` et `/updates.json`.
- **Version** : elle figure dans `extension/manifest.base.json`, dans l'en-tête `@version` et
  dans la constante `VERSION` du userscript. Le build s'arrête si elles diffèrent ;
  `release.ps1` les monte ensemble.
- Le build est reproductible : mêmes sources, mêmes archives, octet pour octet.

Vérifications :

```powershell
npm run lint:firefox                           # web-ext lint, en mode auto-hébergé
npx playwright install --no-shell chromium     # une fois
npm run check:chrome                           # dist/chrome dans un Chromium headless sur un live Twitch
```

## Publication

### Une fois : comptes et clés

**addons.mozilla.org (Firefox)**

1. Se connecter sur https://addons.mozilla.org avec un compte Mozilla, ouvrir le Developer Hub
   et accepter l'accord de distribution des développeurs (sans lui, l'API refuse les envois).
2. « Gérer les clés API » (https://addons.mozilla.org/developers/addon/api/key/) → générer des
   identifiants. AMO affiche un « émetteur JWT » (`user:…`) et un « secret JWT ».
3. Les ranger chiffrés par DPAPI (lisibles seulement par ce compte Windows, sur ce PC). La saisie
   ne s'affiche pas :

   ```powershell
   powershell -ExecutionPolicy Bypass -File $HOME\.claude\scripts\secret.ps1 set amo-jwt-issuer
   powershell -ExecutionPolicy Bypass -File $HOME\.claude\scripts\secret.ps1 set amo-jwt-secret
   ```

   Sans `secret.ps1`, ces commandes donnent les mêmes fichiers :

   ```powershell
   New-Item -ItemType Directory -Force $HOME\.secrets | Out-Null
   Read-Host -AsSecureString 'Émetteur JWT' | ConvertFrom-SecureString | Set-Content -Encoding ascii $HOME\.secrets\amo-jwt-issuer.dpapi
   Read-Host -AsSecureString 'Secret JWT' | ConvertFrom-SecureString | Set-Content -Encoding ascii $HOME\.secrets\amo-jwt-secret.dpapi
   ```

   Les clés ne vont jamais dans le dépôt, dans un fichier `.env` ni sur une ligne de commande.
   Pour en changer, en régénérer sur AMO (les anciennes sont révoquées) et relancer ces
   commandes.

Le premier `release.ps1` crée l'extension sur le compte AMO avec l'identifiant
`{adf926d0-3333-45f4-b9d2-b54afdb0fc13}`, celui des installations existantes. Ne jamais le
changer : elles ne recevraient plus les mises à jour.

**Cloudflare Pages (site)**

1. Créer le projet Pages qui sert le site. Son nom est celui de `cloudflarePagesProject` dans
   `distribution.json` (`ronflux`) :

   ```powershell
   cd tools\deploy
   npm ci
   npx wrangler login
   npx wrangler pages project create ronflux --production-branch main
   cd ..\..
   ```

   Puis lui donner l'adresse écrite dans les paquets (`siteUrl`), `ronflux.feitanx.com` : dans le
   tableau de bord, projet `ronflux` → Domaines personnalisés → ajouter `ronflux.feitanx.com`.
   La zone `feitanx.com` étant sur le même compte, il suffit d'un CNAME `ronflux` vers
   `ronflux.pages.dev`, en proxy.

   `wrangler login` ouvre le navigateur pour autoriser wrangler sur le compte Cloudflare.
   wrangler est installé à part, dans `tools/deploy`, pour que `npm ci` à la racine reste léger.
2. Créer un jeton d'API Cloudflare avec les autorisations `Cloudflare Pages : Edit` et
   `Account Settings : Read` (wrangler s'en sert pour trouver le compte), puis le ranger :

   ```powershell
   powershell -ExecutionPolicy Bypass -File $HOME\.claude\scripts\secret.ps1 set cloudflare-pages
   ```

   Sans `cloudflare-pages`, `release.ps1` prend `cloudflare-write`, le jeton général du compte,
   s'il est rangé.

**Chrome Web Store**

1. Créer un compte développeur sur https://chrome.google.com/webstore/devconsole (frais
   d'inscription uniques).
2. « Nouvel article » → envoyer `ronflux-chrome.zip`, puis remplir la fiche, les pratiques de
   confidentialité et la distribution d'après [docs/chrome-web-store.md](docs/chrome-web-store.md)
   (visibilité « non répertoriée »).
3. Une fois l'article accepté, mettre le lien de sa fiche dans la configuration du site
   (`chromeWebStoreUrl`) : le bouton Chrome du site y mène alors directement.

### À chaque version

```powershell
powershell -ExecutionPolicy Bypass -File .\release.ps1 -DryRun   # ce qui sera fait, sans rien modifier
powershell -ExecutionPolicy Bypass -File .\release.ps1           # 1.0.2 → 1.0.3 ; -Bump minor|major ou -Version x.y.z
```

`release.ps1` :

1. monte la version aux trois endroits où elle figure ;
2. lance `build.ps1` ;
3. envoie la version Firefox à AMO sur le canal « unlisted » (`web-ext sign`) et récupère le
   `.xpi` signé, après avoir vérifié qu'il contient exactement les fichiers construits. La
   validation automatique d'AMO prend en général quelques minutes ;
4. prépare `dist/publication/`, avec l'arborescence du site :

   | Fichier | Adresse |
   |---|---|
   | `updates.json` | `/updates.json` : manifeste de mise à jour Firefox (version, lien et empreinte SHA-256 du `.xpi`) |
   | `telecharger/ronflux-firefox.xpi` | `/telecharger/ronflux-firefox.xpi` (signé) |
   | `telecharger/ronflux-chrome.zip` | `/telecharger/ronflux-chrome.zip` |
   | `telecharger/ronflux.user.js` | `/telecharger/ronflux.user.js` |

5. commite la montée de version, et seulement elle (les autres modifications de l'arbre de
   travail restent en l'état), puis pose l'étiquette `vx.y.z` ;
6. construit le site (`npm run build` dans `site/`), y ajoute `dist/publication/` et déploie le
   tout sur Cloudflare Pages (`wrangler pages deploy`, branche de production `main`).
   `updates.json` et le `.xpi` partent ainsi ensemble, car le premier contient l'empreinte du
   second. Le script s'arrête si le site ne sert pas le `.xpi` en `application/x-xpinstall`
   (fichier `_headers`) : Firefox le téléchargerait au lieu de proposer l'installation.

Les clés et le jeton ne sont déchiffrés qu'au moment de s'en servir et passés à web-ext ou à
wrangler par l'environnement de leur seul processus, jamais en argument ni à l'écran. Les autres
variables `WEB_EXT_*`, `CLOUDFLARE_*`, `CF_*` et `WRANGLER_*` sont écartées le temps de l'appel.

Options : `-NoCommit` saute le commit et l'étiquette ; `-NoDeploy` saute le déploiement, et
`dist/publication/` est alors à déposer à la racine du site. Sans dossier `site/`, le déploiement
est sauté.

Seule l'étape du Chrome Web Store reste à la main : onglet « Paquet » → « Importer un nouveau
paquet » → `dist/publication/telecharger/ronflux-chrome.zip` → « Envoyer pour examen ».

**Reprise** :

- arrêt après la montée de version, avant l'envoi à AMO : relancer avec `-Version x.y.z` (la
  même) ;
- arrêt après la signature (déploiement en échec, par exemple) : le script affiche la commande
  de reprise, `release.ps1 -SignedXpi <fichier>`, qui termine sans renvoyer la version à AMO (il
  refuse deux envois du même numéro). Un commit ou une étiquette déjà posés ne sont pas refaits ;
- AMO a reçu la version mais l'attente de la signature a expiré : télécharger le `.xpi` signé
  depuis la page de la version sur le Developer Hub, puis `release.ps1 -SignedXpi <fichier>`.

**Changer l'adresse du site** : modifier `siteUrl` dans `distribution.json` (et
`cloudflarePagesProject` si le site passe sur un autre projet Pages). Les installations
existantes (Firefox par `updates.json`, userscript par `@updateURL`) interrogent l'ancienne
adresse jusqu'à ce qu'elles reçoivent une version construite avec la nouvelle : garder
l'ancienne adresse en service le temps d'une version au moins.

## Configuration

Tout se règle dans l'objet `CONFIG` en tête de `src/ronflux.user.js` :

| Option | Défaut | Rôle |
|---|---|---|
| `debug` | `false` | Journal détaillé dans la console |
| `showNotifications` | `true` | Petit message dans le lecteur quand une pub est bloquée |
| `hidePlayerOnUnblockedAd` | `true` | Masquer le lecteur et couper le son si aucun flux de secours n'est trouvé |
| `reloadPlayerAfterAd` | `'always'` | Recharger le lecteur après une pub : `'always'`, `'quality-changed'` ou `'never'` |
| `minReloadIntervalMs` | `45000` | Délai minimal entre deux rechargements automatiques |
| `retryIntervalMs` | `10000` | Délai avant de rechercher à nouveau un flux de secours après un échec |
| `backupPlayerTypes` | liste | Types de lecteur essayés dans l'ordre pour obtenir un flux sans pub |
| `forceMainPlayerType` | `'popout'` | Type de lecteur demandé pour le flux principal à la place de `site` (pas de pre-roll) ; `null` pour désactiver |

Twitch change régulièrement quels types de lecteur reçoivent des pubs. Si les pubs reviennent,
c'est en général `backupPlayerTypes` qu'il faut réordonner ou compléter : la console indique
quel type a fonctionné, et le dernier type qui a marché sur une chaîne est réessayé en premier.

Après modification du userscript, lancer `build.ps1` pour regénérer les paquets de `dist/`
(voir Construction) :

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

## Diagnostic

Ouvrir la console (F12). Tous les messages sont préfixés `[Ronflux]` (page) ou
`[Ronflux:worker]` (lecteur). Au chargement d'un live on doit voir :

```
[Ronflux] v1.0.2 chargé
[Ronflux] worker Twitch enveloppé
[Ronflux:worker] hook installé dans le worker du lecteur
[Ronflux] flux principal demandé en « popout » au lieu de « site » (pas de pre-roll)
```

puis, lors d'une pub :

```
[Ronflux:worker] pub détectée (mid-roll) 1080p60 (source)
[Ronflux:worker] pub mid-roll bloquée → flux de secours embed/web (1080p60 (source))
[Ronflux:worker] fin de la pub après 31 s
[Ronflux] lecteur rechargé
```

Une API est exposée dans la console : `__ronflux.version`, `__ronflux.config`,
`__ronflux.workerCount`, `__ronflux.setDebug(true)`, `__ronflux.reloadPlayer()`.

Si « worker Twitch enveloppé » n'apparaît jamais (`__ronflux.workerCount` reste à 0), le
script s'est exécuté trop tard : Twitch crée le worker du lecteur dans la première seconde du
chargement de la page. Dans Tampermonkey, mettre le « Mode d'injection » sur « Instantané »
(Paramètres → Général, mode de configuration « Avancé ») ; dans Violentmonkey, laisser
`@run-at document-start`. Les extensions Firefox et Chrome n'ont pas ce problème.

Si « pub détectée mais aucune playlist maîtresse connue » ou « playlist maîtresse non reconnue »
s'affiche, Twitch a changé le format de l'URL usher : adapter `isMasterPlaylistUrl` / `onMaster`
dans le worker (voir l'historique 1.0.2 ci-dessous).

Si « aucun flux de secours sans pub trouvé » s'affiche à chaque pub, tous les types de lecteur
de `backupPlayerTypes` reçoivent des pubs à ce moment-là : le lecteur est alors masqué et le
son coupé, et une nouvelle recherche a lieu toutes les 10 s jusqu'à la fin de la pub.

## État des lieux (validé le 3 octobre 2026)

Mesures faites sur twitch.tv depuis la France, sans compte :

- Twitch utilise le lecteur Amazon IVS (`player-core-variant-a`), qui crée son worker une seule
  fois au chargement de la page, via `new Worker(blob:…)` avec un `importScripts` du script
  `amazon-ivs-wasmworker`. L'enveloppe fonctionne : le worker est bien intercepté quand le script
  est chargé avant Twitch.
- Playlist maîtresse en `usher.ttvnw.net/api/v2/channel/hls/…`, sans `#EXT-X-MEDIA` : le nom de
  la qualité vient de `IVS-NAME` / `STABLE-VARIANT-ID` ; playlists média en
  `*.playlist.ttvnw.net/v1/playlist/…`.
- Marqueurs de pub inchangés : `#EXT-X-DATERANGE:ID="stitched-ad-…",CLASS="twitch-stitched-ad",…,
  X-TV-TWITCH-AD-ROLL-TYPE="PREROLL"`.
- Jetons d'accès : `popout`, `frontpage`, `site/android`, `site/ios` ont donné des flux sans
  pre-roll sur toutes les chaînes testées ; `embed` est sans pub sur certaines chaînes et reçoit
  un pre-roll sur d'autres ; `autoplay` est sans pub mais limité à 360p ; `picture-by-picture`
  et `thunderdome` reçoivent un pre-roll. Pendant un pre-roll en cours sur une chaîne, il est
  arrivé que tous les types reçoivent la même pub pendant quelques dizaines de secondes
  (fréquence publicitaire par appareil) : d'où le masquage du lecteur en repli et les nouvelles
  tentatives périodiques.
- Test de bout en bout : pub pre-roll détectée dans le worker du lecteur, playlist de secours
  sans pub (même qualité) renvoyée au lecteur à la place, notification affichée.
- `usherV2` (`/api/v2/channel/hls/`) est un drapeau que Twitch active compte par compte (le
  site l'utilise si l'expérimentation est active pour l'utilisateur) : un compte connecté peut
  recevoir des playlists v2 alors qu'un visiteur anonyme reste en v1.

## Historique

- **1.0.2** (3 octobre 2026) — Correctif : avec un compte sur lequel Twitch active `usherV2`, la
  playlist maîtresse est en `/api/v2/channel/hls/…` et le worker n'en extrayait pas le nom de
  chaîne (regex limitée à `/api/channel/hls/`) ; les playlists de pub étaient alors transmises au
  lecteur sans aucun message. Symptôme : « hook installé » dans la console mais pubs jouées et
  jamais « pub détectée ». Le worker avertit désormais explicitement dans ce cas. Nouveauté :
  le flux principal est demandé en `popout` (option `forceMainPlayerType`), ce qui supprime les
  pre-rolls à la source.
- **1.0.1** — Prise en charge du lecteur Amazon IVS (worker `blob:` + `importScripts`, playlists
  `*.playlist.ttvnw.net/v1/playlist/`, noms de qualité `IVS-NAME`).
- **1.0.0** — Version initiale.

## Limites connues

- Pendant une pub, la qualité peut baisser si le flux de secours n'offre pas la qualité d'origine
  (le script choisit la plus proche). Un court rechargement du lecteur a lieu à la fin de la pub.
- Seuls les lives sont traités, pas les VOD ni les clips.
- Le script dépend de détails internes de Twitch (worker du lecteur, format des playlists,
  composant React du lecteur). Une refonte côté Twitch peut le casser : vérifier la console.
- Twitch propose Turbo et les abonnements aux chaînes comme moyens officiels de ne pas voir de
  pubs ; bloquer les pubs prive les streamers de ce revenu.

## Licence

Ronflux est publié sous licence MIT (voir `LICENSE`). Code source :
https://github.com/NOUSSS/ronflux.
