#!/usr/bin/env node
/**
 * Opus polish shots (#157): Nanda's hat stall, the Puleiro dos Pássaros, and the feira at dawn, midday, dusk, night, chuva and garoa.
 * Desktop 1280x800 and phone 390x844. The time and weather are pinned in the page with `__tb.setClock`.
 *
 *   pnpm build && pnpm start &
 *   node scripts/shops-feira-weather-shots.mjs before    # or: after (the file prefix)
 *
 * Shots land in docs/lifesim/shots/opus-polish/shops-feira-weather/ (SHOTS_DIR overrides).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { goArea } from './lib/areas.mjs';
import { sleep, waitFor } from './lib/meveum-play.mjs';
import { DAY_MIN, requirePinnedClock } from './lib/clock-pin.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const PREFIX = process.argv[2] ?? 'after';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'docs/lifesim/shots/opus-polish/shops-feira-weather');
const CHROME = findChrome();
if (!CHROME) {
  console.error('Chrome/Chromium not found: set CHROME_PATH');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const FEIRA = [
  ['dawn', '06:20', 'sol'],
  ['midday', '12:00', 'sol'],
  ['dusk', '18:20', 'sol'],
  ['night', '22:30', 'sol'],
  ['rain', '10:30', 'chuva'],
  ['drizzle', '10:30', 'garoa'],
  ['rain-night', '21:30', 'chuva'],
];
const log = (...a) => console.log('  ·', ...a);

// the server clock only decides who is on duty; the sky is pinned in the page
try {
  await requirePinnedClock(BASE, { min: 0, max: 1439, target: DAY_MIN });
} catch {
  log('server clock not pinned: Nanda may be away');
}

async function enter(page, name) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `shops+${name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '10:00', weather: 'sol' }));
  await sleep(600);
}

const clearToasts = (page) => page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());
const closeModal = async (page) => {
  await page.keyboard.press('Escape');
  await sleep(300);
};

async function openProp(page, prop, modal) {
  await page.evaluate((prop) => window.__tb.interact({ prop }), prop);
  await waitFor(page, (sel) => !!document.querySelector(sel), modal, 25_000, `open ${modal}`);
  await sleep(700);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  for (const [view, opts] of Object.entries(VIEW)) {
    const page = await browser.newPage(opts);
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    const shot = async (name) => {
      await clearToasts(page);
      await sleep(150);
      const file = path.join(SHOTS, `${PREFIX}_${name}_${view === 'desktop' ? '1280x800' : '390x844'}.png`);
      await page.screenshot({ path: file });
      log('shot', path.basename(file));
    };
    log(view, 'enter');
    await enter(page, view);

    // Nanda's stall: take the free straw hat so the grid shows an owned / worn card next to the ones for sale
    await openProp(page, 'barraca', '.panel .shop');
    await shot('hats');
    const free = await page.$('[data-hat-action="chapeu_palha"]');
    if (free) {
      await free.click();
      await sleep(900);
      await shot('hats-bought');
    }
    await closeModal(page);

    // the Puleiro: adopt the free green bird, then look at the stall again
    await openProp(page, 'poleiro', '.parrot-shop');
    await shot('puleiro');
    const adopt = await page.$('[data-parrot="verde"] button');
    if (adopt) {
      await adopt.click();
      await sleep(1200);
      await shot('puleiro-owned');
    }
    await closeModal(page);

    // the feira, across the day and the weather
    await goArea(page, 'feira');
    const mid = await page.evaluate(() => {
      const r = window.__tb.rooms.feira;
      return { x: Math.floor(r.floor[0].length / 2), y: Math.floor(r.floor.length / 2) };
    });
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [mid.x, mid.y]);
    await sleep(4000);
    for (const [name, time, weather] of FEIRA) {
      await page.evaluate(([time, weather]) => window.__tb.setClock({ time, weather }), [time, weather]);
      // the weather and the lights ease in
      await sleep(5000);
      await shot(`feira-${name}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
