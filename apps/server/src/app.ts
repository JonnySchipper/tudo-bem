import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg } from '@tudobem/shared';
import { World, type CloseReason } from './world.js';
import { ProfileStore } from './store.js';
import { fileAdapter } from './fileStore.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';
import { FileModerationQueue } from './services/fileModeration.js';
import { handleConversaApi } from './conversaApi.js';
import { staticCacheControl } from './cacheControl.js';
import {
  AccountStore,
  accountsFileAdapter,
  defaultLimiters,
  handleAuthApi,
  originAllowed,
  sessionCookieOf,
  type CookieSecure,
  type ScryptParams,
} from './auth.js';

export interface AppOptions {
  dataDir: string;
  clientDist?: string;
  roomCap?: number;
  ambiance?: boolean;
  idleKickMs?: number;
  /** How often the idle sweep runs. */
  idleSweepMs?: number;
  cookieSecure?: CookieSecure;
  /** Extra browser origins allowed to open the WebSocket / call /api/auth (same-origin is always allowed). */
  allowedOrigins?: string[];
  sessionTtlMs?: number;
  scrypt?: ScryptParams;
}

/** WebSocket close codes the client understands (see apps/client/src/net.ts). */
export const CLOSE_CODES: Record<CloseReason, number> = { replaced: 4000, idle: 4001, logout: 4002 };

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

export function createApp(opts: AppOptions) {
  const { dataDir, clientDist } = opts;
  const store = new ProfileStore(fileAdapter(dataDir));
  const accounts = new AccountStore(accountsFileAdapter(dataDir), { sessionTtlMs: opts.sessionTtlMs, scrypt: opts.scrypt });
  const world = new World(
    store,
    {
      safety: new JevStubSafety(),
      gloss: new PhrasebookGloss(),
      npc: new AuthoredNpcDialogue(),
      student: new InMemoryStudentModel(),
      moderation: new FileModerationQueue(path.join(dataDir, 'moderation.jsonl')),
    },
    { roomCap: opts.roomCap, ambiance: opts.ambiance, accounts, idleKickMs: opts.idleKickMs },
  );
  const limiters = defaultLimiters();
  const allowedOrigins = opts.allowedOrigins ?? [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ...world.stats(), accounts: accounts.count() }));
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return handleAuthApi(req, res, {
        accounts,
        cookieSecure: opts.cookieSecure,
        allowedOrigins,
        limiters,
        onLogout: (accountId) => world.dropAccount(accountId),
      }).catch((e) => {
        console.error('[auth] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (url.pathname === '/api/conversa') {
      return handleConversaApi(req, res, {
        store,
        onProfileChanged: (playerId) => world.pushProfileById(playerId),
        playerIdFor: (r) => accounts.accountForSession(sessionCookieOf(r))?.profileId,
      });
    }
    if (!clientDist) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Tudo Bem server is running. In dev, open the Vite client at http://localhost:5173');
    }
    const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = path.join(clientDist, rel);
    if (!file.startsWith(clientDist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(clientDist, 'index.html');
    const ext = path.extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': staticCacheControl(url, ext),
    });
    fs.createReadStream(file).pipe(res);
  });

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 16 * 1024,
    verifyClient: (info: { req: http.IncomingMessage }, done: (ok: boolean, code?: number, message?: string) => void) =>
      originAllowed(info.req, allowedOrigins) ? done(true) : done(false, 403, 'Forbidden'),
  });
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws, req) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const account = accounts.accountForSession(sessionCookieOf(req));
    const session = world.connect(
      crypto.randomUUID(),
      (m) => {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
      },
      (reason) => ws.close(CLOSE_CODES[reason], reason),
      { accountId: account?.id },
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
  const idleSweep = setInterval(() => world.sweepIdle(), opts.idleSweepMs ?? 15_000);

  return {
    server,
    wss,
    world,
    store,
    accounts,
    close() {
      clearInterval(heartbeat);
      clearInterval(idleSweep);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      store.flush();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
