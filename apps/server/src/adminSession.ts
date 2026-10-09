/**
 * Dashboard sign-in (playtudobem.com/admin). The admin password is checked once (AdminLoginGuard, the same check and
 * throttle as the in-game admin gate); after that the browser holds a random token in an httpOnly cookie scoped to
 * `/api/admin`. Only its sha256 is kept, in memory: a restart signs everyone out, which is fine for one admin.
 *
 * Short-lived: 30 minutes without a request ends it, and 8 hours ends it regardless.
 */
import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { parseCookies, type CookieSecure } from './auth.js';
import { requestIsHttps } from './securityHeaders.js';

export const ADMIN_COOKIE = 'tb_admin';
export const ADMIN_SESSION_IDLE_MS = 30 * 60_000;
export const ADMIN_SESSION_MAX_MS = 8 * 60 * 60_000;

export interface AdminSession {
  /** Who signed in: the name typed at sign-in (the password is shared, so this is a label, not proof). */
  name: string;
  ip: string;
  createdAt: number;
  lastSeen: number;
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export class AdminSessions {
  private byHash = new Map<string, AdminSession>();

  constructor(private now: () => number = Date.now) {}

  create(name: string, ip: string): string {
    this.prune();
    const raw = crypto.randomBytes(32).toString('base64url');
    const t = this.now();
    this.byHash.set(sha256(raw), { name, ip, createdAt: t, lastSeen: t });
    return raw;
  }

  /** The session for a cookie value, sliding its idle timer. Undefined when missing or expired. */
  check(raw: string | undefined): AdminSession | undefined {
    if (!raw || raw.length > 100) return undefined;
    const h = sha256(raw);
    const s = this.byHash.get(h);
    if (!s) return undefined;
    const t = this.now();
    if (t - s.lastSeen > ADMIN_SESSION_IDLE_MS || t - s.createdAt > ADMIN_SESSION_MAX_MS) {
      this.byHash.delete(h);
      return undefined;
    }
    s.lastSeen = t;
    return s;
  }

  expiresAt(s: AdminSession): number {
    return Math.min(s.lastSeen + ADMIN_SESSION_IDLE_MS, s.createdAt + ADMIN_SESSION_MAX_MS);
  }

  revoke(raw: string | undefined) {
    if (raw) this.byHash.delete(sha256(raw));
  }

  private prune() {
    const t = this.now();
    for (const [h, s] of this.byHash) if (t - s.lastSeen > ADMIN_SESSION_IDLE_MS || t - s.createdAt > ADMIN_SESSION_MAX_MS) this.byHash.delete(h);
  }
}

export function adminCookieOf(req: IncomingMessage): string | undefined {
  return parseCookies(req.headers.cookie)[ADMIN_COOKIE];
}

/** httpOnly, SameSite=Strict, only sent to `/api/admin`. `value` empty clears it. */
export function adminCookie(req: IncomingMessage, value: string, mode: CookieSecure = 'auto'): string {
  const secure = mode === 'auto' ? requestIsHttps(req) : mode;
  const maxAge = value ? Math.floor(ADMIN_SESSION_MAX_MS / 1000) : 0;
  return [`${ADMIN_COOKIE}=${value}`, 'Path=/api/admin', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`, secure ? 'Secure' : ''].filter(Boolean).join('; ');
}
