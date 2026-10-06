import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BODY_TYPES, BOTTOM_STYLES, EXTRA_STYLES, FACE_STYLES, HAIR_STYLES, HATS, IDLE_POSES, TOP_STYLES } from '@tudobem/shared';
import { T } from './coords';
import { AVATAR_HEAD_LIFT, AVATAR_HEAD_SIT_LIFT, CHAR_LAYERS, OUTFITS, allLayerKeys, avatarCrown, avatarDrawScale, avatarPx, avatarScaleFor, hatLayer, outfitKey, pick, setAvatarZoom } from './characters';

const manifest = JSON.parse(readFileSync(new URL('../../../public/pixel/manifest.json', import.meta.url), 'utf8')) as { chars: Record<string, string> };

describe('avatar draw scale', () => {
  it('draws people about 1.4x, on whole device pixels at every camera zoom', () => {
    expect([2, 3, 4, 5, 6].map(avatarScaleFor)).toEqual([3 / 2, 4 / 3, 6 / 4, 7 / 5, 8 / 6]);
    for (const z of [1, 2, 3, 4, 5, 6, 8]) {
      const s = avatarScaleFor(z);
      expect(Number.isInteger(Math.round(s * z * 1e9) / 1e9), `zoom ${z}`).toBe(true);
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(1.5);
    }
  });

  it('follows the camera zoom; crowns, hats and the sit pose scale with it, feet stay at the origin', () => {
    // the unscaled crown sits only a few pixels over a floor tile, in the same band as a chair
    expect(AVATAR_HEAD_LIFT).toBeGreaterThan(T);
    expect(AVATAR_HEAD_LIFT - T).toBeLessThan(T / 2);
    setAvatarZoom(3);
    expect(avatarDrawScale()).toBeCloseTo(4 / 3);
    const standing = avatarCrown(false);
    expect(standing).toBeCloseTo((AVATAR_HEAD_LIFT * 4) / 3);
    // taller than a chair, under two tiles: outfits read without the chibi heads turning chunky
    expect(standing).toBeGreaterThan(T * 1.75);
    expect(standing).toBeLessThan(T * 2);
    expect(avatarCrown(false, 5) - standing).toBeCloseTo(avatarPx(5));
    expect(avatarCrown(true)).toBeCloseTo((AVATAR_HEAD_SIT_LIFT * 4) / 3);
    setAvatarZoom(2);
    expect(avatarCrown(false)).toBeCloseTo(AVATAR_HEAD_LIFT * 1.5);
    setAvatarZoom(3);
  });
});

describe('CHAR_LAYERS covers every creator option', () => {
  it('has an entry for every enum value', () => {
    for (const b of BODY_TYPES) expect(CHAR_LAYERS.body[b], `body ${b}`).toBeTruthy();
    for (const h of HAIR_STYLES) expect(CHAR_LAYERS.hair[h], `hair ${h}`).toBeTruthy();
    for (const f of FACE_STYLES) expect(CHAR_LAYERS.face[f], `face ${f}`).toBeTruthy();
    for (const e of EXTRA_STYLES) expect(e in CHAR_LAYERS.extra, `extra ${e}`).toBe(true);
    for (const i of IDLE_POSES) expect(CHAR_LAYERS.idle[i], `idle ${i}`).toBeTruthy();
    expect(Object.keys(CHAR_LAYERS.hair).sort()).toEqual([...HAIR_STYLES].sort());
    expect(Object.keys(CHAR_LAYERS.idle).sort()).toEqual([...IDLE_POSES].sort());
  });

  it('every top x bottom combination resolves to its own outfit at every body type', () => {
    const seen = new Set<string>();
    for (const t of TOP_STYLES) {
      for (const b of BOTTOM_STYLES) {
        const entry = OUTFITS[t][b];
        expect(entry, `${t}/${b}`).toBeTruthy();
        expect(entry.ramps).toEqual(['top', 'bottom', 'shoes']);
        expect(entry.source).toMatch(/^Outfit_\d\d$/);
        for (const body of BODY_TYPES) {
          const key = outfitKey(t, b, body);
          expect(manifest.chars[key], `${key} in the manifest`).toBeTruthy();
          seen.add(key);
        }
      }
    }
    expect(seen.size).toBe(TOP_STYLES.length * BOTTOM_STYLES.length * BODY_TYPES.length);
  });

  it('documents which combinations edit the source outfit', () => {
    expect(OUTFITS.camiseta.calca.edit).toBe('none');
    expect(OUTFITS.camiseta.bermuda.edit).toBe('shorts');
    expect(OUTFITS.camisa.saia.edit).toBe('skirt');
    expect(OUTFITS.regata.calca.edit).toBe('tank');
    expect(OUTFITS.regata.saia.edit).toBe('tank+skirt');
  });

  it('every hat in the catalog has a layer, and every layer key exists in the manifest', () => {
    for (const h of HATS) expect(hatLayer(h.id), h.id).toBeTruthy();
    expect(HATS).toHaveLength(11);
    expect(HATS.some((h) => h.id === 'chapeu_chef')).toBe(false);
    expect(hatLayer('chapeu_chef')).toBe('hat_chapeu_chef');
    expect(hatLayer('chapeu_padeiro_casa')).toBe('hat_chapeu_chef');
    for (const key of allLayerKeys()) expect(manifest.chars[key], `${key} in the manifest`).toBeTruthy();
  });

  it('an unknown value falls back to the closest style and logs once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pick(CHAR_LAYERS.hair, 'moicano', 'curto', 'hair')).toBe('hair_curto');
    expect(pick(CHAR_LAYERS.hair, 'moicano', 'curto', 'hair')).toBe('hair_curto');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(outfitKey('capa', 'kilt', 'forte')).toBe('outfit_camiseta_calca__forte');
    warn.mockRestore();
  });

  it('missing optional appearance fields fall back without logging', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(pick(CHAR_LAYERS.face, undefined, 'suave', 'face').eyes).toBe('eyes_suave');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
