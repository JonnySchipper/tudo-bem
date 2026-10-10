#!/usr/bin/env node
/**
 * Screenshots of the Padaria counter progression (issue #150) from the solo build (the world runs in the page, test hints on):
 *
 *   pnpm build && MSYS_NO_PATHCONV=1 node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/padaria-progression-shots.mjs   # SHOTS_DIR (default docs/lifesim/shots/padaria-progression), VIEWS=desktop,phone
 *
 * Per view: the first shift (café lesson, the ladder strip), the shift that opens água (gold "Novo no cardápio" card, NOVO on the shelf), the
 * coffee pour filling, in the "Agora!" window and spilling, the end card's countdown and its "Próximo turno" line, and a mid-ladder lesson
 * (the juicer) with the strip folded.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { assert, buildOrder, serve, sleep, startShift, waitFor, waitFront, wantOf } from './lib/correria-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/padaria-progression');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
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

/** Where the player is on the ladder: completed shifts and the cards already shown. */
const setLadder = (page, shifts, taught) =>
  page.evaluate(([n, t]) => {
    const p = window.__tb.net.debugSession().profile;
    p.correria = { stars: 0, shifts: n, best: 0, taught: t };
  }, [shifts, taught]);

const closeShift = async (page) => {
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
  await sleep(300);
  await page.evaluate(() => window.__tb.correria.ui?.destroy());
  await sleep(400);
};

/** Serve the customer at the counter, then quit: the end card for a shift that served one. */
async function serveOneAndEnd(page) {
  await page.evaluate(() => window.__tb.correria.feed.on.clear());
  const c = await waitFront(page);
  await buildOrder(page, await wantOf(page, c));
  await serve(page);
  await sleep(500);
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
  await page.waitForSelector('#mg-end', { timeout: 8000 });
  await sleep(500);
}

/**
 * Start a pour and hold the frames (no rAF) once the machine shows `zone` at `frac` of the fill time or more. The "Agora!" window is ~0.7 s and a
 * 2× swiftshader capture lags by about a second, so the shot is of the held frame. `thaw()` lets the page run again.
 */
async function pourHeldAt(page, zone, frac) {
  const ok = await page.evaluate(
    ([zone, frac]) =>
      new Promise((resolve) => {
        const feed = window.__tb.correria.feed;
        feed.on.pourStart('cafe');
        const raf = window.requestAnimationFrame;
        const until = performance.now() + 6000;
        const poll = () => {
          const s = feed.snap;
          const fill = s?.pour ? (s.pour.age + performance.now() - feed.snapAt) / s.pourMs : 0;
          if (fill >= frac && document.querySelector('#cr-machine')?.dataset.zone === zone) {
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
    [zone, frac],
  );
  assert(ok, `the machine shows ${zone}`);
  await sleep(120);
}
const thaw = (page) =>
  page.evaluate(() => {
    const { raf, held } = window.__tbRaf;
    window.requestAnimationFrame = raf;
    for (const cb of held) raf(cb);
  });
/** Stop the pour and wait for its toast to go, so the next shot starts clean. */
async function endPour(page) {
  await page.evaluate(() => window.__tb.correria.feed.on.pourEnd());
  await waitFor(page, () => !window.__tb.correria.feed.snap?.pour && !document.querySelector('#cr-say.on'), null, 8000, 'the pour to clear');
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
  const okLesson = async () => {
    await page.evaluate(() => document.querySelector('.cr-lesson-ok')?.click());
    await sleep(300);
  };
  try {
    await enterPadaria(page);

    // 1. the very first shift: the café card, with the starter menu and "Próximo: água em 2 turnos"
    await setLadder(page, 0, []);
    await startShift(page);
    await page.waitForSelector('#cr-lesson .cr-ladder', { timeout: 6000 });
    await sleep(400);
    await shot('first_shift_cafe_lesson');
    await okLesson();
    await closeShift(page);

    // 2. the shift that opens água: the gold "Novo no cardápio" card, then NOVO on the shelf
    await setLadder(page, 2, ['cafe', 'pao']);
    await startShift(page);
    await page.waitForSelector('#cr-lesson.grew .cr-ladder-item.new', { timeout: 6000 });
    await sleep(400);
    await shot('novo_no_cardapio_agua');
    await okLesson();
    await waitFor(page, () => document.querySelector('#cr-item-agua')?.classList.contains('cr-new'), null, 4000, 'NOVO on água');
    await sleep(300);
    await shot('novo_badge_shelf');

    // 3. the coffee: filling, "Agora!" in the window, and an overpour past the brim (each a held frame)
    await pourHeldAt(page, 'filling', 0.4);
    await shot('pour_filling');
    await thaw(page);
    await endPour(page);
    await pourHeldAt(page, 'agora', 0.7);
    await shot('pour_agora');
    await thaw(page);
    await endPour(page);
    await pourHeldAt(page, 'over', 1.15);
    await shot('pour_spilling');
    await thaw(page);
    await endPour(page);

    // 4. the end card: the countdown to pão de queijo
    await serveOneAndEnd(page);
    await shot('end_card_countdown');
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(400);

    // 5. one shift before pão de queijo: the end card leads with what opens next time
    await setLadder(page, 3, ['cafe', 'pao', 'agua']);
    await startShift(page);
    await serveOneAndEnd(page);
    await page.waitForSelector('#cr-end-next', { timeout: 4000 });
    await shot('end_card_next_shift_opens');
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(400);

    // 6. mid-ladder: the juicer card with the strip folded ("+N")
    await setLadder(page, 10, ['cafe', 'pao', 'agua', 'pao_de_queijo', 'cafe_com_leite', 'pao_na_chapa', 'where']);
    await startShift(page);
    await page.waitForSelector('#cr-lesson .cr-ladder-item.more', { timeout: 6000 });
    await sleep(400);
    await shot('juicer_lesson_folded_strip');
    await okLesson();
    await closeShift(page);

    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
