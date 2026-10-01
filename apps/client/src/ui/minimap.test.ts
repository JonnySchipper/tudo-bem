import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { MINIMAP_PX, markers, minimapPixels } from './minimap';

describe('Vila Ipê minimap', () => {
  const room = ROOMS.praca;
  it('is 2 px per tile, opaque', () => {
    const m = minimapPixels(room);
    expect(m.w).toBe(56 * MINIMAP_PX);
    expect(m.h).toBe(40 * MINIMAP_PX);
    for (let i = 3; i < m.data.length; i += 4) expect(m.data[i]).toBe(255);
  });

  it('shows streets dark, lawns green and the buildings brown', () => {
    const m = minimapPixels(room);
    const at = (tx: number, ty: number) => [...m.data.slice((ty * MINIMAP_PX * m.w + tx * MINIMAP_PX) * 4 + 1, (ty * MINIMAP_PX * m.w + tx * MINIMAP_PX) * 4 + 2)][0];
    expect(at(30, 9)).toBeLessThan(100); // asfalto
    expect(at(15, 17)).toBeGreaterThan(150); // grama (green channel)
    const r = (tx: number, ty: number) => m.data[(ty * MINIMAP_PX * m.w + tx * MINIMAP_PX) * 4];
    expect(r(15, 2)).toBeGreaterThan(120); // building: brown
    expect(r(15, 2)).toBeLessThan(150);
  });

  it('marks the three doors, both NPCs and you', () => {
    const ms = markers(room, { x: 25, y: 27 });
    expect(ms.filter((m) => m.kind === 'door')).toHaveLength(3);
    expect(ms.filter((m) => m.kind === 'npc').map((m) => m.label).sort()).toEqual(['Dona Rosa', 'Júlia', 'Nanda', 'Seu Chico', 'Seu Zé', 'Tia Lu']); // plus the feira vendors
    expect(ms.filter((m) => m.kind === 'me')).toHaveLength(1);
    expect(markers(room, null).some((m) => m.kind === 'me')).toBe(false);
  });

  it('marks the NPCs where they are now when the caller says so (schedules move them)', () => {
    const ms = markers(room, null, [{ name: 'Júlia', x: 21, y: 6 }]);
    expect(ms.filter((m) => m.kind === 'npc')).toEqual([{ kind: 'npc', x: 21, y: 6, label: 'Júlia' }]);
  });
});
