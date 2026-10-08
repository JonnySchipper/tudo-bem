#!/usr/bin/env node
/**
 * Tap-to-walk and street framing shots (issue #154): every open-air area as a player sees it (live camera, HUD on), plus a real tap on the
 * floor (the destination marker) and one off the walkable map (the refused cue), so the before and after can be compared side by side.
 *
 *   pnpm build
 *   PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   BASE_URL=http://localhost:8810 node scripts/tap-walk-shots.mjs --phase=after [--only=rua,praca] [--vp=390x844]
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
const ONLY = argv.only ? argv.only.split(',') : ['praca', 'rua', 'rua_leste', 'feira', 'aeroporto'];
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '844x390', width: 844, height: 390, touch: true },
].filter((v) => !argv.vp || argv.vp.split(',').includes(v.name));
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });
const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// where the player stands, per area (same spots as street-framing-shots.mjs)
const STAND = { rua: [12, 9], rua_leste: [8, 7], praca: [16, 16], feira: [4, 8], aeroporto: [15, 15] };

/** Tap (touch) or click (mouse) a client point the way a player does. */
async function press(page, vp, x, y) {
  if (vp.touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch, isMobile: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
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
  await waitFor(page, () => !!window.__tb.game.room?.room, null, 20_000, 'a room').catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, `debug_${vp.name}.png`) });
    throw e;
  });
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(TIME)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), TIME);
  await sleep(3000);
  // the two phone sizes and 1280 shoot every area; 1920 only needs the streets (the seam) and the landscape phone only the praça
  const areas = vp.name === '844x390' ? ONLY.filter((a) => a === 'praca') : ONLY;
  for (const area of areas) {
    try {
      if ((await page.evaluate(() => window.__tb.game.room?.room)) !== area) {
        await page.evaluate((room) => window.__tb.net.send({ t: 'join', room }), area);
        await waitFor(page, (id) => window.__tb.game.room?.room === id, area, 20_000, area);
      }
      const [sx, sy] = STAND[area];
      await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [sx, sy]);
      await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [sx, sy], { timeout: 30_000 }).catch(() => console.log(`  (walk to ${sx},${sy} did not finish)`));
      await page.evaluate(() => window.__tb.renderer.setShot(null));
      await sleep(2500);
      const file = `${PHASE}_${vp.name}_${area}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      console.log('  ·', file);
    } catch (e) {
      console.log(`  ! ${vp.name} ${area}: ${String(e).split('\n')[0]}`);
    }
  }
  // the praça: a real tap on the floor four tiles away (the marker, caught mid-walk), then one on the town around the map (refused)
  if (ONLY.includes('praca') && vp.name !== '1920x1080') {
    try {
      if ((await page.evaluate(() => window.__tb.game.room?.room)) !== 'praca') {
        await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'praca' }));
        await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 20_000, 'praca');
      }
      const [sx, sy] = STAND.praca;
      await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [sx, sy]);
      await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [sx, sy], { timeout: 30_000 }).catch(() => {});
      await sleep(1200);
      // down the walkway, three tiles south of where the avatar stands
      const to = await page.evaluate(([x, y]) => window.__tb.tileToClient(x, y), [sx, sy + 3]);
      const hit = await page.evaluate(([x, y]) => window.__tb.renderer.hitTest(x, y)?.kind ?? null, [to.px, to.py]);
      await press(page, vp, to.px, to.py);
      await sleep(220);
      console.log(`    tap on ${hit}:`, JSON.stringify(await page.evaluate(() => ({ mark: window.__tb.renderer.scene?.tap?.kind ?? null, self: window.__tb.selfTile() }))));
      await page.screenshot({ path: path.join(OUT, `${PHASE}_${vp.name}_tap.png`) });
      console.log('  ·', `${PHASE}_${vp.name}_tap.png`);
      await sleep(2500);
      // the nearest blocked floor tile on screen (a planter, the fountain's rim): nobody can stand there
      const me = await page.evaluate(() => {
        const t = window.__tb.selfTile();
        const grid = window.__tb.renderer.scene?.grid;
        if (!t || !grid) return null;
        let best = null;
        for (let dy = -8; dy <= 8; dy++) {
          for (let dx = -8; dx <= 8; dx++) {
            const x = t.tile.x + dx;
            const y = t.tile.y + dy;
            if (!grid.blocked.has(`${x},${y}`)) continue;
            const c = window.__tb.tileToClient(x, y);
            if (c.px < 30 || c.py < 200 || c.px > innerWidth - 30 || c.py > innerHeight - 120) continue;
            if (window.__tb.renderer.hitTest(c.px, c.py)?.kind !== 'tile') continue;
            const d = Math.abs(dx) + Math.abs(dy);
            if (!best || d < best.d) best = { d, ...c };
          }
        }
        return best;
      });
      if (me) {
        await press(page, vp, me.px, me.py);
        await sleep(160);
        await page.screenshot({ path: path.join(OUT, `${PHASE}_${vp.name}_refused.png`) });
        console.log('  ·', `${PHASE}_${vp.name}_refused.png`);
      }
    } catch (e) {
      console.log(`  ! ${vp.name} tap: ${String(e).split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
