#!/usr/bin/env node
/**
 * Screenshots of the Escola lessons (#125): the home (streak, goal, plate, path), each exercise kind, a verdict, the end card, the new
 * nameplate reveal, the HUD goal chip, and the five plate colours overhead. From the solo build:
 *
 *   pnpm build && node scripts/serve-static.mjs apps/client/dist 9211 / &
 *   BASE_URL=http://localhost:9211/ node scripts/escola-shots.mjs     # SHOTS_DIR (default docs/lifesim/shots/escola), VIEWS=desktop,phone
 *
 * The player's escola is seeded through the in-page world's test hook (`testSeedEscola`: 14 words mastered, 3 one box short), so one
 * lesson crosses into the Amarela plate. Answers are read from the in-page server's lesson (solo only); the client itself never has them.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:9211/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/escola');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = (...a) => console.log('  ·', ...a);

/** The exercise on screen and its key, from the in-page world (solo). */
const lessonKey = (page) =>
  page.evaluate(() => {
    const net = window.__tb.net;
    const l = net.world.escola.lessons.get(net.session);
    return l?.cur ? { kind: l.cur.ex.kind, key: l.cur.key } : null;
  });

/** Answer the exercise on screen, right (or wrong when `miss`), through the panel's own controls. */
async function answer(page, miss) {
  const cur = await lessonKey(page);
  assert(cur, 'a lesson exercise is on screen');
  const { kind, key } = cur;
  if (kind === 'pick' || kind === 'pick_en' || kind === 'listen') {
    const want = kind === 'pick' ? key.pt : key.en;
    const choices = await page.$$eval('#escola-options button', (bs) => bs.map((b) => b.dataset.choice));
    const right = choices.find((c) => c.toLowerCase() === want.toLowerCase());
    const pick = miss ? choices.find((c) => c !== right) : right;
    await page.click(`#escola-options button[data-choice="${pick.replace(/"/g, '\\"')}"]`);
  } else if (kind === 'type') {
    await page.fill('#escola-type', miss ? 'nada' : key.pt);
    await page.click('#escola-check');
  } else if (kind === 'build') {
    const tiles = await page.$$eval('#escola-bank button', (bs) => bs.map((b) => b.textContent));
    const used = new Set();
    const order = key.tiles.map((t) => {
      const i = tiles.findIndex((x, k) => x === t && !used.has(k));
      used.add(i);
      return i;
    });
    if (miss) order.reverse();
    for (const i of order) await page.click(`#escola-bank button[data-tile="${i}"]`);
    await page.click('#escola-check');
  } else if (kind === 'match') {
    for (let pt = 0; pt < key.pairs.length; pt++) {
      await page.click(`#escola-match [data-side="pt"][data-i="${pt}"]`);
      await page.click(`#escola-match [data-side="en"][data-i="${key.pairs[pt]}"]`);
      await sleep(120);
    }
  }
  await page.waitForSelector('#escola-verdict', { timeout: 8_000 });
  return kind;
}

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
    // 20 words: 14 mastered, 3 one box short and due, 3 new; a 6-day streak up to yesterday
    const seeded = await page.evaluate(() => window.__tb.net.world.testSeedEscola('Lia', { words: 20, mastered: 14, ready: 3, streak: 6 }));
    assert(seeded, 'seeded the escola');
    await goArea(page, 'rua_leste');
    await page.evaluate(() => window.__tb.interact({ portal: 'rua_escola' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'escola', null, 30_000, 'escola');
    await sleep(1200);
    await shot('hud_goal_chip');

    await page.evaluate(() => window.__tb.interact({ prop: 'carteira' }));
    await page.waitForSelector('#escola-start', { timeout: 20_000 });
    await sleep(800);
    await shot('home');
    if (name === 'desktop') {
      await page.$eval('#escola-path', (el) => el.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await shot('home_path');
    }

    await page.click('#escola-start');
    const seen = new Set();
    let missed = false;
    for (let step = 0; step < 20; step++) {
      await page.waitForSelector('#escola-lesson, #escola-done', { timeout: 10_000 });
      if (await page.$('#escola-done')) break;
      await sleep(400);
      const cur = await lessonKey(page);
      const first = !seen.has(cur.kind);
      if (first) await shot(`ex_${cur.kind}`);
      // one miss on a new word's pick, for the red verdict (it comes back as a retry)
      const miss = !missed && cur.kind === 'pick';
      await answer(page, miss);
      await sleep(500);
      if (miss) {
        missed = true;
        await shot('verdict_miss');
      } else if (first) await shot(`ok_${cur.kind}`);
      seen.add(cur.kind);
      await page.click('#escola-next');
      await sleep(250);
    }
    await page.waitForSelector('#escola-done', { timeout: 10_000 });
    await sleep(900);
    if (await page.$('#escola-tierup')) {
      await shot('tier_up');
      await page.click('#escola-tierup-ok');
      await sleep(300);
    }
    await shot('done');
    await page.keyboard.press('Escape');
    await sleep(800);

    // the five plates overhead (the HUD chip follows): each colour set on the in-page session and broadcast like a tier-up
    if (name === 'desktop') {
      for (const tier of ['verde', 'amarelo', 'azul', 'roxo', 'dourado']) {
        await page.evaluate((tier) => {
          const net = window.__tb.net;
          net.session.profile.nameplate = tier;
          net.world.broadcastAvatar(net.session);
          net.world.pushProfile(net.session);
        }, tier);
        await sleep(700);
        await shot(`plate_${tier}`);
      }
    }
    if (errors.length) console.log('  ! page errors:', errors);
  } finally {
    await browser.close();
  }
}

for (const v of VIEWS) {
  console.log(`\n${v}`);
  await run(v);
}
