#!/usr/bin/env node
/**
 * Screenshots of the espremedor in Correria no Balcão (the real counter, not the contact sheet).
 *
 *   pnpm build
 *   PORT=8820 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8820 node scripts/juicer-shots.mjs
 *
 * The built client is served by that server. The page runs the world in-page (`?solo&rolltest&crtest`), the same way
 * `scripts/correria-shots.mjs` does, so the profile can be seeded: 10 completed shifts puts suco de laranja on the menu
 * (the step after pão na chapa) and `taught` lists the old suco card but not `espremedor`, so the one-time juicer lesson shows.
 * Shots land in docs/lifesim/shots/juicer/: lesson, cycle (the pour, glass filling, line visible), served (glass at the line, the green
 * lamp lit, "na linha!"), taken (the glass hopping onto the tray) and spill (one orange too many: the glass overflows).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { DAY_MIN, offsetMinFor, requirePinnedClock } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { assert, sleep, startShift, waitFor } from './lib/correria-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:8820/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/juicer');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWS = [
  { file: '1280x800', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { file: '390x844', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
];
const log = (...a) => console.log('  ·', ...a);

/** Old save that already learned suco as a grab: the juicer card (`espremedor`) is still untaught. */
const TAUGHT_BEFORE_JUICER = ['cafe', 'pao', 'agua', 'pao_de_queijo', 'cafe_com_leite', 'pao_na_chapa', 'suco_de_laranja', 'where'];

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
  await sleep(600);
}

function seedSuco(page) {
  return page.evaluate((taught) => {
    const p = window.__tb.net.debugSession().profile;
    // 10 completed shifts: café … pão na chapa, then suco de laranja. No `espremedor` in taught.
    p.correria = { stars: 4, shifts: 10, best: 80, taught };
  }, TAUGHT_BEFORE_JUICER);
}

/**
 * Pause on the pour of the second orange. The glass only fills during pour, and the first orange's
 * `prev` is 0, so a cut frame is an empty glass. One finished orange leaves juice in the cup; the next pour shows it rising.
 */
async function freezeMidCycle(page) {
  const step = await page.evaluate(() => new Promise((resolve) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const stepOf = () => document.querySelector('#cr-juicer')?.dataset.step ?? '';
    const juice = () => window.__tb.correria.feed.snap?.juice ?? null;
    const click = () => document.querySelector('#cr-juicer')?.click();
    (async () => {
      click();
      const idleBy = performance.now() + 2500;
      while (stepOf() === 'idle' && performance.now() < idleBy) await sleep(30);
      while (stepOf() !== 'idle' && performance.now() < idleBy + 1500) await sleep(30);
      click();
      const started = performance.now();
      let pourAt = 0;
      const tick = () => {
        const step = stepOf();
        if (step === 'pour' && !pourAt) pourAt = performance.now();
        // on the pour (the stream is on screen); software GL frames are slow, so freeze on the first pour frame seen
        if (pourAt) {
          window.__tb.renderer.scene.scene.pause();
          const j = juice();
          resolve({ step, fill: j?.fill ?? null, prev: j?.prev ?? null });
          return;
        }
        if (performance.now() - started > 2500) resolve({ step: step || 'timeout', fill: juice()?.fill ?? null, prev: juice()?.prev ?? null });
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })();
  }));
  return step;
}

function resume(page) {
  return page.evaluate(() => window.__tb.renderer.scene.scene.resume());
}

/** Drop oranges until the glass is at or over the line and the machine is idle again. */
async function fillToLine(page) {
  const got = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = () => document.querySelector('#cr-juicer')?.dataset.step ?? '';
    const juice = () => window.__tb.correria.feed.snap?.juice ?? null;
    const ready = () => {
      const j = juice();
      return !!(j && j.fill >= 0.8 && step() === 'idle');
    };
    for (let i = 0; i < 6 && !ready(); i++) {
      const before = juice()?.oranges ?? 0;
      document.querySelector('#cr-juicer')?.click();
      const until = performance.now() + 2500;
      while ((juice()?.oranges ?? 0) <= before && performance.now() < until) await sleep(40);
      const idleBy = performance.now() + 1500;
      while (step() !== 'idle' && performance.now() < idleBy) await sleep(30);
    }
    const j = juice();
    return { fill: j?.fill ?? null, oranges: j?.oranges ?? 0, step: step(), state: document.querySelector('#cr-juice-glass')?.dataset.state ?? '' };
  });
  return got;
}

async function run(view) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext(view);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (label) => {
    const file = `${label}_${view.file}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  try {
    await enterPadaria(page);
    await seedSuco(page);
    await startShift(page);
    const opened = await page.evaluate(() => ({
      menu: window.__tb.correria.feed.snap?.menu ?? [],
      lesson: window.__tb.correria.feed.snap?.lesson?.id ?? null,
    }));
    assert(opened.menu.includes('suco_de_laranja'), `suco on the menu (${opened.menu.join(',')})`);
    assert(opened.lesson === 'espremedor', `juicer lesson (${opened.lesson})`);
    await page.waitForSelector('#cr-lesson', { timeout: 5000 });
    // the wave banner fades in about 2s; the lesson card stays until Entendi
    await sleep(2200);
    const title = await page.textContent('#cr-lesson h3 .pt');
    assert(title?.includes('espremedor'), `lesson title (${title})`);
    const frame = await page.evaluate(() => {
      const info = window.__tb.renderer?.scene?.info?.() ?? {};
      const lesson = document.querySelector('#cr-lesson')?.getBoundingClientRect();
      const ok = document.querySelector('#cr-lesson .cr-lesson-ok')?.getBoundingClientRect();
      return {
        zoom: info.zoom,
        top: window.__tb.correria.feed.topPx,
        box: window.__tb.correria.feed.boxPx,
        lessonH: lesson ? Math.round(lesson.height) : 0,
        okTop: ok ? Math.round(ok.top) : null,
        okBottom: ok ? Math.round(ok.bottom) : null,
        lessonBottom: lesson ? Math.round(lesson.bottom) : null,
      };
    });
    log('frame', JSON.stringify(frame));
    assert(frame.okBottom != null && frame.lessonBottom != null && frame.okBottom <= frame.lessonBottom + 1, 'Entendi is inside the lesson card');
    await shot('lesson');

    await page.evaluate(() => document.querySelector('#cr-lesson .cr-lesson-ok')?.click());
    await page.waitForSelector('#cr-lesson', { state: 'detached', timeout: 3000 });
    await page.waitForFunction(() => {
      const w = document.querySelector('.cr-wave');
      return !w || getComputedStyle(w).opacity === '0';
    }, null, { timeout: 4000 }).catch(() => {});
    await sleep(200);

    const mid = await freezeMidCycle(page);
    log('cycle', JSON.stringify(mid));
    assert(mid.step === 'cut' || mid.step === 'press' || mid.step === 'pour', `mid-cycle frame (${mid.step})`);
    await shot('cycle');
    await resume(page);

    const glass = await fillToLine(page);
    log('served', JSON.stringify(glass));
    assert(glass.fill >= 0.8 && glass.fill <= 1.2, `glass at the line (${glass.fill})`);
    assert(glass.step === 'idle', `machine idle on the finished glass (${glass.step})`);
    assert(glass.state === 'ready', `glass ready (${glass.state})`);
    await sleep(250);
    const lamp = await page.evaluate(() => document.querySelector('#cr-juicer')?.dataset.frame ?? '');
    assert(lamp === 'ready', `green lamp on the finished glass (${lamp})`);
    await shot('served');

    // take it: the glass hops off the drip tray onto the tray (freeze it in the air)
    const flying = await page.evaluate(() => new Promise((resolve) => {
      const before = window.__tb.correria.feed.snap?.tray.length ?? 0;
      document.querySelector('#cr-juice-glass')?.click();
      const until = performance.now() + 2500;
      const tick = () => {
        const tray = window.__tb.correria.feed.snap?.tray ?? [];
        if (tray.length > before) {
          setTimeout(() => {
            window.__tb.renderer.scene.scene.pause();
            resolve({ tray });
          }, 120);
        } else if (performance.now() > until) resolve({ tray });
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));
    log('taken', JSON.stringify(flying));
    assert(flying.tray.includes('suco_de_laranja'), `suco on the tray (${flying.tray.join(',')})`);
    await shot('taken');
    await resume(page);
    await sleep(700);

    // overfill one: keep feeding the machine past the line until the glass spills, freeze on the overflow
    const spill = await page.evaluate(() => new Promise((resolve) => {
      const fx = () => document.querySelector('#cr-juice-glass')?.dataset.fx ?? '';
      const step = () => document.querySelector('#cr-juicer')?.dataset.step ?? '';
      const started = performance.now();
      let taps = 0;
      const tick = () => {
        if (fx() === 'spill') {
          window.__tb.renderer.scene.scene.pause();
          resolve({ fx: 'spill', taps });
          return;
        }
        if (performance.now() - started > 9000) return resolve({ fx: fx() || 'timeout', taps });
        if (step() === 'idle' && fx() === '') {
          document.querySelector('#cr-juicer')?.click();
          taps++;
        }
        setTimeout(tick, 60);
      };
      tick();
    }));
    log('spill', JSON.stringify(spill));
    assert(spill.fx === 'spill', `the glass overflowed (${spill.fx})`);
    await shot('spill');
    await resume(page);

    const bad = errors.filter((e) => !/WebGL|GL_INVALID|gpu/i.test(e));
    assert(!bad.length, `no page errors (${bad.join(' | ')})`);
  } finally {
    await browser.close();
  }
}

await requirePinnedClock(BASE, { target: DAY_MIN });
for (const v of VIEWS) {
  console.log(`\n${v.file}`);
  await run(v);
}
console.log('\nshots in', SHOTS);
