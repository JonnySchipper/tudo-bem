import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg } from '@tudobem/shared';
import { World } from './world.js';
import { ProfileStore } from './store.js';
import { fileAdapter } from './fileStore.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';
import { FileModerationQueue } from './services/fileModeration.js';
import { handleConversaApi } from './conversaApi.js';
import { handleAuthApi } from './authApi.js';
import { staticCacheControl } from './cacheControl.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const CLIENT_DIST = process.env.CLIENT_DIST ?? [path.resolve(here, '../../client/dist'), path.resolve(process.cwd(), 'apps/client/dist')].find((p) => fs.existsSync(p));
const ROOM_CAP = Number(process.env.ROOM_CAP ?? 16);
/** Praça / Academia ambiance CPUs: `on` for “feel” playtests (default), `off` for empty-room playtests. */
const CPU_AMBIANCE = (process.env.LIVEOPS_CPU_AMBIANCE ?? 'on').toLowerCase() !== 'off';

const store = new ProfileStore(fileAdapter(DATA_DIR));
const world = new World(
  store,
  {
    safety: new JevStubSafety(),
    gloss: new PhrasebookGloss(),
    npc: new AuthoredNpcDialogue(),
    student: new InMemoryStudentModel(),
    moderation: new FileModerationQueue(path.join(DATA_DIR, 'moderation.jsonl')),
  },
  { roomCap: ROOM_CAP, ambiance: CPU_AMBIANCE },
);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, ...world.stats() }));
  }
  if (url.pathname === '/api/conversa') {
    return handleConversaApi(req, res, {
      store,
      onProfileChanged: (playerId) => world.pushProfileById(playerId),
    });
  }
  if (handleAuthApi(req, res, url.pathname)) return;
  if (!CLIENT_DIST) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Tudo Bem server is running. In dev, open the Vite client at http://localhost:5173');
  }
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = path.join(CLIENT_DIST, rel);
  if (!file.startsWith(CLIENT_DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(CLIENT_DIST, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': staticCacheControl(url, ext),
  });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws) => {
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));
  const session = world.connect(
    crypto.randomUUID(),
    (m) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
    },
    () => ws.close(4000, 'replaced'),
  );
  ws.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    world.handle(session, msg).catch((e) => console.error('[world] handler error', e));
  });
  ws.on('close', () => world.disconnect(session));
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 30_000);

server.listen(PORT, HOST, () => {
  console.log(`\n  Tudo Bem · servidor da praça em http://localhost:${PORT}`);
  console.log(`  client: ${CLIENT_DIST ?? '(dev mode — use Vite on :5173)'} · data: ${DATA_DIR} · cap ${ROOM_CAP}/instância · CPUs ${CPU_AMBIANCE ? 'on' : 'off'}\n`);
});

const shutdown = () => {
  clearInterval(heartbeat);
  store.flush();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
