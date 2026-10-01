#!/usr/bin/env node
/**
 * The four README screenshots (1280 x 800): the street at golden hour, the praça at 19:30, the padaria dialogue, the feira.
 *
 *   pnpm build && TB_TEST_CLOCK_CONTROL=1 pnpm start          # a pinned server (see scripts/lib/clock-pin.mjs)
 *   node scripts/readme-shots.mjs                             # BASE_URL, CHROME_PATH, SHOTS_DIR (default docs/screenshots)
 *
 * The sky comes from `__tb.setClock` (client side); Seu Carlos, the baker, and the feira vendors need the server clock at daytime, which the pin gives.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { requirePinnedClock } from './lib/clock-pin.mjs';
import { openNpc } from './lib/npc.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'screenshots');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
await requirePinnedClock(BASE, { label: 'daytime, about 08:30' });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('  ·', name);
};
const walk = async (x, y) => {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await waitFor(page, ([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], 60_000, `at ${x},${y}`);
  await sleep(1200);
};

await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
await page.waitForSelector('#intro-enter', { timeout: 15_000 });
await page.click('#intro-enter');
await page.waitForSelector('#intro-skip', { timeout: 12_000 });
await page.click('#intro-skip');
await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
await page.click('#intro-tab-register');
await page.fill('#intro-email', `readme+${Date.now().toString(36)}@exemplo.com`);
await page.fill('#intro-password', 'pao-de-queijo-2026');
await page.click('#intro-submit');
await page.waitForSelector('#avatar-name', { timeout: 15_000 });
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');
await page.click('#enter-praca');
await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 15_000, 'praça');
await sleep(1500);

// 1. the street in front of the padaria, golden hour
await page.evaluate(() => window.__tb.setClock({ time: '17:30', weather: 'sol' }));
await walk(16, 7);
await shot('street');

// 2. the praça at 19:30
await page.evaluate(() => window.__tb.setClock({ time: '19:30', weather: 'sol' }));
await walk(25, 16);
await sleep(1500);
await shot('praca_1930');

// 3. the feira (server clock pinned in the morning; the sky follows it)
await page.evaluate(() => window.__tb.setClock({ time: null, weather: 'sol' }));
await walk(45, 19);
await openNpc(page, 'tia_lu', 'feira');
await page.click('#dialogue-box [data-chip="0"]');
await waitFor(page, () => /dois reais/.test(document.querySelector('#dialogue-box .line-bubble .pt')?.textContent ?? ''), null, 8000, 'the price');
await sleep(600);
await shot('feira');
await page.keyboard.press('Escape');
await sleep(500);

// 4. the padaria: Seu Carlos at the counter
await page.evaluate(() => window.__tb.setClock({ time: '09:30', weather: 'sol' }));
await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 15_000, 'padaria');
await sleep(1500);
await openNpc(page, 'carlos', 'conversa');
await sleep(900);
await shot('padaria_dialogue');

await browser.close();
