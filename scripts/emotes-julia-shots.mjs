#!/usr/bin/env node
/**
 * Before/after shots for the Oi / Valeu / Dançar limbs and Júlia's repeat intro.
 *
 *   pnpm --filter @tudobem/client dev
 *   BASE_URL=http://localhost:5173 TAG=before node scripts/emotes-julia-shots.mjs
 *
 * Writes docs/lifesim/shots/emotes-julia/<TAG>_emotes.png, <TAG>_julia_first.png, <TAG>_julia_return.png.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const TAG = process.env.TAG ?? 'after';
const OUT = process.env.SHOTS_DIR ?? path.join(ROOT, 'docs', 'lifesim', 'shots', 'emotes-julia');
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('pageerror', String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('console.error', m.text());
});

const line = () => page.locator('#dialogue-box .line-bubble .pt').innerText();

async function dismissPrelude() {
  for (let i = 0; i < 6; i++) {
    const key = await page.evaluate(() => document.getElementById('dialogue-box')?.dataset.dialogue ?? '');
    console.log('dialogue', key || '(none)', await page.locator('#dialogue-box .line-bubble .pt').innerText().catch(() => ''));
    if (key === 'talk-julia') return;
    if (key.startsWith('offer-') || key.startsWith('give-')) {
      await page.click('#dialogue-box [data-chip="1"]');
      await sleep(400);
      continue;
    }
    await sleep(250);
  }
}

try {
  await page.goto(`${BASE}/?solo&notype=1&cpu=off`);
  await page.waitForSelector('#intro-enter', { timeout: 20_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 15_000 });
  await page.fill('#avatar-name', 'Ana');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await page.evaluate(() => window.__tb.setClock({ time: '12:00', weather: 'sol' }));
  await sleep(800);

  // three standing neighbours, one emote each, zoomed so a painted-on arm would read
  await page.evaluate(() => {
    const g = window.__tb.game;
    const self = g.avatars.get(g.room.selfId);
    const look = self.pub.appearance;
    const hat = self.pub.hat;
    const kinds = ['oi', 'valeu', 'dancar'];
    for (let i = 0; i < kinds.length; i++) {
      const id = `cpu-emote-${i}`;
      g.avatars.set(id, {
        pub: { id, name: kinds[i], pronoun: 'ela', appearance: look, hat, parrot: false, nameplate: 'verde', x: 20 + i * 2, y: 34, dir: 'SW', sitting: false, cpu: true },
        from: { x: 20 + i * 2, y: 34 },
        path: [],
        start: performance.now(),
        sitOnArrive: false,
        emote: null,
        bubbles: [],
        seed: 3 + i,
      });
    }
  });
  await page.addStyleTag({ content: '#ui{visibility:hidden !important} .wl-stack,.wl-guide{display:none !important}' });
  await page.evaluate(() => window.__tb.renderer.setShot('cam:22,33.2,8'));
  await sleep(600);
  await page.evaluate(() => {
    const t0 = performance.now() / 1000 - 0.35;
    ['oi', 'valeu', 'dancar'].forEach((kind, i) => {
      const a = window.__tb.game.avatars.get('cpu-emote-' + i);
      if (a) a.emote = { kind, t0 };
    });
  });
  await sleep(120);
  const emoteFile = path.join(OUT, `${TAG}_emotes.png`);
  await page.screenshot({ path: emoteFile });
  const anims = await page.evaluate(() => {
    const all = window.__tb.facings();
    return Object.fromEntries(Object.entries(all).filter(([id]) => id.startsWith('cpu-emote-')));
  });
  console.log('emote anims', JSON.stringify(anims));
  console.log('  ·', path.relative(ROOT, emoteFile));

  await page.evaluate(() => window.__tb.renderer.setShot(null));
  await page.addStyleTag({ content: '#ui{visibility:visible !important}' });

  const where = async (label) => {
    const info = await page.evaluate(() => {
      const g = window.__tb.game;
      const ids = [...g.avatars.keys()];
      const j = g.avatars.get('npc-julia');
      return {
        room: g.room?.room,
        ids,
        julia: j ? { x: j.pub.x, y: j.pub.y, activity: j.pub.activity, interact: j.pub.npcInteract } : null,
        minute: window.__tb.clock.minutes(),
      };
    });
    console.log(label, JSON.stringify(info));
    return info;
  };
  let spot = await where('before interact');
  if (!spot.julia) {
    for (const room of ['praca', 'rua', 'rua_leste']) {
      await page.evaluate((room) => window.__tb.net.send({ t: 'join', room }), room);
      await waitFor(page, (room) => window.__tb.game.room?.room === room, room, 8_000, `join ${room}`);
      await sleep(500);
      spot = await where(`in ${room}`);
      if (spot.julia) break;
    }
  }
  assert(spot.julia, 'Júlia is in a room');
  await page.evaluate((tile) => window.__tb.walkTo(tile.x, tile.y), spot.julia.interact ?? { x: spot.julia.x, y: spot.julia.y + 1 });
  await sleep(500);
  await page.evaluate(() => window.__tb.interact({ npc: 'julia' }));
  await waitFor(page, () => !!document.getElementById('dialogue-box'), null, 15_000, 'dialogue');
  await dismissPrelude();
  await waitFor(page, () => document.getElementById('dialogue-box')?.dataset.dialogue === 'talk-julia', null, 8_000, 'julia greeting');
  await page.evaluate(() => document.getElementById('photo-close')?.click());
  await sleep(300);
  const first = await line();
  console.log('first line:', first);
  const firstFile = path.join(OUT, `${TAG}_julia_first.png`);
  await page.screenshot({ path: firstFile });
  console.log('  ·', path.relative(ROOT, firstFile));

  await page.keyboard.press('Escape');
  await sleep(400);
  await waitFor(
    page,
    () => (window.__tb.game.profile?.bond?.julia ?? 0) > 0,
    null,
    8_000,
    'julia bond after the first talk',
  );

  await page.evaluate(() => window.__tb.interact({ npc: 'julia' }));
  await waitFor(page, () => !!document.getElementById('dialogue-box'), null, 12_000, 'return dialogue');
  await dismissPrelude();
  await waitFor(page, () => document.getElementById('dialogue-box')?.dataset.dialogue === 'talk-julia', null, 8_000, 'julia return');
  await page.evaluate(() => document.getElementById('photo-close')?.click());
  await sleep(300);
  const again = await line();
  console.log('return line:', again);
  const returnFile = path.join(OUT, `${TAG}_julia_return.png`);
  await page.screenshot({ path: returnFile });
  console.log('  ·', path.relative(ROOT, returnFile));
} finally {
  await browser.close();
}
