/**
 * Ground dressing and wires of the outdoor map (Phase 5): crosswalks, lane dashes, the São Paulo mosaic, manholes, wildflowers, grass tufts,
 * grime, and the overhead wires between the utility poles. Purely visual and deterministic (no Phaser): the scene turns the lists into
 * sprites, the tests check that every key exists in the manifest and that nothing lands on the wrong terrain.
 */
import type { PropDef, RoomDef } from '@tudobem/shared';
import { propTiles } from '@tudobem/shared';
import { T } from './coords';
import { hash2 } from './terrain';
import { v2Decals, v2DecalTiles } from './sceneryV2';

export interface Decal {
  key: string;
  /** world px: the top-left corner (`tl`) or the sprite anchor (`anchor`) */
  x: number;
  y: number;
  origin: 'tl' | 'anchor';
  depth: number;
}

export interface WireRun {
  /** world px of the pole attach point where the run starts, then the sprites laid end to end */
  x: number;
  y: number;
  keys: string[];
}

export interface Scenery {
  decals: Decal[];
  wires: WireRun[];
}

const DEPTH_MOSAIC = -5000;
const DEPTH_PATCH = -4990;
const DEPTH_DIRT = -4980;
const DEPTH_GRIME = -4950;
const DEPTH_FLOWERS = -4800;
const DEPTH_CLOVER = -4600;
const DEPTH_TUFT = -4400;

const rnd = (x: number, y: number, seed: number) => hash2(x, y, seed) / 4294967296;

/** Ground dressing placed by hand, per outdoor room (split into areas): the lane rows of the streets, crosswalks, the bus lane, mosaics, manholes. */
interface RoomDressing {
  /** The lane rows of a street: its rows are y0..y1, dashes run down the middle. */
  streets: { y0: number; y1: number; dashDy: number }[];
  crosswalks: { x: number; y: number }[];
  mosaics: { x: number; y: number }[];
  /** The painted bus bay in front of the stop (7 tiles wide = the bus's 112 px; centred on the eastbound lane, where the bus stands, feet at y0 * 16 + 36). */
  busBay: { x: number; y: number; w: number; py: number } | null;
  manholes: { x: number; y: number }[];
}

/** The São Paulo state mosaic is 4 x 3 tiles; it takes the first free paved 4 x 3 spot of a room's list (none of the split areas has a big enough bare patch of paving now). */
export const MOSAIC_TILES = { w: 4, h: 3 };

const DRESSING: Record<string, RoomDressing> = {
  // W3: the dashes run between the two lanes (ambientData.ts: feet at +17 and +36); the crosswalks line up with the doors and the brick path
  rua: {
    streets: [{ y0: 8, y1: 11, dashDy: 26 }],
    crosswalks: [{ x: 8, y: 8 }, { x: 12, y: 8 }, { x: 19, y: 8 }],
    mosaics: [],
    busBay: null,
    manholes: [{ x: 14, y: 9 }, { x: 5, y: 10 }],
  },
  // the east half of the street (the old rua's x21-39, so every x here is the old one minus 21)
  rua_leste: {
    streets: [{ y0: 8, y1: 11, dashDy: 26 }],
    crosswalks: [],
    mosaics: [],
    busBay: { x: 3, y: 10, w: 7, py: 8 * T + 36 - 20 },
    manholes: [{ x: 14, y: 11 }, { x: 1, y: 9 }],
  },
  praca: { streets: [], crosswalks: [], mosaics: [], busBay: null, manholes: [{ x: 18, y: 19 }, { x: 25, y: 13 }, { x: 13, y: 5 }] },
  feira: { streets: [], crosswalks: [], mosaics: [], busBay: null, manholes: [{ x: 20, y: 9 }, { x: 16, y: 16 }] },
  // the airport: the runway's centre line (rows 2-3)
  aeroporto: { streets: [{ y0: 2, y1: 3, dashDy: 15 }], crosswalks: [], mosaics: [], busBay: null, manholes: [] },
};

/** Vila Ipê's dressing, or null for a room that has none (the interiors). */
export function sceneryFor(def: RoomDef, has: (key: string) => boolean = () => true): Scenery | null {
  if (!def.outdoor) return null;
  const dress = DRESSING[def.id] ?? { streets: [], crosswalks: [], mosaics: [], busBay: null, manholes: [] };
  const decals: Decal[] = [];
  const add = (d: Decal) => {
    if (has(d.key)) decals.push(d);
  };
  const occupied = new Set<string>();
  for (const p of def.props) {
    // a fence's footprint is the whole rectangle it encloses, but only its ring is solid: the lawn inside stays dressable
    for (const t of propTiles(p)) if (p.kind !== 'cerca' || t.x === p.x || t.y === p.y || t.x === p.x + (p.w ?? 1) - 1 || t.y === p.y + (p.h ?? 1) - 1) occupied.add(`${t.x},${t.y}`);
  }
  // V2's hand-placed ground decals (sand pit, towels, dirt trails) are as busy as a prop: no lawn dressing or mosaic on them
  for (const k of v2DecalTiles(def)) occupied.add(k);
  const at = (x: number, y: number) => def.floor[y]?.[x];

  // crosswalks across both streets, aligned with the doors and the brick axis
  for (const c of dress.crosswalks) add({ key: 'decals/crosswalk', x: c.x * T, y: c.y * T, origin: 'tl', depth: DEPTH_MOSAIC });
  const walked = (x: number, y: number) =>
    dress.crosswalks.some((c) => y >= c.y && y < c.y + 4 && x >= c.x * T - 12 && x < (c.x + 2) * T + 12) ||
    (!!dress.busBay && y === 8 && x >= dress.busBay.x * T - 14 && x < (dress.busBay.x + dress.busBay.w) * T); // no dashes over the bus bay (Rua dos Ipês's first row is 8)
  // lane dashes down the middle of each street, every 32 px
  for (const s of dress.streets) {
    const y = s.y0 * T + s.dashDy;
    for (let x = 4; x < def.cols * T - 10; x += 32) if (!walked(x, s.y0)) add({ key: 'decals/lane_dash', x, y, origin: 'tl', depth: DEPTH_MOSAIC });
  }
  // the painted bus lane in front of the stop
  if (dress.busBay) add({ key: 'decals/faixa_onibus', x: dress.busBay.x * T, y: dress.busBay.py, origin: 'tl', depth: DEPTH_MOSAIC + 2 });
  // a mosaic only goes where its whole footprint is paving with nothing standing on it (the room data may move props around)
  for (const m of dress.mosaics) {
    let free = true;
    for (let dy = 0; dy < MOSAIC_TILES.h; dy++) for (let dx = 0; dx < MOSAIC_TILES.w; dx++) if (at(m.x + dx, m.y + dy) !== 'c' || occupied.has(`${m.x + dx},${m.y + dy}`)) free = false;
    if (free) add({ key: 'decals/sp_mosaic', x: m.x * T, y: m.y * T, origin: 'tl', depth: DEPTH_MOSAIC + 5 });
  }
  for (const m of dress.manholes) add({ key: 'decals/manhole', x: Math.round((m.x + 0.5) * T), y: Math.round((m.y + 0.5) * T) + 6, origin: 'anchor', depth: DEPTH_MOSAIC + 8 });

  // wildflowers on the lawns: a patch in roughly one grass tile in eight, never under a prop, never spilling off the grass
  for (let y = 0; y < def.rows; y++) {
    for (let x = 0; x < def.cols - 1; x++) {
      if (at(x, y) !== 'g' || at(x + 1, y) !== 'g' || occupied.has(`${x},${y}`) || occupied.has(`${x + 1},${y}`)) continue;
      if (rnd(x, y, 11) > 0.11) continue;
      const k = Math.floor(rnd(x, y, 12) * 2);
      add({ key: `decals/flowers_${k}`, x: x * T, y: y * T, origin: 'tl', depth: DEPTH_FLOWERS });
    }
  }
  grassDressing(def, add, at, occupied);
  // grass tufts on the paving next to the lawns, along curbs and in the joints
  for (let y = 1; y < def.rows - 1; y++) {
    for (let x = 1; x < def.cols - 1; x++) {
      if (at(x, y) !== 'c') continue;
      const nextToGrass = at(x - 1, y) === 'g' || at(x + 1, y) === 'g' || at(x, y - 1) === 'g' || at(x, y + 1) === 'g';
      const nextToStreet = at(x, y + 1) === 'a' || at(x, y - 1) === 'a';
      if (occupied.has(`${x},${y}`)) continue;
      const chance = nextToGrass ? 0.2 : nextToStreet ? 0.04 : 0.01;
      if (rnd(x, y, 21) > chance) continue;
      const k = Math.floor(rnd(x, y, 22) * 2);
      add({ key: `decals/tuft_${k}`, x: Math.round(x * T + 3 + rnd(x, y, 23) * 10), y: Math.round((y + 1) * T - 1 - rnd(x, y, 24) * 3), origin: 'anchor', depth: DEPTH_TUFT });
    }
  }
  // grime stains that break up the big flat areas of paving and asphalt
  for (let y = 0; y < def.rows; y++) {
    for (let x = 0; x < def.cols; x++) {
      const ch = at(x, y);
      if (ch !== 'c' || rnd(x, y, 31) > 0.022) continue; // the asphalt has its own cracks, patches and stains in its fill tiles
      const k = Math.floor(rnd(x, y, 32) * 5);
      add({ key: `decals/grime_${k}`, x: Math.round(x * T + 8), y: Math.round(y * T + 8), origin: 'anchor', depth: DEPTH_GRIME });
    }
  }

  decals.push(...v2Decals(def, has));
  return { decals, wires: wireRuns(def) };
}

/** The pole-to-pole wire spans: consecutive utility poles (`poste_N`) are 8 tiles apart, one fios_8 each; one span carries the shoes (fios_6 + fios_... no: fios_6 + a short one). */
function wireRuns(def: RoomDef): WireRun[] {
  const poles = def.props.filter((p: PropDef) => /^poste_\d+$/.test(p.id)).sort((a, b) => a.x - b.x);
  const out: WireRun[] = [];
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = poles[i];
    const b = poles[i + 1];
    const span = b.x - a.x;
    const keys = span === 8 ? (i === 2 ? ['props/fios_6', 'props/fios_seg', 'props/fios_seg'] : ['props/fios_8']) : span === 6 ? ['props/fios_6'] : span === 4 ? ['props/fios_4'] : ['props/fios_8'];
    out.push({ x: Math.round((a.x + 0.5) * T), y: (a.y + 1) * T, keys });
  }
  return out;
}

/** Size (in tiles, w x h) of each grass patch variant, matching the art in custom/ground.mjs. */
const PATCH_PX: Record<string, [number, number]> = { light_0: [112, 64], light_1: [96, 56], light_2: [128, 72], dark_0: [104, 60], dark_1: [88, 52], dark_2: [120, 68] };

/**
 * The life of a lawn: two or three large soft patches of lighter or darker grass (a grid of 5 x 4 tile cells, one jittered patch per cell, only where the
 * whole patch lies on grass), a few worn dirt patches where lawns meet the paving, clover and blade tufts. All deterministic, nothing under a prop.
 */
function grassDressing(def: RoomDef, add: (d: Decal) => void, at: (x: number, y: number) => string | undefined, occupied: Set<string>): void {
  // a soft tonal patch may lie under the lawn's props (they are drawn over it, and V2 filled the lawns with them) but not under another ground decal (sand, towels, trails)
  const decalTiles = v2DecalTiles(def);
  const onGrass = (px0: number, py0: number, px1: number, py1: number, busy?: Set<string>): boolean => {
    for (let ty = Math.floor(py0 / T); ty <= Math.floor((py1 - 1) / T); ty++) for (let tx = Math.floor(px0 / T); tx <= Math.floor((px1 - 1) / T); tx++) if (at(tx, ty) !== 'g' || busy?.has(`${tx},${ty}`)) return false;
    return true;
  };
  // large soft patches: a jittered cell grid (3 x 3 tiles), one candidate per cell, kept when the patch body lies on grass and no other patch is near
  const placed: { x: number; y: number }[] = [];
  for (let cy = 0; cy * 3 < def.rows; cy++) {
    for (let cx = 0; cx * 3 < def.cols; cx++) {
      if (rnd(cx, cy, 41) > 0.55) continue;
      const tone = rnd(cx, cy, 42) < 0.5 ? 'light' : 'dark';
      const k = Math.floor(rnd(cx, cy, 43) * 3);
      const [w, h] = PATCH_PX[`${tone}_${k}`];
      // a few tries across the neighbourhood: V2 put trees, beds and play gear on most lawns, so the first spot is often taken
      let px = 0, py = 0, ok = false;
      for (let a = 0; a < 16 && !ok; a++) {
        px = Math.round((cx * 3 + 1.5 + (rnd(cx, cy, 44 + a * 7) - 0.5) * 6) * T);
        py = Math.round((cy * 3 + 1.5 + (rnd(cx, cy, 45 + a * 7) - 0.5) * 6) * T);
        // the dithered rim may touch the curb, the body (the inner 82%) must be all grass with nothing standing on it
        ok = onGrass(px - w * 0.41, py - h * 0.41, px + w * 0.41, py + h * 0.41, decalTiles) && !placed.some((q) => Math.hypot(q.x - px, q.y - py) < 3.8 * T);
      }
      if (!ok) continue;
      placed.push({ x: px, y: py });
      add({ key: `decals/grass_${tone}_${k}`, x: px, y: py, origin: 'anchor', depth: DEPTH_PATCH });
    }
  }
  // worn dirt: on the lawn side of the paving, where people cut the corner; spaced out
  const dirt: { x: number; y: number }[] = [];
  for (let y = 1; y < def.rows - 1; y++) {
    for (let x = 1; x < def.cols - 2; x++) {
      if (at(x, y) !== 'g' || at(x + 1, y) !== 'g' || occupied.has(`${x},${y}`) || occupied.has(`${x + 1},${y}`)) continue;
      const near = (c: string) => at(x - 1, y) === c || at(x + 2, y) === c || at(x, y - 1) === c || at(x, y + 1) === c;
      // the corners next to the brick paths are where feet cut across, the rest of the rim only now and then
      const chance = near('t') ? 0.14 : near('c') ? 0.02 : 0;
      if (rnd(x, y, 51) > chance) continue;
      if (dirt.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) < 6)) continue;
      dirt.push({ x, y });
      const k = Math.floor(rnd(x, y, 52) * 3);
      add({ key: `decals/dirt_${k}`, x: Math.round((x + 1) * T), y: Math.round((y + 0.6) * T), origin: 'anchor', depth: DEPTH_DIRT });
    }
  }
  // clover and blade tufts
  for (let y = 0; y < def.rows; y++) {
    for (let x = 0; x < def.cols; x++) {
      if (at(x, y) !== 'g' || occupied.has(`${x},${y}`)) continue;
      if (rnd(x, y, 61) < 0.07) add({ key: `decals/clover_${Math.floor(rnd(x, y, 62) * 2)}`, x: Math.round(x * T + 3 + rnd(x, y, 63) * 10), y: Math.round(y * T + 6 + rnd(x, y, 64) * 9), origin: 'anchor', depth: DEPTH_CLOVER });
      if (rnd(x, y, 71) < 0.14) add({ key: `decals/gtuft_${Math.floor(rnd(x, y, 72) * 3)}`, x: Math.round(x * T + 3 + rnd(x, y, 73) * 10), y: Math.round(y * T + 5 + rnd(x, y, 74) * 10), origin: 'anchor', depth: DEPTH_CLOVER + 1 });
    }
  }
}
