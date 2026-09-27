#!/usr/bin/env node
/**
 * Padaria Art deltas v4 evidence at Art's Fly framing: 1024×640, DPR 1 (what the pass bar is judged on).
 *
 *   VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
 *   SHOTS_DIR=docs/art/padaria-deltas-v4/after node scripts/padaria-v4-shots.mjs
 *
 * Writes the full room plus one native-resolution crop per Art check (glass case, floor AO at the wall
 * and counter feet, register tray, salgados case) and a 3× nearest-neighbour blow-up of each crop, so
 * the review sees exactly the game pixels — no DPR-2 re-render flattering the detail.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/tudo-bem/';
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? 'docs/art/padaria-deltas-v4/after';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
const tile = (x, y) => page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [x, y]);

await page.goto(BASE);
await page.waitForSelector('#intro-guest');
await page.click('#intro-guest');
await page.waitForSelector('#avatar-name');
await page.fill('#avatar-name', 'Jonny');
await page.click('button:has-text("ele (he)")');
await page.check('#confirm-18');
await page.click('#enter-praca');
await page.waitForFunction(() => window.__tb.game.room?.room === 'praca');
await sleep(800);
{
  const p = await tile(5, 0);
  const s = await page.evaluate(() => window.__tb.renderer.cam.scale);
  await page.mouse.click(p.px, p.py - 40 * s);
}
await page.waitForFunction(() => window.__tb.game.room?.room === 'padaria', null, { timeout: 15_000 });
await sleep(600);
{
  // Stand by the mesas, clear of the counter run and the left wall foot.
  const p = await tile(4, 7);
  await page.mouse.click(p.px, p.py);
}
await sleep(2600);
// Hide DOM chrome (toasts, first-steps panel) so crops show only the canvas.
await page.addStyleTag({ content: 'body > *:not(canvas):not(#game):not(.game):not(#app) { visibility: hidden !important; } .toast, .checklist, .first-steps { display: none !important; }' });
await sleep(200);
fs.mkdirSync(OUT, { recursive: true });
await page.screenshot({ path: path.join(OUT, '00_padaria_full.png') });
console.log('  · 00_padaria_full');

const scale = await page.evaluate(() => window.__tb.renderer.cam.scale);
/** Clip box around a tile point, sizes in world units (scaled by the camera). */
async function crop(name, tx, ty, w, h, lift = 0) {
  const p = await tile(tx, ty);
  const clip = { x: Math.round(p.px - (w * scale) / 2), y: Math.round(p.py - (h / 2 + lift) * scale), width: Math.round(w * scale), height: Math.round(h * scale) };
  const buf = await page.screenshot({ clip });
  fs.writeFileSync(path.join(OUT, `${name}.png`), buf);
  // 3× nearest-neighbour blow-up of the same pixels.
  const zoom = await ctx.newPage();
  await zoom.setViewportSize({ width: clip.width * 3, height: clip.height * 3 });
  await zoom.setContent(`<body style="margin:0"><img style="image-rendering:pixelated;width:${clip.width * 3}px;height:${clip.height * 3}px;display:block" src="data:image/png;base64,${buf.toString('base64')}"></body>`);
  await zoom.screenshot({ path: path.join(OUT, `${name}_3x.png`) });
  await zoom.close();
  console.log('  ·', name);
}
await crop('d1_glass_case', 7, 2.6, 150, 110, 28);
await crop('d2_floor_ao_wall', 0.6, 6.2, 190, 130, 24);
await crop('d2_floor_ao_counter', 3.5, 3.4, 220, 110, 16);
await crop('d3_register_tray', 0.5, 2.6, 110, 100, 40);
await crop('d4_salgados_case', 7.5, 2.5, 90, 90, 34);
await browser.close();
