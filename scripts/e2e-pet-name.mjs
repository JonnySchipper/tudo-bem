#!/usr/bin/env node
/**
 * Name a subscriber dog, then a cat. The name survives a reload, and a second player sees the badge.
 *
 *   node scripts/e2e-pet-name.mjs   (BASE_URL, CHROME_PATH)
 *   Writes 1280x800 and 390x844 shots to docs/lifesim/shots/pet-name/ unless SHOTS=0.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';
import { requirePinnedClock } from './lib/clock-pin.mjs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8787';
const CHROME = findChrome();
const PASSWORD = 'pao-de-queijo-2026';
const ADMIN = process.env.TB_ADMIN_PASSWORD || 'tb-admin-praca';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'docs/lifesim/shots/pet-name');
const SAVE = process.env.SHOTS !== '0';
const NAMES = ['Caramelo', 'Paçoca', 'Feijão', 'Pipoca', 'Bolinha', 'Mel', 'Tapioca', 'Farofa'];
const log = (...a) => console.log('  ·', ...a);

async function signup(page, name) {
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `pet+${name.toLowerCase()}+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PASSWORD);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '11:00', weather: 'sol' }));
}

async function openHud(page, sel) {
  const burger = page.locator('#btn-burger');
  if (await burger.isVisible()) {
    if ((await burger.getAttribute('aria-expanded')) !== 'true') await burger.click();
  } else if ((await page.getAttribute('#btn-menu', 'aria-expanded')) !== 'true') {
    await page.click('#btn-menu');
  }
  await page.click(sel);
}

async function grantSelf(page) {
  await openHud(page, '#btn-credits');
  await page.waitForSelector('#credits-admin-door', { timeout: 8_000 });
  await page.click('#credits-admin-door');
  await page.waitForSelector('#admin-password', { timeout: 8_000 });
  await page.fill('#admin-password', ADMIN);
  await page.click('#admin-login-go');
  const id = await page.evaluate(() => window.__tb.game.profile.id);
  await page.waitForSelector(`[data-grant="${id}"]`, { timeout: 8_000 });
  await page.click(`[data-grant="${id}"]`);
  await waitFor(page, () => window.__tb.game.profile?.subscription?.status === 'active', null, 8_000, 'test subscription');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#admin-subs', { state: 'detached', timeout: 8_000 });
  log('subscription granted');
}

async function stand(page) {
  const tiles = [
    [12, 10],
    [14, 8],
    [10, 12],
    [16, 12],
    [8, 10],
  ];
  for (const [x, y] of tiles) {
    await page.evaluate(([x, y]) => window.__tb.walkTo(x, y, false), [x, y]);
    try {
      await waitFor(
        page,
        ([x, y]) => {
          const t = window.__tb.selfTile();
          return t && !t.moving && t.tile.x === x && t.tile.y === y;
        },
        [x, y],
        8_000,
        `stand on ${x},${y}`,
      );
      return { x, y };
    } catch {
      /* try the next open tile */
    }
  }
  throw new Error('could not stand on an open praça tile');
}

async function settlePet(page, pose) {
  await waitFor(
    page,
    (pose) => {
      const me = [...window.__tb.renderer.scene.avatars.values()].find((v) => v.pet?.visible);
      return !!me && !me.moving && String(me.petKey).includes(pose);
    },
    pose,
    12_000,
    `pet ${pose}`,
  );
}

/** Sit the pet, then wait until that chat line has left the screen so the badge is the label in the shot. */
async function sitForShot(page) {
  await settlePet(page, 'idle');
  await page.evaluate(() => window.__tb.net.send({ t: 'chat', text: 'senta' }));
  await settlePet(page, 'sit');
  await waitFor(
    page,
    () => ![...document.querySelectorAll('.wl-bubble .pt')].some((el) => /senta/i.test(el.textContent ?? '')),
    null,
    12_000,
    'senta bubble clears',
  );
}

function badgeInView(name) {
  const el = document.querySelector(`[data-pet-name="${name}"]`);
  if (!el || getComputedStyle(el).display === 'none') return false;
  const plate = el.querySelector('.wl-plate-pet');
  if (!plate) return false;
  const r = plate.getBoundingClientRect();
  return r.width > 8 && r.height > 8 && r.top > 36 && r.bottom < window.innerHeight - 24 && r.left > 0 && r.right < window.innerWidth;
}

async function waitBadge(page, name) {
  await waitFor(page, badgeInView, name, 12_000, `badge ${name}`);
}

async function badgeOverlapsOwner(page, name, ownerClass) {
  return page.evaluate(
    ([name, ownerClass]) => {
      const pet = document.querySelector(`[data-pet-name="${name}"] .wl-plate`);
      const owner = document.querySelector(ownerClass);
      if (!pet || !owner) return null;
      const a = pet.getBoundingClientRect();
      const b = owner.getBoundingClientRect();
      if (b.width < 2) return false;
      return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    },
    [name, ownerClass],
  );
}

async function shot(page, file) {
  if (!SAVE) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, file) });
  log('shot', file);
}

async function shotPair(page, stem) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(350);
  await shot(page, `${stem}-1280x800.png`);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(450);
  await shot(page, `${stem}-390x844.png`);
  await page.setViewportSize({ width: 1280, height: 800 });
  await sleep(300);
}

async function main() {
  assert(CHROME, 'set CHROME_PATH');
  await requirePinnedClock(BASE, { min: 10 * 60, max: 12 * 60, target: 11 * 60, label: 'late morning' });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctxA.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await signup(page, 'Lia');
    await grantSelf(page);
    await openHud(page, '#btn-support');
    await page.waitForSelector('[data-perk="pet:dog"]', { timeout: 8_000 });
    await page.click('[data-perk="pet:dog"]');
    await page.waitForSelector('#pet-name-panel', { timeout: 8_000 });
    const prompt = await page.textContent('#pet-name-title');
    assert((prompt ?? '').includes('Qual é o nome do seu cachorro?'), `dog prompt, got ${prompt}`);
    assert((await page.textContent('#pet-name-panel'))?.includes("What's your dog's name?"), 'english hint under the dog prompt');
    assert(await page.$('#pet-name-roll'), 'Sortear');
    assert(await page.$('#pet-name-save'), 'Salvar');
    await shotPair(page, 'dialog');

    await page.keyboard.press('Escape');
    await page.waitForSelector('#pet-name-panel', { state: 'detached', timeout: 8_000 });
    await page.reload();
    await waitFor(page, () => window.__tb?.game?.room?.room === 'praca', null, 15_000, 'praça after reload');
    await page.waitForSelector('#pet-name-panel', { timeout: 8_000 });
    log('unnamed pet asks again after reload');

    await page.fill('#pet-name-input', 'Rex2');
    await page.click('#pet-name-save');
    await page.waitForSelector('#pet-name-err', { state: 'visible', timeout: 4_000 });
    assert(((await page.textContent('#pet-name-err')) ?? '').includes('letras'), 'shape error stays in the dialog');

    await page.click('#pet-name-roll');
    const rolled = await page.inputValue('#pet-name-input');
    assert(NAMES.includes(rolled), `Sortear offered ${rolled}`);

    await page.fill('#pet-name-input', 'Caramelo');
    await page.click('#pet-name-save');
    await waitFor(page, () => window.__tb.game.profile?.petNames?.dog === 'Caramelo', null, 8_000, 'Caramelo saved');
    await page.waitForSelector('#pet-name-panel', { state: 'detached', timeout: 8_000 });

    const here = await stand(page);
    await sitForShot(page);
    await waitBadge(page, 'Caramelo');
    assert((await badgeOverlapsOwner(page, 'Caramelo', '.wl-plate-me')) === false, 'dog badge covers Lia’s name');
    await shotPair(page, 'dog');
    await waitBadge(page, 'Caramelo');

    const id = await page.evaluate(() => window.__tb.game.profile.id);
    await page.reload();
    await waitFor(page, () => window.__tb?.game?.profile?.petNames?.dog === 'Caramelo' && window.__tb.game.room?.room === 'praca', null, 15_000, 'named dog after reload');
    assert((await page.$('#pet-name-panel')) === null, 'a named pet does not ask again');
    await page.evaluate(() => window.__tb.setClock({ time: '11:00', weather: 'sol' }));
    await waitBadge(page, 'Caramelo');
    log('badge persisted', id);

    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const other = await ctxB.newPage();
    other.on('pageerror', (e) => errors.push(String(e)));
    await signup(other, 'Bia');
    await other.evaluate(([x, y]) => window.__tb.walkTo(x + 1, y + 1, false), [here.x, here.y]);
    await sleep(600);
    await page.evaluate(() => window.__tb.net.send({ t: 'chat', text: 'senta' }));
    await waitBadge(other, 'Caramelo');
    assert((await badgeOverlapsOwner(other, 'Caramelo', '.wl-plate-player')) === false, 'dog badge covers a name on the other screen');
    await shotPair(other, 'other');
    log('second client sees Caramelo');

    await openHud(page, '#btn-support');
    await page.waitForSelector('#pet-rename', { timeout: 8_000 });
    assert(((await page.textContent('#pet-called')) ?? '').includes('Caramelo'), 'support shows the dog’s name');
    await page.click('#pet-rename');
    await page.waitForSelector('#pet-name-input', { timeout: 8_000 });
    assert((await page.inputValue('#pet-name-input')) === 'Caramelo', 'rename prefills the current name');
    await page.fill('#pet-name-input', 'Paçoca');
    await page.click('#pet-name-save');
    await waitFor(page, () => window.__tb.game.profile?.petNames?.dog === 'Paçoca', null, 8_000, 'renamed');
    await waitBadge(other, 'Paçoca');
    log('rename reached the other client');

    await openHud(page, '#btn-support');
    await page.waitForSelector('[data-perk="pet:cat"]', { timeout: 8_000 });
    await page.click('[data-perk="pet:cat"]');
    await page.waitForSelector('#pet-name-title', { timeout: 8_000 });
    assert(((await page.textContent('#pet-name-title')) ?? '').includes('Qual é o nome da sua gata/do seu gato?'), 'cat prompt');
    await page.fill('#pet-name-input', 'Pipoca');
    await page.click('#pet-name-save');
    await waitFor(page, () => window.__tb.game.profile?.petNames?.cat === 'Pipoca' && window.__tb.game.profile?.petNames?.dog === 'Paçoca', null, 8_000, 'both names stored');
    await stand(page);
    await sitForShot(page);
    await waitBadge(page, 'Pipoca');
    assert((await page.evaluate(() => document.querySelector('[data-pet-name="Paçoca"]'))) === null, 'the dog badge left with the dog');
    assert((await badgeOverlapsOwner(page, 'Pipoca', '.wl-plate-me')) === false, 'cat badge covers Lia’s name');
    await shotPair(page, 'cat');
    await waitBadge(other, 'Pipoca');

    await page.evaluate(() => window.__tb.net.send({ t: 'perk', action: 'pet', pet: null }));
    await waitFor(page, () => !document.querySelector('[data-pet-name="Pipoca"]'), null, 8_000, 'badge hides with the pet');
    await waitFor(other, () => !document.querySelector('[data-pet-name="Pipoca"]'), null, 8_000, 'other client hides the badge');

    assert(errors.length === 0, errors.join('\n'));
    log('pet naming ok');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
