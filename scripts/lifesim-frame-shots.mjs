#!/usr/bin/env node
/**
 * Screenshots of the P1 style frame (apps/client/lifesim-frame.html).
 *
 *   pnpm --filter @tudobem/client dev --port 5199      # or a static server on apps/client/dist
 *   BASE_URL=http://localhost:5199/ node scripts/lifesim-frame-shots.mjs
 *
 * Writes 1280x800 and 390x844 shots at 17:30 and 19:30 to docs/lifesim/shots/p1/ (SHOTS_DIR to override).
 * CHROME_PATH=... on Windows (chrome.exe or msedge.exe). Extra args: --zoom4 adds 4x detail shots.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:5199/';
const OUT = process.env.SHOTS_DIR ?? 'docs/lifesim/shots/p1';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** name, viewport, dpr, camera params per viewport */
const VIEWS = [
  { tag: '1280x800', w: 1280, h: 800, q: 'zoom=3&cx=15&cy=9.2' },
  { tag: '390x844', w: 390, h: 844, q: 'zoom=3&cx=12.8&cy=9.6' },
];
const HOURS = [
  { tag: '1730', t: 17.5 },
  { tag: '1930', t: 19.5 },
];
const extra = process.argv.includes('--zoom4');
const DPR = Number(process.env.DPR ?? 1);
const SUFFIX = DPR === 1 ? '' : `_dpr${DPR}`;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: DPR });
  for (const hr of HOURS) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', String(e)));
    page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
    await page.goto(`${BASE}lifesim-frame.html?t=${hr.t}&${v.q}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__frame?.scene?.scene?.isActive?.('frame'), null, { timeout: 30000 });
    await sleep(4500); // let the walker move, petals fall, pigeons wander
    const file = path.join(OUT, `frame_${hr.tag}_${v.tag}${SUFFIX}.png`);
    await page.screenshot({ path: file });
    console.log('  ·', file);
    if (extra && v.w > 600) {
      await page.goto(`${BASE}lifesim-frame.html?t=${hr.t}&zoom=4&cx=${v.w > 600 ? 16 : 14.6}&cy=9.5&ui=0`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => window.__frame?.scene?.scene?.isActive?.('frame'), null, { timeout: 30000 });
      await sleep(3000);
      await page.screenshot({ path: path.join(OUT, `frame_${hr.tag}_${v.tag}_z4${SUFFIX}.png`) });
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
