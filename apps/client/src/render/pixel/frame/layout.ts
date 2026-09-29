/**
 * The hard-coded 30x18 slice of praça used by the P1 style frame (HOWTO Phase 1 step 3).
 * All art keys refer to public/pixel/manifest.json. Positions are tile units; `x, y` is where the sprite's anchor
 * (bottom-centre of its footprint) lands, so (12, 9) is the x-edge between tiles 11 and 12 on the y-edge above row 9.
 */

export const COLS = 30;
export const ROWS = 18;

/** g grass, c calçada (petit-pavé), a asfalto. Rows 0-5 hide behind the shopfronts. */
export const FLOOR: string[] = (() => {
  const rows: string[] = [];
  for (let y = 0; y < ROWS; y++) {
    let r = '';
    for (let x = 0; x < COLS; x++) {
      let c = 'c';
      if (y >= 14) c = 'a';
      if (y >= 8 && y <= 11 && ((x >= 2 && x <= 6) || (x >= 23 && x <= 27))) c = 'g';
      r += c;
    }
    rows.push(r);
  }
  return rows;
})();

export interface Placement {
  key: string;
  x: number;
  y: number;
  flip?: boolean;
}

/** Shopfronts along the north edge; the two outer ones are cut by the map edge. */
export const SHOPS: Placement[] = [
  { key: 'buildings/shop_sapatos', x: -0.5, y: 6 },
  { key: 'buildings/shop_mercado', x: 4.5, y: 6 },
  { key: 'buildings/shop_padaria', x: 9.5, y: 6 },
  { key: 'buildings/shop_flores', x: 14.5, y: 6 },
  { key: 'buildings/shop_lanches', x: 19.5, y: 6 },
  { key: 'buildings/shop_pizzaria', x: 24.5, y: 6 },
  { key: 'buildings/shop_sapatos', x: 29.5, y: 6 },
];

export const PROPS: Placement[] = [
  { key: 'props/banca', x: 22.2, y: 8.0 },
  { key: 'props/fountain', x: 15.0, y: 12.7 },
  { key: 'props/lamp_old', x: 7.2, y: 8.0 },
  { key: 'props/lamp_old', x: 12.2, y: 8.0 },
  { key: 'props/lamp_old', x: 18.0, y: 8.0 },
  { key: 'props/lamp_curve', x: 12.0, y: 13.7 },
  { key: 'props/lamp_curve', x: 18.6, y: 13.7, flip: true },
  { key: 'props/bench_wide', x: 10.0, y: 8.85 },
  { key: 'props/bench_wide', x: 20.4, y: 9.9 },
  { key: 'props/bench_small', x: 23.2, y: 13.5 },
  { key: 'props/trash', x: 13.2, y: 8.0 },
  { key: 'props/trash', x: 5.4, y: 13.6 },
  // planters + hedges + flowers
  { key: 'props/planter_grass', x: 7.5, y: 13.55 },
  { key: 'props/hedge_wide', x: 6.2, y: 11.9 },
  { key: 'props/hedge_wide', x: 3.0, y: 8.7 },
  { key: 'props/bush_flower', x: 5.9, y: 8.6 },
  { key: 'props/bush_flower', x: 2.7, y: 11.7 },
  { key: 'props/hedge_planter', x: 25.5, y: 9.0 },
  { key: 'props/bush_flower', x: 23.7, y: 11.6 },
  { key: 'props/bush_flower', x: 27.1, y: 11.7 },
  { key: 'props/pot_red', x: 4.1, y: 6.9 },
  { key: 'props/pot_teal', x: 9.0, y: 6.95 },
  { key: 'props/pot_red_small', x: 13.9, y: 6.9 },
  { key: 'props/pot_teal', x: 17.9, y: 6.95 },
  { key: 'props/pot_red', x: 24.0, y: 6.9 },
  { key: 'critters/cat', x: 16.6, y: 8.15 },
];

/** Trees: trunk key + foot; the manifest links the overhead canopy and its sway. */
export const TREES: Placement[] = [
  { key: 'props/ipe_large', x: 4.5, y: 10.6 },
  { key: 'props/ipe_medium', x: 25.3, y: 10.5 },
  { key: 'props/ipe_medium', x: 7.5, y: 13.35 },
];

export interface DecalPlacement extends Placement {
  depth?: number;
  /** origin in the sprite (default: manifest anchor) */
  topLeft?: boolean;
}

export const DECALS: DecalPlacement[] = [
  { key: 'decals/sp_mosaic', x: 9.0, y: 9.7, topLeft: true },
  { key: 'decals/crosswalk', x: 6, y: 14, topLeft: true },
  { key: 'decals/crosswalk', x: 22, y: 14, topLeft: true },
  { key: 'decals/manhole', x: 12.0, y: 12.6 },
  { key: 'decals/manhole', x: 18.2, y: 8.7 },
  { key: 'decals/flowers_2', x: 2.3, y: 8.2, topLeft: true },
  { key: 'decals/flowers_0', x: 4.0, y: 10.2, topLeft: true },
  { key: 'decals/flowers_1', x: 2.2, y: 10.7, topLeft: true },
  { key: 'decals/flowers_0', x: 5.3, y: 8.3, topLeft: true },
  { key: 'decals/flowers_2', x: 23.4, y: 9.3, topLeft: true },
  { key: 'decals/flowers_1', x: 25.4, y: 8.3, topLeft: true },
  { key: 'decals/flowers_0', x: 23.3, y: 10.9, topLeft: true },
  { key: 'decals/flowers_1', x: 26.0, y: 10.9, topLeft: true },
];

/** Grime stains that break up the big flat areas (paving and road). */
export const GRIME: { x: number; y: number; k: 0 | 1 | 2 | 3 | 4 }[] = [
  { x: 7.6, y: 7.2, k: 0 }, { x: 12.4, y: 10.3, k: 1 }, { x: 17.2, y: 8.3, k: 2 }, { x: 21.0, y: 12.3, k: 3 },
  { x: 9.6, y: 12.9, k: 4 }, { x: 15.2, y: 7.2, k: 0 }, { x: 25.6, y: 7.3, k: 1 }, { x: 19.6, y: 11.7, k: 3 },
  { x: 3.4, y: 13.1, k: 2 }, { x: 5.2, y: 6.9, k: 1 }, { x: 29.0, y: 12.6, k: 0 }, { x: 0.8, y: 7.4, k: 4 },
  { x: 10.0, y: 15.2, k: 2 }, { x: 20.5, y: 16.6, k: 0 }, { x: 26.5, y: 15.0, k: 1 }, { x: 2.0, y: 17.0, k: 3 },
  { x: 16.5, y: 17.2, k: 4 }, { x: 13.2, y: 14.8, k: 3 },
];

/** Tufts poking out of the paving near the curb and bed edges. */
export const TUFTS: { x: number; y: number; k: 0 | 1 }[] = [
  { x: 3.6, y: 13.9, k: 0 }, { x: 5.4, y: 13.8, k: 1 }, { x: 11.9, y: 13.9, k: 1 }, { x: 14.1, y: 13.95, k: 0 },
  { x: 17.3, y: 13.9, k: 0 }, { x: 20.9, y: 13.85, k: 1 }, { x: 25.1, y: 13.9, k: 0 }, { x: 27.6, y: 13.8, k: 1 },
  { x: 7.5, y: 12.05, k: 0 }, { x: 22.2, y: 12.1, k: 1 }, { x: 1.5, y: 12.2, k: 0 }, { x: 8.3, y: 7.9, k: 1 },
  { x: 20.1, y: 7.95, k: 0 }, { x: 28.2, y: 12.1, k: 1 },
];

export interface CharSpec {
  id: string;
  sheet: string;
  layers: { key: string; ramps: Record<string, string> }[];
}

/** Júlia walks a loop around the fountain. */
export const WALKER_LOOP: [number, number][] = [
  [11.4, 13.2], [18.6, 13.2], [18.6, 7.75], [11.4, 7.75],
];
export const SITTERS: { sheet: string; x: number; y: number; facing: 'S' | 'W' | 'E' | 'N'; bench: number }[] = [
  { sheet: 'char_ze', x: 9.3, y: 8.85, facing: 'S', bench: 0 },
  { sheet: 'char_mara', x: 20.9, y: 9.9, facing: 'S', bench: 1 },
];
export const IDLERS: { sheet: string; x: number; y: number; facing: 'S' | 'W' | 'E' | 'N' }[] = [
  { sheet: 'char_nanda', x: 18.75, y: 8.6, facing: 'E' },
  { sheet: 'char_beto', x: 21.6, y: 12.8, facing: 'E' },
];

export const PIGEONS: { x: number; y: number }[] = [
  { x: 12.4, y: 11.6 }, { x: 13.1, y: 12.4 }, { x: 17.9, y: 12.3 }, { x: 18.7, y: 10.8 }, { x: 10.2, y: 12.9 },
];
export const PIGEON_BOUNDS = { x0: 8, x1: 21, y0: 8.2, y1: 13.8 };

/** Traffic: the road is rows 14..17; lanes at y = 15.5 (west) and 17 (east). */
export const LANES = [
  { y: 15.55, dir: -1 as const, keys: ['vehicles/car_red_l', 'vehicles/car_blue_l'] },
  { y: 17.5, dir: 1 as const, keys: ['vehicles/car_blue_r', 'vehicles/car_red_r'] },
];
