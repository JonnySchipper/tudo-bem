#!/usr/bin/env node
/**
 * Shots of the three open-air areas (split into areas): rua, praca, feira at 17:30 (sol), desktop 1280x800 and phone 390x844, as the game frames
 * them for a player (the camera follows the avatar) and as a whole-map overview, plus the Mapa panel with each area's minimap.
 *
 *   BASE_URL=http://localhost:9851 node scripts/split-shots.mjs [--only=rua,praca] [--time=17:30]
 * Needs a server with TB_TEST_CLOCK_CONTROL=1. Output: docs/lifesim/shots/split/<viewport>_<area>_<view>_<hhmm>.png (SHOTS_DIR to override).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:9851';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'split');
const TIME = argv.time ?? '17:30';
const ONLY = argv.only ? argv.only.split(',') : ['rua', 'rua_leste', 'praca', 'feira'];
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const tag = TIME.replace(':', '');
// where the player stands for the follow view, per area
const STAND = { rua: [16, 13], rua_leste: [8, 7], praca: [16, 16], feira: [4, 8] };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844, touch: true }]) {
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
  await page.fill('#intro-email', `shots+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Foto');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praca');
  await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(TIME)}`, { method: 'POST' });
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), TIME);
  await sleep(3000);
  for (const area of ONLY) {
    if ((await page.evaluate(() => window.__tb.game.room?.room)) !== area) {
      await page.evaluate((room) => window.__tb.net.send({ t: 'join', room }), area);
      await waitFor(page, (id) => window.__tb.game.room?.room === id, area, 20_000, area);
    }
    const [sx, sy] = STAND[area];
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [sx, sy]);
    await sleep(4500);
    await page.evaluate(() => { window.__tb.renderer.setShot(null); });
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, `${vp.name}_${area}_follow_${tag}.png`) });
    await page.evaluate(() => window.__tb.renderer.setShot('map'));
    await sleep(1200);
    await page.screenshot({ path: path.join(OUT, `${vp.name}_${area}_map_${tag}.png`) });
    await page.evaluate(() => window.__tb.renderer.setShot(null));
    // the Mapa panel with this area's minimap
    await page.evaluate(() => document.getElementById('btn-map').click());
    await page.waitForSelector('.map-tab', { timeout: 5000 });
    await page.click(`.map-tab[data-area="${area}"]`);
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, `${vp.name}_${area}_minimap.png`) });
    await page.keyboard.press('Escape');
    await sleep(300);
    console.log(`${vp.name} ${area} ok`);
  }
  await ctx.close();
}
await browser.close();
