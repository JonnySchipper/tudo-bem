#!/usr/bin/env node
/**
 * Visual pass V3 (buildings) shots: the north row, the south row, the west house and the three interiors, desktop + phone.
 *
 *   pnpm build && PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8810 SHOTS_DIR=docs/lifesim/shots/v3/after node scripts/v3-shots.mjs [--only=north,south,west,interiors] [--vp=desktop|phone] [--tag=name]
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'v3', 'after');
const ONLY = argv.only ? argv.only.split(',') : ['north', 'south', 'west', 'interiors'];
const CHROME = findChrome();
assert(CHROME, 'Chrome not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };

const hm = (t) => t.slice(0, 2) * 60 + Number(t.slice(3, 5));
const tag = (t) => t.replace(':', '');
async function pin(page, time, weather = 'sol') {
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(time)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: t, weather: w }), [time, weather]);
}
const cam = (page, spec) => page.evaluate((s) => window.__tb.renderer.setShot(s), spec);
const waitRoom = (page, id) => waitFor(page, (id) => window.__tb.game.room?.room === id, id, 20_000, `room ${id}`);
const interact = async (page, t) => assert(await page.evaluate((t) => window.__tb.interact(t), t), `interact ${JSON.stringify(t)}`);
async function walk(page, x, y) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 70_000 }).catch(() => {});
  await sleep(500);
}
async function snap(page, vp, name) {
  await page.evaluate(() => { let s = document.getElementById('v3-hide'); if (!s) { s = document.createElement('style'); s.id = 'v3-hide'; s.textContent = '#ui{visibility:hidden !important}'; document.head.append(s); } });
  let buf;
  for (let i = 0; i < 5; i++) {
    buf = await page.screenshot();
    const st = (await sharp(buf).greyscale().stats()).channels[0];
    if (st.mean > 6 && st.stdev > 5) break;
    await sleep(1500);
  }
  await page.evaluate(() => document.getElementById('v3-hide')?.remove());
  const file = `${vp.name}_${name}.png`;
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log('  .', file);
}
async function boot(page) {
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await sleep(2500);
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await sleep(1500);
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await sleep(800);
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `v3+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await sleep(500);
  await page.click('#enter-praca');
  await waitRoom(page, 'praca');
  await sleep(2000);
}

const AREAS = {
  north: [
    { n: 'north_west', c: [9, 6.2, 3], pc: [8, 5, 2], at: [8, 7], times: ['12:00', '21:00'] },
    { n: 'north_mid', c: [27, 6.2, 3], pc: [27, 5, 2], at: [26, 7], times: ['12:00'] },
    { n: 'north_east', c: [47, 6.2, 3], pc: [47, 5, 2], at: [46, 7], times: ['12:00', '21:00'] },
  ],
  south: [
    { n: 'south_west', c: [14, 35, 3], pc: [13, 34, 2], at: [12, 33], times: ['12:00', '21:00'] },
    { n: 'south_east', c: [40, 35, 3], pc: [41, 34, 2], at: [40, 33], times: ['12:00', '21:00'] },
  ],
  west: [{ n: 'west_house', c: [8, 17, 3], pc: [7, 17, 2], at: [9, 17], times: ['12:00', '21:00'] }],
};

async function outdoor(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await boot(page);
  for (const group of ONLY.filter((o) => AREAS[o])) {
    for (const a of AREAS[group]) {
      await pin(page, '12:00');
      await cam(page, null);
      await walk(page, a.at[0], a.at[1]);
      const c = vp.touch ? a.pc : a.c;
      await cam(page, `cam:${c[0]},${c[1]},${c[2]}`);
      for (const t of vp.touch ? ['12:00'] : a.times) {
        await pin(page, t);
        await sleep(2500);
        await snap(page, vp, `${a.n}_${tag(t)}`);
      }
    }
  }
  if (ONLY.includes('interiors')) {
    await pin(page, '12:00');
    await cam(page, null);
    const rooms = [['praca_padaria', 'padaria', 'padaria_praca'], ['praca_academia', 'academia', 'academia_praca'], ...(vp.touch ? [] : [['praca_kitnet', 'kitnet', 'kitnet_praca']])];
    for (const [portal, id, back] of rooms) {
      await walk(page, 25, 27);
      await interact(page, { portal });
      await waitRoom(page, id);
      for (const t of ['12:00', '21:00']) {
        await pin(page, t);
        await sleep(vp.touch ? 4000 : 5000);
        await snap(page, vp, `${id}_${tag(t)}`);
      }
      await interact(page, { portal: back });
      await waitRoom(page, 'praca');
      await sleep(1200);
    }
  }
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const vps = argv.vp ? [argv.vp === 'phone' ? PHONE : DESKTOP] : [DESKTOP, PHONE];
  for (const vp of vps) { console.log('==', vp.name); await outdoor(browser, vp); }
} finally {
  await browser.close();
}
