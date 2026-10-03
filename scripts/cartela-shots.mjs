#!/usr/bin/env node
/**
 * Cartela UI screenshots (solo build). Needs static client on BASE_URL.
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 / &
 *   SHOTS_DIR=/opt/cursor/artifacts/screenshots node scripts/cartela-shots.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS_DIR ?? '/opt/cursor/artifacts/screenshots';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();

const shot = async (name) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

async function enterPraça() {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Cartela');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 15_000, 'praça');
  await sleep(800);
}

try {
  await enterPraça();
  await page.evaluate(() => {
    window.__tb.game.profile.cartela = { stamps: 0, activityDay: {} };
    window.__tb.game.emit('profile');
  });
  await page.click('#cartela-pill');
  await page.waitForSelector('[data-modal="cartela"]', { timeout: 5000 });
  await shot('cartela-empty');
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
    window.__tb.game.profile.cartela = { stamps: 3, activityDay: { tatame: day, balcao: day, feira: day } };
    window.__tb.game.emit('profile');
  });
  await page.click('#cartela-pill');
  await page.waitForSelector('[data-modal="cartela"]', { timeout: 5000 });
  await shot('cartela-partial');
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    window.__tb.cartelaBanner(7);
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/New_York' });
    window.__tb.game.profile.cartela = { stamps: 0, activityDay: { tatame: day, balcao: day, feira: day, conversa: day } };
    window.__tb.game.emit('profile');
  });
  await sleep(400);
  await shot('cartela-payout');
  console.log('cartela shots ->', SHOTS);
} catch (e) {
  console.error('cartela shots failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
