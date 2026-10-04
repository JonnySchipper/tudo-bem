import { describe, expect, it } from 'vitest';
import { FILM } from './diary.js';
import { normalizeArrival } from './diary.js';
import { CATCHUP_GRANTS, claimGrant, handCamera, owedGrants, type GrantProfile } from './grants.js';

const home = (over: Partial<GrantProfile> = {}): GrantProfile => ({ arrivalIntroDone: true, hasCamera: false, film: 0, ...over });

describe('catch-up grants', () => {
  it('offers the camera to someone who already lives here and never received one', () => {
    const oldSave = normalizeArrival(undefined);
    expect(owedGrants(oldSave).map((g) => g.id)).toEqual(['camera']);
    expect(owedGrants(home()).map((g) => g.id)).toEqual(['camera']);
  });

  it('leaves a brand-new arrival on the plane intro, and skips anyone who already has the camera', () => {
    expect(owedGrants(normalizeArrival({ arrivalIntroDone: false, hasCamera: false }))).toEqual([]);
    expect(owedGrants(home({ hasCamera: true }))).toEqual([]);
    expect(owedGrants(null)).toEqual([]);
  });

  it('hands the camera over once, with starter film, and caps the roll', () => {
    const p = home({ film: 4 });
    const got = claimGrant(p, 'camera');
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.notice.pt).toMatch(/câmera/);
    expect(p).toMatchObject({ hasCamera: true, film: 4 + FILM.starter });
    expect(claimGrant(p, 'camera')).toEqual({ ok: false, reason: 'have' });
    expect(p.film).toBe(4 + FILM.starter);

    const full = home({ film: 98 });
    handCamera(full);
    expect(full.film).toBe(99);
    handCamera(full);
    expect(full.film).toBe(99);
  });

  it('refuses an unknown feature and a camera the arrival has not finished yet', () => {
    const fresh: GrantProfile = { arrivalIntroDone: false, hasCamera: false, film: 0 };
    expect(claimGrant(fresh, 'camera')).toEqual({ ok: false, reason: 'have' });
    expect(fresh.hasCamera).toBe(false);
    expect(claimGrant(home(), 'teleporte')).toEqual({ ok: false, reason: 'unknown' });
  });

  it('keeps grant ids unique so a new feature is one row', () => {
    expect(new Set(CATCHUP_GRANTS.map((g) => g.id)).size).toBe(CATCHUP_GRANTS.length);
    for (const g of CATCHUP_GRANTS) {
      expect(g.title.pt.length).toBeGreaterThan(0);
      expect(g.title.en.length).toBeGreaterThan(0);
      expect(g.accept.pt.length).toBeGreaterThan(0);
      expect(g.later.en.length).toBeGreaterThan(0);
    }
  });
});
