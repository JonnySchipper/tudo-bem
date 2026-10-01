#!/usr/bin/env node
/**
 * Phase 8a review screenshots + a full recado walk-through: the welcome tracker (Júlia's chain), the offer in Seu Carlos' dialogue, the tracker
 * mid-recado, the journal (with the Mochila), the "Entregar" chip, the thanks card and the heart-up toast, at desktop and phone size.
 *
 *   TB_TEST_OFFER=carlos_cafe_pra_nanda TB_TEST_CLOCK_OFFSET_MIN=<min> PORT=8805 TB_TEST_ROLL=1 pnpm start
 *   BASE_URL=http://localhost:8805 node scripts/lifesim-shots-p8a.mjs      # → docs/lifesim/shots/p8a/
 *
 * The server clock must read daytime (Seu Carlos 06-22, Nanda at her stall 08-20). Env: BASE_URL, CHROME_PATH, SHOTS_DIR. Flag: --only=1280x800 | 390x844.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { requirePinnedClock } from './lib/clock-pin.mjs';

const argv = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const OUT = process.env.SHOTS_DIR ?? path.join('docs', 'lifesim', 'shots', 'p8a');
const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844, touch: true },
].filter((v) => !argv.only || v.name === argv.only);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => {
  if (!c) throw new Error(`assert: ${m}`);
};

async function shot(page, vp, name) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${vp.name}_${name}.png`) });
  console.log('  ·', vp.name, name);
}
async function interact(page, target) {
  const ok = await page.evaluate((t) => window.__tb.interact(t), target);
  assert(ok, `interact target ${JSON.stringify(target)}`);
}
const waitRoom = (page, id) => page.waitForFunction((id) => window.__tb.game.room?.room === id, id, { timeout: 20_000 });
const box = (page, key) => page.waitForSelector(`#dialogue-box[data-dialogue="${key}"]`, { timeout: 25_000 });
const typed = (page) => page.waitForFunction(() => !document.querySelector('#dialogue-box .tw-rest')?.textContent, null, { timeout: 15_000 }).catch(() => {});

async function toWorld(page, vp) {
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `p8a+${vp.name}${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Jonny');
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await waitRoom(page, 'praca');
  await sleep(1500);
}

const rect = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, shown: r.width > 0 && getComputedStyle(el).display !== 'none' };
  }, sel);
const overlap = (a, b) => !!a && !!b && a.shown && b.shown && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

async function run(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, hasTouch: !!vp.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await toWorld(page, vp);

  // 1. Júlia's welcome chain, as the tracker (also on a phone, clear of the joystick and the chat)
  const tr = await rect(page, '#recado-tracker');
  assert(tr?.shown, 'the tracker shows');
  const head = await page.textContent('#recado-tracker');
  assert(head.includes('Bem-vindo à Vila Ipê'), `welcome chain title (${head})`);
  if (vp.touch) {
    for (const sel of ['#joystick', '.bottombar', '.chatbar']) assert(!overlap(tr, await rect(page, sel)), `tracker clears ${sel}`);
    assert(tr.r <= vp.width && tr.b < vp.height * 0.4, 'the tracker stays small on a phone');
  }
  assert(!(await page.$('#checklist')), 'the old checklist is gone');
  await shot(page, vp, 'tracker_tutorial');

  // 2. Seu Carlos offers a recado when you talk to him
  await interact(page, { portal: 'praca_padaria' });
  await waitRoom(page, 'padaria');
  await sleep(1200);
  await page.waitForFunction(() => window.__tb.game.liveNpcs(performance.now()).some((n) => n.id === 'carlos' || n.id === 'graca'), null, { timeout: 15_000 });
  const baker = await page.evaluate(() => (window.__tb.clock.minutes() >= 360 && window.__tb.clock.minutes() < 1320 ? 'carlos' : 'graca'));
  await interact(page, { npc: baker });
  await box(page, `offer-${baker}`);
  await typed(page);
  await sleep(500);
  assert((await page.textContent('#dialogue-box')).includes('Pode deixar!'), 'offer chip: Pode deixar!');
  assert((await page.textContent('#dialogue-box')).includes('Agora não'), 'offer chip: Agora não');
  assert(await page.$('#dialogue-box .dbx-hearts'), 'hearts next to the name tag');
  await shot(page, vp, 'offer_dialogue');
  await page.click('#dialogue-box [data-chip="0"]');
  await page.waitForSelector('#recado-tracker [data-recado="carlos_cafe_pra_nanda"]', { timeout: 8000 });
  await sleep(1700);
  await shot(page, vp, 'tracker_mid_recado');

  // 3. the journal: offered / active / Mochila / friends
  await page.click('#btn-recados');
  await page.waitForSelector('[data-modal="recados"] .rj-card.active', { timeout: 5000 });
  assert((await page.textContent('[data-modal="recados"]')).includes('Mochila'), 'journal has the Mochila');
  await sleep(300);
  await shot(page, vp, 'journal');
  await page.keyboard.press('Escape');
  await sleep(300);

  // 4. order café com leite through Pedido rápido (the recado's first step); it lands in the bag
  await interact(page, { npc: baker });
  await box(page, 'conversa');
  await page.click('[data-action="pedido-rapido"]');
  await box(page, 'pedido');
  for (const chip of [0, 1, 3, 0, 0]) {
    const before = await page.textContent('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt');
    await sleep(500);
    await page.click(`#dialogue-box[data-dialogue="pedido"] [data-chip="${chip}"]`);
    await page.waitForFunction((b) => document.querySelector('#dialogue-box[data-dialogue="pedido"] .line-bubble .pt')?.textContent !== b, before, { timeout: 8000 });
  }
  await page.waitForFunction(() => (window.__tb.game.profile.bag?.cafe_com_leite ?? 0) >= 1, null, { timeout: 8000 });
  await page.keyboard.press('Escape');
  await sleep(400);
  const step1 = await page.evaluate(() => window.__tb.game.board.active.find((a) => a.id === 'carlos_cafe_pra_nanda')?.step);
  assert(step1 === 1, `recado step 1 after ordering (got ${step1})`);
  await page.click('#btn-recados');
  await page.waitForSelector('[data-modal="recados"] .rj-item[data-item="cafe_com_leite"]', { timeout: 5000 });
  await sleep(900);
  await shot(page, vp, 'journal_bag');
  await page.keyboard.press('Escape');

  // 5. to Nanda: "Entregar café com leite"
  await interact(page, { portal: 'padaria_praca' });
  await waitRoom(page, 'praca');
  await sleep(1000);
  await page.waitForFunction(() => window.__tb.game.liveNpcs(performance.now()).some((n) => n.id === 'nanda'), null, { timeout: 15_000 });
  const rvBefore = await page.evaluate(() => window.__tb.game.profile.coins);
  const bondBefore = await page.evaluate(() => window.__tb.game.profile.bond?.carlos ?? 0);
  const bagBefore = await page.evaluate(() => window.__tb.game.profile.bag?.cafe_com_leite ?? 0);
  await interact(page, { npc: 'nanda' });
  await box(page, 'give-nanda');
  await typed(page);
  await sleep(500);
  assert((await page.textContent('#dialogue-box')).includes('Entregar café com leite'), 'give chip: Entregar café com leite');
  await shot(page, vp, 'give_chip');
  await page.click('#dialogue-box [data-chip="0"]');
  await page.waitForSelector('#recado-done', { timeout: 8000 });
  await sleep(700);
  await shot(page, vp, 'recado_done');
  const after = await page.evaluate(() => ({ coins: window.__tb.game.profile.coins, bond: window.__tb.game.profile.bond, done: window.__tb.game.board.done, bag: window.__tb.game.profile.bag }));
  assert(after.done.includes('carlos_cafe_pra_nanda'), 'the recado is done');
  assert(after.coins - rvBefore >= 10, `RV reward (+${after.coins - rvBefore})`);
  assert((after.bond.carlos ?? 0) - bondBefore === 4, `bond reward for Seu Carlos (+${(after.bond.carlos ?? 0) - bondBefore})`);
  assert((after.bag.cafe_com_leite ?? 0) === bagBefore - 1, 'the coffee left the bag');
  await sleep(1500);

  if (process.env.PIN_CLOCK) await page.evaluate(() => window.__tb.setClock({ time: '12:00' }));
  // 5b. talk to Nanda again: her own offers (declined) and then her greeting
  await interact(page, { npc: 'nanda' });
  for (let i = 0; i < 6; i++) {
    await page.waitForSelector('#dialogue-box', { timeout: 20_000 });
    const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
    console.log('    nanda box:', key);
    if (key === 'talk-nanda') break;
    await page.click('#dialogue-box [data-chip="1"]');
    await sleep(400);
  }
  assert((await page.getAttribute('#dialogue-box', 'data-dialogue')) === 'talk-nanda', 'Nanda greets after the offers are declined');
  await page.keyboard.press('Escape');
  await sleep(300);

  // 6. a heart-up toast (a real heart needs 10 points: lift Nanda's bond in the page for the picture)
  await page.evaluate(() => {
    const g = window.__tb.game;
    g.profile = { ...g.profile, bond: { ...g.profile.bond, nanda: 9 } };
    g.emit('profile');
    g.profile = { ...g.profile, bond: { ...g.profile.bond, nanda: 11 } };
    g.emit('profile');
  });
  await page.waitForSelector('.toast.reward', { timeout: 3000 });
  await sleep(300);
  await shot(page, vp, 'heart_up_toast');

  assert(!errors.length, `no page errors: ${errors.join(' | ')}`);
  await ctx.close();
}

if (!process.env.SOLO) await requirePinnedClock(BASE, { label: 'daytime, about 08:30' });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  for (const vp of VIEWPORTS) {
    console.log(`\n== ${vp.name}`);
    await run(browser, vp);
  }
  console.log('\n  ✓ p8a shots done');
} finally {
  await browser.close();
}
