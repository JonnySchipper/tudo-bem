import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { MINIMAP_PX, markers, minimapPixels } from './minimap';

describe('Vila Ipê minimaps (one per open-air area)', () => {
  const rua = ROOMS.rua;
  const praca = ROOMS.praca;
  const feira = ROOMS.feira;

  it('is 2 px per tile, opaque, at each area size', () => {
    for (const [room, cols, rows] of [[rua, 40, 16], [praca, 32, 24], [feira, 32, 20]] as const) {
      const m = minimapPixels(room);
      expect(m.w).toBe(cols * MINIMAP_PX);
      expect(m.h).toBe(rows * MINIMAP_PX);
      for (let i = 3; i < m.data.length; i += 4) expect(m.data[i]).toBe(255);
    }
  });

  it('shows streets dark, lawns green and the buildings brown', () => {
    const m = minimapPixels(rua);
    const g = (tx: number, ty: number) => m.data[(ty * MINIMAP_PX * m.w + tx * MINIMAP_PX) * 4 + 1];
    const r = (tx: number, ty: number) => m.data[(ty * MINIMAP_PX * m.w + tx * MINIMAP_PX) * 4];
    expect(g(10, 9)).toBeLessThan(100); // asfalto
    expect(g(5, 14)).toBeGreaterThan(150); // grama (green channel)
    expect(r(15, 2)).toBeGreaterThan(120); // building: brown
    expect(r(15, 2)).toBeLessThan(150);
    const p = minimapPixels(praca);
    const pg = (tx: number, ty: number) => p.data[(ty * MINIMAP_PX * p.w + tx * MINIMAP_PX) * 4 + 1];
    expect(pg(5, 6)).toBeGreaterThan(150); // the praça lawn
  });

  it('marks the rua doors (padaria, Edifício, academia) and the edge to the praça, both NPCs of a room and you', () => {
    const ms = markers(rua, { x: 20, y: 13 });
    const doors = ms.filter((m) => m.kind === 'door');
    expect(doors).toHaveLength(4); // three doors and ONE marker for the whole south opening
    expect(doors.map((d) => d.label).sort()).toEqual(['Edifício Ipê — Minha kitnet', 'Academia do Bairro', 'Padaria do Seu Carlos', 'Praça Central'].sort());
    expect(ms.filter((m) => m.kind === 'me')).toHaveLength(1);
    expect(markers(rua, null).some((m) => m.kind === 'me')).toBe(false);
    // the praça: one marker per exit (north to the rua, east to the feira), and Nanda and Júlia at their home tiles
    expect(markers(praca, null).filter((m) => m.kind === 'door').map((m) => m.label).sort()).toEqual(['Feira Livre', 'Rua dos Ipês']);
    expect(markers(praca, null).filter((m) => m.kind === 'npc').map((m) => m.label).sort()).toEqual(['Júlia', 'Nanda']);
    // the feira: the gate to the praça, and the four vendors
    expect(markers(feira, null).filter((m) => m.kind === 'door').map((m) => m.label)).toEqual(['Praça Central']);
    expect(markers(feira, null).filter((m) => m.kind === 'npc').map((m) => m.label).sort()).toEqual(['Dona Rosa', 'Seu Chico', 'Seu Zé', 'Tia Lu']);
  });

  it('marks the NPCs where they are now when the caller says so (schedules move them)', () => {
    const ms = markers(praca, null, [{ name: 'Júlia', x: 13, y: 9 }]);
    expect(ms.filter((m) => m.kind === 'npc')).toEqual([{ kind: 'npc', x: 13, y: 9, label: 'Júlia' }]);
  });
});
