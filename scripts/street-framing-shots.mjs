#!/usr/bin/env node
/**
 * Street framing shots (issue #123): the open-air areas as a player sees them (live camera following the avatar, HUD on) at 1280x800,
 * 1920x1080 and a 390x844 phone, so the "before" and "after" of the outdoor framing rule can be compared side by side.
 *
 *   pnpm build
 *   PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8810 node scripts/street-framing-shots.mjs --phase=after [--only=rua,rua_leste] [--time=12:00] [--vp=1920x1080]
 *
 * Output: docs/lifesim/shots/street-framing/<phase>_<viewport>_<area>.png (SHOTS_DIR to override).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'street-framing');
const PHASE = argv.phase ?? 'after';
const TIME = argv.time ?? '12:00';
const ONLY = argv.only ? argv.only.split(',') : ['rua', 'rua_leste', 'praca', 'feira', 'aeroporto'];
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '390x844', width: 390, height: 844, touch: true },
].filter((v) => !argv.vp || argv.vp.split(',').includes(v.name));
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// where the player stands, per area: somewhere a player actually walks (the north sidewalk of the street, the middle of the praça)
const STAND = { rua: [12, 9], rua_leste: [8, 7], praca: [16, 16], feira: [4, 8], aeroporto: [15, 15] };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `framing+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Foto');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  // a new player may land at the airport (the arrival) or straight in the praça: any room will do
  await waitFor(page, () => !!window.__tb.game.room?.room, null, 20_000, 'a room').catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, `debug_${vp.name}.png`) });
    throw e;
  });
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(TIME)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), TIME);
  await sleep(3000);
  for (const area of ONLY) {
    try {
      if ((await page.evaluate(() => window.__tb.game.room?.room)) !== area) {
        await page.evaluate((room) => window.__tb.net.send({ t: 'join', room }), area);
        await waitFor(page, (id) => window.__tb.game.room?.room === id, area, 20_000, area);
      }
      const [sx, sy] = STAND[area];
      await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [sx, sy]);
      await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [sx, sy], { timeout: 30_000 }).catch(() => console.log(`  (walk to ${sx},${sy} did not finish)`));
      await page.evaluate(() => window.__tb.renderer.setShot(null));
      await sleep(2500);
      const file = `${PHASE}_${vp.name}_${area}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      console.log('  ·', file);
    } catch (e) {
      console.log(`  ! ${vp.name} ${area}: ${String(e).split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
