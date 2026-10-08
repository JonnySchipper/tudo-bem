#!/usr/bin/env node
/**
 * Real screenshots of the subscriber dog, cat and chat-bubble trims.
 *
 *   pnpm --filter @tudobem/client dev --host 127.0.0.1 --port 5173
 *   BASE_URL=http://127.0.0.1:5173 node scripts/subscriber-perk-shots.mjs
 *
 * Enters as a guest, grants the test subscription through the admin Assinaturas path
 * (`admin` login + `grantSub`), adopts the parrot, then walks with each pet.
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
    tb.renderer.scene.scene.resume();
    const here = tb.selfTile();
    if (!here?.tile) throw new Error('no self tile');
    const { x: hx, y: hy } = here.tile;
    const selfId = tb.game.self?.pub?.id;
    const tries = [
      [hx + 6, hy],
      [hx - 6, hy],
      [hx, hy + 5],
      [hx, hy - 5],
      [24, 12],
      [16, 8],
    ];
    let moved = false;
    let dest = null;
    for (const [x, y] of tries) {
      if (x === hx && y === hy) continue;
      tb.walkTo(x, y);
      dest = { x, y };
      const until = performance.now() + 700;
      while (performance.now() < until) {
        const f = tb.facings();
        const me = selfId && f ? f[selfId] : null;
        if (me?.moving) { moved = true; break; }
        await sleep(40);
      }
      if (moved) break;
    }
    // A tile step is 260ms and the walk cycle is 8 fps, so hold a beat into the stride.
    await sleep(220);
    const scene = tb.renderer.scene;
    const views = [...scene.avatars.values()];
    const me = views.find((v) => v.pet);
    const pet = me?.pet;
    const parrot = me?.parrot;
    const key = me?.petKey ?? '';
    if (!moved || !key.includes('walk')) {
      return { moved, dest, from: { x: hx, y: hy }, petKey: key || null, facing: tb.facings() };
    }
    scene.scene.pause();
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
      tile: tb.selfTile(),
      petFrame: pet?.anims?.currentFrame?.index ?? null,
      petKey: key,
      flip: pet ? pet.flipX : null,
      parrot: !!parrot,
      facing: selfId ? tb.facings()?.[selfId] : null,
      petAt: pet ? toCss(pet.x, pet.y) : null,
    };
  });
  log('walk', JSON.stringify(info));
  if (!info.moved || !String(info.petKey ?? '').includes('walk')) {
    throw new Error(`expected a walking pet, got ${JSON.stringify(info)}`);
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

/** 640×800 window that keeps a point on screen, biased left so the shoulder parrot stays in frame. */
function halfFrame(px, py, viewW = 1280, viewH = 800) {
  const left = Math.max(0, Math.min(viewW - 640, Math.round(px - 280)));
  const top = Math.max(0, Math.min(viewH - 800, Math.round((py ?? 400) - 400)));
  return { left, top, width: 640, height: 800 };
}

async function joinHorizontal(leftFile, rightFile, out, leftAt, rightAt) {
  const a = await sharp(leftFile).extract(halfFrame(leftAt?.x ?? 820, leftAt?.y)).toBuffer();
  const b = await sharp(rightFile).extract(halfFrame(rightAt?.x ?? 980, rightAt?.y)).toBuffer();
  await sharp({ create: { width: 1280, height: 800, channels: 4, background: '#1d1b26' } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: 640, top: 0 },
    ])
    .png()
    .toFile(out);
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
const dogWalk = await shotWalking(desk, path.join(raw, 'dog-1280.png'));
await setPet(desk, 'cat');
const catWalk = await shotWalking(desk, path.join(raw, 'cat-1280.png'));
await joinHorizontal(path.join(raw, 'dog-1280.png'), path.join(raw, 'cat-1280.png'), path.join(SHOTS, 'walk-1280x800.png'), dogWalk.petAt, catWalk.petAt);
log('wrote walk-1280x800.png');

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
