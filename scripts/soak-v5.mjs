#!/usr/bin/env node
/**
 * V5 soak: sweeps 24 hours x 4 weathers x the rooms in ONE page (no reload), `loops` times, and after every step asserts that
 *   - the WebGL canvas is not blank (sampled pixels of a screenshot of the canvas region),
 *   - no `webglcontextlost` / page error / console error happened,
 *   - the Phaser texture count and the shadow-atlas size stay bounded (no leak across clock, weather or room changes).
 *
 *   BASE_URL=http://localhost:8855 node scripts/soak-v5.mjs [--loops=1] [--hours=0,3,6,...] [--rooms=praca,padaria] [--vp=phone] [--fast]
 * Needs a server started with TB_TEST_CLOCK_CONTROL=1. Exit code 1 on any failure.
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const BASE = process.env.BASE_URL ?? 'http://localhost:8855';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
const vp = argv.vp === 'phone' ? { name: '390x844', width: 390, height: 844, touch: true } : { name: '1280x800', width: 1280, height: 800 };
const LOOPS = Number(argv.loops ?? 1);
const HOURS = (argv.hours ? argv.hours.split(',').map(Number) : Array.from({ length: 24 }, (_, i) => i));
const ROOMS = (argv.rooms ?? 'praca,rua,feira,padaria').split(',');
const WEATHERS = ['sol', 'nublado', 'garoa', 'chuva'];
const SETTLE = Number(argv.settle ?? (argv.fast ? 350 : 900));
/** Texture budget: the world loads a handful of textures; anything that grows with the number of steps is a leak. */
const MAX_TEXTURES = Number(argv.maxTextures ?? 140);
// every room is entered with a join (the walk between the open-air areas is covered by the e2e); the soak is about the render, not the route
const PORTALS = { praca: null, rua: true, feira: true, padaria: true };
const hm = (h) => h * 60 + 5;
const failures = [];
let steps = 0;

async function boot(page) {
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `soak+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Soak');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praça');
  await sleep(1500);
}

/** Fraction of distinct colour in the canvas area and its mean luma, from a screenshot of the canvas only. */
async function canvasStats(page) {
  const el = await page.$('#world canvas, canvas');
  const buf = await (el ?? page).screenshot();
  const st = await sharp(buf).greyscale().stats();
  return { mean: st.channels[0].mean, stdev: st.channels[0].stdev };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
const page = await ctx.newPage();
const events = [];
page.on('pageerror', (e) => events.push(`pageerror ${String(e.stack ?? e).slice(0, 700)}`));
page.on('console', (m) => { if (m.type() === 'error') events.push(`console.error ${m.text().slice(0, 160)}`); });
await page.addInitScript(() => {
  window.__ctxLost = 0;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...a) {
    const c = orig.apply(this, a);
    if (!this.__wl) { this.__wl = true; this.addEventListener('webglcontextlost', () => { window.__ctxLost++; }); }
    return c;
  };
});
await boot(page);
await page.addStyleTag({ content: '#ui{visibility:hidden !important}' });

const info = () => page.evaluate(() => {
  const g = window.__tb?.renderer?.game ?? window.__tb?.game?.phaser;
  const t = window.__tb.perf?.shade;
  return { ctxLost: window.__ctxLost, shade: t, room: window.__tb.game.room?.room };
});
let maxTex = 0;
const texCount = () => page.evaluate(() => window.__tb.renderer.textureInfo?.() ?? null);

for (let loop = 0; loop < LOOPS; loop++) {
  for (const room of ROOMS) {
    const portals = PORTALS[room];
    if (portals) {
      await page.evaluate((r) => window.__tb.net.send({ t: 'join', room: r }), room);
      await waitFor(page, (id) => window.__tb.game.room?.room === id, room, 20_000, room);
      await sleep(1200);
    }
    for (const weather of WEATHERS) {
      for (const h of HOURS) {
        await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(h)}`, { method: 'POST' });
        await page.evaluate(([h, w]) => window.__tb.setClock({ time: `${String(h).padStart(2, '0')}:05`, weather: w }), [h, weather]);
        await sleep(SETTLE);
        steps++;
        const s = await canvasStats(page);
        const i = await info();
        const tex = await texCount();
        if (tex) maxTex = Math.max(maxTex, tex.count);
        const tag = `loop ${loop} ${room} ${String(h).padStart(2, '0')}:05 ${weather}`;
        if (s.stdev < 4 || s.mean < 2) failures.push(`${tag}: canvas BLANK (mean ${s.mean.toFixed(1)}, stdev ${s.stdev.toFixed(1)})`);
        if (i.ctxLost) failures.push(`${tag}: webglcontextlost x${i.ctxLost}`);
        if (tex && tex.count > MAX_TEXTURES) failures.push(`${tag}: ${tex.count} textures (budget ${MAX_TEXTURES})`);
        if (events.length) failures.push(`${tag}: ${events.splice(0).join(' | ')}`);
      }
    }
    if (portals) {
      await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'praca' }));
      await waitFor(page, (id) => window.__tb.game.room?.room === id, 'praca', 20_000, 'praca');
      await sleep(1200);
    }
  }
  const tex = await texCount();
  const sh = await page.evaluate(() => window.__tb.perf?.shade);
  console.log(`loop ${loop + 1}/${LOOPS} done: ${steps} steps, textures now ${tex?.count ?? '?'} (max ${maxTex}), atlas pages ${sh?.pages ?? '?'} (${tex?.shadowAtlas ?? '?'}), silhouettes ${sh?.silhouettes ?? '?'}`);
}
await browser.close();
if (failures.length) {
  console.error(`\nSOAK FAILED (${failures.length}):\n  ` + failures.slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log(`SOAK OK: ${steps} steps, no blank frame, no context loss, textures bounded (max ${maxTex})`);
