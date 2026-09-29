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
// --top: after each interior shot walk toward its back wall and take a second shot (the desktop camera follows the avatar, so the wall band only shows up there)
const TOP = 'top' in argv;
const CLEAN = 'clean' in argv || !!process.env.CLEAN;
// --decorate: extra kitnet shots in decorate mode (a ghost of the chair in hand on a free tile and on a reserved tile, and a selected placed piece with its outline)
const DECORATE = 'decorate' in argv;
// --chat: extra shots with speech bubbles (you and an NPC) in the praça and the padaria
const CHAT = 'chat' in argv;
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
async function walkNear(page, x, y, name, vp) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 12_000 }).catch(() => {});
  await sleep(1200);
  await shot(page, vp, name);
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

/** Kitnet in decorate mode: state is set through window.__tb (the same fields the Decorar panel and the pointer set). */
async function decorateShots(page, vp) {
  const hover = (x, y) => page.evaluate(([x, y]) => { window.__tb.game.hoverTile = { x, y }; }, [x, y]);
  await page.evaluate(() => {
    const g = window.__tb.game;
    g.furniture = [
      { uid: 'd1', itemId: 'poltrona_verde', x: 3, y: 3, rot: 0 },
      { uid: 'd2', itemId: 'planta', x: 5, y: 4, rot: 0 },
      { uid: 'd3', itemId: 'mesinha', x: 4, y: 5, rot: 0 },
    ];
    g.editMode = true;
    g.placing = { itemId: 'cadeira_madeira', rot: 0 };
  });
  await hover(5, 6);
  await sleep(600);
  await shot(page, vp, 'kitnet_decorate_ghost_ok');
  await page.evaluate(() => { window.__tb.game.placing.rot = 1; });
  await hover(2, 6);
  await sleep(300);
  await shot(page, vp, 'kitnet_decorate_ghost_rot');
  await hover(1, 0); // the kitchen: reserved
  await sleep(300);
  await shot(page, vp, 'kitnet_decorate_ghost_bad');
  await page.evaluate(() => { const g = window.__tb.game; g.placing = null; g.selectedFurniture = 'd1'; });
  await hover(5, 2);
  await sleep(600);
  await shot(page, vp, 'kitnet_decorate_selected');
  await page.evaluate(() => { const g = window.__tb.game; g.editMode = false; g.placing = null; g.selectedFurniture = null; g.hoverTile = null; });
}

async function chatShots(page, vp, name) {
  await page.evaluate(() => window.__tb.net.send({ t: 'chat', text: 'Bom dia! Tudo bem com voce?' }));
  await sleep(1400);
  await shot(page, vp, name);
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
  if (CHAT) await chatShots(page, vp, 'praca_chat');

  // walk up to the north end so the shopfronts / wall band are in frame (the spawn view shows the south half at desktop zoom)
  await page.evaluate(() => window.__tb.walkTo(6, 2));
  await page.waitForFunction(() => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === 6 && t.tile.y === 2; }, null, { timeout: 12_000 }).catch(() => {});
  await sleep(1200);
  await shot(page, vp, 'praca_north');

  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(1500);
  await shot(page, vp, 'padaria');
  if (CHAT) {
    await page.evaluate(() => window.__tb.game.npcBubbles.set('carlos', { text: 'Bom dia! Chega mais, pode pedir!', gloss: 'Good morning! Come on over, go ahead and order!', at: performance.now() }));
    await sleep(500);
    await shot(page, vp, 'padaria_carlos');
  }
  if (TOP) await walkNear(page, 4, 4, 'padaria_top', vp);

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
  if (TOP) await walkNear(page, 3, 6, 'kitnet_top', vp);
  if (DECORATE) await decorateShots(page, vp);

  await interact(page, { portal: 'kitnet_praca' });
  await waitRoom(page, 'praca');
  await sleep(500);
  await interact(page, { portal: 'praca_academia' });
  await waitRoom(page, 'academia');
  await sleep(1500);
  await shot(page, vp, 'academia');
  if (TOP) await walkNear(page, 6, 6, 'academia_top', vp);

  if (VIEW === 'pixel') console.log('  artMissing:', JSON.stringify(await page.evaluate(() => window.__tb.artMissing)));
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
