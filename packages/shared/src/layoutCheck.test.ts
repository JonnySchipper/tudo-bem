import { describe, expect, it } from 'vitest';
import { checkLayout, reachableFrom } from './layoutCheck.js';
import { bundledObjects } from './roomLayoutFiles.js';
import { buildGrid, isWalkable, key, ROOM_IDS, ROOMS, type PropDef } from './rooms.js';
import { layoutDiff, layoutDiffSummary, validateRoomLayout } from './layout.js';

const box = (id: string, x: number, y: number, w = 1, h = 1): PropDef => ({ id, kind: 'cenario', x, y, w, h, blocks: true, art: 'props/lixeira' });

/** A floor tile in the middle of open, reachable floor (its 5x5 neighbourhood walkable). */
function openTile(room: 'padaria' | 'praca') {
  const def = ROOMS[room];
  const grid = buildGrid({ ...def, props: bundledObjects(room) });
  const reach = reachableFrom(grid, def.spawn);
  for (let y = 2; y < def.rows - 2; y++) {
    for (let x = 2; x < def.cols - 2; x++) {
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) ok = isWalkable(grid, x + dx, y + dy) && reach.has(key(x + dx, y + dy));
      if (ok) return { x, y };
    }
  }
  throw new Error(`no open floor in ${room}`);
}

describe('layout check (design mode publish warnings)', () => {
  it('finds nothing new in any shipped layout', () => {
    for (const id of ROOM_IDS) {
      const objects = bundledObjects(id);
      expect(checkLayout(id, objects, objects), id).toEqual([]);
    }
  });

  it('flags a blocked arrival tile as an error', () => {
    const base = bundledObjects('padaria');
    const arrive = ROOMS.rua.portals.find((p) => p.to === 'padaria')!.arrive;
    const issues = checkLayout('padaria', [...base, box('tampa', arrive.x, arrive.y)], base);
    const doors = issues.filter((i) => i.kind === 'door');
    expect(doors.find((i) => i.ids.includes('tampa'))).toMatchObject({ severity: 'error', ids: ['tampa'], tiles: [arrive] });
    // whoever is already inside cannot get to the way out either
    expect(doors.some((i) => i.ids.length === 0)).toBe(true);
    expect(issues[0]!.severity).toBe('error');
  });

  it('flags an interaction tile nobody can reach', () => {
    const base = bundledObjects('padaria');
    const counter = base.find((p) => p.action && p.interact)!;
    const issues = checkLayout('padaria', [...base, box('tampa', counter.interact!.x, counter.interact!.y)], base);
    expect(issues.find((i) => i.kind === 'interact')).toMatchObject({ severity: 'error', ids: [counter.id] });
  });

  it('warns about overlapping colliders, objects off the map and cut-off floor', () => {
    const base = bundledObjects('praca');
    const t = openTile('praca');
    const ring = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].filter((dx) => dx || dy).map((dx) => box(`anel_${dx}_${dy}`, t.x + dx, t.y + dy)));
    const issues = checkLayout('praca', [...base, ...ring, box('dupla', t.x - 1, t.y - 1), box('longe', -3, 2)], base);
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain('overlap');
    expect(kinds).toContain('offmap');
    const cut = issues.find((i) => i.kind === 'unreachable')!;
    expect(cut.tiles).toEqual([t]);
    expect(issues.find((i) => i.kind === 'overlap')!.ids.sort()).toEqual(['anel_-1_-1', 'dupla']);
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
  });

  it('reports only what the edit introduced when given the old layout', () => {
    const base = bundledObjects('praca');
    const edited = [...base, box('longe', -3, 2)];
    expect(checkLayout('praca', edited, edited)).toEqual([]);
    expect(checkLayout('praca', edited, base)).toHaveLength(1);
  });
});

describe('layout diff and the design-mode fields', () => {
  it('lists added, removed and changed props', () => {
    const base = bundledObjects('padaria');
    const [first, second] = base;
    const after = [{ ...first!, x: first!.x + 1, flip: true }, ...base.slice(2), box('novo', 3, 3)];
    const d = layoutDiff(base, after);
    expect(d.added).toEqual(['novo']);
    expect(d.removed).toEqual([second!.id]);
    expect(d.changed).toEqual([{ id: first!.id, fields: ['x', 'flip'] }]);
    expect(layoutDiffSummary(d)).toBe('+1 -1 ~1');
  });

  it('keeps flip and a draw-order bias, and refuses out-of-range ones', () => {
    const base = bundledObjects('padaria');
    const ok = validateRoomLayout('padaria', [{ ...base[0]!, flip: true, z: 12 }, { ...base[1]!, flip: false, z: 0 }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.objects[0]).toMatchObject({ flip: true, z: 12 });
      expect(ok.objects[1]).not.toHaveProperty('flip');
      expect(ok.objects[1]).not.toHaveProperty('z');
    }
    expect(validateRoomLayout('padaria', [{ ...base[0]!, z: 9999 }]).ok).toBe(false);
    expect(validateRoomLayout('padaria', [{ ...base[0]!, flip: 'sim' }]).ok).toBe(false);
  });
});
