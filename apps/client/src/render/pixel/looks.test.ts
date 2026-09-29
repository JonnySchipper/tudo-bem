import { describe, expect, it } from 'vitest';
import { CLOTH_COLORS, ROOMS, SKIN_TONES, type Appearance } from '@tudobem/shared';
import { lookForAppearance, lookForNpc, lookKey } from './looks';

const base: Appearance = { body: 'medio', skin: 2, hair: 'curto', hairColor: 1, top: 'camiseta', topColor: 3, bottom: 'calca', bottomColor: 4, shoes: 0 };

describe('looks (one base sheet, recolored)', () => {
  it('skin, hair and cloth colors come from the appearance indices', () => {
    const l = lookForAppearance(base);
    expect(l.skin).toBe(SKIN_TONES[2]);
    expect(l.top).toBe(CLOTH_COLORS[3]);
    expect(l.body).toBe('body_medio');
  });

  it('out-of-range or missing indices fall back instead of throwing', () => {
    const l = lookForAppearance({ ...base, skin: 99, topColor: -1, hairColor: Number.NaN });
    expect(l.skin).toBe(SKIN_TONES[0]);
    expect(l.top).toBe(CLOTH_COLORS[0]);
  });

  it('two looks with the same colors share a cache key; a different skin does not', () => {
    expect(lookKey(lookForAppearance(base))).toBe(lookKey(lookForAppearance({ ...base })));
    expect(lookKey(lookForAppearance(base))).not.toBe(lookKey(lookForAppearance({ ...base, skin: 5 })));
  });

  it('NPCs get their own outfit and hair layers', () => {
    const carlos = ROOMS.padaria.npcs[0];
    const l = lookForNpc(carlos.id, carlos.appearance);
    expect(l.outfit).not.toBe('outfit_o01');
    expect(lookKey(l)).not.toBe(lookKey(lookForAppearance(carlos.appearance)));
  });
});
