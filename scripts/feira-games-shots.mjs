#!/usr/bin/env node
/**
 * Feira cart games screenshots (and a smoke play with real mouse clicks).
 *
 *   BASE_URL=https://playtudobem.com/ node scripts/feira-games-shots.mjs        # live server (guest)
 *   BASE_URL=http://localhost:9311/?solo node scripts/feira-games-shots.mjs     # solo build
 *   SHOTS_DIR (default /workspace/feira-games-shots), VIEWS=desktop,phone, GAME=tapioca|pastel|caldo (forces nothing; just labels)
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { sleep } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:9311/?solo';
const SHOTS = process.env.SHOTS_DIR ?? '/workspace/feira-games-shots';
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const TAG = process.env.TAG ?? 'local';
const CHROME = findChrome();
fs.mkdirSync(SHOTS, { recursive: true });
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

async function enter(page) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(800);
  await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
  await goArea(page, 'feira');
  await sleep(1500);
}

const shot = async (page, name) => {
  const p = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: p });
  log('shot', p);
};

/** Real mouse click at an element's centre (not el.click()), so per-frame DOM rebuilds would show up as lost clicks. */
async function mclick(page, sel) {
  const el = await page.waitForSelector(sel, { timeout: 5000 });
  const b = await el.boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
}

export { enter, shot, mclick, log };

async function run(viewName) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext(VIEW[viewName]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  try {
    await enter(page);
    await shot(page, `${TAG}-${viewName}-feira-room`);
    // the walk to the sign is long (around the stalls); wait for the panel, not a fixed sleep
    await page.evaluate(() => window.__tb.interact({ prop: 'placa_jogos' }));
    await page.waitForSelector('[data-modal="feira-sign"]', { timeout: 30_000 });
    await sleep(300);
    await shot(page, `${TAG}-${viewName}-sign`);
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.evaluate(() => document.querySelectorAll('#feira-sign-panel .close, [data-modal] .close').forEach((b) => b.click()));
    await page.evaluate(() => window.__tb.interact({ prop: 'carrinho_jogos' }));
    await page.waitForSelector('#feira-cart-play', { timeout: 15_000 });
    await shot(page, `${TAG}-${viewName}-cart-offer`);
    const game = await page.evaluate(() => document.querySelector('#feira-cart-game')?.textContent ?? '');
    log('featured', game);
    await page.click('#feira-cart-play');
    const play = (await import(`./feira-play-${process.env.GAME ?? 'tapioca'}.mjs`)).play;
    await play(page, { shot: (n) => shot(page, `${TAG}-${viewName}-${n}`), mclick: (s) => mclick(page, s), log });
    await sleep(1000);
    await page.evaluate(() => document.querySelector('[id$="-close"]')?.click());
    await sleep(1500);
    await shot(page, `${TAG}-${viewName}-after-crown`);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) await run(v);
