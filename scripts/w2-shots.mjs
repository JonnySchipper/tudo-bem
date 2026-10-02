#!/usr/bin/env node
/**
 * Wave 2 render-fix shots. BASE_URL=http://localhost:8980 TAG=before|after node scripts/w2-shots.mjs [--only=street,padaria,praca,feira]
 * Output docs/lifesim/shots/w2/<TAG>_<name>.png (the server needs TB_TEST_CLOCK_CONTROL=1).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8980';
const TAG = process.env.TAG ?? 'after';
const OUT = path.join('docs', 'lifesim', 'shots', 'w2');
const ONLY = argv.only ? argv.only.split(',') : ['street', 'padaria', 'praca', 'feira'];
const CHROME = findChrome();
assert(CHROME, 'Chrome not found');
fs.mkdirSync(OUT, { recursive: true });
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(2, 4));
const pin = async (page, t, w = 'sol') => {
  await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(t)}`, { method: 'POST' });
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: `${t.slice(0, 2)}:${t.slice(2)}`, weather: w }), [t, w]);
};
const walk = async (page, x, y) => {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout: 70_000 }).catch(() => console.log('  (walk unfinished)'));
  await sleep(600);
};
const cam = (page, s) => page.evaluate((s) => window.__tb.renderer.setShot(s), s);
const snap = async (page, name, clean = true) => {
  await page.evaluate((c) => { document.getElementById('w2hide')?.remove(); if (c) { const s = document.createElement('style'); s.id = 'w2hide'; s.textContent = '#ui,.wl-stack,.wl-guide{visibility:hidden !important}'; document.head.append(s); } }, clean);
  const buf = await page.screenshot();
  fs.writeFileSync(path.join(OUT, `${TAG}_${name}.png`), buf);
  console.log('  .', `${TAG}_${name}.png`);
};
const PW = 'pao-de-queijo-2026';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
await page.goto(`${BASE}?notype=1${process.env.EXTRA ?? ''}`);
await page.waitForSelector('#intro-enter', { timeout: 20_000 });
await page.click('#intro-enter');
await page.waitForSelector('#intro-skip', { timeout: 12_000 });
await page.click('#intro-skip');
await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
await page.click('#intro-tab-register');
await page.fill('#intro-email', `w2+${Date.now().toString(36)}@exemplo.com`);
await page.fill('#intro-password', PW);
await page.click('#intro-submit');
await page.waitForSelector('#avatar-name', { timeout: 15_000 });
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');
await page.click('#enter-praca');
await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praça');
await sleep(2500);

const evalNow = async () => { if (process.env.EVAL) console.log(JSON.stringify(await page.evaluate(process.env.EVAL), null, 1)); };
const area = async (name, at, c, scenes, wait = 3500) => {
  await pin(page, '1200');
  await cam(page, null);
  await walk(page, at[0], at[1]);
  await cam(page, `cam:${c[0]},${c[1]},${c[2]}`);
  for (const [t, w] of scenes) { await pin(page, t, w); await sleep(wait); await snap(page, `${name}_${t}${w === 'sol' ? '' : '_' + w}`); await evalNow(); }
};
if (ONLY.includes('street')) await area('north_street', [16, 7], [22, 8.4, 3], [['2100', 'sol'], ['2100', 'chuva']]);
if (ONLY.includes('praca')) await area('praca', [25, 16], [25, 20, 3], [['1200', 'sol'], ['0700', 'sol'], ['1730', 'sol'], ['2100', 'chuva'], ['2300', 'sol']]);
if (ONLY.includes('feira')) await area('feira', [45, 20], [43, 22, 3], [['0900', 'sol'], ['2100', 'sol']], 6000);
if (ONLY.includes('padaria')) {
  await cam(page, null);
  await pin(page, '1200');
  await walk(page, 25, 16);
  assert(await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' })), 'portal');
  await waitFor(page, (id) => window.__tb.game.room?.room === id, 'padaria', 20_000, 'padaria');
  await pin(page, '1200');
  await sleep(6000);
  await snap(page, 'padaria_1200');
  await snap(page, 'padaria_1200_ui', false);
  if (process.env.EVAL) console.log(JSON.stringify(await page.evaluate(process.env.EVAL), null, 1));
}
await browser.close();
