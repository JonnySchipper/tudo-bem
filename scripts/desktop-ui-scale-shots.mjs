#!/usr/bin/env node
/**
 * Desktop UI scale (issue #169): the HUD, the airport tutorial card and an open dialogue at desktop and phone sizes, plus an overlap check.
 *
 *   pnpm build && node scripts/desktop-ui-scale-shots.mjs [before|after] [1280x800,390x844,...]      # default: after, every size
 *
 * Starts its own server (temp DATA_DIR, pinned 08:30 clock) like `pnpm e2e:all`. For each size: a new account lands at the airport (HUD + the
 * tutorial step card), then walks into the padaria and opens Seu Carlos's counter (the dialogue close-up). Shots land in
 * docs/lifesim/shots/desktop-ui-scale/<PREFIX>_<what>_<w>x<h>.png. Every HUD piece that is on screen is checked against the others: the script
 * fails when two of them overlap or one leaves the viewport.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { goArea } from './lib/areas.mjs';
import { requirePinnedClock } from './lib/clock-pin.mjs';
import { sleep } from './lib/meveum-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = process.argv[2] ?? process.env.PREFIX ?? 'after';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/desktop-ui-scale');
const PORT = Number(process.env.PORT ?? 8797);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = findChrome();
if (!CHROME) {
  console.error('Chrome/Chromium not found: set CHROME_PATH');
  process.exit(1);
}
const ALL = {
  '1280x800': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  '1440x900': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  '1920x1080': { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  '844x390': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const SIZES = (process.argv[3] ?? process.env.SIZES ?? Object.keys(ALL).join(',')).split(',');
/** Only these sizes are written to the repo; the others are checked and not kept. */
const KEEP = new Set((process.env.KEEP ?? '1280x800,1920x1080,390x844').split(','));
const log = (...a) => console.log('  ·', ...a);
fs.mkdirSync(SHOTS, { recursive: true });

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-ui-scale-'));
const server = spawn(process.execPath, [path.join(ROOT, 'apps/server/dist/index.js')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, TB_TEST_CLOCK_CONTROL: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitHealthy() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`server did not come up\n${serverLog.slice(-2000)}`);
}

/** The HUD pieces that must never overlap each other (each one only when it is on screen). */
const PIECES = {
  plate: '#hud-top .hud-left',
  stats: '#hud-top .hud-stats',
  fala: '#btn-feedback',
  icons: '#hud-actions',
  burger: '#btn-burger',
  mission: '#mission-pill',
  cartela: '#cartela-pill',
  tracker: '.rtrack',
  chat: '.bottombar .chatbar',
  emotes: '#hud-emotes',
  toasts: '.toasts .toast',
  dialogue: '#dialogue-box',
};

async function overlaps(page, label) {
  const res = await page.evaluate((pieces) => {
    const vw = innerWidth;
    const vh = innerHeight;
    const boxes = [];
    for (const [name, sel] of Object.entries(pieces)) {
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        // only what is actually painted: an ancestor with display none hides it too
        if (!el.checkVisibility?.({ visibilityProperty: true })) continue;
        boxes.push({ name, l: r.left, t: r.top, r: r.right, b: r.bottom });
      }
    }
    const bad = [];
    for (const b of boxes) if (b.l < -1 || b.t < -1 || b.r > vw + 1 || b.b > vh + 1) bad.push(`${b.name} leaves the screen (${Math.round(b.l)},${Math.round(b.t)},${Math.round(b.r)},${Math.round(b.b)})`);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const c = boxes[j];
        if (a.name === c.name) continue;
        // the pixel frame's 2 px edge may touch
        if (a.l < c.r - 2 && c.l < a.r - 2 && a.t < c.b - 2 && c.t < a.b - 2) bad.push(`${a.name} overlaps ${c.name}`);
      }
    return { bad, boxes: boxes.map((b) => `${b.name}:${Math.round(b.l)},${Math.round(b.t)}-${Math.round(b.r)},${Math.round(b.b)}`) };
  }, PIECES);
  log(label, res.boxes.join(' '));
  return res.bad.map((b) => `${label}: ${b}`);
}

async function shot(page, size, what) {
  const dir = KEEP.has(size) ? SHOTS : fs.mkdtempSync(path.join(os.tmpdir(), 'tb-ui-scale-shot-'));
  const file = path.join(dir, `${PREFIX}_${what}_${size}.png`);
  await page.screenshot({ path: file });
  log('shot', path.relative(ROOT, file));
}

/** The NPC's head and the player's head (client px) while the dialogue is open: both must sit above the box. */
async function speakersClear(page, label) {
  const r = await page.evaluate(() => {
    const box = document.getElementById('dialogue-box')?.getBoundingClientRect();
    const tb = window.__tb;
    const self = tb.selfTile?.();
    const carlos = tb.game.liveNpcs(performance.now()).find((n) => n.id === 'carlos');
    const pts = [];
    if (self) pts.push(tb.tileToClient(self.tile.x, self.tile.y));
    if (carlos) pts.push(tb.tileToClient(carlos.x, carlos.y));
    return { top: box?.top ?? null, feet: pts.map((p) => p.py) };
  });
  if (r.top === null) return [`${label}: no dialogue box`];
  return r.feet.filter((y) => y > r.top).map((y) => `${label}: a speaker (feet at y=${Math.round(y)}) is under the dialogue box (top ${Math.round(r.top)})`);
}

const problems = [];
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  await waitHealthy();
  for (const size of SIZES) {
    const opts = ALL[size];
    if (!opts) throw new Error(`unknown size ${size}`);
    await requirePinnedClock(BASE);
    const page = await browser.newPage(opts);
    page.on('pageerror', (e) => problems.push(`${size}: page error ${e}`));
    log(size, 'enter');
    await page.goto(`${BASE}/?notype=1`);
    await page.waitForSelector('#intro-enter', { timeout: 30_000 });
    await page.click('#intro-enter');
    await page.waitForSelector('#intro-skip', { timeout: 12_000 });
    await page.click('#intro-skip');
    await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
    await page.click('#intro-tab-register');
    await page.fill('#intro-email', `scale+${size}-${Date.now().toString(36)}@exemplo.com`);
    await page.fill('#intro-password', 'pao-de-queijo-2026');
    await page.click('#intro-submit');
    await page.waitForSelector('#avatar-name', { timeout: 15_000 });
    await page.fill('#avatar-name', 'Jonny');
    await page.click('button:has-text("ele (he)")');
    await page.click('#enter-praca');
    // the airport: the HUD with the tutorial step card in the tracker's corner
    await page.waitForFunction(() => window.__tb?.game?.room?.room === 'aeroporto', null, { timeout: 20_000 });
    await page.waitForSelector('.aero-tut:not([hidden])', { timeout: 10_000 }).catch(() => log('no airport card'));
    await sleep(1500);
    await shot(page, size, 'tutorial');
    problems.push(...(await overlaps(page, `${size} airport`)));

    await finishArrival(page);
    await page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());
    await sleep(1200);
    await shot(page, size, 'hud');
    problems.push(...(await overlaps(page, `${size} praça`)));

    // the dialogue close-up: Seu Carlos at the padaria counter
    await goArea(page, 'rua');
    await page.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
    await page.waitForFunction(() => window.__tb.game.room?.room === 'padaria', null, { timeout: 20_000 });
    await sleep(800);
    await page.evaluate(() => window.__tb.interact({ npc: 'carlos' }));
    for (let i = 0; i < 8; i++) {
      await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
      const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
      if (key === 'counter-carlos') break;
      if (key?.startsWith('idle-')) await page.click('#dialogue-box [data-chip="0"]');
      else if (key?.startsWith('offer-') || key?.startsWith('give-')) await page.click('#dialogue-box [data-chip="1"]');
      await sleep(400);
    }
    await page.evaluate(() => document.querySelector('.toasts')?.replaceChildren());
    await sleep(1500);
    await shot(page, size, 'dialogue');
    problems.push(...(await overlaps(page, `${size} dialogue`)));
    problems.push(...(await speakersClear(page, `${size} dialogue`)));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
  try {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nno overlaps');
