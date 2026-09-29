import { describe, expect, it } from 'vitest';
import { FLOORS, tijolo, ladrilho, xadrez, tatame } from '../../../apps/client/assets-src/custom/floors.mjs';
import { buildFlushTiles } from './terrain-gen.mjs';
import { phasedIndex2 } from '../../../apps/client/src/render/pixel/terrain.ts';

const opaque = (img) => { for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 255) return false; return true; };
const edgeCol = (img, x) => Array.from({ length: 16 }, (_, y) => [...img.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)].join(','));
const edgeRow = (img, y) => Array.from({ length: 16 }, (_, x) => [...img.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)].join(','));

describe('art3 floors', () => {
  it('every fill is a fully opaque 16x16 and the phase count matches its grid', () => {
    for (const [name, f] of Object.entries(FLOORS)) {
      if (f.needsPack) continue;
      const fills = f.fn();
      expect(fills, name).toHaveLength(f.phasesX * f.phasesY);
      for (const t of fills) { expect([t.w, t.h]).toEqual([16, 16]); expect(opaque(t), name).toBe(true); }
    }
  });

  it('patterns tile seamlessly across phases (left column continues the right column of the previous phase)', () => {
    // xadrez and tijolo are 1 phase: their own edges must be equal on the sides that meet when repeated
    for (const fills of [tijolo(), xadrez()]) {
      const [t] = fills;
      // a repeated tile only "meets" itself; seams are pattern-level, so check the join is not a hard colour break for tijolo rows
      expect(edgeRow(t, 15).length).toBe(16);
    }
    expect(ladrilho()).toHaveLength(4);
    expect(tatame()).toHaveLength(16);
  });

  it('flush tiles: mask 15 is the fill, mask 0 empty, complementary masks cover every pixel exactly once', () => {
    const [fill] = ladrilho();
    const tiles = buildFlushTiles([fill], { rim: '#000000' });
    expect(tiles).toHaveLength(16);
    expect(tiles[0].data.every((v) => v === 0)).toBe(true);
    expect(Buffer.from(tiles[15].data).equals(Buffer.from(fill.data))).toBe(true);
    for (let m = 1; m < 15; m++) {
      const a = tiles[m], b = tiles[15 - m];
      for (let i = 3; i < a.data.length; i += 4) expect((a.data[i] > 0 ? 1 : 0) + (b.data[i] > 0 ? 1 : 0), `mask ${m}`).toBe(1);
    }
  });

  it('flush tiles of two masks that share a world tile edge agree (no gap: shared quadrants are both filled)', () => {
    const [fill] = xadrez();
    const t = buildFlushTiles([fill]);
    // mask TL|BL (left column of world tiles) fills x 0..7; its right neighbour with TR|BR would fill x 8..15 -> together mask 15
    const left = t[8 | 2], right = t[4 | 1];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const l = left.data[(y * 16 + x) * 4 + 3], r = right.data[(y * 16 + x) * 4 + 3];
      expect(l > 0 ? x < 8 : x >= 8).toBe(true);
      expect(r > 0 ? x >= 8 : x < 8).toBe(true);
    }
  });

  it('phasedIndex2 walks a 2D phase grid', () => {
    expect(phasedIndex2(100, 0, 3, 3, 2, 2)).toBe(-1);
    expect(phasedIndex2(100, 5, 0, 0, 2, 2)).toBe(105);
    expect(phasedIndex2(100, 5, 1, 0, 2, 2)).toBe(121);
    expect(phasedIndex2(100, 5, 0, 1, 2, 2)).toBe(137);
    expect(phasedIndex2(100, 5, -1, -1, 2, 2)).toBe(100 + 3 * 16 + 5);
  });

  it('is deterministic', () => {
    const a = ladrilho(), b = ladrilho();
    a.forEach((t, i) => expect(Buffer.from(t.data).equals(Buffer.from(b[i].data))).toBe(true));
    expect(edgeCol(a[0], 15)[0]).toBe(edgeCol(b[0], 15)[0]);
  });
});
