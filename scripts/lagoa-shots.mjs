#!/usr/bin/env node
/**
 * The Lagoa do Jerivá's screenshots: the trail head on the Praia, the lagoon by morning, at golden hour, at night (fireflies) and in the
 * rain, the jetty, the mirante, the south bank's capybaras and the map. Desktop 1280x800 and a wide 2560x1600. Every shot asserts nothing was
 * drawn as a placeholder (`__tb.artMissing`) and the page threw nothing.
 *
 *   pnpm build && PORT=8811 TB_TEST_CLOCK_CONTROL=1 pnpm start &
 *   BASE_URL=http://localhost:8811/ node scripts/lagoa-shots.mjs
 * Env: BASE_URL, CHROME_PATH, SHOTS_DIR (default docs/lifesim/shots/lagoa), VIEWS=desktop,wide
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { goLagoa, goPraia } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { assert, sleep } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8811/';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'lagoa');
const VIEWS = (process.env.VIEWS ?? 'desktop,wide').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  wide: { viewport: { width: 2560, height: 1600 }, deviceScaleFactor: 1 },
};
const log = (...a) => console.log('  ·', ...a);
const errors = [];

async function enter(page, name) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `lagoa+${name.toLowerCase()}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '09:00', weather: 'sol' }));
  await page.evaluate(() => document.getElementById('aero-next-ok')?.click());
}

async function shot(page, view, name) {
  await sleep(700);
  const missing = await page.evaluate(() => window.__tb.artMissing);
  assert(missing.length === 0, `${name}: placeholders drawn for ${missing.join(', ')}`);
  const p = path.join(OUT, `${view}_${name}.png`);
  await page.screenshot({ path: p });
  log('shot', p);
}

const walk = async (page, x, y, ms = 6000) => {
  await page.evaluate(([a, b]) => window.__tb.walkTo(a, b), [x, y]);
  await sleep(ms);
};
const clock = (page, time, weather = 'sol') => page.evaluate((o) => window.__tb.setClock(o), { time, weather });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const view of VIEWS) {
    const ctx = await browser.newContext(VIEW[view]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${view}: ${e}`));
    await enter(page, 'Iara');
    await goPraia(page);
    await clock(page, '10:00');
    await walk(page, 2, 10, 7000);
    await shot(page, view, 'praia_trilha');
    await goLagoa(page);
    await walk(page, 24, 13, 6000);
    await shot(page, view, 'lagoa_0900');
    await walk(page, 20, 13, 4000);
    await shot(page, view, 'lagoa_pier');
    await walk(page, 16, 22, 9000);
    await shot(page, view, 'lagoa_capivaras');
    await walk(page, 14, 4, 9000);
    await shot(page, view, 'lagoa_mirante');
    await clock(page, '17:40');
    await sleep(1200);
    await shot(page, view, 'lagoa_1740');
    await clock(page, '22:00');
    await sleep(1500);
    await shot(page, view, 'lagoa_2200_vagalumes');
    await clock(page, '11:00', 'chuva');
    await sleep(1500);
    await shot(page, view, 'lagoa_1100_chuva');
    await clock(page, '10:00');
    await page.evaluate(() => document.getElementById('btn-map').click());
    await page.waitForSelector('[data-modal="map"] .tm-svg', { timeout: 5000 });
    assert(await page.isVisible('.tm-here[data-here="lagoa"]'), '"você está aqui" on the lagoa');
    await shot(page, view, 'map');
    await ctx.close();
  }
} finally {
  await browser.close();
}
assert(errors.length === 0, `page errors:\n${errors.join('\n')}`);
console.log('lagoa-shots: ok');
