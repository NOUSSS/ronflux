# Site de Ronflux

Page d'accueil statique, construite avec [Vite](https://vite.dev/) sans framework : une page
HTML, une feuille de style, deux petits scripts. Aucun script tiers, aucune mesure d'audience ;
les polices sont servies par le site.

## Construire

```sh
cd site
npm ci
npm run build      # sortie dans site/dist/
npm run dev        # aperçu avec rechargement, http://localhost:5173
npm run preview    # sert site/dist/ tel qu'il sera en ligne
```

Node 20.19 ou plus récent (`.node-version` : 22).

Le build lit les sources de l'extension, un manifeste unique (`extension/manifest.json`) ou une
base complétée par navigateur (`extension/manifest.base.json` + `manifest.firefox.json`) :

- la version, affichée sur la page ; le build échoue s'il ne la trouve pas, pour qu'elle ne
  puisse pas diverger du paquet ;
- la version minimale de Firefox (`gecko.strict_min_version`) ;
- les mises à jour Firefox : si `gecko.update_url` est dans les sources, ou si `build.ps1`
  l'ajoutera (base + firefox, avec un `siteUrl` dans `../distribution.json`), la page dit que
  Firefox met Ronflux à jour tout seul ; sinon, elle dit de réinstaller la nouvelle version
  depuis le site.

Dans `index.html`, ces variantes sont des blocs `<!-- si:nom -->…<!-- /si:nom -->` et
`<!-- sinon:nom -->…<!-- /sinon:nom -->` (`cws`, `maj-firefox`), résolus au build.

## Cloudflare Pages

| Réglage | Valeur |
|---|---|
| Répertoire racine | `site` |
| Commande de build | `npm run build` |
| Répertoire de sortie | `dist` |

`public/_headers` est copié tel quel : politique de sécurité du contenu (rien d'extérieur),
et types MIME des fichiers à télécharger. `application/x-xpinstall` est indispensable pour que
Firefox propose l'installation du `.xpi` au lieu de le télécharger.

## Fichiers à télécharger

Ils ne sont pas dans le dépôt (`public/telecharger/` et `public/updates.json` sont ignorés par
git). L'intégration les dépose avant le build dans `site/public/`, ou après le build dans
`site/dist/`, aux chemins suivants :

| Fichier | Servi à |
|---|---|
| `.xpi` Firefox signé (non répertorié) | `/telecharger/ronflux-firefox.xpi` |
| ZIP de l'extension Chromium | `/telecharger/ronflux-chrome.zip` |
| userscript | `/telecharger/ronflux.user.js` |
| manifeste de mise à jour Firefox (à la racine, pas dans `telecharger/`) | `/updates.json` |

`release.ps1` (à la racine du dépôt) produit exactement cette arborescence dans
`dist/publication/` : la copier telle quelle dans `site/dist/` après le build. `updates.json` et le
`.xpi` partent ensemble (le premier contient l'empreinte du second).

## Réglages

`ronflux.config.js` :

- `chromeWebStoreUrl` : adresse de la fiche Chrome Web Store. Vide, le lien n'apparaît nulle
  part et Chrome, Brave, Edge et Opera passent par le ZIP. Renseignée, le bouton principal de
  ces navigateurs mène au store et le ZIP reste proposé en second.

## Reconnaissance du navigateur

`public/navigateur.js` s'exécute avant le premier affichage et pose `data-nav` (`firefox`,
`chromium`, `mobile` ou `autre`) et `data-nav-nom` (`Chrome`, `Brave`, `Edge`, `Opera`) sur
`<html>`. Le CSS montre le bloc d'installation correspondant, sans décalage. Sans JavaScript,
la page propose le choix entre Firefox et Chromium.

## Logo et favicon

Pas encore de logo : le nom s'affiche en texte. Le logo prendra la place de
`.marque-signe` dans l'en-tête (masqué tant qu'il est vide) ; le favicon remplace la ligne
`<link rel="icon" href="data:,">` de `index.html` (le commentaire juste au-dessus donne la
ligne à mettre).

## Direction artistique

Une affiche militante tirée en sérigraphie : papier rose, encres bleu nuit et rouge en
surimpression, jaune fluo réservé au bouton d'installation. Les jetons sont en tête de
`src/style.css` ; le détail est dans `DESIGN.md`.
