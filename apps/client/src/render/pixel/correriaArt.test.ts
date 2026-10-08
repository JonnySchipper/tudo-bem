import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MG_ITEMS } from '@tudobem/shared';
import { ART_SIZES, BAG_SPOT, BELL_SPOT, BOARD, BOARD_SHELF_TOP, BOARD_TOWER_X, HOPPER_NEXT, JUICER_SPOT, JUICE_GLASS_LEVELS, JUICE_GLASS_SPOT, JUICE_LINE_ROWS, JUICE_SPOUT, juiceGlassKey, juiceRows, CHAPA_SLOTS, CHAPA_SPOT, COFFEE_SPOT, ITEM_SCALE, ITEM_SPOTS, PLATE_SPOT, QUEUE_SPOTS, REGISTER_SPOT, TIPJAR_SPOT, allArtKeys, sizeOfKey, traySlot, TRAY_SPOT, type Spot } from './correriaArt';

const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../public/pixel/manifest.json'), 'utf8'));

describe('the Correria no Balcão art contract', () => {
  it('lists the keys of the contract: an item per shelf item, the pieces, their states and the steam', () => {
    const keys = allArtKeys();
    // + the juicer: 6 machine frames, 10 glass levels and the overflow, 3 orange sizes, the crate
    expect(keys).toHaveLength(MG_ITEMS.length + 5 + 5 + 5 + 2 + 4 + 5 + 4 + 6 + 11 + 3 + 1);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of MG_ITEMS) expect(keys).toContain(`balcao/item_${i.id}`);
    for (const k of ['balcao/tray', 'balcao/tray_full', 'balcao/bag', 'balcao/plate', 'balcao/register', 'balcao/chapa_burnt', 'balcao/coffee_pour_3', 'balcao/bell_1', 'balcao/tipjar_3', 'balcao/patience_0', 'fx/steam_3']) expect(keys).toContain(k);
    for (const k of ['balcao/juicer_idle', 'balcao/juicer_cut', 'balcao/juicer_peel', 'balcao/juice_glass_7', 'balcao/juice_glass_spill', 'balcao/orange_g', 'balcao/laranjas']) expect(keys).toContain(k);
  });

  it('every key is in the manifest at the contracted size and anchor (bottom-centre)', () => {
    const missing = allArtKeys().filter((k) => !manifest.sprites[k]);
    expect(missing).toEqual([]);
    for (const k of allArtKeys()) {
      const d = manifest.sprites[k];
      const want = sizeOfKey(k)!;
      expect(want, k).toBeTruthy();
      expect([d.w, d.h, d.ax, d.ay], k).toEqual(want);
    }
  });

  /** The art rectangle of a piece at a spot (anchor bottom-centre), at a scale. */
  const rect = (id: string, spot: Spot, [w, h, ax, ay]: [number, number, number, number], scale = 1) => ({ id, x0: spot.x - ax * scale, y0: spot.y - ay * scale, x1: spot.x - ax * scale + w * scale, y1: spot.y - ay * scale + h * scale });
  const pieces = () => [
    ...Object.entries(ITEM_SPOTS).map(([id, s]) => rect(id, s, ART_SIZES.item!, ITEM_SCALE)),
    rect('coffee', COFFEE_SPOT, ART_SIZES.coffee!),
    rect('juicer', JUICER_SPOT, ART_SIZES.juicer!),
    rect('chapa', CHAPA_SPOT, ART_SIZES.chapa!),
    rect('tray', TRAY_SPOT, ART_SIZES.tray!),
    rect('bag', BAG_SPOT, ART_SIZES.bag!),
    rect('plate', PLATE_SPOT, ART_SIZES.plate!),
    rect('register', REGISTER_SPOT, ART_SIZES.register!),
    rect('tipjar', TIPJAR_SPOT, ART_SIZES.tipjar!),
    rect('bell', BELL_SPOT, ART_SIZES.bell!),
  ];

  it('every piece stands on the board and NOTHING overlaps (labels included: 12 px under each item and the bag)', () => {
    expect(Object.keys(ITEM_SPOTS).sort()).toEqual(MG_ITEMS.map((i) => i.id).sort());
    const all = pieces();
    for (const r of all) {
      expect(r.x0, r.id).toBeGreaterThanOrEqual(BOARD.x0);
      expect(r.x1, r.id).toBeLessThanOrEqual(BOARD.x1);
      expect(r.y0, r.id).toBeGreaterThanOrEqual(BOARD.y0);
      expect(r.y1, r.id).toBeLessThanOrEqual(BOARD.y1 + 1);
      // only the station column rises over the shelf top
      if (r.y0 < BOARD_SHELF_TOP) expect(r.x0, r.id).toBeGreaterThanOrEqual(BOARD_TOWER_X);
    }
    // the label band under a labelled piece counts as part of it
    const labelled = new Set([...Object.keys(ITEM_SPOTS), 'bag', 'plate', 'coffee', 'bell', 'juicer']);
    const withLabel = all.map((r) => ({ ...r, y1: r.y1 + (labelled.has(r.id) ? 10 : 0) }));
    for (let i = 0; i < withLabel.length; i++)
      for (let j = i + 1; j < withLabel.length; j++) {
        const a = withLabel[i]!;
        const b = withLabel[j]!;
        const overlap = Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.y1, b.y1) > Math.max(a.y0, b.y0);
        expect(overlap, `${a.id} vs ${b.id}`).toBe(false);
      }
  });

  it('the shelf is a grid: four columns, three rows, even steps', () => {
    const xs = [...new Set(Object.values(ITEM_SPOTS).map((s) => s.x))].sort((p, q) => p - q);
    const ys = [...new Set(Object.values(ITEM_SPOTS).map((s) => s.y))].sort((p, q) => p - q);
    expect(xs).toHaveLength(4);
    expect(ys).toHaveLength(3);
    expect(new Set(xs.slice(1).map((x, i) => x - xs[i]!)).size).toBe(1);
    expect(new Set(ys.slice(1).map((y, i) => y - ys[i]!)).size).toBe(1);
  });

  it('the queue spots are on the floor below the board and the grill slots sit on the chapa', () => {
    for (const q of QUEUE_SPOTS) {
      expect(q.y).toBeGreaterThan(BOARD.y1 + 8);
      expect(q.y).toBeLessThanOrEqual(144);
      expect(q.x).toBeGreaterThan(0);
      expect(q.x).toBeLessThan(160);
    }
    expect(QUEUE_SPOTS).toHaveLength(3);
    expect(CHAPA_SLOTS).toHaveLength(2);
  });

  it('the juicer glass stands on its drip tray under the spout, and the line is a row of the glass', () => {
    const j = rect('juicer', JUICER_SPOT, ART_SIZES.juicer!);
    const g = rect('glass', JUICE_GLASS_SPOT, ART_SIZES.juice!);
    expect(g.x0).toBeGreaterThan(j.x0);
    expect(g.x1).toBeLessThan(j.x1);
    expect(g.y1).toBeLessThanOrEqual(j.y1);
    expect(g.y0).toBeGreaterThan(JUICE_SPOUT.y);
    expect(JUICE_SPOUT.x).toBe(JUICE_GLASS_SPOT.x);
    expect(HOPPER_NEXT.y).toBeLessThan(JUICE_SPOUT.y);
    expect(juiceRows(0)).toBe(0);
    expect(juiceRows(1)).toBe(JUICE_LINE_ROWS);
    expect(juiceRows(0.8)).toBeLessThan(JUICE_LINE_ROWS);
    expect(juiceRows(1.2)).toBeGreaterThan(JUICE_LINE_ROWS);
    expect(juiceRows(9)).toBe(JUICE_GLASS_LEVELS - 1);
    expect(juiceGlassKey(juiceRows(1))).toBe('balcao/juice_glass_7');
  });

  it('the tray holds ten miniatures in two rows, on the tray', () => {
    const slots = Array.from({ length: 10 }, (_, i) => traySlot(i));
    expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(10);
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(TRAY_SPOT.x - 32);
      expect(s.x).toBeLessThan(TRAY_SPOT.x + 32);
    }
  });
});
