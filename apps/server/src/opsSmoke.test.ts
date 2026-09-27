import { afterEach, describe, expect, it } from 'vitest';
import { OPS_SMOKE_EMAIL } from '@tudobem/shared';
import { OPS_SMOKE_DEV_PASSWORD, readOpsSmokeConfig } from './opsSmoke.js';

describe('readOpsSmokeConfig', () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function snap(keys: string[]) {
    for (const k of keys) prev[k] = process.env[k];
  }

  it('is off unless TB_OPS_SMOKE=1', () => {
    snap(['TB_OPS_SMOKE', 'TB_OPS_SMOKE_PASSWORD', 'NODE_ENV']);
    delete process.env.TB_OPS_SMOKE;
    expect(readOpsSmokeConfig()).toEqual({ enabled: false, ready: false, email: OPS_SMOKE_EMAIL });
  });

  it('uses TB_OPS_SMOKE_PASSWORD when set', () => {
    snap(['TB_OPS_SMOKE', 'TB_OPS_SMOKE_PASSWORD', 'NODE_ENV']);
    process.env.TB_OPS_SMOKE = '1';
    process.env.TB_OPS_SMOKE_PASSWORD = 'fly-ops-smoke-secret-1';
    expect(readOpsSmokeConfig()).toEqual({
      enabled: true,
      ready: true,
      email: OPS_SMOKE_EMAIL,
      password: 'fly-ops-smoke-secret-1',
    });
  });

  it('refuses production without a password', () => {
    snap(['TB_OPS_SMOKE', 'TB_OPS_SMOKE_PASSWORD', 'NODE_ENV']);
    process.env.TB_OPS_SMOKE = '1';
    process.env.NODE_ENV = 'production';
    delete process.env.TB_OPS_SMOKE_PASSWORD;
    expect(readOpsSmokeConfig().ready).toBe(false);
  });

  it('allows the documented dev default when smoke is on locally', () => {
    snap(['TB_OPS_SMOKE', 'TB_OPS_SMOKE_PASSWORD', 'NODE_ENV']);
    process.env.TB_OPS_SMOKE = '1';
    process.env.NODE_ENV = 'development';
    delete process.env.TB_OPS_SMOKE_PASSWORD;
    expect(readOpsSmokeConfig()).toMatchObject({ ready: true, password: OPS_SMOKE_DEV_PASSWORD });
  });
});
