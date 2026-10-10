/**
 * `/api/admin/*`: the admin dashboard's API (the page is `/admin`, apps/client/admin.html).
 *
 * `POST /api/admin/login` is the only route that answers without the admin cookie. Everything else, known route or not,
 * is 401 until the cookie checks out, so the client hides nothing the server does not also enforce. Writes must be
 * same-origin JSON (CSRF), and each one appends a row to `admin_audit` (adminOps.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { BELT_LADDER, MUTE_MAX_MINUTES, ROOM_IDS, ROOMS, hasPerkAccess, normalizeBjj, normalizeDiary } from '@tudobem/shared';
import { AdminLoginGuard, type AdminAuthConfig } from './adminAuth.js';
import { clientIp, originAllowed, readJson, type CookieSecure } from './auth.js';
import { ADMIN_SESSION_IDLE_MS, AdminSessions, adminCookie, adminCookieOf, type AdminSession } from './adminSession.js';
import { backupDatabase, listBackups, sqlitePath, type SqliteDatabase } from './sqliteDb.js';
import { LOCKED_TUNABLES } from './gameConfig.js';
import {
  INTRO_RESETS,
  ITEM_KINDS,
  MODERATION_KINDS,
  accountOf,
  ban,
  comp,
  deleteAccount,
  feedbackList,
  giveCoins,
  itemCatalogs,
  kick,
  moderationList,
  mute,
  playerDetail,
  playerRows,
  rename,
  resetIntro,
  resetLayout,
  resetProgress,
  restore,
  setBelt,
  setConfig,
  setFeiraCart,
  setFounder,
  setItem,
  signOutAll,
  subscriptions,
  triageFeedback,
  worldView,
  type AdminCtx,
  type OpResult,
  type PlayerRow,
} from './adminOps.js';
import { FEEDBACK_STATUSES } from './adminStores.js';
import { designPullRequest, designState, discardDraft, publishDesign, resetDesign, revertDesign, saveDraft } from './designOps.js';

export interface AdminApiDeps {
  ctx: AdminCtx;
  admin: AdminAuthConfig;
  /** Shared with the in-game admin gate, /api/feedback and /api/moderation: one throttle for the one secret. */
  adminGuard: AdminLoginGuard;
  sessions: AdminSessions;
  db: SqliteDatabase;
  dataDir: string;
  allowedOrigins?: readonly string[];
  cookieSecure?: CookieSecure;
  jevStatus: () => { state: string; model?: string; error?: string };
  startedAt: number;
}

type Handler = (req: IncomingMessage, res: ServerResponse, url: URL, actor: string, session: AdminSession) => Promise<void> | void;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

const unauthorized = (res: ServerResponse) => send(res, 401, { ok: false, code: 'unauthorized' });

function sendOp(res: ServerResponse, r: OpResult) {
  if (r.ok) return send(res, 200, r);
  send(res, r.status, { ok: false, error: r.error });
}

/** Spreadsheet-safe CSV cell: quoted, and a leading = + - @ cannot start a formula. */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : '');
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

function fileSize(file: string): number {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
}

const DESIGN_MAX_BODY = 512 * 1024;

const BACKUP_NAME =/^tudobem-[0-9TZ.\-]+\.sqlite$/;

export function createAdminApi(deps: AdminApiDeps) {
  const { ctx } = deps;

  // a whole room layout (up to LAYOUT_MAX_OBJECTS props) is far over the 8 KB every other route allows
  const body = async (req: IncomingMessage) => (await readJson(req, req.url?.startsWith('/api/admin/design/') ? DESIGN_MAX_BODY : undefined)) ?? {};
  const op = (fn: (ctx: AdminCtx, actor: string, b: Record<string, unknown>) => OpResult | Promise<OpResult>): Handler => async (req, res, _url, actor) =>
    sendOp(res, await fn(ctx, actor, await body(req)));

  function overview() {
    const now = ctx.world.now();
    const online = ctx.world.online();
    const accounts = ctx.accounts.all();
    const profiles = ctx.store.all();
    const days: { day: string; accounts: number; profiles: number }[] = [];
    for (let i = 29; i >= 0; i--) days.push({ day: dayKey(now - i * 86_400_000), accounts: 0, profiles: 0 });
    const byDay = new Map(days.map((d) => [d.day, d]));
    for (const a of accounts) {
      const d = byDay.get(dayKey(a.createdAt));
      if (d) d.accounts++;
    }
    for (const p of profiles) {
      const d = byDay.get(dayKey(p.createdAt));
      if (d) d.profiles++;
    }
    let paying = 0;
    let comps = 0;
    for (const p of profiles) {
      if (!hasPerkAccess(p.subscription, now)) continue;
      if (p.subscription?.provider === 'comp') comps++;
      else if (p.subscription?.provider !== 'dev') paying++;
    }
    const backupDir = path.join(path.resolve(deps.dataDir), 'backups');
    const backups = listBackups(backupDir);
    const db = sqlitePath(deps.dataDir);
    let disk: { total: number; free: number } | null = null;
    try {
      const st = fs.statfsSync(path.resolve(deps.dataDir));
      disk = { total: Number(st.blocks) * Number(st.bsize), free: Number(st.bavail) * Number(st.bsize) };
    } catch {
      disk = null;
    }
    const pendingModeration = ctx.moderation.recent(1000).filter((e) => (e.kind === 'report' || e.kind === 'escalate') && now - e.at < 7 * 86_400_000).length;
    const newFeedback = ctx.feedback.list({ limit: 5000 }).filter((r) => ctx.triage.get(r.id).status === 'new').length;
    return {
      ok: true,
      now,
      online: { players: online.length, list: online, instances: ctx.world.instances() },
      totals: { accounts: accounts.length, profiles: profiles.length, subscribers: paying, comps, banned: profiles.filter((p) => p.banned).length },
      signups: days,
      jev: deps.jevStatus(),
      server: {
        startedAt: deps.startedAt,
        uptimeSec: Math.round(process.uptime()),
        // TB_GIT_SHA comes from the Docker build arg; until the deploy passes it, Fly's image ref still names the release
        version: (process.env.TB_GIT_SHA !== 'unknown' && process.env.TB_GIT_SHA) || process.env.FLY_IMAGE_REF || 'dev',
        node: process.version,
        rssMb: Math.round(process.memoryUsage().rss / 1e6),
        region: process.env.FLY_REGION ?? null,
      },
      storage: {
        dbBytes: fileSize(db) + fileSize(`${db}-wal`) + fileSize(`${db}-shm`),
        disk,
        backups: { count: backups.length, bytes: backups.reduce((n, b) => n + b.size, 0), last: backups[0]?.mtimeMs ?? null },
        store: ctx.store.health(),
      },
      todo: { pendingModeration, newFeedback },
    };
  }

  function players(url: URL) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const filter = url.searchParams.get('filter') ?? '';
    const sort = url.searchParams.get('sort') ?? 'lastSeen';
    const dir = url.searchParams.get('dir') === 'asc' ? 1 : -1;
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 100));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const filters: Record<string, (r: PlayerRow) => boolean> = {
      online: (r) => r.online,
      subscribers: (r) => !!r.sub?.active,
      banned: (r) => r.banned,
      muted: (r) => r.muted,
      noprofile: (r) => !r.profileId,
      test: (r) => r.testUser,
      founder: (r) => r.founder,
    };
    let rows = playerRows(ctx);
    if (q) rows = rows.filter((r) => [r.name ?? '', r.email ?? '', r.id, r.accountId ?? ''].some((s) => s.toLowerCase().includes(q)));
    if (filters[filter]) rows = rows.filter(filters[filter]!);
    const key = (r: PlayerRow): string | number => {
      if (sort === 'name') return (r.name ?? r.email ?? '').toLowerCase();
      if (sort === 'email') return (r.email ?? '').toLowerCase();
      if (sort === 'createdAt') return r.createdAt;
      if (sort === 'coins') return r.coins ?? -1;
      if (sort === 'words') return r.words;
      if (sort === 'belt') return r.belt ? BELT_LADDER.findIndex((b) => b.belt === r.belt) * 10 + (r.stripes ?? 0) : -1;
      return r.lastSeen ?? 0;
    };
    rows.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
    });
    return { ok: true, total: rows.length, rows: rows.slice(offset, offset + limit) };
  }

  function exportCsv(what: string): string | null {
    if (what === 'accounts') {
      return toCsv(
        ['account_id', 'email', 'google', 'profile_id', 'created_at', 'last_login_at', 'confirmed_18_at', 'live_sessions'],
        ctx.accounts.all().map((a) => [a.id, a.email, a.googleSub ? 'yes' : 'no', a.profileId ?? '', iso(a.createdAt), iso(a.lastLoginAt), iso(a.confirmed18At), ctx.accounts.sessionsOf(a.id).length]),
      );
    }
    if (what === 'profiles') {
      const now = ctx.world.now();
      return toCsv(
        ['profile_id', 'name', 'account_id', 'email', 'created_at', 'last_seen', 'rv', 'belt', 'stripes', 'wins', 'diary_words', 'nameplate', 'founder', 'sub_status', 'sub_provider', 'sub_active', 'banned', 'muted_until', 'test_user'],
        ctx.store.all().map((p) => {
          const bjj = normalizeBjj(p.bjj);
          return [
            p.id,
            p.name,
            accountOf(ctx, p)?.id ?? '',
            accountOf(ctx, p)?.email ?? '',
            iso(p.createdAt),
            iso(p.lastSeen),
            p.coins,
            bjj.belt,
            bjj.stripes,
            bjj.wins,
            normalizeDiary(p.diary).length,
            p.nameplate,
            p.founder ? 'yes' : 'no',
            p.subscription?.status ?? '',
            p.subscription?.provider ?? '',
            hasPerkAccess(p.subscription, now) ? 'yes' : 'no',
            p.banned ? iso(p.banned.at) : '',
            (p.mutedUntil ?? 0) > now ? iso(p.mutedUntil) : '',
            p.testUser ? 'yes' : 'no',
          ];
        }),
      );
    }
    return null;
  }

  const backupDir = () => path.join(path.resolve(deps.dataDir), 'backups');

  const GET: Record<string, Handler> = {
    '/api/admin/session': (_q, res, _u, _a, s) => send(res, 200, { ok: true, name: s.name, expiresAt: deps.sessions.expiresAt(s), idleMs: ADMIN_SESSION_IDLE_MS }),
    '/api/admin/overview': (_q, res) => send(res, 200, overview()),
    '/api/admin/players': (_q, res, url) => send(res, 200, players(url)),
    '/api/admin/player': (_q, res, url) => sendOp(res, playerDetail(ctx, url.searchParams.get('id'))),
    '/api/admin/catalogs': (_q, res) =>
      send(res, 200, {
        ok: true,
        items: itemCatalogs(),
        itemKinds: ITEM_KINDS,
        belts: BELT_LADDER.map((b) => b.belt),
        introResets: INTRO_RESETS,
        muteMaxMinutes: MUTE_MAX_MINUTES,
        adminGrantMax: ctx.config.get('adminGrantMax'),
        rooms: ROOM_IDS.map((id) => ({ id, name: ROOMS[id].name })),
        moderationKinds: MODERATION_KINDS,
        feedbackStatuses: FEEDBACK_STATUSES,
      }),
    '/api/admin/subscriptions': (_q, res) => send(res, 200, subscriptions(ctx)),
    '/api/admin/moderation': (_q, res, url) => send(res, 200, moderationList(ctx, { kind: url.searchParams.get('kind'), search: url.searchParams.get('q'), limit: Number(url.searchParams.get('limit')) || undefined })),
    '/api/admin/feedback': (_q, res, url) => send(res, 200, feedbackList(ctx, { status: url.searchParams.get('status'), search: url.searchParams.get('q'), category: url.searchParams.get('category') })),
    '/api/admin/world': (_q, res) =>
      send(res, 200, { ...worldView(ctx), rooms: ROOM_IDS.filter((id) => id !== 'andar').map((id) => ({ id, name: ROOMS[id].name, designUrl: `/?design=${id}` })) }),
    '/api/admin/config': (_q, res) => send(res, 200, { ok: true, values: ctx.config.list(), locked: LOCKED_TUNABLES }),
    '/api/admin/data/backups': (_q, res) => send(res, 200, { ok: true, backups: listBackups(backupDir()).map((b) => ({ name: path.basename(b.path), bytes: b.size, at: b.mtimeMs })) }),
    '/api/admin/data/backup-file': (_q, res, url, actor) => {
      const name = url.searchParams.get('name') ?? '';
      const file = path.join(backupDir(), name);
      if (!BACKUP_NAME.test(name) || !fs.existsSync(file)) return send(res, 404, { ok: false, error: 'No backup with that name.' });
      ctx.audit.append({ actor, action: 'data.download', target: name, summary: `downloaded backup ${name}` });
      res.writeHead(200, {
        'content-type': 'application/vnd.sqlite3',
        'content-disposition': `attachment; filename="${name}"`,
        'content-length': String(fs.statSync(file).size),
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    },
    '/api/admin/data/export': (_q, res, url, actor) => {
      const what = url.searchParams.get('what') ?? '';
      const csv = exportCsv(what);
      if (csv === null) return send(res, 400, { ok: false, error: 'Export accounts or profiles.' });
      ctx.audit.append({ actor, action: 'data.export', target: what, summary: `exported ${what} CSV` });
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="tudobem-${what}-${dayKey(Date.now())}.csv"`, 'cache-control': 'no-store' });
      res.end(csv);
    },
    '/api/admin/audit': (_q, res, url) =>
      send(res, 200, {
        ok: true,
        items: ctx.audit.list({
          limit: Number(url.searchParams.get('limit')) || 100,
          beforeId: Number(url.searchParams.get('before')) || undefined,
          action: url.searchParams.get('action') || undefined,
          target: url.searchParams.get('target') || undefined,
        }),
        actions: ctx.audit.actions(),
      }),
    '/api/admin/design/state': (_q, res, url) => sendOp(res, designState(ctx, url.searchParams.get('room'))),
    '/api/admin/audit/entry': (_q, res, url) => {
      const e = ctx.audit.get(Number(url.searchParams.get('id')));
      return e ? send(res, 200, { ok: true, entry: e }) : send(res, 404, { ok: false, error: 'No audit entry with that id.' });
    },
  };

  const POST: Record<string, Handler> = {
    '/api/admin/logout': (req, res) => {
      deps.sessions.revoke(adminCookieOf(req));
      send(res, 200, { ok: true }, { 'set-cookie': adminCookie(req, '', deps.cookieSecure) });
    },
    '/api/admin/player/coins': op(giveCoins),
    '/api/admin/player/item': op(setItem),
    '/api/admin/player/belt': op(setBelt),
    '/api/admin/player/reset-intro': op(resetIntro),
    '/api/admin/player/reset-progress': op(resetProgress),
    '/api/admin/player/delete': op(deleteAccount),
    '/api/admin/player/signout': op(signOutAll),
    '/api/admin/player/mute': op(mute),
    '/api/admin/player/kick': op(kick),
    '/api/admin/player/ban': op(ban),
    '/api/admin/player/rename': op(rename),
    '/api/admin/player/founder': op(setFounder),
    '/api/admin/subscriptions/comp': op(comp),
    '/api/admin/feedback/triage': op(triageFeedback),
    '/api/admin/world/layout-reset': op(resetLayout),
    '/api/admin/world/feira-cart': op(setFeiraCart),
    '/api/admin/config': op(setConfig),
    '/api/admin/audit/restore': op(restore),
    '/api/admin/design/draft': op(saveDraft),
    '/api/admin/design/draft/discard': op(discardDraft),
    '/api/admin/design/publish': op(publishDesign),
    '/api/admin/design/revert': op(revertDesign),
    '/api/admin/design/reset': op(resetDesign),
    '/api/admin/design/pr': op(designPullRequest),
    '/api/admin/data/backup': async (_req, res, _url, actor) => {
      try {
        const file = await backupDatabase(deps.db, deps.dataDir, { force: true });
        if (!file) return send(res, 507, { ok: false, error: 'Backup skipped: not enough room on the volume (see the server log).' });
        ctx.audit.append({ actor, action: 'data.backup', target: path.basename(file), summary: `made backup ${path.basename(file)}` });
        send(res, 200, { ok: true, name: path.basename(file) });
      } catch {
        console.error('[admin] backup failed');
        send(res, 500, { ok: false, error: 'Backup failed (see the server log).' });
      }
    },
  };

  async function login(req: IncomingMessage, res: ServerResponse) {
    if (!deps.admin.ready || !deps.admin.password) return send(res, 404, { ok: false, code: 'disabled', error: 'Admin is off on this server (TB_ADMIN_PASSWORD is not set).' });
    const b = await body(req);
    const ip = clientIp(req);
    const verdict = deps.adminGuard.attempt(AdminLoginGuard.keys({ ip }), typeof b.password === 'string' ? b.password : '', deps.admin.password, 'dashboard login');
    if (verdict === 'blocked') return send(res, 429, { ok: false, code: 'rate', error: 'Too many password attempts. Wait 15 minutes.' });
    if (verdict === 'wrong') return send(res, 401, { ok: false, code: 'credentials', error: 'Wrong password.' });
    const name = (typeof b.name === 'string' ? b.name.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 40) : '') || 'admin';
    const raw = deps.sessions.create(name, ip);
    console.log(`[admin] dashboard sign-in name=${name} ip=${ip}`);
    send(res, 200, { ok: true, name }, { 'set-cookie': adminCookie(req, raw, deps.cookieSecure) });
  }

  /** Answers every `/api/admin/*` request. */
  async function handleAdminApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://x');
    const method = req.method ?? 'GET';
    const write = method !== 'GET' && method !== 'HEAD';
    if (write) {
      // CSRF: a cookie-bearing write must come from this site, as JSON (a cross-site form cannot send that without a preflight).
      if (!originAllowed(req, deps.allowedOrigins)) return send(res, 403, { ok: false, code: 'origin' });
      if (!/^application\/json\b/i.test(String(req.headers['content-type'] ?? ''))) return send(res, 415, { ok: false, code: 'json_only' });
    }
    if (url.pathname === '/api/admin/login') {
      if (method !== 'POST') return send(res, 405, { ok: false, code: 'method' });
      return login(req, res);
    }
    const session = deps.sessions.check(adminCookieOf(req));
    if (!session) return unauthorized(res);
    const handler = (write ? POST : GET)[url.pathname];
    if (!handler) return send(res, (write ? GET : POST)[url.pathname] ? 405 : 404, { ok: false, code: 'not_found' });
    const actor = `${session.name} @ ${session.ip}`;
    await handler(req, res, url, actor, session);
  }

  /** `routes` lists every route (the auth test asks each one for a 401 without the cookie). */
  return Object.assign(handleAdminApi, { routes: { get: Object.keys(GET), post: Object.keys(POST) } });
}
