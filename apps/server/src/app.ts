import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { WS_MAX_PAYLOAD, conversaDateKey, type ClientMsg } from '@tudobem/shared';
import { World, type CloseReason } from './world.js';
import { ProfileStore } from './store.js';
import { AcademyStore } from './academyStore.js';
import { PadariaStore } from './padariaStore.js';
import { academyFileAdapter, feedbackFileAdapter, feiraCartFileAdapter, feiraGamesFileAdapter, fileAdapter, layoutFileAdapter, padariaFileAdapter } from './fileStore.js';
import { backupDatabase, closeDatabase, openDatabase } from './sqliteDb.js';
import { LayoutStore } from './layoutStore.js';
import { FeiraCartStore } from './feiraCart.js';
import { FeiraGamesStore } from './feiraGames.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';
import { FileModerationQueue } from './services/fileModeration.js';
import { JevModelSafety, jevSelfCheck, loadOnnxToxModel } from './services/jevModel.js';
import type { ChatSafetyService } from './services/interfaces.js';
import { handleConversaApi } from './conversaApi.js';
import { ConversaMemory } from './conversaMemory.js';
import { staticCacheControl } from './cacheControl.js';
import { legalPageFile } from './legalPages.js';
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
import { handleFeedbackApi } from './feedbackApi.js';
import { FeedbackStore } from './feedbackStore.js';
import { readAdminAuthConfig, type AdminAuthConfig } from './adminAuth.js';
import { handleBillingApi } from './billing/http.js';
import { billingConfigured, readBillingConfig } from './billing/provider.js';
import { publicAppConfig, readOpsSmokeConfig, type OpsSmokeConfig } from './opsSmoke.js';
import { readGoogleOAuthConfig, type GoogleOAuthConfig, type GoogleTokenPayload } from './googleAuth.js';
import { repairPapagaios } from './papagaioRepair.js';

export interface AppOptions {
  dataDir: string;
  clientDist?: string;
  /** Override env-based Ops smoke config (tests). */
  opsSmoke?: OpsSmokeConfig;
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
  /** Override Google OAuth config (tests). */
  googleOAuth?: GoogleOAuthConfig;
  /** Skip JWKS network verification in tests. */
  verifyGoogleIdToken?: (token: string, clientId: string) => Promise<GoogleTokenPayload | null>;
  /** Override admin auth for GET /api/feedback (tests). Defaults to `TB_ADMIN_PASSWORD`. */
  feedbackAdmin?: AdminAuthConfig;
  /** Jev model folder (scripts/fetch-jev-model.py). Defaults to `TB_JEV_MODEL_DIR`; unset = stub only. */
  jevModelDir?: string;
  /** Lemon Squeezy secrets. Omit to read the process env. Missing any secret disables checkout and the webhook. */
  billing?: import('./billing/provider.js').BillingConfig;
  /** Test double for the Lemon Squeezy HTTP client. */
  billingFetch?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Hourly online backups under `dataDir/backups`, and one on shutdown when the last copy is older than an hour. */
  sqliteBackups?: boolean;
}

/** Server chat safety: the Jev model behind the stub when a model folder is configured, else the stub alone. */
function chatSafety(dir: string | undefined): ChatSafetyService & { status?: JevModelSafety['status'] } {
  if (!dir) return new JevStubSafety();
  const threads = Number(process.env.TB_JEV_THREADS) || 1;
  const t0 = Date.now();
  const safety = new JevModelSafety(new JevStubSafety(), loadOnnxToxModel(dir, { threads }));
  void safety.ready().then((st) => {
    const rss = Math.round(process.memoryUsage().rss / 1e6);
    if (st.state !== 'ready') return console.error(`[jev] model unavailable, stub-only chat safety: ${st.error}`);
    console.log(`[jev] model ${st.model} ready in ${Date.now() - t0}ms (rss ${rss} MB)`);
    if (process.env.TB_JEV_SELFCHECK === '0') return;
    void jevSelfCheck(safety).then((r) =>
      console.log(`[jev] self-check ${r.pass}/${r.total} model-pack cases ok, p50 ${r.p50}ms p95 ${r.p95}ms${r.failed.length ? `; FAILED: ${r.failed.join(' | ')}` : ''}`),
    );
  });
  return safety;
}

/** WebSocket close codes the client understands (see apps/client/src/net.ts). */
export const CLOSE_CODES: Record<CloseReason, number> = { replaced: 4000, idle: 4001, logout: 4002, admin: 4003 };

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
  // Open (and migrate) before any store constructor. A failed import must abort startup; ProfileStore would otherwise catch the error and later save an empty set.
  openDatabase(dataDir);
  const store = new ProfileStore(fileAdapter(dataDir));
  const feiraGamesFile = feiraGamesFileAdapter(dataDir);
  const feiraGames = new FeiraGamesStore(() => feiraGamesFile.load(), (state) => feiraGamesFile.save(state), () => Date.now());
  const feiraCartFile = feiraCartFileAdapter(dataDir);
  const feiraCart = new FeiraCartStore(() => feiraCartFile.load(), (state) => feiraCartFile.save(state));
  const academies = new AcademyStore(academyFileAdapter(dataDir));
  const padarias = new PadariaStore(padariaFileAdapter(dataDir));
  const layouts = new LayoutStore(layoutFileAdapter(dataDir));
  const feedback = new FeedbackStore(feedbackFileAdapter(dataDir));
  const feedbackAdmin = opts.feedbackAdmin ?? readAdminAuthConfig();
  const billing = opts.billing ?? readBillingConfig(process.env);
  const accounts = new AccountStore(accountsFileAdapter(dataDir), { sessionTtlMs: opts.sessionTtlMs, scrypt: opts.scrypt });
  const fixedPapagaios = repairPapagaios((email) => accounts.profileIdForEmail(email), store);
  if (fixedPapagaios.length) console.log(`[papagaio] restored colours for ${fixedPapagaios.join(', ')}`);
  const safety = chatSafety(opts.jevModelDir ?? (process.env.TB_JEV_MODEL_DIR || undefined));
  const world = new World(
    store,
    {
      safety,
      gloss: new PhrasebookGloss(),
      npc: new AuthoredNpcDialogue(),
      student: new InMemoryStudentModel(),
      moderation: new FileModerationQueue(path.join(dataDir, 'moderation.jsonl')),
    },
    { roomCap: opts.roomCap, ambiance: opts.ambiance, accounts, idleKickMs: opts.idleKickMs, academies, padarias, feiraGames, feiraCart, layouts },
  );
  const conversaMemory = new ConversaMemory({ store, onProfileChanged: (playerId) => world.pushProfileById(playerId) });
  // Test servers (TB_TEST_CLOCK_CONTROL=1, never set on prod) lift the 10-signups-per-hour-per-IP cap: e2e:all signs up 10+ accounts from 127.0.0.1.
  const limiters = defaultLimiters(Date.now, process.env.TB_TEST_CLOCK_CONTROL === '1' ? 200 : 10);
  const allowedOrigins = opts.allowedOrigins ?? [];
  const opsSmoke = opts.opsSmoke ?? readOpsSmokeConfig();
  const googleOAuth = opts.googleOAuth ?? readGoogleOAuthConfig();
  const verifyGoogleIdToken = opts.verifyGoogleIdToken;
  if (opsSmoke.ready && opsSmoke.password) {
    void accounts.ensureSmokeAccount(opsSmoke.email, opsSmoke.password).catch((e) => console.error('[ops-smoke] seed failed', e));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, ...world.stats(), accounts: accounts.count(), gameMinute: world.gameMinuteNow(), jev: safety.status?.() ?? { state: 'stub' } }));
    }
    // Test only: `POST /__test/clock?min=510` sets the game clock to 08:30 (e2e runs pin it). Off unless TB_TEST_CLOCK_CONTROL=1.
    if (url.pathname === '/__test/clock' && process.env.TB_TEST_CLOCK_CONTROL === '1') {
      const min = Number(url.searchParams.get('min'));
      if (!Number.isFinite(min)) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: false }));
      }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, gameMinute: world.setClockMinute(min) }));
    }
    // Test only: `POST /__test/escola?name=Lia&words=24&mastered=14&ready=4&streak=6` seeds an online player's escola (the escola screenshots).
    if (url.pathname === '/__test/escola' && process.env.TB_TEST_CLOCK_CONTROL === '1') {
      const n = (k: string) => Math.max(0, Math.min(500, Math.floor(Number(url.searchParams.get(k)) || 0)));
      const ok = world.testSeedEscola(url.searchParams.get('name') ?? '', { words: n('words'), mastered: n('mastered'), ready: n('ready'), streak: n('streak') });
      res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok }));
    }
    if (url.pathname === '/api/config') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(publicAppConfig(opsSmoke, googleOAuth.ready ? googleOAuth.clientId : '', billingConfigured(billing))));
    }
    if (url.pathname.startsWith('/api/auth/')) {
      return handleAuthApi(req, res, {
        accounts,
        cookieSecure: opts.cookieSecure,
        allowedOrigins,
        limiters,
        opsSmoke,
        adminAuth: feedbackAdmin,
        googleOAuth,
        verifyGoogleIdToken,
        onLogout: (accountId) => world.dropAccount(accountId),
      }).catch((e) => {
        console.error('[auth] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (url.pathname === '/api/billing/checkout' || url.pathname === '/api/billing/webhook') {
      return handleBillingApi(req, res, {
        config: billing,
        accounts,
        store,
        sync: (userId) => world.syncEntitlements(userId),
        fetchImpl: opts.billingFetch,
      }).catch((e) => {
        console.error('[billing] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (url.pathname === '/api/feedback') {
      return handleFeedbackApi(req, res, {
        store: feedback,
        accounts,
        admin: feedbackAdmin,
        moderation: world.services.moderation,
        allowedOrigins,
      }).catch((e) => {
        console.error('[feedback] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (url.pathname === '/api/conversa') {
      return handleConversaApi(req, res, {
        store,
        onProfileChanged: (playerId) => world.pushProfileById(playerId),
        onConversaEnd: (playerId, npc, grade, order) => world.conversaEnded(playerId, npc, grade, order),
        onConversaLine: (playerId, who, pt) => world.conversaLine(playerId, who, pt),
        memory: conversaMemory,
        clockMinutes: () => world.gameMinuteNow(),
        dateKey: () => conversaDateKey(),
        playerIdFor: (r) => accounts.accountForSession(sessionCookieOf(r))?.profileId,
      });
    }
    if (!clientDist) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Tudo Bem server is running. In dev, open the Vite client at http://localhost:5173');
    }
    // Privacy and terms are real HTML. Without this, /privacy falls through to the game shell and looks blank.
    const legalName = legalPageFile(url.pathname);
    if (legalName) {
      const file = path.join(clientDist, legalName);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
        return res.end('Not found');
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return fs.createReadStream(file).pipe(res);
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
    // A diary photo is a jpeg data URL. 16KB closed the socket on the shot, before diary.handle ran.
    maxPayload: WS_MAX_PAYLOAD,
    verifyClient: (info: { req: http.IncomingMessage }, done: (ok: boolean, code?: number, message?: string) => void) =>
      originAllowed(info.req, allowedOrigins) ? done(true) : done(false, 403, 'Forbidden'),
  });
  /**
   * Unanswered protocol pings before the socket is dropped. One quiet interval is a phone whose
   * browser was suspended (the camera app is in front, so the page cannot pong). Two more and the
   * socket is actually gone.
   */
  const HEARTBEAT_MISSES = 3;
  const missed = new WeakMap<WebSocket, number>();

  wss.on('connection', (ws, req) => {
    missed.set(ws, 0);
    ws.on('pong', () => missed.set(ws, 0));
    // An oversized frame closes this socket. Without a listener the 'error' event takes the process down.
    ws.on('error', (err) => {
      if ((err as { code?: string }).code !== 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH') console.error('[ws]', err);
    });
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
      const n = missed.get(ws) ?? 0;
      if (n >= HEARTBEAT_MISSES) {
        ws.terminate();
        continue;
      }
      missed.set(ws, n + 1);
      ws.ping();
    }
  }, 30_000);
  const idleSweep = setInterval(() => {
    world.sweepIdle();
    world.sweepFeiraGames();
  }, opts.idleSweepMs ?? 15_000);

  const runBackup = () => {
    void backupDatabase(openDatabase(dataDir), dataDir).catch(() => console.error('[sqlite] backup failed'));
  };
  const backupKick = opts.sqliteBackups ? setTimeout(runBackup, 60_000) : null;
  const backupTimer = opts.sqliteBackups ? setInterval(runBackup, 60 * 60 * 1000) : null;
  backupKick?.unref();
  backupTimer?.unref();

  return {
    server,
    wss,
    world,
    store,
    accounts,
    async close() {
      clearInterval(heartbeat);
      clearInterval(idleSweep);
      if (backupKick) clearTimeout(backupKick);
      if (backupTimer) clearInterval(backupTimer);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      feiraGames.persist();
      feiraCart.persist();
      academies.save();
      padarias.save();
      feedback.save();
      store.shutdown();
      if (opts.sqliteBackups) {
        try {
          await backupDatabase(openDatabase(dataDir), dataDir);
        } catch {
          console.error('[sqlite] shutdown backup failed');
        }
      }
      closeDatabase(dataDir);
    },
  };
}
