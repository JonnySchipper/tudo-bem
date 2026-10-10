#!/usr/bin/env node
/**
 * Screenshots of the Pet Shop do Seu Dito (#234, docs/PET-STORE-PLAN.md §9.3) → docs/lifesim/shots/petshop/.
 *
 *   pnpm shots:pet-shop                     # starts the client dev server (solo build) on :5179 and stops it at the end
 *   BASE_URL=http://127.0.0.1:5173 pnpm shots:pet-shop   # or use one that is already running
 *
 * Solo build (the world runs in the page). A free player first: the facade by day and at night, the interior with the day's animals, the
 * Adotar tab with the Apoiar card, a carinho and Seu Dito's line, the Diário's Pet Shop chapter. Then the test subscription (the rolltest
 * session, as subscriber-perk-shots.mjs does): the meet view, the name dialog, the adoption, Meus pets, the Lojinha, a collar and a toy,
 * the pet following on the street, and the kitnet with the others resting (one on a caminha). It throws when a step does not happen.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival, quietFirstTimeCards } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/petshop');
const CHROME = findChrome();
if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log('  ·', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The dev server: the one given, or our own for the length of the run. */
async function server() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL, stop: () => {} };
  const port = 5179;
  const child = spawn('pnpm', ['--filter', '@tudobem/client', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let out = '';
  child.stdout.on('data', (b) => (out += b));
  child.stderr.on('data', (b) => (out += b));
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base)).ok) return { base, stop: () => process.kill(-child.pid, 'SIGTERM') };
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  process.kill(-child.pid, 'SIGTERM');
  throw new Error(`the dev server did not start:\n${out}`);
}

async function enter(page, base, name) {
  const url = new URL(base);
  url.searchParams.set('solo', '1');
  url.searchParams.set('cpu', 'off');
  url.searchParams.set('rolltest', '1');
  await page.goto(url.toString());
  await page.click('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-guest', { timeout: 12_000 });
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await quietFirstTimeCards(page);
  await clockAt(page, '11:00');
}

const clockAt = (page, time) => page.evaluate((time) => window.__tb.setClock({ time, weather: 'sol' }), time);
const room = (page) => page.evaluate(() => window.__tb.game.room?.room);

async function join(page, to) {
  await page.evaluate((to) => window.__tb.net.send({ t: 'join', room: to }), to);
  await page.waitForFunction((to) => window.__tb.game.room?.room === to, to, { timeout: 15_000 });
  await sleep(900);
}

/** Closes whatever panel is open (Escape, then the backdrop's close button). */
async function closePanels(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.$('.backdrop'))) return;
    await page.keyboard.press('Escape');
    await sleep(200);
  }
}

/** The test subscription, the way the Assinaturas "Conceder" grants it (subscriber-perk-shots.mjs). */
async function grant(page) {
  await page.evaluate(() => {
    const s = window.__tb.net.debugSession();
    if (!s?.profile) throw new Error('no rolltest session');
    s.profile.subscription = { status: 'active', currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000, provider: 'dev' };
    s.profile.coins = 200;
    // a profile push: any harmless message that answers with the profile
    window.__tb.net.send({ t: 'perk', action: 'pet', pet: null });
  });
  await page.waitForFunction(() => window.__tb.game.profile?.subscription?.status === 'active', null, { timeout: 8_000 });
  log('test subscription granted');
}

const shot = async (page, name) => {
  await sleep(250);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('wrote', `${name}.png`);
};

const srv = await server();
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
try {
  for (const vp of [{ w: 1280, h: 800, tag: '1280x800' }, { w: 390, h: 844, tag: '390x844', phone: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, ...(vp.phone ? { isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await enter(page, srv.base, vp.phone ? 'Bia' : 'Lia');

    // ---------------------------------------------------------------- the street: the front by day and at night
    await join(page, 'rua_leste');
    await page.evaluate(() => window.__tb.walkTo(19, 7));
    await sleep(2500);
    await shot(page, `01-facade-day-${vp.tag}`);
    await clockAt(page, '19:30');
    await sleep(1200);
    await shot(page, `02-facade-night-${vp.tag}`);
    await clockAt(page, '11:00');

    // ---------------------------------------------------------------- inside, a free player
    await page.evaluate(() => window.__tb.interact({ portal: 'rua_petshop' }));
    await page.waitForFunction(() => window.__tb.game.room?.room === 'petshop', null, { timeout: 15_000 });
    await sleep(1500);
    await shot(page, `03-interior-${vp.tag}`);
    await page.evaluate(() => window.__tb.interact({ prop: 'cercadinho' }));
    await page.waitForSelector('#petshop-panel', { timeout: 12_000 });
    if (!(await page.$('#petshop-gate'))) throw new Error('a free player sees the Apoiar card');
    await shot(page, `04-adotar-free-${vp.tag}`);
    await page.click('.petshop-animal[data-pen="cercadinho"][data-slot="0"]');
    await page.waitForSelector('#petshop-meet', { timeout: 6_000 });
    if (await page.$('#petshop-adopt')) throw new Error('no Adotar button without a subscription');
    const words0 = await page.evaluate(() => (window.__tb.game.profile?.diary ?? []).length);
    await page.click('#petshop-carinho');
    await page.waitForFunction((n) => (window.__tb.game.profile?.diary ?? []).length > n, words0, { timeout: 8_000 });
    await sleep(400);
    await shot(page, `05-carinho-${vp.tag}`);
    await closePanels(page);

    // ---------------------------------------------------------------- subscriber: meet, name, adopt
    await grant(page);
    await page.evaluate(() => window.__tb.interact({ prop: 'cercadinho' }));
    await page.waitForSelector('#petshop-panel', { timeout: 12_000 });
    if (await page.$('#petshop-gate')) throw new Error('a subscriber does not see the Apoiar card');
    await shot(page, `06-adotar-subscriber-${vp.tag}`);
    await page.click('.petshop-swatch[data-breed="vira_lata_caramelo"]');
    await page.waitForSelector('#petshop-meet', { timeout: 6_000 });
    await shot(page, `07-meet-${vp.tag}`);
    await page.click('#petshop-adopt');
    await page.waitForSelector('#pet-name-input', { timeout: 6_000 });
    await page.fill('#pet-name-input', 'Paçoca');
    await shot(page, `08-name-${vp.tag}`);
    await page.click('#pet-name-save');
    await page.waitForFunction(() => (window.__tb.game.profile?.pets ?? []).some((q) => q.name === 'Paçoca'), null, { timeout: 10_000 });
    await page.waitForSelector('#petshop-pets', { timeout: 8_000 });
    await shot(page, `09-adopted-meus-pets-${vp.tag}`);
    await page.evaluate(() => {
      const send = window.__tb.net.send;
      send({ t: 'pet', action: 'adopt', breed: 'siames', coat: 'seal', name: 'Mel' });
      send({ t: 'pet', action: 'adopt', breed: 'dachshund', coat: 'preto_castanho', name: 'Linguiça' });
    });
    await page.waitForFunction(() => (window.__tb.game.profile?.pets ?? []).length >= 3, null, { timeout: 10_000 });

    // ---------------------------------------------------------------- the lojinha: a collar, a ball, a bed
    await closePanels(page);
    await page.evaluate(() => window.__tb.interact({ prop: 'balcao' }));
    await page.waitForSelector('.petshop-shop', { timeout: 12_000 });
    await shot(page, `10-lojinha-${vp.tag}`);
    await page.evaluate(() => {
      const send = window.__tb.net.send;
      for (const itemId of ['coleira_vermelha', 'bolinha', 'caminha_xadrez']) send({ t: 'pet', action: 'buy', itemId });
    });
    await page.waitForFunction(() => {
      const p = window.__tb.game.profile;
      return p?.petItems?.includes('coleira_vermelha') && p.petItems.includes('bolinha') && (p.furniture?.caminha_xadrez ?? 0) > 0;
    }, null, { timeout: 10_000 });
    const pacoca = await page.evaluate(() => window.__tb.game.profile.pets.find((q) => q.name === 'Paçoca').id);
    await page.evaluate((id) => {
      const send = window.__tb.net.send;
      send({ t: 'pet', action: 'equip', petId: id, slot: 'collar', itemId: 'coleira_vermelha' });
      send({ t: 'pet', action: 'equip', petId: id, slot: 'toy', itemId: 'bolinha' });
      send({ t: 'pet', action: 'active', petId: id });
    }, pacoca);
    await page.waitForFunction(() => window.__tb.game.self?.pub?.petCollar === 'coleira_vermelha' && window.__tb.game.self.pub.petToy === 'bolinha', null, { timeout: 10_000 });
    await closePanels(page);

    // ---------------------------------------------------------------- the street with Paçoca, and a busca
    await join(page, 'rua_leste');
    await page.evaluate(() => window.__tb.walkTo(10, 7));
    await sleep(3500);
    await page.evaluate(() => window.__tb.net.send({ t: 'chat', text: 'busca!' }));
    await sleep(700);
    await shot(page, `11-busca-${vp.tag}`);

    // ---------------------------------------------------------------- the kitnet: the others resting, one on the caminha
    await join(page, 'kitnet');
    await quietFirstTimeCards(page);
    await closePanels(page);
    await page.evaluate(() => window.__tb.net.send({ t: 'furniture', action: 'place', itemId: 'caminha_xadrez', x: 5, y: 6, rot: 0 }));
    await page.waitForFunction(() => (window.__tb.game.room?.homePets ?? []).length >= 2, null, { timeout: 10_000 });
    await sleep(7000);
    await shot(page, `12-kitnet-${vp.tag}`);

    // ---------------------------------------------------------------- the Diário's Pet Shop chapter
    await page.evaluate(() => document.querySelector('#btn-caderno')?.click() ?? document.querySelector('#btn-burger')?.click());
    if (!(await page.$('.jb-book, .journal'))) {
      await sleep(300);
      await page.evaluate(() => document.querySelector('#btn-caderno')?.click());
    }
    await page.waitForSelector('[data-journal-tab="petshop"]', { timeout: 8_000 });
    await page.click('[data-journal-tab="petshop"]');
    await sleep(600);
    await shot(page, `13-diario-${vp.tag}`);
    await ctx.close();
  }
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log('shots in', SHOTS);
} finally {
  await browser.close();
  srv.stop();
}
