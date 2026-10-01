#!/usr/bin/env node
/**
 * Art track 4 review shots (map, south row, west block, lamps, rain, Professora Bia, fountain), clean (no DOM overlays), 2560x1600
 * (1280x800 CSS at a device scale factor of 2). The camera is placed through `?shot=cam:<tileX>,<tileY>,<zoom>`-style
 * `__tb.renderer.setShot`; the clock and weather through `__tb.setClock`.
 *
 *   pnpm build && PORT=8804 TB_TEST_ROLL=1 pnpm start
 *   BASE_URL=http://localhost:8804 TAG=before node scripts/lifesim-shots-art4.mjs [--only=map,south]
 *
 * Output: docs/lifesim/shots/art4/<TAG>_<name>.png
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8804';
const TAG = process.env.TAG ?? 'after';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'art4');
const ONLY = argv.only ? argv.only.split(',') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VW = 1280;
const VH = 800;
const T = 16;

/** scenes: cam = [tileX, tileY, zoom in device px], clip = [x0, y0, x1, y1] in tiles (cropped out of the frame) */
const SCENES = [
  { name: 'map', time: '17:30', weather: 'sol', shot: 'map' },
  { name: 'south_west', time: '12:00', cam: [16, 33, 4], clip: [0, 29, 32, 40] },
  { name: 'south_east', time: '12:00', cam: [40, 33, 4], clip: [24, 29, 56, 40] },
  { name: 'west_block', time: '12:00', cam: [9, 21, 6], clip: [0, 12, 18, 31] },
  { name: 'top_edificio', time: '12:00', cam: [28, 4, 4], clip: [14, -3, 44, 9] },
  { name: 'lamps_1930', time: '19:30', weather: 'sol', cam: [28, 10, 4] },
  { name: 'lamps_2300', time: '23:00', weather: 'sol', cam: [28, 10, 4] },
  { name: 'praca_1930', time: '19:30', weather: 'sol', cam: [25, 22, 4] },
  { name: 'rain_1500', time: '15:00', weather: 'chuva', cam: [28, 10, 4], wait: 6000 },
  { name: 'fountain', time: '15:00', weather: 'sol', cam: [25, 21, 8], frames: 3 },
  { name: 'academia_bia', time: '12:00', weather: 'sol', room: 'academia', cam: [8, 5, 12] },
];

async function enter(browser) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `art4+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 15_000 });
  await page.evaluate(() => setInterval(() => { try { window.__tb.renderer.scene.fxLevel.lowfx = false; } catch {} }, 250));
  await sleep(3000);
  return page;
}

async function hideDom(page) {
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    document.querySelectorAll('body *').forEach((el) => { if (el !== c && !el.contains(c)) el.style.visibility = 'hidden'; });
  });
}

async function snap(page, sc, suffix = '') {
  const file = path.join(OUT, `${TAG}_${sc.name}${suffix}.png`);
  let clip;
  if (sc.clip && sc.cam) {
    const [cx, cy, z] = sc.cam;
    const k = z / 2; // css px per art px (device scale factor 2)
    const cl = (tx, ty) => [VW / 2 + (tx - cx) * T * k, VH / 2 + (ty - cy) * T * k];
    const [x0, y0] = cl(sc.clip[0], sc.clip[1]);
    const [x1, y1] = cl(sc.clip[2], sc.clip[3]);
    const X0 = Math.max(0, x0), Y0 = Math.max(0, y0);
    clip = { x: X0, y: Y0, width: Math.min(VW, x1) - X0, height: Math.min(VH, y1) - Y0 };
  }
  await page.screenshot({ path: file, clip });
  console.log('  ·', path.basename(file));
}

if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const page = await enter(browser);
  await hideDom(page);
  for (const sc of SCENES.filter((s) => !ONLY || ONLY.some((o) => s.name.includes(o)))) {
    if (sc.room === 'academia') {
      await page.evaluate(() => window.__tb.interact({ portal: 'praca_academia' }));
      await page.waitForFunction(() => window.__tb.game.room?.room === 'academia', null, { timeout: 30_000 });
      await sleep(1500);
    } else if ((await page.evaluate(() => window.__tb.game.room?.room)) !== 'praca') {
      await page.evaluate(() => window.__tb.interact({ portal: 'academia_praca' }));
      await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 30_000 });
      await sleep(1500);
    }
    await page.evaluate((s) => { window.__tb.setClock({ time: s.time, weather: s.weather ?? 'sol' }); window.__tb.renderer.setShot(s.shot ?? `cam:${s.cam.join(',')}`); }, sc);
    await sleep(sc.wait ?? 3500);
    await snap(page, sc);
    for (let i = 1; i < (sc.frames ?? 1); i++) {
      await sleep(260);
      await snap(page, sc, `_f${i + 1}`);
    }
  }
} finally {
  await browser.close();
}
