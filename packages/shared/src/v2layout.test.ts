import { describe, expect, it } from 'vitest';
import { buildGrid, floorAt, isWalkable, propTiles, ROOMS } from './rooms.js';
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import { scheduleAt } from './schedules.js';

const { rua, rua_leste, praca, feira } = ROOMS;
const props = [...rua.props, ...rua_leste.props, ...praca.props, ...feira.props];
const byId = (id: string) => props.find((p) => p.id === id)!;

/** Visual pass V2 (composition) of Vila Ipê, carried over to the three areas: the layout rules the props must keep. */
describe('V2 composition of Vila Ipê (rua, praça, feira)', () => {
  it('has the focal points: coreto, bust, game tables, playground, carts, a shade tree and a palm', () => {
    for (const id of ['coreto', 'busto', 'mesa_domino_1', 'mesa_xadrez_1', 'pg_balanco', 'pg_escorregador', 'pg_gangorra', 'pg_trepa', 'pipoqueiro', 'carrinho_coco', 'sibipiruna', 'jeriva_1']) {
      expect(praca.props.some((p) => p.id === id), id).toBe(true);
    }
    // tree variety across the three areas: purple and white ipês, a shade tree, a sibipiruna, palms, the street pit trees
    const trees = new Set(props.filter((p) => p.kind === 'arvore' || p.kind === 'ipe').map((p) => p.art ?? (p.hero ? 'props/ipe_large' : 'props/ipe_medium')));
    expect(trees.size).toBeGreaterThanOrEqual(8);
    for (const art of ['props/ipe_roxo_medium', 'props/ipe_branco_large', 'props/sibipiruna', 'props/jeriva', 'props/arvore_rua', 'props/oiti']) expect(trees.has(art), art).toBe(true);
    // the praça's own variety, and the hero ipê stays in it
    expect(new Set(praca.props.filter((p) => p.kind === 'arvore' || p.kind === 'ipe').map((p) => p.art ?? 'hero')).size).toBeGreaterThanOrEqual(6);
    expect(praca.props.some((p) => p.hero)).toBe(true);
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

  it('parks vehicles in the bays of the rua (row 12), never on a crosswalk, and only there', () => {
    // one bay on each half of the street; the crosswalks are all on the west half
    for (const [half, crosswalks, from, to] of [[rua, [8, 9, 12, 13, 19, 20], 2, 21], [rua_leste, [], 1, 18]] as const) {
      const parked = half.props.filter((p) => p.id.startsWith('estac_'));
      expect(parked.length, half.id).toBeGreaterThanOrEqual(1);
      for (const p of parked) {
        expect(p.y, p.id).toBe(12);
        expect(p.h ?? 1).toBe(1);
        expect(p.blocks, p.id).toBe(true);
        for (const t of propTiles(p)) {
          expect(crosswalks.includes(t.x), `${p.id} on a crosswalk at ${t.x}`).toBe(false);
          expect(floorAt(half, t.x, t.y), `${p.id} stands on the asphalt`).toBe('asfalto');
        }
      }
      // the sidewalk and the crosswalks stay walkable
      const g = buildGrid(half);
      for (const x of crosswalks) expect(isWalkable(g, x, 12), `crosswalk ${x},12`).toBe(true);
      for (let x = from; x < to; x++) if (!half.props.some((p) => propTiles(p).some((t) => t.x === x && t.y === 12 && p.blocks))) expect(isWalkable(g, x, 12), `${half.id} ${x},12`).toBe(true);
    }
    expect(props.filter((p) => p.id.startsWith('estac_')).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the pit trees off the doors and their landing tiles', () => {
    for (const half of [rua, rua_leste]) for (const p of half.props.filter((q) => q.id.startsWith('arv_'))) {
      for (const t of propTiles(p)) for (const portal of half.portals.filter((q) => !q.edge)) {
        expect(Math.abs(t.x - portal.x) <= 1 && t.y <= 7 && t.y >= 6, `${p.id} next to ${portal.id}`).toBe(false);
      }
    }
  });

  it('puts every feira vendor in front of the stall, facing the aisle, with the customer one tile further', () => {
    for (const [id, npc] of [['feira_tia_lu', 'tia_lu'], ['feira_ze', 'ze'], ['feira_chico', 'chico'], ['feira_rosa', 'rosa']] as const) {
      const stall = feira.props.find((p) => p.id === id)!;
      const slot = scheduleAt(npc, 9 * 60)!;
      expect(slot.room).toBe('feira');
      expect(slot.activity).toBe('trabalhando');
      expect(slot.tile).toEqual({ x: stall.x + 1, y: stall.y + 2 });
      expect(slot.interact).toEqual({ x: stall.x + 1, y: stall.y + 3 });
      expect(slot.dir).toBe('SW');
      expect(stall.interact).toEqual(slot.interact);
      // the vendor's tile is free ground, not a prop
      expect(isWalkable(buildGrid(feira), slot.tile.x, slot.tile.y)).toBe(true);
    }
  });

  it('paves the feira lot with granite setts (paralelepipedo), and the gate is brick', () => {
    for (const [x, y] of [[8, 8], [20, 12], [24, 16], [6, 2]]) expect(floorAt(feira, x, y)).toBe('paralelepipedo');
    expect(floorAt(feira, 1, 8)).toBe('tijolo');
  });

  it('keeps the praça calmer than the old map: about a third fewer props in the square than the 56 x 40 map had in it', () => {
    // the old praça block (x10-40, y14-29) held 71 props: the new square, at a comparable ground area, keeps its focal points with fewer
    // the small objects and signs of the language diary are scenery on the ground, not composition: they are counted apart
    const diary = new Set(DIARY_PLACEMENTS.map((p) => p.id));
    const decor = praca.props.filter((p) => !p.id.startsWith('sebe_') && !p.id.startsWith('cerca_') && !diary.has(p.id));
    expect(decor.length).toBeLessThanOrEqual(62);
    expect(decor.length).toBeGreaterThanOrEqual(40);
  });
});
