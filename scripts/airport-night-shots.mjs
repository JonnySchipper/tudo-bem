#!/usr/bin/env node
/**
 * Airport night lights shots (issue #168): the aeroporto as a player sees it (live camera, HUD on) at noon, dusk and night, at 1280x800 and a
 * 390x844 phone, so the before and after of the terminal's interior lights can be compared side by side.
 *
 *   pnpm build
 *   PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8810 node scripts/airport-night-shots.mjs --phase=after [--vp=390x844]
 *
 * Output: docs/lifesim/shots/airport-night-lights/<phase>_<viewport>_<noon|dusk|night>.png (SHOTS_DIR to override).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'airport-night-lights');
const PHASE = argv.phase ?? 'after';
const TIMES = [
  { name: 'noon', time: '12:00' },
  { name: 'dusk', time: '18:30' },
  { name: 'night', time: '21:00' },
];
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true },
].filter((v) => !argv.vp || argv.vp.split(',').includes(v.name));
// the gate lounge, between the departures board and passport control
const STAND = [15, 14];
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  // pin the sky before the world's first frame, which snaps the weather blend (later pins ease in over a long while)
  await page.evaluate(() => window.__tb.setClock({ time: '12:00', weather: 'sol' }));
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `aeronoite+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Foto');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  // the arrival tutorial is skipped (its own shots are #167's), then back to the airport as a returning player
  await finishArrival(page);
  await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'aeroporto' }));
  await waitFor(page, () => window.__tb.game.room?.room === 'aeroporto', null, 20_000, 'aeroporto');
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), STAND);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, STAND, { timeout: 30_000 }).catch(() => console.log(`  (walk to ${STAND} did not finish)`));
  await page.evaluate(() => window.__tb.renderer.setShot(null));
  for (const t of TIMES) {
    const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(t.time)}`, { method: 'POST' });
    assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
    await page.evaluate((time) => window.__tb.setClock({ time, weather: 'sol' }), t.time);
    // the lights ease on over a few game minutes and the weather smooths: let a few frames settle
    await sleep(3000);
    const file = `${PHASE}_${vp.name}_${t.name}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    console.log('  ·', file);
  }
  await ctx.close();
}
await browser.close();
