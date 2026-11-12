// Popup de l'extension : état sur l'onglet courant, version, date de publication et liens.
// infos.json est écrit par build.ps1 (date du build, adresse du site) ; absent hors build.
'use strict';

const api = globalThis.browser ?? globalThis.chrome;
const TWITCH = ['*://*.twitch.tv/*'];

const $ = (id) => document.getElementById(id);

function etat(nom, titre, detail = '') {
  $('etat').dataset.etat = nom;
  $('etat-titre').textContent = titre;
  $('etat-detail').textContent = detail;
  $('autoriser').hidden = nom !== 'refuse';
}

function estTwitch(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return /^https?:$/.test(protocol) && (hostname === 'twitch.tv' || hostname.endsWith('.twitch.tv'));
  } catch {
    return false;
  }
}

async function majEtat() {
  // Firefox laisse l'utilisateur retirer l'accès à twitch.tv : sans lui, rien ne s'exécute.
  const permis = await api.permissions.contains({ origins: TWITCH }).catch(() => true);
  if (!permis) {
    etat('refuse', 'Accès à twitch.tv refusé', 'Sans cet accès, Ronflux ne peut pas bloquer les pubs.');
    return;
  }
  // Sans la permission « tabs », l'adresse de l'onglet n'est connue que sur twitch.tv.
  const [onglet] = await api.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (onglet?.url && estTwitch(onglet.url)) {
    etat('actif', 'Actif sur cet onglet', 'Les pubs des lives sont bloquées.');
  } else {
    etat('attente', 'En veille', 'Ronflux agit seulement sur twitch.tv.');
  }
}

function dateLongue(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function majInfos() {
  $('version').textContent = api.runtime.getManifest().version;
  const infos = await fetch('infos.json').then((r) => r.json()).catch(() => null);
  if (!infos) return;
  const date = typeof infos.date === 'string' ? dateLongue(infos.date) : '';
  if (date) {
    $('date').textContent = date;
    $('ligne-date').hidden = false;
  }
  if (typeof infos.site === 'string' && /^https:\/\//.test(infos.site)) $('lien-site').href = infos.site;
}

$('autoriser').addEventListener('click', () => {
  api.permissions.request({ origins: TWITCH }).then(majEtat, majEtat);
});

majInfos();
majEtat();
