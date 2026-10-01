/**
 * The dual-grid terrain of a floor as a plain list of tiles (HOWTO §5.6), with no Phaser: `terrainLayers.ts` puts the tiles on Phaser
 * tilemap layers, the intro snapshot paints them on a 2D canvas. One implementation of the layer order, substitutes and masks.
 */
import type { Manifest } from './manifest';
import { TERRAIN_PRIORITY, maskAt, phasedIndex2, tileIndex } from './terrain';

/** A flush terrain laid over a slab terrain counts as that slab in the slab's own mask (bricks inlaid in calçada: no curb between them). */
export const FLUSH_ON_SLAB: Record<string, string> = { t: 'c' };

const LAYER_RANK = { flat: 0, slab: 1, flush: 2 } as const;

export interface TerrainTile {
  /** index of the layer in draw order (0 = bottom) */
  layer: number;
  ch: string;
  /** display-grid cell: the tile is drawn at ((i - 0.5) * T, (j - 0.5) * T) */
  i: number;
  j: number;
  /** index in the tileset */
  idx: number;
}

export function terrainTiles(
  floor: readonly string[],
  terrain: Manifest['terrain'],
  opts: { outside?: string; substitute?: Record<string, string> } = {},
): { tiles: TerrainTile[]; order: string[] } {
  const cols = floor[0]?.length ?? 0;
  const rows = floor.length;
  const sub = opts.substitute ?? {};
  const view = floor.map((row) => [...row].map((ch) => (terrain.layers[ch] ? ch : sub[ch] && terrain.layers[sub[ch]] ? sub[ch] : ch)).join(''));
  const order = [...TERRAIN_PRIORITY].filter((c) => terrain.layers[c] && view.some((r) => r.includes(c)));
  order.sort((a, b) => LAYER_RANK[terrain.layers[a].edge] - LAYER_RANK[terrain.layers[b].edge]);
  const tiles: TerrainTile[] = [];
  order.forEach((ch, layer) => {
    const def = terrain.layers[ch];
    const maskView = def.edge === 'slab' ? view.map((r) => [...r].map((c) => (FLUSH_ON_SLAB[c] === ch && terrain.layers[c] ? ch : c)).join('')) : view;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const mask = maskAt(maskView, ch, i, j, opts.outside);
        const idx = def.edge === 'flat' ? tileIndex(def.first, mask, i, j, def.variants) : phasedIndex2(def.first, mask, i, j, def.phases, def.phasesY ?? 1);
        if (idx >= 0) tiles.push({ layer, ch, i, j, idx });
      }
    }
  });
  return { tiles, order };
}
