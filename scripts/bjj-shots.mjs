#!/usr/bin/env node
/**
 * Screenshots of "Treino no tatame" (the ten-turn mat loop) and the academy floor, from the solo build:
 *
 *   pnpm build && node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/bjj-shots.mjs     # SHOTS_DIR (default docs/lifesim/shots/bjj), VIEWS=desktop,phone
 *
 * It plays one bout with the best-percent pick, shooting every pick screen and a moment of each resolution, then the end card.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { openBout, playBout, startBout } from './lib/bout-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/bjj');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

async function run(name) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext(VIEW[name])).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  let n = 0;
  const shot = async (label) => {
    const file = `${name}_${String(++n).padStart(2, '0')}_${label}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    log(file);
  };
  try {
    await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}solo&notype=1&tbclockmin=${offsetMinFor(DAY_MIN)}`);
    await page.click('#intro-enter');
    await page.click('#intro-skip');
    await page.waitForSelector('#intro-guest', { state: 'visible' });
    await page.click('#intro-guest');
    await page.fill('#avatar-name', 'Lia');
    await page.click('button:has-text("ela (she)")');
    await page.click('#enter-praca');
    await finishArrival(page);
    await sleep(600);
    await goArea(page, 'rua');
    await goArea(page, 'rua_leste');
    await sleep(800);
    await shot('rua_leste');
    await page.evaluate(() => window.__tb.interact({ portal: 'praca_academia' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'academia', null, 20_000, 'academia');
    await sleep(1500);
    await shot('academia');
    await page.evaluate(() => {
      window.__tb.net.session.profile.coins = 120;
      window.__tb.game.profile.coins = 120;
    });
    await page.evaluate(() => window.__tb.interact({ prop: 'vestiario' }));
    await page.waitForSelector('#dialogue-box[data-dialogue="gi-buy"]', { timeout: 15_000 });
    await shot('gi_buy');
    await page.click('#dialogue-box [data-chip="0"]');
    await waitFor(page, () => window.__tb.game.profile.giOwned, null, 8000, 'gi purchased');
    await sleep(800);
    await shot('gi_on');
    if (process.env.DRILL) {
      // a fresh stripe with its move still to drill: the lesson card, then the end card it leads to
      await page.evaluate(() => {
        window.__tb.net.session.profile.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar'], pendingDrill: 'sleeve_grip' };
      });
      // the pending lesson opens straight from the mat queue, no lobby
      await page.evaluate(() => window.__tb.interact({ prop: 'fila' }));
      await page.waitForSelector('#bout-drill', { timeout: 15_000 });
      await sleep(600);
      await shot('drill');
      await page.click('#bout-drill');
      await page.waitForSelector('#bout-end', { timeout: 15_000 });
      await sleep(800);
      await shot('drill_end');
      if (errors.length) console.log('  ! page errors:', errors);
      return;
    }
    if (process.env.ACADEMY) {
      // a brown belt (140 wins) founds an academy from the elevator, then stands on its floor
      await page.evaluate(() => {
        window.__tb.net.session.profile.bjj = { belt: 'marrom', stripes: 0, wins: 140, unlocked: [] };
        window.__tb.net.session.profile.coins = 500;
      });
      await page.evaluate(() => window.__tb.interact({ prop: 'elevador' }));
      await page.waitForSelector('.academy-dir', { timeout: 15_000 });
      await sleep(400);
      await shot('elevator');
      await page.fill('#academy-name', 'Equipe Ipê');
      await shot('elevator_found_form');
      await page.click('.academy-found button[type="submit"]');
      await waitFor(page, () => window.__tb.game.room?.room === 'andar', null, 20_000, 'academy floor');
      await sleep(1800);
      await shot('floor_owner');
      await page.evaluate(() => window.__tb.interact({ prop: 'andar_brasao' }));
      await page.waitForSelector('.academy-look', { timeout: 15_000 });
      await page.click('.academy-look button[data-id="azul"]');
      await sleep(300);
      await shot('floor_look_editor');
      await page.click('.academy-look button[type="submit"]');
      await sleep(800);
      // train on the academy's own mat
      await page.evaluate(() => window.__tb.interact({ prop: 'andar_tatame' }));
      await page.waitForSelector('#bout[data-phase="lobby"]', { timeout: 15_000 });
      await sleep(900);
      await shot('floor_bout_lobby');
      await startBout(page);
      await sleep(4000);
      await shot('floor_bout');
      if (errors.length) console.log('  ! page errors:', errors);
      return;
    }
    await openBout(page);
    await sleep(900);
    await shot('lobby');
    await startBout(page);
    let picks = 0;
    const probe = setInterval(() => void page.evaluate(() => `${document.querySelector('#bout')?.getAttribute('data-phase')} | ${document.querySelector('#bout-top')?.textContent} | ${document.querySelector('#bout-body')?.textContent?.slice(0, 90)}`).then((t) => process.env.PROBE && console.log('    ~', t)).catch(() => {}), 1000);
    const result = await playBout(page, {
      pick: 'bold',
      onBeat: async ({ phase }) => {
        if (phase !== 'pick' || picks > 5) return;
        picks++;
        await sleep(200);
        await shot(`pick_${picks}`);
        // a moment into the resolution that follows
        setTimeout(() => void page.screenshot({ path: path.join(SHOTS, `${name}_resolve_${picks}.png`) }).catch(() => {}), 1100);
      },
    });
    clearInterval(probe);
    log('result', result.winner, result.reason, `${result.moves} moves`);
    await sleep(1500);
    await shot('end');
    if (errors.length) console.log('  ! page errors:', errors);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
