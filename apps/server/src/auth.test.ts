import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OPS_SMOKE_EMAIL } from '@tudobem/shared';
import { AccountStore, AttemptLimiter, accountsFileAdapter, hashPassword, parseCookies, verifyPassword, type ScryptParams } from './auth.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';

/** Cheap params keep the suite fast; production uses SCRYPT_DEFAULT. */
const FAST: ScryptParams = { N: 1024, r: 8, p: 1 };

describe('password hashing', () => {
  it('stores a salted scrypt hash, never the password, and verifies it', async () => {
    const a = await hashPassword('pao-de-queijo-42', FAST);
    const b = await hashPassword('pao-de-queijo-42', FAST);
    expect(a).toMatch(/^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(a).not.toContain('pao-de-queijo');
    expect(a).not.toBe(b);
    expect(await verifyPassword('pao-de-queijo-42', a)).toBe(true);
    expect(await verifyPassword('pao-de-queijo-43', a)).toBe(false);
    expect(await verifyPassword('pao-de-queijo-42', 'plaintext')).toBe(false);
  });

  it('uses the production cost by default', async () => {
    expect(await hashPassword('cafezinho!')).toMatch(/^scrypt\$16384\$8\$5\$/);
  });
});

describe('AccountStore', () => {
  let dir = '';
  afterEach(() => {
    if (dir) {
      closeDatabase(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    }
    dir = '';
  });

  it('registers, rejects duplicates and bad input, and logs in case-insensitively', async () => {
    const store = new AccountStore(null, { scrypt: FAST });
    expect(await store.register('nope', 'senha-boa-123', true)).toMatchObject({ ok: false, code: 'email' });
    expect(await store.register('ana@exemplo.com', 'curta', true)).toMatchObject({ ok: false, code: 'password' });
    const r = await store.register('  Ana@Exemplo.com ', 'senha-boa-123', true);
    expect(r).toMatchObject({ ok: true, account: { email: 'ana@exemplo.com' } });
    expect(await store.register('ana@exemplo.com', 'outra-senha-9', true)).toMatchObject({ ok: false, code: 'taken' });
    expect(await store.login('ANA@exemplo.com', 'senha-boa-123')).toMatchObject({ ok: true });
    expect(await store.login('ana@exemplo.com', 'errada-123')).toMatchObject({ ok: false, code: 'credentials' });
    expect(await store.login('ninguem@exemplo.com', 'senha-boa-123')).toMatchObject({ ok: false, code: 'credentials' });
    if (r.ok) expect(r.account.confirmed18At).toBeGreaterThan(0);
    // The 18+ tick is optional: an unticked signup still works and simply isn't marked.
    const quiet = await store.register('leo@exemplo.com', 'senha-boa-123', false);
    expect(quiet).toMatchObject({ ok: true });
    if (quiet.ok) expect(quiet.account.confirmed18At).toBeUndefined();
  });

  it('persists accounts + hashed sessions to disk and survives a restart', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-auth-'));
    const a = new AccountStore(accountsFileAdapter(dir), { scrypt: FAST });
    const r = await a.register('bia@exemplo.com', 'coxinha-quente', true);
    if (!r.ok) throw new Error('register failed');
    const cookie = a.createSession(r.account.id);
    a.linkProfile(r.account.id, 'p-123');
    const db = openDatabase(dir);
    const raw = [...(db.prepare('SELECT json FROM accounts').all() as { json: string }[]), ...(db.prepare('SELECT json FROM sessions').all() as { json: string }[])].map((r) => r.json).join('\n');
    expect(raw).not.toContain('coxinha-quente');
    expect(raw).not.toContain(cookie);
    expect(raw).toContain('scrypt$');

    const b = new AccountStore(accountsFileAdapter(dir), { scrypt: FAST });
    expect(b.accountForSession(cookie)?.email).toBe('bia@exemplo.com');
    expect(b.profileIdFor(r.account.id)).toBe('p-123');
    expect(await b.login('bia@exemplo.com', 'coxinha-quente')).toMatchObject({ ok: true });
  });

  it('ensures the Ops smoke account idempotently and rotates the hash when the password changes', async () => {
    const store = new AccountStore(null, { scrypt: FAST });
    const pw1 = 'smoke-password-1';
    const a = await store.ensureSmokeAccount(OPS_SMOKE_EMAIL, pw1);
    expect(a.email).toBe(OPS_SMOKE_EMAIL);
    const again = await store.ensureSmokeAccount(OPS_SMOKE_EMAIL, pw1);
    expect(again.id).toBe(a.id);
    const pw2 = 'smoke-password-2';
    await store.ensureSmokeAccount(OPS_SMOKE_EMAIL, pw2);
    expect(await store.login(OPS_SMOKE_EMAIL, pw2)).toMatchObject({ ok: true });
    expect(await store.login(OPS_SMOKE_EMAIL, pw1)).toMatchObject({ ok: false, code: 'credentials' });
  });

  it('signs in with Google, links an existing email account, and rejects conflicting subs', async () => {
    const store = new AccountStore(null, { scrypt: FAST });
    const g1 = await store.loginWithGoogle({ sub: 'google-sub-1', email: 'ana@exemplo.com', emailVerified: true });
    expect(g1).toMatchObject({ ok: true, account: { email: 'ana@exemplo.com', googleSub: 'google-sub-1' } });
    const again = await store.loginWithGoogle({ sub: 'google-sub-1', email: 'ana@exemplo.com', emailVerified: true });
    expect(again.ok && again.account.id).toBe(g1.ok && g1.account.id);

    const pw = await store.register('leo@exemplo.com', 'senha-boa-123', false);
    expect(pw.ok).toBe(true);
    const link = await store.loginWithGoogle({ sub: 'google-sub-2', email: 'leo@exemplo.com', emailVerified: true });
    expect(link).toMatchObject({ ok: true });
    if (link.ok) expect(link.account.googleSub).toBe('google-sub-2');

    if (pw.ok) {
      pw.account.googleSub = 'other-sub';
      const clash = await store.loginWithGoogle({ sub: 'google-sub-3', email: 'leo@exemplo.com', emailVerified: true });
      expect(clash).toMatchObject({ ok: false, code: 'google' });
    }
  });

  it('expires sessions, slides active ones, and revokes on logout', async () => {
    let t = 1_000_000;
    const day = 24 * 60 * 60_000;
    const store = new AccountStore(null, { scrypt: FAST, now: () => t, sessionTtlMs: 30 * day });
    const r = await store.register('leo@exemplo.com', 'guarana-gelado', true);
    if (!r.ok) throw new Error('register failed');
    const c1 = store.createSession(r.account.id);
    t += 20 * day;
    expect(store.accountForSession(c1)).toBeTruthy();
    t += 20 * day;
    expect(store.accountForSession(c1)).toBeTruthy();
    t += 31 * day;
    expect(store.accountForSession(c1)).toBeUndefined();

    const c2 = store.createSession(r.account.id);
    expect(store.revokeSession(c2)?.id).toBe(r.account.id);
    expect(store.accountForSession(c2)).toBeUndefined();
    expect(store.accountForSession('forged')).toBeUndefined();
  });
});

describe('helpers', () => {
  it('limits repeated failures in a sliding window', () => {
    let t = 0;
    const lim = new AttemptLimiter(3, 1000, () => t);
    lim.hit('k');
    lim.hit('k');
    expect(lim.blocked('k')).toBe(false);
    lim.hit('k');
    expect(lim.blocked('k')).toBe(true);
    t += 1001;
    expect(lim.blocked('k')).toBe(false);
  });

  it('parses cookies and ignores malformed ones', () => {
    expect(parseCookies('a=1; tb_session=abc%2Fdef; bad=%E0%A4%A')).toEqual({ a: '1', tb_session: 'abc/def' });
    expect(parseCookies(undefined)).toEqual({});
  });
});
