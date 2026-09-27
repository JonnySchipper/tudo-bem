#!/usr/bin/env node
/**
 * Padaria wow + Conversa mesa review shots at 1280×800 (TB Art padaria-wow brief 2026-09-26).
 *
 *   VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
 *   SHOTS_DIR=docs/art/padaria-wow node scripts/padaria-shots.mjs
 *
 * Captures: Padaria (full + counter zoom), Conversa mesa mid-session, Conversa conta stamp.
 * Options: SHOT_QUERY='?art=live' (skip baked sprites), SHOT_DPR=2, DETAIL=1 (counter / case / window
 * close-ups), SHOT_W / SHOT_H (e.g. 390×844 phone), PRE_CHIPS=n (chips tapped before the mesa shot).
 * Static hosting answers POST /api/conversa with an error, so Conversa runs the authored Carlos.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/tudo-bem/';
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? 'docs/art/padaria-wow';
const QUERY = process.env.SHOT_QUERY ?? '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickTile(page, x, y, lift = 0) {
  const p = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);
  const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
  await page.mouse.click(p.px, p.py - lift * scale);
}

async function shot(page, name, clip) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log('  ·', name);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: Number(process.env.SHOT_W ?? 1280), height: Number(process.env.SHOT_H ?? 800) }, deviceScaleFactor: Number(process.env.SHOT_DPR ?? 1) });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
await page.goto(BASE + QUERY);
await page.waitForSelector('#intro-skip');
await page.click('#intro-skip');
await page.waitForSelector('#intro-guest');
await page.click('#intro-guest');
await page.waitForSelector('#avatar-name');
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');
await page.check('#confirm-18');
await page.click('#enter-praca');
await page.waitForFunction(() => window.__tb.game.room?.room === 'praca');
await sleep(800);
await clickTile(page, 5, 0, 40);
await page.waitForFunction(() => window.__tb.game.room?.room === 'padaria', null, { timeout: 15_000 });
await sleep(600);
await clickTile(page, 4, 4);
await sleep(2600);
await shot(page, '01_padaria');
await shot(page, '02_padaria_counter', { x: 300, y: 110, width: 720, height: 540 });
if (process.env.DETAIL) {
  await shot(page, 'd1_counter_carlos', { x: 560, y: 150, width: 440, height: 330 });
  await shot(page, 'd2_case_menu', { x: 840, y: 180, width: 300, height: 320 });
  await shot(page, 'd3_window_cafe', { x: 400, y: 170, width: 340, height: 360 });
}

await clickTile(page, 3, 1, 50);
await page.waitForSelector('[data-modal="conversa"] [data-chip="0"]', { timeout: 12_000 });
await sleep(400);
for (let i = 0; i < Number(process.env.PRE_CHIPS ?? 2); i++) {
  await page.click('[data-modal="conversa"] [data-chip="0"]');
  await sleep(500);
}
await shot(page, '03_conversa_mesa');
for (let i = 0; i < 8; i++) {
  const chip = await page.$('[data-modal="conversa"] [data-chip="0"]');
  if (!chip) break;
  await chip.click();
  await sleep(500);
}
await page.waitForSelector('.conversa-score-card', { timeout: 8_000 }).catch(() => {});
await sleep(400);
await shot(page, '04_conversa_conta');
await browser.close();
