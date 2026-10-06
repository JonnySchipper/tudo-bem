import { describe, expect, it } from 'vitest';
import { ALL_HATS } from '@tudobem/shared';
import { CUT_ABOVE_FEET, applyBodyHeight, frameBottoms, type Geometry } from './bodytype';
import { HAT_LIFT, hatLayer } from './characters';

// one 4x10 frame; row y holds the marker value y in its red channel (opaque) for y in 2..9, so shifts are easy to read
const g: Geometry = { frameW: 4, frameH: 10, cols: 1, rows: 1 };
const frame = () => {
  const d = new Uint8ClampedArray(4 * 10 * 4);
  for (let y = 2; y < 10; y++) for (let x = 0; x < 4; x++) d.set([y * 10, 0, 0, 255], (y * 4 + x) * 4);
  return d;
};
const rowsOf = (d: Uint8ClampedArray) => Array.from({ length: 10 }, (_, y) => (d[(y * 4) * 4 + 3] ? d[y * 4 * 4] / 10 : -1));

describe('body height (esguio taller, forte shorter)', () => {
  const bottoms = frameBottoms(frame(), g);

  it('finds the feet row', () => expect(bottoms[0]).toBe(9));

  it('medio returns the input unchanged', () => {
    const f = frame();
    expect(applyBodyHeight(f, g, bottoms, 'medio')).toBe(f);
  });

  it('esguio duplicates the torso row and lifts everything above it; the feet stay', () => {
    const cut = 9 - CUT_ABOVE_FEET; // 3
    const out = rowsOf(applyBodyHeight(frame(), g, bottoms, 'esguio'));
    expect(out[1]).toBe(2); // the head row rose by one
    expect(out[cut - 1]).toBe(cut);
    expect(out[cut]).toBe(cut); // duplicated
    expect(out[9]).toBe(9);
  });

  it('forte removes the torso row and lowers everything above it; the feet stay', () => {
    const cut = 9 - CUT_ABOVE_FEET;
    const out = rowsOf(applyBodyHeight(frame(), g, bottoms, 'forte'));
    expect(out[3]).toBe(2); // the head row sank by one
    expect(out[0]).toBe(-1);
    expect(out[cut + 1]).toBe(cut + 1);
    expect(out[9]).toBe(9);
  });

  it('does not modify its input', () => {
    const f = frame();
    const copy = new Uint8ClampedArray(f);
    applyBodyHeight(f, g, bottoms, 'esguio');
    expect(f).toEqual(copy);
  });
});

describe('hat lift', () => {
  it('every catalog hat has a lift for its layer', () => {
    for (const h of ALL_HATS) expect(HAT_LIFT[hatLayer(h.id) as string], h.id).toBeGreaterThanOrEqual(0);
  });
});
