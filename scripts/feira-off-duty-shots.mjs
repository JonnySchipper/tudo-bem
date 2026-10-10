#!/usr/bin/env node
/**
 * Feira vendors off duty (issue #170): Tia Lu on her praça bench at 15:00 (off-duty talk), then at her stall at 08:40 (the stall box as before).
 * Starts its own server with a pinned clock (TB_TEST_CLOCK_CONTROL=1) unless BASE_URL is given, and shoots both sizes.
 *
 *   pnpm build && node scripts/feira-off-duty-shots.mjs [before|after]    # (or TAG), SHOTS_DIR (default docs/lifesim/shots/feira-vendors-off-duty)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAG = process.argv[2] ?? process.env.TAG ?? 'after';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/feira-vendors-off-duty');
const CHROME = findChrome();
const PORT = Number(process.env.SHOTS_PORT ?? 8793);
const VIEWS = {
  '1280x800': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);
fs.mkdirSync(SHOTS, { recursive: true });

let server = null;
let BASE = process.env.BASE_URL;
if (!BASE) {
  BASE = `http://127.0.0.1:${PORT}`;
  server = spawn(process.execPath, [path.join(ROOT, 'apps/server/dist/index.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tb-offduty-')), TB_TEST_CLOCK_CONTROL: '1' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) break;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
}

const pin = async (min) => {
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${min}`, { method: 'POST' });
  assert(r.ok, `pin the clock to ${min} (start the server with TB_TEST_CLOCK_CONTROL=1)`);
};

async function enter(browser, view, min) {
  await pin(min);
  const page = await (await browser.newContext(VIEWS[view])).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`${BASE}/?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `folga+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 12_000 });
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ weather: 'sol' }));
  await sleep(800);
  return page;
}

const shot = async (page, name) => {
  const p = path.join(SHOTS, `${TAG}_${name}.png`);
  await page.screenshot({ path: p });
  log('shot', path.relative(ROOT, p));
};
const boxKey = (page) => page.getAttribute('#dialogue-box', 'data-dialogue');
const boxLine = async (page) => ((await page.textContent('#dialogue-box .line-bubble .pt').catch(() => '')) ?? '').trim();

/** Talk to Tia Lu, declining a recado offer or hand-over, and stop at the first box that is hers. */
async function talkToTiaLu(page) {
  await page.evaluate(() => window.__tb.interact({ npc: 'tia_lu' }));
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('#dialogue-box', { timeout: 20_000 });
    const key = await boxKey(page);
    if (!key?.startsWith('offer-') && !key?.startsWith('give-')) return key;
    await page.click('#dialogue-box [data-chip="1"]');
    await sleep(350);
  }
  return boxKey(page);
}

async function run(view) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    // 15:00, the praça: Tia Lu rests on her bench (banco_4)
    const page = await enter(browser, view, 15 * 60);
    await waitFor(page, () => [...window.__tb.game.avatars.values()].some((a) => a.pub.npc === 'tia_lu' && a.pub.activity === 'sentado'), null, 30_000, 'Tia Lu on the bench');
    let key = await talkToTiaLu(page);
    await sleep(600);
    log(view, 'praça 15:00:', key, '|', await boxLine(page));
    await shot(page, `${view}_praca_1500`);
    // the next box: the buy question
    if (key === 'vendor-off-duty') await page.click('#dialogue-box [data-chip="0"]');
    await sleep(800);
    key = await boxKey(page).catch(() => null);
    if (key) {
      log(view, 'praça 15:00 next:', key, '|', await boxLine(page));
      await shot(page, `${view}_praca_1500_next`);
    }
    await page.context().close();

    // 08:40, the feira: Tia Lu is at her stall
    const day = await enter(browser, view, 8 * 60 + 40);
    await goArea(day, 'feira');
    await waitFor(day, () => [...window.__tb.game.avatars.values()].some((a) => a.pub.npc === 'tia_lu' && a.pub.activity === 'trabalhando'), null, 30_000, 'Tia Lu at the stall');
    await day.evaluate(() => window.__tb.walkTo(7, 6, false));
    await sleep(2500);
    key = await talkToTiaLu(day);
    await sleep(600);
    log(view, 'stall 08:40:', await boxKey(day), '|', await boxLine(day));
    await shot(day, `${view}_stall_0840`);
  } finally {
    await browser.close();
  }
}

try {
  assert(CHROME, 'set CHROME_PATH');
  for (const v of (process.env.VIEWS ?? '1280x800,390x844').split(',')) await run(v);
} finally {
  server?.kill();
}
