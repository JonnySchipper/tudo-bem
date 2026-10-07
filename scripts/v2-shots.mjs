#!/usr/bin/env node
/**
 * Visual pass V2 shots (outdoor composition): clean world shots of the map, the praça and each quadrant, the feira (open and closed), the west
 * block and both streets, at 12:00 and 17:30, desktop 1280x800 and phone 390x844. Runs against the solo build (no server), so the in-page world
 * is pinned with `?tbclockmin=` (the NPC schedules, the feira hours) and `__tb.setClock` (sky).
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client exec vite --port 5190 &
 *   BASE_URL=http://localhost:5190/ TAG=after node scripts/v2-shots.mjs [--only=map,feira] [--hours=12:00,17:30] [--phone | --desktop]
 *
 * Output: docs/lifesim/shots/v2/<tag>_<viewport>_<scene>_<hhmm>.png (SHOTS_DIR to override).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:5190/';
const TAG = process.env.TAG ?? 'after';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'v2');
const ONLY = opt.only ? opt.only.split(',') : null;
const HOURS = opt.hours ? opt.hours.split(',') : ['12:00', '17:30'];
const WANT_DESKTOP = !argv.includes('--phone');
const WANT_PHONE = !argv.includes('--desktop');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
// [name, tileX, tileY, desktop zoom, phone zoom (null: skip on the phone), phone [tileX, tileY] override]; the map is one scene
const SCENES = [
  ['map', 'map'],
  ['praca_centre', 25, 20.5, 3, 2],
  ['praca_nw', 15.5, 18, 3, 2],
  ['praca_ne', 35.5, 18, 3, 2],
  ['praca_sw', 15.5, 25.5, 3, 2],
  ['praca_se', 35.5, 25.5, 3, 2],
  ['feira', 43.5, 22, 3, 2, [48, 22]],
  ['west_block', 13.5, 21, 3, 2, [6, 21]],
  ['north_street_w', 14, 8.5, 3, 2],
  ['north_street_e', 38, 8.5, 3, 2],
  ['south_street_w', 14, 31.5, 3, null],
  ['south_street_e', 38, 31.5, 3, null],
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
  await finishArrival(page);
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
    const file = `${TAG}_${vp.name}_${name}_${tag(hour)}.png`;
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
