#!/usr/bin/env node
/**
 * Phase 6a review shots: the same praça spot at 07:00, 12:00, 17:30, 19:30 and 23:00 (sun), plus garoa and chuva at 15:00, at 1280x800,
 * and a phone shot at 19:30. The time and weather are pinned through `window.__tb.setClock` (the production build ignores ?time / ?weather).
 *
 *   pnpm build && PORT=8797 pnpm start
 *   BASE_URL=http://localhost:8797 node scripts/lifesim-shots-p6a.mjs [--phase=p6a] [--spot=6,3]
 *
 * Also prints `window.__tb.perf` (frame-time probe) for each shot, so the numbers land in the report.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const PHASE = argv.phase ?? 'p6a';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', PHASE);
const SPOT = (argv.spot ?? '').split(',').map(Number);
const LOWFX = 'lowfx' in argv;
const ONLY = argv.only ? argv.only.split(',') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
const SHOTS = [
  { vp: DESKTOP, name: 'praca_0700_sol', time: '07:00', weather: 'sol' },
  { vp: DESKTOP, name: 'praca_1200_sol', time: '12:00', weather: 'sol' },
  { vp: DESKTOP, name: 'praca_1730_sol', time: '17:30', weather: 'sol' },
  { vp: DESKTOP, name: 'praca_1930_sol', time: '19:30', weather: 'sol' },
  { vp: DESKTOP, name: 'praca_2300_sol', time: '23:00', weather: 'sol' },
  { vp: DESKTOP, name: 'praca_1500_garoa', time: '15:00', weather: 'garoa', settle: 9000 },
  { vp: DESKTOP, name: 'praca_1500_chuva', time: '15:00', weather: 'chuva', settle: 9000 },
  { vp: DESKTOP, name: 'praca_1500_nublado', time: '15:00', weather: 'nublado', settle: 9000 },
  { vp: DESKTOP, name: 'praca_2000_chuva', time: '20:00', weather: 'chuva', settle: 9000 },
  { vp: PHONE, name: 'praca_1930_sol', time: '19:30', weather: 'sol' },
];

function url() {
  const u = new URL(BASE);
  if (LOWFX) u.searchParams.set('lowfx', '1');
  return u.toString();
}

async function enter(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(url());
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `p6a+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 15_000 });
  await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 3, null, { timeout: 8000 }).catch(() => {});
  return { ctx, page };
}

async function goSpot(page) {
  const [x, y] = SPOT.length === 2 && SPOT.every(Number.isFinite)
    ? SPOT
    : await page.evaluate(() => {
        // three tiles below the padaria door: the shopfront and the lamps are in frame
        const p = window.__tb.game.roomDef.portals.find((q) => q.to === 'padaria');
        return p ? [p.x, Math.min(window.__tb.game.roomDef.rows - 2, p.y + 3)] : [6, 3];
      });
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 15_000 }).catch(() => {});
  await sleep(6500); // the first-step toast clears the HUD
}

if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const vp of [DESKTOP, PHONE]) {
    const { ctx, page } = await enter(browser, vp);
    await goSpot(page);
    for (const s of SHOTS.filter((s) => s.vp === vp && (!ONLY || ONLY.some((o) => s.name.includes(o))))) {
      await page.evaluate((s) => window.__tb.setClock({ time: s.time, weather: s.weather }), s);
      await sleep(s.settle ?? 3500);
      const file = path.join(OUT, `${vp.name}_${s.name}.png`);
      await page.screenshot({ path: file });
      const perf = await page.evaluate(() => JSON.stringify(window.__tb.perf));
      console.log('  ·', vp.name, s.name, s.time, s.weather, perf);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
