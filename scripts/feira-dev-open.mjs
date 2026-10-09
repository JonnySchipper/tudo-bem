#!/usr/bin/env node
/**
 * Dev helper: open today's Feira cart game in a solo build and leave a screenshot every second, so the stage
 * can be looked at without playing it. GAME=tapioca|pastel|caldo, VIEW=desktop|phone, SECS (default 6).
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { sleep } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:9311/?solo';
const GAME = process.env.GAME ?? 'tapioca';
const VIEW = process.env.VIEW ?? 'desktop';
const SECS = Number(process.env.SECS ?? 6);
const SHOTS = process.env.SHOTS_DIR ?? '/workspace/feira-dev';
fs.mkdirSync(SHOTS, { recursive: true });
const VIEWS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const page = await (await browser.newContext(VIEWS[VIEW])).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
try {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1&feiraon=${GAME}`);
  await page.click('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-guest', { timeout: 12_000 });
  await page.fill('#avatar-name', 'Lia', { timeout: 15_000 });
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
  await page.evaluate(() => document.getElementById('aero-next-ok')?.click());
  await goArea(page, 'feira');
  await sleep(1200);
  await page.evaluate(() => window.__tb.interact({ prop: 'carrinho_jogos' }));
  await page.click('#feira-cart-play', { timeout: 15_000 });
  await sleep(800);
  if (await page.$('#howto-ok')) await page.click('#howto-ok');
  for (let s = 1; s <= SECS; s++) {
    await sleep(1000);
    await page.screenshot({ path: path.join(SHOTS, `${GAME}-${VIEW}-${s}.png`) });
  }
} finally {
  await browser.close();
}
