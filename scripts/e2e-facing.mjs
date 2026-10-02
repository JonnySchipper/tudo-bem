#!/usr/bin/env node
/**
 * Diagonal facing check: walks the local avatar along diagonal paths (click/walkTo, held W+D keys, the joystick) in the static
 * `VITE_LOCAL_WORLD=1` build and records the facing/animation drawn every frame via `window.__tb.facings()`. A diagonal walk must keep ONE
 * facing (E/W) from the first frame to the last: no flicker, no idle/walk facing flip between keyboard steps.
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 / &
 *   BASE_URL=http://localhost:4173/ node scripts/e2e-facing.mjs        # CHROME_PATH optional; FACING_DUMP=1 prints the full sequences
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SOFT = !!process.env.FACING_SOFT; // report only (the before-the-fix run)
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const check = (ok, msg) => {
  if (ok) return;
  if (SOFT) console.log('    FAIL (soft):', msg);
  else assert(ok, msg);
};

/** Run `act`, sample the self avatar's facing/anim every animation frame, then settle. Returns the frames, run-length encoded for the log. */
async function record(label, act, settleMs) {
  await page.evaluate(() => {
    const id = window.__tb.game.self.pub.id;
    window.__rec = { frames: [], on: true };
    const tick = () => {
      if (!window.__rec.on) return;
      const f = window.__tb.facings()?.[id];
      if (f) window.__rec.frames.push(`${f.moving ? 'walk' : 'idle'}:${f.facing}`);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await sleep(settleMs);
  const frames = await page.evaluate(() => ((window.__rec.on = false), window.__rec.frames));
  const runs = [];
  for (const f of frames) {
    if (runs.length && runs[runs.length - 1][0] === f) runs[runs.length - 1][1]++;
    else runs.push([f, 1]);
  }
  const seq = runs.map(([f, n]) => `${f}x${n}`).join(' ');
  console.log(`  ${label}: ${frames.length} frames, ${runs.length} runs\n    ${process.env.FACING_DUMP ? seq : seq.slice(0, 300)}`);
  return { frames, runs };
}

try {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Diag');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 15_000, 'praça');
  await sleep(1500);
  const settle = async (x, y) => {
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
    await waitFor(page, ([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], 20_000, `arrive ${x},${y}`);
  };

  // 1) click a tile diagonally away: SE, SW, NW, NE (exact 4-tile diagonals)
  // (start tile, end tile) pairs whose 4-tile legs are open pure diagonals in the praça
  for (const [name, sx, sy, x, y] of [['click SE', 22, 14, 26, 18], ['click SW', 22, 14, 18, 18], ['click NW', 19, 11, 15, 7], ['click NE', 11, 11, 15, 7]]) {
    await settle(sx, sy);
    const r = await record(name, () => page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]), 4200);
    const walk = new Set(r.frames.filter((f) => f.startsWith('walk')));
    check(walk.size === 1, `${name}: ONE walking facing for the whole diagonal, saw ${[...walk].join(', ')}`);
    check(walk.size > 0 && /:(E|W)$/.test([...walk][0]), `${name}: a diagonal faces E/W`);
  }

  // 2) hold W+D (and S+A): chained diagonal steps; no flip between the walk steps and the pauses between them
  for (const [name, keys, sx, sy] of [['keys W+D', ['w', 'd'], 11, 11], ['keys S+A', ['s', 'a'], 22, 14]]) {
    await settle(sx, sy);
    const r = await record(name, async () => {
      for (const k of keys) await page.keyboard.down(k); // a few ms apart, like two fingers; the first key waits a chord beat
      await sleep(1100); // stay inside the open 4-tile diagonal
      for (const k of keys) await page.keyboard.up(k);
    }, 1500);
    const facings = new Set(r.frames.map((f) => f.split(':')[1]));
    check(facings.size === 1, `${name}: one facing for the whole keyboard diagonal (steps and pauses), saw ${[...facings].join(', ')}`);
  }

  // 3) the joystick pushed diagonally (down-right, then up-left)
  await page.evaluate(() => { const j = document.getElementById('joystick'); if (j) j.style.display = 'block'; });
  for (const [name, ox, oy, sx, sy] of [['joystick down-right', 40, 40, 22, 14], ['joystick up-left', -40, -40, 19, 11]]) {
    await settle(sx, sy);
    const box = await page.locator('#joystick').boundingBox();
    assert(box, 'joystick present');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = await record(name, async () => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + ox, cy + oy, { steps: 4 });
      await sleep(1000);
      await page.mouse.up();
    }, 1500);
    const walk = new Set(r.frames.filter((f) => f.startsWith('walk')));
    check(walk.size === 1, `${name}: one walking facing, saw ${[...walk].join(', ')}`);
  }
  assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
  console.log('e2e-facing OK');
} finally {
  await browser.close();
}
