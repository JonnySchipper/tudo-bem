#!/usr/bin/env node
/**
 * Me vê um… across server restarts, in a real browser. Starts (and restarts) its own server.
 *
 *   pnpm build && pnpm e2e:meveum        # CHROME_PATH / SHOTS_DIR / E2E_MG_PORT optional
 *
 * A deploy restarts the server and drops every in-memory shift. The client reconnects in about a
 * second, before “Reconectando…” reads, and rejoins the Padaria with the panel still open. That
 * must end on a visible “perdi a comanda” card, not a locked tray on an empty bar.
 *
 * Plays shift 1, taps Jogar de novo, then restarts the server twice during Pedido 1: once as the
 * bar empties and once mid-build. Both times the lost-shift card must appear (no RV, no footer).
 * The next shift's first timeout must still re-arm “de novo, devagar”.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, buildTrayItem, expectFirstTimeoutRearms, learnShelf, mgBar, mgState, playShift, sleep, trayFor, waitFor, waitForTicket } from './lib/meveum-play.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/server/dist/index.js');
const PORT = Number(process.env.E2E_MG_PORT ?? 8797);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
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
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR, LIVEOPS_CPU_AMBIANCE: 'off' },
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
  await page.waitForSelector('#intro-skip', { timeout: 12_000 });
  await page.click('#intro-skip');
  await page.waitForSelector('#intro-guest', { timeout: 12_000 });
  await page.click('#intro-guest');
  await page.waitForSelector('#avatar-name', { timeout: 12_000 });
  await page.fill('#avatar-name', name);
  await page.click('button:has-text("ele (he)")');
  await page.check('#confirm-18');
  await page.click('#enter-praca');
  await waitFor(page, () => window.__tb.game.room?.room === 'praca', null, 10_000, 'praça');
}

async function openShift(page) {
  await page.evaluate(() => window.__tb.net.send({ t: 'mg', action: 'start' }));
  await page.waitForSelector('#mg-order', { timeout: 8000 });
}

const coins = (page) => page.evaluate(() => window.__tb.game.profile.coins);

/** Restart during Pedido 1 and expect the lost-shift card instead of a frozen tray. */
async function expectLostAfterRestart(page, label) {
  const before = await coins(page);
  const back = await restartServer();
  log(`${label}: server restarted`);
  const seen = await page
    .waitForSelector('#mg-end[data-lost="1"]', { timeout: LOST_CARD_MS })
    .then(() => Date.now())
    .catch(() => 0);
  if (!seen) {
    // Hold the frame Product saw, then report what the tray was doing.
    await sleep(Math.max(0, 30_000 - (Date.now() - back)));
    await shot(page, `meveum_${label}_stall_30s`);
    const stuck = await page.evaluate(() => ({
      panel: !!document.querySelector('[data-modal="minigame"]'),
      footer: !!document.querySelector('#mg-tray-place')?.offsetParent,
    }));
    throw new Error(
      `${label}: no lost-shift card ${LOST_CARD_MS / 1000}s after the server came back (30s later: ${await mgState(page)} · bar ${await mgBar(page)} · panel ${stuck.panel} · footer ${stuck.footer})`,
    );
  }
  log(`${label}: lost-shift card ${((seen - back) / 1000).toFixed(1)}s after the server came back`);
  await sleep(250);
  await shot(page, `meveum_${label}_lost`);
  const card = (await page.textContent('#mg-end')) ?? '';
  assert(/perdi a comanda/i.test(card), `${label}: Carlos says he lost the ticket (${card})`);
  assert(!/RV|\/6|pontos/i.test(card), `${label}: lost card has no RV / score line (${card})`);
  assert(!(await page.$('#mg-end .big')), `${label}: no “+N RV” headline`);
  assert(!(await page.isVisible('#mg-tray-place')) && !(await page.isVisible('#mg-submit')) && !(await page.isVisible('#mg-clear')), `${label}: footer hidden on Fim do turno`);
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

    // Shift 1, played straight through.
    await openShift(page);
    await learnShelf(page);
    await playShift(page, { log });
    const paid = await page.textContent('#mg-end .big');
    assert(/\+\d+ RV/.test(paid ?? ''), `shift 1 pays (${paid})`);
    assert(!(await page.isVisible('#mg-tray-place')), 'Fim do turno hides the tray footer');
    log('shift 1 done:', paid);

    // Jogar de novo, then a deploy lands as Pedido 1's bar runs out.
    await page.click('#mg-end button:has-text("Jogar de novo")');
    await waitForTicket(page, 0);
    await waitFor(
      page,
      () => {
        const m = /scaleX\(([\d.e-]+)\)/.exec(document.querySelector('#minigame .timer > div')?.style.transform ?? '');
        return !!m && Number(m[1]) < 0.1;
      },
      null,
      135_000,
      'Pedido 1 bar nearly empty',
    );
    await expectLostAfterRestart(page, 'restart_bar_empty');

    // Jogar de novo from the lost card, then a deploy lands mid-build.
    await page.click('#mg-end button:has-text("Jogar de novo")');
    await waitForTicket(page, 0);
    const text = await page.textContent('#mg-order');
    const { tray, mods } = await trayFor(page, text);
    const [first] = Object.keys(tray);
    await buildTrayItem(page, first, mods.some((m) => m.startsWith('pra ')), []);
    await page.click(`#mg-shelves [data-item="${first}"]`);
    await waitFor(page, () => !!document.querySelector('#mg-wip img') && !!document.querySelector('#mg-tray button'), null, 3000, 'mid-build tray');
    log(`mid-build on “${text}”`);
    await expectLostAfterRestart(page, 'restart_mid_build');

    // The next shift still re-arms its first timeout.
    await page.click('#mg-end button:has-text("Jogar de novo")');
    await expectFirstTimeoutRearms(page, log);
    await shot(page, 'meveum_next_shift_denovo');

    assert(!errors.length, `no page errors: ${errors.join(' | ')}`);
  } finally {
    await browser.close();
    await stopServer();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
  console.log('\n  ✓ Me vê um… survives server restarts\n');
}

main().catch(async (e) => {
  console.error('\n  ✗ e2e:meveum failed:', e.message, '\n');
  await stopServer().catch(() => {});
  process.exit(1);
});
