#!/usr/bin/env node
/**
 * Visual-polish screenshots (solo build): the plane arrival and Júlia's hand-over, the camera (viewfinder, shutter, the print, a new word),
 * the diary book, the escola with Dona Lúcia, the cartela (a stamp, the 7th stamp paying out, the fresh card), regulars up close,
 * and the same intro on a phone. Also asserts that a click with the camera open really spends film and saves a photo.
 *
 *   VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build
 *   node scripts/serve-static.mjs apps/client/dist 4173 / &
 *   SHOTS_DIR=docs/lifesim/shots/visual-polish node scripts/polish-shots.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { findChrome } from './lib/chrome.mjs';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { goArea } from './lib/areas.mjs';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS_DIR ?? 'docs/lifesim/shots/visual-polish';
const CHROME = findChrome();
assert(CHROME, 'Chrome/Chromium not found: set CHROME_PATH');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });

async function newPlayer(viewport, name) {
  const page = await (await browser.newContext({ viewport, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  // the in-page world reads about 08:30: the feira is open and Seu Carlos is at the counter
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1&tbclockmin=${offsetMinFor(DAY_MIN)}`);
  await page.click('#intro-enter', { timeout: 15_000 });
  await page.click('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-guest', { timeout: 12_000 });
  await page.fill('#avatar-name', name, { timeout: 15_000 });
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await page.waitForFunction(() => window.__tb?.game?.room?.room === 'aeroporto', null, { timeout: 20_000 });
  await page.evaluate(() => window.__tb.setClock({ weather: 'sol' }));
  return page;
}

const shooter = (page) => async (name, clip) => {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...(clip ? { clip } : {}) });
  console.log('shot', name);
};

/** Client rect of a prop by id (pixel view). */
const propRect = (page, id) =>
  page.evaluate((id) => {
    const room = window.__tb.game.roomDef ?? window.__tb.rooms[window.__tb.game.room.room];
    const p = room.props.find((q) => q.id === id);
    return window.__tb.renderer.propClientRect?.(p) ?? null;
  }, id);

try {
  // ---------------------------------------------------------------- arrival
  const page = await newPlayer({ width: 1280, height: 800 }, 'Lia');
  const shot = shooter(page);
  // a new arrival lands at the airport: the gate, then Célia hands over Júlia's package (the camera and the cartela)
  await sleep(1500);
  await shot('01-arrival-airport');
  await page.evaluate(() => window.__tb.interact({ npc: 'celia' }));
  await page.waitForSelector('#dialogue-box', { timeout: 20_000 });
  await sleep(1200);
  await shot('02-arrival-handover');
  await page.click('#dialogue-box .dbx-chips button');
  await sleep(520);
  await shot('03-arrival-gifts-fly');
  await waitFor(page, () => window.__tb.game.profile.arrivalIntroDone === true && window.__tb.game.profile.hasCamera, null, 8000, 'camera in hand');
  // then straight to the praça for the rest of the shots
  await finishArrival(page);
  await sleep(900);

  // ---------------------------------------------------------------- camera
  await page.click('#btn-camera');
  const fonte = await propRect(page, 'fonte');
  assert(fonte, 'the fountain is on screen');
  const fx = Math.round(fonte.x + fonte.w / 2);
  const fy = Math.round(fonte.y + fonte.h / 2);
  await page.mouse.move(fx - 40, fy - 30);
  await page.mouse.move(fx, fy, { steps: 6 });
  await sleep(300);
  assert((await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [fx, fy])) === 'world', 'the viewfinder lets the click through to the world canvas');
  await shot('04-camera-viewfinder');
  const before = await page.evaluate(() => ({ film: window.__tb.game.profile.film, photos: window.__tb.game.photos?.length ?? 0 }));
  await page.mouse.click(fx, fy);
  await sleep(70);
  await shot('05-camera-shutter');
  await sleep(650);
  await shot('06-camera-new-word');
  const after = await page.evaluate(() => ({ film: window.__tb.game.profile.film, photos: window.__tb.game.photos?.length ?? 0 }));
  assert(after.film === before.film - 1 && after.photos === before.photos + 1, `a click takes a photo (film ${before.film}→${after.film}, photos ${before.photos}→${after.photos})`);
  // one photo per opening: the camera closed itself after the shot
  assert(!(await page.evaluate(() => window.__tb.game.cameraOn)), 'the camera closes after a photo');
  // the new-word card does not block reopening the camera and taking the next shot
  await sleep(300);
  await page.click('#btn-camera');
  const sky = { x: 200, y: 520 };
  await page.mouse.move(sky.x, sky.y, { steps: 4 });
  await page.mouse.click(sky.x, sky.y);
  await sleep(1100);
  await shot('07-camera-photo-saved');
  const after2 = await page.evaluate(() => window.__tb.game.photos?.length ?? 0);
  assert(after2 === after.photos + 1, 'a second shot while the new-word card is up still fires');
  await sleep(3200);

  // ---------------------------------------------------------------- diary
  await page.click('#btn-caderno');
  await sleep(380);
  await shot('08-diary-opening');
  await sleep(1300);
  await shot('09-diary-open');
  await page.keyboard.press('Escape');
  await sleep(300);

  // ---------------------------------------------------------------- regular up close (Júlia: ponytail and tote, the portrait matches)
  await page.evaluate(() => window.__tb.interact({ npc: 'julia' }));
  await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
  await sleep(2600);
  await shot('10-regular-julia');
  await page.keyboard.press('Escape');
  await sleep(500);

  // ---------------------------------------------------------------- cartela: a stamp, then the 7th
  // the Cartela chip is a regular's (three recados done, SIMPLIFICATION-REVIEW §3): the next profile push carries it
  await page.evaluate(() => {
    window.__tb.net.session.profile.recadosDoneTotal = 3;
  });
  await goArea(page, 'feira');
  await sleep(500);
  await shot('11-cartela-stamp');
  await page.click('#cartela-pill');
  await sleep(900);
  await shot('12-cartela-panel');
  await page.keyboard.press('Escape');
  await goArea(page, 'praca');
  await sleep(800);
  // six stamps on the card from earlier days: entering the feira again tomorrow pays out (the server path, not a staged banner)
  await page.evaluate(() => {
    const p = window.__tb.net.session.profile;
    p.cartela = { stamps: 6, activityDay: {} };
  });
  await goArea(page, 'feira');
  await sleep(250);
  await shot('13-cartela-payout-arrive');
  await sleep(700);
  await shot('14-cartela-payout-stamp');
  const held = await page.evaluate(() => document.querySelector('#cartela-pill .cartela-n')?.textContent);
  assert(held === '7/7', `the chip holds 7/7 while the banner plays (saw ${held})`);
  await sleep(4200);
  await shot('15-cartela-fresh-card');
  const fresh = await page.evaluate(() => document.querySelector('#cartela-pill .cartela-n')?.textContent);
  assert(fresh === '0/7', `the chip turns over to a fresh card after the banner (saw ${fresh})`);

  // ---------------------------------------------------------------- regulars at the feira (Zé, Chico, Rosa)
  for (const npc of ['ze', 'chico', 'rosa']) {
    const ok = await page.evaluate((npc) => window.__tb.interact({ npc }), npc);
    if (!ok) continue;
    await page.waitForSelector('#dialogue-box', { timeout: 25_000 }).catch(() => {});
    await sleep(2600);
    await shot(`16-regular-${npc}`);
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // ---------------------------------------------------------------- escola
  await goArea(page, 'rua');
  await page.evaluate(() => window.__tb.interact({ portal: 'rua_escola' }));
  await waitFor(page, () => window.__tb.game.room?.room === 'escola', null, 30_000, 'escola');
  await sleep(1200);
  await shot('17-escola-room');
  await page.evaluate(() => window.__tb.interact({ prop: 'carteira' }));
  await page.waitForSelector('#escola-start', { timeout: 20_000 });
  await sleep(700);
  await shot('18-escola-home');
  // the lesson's first card (a new word: pick the Portuguese); the full lesson flow is scripts/escola-shots.mjs
  await page.click('#escola-start');
  await page.waitForSelector('#escola-lesson', { timeout: 10_000 });
  await sleep(700);
  await shot('19-escola-lesson');
  await page.click('#escola-options button');
  await page.waitForSelector('#escola-verdict', { timeout: 8_000 });
  await sleep(600);
  await shot('20-escola-verdict');
  await page.keyboard.press('Escape');
  await page.context().close();

  // ---------------------------------------------------------------- Carlos in the padaria, at the 2x draw scale
  const p2 = await newPlayer({ width: 1280, height: 800 }, 'Bia');
  const shot2 = shooter(p2);
  await finishArrival(p2);
  await sleep(800);
  await goArea(p2, 'rua');
  await p2.evaluate(() => window.__tb.interact({ portal: 'praca_padaria' }));
  await waitFor(p2, () => window.__tb.game.room?.room === 'padaria', null, 30_000, 'padaria');
  await sleep(1500);
  await shot2('22-padaria-scale');
  await p2.evaluate(() => window.__tb.interact({ npc: 'carlos' }));
  await p2.waitForSelector('#dialogue-box', { timeout: 25_000 }).catch(() => {});
  await sleep(2600);
  await shot2('23-regular-carlos');
  await p2.context().close();

  // ---------------------------------------------------------------- phone: the airport and the diary
  const phone = await newPlayer({ width: 390, height: 844 }, 'Rafa');
  const shot3 = shooter(phone);
  await sleep(1500);
  await shot3('24-phone-airport');
  await finishArrival(phone);
  await sleep(1500);
  await phone.evaluate(() => window.__tb.net.send({ t: 'diary', action: 'photo', anchors: [], image: undefined }));
  await phone.click('#btn-burger');
  await sleep(300);
  await phone.click('#btn-caderno');
  await sleep(1800);
  await shot3('25-phone-diary');
  console.log('polish shots ->', SHOTS);
} catch (e) {
  console.error('polish shots failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
