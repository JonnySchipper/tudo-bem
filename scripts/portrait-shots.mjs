#!/usr/bin/env node
/**
 * Every place an NPC portrait shows, at 1280x800 and 390x844: Nanda and Seu Carlos in the dialogue box, the recado offer and the thanks
 * card, the journal, a feira vendor (Tia Lu) and the escola with Dona Lúcia. Used for the before / after pictures of the portrait rework.
 *
 *   pnpm build
 *   PORT=8810 TB_TEST_CLOCK_CONTROL=1 pnpm start
 *   node scripts/portrait-shots.mjs [--out=docs/lifesim/shots/portraits/after] [--vp=desktop|phone]
 *
 * Each step is best effort: a step that cannot be reached is listed at the end and the run goes on.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { passIdle } from './lib/npc.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8810';
const OUT = argv.out ?? process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'portraits', 'after');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = { name: '1280x800', width: 1280, height: 800 };
const PHONE = { name: '390x844', width: 390, height: 844, touch: true };
const missed = [];

const hm = (t) => t.slice(0, 2) * 60 + Number(t.slice(3, 5));
async function pin(page, time) {
  const r = await fetch(`${new URL(BASE).origin}/__test/clock?min=${hm(time)}`, { method: 'POST' });
  assert(r.ok, 'server clock control (start the server with TB_TEST_CLOCK_CONTROL=1)');
  await page.evaluate((t) => window.__tb.setClock({ time: t, weather: 'sol' }), time);
}
const interact = (page, t) => page.evaluate((t) => window.__tb.interact(t), t);
const waitRoom = (page, id) => waitFor(page, (id) => window.__tb.game.room?.room === id, id, 25_000, `room ${id}`);
const typed = (page) => page.waitForFunction(() => !document.querySelector('#dialogue-box .tw-rest')?.textContent, null, { timeout: 15_000 }).catch(() => {});
const key = (page) => page.getAttribute('#dialogue-box', 'data-dialogue').catch(() => null);
async function close(page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('[data-modal] .close, #dialogue-box .dbx-close').forEach((b) => b.click()));
  await sleep(500);
}

/** The new-word cards ("Nova palavra!") sit over the dialogue box: click them away. */
async function dismissCards(page) {
  for (let i = 0; i < 6 && (await page.$('#photo-close')); i++) {
    await page.click('#photo-close').catch(() => {});
    await sleep(350);
  }
}

/** Leave an interior for the street it opens onto. */
async function outdoors(page) {
  const exits = { padaria: 'padaria_praca', escola: 'escola_rua', kitnet: 'kitnet_praca', academia: 'academia_praca' };
  const room = await page.evaluate(() => window.__tb.game.room?.room);
  if (!exits[room]) return;
  const portal = await page.evaluate((r) => window.__tb.rooms[r].portals.find((p) => !p.edge)?.id, room);
  assert(await interact(page, { portal: portal ?? exits[room] }), `exit of ${room}`);
  await waitFor(page, (r) => window.__tb.game.room?.room !== r, room, 25_000, `out of ${room}`);
  await sleep(1500);
}

async function snap(page, vp, name) {
  await dismissCards(page);
  await typed(page);
  await sleep(400);
  const file = path.join(OUT, `${vp.name}_${name}.png`);
  await page.screenshot({ path: file });
  console.log('  ·', file);
}

/** Run one step; a failure is noted and the run goes on. */
async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    missed.push(`${name}: ${String(e?.message ?? e).split('\n')[0].slice(0, 140)}`);
    console.log(`  (skipped ${name})`);
  }
}

/** Open an NPC and walk through the learned-line opener; returns the first other box key. */
async function talk(page, npc) {
  assert(await interact(page, { npc }), `${npc} is here`);
  await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
  await passIdle(page);
  await sleep(300);
  return key(page);
}

/** Click an HUD action, opening the phone drawer first when its button is hidden. */
async function press(page, sel) {
  const vis = (s) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }, s);
  if (!(await vis(sel))) for (const opener of ['#btn-burger', '#btn-menu']) {
    if (!(await vis(opener))) continue;
    await page.click(opener);
    await sleep(350);
    if (await vis(sel)) break;
  }
  await page.click(sel);
}

async function run(browser, vp) {
  console.log(`\n== ${vp.name}`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.goto(`${BASE}?notype=1`);
  await page.click('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-skip', { timeout: 12_000 });
  await page.waitForSelector('#intro-submit', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `portraits+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.fill('#avatar-name', 'Jonny', { timeout: 15_000 });
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await pin(page, '10:00');
  await sleep(3000);

  await step('dialogue Nanda', async () => {
    await talk(page, 'nanda');
    await snap(page, vp, 'dialogue_nanda');
    await close(page);
  });
  await step('journal', async () => {
    await press(page, '#btn-recados');
    await page.waitForSelector('[data-modal="recados"]', { timeout: 6000 });
    await sleep(700);
    await snap(page, vp, 'journal');
    await close(page);
  });

  // the padaria: Seu Carlos offers the coffee recado, then talks
  let accepted = false;
  await step('padaria', async () => {
    await goArea(page, 'rua');
    assert(await interact(page, { portal: 'praca_padaria' }), 'padaria door');
    await waitRoom(page, 'padaria');
    await pin(page, '10:00');
    await sleep(3500);
    await talk(page, 'carlos');
    for (let i = 0; i < 8; i++) {
      await dismissCards(page);
      const k = await key(page);
      console.log('    carlos box:', k);
      if (k === 'conversa' || k === 'counter-carlos') break;
      if (!k) {
        await talk(page, 'carlos');
        continue;
      }
      if (k === 'offer-carlos' && !accepted) {
        await snap(page, vp, 'recado_offer_carlos');
        await page.click('#dialogue-box [data-chip="0"]');
        accepted = true;
        await sleep(1500);
        await close(page);
        await talk(page, 'carlos');
        continue;
      }
      await page.click('#dialogue-box [data-chip="1"]');
      await sleep(500);
    }
    const k = await key(page);
    assert(k === 'conversa' || k === 'counter-carlos', `Carlos talks (${k})`);
    await snap(page, vp, 'dialogue_carlos');
    if (accepted && k === 'counter-carlos') {
      // the counter: buy the café com leite for Nanda
      const chips = await page.$$eval('#dialogue-box [data-chip]', (bs) => bs.map((b) => [b.dataset.chip, b.textContent ?? '']));
      const chip = chips.find(([, t]) => /caf[ée] com leite/i.test(t))?.[0];
      assert(chip !== undefined, 'café com leite on the counter');
      await page.click(`#dialogue-box [data-chip="${chip}"]`);
      await page.waitForFunction(() => (window.__tb.game.profile.bag?.cafe_com_leite ?? 0) >= 1, null, { timeout: 8000 });
    } else if (accepted) {
      // café com leite through Pedido rápido, for the thanks card
      await page.click('[data-action="pedido-rapido"]');
      await page.waitForSelector('#dialogue-box[data-dialogue="pedido"]', { timeout: 12_000 });
      for (const chip of [0, 1, 3, 0, 0]) {
        const before = await page.textContent('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt');
        await sleep(500);
        await page.click(`#dialogue-box[data-dialogue="pedido"] [data-chip="${chip}"]`);
        await page.waitForFunction((b) => document.querySelector('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt')?.textContent !== b, before, { timeout: 8000 });
      }
      await page.waitForFunction(() => (window.__tb.game.profile.bag?.cafe_com_leite ?? 0) >= 1, null, { timeout: 8000 });
    }
    await close(page);
  });
  if (accepted) await step('thanks card', async () => {
    await outdoors(page);
    await goArea(page, 'praca');
    await sleep(1500);
    assert(await interact(page, { npc: 'nanda' }), 'nanda');
    for (let i = 0; i < 6 && !(await page.$('#dialogue-box[data-dialogue="give-nanda"]')); i++) {
      await page.waitForSelector('#dialogue-box', { timeout: 20_000 });
      await dismissCards(page);
      const k = await key(page);
      console.log('    nanda box:', k);
      if (k?.startsWith('offer-')) await page.click('#dialogue-box [data-chip="1"]');
      await sleep(400);
    }
    await typed(page);
    await page.click('#dialogue-box [data-chip="0"]');
    await page.waitForSelector('#recado-done', { timeout: 8000 });
    await sleep(700);
    await snap(page, vp, 'recado_thanks');
    await close(page);
  });

  await step('feira', async () => {
    await outdoors(page);
    await goArea(page, 'feira');
    await pin(page, '10:00');
    await page.evaluate(() => window.__tb.walkTo(7, 6, false));
    await sleep(5000);
    assert(await interact(page, { npc: 'tia_lu' }), 'tia_lu');
    for (let i = 0; i < 6; i++) {
      await page.waitForSelector('#dialogue-box', { timeout: 8000 });
      const k = await key(page);
      if (k === 'feira') break;
      if (k?.startsWith('offer-') || k?.startsWith('give-')) await page.click('#dialogue-box [data-chip="1"]');
      await sleep(350);
    }
    await page.waitForSelector('#dialogue-box[data-dialogue="feira"]', { timeout: 8000 });
    await snap(page, vp, 'feira_tia_lu');
    await page.click('#dialogue-box [data-chip="0"]');
    await sleep(1200);
    await page.click('#dialogue-box [data-chip="1"]');
    await page.waitForSelector('#feira-tray', { timeout: 6000 });
    await snap(page, vp, 'feira_tray');
    await close(page);
  });

  await step('escola', async () => {
    await outdoors(page);
    await goArea(page, 'rua_leste');
    assert(await interact(page, { portal: 'rua_escola' }), 'escola door');
    await waitRoom(page, 'escola');
    await sleep(1500);
    assert(await interact(page, { prop: 'carteira' }), 'the desk');
    await page.waitForSelector('#escola-practice', { timeout: 20_000 });
    await sleep(800);
    await snap(page, vp, 'escola');
    await close(page);
  });
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const vp of argv.vp ? [argv.vp === 'phone' ? PHONE : DESKTOP] : [DESKTOP, PHONE]) await run(browser, vp);
} finally {
  await browser.close();
}
if (missed.length) console.log('\ncould not capture:\n  - ' + missed.join('\n  - '));
