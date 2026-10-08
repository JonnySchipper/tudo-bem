#!/usr/bin/env node
/**
 * Night-time e2e (Phase 8b, D12; moved to the Phase 7 dialogue box in Phase 10). Needs a PINNED game clock: a server with TB_TEST_CLOCK_CONTROL=1 (this
 * script sets the hour) or one started with TB_TEST_CLOCK_OFFSET_MIN (`node scripts/lib/clock-pin.mjs 20:52`). It fails fast when the clock is off.
 *
 *   PHASE=a  clock pinned at about 20:40: the hat stall is closed at 21:00, the hat shop still opens from it (note "Nanda volta às 8h").
 *            20:40 leaves room for signup and the arrival word cards and still reaches the world before 21:00.
 *   PHASE=b  clock pinned at about 22:15: Seu Carlos sits on a praça bench at 22:30, Dona Graça covers the padaria at 23:00, the breakfast
 *            scene + Me vê um work with her (the dialogue box), Professora Bia is at the academia.
 *
 *   node scripts/e2e-night.mjs   (BASE_URL, CHROME_PATH, SHOTS_DIR, PHASE)
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { assert, playShift, sleep, startShiftFromPedido, waitFor } from './lib/correria-play.mjs';
import { assertPageClock, requirePinnedClock } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME = findChrome();
const SHOTS = process.env.SHOTS_DIR ?? '';
const PHASE = process.env.PHASE ?? 'b';
const PASSWORD = 'pao-de-queijo-2026';
const log = (...a) => console.log('  ·', ...a);
const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('screenshot', name);
};
const minutes = (page) => page.evaluate(() => window.__tb.clock.minutes());
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const npcsHere = (page) => page.evaluate(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.npc).map((a) => ({ id: a.pub.npc, activity: a.pub.activity, x: a.pub.x, y: a.pub.y })));
const walkTo = (page, x, y) => page.evaluate(([x, y]) => window.__tb.walkTo(x, y, false), [x, y]);
const interact = async (page, t) => assert(await page.evaluate((t) => window.__tb.interact(t), t), `interact ${JSON.stringify(t)}`);
const join = async (page, portal, room) => {
  await interact(page, { portal });
  await waitFor(page, (r) => window.__tb.game.room?.room === r, room, 12_000, `room ${room}`);
  await sleep(600);
};
async function waitIdleAt(page, x, y) {
  await waitFor(page, ([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], 20_000, `at ${x},${y}`);
}

async function main() {
  assert(CHROME, 'set CHROME_PATH');
  const WINDOW = PHASE === 'a'
    ? { min: 20 * 60, max: 20 * 60 + 58, target: 20 * 60 + 40, label: 'just before 21:00' }
    : { min: 21 * 60 + 40, max: 22 * 60 + 28, target: 22 * 60 + 15, label: 'just before 22:30' };
  await requirePinnedClock(BASE, WINDOW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 12_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `noite+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PASSWORD);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 12_000 });
  await page.fill('#avatar-name', 'Coruja');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(800);
  await assertPageClock(page, WINDOW);
  log('start, game time', hhmm(await minutes(page)));

  if (PHASE === 'a') {
    await waitFor(page, () => window.__tb.clock.minutes() >= 1260, null, 120_000, '21:00');
    await walkTo(page, 19, 3); // in front of Nanda's stall (the praça)
    await waitIdleAt(page, 19, 3);
    await sleep(1200);
    const m = await minutes(page);
    log('at the stall, game time', hhmm(m));
    const npcs = await npcsHere(page);
    assert(!npcs.some((n) => n.id === 'nanda'), 'Nanda is not in the world at night');
    assert(npcs.some((n) => n.id === 'julia'), 'Júlia is in the praça');
    await shot(page, 'closed_stall_2100');
    await interact(page, { prop: 'barraca' });
    await page.waitForSelector('[data-modal="shop"], .nanda-says', { timeout: 8000 });
    const note = (await page.textContent('.nanda-says')) ?? '';
    assert(/Nanda volta às 8h/.test(note), `the closed stall opens the hat shop with the note (${note})`);
    assert((await page.$$('[data-hat]')).length >= 1, 'hats are listed');
    await shot(page, 'closed_stall_shop');
    log('hat shop opens from the closed stall:', note.trim());
  } else {
    // Seu Carlos on a bench at 22:30
    await waitFor(page, () => window.__tb.clock.minutes() >= 1350 && window.__tb.clock.minutes() < 1400, null, 150_000, '22:30');
    await walkTo(page, 24, 21); // in front of banco_2
    await waitIdleAt(page, 24, 21);
    await sleep(1000);
    const npcs = await npcsHere(page);
    const carlos = npcs.find((n) => n.id === 'carlos');
    log('22:30+ praça NPCs:', JSON.stringify(npcs), 'time', hhmm(await minutes(page)));
    assert(carlos && carlos.activity === 'sentado' && carlos.x === 24 && carlos.y === 20, 'Seu Carlos sits on the praça bench');
    await shot(page, 'carlos_bench_2230');

    // the padaria at 23:00 with Dona Graça
    // the padaria is on the rua: walk off the praça's north edge, then to the door's sidewalk
    await goArea(page, 'rua');
    await walkTo(page, 4, 6);
    await waitIdleAt(page, 4, 6);
    await waitFor(page, () => window.__tb.clock.minutes() >= 1380 && window.__tb.clock.minutes() < 1420, null, 150_000, '23:00');
    await join(page, 'praca_padaria', 'padaria');
    await waitFor(page, () => [...window.__tb.game.avatars.values()].some((a) => a.pub.npc === 'graca'), null, 8000, 'Graça at the counter');
    const padaria = await npcsHere(page);
    assert(padaria.length === 1 && padaria[0].id === 'graca' && padaria[0].activity === 'trabalhando', `only Dona Graça works the padaria (${JSON.stringify(padaria)})`);
    log('padaria at', hhmm(await minutes(page)), JSON.stringify(padaria));
    await shot(page, 'padaria_2300_graca');

    // the counter with her: order a coxinha (pay, carry it, it goes in the bag)
    await interact(page, { npc: 'graca' });
    // an NPC may open with a recado offer ("Agora não") or a hand-over ("Só conversar") before the counter box (Phase 8a)
    for (let i = 0; i < 8; i++) {
      await page.waitForSelector('#dialogue-box', { timeout: 25_000 });
      const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
      if (key === 'counter-graca') break;
      if (key?.startsWith('offer-') || key?.startsWith('give-')) await page.click('#dialogue-box [data-chip="1"]');
      await sleep(350);
    }
    await page.waitForSelector('#dialogue-box[data-dialogue="counter-graca"]', { timeout: 12_000 });
    const name = ((await page.textContent('#dialogue-box[data-dialogue="counter-graca"] .npc-name')) ?? '').trim();
    assert(name === 'Dona Graça', `the counter is Dona Graça's at night (${name})`);
    await page.click('#dialogue-box[data-dialogue="counter-graca"] [data-chip="0"]');
    await waitFor(page, () => window.__tb.game.self?.pub.carry === 'coxinha', null, 8000, 'carrying the coxinha');
    const afterScene = await page.evaluate(() => window.__tb.game.profile);
    assert(afterScene.tutorial.carlos, 'ordering at the counter completed the padaria step with Dona Graça');
    assert((afterScene.bond?.graca ?? 0) >= 2, `the talk bond went to Dona Graça (${JSON.stringify(afterScene.bond)})`);
    log('ordered from Graça, bond', JSON.stringify(afterScene.bond), 'bag', JSON.stringify(afterScene.bag));

    // Correria no Balcão with her at the counter (the baker on duty)
    await startShiftFromPedido(page);
    await playShift(page, { log, dwell: () => Promise.resolve() });
    const afterMg = await page.evaluate(() => window.__tb.game.profile);
    assert(afterMg.coins > afterScene.coins, `Correria no Balcão paid out at night (${afterScene.coins} → ${afterMg.coins})`);
    assert(afterMg.tutorial.meveum, 'the Correria no Balcão tutorial step completed');
    log('Correria no Balcão at night ok, RV', afterMg.coins - afterScene.coins);

    // the academia: Professora Bia
    await page.keyboard.press('Escape');
    await sleep(500);
    await join(page, 'padaria_praca', 'rua');
    await goArea(page, 'rua_leste'); // the academia door is on the east half of the street
    await walkTo(page, 5, 6);
    await waitIdleAt(page, 5, 6);
    await join(page, 'praca_academia', 'academia');
    await waitFor(page, () => [...window.__tb.game.avatars.values()].some((a) => a.pub.npc === 'prof'), null, 8000, 'Professora Bia');
    await sleep(800);
    await walkTo(page, 8, 6);
    await waitIdleAt(page, 8, 6);
    await shot(page, 'academia_prof_bia');
    const miss = await page.evaluate(() => window.__tb.artMissing);
    log('artMissing:', miss.join(',') || 'none');
  }
  assert(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  await browser.close();
  console.log(`\n  ✓ night e2e (phase ${PHASE}) passed`);
}

main().catch((e) => {
  console.error('\n  ✗', e.message);
  process.exit(1);
});
