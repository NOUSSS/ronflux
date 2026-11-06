'use strict';
// Jeu d'essai de Ronflux, sans dépendance :
//
//   node tests/ronflux.test.js
//
// VERBOSE=1 affiche les journaux de la page et du worker. Le banc d'essai est décrit dans
// tests/harness.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnv, uiTextProblems } = require('./harness');

const LIVE = (channel, type, quality = '1080p60') => ({ ad: false, channel, type, quality });
const AD = { ad: true };

function assertUiText(text) {
  assert.ok(text, 'aucun texte affiché');
  assert.deepEqual(uiTextProblems(text), [], 'texte affiché : ' + JSON.stringify(text));
}

test('pub bloquée : flux de secours pendant la pub, puis flux d’origine et rechargement du lecteur', async () => {
  const env = createEnv();
  const player = env.startPlayer();
  assert.equal(player.global.__twitchWorkerLoaded, true, 'le code Twitch d’origine doit s’exécuter après workerMain');
  await player.loadChannel('chan1', { v2: true });

  env.net.adFor = (channel, type) => (type === 'main' ? 'midroll' : false);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'popout/web'));
  env.clock.runFrames();
  assert.equal(env.toast(), 'Pub bloquée');
  assertUiText(env.toast());
  assert.equal(env.overlay(), null);
  assert.equal(env.dom.video.muted, false);

  // Suite de la pub : même flux de secours, sans nouvelle demande de jeton ni second message.
  const tokens = env.net.count('gql');
  env.clock.advance(2000);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'popout/web'));
  assert.equal(env.net.count('gql'), tokens);
  assert.equal(env.toastCount(), 1);

  // Fin de la pub : flux d'origine, lecteur rechargé une fois.
  env.net.adFor = () => false;
  assert.deepEqual(await player.poll(), LIVE('chan1', 'main'));
  assert.equal(env.dom.reloads.length, 1);
  env.clock.advance(4000);
  env.clock.runFrames();
  assert.equal(env.toast(), null);
  assert.deepEqual(env.warnings(), []);
});

test('bug 1 : le message « Pub bloquée » disparaît même si requestAnimationFrame est suspendu', async () => {
  // Onglet en arrière-plan ou fenêtre recouverte (jeu en plein écran) : le navigateur ne dessine
  // plus d'image, mais les minuteurs tournent toujours.
  const env = createEnv();
  const player = env.startPlayer();
  await player.loadChannel('chan1');
  env.net.adFor = (channel, type) => (type === 'main' ? 'midroll' : false);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'popout/web'));

  env.clock.advance(5000);
  // Retour sur l'onglet : les images en attente sont dessinées.
  env.clock.runFrames();
  assert.equal(env.toast(), null, 'le message est resté affiché');
});

test('bug 2 : tous les secours ont la pub, masque, puis nouvel essai et retour du live dès qu’un secours redevient propre', async () => {
  const env = createEnv();
  const player = env.startPlayer();
  await player.loadChannel('chan1');
  let cleanType = null;
  env.net.adFor = (channel, type) => (type === cleanType ? false : 'midroll');

  assert.deepEqual(await player.poll(), AD);
  const overlay = env.overlay();
  assert.ok(overlay, 'le lecteur doit être masqué');
  assertUiText(overlay);
  assert.equal(env.dom.video.muted, true);
  const types = env.window.__ronflux.config.backupPlayerTypes.length;
  assert.equal(env.net.count('gql'), types, 'chaque type de secours doit être essayé une fois');

  // Pendant le délai avant un nouvel essai (10 s) : aucune recherche, le masque reste.
  for (let i = 0; i < 4; i++) {
    env.clock.advance(2000);
    assert.deepEqual(await player.poll(), AD);
  }
  assert.equal(env.net.count('gql'), types);
  assert.ok(env.overlay());
  assert.equal(env.dom.video.muted, true);

  // Un secours redevient propre : au bout des 10 s, nouvelle recherche et retour du live.
  cleanType = 'site/ios';
  env.clock.advance(2000);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'site/ios'));
  assert.equal(env.overlay(), null);
  assert.equal(env.dom.video.muted, false);
  assert.equal(env.toast(), 'Pub bloquée');
  assert.equal(env.warnings('worker').filter((w) => w.includes('aucun flux de secours')).length, 1);
});

test('bug 3 : changement de chaîne (raid) pendant une pub masquée, masque retiré et son rendu', async () => {
  const env = createEnv();
  const player = env.startPlayer();
  await player.loadChannel('chan1');
  env.net.adFor = (channel) => (channel === 'chan1' ? 'midroll' : false);
  assert.deepEqual(await player.poll(), AD);
  assert.ok(env.overlay());
  assert.equal(env.dom.video.muted, true);

  await player.loadChannel('chan2');
  assert.equal(env.overlay(), null);
  assert.equal(env.dom.video.muted, false);
  assert.deepEqual(await player.poll(), LIVE('chan2', 'main'));
  assert.equal(env.dom.reloads.length, 0, 'le lecteur qui démarre sur la nouvelle chaîne ne doit pas être rechargé');
});

test('changement de chaîne pendant une pub bloquée : pas de rechargement du lecteur', async () => {
  const env = createEnv();
  const player = env.startPlayer();
  await player.loadChannel('chan1');
  env.net.adFor = (channel, type) => (channel === 'chan1' && type === 'main' ? 'midroll' : false);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'popout/web'));

  await player.loadChannel('chan2');
  assert.deepEqual(await player.poll(), LIVE('chan2', 'main'));
  assert.equal(env.dom.reloads.length, 0);
});

test('worker terminé pendant une pub masquée : masque retiré et son rendu', async () => {
  const env = createEnv();
  const player = env.startPlayer();
  await player.loadChannel('chan1');
  env.net.adFor = () => 'midroll';
  assert.deepEqual(await player.poll(), AD);
  assert.ok(env.overlay());

  player.terminate();
  assert.equal(env.overlay(), null);
  assert.equal(env.dom.video.muted, false);
});

test('le secours prend la pub à son tour : passage au type suivant, sans second message', async () => {
  const env = createEnv();
  const player = env.startPlayer();
  await player.loadChannel('chan1');
  const withAd = new Set(['main']);
  env.net.adFor = (channel, type) => (withAd.has(type) ? 'midroll' : false);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'popout/web'));

  withAd.add('popout/web');
  env.clock.advance(2000);
  assert.deepEqual(await player.poll(), LIVE('chan1', 'frontpage/web'));
  assert.equal(env.toastCount(), 1);
  assert.equal(env.overlay(), null);
});

test('injection trop tardive : message court qui ne parle pas de l’extension Firefox seule', async () => {
  const env = createEnv();
  env.clock.advance(5000);
  const text = env.toast();
  assert.match(text || '', /trop tard/);
  assertUiText(text);
  const warning = env.warnings('page').join('\n');
  assert.match(warning, /trop tard/);
  assert.doesNotMatch(text + '\n' + warning, /extension Firefox/);
});

test('pas de message d’injection tardive quand le worker a été enveloppé puis terminé', async () => {
  const env = createEnv();
  env.startPlayer().terminate();
  env.clock.advance(5000);
  assert.equal(env.toast(), null);
  assert.deepEqual(env.warnings(), []);
});
