import { describe, expect, it } from 'vitest';
import { PET_PENS, petLook, type HomePet } from '@tudobem/shared';
import { BOWL_GATHER_MS, homeResidents, penResidents } from './residentPets';

describe('resident pets (#234)', () => {
  it('the pens show the day’s litter inside the pen, the same for everyone', () => {
    const a = penResidents(5, 123_456_000);
    expect(a).toEqual(penResidents(5, 123_456_000));
    expect(a).toHaveLength(PET_PENS.reduce((n, p) => n + p.shows, 0));
    for (const r of a) {
      const pen = PET_PENS.find((p) => p.id === r.pen!.penId)!;
      const tile = [Math.floor(r.x / 16), Math.floor(r.y / 16)];
      expect(pen.tiles).toContainEqual(tile);
    }
  });

  it('home pets rest on their tiles, and gather at the bowl for a few seconds after you come in', () => {
    const pets: HomePet[] = [
      { id: 'a', look: petLook('labrador', 'preto', null), name: 'Rex', pose: 'lie', tile: { x: 2, y: 2 }, toy: null },
      { id: 'b', look: petLook('persa', 'branco', null), name: null, pose: 'sit', tile: { x: 6, y: 5 }, toy: null },
    ];
    const bowl = [{ uid: 'r', itemId: 'saco_racao', x: 4, y: 4, rot: 0 as const }];
    const resting = homeResidents(pets, [], 0, 99_999);
    expect(resting.map((r) => [Math.floor(r.x / 16), Math.floor(r.y / 16), r.pose])).toEqual([[2, 2, 'lieS'], [6, 5, 'sitS']]);
    const gathered = homeResidents(pets, bowl, 0, 1000);
    for (const r of gathered) expect(Math.abs(Math.floor(r.x / 16) - 4) + Math.abs(Math.floor(r.y / 16) - 4)).toBeLessThanOrEqual(2);
    expect(homeResidents(pets, bowl, 0, BOWL_GATHER_MS + 1)).toEqual(homeResidents(pets, [], 0, BOWL_GATHER_MS + 1));
  });
});
