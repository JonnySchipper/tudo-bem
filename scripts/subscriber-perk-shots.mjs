#!/usr/bin/env node
/**
 * Real screenshots of the subscriber dog, cat and chat-bubble trims.
 *
 *   pnpm --filter @tudobem/client dev --host 127.0.0.1 --port 5173
 *   BASE_URL=http://127.0.0.1:5173 node scripts/subscriber-perk-shots.mjs
 *
 * Enters as a guest, grants the test subscription through the admin Assinaturas path
 * (`admin` login + `grantSub`), adopts the parrot, then walks with each pet.
 * The dog and the cat trail a few tiles behind. "senta" and "deita" are sent as normal chat.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findChrome } from './lib/chrome.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const SHOTS = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs/lifesim/shots/subscriber-perks');
const CHROME = findChrome();
if (!CHROME) throw new Error('Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log('  ·', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enter(page) {
  const url = new URL(BASE);
  url.searchParams.set('solo', '1');
  url.searchParams.set('cpu', 'off');
  url.searchParams.set('rolltest', '1');
  await page.goto(url.toString());
  await page.waitForSelector('#intro-enter', { timeout: 30_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Lia');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '11:00', weather: 'sol' }));
  await sleep(600);
}

/**
 * Solo admin login cannot hash the password (the browser build externalizes node:crypto), so the
 * shot uses the rolltest session — the same grant the Assinaturas "Conceder" button applies
 * (`grantTestSubscription`: active, dev provider, 30 days) — then the real perk messages.
 */
async function grant(page) {
  await page.evaluate(() => {
    const s = window.__tb.net.debugSession();
    if (!s?.profile) throw new Error('no rolltest session');
    const now = Date.now();
    s.profile.subscription = { status: 'active', currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000, provider: 'dev' };
    s.profile.founderBadge = true;
    window.__tb.net.send({ t: 'parrot', action: 'adopt' });
    window.__tb.net.send({ t: 'perk', action: 'pet', pet: null });
  });
  await page.waitForFunction(() => {
    const p = window.__tb.game.profile;
    return p?.subscription?.status === 'active' && p.parrotEquipped === true;
  }, null, { timeout: 8_000 });
  log('test subscription granted, parrot equipped');
}

async function setPet(page, pet) {
  await page.evaluate((pet) => window.__tb.net.send({ t: 'perk', action: 'pet', pet }), pet);
  await page.waitForFunction((pet) => {
    const self = window.__tb.game.self;
    return self?.pub?.pet === pet && self.pub.parrot === true;
  }, pet, { timeout: 8_000 });
  await sleep(250);
}

async function freezeWalking(page) {
  const info = await page.evaluate(async () => {
    const tb = window.__tb;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const trailing = (owner, pet, facing) => {
      const dx = owner.x - pet.x;
      const dy = owner.y - pet.y;
      if (facing === 'E') return dx > 12 && Math.abs(pet.y - owner.y) < 22;
      if (facing === 'W') return dx < -12 && Math.abs(pet.y - owner.y) < 22;
      if (facing === 'S') return dy > 12 && Math.abs(pet.x - owner.x) < 22;
      if (facing === 'N') return dy < -12 && Math.abs(pet.x - owner.x) < 22;
      return false;
    };
    tb.renderer.scene.scene.resume();
    const here = tb.selfTile();
    if (!here?.tile) throw new Error('no self tile');
    const { x: hx, y: hy } = here.tile;
    const tries = [
      [hx + 10, hy],
      [hx - 10, hy],
      [hx, hy + 8],
      [hx, hy - 8],
      [24, 12],
      [8, 16],
    ];
    let moved = false;
    let dest = null;
    let pose = null;
    for (const [x, y] of tries) {
      if (x === hx && y === hy) continue;
      tb.walkTo(x, y);
      dest = { x, y };
      const until = performance.now() + 3200;
      while (performance.now() < until) {
        const scene = tb.renderer.scene;
        const me = [...scene.avatars.values()].find((v) => v.pet);
        const key = me?.petKey ?? '';
        if (me?.moving && me.pet && key.includes('walk') && trailing({ x: me.wx, y: me.wy }, { x: me.pet.x, y: me.pet.y }, me.facing)) {
          moved = true;
          pose = {
            petKey: key,
            facing: me.facing,
            owner: { x: me.wx, y: me.wy },
            pet: { x: me.pet.x, y: me.pet.y },
            flip: me.pet.flipX,
            petFrame: me.pet.anims?.currentFrame?.index ?? null,
          };
          scene.scene.pause();
          break;
        }
        await sleep(40);
      }
      if (moved) break;
      tb.renderer.scene.scene.resume();
    }
    if (!moved || !pose) {
      const scene = tb.renderer.scene;
      const me = [...scene.avatars.values()].find((v) => v.pet);
      return { moved, dest, from: { x: hx, y: hy }, petKey: me?.petKey ?? null, facing: me?.facing ?? null, owner: me ? { x: me.wx, y: me.wy } : null, pet: me?.pet ? { x: me.pet.x, y: me.pet.y } : null };
    }
    const scene = tb.renderer.scene;
    const cam = scene.cameras.main;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    const dpr = scene.scale.width / Math.max(1, window.innerWidth);
    const toCss = (wx, wy) => ({
      x: ((wx - cam.scrollX - hw) * cam.zoom + hw) / dpr,
      y: ((wy - cam.scrollY - hh) * cam.zoom + hh) / dpr,
    });
    return {
      moved,
      dest,
      from: { x: hx, y: hy },
      ...pose,
      parrot: !!petViewSafe(scene),
      petAt: toCss(pose.pet.x, pose.pet.y),
      ownerAt: toCss(pose.owner.x, pose.owner.y),
    };
    function petViewSafe(scene) {
      return [...scene.avatars.values()].some((v) => v.parrot);
    }
  });
  log('walk', JSON.stringify(info));
  if (!info.moved || !String(info.petKey ?? '').includes('walk')) {
    throw new Error(`expected a pet trailing behind, got ${JSON.stringify(info)}`);
  }
  return info;
}

async function shotWalking(page, file) {
  const info = await freezeWalking(page);
  await sleep(80);
  await page.screenshot({ path: file });
  await page.evaluate(() => window.__tb.renderer.scene.scene.resume());
  return info;
}

/** Wait until the player and the pet have both stopped, so a sit or lie reads next to them. */
async function settle(page) {
  await page.evaluate(() => window.__tb.renderer.scene.scene.resume());
  await page.waitForFunction(() => {
    const t = window.__tb.selfTile();
    const me = [...window.__tb.renderer.scene.avatars.values()].find((v) => v.pet);
    return t && !t.moving && me && !me.moving && String(me.petKey).includes('idle');
  }, null, { timeout: 10_000 });
}

/**
 * Send a one-word pet command as ordinary chat. The line still goes out; the pet reacts on top.
 * `pose` is the animation stem (`sit` or `lie`).
 */
async function shotCommand(page, text, pose, file, waitIdle) {
  if (waitIdle) await settle(page);
  else await page.evaluate(() => window.__tb.renderer.scene.scene.resume());
  await page.evaluate((text) => window.__tb.net.send({ t: 'chat', text }), text);
  await page.waitForFunction((pose) => {
    const me = [...window.__tb.renderer.scene.avatars.values()].find((v) => v.pet);
    return me && String(me.petKey).includes(pose);
  }, pose, { timeout: 6_000 });
  await sleep(220);
  await page.evaluate(() => window.__tb.renderer.scene.scene.pause());
  await sleep(40);
  const info = await page.evaluate(() => {
    const me = [...window.__tb.renderer.scene.avatars.values()].find((v) => v.pet);
    return { petKey: me?.petKey ?? null, moving: me?.moving ?? null, ownerMoving: me?.pet ? undefined : null };
  });
  log(text, JSON.stringify(info));
  if (!String(info.petKey ?? '').includes(pose)) throw new Error(`expected pet ${pose}, got ${JSON.stringify(info)}`);
  await page.screenshot({ path: file });
  await page.evaluate(() => window.__tb.renderer.scene.scene.resume());
}

async function shotBubble(page, style, file) {
  await page.evaluate(() => window.__tb.renderer.scene.scene.resume());
  await page.evaluate((style) => {
    const tb = window.__tb;
    tb.net.send({ t: 'perk', action: 'bubble', style });
    tb.net.send({ t: 'chat', text: 'Oi! Tudo bem?' });
  }, style);
  const sel = style === 'classic' ? '.wl-bubble:not([class*="wl-style-"])' : `.wl-bubble.wl-style-${style}`;
  await page.waitForSelector(sel, { timeout: 6_000 });
  await sleep(280);
  const box = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, text: el.innerText };
  }, sel);
  log(style, JSON.stringify(box));
  await page.screenshot({ path: file });
  return box;
}

/** 640×400 window around a chat bubble, shifted down so the speaker stays in the cell. */
function bubbleFrame(box, viewW = 1280, viewH = 800) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2 + 70;
  const left = Math.max(0, Math.min(viewW - 640, Math.round(cx - 320)));
  const top = Math.max(0, Math.min(viewH - 400, Math.round(cy - 160)));
  return { left, top, width: 640, height: 400 };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const desk = await desktop.newPage();
await enter(desk);
await grant(desk);

const raw = path.join(SHOTS, '_raw');
fs.mkdirSync(raw, { recursive: true });

await setPet(desk, 'dog');
await shotWalking(desk, path.join(SHOTS, 'walk-1280x800.png'));
log('wrote walk-1280x800.png');
await shotCommand(desk, 'senta', 'sit', path.join(SHOTS, 'dog-sit-1280x800.png'), true);
log('wrote dog-sit-1280x800.png');
await shotCommand(desk, 'deita', 'lie', path.join(SHOTS, 'dog-lie-1280x800.png'), false);
log('wrote dog-lie-1280x800.png');

await setPet(desk, 'cat');
await shotWalking(desk, path.join(SHOTS, 'cat-walk-1280x800.png'));
log('wrote cat-walk-1280x800.png');
await shotCommand(desk, 'senta', 'sit', path.join(SHOTS, 'cat-sit-1280x800.png'), true);
log('wrote cat-sit-1280x800.png');
await shotCommand(desk, 'deita', 'lie', path.join(SHOTS, 'cat-lie-1280x800.png'), false);
log('wrote cat-lie-1280x800.png');

const bubbleFiles = [];
for (const style of ['classic', 'sol', 'mar', 'mata', 'festa']) {
  const file = path.join(raw, `bubble-${style}.png`);
  const box = await shotBubble(desk, style, file);
  bubbleFiles.push({ style, file, box });
}
await desktop.close();

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const ph = await phone.newPage();
await enter(ph);
await grant(ph);
await setPet(ph, 'dog');
await shotWalking(ph, path.join(SHOTS, 'walk-390x844.png'));
await setPet(ph, 'cat');
await shotWalking(ph, path.join(raw, 'cat-390.png'));
await phone.close();
await browser.close();

// Four subscriber trims, each a real chat bubble, in one 1280×800 sheet.
const cells = [
  ['sol', 0, 0],
  ['mar', 640, 0],
  ['mata', 0, 400],
  ['festa', 640, 400],
];
const overlays = [];
for (const [style, x, y] of cells) {
  const shot = bubbleFiles.find((b) => b.style === style);
  const buf = await sharp(shot.file).extract(bubbleFrame(shot.box)).toBuffer();
  overlays.push({ input: buf, left: x, top: y });
}
await sharp({ create: { width: 1280, height: 800, channels: 4, background: '#1d1b26' } })
  .composite(overlays)
  .png()
  .toFile(path.join(SHOTS, 'bubbles-1280x800.png'));
log('wrote bubbles-1280x800.png');
console.log('shots in', SHOTS);
