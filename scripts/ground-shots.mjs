#!/usr/bin/env node
/**
 * Ground-pass screenshots (visual pass V1): the outdoor areas and the full map at chosen hours, desktop and phone, HUD hidden.
 *
 *   PORT=8877 TB_TEST_CLOCK_CONTROL=1 node apps/server/dist/index.js       # a pinned server (after `pnpm build`)
 *   BASE_URL=http://localhost:8877 node scripts/ground-shots.mjs --out=docs/lifesim/shots/v1 [--times=12:00,17:30] [--vp=desktop|phone]
 *        [--areas=praca_fountain,north_street,south_street,west_houses,feira,map] [--prefix=after]
 *
 * Same camera presets as scripts/visual-audit.mjs, so the shots compare one to one with docs/lifesim/shots/audit/.
 * Extra areas for close-ups: `cam:<x>,<y>,<zoom>` names pass through as `--areas=close:25_14_5`.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8877';
const OUT = argv.out ?? path.join('docs', 'lifesim', 'shots', 'v1');
const PREFIX = argv.prefix ? argv.prefix + '_' : '';
const TIMES = (argv.times ?? '12:00,17:30').split(',');
const WANT = (argv.areas ?? 'map,praca_fountain,north_street,south_street,west_houses,feira').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const tag = (t) => t.replace(':', '');

async function pin(page, time, weather = 'sol') {
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(time)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: t, weather: w }), [time, weather]);
}
const cam = (page, spec) => page.evaluate((s) => window.__tb.renderer.setShot(s), spec);
async function walk(page, x, y) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 70_000 }).catch(() => {});
  await sleep(500);
}
async function clean(page, on) {
  await page.evaluate(([on]) => {
    let s = document.getElementById('gs-hide');
    if (on && !s) { s = document.createElement('style'); s.id = 'gs-hide'; s.textContent = '#ui{visibility:hidden !important}'; document.head.append(s); }
    if (!on && s) s.remove();
  }, [on]);
}
async function snap(page, vp, name) {
  await clean(page, true);
  const file = path.join(OUT, `${PREFIX}${vp.name}_${name}.png`);
  fs.writeFileSync(file, await page.screenshot());
  await clean(page, false);
  console.log('  ·', path.basename(file));
}

const PW = 'pao-de-queijo-2026';
async function boot(page, vp) {
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
  await page.fill('#intro-email', `ground+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PW);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(2000);
}

const AREAS = {
  north_street: { cam: [22, 8.4, 3], phoneCam: [18, 13, 2], at: [16, 7], phone: true },
  praca_fountain: { cam: [25, 20, 3], phoneCam: [25, 20, 2], at: [25, 16], phone: true },
  west_houses: { cam: [13, 20, 3], at: [9, 17] },
  south_street: { cam: [25, 31.5, 3], at: [25, 30] },
  feira: { cam: [43, 22, 3], at: [45, 19], slow: true },
};

async function run(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await boot(page, vp);
  await pin(page, '12:00');
  if (WANT.includes('map')) {
    await cam(page, 'map');
    for (const t of TIMES) { await pin(page, t); await sleep(2500); await snap(page, vp, `map_${tag(t)}`); }
  }
  for (const want of WANT) {
    const close = want.startsWith('close:') ? want.slice(6).split('_') : null;
    const a = close ? { cam: close.map(Number), at: [Math.round(Number(close[0])), Math.round(Number(close[1]))], phoneCam: close.map(Number), phone: true } : AREAS[want];
    if (!a || (vp.touch && !a.phone)) continue;
    await pin(page, '12:00');
    await cam(page, null);
    await walk(page, a.at[0], a.at[1]);
    const c = vp.touch ? a.phoneCam ?? a.cam : a.cam;
    await cam(page, `cam:${c[0]},${c[1]},${c[2]}`);
    for (const t of TIMES) {
      await pin(page, t);
      await sleep(a.slow ? 8000 : 2500);
      await snap(page, vp, `${close ? 'close_' + close.join('_') : want}_${tag(t)}`);
    }
  }
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const vps = argv.vp === 'phone' ? [PHONE] : argv.vp === 'desktop' ? [DESKTOP] : [DESKTOP, PHONE];
  for (const vp of vps) { console.log(`== ${vp.name}`); await run(browser, vp); }
} finally {
  await browser.close();
}
