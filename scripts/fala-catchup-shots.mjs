#!/usr/bin/env node
/**
 * Screenshots (and a smoke check) of the Fala chip, the feedback form, its thank-you, and Júlia's catch-up popup.
 *
 *   pnpm build && PHASE=after node scripts/fala-catchup-shots.mjs     # BASE_URL to use a running server instead of its own
 *
 * A real server (the form posts to /api/feedback). A fresh account already has the camera, so the popup is shown by replaying its
 * own profile with `hasCamera: false` through the client's message handlers; taking it asks the server, which answers "have" and
 * changes nothing. Shots land in docs/lifesim/shots/opus-polish/fala-catchup/ as `${PHASE}_*.png`.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { sleep } from './lib/meveum-play.mjs';

const PHASE = process.argv[2] ?? process.env.PHASE ?? 'after';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'docs/lifesim/shots/opus-polish/fala-catchup');
const CHROME = findChrome();
if (!CHROME) {
  console.error('Chrome/Chromium not found: set CHROME_PATH');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  '1280x800': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const log = (...a) => console.log('  ·', ...a);

async function enter(page, guest) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  if (guest) {
    await page.click('#intro-guest');
  } else {
    await page.click('#intro-tab-register');
    await page.fill('#intro-email', `fala+${Date.now().toString(36)}@exemplo.com`);
    await page.fill('#intro-password', 'pao-de-queijo-2026');
    await page.click('#intro-submit');
  }
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '10:30', weather: 'sol' }));
  await sleep(900);
}

const quiet = (page) => page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());
const shot = async (page, name, size) => {
  const file = path.join(SHOTS, `${PHASE}_${name}_${size}.png`);
  await page.screenshot({ path: file });
  log('shot', path.relative(process.cwd(), file));
};

/** No BASE_URL: start the built server on a temp DATA_DIR and stop it afterwards (needs `pnpm build`). */
async function ownServer() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const port = Number(process.env.FALA_PORT ?? 8799);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(root, 'apps/server/dist/index.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'tb-fala-')) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return { base, stop: () => child.kill() };
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  child.kill();
  throw new Error('server did not come up');
}

const server = process.env.BASE_URL ? { base: process.env.BASE_URL, stop: () => {} } : await ownServer();
const BASE = server.base;
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  for (const [size, opts] of Object.entries(VIEW)) {
    // multiplayer is account-only, so the form shows the signed-in line instead of the contact field
    const page = await browser.newPage(opts);
    log(size, 'enter');
    await enter(page, false);
    await quiet(page);
    await shot(page, 'hud', size);

    await page.click('#btn-feedback');
    await page.waitForSelector('#feedback-text', { timeout: 5_000 });
    await sleep(400);
    await shot(page, 'fala-form', size);
    await page.fill('#feedback-text', 'A porta da padaria emperrou um pouquinho, mas eu adorei o pão de queijo!');
    await page.click('[data-feedback-cat="love"]');
    await sleep(250);
    await shot(page, 'fala-filled', size);
    await page.click('#feedback-send');
    await page.waitForSelector('#feedback-thanks-close', { timeout: 8_000 });
    await sleep(700);
    await shot(page, 'fala-thanks', size);
    await page.click('#feedback-thanks-close');
    await page.waitForSelector('#feedback-thanks-close', { state: 'detached', timeout: 5_000 });

    // Escape closes the form mid-play
    await page.click('#btn-feedback');
    await page.waitForSelector('#feedback-text', { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#feedback-text', { state: 'detached', timeout: 5_000 });

    // Júlia's catch-up popup
    await quiet(page);
    await page.evaluate(() => {
      const tb = window.__tb;
      const msg = { t: 'profile', profile: { ...tb.game.profile, hasCamera: false } };
      for (const h of tb.net.handlers) h(msg);
    });
    await page.waitForSelector('#grant-offer #grant-accept', { timeout: 5_000 });
    await sleep(1600);
    await shot(page, 'catchup', size);
    await page.click('#grant-accept');
    await sleep(260);
    await shot(page, 'catchup-give', size);
    await page.waitForSelector('#grant-offer', { state: 'detached', timeout: 5_000 });
    await page.close();
  }
} finally {
  await browser.close();
  server.stop();
}
console.log('fala-catchup shots ✓');
