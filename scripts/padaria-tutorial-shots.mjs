#!/usr/bin/env node
/**
 * Screenshots of the #150 follow-ups (the bakery play spot and the first-time practice tutorial) from the solo build (test hints on):
 *
 *   pnpm build && MSYS_NO_PATHCONV=1 node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/padaria-tutorial-shots.mjs   # SHOTS_DIR (default docs/lifesim/shots/padaria-tutorial), VIEWS=desktop,phone
 *
 * Per view: the Padaria's door sign in the Rua, the play spot inside on a first visit ("Comece aqui!"), each of the six practice steps (with
 * the gold light on what to tap, the coffee shot held at "Agora!"), the "?" replay, the big order ticket in a real shift, and the play spot
 * once the practice is done.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { assert, sleep, waitFor, waitFront } from './lib/correria-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/padaria-tutorial');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

/** A guest who has met Carlos (so the Rua and the Padaria show the bakery signs) but never played a shift or the practice. */
async function enterRua(page) {
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
  await page.evaluate(() => {
    localStorage.removeItem('tb_cr_practice');
    const p = window.__tb.net.debugSession().profile;
    p.tutorial.carlos = true;
    p.tutorial.meveum = false;
  });
  await goArea(page, 'rua');
  await sleep(1200);
}

/** Wait for a selector, but only log on a miss: a missing extra (a glow, a kicker) should not cost the rest of the shots. */
async function soft(page, sel, ms = 4000) {
  try {
    await page.waitForSelector(sel, { timeout: ms });
    return true;
  } catch {
    log(`(no ${sel})`);
    return false;
  }
}

const click = (page, id) => page.evaluate((id) => document.getElementById(id)?.click(), id);
const coachStep = (page, step) => waitFor(page, (s) => document.querySelector('#cr-coach')?.dataset.step === s, step, 15_000, `the practice step ${step}`);

/** The coffee: tap the machine, hold the frames once it shows "Agora!", shoot, then let it run and tap again (the practice cannot fail). */
async function pourAtAgora(page, shoot) {
  await page.evaluate(() => window.__tb.correria.feed.on.pourStart('cafe'));
  const ok = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const until = performance.now() + 6000;
        const poll = () => {
          if (document.querySelector('#cr-machine')?.dataset.zone === 'agora') {
            const raf = window.requestAnimationFrame;
            const held = [];
            window.__tbRaf = { raf, held };
            window.requestAnimationFrame = (cb) => (held.push(cb), 0);
            return resolve(true);
          }
          if (performance.now() > until) return resolve(false);
          setTimeout(poll, 10);
        };
        poll();
      }),
  );
  assert(ok, 'the machine shows Agora!');
  await sleep(120);
  await shoot();
  await page.evaluate(() => {
    const { raf, held } = window.__tbRaf;
    window.requestAnimationFrame = raf;
    for (const cb of held) raf(cb);
    window.__tb.correria.feed.on.pourEnd();
  });
}

/** The juicer: an orange per tap until the line, then the glass (shoots once the light has moved to the glass). */
async function juice(page, shoot) {
  let shotGlass = false;
  for (let i = 0; i < 20; i++) {
    const step = await page.evaluate(() => document.querySelector('#cr-coach')?.dataset.step);
    if (step !== 'suco') return;
    const fill = await page.evaluate(() => window.__tb.correria.feed.snap?.juice?.fill ?? 0);
    if (fill >= 0.8) {
      if (!shotGlass) {
        await sleep(300);
        await shoot();
        shotGlass = true;
      }
      await click(page, 'cr-juice-glass');
    } else await click(page, 'cr-juicer');
    await sleep(760);
  }
}

async function run(name) {
  const v = VIEW[name];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(v);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let n = 0;
  const shot = async (label) => {
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  try {
    await enterRua(page);

    // 1. the Rua: the Padaria's door sign
    await soft(page, '.wl-guide-door');
    await shot('rua_door_sign');

    // 2. inside, first visit: the glowing spot, the "Jogar: Padaria" sign and "Comece aqui!"
    await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 20_000, 'padaria');
    await sleep(1200);
    await soft(page, '.wl-guide-play.wl-guide-first');
    await shot('play_spot_first_visit');

    // 3. the practice opens from the counter rail
    await page.evaluate(() => window.__tb.interact({ prop: 'trilho' }));
    await page.waitForSelector('#cr-coach', { timeout: 10_000 });
    await coachStep(page, 'read');
    await sleep(600);
    await shot('tutorial_1_read_order');
    await click(page, 'cr-coach-next');

    await coachStep(page, 'cafe');
    await sleep(400);
    await shot('tutorial_2_coffee_tap');
    await pourAtAgora(page, () => shot('tutorial_2b_coffee_agora'));

    await coachStep(page, 'pao');
    await sleep(400);
    await shot('tutorial_3_pao_frances');
    await click(page, 'cr-item-pao');

    await coachStep(page, 'suco');
    await sleep(400);
    await shot('tutorial_4_juicer');
    await juice(page, () => shot('tutorial_4b_juice_glass'));

    await coachStep(page, 'serve');
    await sleep(400);
    await shot('tutorial_5_serve');
    await click(page, 'cr-serve');

    await coachStep(page, 'paid');
    await sleep(600);
    await shot('tutorial_6_paid');

    // 4. "?" replays the practice from step 1
    await click(page, 'cr-coach-again');
    await coachStep(page, 'read');
    await click(page, 'cr-coach-next');
    await coachStep(page, 'cafe');
    await click(page, 'cr-help');
    await coachStep(page, 'read');
    await sleep(400);
    await shot('tutorial_replay_help');

    // 5. Pular: the practice is done, and a real shift opens with the big order ticket
    await click(page, 'cr-coach-skip');
    await waitFor(page, () => !document.querySelector('#cr-coach') && !!window.__tb.correria.feed.snap, null, 10_000, 'the real shift');
    await waitFront(page);
    await page.evaluate(() => document.querySelector('.cr-lesson-ok')?.click());
    await sleep(800);
    await shot('real_shift_big_ticket');
    await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
    await sleep(300);
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(800);

    // 6. after the practice: the play spot stays, without "Comece aqui!"
    await shot('play_spot_after_practice');

    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
