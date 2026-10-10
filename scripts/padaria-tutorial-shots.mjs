#!/usr/bin/env node
/**
 * The padaria as a brand-new player meets it (issue #227), from the solo build, as stills and GIF frame sequences:
 *
 *   pnpm build && MSYS_NO_PATHCONV=1 node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/padaria-tutorial-shots.mjs   # SHOTS_DIR (default docs/lifesim/shots/padaria-overhaul), VIEWS=desktop,phone
 *
 * Per view: the Padaria's door sign in the Rua; inside, the "Jogar: Padaria" sign on the vitrine; a click on the vitrine opens the practice
 * (Ana: um café e um pão) with one coach mark at a time (the machine, the green "Agora!", the pão, Entregar), then "Começar o turno" and the
 * first real customer; later, an order "extra quente" (the 🔥 tag, the red band on the meter); and a player's own padaria (the small empty
 * Balcão room, the owner menu, its counter with only café and pão, the bigger room after the Padaria upgrade).
 * GIFs: `<view>_gif_<name>.gif` (every frame is also in `frames/`).
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { assert, sleep, waitFor } from './lib/correria-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/padaria-overhaul');
const FRAMES = path.join(SHOTS, 'frames');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(FRAMES, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
/** GIF width per view (the frames are scaled down; a GIF of a full desktop screen is heavy). */
const GIF_W = { desktop: 720, phone: 300 };
const log = (...a) => console.log('  ·', ...a);
const click = (page, id) => page.evaluate((id) => document.getElementById(id)?.click(), id);
const mark = (page) => page.evaluate(() => (document.querySelector('#cr-mark.on') ? document.querySelector('#cr-mark')?.dataset.key ?? null : null));
const waitMark = (page, key, ms = 12_000) => waitFor(page, (k) => document.querySelector('#cr-mark.on')?.dataset.key === k, key, ms, `the coach mark ${key}`);
const zone = (page) => page.evaluate(() => document.querySelector('#cr-machine')?.dataset.zone ?? null);
const front = (page) => page.evaluate(() => window.__tb.correria.feed.snap?.customers.find((c) => c.state === 'front') ?? null);
const profile = (page, fn, arg) => page.evaluate(([src, a]) => new Function('p', 'a', src)(window.__tb.net.session.profile, a), [fn, arg]);

/** A guest who has met Carlos (so the Rua and the Padaria show the bakery signs) but never played a shift or the practice. */
async function enterRua(page) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}solo&rolltest&crtest&notype=1&tbclockmin=${offsetMinFor(DAY_MIN)}`);
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
    localStorage.removeItem('tb_cr_coach_v1');
    const p = window.__tb.net.session.profile;
    p.tutorial.carlos = true;
    p.tutorial.meveum = false;
  });
  await goArea(page, 'rua');
  await sleep(1200);
}

async function run(name) {
  const v = VIEW[name];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext(v);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  let n = 0;
  const shot = async (label) => {
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  /**
   * Film what `act` does (CDP screencast: the frames the page actually paints, a screenshot per frame would be far too slow for a
   * 2-second pour), keep at most `keep` evenly spaced frames, and write them as frames and one GIF that plays at the real speed.
   */
  const film = async (label, act, { keep = 18, tail = 500 } = {}) => {
    const cdp = await ctx.newCDPSession(page);
    const got = [];
    cdp.on('Page.screencastFrame', (f) => {
      got.push({ at: Date.now(), data: Buffer.from(f.data, 'base64') });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    // small JPEG frames keep the page's own timing honest (full-size PNG frames slowed its timers by a few hundred ms)
    const vp = page.viewportSize();
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: Math.round(vp.width * 1.0), maxHeight: Math.round(vp.height * 1.0), everyNthFrame: 1 });
    await act();
    await sleep(tail);
    await cdp.send('Page.stopScreencast');
    await cdp.detach().catch(() => {});
    assert(got.length >= 2, `${label}: frames were filmed`);
    const step = Math.max(1, got.length / keep);
    const picked = [];
    for (let i = 0; i < got.length; i += step) picked.push(got[Math.floor(i)]);
    if (picked.at(-1) !== got.at(-1)) picked.push(got.at(-1));
    for (const f of fs.readdirSync(FRAMES)) if (f.startsWith(`${name}_${label}_`)) fs.rmSync(path.join(FRAMES, f));
    await Promise.all(picked.map((f, i) => sharp(f.data).png().toFile(path.join(FRAMES, `${name}_${label}_${String(i).padStart(2, '0')}.png`))));
    const w = GIF_W[name];
    const small = await Promise.all(picked.map((f) => sharp(f.data).resize({ width: w }).png().toBuffer()));
    const delay = picked.map((f, i) => (i === picked.length - 1 ? 1600 : Math.max(60, Math.min(900, picked[i + 1].at - f.at))));
    const file = `${name}_gif_${label}.gif`;
    await sharp(small, { join: { animated: true } }).gif({ delay, loop: 0 }).toFile(path.join(SHOTS, file));
    log(`${file} (${picked.length} of ${got.length} frames)`);
  };
  /**
   * Tap the machine, tap again in the middle of the window wanted ('agora' = the green, 'quente' = the red), timed from the first tap like a
   * player counting the beat (the label on screen can trail a frame or two behind under the screencast). Filmed.
   */
  const pour = async (label, want) => {
    for (let take = 1; take <= 4; take++) {
      let mods = [];
      await film(label, async () => {
        const at = want === 'quente' ? 1.22 : 0.8;
        await page.evaluate(
          (at) =>
            new Promise((resolve) => {
              const ms = window.__tb.correria.feed.snap?.pourMs || 1800;
              const t0 = performance.now();
              document.getElementById('cr-machine')?.click();
              const tick = () => (performance.now() - t0 >= ms * at ? (document.getElementById('cr-machine')?.click(), resolve(true)) : setTimeout(tick, 5));
              tick();
            }),
          at,
        );
        await sleep(300);
        mods = await page.evaluate(() => window.__tb.correria.feed.snap?.mods ?? []);
      });
      const landed = await page.evaluate(() => (window.__tb.correria.feed.snap?.tray ?? []).includes('cafe'));
      if (landed && (want === 'quente') === mods.includes('bem_quente')) return;
      log(`take ${take}: the pour missed the ${want} (tray ${landed ? 'has' : 'has no'} café, mods ${mods}); again`);
      await click(page, 'cr-clear');
      await sleep(500);
    }
    throw new Error(`the pour never landed in ${want}`);
  };
  try {
    await enterRua(page);

    // 1. the Rua: the Padaria's door sign
    await shot('rua_door_sign');

    // 2. inside, first visit: the "Jogar: Padaria" sign stands on the vitrine (the display case is what you click)
    await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 20_000, 'padaria');
    await sleep(1500);
    await shot('play_spot_on_the_vitrine');

    // 3. a click on the vitrine: the practice opens on the counter, nothing to read first, one hint at the coffee machine
    const t0 = Date.now();
    await page.evaluate(() => window.__tb.interact({ prop: 'vitrine' }));
    await page.waitForSelector('#cr-order', { timeout: 15_000 });
    await waitMark(page, 'cafe');
    log(`vitrine → first hint in ${Date.now() - t0} ms`);
    await sleep(500);
    await shot('practice_hint_coffee_machine');

    // 4. the coffee: tap, the cup fills (the hint moves to the green), tap at "Agora!"
    await pour('practice_coffee_pour', 'agora');
    await waitMark(page, 'item:pao');
    await sleep(300);
    await shot('practice_hint_pao');

    // 5. the pão, then Entregar
    await click(page, 'cr-item-pao');
    await waitMark(page, 'serve');
    await sleep(300);
    await shot('practice_hint_serve');
    await click(page, 'cr-serve');
    await page.waitForSelector('#cr-done', { timeout: 10_000 });
    await sleep(900);
    await shot('practice_done');

    // 6. "Começar o turno": the first real customer; the hints already learnt stay away, the board is just café and pão, big
    await click(page, 'cr-start');
    await waitFor(page, () => !!window.__tb.correria.feed.snap && !document.querySelector('.cr-practice'), null, 10_000, 'the real shift');
    let c = null;
    for (let i = 0; i < 40 && !c; i++) {
      c = await front(page);
      if (!c) await sleep(250);
    }
    assert(c, 'a customer at the counter');
    await sleep(1600);
    await shot('first_shift_customer');
    // play this first customer through, filmed (whatever they asked for: café, pão or both)
    const items = (c.debug?.lines ?? []).map((l) => l.itemId);
    await film(
      'first_shift_customer',
      async () => {
        for (const id of items.length ? items : (c.want?.items ?? [])) {
          if (id === 'cafe')
            await page.evaluate(
              () =>
                new Promise((resolve) => {
                  document.getElementById('cr-machine')?.click();
                  setTimeout(() => (document.getElementById('cr-machine')?.click(), resolve(true)), Math.round((window.__tb.correria.feed.snap?.pourMs || 1800) * 0.88));
                }),
            );
          else await click(page, `cr-item-${id}`);
          await sleep(500);
        }
        await click(page, 'cr-serve');
        await sleep(1200);
      },
      { keep: 24 },
    );
    await shot('first_shift_served');
    await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
    await sleep(600);
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(800);

    // 7. extra quente: a player with a shift behind them; restart until a customer asks for it (a lone coffee, about one in eight)
    await profile(page, 'p.correria = { ...(p.correria ?? {}), stars: 0, shifts: 2, best: 0, taught: p.correria?.taught ?? [] }; p.tutorial.meveum = true;');
    let hot = null;
    for (let tries = 0; tries < 40 && !hot; tries++) {
      await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'start' }));
      await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'a shift');
      let f = null;
      for (let i = 0; i < 40 && !f; i++) {
        f = await front(page);
        if (!f) await sleep(200);
      }
      if (f?.hot) hot = f;
      else {
        await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
        await sleep(200);
        await page.evaluate(() => window.__tb.correria.ui?.destroy());
        await sleep(200);
      }
    }
    assert(hot, 'an extra-quente order came');
    await sleep(1400);
    await shot('extra_quente_order');
    await pour('extra_quente_pour', 'quente');
    await sleep(400);
    await shot('extra_quente_on_the_tray');
    await click(page, 'cr-serve');
    await sleep(1200);
    await shot('extra_quente_served');
    await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
    await sleep(600);
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(600);

    // 8. a player's own padaria: found it at the Rua door (coins set in the in-page world), the small empty Balcão
    await page.evaluate(() => window.__tb.interact({ portal: 'padaria_praca' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'rua', null, 20_000, 'rua');
    await sleep(800);
    await profile(page, 'p.coins = 2600;');
    await page.evaluate(() => window.__tb.interact({ prop: 'padaria_porta_fundar' }));
    await page.waitForSelector('.padaria-door input', { timeout: 15_000 });
    await page.fill('.padaria-door input', 'Padaria da Lia');
    await page.keyboard.press('Enter');
    await waitFor(page, () => !!window.__tb.game.room?.padaria, null, 20_000, 'owned padaria');
    await page.waitForSelector('#pad-welcome-ok', { timeout: 10_000 });
    await sleep(400);
    await shot('own_welcome');
    await page.click('#pad-welcome-ok');
    await sleep(1500);
    await shot('own_balcao_room');
    await page.click('#pad-owner-btn');
    await page.waitForSelector('.padaria-book', { timeout: 10_000 });
    await sleep(400);
    await shot('own_owner_menu');
    await page.click('#pad-play');
    await page.waitForSelector('#cr-order', { timeout: 15_000 });
    for (let i = 0; i < 40 && !(await front(page)); i++) await sleep(250);
    await sleep(1600);
    await shot('own_counter_cafe_e_pao');
    await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'quit' }));
    await sleep(600);
    await page.evaluate(() => window.__tb.correria.ui?.destroy());
    await sleep(600);
    await page.click('#pad-owner-btn');
    await page.waitForSelector('[data-upgrade="size2"]', { timeout: 10_000 });
    await page.click('[data-upgrade="size2"]');
    await waitFor(page, () => window.__tb.game.room?.padaria?.size === 2, null, 10_000, 'size 2');
    await page.keyboard.press('Escape');
    await sleep(1500);
    await shot('own_padaria_room_grown');

    // the first-time flow as one storyboard GIF: the sign, each hint, the pour, the end of the practice, the first real customer
    const story = [
      `${name}_02_play_spot_on_the_vitrine.png`,
      `${name}_03_practice_hint_coffee_machine.png`,
      ...fs.readdirSync(FRAMES).filter((f) => f.startsWith(`${name}_practice_coffee_pour_`)).sort().map((f) => path.join('frames', f)),
      `${name}_04_practice_hint_pao.png`,
      `${name}_05_practice_hint_serve.png`,
      `${name}_06_practice_done.png`,
      `${name}_07_first_shift_customer.png`,
      ...fs.readdirSync(FRAMES).filter((f) => f.startsWith(`${name}_first_shift_customer_`)).sort().map((f) => path.join('frames', f)),
    ].map((f) => path.join(SHOTS, f));
    const w = GIF_W[name];
    const frames = await Promise.all(story.map((f) => sharp(f).resize({ width: w }).png().toBuffer()));
    const still = (f) => !f.includes(`${path.sep}frames${path.sep}`);
    await sharp(frames, { join: { animated: true } })
      .gif({ delay: story.map((f) => (still(f) ? 1700 : 140)), loop: 0 })
      .toFile(path.join(SHOTS, `${name}_gif_first_time_flow.gif`));
    log(`${name}_gif_first_time_flow.gif (${frames.length} frames)`);

    assert(!errors.length, `no page errors (${errors.join(' | ')})`);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
