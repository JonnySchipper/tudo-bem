import { describe, expect, it } from 'vitest';
import { PADARIA_CASA_DIMS, padariaCasaRoom } from './padariaCasa.js';
import { ownedCorreriaMenuIds, type PlayerPadaria } from './playerPadaria.js';
import { ROOMS, buildGrid, isWalkable } from './rooms.js';
import { findPath } from './path.js';
import { shiftItemPool } from './correria.js';

const row = (size: 1 | 2 | 3): PlayerPadaria => ({ id: 'abcdef12', name: 'Padaria da Lia', nameKey: 'padaria da lia', ownerId: 'abcdef34', size, sweets: {}, createdAt: 0 });

describe("a player's own padaria is its own place", () => {
  it('is not Seu Carlos’s room: other floor, other walls, its own small layout, no baker and none of his signs', () => {
    const carlos = ROOMS.padaria;
    for (const size of [1, 2, 3] as const) {
      const r = padariaCasaRoom(size);
      expect(r.id).toBe('padaria');
      expect(r.floor.join('')).not.toContain('l');
      expect(r.wallStyle).toBeTruthy();
      expect(r.noHotspots).toBe(true);
      expect(r.npcs).toEqual([]);
      expect(r.props.length).toBeLessThan(carlos.props.length / 2);
      expect(r.props.some((p) => p.id.startsWith('d_'))).toBe(false);
      // no pot by the door: the upgrades are in the owner menu
      expect(r.props.some((p) => p.action === 'padaria_door' || p.id === 'padaria_porta_fundar')).toBe(false);
    }
  });

  it('starts small and nearly empty, and grows with each size', () => {
    const area = (s: 1 | 2 | 3) => PADARIA_CASA_DIMS[s].cols * PADARIA_CASA_DIMS[s].rows;
    expect(area(1)).toBeLessThan(ROOMS.padaria.cols * ROOMS.padaria.rows);
    expect(area(1)).toBeLessThan(area(2));
    expect(area(2)).toBeLessThan(area(3));
    expect(padariaCasaRoom(1).props.map((p) => p.kind).sort()).toEqual(['balcao', 'caixa', 'vitrine']);
    expect(padariaCasaRoom(2).props.length).toBeGreaterThan(padariaCasaRoom(1).props.length);
    expect(padariaCasaRoom(3).props.filter((p) => p.kind === 'mesa').length).toBeGreaterThan(padariaCasaRoom(2).props.filter((p) => p.kind === 'mesa').length);
    // one object per size, so the client does not rebuild the scene every frame
    expect(padariaCasaRoom(2)).toBe(padariaCasaRoom(2));
  });

  it('the vitrine starts the game, the balcão sells, and both are reachable from the door at every size', () => {
    for (const size of [1, 2, 3] as const) {
      const r = padariaCasaRoom(size);
      const grid = buildGrid(r);
      const play = r.props.find((p) => p.action === 'minigame')!;
      const sell = r.props.find((p) => p.action === 'padaria_counter')!;
      expect(play.kind).toBe('vitrine');
      expect(sell.kind).toBe('balcao');
      const door = r.portals[0]!;
      expect(door.to).toBe('rua');
      for (const t of [play.interact!, sell.interact!, r.spawn]) {
        expect(isWalkable(grid, t.x, t.y), `size ${size} ${t.x},${t.y}`).toBe(true);
        expect(findPath(grid, r.spawn, t), `size ${size} spawn -> ${t.x},${t.y}`).not.toBeNull();
      }
    }
  });

  it('at the Balcão size the counter game is café and pão only, however long the owner has played; the Padaria opens the rest', () => {
    for (const shifts of [0, 5, 99]) expect(shiftItemPool({ shifts, menuIds: ownedCorreriaMenuIds(row(1)) }).map((i) => i.id).sort()).toEqual(['cafe', 'pao']);
    expect(shiftItemPool({ shifts: 99, menuIds: ownedCorreriaMenuIds(row(2)) }).length).toBeGreaterThan(10);
  });
});
