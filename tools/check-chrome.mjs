// Vérifie le paquet Chrome : charge dist/chrome dans un Chromium headless (Playwright) sur un live
// Twitch et attend dans la console « [Ronflux] v… chargé » puis « worker Twitch enveloppé ».
// Aucune fenêtre ne s'ouvre, le profil est temporaire et supprimé à la fin.
//
//   npx playwright install --no-shell chromium     (une fois)
//   node tools/check-chrome.mjs [--extension=<dossier>] [https://www.twitch.tv/<chaîne en live>]
//
// Par défaut l'extension chargée est dist/chrome ; --extension permet de tester le contenu de
// dist/ronflux-chrome.zip une fois décompressé. Sans adresse, la première chaîne du répertoire
// Twitch (la plus regardée) est prise.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const extArg = args.find((a) => a.startsWith('--extension='));
const extDir = resolve(extArg ? extArg.slice('--extension='.length) : 'dist/chrome');
if (!existsSync(join(extDir, 'manifest.json'))) {
  console.error(`${extDir} : pas de manifest.json (lancer build.ps1 d'abord).`);
  process.exit(2);
}

const profileDir = mkdtempSync(join(tmpdir(), 'ronflux-chrome-'));
let ok = false;
// channel 'chromium' : le Chromium complet en mode headless. La coquille headless que Playwright
// utilise par défaut ne charge pas les extensions.
const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
try {
  let channelUrl = args.find((a) => !a.startsWith('--'));
  if (!channelUrl) {
    const directory = context.pages()[0] ?? (await context.newPage());
    await directory.goto('https://www.twitch.tv/directory/all', { waitUntil: 'domcontentloaded' });
    const card = directory.locator('a[data-a-target="preview-card-image-link"]').first();
    await card.waitFor({ timeout: 30000 });
    channelUrl = new URL(await card.getAttribute('href'), 'https://www.twitch.tv').href;
    await directory.close();
  }

  // Onglet neuf : seuls les messages du live comptent, comme au premier chargement d'un visiteur.
  const page = await context.newPage();
  const lines = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[Ronflux')) {
      lines.push(text);
      console.log(`  console : ${text}`);
    }
  });
  console.log(`Live : ${channelUrl}`);
  await page.goto(channelUrl, { waitUntil: 'domcontentloaded' });

  const loaded = () => lines.some((l) => /^\[Ronflux\] v\S+ chargé/.test(l));
  const wrapped = () => lines.some((l) => l.includes('worker Twitch enveloppé'));
  const workers = () => page.evaluate(() => window.__ronflux?.workerCount ?? 0).catch(() => 0);
  const deadline = Date.now() + 45000;
  let workerCount = 0;
  while (Date.now() < deadline && !(loaded() && wrapped() && (workerCount = await workers()) > 0)) {
    await page.waitForTimeout(500);
  }

  ok = loaded() && wrapped() && workerCount > 0;
  console.log(`Script chargé : ${loaded() ? 'oui' : 'NON'}`);
  console.log(`Worker Twitch enveloppé : ${wrapped() ? 'oui' : 'NON'} (__ronflux.workerCount = ${workerCount})`);
} finally {
  await context.close();
  rmSync(profileDir, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
