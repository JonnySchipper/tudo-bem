/**
 * POST /api/account/delete        — self-serve deletion. Password re-entry; a Google account types its email instead.
 * GET  /api/account/export        — the signed-in player's data as a JSON download (no password or session hashes).
 * POST /api/account/admin-delete  — the same deletion by email, for the team (`Authorization: Bearer <TB_ADMIN_PASSWORD>`).
 *                                   `scripts/delete-account.mjs <email>` calls it.
 * Same-origin + JSON on the POSTs, like /api/auth.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AUTH_COPY, normalizeEmail } from '@tudobem/shared';
import { PASSWORD_WRONG, clearSessionCookie, clientIp, originAllowed, readJson, sessionCookieOf, type AuthLimiters, type CookieSecure } from './auth.js';
import { ADMIN_TOO_MANY, ADMIN_WRONG_PASSWORD, AdminLoginGuard, type AdminAuthConfig } from './adminAuth.js';
import { deleteAccountCascade, exportAccountData, type AccountDeleteDeps } from './accountDelete.js';

export interface AccountApiDeps extends AccountDeleteDeps {
  limiters: AuthLimiters;
  admin: AdminAuthConfig;
  adminGuard: AdminLoginGuard;
  allowedOrigins?: readonly string[];
  cookieSecure?: CookieSecure;
}

export const DELETE_CONFIRM_WRONG = {
  pt: 'Digite o e-mail da conta exatamente como ele é.',
  en: 'Type the account email exactly as it is.',
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

const fail = (code: string, copy: { pt: string; en: string }) => ({ ok: false, code, ...copy });

function bearer(req: IncomingMessage): string {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return '';
  return /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim() ?? '';
}

export async function handleAccountApi(req: IncomingMessage, res: ServerResponse, deps: AccountApiDeps): Promise<void> {
  const action = new URL(req.url ?? '/', 'http://x').pathname.replace(/^\/api\/account\/?/, '');
  const { accounts, limiters } = deps;

  if (action === 'export' && req.method === 'GET') {
    const account = accounts.accountForSession(sessionCookieOf(req));
    if (!account) return send(res, 401, fail('unauthenticated', AUTH_COPY.unauthenticated));
    const day = new Date().toISOString().slice(0, 10);
    return send(res, 200, exportAccountData(deps, account), { 'content-disposition': `attachment; filename="tudo-bem-${day}.json"` });
  }

  if (req.method !== 'POST' || (action !== 'delete' && action !== 'admin-delete')) {
    return send(res, 404, fail('bad_request', AUTH_COPY.badRequest));
  }
  if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
    return send(res, 403, fail('bad_request', AUTH_COPY.badRequest));
  }
  const ip = clientIp(req);

  if (action === 'admin-delete') {
    if (!deps.admin.ready || !deps.admin.password) return send(res, 404, fail('disabled', AUTH_COPY.badRequest));
    const verdict = deps.adminGuard.attempt(AdminLoginGuard.keys({ ip }), bearer(req), deps.admin.password, 'account admin-delete');
    if (verdict === 'blocked') return send(res, 429, fail('rate', ADMIN_TOO_MANY));
    if (verdict === 'wrong') return send(res, 401, fail('unauthorized', ADMIN_WRONG_PASSWORD));
    const body = await readJson(req);
    const email = typeof body?.email === 'string' ? body.email : '';
    const account = email ? accounts.byEmailGet(email) : undefined;
    if (!account) return send(res, 404, fail('not_found', { pt: 'Nenhuma conta com esse e-mail.', en: 'No account with that email.' }));
    const summary = deleteAccountCascade(deps, account.id);
    return send(res, 200, { ok: true, deleted: summary });
  }

  const raw = sessionCookieOf(req);
  const account = accounts.accountForSession(raw);
  if (!account) return send(res, 401, fail('unauthenticated', AUTH_COPY.unauthenticated));
  const body = await readJson(req);
  if (!body) return send(res, 400, fail('bad_request', AUTH_COPY.badRequest));
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmEmail = typeof body.confirmEmail === 'string' ? body.confirmEmail : '';

  // Same per-account budget as a login: a borrowed cookie can't guess its way to a deletion.
  const key = `acct:${account.id}`;
  if (!limiters.login.take(key)) return send(res, 429, fail('rate', AUTH_COPY.rate));
  if (!limiters.ip.take(ip)) {
    limiters.login.release(key);
    return send(res, 429, fail('rate', AUTH_COPY.rate));
  }
  let ok = false;
  if (password) ok = await accounts.checkPassword(account, password);
  // A Google account has no password the player knows; typing the account email is the confirmation.
  else if (account.googleSub) ok = !!confirmEmail && normalizeEmail(confirmEmail) === account.email;
  if (!ok) return send(res, 401, fail('credentials', account.googleSub && !password ? DELETE_CONFIRM_WRONG : PASSWORD_WRONG));
  limiters.login.reset(key);
  limiters.ip.release(ip);
  // The account may have been deleted elsewhere while the password hashed.
  if (!accounts.get(account.id)) return send(res, 401, fail('unauthenticated', AUTH_COPY.unauthenticated));
  const summary = deleteAccountCascade(deps, account.id);
  return send(res, 200, { ok: true, deleted: { profiles: summary?.profileIds.length ?? 0 } }, { 'set-cookie': clearSessionCookie(req, deps.cookieSecure) });
}
