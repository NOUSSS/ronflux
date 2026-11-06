---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

## Scope

Page d'accueil de Ronflux (`site/index.html`), une seule page. Mode : Persuade.
Visiteur : spectateur de lives Twitch, non technique. Action : installer la version qui
correspond à son navigateur (Firefox en un clic, Chromium par ZIP en mode développeur,
userscript en option discrète). Preuve : le mécanisme montré, pas des chiffres (il n'y en a
pas). Contraintes : aucun script tiers, rien de Twitch dans l'allure, rien du Pokémon dans le
logo. Le logo sert aussi d'icône à l'extension (16 à 128 px).

## Direction contract

THESIS: Le site est le compte rendu d'une soirée de live, établi comme un enregistrement du
sommeil : les pubs sont des événements notés sur le tracé, et pendant qu'elles passent, la
piste de Ronflux ronfle. Il refuse la page de bloqueur habituelle (fond sombre, titre centré,
capture du lecteur, trois cartes d'avantages).

OWN-WORLD: Papier d'enregistreur vert pâle, réglé en grands carreaux de 40 px et petits de
8 px, sur toute la page. Encre vert-noir en trois valeurs : texte et tracés, annotations,
réglure. Une seule couleur d'événement, l'ocre, posée en surligneur sur les pubs. Grotesque
condensée pour titres, noms de pistes et graduations, sa largeur normale pour le texte,
chiffres tabulaires. Filets d'un pixel, angles droits, ni ombre ni arrondi, bouton plein
d'encre.

STORY: Le visiteur lit que pendant la pub Ronflux ronfle à sa place et que le live continue.
Il voit la bande défiler, le tracé du live rester continu quand la pub passe, et installe la
bonne version. Il lit ensuite le compte rendu d'une heure, annoté au moment de chaque pub,
puis suit le protocole d'installation, chaque poste avec ce qu'il doit voir une fois fini.

FIRST VIEWPORT: Logo (un R dont la jambe part en tracé) et nom en haut à gauche, trois liens à
droite. Titre sur deux lignes à gauche, environ 72 px, sur deux tiers de la largeur ; note de
trois phrases à droite. Sous le titre, le bouton d'encre « Installer pour <navigateur> » et
ses faits. Le dernier tiers est la bande d'enregistrement pleine largeur : trois pistes
(Twitch diffuse, Vous voyez, Ronflux) qui défilent sous des plumes fixées à droite, avec une
lecture de l'heure et de l'état.

FORM: Compte rendu de polysomnographie, sixième de ma liste ordonnée, tirage assigné ;
seed:60c670de2acaa678. Raises : une seule géométrie, la grille du papier (BBS) ; chaque
explication épinglée au tracé à l'instant qu'elle décrit (tenségrité) ; un seul tracé fort par
écran (ikebana) ; trois valeurs d'encre, une couleur d'événement, filets d'un pixel (rail
central) ; installation en postes ordonnés avec leur état fini (chambre noire) ; pistes
serrées bord à bord dans la bande (gyaru). Signature : quand une pub passe sous les plumes, la
piste Twitch se remplit d'ocre, la piste Ronflux s'agite, la piste « Vous voyez » reste
continue et la lecture affiche « Pub bloquée ». Arrêtée avec prefers-reduced-motion, en pause
hors de l'écran.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Moment marquant

La bande du premier écran : la pub passe sous les plumes, la piste du live ne casse pas, et
Ronflux ronfle.

## Non résolu

Adresse du site, lien Chrome Web Store (constante vide), contenu final des fichiers de
`/telecharger/`. Une version « norme du secteur » a été construite en parallèle sur une autre
branche (`claude/landing-standard-77bc20`) ; l'utilisateur a retenu celle-ci.
