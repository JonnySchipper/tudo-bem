import { describe, expect, it } from 'vitest';
import { buildGrid, floorAt, isWalkable, propTiles, ROOMS } from './rooms.js';
import { scheduleAt } from './schedules.js';

const praca = ROOMS.praca;
const props = praca.props;
const byId = (id: string) => props.find((p) => p.id === id)!;

/** Visual pass V2 (composition): the layout rules the new props must keep. */
describe('V2 composition of Vila Ipê', () => {
  it('has the focal points: coreto, bust, game tables, playground, carts, a shade tree and a palm', () => {
    for (const id of ['coreto', 'busto', 'mesa_domino_1', 'mesa_xadrez_1', 'pg_balanco', 'pg_escorregador', 'pg_gangorra', 'pg_trepa', 'pipoqueiro', 'carrinho_coco', 'sibipiruna', 'jeriva_1']) {
      expect(byId(id), id).toBeDefined();
    }
    // tree variety: five different tree sprites at least, purple and white ipês among them
    const trees = new Set(props.filter((p) => p.kind === 'arvore' || p.kind === 'ipe').map((p) => p.art ?? (p.hero ? 'props/ipe_large' : 'props/ipe_medium')));
    expect(trees.size).toBeGreaterThanOrEqual(8);
    for (const art of ['props/ipe_roxo_medium', 'props/ipe_branco_large', 'props/figueira', 'props/sibipiruna', 'props/jeriva', 'props/arvore_rua', 'props/oiti']) {
      if (art === 'props/figueira') continue; // authored but not placed in this layout
      expect(trees.has(art), art).toBe(true);
    }
  });

  it('puts four stools around each game table, every sitter facing the table', () => {
    const face = { SE: [1, 0], NW: [-1, 0], SW: [0, 1], NE: [0, -1] } as const;
    for (const [table, prefix] of [['mesa_domino_1', 'banquinho_a'], ['mesa_xadrez_1', 'banquinho_b']] as const) {
      const t = byId(table);
      const stools = props.filter((p) => p.id.startsWith(prefix));
      expect(stools).toHaveLength(4);
      for (const s of stools) {
        expect(s.seat, s.id).toBeDefined();
        const [dx, dy] = face[s.seat!];
        expect({ x: s.x + dx, y: s.y + dy }, `${s.id} faces the table`).toEqual({ x: t.x, y: t.y });
        expect(s.blocks, s.id).toBe(false);
      }
    }
  });

  it('parks vehicles in the bays of each street (row 12 and 35), never on a crosswalk', () => {
    const parked = props.filter((p) => p.id.startsWith('estac_'));
    expect(parked.length).toBeGreaterThanOrEqual(10);
    const crosswalks = { 12: [15, 16, 24, 25, 40, 41], 35: [12, 13, 24, 25, 38, 39] } as Record<number, number[]>;
    for (const p of parked) {
      expect([12, 35], p.id).toContain(p.y);
      expect(p.h ?? 1).toBe(1);
      expect(p.blocks, p.id).toBe(true);
      for (const t of propTiles(p)) {
        expect(crosswalks[p.y].includes(t.x), `${p.id} on a crosswalk at ${t.x}`).toBe(false);
        expect(floorAt(praca, t.x, t.y), `${p.id} stands on the asphalt`).toBe('asfalto');
      }
    }
    // the sidewalks and the crosswalks stay walkable
    const g = buildGrid(praca);
    for (const [row, xs] of Object.entries(crosswalks)) for (const x of xs) expect(isWalkable(g, x, Number(row)), `crosswalk ${x},${row}`).toBe(true);
    for (let x = 2; x < 54; x++) for (const y of [12, 31]) if (!props.some((p) => propTiles(p).some((t) => t.x === x && t.y === y && p.blocks))) expect(isWalkable(g, x, y)).toBe(true);
  });

  it('keeps the pit trees off the doors and their landing tiles', () => {
    for (const p of props.filter((q) => q.id.startsWith('arv_'))) {
      for (const t of propTiles(p)) for (const portal of praca.portals) {
        expect(Math.abs(t.x - portal.x) <= 1 && t.y <= 7 && t.y >= 6, `${p.id} next to ${portal.id}`).toBe(false);
      }
    }
  });

  it('puts every feira vendor in front of the stall, facing the aisle, with the customer one tile further', () => {
    for (const [id, npc] of [['feira_tia_lu', 'tia_lu'], ['feira_ze', 'ze'], ['feira_chico', 'chico'], ['feira_rosa', 'rosa']] as const) {
      const stall = byId(id);
      const slot = scheduleAt(npc, 9 * 60)!;
      expect(slot.activity).toBe('trabalhando');
      expect(slot.tile).toEqual({ x: stall.x + 1, y: stall.y + 2 });
      expect(slot.interact).toEqual({ x: stall.x + 1, y: stall.y + 3 });
      expect(slot.dir).toBe('SW');
      expect(stall.interact).toEqual(slot.interact);
      // the vendor's tile is free ground, not a prop
      expect(isWalkable(buildGrid(praca), slot.tile.x, slot.tile.y)).toBe(true);
    }
  });

  it('paves the feira lot with granite setts (paralelepipedo)', () => {
    for (const [x, y] of [[44, 20], [48, 22], [51, 27], [42, 15]]) expect(floorAt(praca, x, y)).toBe('paralelepipedo');
    expect(floorAt(praca, 41, 21)).toBe('tijolo');
  });
});
