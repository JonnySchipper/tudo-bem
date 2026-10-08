#!/usr/bin/env node
/**
 * Held snacks and the street snack carts (issue #156): buy at the pipoqueiro and the coconut cart, eat / drink, toss the empty into a
 * lixeira and onto the ground. Doubles as a smoke check (it fails if a step does not land) and writes the review shots.
 *
 *   pnpm build && pnpm start &
 *   node scripts/held-snacks-shots.mjs after      # `before` on main; BASE_URL (default http://127.0.0.1:8787), CHROME_PATH optional
 *
 * Shots land in docs/lifesim/shots/opus-polish/held-snacks/<TAG>_<step>_<1280x800|390x844>.png (SHOTS_DIR to override).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const TAG = process.argv[2] ?? process.env.TAG ?? 'after';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'docs/lifesim/shots/opus-polish/held-snacks');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  '1280x800': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

async function enter(page) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await sleep(600);
  if (await page.isVisible('#intro-18')) {
    // the server build: guests do not enter multiplayer (the CTA switches to Criar conta), so make a throwaway account
    await page.fill('#intro-email', `pipoca+${Date.now().toString(36)}@exemplo.com`);
    await page.fill('#intro-password', 'pao-de-queijo-2026');
    await page.check('#intro-18');
    await page.click('#intro-submit');
  }
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Pipoca');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  // midday light so the art reads; the clock pin is a client-only shots hook
  await page.evaluate(() => window.__tb.setClock({ time: '12:30', weather: 'sol' }));
  await sleep(800);
}

const carry = (page) => page.evaluate(() => window.__tb.game.self?.pub.carry ?? null);
const coins = (page) => page.evaluate(() => window.__tb.game.profile?.coins ?? 0);
const clearToasts = (page) => page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());

async function walk(page, x, y) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await waitFor(page, ([x, y]) => {
    const t = window.__tb.selfTile();
    return t && !t.moving && t.tile.x === x && t.tile.y === y;
  }, [x, y], 20_000, `walk to ${x},${y}`);
  await sleep(500);
}

/** Open a cart's menu (the click walks you over first). */
async function openCart(page, prop) {
  await page.evaluate((id) => window.__tb.interact({ prop: id }), prop);
  await page.waitForSelector('#dialogue-box[data-dialogue^="street-snack"]', { timeout: 20_000 });
  await sleep(700);
}

/** A cart's menu-board tile (`data-snack`), or the chip on builds without the board. */
async function choose(page, snackId, chipRe) {
  const tile = page.locator(`#dialogue-box .snack-pick[data-snack="${snackId}"]`);
  if (await tile.count()) await tile.click();
  else await page.locator('#dialogue-box .dbx-chip', { hasText: chipRe }).first().click();
}

async function useCarry(page) {
  await page.click('#btn-carry');
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let failed = false;
for (const [size, opts] of Object.entries(VIEW)) {
  const page = await browser.newPage(opts);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (step) => {
    const file = path.join(SHOTS, `${TAG}_${step}_${size}.png`);
    await page.screenshot({ path: file });
    log('shot', path.relative(process.cwd(), file));
  };
  try {
    log(size, 'enter');
    await enter(page);
    log('coins', await coins(page));

    // 1. the pipoqueiro: salgada / doce, then the leite condensado step
    await openCart(page, 'pipoqueiro');
    await shot('pipoca_menu');
    await choose(page, 'pipoca_doce', /Pipoca doce/);
    await page.waitForSelector('#dialogue-box[data-dialogue="street-snack-leite"]', { timeout: 5000 });
    await sleep(500);
    await shot('pipoca_leite');
    await choose(page, 'pipoca_doce_leite', /Com leite condensado/);
    await waitFor(page, () => window.__tb.game.self?.pub.carry === 'pipoca_doce_leite', null, 8000, 'holding pipoca doce com leite');
    await page.evaluate(() => document.querySelector('.dbx-close')?.click());
    // step out from behind the cart, onto the path by the playground lixeira (lixeira_p2 at 13,19)
    await walk(page, 15, 19);
    await page.mouse.move(2, 400);
    await clearToasts(page);
    await sleep(400);
    await shot('held_pipoca');

    // 2. eat: the bite beat, then the empty bag in hand
    await useCarry(page);
    await sleep(380);
    await shot('eating');
    await waitFor(page, () => window.__tb.game.self?.pub.carry === 'saquinho_vazio', null, 8000, 'empty bag in hand');
    await sleep(1600);
    await clearToasts(page);
    await shot('empty_bag');

    // 3. toss into the lixeira (two tiles away: in reach)
    await clearToasts(page);
    // the arc is under half a second and a WebGL screenshot takes a while: shoot as soon as the bag leaves the hand
    await useCarry(page);
    await waitFor(page, () => window.__tb.game.self?.pub.carry === null, null, 8000, 'tossed');
    await shot('toss_lixeira');
    await waitFor(page, () => window.__tb.game.self?.pub.carry === null, null, 8000, 'tossed');
    await sleep(500);
    await shot('toss_lixeira_done');

    // 4. the coconut cart: buy, drink, toss away from any bin. A new account starts with 10 RV (spent on the pipoca), so a second one
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await enter(page);
    await clearToasts(page);
    await openCart(page, 'carrinho_coco');
    await shot('coco_menu');
    await choose(page, 'agua_de_coco', /Comprar/);
    await waitFor(page, () => window.__tb.game.self?.pub.carry === 'agua_de_coco', null, 8000, 'holding água de coco');
    await page.evaluate(() => document.querySelector('.dbx-close')?.click());
    // onto the brick path south of the cart: no lixeira within reach, so the toss lands on the ground
    await walk(page, 23, 12);
    await page.mouse.move(2, 400);
    await clearToasts(page);
    await sleep(400);
    await shot('held_coco');
    await useCarry(page);
    await sleep(420);
    await shot('drinking');
    await waitFor(page, () => window.__tb.game.self?.pub.carry === 'coco_vazio', null, 8000, 'empty coconut in hand');
    await sleep(1600);
    await clearToasts(page);
    await shot('empty_coco');
    await useCarry(page);
    await sleep(240);
    await shot('toss_ground');
    await waitFor(page, () => window.__tb.game.self?.pub.carry === null, null, 8000, 'tossed the coconut');
    assert(!errors.length, `page errors: ${errors.join(' | ')}`);
    log(size, 'ok, coins left', await coins(page));
  } catch (e) {
    failed = true;
    console.error(`  ✗ ${size}:`, e?.message ?? e);
    await shot('fail').catch(() => {});
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
