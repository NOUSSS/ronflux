import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import reglages from './ronflux.config.js';
import { POINT_FIXE, heure, svgBande, svgPlumes, svgReleve } from './src/enregistrement.js';

const racine = (chemin) => new URL(`../${chemin}`, import.meta.url);
const lireJson = (chemin) => JSON.parse(readFileSync(racine(chemin), 'utf8').replace(/^﻿/, ''));
const lireJsonSiPresent = (chemin) => (existsSync(racine(chemin)) ? lireJson(chemin) : null);

// Le site lit les sources de l'extension, pour ne rien afficher qui diverge des paquets :
// la version, la version minimale de Firefox, et si Firefox met Ronflux à jour tout seul.
// Deux dispositions sont comprises : un manifeste unique (extension/manifest.json), ou une
// base commune complétée par navigateur (manifest.base.json + manifest.firefox.json), dont
// build.ps1 assemble le manifeste Firefox en y ajoutant update_url d'après distribution.json.
function lireExtension() {
  const base = lireJsonSiPresent('extension/manifest.base.json');
  const unique = base ? null : lireJson('extension/manifest.json');
  const firefox = base ? lireJsonSiPresent('extension/manifest.firefox.json') : unique;
  const source = base ? 'extension/manifest.base.json' : 'extension/manifest.json';

  const version = (base || unique).version;
  if (!/^\d+(\.\d+)*$/.test(version || '')) {
    throw new Error(`Version illisible dans ${source} : ${version}`);
  }

  const gecko = firefox?.browser_specific_settings?.gecko;
  const firefoxMin = /^(\d+)(\.\d+)*$/.exec(gecko?.strict_min_version || '')?.[1];
  if (!firefoxMin) {
    throw new Error('Version minimale de Firefox (browser_specific_settings.gecko.strict_min_version) introuvable');
  }

  const siteUrl = lireJsonSiPresent('distribution.json')?.siteUrl;
  const majFirefox = Boolean(gecko?.update_url) || (Boolean(base) && /^https:\/\/\S+$/.test(siteUrl || ''));
  return { version, firefoxMin, majFirefox };
}

function lireChromeWebStore() {
  const url = (reglages.chromeWebStoreUrl || '').trim();
  if (url && !/^https:\/\/[^\s"<>]+$/.test(url)) {
    throw new Error(`chromeWebStoreUrl doit être une adresse https : ${url}`);
  }
  return url;
}

// Polices du premier écran, préchargées pour que le titre ne change pas de forme
// à leur arrivée.
const POLICES_PRECHARGEES = [
  /sofia-sans-condensed-latin-wght-normal-[\w-]+\.woff2$/,
  /sofia-sans-latin-wght-normal-[\w-]+\.woff2$/,
];

function ronflux() {
  const { version, firefoxMin, majFirefox } = lireExtension();
  const chromeWebStore = lireChromeWebStore();
  // Blocs conditionnels du gabarit : <!-- si:nom -->…<!-- /si:nom --> et
  // <!-- sinon:nom -->…<!-- /sinon:nom -->.
  const conditions = { cws: Boolean(chromeWebStore), 'maj-firefox': majFirefox };

  // Le logo de l'extension sert aussi de favicon et de signe dans la page : un seul fichier.
  const logo = () => readFileSync(racine('extension/icon.svg'));

  // Partie du dessin de l'icône (96 × 96) que montre le signe : le R, sans la marge de la
  // tuile. Faite pour le dessin actuel ; un nouveau dessin demande un nouveau cadrage.
  const CADRAGE_SIGNE = '18 8 80 80';

  // Dans la page, le signe est le dessin de l'icône sans sa tuile, à l'encre du texte.
  // Forme exigée de icon.svg : la tuile en premier élément, un <rect …/>, et les couleurs du
  // dessin en hexadécimal (fill ou stroke). Voir site/README.md, « Logo et favicon ».
  function signe() {
    const source = logo().toString('utf8').replace(/<!--[\s\S]*?-->\s*/g, '');
    if (!/<svg\b[^>]*>\s*<rect\b[^>]*\/>/.test(source)) {
      throw new Error("extension/icon.svg : la tuile doit être le premier élément, un <rect …/> (voir signe() dans vite.config.js)");
    }
    const svg = source
      .replace(/<rect\b[^>]*\/>\s*/, '')
      .replace(/\b(fill|stroke)="#[0-9a-f]{3,8}"/gi, '$1="currentColor"')
      .replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CADRAGE_SIGNE}" width="32" height="32" class="marque-signe" aria-hidden="true" focusable="false">`)
      .replace(/\s*\n\s*/g, '');
    if (/#[0-9a-f]{3,8}\b/i.test(svg)) {
      throw new Error("extension/icon.svg : une couleur du dessin n'est pas dans un attribut fill ou stroke (voir signe() dans vite.config.js)");
    }
    return svg;
  }

  return [
    {
      name: 'ronflux:favicon',
      configureServer(server) {
        server.middlewares.use('/favicon.svg', (_req, res) => {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.end(logo());
        });
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'favicon.svg', source: logo() });
      },
    },
    {
      name: 'ronflux:contenu',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          return html
            .replace(/<!-- (si|sinon):([\w-]+) -->([\s\S]*?)<!-- \/\1:\2 -->/g, (_, sens, nom, bloc) => {
              if (!(nom in conditions)) throw new Error(`Condition inconnue dans index.html : ${nom}`);
              return conditions[nom] === (sens === 'si') ? bloc : '';
            })
            .replaceAll('{{chromeWebStore}}', chromeWebStore)
            .replaceAll('{{version}}', version)
            .replaceAll('{{firefoxMin}}', firefoxMin)
            // Tracés de démonstration, calculés une fois pour être là sans JavaScript.
            .replace('{{bande}}', svgBande())
            .replace('{{plumes}}', svgPlumes())
            .replace('{{heure}}', heure(POINT_FIXE))
            .replace('{{releve}}', svgReleve('large') + svgReleve('etroit'))
            .replaceAll('{{signe}}', signe())
            // Les commentaires du gabarit ne partent pas en ligne.
            .replace(/\s*<!--[\s\S]*?-->/g, '');
        },
      },
    },
    {
      name: 'ronflux:polices',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.bundle) return html;
          const fichiers = Object.keys(ctx.bundle);
          const tags = POLICES_PRECHARGEES.map((motif) => fichiers.find((f) => motif.test(f)))
            .filter(Boolean)
            .map((fichier) => ({
              tag: 'link',
              attrs: { rel: 'preload', href: `/${fichier}`, as: 'font', type: 'font/woff2', crossorigin: '' },
              injectTo: 'head',
            }));
          return { html, tags };
        },
      },
    },
  ];
}

export default defineConfig({
  plugins: [ronflux()],
  build: {
    // Les polices restent des fichiers (préchargés), jamais des data: dans le CSS.
    assetsInlineLimit: (fichier) => (fichier.endsWith('.woff2') ? false : undefined),
  },
});
