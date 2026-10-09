/**
 * GET /api/moderation — the review list: player reports (with the server's snapshot of the target's lines),
 * Jev escalations, blocks and warnings, newest first. Same auth as `GET /api/feedback`: the admin password as
 * `Authorization: Bearer …` (`TB_ADMIN_PASSWORD`; local default when unset).
 *
 * Query: `limit` (1-200, default 50), `since` (ms epoch), `kind` (report | escalate | block | warn).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { adminPasswordMatches, type AdminAuthConfig } from './adminAuth.js';
import type { ModerationQueue } from './services/interfaces.js';
import { moderationRows } from './playerModeration.js';

export interface ModerationApiDeps {
  admin: AdminAuthConfig;
  moderation: ModerationQueue;
}

const KINDS = ['report', 'escalate', 'block', 'warn'] as const;

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return '';
  return /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? '';
}

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number | null {
  const raw = url.searchParams.get(key);
  if (raw == null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n < min || n > max ? null : n;
}

export function handleModerationApi(req: IncomingMessage, res: ServerResponse, deps: ModerationApiDeps): void {
  const url = new URL(req.url ?? '/', 'http://x');
  if (req.method !== 'GET') return send(res, 405, { ok: false, code: 'bad_request' });
  if (!deps.admin.ready || !deps.admin.password) return send(res, 404, { ok: false, code: 'disabled' });
  if (!adminPasswordMatches(bearer(req), deps.admin.password)) return send(res, 401, { ok: false, code: 'unauthorized' });
  const limit = intParam(url, 'limit', 50, 1, 200);
  const since = intParam(url, 'since', 0, 0, Number.MAX_SAFE_INTEGER);
  const kind = url.searchParams.get('kind');
  if (limit === null || since === null || (kind !== null && !(KINDS as readonly string[]).includes(kind))) return send(res, 400, { ok: false, code: 'bad_request' });
  const events = deps.moderation.recent(1000).filter((e) => !kind || e.kind === kind);
  const items = moderationRows(events, limit, since).map((row) => ({ ...row, iso: new Date(row.at).toISOString() }));
  send(res, 200, { ok: true, total: items.length, items });
}
