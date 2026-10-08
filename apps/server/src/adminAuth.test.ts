import { describe, expect, it } from 'vitest';
import { ADMIN_DEV_PASSWORD, adminPasswordMatches, readAdminAuthConfig } from './adminAuth.js';

describe('adminPasswordMatches', () => {
  it('accepts the expected secret and rejects typos in constant time', () => {
    expect(adminPasswordMatches('super-secret-admin', 'super-secret-admin')).toBe(true);
    expect(adminPasswordMatches('super-secret-admi', 'super-secret-admin')).toBe(false);
    expect(adminPasswordMatches('', 'super-secret-admin')).toBe(false);
  });
});

describe('readAdminAuthConfig', () => {
  it('uses TB_ADMIN_PASSWORD when valid', () => {
    const cfg = readAdminAuthConfig({ TB_ADMIN_PASSWORD: 'super-secret-admin' });
    expect(cfg).toEqual({ ready: true, password: 'super-secret-admin' });
  });

  it('rejects a too-short env password', () => {
    expect(readAdminAuthConfig({ TB_ADMIN_PASSWORD: 'short' })).toEqual({ ready: false });
  });

  it('is off in production without an env password', () => {
    expect(readAdminAuthConfig({ NODE_ENV: 'production' })).toEqual({ ready: false });
  });

  it('falls back to the local default outside production', () => {
    expect(readAdminAuthConfig({ NODE_ENV: 'test' })).toEqual({ ready: true, password: ADMIN_DEV_PASSWORD });
    expect(readAdminAuthConfig({})).toEqual({ ready: true, password: ADMIN_DEV_PASSWORD });
  });
});
