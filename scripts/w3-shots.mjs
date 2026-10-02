#!/usr/bin/env node
/**
 * Wave 3 street shots (before / after): Rua dos Ipês (north street) and Rua Jacarandá (south street) west and east halves, the bus stop and the whole map,
 * at 12:00 and 21:00, desktop 1280x800, against the solo build (no server).
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client exec vite --port 9140 &
 *   BASE_URL=http://localhost:9140/ TAG=after node scripts/w3-shots.mjs
 *
 * Output: docs/lifesim/shots/w3/<tag>_<scene>_<hhmm>.png
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:5190/';
const TAG = process.env.TAG ?? 'after';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'w3');
const ONLY = opt.only ? opt.only.split(',') : null;
const HOURS = opt.hours ? opt.hours.split(',') : ['12:00', '21:00'];
const WANT_DESKTOP = !argv.includes('--phone');
const WANT_PHONE = false;
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
// [name, tileX, tileY, desktop zoom, phone zoom (null: skip on the phone), phone [tileX, tileY] override]; the map is one scene
const SCENES = [
  ['map', 'map'],
  ['north_street_w', 14, 10, 3, null],
  ['north_street_e', 38, 10, 3, null],
  ['bus_stop', 36.5, 11, 4, null],
  ['south_street_w', 14, 33, 3, null],
  ['south_street_e', 38, 33, 3, null],
];
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const tag = (t) => t.replace(':', '');

async function run(browser, vp, hour) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  // start a few game minutes early so the schedules sit in the right slot for the whole run (1 game minute = 2 s)
  const url = `${BASE}${BASE.includes('?') ? '&' : '?'}notype=1&tbclockmin=${offsetMinFor(Math.max(0, hm(hour) - 6))}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('#intro-enter', { timeout: 90_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 30_000, 'praça');
  await sleep(2500);
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), hour);
  await page.addStyleTag({ content: '#ui{visibility:hidden !important}' });
  for (const s of SCENES) {
    const [name] = s;
    if (ONLY && !ONLY.includes(name)) continue;
    let spec;
    if (s[1] === 'map') spec = 'map';
    else {
      const z = vp.touch ? s[4] : s[3];
      if (!z) continue;
      const [cx, cy] = vp.touch && s[5] ? s[5] : [s[1], s[2]];
      spec = `cam:${cx},${cy},${z}`;
    }
    await page.evaluate((c) => window.__tb.renderer.setShot(c), spec);
    await sleep(1800);
    const file = `${TAG}_${name}_${tag(hour)}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    console.log('  ·', file);
  }
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const hour of HOURS) {
    if (WANT_DESKTOP) await run(browser, DESKTOP, hour);
    if (WANT_PHONE) await run(browser, PHONE, hour);
  }
} finally {
  await browser.close();
}
