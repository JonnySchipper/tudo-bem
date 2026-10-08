#!/usr/bin/env node
/**
 * Screenshots of "Treino no tatame" (the Academia bout) for DECISIONS / review, from the solo build (the world runs in the page, hint mode):
 *
 *   pnpm build && node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/academia-shots.mjs            # SHOTS_DIR (default docs/lifesim/shots/academia), VIEWS=desktop,phone,land
 *
 * desktop: lobby, the walk-in, the intent choice, challenges of every kind, a transition mid-clip, the Final chance and its prompt,
 * the tap, the win. phone portrait and landscape: lobby, intent, a challenge, the end card (with the measured share of the screen the panel covers).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { answerChallenge, boutPhase, openBout, playBout, startBout } from './lib/bout-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/academia');
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

async function enterAcademia(page) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}solo&rolltest&notype=1&boutintro=4200&boutpace=1&tbclockmin=${offsetMinFor(DAY_MIN)}`);
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
  await goArea(page, 'rua_leste');
  await page.evaluate(() => window.__tb.interact({ portal: 'praca_academia' }));
  await waitFor(page, () => window.__tb.game.room?.room === 'academia', null, 20_000, 'academia');
  await sleep(1500);
}

/** Share of the viewport height the bout panel covers. */
const panelShare = (page) =>
  page.evaluate(() => {
    const p = document.querySelector('#bout');
    return p ? +(p.getBoundingClientRect().height / window.innerHeight).toFixed(3) : 0;
  });

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
    log(file, `panel ${(await panelShare(page)) * 100}%`);
  };
  try {
    await enterAcademia(page);
    await shot('gym');
    await openBout(page);
    await sleep(900);
    await shot('lobby');

    await startBout(page);
    if (name === 'desktop') {
      await sleep(900);
      await shot('intro_walkin');
      await sleep(1700);
      await shot('intro_facing');
    }
    // play: capture a few prompts of different kinds, a transition and the finalização
    const seen = new Set();
    let kinds = 0;
    let transShot = false;
    let transWatch = false;
    let finishShot = false;
    const result = await playBout(page, {
      right: (i) => i % 7 !== 3,
      pick: 'bold',
      onPhase: async (phase) => {
        if (phase === 'intent') {
          const fin = await page.getAttribute('#bout-intents', 'data-finish');
          if (fin === 'true' && !finishShot) {
            finishShot = true;
            await sleep(500);
            await shot('final_chance');
          } else if (!seen.has('intent')) {
            seen.add('intent');
            await sleep(300);
            await shot('intent');
          }
        } else {
          const kind = await page.getAttribute('#bout-challenge', 'data-kind');
          const role = await page.evaluate(() => document.querySelector('.bout-role')?.className ?? '');
          const tag = role.includes('role-finish') ? 'finish' : role.includes('role-escape') ? 'escape' : kind;
          if (!seen.has(tag) && (name === 'desktop' || kinds < 3)) {
            seen.add(tag);
            kinds++;
            await sleep(300);
            await shot(`challenge_${tag}`);
          }
        }
        // a transition clip is short: watch for it right after this answer
        if (name === 'desktop' && !transShot && !transWatch) {
          transWatch = true;
          void (async () => {
            for (let i = 0; i < 60 && !transShot; i++) {
              const mode = await page.evaluate(() => window.__tb.renderer.info()?.bout?.mode).catch(() => null);
              if (mode === 'trans') {
                transShot = true;
                await shot('transition');
                return;
              }
              await sleep(60);
            }
            transWatch = false;
          })();
        }
      },
    });
    log('result', result.winner, result.reason, `${result.answers} answers`);
    await sleep(2200);
    await shot('end');
    const info = await page.evaluate(() => window.__tb.renderer.info()?.bout);
    log('stage', JSON.stringify(info));
    const missing = await page.evaluate(() => window.__tb.artMissing.filter((k) => k.startsWith('bjj/') || k === 'props/placar'));
    assert(missing.length === 0, `bjj art missing: ${missing.join(', ')}`);
    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
    await page.click('#bout-leave');
    await sleep(1200);
    await shot('back_in_gym');
  } finally {
    await browser.close();
  }
}

/**
 * The partner's side of it (desktop): Rafael (a blue belt unlocks him) pins the player on the back with a full pegada, so an escape challenge
 * comes up; the first escape works (back to cem quilos), the second fails and the partner taps the player: the pair is drawn with the colours
 * exchanged (the player stays in white, underneath) and the end card is a loss.
 */
async function runPartner() {
  const v = VIEW.desktop;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext(v)).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let n = 0;
  const shot = async (label) => {
    const file = `partner_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  const poke = () =>
    page.evaluate(() => {
      const b = window.__tb.net.debugBout();
      if (b) Object.assign(b.st, { rung: -4, pegadaB: 3, momentum: -8, top: 'costas' });
    });
  try {
    await enterAcademia(page);
    await page.evaluate(() => {
      window.__tb.net.debugSession().profile.bjj = { belt: 'azul', stripes: 1, wins: 30 };
    });
    await openBout(page);
    await sleep(600);
    await shot('lobby_blue_belt');
    await startBout(page, 'rafael');
    let seenEscape = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 150_000 && !(await page.$('#bout-end'))) {
      await poke();
      const st = await page.evaluate(() => ({ phase: document.querySelector('#bout')?.getAttribute('data-phase'), role: document.querySelector('.bout-role')?.className ?? '', seq: document.querySelector('#bout-challenge')?.getAttribute('data-seq') ?? document.querySelector('#bout-intents')?.getAttribute('data-seq') ?? '' }));
      const key = `${st.phase}:${st.seq}`;
      if (st.phase === 'intent' && !seen.has(key)) {
        seen.add(key);
        await page.waitForTimeout(250);
        await page.click('#bout-intents .bout-intent:first-child');
      } else if (st.phase === 'challenge' && !seen.has(key)) {
        seen.add(key);
        if (st.role.includes('role-escape')) {
          seenEscape++;
          await sleep(500);
          await shot(`escape_prompt_${seenEscape}`);
          await page.waitForTimeout(300);
          await answerChallenge(page, seenEscape === 1);
          await sleep(900);
          await shot(seenEscape === 1 ? 'escaped' : 'tapped_out');
        } else {
          await page.waitForTimeout(300);
          await answerChallenge(page, true);
        }
      } else await sleep(150);
    }
    await page.waitForSelector('#bout-end', { timeout: 20_000 });
    await sleep(1800);
    await shot('end_loss');
    const info = await page.evaluate(() => window.__tb.renderer.info()?.bout);
    log('stage', JSON.stringify(info));
    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
}
const seen = new Set();

/**
 * The player's finish (desktop): the player is put on top with a full pegada, so the Final! chance appears; the prompt, the tap
 * (the partner's hand in the air) and the raised hand follow.
 */
async function runFinish() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext(VIEW.desktop)).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let n = 0;
  const shot = async (label) => {
    const file = `finish_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  const poke = () =>
    page.evaluate(() => {
      const b = window.__tb.net.debugBout();
      if (b) Object.assign(b.st, { rung: 4, pegada: 3, momentum: 0, top: 'montada' });
    });
  const done = new Set();
  try {
    await enterAcademia(page);
    await openBout(page);
    await startBout(page);
    let stage = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 150_000 && !(await page.$('#bout-end'))) {
      if (stage < 1) await poke();
      const st = await page.evaluate(() => ({ phase: document.querySelector('#bout')?.getAttribute('data-phase'), finish: document.querySelector('#bout-intents')?.getAttribute('data-finish'), role: document.querySelector('.bout-role')?.className ?? '', seq: document.querySelector('#bout-challenge')?.getAttribute('data-seq') ?? document.querySelector('#bout-intents')?.getAttribute('data-seq') ?? '' }));
      const key = `${st.phase}:${st.seq}`;
      if (st.phase === 'intent' && !done.has(key)) {
        done.add(key);
        await page.waitForTimeout(300);
        if (st.finish === 'true') {
          stage = 1;
          await sleep(300);
          await shot('chance');
          // the tap is a short beat: watch the stage for it while the prompts are answered
          void (async () => {
            for (let i = 0; i < 1500; i++) {
              const mode = await page.evaluate(() => window.__tb.renderer.info()?.bout?.mode).catch(() => null);
              if (mode === 'finish') {
                await sleep(450);
                await shot('tap');
                return;
              }
              await sleep(40);
            }
          })();
          await page.click('#bout-intents .bout-intent[data-intent="finalizar"]');
        } else await page.click('#bout-intents .bout-intent:first-child');
      } else if (st.phase === 'challenge' && !done.has(key)) {
        done.add(key);
        await page.waitForTimeout(350);
        if (st.role.includes('role-finish')) {
          await shot('prompt');
          await answerChallenge(page, true);
        } else await answerChallenge(page, true);
      } else await sleep(150);
    }
    await page.waitForSelector('#bout-end', { timeout: 20_000 });
    await sleep(2200);
    await shot('win');
    assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`== ${v}`);
  await run(v);
}
if (VIEWS.includes('desktop') && !process.env.NO_EXTRA) {
  console.log('== finish (the player on top)');
  await runFinish();
  console.log('== partner (the other side)');
  await runPartner();
}
console.log('done');
void boutPhase;
