#!/usr/bin/env node
/**
 * Kitnet first visit (issue #171): the Decorar guide step by step and the sleeping cat, at 1280×800 and 390×844 (phone, touch).
 *
 *   pnpm build && TB_TEST_CLOCK_CONTROL=1 pnpm start          # any server; a fresh throwaway account per viewport
 *   node scripts/kitnet-first-visit-shots.mjs --mode=after    # → docs/lifesim/shots/kitnet-first-visit/after_*.png
 *   node scripts/kitnet-first-visit-shots.mjs --mode=before   # the same walk on a main build (no guide): before_*.png
 *
 * The "after" run is also a check: a fresh profile follows the guide to buy one piece with RV, place it, rotate it and leave Decorar; after a
 * reload the same profile walks into its kitnet again and the guide must not come back. It exits non-zero when either fails.
 * Env: BASE_URL (default http://localhost:8787), CHROME_PATH, SHOTS_DIR.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const MODE = argv.mode === 'before' ? 'before' : 'after';
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'kitnet-first-visit');
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true, phone: true },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CAT_TILE = { x: 5, y: 3 };

function assert(ok, msg) {
  if (!ok) throw new Error(`FAILED: ${msg}`);
  console.log('  ✓', msg);
}

/** A click on a control the guide may be pulsing: the bounce never counts as "stable" while Phaser frames are slow in headless Chrome. */
const tap = (page, sel) => page.click(sel, { force: true });

async function shot(page, vp, name, clip) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${MODE}_${vp.name}_${name}.png`), ...(clip ? { clip } : {}) });
  console.log('  ·', MODE, vp.name, name);
}

const step = (page) => page.evaluate(() => document.querySelector('#kitnet-guide:not([hidden]) .aero-tut-list li.current')?.getAttribute('data-step') ?? null);
async function waitStep(page, id) {
  await page.waitForFunction((id) => document.querySelector('#kitnet-guide:not([hidden]) .aero-tut-list li.current')?.getAttribute('data-step') === id, id, { timeout: 8000 });
  await sleep(450);
}

async function newPlayer(page, vp) {
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `kitnet+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '11:00', weather: 'sol' }));
}

async function toKitnet(page) {
  await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'kitnet' }));
  await page.waitForFunction(() => window.__tb.game.room?.room === 'kitnet' && window.__tb.game.room.ownerId === window.__tb.game.profile?.id, null, { timeout: 15_000 });
  await sleep(1800);
}

async function openDecorar(page, vp) {
  if (vp.phone) {
    await tap(page, '#btn-burger');
    await sleep(500);
  }
  await tap(page, '#btn-decor');
  await page.waitForFunction(() => (document.getElementById('decor-panel')?.offsetWidth ?? 0) > 0, null, { timeout: 5000 });
}

/** The cat, put down client-side (40 RV is more than a fresh profile has) with the player standing clear, then a close crop. */
async function catShots(page, vp) {
  await page.evaluate((t) => {
    const g = window.__tb.game;
    g.furniture = [...g.furniture.filter((f) => f.uid !== 'shot-cat'), { uid: 'shot-cat', itemId: 'gato', x: t.x, y: t.y, rot: 0 }];
    g.emit('decor');
  }, CAT_TILE);
  await page.evaluate(() => window.__tb.walkTo(2, 5));
  await sleep(2200);
  await shot(page, vp, 'cat_room');
  const c = await page.evaluate((t) => window.__tb.tileToClient(t.x, t.y), CAT_TILE);
  const w = vp.phone ? 160 : 220, h = vp.phone ? 110 : 150;
  await shot(page, vp, 'cat_close', { x: Math.max(0, Math.round(c.px - w / 2)), y: Math.max(0, Math.round(c.py - h * 0.6)), width: w, height: h });
}

async function before(page, vp) {
  await toKitnet(page);
  await shot(page, vp, '1_arrive');
  await openDecorar(page, vp);
  await sleep(500);
  await shot(page, vp, '2_decorar_open');
  await tap(page, '#tab-loja');
  await sleep(400);
  await shot(page, vp, '3_atelier');
  await page.click('#decor-panel button.ghost');
  await sleep(400);
  await catShots(page, vp);
}

async function after(page, vp) {
  await toKitnet(page);
  assert(await page.evaluate(() => window.__tb.kitnetGuide().running), `${vp.name}: a fresh profile gets the guide in its kitnet`);
  await waitStep(page, 'abrir');
  await shot(page, vp, '1_abrir');
  if (vp.phone) {
    await tap(page, '#btn-burger');
    await sleep(700);
    await shot(page, vp, '1b_abrir_menu');
  }
  await tap(page, '#btn-decor');
  await waitStep(page, 'loja');
  await shot(page, vp, '2_loja');
  await tap(page, '#tab-loja');
  await waitStep(page, 'comprar');
  await shot(page, vp, '3_comprar');
  const coins0 = await page.evaluate(() => window.__tb.game.profile.coins);
  // the piece the guide points at (the cheapest one this profile can pay for)
  await tap(page, '[data-buy-furniture].tut-pulse');
  await waitStep(page, 'meus');
  const coins1 = await page.evaluate(() => window.__tb.game.profile.coins);
  assert(coins1 < coins0, `${vp.name}: bought one piece with RV (${coins0} → ${coins1})`);
  await shot(page, vp, '4_meus');
  await tap(page, '#tab-meus');
  await waitStep(page, 'escolher');
  await shot(page, vp, '5_escolher');
  await tap(page, '[data-furniture].tut-pulse');
  await waitStep(page, 'colocar');
  const tile = await page.evaluate(() => window.__tb.kitnetGuide().world);
  assert(!!tile, `${vp.name}: the world arrow suggests a free tile`);
  await page.evaluate((t) => { window.__tb.game.hoverTile = { x: t.x, y: t.y }; }, tile);
  await sleep(500);
  await shot(page, vp, '6_colocar');
  const n0 = await page.evaluate(() => window.__tb.game.furniture.length);
  await page.evaluate((t) => window.__tb.clickHit({ kind: 'tile', tile: { x: t.x, y: t.y } }), tile);
  await waitStep(page, 'girar');
  assert((await page.evaluate(() => window.__tb.game.furniture.length)) === n0 + 1, `${vp.name}: placed it`);
  // two chairs (the free one and the bought one): the second is still in hand. Put it away (Esc) to rotate the placed one instead.
  await page.evaluate(() => {
    const g = window.__tb.game;
    g.hoverTile = null;
    if (g.placing) {
      g.placing = null;
      g.emit('decor');
    }
  });
  await sleep(500);
  await shot(page, vp, '7_girar');
  await page.evaluate(() => {
    const g = window.__tb.game;
    window.__tb.clickHit({ kind: 'furniture', f: g.furniture.at(-1) });
  });
  await sleep(500);
  await shot(page, vp, '7b_girar_selecionado');
  await tap(page, '#decor-rotate');
  await waitStep(page, 'sair');
  await shot(page, vp, '8_sair');
  await tap(page, '#decor-exit');
  await page.waitForFunction(() => !window.__tb.kitnetGuide().running, null, { timeout: 5000 });
  await sleep(500);
  await shot(page, vp, '9_pronto');
  await catShots(page, vp);

  // a returning profile: reload, back into the kitnet, no guide
  await page.reload();
  await page.waitForFunction(() => window.__tb?.game?.profile && window.__tb.game.room, null, { timeout: 20_000 });
  await toKitnet(page);
  assert(!(await page.evaluate(() => window.__tb.kitnetGuide().running)) && !(await step(page)), `${vp.name}: a returning profile does not see the guide again`);
  await shot(page, vp, '10_volta_sem_guia');
  // the Decorar panel's "?" replays it
  await openDecorar(page, vp);
  await tap(page, '#decor-help');
  await waitStep(page, 'loja');
  await shot(page, vp, '11_rever_guia');
  await tap(page, '#kitnet-guide-skip');
  await sleep(300);
  assert(!(await page.evaluate(() => window.__tb.kitnetGuide().running)), `${vp.name}: Pular closes the guide`);
}

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
let failed = false;
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', String(e)));
    try {
      await newPlayer(page, vp);
      await (MODE === 'before' ? before(page, vp) : after(page, vp));
    } catch (e) {
      failed = true;
      console.error(e);
      await shot(page, vp, 'error').catch(() => {});
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
