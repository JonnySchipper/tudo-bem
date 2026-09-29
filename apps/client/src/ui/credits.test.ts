import { describe, expect, it } from 'vitest';
import { CREDITS, LIMEZU_URL } from './creditsData';

describe('credits data', () => {
  it('carries the LimeZu credit with a real link (license requirement)', () => {
    const art = CREDITS.find((c) => c.id === 'art');
    expect(art?.who).toBe('LimeZu');
    expect(art?.link?.href).toBe(LIMEZU_URL);
    expect(LIMEZU_URL).toBe('https://limezu.itch.io/');
    expect(art?.link?.label).toContain('limezu.itch.io');
  });

  it('every line has PT and EN roles and unique ids; every link is https', () => {
    expect(new Set(CREDITS.map((c) => c.id)).size).toBe(CREDITS.length);
    for (const c of CREDITS) {
      expect(c.role.pt && c.role.en, c.id).toBeTruthy();
      if (c.link) expect(c.link.href.startsWith('https://'), c.id).toBe(true);
    }
  });

  it('lists the voices, fonts and world engine', () => {
    const ids = CREDITS.map((c) => c.id);
    for (const id of ['voices', 'fonts', 'engine']) expect(ids).toContain(id);
  });
});
