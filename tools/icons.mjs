// Tire du logo SVG les icônes PNG de l'extension Chrome (Chrome refuse le SVG dans un manifeste).
// Le logo n'existe qu'en un seul fichier source, extension/icon.svg : le remplacer suffit.
//
//   node tools/icons.mjs <icon.svg> <dossier de sortie> <taille>…   → <dossier>/icon-<taille>.png
//
// Appelé par build.ps1.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const [svgPath, outDir, ...sizes] = process.argv.slice(2);
if (!svgPath || !outDir || sizes.length === 0) {
  console.error('usage : node tools/icons.mjs <icon.svg> <dossier de sortie> <taille>…');
  process.exit(2);
}

const svg = readFileSync(svgPath);
mkdirSync(outDir, { recursive: true });
for (const arg of sizes) {
  const size = Number(arg);
  if (!Number.isInteger(size) || size < 1 || size > 1024) throw new Error(`taille invalide : ${arg}`);
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
  if (image.width !== size || image.height !== size) {
    throw new Error(`${svgPath} n'est pas carré : rendu en ${image.width}×${image.height} pour ${size} px`);
  }
  writeFileSync(join(outDir, `icon-${size}.png`), image.asPng());
}
