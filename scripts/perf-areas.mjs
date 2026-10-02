#!/usr/bin/env node
/**
 * Per-area perf probe (split into areas): the busy outdoor scenes at 17:30 and 19:30 chuva, desktop + phone, reading __tb.perf at ~4.6 s.
 *   BASE_URL=http://localhost:9850 node scripts/perf-areas.mjs [--scenes="praca@28,12;feira@16,10"] [--vp=desktop|phone]
 * Needs a server with TB_TEST_CLOCK_CONTROL=1. Scene syntax: roomId@tileX,tileY (the camera is pinned there at zoom 3; the room is entered with a join).
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:9850';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
const SCENES = (argv.scenes ?? 'praca@28,12').split(';').map((s) => { const [room, at] = s.split('@'); const [x, y] = at.split(',').map(Number); return { room, x, y }; });
const TIMES = (argv.times ?? '17:30,19:30').split(',');
const VPS = argv.vp === 'phone' ? ['phone'] : argv.vp === 'desktop' ? ['desktop'] : ['desktop', 'phone'];
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const name of VPS) {
  const vp = name === 'phone' ? { width: 390, height: 844, touch: true } : { width: 1280, height: 800 };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `perfa+${name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Perf');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praca');
  for (const sc of SCENES) {
    if ((await page.evaluate(() => window.__tb.game.room?.room)) !== sc.room) {
      await page.evaluate((room) => window.__tb.net.send({ t: 'join', room }), sc.room);
      await waitFor(page, (id) => window.__tb.game.room?.room === id, sc.room, 20_000, sc.room);
      await sleep(1500);
    }
    for (const time of TIMES) {
      await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(time)}`, { method: 'POST' });
      await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'chuva' }), time);
      await page.evaluate(([x, y]) => window.__tb.renderer.setShot(`cam:${x},${y},3`), [sc.x, sc.y]);
      if (time === '19:30') await page.evaluate(() => window.__tb.ambient?.bus?.(-900));
      await sleep(4600);
      const p = await page.evaluate(() => ({ ...window.__tb.perf, labels: document.querySelectorAll('#world-labels > *').length }));
      console.log(`${name.padEnd(7)} ${sc.room.padEnd(7)} ${time} chuva | fps ${p.fps} avg ${p.avgMs} p90 ${p.p90Ms} max ${p.maxMs} | objects ${p.objects} textures ${p.textures} particles ${p.particles} labels ${p.labels} | ambient ${JSON.stringify(p.ambient)}`);
    }
  }
  await ctx.close();
}
await browser.close();
