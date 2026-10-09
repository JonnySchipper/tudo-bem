#!/usr/bin/env node
/**
 * The flight in (the new-account cutscene, ui/flightIntro.ts), shot by shot: a fresh solo account goes through the avatar creator, then
 * the script plays the whole cutscene, answering Lia and buckling the seatbelt, and saves a picture of every beat.
 *
 *   pnpm --filter @tudobem/client dev -- --port 5199 &
 *   BASE_URL='http://localhost:5199/?solo' SHOTS_DIR=/tmp/flight node scripts/flight-shots.mjs     # WIDTH, HEIGHT optional
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5199/?solo';
const SHOTS = process.env.SHOTS_DIR ?? 'shots-flight';
const W = Number(process.env.WIDTH ?? 1280);
const H = Number(process.env.HEIGHT ?? 800);
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (name) => page.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}_${name}.png`) });

await page.goto(BASE);
await page.waitForSelector('#intro-enter', { timeout: 20_000 });
await page.click('#intro-enter');
await page.waitForSelector('#intro-skip', { timeout: 12_000 });
await page.click('#intro-skip');
await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
await page.click('#intro-guest');
await page.waitForSelector('#avatar-name', { timeout: 15_000 });
await page.fill('#avatar-name', 'Jonny');
await page.click('#enter-praca');
await page.waitForSelector('.flight-intro', { timeout: 15_000 });
const tapOn = () => page.mouse.click(W / 2, H * 0.3);
const boxDone = () => page.waitForSelector('.fl-box.is-done, .fl-choices.is-on', { timeout: 20_000 });

await sleep(2600);
await shot('prologue');
for (let i = 0; i < 3; i++) {
  await sleep(1500);
  await tapOn();
  await sleep(700);
}
await page.waitForSelector('.fl-letter.is-read', { timeout: 15_000 });
await sleep(800);
await shot('letter');
await tapOn();
await sleep(1500);
await shot('packed');
for (let i = 0; i < 2; i++) {
  await sleep(1400);
  await tapOn();
  await sleep(600);
}
await sleep(3500);
await shot('night-flight');
await sleep(3500);
await shot('night-flight-2');
await tapOn();
await sleep(1200);
await shot('iris');
// the cabin: answer everything, shoot every beat
for (let i = 0; i < 40; i++) {
  if (await page.$('.fl-belt')) break;
  await boxDone();
  await sleep(300);
  await shot(`cabin-${i}`);
  if (await page.$('.fl-choices.is-on .fl-choice')) {
    const k = await page.$$eval('.fl-choices.is-on .fl-choice', (b) => b.length);
    await page.click(`.fl-choices.is-on .fl-choice >> nth=${i % k}`);
    await sleep(500);
    await shot(`cabin-${i}-reply`);
    await sleep(900);
  } else {
    await tapOn();
    await sleep(400);
  }
}
await page.waitForSelector('.fl-belt', { timeout: 10_000 });
await sleep(400);
await shot('seatbelt');
await page.click('.fl-belt', { force: true });
await page.waitForFunction(() => /Perfeito/.test(document.querySelector('.fl-box .fl-pt')?.textContent ?? ''));
await boxDone();
await shot('seatbelt-done');
await tapOn();
for (const [ms, name] of [[2600, 'lia-leaves'], [1600, 'dawn-out'], [2200, 'descent'], [1800, 'clouds'], [2000, 'hills'], [2000, 'approach'], [1500, 'touchdown'], [1500, 'braking']]) {
  await sleep(ms);
  await shot(name);
}
await page.waitForSelector('.fl-title.is-ready', { timeout: 15_000 });
await sleep(600);
await shot('title');
await tapOn();
await page.waitForFunction(() => !document.querySelector('.flight-intro'), null, { timeout: 10_000 });
await page.waitForFunction(() => window.__tb?.game?.room?.room === 'desembarque', null, { timeout: 15_000 });
await sleep(1500);
await shot('arrivals-hall');
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
