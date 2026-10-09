import { describe, expect, it } from 'vitest';
import { ROOM_IDS, ROOMS } from '@tudobem/shared';
import { MAP_H, MAP_W, ROOM_ON_MAP, SOON_SPOTS, backdropArt, hereSpotId, mapSpots, spotAnchor, tapResult, type Box } from './townMapData';

const overlaps = (a: Box, b: Box) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
const inside = (x: number, y: number, w: number, h: number, boxes: Box[]) => boxes.some((b) => x >= b[0] && y >= b[1] && x + w <= b[0] + b[2] && y + h <= b[1] + b[3]);

describe('the Mapa: one illustrated map of Vila Ipê', () => {
  it('places every room of the shared room list (or routes it through the place it is inside)', () => {
    for (const id of ROOM_IDS) {
      const on = ROOM_ON_MAP[id];
      expect(on, id).toBeTruthy();
      if ('via' in on) expect(ROOM_ON_MAP[on.via], `${id} via ${on.via}`).toHaveProperty('art');
    }
    const rooms = mapSpots().filter((s) => s.room);
    expect(rooms.map((s) => s.id).sort()).toEqual(['academia', 'aeroporto', 'escola', 'feira', 'kitnet', 'padaria', 'praca', 'rua', 'rua_leste']);
    // each place travels to its own room and is labelled with that room's own name and gloss
    for (const s of rooms) {
      expect(s.room).toBe(s.id);
      expect(s.pt).toBe(ROOMS[s.room!].name);
      expect(s.en).toBe(ROOMS[s.room!].gloss);
    }
  });

  it('draws Praia and Fazenda as coming soon: no travel, a bilingual teaser', () => {
    expect(SOON_SPOTS.map((s) => [s.id, s.pt, s.en])).toEqual([
      ['praia', 'Praia', 'Beach'],
      ['fazenda', 'Fazenda', 'Farm'],
    ]);
    for (const s of SOON_SPOTS) {
      expect(s.room).toBeNull();
      expect(s.soon?.pt.length).toBeGreaterThan(10);
      expect(s.soon?.en.length).toBeGreaterThan(10);
      expect(tapResult(s, { touch: false, selected: null, here: 'rua' })).toBe('teaser');
      expect(tapResult(s, { touch: true, selected: s.id, here: 'rua' })).toBe('teaser');
    }
  });

  it('keeps every place on the map, its pixels inside its own tap area, and no two places overlapping', () => {
    const spots = mapSpots();
    for (const s of spots) {
      for (const [x, y, w, h] of s.hit) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(MAP_W);
        expect(y + h).toBeLessThanOrEqual(MAP_H);
      }
      expect(s.art.length).toBeGreaterThan(10);
      for (const [x, y, w, h] of s.art) expect(inside(x, y, w, h, s.hit), `${s.id} pixel ${x},${y} ${w}x${h}`).toBe(true);
    }
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++)
        for (const a of spots[i]!.hit) for (const b of spots[j]!.hit) expect(overlaps(a, b), `${spots[i]!.id} / ${spots[j]!.id}`).toBe(false);
    for (const [x, y, w, h] of backdropArt()) {
      expect(x >= 0 && y >= 0 && x + w <= MAP_W && y + h <= MAP_H, `backdrop ${x},${y}`).toBe(true);
    }
  });

  it('gives a phone big tap targets (the map is about 3.4 px per art pixel at 390×844)', () => {
    const phoneScale = (844 - 150) / MAP_H;
    for (const s of mapSpots()) {
      const [, , w, h] = s.hit[0]!;
      expect(Math.min(w, h) * phoneScale, s.id).toBeGreaterThanOrEqual(44);
    }
  });

  it('marks "você está aqui" on your place, and on the Academia from a player academy floor', () => {
    expect(hereSpotId('praca')).toBe('praca');
    expect(hereSpotId('kitnet')).toBe('kitnet');
    expect(hereSpotId('andar')).toBe('academia');
    expect(hereSpotId(null)).toBeNull();
    const a = spotAnchor(ROOM_ON_MAP.padaria as { hit: Box[] });
    expect(a.x).toBeGreaterThan(103);
    expect(a.top).toBe(56);
  });

  it('travels on a click, lifts first on a touch, and just closes where you already are', () => {
    const feira = { id: 'feira' as const, room: 'feira' as const };
    expect(tapResult(feira, { touch: false, selected: null, here: 'rua' })).toBe('travel');
    expect(tapResult(feira, { touch: true, selected: null, here: 'rua' })).toBe('select');
    expect(tapResult(feira, { touch: true, selected: 'praca', here: 'rua' })).toBe('select');
    expect(tapResult(feira, { touch: true, selected: 'feira', here: 'rua' })).toBe('travel');
    expect(tapResult(feira, { touch: false, selected: null, here: 'feira' })).toBe('stay');
  });
});
