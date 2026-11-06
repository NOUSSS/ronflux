/*
 * Tracés de démonstration du site : la bande qui défile en haut de page et le relevé d'une
 * heure de live. Tout est calculé, rien n'est enregistré : signaux synthétiques, déterministes.
 *
 * Utilisé à deux endroits :
 *  - au build, par vite.config.js, qui écrit les SVG dans la page (visibles sans JavaScript) ;
 *  - dans la page, par main.js, qui fait défiler la bande et déplace les plumes.
 */

const r1 = (n) => Math.round(n * 10) / 10;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ Bande */

// Le papier se répète tous les BANDE.periode pixels : signaux et pubs sont périodiques sur
// cette longueur, pour que la boucle ne se voie pas.
export const BANDE = {
  periode: 1600,
  piste: 80, // hauteur d'une piste
  regle: 40, // rangée du haut, où s'inscrivent les pubs
  vitesse: 40, // pixels de papier par seconde
  secondesParPixel: 15 / 40, // horloge accélérée : un grand carreau vaut quinze secondes
  // [début, longueur] de chaque pub dans la période
  pubs: [
    [240, 200],
    [880, 320],
  ],
};
BANDE.hauteur = BANDE.regle + 3 * BANDE.piste;

// Point du papier sous les plumes à l'affichage de la page : au milieu de la seconde pub,
// Ronflux en train de ronfler. C'est aussi l'image fixe, sans JavaScript ou sans animation.
export const POINT_FIXE = 880 + 200;

// Le SVG couvre deux périodes ; son bord droit, posé contre les plumes, porte POINT_FIXE.
const DEBUT_SVG = POINT_FIXE - 2 * BANDE.periode;

const modulo = (x, n) => ((x % n) + n) % n;

// Activité du live : une somme de sinus dont les fréquences divisent la période.
export function signalLive(p) {
  const L = BANDE.periode;
  const enveloppe = 0.72 + 0.28 * Math.sin((TAU * 3 * p) / L + 0.6);
  const s =
    7 * Math.sin((TAU * 25 * p) / L + 0.3) +
    5 * Math.sin((TAU * 41 * p) / L + 1.1) +
    3.2 * Math.sin((TAU * 75 * p) / L + 2.0) +
    5.5 * Math.sin((TAU * 15 * p) / L + 0.7) +
    2 * Math.sin((TAU * 121 * p) / L + 0.4);
  return s * enveloppe;
}

// La pub qui couvre ce point du papier, ou null.
export function pubEn(p) {
  const x = modulo(p, BANDE.periode);
  for (const [debut, duree] of BANDE.pubs) {
    if (x >= debut && x < debut + duree) return { debut, duree, u: (x - debut) / duree };
  }
  return null;
}

// Ronflux : il respire en veille, il ronfle pendant la pub.
export function signalRonfle(p) {
  const souffle = 2.2 * Math.sin((TAU * 10 * p) / BANDE.periode);
  const pub = pubEn(p);
  if (!pub) return souffle;
  const e = Math.pow(Math.sin(Math.PI * pub.u), 0.7);
  const x = (pub.u * pub.duree * TAU) / 56;
  return souffle * (1 - e) + 24 * e * (Math.sin(x) + 0.32 * Math.sin(2 * x + 0.9));
}

function trace(signal, debut, fin, pas, milieu) {
  let d = '';
  for (let p = debut; p <= fin + 1e-9; p += pas) {
    d += `${d ? 'L' : 'M'}${r1(p)} ${r1(milieu - signal(p))}`;
  }
  return d;
}

// Pubs placées sur le SVG (coordonnées du SVG), en entier ou en partie.
function pubsSurLeSvg() {
  const L = BANDE.periode;
  const largeur = 2 * L;
  const liste = [];
  for (let k = -3; k <= 3; k++) {
    for (const [a, n] of BANDE.pubs) {
      const x = a + k * L - DEBUT_SVG;
      const debut = Math.max(0, x);
      const fin = Math.min(largeur, x + n);
      if (fin > debut) liste.push([debut, fin - debut, x]);
    }
  }
  return liste.sort((p, q) => p[0] - q[0]);
}

// Le papier de la bande : deux périodes côte à côte, dont la page fait défiler une fenêtre
// (main.js). Pistes de haut en bas : Twitch diffuse, Vous voyez, Ronflux.
export function svgBande() {
  const { periode: L, piste: h, regle } = BANDE;
  const largeur = 2 * L;
  const m = h / 2;
  const pubs = pubsSurLeSvg();

  // Chaque tracé est dessiné sur une période puis répété (<use>) pour couvrir le SVG.
  const copies = [];
  for (let k = -3; k <= 3; k++) {
    const x = k * L - DEBUT_SVG;
    if (x < largeur && x + L > 0) copies.push(x);
  }
  const repete = (id) => copies.map((x) => `<use href="#${id}" x="${x}"/>`).join('');

  // Morceaux de papier où Twitch diffuse le live, entre les pubs.
  const horsPub = [];
  let x = 0;
  for (const [a, n] of pubs) {
    if (a > x) horsPub.push([x, a - x]);
    x = a + n;
  }
  if (x < largeur) horsPub.push([x, largeur - x]);

  const surligne = pubs
    .map(([a, n]) => `<rect class="b-surligne" x="${a}" y="0" width="${n}" height="${BANDE.hauteur}"/>`)
    .join('');
  // L'étiquette suit le début de la pub, même quand celui-ci est hors du SVG.
  const etiquettes = pubs
    .filter(([, , depart]) => depart >= 0)
    .map(([, , depart]) => `<text class="b-etiquette" x="${depart + 8}" y="${regle - 14}">Pub</text>`)
    .join('');
  const blocs = pubs
    .map(([a, n]) => `<rect class="b-pub" x="${a}" y="${regle + 16}" width="${n}" height="${h - 32}"/>`)
    .join('');
  const decoupe = horsPub.map(([a, n]) => `<rect x="${a}" y="0" width="${n}" height="${h}"/>`).join('');

  return `<svg class="bande-papier" width="${largeur}" height="${BANDE.hauteur}" viewBox="0 0 ${largeur} ${BANDE.hauteur}" aria-hidden="true" focusable="false">
<defs><path id="b-live" d="${trace(signalLive, 0, L, 4, m)}"/><path id="b-ronfle" d="${trace(signalRonfle, 0, L, 3, m)}"/><clipPath id="b-hors-pub">${decoupe}</clipPath></defs>
${surligne}${etiquettes}${blocs}
<g class="b-trace" transform="translate(0 ${regle})"><g clip-path="url(#b-hors-pub)">${repete('b-live')}</g></g>
<g class="b-trace" transform="translate(0 ${regle + h})">${repete('b-live')}</g>
<g class="b-trace b-ronflux" transform="translate(0 ${regle + 2 * h})">${repete('b-ronfle')}</g>
</svg>`;
}

// Décalage du SVG (translateX, en pixels) quand `ecoule` pixels de papier ont défilé depuis
// POINT_FIXE. Toujours dans ]0, période] : l'image est la même qu'au décalage 0.
export function decalage(ecoule) {
  return BANDE.periode - modulo(ecoule, BANDE.periode);
}

// Plumes et lectures pour un point du papier. Une plume levée (null) n'écrit pas.
export function etatBande(p) {
  const m = BANDE.piste / 2;
  const pub = Boolean(pubEn(p));
  return {
    pub,
    plumes: [pub ? null : m - signalLive(p), m - signalLive(p), m - signalRonfle(p)],
  };
}

// Heure affichée par la lecture, à partir de 20 h 41 au début du papier, à la minute,
// notée comme ailleurs sur la page (« 20 h 07 »).
export function heure(p) {
  const s = Math.floor(20 * 3600 + 41 * 60 + p * BANDE.secondesParPixel) % 86400;
  return `${Math.floor(s / 3600)} h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
}

// Les plumes, fixes, au bout de la fenêtre : un petit SVG dont main.js déplace les points.
export function svgPlumes() {
  const { regle, piste: h } = BANDE;
  const etat = etatBande(POINT_FIXE);
  const points = etat.plumes
    .map((y, i) => {
      const levee = y === null;
      return `<circle class="plume${levee ? ' plume-levee' : ''}" cx="5" cy="${r1(regle + i * h + (levee ? h / 2 : y))}" r="4"/>`;
    })
    .join('');
  return `<svg class="bande-plumes" width="10" height="${BANDE.hauteur}" viewBox="0 0 10 ${BANDE.hauteur}" aria-hidden="true" focusable="false">${points}</svg>`;
}

/* ------------------------------------------------------------------ Relevé d'une heure */

// Une heure de live, de 20 h à 21 h. Deux tirages : large (1080 unités, 18 par minute) et
// étroit pour le téléphone (360 unités, 6 par minute), chacun à peu près à un pixel l'unité,
// pour garder la même densité de tracé.
// Les pubs : [minute de début, durée en minutes, masquée ?]. Les colonnes des notes, dans
// style.css (.releve-grille), reprennent ces minutes : 7, 24 et 46.
export const RELEVE = {
  largeurs: { large: 1080, etroit: 360 },
  pubMin: 6, // une pub ne fait jamais moins de 6 unités de large, pour rester visible
  piste: 80,
  pubs: [
    [7, 0.5, false],
    [24, 1.5, false],
    [46, 3, true],
  ],
};

function signalHeure(x) {
  return (
    (6.5 * Math.sin(x * 0.21 + 0.4) +
      4.5 * Math.sin(x * 0.53 + 1.3) +
      3 * Math.sin(x * 1.07 + 2.1) +
      4 * Math.sin(x * 0.083 + 0.2)) *
    (0.75 + 0.25 * Math.sin(x * 0.011))
  );
}

export function svgReleve(tirage) {
  const W = RELEVE.largeurs[tirage];
  if (!W) throw new Error(`Tirage du relevé inconnu : ${tirage}`);
  const h = RELEVE.piste;
  const m = h / 2;
  const parMinute = W / 60;
  const pubs = RELEVE.pubs.map(([debut, duree, masquee]) => [debut * parMinute, Math.max(duree * parMinute, RELEVE.pubMin), masquee]);

  // Sans Ronflux : le live s'arrête à chaque pub.
  const morceaux = [];
  let x = 0;
  for (const [a, n] of pubs) {
    morceaux.push([x, a]);
    x = a + n;
  }
  morceaux.push([x, W]);
  const sans = morceaux.map(([a, b]) => trace(signalHeure, a, b, 2, m)).join('');

  // Avec Ronflux : continu, sauf pendant la pub masquée, où l'image disparaît.
  const [ma, mn] = pubs.find(([, , masquee]) => masquee);
  const avec = trace(signalHeure, 0, ma, 2, m) + trace(signalHeure, ma + mn, W, 2, m);

  const surligne = pubs
    .map(([a, n]) => `<rect class="b-surligne" x="${r1(a)}" y="0" width="${r1(n)}" height="${2 * h}"/>`)
    .join('');
  const blocs = pubs
    .map(([a, n]) => `<rect class="b-pub" x="${r1(a)}" y="16" width="${r1(n)}" height="${h - 32}"/>`)
    .join('');

  return `<svg class="releve-traces releve-${tirage}" viewBox="0 0 ${W} ${2 * h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
${surligne}${blocs}
<g class="b-trace"><path d="${sans}"/></g>
<g class="b-trace" transform="translate(0 ${h})"><path d="${avec}"/><path class="b-masque" d="M${r1(ma)} ${m}H${r1(ma + mn)}"/></g>
</svg>`;
}
