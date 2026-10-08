#!/usr/bin/env node
/**
 * Feira e2e (Phase 9). Needs a PINNED game clock (Phase 10): either a server started with TB_TEST_CLOCK_CONTROL=1 (this script sets the hour
 * itself: about 08:50 for PHASE=day, 15:35 for PHASE=night) or one started with TB_TEST_CLOCK_OFFSET_MIN (`node scripts/e2e-feira.mjs --offset day|night`
 * prints the value). It fails fast with a message when the clock is outside the window. `pnpm e2e:all` runs both phases on its own pinned server.
 *
 *   PHASE=day    walk to Tia Lu, ask the price (chip), hear 3-for-5, pay exactly with a R$ 5 note, get 3 bananas in the bag; then a typed question,
 *                an over-payment with change, and an under-payment that buys nothing.
 *   PHASE=night  the stalls are folded and closed (note), the Hortifrúti corner at the banca still sells (D12).
 *
 *   node scripts/e2e-feira.mjs   (BASE_URL, CHROME_PATH, SHOTS_DIR, SHOT_PREFIX, VIEW=390x844, PHASE)
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { assert, sleep, waitFor } from './lib/meveum-play.mjs';
import { assertPageClock, requirePinnedClock } from './lib/clock-pin.mjs';
import { goArea } from './lib/areas.mjs';
import { finishArrival } from './lib/arrival.mjs';

const GAME_DAY_MS = 48 * 60 * 1000;
const CLOCK_OFFSET_MS = 17 * 2 * 60 * 1000;
if (process.argv[2] === '--offset') {
  const minute = process.argv[3] === 'night' ? 15 * 60 + 40 : 8 * 60 + 40;
  const target = (minute / 1440) * GAME_DAY_MS;
  const ms = (((target - ((Date.now() + CLOCK_OFFSET_MS) % GAME_DAY_MS)) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  console.log((ms / 60000).toFixed(4));
  process.exit(0);
}

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME = findChrome();
const SHOTS = process.env.SHOTS_DIR ?? '';
const PREFIX = process.env.SHOT_PREFIX ?? 'desktop';
const [VW, VH] = (process.env.VIEW ?? '1280x800').split('x').map(Number);
const PHASE = process.env.PHASE ?? 'day';
const PASSWORD = 'pao-de-queijo-2026';
const log = (...a) => console.log('  ·', ...a);
const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${PREFIX}_${name}.png`) });
  log('screenshot', `${PREFIX}_${name}`);
};
const minutes = (page) => page.evaluate(() => window.__tb.clock.minutes());
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const walkTo = (page, x, y) => page.evaluate(([x, y]) => window.__tb.walkTo(x, y, false), [x, y]);
const interact = async (page, t) => assert(await page.evaluate((t) => window.__tb.interact(t), t), `interact ${JSON.stringify(t)}`);
const bag = (page) => page.evaluate(() => window.__tb.game.profile.bag ?? {});
const coins = (page) => page.evaluate(() => window.__tb.game.profile.coins);
async function waitIdleAt(page, x, y) {
  await waitFor(page, ([x, y]) => { const t = window.__tb.selfTile(); return t && !t.moving && t.tile.x === x && t.tile.y === y; }, [x, y], 25_000, `at ${x},${y}`);
}
const line = async (page) => ((await page.textContent('#dialogue-box .line-bubble .pt')) ?? '').trim();
const waitLine = (page, re, what) => waitFor(page, (src) => new RegExp(src).test(document.querySelector('#dialogue-box .line-bubble .pt')?.textContent ?? ''), re.source, 8000, what);

async function main() {
  assert(CHROME, 'set CHROME_PATH');
  const WINDOW = PHASE === 'day'
    ? { min: 8 * 60, max: 9 * 60 + 30, target: 8 * 60 + 50, label: 'feira open, about 08:50' }
    : { min: 15 * 60, max: 16 * 60 + 20, target: 15 * 60 + 35, label: 'feira closed, about 15:35' };
  await requirePinnedClock(BASE, WINDOW);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${BASE.includes('?') ? '&' : '?'}notype=1`);
  await page.waitForSelector('#intro-enter', { timeout: 12_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `feira+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', PASSWORD);
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 12_000 });
  await page.fill('#avatar-name', 'Freguesa');
  await page.click('button:has-text("ela (she)")');
  await page.click('#enter-praca');
  await finishArrival(page);
  await sleep(800);
  await assertPageClock(page, WINDOW);
  log('start, game time', hhmm(await minutes(page)));

  if (PHASE === 'day') {
    await waitFor(page, () => window.__tb.clock.minutes() >= 540 && window.__tb.clock.minutes() < 600, null, 120_000, '09:00');
    // the feira is its own area now: walk off the praça's east edge, then to Tia Lu's customer spot (7,6), she stands in front of her stall at (7,5)
    await goArea(page, 'feira');
    log('walked off the praça edge into the feira');
    await walkTo(page, 7, 6);
    await waitIdleAt(page, 7, 6);
    await sleep(1500);
    log('at the stall, game time', hhmm(await minutes(page)));
    const npcs = await page.evaluate(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.npc).map((a) => a.pub.npc));
    for (const id of ['tia_lu', 'ze', 'chico', 'rosa']) assert(npcs.includes(id), `${id} is at the feira`);
    await shot(page, 'feira_open_0900');

    // Quanto custa a banana? (chip 0), hear 3-for-5, three bananas, pay R$ 5
    await interact(page, { npc: 'tia_lu' });
    // a vendor may open with a recado offer ("Agora não") or a hand-over ("Só conversar") before the price box (Phase 8a)
    for (let i = 0; i < 6; i++) {
      await page.waitForSelector('#dialogue-box', { timeout: 8000 });
      const key = await page.getAttribute('#dialogue-box', 'data-dialogue');
      if (key === 'feira') break;
      if (key?.startsWith('idle-')) await page.click('#dialogue-box [data-chip="0"]'); // Continuar — the learned line
      else if (key?.startsWith('offer-') || key?.startsWith('give-')) await page.click('#dialogue-box [data-chip="1"]');
      await sleep(350);
    }
    await page.waitForSelector('#dialogue-box[data-dialogue="feira"]', { timeout: 8000 });
    await page.click('#dialogue-box [data-chip="0"]');
    await waitLine(page, /dois reais/, 'the price in words');
    assert(/Três por cinco reais/.test(await line(page)), 'Tia Lu says three for five');
    await shot(page, 'price_dialogue');
    await page.click('#dialogue-box [data-chip="1"]'); // three bananas
    await page.waitForSelector('#feira-tray', { timeout: 6000 });
    assert(/cinco reais/.test(await line(page)), 'the total is said in words');
    await shot(page, 'payment_tray');
    const c0 = await coins(page);
    await page.click('#feira-pieces [data-cents="500"]');
    assert((await page.textContent('#feira-paid')).includes('R$ 5'), 'the tray shows R$ 5');
    await page.click('#feira-pay');
    await waitFor(page, () => (window.__tb.game.profile.bag?.banana ?? 0) === 3, null, 6000, '3 bananas in the bag');
    assert((await coins(page)) > c0, 'a little RV is paid');
    assert(/Valor certinho/.test(await line(page)), 'exact payment');
    log('bought 3 bananas, bag', JSON.stringify(await bag(page)), 'RV', (await coins(page)) - c0);

    // typed question, over-payment with change
    await page.click('#dialogue-box [data-chip="0"]'); // one more thing
    await page.fill('#feira-input', 'quanto custa a laranja?');
    await page.press('#feira-input', 'Enter');
    await waitLine(page, /Laranja|laranja/, 'orange price');
    await page.click('#dialogue-box [data-chip="0"]'); // one orange, R$ 1
    await page.waitForSelector('#feira-tray');
    await page.click('#feira-pieces [data-cents="200"]');
    await page.click('#feira-pay');
    await waitFor(page, () => (window.__tb.game.profile.bag?.laranja ?? 0) === 1, null, 6000, 'orange bought with change');
    assert(/troco: um real/.test(await line(page)), `change is said (${await line(page)})`);
    await shot(page, 'change_line');
    log('over-payment: ', await line(page));

    // under-payment buys nothing
    await page.click('#dialogue-box [data-chip="0"]');
    await page.click('#dialogue-box [data-chip="2"]'); // maçã
    await waitLine(page, /maçã/i, 'apple price');
    await page.click('#dialogue-box [data-chip="1"]'); // two apples R$ 3
    await page.waitForSelector('#feira-tray');
    await page.click('#feira-pieces [data-cents="200"]');
    await page.click('#feira-pay');
    await waitLine(page, /Faltam um real/, 'what is missing');
    assert(((await bag(page)).maca ?? 0) === 0, 'nothing bought when short');
    log('under-payment:', await line(page));
    await page.keyboard.press('Escape');
  } else {
    await waitFor(page, () => window.__tb.clock.minutes() >= 940 && window.__tb.clock.minutes() < 1000, null, 120_000, '15:40');
    await goArea(page, 'feira');
    await walkTo(page, 7, 6);
    await waitIdleAt(page, 7, 6);
    await sleep(1500);
    const npcs = await page.evaluate(() => [...window.__tb.game.avatars.values()].filter((a) => a.pub.npc).map((a) => a.pub.npc));
    for (const id of ['ze', 'chico', 'rosa']) assert(!npcs.includes(id), `${id} is gone after 13:00`);
    log('closed feira at', hhmm(await minutes(page)));
    await shot(page, 'feira_closed_1600');
    await interact(page, { prop: 'feira_tia_lu' });
    await page.waitForSelector('#dialogue-box[data-dialogue="feira-fechada"]', { timeout: 8000 });
    assert(/6h/.test(await line(page)), `the closed stall says when the feira is back (${await line(page)})`);
    await shot(page, 'closed_note');
    await page.keyboard.press('Escape');
    await sleep(300);
    // D12: the Hortifrúti corner at the banca (on the rua, back through the praça) still sells
    await goArea(page, 'rua');
    await interact(page, { prop: 'hortifruti' });
    await waitIdleAt(page, 8, 7);
    await page.waitForSelector('#dialogue-box[data-dialogue="feira"]', { timeout: 8000 });
    await shot(page, 'hortifruti');
    await page.click('#dialogue-box [data-chip="0"]');
    await waitLine(page, /dois reais/, 'banana price at the banca');
    await page.click('#dialogue-box [data-chip="0"]');
    await page.waitForSelector('#feira-tray');
    await page.click('#feira-pieces [data-cents="200"]');
    await page.click('#feira-pay');
    await waitFor(page, () => (window.__tb.game.profile.bag?.banana ?? 0) === 1, null, 6000, 'banana from the banca');
    log('Hortifrúti sold a banana at', hhmm(await minutes(page)));
  }
  const gaps = await page.evaluate(() => window.__tb.artMissing);
  assert(!gaps?.length, `no missing art (${JSON.stringify(gaps)})`);
  assert(!errors.length, `no page errors: ${errors.join(' | ')}`);
  await browser.close();
  console.log(`\n✓ feira e2e (${PHASE}) passed`);
}

main().catch((e) => {
  console.error('\n✗ feira e2e FAILED:', e);
  process.exit(1);
});
