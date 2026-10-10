#!/usr/bin/env node
/**
 * The Praia's screenshots (PRAIA-PLAN.md 9.3): the beach at four hours and in the rain, the map with the praia as a place, Bento's menu,
 * a fishing stage, Jô's tray, the party invite modal, the party deck with two avatars and the trip card. Desktop 1280x800 and phone 390x844.
 * Every shot asserts nothing was drawn as a placeholder (`__tb.artMissing`).
 *
 *   pnpm build && PORT=8811 TB_TEST_PESCA=1 TB_TEST_CLOCK_CONTROL=1 pnpm start &
 *   BASE_URL=http://localhost:8811/ node scripts/praia-shots.mjs
 * Env: BASE_URL, CHROME_PATH, SHOTS_DIR (default docs/lifesim/shots/praia), VIEWS=desktop,phone, TB_ADMIN_PASSWORD (local default
 * tb-admin-praca: the credits admin door gives the host RV for the party boat).
 * The dashboard's Praia card is on the World page of `scripts/admin-shots.mjs` (6-world.png).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { goPraia } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8811/';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'praia');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const ADMIN = process.env.TB_ADMIN_PASSWORD || 'tb-admin-praca';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);
const errors = [];

async function enter(page, name) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `praia+${name.toLowerCase()}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '09:00', weather: 'sol' }));
  await page.evaluate(() => document.getElementById('aero-next-ok')?.click());
}

async function shot(page, view, name) {
  await sleep(500);
  const missing = await page.evaluate(() => window.__tb.artMissing);
  assert(missing.length === 0, `${name}: placeholders drawn for ${missing.join(', ')}`);
  const p = path.join(OUT, `${view}_${name}.png`);
  await page.screenshot({ path: p });
  log('shot', p);
}

async function openHud(page, sel) {
  const burger = page.locator('#btn-burger');
  if (await burger.isVisible()) {
    if ((await burger.getAttribute('aria-expanded')) !== 'true') await burger.click();
  } else if ((await page.getAttribute('#btn-menu', 'aria-expanded')) !== 'true') await page.click('#btn-menu');
  // the gear's Créditos / Apoiar wait for the resident stage (SIMPLIFICATION-REVIEW §3): press the button itself
  await page.$eval(sel, (b) => b.click());
}

/** The credits admin door: sign in and give this player RV (the host pays the party boat). */
async function giveRv(page, amount) {
  await openHud(page, '#btn-credits');
  await page.waitForSelector('#credits-admin-door', { timeout: 8_000 });
  await page.click('#credits-admin-door');
  await page.waitForSelector('#admin-password', { timeout: 8_000 });
  await page.fill('#admin-password', ADMIN);
  await page.click('#admin-login-go');
  await sleep(500);
  const before = await page.evaluate(() => window.__tb.game.profile.coins);
  await page.evaluate((n) => window.__tb.net.send({ t: 'admin', action: 'money', amount: n }), amount);
  await waitFor(page, (b) => window.__tb.game.profile.coins > b, before, 8_000, 'admin RV');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('[data-modal] .close')?.click());
}

const walkNear = async (page, target) => {
  await page.evaluate((t) => window.__tb.interact(t), target);
  await sleep(2500);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const view of VIEWS) {
    const ctx = await browser.newContext(VIEW[view]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${view}: ${e}`));
    await enter(page, 'Iara');
    await goPraia(page);

    // the beach at four hours, and in the rain (the umbrellas close)
    for (const [time, weather, name] of [
      ['09:00', 'sol', 'beach_0900'],
      ['17:30', 'sol', 'beach_1730_sunpath'],
      ['20:30', 'sol', 'beach_2030_night'],
      ['11:00', 'chuva', 'beach_1100_chuva'],
    ]) {
      await page.evaluate((o) => window.__tb.setClock(o), { time, weather });
      await sleep(1500);
      await shot(page, view, name);
    }
    await page.evaluate(() => window.__tb.setClock({ time: '10:00', weather: 'sol' }));

    // the map: the praia is a place now
    await page.evaluate(() => document.getElementById('btn-map').click());
    await page.waitForSelector('[data-modal="map"] .tm-svg', { timeout: 5000 });
    assert(await page.isVisible('.tm-here[data-here="praia"]'), '"você está aqui" on the praia');
    await shot(page, view, 'map');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('[data-modal="map"] .close')?.click());

    // Bento's menu
    await walkNear(page, { npc: 'bento' });
    await page.evaluate(() => window.__tb.interact({ prop: 'galpao_barcos' }));
    await sleep(1500);
    await shot(page, view, 'bento_menu');
    await page.keyboard.press('Escape');

    // a cast from the sand (the pinned bagre under TB_TEST_PESCA)
    await page.evaluate(() => window.__tb.interact({ prop: 'pesca_praia_1' }));
    await waitFor(page, () => !!window.__tb.pesca.stage(), null, 15_000, 'the fishing stage');
    await shot(page, view, 'stage_praia');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // Jô's tray
    await walkNear(page, { npc: 'jo' });
    await page.evaluate(() => window.__tb.interact({ prop: 'compro_peixe' }));
    await sleep(1200);
    await shot(page, view, 'jo_tray');
    await page.evaluate(() => document.querySelector('[data-modal] .close')?.click());

    if (view === 'desktop') {
      // the party boat: a host and a guest in two windows, friends first
      const gctx = await browser.newContext(VIEW.desktop);
      const guest = await gctx.newPage();
      guest.on('pageerror', (e) => errors.push(`guest: ${e}`));
      await enter(guest, 'Duda');
      const gid = await guest.evaluate(() => window.__tb.game.profile.id);
      const hid = await page.evaluate(() => window.__tb.game.profile.id);
      await page.evaluate((id) => window.__tb.net.send({ t: 'friend', action: 'request', targetId: id }), gid);
      await sleep(600);
      await guest.evaluate((id) => window.__tb.net.send({ t: 'friend', action: 'accept', targetId: id }), hid);
      await sleep(600);
      await giveRv(page, 300);
      await walkNear(page, { npc: 'bento' });
      await page.evaluate(() => window.__tb.party.create());
      await waitFor(page, () => window.__tb.game.room?.room === 'barco_festa', null, 10_000, 'the host boards');
      await page.evaluate(() => window.__tb.setClock({ time: '17:40', weather: 'sol' }));
      await page.evaluate((id) => window.__tb.party.invite(id), gid);
      await guest.waitForSelector('[data-modal="party-invite"]', { timeout: 8_000 });
      await shot(guest, view, 'party_invite');
      await guest.click('#btn-party-accept');
      await waitFor(guest, () => window.__tb.game.room?.room === 'barco_festa', null, 10_000, 'the guest boards');
      await guest.evaluate(() => window.__tb.setClock({ time: '17:40', weather: 'sol' }));
      await sleep(1500);
      await shot(page, view, 'party_deck');
      await page.evaluate(() => window.__tb.party.end());
      await page.waitForSelector('[data-modal="party-summary"]', { timeout: 10_000 });
      assert((await page.evaluate(() => window.__tb.game.room?.room)) === 'praia', 'back on the pier');
      await shot(page, view, 'party_summary');
      await gctx.close();
    }
    await ctx.close();
  }
  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  console.log('praia shots ok →', OUT);
} finally {
  await browser.close();
}
