#!/usr/bin/env node
/**
 * Solo build check (Phase 10): the static `VITE_LOCAL_WORLD=1` build boots as a guest, walks the first tutorial step, takes one recado from today's
 * offer, and buys a banana at the Hortifrúti corner (open at every hour) with the world running in the page: no server involved.
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 / &
 *   BASE_URL=http://localhost:4173/ node scripts/e2e-solo.mjs        # CHROME_PATH, SHOTS_DIR optional
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS_DIR ?? '';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
const log = (...a) => console.log('  ·', ...a);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// offline: nothing may reach a server (the only network is the static files)
const api = [];
page.on('request', (r) => /\/api\/(?!config)|\/ws/.test(r.url()) && api.push(r.url())); // /api/config is a harmless 404 probe on a static host
const shot = async (name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `solo_${name}.png`) });
};

try {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Solo');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(1200);
  assert(await page.isVisible('#solo-pill'), 'the solo pill shows (HUD, top left)');

  // tutorial: the hall-taught steps (walking among them) are done once the hall is; the welcome chain starts at the padaria
  await page.evaluate(() => window.__tb.walkTo(24, 12));
  await waitFor(page, () => window.__tb.game.profile?.tutorial?.andar === true, null, 20_000, 'tutorial: andar (done with the hall)');
  log('tutorial step done: andar');
  await shot('tutorial');

  // one recado from today's board
  const offered = await waitFor(page, () => (window.__tb.game.board?.offered?.length ? window.__tb.game.board.offered.map((o) => o.id) : null), null, 8000, 'recados offered');
  void offered;
  const id = await page.evaluate(() => window.__tb.game.board.offered[0].id);
  await page.evaluate((id) => window.__tb.net.send({ t: 'recados', action: 'accept', id }), id);
  await waitFor(page, (id) => window.__tb.game.board.active.some((a) => a.id === id), id, 8000, 'recado active');
  log('recado accepted offline:', id);
  await page.click('#btn-recados');
  await page.waitForSelector('[data-modal="recados"]', { timeout: 5000 });
  await shot('journal');
  await page.keyboard.press('Escape');

  // first-time help: the one "?" reads a panel's How it works card, and out in the Vila it brings back the Vila guide
  // (a newcomer has no Cartela chip and no Ajustes → Guia yet: SIMPLIFICATION-REVIEW §3)
  if (!(await page.$('[data-modal="recados"]'))) await page.click('#btn-recados');
  await page.waitForSelector('[data-modal="recados"]', { timeout: 5000 });
  await sleep(600);
  if (!(await page.$('#howto-card[data-game="recados"]'))) await page.click('#howto-help');
  await page.waitForSelector('#howto-card[data-game="recados"]', { timeout: 4000 });
  await page.click('#howto-ok');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-modal="recados"]', { state: 'detached', timeout: 4000 });
  assert(!(await page.isVisible('#cartela-pill')), 'a newcomer sees no Cartela chip');
  await page.click('#howto-help');
  await page.waitForSelector('#vila-guide', { timeout: 4000 });
  await shot('guide');
  await page.click('#vila-guide-ok');
  await page.waitForSelector('#vila-guide', { state: 'detached', timeout: 4000 });
  log('How it works (Favores) and the Vila guide open from the one ? button');

  // the feira at the Hortifrúti corner (any hour): it is at the banca on the rua, so walk off the praça's north edge first
  await goArea(page, 'rua');
  await page.evaluate(() => window.__tb.interact({ prop: 'hortifruti' }));
  await page.waitForSelector('#dialogue-box[data-dialogue="feira"]', { timeout: 20_000 });
  await page.click('#dialogue-box [data-chip="0"]');
  await waitFor(page, () => /dois reais/.test(document.querySelector('#dialogue-box .line-bubble .pt')?.textContent ?? ''), null, 8000, 'banana price');
  await page.click('#dialogue-box [data-chip="0"]');
  await page.waitForSelector('#feira-tray', { timeout: 6000 });
  await page.click('#feira-pay');
  await waitFor(page, () => (window.__tb.game.profile.bag?.banana ?? 0) === 1, null, 6000, 'banana in the bag');
  log('Hortifrúti sold a banana offline');
  await shot('feira');

  assert(!api.length, `no server traffic in solo mode (${api.join(', ')})`);
  assert(!errors.length, `no page errors: ${errors.join(' | ')}`);
  console.log('\n  ✓ solo build: boots, tutorial step, recado, feira offline');
} catch (e) {
  console.error('\n  ✗ solo check failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
