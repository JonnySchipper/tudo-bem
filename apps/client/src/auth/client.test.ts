import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { hasServerSession, signIn, signUp } from './client';
import { AUTH_SESSION_KEY, clearAuthSession } from './session';

function mockStorage() {
  const bag = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => bag.set(k, v),
    removeItem: (k: string) => bag.delete(k),
    clear: () => bag.clear(),
  });
}

describe('auth client scaffold', () => {
  beforeEach(() => mockStorage());
  afterEach(() => vi.unstubAllGlobals());

  it('rejects short passwords before network', async () => {
    const r = await signIn({ email: 'a@b.com', password: 'short' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('password');
  });

  it('falls back to stub when auth API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const r = await signUp({ email: 'bia@example.com', password: 'senha1234' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.session.stub).toBe(true);
      expect(r.session.email).toBe('bia@example.com');
    }
    const stored = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)!);
    expect(stored.email).toBe('bia@example.com');
    clearAuthSession();
  });

  it('sends the optional 18+ tick with register', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, account: { email: 'leo@example.com', hasProfile: false } }), { status: 201, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await signUp({ email: 'leo@example.com', password: 'senha1234' }, true);
    await signUp({ email: 'leo2@example.com', password: 'senha1234' });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ email: 'leo@example.com', confirm18: true });
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toMatchObject({ confirm18: false });
    clearAuthSession();
  });

  it('only counts a JSON { ok, account } from /api/auth/me as a live session', async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ok: true, account: { email: 'a@b.com', hasProfile: true } })));
    expect(await hasServerSession()).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ok: false, code: 'unauthenticated' })));
    expect(await hasServerSession()).toBe(false);
    // Static hosts answer every path with index.html.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    expect(await hasServerSession()).toBe(false);
  });
});
