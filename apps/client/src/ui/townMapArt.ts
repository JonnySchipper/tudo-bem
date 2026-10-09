/**
 * The Mapa's picture: the real Vila Ipê, drawn once on an offscreen canvas from the same layouts, atlas, terrain tiles and props the game
 * uses (`planSnapshot`, the title screen's snapshot), each area placed where `townMapData.AREA_AT` puts it. The ground between the areas
 * (lawn, the 875 bus road from the rua leste up to the airport, the corner where the Praia and the Fazenda wait) is one more made-up area
 * drawn the same way, so the seams are the game's own terrain edges.
 *
 * `planTownMap` is pure (a list of draw ops) and unit tested; `townMapCanvas` touches the DOM.
 */
import { ROOMS, type PropDef, type RoomDef } from '@tudobem/shared';
import type { Manifest } from '../render/pixel/manifest';
import { T } from '../render/pixel/coords';
import { loadSnapshotAssets, paintSnapshot, planSnapshot, type SnapOp, type SnapshotPlan } from './introSnapshot';
import { AERO_FRONT, AERO_KEEP, AERO_MAP_ROWS, AREA_AT, MAP_COLS, MAP_H, MAP_ROWS, MAP_W, SOON_AT, type MapArea } from './townMapData';

/** The map's light: early afternoon, the town at its clearest. */
export const MAP_MINUTE = 14 * 60;

type Paint = (ch: string, x0: number, y0: number, x1: number, y1: number) => void;

function grid(cols: number, rows: number, base: string, paintAll: (paint: Paint) => void): string[] {
  const g = Array.from({ length: rows }, () => Array.from({ length: cols }, () => base));
  paintAll((ch, x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y]![x] = ch;
  });
  return g.map((r) => r.join(''));
}

const blank = (def: RoomDef, id: string, cols: number, rows: number, floor: string[], props: PropDef[]): RoomDef => ({ ...def, id: id as RoomDef['id'], cols, rows, floor, props, portals: [], npcs: [] });

/** The Aeroporto, shortened for the map: the runway and the terminal's first rows, then its front (the low glass, the curb, the bus). */
export function aeroportoForMap(): RoomDef {
  const def = ROOMS.aeroporto;
  const cut = AERO_FRONT - AERO_KEEP;
  const props = def.props.flatMap((p) => {
    const bottom = p.y + (p.h ?? 1);
    if (bottom <= AERO_KEEP - 1) return [p];
    if (p.y >= AERO_FRONT) return [{ ...p, y: p.y - cut }];
    return [];
  });
  return blank(def, 'mapa_aeroporto', def.cols, AERO_MAP_ROWS, [...def.floor.slice(0, AERO_KEEP), ...def.floor.slice(AERO_FRONT)], props);
}

/** The rua leste, with its east end open: the street goes on to the airport road (the barrier that closes the area in the game is left out). */
function ruaLesteForMap(): RoomDef {
  const def = ROOMS.rua_leste;
  return { ...def, props: def.props.filter((p) => !(p.kind === 'cerca' && p.art === 'cerca_rua')) };
}

/** The sand pit decal (top-left anchored, 7 x 5 tiles) with its top-left on tile x, y. */
const sandAt = (id: string, x: number, y: number): PropDef => ({ id, kind: 'cenario', art: 'decals/areia_pg', x, y: y - 1, w: 1, h: 1, ox: -8, blocks: false });

const prop = (id: string, kind: PropDef['kind'], art: string, x: number, y: number, w = 1, h = 1): PropDef => ({ id, kind, art, x, y, w, h, blocks: false });

/** The ground between the areas, the whole map wide: lawn, the bus road and the corner of the Praia and the Fazenda. */
export function groundForMap(): RoomDef {
  const road = AREA_AT.aeroporto[0] - 4; // the road turns north-south in the 4 columns between the rua leste and the airport
  const roadRow = AERO_MAP_ROWS - 1; // the airport's own curb lane, carried on east and west
  const s = SOON_AT.col;
  const floor = grid(MAP_COLS, MAP_ROWS, 'g', (paint) => {
    paint('c', road, 6, road + 3, 7); // the rua's north sidewalk, to the corner
    paint('a', road, 8, road + 3, roadRow + 2); // the street turns south between the rua leste and the airport
    paint('a', road, roadRow, MAP_COLS - 1, roadRow + 2); // and runs east under the airport, on past the feira
    paint('c', s, roadRow + 3, MAP_COLS - 1, roadRow + 3); // a sidewalk past the feira's corner
  });
  const props: PropDef[] = [
    // trees on the lawn north of the corner, and along the left edge of the praça
    prop('m_jeriva_n', 'arvore', 'props/jeriva', road, 2, 2),
    prop('m_arvore_n', 'arvore', 'props/arvore_rua', road + 2, 4, 2),
    // the Praia: a stretch of sand with palms, towels and the coconut cart, under the end of the road
    sandAt('m_areia', s + 1, SOON_AT.praia + 3),
    prop('m_coco', 'cenario', 'props/carrinho_coco', s + 6, SOON_AT.praia + 2, 3, 1),
    prop('m_palm_a', 'arvore', 'props/jeriva', s, SOON_AT.praia + 3, 2),
    prop('m_toalha_a', 'cenario', 'decals/toalha_azul', s + 2, SOON_AT.praia + 6, 2, 2),
    prop('m_toalha_b', 'cenario', 'decals/toalha_amarela', s + 5, SOON_AT.praia + 7, 2, 2),
    prop('m_palm_b', 'arvore', 'props/jeriva_b', s + 7, SOON_AT.praia + 9, 2),
    // the Fazenda: a fenced plot of furrows, crates and sacks of the harvest, and a mango tree
    { ...prop('m_cerca', 'cerca', 'cerca_jardim', s, SOON_AT.fazenda + 1, 7, 7), blocks: true },
    ...[0, 1, 2, 3, 4].flatMap((i) => [{ ...prop(`m_sulco_${i}`, 'cenario', 'decals/dirt_2', s + 2, SOON_AT.fazenda + 2 + i, 3), oy: -8 }]),
    prop('m_cx_a', 'cenario', 'feira/cx_tomate', s + 7, SOON_AT.fazenda + 3),
    prop('m_cx_b', 'cenario', 'feira/cx_repolho', s + 8, SOON_AT.fazenda + 3),
    prop('m_cx_c', 'cenario', 'feira/cx_melancia', s + 7, SOON_AT.fazenda + 5),
    prop('m_sacos', 'cenario', 'feira/sacos', s + 7, SOON_AT.fazenda + 7, 2),
    prop('m_manga', 'arvore', 'props/manga', s + 1, SOON_AT.fazenda + 9, 2),
    prop('m_manga_b', 'arvore', 'props/manga', s + 6, SOON_AT.fazenda + 9, 2),
  ];
  return blank(ROOMS.praca, 'mapa', MAP_COLS, MAP_ROWS, floor, props);
}

const shift = (ops: SnapOp[], area: readonly [number, number]): SnapOp[] => ops.map((o) => ({ ...o, x: o.x + area[0] * T, y: o.y + area[1] * T }));

/**
 * Everything the map draws, in paint order: the ground between the areas, then each area on its own layer (north to south, so what stands
 * at the top of an area overlaps the one above it).
 */
export function planTownMap(m: Manifest, minute = MAP_MINUTE): SnapshotPlan {
  const areas: [MapArea, RoomDef][] = [
    ['aeroporto', aeroportoForMap()],
    ['rua', ROOMS.rua],
    ['rua_leste', ruaLesteForMap()],
    ['praca', ROOMS.praca],
    ['feira', ROOMS.feira],
  ];
  const ground = planSnapshot(groundForMap(), m, minute);
  const ops = [...ground.ops, ...areas.flatMap(([id, def]) => shift(planSnapshot(def, m, minute).ops, AREA_AT[id]))];
  return { width: MAP_W, height: MAP_H, ops, cast: ground.cast, grade: ground.grade, fill: ground.fill };
}

let cached: Promise<HTMLCanvasElement> | null = null;

/** The map's picture, built once (it reuses the atlases the game has already loaded, from the browser cache). */
export function townMapCanvas(): Promise<HTMLCanvasElement> {
  // a failed load (offline for a moment) is tried again on the next opening
  cached ??= loadSnapshotAssets()
    .then((a) => paintSnapshot(planTownMap(a.manifest), a))
    .catch((e: unknown) => {
      cached = null;
      throw e;
    });
  return cached;
}
