#!/usr/bin/env node
/**
 * Art review screenshots at 1280×800 (TB Art polish brief v2).
 *
 *   VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
 *   SHOTS_DIR=docs/art/polish-v2/after node scripts/shots.mjs
 *
 * Captures: Praça (crowd + hat), Missão do dia kiosk, Padaria, Kitnet with the chair placed.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/tudo-bem/';
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? 'docs/art/polish-v2/after';
const W = Number(process.env.SHOT_W ?? 1280);
const H = Number(process.env.SHOT_H ?? 800);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickTile(page, x, y, lift = 0) {
  const p = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);
  const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
  await page.mouse.click(p.px, p.py - lift * scale);
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  if (process.env.ZOOM) await page.screenshot({ path: path.join(OUT, `${name}_zoom.png`), clip: { x: 330, y: 110, width: 720, height: 540 } });
  console.log('  ·', name);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
await page.goto(BASE);
await page.waitForSelector('#intro-guest');
await page.click('#intro-guest');
await page.waitForSelector('#avatar-name');
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');
await page.check('#confirm-18');
await page.click('button:has-text("Black power")').catch(() => {});
await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = 0)));
await sleep(300);
await shot(page, '00_avatar_creator');
await page.click('#enter-praca');
await page.waitForFunction(() => window.__tb.game.room?.room === 'praca');
await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 4, null, { timeout: 8000 });
await sleep(2500);
await shot(page, '01_praca');

await clickTile(page, 2, 2, 40);
await page.waitForSelector('[data-modal="kiosk"]', { timeout: 12_000 });
await sleep(400);
await shot(page, '02_kiosk_missao');
const take = await page.$('#mission-take');
if (take) {
  await take.click();
  await sleep(500);
  await shot(page, '03_kiosk_taken');
}
await page.keyboard.press('Escape');
await sleep(300);

await page.evaluate(() => window.__tb.net.send({ t: 'buy', kind: 'hat', itemId: 'chapeu_palha' }));
await page.evaluate(() => window.__tb.net.send({ t: 'equipHat', hatId: 'chapeu_palha' }));
await clickTile(page, 8, 6);
await sleep(2500);
await shot(page, '04_praca_walk');

await clickTile(page, 5, 0, 40);
await page.waitForFunction(() => window.__tb.game.room?.room === 'padaria', null, { timeout: 15_000 });
await sleep(1500);
await shot(page, '05_padaria');

await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'kitnet' }));
await page.waitForFunction(() => window.__tb.game.room?.room === 'kitnet', null, { timeout: 15_000 }).catch(() => {});
if ((await page.evaluate(() => window.__tb.game.room?.room)) !== 'kitnet') {
  await clickTile(page, 0, 6, 40);
  await page.waitForFunction(() => window.__tb.game.room?.room === 'praca', null, { timeout: 15_000 });
  await sleep(400);
  await clickTile(page, 0, 4, 40);
  await page.waitForFunction(() => window.__tb.game.room?.room === 'kitnet', null, { timeout: 15_000 });
}
await sleep(800);
await page.click('#btn-decor');
await page.click('[data-furniture="cadeira_madeira"]');
await clickTile(page, 3, 4);
await sleep(400);
await page.click('#decor-panel button.ghost');
await sleep(400);
await clickTile(page, 3, 4, 10);
await sleep(2500);
await shot(page, '06_kitnet');

await browser.close();
