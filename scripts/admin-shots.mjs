/**
 * Screenshots of the admin dashboard (/admin) for the PR and docs/ADMIN.md.
 * Starts the built server on a throwaway data dir, seeds a few players (chat, a report, feedback, a comp),
 * signs in to the dashboard and shoots every section. `pnpm build` first.
 *
 *   node scripts/admin-shots.mjs            # -> docs/screenshots/admin/*.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
import { findChrome } from './lib/chrome.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// the server's WebSocket client: it can send the session cookie, the browser-style global cannot
const WebSocket = createRequire(path.join(root, 'apps/server/package.json'))('ws');
const OUT = process.env.SHOTS_DIR ?? path.join(root, 'docs/screenshots/admin');
const PORT = Number(process.env.PORT ?? 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'painel-de-fotos-1';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-admin-shots-'));
fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'apps/server/dist/index.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dataDir, TB_ADMIN_PASSWORD: PASSWORD, TB_TEST_CLOCK_CONTROL: '1', LIVEOPS_CPU_AMBIANCE: 'off', NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return;
    } catch {
      /* not yet */
    }
    await sleep(100);
  }
  throw new Error('server did not start');
}

const post = (p, body, headers = {}) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const cookieOf = (res) => (res.headers.get('set-cookie') ?? '').split(';')[0];

async function player(name, look = {}) {
  const res = await post('/api/auth/register', { email: `${name.toLowerCase()}@exemplo.com`, password: 'pao-na-chapa-1', confirm18: true });
  const cookie = cookieOf(res);
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/ws`, { headers: { cookie } });
  const inbox = [];
  ws.on('message', (d) => inbox.push(JSON.parse(String(d))));
  await new Promise((r) => ws.once('open', r));
  const send = (m) => ws.send(JSON.stringify(m));
  const until = async (t) => {
    for (let i = 0; i < 200 && !inbox.some((m) => m.t === t); i++) await sleep(20);
    return inbox.filter((m) => m.t === t).at(-1);
  };
  send({ t: 'hello' });
  await until('needProfile');
  send({ t: 'createProfile', name, pronoun: 'nome', appearance: { skin: 2, hair: 1, hairColor: 2, top: 1, topColor: 3, bottom: 0, bottomColor: 1, shoes: 0, ...look } });
  const welcome = await until('welcome');
  send({ t: 'join', room: 'praca' });
  await until('roomState');
  return { cookie, ws, send, id: welcome.profile.id };
}

try {
  await waitUp();
  const ana = await player('Ana');
  const bruno = await player('Bruno');
  const carla = await player('Carla');
  await player('Diego');
  bruno.send({ t: 'chat', text: 'oi gente, tudo bem?' });
  bruno.send({ t: 'chat', text: 'meu email é bruno@exemplo.com' });
  await sleep(300);
  ana.send({ t: 'report', targetId: bruno.id, reason: 'spam' });
  await post('/api/feedback', { text: 'Amei a feira! Mas o carrinho de pastel some às vezes.', category: 'bug' }, { cookie: ana.cookie });
  await post('/api/feedback', { text: 'Queria mais chapéus na barraca da Nanda.', category: 'idea' }, { cookie: carla.cookie });
  await post('/api/feedback', { text: 'A Dona Lúcia é a melhor professora.', category: 'love' }, { cookie: bruno.cookie });

  // a few admin actions so the audit log and the subscriptions page have rows
  const login = await post('/api/admin/login', { password: PASSWORD, name: 'Jonny' });
  const admin = { cookie: cookieOf(login) };
  const act = (p, b) => post(`/api/admin/${p}`, b, admin);
  await act('player/coins', { id: ana.id, delta: 40, reason: 'Correria bug on 10/08' });
  await act('subscriptions/comp', { id: carla.id, grant: true, days: 30 });
  await act('player/mute', { id: bruno.id, minutes: 60 });
  await act('player/item', { id: ana.id, kind: 'hat', itemId: 'cartola', op: 'grant' });
  await act('config', { key: 'missionReward', value: 30 });
  await act('data/backup', {});
  const fb = await (await fetch(`${BASE}/api/admin/feedback?status=new`, { headers: admin })).json();
  await act('feedback/triage', { id: fb.items.at(-1).id, status: 'seen', note: 'Ask Nanda for two more hats.' });

  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const shoot = async (viewport, shots) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1 });
    await page.goto(`${BASE}/admin`);
    await page.fill('input[autocomplete=nickname]', 'Jonny');
    await page.fill('input[type=password]', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForSelector('nav a');
    for (const [hash, file] of shots) {
      await page.evaluate((h) => (location.hash = h), hash);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      console.log('shot', file);
    }
    await page.close();
  };
  await shoot({ width: 1366, height: 900 }, [
    ['#/overview', '1-overview.png'],
    ['#/players', '2-players.png'],
    [`#/player/${ana.id}`, '2b-player-detail.png'],
    ['#/subscriptions', '3-subscriptions.png'],
    ['#/moderation', '4-moderation.png'],
    ['#/feedback', '5-feedback.png'],
    ['#/world', '6-world.png'],
    ['#/config', '7-game-variables.png'],
    ['#/data', '8-data.png'],
    ['#/audit', '9-audit.png'],
  ]);
  await shoot({ width: 390, height: 844 }, [
    ['#/overview', 'phone-overview.png'],
    [`#/player/${ana.id}`, 'phone-player.png'],
  ]);
  // the sign-in screen
  const page = await browser.newPage({ viewport: { width: 1366, height: 700 } });
  await page.goto(`${BASE}/admin`);
  await page.waitForSelector('input[type=password]');
  await page.screenshot({ path: path.join(OUT, '0-sign-in.png') });
  await browser.close();
  for (const p of [ana, bruno, carla]) p.ws.close();
} finally {
  server.kill('SIGTERM');
  await sleep(500);
  fs.rmSync(dataDir, { recursive: true, force: true });
}
