// Chrome Web Store, par son API v2 et un compte de service Google :
// https://developer.chrome.com/docs/webstore/using-api
// https://developer.chrome.com/docs/webstore/service-accounts
//
//   node tools/chrome-web-store.mjs status <fiche>
//   node tools/chrome-web-store.mjs upload <fiche> <paquet.zip> <version>
//
// À lancer par tools/chrome-web-store.ps1 ou release.ps1, qui déchiffrent la clé et la passent
// dans la variable RONFLUX_CWS_KEY, le temps de l'appel : un JSON { publisherId, client_email,
// private_key, private_key_id }. Elle n'est jamais affichée ni écrite ailleurs.
//
// upload envoie le paquet puis le soumet à l'examen (publication par défaut : Google le publie
// dès qu'il l'accepte, avec la visibilité de la fiche). Une version que le store a déjà, publiée
// ou en examen, n'est pas renvoyée : une reprise après un arrêt ne fait que ce qui manque.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const API = 'https://chromewebstore.googleapis.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
// Un envoi que le store traite à part (IN_PROGRESS) se suit par fetchStatus.
const UPLOAD_WAIT_MS = 5 * 60_000;
const UPLOAD_POLL_MS = 3_000;

const STATES = {
  PENDING_REVIEW: 'en examen',
  STAGED: 'acceptée, en attente de publication',
  PUBLISHED: 'publiée',
  PUBLISHED_TO_TESTERS: 'publiée pour les testeurs',
  REJECTED: 'refusée',
  CANCELLED: 'soumission annulée',
};

class Failure extends Error {}

function readKey() {
  const raw = process.env.RONFLUX_CWS_KEY;
  delete process.env.RONFLUX_CWS_KEY;
  if (!raw) throw new Failure('RONFLUX_CWS_KEY absente : lancer ce script par tools/chrome-web-store.ps1 ou release.ps1.');
  let key;
  try { key = JSON.parse(raw); } catch { key = null; }
  const ok = key && ['publisherId', 'client_email', 'private_key'].every((f) => typeof key[f] === 'string' && key[f]);
  if (!ok || !/^[A-Za-z0-9_-]+$/.test(key.publisherId)) {
    throw new Failure('Clé du Chrome Web Store incomplète : la ranger de nouveau (tools/chrome-web-store.ps1 -SaveKey).');
  }
  return key;
}

// Réponse JSON d'un appel, ou une erreur qui dit ce que Google a répondu.
async function call(url, options, what) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
  } catch (e) {
    throw new Failure(`${what} : pas de réponse de ${new URL(url).host} (${e.cause?.code || e.name}).`);
  }
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = null; }
  if (!response.ok) {
    let detail = typeof json?.error === 'string' ? json.error_description || json.error : json?.error?.message;
    if (!detail) detail = text.replace(/\s+/g, ' ').slice(0, 300) || 'réponse vide';
    throw new Failure(`${what} : HTTP ${response.status}, ${detail}`);
  }
  if (!json) throw new Failure(`${what} : réponse illisible de ${new URL(url).host}.`);
  return json;
}

const base64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

// Jeton d'accès d'une heure, obtenu en échange d'une assertion signée par la clé du compte de
// service. iat un peu dans le passé : une horloge locale en avance ferait refuser l'assertion.
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000) - 60;
  const header = { alg: 'RS256', typ: 'JWT', ...(key.private_key_id ? { kid: key.private_key_id } : {}) };
  const claims = { iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 };
  const unsigned = `${base64url(header)}.${base64url(claims)}`;
  let signature;
  try {
    signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  } catch {
    throw new Failure('Clé privée du compte de service illisible : la ranger de nouveau (tools/chrome-web-store.ps1 -SaveKey).');
  }
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` });
  const json = await call(TOKEN_URL, { method: 'POST', body }, 'Jeton Google');
  if (!json.access_token) throw new Failure('Jeton Google : réponse sans access_token.');
  return json.access_token;
}

function versions(revision) {
  return (revision?.distributionChannels || []).map((c) => c.crxVersion).filter(Boolean);
}

function describe(revision) {
  if (!revision) return null;
  const list = versions(revision);
  return `${list.length ? list.join(', ') : 'version inconnue'}, ${STATES[revision.state] || revision.state}`;
}

function printStatus(status) {
  console.log(`  publiée : ${describe(status.publishedItemRevisionStatus) || 'aucune'}`);
  console.log(`  soumise : ${describe(status.submittedItemRevisionStatus) || 'rien en cours'}`);
  if (status.takenDown) console.log('  ATTENTION : la fiche a été retirée du store pour non-respect des règles.');
  if (status.warned) console.log('  ATTENTION : Google a envoyé un avertissement, la fiche sera retirée sans correction.');
}

async function main() {
  const [command, item, zipPath, version] = process.argv.slice(2);
  const usage = 'usage : status <fiche> | upload <fiche> <paquet.zip> <version>';
  if (!['status', 'upload'].includes(command) || !/^[a-p]{32}$/.test(item || '')) throw new Failure(usage);
  if (command === 'upload' && !(zipPath && /^\d+\.\d+\.\d+$/.test(version || ''))) throw new Failure(usage);

  const key = readKey();
  const token = await accessToken(key);
  const auth = { Authorization: `Bearer ${token}` };
  const name = `publishers/${encodeURIComponent(key.publisherId)}/items/${item}`;
  const fetchStatus = () => call(`${API}/v2/${name}:fetchStatus`, { headers: auth }, 'État de la fiche');

  const status = await fetchStatus();
  console.log(`Chrome Web Store, fiche ${item} (compte ${key.client_email}) :`);
  printStatus(status);
  if (command === 'status') return;

  const submitted = status.submittedItemRevisionStatus;
  if (versions(status.publishedItemRevisionStatus).includes(version)) {
    console.log(`Version ${version} déjà publiée : rien à envoyer.`);
    return;
  }
  if (submitted && !['REJECTED', 'CANCELLED'].includes(submitted.state) && versions(submitted).includes(version)) {
    console.log(`Version ${version} déjà soumise (${STATES[submitted.state] || submitted.state}) : rien à envoyer.`);
    return;
  }
  if (submitted?.state === 'PENDING_REVIEW') {
    throw new Failure(`La version ${versions(submitted).join(', ') || 'précédente'} est encore en examen : attendre la fin de l'examen, ou annuler la soumission sur le tableau de bord, puis reprendre.`);
  }

  console.log(`Envoi de ${basename(zipPath)} (version ${version})…`);
  const upload = await call(`${API}/upload/v2/${name}:upload`, {
    method: 'POST',
    headers: { ...auth, 'X-Goog-Upload-Protocol': 'raw', 'X-Goog-Upload-File-Name': basename(zipPath) },
    body: readFileSync(zipPath),
  }, 'Envoi du paquet');
  let state = upload.uploadState;
  const deadline = Date.now() + UPLOAD_WAIT_MS;
  while (state === 'IN_PROGRESS' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, UPLOAD_POLL_MS));
    state = (await fetchStatus()).lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') {
    throw new Failure(state === 'IN_PROGRESS'
      ? 'Le store traite encore le paquet après 5 minutes : vérifier le brouillon sur le tableau de bord, puis reprendre.'
      : `Le store a refusé le paquet (état ${state || 'inconnu'}).`);
  }
  if (upload.crxVersion && upload.crxVersion !== version) {
    throw new Failure(`Le store a lu la version ${upload.crxVersion} dans le paquet, ${version} attendue : rien n'a été soumis.`);
  }
  console.log('  paquet reçu.');

  const published = await call(`${API}/v2/${name}:publish`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  }, 'Soumission à l\'examen');
  for (const w of published.warningInfo?.warnings || []) console.log(`  avertissement du store : ${w.description || w.reason}`);
  const label = STATES[published.state] || published.state || 'état inconnu';
  console.log(`Version ${version} soumise : ${label}.`);
  if (published.state === 'PENDING_REVIEW') {
    console.log('Google l\'examine (en général moins d\'une heure sans nouvelle permission), puis Chrome la distribue tout seul en quelques heures.');
  }
}

try {
  await main();
} catch (e) {
  console.error(e instanceof Failure ? e.message : `Erreur inattendue : ${e?.message || e}`);
  process.exit(1);
}
