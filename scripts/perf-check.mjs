#!/usr/bin/env node
/**
 * Perf sanity (Phase 10): the busiest outdoor scenes at 1280x800 and 390x844, reading `window.__tb.perf` (the 5 s frame-time probe).
 *
 *   pnpm build && TB_TEST_CLOCK_CONTROL=1 pnpm start       # then
 *   node scripts/perf-check.mjs                            # BASE_URL, CHROME_PATH; --lowfx runs with the low-fx flag
 *
 * Scenes: (1) 19:30 chuva on the street with traffic, bus, headlights and the CPU crowd; (2) 12:30 chuva in front of the feira with shoppers.
 * The probe is read at 4.5 s (before the low-fx governor can trip at the end of its first 5 s window) and again at 11 s, so the first number is the
 * full-effects cost and the second says whether the governor stepped in. Headless Chrome on software GL (SwiftShader) is slower than a phone or a laptop GPU.
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { requirePinnedClock } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const LOWFX = process.argv.includes('--lowfx');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
await requirePinnedClock(BASE, { label: 'daytime, about 08:30' });
const VIEWS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true },
];
const SCENES = [
  { name: '19:30 chuva, street, traffic + bus', time: '19:30', at: [25, 12], bus: true },
  { name: '12:30 chuva, feira open, shoppers', time: '12:30', at: [45, 19], bus: false },
];
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, hasTouch: !!v.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1${LOWFX ? '&lowfx=1' : ''}`);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `perf+${v.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Perf');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 15_000, 'praça');
  for (const s of SCENES) {
    await page.evaluate((s) => window.__tb.setClock({ time: s.time, weather: 'chuva' }), s);
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), s.at);
    await waitFor(page, ([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, s.at, 60_000, 'arrive');
    if (s.bus) await page.evaluate(() => window.__tb.ambient?.bus(-900));
    // a fresh probe window: wait the full window out, then read
    await sleep(4500);
    const p1 = await page.evaluate(() => window.__tb.perf);
    await sleep(6500);
    const p2 = await page.evaluate(() => window.__tb.perf);
    const f = (p) => `fps ${p.fps} avg ${p.avgMs} p50 ${p.p50Ms} p90 ${p.p90Ms} max ${p.maxMs} ms, particles ${p.particles}, lowfx ${p.lowfx}${p.lowfxReason ? ` (${p.lowfxReason})` : ''}`;
    console.log(`${v.name} · ${s.name}\n   at 4.5 s: ${f(p1)}\n   at 11 s:  ${f(p2)}`);
  }
  await ctx.close();
}
await browser.close();
