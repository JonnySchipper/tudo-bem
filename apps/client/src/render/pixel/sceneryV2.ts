/**
 * Ground dressing added by the V2 composition pass (pure, deterministic): the playground's sand pit, picnic towels, worn dirt patches in the
 * grass (desire lines to the benches, the tables and the swings), a hopscotch on the sidewalk, a dog's bowl, and what the market leaves on
 * the asphalt. `scenery.ts` appends these to its own decals; every key is optional (a missing sprite is skipped).
 */
import type { RoomDef } from '@tudobem/shared';
import { propTiles } from '@tudobem/shared';
import { T } from './coords';
import { hash2 } from './terrain';
import type { Decal } from './scenery';

const DEPTH_PAD = -4990; // sand, towels: flat on the ground, above the terrain, below stains and flowers
const DEPTH_PATH = -4980;
const DEPTH_CHALK = -4970;
const DEPTH_LITTER = -4940;
const DEPTH_STAIN = -4960; // damp stains lie under the litter

const rnd = (x: number, y: number, seed: number) => hash2(x, y, seed) / 4294967296;

/** Tile positions (fractional) where a worn dirt patch is centred: spots in front of benches, around the tables, along the swings. */
const PATCHES: { x: number; y: number; k: 'a' | 'b' | 'c' | 'd' | 'e' }[] = [
  // in front of the benches facing the lawns
  { x: 14.6, y: 19.7, k: 'b' },
  { x: 31.8, y: 20.1, k: 'a' },
  // around the domino and chess tables
  { x: 33.5, y: 26.6, k: 'd' },
  { x: 37.5, y: 26.6, k: 'd' },
  { x: 35.5, y: 26.2, k: 'e' },
  // the desire line from the brick axis to the tables
  { x: 30.4, y: 26.4, k: 'a' },
  { x: 31.4, y: 27.2, k: 'e' },
  // the way into the playground and the one from the bust to the bench
  { x: 19.2, y: 25.6, k: 'c' },
  { x: 18.6, y: 26.9, k: 'a' },
  { x: 19.4, y: 17.2, k: 'e' },
  { x: 18.8, y: 18.3, k: 'c' },
  // west lawn: the dog corner
  { x: 3.2, y: 28.2, k: 'b' },
  { x: 2.0, y: 27.0, k: 'e' },
];

/** Pixel sizes of the hand-placed dirt trails (the manifest is not available here). */
const DECAL_PX: Record<string, [number, number]> = { a: [22, 14], b: [30, 16], c: [16, 22], d: [26, 18], e: [14, 12] };

/** Tiles (`"x,y"`) covered by V2's hand-placed ground decals (sand pit, towels, dirt trails, hopscotch, bowl), so V1's lawn dressing keeps off them. */
export function v2DecalTiles(def: RoomDef): Set<string> {
  const tiles = new Set<string>();
  if (!def.outdoor) return tiles;
  const rect = (px: number, py: number, w: number, h: number) => {
    for (let ty = Math.floor(py / T); ty <= Math.floor((py + h - 1) / T); ty++) for (let tx = Math.floor(px / T); tx <= Math.floor((px + w - 1) / T); tx++) tiles.add(`${tx},${ty}`);
  };
  rect(11 * T, 24 * T, 112, 80);
  for (const [x, y] of [[13.2, 18.1], [37.2, 23.1], [4.2, 24.3]]) rect(Math.round(x * T), Math.round(y * T), 28, 28);
  for (const p of PATCHES) {
    const [w, h] = DECAL_PX[p.k];
    rect(Math.round((p.x - 0.7) * T), Math.round((p.y - 0.45) * T), w, h);
  }
  rect(13 * T, 31 * T, 64, 16);
  rect(Math.round(3.4 * T) - 4, Math.round(28.8 * T) - 3, 8, 6);
  return tiles;
}

export function v2Decals(def: RoomDef, has: (key: string) => boolean): Decal[] {
  if (!def.outdoor) return [];
  const out: Decal[] = [];
  const add = (d: Decal) => {
    if (has(d.key)) out.push(d);
  };
  const tl = (key: string, tx: number, ty: number, depth: number) => add({ key, x: Math.round(tx * T), y: Math.round(ty * T), origin: 'tl', depth });

  tl('decals/areia_pg', 11, 24, DEPTH_PAD);
  // picnic towels under the hero ipê, near the tables, and a third by the south bench
  tl('decals/toalha_azul', 13.2, 18.1, DEPTH_PAD + 1);
  tl('decals/toalha_amarela', 37.2, 23.1, DEPTH_PAD + 1);
  tl('decals/toalha_verde', 4.2, 24.3, DEPTH_PAD + 1);
  for (const p of PATCHES) tl(`decals/trilha_${p.k}`, p.x - 0.7, p.y - 0.45, DEPTH_PATH);
  tl('decals/amarelinha', 13, 31, DEPTH_CHALK);
  add({ key: 'decals/tigela', x: Math.round(3.4 * T), y: Math.round(28.8 * T), origin: 'anchor', depth: DEPTH_CHALK });

  // the market: leaves, cardboard and squashed fruit on the asphalt of the lot, away from the stalls' fronts
  const occupied = new Set<string>();
  for (const p of def.props) for (const t of propTiles(p)) occupied.add(`${t.x},${t.y}`);
  for (let y = 15; y < 29; y++) {
    for (let x = 42; x < 55; x++) {
      if (def.floor[y]?.[x] !== 'p' || occupied.has(`${x},${y}`)) continue;
      const r = rnd(x, y, 71);
      const at = (dx: number, dy: number) => ({ x: Math.round((x + 0.5) * T + dx), y: Math.round((y + 0.5) * T + dy) });
      if (r < 0.04) add({ key: `decals/feira_lixo_${Math.floor(rnd(x, y, 72) * 3)}`, ...at(0, 0), origin: 'anchor', depth: DEPTH_LITTER });
      else if (r < 0.065) add({ key: `decals/feira_repolho_${Math.floor(rnd(x, y, 73) * 2)}`, ...at((rnd(x, y, 74) - 0.5) * 6, (rnd(x, y, 75) - 0.5) * 6), origin: 'anchor', depth: DEPTH_LITTER + 1 });
      else if (r < 0.08) add({ key: `decals/feira_mancha_${Math.floor(rnd(x, y, 76) * 3)}`, ...at(0, 2), origin: 'anchor', depth: DEPTH_STAIN });
      else if (r < 0.088) add({ key: 'decals/feira_caixa', ...at(0, 0), origin: 'anchor', depth: DEPTH_LITTER + 2 });
    }
  }
  // chalk price scribbles on the setts in front of each vendor's board (one tile south of the blackboard), and a damp stain by the fish and flower stalls
  for (const [i, p] of def.props.filter((q) => q.id.startsWith('lousa_')).entries()) {
    const tx = p.x, ty = p.y + 1;
    if (def.floor[ty]?.[tx] !== 'p' || occupied.has(`${tx},${ty}`)) continue;
    add({ key: `decals/feira_giz_${i % 5}`, x: Math.round((tx + 0.5) * T + 2), y: Math.round((ty + 0.5) * T + 3), origin: 'anchor', depth: DEPTH_CHALK });
  }
  return out;
}
