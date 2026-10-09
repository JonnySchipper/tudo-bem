#!/usr/bin/env node
/**
 * Screenshots of "Correria no Balcão" for DECISIONS / review, from the solo build (the world runs in the page, test hints on):
 *
 *   pnpm build && MSYS_NO_PATHCONV=1 node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/correria-shots.mjs      # SHOTS_DIR (default docs/lifesim/shots/correria), VIEWS=desktop,phone,land
 *
 * Per view: a customer ordering (written, at Verde with the glosses), the chapa and the coffee in use, a correction, then at the top level a
 * listening order, serving (bell, emote, tip), "Quanto é?", and the end card. Phone portrait and landscape get the same set (with the measured
 * share of the screen the strip covers).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { assert, answerAsk, buildOrder, serve, sleep, snap, startShift, waitFor, waitFront, wantOf } from './lib/correria-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/correria');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone,land').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  land: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

async function enterPadaria(page) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}solo&rolltest&crtest&tbclockmin=${offsetMinFor(DAY_MIN)}`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(800);
  await goArea(page, 'rua');
  await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
  await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 20_000, 'padaria');
  await sleep(1200);
}

const setStars = (page, stars) =>
  page.evaluate((n) => {
    const p = window.__tb.net.debugSession().profile;
    // the full counter (the menu ladder opens every item by 20 shifts) with every how-to card already shown
    const taught = ['cafe', 'pao', 'agua', 'pao_de_queijo', 'cafe_com_leite', 'pao_na_chapa', 'espremedor', 'coxinha', 'pastel', 'bolo', 'guarana', 'misto_quente', 'where'];
    p.correria = { stars: n, shifts: 20, best: 0, taught };
    // friends at the counter: the regulars come in with their own greeting
    p.bond = n > 0 ? { nanda: 40, julia: 40, prof: 30, ze: 30, chico: 30, rosa: 30, tia_lu: 30 } : {};
  }, stars);
const quit = async (page) => {
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
  await sleep(300);
};

async function run(name) {
  const v = VIEW[name];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(v);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let n = 0;
  const share = () => page.evaluate(() => { const p = document.querySelector('#cr-panel'); return p && p.offsetParent ? +(p.getBoundingClientRect().height / window.innerHeight).toFixed(3) : 0; });
  const shot = async (label) => {
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file, `strip ${((await share()) * 100).toFixed(0)}%`);
  };
  try {
    await enterPadaria(page);

    // 1. Verde: a written order, the chapa, the coffee, a correction
    await setStars(page, 0);
    await startShift(page);
    const first = await waitFront(page);
    await sleep(500);
    await shot('order_written');
    await page.click('#cr-item-pao_na_chapa');
    await sleep(1300);
    const box = await page.locator('#cr-item-cafe').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await sleep(900);
    await shot('chapa_and_coffee');
    await page.mouse.up();
    await sleep(1400);
    await shot('chapa_ready');
    await page.click('#cr-grill-0');
    await page.click('#cr-item-guarana'); // an item nobody asked for: the correction below is certain
    await sleep(200);
    // a wrong tray: serve what is on it (a pão na chapa and a café) unless that is the order, then the correction
    await page.click('#cr-serve');
    await sleep(450);
    const cur = (await snap(page)).customers.find((c) => c.id === first.id);
    if (cur?.mistakes > 0) await shot('correction');
    else log('(the staged tray happened to be the order)');
    await quit(page);
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(500);

    // 2. the top level: a listening order, serving, "Quanto é?", the end card
    await setStars(page, 20);
    let listening = false;
    for (let i = 0; i < 25 && !listening; i++) {
      await startShift(page);
      const c = await waitFront(page);
      if (c.mode === 'listening') {
        listening = true;
        await sleep(600);
        await shot('order_listening');
      } else {
        await quit(page);
        await page.evaluate(() => window.__tb.correria.ui?.destroy());
        await sleep(300);
      }
    }
    assert(listening, 'found a listening customer');
    let askShot = false;
    let served = 0;
    for (let i = 0; i < 12 && !askShot; i++) {
      const c = await waitFront(page);
      const want = await wantOf(page, c);
      await buildOrder(page, want);
      await sleep(300);
      if (served === 0) await shot('tray_ready');
      await serve(page);
      served++;
      await sleep(350);
      if (served === 1) await shot('serving');
      const asking = await page.evaluate(() => !!window.__tb.correria.feed.snap?.customers.find((x) => x.state === 'asking'));
      if (asking) {
        await sleep(300);
        await shot('quanto_e');
        askShot = true;
        await answerAsk(page);
        await sleep(500);
        await shot('after_answer');
      }
    }
    log('served', served, 'ask shot', askShot);
    await quit(page);
    await sleep(500);
    await shot('end_card');
    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
