import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import reglages from './ronflux.config.js';

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

// Polices du premier écran, préchargées pour que le slogan ne change pas de forme
// à leur arrivée.
const POLICES_PRECHARGEES = [
  /big-shoulders-stencil-latin-opsz-normal-[\w-]+\.woff2$/,
  /archivo-latin-wght-normal-[\w-]+\.woff2$/,
];

function ronflux() {
  const { version, firefoxMin, majFirefox } = lireExtension();
  const chromeWebStore = lireChromeWebStore();
  // Blocs conditionnels du gabarit : <!-- si:nom -->…<!-- /si:nom --> et
  // <!-- sinon:nom -->…<!-- /sinon:nom -->.
  const conditions = { cws: Boolean(chromeWebStore), 'maj-firefox': majFirefox };

  return [
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
            // Les commentaires du gabarit (logo et favicon à venir) ne partent pas en ligne.
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
