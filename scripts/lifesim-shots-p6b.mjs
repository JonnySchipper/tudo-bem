#!/usr/bin/env node
/**
 * Phase 6b review shots (ambient life): the street with traffic by day and at night, the bus at the stop, the vira-lata awake and asleep,
 * the fountain with the pigeons calm and scattering, and (with --intro) the title screen on desktop and phone.
 *
 *   pnpm build && PORT=8801 TB_TEST_ROLL=1 pnpm start
 *   BASE_URL=http://localhost:8801 node scripts/lifesim-shots-p6b.mjs [--only=bus,dog] [--intro] [--perf]
 *
 * The time, weather and the bus are driven through `window.__tb.setClock` / `window.__tb.ambient` (the production build ignores ?time=).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8801';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'p6b');
const ONLY = argv.only ? argv.only.split(',') : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };

/** Walk to (x, y) or the nearest free tile around it (props block some tiles): a candidate that does not start a move is skipped. */
async function walk(page, x, y, wait = 20_000) {
  const cands = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [2, 0], [-2, 0]].map(([dx, dy]) => [x + dx, y + dy]);
  for (const [cx, cy] of cands) {
    const cur = await page.evaluate(() => window.__tb.selfTile());
    if (cur && cur.tile.x === cx && cur.tile.y === cy && !cur.moving) return [cx, cy];
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [cx, cy]);
    await sleep(500);
    const moving = await page.evaluate(() => window.__tb.selfTile()?.moving);
    if (!moving) continue;
    await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [cx, cy], { timeout: wait }).catch(() => {});
    return [cx, cy];
  }
  return null;
}

async function enter(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `p6b+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 15_000 });
  // the shared headless box is busy: keep the full effects for the review shots (the low-fx fallback itself is covered by --perf --throttle)
  if (!('keeplowfx' in argv)) await page.evaluate(() => setInterval(() => { try { window.__tb.renderer.scene.fxLevel.lowfx = false; } catch {} }, 250));
  await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 3, null, { timeout: 8000 }).catch(() => {});
  return { ctx, page };
}

const shot = async (page, name, vp = DESKTOP) => {
  const file = path.join(OUT, `${vp.name}_${name}.png`);
  await page.screenshot({ path: file });
  const amb = await page.evaluate(() => JSON.stringify(window.__tb.ambient?.info?.()));
  console.log('  ·', vp.name, name, amb);
};

const SCENES = [
  { name: 'street_day', time: '12:00', at: [28, 13], wait: 9000 },
  { name: 'street_night', time: '21:00', at: [28, 13], wait: 9000 },
  { name: 'bus_stop', time: '17:30', at: [33, 13], bus: true, wait: 1500 },
  { name: 'dog_awake', time: '09:00', at: [8, 27], wait: 16000 },
  { name: 'dog_asleep', time: '23:00', at: [8, 27], wait: 35000 },
  { name: 'fountain_pigeons', time: '16:00', at: [25, 27], wait: 3000 },
  { name: 'fountain_scatter', time: '16:00', at: [22, 24], wait: 700, prep: true },
  { name: 'street_jacaranda', time: '10:00', at: [26, 31], wait: 9000 },
  { name: 'ipes_butterflies', time: '11:00', at: [15, 18], wait: 3000 },
  { name: 'fireflies_night', time: '21:30', at: [15, 22], wait: 5000 },
];

if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
async function introShots(vp, dpr) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: dpr, isMobile: !!vp.touch, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, vp.name + "_title_enter.png") });
  await page.click('#intro-enter');
  await page.waitForSelector('.intro-phase-auth', { timeout: 20_000 });
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, vp.name + "_title_auth.png") });
  console.log('  ·', vp.name, 'title');
  await ctx.close();
}

try {
  if ('intro' in argv) {
    await introShots(DESKTOP, 1);
    await introShots(PHONE, 2);
    process.exit(0);
  }
  const { ctx, page } = await enter(browser, DESKTOP);
  await walk(page, 27, 25);
  await sleep(1200);
  await page.evaluate(() => { const c = document.querySelector('#checklist'); if (c && !c.classList.contains('collapsed')) c.querySelector('h3')?.click(); });
  await sleep(6500);
  {
    for (const s of SCENES.filter((s) => !ONLY || ONLY.some((o) => s.name.includes(o)))) {
      await page.evaluate((s) => window.__tb.setClock({ time: s.time, weather: 'sol' }), s);
      if (s.prep) await walk(page, 25, 27);
      await sleep(s.prep ? 4000 : 500);
      if (s.prep) {
        // walk at the pigeons and shoot a moment after they take off
        await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), s.at);
        await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && Math.hypot(t.tile.x - x, t.tile.y - y) < 2.6; }, s.at, { timeout: 15_000 }).catch(() => {});
        await sleep(s.wait);
        await shot(page, s.name);
        continue;
      }
      await walk(page, s.at[0], s.at[1]);
      if (s.bus) await page.evaluate(() => window.__tb.ambient.bus(-900));
      await sleep(s.wait);
      await shot(page, s.name);
    }
    if ('perf' in argv) {
      await walk(page, 26, 13);
      for (const s of [{ time: '19:30', weather: 'chuva' }, { time: '12:00', weather: 'sol' }]) {
        await page.evaluate((s) => window.__tb.setClock(s), s);
        await page.evaluate(() => window.__tb.ambient.bus(-900));
        await sleep(9000);
        console.log('  perf', s.time, s.weather, await page.evaluate(() => JSON.stringify(window.__tb.perf)));
      }
    }
  }
  await ctx.close();
} finally {
  await browser.close();
}
