# Relecture de Ronflux

Ce que le relecteur doit savoir sur ce projet en plus du code.

## Structure

- `src/ronflux.user.js` est la source unique du code. `build.ps1` en tire `dist/` (extensions
  Firefox et Chrome, décompressées et empaquetées, et userscript distribué), qui est ignoré par
  git : ne jamais relire ni corriger `dist/`.
- Manifestes : `extension/manifest.base.json` + `manifest.firefox.json` / `manifest.chrome.json`,
  fusionnés par `tools/manifest.mjs`. Fonctions communes aux scripts PowerShell :
  `tools/common.ps1`.
- `release.ps1` monte la version, fait signer la version Firefox par AMO, prépare
  `dist/publication/`, commite la version puis déploie le site (`site/` construit, plus
  `dist/publication/`) sur Cloudflare Pages. wrangler est installé à part, dans `tools/deploy`.
- Le script tourne dans la page Twitch (monde `MAIN`, `document_start`) et injecte
  `workerMain` dans le worker du lecteur.

## Zones à relire de près

- `workerMain` est sérialisé par `toString()` puis placé en tête du script du worker Twitch.
  Il ne doit référencer aucune variable extérieure (tout passe par `cfg`), et une exception
  levée à son premier niveau arrête tout le worker, donc le lecteur.
- Fonctions `async` partagées par une promesse mise en cache (`ad.pending`) : une fonction
  `async` s'exécute de façon synchrone jusqu'à son premier `await`, `finally` compris.
- Tout ce que la page affiche ou modifie pendant une pub (masque, son coupé, message) doit
  être retiré quelle que soit la façon dont la pub se termine : fin normale, changement de
  chaîne ou raid, worker terminé, onglet en arrière-plan. Le navigateur suspend
  `requestAnimationFrame` dans un onglet caché ou une fenêtre recouverte, pas les minuteurs.
- Détails internes de Twitch dont dépend le script : URL usher (`/channel/hls/`, v1 et v2),
  marqueurs de pub des playlists, requête GraphQL `PlaybackAccessToken`, composant React du
  lecteur (`setSrc`). Une hypothèse sur leur forme doit échouer sans casser le lecteur.
- Clés API AMO et jeton Cloudflare dans `release.ps1` : ils ne doivent apparaître dans aucune
  sortie, argument de commande, fichier ni message d'erreur. Seules les variables
  d'environnement des processus web-ext et wrangler les portent, retirées dans un `finally`.
- Outils externes (git, npm, node) : toujours par `Invoke-Native`, `Invoke-NativeCode` ou
  `Get-NativeOutput` de `tools/common.ps1`. Un appel direct `& git …` sous
  `$ErrorActionPreference = 'Stop'` s'arrête sur le premier avertissement écrit sur stderr dès
  que stderr est redirigé (journal, CI, `2>&1`), même quand l'outil réussit.
- Contrats avec l'existant : l'identifiant Firefox `{adf926d0-3333-45f4-b9d2-b54afdb0fc13}` (les
  installations se mettent à jour par lui) et les chemins publics de `tools/common.ps1` (le site
  et les `update_url` / `@updateURL` déjà distribués). Les changer casse les mises à jour.
- `updates.json` porte l'empreinte du `.xpi` publié : toute écriture du `.xpi` après ce calcul
  fait échouer les mises à jour Firefox.
- Scripts PowerShell : Windows PowerShell 5.1 (pas d'opérateurs de PowerShell 7), fichiers
  `.ps1` en UTF-8 avec BOM, sinon les accents sont mal lus.

## Exécuter le code

- `workerMain` se teste sous Node : l'extraire du fichier et l'exécuter avec un `self`
  simulé (`fetch`, `postMessage`, `addEventListener`) qui sert des playlists maîtresse et
  média factices et des réponses GraphQL.
- Ne jamais lancer `install.ps1` : il ferme le navigateur de l'utilisateur pour réinstaller
  l'extension.
- Ne jamais lancer `release.ps1` sans `-DryRun` dans le dépôt : il monte la version, signe avec
  les vraies clés, commite et déploie le site. Pour le tester, dans une copie du dépôt :
  - sans `.git` (dans un worktree, `.git` est un fichier : l'exclure aussi, sinon la copie
    commite dans le vrai dépôt), avec son propre `git init` et une jonction vers `node_modules` ;
  - `$AmoApi` pointé vers un faux serveur AMO local ;
  - un faux `tools/deploy/node_modules/wrangler/bin/wrangler.js` qui note ses arguments, son
    environnement et les fichiers déployés, et dont le code de sortie se règle ;
  - le `site/` de la branche du site ;
  - fausses clés rangées par `ConvertFrom-SecureString` dans un `USERPROFILE` temporaire ;
  - lancé avec stderr redirigé (`*>&1`), le cas le plus strict.

  `-SignedXpi` avec un `.xpi` construit auquel on ajoute une entrée `META-INF/mozilla.rsa` teste
  la suite sans serveur AMO.
- Paquets : `npm run lint:firefox` (web-ext lint) et `npm run check:chrome` (dist/chrome dans un
  Chromium headless sur un live Twitch, après `npx playwright install --no-shell chromium`).
