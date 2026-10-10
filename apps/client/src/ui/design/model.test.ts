import { describe, expect, it } from 'vitest';
import type { PropDef } from '@tudobem/shared';
import { EditHistory, cloneProps, drawDepth, footprint, freshId, layerOf, marqueeIds, nudgePx, pasteAt, pickAt, propBox, restack, rotateProp, snapToGrid, T } from './model';

const prop = (id: string, x: number, y: number, extra: Partial<PropDef> = {}): PropDef => ({ id, kind: 'cenario', x, y, blocks: true, ...extra });
const tall = { w: 16, h: 40, ax: 8, ay: 38 };

describe('design model', () => {
  it('sorts props into floor, object and overhead layers', () => {
    expect(layerOf(prop('a', 0, 0, { kind: 'tatame' }), null, null)).toBe('floor');
    expect(layerOf(prop('a', 0, 0), { ...tall, decal: true }, 'props/x')).toBe('floor');
    expect(layerOf(prop('a', 0, 0), null, 'decals/sp_mosaic')).toBe('floor');
    expect(layerOf(prop('a', 0, 0), { ...tall, overhead: true }, 'aero/teto')).toBe('overhead');
    expect(layerOf(prop('a', 0, 0), tall, 'props/lixeira')).toBe('objects');
  });

  it('boxes a prop by its sprite around the anchor, nudge included', () => {
    const p = prop('a', 2, 3);
    expect(footprint(p)).toEqual({ x0: 32, y0: 48, x1: 48, y1: 64 });
    expect(propBox(p, tall)).toEqual({ x0: 32, y0: 64 - 38, x1: 48, y1: 64 + 2 });
    // the sprite moves with the fine nudge, the footprint (collision) does not
    expect(propBox({ ...p, ox: 4 }, tall)).toMatchObject({ x0: 32, x1: 52 });
  });

  it('picks the prop drawn on top, standing props over floor art, and skips locked or hidden ones', () => {
    const rug = prop('tapete', 0, 0, { w: 4, h: 4, blocks: false });
    const back = prop('atras', 1, 1);
    const front = prop('frente', 1, 2);
    const objects = [front, rug, back];
    const boxOf = (p: PropDef) => propBox(p, p.id === 'tapete' ? null : tall);
    const layer = (p: PropDef): 'floor' | 'objects' => (p.id === 'tapete' ? 'floor' : 'objects');
    expect(pickAt(objects, 24, 30, boxOf, layer, () => false)?.id).toBe('frente');
    expect(pickAt(objects, 24, 30, boxOf, layer, (p) => p.id === 'frente')?.id).toBe('atras');
    expect(pickAt(objects, 60, 60, boxOf, layer, () => false)?.id).toBe('tapete');
    expect(pickAt(objects, 600, 600, boxOf, layer, () => false)).toBeNull();
    expect(marqueeIds(objects, { x0: 0, y0: 0, x1: 20, y1: 5 }, boxOf, () => false)).toEqual(['tapete', 'atras']);
  });

  it('makes free ids, and duplicates or pastes with interaction tiles and gaps attached', () => {
    const taken = new Set(['banco', 'banco_2']);
    expect(freshId('banco', taken)).toBe('banco_3');
    expect(freshId('banco_2', taken)).toBe('banco_3');
    expect(freshId('mesa café!', taken)).toBe('mesa_caf__');
    const src = [prop('banco', 4, 4, { interact: { x: 4, y: 5 }, action: 'kiosk' }), prop('cerca', 6, 6, { w: 3, h: 3, gaps: [{ x: 7, y: 8 }] })];
    const dup = cloneProps(src, new Set(['banco', 'cerca']), 1, 0);
    expect(dup.map((p) => p.id)).toEqual(['banco_2', 'cerca_2']);
    expect(dup[0]).toMatchObject({ x: 5, interact: { x: 5, y: 5 } });
    expect(dup[1]!.gaps).toEqual([{ x: 8, y: 8 }]);
    expect(src[0]!.x).toBe(4);
    const pasted = pasteAt(src, new Set(), { x: 10, y: 20 });
    expect(pasted.map((p) => [p.id, p.x, p.y])).toEqual([
      ['banco', 10, 20],
      ['cerca', 12, 22],
    ]);
  });

  it('nudges by art px, carrying whole tiles, and snaps back to the grid', () => {
    const p = prop('a', 5, 5, { interact: { x: 5, y: 6 } });
    nudgePx(p, -1, 0);
    expect(p).toMatchObject({ x: 4, ox: 15, interact: { x: 4, y: 6 } });
    nudgePx(p, 1, 17);
    expect(p).toMatchObject({ x: 5, y: 6 });
    expect(p.ox).toBeUndefined();
    expect(p.oy).toBe(1);
    nudgePx(p, 0, 9);
    snapToGrid(p);
    expect(p).toMatchObject({ x: 5, y: 7 });
    expect(p.oy).toBeUndefined();
  });

  it('brings a prop in front of what overlaps it, and sends it back behind', () => {
    const a = prop('a', 2, 2);
    const b = prop('b', 2, 3);
    const far = prop('far', 20, 20);
    const objects = [a, b, far];
    const boxOf = (p: PropDef) => propBox(p, tall);
    expect(drawDepth(a)).toBeLessThan(drawDepth(b));
    restack(objects, new Set(['a']), 1, boxOf);
    expect(drawDepth(a)).toBe(drawDepth(b) + 1);
    expect(a.z).toBe(T + 1);
    restack(objects, new Set(['a']), -1, boxOf);
    expect(drawDepth(a)).toBe(drawDepth(b) - 1);
    restack(objects, new Set(['far']), 1, boxOf);
    expect(far.z).toBe(1);
  });

  it('turns seats and art with facings, and says when a sprite cannot turn', () => {
    const chair = prop('c', 0, 0, { kind: 'cadeira_padaria', seat: 'SE' });
    expect(rotateProp(chair, () => false)).toBe(true);
    expect(chair.seat).toBe('SW');
    const sign = prop('s', 0, 0, { art: 'props/placa_e' });
    const have = new Set(['props/placa_e', 'props/placa_w']);
    expect(rotateProp(sign, (k) => have.has(k))).toBe(true);
    expect(sign.art).toBe('props/placa_w');
    expect(rotateProp(sign, (k) => have.has(k))).toBe(true);
    expect(sign.art).toBe('props/placa_e');
    expect(rotateProp(prop('x', 0, 0, { art: 'props/fonte' }), () => true)).toBe(false);
  });

  it('undoes and redoes without limit, merges a continuing edit, and lists the changes', () => {
    let t = 0;
    const h = new EditHistory(() => t);
    let doc = [prop('a', 0, 0)];
    for (let i = 1; i <= 120; i++) {
      h.record(`move ${i}`, doc);
      doc = [{ ...doc[0]!, x: i }];
      t += 2000;
    }
    for (let i = 0; i < 120; i++) doc = h.undo(doc)!;
    expect(doc[0]!.x).toBe(0);
    expect(h.undo(doc)).toBeNull();
    doc = h.redo(doc)!;
    expect(doc[0]!.x).toBe(1);
    expect(h.entries().done.map((e) => e.label)).toEqual(['move 1']);
    expect(h.entries().undone[0]!.label).toBe('move 2');
    // a new edit drops the redo stack
    h.record('apagar', doc);
    expect(h.canRedo).toBe(false);
    // typing in one field is one entry
    h.recordOrMerge('x', doc, 'a.x');
    t += 100;
    h.recordOrMerge('x', doc, 'a.x');
    expect(h.entries().done.map((e) => e.label)).toEqual(['move 1', 'apagar', 'x']);
  });
});
