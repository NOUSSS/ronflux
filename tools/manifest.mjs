// Assemble le manifeste d'un navigateur : la base commune, puis ce qui est propre au navigateur.
// Les objets sont fusionnés récursivement ; un tableau ou une valeur simple du second fichier
// remplace celle de la base, et `null` retire la clé.
//
//   node tools/manifest.mjs <base.json> <navigateur.json> <sortie.json> [--gecko-update-url=URL]
//
// Appelé par build.ps1. --gecko-update-url ajoute browser_specific_settings.gecko.update_url
// (adresse du manifeste de mise à jour Firefox, tirée de distribution.json).
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const options = new Map();
const files = [];
for (const arg of args) {
  const m = /^--([a-z-]+)=(.*)$/.exec(arg);
  if (m) options.set(m[1], m[2]);
  else files.push(arg);
}
if (files.length !== 3 || [...options.keys()].some((k) => k !== 'gecko-update-url')) {
  console.error('usage : node tools/manifest.mjs <base.json> <navigateur.json> <sortie.json> [--gecko-update-url=URL]');
  process.exit(2);
}
const [basePath, browserPath, outPath] = files;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`${path} : ${e.message}`);
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function merge(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value === null) delete out[key];
    else if (isObject(value) && isObject(out[key])) out[key] = merge(out[key], value);
    else out[key] = value;
  }
  return out;
}

const manifest = merge(readJson(basePath), readJson(browserPath));

const updateUrl = options.get('gecko-update-url');
if (updateUrl !== undefined) {
  if (!/^https:\/\/\S+$/.test(updateUrl)) throw new Error(`--gecko-update-url doit être une adresse https : ${updateUrl}`);
  const gecko = manifest.browser_specific_settings?.gecko;
  if (!isObject(gecko)) throw new Error(`${browserPath} : browser_specific_settings.gecko absent, impossible d'y mettre update_url`);
  gecko.update_url = updateUrl;
}

writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
