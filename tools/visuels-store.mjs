// Visuels de la fiche Chrome Web Store, tirés du logo et du site :
//   - icône de la fiche, 128 × 128 : le logo en 96 × 96 avec 16 px de marge transparente,
//     comme le demande le Chrome Web Store ;
//   - petite vignette promotionnelle, 440 × 280 : le logo, le nom et une piste de la bande
//     du site, Ronflux qui ronfle pendant une pub ;
//   - captures d'écran 1280 × 800 : le haut de la page et le relevé d'une heure de live.
//
//   node tools/visuels-store.mjs <adresse du site>      → dist/store/
//
// L'adresse est celle d'un site servi (npm run dev ou preview dans site/, ou le site en ligne).
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { BANDE, signalRonfle } from '../site/src/enregistrement.js';

const racine = fileURLToPath(new URL('..', import.meta.url));
const sortie = join(racine, 'dist', 'store');
const [site] = process.argv.slice(2);
if (!/^https?:\/\/\S+$/.test(site || '')) {
  console.error('usage : node tools/visuels-store.mjs <adresse du site>');
  process.exit(2);
}
mkdirSync(sortie, { recursive: true });

const logo = readFileSync(join(racine, 'extension', 'icon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
// Police intégrée en data: : une page chargée par setContent n'a pas le droit de lire un fichier
// local, et la police de secours passerait sans erreur.
const police = (famille, fichier) => {
  const donnees = readFileSync(join(racine, 'site', 'node_modules', '@fontsource-variable', fichier)).toString('base64');
  return `@font-face { font-family: '${famille}'; font-weight: 1 1000; src: url('data:font/woff2;base64,${donnees}') format('woff2-variations'); }`;
};

// Jetons du site (site/src/style.css).
const jetons = {
  papier: '#eef2ec',
  papierClair: '#f6f8f4',
  reglure: '#dfe8e1',
  reglureForte: '#c6d6ca',
  encre: '#1d2a2f',
  ocreVoile: 'rgb(217 164 65 / 0.3)',
};

// Piste de Ronflux sur la vignette : 360 × 80 px pour 600 px de papier de la bande, autour
// de la seconde pub (880 à 1200), pour qu'il respire, ronfle, puis respire de nouveau.
function piste() {
  const largeur = 360;
  const hauteur = 80;
  const debut = 700;
  const fin = 1300;
  const echelle = largeur / (fin - debut);
  let d = '';
  for (let p = debut; p <= fin; p += 2) {
    const x = (p - debut) * echelle;
    const y = hauteur / 2 - signalRonfle(p);
    d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const [a, n] = BANDE.pubs[1];
  const pub = `<rect x="${((a - debut) * echelle).toFixed(1)}" y="0" width="${(n * echelle).toFixed(1)}" height="${hauteur}" fill="${jetons.ocreVoile}"/>`;
  return `<svg class="piste" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}">${pub}<path d="${d}" fill="none" stroke="${jetons.encre}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

const vignette = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
${police('Sofia Sans Condensed', 'sofia-sans-condensed/files/sofia-sans-condensed-latin-wght-normal.woff2')}
* { margin: 0; box-sizing: border-box; }
html, body { width: 440px; height: 280px; overflow: hidden; }
body {
  position: relative;
  background:
    linear-gradient(${jetons.reglureForte} 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, ${jetons.reglureForte} 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(${jetons.reglure} 1px, transparent 1px) 0 0 / 8px 8px,
    linear-gradient(90deg, ${jetons.reglure} 1px, transparent 1px) 0 0 / 8px 8px,
    ${jetons.papier};
}
.logo { position: absolute; left: 40px; top: 40px; width: 80px; height: 80px; }
.logo svg { display: block; width: 80px; height: 80px; }
.nom {
  position: absolute; left: 152px; top: 40px; height: 80px;
  display: flex; align-items: center;
  font: 700 88px/1 'Sofia Sans Condensed', sans-serif; color: ${jetons.encre};
}
.bande {
  position: absolute; left: 40px; top: 160px; width: 360px; height: 80px;
  background:
    linear-gradient(${jetons.encre}, ${jetons.encre}) top / 100% 1px no-repeat,
    linear-gradient(${jetons.encre}, ${jetons.encre}) bottom / 100% 1px no-repeat,
    ${jetons.papierClair};
}
.piste { display: block; }
</style></head><body>
<div class="logo">${logo}</div>
<div class="nom">Ronflux</div>
<div class="bande">${piste()}</div>
</body></html>`;

const icone = `<!doctype html><html><head><style>
* { margin: 0; } html, body { width: 128px; height: 128px; background: transparent; }
svg { display: block; position: absolute; left: 16px; top: 16px; width: 96px; height: 96px; }
</style></head><body>${logo}</body></html>`;

const navigateur = await chromium.launch({ headless: true, channel: 'chromium' });
try {
  const page = await navigateur.newPage({ viewport: { width: 440, height: 280 } });
  await page.setContent(vignette, { waitUntil: 'load' });
  const policeChargee = await page.evaluate(async () => {
    await document.fonts.load("700 88px 'Sofia Sans Condensed'");
    return [...document.fonts].some((f) => f.family.includes('Sofia Sans Condensed') && f.status === 'loaded');
  });
  if (!policeChargee) throw new Error('Sofia Sans Condensed ne se charge pas dans la vignette');
  await page.screenshot({ path: join(sortie, 'vignette-440x280.png') });
  await page.close();

  const pageIcone = await navigateur.newPage({ viewport: { width: 128, height: 128 } });
  await pageIcone.setContent(icone);
  await pageIcone.screenshot({ path: join(sortie, 'icone-128.png'), omitBackground: true });
  await pageIcone.close();

  // Captures : un ordinateur sous Chrome, animation figée sur l'image fixe de la bande
  // (au milieu d'une pub, « Pub bloquée »).
  const capture = await navigateur.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  });
  await capture.goto(site, { waitUntil: 'networkidle' });
  await capture.evaluate(() => document.fonts.ready);
  await capture.screenshot({ path: join(sortie, 'capture-1-1280x800.png') });
  await capture.evaluate(() => {
    const titre = document.querySelector('#fonctionnement h2');
    window.scrollTo(0, titre.getBoundingClientRect().top + window.scrollY - 120);
  });
  await capture.screenshot({ path: join(sortie, 'capture-2-1280x800.png') });
  await capture.close();
} finally {
  await navigateur.close();
}
console.log(`Visuels dans ${sortie}`);
