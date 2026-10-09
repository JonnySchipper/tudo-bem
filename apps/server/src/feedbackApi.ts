/**
 * POST /api/feedback — anyone in the live game can leave a note (no paywall).
 * GET  /api/feedback — daily review. Requires the admin password (`Authorization: Bearer …`),
 * the same secret as the hidden admin panel (`TB_ADMIN_PASSWORD`; local default when unset).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { prepareFeedback, type FeedbackCode } from '@tudobem/shared';
import { clientIp, originAllowed, sessionCookieOf, type AccountStore } from './auth.js';
import { AttemptLimiter } from './attemptLimiter.js';
import { ADMIN_TOO_MANY, AdminLoginGuard, type AdminAuthConfig } from './adminAuth.js';
import type { FeedbackStore } from './feedbackStore.js';
import type { ModerationQueue } from './services/interfaces.js';

const MAX_BODY = 8 * 1024;

/** Notes per hour: a guest per client IP, a signed-in player per account. */
export const FEEDBACK_GUEST_PER_HOUR = 5;
export const FEEDBACK_ACCOUNT_PER_HOUR = 20;

export interface FeedbackLimits {
  guest: AttemptLimiter;
  account: AttemptLimiter;
}

export function defaultFeedbackLimits(now: () => number = Date.now): FeedbackLimits {
  return {
    guest: new AttemptLimiter(FEEDBACK_GUEST_PER_HOUR, 60 * 60_000, now),
    account: new AttemptLimiter(FEEDBACK_ACCOUNT_PER_HOUR, 60 * 60_000, now),
  };
}

const FEEDBACK_RATE = { pt: 'Você já mandou vários recados agora. Tenta de novo daqui a pouco.', en: 'You’ve sent several notes just now. Try again in a little while.' };

export interface FeedbackApiDeps {
  store: FeedbackStore;
  accounts: AccountStore;
  admin: AdminAuthConfig;
  moderation: ModerationQueue;
  allowedOrigins?: readonly string[];
  now?: () => number;
  /** Shared with the other admin-password checks (app.ts). */
  adminGuard: AdminLoginGuard;
  limits: FeedbackLimits;
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

function fail(res: ServerResponse, status: number, code: FeedbackCode | 'unauthorized' | 'disabled' | 'rate', pt?: string, en?: string) {
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
    const verdict = deps.adminGuard.attempt(AdminLoginGuard.keys({ ip: clientIp(req) }), bearer(req), admin.password, 'feedback list');
    if (verdict === 'blocked') {
      fail(res, 429, 'rate', ADMIN_TOO_MANY.pt, ADMIN_TOO_MANY.en);
      return;
    }
    if (verdict === 'wrong') {
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
  // Every attempt counts (a refused note can still file a moderation entry).
  const allowed = account ? deps.limits.account.take(`acct:${account.id}`) : deps.limits.guest.take(`ip:${clientIp(req)}`);
  if (!allowed) {
    fail(res, 429, 'rate', FEEDBACK_RATE.pt, FEEDBACK_RATE.en);
    return;
  }

  const prepared = prepareFeedback(body);
  if (!prepared.ok) {
    if (prepared.code === 'unsafe' || prepared.queue) {
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
  send(res, 201, { ok: true });
}
