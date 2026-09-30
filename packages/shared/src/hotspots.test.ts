import { describe, expect, it } from 'vitest';
import { HOTSPOTS, HOTSPOT_READ_RANGE, hotspotBox, hotspotCueSpot, hotspotDistance, hotspotTitle, hotspotsInRoom, hotspotsNear, readSpot, type HotspotDef } from './hotspots.js';
import { buildGrid, isWalkable, ROOMS, ROOM_IDS, propTiles } from './rooms.js';
import { findPath } from './path.js';
import { cardById } from './cards.js';
import { cardsInText } from './caderno.js';
import { PRICES } from './carlos.js';
import { normalizeAnswer } from './accept.js';

describe('hotspot data', () => {
  it('has at least 24 entries with unique ids, in a real room, with PT and EN text', () => {
    expect(HOTSPOTS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(HOTSPOTS.map((h) => h.id)).size).toBe(HOTSPOTS.length);
    for (const h of HOTSPOTS) {
      expect(ROOM_IDS).toContain(h.room);
      expect(h.pt.trim().length).toBeGreaterThan(0);
      expect(h.en.trim().length).toBeGreaterThan(0);
      // the same number of lines in both languages, so the card can show them side by side
      expect(h.pt.split('\n').length, h.id).toBe(h.en.split('\n').length);
    }
    for (const room of ['praca', 'padaria', 'kitnet', 'academia'] as const) expect(hotspotsInRoom(room).length, room).toBeGreaterThan(0);
  });

  it('footprints are inside the room', () => {
    for (const h of HOTSPOTS) {
      const r = ROOMS[h.room];
      const w = h.w ?? 1;
      const hh = h.h ?? 1;
      expect(h.x >= 0 && h.y >= 0 && h.x + w <= r.cols && h.y + hh <= r.rows, `${h.id} in bounds`).toBe(true);
      expect(Number.isInteger(h.x) && Number.isInteger(h.y), h.id).toBe(true);
      if (h.up !== undefined) expect(!r.outdoor && h.up >= 1 && h.up <= 3, `${h.id}: up only on interior walls`).toBe(true);
    }
  });

  it('every hotspot can be read: a reachable walkable tile lies within 3 tiles of its footprint', () => {
    for (const h of HOTSPOTS) {
      const room = ROOMS[h.room];
      const grid = buildGrid(room, []);
      const reachable = (x: number, y: number) => isWalkable(grid, x, y) && ((x === room.spawn.x && y === room.spawn.y) || !!findPath(grid, room.spawn, { x, y }));
      const spot = readSpot(h, room.spawn, reachable, HOTSPOT_READ_RANGE);
      expect(spot, `${h.id} has a reading spot`).not.toBeNull();
      expect(hotspotDistance(h, spot!)).toBeLessThanOrEqual(HOTSPOT_READ_RANGE);
    }
  });

  it('does not sit on a door, an NPC or a prop that has an action (those keep their click)', () => {
    for (const h of HOTSPOTS) {
      const room = ROOMS[h.room];
      const box = hotspotBox(h);
      const inBox = (t: { x: number; y: number }) => t.x >= box.x0 && t.x < box.x1 && t.y >= box.y0 && t.y < box.y1;
      for (const p of room.portals) expect(inBox(p), `${h.id} covers portal ${p.id}`).toBe(false);
      for (const p of room.props.filter((q) => q.action)) expect(propTiles(p).some(inBox), `${h.id} covers ${p.id}`).toBe(false);
      for (const n of room.npcs) expect(inBox(n) || inBox(n.interact), `${h.id} covers ${n.id}`).toBe(false);
    }
  });

  it('card ids exist, and every listed card really appears in the text', () => {
    for (const h of HOTSPOTS) {
      for (const id of h.cards ?? []) {
        expect(cardById(id), `${h.id}: ${id}`).toBeDefined();
        expect(cardsInText(h.pt), `${h.id} teaches ${id}`).toContain(id);
      }
    }
  });

  it('the padaria menu and the sidewalk table agree with the scene prices', () => {
    let checked = 0;
    for (const h of HOTSPOTS.filter((x) => ['padaria_cardapio', 'mesa_cafe_precos', 'padaria_estufa'].includes(x.id))) {
      for (const l of h.pt.split(/\n| · /)) {
        const m = /^(.*?)\s*R\$\s*(\d+)$/.exec(l.trim());
        if (!m) continue;
        const item = Object.keys(PRICES).find((k) => {
          const card = cardById(`lex.padaria.${k}`);
          return card && normalizeAnswer(card.form) === normalizeAnswer(m[1]!);
        });
        expect(item, `${h.id}: "${m[1]}" is a priced item`).toBeDefined();
        expect(PRICES[item!], `${h.id}: ${m[1]}`).toBe(Number(m[2]));
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(9);
    const menu = HOTSPOTS.find((h) => h.id === 'padaria_cardapio')!;
    // every item the scene can sell is on the menu
    for (const k of Object.keys(PRICES).filter((x) => x !== 'nada')) expect(menu.cards, k).toContain(`lex.padaria.${k}`);
  });
});

describe('hotspot helpers', () => {
  const sign: HotspotDef = { id: 't', room: 'praca', x: 10, y: 10, w: 3, h: 2, pt: 'A', en: 'A' };

  it('hotspotsNear: only the room, within range, nearest first', () => {
    const list: HotspotDef[] = [sign, { ...sign, id: 'near', x: 15, y: 10, w: 1, h: 1 }, { ...sign, id: 'other-room', room: 'padaria' }, { ...sign, id: 'far', x: 30, y: 30 }];
    expect(hotspotsNear('praca', { x: 14, y: 11 }, 3, list).map((h) => h.id)).toEqual(['near', 't']);
    expect(hotspotsNear('praca', { x: 14, y: 11 }, 0, list)).toEqual([]);
    expect(hotspotsNear('praca', { x: 11, y: 11 }, 3, list).map((h) => h.id)).toEqual(['t']);
    // 3 tiles is in, 4 is out
    expect(hotspotsNear('praca', { x: 10, y: 14 }, 3, list).map((h) => h.id)).toEqual(['t']);
    expect(hotspotsNear('praca', { x: 10, y: 15 }, 3, list)).toEqual([]);
    expect(hotspotsNear('kitnet', { x: 10, y: 11 }, 3, list)).toEqual([]);
  });

  it('hotspotBox adds the wall rows above the footprint', () => {
    expect(hotspotBox({ x: 8, y: 0, w: 2, h: 1, up: 2 })).toEqual({ x0: 8, y0: -2, x1: 10, y1: 1 });
    expect(hotspotBox({ x: 3, y: 4 })).toEqual({ x0: 3, y0: 4, x1: 4, y1: 5 });
  });

  it('readSpot picks the walkable tile nearest to the player, or nothing when none is close', () => {
    const open = () => true;
    expect(readSpot(sign, { x: 10, y: 12 }, open)).toEqual({ x: 10, y: 12 });
    expect(readSpot(sign, { x: 10, y: 20 }, open)).toEqual({ x: 10, y: 14 });
    // blocked ground: only the far side is walkable
    expect(readSpot(sign, { x: 11, y: 5 }, (_x, y) => y >= 13)).toEqual({ x: 11, y: 13 });
    expect(readSpot(sign, { x: 0, y: 0 }, () => false)).toBeNull();
  });

  it('the 👁 cue floats over the middle of the top edge of the click box', () => {
    expect(hotspotCueSpot({ x: 20, y: 4, w: 3, h: 2 })).toEqual({ x: 21, y: 4 });
    expect(hotspotCueSpot({ x: 15, y: 1, w: 4, h: 3 })).toEqual({ x: 16.5, y: 1 });
    expect(hotspotCueSpot({ x: 8, y: 0, w: 2, h: 1, up: 2 })).toEqual({ x: 8.5, y: -2 });
    expect(hotspotCueSpot({ x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });

  it('hotspotTitle is the first line', () => {
    expect(hotspotTitle({ pt: 'CARDÁPIO\nPão R$ 6', en: 'MENU\nBread' })).toEqual({ pt: 'CARDÁPIO', en: 'MENU' });
  });
});
