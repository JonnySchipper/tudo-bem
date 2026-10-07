#!/usr/bin/env node
/**
 * Screenshots of the player-owned padaria loop (Fundar → hat → re-enter → work → upgrade), from the solo build:
 *
 *   pnpm build && node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/padaria-shots.mjs     # SHOTS_DIR (default docs/lifesim/shots/padaria-own), VIEWS=desktop,phone
 *
 * Coins are set through the in-page world (solo only) so the shots do not have to play 45 shifts.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/padaria-own');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);
const setCoins = (page, n) => page.evaluate((n) => (window.__tb.net.session.profile.coins = n), n);
const send = (page, m) => page.evaluate((m) => window.__tb.net.send(m), m);

async function run(name) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext(VIEW[name])).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let n = 0;
  const shot = async (label) => {
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  try {
    await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}solo&notype=1&tbclockmin=${offsetMinFor(DAY_MIN)}`);
    await page.click('#intro-enter');
    await page.click('#intro-skip');
    await page.waitForSelector('#intro-guest', { state: 'visible' });
    await page.click('#intro-guest');
    await page.fill('#avatar-name', 'Lia');
    await page.click('button:has-text("ela (she)")');
    await page.click('#enter-praca');
    await finishArrival(page);
    await sleep(600);
    await goArea(page, 'rua');
    await sleep(1200);
    await shot('rua_saving');
    await setCoins(page, 420);
    await page.evaluate(() => window.__tb.interact({ prop: 'padaria_porta_fundar' }));
    await page.waitForSelector('.padaria-door', { timeout: 15_000 });
    await sleep(300);
    await shot('door_saving');
    await page.evaluate(() => document.querySelector('.modal-close, [data-close]')?.click());
    await page.keyboard.press('Escape');
    // a real owner has long met Seu Carlos (the street guide for owners waits for that step)
    await page.evaluate(() => (window.__tb.net.session.profile.tutorial.carlos = true));
    await setCoins(page, 2400);
    await page.evaluate(() => window.__tb.interact({ prop: 'padaria_porta_fundar' }));
    await page.waitForSelector('.padaria-door input', { timeout: 15_000 });
    await page.fill('.padaria-door input', 'Padaria da Lia');
    await shot('door_fundar');
    await page.keyboard.press('Enter');
    await waitFor(page, () => !!window.__tb.game.room?.padaria, null, 20_000, 'owned padaria');
    await page.waitForSelector('#pad-welcome-ok', { timeout: 10_000 });
    await sleep(300);
    await shot('owned_welcome');
    await page.click('#pad-welcome-ok');
    await sleep(800);
    await shot('owned_first');
    // the in-shop vaso: the book of Melhorias
    await page.evaluate(() => window.__tb.interact({ prop: 'padaria_porta_fundar' }));
    await page.waitForSelector('.padaria-book', { timeout: 15_000 });
    await sleep(400);
    await shot('book_balcao');
    await page.click('[data-upgrade="size2"]');
    await waitFor(page, () => window.__tb.game.room?.padaria?.size === 2, null, 10_000, 'size 2');
    await sleep(500);
    await shot('book_padaria');
    await page.keyboard.press('Escape');
    // out to the rua: the owner's arrow over the shared door
    await page.evaluate(() => window.__tb.interact({ portal: 'padaria_praca' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'rua', null, 20_000, 'back on rua');
    await sleep(1500);
    await shot('rua_owner');
    // Seu Carlos's door asks the owner which padaria
    await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
    await page.waitForSelector('.padaria-choose', { timeout: 15_000 });
    await sleep(300);
    await shot('door_choose');
    await page.click('#pad-choose-mine');
    await waitFor(page, () => !!window.__tb.game.room?.padaria, null, 20_000, 'owned padaria again');
    await sleep(800);
    await setCoins(page, 3500);
    await send(page, { t: 'padariaOwn', action: 'upgrade', kind: 'size3' });
    await send(page, { t: 'padariaOwn', action: 'upgrade', kind: 'brigadeiro' });
    await sleep(1500);
    await shot('owned_restaurante');
    await page.evaluate(() => window.__tb.interact({ prop: 'balcao' }));
    await sleep(2500);
    await shot('balcao_da_casa');
    await page.keyboard.press('Escape');
    await sleep(300);
    await page.evaluate(() => window.__tb.interact({ prop: 'trilho' }));
    await sleep(4000);
    await shot('correria_owned');
    if (errors.length) console.log('  ! page errors:', errors);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
