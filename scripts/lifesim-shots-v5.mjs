#!/usr/bin/env node
/**
 * V5 (lighting) before/after shots: the praça fountain and the north street at the key hours, desktop and phone, plus `__tb.perf`.
 *
 *   pnpm build && PORT=8855 TB_TEST_CLOCK_CONTROL=1 node apps/server/dist/index.js
 *   BASE_URL=http://localhost:8855 TAG=after node scripts/lifesim-shots-v5.mjs [--vp=desktop|phone] [--area=praca,north] [--times=0700,1730,1500chuva] [--perf] [--wait=3500]
 *
 * Output: docs/lifesim/shots/v5/<TAG>_<viewport>_<area>_<time>[_<weather>].png (override the folder with SHOTS_DIR).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8855';
const TAG = process.env.TAG ?? 'after';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'v5');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const VPS = [
  { key: 'desktop', name: '1280x800', width: 1280, height: 800 },
  { key: 'phone', name: '390x844', width: 390, height: 844, touch: true },
].filter((v) => !argv.vp || argv.vp.split(',').includes(v.key));
const AREAS = [
  { key: 'praca', name: 'praca_fountain', cam: [25, 20, 3], phoneCam: [25, 20, 2], at: [25, 16] },
  { key: 'north', name: 'north_street', cam: [22, 8.4, 3], phoneCam: [18, 13, 2], at: [16, 7] },
  { key: 'feira', name: 'feira', cam: [43, 22, 3], phoneCam: [43, 22, 2], at: [45, 19] },
  { key: 'south', name: 'south_street', cam: [25, 31.5, 3], phoneCam: [25, 31.5, 2], at: [25, 30] },
  { key: 'west', name: 'west_houses', cam: [13, 20, 3], phoneCam: [13, 20, 2], at: [9, 17] },
].filter((a) => !argv.area || argv.area.split(',').includes(a.key));
const SCENES = [['0700', 'sol'], ['1200', 'sol'], ['1730', 'sol'], ['1930', 'sol'], ['2300', 'sol'], ['1500', 'chuva'], ['2100', 'chuva'], ['1500', 'nublado'], ['0530', 'sol'], ['1830', 'sol'], ['1500', 'garoa'], ['1530', 'sol'], ['1000', 'sol'], ['1600', 'sol']]
  .filter(([t, w]) => !argv.times || argv.times.split(',').includes(w === 'sol' ? t : t + w));
const DEFAULT = new Set(['0700-sol', '1200-sol', '1730-sol', '1930-sol', '2300-sol', '1500-chuva', '2100-chuva']);
const WAIT = Number(argv.wait ?? 3500);

const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4));
async function pin(page, t, w) {
  await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(t)}`, { method: 'POST' });
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: `${t.slice(0, 2)}:${t.slice(2)}`, weather: w }), [t, w]);
}
async function walk(page, x, y) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 70_000 }).catch(() => console.log(`  (walk ${x},${y} unfinished)`));
  await sleep(600);
}
const PW = 'pao-de-queijo-2026';
async function boot(page, vp) {
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `v5+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PW);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praça');
  await sleep(2500);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const perf = [];
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console.error', m.text()); });
  await boot(page, vp);
  await page.addStyleTag({ content: '#ui{visibility:hidden !important}' });
  for (const a of AREAS) {
    await pin(page, '1200', 'sol');
    await page.evaluate(() => window.__tb.renderer.setShot(null));
    await walk(page, a.at[0], a.at[1]);
    const c = vp.touch ? a.phoneCam : a.cam;
    await page.evaluate((s) => window.__tb.renderer.setShot(s), `cam:${c[0]},${c[1]},${c[2]}`);
    for (const [t, w] of SCENES) {
      if (!argv.times && !DEFAULT.has(`${t}-${w}`)) continue;
      await pin(page, t, w);
      await sleep(WAIT);
      const file = `${TAG}_${vp.name}_${a.name}_${t}${w === 'sol' ? '' : '_' + w}.png`;
      fs.writeFileSync(path.join(OUT, file), await page.screenshot());
      console.log('  ·', file);
      if (argv.eval) console.log('    eval', JSON.stringify(await page.evaluate((e) => new Function('return (' + e + ')')(), argv.eval)));
      if (argv.perf) {
        await sleep(5200);
        const p = await page.evaluate(() => window.__tb.perf);
        perf.push(`${vp.name} ${a.name} ${t} ${w}: fps ${p.fps} avg ${p.avgMs} p90 ${p.p90Ms} max ${p.maxMs} ms, particles ${p.particles}, lowfx ${p.lowfx}`);
        console.log('    perf', perf.at(-1));
      }
    }
  }
  await ctx.close();
}
await browser.close();
if (perf.length) fs.writeFileSync(path.join(OUT, `${TAG}_perf.txt`), perf.join('\n') + '\n');
