#!/usr/bin/env node
/**
 * Correria no Balcão across server restarts, in a real browser (the file keeps its old name: `pnpm e2e:meveum`). Starts (and restarts) its own
 * server, always with a pinned game clock (TB_TEST_CLOCK_OFFSET_MIN so it reads about 08:30 at every start; no outside server is needed) and with
 * TB_TEST_MG=1 so a bot can read each customer's order lines from the snapshot instead of parsing the Portuguese.
 *
 *   pnpm build && pnpm e2e:meveum        # CHROME_PATH / SHOTS_DIR / E2E_MG_PORT optional
 *
 * A deploy restarts the server and drops every in-memory shift. The client reconnects in about a second, before “Reconectando…” reads, and
 * rejoins the Padaria with the counter overlay still open. That must end on a visible “perdi a comanda” card, not a frozen counter.
 *
 * Plays a few customers of shift 1 through the real taps (grab, grill, pour, serve), checks the state the server sends, restarts the server
 * once in the lull between customers and once mid-build (an item on the tray). Both times the lost-shift card must appear (no RV, no stats).
 * The next shift must start clean afterwards. (A full shift is played in `e2e`; the server keeps shifts in memory on purpose.)
 */
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAY_MIN, offsetMinFor } from './lib/clock-pin.mjs';
import { assert, answerAsk, buildOrder, serve, sleep, snap, startShift, waitFor, waitFront, wantOf } from './lib/correria-play.mjs';
import { finishArrival } from './lib/arrival.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/server/dist/index.js');
const PORT = Number(process.env.E2E_MG_PORT ?? 8797);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = findChrome();
const SHOTS = process.env.SHOTS_DIR ?? '';
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-e2e-meveum-'));
/** How long after the server is back the lost card may take (reconnect backoff + rejoin + resync). */
const LOST_CARD_MS = 8_000;

const log = (...a) => console.log('  ·', ...a);

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  log('screenshot', name);
}

// ---------------------------------------------------------------- server process

let server = null;
let serverLog = '';

async function healthy(timeout = 15_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {
      /* not listening yet */
    }
    await sleep(50);
  }
  throw new Error(`server did not come up on :${PORT}\n${serverLog.slice(-2000)}`);
}

async function startServer() {
  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    // pinned game clock (Phase 10): every (re)start reads about 08:30, so the padaria's baker never depends on the hour of the real day
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, LIVEOPS_CPU_AMBIANCE: 'off', TB_TEST_MG: '1', TB_TEST_CLOCK_OFFSET_MIN: String(offsetMinFor(DAY_MIN)) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => (serverLog += d));
  child.stderr.on('data', (d) => (serverLog += d));
  server = child;
  await healthy();
}

async function stopServer() {
  const child = server;
  server = null;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((r) => child.once('exit', r));
  child.kill('SIGTERM');
  await exited;
}

/** SIGTERM + boot, the way a Fly deploy replaces the machine. Returns when /healthz answers again. */
async function restartServer() {
  await stopServer();
  await startServer();
  return Date.now();
}

// ---------------------------------------------------------------- browser helpers

async function signUp(page, name) {
  await page.goto(BASE);
  await page.waitForSelector('#intro-enter', { timeout: 12_000 });
  await page.click('#intro-enter');
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { state: 'visible', timeout: 12_000 });
  // Multiplayer is account-only; the session survives the restarts below (the SQLite file lives in DATA_DIR).
  await page.click('#intro-tab-register');
  await page.fill('#intro-email', `${name.toLowerCase()}+${Date.now().toString(36)}@exemplo.com`);
  await page.fill('#intro-password', 'pao-de-queijo-2026');
  await page.click('#intro-submit');
  await page.waitForSelector('#avatar-name', { timeout: 12_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ele (he)")');
  await page.click('#enter-praca');
  await finishArrival(page);
}

const coins = (page) => page.evaluate(() => window.__tb.game.profile.coins);

/** Serve one customer through the taps (and answer "Quanto é?" if they ask). */
async function serveOne(page) {
  const c = await waitFront(page);
  const want = await wantOf(page, c);
  await buildOrder(page, want);
  const cur = (await snap(page)).customers.find((x) => x.id === c.id);
  if (cur?.follow && !c.follow) await buildOrder(page, await wantOf(page, cur));
  await serve(page);
  await sleep(250);
  const still = (await snap(page)).customers.find((x) => x.id === c.id && x.state === 'front');
  if (still && still.mistakes > 0) {
    await buildOrder(page, await wantOf(page, still));
    await serve(page);
    await sleep(250);
  }
  await answerAsk(page);
  return c;
}

/** Restart and expect the lost-shift card instead of a frozen counter. */
async function expectLostAfterRestart(page, label) {
  const before = await coins(page);
  const back = await restartServer();
  log(`${label}: server restarted`);
  const seen = await page
    .waitForSelector('#mg-end[data-lost="1"]', { timeout: LOST_CARD_MS })
    .then(() => Date.now())
    .catch(() => 0);
  if (!seen) {
    // Hold the frame Product saw, then report what the counter was doing.
    await sleep(Math.max(0, 30_000 - (Date.now() - back)));
    await shot(page, `meveum_${label}_stall_30s`);
    const stuck = await page.evaluate(() => ({ overlay: !!document.querySelector('#correria'), serve: !!document.querySelector('#cr-serve')?.offsetParent, customers: window.__tb.correria.feed.snap?.customers.length ?? -1 }));
    throw new Error(`${label}: no lost-shift card ${LOST_CARD_MS / 1000}s after the server came back (30s later: overlay ${stuck.overlay} · serve ${stuck.serve} · customers ${stuck.customers})`);
  }
  log(`${label}: lost-shift card ${((seen - back) / 1000).toFixed(1)}s after the server came back`);
  await sleep(250);
  await shot(page, `meveum_${label}_lost`);
  const card = (await page.textContent('#mg-end')) ?? '';
  assert(/perdi a comanda/i.test(card), `${label}: Seu Carlos says he lost the order slip (${card})`);
  assert(!/RV|\/15|pontos/i.test(card), `${label}: lost card has no RV / score line (${card})`);
  assert(!(await page.$('#mg-end .big')), `${label}: no “+N RV” headline`);
  assert(!(await page.isVisible('#cr-serve')), `${label}: the counter strip is hidden on Fim do turno`);
  assert(await page.isVisible('#mg-end button:has-text("Sair")'), `${label}: Sair`);
  assert(await page.isVisible('#mg-end button:has-text("Jogar de novo")'), `${label}: Jogar de novo`);
  assert((await coins(page)) === before, `${label}: a lost shift pays nothing`);
}

// ---------------------------------------------------------------- run

async function main() {
  assert(CHROME, 'Chrome/Chromium not found — set CHROME_PATH');
  assert(fs.existsSync(SERVER), 'apps/server/dist/index.js missing — run pnpm build');
  console.log(`\nTudo Bem e2e:meveum → ${BASE}`);
  await startServer();
  const browser = await chromium.launch({ executablePath: CHROME, headless: !process.env.HEADED, args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await signUp(page, 'Rafa');
    await page.evaluate(() => window.__tb.net.send({ t: 'join', room: 'padaria' }));
    await waitFor(page, () => window.__tb.game.room?.room === 'padaria', null, 8000, 'padaria');

    // Shift 1: the counter opens, customers come, two are served through the taps.
    await startShift(page);
    // the first shift opens with the How to play card over the counter (it holds the game's clicks until it is closed): read it, "Got it"
    await page.waitForSelector('#howto-card[data-game="correria"]', { timeout: 8000 });
    await page.click('#howto-ok');
    await page.waitForSelector('#howto-card', { state: 'detached', timeout: 4000 });
    assert(await page.isVisible('#howto-help'), 'the “?” stays to read How to play again');
    assert(await page.isVisible('#cr-panel'), 'the counter strip is up');
    assert(!(await page.$('[data-modal="minigame"]')), 'no modal over the padaria');
    const first = await waitFront(page);
    log(`customer 1 (${first.who.name}): “${first.pt}”`);
    for (let i = 0; i < 2; i++) {
      const c = await serveOne(page);
      log(`served “${c.pt}”`);
    }
    await waitFor(page, () => window.__tb.correria.feed.snap?.stats.served >= 2, null, 8000, 'two served');
    await shot(page, 'meveum_shift1_served');
    const points = await page.textContent('#cr-points');
    assert(Number(points) > 0, `points on the HUD (${points})`);

    // A deploy lands in the lull after a serve.
    await expectLostAfterRestart(page, 'restart_between');

    // Jogar de novo from the lost card, then a deploy lands mid-build.
    await page.click('#mg-end button:has-text("Jogar de novo")');
    await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'a fresh shift');
    const c2 = await waitFront(page);
    const want = await wantOf(page, c2);
    const first2 = want.lines.find((l) => !['pao_na_chapa', 'misto_quente', 'cafe', 'cafe_com_leite'].includes(l.itemId)) ?? null;
    if (first2) await page.click(`#cr-item-${first2.itemId}`);
    else await page.click('#cr-item-pao');
    await waitFor(page, () => (window.__tb.correria.feed.snap?.tray.length ?? 0) > 0, null, 4000, 'an item on the tray');
    log(`mid-build on “${c2.pt}”`);
    await expectLostAfterRestart(page, 'restart_mid_build');

    // The next shift still starts clean: customers arrive, the first one orders.
    await page.click('#mg-end button:has-text("Jogar de novo")');
    await waitFor(page, () => !!window.__tb.correria.feed.snap, null, 8000, 'the next shift');
    const fresh = await waitFront(page);
    const s = await snap(page);
    assert(s.stats.served === 0 && s.stats.points === 0 && s.tray.length === 0, 'a clean next shift');
    log(`next shift: “${fresh.pt}”`);
    await shot(page, 'meveum_next_shift');

    assert(!errors.length, `no page errors: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
    await stopServer();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  console.log('\n  ✓ Correria no Balcão survives server restarts\n');
}

main().catch(async (e) => {
  console.error('\n  ✗ e2e:meveum failed:', e.message, '\n');
  await stopServer().catch(() => {});
  process.exit(1);
});
