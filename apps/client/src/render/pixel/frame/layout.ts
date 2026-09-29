/**
 * The hard-coded 30x18 slice of praça used by the P1 style frame (HOWTO Phase 1 step 3).
 * All art keys refer to public/pixel/manifest.json. Positions are tile units; `foot` is where the sprite's anchor
 * (bottom-centre of its footprint) lands, so (12, 9) means the bottom edge of row 8, x centre of tile 11.5..12.5 edge.
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

export interface PropPlacement {
  key: string;
  /** tile units, anchor point */
  x: number;
  y: number;
  /** flip horizontally */
  flip?: boolean;
  /** id for hit tests / lights later */
  id?: string;
}

export const SHOPS: { key: string; x: number }[] = [
  { key: 'buildings/shop_padaria', x: 2.5 },
  { key: 'buildings/shop_mercado', x: 7.5 },
  { key: 'buildings/shop_flores', x: 12.5 },
  { key: 'buildings/shop_lanches', x: 17.5 },
  { key: 'buildings/shop_sapatos', x: 22.5 },
  { key: 'buildings/shop_pizzaria', x: 27.5 },
];
export const SHOP_BASE_Y = 6;

export const PROPS: PropPlacement[] = [
  { key: 'props/banca', x: 21.5, y: 8.0, id: 'banca' },
  { key: 'props/lamp_old', x: 7.0, y: 8.0, id: 'lamp1' },
  { key: 'props/lamp_old', x: 16.5, y: 8.0, id: 'lamp2' },
  { key: 'props/lamp_curve', x: 28.5, y: 8.0, id: 'lamp3' },
  { key: 'props/lamp_curve', x: 1.5, y: 13.6, id: 'lamp4' },
  { key: 'props/bench_wide', x: 10.5, y: 9.4, id: 'bench1' },
  { key: 'props/bench_wide', x: 19.5, y: 9.4, id: 'bench2' },
  { key: 'props/bench_small', x: 14.0, y: 12.6, id: 'bench3' },
  { key: 'props/trash', x: 12.4, y: 7.8 },
  { key: 'props/bush_round', x: 3.5, y: 12.0 },
  { key: 'props/bush_round', x: 25.5, y: 12.0 },
];

/** Trees: trunk sprite key + foot position. The manifest links the canopy overhead sprite. */
export const TREES: PropPlacement[] = [
  { key: 'props/ipe_large', x: 4.5, y: 10.6, id: 'ipe1' },
  { key: 'props/ipe_medium', x: 25.5, y: 10.4, id: 'ipe2' },
  { key: 'props/ipe_medium', x: 8.5, y: 13.3, id: 'ipe3' },
];

export interface CharPlacement {
  id: string;
  name: string;
  /** layer keys, back to front */
  layers: { key: string; ramps: Partial<Record<'skin' | 'hair' | 'top' | 'bottom' | 'shoes', string>> }[];
}

export const WALKER_LOOP: [number, number][] = [
  [12.5, 11.4], [17.5, 11.4], [17.5, 8.6], [12.5, 8.6],
];
export const SITTER = { x: 11.5, y: 9.05, facing: 'S' as const };
export const IDLER = { x: 22.2, y: 9.6, facing: 'W' as const };

export const PIGEONS: { x: number; y: number }[] = [
  { x: 15.2, y: 10.0 }, { x: 16.4, y: 10.6 }, { x: 14.2, y: 10.9 }, { x: 18.9, y: 12.4 },
];

export const CROSSWALK = { x: 13, y: 14, w: 2 };
