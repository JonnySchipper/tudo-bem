#!/usr/bin/env node
/**
 * Feira cart games are off until an admin turns one on. With every game off, the cart and the FEIRA sign
 * are not in the world. Turning Pastel on from the credits admin door puts them back without a reload.
 *
 *   node scripts/e2e-feira-cart.mjs   (BASE_URL, CHROME_PATH)
 *   Writes 1280x800 shots to docs/lifesim/shots/feira-games/ when SHOTS=1 (default).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const CHROME = findChrome();
const PASSWORD = 'pao-de-queijo-2026';
const ADMIN = process.env.TB_ADMIN_PASSWORD || 'tb-admin-praca';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs/lifesim/shots/feira-games');
const SAVE = process.env.SHOTS !== '0';
const log = (...a) => console.log('  ·', ...a);

const CART = (names) => names.some((n) => n.startsWith('props/carrinho_feira') || n.startsWith('props/placa_feira'));

async function enter(page) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `cart+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PASSWORD);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
  await goArea(page, 'feira');
  await sleep(600);
}

async function enablePastel(page) {
  await page.click('#btn-menu').catch(() => page.click('#btn-burger'));
  await page.click('#btn-credits');
  await page.waitForSelector('#credits-admin-door', { timeout: 8_000 });
  await page.click('#credits-admin-door');
  await page.waitForSelector('#admin-password', { timeout: 8_000 });
  await page.fill('#admin-password', ADMIN);
  await page.click('#admin-login-go');
  await page.waitForSelector('#admin-feira-pastel', { timeout: 8_000 });
  const on = await page.getAttribute('#admin-feira-pastel', 'aria-checked');
  if (on !== 'true') await page.click('#admin-feira-pastel');
  await page.waitForFunction(() => document.querySelector('#admin-feira-pastel')?.getAttribute('aria-checked') === 'true');
  await page.keyboard.press('Escape');
  await sleep(300);
}

const world = (page) =>
  page.evaluate(() => {
    const props = window.__tb.game.roomDef.props.map((p) => p.id);
    const praca = window.__tb.rooms.praca.props.map((p) => p.id);
    const frames = window.__tb.drawnFrames();
    const plates = [...document.querySelectorAll('.wl-plate')].map((el) => el.textContent ?? '');
    return {
      props,
      frames,
      plates,
      chico: props.includes('feira_chico'),
      stallCart: props.includes('carrinho_feira_1'),
      coco: praca.includes('carrinho_coco'),
      pipoca: praca.includes('pipoqueiro'),
      gameCart: props.includes('carrinho_jogos'),
      sign: props.includes('placa_jogos'),
      closedCopy: document.body.innerText.includes('O carrinho está fechado hoje'),
    };
  });

async function main() {
  assert(CHROME, 'set CHROME_PATH');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await enter(page);
    await page.evaluate(() => window.__tb.renderer.setShot('cam:22,8,3'));
    await waitFor(
      page,
      () => {
        const f = window.__tb.drawnFrames();
        const market = f.some((n) => n.startsWith('props/feira_livre'));
        const cart = f.some((n) => n.startsWith('props/carrinho_feira') || n.startsWith('props/placa_feira'));
        return market && !cart;
      },
      null,
      15_000,
      'feira drawn with no game cart',
    );
    const off = await world(page);
    assert(!off.gameCart && !off.sign, 'room still lists the game cart or the sign');
    assert(!CART(off.frames), `cart sprites still drawn: ${off.frames.filter((n) => n.includes('feira') || n.includes('carrinho') || n.includes('placa')).join(' ')}`);
    assert(!off.plates.includes('Fechado'), 'a Fechado plate is still up');
    assert(!off.closedCopy, 'the closed-cart line is on screen');
    assert(off.chico && off.stallCart, 'Seu Chico or the stall carts disappeared');
    assert(off.coco && off.pipoca, 'the coconut cart or the pipoca stand disappeared');
    assert((await page.evaluate(() => window.__tb.interact({ prop: 'carrinho_jogos' }))) === false, 'the hidden cart is still a click target');
    assert((await page.evaluate(() => window.__tb.interact({ prop: 'placa_jogos' }))) === false, 'the hidden sign is still a click target');
    assert((await page.$('#feira-cart-closed')) === null, 'closed-cart panel is open');

    await page.evaluate(() => window.__tb.walkTo(22, 7, false));
    await waitFor(
      page,
      () => {
        const t = window.__tb.selfTile();
        return t && !t.moving && t.tile.x === 22 && t.tile.y === 7;
      },
      null,
      20_000,
      'walk onto the empty cart tile',
    );
    await page.evaluate(() => window.__tb.walkTo(16, 11, false));
    await waitFor(
      page,
      () => {
        const t = window.__tb.selfTile();
        return t && !t.moving && t.tile.x === 16 && t.tile.y === 11;
      },
      null,
      20_000,
      'step back for the shot',
    );
    await sleep(400);
    if (SAVE) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, '1280x800-carts-off.png') });
      log('shot', '1280x800-carts-off.png');
    }

    await enablePastel(page);
    await waitFor(
      page,
      () => {
        const f = window.__tb.drawnFrames();
        return f.includes('props/carrinho_feira') && f.includes('props/placa_feira');
      },
      null,
      12_000,
      'pastel cart and sign sprites',
    );
    const on = await world(page);
    assert(on.gameCart && on.sign, 'turning Pastel on did not put the cart and the sign back');
    assert(on.chico && on.stallCart && on.coco && on.pipoca, 'vendors changed when Pastel turned on');
    assert(!on.plates.includes('Fechado') && !on.closedCopy, 'a closed stub appeared with Pastel on');
    await sleep(500);
    if (SAVE) {
      await page.screenshot({ path: path.join(SHOTS, '1280x800-pastel-on.png') });
      log('shot', '1280x800-pastel-on.png');
    }

    const stayed = await page.evaluate(() => {
      window.__tb.walkTo(22, 7, false);
      return true;
    });
    assert(stayed, 'walk');
    await sleep(1200);
    const tile = await page.evaluate(() => window.__tb.selfTile());
    assert(tile && !tile.moving && !(tile.tile.x === 22 && tile.tile.y === 7), 'the cart tile is still walkable after Pastel turned on');

    assert((await page.evaluate(() => window.__tb.interact({ prop: 'carrinho_jogos' }))) === true, 'the cart is not clickable');
    await page.waitForSelector('#feira-cart-play', { timeout: 8_000 });
    assert((await page.$('#feira-cart-closed')) === null, 'closed panel opened for a live cart');
    const featured = await page.textContent('#feira-cart-game');
    assert((featured ?? '').includes('Pastel'), `expected Pastel, got ${featured}`);
    assert(errors.length === 0, errors.join('\n'));
    log('feira cart hide ok');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
