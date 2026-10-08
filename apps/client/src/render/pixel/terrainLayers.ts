/**
 * Builds the dual-grid terrain of a floor as Phaser Tilemap layers (HOWTO §5.6): one layer per terrain, drawn at a half tile offset.
 * Shared by the game's WorldScene and the style frame, so both draw terrain with one implementation.
 */
import Phaser from 'phaser';
import type { Manifest } from './manifest';
import { terrainTiles } from './terrainPlan';
import { T } from './coords';
import { DEPTH } from './props';

export { FLUSH_ON_SLAB } from './terrainPlan';

export interface TerrainResult {
  map: Phaser.Tilemaps.Tilemap;
  layers: Phaser.Tilemaps.TilemapLayer[];
  /** floor chars that have a layer in the manifest */
  drawn: string[];
}

/**
 * `terrainKey` is the loaded tileset image key. `outside` (optional) is what counts as the terrain beyond the map edge: pass a char that
 * is no terrain (for example 'x') to get proper curbs at the map border, or omit it to let the nearest tile continue off the map.
 * `wrap` lets the caller route every object through its camera filter (the two-camera lighting setup). `offset` (tiles) is where floor
 * char (0, 0) lands: an open-air map passes its surround (surround.ts), which starts `margin` tiles west and north of the map.
 */
export function buildTerrainLayers(
  scene: Phaser.Scene,
  floor: readonly string[],
  terrain: Manifest['terrain'],
  terrainKey: string,
  opts: { outside?: string; wrap?: <G extends Phaser.GameObjects.GameObject>(o: G) => G; substitute?: Record<string, string>; offset?: number } = {},
): TerrainResult {
  const off = (opts.offset ?? 0) * T;
  const cols = floor[0]?.length ?? 0;
  const rows = floor.length;
  const wrap = opts.wrap ?? (<G extends Phaser.GameObjects.GameObject>(o: G) => o);
  const map = scene.make.tilemap({ tileWidth: T, tileHeight: T, width: cols + 1, height: rows + 1 });
  const ts = map.addTilesetImage('terrain', terrainKey, T, T, terrain.margin, terrain.spacing);
  if (!ts) throw new Error('terrain tileset failed');
  // flat underlays first (grass, asphalt), then slab terrains on top (docs/lifesim/DECISIONS.md, Phase 1 decision 5)
  const { tiles, order } = terrainTiles(floor, terrain, { outside: opts.outside, substitute: opts.substitute });
  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  order.forEach((ch, li) => {
    const layer = map.createBlankLayer(`terrain_${ch}`, ts, off - T / 2, off - T / 2, cols + 1, rows + 1);
    if (!layer) throw new Error('layer failed ' + ch);
    layer.setDepth(DEPTH.terrain + li);
    wrap(layer);
    layers.push(layer);
  });
  for (const t of tiles) layers[t.layer].putTileAt(t.idx, t.i, t.j);
  return { map, layers, drawn: order };
}
