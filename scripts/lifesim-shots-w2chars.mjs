#!/usr/bin/env node
/**
 * Wave 2 (characters) before/after shots, deterministic: the crowd is injected into the client's avatar map (client-side only), so every run shows the
 * same neighbours, with the real look code of the build under test.
 *
 *   pnpm build && PORT=9021 TB_TEST_CLOCK_CONTROL=1 node apps/server/dist/index.js
 *   BASE_URL=http://localhost:9021 TAG=after node scripts/lifesim-shots-w2chars.mjs [--what=parade,emotes,creator] [--times=1200,1730] [--zoom=5]
 *
 * parade:  24 neighbours (the CPU wardrobe by name) in three rows in the praça at zoom 5, at the given hours  -> <TAG>_parade_praca_<time>_z5.png
 * emotes:  five avatars, one emote each, at +0.3 s / +0.7 s / +1.0 s                                       -> <TAG>_emotes_<n>.png
 * creator: the avatar creator preview (6x) for four dark-hair styles on dark and light skin                -> <TAG>_creator_hair.png
 * Output folder: docs/lifesim/shots/w2chars (SHOTS_DIR to override). The names come from the bundled shared package of the working tree.
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:9021';
const TAG = process.env.TAG ?? 'after';
const OUT = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs', 'lifesim', 'shots', 'w2chars');
const WHAT = (argv.what ?? 'parade,emotes,creator').split(',');
const TIMES = (argv.times ?? '1200,1730').split(',');
const ZOOM = Number(argv.zoom ?? 5);
const CAM = (argv.cam ?? '25,25').split(',').map(Number); // camera centre tile
const ROWS = (argv.rows ?? '22,25,28').split(',').map(Number); // tile rows of the back, middle and front rows
const X0 = Number(argv.x0 ?? 21); // first tile column of each row (8 per row)
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

// the working tree's own wardrobe
const { build } = createRequire(path.join(ROOT, 'apps/server/package.json'))('esbuild');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-w2c-'));
const outfile = path.join(tmp, 'shared.mjs');
await build({ entryPoints: [path.join(ROOT, 'packages/shared/src/index.ts')], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error' });
const shared = await import(pathToFileURL(outfile).href);

const FRONT = ['Patricia', 'Gabriela', 'Igor', 'Gustavo', 'Roberto', 'Carolina', 'Thiago', 'Beatriz'];
const MID = ['Larissa', 'Mateus', 'Renata', 'André', 'Helena', 'Daniel', 'Felipe', 'Rafael'];
const BACK = ['Camila', 'Paulo', 'Diego', 'Natasha', 'Fernanda', 'Ana', 'Bruno', 'Clara'];
const NAMES = [...BACK, ...MID, ...FRONT];
const crowd = NAMES.map((name, i) => {
  const l = shared.cpuLook(name);
  const row = Math.floor(i / 8); // 0 = back, 1 = middle, 2 = front
  return { id: `cpu-w2-${i}`, name, appearance: l.appearance, hat: l.hat, x: X0 + (i % 8), y: ROWS[row], seed: 11 + i * 7, dir: row === 2 ? ['SW', 'SW', 'SE', 'NE', 'NW', 'SW', 'SE', 'SW'][i % 8] : 'SW' };
});
const PW = 'pao-de-queijo-2026';
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4));
async function pin(page, t, w = 'sol') {
  await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(t)}`, { method: 'POST' });
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: `${t.slice(0, 2)}:${t.slice(2)}`, weather: w }), [t, w]);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.error('console.error', m.text()); });

await page.goto(`${BASE}?notype=1`);
await page.waitForSelector('#intro-enter', { timeout: 20_000 });
await page.click('#intro-enter');
await page.waitForSelector('#intro-skip', { timeout: 12_000 });
await page.click('#intro-skip');
await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
await page.click('#intro-tab-register');
await page.fill('#intro-email', `w2c+${Date.now().toString(36)}@exemplo.com`);
await page.fill('#intro-password', PW);
await page.click('#intro-submit');
await page.waitForSelector('#avatar-name', { timeout: 15_000 });
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');

if (WHAT.includes('creator')) {
  // dark hair on dark and on light skin: the preview canvas only, at its CSS size (6x)
  const tiles = [];
  const swatch = (group, i) => page.locator('.swatches').nth(group).locator('button').nth(i);
  for (const [skin, label] of [[7, 'dark'], [2, 'mid']]) {
    await swatch(0, skin).click();
    await swatch(1, 0).click();
    for (const style of ['Cacheado', 'Black power', 'Ondulado', 'Longo', 'Undercut']) {
      await page.click(`button:has-text("${style}")`);
      await sleep(2300); // the preview waves once when it opens: wait it out
      tiles.push(await page.locator('#avatar-preview').screenshot());
    }
  }
  const sample = await sharp(tiles[0]).metadata();
  const sheet = await sharp({ create: { width: sample.width * 5, height: sample.height * 2, channels: 4, background: '#f6ecda' } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % 5) * sample.width, top: Math.floor(i / 5) * sample.height })))
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(OUT, `${TAG}_creator_hair.png`), sheet);
  await page.screenshot({ path: path.join(OUT, `${TAG}_creator_full.png`) });
  console.log('  · creator');
}

await page.click('#enter-praca');
await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praça');
await sleep(2500);
await page.addStyleTag({ content: '#ui{visibility:hidden !important} .wl-stack{display:none !important}' });
const inject = (list, ids) =>
  page.evaluate(([list]) => {
    const g = window.__tb.game;
    for (const [id] of [...g.avatars]) if (id.startsWith('cpu-w2-')) g.avatars.delete(id);
    for (const c of list) {
      g.avatars.set(c.id, {
        pub: { id: c.id, name: c.name, pronoun: 'ele', appearance: c.appearance, hat: c.hat, parrot: !!c.parrot, nameplate: 'verde', x: c.x, y: c.y, dir: c.dir ?? 'SW', sitting: false, cpu: true },
        from: { x: c.x, y: c.y }, path: [], start: performance.now(), sitOnArrive: false, emote: null, bubbles: [], seed: c.seed,
      });
    }
  }, [list, ids]);
const hideReal = () =>
  page.evaluate(() => {
    // the real neighbours would wander into the frame: park them off screen by dropping the ones that are not ours
    const g = window.__tb.game;
    for (const [id] of [...g.avatars]) if (id.startsWith('cpu-') && !id.startsWith('cpu-w2-')) g.avatars.delete(id);
  });

if (WHAT.includes('parade')) {
  await inject(crowd);
  for (const t of TIMES) {
    await pin(page, t);
    await hideReal();
    await sleep(3000);
    await pin(page, t); // the server's weather can change under the pin
    await sleep(500);
    const file = `${TAG}_parade_praca_${t}_z${ZOOM}.png`;
    await page.evaluate(([z, cam]) => window.__tb.renderer.setShot(`cam:${cam[0]},${cam[1]},${z}`), [ZOOM, CAM]);
    await sleep(800);
    fs.writeFileSync(path.join(OUT, file), await page.screenshot());
    console.log('  ·', file);
  }
}

if (WHAT.includes('emotes')) {
  const kinds = ['oi', 'valeu', 'rir', 'dancar', 'desculpa'];
  const five = crowd.slice(0, 5).map((c, i) => ({ ...c, x: 22 + i * 2, y: 26, parrot: i === 2 }));
  await inject(five);
  await pin(page, '1200');
  await page.evaluate(() => window.__tb.renderer.setShot('cam:26,25.6,8'));
  await sleep(1500);
  await page.evaluate(([kinds]) => {
    const t0 = performance.now() / 1000;
    kinds.forEach((kind, i) => { const a = window.__tb.game.avatars.get('cpu-w2-' + i); if (a) a.emote = { kind, t0 }; });
  }, [kinds]);
  for (const [n, wait] of [[1, 300], [2, 400], [3, 300]]) {
    await sleep(wait);
    fs.writeFileSync(path.join(OUT, `${TAG}_emotes_${n}.png`), await page.screenshot());
  }
  console.log('  · emotes');
}

await browser.close();
