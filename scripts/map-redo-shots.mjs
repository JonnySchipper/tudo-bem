#!/usr/bin/env node
/**
 * The Mapa redo (#173): one illustrated map where each place is the button. Opens the map on desktop (1280x800) and phone (390x844), shoots it
 * plain, with a place hovered (desktop) or tapped once (phone), and with the Praia teaser up. Then it checks travel: a click on every place
 * of the map joins that room, and a click on Praia / Fazenda never leaves the room you are in.
 *
 *   pnpm build && pnpm start &
 *   node scripts/map-redo-shots.mjs        # BASE_URL (default http://localhost:8787/), CHROME_PATH, SHOTS_DIR optional
 * or against the static solo build (`VITE_LOCAL_WORLD=1`, served by scripts/serve-static.mjs) with SOLO=1 (signs in as a guest).
 * Output: docs/lifesim/shots/map-redo/<viewport>_<view>.png
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787/';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'map-redo');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('  ·', ...a);

const PLACES = ['aeroporto', 'kitnet', 'padaria', 'academia', 'escola', 'rua', 'rua_leste', 'praca', 'feira'];

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844, touch: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.touch ? 2 : 1, hasTouch: !!vp.touch, isMobile: !!vp.touch });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
    await page.waitForSelector('#intro-enter', { timeout: 15_000 });
    await page.click('#intro-enter');
    await page.waitForSelector('#intro-skip', { timeout: 12_000 });
    await page.click('#intro-skip');
    await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
    if (process.env.SOLO) await page.click('#intro-guest');
    else {
      // a server: a fresh account each run
      await page.click('#intro-tab-register');
      await page.fill('#intro-email', `mapa+${vp.name}${Date.now().toString(36)}@exemplo.com`);
      await page.fill('#intro-password', 'pao-de-queijo-2026');
      await page.click('#intro-submit');
    }
    await page.waitForSelector('#avatar-name', { timeout: 15_000 });
    await page.fill('#avatar-name', 'Mapa');
    await page.click('button:has-text("ela (she)")');
    await page.click('#enter-praca');
    await finishArrival(page);
    await sleep(1200);

    const openMap = async () => {
      await page.evaluate(() => document.getElementById('btn-map').click());
      await page.waitForSelector('[data-modal="map"] .tm-svg', { timeout: 5000 });
      await sleep(400);
    };
    await openMap();
    assert((await page.$$('[data-modal="map"] .map-card, [data-modal="map"] .map-tab')).length === 0, 'the old named cards and tabs are gone');
    assert(await page.isVisible('.tm-here[data-here="praca"]'), '"você está aqui" on the praça');
    await page.screenshot({ path: path.join(OUT, `${vp.name}_map.png`) });
    log(vp.name, 'map');

    // hover (desktop) / first tap (phone) on the padaria: it lifts and shows its name
    if (vp.touch) await page.tap('.tm-spot[data-spot="padaria"] .tm-hit');
    else await page.hover('.tm-spot[data-spot="padaria"] .tm-hit');
    await sleep(300);
    assert(await page.isVisible('.tm-label[data-for="padaria"]'), 'the padaria label shows');
    assert((await page.evaluate(() => window.__tb.game.room?.room)) === 'praca', 'a hover or first tap does not travel');
    await page.screenshot({ path: path.join(OUT, `${vp.name}_${vp.touch ? 'tap' : 'hover'}.png`) });
    log(vp.name, vp.touch ? 'tap' : 'hover');

    // the coming-soon teaser: never travel
    for (const soon of ['fazenda', 'praia']) {
      if (vp.touch) {
        await page.evaluate((id) => {
          const s = document.querySelector('.tm-scroll');
          s.scrollLeft = id === 'praia' ? 0 : s.scrollWidth;
        }, soon);
        await sleep(200);
        await page.tap(`.tm-spot[data-spot="${soon}"] .tm-hit`);
      } else await page.click(`.tm-spot[data-spot="${soon}"] .tm-hit`);
      await page.waitForSelector(`.tm-teaser[data-spot="${soon}"]:not([hidden])`, { timeout: 3000 });
      assert((await page.evaluate(() => window.__tb.game.room?.room)) === 'praca', `${soon} does not travel`);
    }
    await sleep(200);
    await page.screenshot({ path: path.join(OUT, `${vp.name}_soon_teaser.png`) });
    log(vp.name, 'teaser');
    await page.click('[data-teaser-ok]');

    // travel: every place on the map joins its room (desktop: one click; phone: tap to lift, tap again to go)
    for (const id of vp.touch ? ['feira', 'academia'] : PLACES) {
      if ((await page.evaluate(() => window.__tb.game.room?.room)) === id) continue;
      if (!(await page.$('[data-modal="map"]'))) await openMap();
      const hit = `.tm-spot[data-spot="${id}"] .tm-hit`;
      if (vp.touch) {
        await page.$eval(hit, (el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
        await page.tap(hit);
        await sleep(150);
        await page.tap(hit);
      } else await page.click(hit);
      await waitFor(page, (room) => window.__tb.game.room?.room === room, id, 10_000, `travel to ${id}`);
      assert(!(await page.$('[data-modal="map"]')), 'the map closes on travel');
      log(vp.name, 'travel ok →', id);
      await sleep(500);
    }
    // the pin follows you
    await openMap();
    const last = await page.evaluate(() => window.__tb.game.room?.room);
    assert(await page.isVisible(`.tm-here[data-here="${last}"]`), `"você está aqui" on ${last}`);
    await page.screenshot({ path: path.join(OUT, `${vp.name}_map_from_${last}.png`) });
    await ctx.close();
  }
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  console.log('map-redo shots ok →', OUT);
} finally {
  await browser.close();
}
