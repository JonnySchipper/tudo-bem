#!/usr/bin/env node
/**
 * V4 (UI) shots: the HUD, the panels and the out-of-world screens, before / after.
 *
 *   pnpm build
 *   PORT=8847 TB_TEST_CLOCK_CONTROL=1 TB_TEST_OFFER=carlos_cafe_pra_nanda TB_TEST_ROLL=1 node apps/server/dist/index.js
 *   BASE_URL=http://localhost:8847 node scripts/v4-shots.mjs --tag=after [--only=out,hud,panels,crowd,phone,land]
 *
 * Output: docs/lifesim/shots/v4/<tag>_<viewport>_<name>.png (override the folder with SHOTS_DIR). Also prints the HUD coverage: the share of the
 * screen covered by the union of the HUD boxes while walking (top bar, tracker, chat bar, emotes), and checks the phone tap targets.
 * Works against the old HUD (ids kept) and the new one: menu items that live in the settings menu / drawer are opened first when hidden.
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { requirePinnedClock } from './lib/clock-pin.mjs';
import { openNpc, passIdle } from './lib/npc.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8847';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'v4');
const TAG = argv.tag ?? 'after';
const ONLY = argv.only ? argv.only.split(',') : ['out', 'hud', 'panels', 'crowd', 'phone', 'land'];
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
const LAND = { name: '844x390', width: 844, height: 390, touch: true };
const made = [];
const missed = [];
const report = [];

const hm = (t) => t.slice(0, 2) * 60 + Number(t.slice(3, 5));
async function pin(page, time, weather = 'sol') {
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(time)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate(([t, w]) => window.__tb.setClock({ time: t, weather: w }), [time, weather]);
}
const cam = (page, spec) => page.evaluate((s) => window.__tb.renderer.setShot(s), spec);
const waitRoom = (page, id) => waitFor(page, (id) => window.__tb.game.room?.room === id, id, 20_000, `room ${id}`);
const interact = async (page, t) => assert(await page.evaluate((t) => window.__tb.interact(t), t), `interact ${JSON.stringify(t)}`);

async function walk(page, x, y, timeout = 70_000) {
  await page.evaluate(([x, y]) => window.__tb.walkTo(x, y), [x, y]);
  await page.waitForFunction(([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], { timeout }).catch(() => console.log(`    (walk to ${x},${y} did not finish)`));
  await sleep(600);
}

async function snap(page, vp, name, opts = {}) {
  let buf;
  for (let i = 0; i < 5; i++) {
    buf = await page.screenshot();
    const st = (await sharp(buf).greyscale().stats()).channels[0];
    if (st.mean > 6 && st.stdev > 5) break;
    console.log(`    (blank frame for ${name}, retrying)`);
    await sleep(1500);
  }
  if (opts.clip) buf = await sharp(buf).extract(opts.clip).toBuffer();
  const file = `${TAG}_${vp.name}_${name}.png`;
  fs.writeFileSync(path.join(OUT, file), buf);
  made.push(file);
  console.log('  .', file);
}

/** Share of the viewport covered by the union of the HUD boxes (what the player loses of the world), and the boxes under 44 px that are tap targets. */
async function hudStats(page, label) {
  const r = await page.evaluate(() => {
    const sel = [
      '.brand', '.top-left > *', '.top-right > *', '.hud-slab', '.hud-chip', '.rtrack', '.chatbar', '.emotes button', '.hud-emote-toggle', '.toast',
      '#mission-pill', '.mission-banner',
    ].join(',');
    const W = window.innerWidth;
    const H = window.innerHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    const seen = new Set();
    const small = [];
    const parts = {};
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const b = el.getBoundingClientRect();
      if (b.width < 4 || b.height < 4 || b.right < 0 || b.bottom < 0 || b.left > W || b.top > H) continue;
      if (el.closest('.hud-menu:not(.open), .hud-actions:not(.open) .hud-menu-wrap')) { /* hidden popover */ }
      const key = `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      g.fillRect(b.left, b.top, b.width, b.height);
      const cls = el.className?.toString().split(' ')[0] || el.tagName;
      parts[cls] = (parts[cls] ?? 0) + b.width * b.height;
      if (el.matches('button, a, [role=button]') && (b.width < 43.5 || b.height < 43.5)) small.push(`${el.id || cls} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    const d = g.getImageData(0, 0, W, H).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
    return { pct: (100 * n) / (W * H), small, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round((100 * v) / (W * H) * 10) / 10])) };
  });
  console.log(`  HUD ${label}: ${r.pct.toFixed(1)}% of the screen`, JSON.stringify(r.parts), r.small.length ? `| under 44px: ${r.small.join(', ')}` : '');
  report.push({ label, ...r });
  return r;
}

/** Open the menu / drawer that holds an action when its button is not visible. */
async function openAction(page, id) {
  const vis = async (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }, sel);
  if (await vis(id)) return page.click(id);
  for (const opener of ['#btn-burger', '#btn-menu']) {
    if (await vis(opener)) {
      await page.click(opener);
      await sleep(300);
      if (await vis(id)) return page.click(id);
    }
  }
  throw new Error(`action ${id} is not reachable`);
}

const PW = 'pao-de-queijo-2026';
async function boot(page, vp, { name = 'Jonny', shots = false, enter = true } = {}) {
  await page.goto(`${BASE}?notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await sleep(2800);
  if (shots) await snap(page, vp, 'ui_title_enter');
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await sleep(3500);
  if (shots) await snap(page, vp, 'ui_title_hero');
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await sleep(1800);
  if (shots) await snap(page, vp, 'ui_signin_card');
  await page.click('#intro-tab-register');
  await sleep(500);
  if (shots) await snap(page, vp, 'ui_signup_card');
  await page.fill('#intro-email', `v4+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PW);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 }).catch(async (e) => { await snap(page, vp, 'debug_no_creator'); throw e; });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ele (he)")');
  await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = 0)));
  await sleep(1200);
  if (shots) {
    await snap(page, vp, 'ui_avatar_creator');
    if (vp.touch) {
      await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = el.scrollHeight)));
      await sleep(400);
      await snap(page, vp, 'ui_avatar_creator_bottom');
    }
  }
  if (!enter) return;
  await page.click('#enter-praca');
  await waitRoom(page, 'praca');
  await sleep(2500);
}

async function newPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  return { ctx, page };
}

async function close(page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('[data-modal] .close, #dialogue-box .dbx-close').forEach((b) => b.click()));
  await sleep(500);
}

// ---------------------------------------------------------------- the HUD while walking, plus out-of-world screens
async function sectionHud(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp, { shots: ONLY.includes('out') });
  await pin(page, '12:00');
  await sleep(2500);
  await walk(page, 25, 16);
  await sleep(900);
  await hudStats(page, `${vp.name} just arrived (tutorial toast, tracker peeking)`);
  await sleep(7500);
  await snap(page, vp, 'hud_idle');
  await hudStats(page, `${vp.name} idle`);

  // the menu / drawer open
  const opener = (await page.$('#btn-burger')) && (await page.isVisible('#btn-burger')) ? '#btn-burger' : '#btn-menu';
  if (await page.$(opener)) {
    await page.click(opener).catch(() => {});
    await sleep(500);
    await snap(page, vp, 'hud_menu_open');
    await page.keyboard.press('Escape');
    await page.mouse.click(vp.width / 2, vp.height / 2).catch(() => {});
    await sleep(300);
  }
  // hover label on an icon (desktop)
  if (!vp.touch && (await page.$('#btn-map'))) {
    await page.hover('#btn-map');
    await sleep(500);
    await snap(page, vp, 'hud_tooltip', { clip: { left: 640, top: 0, width: 640, height: 200 } });
    await page.mouse.move(600, 500);
  }

  // a toast next to the tracker: a recado accepted in the padaria
  await pin(page, '12:00');
  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(3000);
  await pin(page, '12:00');
  await sleep(3500);
  await interact(page, { npc: 'carlos' });
  await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
  await passIdle(page);
  let key = await page.getAttribute('#dialogue-box', 'data-dialogue');
  if (key === 'offer-carlos') {
    await sleep(1000);
    if (vp.name === DESKTOP.name || !vp.touch) await snap(page, vp, 'dialogue_offer');
    await page.click('#dialogue-box [data-chip="0"]');
    await page.waitForSelector('#recado-tracker [data-recado="carlos_cafe_pra_nanda"]', { state: 'attached', timeout: 8000 }).catch(() => missed.push('recado did not start'));
    await sleep(700);
    await snap(page, vp, 'tracker_and_toast');
    await hudStats(page, `${vp.name} tracker+toast`);
  } else {
    missed.push(`recado offer: Carlos opened "${key}"`);
    await close(page);
  }
  await ctx.close();
}

async function sectionPanels(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp);
  await pin(page, '12:00');
  await sleep(2000);
  await walk(page, 25, 16);
  const shot = async (name) => { await sleep(900); await snap(page, vp, name); await close(page); };

  await openAction(page, '#btn-recados');
  await shot('panel_journal');
  await openAction(page, '#btn-caderno');
  await shot('panel_caderno');
  await openAction(page, '#btn-map');
  await shot('panel_map');
  await openAction(page, '#btn-wardrobe');
  await shot('panel_wardrobe');
  await openAction(page, '#btn-friends');
  await shot('panel_friends');
  await openAction(page, '#btn-credits');
  await page.waitForSelector('[data-modal="credits"] .credits-panel', { timeout: 5000 });
  await shot('panel_credits');
  await interact(page, { prop: 'barraca' });
  await page.waitForSelector('[data-modal] .panel', { timeout: 8000 });
  await shot('panel_hat_shop');
  await walk(page, 34, 15);
  await pin(page, '12:00');
  await sleep(2500);
  await openNpc(page, 'nanda');
  await sleep(900);
  await snap(page, vp, 'dialogue_nanda');
  await close(page);

  // padaria: Conversa, Me vê um
  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(3000);
  await pin(page, '12:00');
  await sleep(3500);
  await openNpc(page, 'carlos', 'conversa');
  await sleep(1200);
  await snap(page, vp, 'dialogue_conversa');
  await close(page);
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'start' }));
  await page.waitForSelector('#cr-order', { timeout: 8000 });
  await sleep(1400);
  await snap(page, vp, 'panel_meveum');
  await page.click('#cr-quit').catch(() => {});
  await sleep(800);
  await close(page);
  await ctx.close();
}

async function sectionCrowd(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp);
  await pin(page, '12:00');
  await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 4, null, { timeout: 15_000 }).catch(() => {});
  await sleep(4000);
  const centre = await page.evaluate(() => {
    const pts = [...window.__tb.game.avatars.values()].map((a) => a.pub.tile ?? { x: a.pub.x, y: a.pub.y }).filter((p) => p && p.y >= 12 && p.y <= 31 && p.x >= 8 && p.x <= 42);
    let best = { n: -1, x: 25, y: 20 };
    for (const p of pts) {
      const near = pts.filter((q) => Math.abs(q.x - p.x) <= 4 && Math.abs(q.y - p.y) <= 3);
      if (near.length > best.n) best = { n: near.length, x: near.reduce((s, q) => s + q.x, 0) / near.length, y: near.reduce((s, q) => s + q.y, 0) / near.length };
    }
    return best;
  });
  console.log('  crowd centre', JSON.stringify(centre));
  await walk(page, Math.round(centre.x), Math.round(centre.y));
  await sleep(1500);
  await snap(page, vp, 'crowd_labels');
  // the praça near Júlia and the NPCs
  await cam(page, null);
  await ctx.close();
}

async function main() {
  await requirePinnedClock(BASE, { min: 0, max: 1439, target: 12 * 60, label: 'any hour (the shots pin each scene)' });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    if (ONLY.includes('hud') || ONLY.includes('out')) await sectionHud(browser, DESKTOP);
    if (ONLY.includes('panels')) await sectionPanels(browser, DESKTOP);
    if (ONLY.includes('crowd')) await sectionCrowd(browser, DESKTOP);
    if (ONLY.includes('phone')) {
      await sectionHud(browser, PHONE);
      if (ONLY.includes('panels')) await sectionPanels(browser, PHONE);
    }
    if (ONLY.includes('land')) await sectionHud(browser, LAND);
  } finally {
    await browser.close();
  }
  console.log(`\n${made.length} files in ${OUT}`);
  if (missed.length) console.log('could not capture:\n  - ' + missed.join('\n  - '));
  fs.writeFileSync(path.join(OUT, `${TAG}_hud_stats.json`), JSON.stringify(report, null, 2));
}
await main();
