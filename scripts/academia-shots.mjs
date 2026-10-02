#!/usr/bin/env node
/**
 * Screenshots of "Treino no tatame" (the Academia bout) for DECISIONS / review, from the solo build (the world runs in the page, hint mode):
 *
 *   pnpm build && node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/academia-shots.mjs            # SHOTS_DIR (default docs/lifesim/shots/academia), VIEWS=desktop,phone,land
 *
 * desktop: lobby, the walk-in, the intent choice, challenges of every kind, a transition mid-clip, the finalização chance and its prompt,
 * the tap, the win. phone portrait and landscape: lobby, intent, a challenge, the end card (with the measured share of the screen the panel covers).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { answerChallenge, boutPhase, openBout, playBout, startBout } from './lib/bout-play.mjs';

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
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}solo&rolltest&notype=1&boutintro=4200&tbclockmin=${offsetMinFor(DAY_MIN)}`);
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
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 20_000, 'praça');
  await sleep(800);
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
            await shot('finalizacao_chance');
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
        if (name === 'desktop' && !transShot) {
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

for (const v of VIEWS) {
  console.log(`== ${v}`);
  await run(v);
}
console.log('done');
void boutPhase;
void answerChallenge;
