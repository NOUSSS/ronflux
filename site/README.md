# Site de Ronflux

Page d'accueil statique, construite avec [Vite](https://vite.dev/) sans framework : une page
HTML, une feuille de style, trois petits scripts. Aucun script tiers, aucune mesure d'audience ;
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

## Déploiement (Cloudflare Pages)

Le site n'est pas relié au dépôt chez Cloudflare : les fichiers à télécharger ne sont pas
dans git, et le `.xpi` signé exige les clés AMO. `release.ps1`, à la racine du dépôt, construit
le site, y ajoute les paquets (voir plus bas) et envoie `site/dist/` par
`wrangler pages deploy` au projet Pages `ronflux`. Il s'arrête si `site/dist/index.html` manque
ou si `site/dist/_headers` ne sert pas le `.xpi` en `application/x-xpinstall`.

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

`release.ps1` produit exactement cette arborescence dans `dist/publication/` et la copie dans
`site/dist/` après le build. `updates.json` et le `.xpi` partent ensemble (le premier contient
l'empreinte du second).

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

Le logo n'existe qu'en un fichier, `extension/icon.svg`. Le build du site le sert tel quel en
`/favicon.svg` et en tire le signe de l'en-tête et du pied de page (`signe()` dans
`vite.config.js`) : la tuile en moins, le dessin à l'encre du texte. Le SVG doit donc garder
cette forme :

- la tuile est son premier élément, un `<rect …/>` ;
- les couleurs du dessin sont en hexadécimal, dans des attributs `fill` ou `stroke` ; elles
  passent en `currentColor`.

Sinon le build du site échoue. Le cadrage du signe (`CADRAGE_SIGNE`, `18 8 80 80` dans un
dessin de 96 × 96) est fait pour le R actuel : avec un autre dessin, il faut le revoir, faute
de quoi le signe est rogné sans erreur. `release.ps1` ne construit le site qu'après la
signature AMO : après un changement de logo, lancer `npm run build` ici et regarder l'en-tête
avant de publier.

## Direction artistique

Le compte rendu d'une nuit d'enregistreur : papier vert pâle réglé en carreaux, encres
vert-noir, ocre réservé aux pubs. En haut de page, une bande défile comme le papier d'un
enregistreur, sur trois pistes : ce que Twitch diffuse, ce que vous voyez, ce que fait Ronflux.
Les jetons sont en tête de `src/style.css` ; les tracés sont calculés par
`src/enregistrement.js`, au build pour l'image fixe et dans la page pour le défilement. Le
détail est dans `DESIGN.md`.
