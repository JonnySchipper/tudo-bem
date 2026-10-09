import { describe, expect, it } from 'vitest';
import { PARROT_COLORS } from '@tudobem/shared';
import { PARROT_FRAME_COUNT, PARROT_H, PARROT_W, parrotPixels, parrotRows, parrotSpecies, type ParrotSpecies } from './parrotSpecies';

const SPECIES: ParrotSpecies[] = ['verde', 'azul', 'canarinho', 'vermelha', 'periquito'];

const alphaMask = (px: Uint8ClampedArray) => Array.from({ length: PARROT_W * PARROT_H }, (_, i) => (px[i * 4 + 3] ? 1 : 0)).join('');
const isOutline = (px: Uint8ClampedArray, i: number) => px[i + 3] && px[i] === 0x3a && px[i + 1] === 0x3a && px[i + 2] === 0x50;
const colours = (px: Uint8ClampedArray) => {
  const out = new Set<number>();
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]) out.add((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
  return out;
};

describe('shoulder bird species', () => {
  it('maps every poleiro colour on sale to its own bird, old and new ids alike', () => {
    const birds = PARROT_COLORS.map((c) => parrotSpecies(c.id));
    expect(new Set(birds).size).toBe(PARROT_COLORS.length);
    expect(parrotSpecies('verde')).toBe('verde');
    expect(parrotSpecies('amarelo')).toBe('canarinho');
    expect(parrotSpecies('vermelho')).toBe('vermelha');
    expect(parrotSpecies('laranja')).toBe('periquito');
    for (const s of SPECIES) expect(parrotSpecies(s)).toBe(s);
    expect(parrotSpecies(null)).toBe('verde');
    expect(parrotSpecies('nope')).toBe('verde');
  });

  it('authors 4 frames of 8 x 10 with a palette entry for every pixel', () => {
    for (const s of SPECIES) {
      for (let f = 0; f < PARROT_FRAME_COUNT; f++) {
        const rows = parrotRows(s, f);
        expect(rows, `${s}:${f}`).toHaveLength(PARROT_H);
        for (const r of rows) expect(r, `${s}:${f}`).toHaveLength(PARROT_W);
        expect(() => parrotPixels(s, f)).not.toThrow();
      }
      // the idle animates: not every frame is the same picture
      expect(new Set([0, 1, 2, 3].map((f) => parrotRows(s, f).join('/'))).size, s).toBeGreaterThan(2);
    }
  });

  it('keeps the navy outline and the bottom anchor row the renderers rely on', () => {
    for (const s of SPECIES) {
      const px = parrotPixels(s, 0);
      expect(colours(px).has(0x3a3a50), s).toBe(true);
      // something sits on the anchor row, so the bird rests on the shoulder like the poleiro parrot
      expect(alphaMask(px).slice(-PARROT_W), s).toContain('1');
    }
  });

  it('gives each bird its own silhouette or markings, not just a hue', () => {
    for (let a = 0; a < SPECIES.length; a++) {
      for (let b = a + 1; b < SPECIES.length; b++) {
        const pa = parrotPixels(SPECIES[a]!, 0);
        const pb = parrotPixels(SPECIES[b]!, 0);
        let opaque = 0;
        let differ = 0;
        for (let i = 0; i < pa.length; i += 4) {
          if (!pa[i + 3] && !pb[i + 3]) continue;
          if (isOutline(pa, i) && isOutline(pb, i)) continue;
          opaque++;
          if (pa[i + 3] !== pb[i + 3] || pa[i] !== pb[i] || pa[i + 1] !== pb[i + 1] || pa[i + 2] !== pb[i + 2]) differ++;
        }
        // well over half of the painted bird changes: shape, face, beak, wing and tail, not one body ramp
        expect(differ / opaque, `${SPECIES[a]} vs ${SPECIES[b]}`).toBeGreaterThan(0.6);
      }
    }
  });
});
