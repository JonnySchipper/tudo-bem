#!/usr/bin/env node
/**
 * Visual audit: a complete screenshot set of the current game for an art director (no critique, just capture).
 *
 *   pnpm build
 *   PORT=8810 TB_TEST_CLOCK_CONTROL=1 TB_TEST_OFFER=carlos_cafe_pra_nanda TB_TEST_ROLL=1 pnpm start     # a pinned server
 *   BASE_URL=http://localhost:8810 node scripts/visual-audit.mjs [--only=map,areas,interiors,ui,crowd,sheets]
 *
 * Output: docs/lifesim/shots/audit/ (override with SHOTS_DIR), names `<viewport>_<area>_<time>[_<weather>].png`, viewports 1280x800 and 390x844 (marked ★ in the brief).
 * Every scene pins both clocks: the server's (`POST /__test/clock`, so the NPC schedules and the feira vendors match) and the page's (`__tb.setClock`,
 * sky + weather). Fixed cameras come from `renderer.setShot('map' | 'cam:<tileX>,<tileY>,<zoom>')` (the `?shot=` modes). Blank frames are retried.
 * Reuses the helpers of lifesim-shots.mjs / readme-shots.mjs / e2e-feira.mjs (login flow, `openNpc`, `requirePinnedClock`).
 */
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findChrome } from './lib/chrome.mjs';
import { requirePinnedClock } from './lib/clock-pin.mjs';
import { openNpc } from './lib/npc.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'audit');
const ONLY = argv.only ? argv.only.split(',') : ['map', 'areas', 'interiors', 'ui', 'crowd', 'sheets'];
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
const made = [];
const missed = [];

// ---------------------------------------------------------------- clock + camera + shot helpers
const hm = (t) => t.slice(0, 2) * 60 + Number(t.slice(3, 5));
const tag = (t) => t.replace(':', '');

/** Server clock (NPCs, vendors) and page clock (sky, weather) to the same hour. */
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

const HIDE_CSS = '#ui{visibility:hidden !important}';
async function setClean(page, on) {
  await page.evaluate(([on, css]) => {
    let s = document.getElementById('audit-hide');
    if (on && !s) { s = document.createElement('style'); s.id = 'audit-hide'; s.textContent = css; document.head.append(s); }
    if (!on && s) s.remove();
  }, [on, HIDE_CSS]);
}

/** Screenshot to OUT/<vp>_<name>.png; `clean` hides the HUD/DOM chrome so only the world shows. Retries a blank or near-uniform frame. */
async function snap(page, vp, name, { clean = false, only = null } = {}) {
  if (only && !only.includes(vp.name)) return;
  if (clean) await setClean(page, true);
  let buf;
  for (let i = 0; i < 5; i++) {
    buf = await page.screenshot();
    const st = (await sharp(buf).greyscale().stats()).channels[0];
    if (st.mean > 6 && st.stdev > 5) break;
    console.log(`    (blank frame for ${name}, retrying)`);
    await sleep(1500);
  }
  if (clean) await setClean(page, false);
  const file = `${vp.name}_${name}.png`;
  fs.writeFileSync(path.join(OUT, file), buf);
  made.push(file);
  console.log('  ·', file);
}

// ---------------------------------------------------------------- login
const PW = 'pao-de-queijo-2026';
async function boot(page, vp, { name = 'Jonny', shots = false, extra = '' } = {}) {
  await page.goto(`${BASE}?notype=1${extra}`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await sleep(2800);
  if (shots) await snap(page, vp, 'ui_title_enter');
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await sleep(3500);
  if (shots) await snap(page, vp, 'ui_title_hero');
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await sleep(1800);
  if (shots) await snap(page, vp, 'ui_signin_card');
  await page.click('#intro-tab-register');
  await sleep(500);
  if (shots) await snap(page, vp, 'ui_signup_card');
  await page.fill('#intro-email', `audit+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PW);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ele (he)")');
  await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = 0)));
  await sleep(700);
  if (shots) {
    await snap(page, vp, 'ui_avatar_creator');
    if (vp.touch) {
      await page.evaluate(() => document.querySelectorAll('.onboarding, .onboarding *').forEach((el) => (el.scrollTop = el.scrollHeight)));
      await sleep(400);
      await snap(page, vp, 'ui_avatar_creator_bottom');
    }
  }
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

// ---------------------------------------------------------------- 1. full map
async function sectionMap(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp);
  await cam(page, 'map');
  for (const t of ['08:00', '17:30', '21:00']) {
    await pin(page, t);
    await sleep(3000);
    await snap(page, vp, `map_${tag(t)}`, { clean: true });
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 2. outdoor areas
// cx, cy: camera tile; z: integer zoom (desktop / phone); at: where the avatar stands; times: the pins
const T4 = ['08:00', '12:00', '17:30', '21:00'];
const AREAS = [
  { name: 'north_street', cam: [22, 8.4, 3], phoneCam: [18, 13, 2], at: [16, 7], times: T4, wx: [['15:00', 'garoa'], ['15:00', 'chuva']], phone: true },
  { name: 'north_street_east', cam: [40, 8.4, 3], at: [40, 7], times: T4 },
  { name: 'praca_fountain', cam: [25, 20, 3], phoneCam: [25, 20, 2], at: [25, 16], times: T4, wx: [['15:00', 'garoa'], ['15:00', 'chuva']], phone: true },
  { name: 'west_houses', cam: [13, 20, 3], at: [9, 17], times: T4 },
  { name: 'south_street', cam: [25, 31.5, 3], at: [25, 30], times: T4 },
  { name: 'feira', cam: [43, 22, 3], at: [45, 19], times: ['08:00', '09:00', '12:00', '16:00', '17:30', '21:00'], slow: true },
  { name: 'bus_stop', cam: [31, 13, 3], at: [31, 13], times: T4 },
];

async function sectionAreas(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp);
  for (const a of AREAS) {
    if (vp.touch && !a.phone) continue;
    await pin(page, '12:00');
    console.log(`  area ${a.name}`);
    await cam(page, null);
    await walk(page, a.at[0], a.at[1]);
    const c = vp.touch ? a.phoneCam ?? a.cam : a.cam;
    await cam(page, `cam:${c[0]},${c[1]},${c[2]}`);
    const scenes = [...a.times.map((t) => [t, 'sol']), ...(a.wx ?? [])];
    for (const [t, w] of scenes) {
      await pin(page, t, w);
      await sleep(a.slow ? 9000 : 3500);
      await snap(page, vp, `${a.name}_${tag(t)}${w === 'sol' ? '' : '_' + w}`, { clean: true });
    }
  }
  await cam(page, null);
  await ctx.close();
}

// ---------------------------------------------------------------- 3. interiors
async function sectionInteriors(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp);
  const FURNISH = () => {
    const ids = ['cadeira_madeira', 'poltrona_verde', 'pufe_amarelo', 'mesinha', 'planta', 'tapete', 'radio', 'ventilador', 'gato', 'luminaria', 'estante', 'quadro', 'rede', 'filtro'];
    const at = [[2, 3, 0], [5, 4, 1], [3, 5, 0], [4, 3, 0], [4, 1, 0], [3, 4, 1], [7, 3, 0], [6, 5, 1], [2, 2, 1], [7, 5, 0], [0, 1, 0], [6, 7, 1], [5, 2, 0], [3, 2, 0]];
    window.__tb.game.furniture = ids.map((itemId, i) => ({ uid: 'shot' + i, itemId, x: at[i][0], y: at[i][1], rot: at[i][2] }));
  };
  const room = async (portal, id, times, label, opts = {}) => {
    await interact(page, { portal });
    await waitRoom(page, id);
    for (const t of times) {
      await pin(page, t);
      await sleep(opts.slow ? 8000 : 3500);
      await snap(page, vp, `${label}_${tag(t)}`, { clean: true });
    }
  };
  const back = async (portal) => {
    await interact(page, { portal });
    await waitRoom(page, 'praca');
    await sleep(1500);
  };
  await pin(page, '12:00');
  await room('praca_padaria', 'padaria', ['12:00', '21:00'], 'padaria', { slow: true });
  await back('padaria_praca');
  if (!vp.touch) {
    await pin(page, '12:00');
    await room('praca_kitnet', 'kitnet', ['12:00', '21:00'], 'kitnet_default');
    await page.evaluate(FURNISH);
    await pin(page, '12:00');
    await sleep(2000);
    await snap(page, vp, 'kitnet_furnished_1200', { clean: true });
    await pin(page, '21:00');
    await sleep(3000);
    await snap(page, vp, 'kitnet_furnished_2100', { clean: true });
    await page.evaluate(() => { window.__tb.game.furniture = []; });
    await back('kitnet_praca');
    await pin(page, '12:00');
    await room('praca_academia', 'academia', ['12:00', '21:00'], 'academia', { slow: true });
    await back('academia_praca');
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 4. UI screens
const PHONE_UI = new Set(['title_enter', 'title_hero', 'signin_card', 'signup_card', 'avatar_creator', 'avatar_creator_bottom', 'hud_idle_praca', 'dialogue_carlos_pedido', 'dialogue_carlos_conversa', 'tracker_mid_recado', 'meveum', 'feira_price', 'feira_payment_tray']);

async function sectionUi(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  const ui = async (name, opts) => {
    if (vp.touch && !PHONE_UI.has(name)) return;
    await snap(page, vp, `ui_${name}`, opts);
  };
  // title / sign-in / sign-up / avatar creator (named ui_*, all starred)
  await boot(page, vp, { shots: true });
  const close = async () => {
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelectorAll('[data-modal] .close, #dialogue-box .dbx-close').forEach((b) => b.click()));
    await sleep(500);
  };
  await pin(page, '12:00');
  await sleep(2500);

  // HUD idle in the praça
  await walk(page, 25, 16);
  await sleep(1500);
  await ui('hud_idle_praca');

  // hotspot card: the newsstand headlines
  await walk(page, 24, 7);
  await page.evaluate(() => window.__tb.clickHit({ kind: 'hotspot', hotspot: { id: 'banca_manchetes', room: 'praca', x: 20, y: 4, w: 3, h: 2, pt: 'BANCA', en: 'NEWSSTAND' } }));
  await page.waitForSelector('[data-modal] .hs-sign', { timeout: 8000 }).catch(() => missed.push('hotspot card did not open'));
  await sleep(700);
  await ui('hotspot_card');
  await close();

  // map panel, credits
  await page.click('#btn-map');
  await sleep(1200);
  await ui('map_panel');
  await close();
  await page.click('#btn-menu').catch(() => page.click('#btn-burger'));
  await page.click('#btn-credits');
  await page.waitForSelector('[data-modal="credits"] .credits-panel', { timeout: 5000 });
  await sleep(500);
  await ui('credits');
  await close();

  // journal (welcome chain) and Caderno
  await page.click('#btn-recados');
  await sleep(900);
  await ui('journal_welcome');
  await close();
  await page.click('#btn-caderno');
  await sleep(900);
  await ui('caderno');
  await close();

  // hat shop, Nanda talk
  await pin(page, '12:00');
  await interact(page, { prop: 'barraca' });
  await page.waitForSelector('[data-modal] .panel', { timeout: 8000 });
  await sleep(900);
  await ui('hat_shop');
  await close();
  await sleep(500);
  await walk(page, 34, 15);
  await pin(page, '12:00');
  await sleep(2500);
  await openNpc(page, 'nanda');
  await sleep(900);
  await ui('dialogue_nanda_talk');
  await close();

  // the feira: price and payment tray
  await pin(page, '10:00');
  await walk(page, 45, 19);
  await sleep(6000);
  await openNpc(page, 'tia_lu', 'feira');
  await page.click('#dialogue-box [data-chip="0"]');
  await waitFor(page, () => /dois reais/.test(document.querySelector('#dialogue-box .line-bubble .pt')?.textContent ?? ''), null, 10_000, 'the price');
  await sleep(700);
  await ui('feira_price');
  await page.click('#dialogue-box [data-chip="1"]');
  await page.waitForSelector('#feira-tray', { timeout: 8000 });
  await sleep(700);
  await ui('feira_payment_tray');
  await close();

  // padaria: the recado offer, the tracker, Conversa, Pedido, Me vê um
  await pin(page, '12:00');
  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(3000);
  await pin(page, '12:00');
  await sleep(4000);
  await interact(page, { npc: 'carlos' });
  await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
  let key = await page.getAttribute('#dialogue-box', 'data-dialogue');
  if (key === 'offer-carlos') {
    await sleep(1200);
    await ui('recado_offer');
    await page.click('#dialogue-box [data-chip="0"]');
    await page.waitForSelector('#recado-tracker [data-recado="carlos_cafe_pra_nanda"]', { timeout: 8000 }).catch(() => missed.push('tracker mid-recado: recado did not start'));
    await sleep(2200);
    await ui('tracker_mid_recado');
  } else {
    missed.push(`recado offer: Carlos opened "${key}" instead of an offer`);
    await close();
  }
  await interact(page, { npc: 'carlos' });
  await page.waitForSelector('#dialogue-box[data-dialogue="conversa"]', { timeout: 25_000 });
  await sleep(1200);
  await ui('dialogue_carlos_conversa');
  await page.click('[data-action="pedido-rapido"]');
  await page.waitForSelector('#dialogue-box[data-dialogue="pedido"]', { timeout: 12_000 });
  await sleep(900);
  await ui('dialogue_carlos_pedido');
  await close();
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'start' }));
  await page.waitForSelector('#mg-order', { timeout: 8000 });
  await sleep(1200);
  await ui('meveum');
  await page.click('#minigame .mg-head button.ghost').catch(() => {});
  await sleep(800);
  await close();

  // kitnet decorate mode
  if (!vp.touch) {
    await interact(page, { portal: 'padaria_praca' });
    await waitRoom(page, 'praca');
    await sleep(1000);
    await interact(page, { portal: 'praca_kitnet' });
    await waitRoom(page, 'kitnet');
    await sleep(2500);
    await page.click('#btn-decor');
    await page.waitForSelector('.decor', { timeout: 5000 });
    await sleep(900);
    await ui('kitnet_decorate_panel');
    await page.evaluate(() => {
      const g = window.__tb.game;
      g.furniture = [
        { uid: 'd1', itemId: 'poltrona_verde', x: 3, y: 3, rot: 0 },
        { uid: 'd2', itemId: 'planta', x: 5, y: 4, rot: 0 },
        { uid: 'd3', itemId: 'mesinha', x: 4, y: 5, rot: 0 },
      ];
      g.editMode = true;
      g.placing = { itemId: 'cadeira_madeira', rot: 0 };
      g.hoverTile = { x: 5, y: 6 };
    });
    await sleep(900);
    await ui('kitnet_decorate_ghost');
    await page.evaluate(() => { const g = window.__tb.game; g.placing = null; g.selectedFurniture = 'd1'; g.hoverTile = { x: 5, y: 2 }; });
    await sleep(900);
    await ui('kitnet_decorate_selected');
    await page.evaluate(() => { const g = window.__tb.game; g.editMode = false; g.placing = null; g.selectedFurniture = null; g.hoverTile = null; g.furniture = []; });
  }
  await ctx.close();
}

// ---------------------------------------------------------------- 5. crowd close-ups
async function sectionCrowd(browser, vp) {
  const { ctx, page } = await newPage(browser, vp);
  await boot(page, vp);
  await pin(page, '12:00');
  await page.waitForFunction(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.cpu).length >= 4, null, { timeout: 15_000 }).catch(() => {});
  await sleep(4000);
  // the densest cluster of people (players, CPUs, NPCs), by tile, in the praça
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
  for (const z of [5, 6]) {
    await cam(page, `cam:${centre.x.toFixed(1)},${centre.y.toFixed(1)},${z}`);
    await sleep(1800);
    await snap(page, vp, `crowd_praca_1200_z${z}`, { clean: true });
  }
  // a second look at the fountain / benches: another spot with people sitting
  await cam(page, null);
  await ctx.close();
}

// ---------------------------------------------------------------- 6. existing sheets
function sheets() {
  const run = (args) => {
    console.log('  node', args.join(' '));
    execFileSync(process.execPath, args, { stdio: 'inherit' });
  };
  const put = (f) => made.push(f);
  run(['scripts/character-lineup.mjs', path.join(OUT, 'sheet_character_lineup.png')]);
  put('sheet_character_lineup.png');
  for (const set of ['art1', 'portraits', 'feira', 'icons', 'ui', 'fixes', 'floors', 'walls', 'padaria', 'kitnet', 'academia', 'praca']) {
    try {
      run(['scripts/pixel-contact.mjs', '--set', set, path.join(OUT, `sheet_contact_${set}.png`)]);
      put(`sheet_contact_${set}.png`);
    } catch (e) {
      missed.push(`contact sheet ${set}: ${String(e).slice(0, 80)}`);
    }
  }
}

// ---------------------------------------------------------------- main
await requirePinnedClock(BASE, { min: 0, max: 1439, target: 12 * 60, label: 'any hour (the audit pins each scene itself)' });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const vps = argv.vp ? [argv.vp === 'phone' ? PHONE : DESKTOP] : [DESKTOP, PHONE];
  for (const vp of vps) {
    console.log(`\n== ${vp.name}`);
    if (ONLY.includes('ui')) await sectionUi(browser, vp);
    if (ONLY.includes('map')) await sectionMap(browser, vp);
    if (ONLY.includes('areas')) await sectionAreas(browser, vp);
    if (ONLY.includes('interiors')) await sectionInteriors(browser, vp);
    if (ONLY.includes('crowd') && !vp.touch) await sectionCrowd(browser, vp);
  }
  if (ONLY.includes('sheets')) sheets();
} finally {
  await browser.close();
}
console.log(`\n${made.length} files in ${OUT}`);
if (missed.length) console.log('could not capture:\n  - ' + missed.join('\n  - '));
