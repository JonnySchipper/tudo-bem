#!/usr/bin/env node
/**
 * Zoom 3 before/after shots (docs/lifesim/DECISIONS.md "Zoom 3"): praça centre 17:30, north street 12:00 and the padaria interior at 1280x800 and
 * 1920x1080, the new rule's natural camera and the old zoom (fixed `cam:` shot on the same centre). Also checks hit-testing at the new zoom.
 *
 *   pnpm build && PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8810 node scripts/zoom3-shots.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = path.join('docs', 'lifesim', 'shots', 'zoom3');
fs.mkdirSync(OUT, { recursive: true });
const VPS = [{ w: 1280, h: 800, oldZ: 4 }, { w: 1920, h: 1080, oldZ: 5 }];
const hm = (t) => t.slice(0, 2) * 60 + Number(t.slice(3, 5));
const pin = async (page, t) => {
  assert((await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(t)}`, { method: 'POST' })).ok, 'clock control');
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), t);
};
const waitRoom = (page, id) => waitFor(page, (id) => window.__tb.game.room?.room === id, id, 20_000, `room ${id}`);
const cam = (page, s) => page.evaluate((s) => window.__tb.renderer.setShot(s), s);
const info = (page) => page.evaluate(() => window.__tb.renderer.info());
async function walk(page, x, y) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 70_000 }).catch(() => console.log('  (walk unfinished)'));
  await sleep(700);
}
const shot = async (page, name) => { fs.writeFileSync(path.join(OUT, name), await page.screenshot()); console.log('  ·', name); };

async function hitTest(page, vp, label) {
  const i = await info(page);
  const bad = [];
  for (const [dx, dy] of [[0, 0], [2, 1], [-3, 2], [4, -2]]) {
    const wx = (Math.floor(i.cx / 16) + dx + 0.5) * 16, wy = (Math.floor(i.cy / 16) + dy + 0.5) * 16;
    const px = vp.w / 2 + (wx - i.cx) * i.cssScale, py = vp.h / 2 + (wy - i.cy) * i.cssScale;
    await page.mouse.move(px, py);
    await sleep(250);
    const h = await page.evaluate(() => window.__tb.game.hoverTile);
    const want = { x: Math.floor(i.cx / 16) + dx, y: Math.floor(i.cy / 16) + dy };
    if (!h || h.x !== want.x || h.y !== want.y) bad.push({ want, got: h });
  }
  console.log(`  hit-test ${label} z${i.zoom}: ${bad.length ? 'MISMATCH ' + JSON.stringify(bad) : 'ok'}`);
}

const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await sleep(2500);
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await sleep(2500);
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `z3+${vp.w}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitRoom(page, 'praca');
  await sleep(2500);

  const outdoor = [
    { name: 'praca', at: [25, 16], c: [25, 20], t: '17:30' },
    { name: 'street', at: [16, 7], c: [22, 8.4], t: '12:00' },
  ];
  for (const s of outdoor) {
    await pin(page, s.t);
    await cam(page, null);
    await walk(page, s.at[0], s.at[1]);
    await sleep(3500);
    const z = (await info(page)).zoom;
    await shot(page, `${s.name}_natural_${vp.w}x${vp.h}_z${z}.png`);
    await hitTest(page, vp, s.name);
    await cam(page, `cam:${s.c[0]},${s.c[1]},${z}`);
    await sleep(1500);
    await shot(page, `${s.name}_${vp.w}x${vp.h}_z${z}.png`);
    await cam(page, `cam:${s.c[0]},${s.c[1]},${vp.oldZ}`);
    await sleep(1500);
    await shot(page, `${s.name}_${vp.w}x${vp.h}_z${vp.oldZ}.png`);
    await cam(page, null);
  }
  // padaria interior (natural camera at the new rule; old zoom = same centre, fixed)
  await pin(page, '12:00');
  await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
  await waitRoom(page, 'padaria');
  await sleep(4000);
  const pi = await info(page);
  await shot(page, `padaria_${vp.w}x${vp.h}_z${pi.zoom}.png`);
  await hitTest(page, vp, 'padaria');
  await cam(page, `cam:${pi.cx / 16},${pi.cy / 16},${vp.oldZ}`);
  await sleep(1500);
  await shot(page, `padaria_${vp.w}x${vp.h}_z${vp.oldZ}.png`);
  await cam(page, null);
  await ctx.close();
}
await browser.close();
