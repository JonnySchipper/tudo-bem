/**
 * Builds the dual-grid terrain of a floor as Phaser Tilemap layers (HOWTO §5.6): one layer per terrain, drawn at a half tile offset.
 * Shared by the game's WorldScene and the style frame, so both draw terrain with one implementation.
 */
import Phaser from 'phaser';
import type { Manifest } from './manifest';
import { TERRAIN_PRIORITY, maskAt, phasedIndex, phasedIndex2, tileIndex } from './terrain';
import { T } from './coords';
import { DEPTH } from './props';

/** A flush terrain laid over a slab terrain counts as that slab in the slab's own mask (bricks inlaid in calçada: no curb between them). */
export const FLUSH_ON_SLAB: Record<string, string> = { t: 'c' };

const LAYER_RANK = { flat: 0, slab: 1, flush: 2 } as const;

export interface TerrainResult {
  map: Phaser.Tilemaps.Tilemap;
  layers: Phaser.Tilemaps.TilemapLayer[];
  /** floor chars that have a layer in the manifest */
  drawn: string[];
}

/**
 * `terrainKey` is the loaded tileset image key. `outside` (optional) is what counts as the terrain beyond the map edge: pass a char that
 * is no terrain (for example 'x') to get proper curbs at the map border, or omit it to let the nearest tile continue off the map.
 * `wrap` lets the caller route every object through its camera filter (the two-camera lighting setup).
 */
export function buildTerrainLayers(
  scene: Phaser.Scene,
  floor: readonly string[],
  terrain: Manifest['terrain'],
  terrainKey: string,
  opts: { outside?: string; wrap?: <G extends Phaser.GameObjects.GameObject>(o: G) => G; substitute?: Record<string, string> } = {},
): TerrainResult {
  const cols = floor[0]?.length ?? 0;
  const rows = floor.length;
  const wrap = opts.wrap ?? (<G extends Phaser.GameObjects.GameObject>(o: G) => o);
  const map = scene.make.tilemap({ tileWidth: T, tileHeight: T, width: cols + 1, height: rows + 1 });
  const ts = map.addTilesetImage('terrain', terrainKey, T, T, terrain.margin, terrain.spacing);
  if (!ts) throw new Error('terrain tileset failed');
  // a floor char with no art of its own is drawn as its substitute terrain (for example brick pavers as calçada)
  const sub = opts.substitute ?? {};
  const view = floor.map((row) => [...row].map((ch) => (terrain.layers[ch] ? ch : (sub[ch] && terrain.layers[sub[ch]] ? sub[ch] : ch))).join(''));
  // flat underlays first (grass, asphalt), then slab terrains on top (docs/lifesim/DECISIONS.md, Phase 1 decision 5)
  const order = [...TERRAIN_PRIORITY].filter((c) => terrain.layers[c] && view.some((r) => r.includes(c)));
  order.sort((a, b) => LAYER_RANK[terrain.layers[a].edge] - LAYER_RANK[terrain.layers[b].edge]);
  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  order.forEach((ch, li) => {
    const def = terrain.layers[ch];
    // slab layers see the flush terrains inlaid in them as themselves (no curb between calçada and its brick path)
    const maskView = def.edge === 'slab' ? view.map((r) => [...r].map((c) => (FLUSH_ON_SLAB[c] === ch && terrain.layers[c] ? ch : c)).join('')) : view;
    const layer = map.createBlankLayer(`terrain_${ch}`, ts, -T / 2, -T / 2, cols + 1, rows + 1);
    if (!layer) throw new Error('layer failed ' + ch);
    layer.setDepth(DEPTH.terrain + li);
    wrap(layer);
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const mask = maskAt(maskView, ch, i, j, opts.outside);
        const idx =
          def.edge === 'flat'
            ? tileIndex(def.first, mask, i, j, def.variants)
            : def.edge === 'flush'
              ? phasedIndex2(def.first, mask, i, j, def.phases, def.phasesY ?? 1)
              : phasedIndex(def.first, mask, i, def.phases);
        if (idx >= 0) layer.putTileAt(idx, i, j);
      }
    }
    layers.push(layer);
  });
  return { map, layers, drawn: order };
}
