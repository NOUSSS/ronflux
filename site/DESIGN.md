---
name: Ronflux
description: Affiche de lutte sérigraphiée pour le site de Ronflux, bloqueur des pubs des lives Twitch.
colors:
  papier: "#ff8fb8"
  encre: "#13286b"
  encre-douce: "color-mix(in oklab, #13286b 86%, #ff8fb8)"
  encre-trame: "color-mix(in oklab, #13286b 12%, #ff8fb8)"
  encre-rouge: "#e3201b"
  encre-jaune: "#f2ff3d"
  encre-surimpression: "#11050b"
typography:
  display:
    fontFamily: "Affiche, Arial Narrow, sans-serif"
    fontSize: "clamp(4.25rem, min(21vw, 22svh), 16rem)"
    fontWeight: 900
    lineHeight: 0.8
    letterSpacing: "-0.005em"
  marque-pied:
    fontFamily: "Affiche, Arial Narrow, sans-serif"
    fontSize: "clamp(5rem, 30vw, 34rem)"
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Affiche, Arial Narrow, sans-serif"
    fontSize: "clamp(2.75rem, 1.4rem + 5vw, 6rem)"
    fontWeight: 850
    lineHeight: 0.9
  chiffre:
    fontFamily: "Affiche, Arial Narrow, sans-serif"
    fontSize: "3.25rem"
    fontWeight: 900
    lineHeight: 0.8
  bouton:
    fontFamily: "Affiche, Arial Narrow, sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 0.8vw, 2rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  marque:
    fontFamily: "Affiche, Arial Narrow, sans-serif"
    fontSize: "2rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.01em"
  title:
    fontFamily: "Texte, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  tract:
    fontFamily: "Texte, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 1rem + 0.4vw, 1.3125rem)"
    fontWeight: 500
    lineHeight: 1.45
  body:
    fontFamily: "Texte, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Texte, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  code:
    fontFamily: "ui-monospace, Cascadia Mono, Menlo, Consolas, monospace"
    fontWeight: 600
rounded:
  rayon: "0"
spacing:
  e-1: "0.25rem"
  e-2: "0.5rem"
  e-3: "0.75rem"
  e-4: "1rem"
  e-5: "1.5rem"
  e-6: "2rem"
  e-7: "3rem"
  e-8: "4rem"
  e-9: "6rem"
  e-10: "9rem"
  marge: "clamp(1rem, 4vw, 4rem)"
  gouttiere: "clamp(1rem, 2vw, 2rem)"
  entete-h: "4.5rem"
components:
  bouton-installer:
    backgroundColor: "{colors.encre-jaune}"
    textColor: "{colors.encre}"
    typography: "{typography.bouton}"
    rounded: "{rounded.rayon}"
    padding: "0.5em 0.85em 0.45em"
  bouton-installer-hover:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.encre-jaune}"
  bouton-copier:
    backgroundColor: "transparent"
    textColor: "{colors.encre}"
    typography: "{typography.label}"
    rounded: "{rounded.rayon}"
    padding: "0.45em 0.8em"
  bouton-copier-hover:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.papier}"
  adresse-code:
    backgroundColor: "{colors.encre-trame}"
    textColor: "{colors.encre}"
    typography: "{typography.code}"
    rounded: "{rounded.rayon}"
    padding: "0.3em 0.55em"
  piste-live:
    backgroundColor: "{colors.encre}"
    height: "1.75rem"
  piste-pub:
    backgroundColor: "{colors.encre-rouge}"
    height: "3.5rem"
  lien-evitement:
    backgroundColor: "{colors.encre}"
    textColor: "{colors.papier}"
    padding: "{spacing.e-2} {spacing.e-4}"
---

# Design System: Ronflux

## Overview

**Creative North Star: "L’affiche sérigraphiée"**

Le site est une affiche de lutte tirée en sérigraphie, pas une page de logiciel. Un papier rose vif, grainé, couvre toute la page ; deux encres à plat, bleu nuit et rouge, y sont tirées ; une troisième, jaune fluo, ne sert qu’au bouton d’installation. Tout est à angle vif, rien ne flotte : la profondeur vient de la superposition des encres, jamais d’une ombre.

La composition s’ordonne sur une grille de douze colonnes et une seule ligne de repérage verticale, décentrée, sur laquelle se posent les croix de repérage. Les titres s’arrêtent avant elle, les corps de texte partent d’elle. Les lettres pochoir condensées très grasses font l’affiche ; une grotesque lisible fait le tract. Le seul endroit où le tirage montre son défaut est la bande rouge du slogan, évidée à l’emplacement des lettres et légèrement hors repérage.

Densité basse, grands blancs verticaux (9 rem en tête de partie), peu de composants, chacun avec un seul rôle.

**Key Characteristics:**
- Papier rose grainé, encres à plat, aucun dégradé décoratif.
- Jaune réservé à l’action d’installer.
- Aucun arrondi, aucune ombre.
- Une ligne de repérage décentrée, des croix posées dessus.
- Affiche pochoir pour la voix, grotesque pour l’explication.

## Colors

Un papier, deux encres et une encre réservée ; les tons intermédiaires sont l’encre bleue mélangée au papier, jamais une nouvelle teinte.

### Primary
- **Bleu nuit d’encre** (`encre`) : toute l’encre courante. Texte, titres, slogan, segments « live » des pistes, filets fins, croix de repérage, contour de focus, sélection de texte (fond bleu, texte papier), survol du bouton d’installation.

### Secondary
- **Rouge de sérigraphie** (`encre-rouge`) : la deuxième encre. Bande en biais du slogan (grainée comme le papier), segments « pub » des pistes et leur légende, filet épais en tête de chaque rang d’installation. Jamais pour du texte.

### Tertiary
- **Jaune fluo** (`encre-jaune`) : le fond du bouton d’installation, et son texte au survol. Rien d’autre.

### Neutral
- **Papier rose** (`papier`) : fond de toute la page, sous la texture `grain.svg` (240 px, bruit teinté de l’encre bleue). Aussi la couleur de l’évidement de la bande rouge et du fond de la tête de lecture.
- **Encre douce** (`encre-douce`, 86 % d’encre dans le papier) : texte secondaire en petit corps (faits sous le bouton, légendes de figure, mentions du pied).
- **Trame** (`encre-trame`, 12 % d’encre dans le papier) : fond de l’adresse à copier, seul aplat clair de la page.
- **Surimpression** (`encre-surimpression`) : bleu sous rouge en multiplication. Ne sert qu’au chevauchement des lettres et de la bande rouge dans le slogan.

### Named Rules
**La règle de l’encre jaune.** Le jaune signale une seule action : installer (ou choisir sa famille de navigateurs pour installer). Un élément jaune qui ne mène pas à l’installation est une erreur.

**La règle des deux encres.** Hors du jaune, tout s’imprime en bleu nuit ou en rouge sur le papier. Un ton plus clair ou plus doux se fait en mélangeant l’encre bleue au papier (`color-mix` en oklab), pas en ajoutant une couleur.

## Typography

**Display Font:** Affiche, Big Shoulders Stencil variable auto-hébergée (repli Arial Narrow, sans-serif)
**Body Font:** Texte, Archivo variable auto-hébergée (repli system-ui, sans-serif)
**Label/Mono Font:** pile système monospace (ui-monospace, Cascadia Mono, Menlo, Consolas) pour les adresses à copier

**Character:** un pochoir condensé, très gras, qui parle fort comme une affiche collée, et une grotesque large et calme qui explique comme un tract. Les deux polices sont servies par le site, en `font-display: block`.

### Hierarchy
- **Display** (900, de 4,25 à 16 rem selon la largeur et la hauteur d’écran, interligne 0,8) : le slogan seul, en capitales, sur trois lignes qui descendent en escalier jusqu’à la ligne de repérage.
- **Marque du pied** (900, de 5 à 34 rem, interligne 0,78) : le nom « Ronflux » en très grand, clôture de l’affiche.
- **Headline** (850, de 2,75 à 6 rem, interligne 0,9, 16 ch au plus, équilibré) : titres de partie.
- **Chiffre** (900, 3,25 rem, interligne 0,8) : numéros des étapes d’installation, en Affiche.
- **Bouton** (800, de 1,5 à 2 rem, interligne 1) : libellé du bouton jaune, en Affiche, casse normale.
- **Marque** (900, 2 rem) : le nom dans l’en-tête.
- **Title** (700, 1,25 rem, interligne 1,25) : titres h3 en Texte (rangs d’installation, explications, questions). Les h4 des étapes prennent le corps du texte en 700.
- **Tract** (500, de 1,125 à 1,3125 rem, interligne 1,45, 34 ch au plus) : les trois phrases du premier écran.
- **Body** (400, 1,0625 rem, interligne 1,55) : texte courant, 42 à 65 ch selon le bloc.
- **Label** (0,9375 rem) : petit texte, en encre douce ; chiffres tabulaires sur les règles de temps et les faits de version.

### Named Rules
**La règle de l’affiche et du tract.** Affiche ne sert qu’à ce qui se lit de loin : slogan, titres de partie, marque, chiffres d’étapes, bouton jaune. Tout ce qui se lit de près est en Texte.

**La règle des capitales.** Seul le slogan est en capitales. Libellés, boutons, titres et liens restent en casse normale, sans espacement élargi.

## Layout

Un cadre de 112 rem au plus, centré, avec une marge latérale fluide (`marge`, de 1 à 4 rem). Dedans, une grille d’une colonne sur téléphone, de douze colonnes à partir de 48 rem, avec une gouttière fluide (`gouttiere`, de 1 à 2 rem).

**La ligne de repérage** (`--ligne`) est le début d’une colonne : la 7e entre 48 et 64 rem, la 6e à partir de 64 rem. Ce qui s’accroche à gauche (bloc d’installation du premier écran, titres des rangs d’installation, questions, première mention du pied) occupe les colonnes 1 à la ligne ; ce qui part d’elle (tract, corps des rangs, réponses, seconde mention) va de la ligne au bord droit, ou jusqu’à la colonne 12 pour le tract et les réponses à partir de 64 rem. La troisième ligne du slogan commence aussi sur elle ; la deuxième est décalée de deux colonnes.

Premier écran : à partir de 64 rem de large et 40 rem de haut, l’affiche occupe toute la hauteur sous l’en-tête (4,5 rem), slogan en haut, bloc d’installation et tract en bas. Sur téléphone, le tract passe avant le bloc d’installation.

Rythme vertical sur l’échelle `e-1` à `e-10` : 9 rem au-dessus de chaque partie (la croix se pose au milieu), 4 rem sous un titre de partie, 3 rem de part et d’autre d’un rang d’installation, 2 rem pour une question. La figure des pistes et le mécanisme qui la suit partagent les mêmes proportions (en secondes de la soirée) : chaque explication commence sous sa coupure, à partir de 64 rem.

Les étapes d’installation passent sur deux colonnes quand leur conteneur dépasse 46 rem (requête de conteneur).

## Elevation & Depth

Aucune ombre portée, aucun relief. Toute la page est à plat, au même niveau que le papier. La profondeur vient de l’ordre de tirage des encres : la bande rouge passe sur le papier, les lettres bleues la chevauchent, et leur recouvrement donne la surimpression plus sombre. La seule `text-shadow` du système fait partie de cette construction (elle dessine la surimpression bleu sous rouge dans la bande du slogan, sans flou) : c’est une encre, pas une ombre.

### Named Rules
**La règle du tirage à plat.** Pas de `box-shadow`, pas de flou, pas de verre, pas de lueur. Un élément se détache par sa couleur d’encre, pas par une élévation.

**La règle du seul défaut.** Le décalage de repérage (de 1,5 à 3 px) n’existe que dans la bande rouge du slogan. Le reste du tirage est parfaitement calé.

## Shapes

Angles vifs partout (`rayon` : 0). Les formes sont des aplats rectangulaires, des filets et des trames. Deux épaisseurs de trait : `--trait` (3 px) pour le focus, le survol des liens et le filet rouge des rangs d’installation ; `--trait-fin` (1,5 px) pour le soulignement des liens, la règle de temps, les filets des questions et le contour de la tête de lecture. La seule forme oblique est la bande rouge du slogan (−1,6°). Les motifs des pistes sont des trames d’impression : points (5 px) et hachures à −45° (pas de 6 px).

**La règle de l’angle vif.** Aucun arrondi, sur aucun élément, à aucune taille.

## Components

### Buttons
- **Shape :** angles vifs (0).
- **Bouton d’installation :** fond jaune, texte bleu en Affiche 800, icône de téléchargement au trait carré (0,9 em, trait 2,6) quand le bouton télécharge ou installe ; pas d’icône sur les boutons de choix de famille. Le libellé nomme le navigateur reconnu (« Installer pour Firefox », « Télécharger pour Chrome »).
- **Hover / Focus :** au survol, les encres s’inversent (fond bleu, texte jaune), en 160 ms sur la courbe `sortie`. Focus : contour bleu de 3 px décalé de 3 px, commun à toute la page.
- **Bouton de copie :** secondaire, transparent, contour d’encre bleue, texte en Texte 600 au petit corps. Au survol, fond bleu et texte papier. Caché sans presse-papiers ; son libellé devient « Copié » pendant 2,5 s.

### Blocs selon le navigateur
Le bloc d’installation du premier écran existe en trois états, choisis avant le premier affichage par l’attribut `data-nav` de `<html>` (`firefox`, `chromium`, sinon `autre`, plus `mobile`) et le nom du navigateur Chromium (`data-nav-nom`) : un seul bouton jaune pour le navigateur reconnu, une ligne de faits en petit corps (version, prérequis), puis les autres versions en liens. Sans détection, deux boutons jaunes de même largeur l’un sous l’autre. Sur téléphone, une phrase en 600 renvoie à un navigateur d’ordinateur, sans bouton.

### Pistes de la soirée (composant signature)
Deux pistes du même live, alignées sur une règle de temps en chiffres tabulaires soulignée d’un filet fin. Chaque piste a un nom en 700, une rangée de notes (filet vertical d’un côté, texte petit en 600) et une bande. Vocabulaire des segments :
- **Live** : aplat bleu, mi-hauteur (1,75 rem).
- **Pub** : aplat rouge, pleine hauteur (3,5 rem).
- **Diffusion de secours** : trame de points bleus.
- **Pub masquée** : hachures bleues.
Les colonnes suivent la durée réelle en secondes, avec 3 px au moins pour une coupure. Les mêmes motifs servent de légende (3 × 0,875 rem) au-dessus de chaque explication.

### Rangs d’installation
Chaque famille de navigateurs est un rang de la grille, ouvert par un filet rouge de 3 px : titre à gauche de la ligne, corps à droite. Le bouton jaune y est précédé de 1,5 rem. Les étapes sont une liste ordonnée, numéros en Affiche 900 à gauche du texte. Le rang du userscript est discret : tout en petit corps, sans bouton, un simple lien.

### Adresse à copier
Code monospace 600 sur la trame claire, suivi du bouton de copie, sur une ligne qui passe à la ligne au besoin.

### Questions
Une question par rang de grille, entre deux filets fins bleus (le dernier fermé en bas) : la question en h3 à gauche de la ligne, la réponse à droite, 65 ch au plus.

### Navigation
En-tête de 4,5 rem : la marque en Affiche à gauche, deux liens d’ancre en Texte 600 à droite, soulignés en trait fin, trait épais au survol. Un lien d’évitement bleu sur papier apparaît au focus.

### Croix de repérage
Une croix (cercle et deux axes, `repere.svg` en masque, teintée en encre bleue) en tête de chaque partie et du pied, 14 px sur téléphone, 28 px à partir de 48 rem. À partir de 48 rem, toutes sont centrées sur la ligne de repérage, au milieu de la marge haute de leur partie ; la croix du premier écran se pose au milieu de l’écart entre le slogan et le bloc d’installation. Sur téléphone, elles se rangent au milieu de la marge gauche.

### Bande du slogan
Le slogan est un h1 en Affiche. Une bande rouge grainée, pivotée de −1,6°, passe sous la deuxième ligne et déborde de la marge de part et d’autre. Par-dessus, une copie décorative du slogan, découpée à la bande et masquée aux lecteurs d’écran, en deux couches : l’évidement couleur papier, décalé du défaut de repérage, dont la surimpression ramenée à la place des lettres donne le bleu sous rouge ; puis les lettres bleues en mode `darken`, qui ne repassent en bleu que le papier de l’évidement. Le défaut vaut 1,5 à 3 px en horizontal et 0,75 à 1,25 px en vertical, proportionné au corps.

### Mouvement
Courbe unique `sortie` (`cubic-bezier(0.16, 1, 0.3, 1)`) ; 160 ms pour les changements d’état (liens, boutons), en couleur ou épaisseur de trait seulement.
- **Calage :** au chargement, l’évidement de la bande glisse d’un décalage de 0,3 em jusqu’à son léger défaut, en 900 ms après 0,15 s.
- **Tête de lecture :** un trait papier de 3 px cerné de bleu traverse les deux pistes en 24 s, en boucle linéaire, et s’arrête au survol de la figure.
- **Mouvement réduit :** pas de calage (la bande est directement à son défaut), pas de tête de lecture, aucune transition.

## Do's and Don'ts

### Do:
- **Do** coder uniquement avec les jetons de `:root` (encres, échelle `e-1` à `e-10`, `trait`, `trait-fin`, `rayon`, `sortie`, durées).
- **Do** réserver le jaune au bouton d’installation, avec l’inversion bleu et jaune au survol.
- **Do** poser chaque nouvelle partie sur la grille de douze colonnes : titre avant la ligne de repérage, corps à partir d’elle, et sa croix centrée sur la ligne.
- **Do** dire une donnée par une trame d’impression (aplat, points, hachures) en encre bleue ou rouge, comme les pistes.
- **Do** garder un seul effet de survol (inversion d’encres, ou épaississement du soulignement) et seulement sur ce qui est cliquable.
- **Do** reprendre le même composant pour le même rôle : un rang d’installation ouvre sur un filet rouge, une question entre deux filets fins, un petit texte en encre douce.
- **Do** arrêter toute animation sous `prefers-reduced-motion`.

### Don't:
- **Don't** ajouter une ombre portée, un flou, du verre ou une lueur.
- **Don't** arrondir un angle.
- **Don't** utiliser le jaune pour autre chose que l’installation, ni le rouge pour du texte.
- **Don't** ajouter une teinte : un ton plus doux se fait en mélangeant l’encre bleue au papier.
- **Don't** étendre le défaut de repérage hors de la bande du slogan.
- **Don't** poser une croix de repérage ailleurs que sur la ligne (ou au milieu de la marge sur téléphone).
- **Don't** mettre en capitales autre chose que le slogan, ni espacer les lettres d’un libellé.
- **Don't** imiter Twitch : ni son violet, ni son logo, ni l’allure de son lecteur.
