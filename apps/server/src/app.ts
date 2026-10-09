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
import { academyFileAdapter, feedbackFileAdapter, feiraCartFileAdapter, feiraGamesFileAdapter, fileAdapter, gameConfigFileAdapter, layoutFileAdapter, padariaFileAdapter } from './fileStore.js';
import { GameConfig } from './gameConfig.js';
import { createAdminApi } from './adminApi.js';
import { AdminSessions } from './adminSession.js';
import { AdminAudit, BillingEventLog, FeedbackTriage } from './adminStores.js';
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
import { serveStatic } from './httpStatic.js';
import { applySecurityHeaders } from './securityHeaders.js';
import { legalPageFile } from './legalPages.js';
import {
  AccountStore,
  accountsFileAdapter,
  clientIp,
  defaultLimiters,
  handleAuthApi,
  originAllowed,
  sessionCookieOf,
  type CookieSecure,
  type ScryptParams,
} from './auth.js';
import { defaultFeedbackLimits, handleFeedbackApi } from './feedbackApi.js';
import { handleModerationApi } from './moderationApi.js';
import { IpConnectionCap, MessageBucket, readWsLimits, WS_POLICY_CLOSE, type WsLimitConfig } from './wsLimits.js';
import { handleAccountApi } from './accountApi.js';
import { FeedbackStore } from './feedbackStore.js';
import { AdminLoginGuard, readAdminAuthConfig, type AdminAuthConfig } from './adminAuth.js';
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
  /** WebSocket abuse limits (wsLimits.ts). Omit to read the env (`TB_WS_*`). */
  wsLimits?: Partial<WsLimitConfig>;
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
export const CLOSE_CODES: Record<CloseReason, number> = { replaced: 4000, idle: 4001, logout: 4002, admin: 4003, banned: 4004 };
/** Server restart (RFC 6455 1012). Sent to every socket on shutdown; the client shows "restarting" and reconnects. */
export const CLOSE_RESTART = 1012;
/** How long shutdown waits for sockets and HTTP keep-alives before cutting them. */
export const SHUTDOWN_GRACE_MS = 2_000;


export function createApp(opts: AppOptions) {
  const { dataDir, clientDist } = opts;
  // Open (and migrate) before any store constructor. A failed import must abort startup; ProfileStore would otherwise catch the error and later save an empty set.
  const db = openDatabase(dataDir);
  const store = new ProfileStore(fileAdapter(dataDir));
  const config = new GameConfig(gameConfigFileAdapter(dataDir));
  const audit = new AdminAudit(db);
  const billingEvents = new BillingEventLog(db);
  const feiraGamesFile = feiraGamesFileAdapter(dataDir);
  const feiraGames = new FeiraGamesStore(() => feiraGamesFile.load(), (state) => feiraGamesFile.save(state), () => Date.now());
  const feiraCartFile = feiraCartFileAdapter(dataDir);
  const feiraCart = new FeiraCartStore(() => feiraCartFile.load(), (state) => feiraCartFile.save(state));
  const academies = new AcademyStore(academyFileAdapter(dataDir));
  const padarias = new PadariaStore(padariaFileAdapter(dataDir));
  const layouts = new LayoutStore(layoutFileAdapter(dataDir));
  const feedback = new FeedbackStore(feedbackFileAdapter(dataDir));
  const feedbackAdmin = opts.feedbackAdmin ?? readAdminAuthConfig();
  // One wrong-password throttle for the admin secret over WebSocket and HTTP.
  const adminGuard = new AdminLoginGuard();
  const feedbackLimits = defaultFeedbackLimits();
  const billing = opts.billing ?? readBillingConfig(process.env);
  const accounts = new AccountStore(accountsFileAdapter(dataDir), { sessionTtlMs: opts.sessionTtlMs, scrypt: opts.scrypt });
  const fixedPapagaios = repairPapagaios((email) => accounts.profileIdForEmail(email), store);
  if (fixedPapagaios.length) console.log(`[papagaio] restored colours for ${fixedPapagaios.join(', ')}`);
  const moderation = new FileModerationQueue(path.join(dataDir, 'moderation.jsonl'));
  const safety = chatSafety(opts.jevModelDir ?? (process.env.TB_JEV_MODEL_DIR || undefined));
  const world = new World(
    store,
    {
      safety,
      gloss: new PhrasebookGloss(),
      npc: new AuthoredNpcDialogue(),
      student: new InMemoryStudentModel(),
      moderation,
    },
    { roomCap: opts.roomCap, ambiance: opts.ambiance, accounts, adminGuard, idleKickMs: opts.idleKickMs, academies, padarias, feiraGames, feiraCart, layouts, config },
  );
  const handleAdminApi = createAdminApi({
    ctx: {
      store,
      accounts,
      academies,
      padarias,
      feedback,
      feiraGames,
      moderation,
      world: world.adminHost(),
      config,
      audit,
      billingEvents,
      triage: new FeedbackTriage(db),
    },
    admin: feedbackAdmin,
    adminGuard,
    sessions: new AdminSessions(),
    db,
    dataDir,
    allowedOrigins: opts.allowedOrigins ?? [],
    cookieSecure: opts.cookieSecure,
    jevStatus: () => safety.status?.() ?? { state: 'stub' },
    startedAt: Date.now(),
  });
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

  /** Admin bearer (same secret as GET /api/feedback): unlocks the counts on /healthz. */
  const isAdmin = (req: http.IncomingMessage) => {
    const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization ?? ''));
    if (!m || !feedbackAdmin.ready || !feedbackAdmin.password) return false;
    return adminGuard.attempt(AdminLoginGuard.keys({ ip: clientIp(req) }), m[1]!.trim(), feedbackAdmin.password, 'healthz') === 'ok';
  };

  const onRequest = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    applySecurityHeaders(req, res);
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://x');
    } catch {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Bad request');
    }
    if (url.pathname === '/healthz') {
      const jev = safety.status?.() ?? { state: 'stub' };
      // Public: liveness, the Jev model state and the game clock (shown in game anyway). Player counts need the admin bearer.
      const body = { ok: true, gameMinute: world.gameMinuteNow(), jev: { state: jev.state } };
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(isAdmin(req) ? { ...body, ...world.stats(), accounts: accounts.count(), jev } : body));
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
        logEvent: (e) => billingEvents.add(e),
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
        adminGuard,
        limits: feedbackLimits,
      }).catch((e) => {
        console.error('[feedback] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (url.pathname.startsWith('/api/admin/')) {
      return handleAdminApi(req, res).catch((e) => {
        console.error('[admin] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (url.pathname === '/api/moderation') {
      return handleModerationApi(req, res, { admin: feedbackAdmin, adminGuard, moderation: world.services.moderation });
    }
    if (url.pathname.startsWith('/api/account/')) {
      return handleAccountApi(req, res, {
        accounts,
        store,
        academies,
        padarias,
        feedback,
        feiraGames,
        moderation,
        forgetLive: (accountId, profileId) => world.forgetAccount(accountId, profileId),
        limiters,
        admin: feedbackAdmin,
        adminGuard,
        allowedOrigins,
        cookieSecure: opts.cookieSecure,
      }).catch((e) => {
        console.error('[account] handler error', e);
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
        allowedOrigins,
        playerIdFor: (r) => accounts.accountForSession(sessionCookieOf(r))?.profileId,
      }).catch((e) => {
        console.error('[conversa] handler error', e);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    }
    if (!clientDist) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Tudo Bem server is running. In dev, open the Vite client at http://localhost:5173');
    }
    // Privacy and terms are real HTML. Without this, /privacy falls through to the game shell and looks blank.
    // /admin is the dashboard page (admin.html): it holds no data and no secret, every call it makes is checked server-side.
    const legalName = url.pathname === '/admin' || url.pathname === '/admin/' ? 'admin.html' : legalPageFile(url.pathname);
    if (legalName) {
      const file = path.join(clientDist, legalName);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
        return res.end('Not found');
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return fs.createReadStream(file).pipe(res);
    }
    serveStatic(req, res, url, clientDist);
  };
  // One bad request must never take the world down: log it, answer 500 without the stack.
  const server = http.createServer((req, res) => {
    onRequest(req, res).catch((e) => {
      console.error('[http] handler error', req.method, req.url, e);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end();
    });
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
  const wsLimits = { ...readWsLimits(), ...opts.wsLimits };
  const ipCap = new IpConnectionCap(wsLimits.maxPerIp);

  wss.on('connection', (ws, req) => {
    const ip = clientIp(req);
    if (!ipCap.acquire(ip)) {
      ws.on('error', () => {});
      return ws.close(WS_POLICY_CLOSE, 'too many connections');
    }
    ws.once('close', () => ipCap.release(ip));
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
      { accountId: account?.id, ip: clientIp(req) },
    );
    // A socket that never says hello, or has no signed-in session, does not get to hold a connection open.
    let helloed = false;
    const helloTimer = setTimeout(() => {
      if (!helloed || !account) ws.close(WS_POLICY_CLOSE, 'hello timeout');
    }, wsLimits.helloTimeoutMs);
    const bucket = new MessageBucket(wsLimits);
    ws.on('message', (data) => {
      if (!bucket.take()) {
        if (bucket.abusive) ws.close(WS_POLICY_CLOSE, 'rate limit');
        return;
      }
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg?.t === 'hello') helloed = true;
      world.handle(session, msg).catch((e) => console.error('[world] handler error', e));
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      world.disconnect(session);
    });
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

  let closing: Promise<void> | null = null;
  /** Write every store. `final` ends the profile store (later saves are ignored). Returns the names that failed. */
  const persistAll = (final: boolean): string[] => {
    const failed: string[] = [];
    const steps: [string, () => void][] = [
      ['profiles', () => (final ? store.shutdown() : store.flush())],
      ['feiraGames', () => feiraGames.persist()],
      ['feiraCart', () => feiraCart.persist()],
      ['academies', () => academies.save()],
      ['padarias', () => padarias.save()],
      ['feedback', () => feedback.save()],
    ];
    for (const [name, step] of steps) {
      try {
        step();
      } catch (e) {
        failed.push(name);
        console.error(`[shutdown] ${name} write failed`, e);
      }
    }
    return failed;
  };

  return {
    server,
    wss,
    world,
    store,
    accounts,
    config,
    audit,
    adminApi: handleAdminApi,
    /**
     * Graceful stop. Order: write every store first (a SIGKILL after the grace period loses nothing), close
     * sockets with 1012 (clients show "restarting" and reconnect), stop HTTP and cut lingering connections after
     * SHUTDOWN_GRACE_MS, write again (disconnects stamped lastSeen), back up last. A second call (second signal)
     * gets the same promise. Rejects when the final write fails, so the process can exit non-zero.
     */
    close() {
      closing ??= (async () => {
        clearInterval(heartbeat);
        clearInterval(idleSweep);
        if (backupKick) clearTimeout(backupKick);
        if (backupTimer) clearInterval(backupTimer);
        persistAll(false);
        for (const ws of wss.clients) {
          try {
            ws.close(CLOSE_RESTART, 'restart');
          } catch {
            ws.terminate();
          }
        }
        wss.close();
        await new Promise<void>((resolve) => {
          const force = setTimeout(() => {
            for (const ws of wss.clients) ws.terminate();
            server.closeAllConnections();
          }, SHUTDOWN_GRACE_MS);
          force.unref?.();
          server.close(() => {
            clearTimeout(force);
            resolve();
          });
        });
        const failed = persistAll(true);
        if (opts.sqliteBackups && !failed.length) {
          try {
            await backupDatabase(openDatabase(dataDir), dataDir);
          } catch {
            console.error('[sqlite] shutdown backup failed');
          }
        }
        closeDatabase(dataDir);
        if (failed.length) throw new Error(`[shutdown] could not write: ${failed.join(', ')}`);
      })();
      return closing;
    },
  };
}
