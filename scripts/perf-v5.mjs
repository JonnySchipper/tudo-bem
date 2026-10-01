#!/usr/bin/env node
/**
 * V5 perf bisect: the same busy scene (21:00 chuva, north street, desktop by default) with each V5 lighting layer switched off in turn
 * (`?v5off=<layer>`, see render/pixel/v5flags.ts), reading __tb.perf at about 4.7 s so the low-fx governor has not tripped yet.
 *   BASE_URL=http://localhost:8855 node scripts/perf-v5.mjs [--vp=phone] [--time=2100] [--weather=chuva] [--layers=none,all,shadow,ao,wet,refl,mirror,water]
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8855';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
const vp = argv.vp === 'phone' ? { name: '390x844', width: 390, height: 844, touch: true } : { name: '1280x800', width: 1280, height: 800 };
const time = argv.time ?? '2100';
const weather = argv.weather ?? 'chuva';
const layers = (argv.layers ?? 'none,all,shadow,ao,wet,refl,mirror,water').split(',');
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4));

async function pin(page, t, w) {
  await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(t)}`, { method: 'POST' });
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: `${t.slice(0, 2)}:${t.slice(2)}`, weather: w }), [t, w]);
}

async function boot(page, extra) {
  await page.goto(`${BASE}?notype=1${extra}`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `perfv5+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Perf');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praça');
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const layer of layers) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  await boot(page, layer === 'none' ? '' : `&v5off=${layer}`);
  await page.evaluate(() => window.__tb.renderer.setShot('cam:22,8.4,3'));
  await pin(page, time, weather);
  await sleep(4000);
  const p = await new Promise((resolve) => setTimeout(resolve, 4700)).then(() => page.evaluate(() => window.__tb.perf));
  console.log(`${vp.name} ${time} ${weather} v5off=${layer.padEnd(7)} avg ${p.avgMs} p90 ${p.p90Ms} max ${p.maxMs} ms, ${p.fps} fps, lowfx ${p.lowfx}`);
  await ctx.close();
}
await browser.close();
