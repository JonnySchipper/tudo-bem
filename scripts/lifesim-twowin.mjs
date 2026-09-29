#!/usr/bin/env node
/**
 * Two-window check for the pixel view (HOWTO Phase 2 "Done when": two browser windows see each other walk).
 *
 *   pnpm build && pnpm start                       # server on :8787 (or PORT=8791 ...)
 *   BASE_URL=http://127.0.0.1:8791 node scripts/lifesim-twowin.mjs [--view=pixel]
 *
 * Two throwaway accounts enter the Praça in separate contexts. B walks across the square; A must (1) get B in its avatar list,
 * (2) see B's interpolated position change tile by tile, (3) have a sprite and a nameplate for B, and the same the other way round
 * (B sees A walk). Exits non-zero on the first failed check.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const VIEW = argv.view ?? 'pixel';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const SHOT = process.env.SHOT ?? '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => {
  if (!c) throw new Error('FAIL: ' + m);
  console.log('  ✓', m);
};

function url() {
  const u = new URL(BASE);
  if (VIEW) u.searchParams.set('view', VIEW);
  return u.toString();
}

async function enter(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', name, String(e)));
  await page.goto(url());
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip');
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible' });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `${name.toLowerCase()}+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name');
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 15_000 });
  return page;
}

/** Sample where a given avatar id is (tile, moving) as another window sees it. */
const sample = (page, id) =>
  page.evaluate((id) => {
    const a = window.__tb.game.avatars.get(id);
    if (!a) return null;
    const p = window.__tb.renderer.avatarPos(a, performance.now());
    return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), moving: p.moving };
  }, id);

async function watchWalk(page, id, label) {
  const seen = new Set();
  let movingSeen = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const s = await sample(page, id);
    if (s) {
      seen.add(`${s.x},${s.y}`);
      movingSeen ||= s.moving;
    }
    await sleep(60);
  }
  assert(movingSeen && seen.size >= 4, `${label} sees the other avatar walk (${seen.size} distinct interpolated positions)`);
}

if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
console.log(`\ntwo-window check → ${url()}`);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const a = await enter(browser, 'Ana');
  const b = await enter(browser, 'Beto');
  const aId = await a.evaluate(() => window.__tb.game.room.selfId);
  const bId = await b.evaluate(() => window.__tb.game.room.selfId);
  await a.waitForFunction((id) => window.__tb.game.avatars.has(id), bId, { timeout: 10_000 });
  await b.waitForFunction((id) => window.__tb.game.avatars.has(id), aId, { timeout: 10_000 });
  assert(true, 'both windows list each other');

  if (VIEW === 'pixel') {
    await sleep(500);
    const plates = await a.$$eval('.wl-plate', (els) => els.map((e) => e.textContent));
    assert(plates.includes('Beto') && plates.includes('Ana'), `Ana's window draws nameplates for both (${plates.filter((p) => ['Ana', 'Beto'].includes(p)).join(', ')})`);
    const info = await a.evaluate(() => window.__tb.renderer.info());
    assert(info && info.avatars >= 2, `Ana's scene has sprites for the room (${info?.avatars})`);
  }

  // Beto walks across the square; Ana watches. Then Ana walks and Beto watches.
  await b.evaluate(() => window.__tb.walkTo(12, 8));
  await watchWalk(a, bId, 'Ana');
  await a.evaluate(() => window.__tb.walkTo(3, 3));
  await watchWalk(b, aId, 'Beto');
  if (SHOT) {
    fs.mkdirSync(SHOT, { recursive: true });
    await a.screenshot({ path: `${SHOT}/twowin_ana.png` });
    await b.screenshot({ path: `${SHOT}/twowin_beto.png` });
  }
  console.log('\n  ✓ two-window check passed\n');
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  await browser.close();
}
