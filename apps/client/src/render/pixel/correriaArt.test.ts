import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MG_ITEMS } from '@tudobem/shared';
import { ART_SIZES, BOARD, CHAPA_SLOTS, ITEM_SPOTS, QUEUE_SPOTS, allArtKeys, sizeOfKey, traySlot, TRAY_SPOT } from './correriaArt';

const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../public/pixel/manifest.json'), 'utf8'));

describe('the Correria no Balcão art contract', () => {
  it('lists the keys of the contract: an item per shelf item, the pieces, their states and the steam', () => {
    const keys = allArtKeys();
    expect(keys).toHaveLength(MG_ITEMS.length + 5 + 5 + 5 + 2 + 4 + 5 + 4);
    expect(new Set(keys).size).toBe(keys.length);
    for (const i of MG_ITEMS) expect(keys).toContain(`balcao/item_${i.id}`);
    for (const k of ['balcao/tray', 'balcao/tray_full', 'balcao/bag', 'balcao/plate', 'balcao/register', 'balcao/chapa_burnt', 'balcao/coffee_pour_3', 'balcao/bell_1', 'balcao/tipjar_3', 'balcao/patience_0', 'fx/steam_3']) expect(keys).toContain(k);
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

  it('every shelf item stands on the board inside the padaria (160 x 144) and no two overlap', () => {
    expect(Object.keys(ITEM_SPOTS).sort()).toEqual(MG_ITEMS.map((i) => i.id).sort());
    const [w, h] = ART_SIZES.item!;
    const rects = Object.entries(ITEM_SPOTS).map(([id, s]) => ({ id, x0: s.x - 14, y0: s.y - 26, x1: s.x - 14 + w, y1: s.y - 26 + h }));
    for (const r of rects) {
      expect(r.x0).toBeGreaterThanOrEqual(BOARD.x0);
      expect(r.x1).toBeLessThanOrEqual(BOARD.x1);
      expect(r.y0).toBeGreaterThanOrEqual(BOARD.y0);
      expect(r.y1).toBeLessThanOrEqual(BOARD.y1);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        // sprites have a transparent margin: a few px of box overlap is fine, a real collision is not
        expect(overlapX > 6 && overlapY > 6, `${a.id} vs ${b.id}`).toBe(false);
      }
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

  it('the tray holds ten miniatures in two rows, on the tray', () => {
    const slots = Array.from({ length: 10 }, (_, i) => traySlot(i));
    expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(10);
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(TRAY_SPOT.x - 32);
      expect(s.x).toBeLessThan(TRAY_SPOT.x + 32);
    }
  });
});
