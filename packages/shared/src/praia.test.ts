import { describe, expect, it } from 'vitest';
import { normalizePraiaConfig, PRAIA_DEFAULT, praiaAllows } from './praia.js';

const NOW = 1_800_000_000_000;
const active = { status: 'active' as const, currentPeriodEnd: NOW + 86_400_000 };
const lapsed = { status: 'expired' as const, currentPeriodEnd: NOW - 1 };

describe('the Praia switch (PRAIA-PLAN.md 1.2)', () => {
  it('opens to everyone by default (the beta is free)', () => {
    expect(PRAIA_DEFAULT).toEqual({ mode: 'open', partyBoat: true });
    expect(praiaAllows(PRAIA_DEFAULT, null, NOW)).toBe(true);
  });

  it('preview lets only an active subscription in early; closed lets nobody in', () => {
    const preview = { mode: 'preview' as const, partyBoat: true };
    expect(praiaAllows(preview, null, NOW)).toBe(false);
    expect(praiaAllows(preview, lapsed, NOW)).toBe(false);
    expect(praiaAllows(preview, active, NOW)).toBe(true);
    const closed = { mode: 'closed' as const, partyBoat: true };
    expect(praiaAllows(closed, active, NOW)).toBe(false);
    expect(praiaAllows(closed, null, NOW)).toBe(false);
  });

  it('a stored blob is read back safely', () => {
    expect(normalizePraiaConfig(null)).toEqual(PRAIA_DEFAULT);
    expect(normalizePraiaConfig({ mode: 'nope', partyBoat: 'yes', extra: 1 })).toEqual(PRAIA_DEFAULT);
    expect(normalizePraiaConfig({ mode: 'closed', partyBoat: false })).toEqual({ mode: 'closed', partyBoat: false });
  });
});
