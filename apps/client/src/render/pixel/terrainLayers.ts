/**
 * Builds the dual-grid terrain of a floor as Phaser Tilemap layers (HOWTO §5.6): one layer per terrain, drawn at a half tile offset.
 * Shared by the game's WorldScene and the style frame, so both draw terrain with one implementation.
 */
import Phaser from 'phaser';
import type { Manifest } from './manifest';
import { TERRAIN_PRIORITY, maskAt, phasedIndex, tileIndex } from './terrain';
import { T } from './coords';
import { DEPTH } from './props';

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
  order.sort((a, b) => Number(terrain.layers[a].edge === 'slab') - Number(terrain.layers[b].edge === 'slab'));
  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  order.forEach((ch, li) => {
    const def = terrain.layers[ch];
    const layer = map.createBlankLayer(`terrain_${ch}`, ts, -T / 2, -T / 2, cols + 1, rows + 1);
    if (!layer) throw new Error('layer failed ' + ch);
    layer.setDepth(DEPTH.terrain + li);
    wrap(layer);
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const mask = maskAt(view, ch, i, j, opts.outside);
        const idx = def.edge === 'slab' ? phasedIndex(def.first, mask, i, def.phases) : tileIndex(def.first, mask, i, j, def.variants);
        if (idx >= 0) layer.putTileAt(idx, i, j);
      }
    }
    layers.push(layer);
  });
  return { map, layers, drawn: order };
}
