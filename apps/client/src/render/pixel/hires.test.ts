import { describe, expect, it } from 'vitest';
import type { Appearance } from '@tudobem/shared';
import { HIRES, avatarDrawScale, setAvatarZoom } from './characters';
import { hiresEnabled } from './hires';
import { lookDrawScale, lookForAppearance, lookForAvatarHires, lookHeadLift, lookKey, useHires } from './looks';

const base: Appearance = { body: 'medio', skin: 2, hair: 'curto', hairColor: 1, top: 'camiseta', topColor: 3, bottom: 'calca', bottomColor: 4, shoes: 0 };

describe('option-4 players (32x64 sheet)', () => {
  it('is the one option-4 sheet, whatever the creator picked', () => {
    const l = lookForAvatarHires(base);
    expect(l.hires).toBe(true);
    expect(l.layers).toEqual([{ key: HIRES.layers.player }]);
    expect(lookKey(lookForAvatarHires({ ...base, skin: 5, hairColor: 3 }))).toBe(lookKey(l));
    expect(lookKey(l)).not.toBe(lookKey(lookForAppearance(base)));
  });

  it('draws at half the avatar scale, so a player keeps the same size in the world', () => {
    for (const z of [2, 3, 4, 6]) {
      setAvatarZoom(z);
      expect(lookDrawScale(lookForAvatarHires(base))).toBe(avatarDrawScale() / 2);
      expect(lookDrawScale(lookForAppearance(base))).toBe(avatarDrawScale());
    }
    // at the common desktop zoom (3) one hi-res art px is a whole 2x2 block of device px
    setAvatarZoom(3);
    expect(lookDrawScale(lookForAvatarHires(base)) * 3).toBe(2);
    expect(lookHeadLift(lookForAvatarHires(base))).toBe(0);
  });

  it('keeps hats and the gi on the 16x32 sheets for now', () => {
    expect(useHires({ hat: null })).toBe(true);
    expect(useHires({ hat: 'bone_verde' })).toBe(false);
    expect(useHires({ hat: null, gi: true })).toBe(false);
    expect(useHires({ hat: null, academyGi: { color: 0, stamp: 'x' } as never })).toBe(false);
  });

  it('is on by default and ?hires=0 turns it off', () => {
    expect(hiresEnabled('')).toBe(true);
    expect(hiresEnabled('?solo')).toBe(true);
    expect(hiresEnabled('?hires=0')).toBe(false);
  });
});
