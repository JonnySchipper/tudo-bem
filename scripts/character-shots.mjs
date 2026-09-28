#!/usr/bin/env node
/**
 * Character review shots (TB Art character redesign v1): studio lineups + in-game closeups.
 *
 *   VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
 *   SHOTS_DIR=docs/art/characters-v1/after node scripts/character-shots.mjs
 *
 * Writes sheet_<lineup>.png (npcs, crowd, hats, creator, poses) from /art.html, then plays the solo
 * build at 1280×800 for full-frame shots and 2× closeups of the crowd, Júlia, Nanda and Seu Carlos.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/tudo-bem/';
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? 'docs/art/characters-v1/after';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---- 1. studio lineups
{
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
  // Only the characters section: the full studio can OOM-crash headless Chrome on a busy box
  await page.goto(`${BASE}art.html?art=live&only=characters`);
  await page.waitForFunction(() => window.__artReady, null, { timeout: 60_000 });
  const figs = await page.$$('section[data-cat="characters"] figure');
  for (const f of figs) {
    const key = (await f.$eval('code', (c) => c.textContent)).split(' ')[0].replace('characters/', '');
    await f.screenshot({ path: path.join(OUT, `sheet_${key}.png`) });
    console.log('  · sheet', key);
  }
  await page.close();
}

// ---- 2. in-game
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));

async function clickTile(x, y, lift = 0) {
  const p = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);
  const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
  await page.mouse.click(p.px, p.py - lift * scale);
}

async function shot(name, clip) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });
  console.log('  ·', name);
}

/** 2× closeup around a floor point (client px), framed so a standing avatar + plate fit. */
async function closeup(name, px, py, w = 300, h = 230) {
  // Idle speech bubbles would cover the NPC being reviewed
  await page.evaluate(() => {
    window.__tb.game.npcBubbles.clear();
    for (const a of window.__tb.game.avatars.values()) a.bubbles = [];
  });
  await sleep(120);
  const x = Math.max(0, Math.min(1280 - w, px - w / 2));
  const y = Math.max(0, Math.min(800 - h, py - h * 0.72));
  await shot(name, { x, y, width: w, height: h });
}

const tileClient = (x, y) => page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);

await page.goto(BASE);
await page.waitForSelector('#birth-month');
await page.selectOption('#birth-month', '5');
await page.selectOption('#birth-year', '1995');
await page.click('#age-next');
await page.waitForSelector('#avatar-name');
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');
await page.check('#confirm-18');
await page.click('button:has-text("Black power")').catch(() => {});
await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = 0)));
await sleep(3000);
await shot('00_creator');
const prev = await page.$('.creator .preview');
if (prev) await prev.screenshot({ path: path.join(OUT, '00_creator_preview.png') });

await page.click('#enter-praca');
await page.waitForFunction(() => window.__tb.game.room?.room === 'praca');
await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 5, null, { timeout: 15_000 }).catch(() => {});
await sleep(9000);
await page.evaluate(() => window.__tb.net.send({ t: 'buy', kind: 'hat', itemId: 'chapeu_palha' }));
await page.evaluate(() => window.__tb.net.send({ t: 'equipHat', hatId: 'chapeu_palha' }));
await clickTile(8, 6);
await sleep(3000);
await shot('01_praca');
await shot('01_praca_zoom', { x: 330, y: 110, width: 720, height: 540 });

// Crowd closeup: frame the CPUs' centroid.
const crowd = await page.evaluate(() => {
  const r = window.__tb.renderer;
  const now = performance.now();
  return [...window.__tb.game.avatars.values()].map((a) => {
    const p = r.avatarPos(a, now);
    return window.__tb.tileToClient(p.x, p.y);
  });
});
if (crowd.length) {
  const cx = crowd.reduce((s, p) => s + p.px, 0) / crowd.length;
  const cy = crowd.reduce((s, p) => s + p.py, 0) / crowd.length;
  await closeup('02_crowd_zoom', cx, cy + 60, 560, 380);
}
const julia = await tileClient(8, 4);
await closeup('03_julia_zoom', julia.px, julia.py);
const nanda = await tileClient(12, 5);
await closeup('04_nanda_zoom', nanda.px, nanda.py, 320, 240);

// Hat shop (Nanda)
await clickTile(12, 5, 40);
await page.waitForSelector('[data-modal="shop"], .panel.shop, [data-modal="hats"]', { timeout: 15_000 }).catch(() => {});
await sleep(1200);
await shot('05_hat_shop');
await page.keyboard.press('Escape');
await sleep(400);

// Padaria + Seu Carlos
await clickTile(5, 0, 40);
await page.waitForFunction(() => window.__tb.game.room?.room === 'padaria', null, { timeout: 20_000 });
await sleep(2500);
await shot('06_padaria');
const carlos = await tileClient(3, 1);
await closeup('07_carlos_zoom', carlos.px, carlos.py + 10, 320, 250);
// SKIP_DIALOGUE=1: the 2× Conversa panel screenshot can OOM-crash headless Chrome on a busy box
if (!process.env.SKIP_DIALOGUE) {
  await clickTile(3, 1, 40);
  await page.waitForSelector('#dialogue, .conversa-portrait', { timeout: 15_000 }).catch(() => {});
  await sleep(1500);
  await shot('08_carlos_dialogue');
  const portrait = await page.$('#dialogue .portrait, .conversa-portrait');
  if (portrait) await portrait.screenshot({ path: path.join(OUT, '08b_carlos_portrait.png') });
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('.conversa-header .close-btn, #dialogue .ghost')?.click());
  await sleep(400);
}

// Counter stool (back view, seated at the counter)
await clickTile(5, 3, 10);
await sleep(4000);
const stool = await tileClient(5, 3);
await closeup('09_counter_stool_zoom', stool.px, stool.py, 340, 260);

// Kitnet daylight on the player
await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'kitnet' }));
await page.waitForFunction(() => window.__tb.game.room?.room === 'kitnet', null, { timeout: 15_000 }).catch(() => {});
await sleep(1500);
const me = await page.evaluate(() => {
  const t = window.__tb.selfTile();
  return t ? window.__tb.tileToClient(t.tile.x, t.tile.y) : null;
});
if (me) await closeup('10_kitnet_player_zoom', me.px, me.py, 300, 230);

await browser.close();
