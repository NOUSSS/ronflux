# Ronflux

Bloque les publicités vidéo (pre-roll et mid-roll) des lives Twitch. Disponible en deux formats
qui partagent exactement le même code :

| Fichier | Format |
|---|---|
| `src/ronflux.user.js` | Userscript pour Tampermonkey / Violentmonkey (Firefox, Chrome, Edge…), et source unique du projet |
| `extension/` → `dist/ronflux-firefox.xpi` | Extension Firefox (Manifest V3, Firefox 128+), construite par `build.ps1` |

`dist/` est généré par `build.ps1` et ignoré par git.

N'installez **qu'un seul** des deux : si les deux sont présents, le second se désactive tout seul.

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

L'extension Firefox bloque en plus, sur les pages Twitch uniquement, quelques domaines de
bannières et de mesure publicitaire (`rules.json`).

## Installation

### Userscript (Tampermonkey / Violentmonkey)

1. Installer [Tampermonkey](https://www.tampermonkey.net/) ou [Violentmonkey](https://violentmonkey.github.io/).
2. Ouvrir le tableau de bord de l'extension → « + » (nouveau script) → coller le contenu de
   `src/ronflux.user.js` → enregistrer. Ou bien ouvrir le fichier `.user.js` dans le
   navigateur : l'extension propose l'installation.
3. Recharger Twitch.

Greasemonkey n'est pas pris en charge (il isole le script de la page, ce qui empêche
d'envelopper le worker).

### Zen Browser (installation permanente, sans signature)

Zen est basé sur Firefox mais, contrairement à Firefox stable, il n'impose pas la signature des
extensions (sa build est compilée avec `MOZ_REQUIRE_SIGNING=false`). Il suffit d'autoriser les
extensions non signées une fois :

1. Ouvrir `about:config`, chercher `xpinstall.signatures.required` et le passer à `false`.
2. Ouvrir `dist/ronflux-firefox.xpi` (après `build.ps1`) dans Zen (glisser le fichier dans la fenêtre, ou
   `about:addons` → roue dentée → « Installer un module depuis un fichier… »).
3. Confirmer « Ajouter ». L'extension reste installée après redémarrage.

Mises à jour suivantes en une commande (rebuild, fermeture de Zen, copie du `.xpi` dans le profil,
relance, vérification de la version) :

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Options : `-DryRun` (affiche sans rien modifier), `-NoRelaunch`, `-Browser firefox` (profil
Firefox, qui doit lui aussi avoir `xpinstall.signatures.required=false`).

### Extension Firefox

Chargement temporaire (disparaît à la fermeture de Firefox, idéal pour tester) :

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. « Charger un module complémentaire temporaire… » → choisir `dist/firefox/manifest.json`
   (ou `dist/ronflux-firefox.xpi`).

Installation permanente : Firefox exige des extensions signées. Deux options :

- **Firefox Developer Edition, Nightly ou ESR** : dans `about:config`, passer
  `xpinstall.signatures.required` à `false`, puis ouvrir `about:addons` → roue dentée →
  « Installer un module depuis un fichier… » → `dist/ronflux-firefox.xpi`.
- **Firefox stable** : signer le paquet avec [web-ext](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign)
  et des identifiants API addons.mozilla.org (`web-ext sign --channel unlisted`), puis installer
  le `.xpi` signé.

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

Après modification du userscript, lancer `build.ps1` pour regénérer `dist/firefox/` et
`dist/ronflux-firefox.xpi` :

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
`@run-at document-start`. L'extension Firefox n'a pas ce problème.

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
