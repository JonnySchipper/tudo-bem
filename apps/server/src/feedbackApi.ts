/**
 * POST /api/feedback — anyone in the live game can leave a note (no paywall).
 * GET  /api/feedback — daily review. Requires the admin password (`Authorization: Bearer …`),
 * the same secret as the hidden admin panel (`TB_ADMIN_PASSWORD`; local default when unset).
 */
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { prepareFeedback, type FeedbackCode } from '@tudobem/shared';
import { AttemptLimiter, clientIp, originAllowed, sessionCookieOf, type AccountStore } from './auth.js';
import type { AdminAuthConfig } from './adminAuth.js';
import type { FeedbackStore } from './feedbackStore.js';
import type { ModerationQueue } from './services/interfaces.js';

/** Accepted notes per IP (and per account, when signed in) each hour. */
export const FEEDBACK_HOURLY_MAX = 8;
const HOUR_MS = 60 * 60_000;
const MAX_BODY = 8 * 1024;

export interface FeedbackApiDeps {
  store: FeedbackStore;
  accounts: AccountStore;
  limiter: AttemptLimiter;
  admin: AdminAuthConfig;
  moderation: ModerationQueue;
  allowedOrigins?: readonly string[];
  now?: () => number;
}

export function feedbackLimiter(now: () => number = Date.now): AttemptLimiter {
  return new AttemptLimiter(FEEDBACK_HOURLY_MAX, HOUR_MS, now);
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? '';
}

function passwordMatches(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function fail(res: ServerResponse, status: number, code: FeedbackCode | 'unauthorized' | 'disabled', pt?: string, en?: string) {
  send(res, status, { ok: false, code, ...(pt ? { pt, en } : {}) });
}

export async function handleFeedbackApi(req: IncomingMessage, res: ServerResponse, deps: FeedbackApiDeps): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname !== '/api/feedback') {
    fail(res, 404, 'bad_request');
    return;
  }

  if (req.method === 'GET') {
    const admin = deps.admin;
    if (!admin.ready || !admin.password) {
      fail(res, 404, 'disabled');
      return;
    }
    if (!passwordMatches(bearer(req), admin.password)) {
      fail(res, 401, 'unauthorized');
      return;
    }
    const limitRaw = url.searchParams.get('limit');
    let limit = 50;
    if (limitRaw != null) {
      if (!/^\d+$/.test(limitRaw)) {
        fail(res, 400, 'bad_request');
        return;
      }
      limit = Number(limitRaw);
      if (limit < 1 || limit > 200) {
        fail(res, 400, 'bad_request');
        return;
      }
    }
    const sinceRaw = url.searchParams.get('since');
    let since = 0;
    if (sinceRaw != null) {
      if (!/^\d+$/.test(sinceRaw)) {
        fail(res, 400, 'bad_request');
        return;
      }
      since = Number(sinceRaw);
    }
    const items = deps.store.list({ limit, since }).map((row) => ({ ...row, at: new Date(row.createdAt).toISOString() }));
    send(res, 200, { ok: true, stored: deps.store.stored(), total: deps.store.count(since), items });
    return;
  }

  if (req.method !== 'POST') {
    fail(res, 404, 'bad_request');
    return;
  }
  if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
    fail(res, 403, 'bad_request');
    return;
  }

  const body = await readJson(req);
  if (!body) {
    fail(res, 400, 'bad_request', 'Não deu pra ler esse recado.', "We couldn't read that note.");
    return;
  }

  const account = deps.accounts.accountForSession(sessionCookieOf(req));
  const ip = clientIp(req);
  const keys = [`ip:${ip}`, ...(account ? [`acct:${account.id}`] : [])];
  if (keys.some((key) => deps.limiter.blocked(key))) {
    fail(res, 429, 'rate', 'Calma, já recebemos o seu recado. Tenta de novo mais tarde.', 'We already got your note. Try again later.');
    return;
  }

  const prepared = prepareFeedback(body);
  if (!prepared.ok) {
    if (prepared.code === 'unsafe' || prepared.queue) {
      for (const key of keys) deps.limiter.hit(key);
      if (prepared.queue) {
        deps.moderation.push({
          kind: prepared.queue.action,
          surface: 'feedback',
          playerId: account?.id ?? 'guest',
          playerName: 'jogador',
          room: typeof body.room === 'string' ? body.room.slice(0, 32) : 'feedback',
          text: prepared.queue.text,
          labels: prepared.queue.labels,
          rules: prepared.queue.rules,
          toxicity: prepared.queue.toxicity,
          ...(prepared.queue.action === 'escalate' ? { status: 'pending' as const } : {}),
          at: deps.now?.() ?? Date.now(),
        });
      }
    }
    fail(res, 400, prepared.code, prepared.pt, prepared.en);
    return;
  }

  // A signed-in player already has an account id. Do not also keep a contact, and never the email.
  const contact = account ? null : prepared.value.contact;
  deps.store.add({
    text: prepared.value.text,
    category: prepared.value.category,
    contact,
    accountId: account?.id ?? null,
    profileId: account?.profileId ?? null,
    room: prepared.value.room,
  });
  for (const key of keys) deps.limiter.hit(key);
  send(res, 201, { ok: true });
}
