---
name: Ronflux
description: Le compte rendu d'une soirée de live, tiré sur papier d'enregistreur, pour le site de Ronflux, bloqueur des pubs des lives Twitch.
colors:
  papier: "#eef2ec"
  papier-clair: "#f6f8f4"
  reglure: "#dfe8e1"
  reglure-forte: "#c6d6ca"
  encre: "#1d2a2f"
  encre-2: "#4a5c60"
  encre-survol: "#34474e"
  ocre: "#d9a441"
  ocre-voile: "rgb(217 164 65 / 0.3)"
typography:
  display:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 4.2vw, 4.75rem)"
    fontWeight: 700
    lineHeight: "round(up, 1.05em, 8px)"
    letterSpacing: "-0.01em"
  display-second:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.5rem, 1.1rem + 4.2vw, 4.75rem)"
    fontWeight: 380
    lineHeight: "round(up, 1.05em, 8px)"
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 1.6vw, 2.75rem)"
    fontWeight: 700
    lineHeight: "round(up, 1.08em, 8px)"
  title-poste:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: "32px"
  title:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: "24px"
  question:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: "24px"
  bouton:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: "24px"
  marque:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "32px"
  navigation:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 500
    lineHeight: "24px"
  piste:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "24px"
    fontFeature: "tnum"
  graduation:
    fontFamily: "Sofia Sans Condensed, Arial Narrow, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: "24px"
    fontFeature: "tnum"
  body:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "24px"
  code:
    fontFamily: "ui-monospace, Cascadia Mono, Menlo, Consolas, monospace"
    fontSize: "0.875em"
    lineHeight: "22px"
rounded:
  angle: "0"
spacing:
  u: "8px"
  u2: "16px"
  u3: "24px"
  u4: "32px"
  carreau: "40px"
  u8: "64px"
  double-carreau: "80px"
  section: "120px"
  section-telephone: "96px"
  gouttiere: "160px"
  lecture: "160px"
  cadre: "min(1240px, calc(round(down, 100% - 104px, 80px) + 40px))"
components:
  bouton-encre:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.papier}"
    typography: "{typography.bouton}"
    rounded: "{rounded.angle}"
    padding: "0 28px"
    height: "56px"
  bouton-encre-hover:
    backgroundColor: "{colors.encre-survol}"
    textColor: "{colors.papier}"
  bouton-texte:
    backgroundColor: "transparent"
    textColor: "{colors.encre}"
    rounded: "{rounded.angle}"
    padding: "0 12px"
    height: "32px"
  bouton-texte-hover:
    backgroundColor: "{colors.papier-clair}"
    textColor: "{colors.encre}"
  adresse-code:
    backgroundColor: "{colors.papier-clair}"
    textColor: "{colors.encre}"
    typography: "{typography.code}"
    rounded: "{rounded.angle}"
    padding: "4px 10px"
  lecture-pub:
    backgroundColor: "{colors.ocre}"
    textColor: "{colors.encre}"
    typography: "{typography.piste}"
    rounded: "{rounded.angle}"
    padding: "2px 6px"
---

# Design System: Ronflux

## Overview

**Creative North Star: « Le compte rendu d'enregistreur »**

Le site est le compte rendu d'une soirée de live, établi comme un enregistrement du sommeil. Toute la page est une feuille de papier d'enregistreur vert pâle, réglée en grands carreaux de 40 px et petits de 8 px. On y écrit à l'encre vert-noir, en trois valeurs ; une seule couleur d'événement, l'ocre, marque les pubs comme un surligneur sur un tracé. Le papier n'est pas un décor posé derrière la page : c'est la géométrie de la page. Les hauteurs de ligne, les marges, les blocs et les pistes tombent sur sa réglure.

La densité est celle d'un document technique lisible par tous : colonnes de lecture modérées, titres condensés, filets d'un pixel pour séparer, aucune carte. La preuve est montrée par des tracés (la bande qui défile, le relevé d'une heure) et chaque explication est épinglée au tracé à l'instant qu'elle décrit. Le monde refuse la page de bloqueur habituelle : fond sombre, titre centré, capture du lecteur, trois cartes d'avantages. Rien de Twitch dans l'allure (ni son violet, ni son lecteur).

**Key Characteristics:**
- Papier réglé (40 px et 8 px) sur toute la page, centré pour que le cadre tombe sur ses lignes.
- Trois valeurs d'encre, plus l'ocre réservé aux pubs.
- Sofia Sans Condensed pour titres, pistes, graduations et boutons ; Sofia Sans pour le texte.
- Hauteur de ligne de 24 px, toutes les cotes verticales en multiples de 8.
- Filets d'un pixel, peints en fond ; angles droits, ni ombre ni arrondi.
- Inserts de papier clair pour les tracés (bande et relevé), réglés depuis leur bord haut.

## Colors

Une palette de table traçante : papier vert pâle, encre vert-noir, et une seule couleur d'événement.

### Primary
- **Ocre de pub** (`ocre`) : la pub, et rien d'autre. Bloc plein sur la piste « Twitch diffuse » pendant une pub, fond de la lecture « Une pub » sous les plumes. C'est la seule couleur chaude de la page.
- **Voile d'ocre** (`ocre-voile`, ocre à 30 %) : la bande verticale qui couvre toute la hauteur d'un tracé pendant une pub, sur la bande comme sur le relevé.

### Neutral
- **Encre** (`encre`) : texte, titres, tracés, plumes, filets forts (bord haut et bas des inserts, filet de tête des postes et du pied), fond du bouton plein, contour de focus.
- **Encre seconde** (`encre-2`) : annotations. Légendes, faits sous le bouton, heures des notes, graduations du relevé, mentions du pied, lecture « En veille ».
- **Encre de survol** (`encre-survol`) : fond du bouton plein au survol, seule variation d'état de l'encre.
- **Papier** (`papier`) : fond de la page, texte du bouton plein.
- **Papier clair** (`papier-clair`) : papier des tracés (bande et relevé), fond de l'adresse à copier, survol des boutons de texte, cache des noms de pistes sur téléphone.
- **Réglure forte** (`reglure-forte`) : grands carreaux et filets secondaires (entre étapes, entre questions, contour de l'adresse).
- **Réglure** (`reglure`) : petits carreaux.

### Named Rules
**La règle des trois encres.** L'encre a trois valeurs : `encre` pour ce qui se lit et se trace, `encre-2` pour ce qui annote, la réglure (`reglure-forte` et `reglure`) pour ce qui structure. `encre-survol` n'existe que comme état du bouton plein. Une quatrième valeur de gris ou de vert ne s'ajoute pas.

**La règle de l'ocre.** L'ocre signifie « une pub ». Il ne sert ni à un lien, ni à un bouton, ni à une mise en avant, ni à un badge. Seule tolérance hors tracé : la sélection de texte du navigateur (`::selection`), qui le prend sur fond d'encre.

## Typography

**Display Font:** Sofia Sans Condensed (repli Arial Narrow), variable, auto-hébergée.
**Body Font:** Sofia Sans (repli system-ui), variable, auto-hébergée.
**Label/Mono Font:** pile monospace du système (ui-monospace, Cascadia Mono, Menlo, Consolas), pour les seules adresses à copier.

**Character:** Une même grotesque en deux largeurs : la condensée pour tout ce qui s'inscrit sur l'enregistrement (titres, noms de pistes, graduations, lectures, boutons), la largeur normale pour ce qui se lit en phrases. Chiffres tabulaires partout où l'on lit des heures ou des versions.

### Hierarchy
- **Display** (700 puis 380, `clamp(2.5rem, 1.1rem + 4.2vw, 4.75rem)`, interligne arrondi au multiple de 8 supérieur, −0,01 em) : le titre d'ouverture, sur deux lignes ; la première en gras, la seconde en maigre.
- **Headline** (700, `clamp(2rem, 1.5rem + 1.6vw, 2.75rem)`, interligne arrondi au multiple de 8) : titres de section, suivis de 40 px.
- **Title** (700, 26 px sur 32 px pour les postes d'installation ; 22 px sur 24 px pour les notes ; 20 px sur 24 px pour les étapes ; 600, 21 px sur 24 px pour les questions).
- **Body** (400, 17 px sur 24 px) : texte courant, colonnes bornées (36 à 52 ch pour la note d'ouverture, 68 ch pour les réponses, 72 ch pour les légendes).
- **Label** (400, 15 px sur 24 px, `encre-2`) : faits, légendes, mentions, remarques « petit ».
- **Piste et graduation** (condensée 600 ou 500, 15 à 16 px, chiffres tabulaires) : noms des pistes, lectures sous les plumes, heures, étiquettes « Pub ».
- **Bouton** (condensée 600, 22 px, 20 px sur téléphone) et **navigation** (condensée 500, 19 px, 17 px sur téléphone).

### Named Rules
**La règle des 24 px.** Tout texte courant et tout titre de bloc a une hauteur de ligne de 24 px (`--ligne`), soit trois petits carreaux. Les grands titres arrondissent leur interligne au multiple de 8 supérieur. Pas d'interligne sans unité qui ferait sortir le texte de la réglure.

**La règle des deux largeurs.** Condensée pour ce qui s'inscrit sur l'enregistrement, normale pour ce qui se lit. Pas de troisième famille, pas de capitales espacées.

## Layout

**Le papier.** Le fond de `html` porte quatre dégradés d'un pixel : grands carreaux de 40 px en `reglure-forte`, petits de 8 px en `reglure`, positionnés depuis le centre haut. Le cadre de contenu (`--cadre`) mesure un nombre impair de grands carreaux, au plus 1240 px, pour que ses deux bords tombent sur des lignes de la réglure centrée ; sur téléphone, il s'arrondit au multiple de 16 px (avec 16 px de marge minimale de chaque côté).

**Le rythme.** Toutes les cotes verticales sont des multiples de 8 : en-tête de 80 px (64 sur téléphone), ouverture à 40 px du haut (24 sur téléphone), sections espacées de 120 px (96 sur téléphone), titres de section suivis de 40 px, postes et pied à 40 px de marge interne, étapes et questions à 24 px. La bande se pose à 64 px du bouton pour tomber sur une ligne de grands carreaux. Les écarts horizontaux restent sur la même échelle (16, 24, 32, 40, 80) ; quelques réglages internes de contrôles (12 px dans les boutons, 10 px dans la marque) en sortent.

**Les colonnes.** Une gouttière de 160 px (120 sur tablette, 0 sur téléphone) porte les noms des pistes et aligne le relevé sur la bande. Les postes d'installation et le pied sont en deux colonnes, 320 px puis le reste (200 px sur tablette, une colonne sur téléphone) ; les questions en 400 px puis le reste (une colonne dès la tablette). Le relevé découpe sa largeur en minutes de live (7, 17, 22 et 14 parts) pour que chaque note commence à la minute de sa pub.

**Points de rupture.** 1023 px (tablette : ouverture en une colonne, gouttière à 120) et 639 px (téléphone : gouttière à 0, noms des pistes posés sur le papier, relevé redessiné en version étroite, notes empilées).

### Named Rules
**La règle de la seule géométrie.** Une seule grille, celle du papier. Un bloc ne se cale pas « à l'œil » : sa hauteur, sa marge et sa position verticale se ramènent à des carreaux de 8 ou 40 px.

## Elevation & Depth

Le système est entièrement plat. Aucune ombre, aucun flou, aucun verre. La profondeur ne s'exprime que par le papier : un insert de `papier-clair`, bordé de deux filets d'encre, se lit comme une feuille tirée de l'enregistreur et posée sur la page. Son propre quadrillage repart de son bord haut, pour que les pistes tombent sur ses lignes, indépendamment de la réglure de la page.

### Named Rules
**La règle des filets peints.** Les filets horizontaux (têtes de postes, pied, étapes, questions, bords des inserts) sont des dégradés d'un pixel peints en fond (`--filet-encre`, `--filet`), jamais des `border` : ils n'ajoutent aucune hauteur et ne décalent rien de la réglure. Seuls les filets verticaux (bords de la fenêtre de bande, attaches des notes et des étiquettes de pub) et le contour des contrôles sont des bordures.

**La règle du papier plat.** Rien ne flotte au-dessus du papier. Pas d'ombre, même au survol.

## Shapes

Angles droits partout (`rounded.angle`, 0) : boutons, adresse, inserts, lecture de pub. Filets d'un pixel, en `encre` pour ce qui borde un tracé ou ouvre un bloc majeur, en `reglure-forte` pour ce qui sépare des éléments de même niveau. Les seules formes rondes sont les plumes de l'enregistreur (cercles de 4 px de rayon, pleins d'encre quand elles écrivent, évidés sur papier clair quand elles sont levées) et la jambe du R du logo.

### Le logo
Un R dont la jambe part en tracé de ronflement, dessiné en traits épais d'encre (12 et 10 unités sur 96). Un seul fichier, `extension/icon.svg`, en deux formes :
- **L'icône** (extension, favicon) : le R d'encre sur une tuile carrée d'ocre, à angles droits, sans marge arrondie. C'est le seul endroit où l'ocre sort des pubs, parce que l'icône vit hors de la page, à 16 px dans une barre d'outils.
- **Le signe dans la page** : le R nu, sans tuile, à l'encre du texte (`currentColor`), 32 px, à côté du nom en condensée 700. Le build le tire de l'icône (suppression de la tuile, recadrage) et échoue si l'icône change de forme.

## Components

### Buttons
Pleins, plats, condensés : un bouton d'encre est une étiquette imprimée.
- **Shape :** angles droits (0), hauteur 56 px, 28 px de marge horizontale (24 sur téléphone), icône de trait de 22 px à 12 px du texte.
- **Bouton d'encre :** fond `encre`, texte `papier`, condensée 600 à 22 px. Il porte l'action d'installer ou de télécharger, avec l'icône de téléchargement (flèche vers un trait) quand il télécharge un fichier.
- **Hover / Focus :** un seul effet au survol, le fond passe à `encre-survol` (160 ms, `cubic-bezier(0.22, 1, 0.36, 1)`). Focus : contour d'encre de 2 px, décalé de 3 px.
- **Bouton de texte** (Copier, Pause) : 32 px de haut, contour d'encre d'un pixel, fond transparent, condensée 600 à 16 px ; au survol, fond `papier-clair`. Il reste caché tant que son action n'est pas possible (presse-papiers absent, animation réduite).

### Adresse à copier
Le code d'une adresse (`chrome://extensions`) sur un petit insert de `papier-clair`, contour d'un pixel en `reglure-forte`, 4 px sur 10 px de marge, interligne 22 px, suivi de son bouton Copier. Le libellé passe à « Copié » pendant 2,5 s.

### Navigation
Trois liens en condensée 500 à 19 px, espacés de 32 px, sans soulignement au repos et soulignés au survol. Sur téléphone, le lien « Fonctionnement » disparaît. Les liens du texte sont soulignés d'un pixel (décalage 0,2 em), deux pixels au survol.

### Postes, étapes, questions
Des rangées, jamais des cartes. Un poste d'installation s'ouvre par un filet d'encre et porte son titre dans la colonne de gauche ; ses étapes sont numérotées dans une colonne de 40 px (chiffre condensé 700) et séparées par des filets de réglure. Le poste Firefox et chacune des étapes Chrome finissent par « Une fois fait : » (condensée 700) suivi de ce que le visiteur doit voir. Les questions suivent la même logique : premier filet d'encre, les suivants en réglure, titre à gauche, réponse à droite.

### La bande (composant signature)
L'enregistreur du premier écran, pleine largeur du cadre, 280 px de haut : une rangée de 40 px pour les étiquettes « Pub », puis trois pistes de 80 px serrées bord à bord (Twitch diffuse, Vous voyez, Ronflux). Trois colonnes : noms des pistes dans la gouttière, fenêtre bordée de filets verticaux d'encre, lectures à droite (heure en chiffres tabulaires, état de chaque piste).
- **Le papier défile :** dans la fenêtre, un insert de `papier-clair` avec sa propre réglure glisse vers la gauche à 40 px par seconde sous trois plumes fixées sur le bord droit. Les tracés sont calculés au build (`src/enregistrement.js`) et écrits en SVG dans la page : sans JavaScript, la bande montre une image fixe, au milieu d'une pub.
- **Pendant une pub :** voile d'ocre sur toute la hauteur, bloc plein d'ocre sur la piste Twitch, lecture « Une pub » sur fond d'ocre, piste Ronflux qui s'agite (trait de 2 px, lecture « Pub bloquée » en 700), piste « Vous voyez » continue.
- **Pause et mouvement réduit :** un bouton de texte Pause (« Reprendre » une fois arrêté) sous la légende. Avec `prefers-reduced-motion: reduce`, la bande ne défile pas et le bouton reste caché ; elle s'arrête aussi hors de l'écran. Le défilement doux de l'ancre est coupé dans le même cas.
- **Téléphone :** la gouttière tombe à 0 ; les noms des pistes se posent sur le papier, en haut à gauche de chaque piste, sur un cache de `papier-clair`, en 13 px.

### Le relevé
Le même papier clair, tiré pour une heure de live en deux pistes de 80 px (Sans Ronflux, Avec Ronflux) : graduations horaires au-dessus, étiquettes de pubs attachées au tracé par un filet vertical d'encre, voile et bloc d'ocre aux pubs, masquage en pointillé de 4 px. Sous le relevé, trois notes épinglées chacune par un filet vertical d'encre qui part de la minute de sa pub. Sur téléphone, un tracé étroit dédié remplace le large et les notes s'empilent.

## Do's and Don'ts

### Do:
- **Do** poser chaque cote verticale sur un multiple de 8 et chaque bloc majeur sur une ligne de grands carreaux de 40 px.
- **Do** garder une hauteur de ligne de 24 px pour le texte et les titres de bloc.
- **Do** peindre les filets horizontaux en fond (`--filet-encre`, `--filet`) plutôt qu'en bordure.
- **Do** réserver l'ocre aux pubs, sur les tracés et dans la lecture sous les plumes.
- **Do** tirer un tracé sur un insert de `papier-clair` bordé de deux filets d'encre, avec sa réglure partie de son bord haut.
- **Do** épingler une explication au tracé par un filet vertical d'encre, à l'instant qu'elle décrit.
- **Do** donner à toute animation un arrêt : bouton Pause, arrêt hors écran, image fixe avec `prefers-reduced-motion`.
- **Do** utiliser le R nu à l'encre dans la page, et la tuile ocre seulement pour l'icône et le favicon.

### Don't:
- **Don't** utiliser d'ombre, d'arrondi, de flou ou de verre : le système est plat et à angles droits.
- **Don't** ajouter une quatrième valeur d'encre ni une deuxième couleur d'événement.
- **Don't** donner l'ocre à un lien, un bouton ou une mise en avant.
- **Don't** ranger le contenu en cartes : des rangées séparées par des filets.
- **Don't** reprendre quoi que ce soit de Twitch (violet, lecteur) ni du Pokémon dont vient le nom.
- **Don't** introduire une troisième famille de caractères, ni des capitales espacées.
- **Don't** poser la tuile ocre du logo dans la page.
