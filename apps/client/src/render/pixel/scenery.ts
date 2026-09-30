/**
 * Ground dressing and wires of the outdoor map (Phase 5): crosswalks, lane dashes, the São Paulo mosaic, manholes, wildflowers, grass tufts,
 * grime, and the overhead wires between the utility poles. Purely visual and deterministic (no Phaser): the scene turns the lists into
 * sprites, the tests check that every key exists in the manifest and that nothing lands on the wrong terrain.
 */
import type { PropDef, RoomDef } from '@tudobem/shared';
import { propTiles } from '@tudobem/shared';
import { T } from './coords';
import { hash2 } from './terrain';

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
const DEPTH_GRIME = -4950;
const DEPTH_FLOWERS = -4800;
const DEPTH_TUFT = -4400;

const rnd = (x: number, y: number, seed: number) => hash2(x, y, seed) / 4294967296;

/** The lane rows of a street: its rows are y0..y1, dashes run down the middle. */
const STREETS = [
  { y0: 8, y1: 11 },
  { y0: 32, y1: 35 },
];
const CROSSWALKS: { x: number; y: number }[] = [
  { x: 15, y: 8 },
  { x: 24, y: 8 },
  { x: 40, y: 8 },
  { x: 12, y: 32 },
  { x: 24, y: 32 },
  { x: 38, y: 32 },
];
const MOSAICS: { x: number; y: number }[] = [
  { x: 26, y: 14 },
  { x: 21, y: 26 },
  { x: 27, y: 27 },
  { x: 14, y: 12 },
  { x: 33, y: 30 },
];
const MANHOLES: { x: number; y: number }[] = [
  { x: 30, y: 9 },
  { x: 9, y: 10 },
  { x: 47, y: 11 },
  { x: 19, y: 33 },
  { x: 44, y: 34 },
  { x: 22, y: 23 },
  { x: 30, y: 21 },
];

/** Vila Ipê's dressing, or null for a room that has none (the interiors). */
export function sceneryFor(def: RoomDef, has: (key: string) => boolean = () => true): Scenery | null {
  if (!def.outdoor) return null;
  const decals: Decal[] = [];
  const add = (d: Decal) => {
    if (has(d.key)) decals.push(d);
  };
  const occupied = new Set<string>();
  for (const p of def.props) for (const t of propTiles(p)) occupied.add(`${t.x},${t.y}`);
  const at = (x: number, y: number) => def.floor[y]?.[x];

  // crosswalks across both streets, aligned with the doors and the brick axis
  for (const c of CROSSWALKS) add({ key: 'decals/crosswalk', x: c.x * T, y: c.y * T, origin: 'tl', depth: DEPTH_MOSAIC });
  const walked = (x: number, y: number) => CROSSWALKS.some((c) => y >= c.y && y < c.y + 4 && x >= c.x * T - 12 && x < (c.x + 2) * T + 12);
  // lane dashes down the middle of each street, every 32 px
  for (const s of STREETS) {
    const y = ((s.y0 + s.y1 + 1) / 2) * T - 1;
    for (let x = 4; x < def.cols * T - 10; x += 32) if (!walked(x, s.y0)) add({ key: 'decals/lane_dash', x, y, origin: 'tl', depth: DEPTH_MOSAIC });
  }
  // the painted bus lane in front of the stop
  add({ key: 'decals/faixa_onibus', x: 33 * T, y: 10 * T, origin: 'tl', depth: DEPTH_MOSAIC + 2 });
  for (const m of MOSAICS) add({ key: 'decals/sp_mosaic', x: m.x * T, y: m.y * T, origin: 'tl', depth: DEPTH_MOSAIC + 5 });
  for (const m of MANHOLES) add({ key: 'decals/manhole', x: Math.round((m.x + 0.5) * T), y: Math.round((m.y + 0.5) * T) + 6, origin: 'anchor', depth: DEPTH_MOSAIC + 8 });

  // wildflowers on the lawns: a patch in roughly one grass tile in eight, never under a prop, never spilling off the grass
  for (let y = 0; y < def.rows; y++) {
    for (let x = 0; x < def.cols - 1; x++) {
      if (at(x, y) !== 'g' || at(x + 1, y) !== 'g' || occupied.has(`${x},${y}`) || occupied.has(`${x + 1},${y}`)) continue;
      if (rnd(x, y, 11) > 0.11) continue;
      const k = Math.floor(rnd(x, y, 12) * 2);
      add({ key: `decals/flowers_${k}`, x: x * T, y: y * T, origin: 'tl', depth: DEPTH_FLOWERS });
    }
  }
  // grass tufts on the paving next to the lawns, along curbs and in the joints
  for (let y = 1; y < def.rows - 1; y++) {
    for (let x = 1; x < def.cols - 1; x++) {
      if (at(x, y) !== 'c') continue;
      const nextToGrass = at(x - 1, y) === 'g' || at(x + 1, y) === 'g' || at(x, y - 1) === 'g' || at(x, y + 1) === 'g';
      const nextToStreet = at(x, y + 1) === 'a' || at(x, y - 1) === 'a';
      if (occupied.has(`${x},${y}`)) continue;
      const chance = nextToGrass ? 0.32 : nextToStreet ? 0.1 : 0.02;
      if (rnd(x, y, 21) > chance) continue;
      const k = Math.floor(rnd(x, y, 22) * 2);
      add({ key: `decals/tuft_${k}`, x: Math.round(x * T + 3 + rnd(x, y, 23) * 10), y: Math.round((y + 1) * T - 1 - rnd(x, y, 24) * 3), origin: 'anchor', depth: DEPTH_TUFT });
    }
  }
  // grime stains that break up the big flat areas of paving and asphalt
  for (let y = 0; y < def.rows; y++) {
    for (let x = 0; x < def.cols; x++) {
      const ch = at(x, y);
      if ((ch !== 'c' && ch !== 'a') || rnd(x, y, 31) > 0.045) continue;
      const k = Math.floor(rnd(x, y, 32) * 5);
      add({ key: `decals/grime_${k}`, x: Math.round(x * T + 8), y: Math.round(y * T + 8), origin: 'anchor', depth: DEPTH_GRIME });
    }
  }

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
