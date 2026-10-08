#!/usr/bin/env node
/**
 * Tap-to-walk and street framing shots (issue #154): every open-air area as a player sees it (live camera, HUD on), plus the tap cues in the
 * praça (a floor tap, an NPC tap, a refused tap on the town past the map edge, a press-and-hold steer) and the landscape phone layout.
 *
 *   pnpm build
 *   PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8810 node scripts/tap-walk-shots.mjs --phase=before|after [--only=praca,rua] [--vp=390x844]
 *
 * Output: docs/lifesim/shots/opus-polish/tap-walk-framing/<phase>_<viewport>_<shot>.png (SHOTS_DIR to override).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'opus-polish', 'tap-walk-framing');
const PHASE = argv.phase ?? 'after';
const TIME = argv.time ?? '12:00';
const ONLY = argv.only ? argv.only.split(',') : ['rua', 'rua_leste', 'praca', 'feira', 'aeroporto'];
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '844x390', width: 844, height: 390, touch: true },
].filter((v) => !argv.vp || argv.vp.split(',').includes(v.name));
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// where the player stands, per area: somewhere a player actually walks (the north sidewalk of the street, the middle of the praça)
const STAND = { rua: [12, 9], rua_leste: [8, 7], praca: [16, 16], feira: [4, 8], aeroporto: [15, 15] };

async function enter(page, vp) {
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `tapwalk+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Foto');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, () => !!window.__tb.game.room?.room, null, 20_000, 'a room');
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(TIME)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), TIME);
  await sleep(3000);
}

async function goTo(page, area) {
  if ((await page.evaluate(() => window.__tb.game.room?.room)) !== area) {
    await page.evaluate((room) => window.__tb.net.send({ t: 'join', room }), area);
    await waitFor(page, (id) => window.__tb.game.room?.room === id, area, 20_000, area);
  }
  const [sx, sy] = STAND[area];
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [sx, sy]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [sx, sy], { timeout: 30_000 }).catch(() => console.log(`  (walk to ${sx},${sy} did not finish)`));
  await page.evaluate(() => window.__tb.renderer.setShot(null));
  await sleep(2000);
}

/** A real tap (touch) or click (mouse) at client px. */
async function tap(page, vp, x, y) {
  if (vp.touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const shoot = async (page, vp, name) => {
  const file = `${PHASE}_${vp.name}_${name}.png`;
  await page.screenshot({ path: path.join(OUT, file) });
  console.log('  ·', file);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch, isMobile: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await enter(page, vp);
  // the landscape phone: only the praça (the HUD and chat bar are the point)
  const areas = vp.name === '844x390' ? ['praca'] : ONLY;
  for (const area of areas) {
    try {
      await goTo(page, area);
      await shoot(page, vp, area);
    } catch (e) {
      console.log(`  ! ${vp.name} ${area}: ${String(e).split('\n')[0]}`);
    }
  }
  if (vp.name === '1920x1080' || !areas.includes('praca')) {
    await ctx.close();
    continue;
  }
  try {
    // the tap cues, in the praça
    await goTo(page, 'praca');
    const [sx, sy] = STAND.praca;
    // a floor tap a few tiles away: the destination marker, shot mid-walk
    const floor = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [sx + 4, sy - 2]);
    await tap(page, vp, floor.px, floor.py);
    await sleep(450);
    await shoot(page, vp, 'tap_floor');
    await sleep(2500);
    // a refused tap: the town drawn past the west edge of the map is not walkable
    const off = await page.evaluate(() => window.__tb.tileToClient(-2, window.__tb.selfTile().tile.y));
    await tap(page, vp, Math.max(6, off.px), off.py);
    await sleep(160);
    await shoot(page, vp, 'tap_refused');
    await sleep(800);
    // an NPC tap: the gold "going to talk" marker on their interact tile
    const npc = await page.evaluate(() => {
      const me = window.__tb.selfTile()?.tile;
      const list = window.__tb.game.liveNpcs(performance.now());
      list.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
      const n = list[0];
      return n ? window.__tb.tileToClient(n.x, n.y - 0.6) : null;
    });
    if (npc) {
      await tap(page, vp, npc.px, npc.py);
      await sleep(450);
      await shoot(page, vp, 'tap_npc');
      await page.evaluate(() => document.querySelector('.dlg-close, [data-close], .modal-close')?.click());
      await page.keyboard.press('Escape');
      await sleep(2500);
      await goTo(page, 'praca');
    }
    // press and hold: the avatar walks toward the finger while it is down
    const hold = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [sx - 4, sy + 2]);
    if (vp.touch) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hold.px, y: hold.py }] });
      await sleep(900);
      await shoot(page, vp, 'hold_steer');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(hold.px, hold.py);
      await page.mouse.down();
      await sleep(900);
      await shoot(page, vp, 'hold_steer');
      await page.mouse.up();
    }
  } catch (e) {
    console.log(`  ! ${vp.name} taps: ${String(e).split('\n')[0]}`);
  }
  await ctx.close();
}
await browser.close();
