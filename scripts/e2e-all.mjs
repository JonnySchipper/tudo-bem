#!/usr/bin/env node
/**
 * Every browser e2e in one go, against ONE server this script starts and stops itself (Phase 10).
 *
 *   pnpm build && pnpm e2e:all        # CHROME_PATH (auto-detected on Windows / macOS / Linux), SHOTS_DIR, E2E_ALL_PORT optional
 *
 * The server runs on a temp DATA_DIR with a PINNED game clock: TB_TEST_CLOCK_CONTROL=1 lets each script set the hour it needs right before it starts
 * (08:30 for e2e, 08:50 / 15:35 for the feira, 20:52 / 22:15 for the night scripts), plus TB_TEST_OFFER=carlos_cafe_pra_nanda (the whole recado is
 * part of `e2e`) and TB_TEST_ROLL=1 (Academia roll hints). Order: e2e, e2e-feira (day, night), e2e-night (a, b), then e2e:meveum (that one
 * restarts its own server twice by design (a deploy drops the shift), so it brings its own pinned server on another port), then e2e:solo (builds the static VITE_LOCAL_WORLD client into a temp dir and serves it itself).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome } from './lib/chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/server/dist/index.js');
const PORT = Number(process.env.E2E_ALL_PORT ?? 8791);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = findChrome();
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-e2e-all-'));

if (!CHROME) {
  console.error('Chrome/Chromium not found: set CHROME_PATH');
  process.exit(1);
}
if (!fs.existsSync(SERVER)) {
  console.error('apps/server/dist/index.js missing: run pnpm build first');
  process.exit(1);
}

let serverLog = '';
const server = spawn(process.execPath, [SERVER], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    DATA_DIR,
    TB_TEST_ROLL: '1',
    TB_TEST_CLOCK_CONTROL: '1',
    TB_TEST_OFFER: 'carlos_cafe_pra_nanda',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitHealthy() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not come up on :${PORT}\n${serverLog.slice(-2000)}`);
}

function run(name, script, env = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    console.log(`\n=== ${name} ===`);
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', script)], {
      cwd: ROOT,
      env: { ...process.env, BASE_URL: BASE, CHROME_PATH: CHROME, ...env },
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve({ name, ok: code === 0, secs: Math.round((Date.now() - t0) / 1000) }));
  });
}

async function runSolo() {
  const name = 'e2e:solo (static VITE_LOCAL_WORLD build)';
  const t0 = Date.now();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-e2e-solo-'));
  console.log(`
=== ${name} ===`);
  const viteBin = path.join(ROOT, 'apps/client/node_modules/vite/bin/vite.js');
  const build = await new Promise((resolve) => {
    const c = spawn(process.execPath, [viteBin, 'build', '--outDir', outDir, '--emptyOutDir'], {
      cwd: path.join(ROOT, 'apps/client'),
      env: { ...process.env, VITE_LOCAL_WORLD: '1' },
      stdio: 'inherit',
    });
    c.on('exit', (code) => resolve(code === 0));
  });
  let res = { name, ok: false, secs: 0 };
  if (build) {
    const soloPort = Number(process.env.E2E_SOLO_PORT ?? 4173);
    const web = spawn(process.execPath, [path.join(ROOT, 'scripts/serve-static.mjs'), outDir, String(soloPort), '/'], { cwd: ROOT, stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 1000));
    res = await run(name, 'e2e-solo.mjs', { BASE_URL: `http://localhost:${soloPort}/` });
    web.kill();
  } else console.error('solo build failed');
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  return { ...res, secs: Math.round((Date.now() - t0) / 1000) };
}

const results = [];
let code = 0;
try {
  await waitHealthy();
  console.log(`server up on ${BASE} (pinned clock via /__test/clock), DATA_DIR ${DATA_DIR}`);
  results.push(await run('e2e (Phase 0 play path + recado)', 'e2e.mjs'));
  results.push(await run('e2e-feira day', 'e2e-feira.mjs', { PHASE: 'day' }));
  results.push(await run('e2e-feira night', 'e2e-feira.mjs', { PHASE: 'night' }));
  results.push(await run('e2e-night a', 'e2e-night.mjs', { PHASE: 'a' }));
  results.push(await run('e2e-night b', 'e2e-night.mjs', { PHASE: 'b' }));
} finally {
  server.kill();
}
// the Me vê um script owns (and restarts) its server
results.push(await run('e2e:meveum', 'e2e-meveum.mjs', { BASE_URL: undefined }));
// the solo build (VITE_LOCAL_WORLD=1: the world runs in the page, no server) is built into a temp dir and served statically
results.push(await runSolo());

console.log('\n--- e2e:all summary ---');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.secs}s)`);
  if (!r.ok) code = 1;
}
try {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
} catch {
  /* best effort */
}
process.exit(code);
