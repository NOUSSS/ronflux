# Relecture de Ronflux

Ce que le relecteur doit savoir sur ce projet en plus du code.

## Structure

- `src/ronflux.user.js` est la source unique du code. `build.ps1` en tire `dist/` (extensions
  Firefox et Chrome, décompressées et empaquetées, et userscript distribué), qui est ignoré par
  git : ne jamais relire ni corriger `dist/`.
- Manifestes : `extension/manifest.base.json` + `manifest.firefox.json` / `manifest.chrome.json`,
  fusionnés par `tools/manifest.mjs`. Fonctions communes aux scripts PowerShell :
  `tools/common.ps1`.
- `release.ps1` monte la version, fait signer la version Firefox par AMO et prépare
  `dist/publication/`, que la publication du site dépose tel quel.
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
- Clés API AMO dans `release.ps1` : elles ne doivent apparaître dans aucune sortie, argument de
  commande, fichier ni message d'erreur. Seules les variables d'environnement du processus
  web-ext les portent, retirées dans un `finally`.
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
- Ne jamais lancer `release.ps1` sans `-DryRun` dans le dépôt : il monte la version et signe
  avec les vraies clés. Pour le tester : copie du dépôt sans `.git` (jonction vers
  `node_modules`), `$AmoApi` de la copie pointé vers un faux serveur AMO local, fausses clés
  rangées par `ConvertFrom-SecureString` dans un `USERPROFILE` temporaire. `-SignedXpi` avec un
  `.xpi` construit auquel on ajoute une entrée `META-INF/mozilla.rsa` teste la publication sans
  serveur.
- Paquets : `npm run lint:firefox` (web-ext lint) et `npm run check:chrome` (dist/chrome dans un
  Chromium headless sur un live Twitch, après `npx playwright install --no-shell chromium`).
