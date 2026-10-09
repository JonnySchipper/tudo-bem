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

type PatchKind = 'a' | 'b' | 'c' | 'd' | 'e';

/** Hand-placed ground dressing of one outdoor room (split into areas). Tile positions are fractional. */
interface V2Room {
  /** sand pit (top-left tile and pixel size) */
  sand?: { x: number; y: number; w: number; h: number };
  /** picnic towels (decal key, tile position) */
  towels: { key: string; x: number; y: number }[];
  /** worn dirt patches centred on a tile position: spots in front of benches, around the tables, along the swings */
  patches: { x: number; y: number; k: PatchKind }[];
  hopscotch?: { x: number; y: number };
  bowl?: { x: number; y: number };
  /** what the market leaves on the paving: the tile rectangle (inclusive) to scatter on */
  market?: { x0: number; y0: number; x1: number; y1: number };
}

const V2: Record<string, V2Room> = {
  praca: {
    sand: { x: 3, y: 15, w: 112, h: 80 },
    towels: [
      { key: 'decals/toalha_azul', x: 5.2, y: 6.1 },
      { key: 'decals/toalha_amarela', x: 27.4, y: 7.6 },
      { key: 'decals/toalha_verde', x: 24.5, y: 14.4 },
    ],
    patches: [
      // in front of the benches facing the lawns
      { x: 11.8, y: 7.7, k: 'b' },
      { x: 24.8, y: 21.7, k: 'a' },
      // around the domino and chess tables
      { x: 22.5, y: 18.6, k: 'd' },
      { x: 26.5, y: 18.6, k: 'd' },
      { x: 24.5, y: 18.2, k: 'e' },
      // the desire line from the brick bar to the tables
      { x: 20.4, y: 15.4, k: 'a' },
      { x: 21.4, y: 16.6, k: 'e' },
      // the way into the playground and the one from the bust to the bench
      { x: 10.2, y: 17.6, k: 'c' },
      { x: 10.6, y: 18.9, k: 'a' },
      { x: 9.4, y: 7.2, k: 'e' },
      { x: 10.8, y: 7.8, k: 'c' },
      // the dog corner
      { x: 3.2, y: 22.0, k: 'b' },
      { x: 2.0, y: 20.5, k: 'e' },
    ],
    hopscotch: { x: 24, y: 22 },
    bowl: { x: 4.4, y: 21.8 },
  },
  rua: { towels: [], patches: [], hopscotch: { x: 15, y: 13 } }, // chalk on the brick path down to the praça
  rua_leste: { towels: [], patches: [] },
  feira: { towels: [], patches: [], market: { x0: 3, y0: 2, x1: 30, y1: 18 } },
};

/** Pixel sizes of the hand-placed dirt trails (the manifest is not available here). */
const DECAL_PX: Record<string, [number, number]> = { a: [22, 14], b: [30, 16], c: [16, 22], d: [26, 18], e: [14, 12] };

/** Tiles (`"x,y"`) covered by V2's hand-placed ground decals (sand pit, towels, dirt trails, hopscotch, bowl), so V1's lawn dressing keeps off them. */
export function v2DecalTiles(def: RoomDef): Set<string> {
  const tiles = new Set<string>();
  const v = V2[def.id];
  if (!def.outdoor || !v) return tiles;
  const rect = (px: number, py: number, w: number, h: number) => {
    for (let ty = Math.floor(py / T); ty <= Math.floor((py + h - 1) / T); ty++) for (let tx = Math.floor(px / T); tx <= Math.floor((px + w - 1) / T); tx++) tiles.add(`${tx},${ty}`);
  };
  if (v.sand) rect(v.sand.x * T, v.sand.y * T, v.sand.w, v.sand.h);
  for (const t of v.towels) rect(Math.round(t.x * T), Math.round(t.y * T), 28, 28);
  for (const p of v.patches) {
    const [w, h] = DECAL_PX[p.k];
    rect(Math.round((p.x - 0.7) * T), Math.round((p.y - 0.45) * T), w, h);
  }
  if (v.hopscotch) rect(v.hopscotch.x * T, v.hopscotch.y * T, 64, 16);
  if (v.bowl) rect(Math.round(v.bowl.x * T) - 4, Math.round(v.bowl.y * T) - 3, 8, 6);
  return tiles;
}

export function v2Decals(def: RoomDef, has: (key: string) => boolean): Decal[] {
  const v = V2[def.id];
  if (!def.outdoor || !v) return [];
  const out: Decal[] = [];
  const add = (d: Decal) => {
    if (has(d.key)) out.push(d);
  };
  const tl = (key: string, tx: number, ty: number, depth: number) => add({ key, x: Math.round(tx * T), y: Math.round(ty * T), origin: 'tl', depth });

  if (v.sand) tl('decals/areia_pg', v.sand.x, v.sand.y, DEPTH_PAD);
  for (const t of v.towels) tl(t.key, t.x, t.y, DEPTH_PAD + 1);
  for (const p of v.patches) tl(`decals/trilha_${p.k}`, p.x - 0.7, p.y - 0.45, DEPTH_PATH);
  if (v.hopscotch) tl('decals/amarelinha', v.hopscotch.x, v.hopscotch.y, DEPTH_CHALK);
  if (v.bowl) add({ key: 'decals/tigela', x: Math.round(v.bowl.x * T), y: Math.round(v.bowl.y * T), origin: 'anchor', depth: DEPTH_CHALK });

  // the market: leaves, cardboard and squashed fruit on the setts of the lot, away from the stalls' fronts
  const m = v.market;
  if (m) {
    const occupied = new Set<string>();
    // a fence's footprint is the whole lot it encloses, but only its ring is solid: the setts inside stay dressable
    for (const p of def.props) for (const t of propTiles(p)) if (p.kind !== 'cerca' || t.x === p.x || t.y === p.y || t.x === p.x + (p.w ?? 1) - 1 || t.y === p.y + (p.h ?? 1) - 1) occupied.add(`${t.x},${t.y}`);
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) {
        if (def.floor[y]?.[x] !== 'p' || occupied.has(`${x},${y}`)) continue;
        const r = rnd(x, y, 71);
        const at = (dx: number, dy: number) => ({ x: Math.round((x + 0.5) * T + dx), y: Math.round((y + 0.5) * T + dy) });
        if (r < 0.03) add({ key: `decals/feira_lixo_${Math.floor(rnd(x, y, 72) * 3)}`, ...at(0, 0), origin: 'anchor', depth: DEPTH_LITTER });
        else if (r < 0.05) add({ key: `decals/feira_repolho_${Math.floor(rnd(x, y, 73) * 2)}`, ...at((rnd(x, y, 74) - 0.5) * 6, (rnd(x, y, 75) - 0.5) * 6), origin: 'anchor', depth: DEPTH_LITTER + 1 });
        else if (r < 0.062) add({ key: `decals/feira_mancha_${Math.floor(rnd(x, y, 76) * 3)}`, ...at(0, 2), origin: 'anchor', depth: DEPTH_STAIN });
        else if (r < 0.068) add({ key: 'decals/feira_caixa', ...at(0, 0), origin: 'anchor', depth: DEPTH_LITTER + 2 });
      }
    }
  }
  return out;
}
