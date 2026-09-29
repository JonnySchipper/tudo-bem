#!/usr/bin/env node
/**
 * Life-sim review screenshots (HOWTO section 7.4): the same five screens at desktop and phone size, for any world view.
 *
 *   pnpm build && pnpm start                                   # multiplayer build on :8787 (or the solo static build)
 *   node scripts/lifesim-shots.mjs                             # iso baseline → docs/lifesim/shots/p0/
 *   VIEW=pixel PHASE=p2 node scripts/lifesim-shots.mjs         # or: node scripts/lifesim-shots.mjs --view=pixel --phase=p2
 *
 * Env / flags (flag wins):
 *   BASE_URL     default http://localhost:8787 (a static solo build: http://localhost:4173/tudo-bem/ and set SOLO=1)
 *   CHROME_PATH  chrome / chromium / msedge executable
 *   VIEW         value for ?view= (omitted → the app default, currently iso)
 *   PHASE        output folder name under docs/lifesim/shots/ (default p0); SHOTS_DIR overrides the whole path
 *   SOLO         guest entry (static build); otherwise a throwaway account is registered
 *
 * Captures per viewport (1280×800 and 390×844): avatar creator, praça, padaria, kitnet, academia.
 * Rooms are reached by id through window.__tb (interact / net.send), so the script works with any renderer.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((p) => fs.existsSync(p));
const VIEW = argv.view ?? process.env.VIEW ?? '';
const PHASE = argv.phase ?? process.env.PHASE ?? 'p0';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', PHASE);
const SOLO = !!process.env.SOLO;
// --clean: hide every DOM overlay (HUD, labels, chat) so only the canvas is in the shot (art reviews: nothing covers the sprites)
// --furnish: put one of every catalog item in the kitnet (client side only, for art reviews)
const FURNISH = 'furnish' in argv;
const CLEAN = 'clean' in argv || !!process.env.CLEAN;
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startUrl() {
  const u = new URL(BASE);
  if (VIEW) u.searchParams.set('view', VIEW);
  return u.toString();
}

const room = (page) => page.evaluate(() => window.__tb.game.room?.room);
async function waitRoom(page, id) {
  await page.waitForFunction((id) => window.__tb.game.room?.room === id, id, { timeout: 15_000 });
}
async function interact(page, target) {
  const ok = await page.evaluate((t) => window.__tb.interact(t), target);
  if (!ok) throw new Error(`no such interact target in ${await room(page)}: ${JSON.stringify(target)}`);
}
async function shot(page, vp, name) {
  fs.mkdirSync(OUT, { recursive: true });
  if (CLEAN && name !== 'avatar_creator') {
    await page.evaluate(() => {
      const c = document.querySelector('canvas');
      document.querySelectorAll('body *').forEach((el) => { if (el !== c && !el.contains(c)) el.style.visibility = 'hidden'; });
    });
  }
  await page.screenshot({ path: path.join(OUT, `${vp.name}_${name}.png`) });
  console.log('  ·', vp.name, name);
}

/** Title screen → avatar creator (guest on solo builds, throwaway account otherwise). */
async function toAvatarCreator(page, vp) {
  await page.goto(startUrl());
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  if (SOLO) await page.click('#intro-guest');
  else {
    await page.click('#intro-tab-register');
    await page.fill('#intro-email', `shots+${vp.name}${Date.now().toString(36)}@exemplo.com`);
    await page.fill('#intro-password', 'pao-de-queijo-2026');
    await page.click('#intro-submit');
  }
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = 0)));
  await sleep(400);
}

async function runViewport(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await toAvatarCreator(page, vp);
  await shot(page, vp, 'avatar_creator');

  await page.click('#enter-praca');
  await waitRoom(page, 'praca');
  await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 4, null, { timeout: 8000 }).catch(() => {});
  await sleep(2500);
  await shot(page, vp, 'praca');

  // walk up to the north end so the shopfronts / wall band are in frame (the spawn view shows the south half at desktop zoom)
  await page.evaluate(() => window.__tb.walkTo(6, 2));
  await page.waitForFunction(() => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === 6 && t.tile.y === 2; }, null, { timeout: 12_000 }).catch(() => {});
  await sleep(1200);
  await shot(page, vp, 'praca_north');

  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(1500);
  await shot(page, vp, 'padaria');

  await interact(page, { portal: 'padaria_praca' });
  await waitRoom(page, 'praca');
  await sleep(500);
  await interact(page, { portal: 'praca_kitnet' });
  await waitRoom(page, 'kitnet');
  if (FURNISH) {
    await page.evaluate(() => {
      const ids = ['cadeira_madeira', 'poltrona_verde', 'pufe_amarelo', 'mesinha', 'planta', 'tapete', 'radio', 'ventilador', 'gato', 'luminaria', 'estante', 'quadro', 'rede', 'filtro'];
      const at = [[2, 3, 0], [5, 4, 1], [3, 5, 0], [4, 3, 0], [4, 1, 0], [3, 4, 1], [7, 3, 0], [6, 5, 1], [2, 2, 1], [7, 5, 0], [0, 1, 0], [6, 7, 1], [5, 2, 0], [3, 2, 0]];
      window.__tb.game.furniture = ids.map((itemId, i) => ({ uid: 'shot' + i, itemId, x: at[i][0], y: at[i][1], rot: at[i][2] }));
    });
  }
  await sleep(1500);
  await shot(page, vp, 'kitnet');

  await interact(page, { portal: 'kitnet_praca' });
  await waitRoom(page, 'praca');
  await sleep(500);
  await interact(page, { portal: 'praca_academia' });
  await waitRoom(page, 'academia');
  await sleep(1500);
  await shot(page, vp, 'academia');

  await ctx.close();
}

if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
console.log(`\nlifesim shots → ${OUT}  (${startUrl()})`);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const vp of VIEWPORTS) await runViewport(browser, vp);
} finally {
  await browser.close();
}
