#!/usr/bin/env node
/**
 * Screenshots for the wifi sign move and feira bunting removal.
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client exec vite --port 5190 &
 *   BASE_URL=http://localhost:5190/ node scripts/wifi-bunting-shots.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { goArea } from './lib/areas.mjs';
import { offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5190/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'docs/lifesim/shots/wifi-bunting');
const CHROME = findChrome();
if (!CHROME) {
  console.error('Chrome/Chromium not found: set CHROME_PATH');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log('  ·', ...a);

async function enter(page) {
  const url = `${BASE}${BASE.includes('?') ? '&' : '?'}solo&notype=1&tbclockmin=${offsetMinFor(10 * 60)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('#intro-enter', { timeout: 90_000 });
  await page.click('#intro-enter');
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible' });
  await page.click('#intro-guest');
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
    await finishArrival(page);
  await sleep(800);
  await page.addStyleTag({ content: '#ui{visibility:hidden !important}' });
}

async function interact(page, target) {
  assert(await page.evaluate((t) => window.__tb.interact(t), target), `interact ${JSON.stringify(target)}`);
}

async function frame(page, tileX, tileY, zoom) {
  await page.evaluate((spec) => window.__tb.renderer.setShot(spec), `cam:${tileX},${tileY},${zoom}`);
  await sleep(1200);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, vp] of [
  ['1280x800', { width: 1280, height: 800 }],
  ['390x844', { width: 390, height: 844, isMobile: true, hasTouch: true }],
]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: name === '390x844' ? 2 : 1, hasTouch: !!vp.hasTouch })).newPage();
  try {
    await enter(page);
    await goArea(page, 'feira');
    await frame(page, 8, 3.5, 3.6);
    const feira = path.join(SHOTS, `feira-aisle-no-bunting-${name}.png`);
    await page.screenshot({ path: feira });
    log(feira);

    await goArea(page, 'rua');
    await page.evaluate(() => window.__tb.walkTo(4, 6));
    await sleep(1500);
    await interact(page, { portal: 'praca_padaria' });
    await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 20_000, 'padaria');
    await sleep(1000);
    await frame(page, 2, 1.5, 3.4);
    const padaria = path.join(SHOTS, `padaria-wifi-sign-${name}.png`);
    await page.screenshot({ path: padaria });
    log(padaria);
  } finally {
    await page.context().close();
  }
}
await browser.close();
