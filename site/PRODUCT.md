# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Délégué : « l'outil le plus simple qui convient », site statique sans serveur déployé sur
Cloudflare Pages. Choix retenu : Vite sans framework (une page HTML, du CSS, un peu de JS),
polices auto-hébergées via `@fontsource`, aucun script tiers.

## Users

Spectateurs de lives Twitch francophones, non techniques : ils regardent des lives sur
ordinateur, se font couper par des pubs de 30 à 90 secondes et n'ont jamais installé de
userscript ni chargé une extension en mode développeur. Ils veulent un bouton, des étapes
courtes et la certitude que ce n'est pas un logiciel douteux.

## Product Purpose

Ronflux bloque les pubs vidéo (pre-roll et mid-roll) des lives Twitch. Quand une pub est
cousue dans le flux, il bascule le lecteur sur un flux de secours sans pub, à la même qualité
si possible ; s'il n'en trouve aucun, il masque le lecteur et coupe le son le temps de la pub.
Réussite : le visiteur installe la bonne version pour son navigateur en moins d'une minute.

## Positioning

Les pubs Twitch ne viennent pas d'un domaine publicitaire : elles sont dans le flux vidéo
lui-même, ce qui rend les bloqueurs classiques inefficaces. Ronflux agit dans le lecteur et
change de flux. Tout se passe dans le navigateur : aucune donnée collectée, aucun serveur.

## Operating Context

- Extension Firefox (et dérivés comme Zen) : `.xpi` signé « non répertorié », installation en
  un clic depuis le site, mises à jour automatiques.
- Chrome et Chromium (Brave, Edge, Opera) : ZIP à charger en mode développeur, en attendant
  une fiche Chrome Web Store « non répertoriée ».
- Userscript pour Tampermonkey ou Violentmonkey, en option.

## Capabilities and Constraints

- Lives seulement : ni VOD ni clips.
- Dépend de détails internes de Twitch : une refonte de Twitch peut le casser.
- Pendant une pub, la qualité peut baisser si le flux de secours ne l'offre pas ; court
  rechargement du lecteur à la fin de la pub.
- Ronflux n'est pas affilié à Twitch. Le site parle de Twitch sans imiter sa marque, son logo
  ni son violet.
- Ouvert : adresse du site, lien Chrome Web Store.

## Brand Commitments

- Nom : Ronflux (clin d'œil à un Pokémon, dans la lignée d'autres projets nommés ainsi). Le
  logo assume l'allusion au sommeil et au ronflement ; ni le logo ni le site ne reprennent quoi
  que ce soit du Pokémon (personnage, silhouette, couleurs).
- Logo à créer avec l'identité. Il sert aussi d'icône à l'extension : lisible de 16 à 128 px.
- Ton : militant assumé contre l'excès de pubs (« on se croirait à la télévision »), sans
  attaquer les streamers. Vouvoiement, pas de ton marketing.
- À éviter : l'air d'un logiciel louche, le jargon technique, une page criarde (couleurs
  saturées, effets qui fatiguent), l'air d'un site généré.

## Evidence on Hand

Aucune capture, aucun chiffre d'utilisateurs, aucun témoignage. Rien de tout cela ne doit être
inventé.

## Product Principles

1. Le visiteur installe d'abord, comprend ensuite : le bon bouton pour son navigateur vient
   avant toute explication.
2. Dire ce que fait Ronflux sans jargon : flux, pub, lecteur, pas HLS ni worker.
3. Honnêteté sur les limites et sur ce que les pubs rémunèrent.
4. Rien ne quitte le navigateur, et le site lui-même ne charge rien de tiers.
