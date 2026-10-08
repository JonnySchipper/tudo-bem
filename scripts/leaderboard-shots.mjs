#!/usr/bin/env node
/**
 * Praça leaderboard screenshots (solo build).
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 / &
 *   SHOTS_DIR=docs/lifesim/shots/leaderboards node scripts/leaderboard-shots.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const SHOTS = process.env.SHOTS_DIR ?? 'docs/lifesim/shots/leaderboards';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found');
fs.mkdirSync(SHOTS, { recursive: true });

async function enterPraca(page, name) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(600);
}

async function seedBoards(page) {
  await page.evaluate(() => {
    const g = window.__tb.game;
    const me = g.profile?.id ?? 'me';
    const meName = g.profile?.name ?? 'Lia';
    g.leaderboards = {
      at: Date.now(),
      words: [
        { rank: 1, id: 'a', name: 'Ana', score: 42 },
        { rank: 2, id: 'b', name: 'Bia', score: 30 },
        { rank: 2, id: 'c', name: 'Caio', score: 30 },
        { rank: 4, id: 'd', name: 'Duda', score: 18 },
        { rank: 5, id: me, name: meName, score: 12, you: true },
      ],
      streak: [
        { rank: 1, id: 'b', name: 'Bia', score: 14 },
        { rank: 2, id: 'a', name: 'Ana', score: 9 },
        { rank: 3, id: 'd', name: 'Duda', score: 4 },
        { rank: 4, id: me, name: meName, score: 2, you: true },
      ],
    };
    g.emit('leaderboards');
  });
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

async function shoot(viewport, tag) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await enterPraca(page, 'Lia');
    await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
    await page.evaluate(() => window.__tb.walkTo(16, 8));
    await sleep(1600);
    await page.screenshot({ path: path.join(SHOTS, `praca-board-${tag}.png`) });

    await seedBoards(page);
    // Patch net.send so refresh keeps seeded data
    await page.evaluate(() => {
      const net = window.__tb.net;
      const orig = net.send.bind(net);
      net.send = (m) => {
        if (m && m.t === 'leaderboards') {
          window.__tb.game.emit('leaderboards');
          return;
        }
        return orig(m);
      };
      window.__tb.openLeaderboards();
    });
    await page.waitForSelector('[data-modal="leaderboards"]', { timeout: 5000 });
    await sleep(250);
    await page.screenshot({ path: path.join(SHOTS, `list-open-${tag}.png`) });
  } finally {
    await context.close();
  }
}

try {
  await shoot({ width: 1280, height: 800 }, '1280');
  await shoot({ width: 390, height: 844 }, '390');
  console.log('leaderboard shots ->', SHOTS);
} catch (e) {
  console.error('leaderboard shots failed:', e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
