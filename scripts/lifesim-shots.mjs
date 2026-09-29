#!/usr/bin/env node
/**
 * Life-sim review screenshots (HOWTO section 7.4): the same five screens at desktop and phone size, for any world view.
 *
 *   pnpm build && pnpm start                                   # multiplayer build on :8787 (or the solo static build)
 *   node scripts/lifesim-shots.mjs --phase=p4b                 # the app default (pixel since Phase 4b) → docs/lifesim/shots/p4b/
 *   VIEW=iso PHASE=p0 node scripts/lifesim-shots.mjs           # or: node scripts/lifesim-shots.mjs --view=iso --phase=p0
 *
 * Env / flags (flag wins):
 *   BASE_URL     default http://localhost:8787 (a static solo build: http://localhost:4173/tudo-bem/ and set SOLO=1)
 *   CHROME_PATH  chrome / chromium / msedge executable
 *   VIEW         value for ?view= (omitted → the app default, pixel)
 *   PHASE        output folder name under docs/lifesim/shots/ (default p0); SHOTS_DIR overrides the whole path
 *   SOLO         guest entry (static build); otherwise a throwaway account is registered
 *
 * Captures per viewport (1280×800 and 390×844, the phone with touch so the joystick shows): avatar creator, praça, padaria, kitnet,
 * academia, then the panels: hat shop, credits, Conversa (portrait), Pedido rápido, Me vê um.
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
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true },
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

/** Panels over the world: hat shop, credits, Conversa with its portrait, Pedido rápido, Me vê um. */
async function panelShots(page, vp) {
  const closeAll = async () => {
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelectorAll('[data-modal] .close, .conversa-backdrop .close-btn, .pedido-backdrop .close-btn, #dialogue .row > button.ghost').forEach((b) => b.click()));
    await sleep(300);
  };
  await interact(page, { portal: 'academia_praca' });
  await waitRoom(page, 'praca');
  await sleep(800);
  await interact(page, { npc: 'julia' });
  await page.waitForSelector('#dialogue', { timeout: 8000 });
  await sleep(500);
  await shot(page, vp, 'dialogue');
  await closeAll();
  await interact(page, { npc: 'nanda' });
  await page.waitForSelector('[data-modal] .panel', { timeout: 8000 });
  await sleep(600);
  await shot(page, vp, 'hat_shop');
  await closeAll();
  await page.click('#btn-credits');
  await page.waitForSelector('[data-modal="credits"] .credits-panel', { timeout: 5000 });
  await sleep(300);
  await shot(page, vp, 'credits');
  await closeAll();
  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(800);
  await interact(page, { npc: 'carlos' });
  await page.waitForSelector('[data-modal="conversa"] .conversa-panel', { timeout: 12_000 });
  await sleep(800);
  await shot(page, vp, 'conversa');
  await page.click('[data-action="pedido-rapido"]');
  await page.waitForSelector('[data-modal="pedido"] .pedido-panel', { timeout: 12_000 });
  await sleep(500);
  await page.evaluate(() => document.querySelectorAll('.pedido-panel, .pedido-backdrop').forEach((el) => el.scrollTo?.(0, 0)));
  await shot(page, vp, 'pedido');
  await closeAll();
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'start' }));
  await page.waitForSelector('#mg-order', { timeout: 8000 });
  await sleep(700);
  await shot(page, vp, 'meveum');
  await page.click('#minigame .mg-head button.ghost');
  await sleep(800);
  await closeAll();
  // the kitnet's decorate panel (furniture icons cropped from the atlas)
  await page.evaluate(() => { const c = window.__tb.game.room?.room; if (c === 'padaria') window.__tb.interact({ portal: 'padaria_praca' }); });
  await waitRoom(page, 'praca');
  await sleep(500);
  await interact(page, { portal: 'praca_kitnet' });
  await waitRoom(page, 'kitnet');
  await sleep(800);
  await page.click('#btn-decor');
  await page.waitForSelector('.decor', { timeout: 5000 });
  await sleep(600);
  await shot(page, vp, 'decor');
}

async function runViewport(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
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

  await interact(page, { portal: 'kitnet_praca' });
  await waitRoom(page, 'praca');
  await sleep(500);
  await interact(page, { portal: 'praca_academia' });
  await waitRoom(page, 'academia');
  await sleep(1500);
  await shot(page, vp, 'academia');
  if (TOP) await walkNear(page, 6, 6, 'academia_top', vp);

  await panelShots(page, vp);

  if (VIEW !== 'iso') console.log('  artMissing:', JSON.stringify(await page.evaluate(() => window.__tb.artMissing)));
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
