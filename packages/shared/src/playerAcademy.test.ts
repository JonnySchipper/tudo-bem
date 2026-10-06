import { describe, expect, it } from 'vitest';
import { buildGrid, isWalkable, ROOMS, seatTiles } from './rooms.js';
import { findPath } from './path.js';
import { normalizeBjj, progressForWins } from './academia.js';
import {
  ACADEMY_CUP_STUB,
  ACADEMY_FEES_STUB,
  academyNameKey,
  academyOutfit,
  canFoundAcademy,
  elevatorLayout,
  normalizeAcademy,
  validateAcademyName,
} from './playerAcademy.js';

describe('player academies, slice 1', () => {
  it('lets a brown or black belt found, and nobody below, using the wins already on the profile', () => {
    expect(progressForWins(140)).toMatchObject({ belt: 'marrom' });
    expect(canFoundAcademy({ wins: 140 })).toBe(true);
    expect(canFoundAcademy({ wins: 300 })).toBe(true);
    expect(canFoundAcademy({ wins: 139 })).toBe(false);
    expect(canFoundAcademy({ wins: 0 })).toBe(false);
    // a hand-written belt does not beat the win count
    expect(canFoundAcademy({ belt: 'marrom', stripes: 0, wins: 0 })).toBe(false);
    expect(normalizeBjj({ belt: 'marrom', wins: 0 }).belt).toBe('branca');
  });

  it('takes a name first-come: accents and case fold, and the safety filter still applies', () => {
    expect(academyNameKey('Academia Ipê')).toBe(academyNameKey('academia ipe'));
    const ok = validateAcademyName('  Academia   Ipê ');
    expect(ok).toMatchObject({ ok: true, name: 'Academia Ipê', key: 'academia ipe' });
    expect(validateAcademyName('shit').ok).toBe(false);
    expect(validateAcademyName('a').ok).toBe(false);
  });

  it('keeps a saved academy coherent and drops a broken row', () => {
    const row = normalizeAcademy({
      id: 'abcdef012345',
      name: 'Ipê',
      ownerId: 'aaaabbbbcccc',
      crest: 'ipe',
      giColor: 'azul',
      giStamp: 'sol',
      members: [],
      createdAt: 10,
    });
    expect(row).toMatchObject({ nameKey: 'ipe', members: ['aaaabbbbcccc'], giColor: 'azul' });
    expect(normalizeAcademy({ id: 'nope', name: 'Ipê' })).toBeNull();
  });

  it('dyes the uniform and leaves the personal belt out of the outfit', () => {
    const dyed = academyOutfit({ body: 'medio', skin: 1, hair: 'curto', hairColor: 0, top: 'camiseta', topColor: 3, bottom: 'bermuda', bottomColor: 2, shoes: 1 }, 'verde');
    expect(dyed).toMatchObject({ top: 'camisa', bottom: 'calca', topColor: 0, bottomColor: 0, skin: 1 });
    expect(dyed).not.toHaveProperty('belt');
  });

  it('stacks the elevator at a 390px phone and keeps a wide row on desktop', () => {
    expect(elevatorLayout(390)).toEqual({ stacked: true, actionWidth: 'full' });
    expect(elevatorLayout(420)).toEqual({ stacked: true, actionWidth: 'full' });
    expect(elevatorLayout(421)).toEqual({ stacked: false, actionWidth: 'auto' });
  });

  it('puts the elevator in Academia do Bairro and a floor with its own mat behind it', () => {
    expect(ROOMS.academia.name).toBe('Academia do Bairro');
    expect(ROOMS.rua_leste.portals.some((p) => p.to === 'academia')).toBe(true);
    expect(ROOMS.academia.portals.some((p) => p.to === 'andar')).toBe(false);
    expect(ROOMS.academia.props.some((p) => p.action === 'bjj_roll')).toBe(true);
    const elev = ROOMS.academia.props.find((p) => p.id === 'elevador');
    expect(elev).toMatchObject({ action: 'academy_elevator', interact: { x: 5, y: 7 } });
    const g = buildGrid(ROOMS.academia);
    expect(findPath(g, ROOMS.academia.spawn, elev!.interact!)).not.toBeNull();
    expect(isWalkable(g, 5, 7)).toBe(true);

    expect(ROOMS.andar.npcs).toEqual([]);
    // slice 2 (polish): the floor's own mat trains and its crest board opens the team card; the gi is still bought at the flagship
    expect(ROOMS.andar.props.some((p) => p.action === 'buy_gi')).toBe(false);
    const ag = buildGrid(ROOMS.andar);
    for (const id of ['andar_tatame', 'andar_brasao']) {
      const p = ROOMS.andar.props.find((q) => q.id === id)!;
      expect(p.action, id).toBeTruthy();
      expect(findPath(ag, ROOMS.andar.spawn, p.interact!), id).not.toBeNull();
    }
    expect(ROOMS.andar.portals.map((p) => p.to)).toEqual(['academia']);
    expect(seatTiles(ROOMS.andar).length).toBeGreaterThan(0);
    const floor = buildGrid(ROOMS.andar);
    expect(isWalkable(floor, ROOMS.andar.spawn.x, ROOMS.andar.spawn.y)).toBe(true);
    expect(findPath(floor, ROOMS.andar.spawn, ROOMS.andar.portals[0]!)).not.toBeNull();
  });

  it('stubs fees and the cup instead of charging or ranking', () => {
    expect(ACADEMY_FEES_STUB).toEqual({ pt: 'Grátis', en: 'Free' });
    expect(ACADEMY_CUP_STUB.pt).toBe('Sem copa');
  });
});
