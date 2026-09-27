import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { signIn, signUp } from './client';
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
});
