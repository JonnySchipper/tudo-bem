#!/usr/bin/env node
/**
 * Screenshots of the admin Testes section.
 *
 *   BASE_URL=http://127.0.0.1:8799 node scripts/admin-testes-shots.mjs
 *
 * A real server: the admin password check uses node:crypto, which the solo page cannot.
 * Local default password is tb-admin-praca (TB_ADMIN_PASSWORD unset, not production).
 * Shots land in docs/lifesim/shots/admin/.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { sleep } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8799';
const SHOTS = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'docs/lifesim/shots/admin');
const CHROME = findChrome();
if (!CHROME) {
  console.error('Chrome/Chromium not found: set CHROME_PATH');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

const VIEW = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const log = (...a) => console.log('  ·', ...a);

function startUrl() {
  return `${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`;
}

async function enter(page) {
  await page.goto(startUrl());
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  if (BASE.includes('solo')) {
    await page.click('#intro-guest');
  } else {
    await page.click('#intro-tab-register');
    await page.fill('#intro-email', `testes+${Date.now().toString(36)}@exemplo.com`);
    await page.fill('#intro-password', 'pao-de-queijo-2026');
    await page.click('#intro-submit');
  }
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(600);
}

async function openTestes(page, phone) {
  if (phone) {
    await page.click('#btn-burger');
    await page.click('#btn-credits');
  } else {
    await page.click('#btn-menu');
    await page.click('#btn-credits');
  }
  await page.click('#credits-admin-door');
  await page.fill('#admin-password', 'tb-admin-praca');
  await page.click('#admin-login-go');
  await page.waitForSelector('#admin-testes', { timeout: 8_000 });
  await page.click('#admin-test-belt-azul');
  await page.waitForFunction(() => document.getElementById('hud-belt')?.getAttribute('aria-label')?.includes('azul'), null, { timeout: 8_000 });
  await page.click('#admin-test-stripe-plus');
  await page.waitForFunction(() => document.getElementById('hud-belt')?.getAttribute('aria-label')?.includes('1 grau'), null, { timeout: 8_000 });
  await page.waitForSelector('.wl-belt.belt-azul', { timeout: 8_000 });
  await page.locator('#admin-testes').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());
  await sleep(200);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
for (const [name, opts] of Object.entries(VIEW)) {
  const page = await browser.newPage(opts);
  log(name, 'enter');
  await enter(page);
  log(name, 'testes');
  await openTestes(page, name === 'phone');
  const file = path.join(SHOTS, name === 'desktop' ? 'testes-1280x800.png' : 'testes-390x844.png');
  await page.screenshot({ path: file });
  log('shot', file);
  await page.close();
}
await browser.close();
