/**
 * The Praia's moving sea (PRAIA-PLAN.md 1.5): a 3-frame foam strip (`fx/onda_0..2`) on every water tile that meets the sand from below,
 * phase-offset by column so the foam rolls along the shore, up to three crabs that scuttle on the shore row at night, and at golden hour
 * the sun's path on the water (1.4): a column of warm glints that shimmers over the open sea from 16:30 to 18:30, gone in the rain.
 *
 * The visual pass on top of the flat water tile: `paintSeaShade` paints one canvas when the room is built (the sea gets clear shallows by the
 * sand and deepens in dithered bands toward the horizon, the sand right above the sea is wet and dark, the lagoa gets rounded banks, a mossy
 * rim, a darker middle and lily pads), and each frame the swash laps up the wet sand, swell lines roll toward the beach and glints twinkle in
 * the sun. Everything reaches `SURROUND_TILES` past the map so the sea the surround continues matches.
 * `shoreTiles` / `crabHomes` / `sunPathAlpha` / `sunPathColumn` / `seaShore` / `paintSeaShade` / `swashReach` are pure (tested); `buildSea`
 * puts sprites on the scene.
 */
import type Phaser from 'phaser';
import type { RoomDef } from '@tudobem/shared';
import type { Manifest } from './manifest';
import { T } from './coords';
import { DEPTH, propAnchor, standingDepth } from './props';
import { SURROUND_TILES } from './surround';

/** At most this many foam strips (the budget in the plan). */
export const FOAM_MAX = 40;
/** Foam frames per second. */
export const FOAM_FPS = 2;
export const CRABS_MAX = 3;
/** Seconds for the lighthouse's beams to go round once. */
export const BEAM_PERIOD = 9;
/** Where the lamp sits in the `praia/farol` image (custom/praia.mjs FAROL_LAMP). */
const FAROL_LAMP = { x: 17, y: 17 };

const WATER = 'o';

/** A cheap 0..1 hash of three integers (the glints' shimmer). */
function hashf(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Water tiles whose north neighbour is sand: where a wave breaks. Evenly thinned to `cap`. */
export function shoreTiles(floor: readonly string[], cap = FOAM_MAX): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 1; y < floor.length; y++) for (let x = 0; x < floor[y].length; x++) if (floor[y][x] === WATER && floor[y - 1][x] === 's') out.push({ x, y });
  if (out.length <= cap) return out;
  const step = out.length / cap;
  return Array.from({ length: cap }, (_, i) => out[Math.floor(i * step)]);
}

/** Sand tiles right above the sea (not the lagoa: only the longest shore row) where a crab may wander, at most `CRABS_MAX`, spread out. */
export function crabHomes(floor: readonly string[]): { x: number; y: number }[] {
  const rows = new Map<number, number[]>();
  for (const t of shoreTiles(floor, Infinity)) rows.set(t.y - 1, [...(rows.get(t.y - 1) ?? []), t.x]);
  let best: [number, number[]] | null = null;
  for (const r of rows) if (!best || r[1].length > best[1].length) best = r;
  if (!best || best[1].length < 6) return [];
  const xs = best[1];
  return Array.from({ length: CRABS_MAX }, (_, i) => ({ x: xs[Math.floor(((i + 0.5) * xs.length) / CRABS_MAX)], y: best![0] }));
}

/** 0..1 strength of the sun's reflection on the water: in from 16:30, full at 17:30, gone by 18:30 (the grade's golden keyframes). */
export function sunPathAlpha(minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  const from = 16 * 60 + 30, peak = 17 * 60 + 30, to = 18 * 60 + 30;
  if (m <= from || m >= to) return 0;
  const t = m < peak ? (m - from) / (peak - from) : (to - m) / (to - peak);
  return t * t * (3 - 2 * t);
}

/**
 * Where the path lies: the open sea (the widest run of water rows that reach the bottom edge), its column a third of the way in from the
 * west, where the sun goes down. `null` when the room has no sea reaching its bottom edge.
 */
export function sunPathColumn(floor: readonly string[]): { x: number; y0: number; y1: number } | null {
  const rows = floor.length;
  if (!rows) return null;
  const cols = floor[0].length;
  const last = floor[rows - 1];
  let x0 = -1, x1 = -1, best = 0;
  for (let x = 0, run = 0; x <= cols; x++) {
    if (x < cols && last[x] === WATER) run++;
    else {
      if (run > best) {
        best = run;
        x1 = x - 1;
        x0 = x - run;
      }
      run = 0;
    }
  }
  if (best < 6) return null;
  const x = x0 + Math.floor(best / 3);
  let y0 = rows - 1;
  while (y0 > 0 && floor[y0 - 1][x] === WATER) y0--;
  // a ring of sea round a deck is too thin for a path
  if (rows - y0 < 4) return null;
  return { x, y0, y1: rows - 1 };
}

// ------------------------------------------------------------------ the shading canvas

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** The sea's bands by depth below the shoreline (px). `dither` px at the top of a band mix it 50/50 with the band above. */
const SEA_BANDS: { from: number; hex: string | null; a: number; dither: number }[] = [
  { from: 0, hex: null, a: 0, dither: 0 }, // the foam line the terrain draws
  { from: 3, hex: '#a8ecd9', a: 0.5, dither: 0 }, // clear shallows: you see the sand through them
  { from: 10, hex: '#86dccb', a: 0.32, dither: 3 },
  { from: 20, hex: null, a: 0, dither: 4 }, // the tile's own teal
  { from: 40, hex: '#23758f', a: 0.2, dither: 4 },
  { from: 76, hex: '#1f6789', a: 0.34, dither: 4 },
  { from: 128, hex: '#1a5a80', a: 0.46, dither: 4 },
];
const WET = rgb('#a88a54');
const LAGOA = { sand: rgb('#ebd9a8'), sand2: rgb('#e2cd98'), bank: rgb('#9c8457'), moss: rgb('#5f9468'), shallow: rgb('#86cdb4'), deep: rgb('#24685c'), pad: rgb('#4f9a45'), pad2: rgb('#7cc35a'), flower: rgb('#f3b6c8') };

/** Per column, the first sea row: the top of the water that runs down to the bottom edge, right under sand (-1 where there is none). */
export function seaShore(floor: readonly string[]): number[] {
  const rows = floor.length;
  const cols = rows ? floor[0].length : 0;
  const out: number[] = [];
  for (let x = 0; x < cols; x++) {
    let y = rows;
    while (y > 0 && floor[y - 1][x] === WATER) y--;
    out.push(y < rows && y > 0 && floor[y - 1][x] === 's' ? y : -1);
  }
  // a pier or a deck column takes the shore of its nearest neighbour that has one
  for (let x = 0; x < cols; x++) {
    if (out[x] >= 0) continue;
    for (let d = 1; d < cols; d++) {
      const a = out[x - d] ?? -1, b = out[x + d] ?? -1;
      if (a >= 0 || b >= 0) {
        out[x] = a >= 0 && (b < 0 || a <= b) ? a : b;
        break;
      }
    }
  }
  return out;
}

/** Water components that do not reach the bottom edge (the lagoa), as tile rects, when they fill their bounding box. */
export function lagoas(floor: readonly string[]): { x0: number; y0: number; x1: number; y1: number }[] {
  const rows = floor.length;
  const cols = rows ? floor[0].length : 0;
  const seen = new Set<number>();
  const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (floor[y][x] !== WATER || seen.has(y * cols + x)) continue;
      const stack = [[x, y]];
      seen.add(y * cols + x);
      let n = 0, bottom = false, x0 = x, x1 = x, y0 = y, y1 = y;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        n++;
        if (cy === rows - 1) bottom = true;
        x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || floor[ny][nx] !== WATER || seen.has(ny * cols + nx)) continue;
          seen.add(ny * cols + nx);
          stack.push([nx, ny]);
        }
      }
      if (!bottom && n === (x1 - x0 + 1) * (y1 - y0 + 1)) out.push({ x0, y0, x1, y1 });
    }
  return out;
}

export interface SeaShade {
  /** world px of the canvas' top-left corner */
  x: number;
  y: number;
  w: number;
  h: number;
  /** RGBA, row-major */
  data: Uint8ClampedArray;
}

/**
 * The still part of the sea's look, painted once per room: depth bands over the open sea, the wet sand above it, and the lagoa's banks.
 * `margin` tiles past every edge (the surround continues the edge tiles there). Null when the room has no water.
 */
export function paintSeaShade(floor: readonly string[], margin = SURROUND_TILES): SeaShade | null {
  const rows = floor.length;
  const cols = rows ? floor[0].length : 0;
  let top = -1;
  for (let y = 0; y < rows && top < 0; y++) if (floor[y].includes(WATER)) top = y;
  if (top < 0) return null;
  const shore = seaShore(floor);
  const charAt = (tx: number, ty: number) => floor[Math.min(rows - 1, Math.max(0, ty))][Math.min(cols - 1, Math.max(0, tx))];
  const shoreAt = (tx: number) => shore[Math.min(cols - 1, Math.max(0, tx))];
  const ox = -margin * T, oy = Math.max(0, top - 1) * T;
  const w = (cols + 2 * margin) * T, h = (rows + margin) * T - oy;
  const data = new Uint8ClampedArray(w * h * 4);
  const blend = (i: number, c: readonly number[], a: number) => {
    // `over` onto whatever this canvas already holds (both are straight alpha)
    const da = data[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) data[i + k] = Math.round((c[k] * a + data[i + k] * da * (1 - a)) / oa);
    data[i + 3] = Math.round(oa * 255);
  };
  const lagos = lagoas(floor);
  const inLago = (tx: number, ty: number) => lagos.some((l) => tx >= l.x0 && tx <= l.x1 && ty >= l.y0 && ty <= l.y1);
  for (let py = 0; py < h; py++) {
    const wy = oy + py, ty = Math.floor(wy / T);
    for (let px = 0; px < w; px++) {
      const wx = ox + px, tx = Math.floor(wx / T);
      const ch = charAt(tx, ty);
      const sy = shoreAt(tx);
      const i = (py * w + px) * 4;
      if (ch === WATER && !(tx >= 0 && tx < cols && ty >= 0 && ty < rows && inLago(tx, ty))) {
        // the open sea: depth below the shoreline
        const d = sy >= 0 ? wy - sy * T : 60;
        let b = 0;
        while (b + 1 < SEA_BANDS.length && d >= SEA_BANDS[b + 1].from) b++;
        let band = SEA_BANDS[b];
        if (b > 0 && d - band.from < band.dither && (px + py) % 2 === 0) band = SEA_BANDS[b - 1];
        if (band.hex) blend(i, rgb(band.hex), band.a);
        // in the shallows, a few pale ripples of the sand underneath
        if (d >= 4 && d < 16 && hashf(px >> 1, py, 7) < 0.05) blend(i, [236, 248, 236], 0.45);
      } else if (ch === 's' && sy >= 0 && ty === sy - 1 && charAt(tx, ty + 1) === WATER) {
        // the wet sand above the sea: darkest by the water, dithered away
        const u = sy * T - wy; // 1..16 px above the shoreline
        if (u <= 7 || (u <= 11 && (px + py) % 2 === 0)) blend(i, WET, u <= 3 ? 0.34 : 0.26);
      }
    }
  }
  // the lagoa: round the corners off with sand, a bank and a mossy rim, clear edges, a darker middle and a few lily pads
  for (const l of lagos) {
    const x0 = l.x0 * T, y0 = l.y0 * T, x1 = (l.x1 + 1) * T, y1 = (l.y1 + 1) * T;
    // an organic pond inside the tile box: a squircle whose rim wobbles, so no straight edge or square corner is left
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    const sd = (fx: number, fy: number) => {
      const ux = (fx - cx) / rx, uy = (fy - cy) / ry;
      const a = Math.atan2(uy, ux);
      const rim = 0.93 + Math.sin(a * 3 + 0.8) * 0.035 + Math.sin(a * 5 + 2.1) * 0.025;
      const n = Math.pow(Math.abs(ux) ** 3 + Math.abs(uy) ** 3, 1 / 3);
      return (rim - n) * Math.min(rx, ry);
    };
    // (3 px past the box too: the terrain's own wet band round the tiles would draw the old square)
    for (let wy = y0 - 3; wy < y1 + 3; wy++)
      for (let wx = x0 - 3; wx < x1 + 3; wx++) {
        const px = wx - ox, py = wy - oy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const i = (py * w + px) * 4;
        const d = sd(wx + 0.5, wy + 0.5);
        if (d < 0) {
          const c = hashf(wx, wy, 3) < 0.17 ? LAGOA.sand2 : LAGOA.sand;
          data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
          if (d > -2.5 && (wx + wy) % 2 === 0) blend(i, WET, 0.3);
        } else if (d < 1.2) blend(i, LAGOA.bank, 1);
        else if (d < 2.4) blend(i, LAGOA.moss, 1);
        else if (d < 5) blend(i, LAGOA.shallow, 0.85);
        else if (d < 8) blend(i, LAGOA.shallow, (wx + wy) % 2 ? 0.4 : 0);
        else blend(i, LAGOA.deep, d < 11 ? ((wx + wy) % 2 ? 0.3 : 0.12) : 0.34);
      }
    // lily pads: a notched disc and, on one, a pink flower
    const pads = [[0.3, 0.62, 3], [0.7, 0.4, 2.6], [0.55, 0.72, 2.2]] as const;
    pads.forEach(([fx, fy, rr], k) => {
      const cx = x0 + (x1 - x0) * fx, cy = y0 + (y1 - y0) * fy;
      for (let wy = Math.floor(cy - rr); wy <= cy + rr; wy++)
        for (let wx = Math.floor(cx - rr - 1); wx <= cx + rr + 1; wx++) {
          const dx = (wx + 0.5 - cx) / (rr + 0.8), dy = (wy + 0.5 - cy) / rr;
          if (dx * dx + dy * dy > 1) continue;
          if (wx + 0.5 > cx && Math.abs(wy + 0.5 - cy) < 0.6) continue; // the notch
          const i = ((wy - oy) * w + (wx - ox)) * 4;
          blend(i, dy < -0.2 && dx < 0.3 ? LAGOA.pad2 : LAGOA.pad, 1);
        }
      if (k === 0) {
        const i = ((Math.round(cy) - 1 - oy) * w + (Math.round(cx) - 1 - ox)) * 4;
        blend(i, LAGOA.flower, 1);
        blend(i + 4, [255, 236, 240], 1);
      }
    });
  }
  return { x: ox, y: oy, w, h, data };
}

/**
 * How far (px) the swash runs up the wet sand at world x, `t` seconds in: each wave slides up, holds a beat and drains back, a long slow
 * swell along the beach so neighbouring stretches are never in step. 0 while the water is back down.
 */
export function swashReach(wx: number, t: number): number {
  const along = Math.sin(wx * 0.021) * 1.3 + Math.sin(wx * 0.0063 + 1.7) * 2.1;
  const ph = ((t / 6.5 + along / (Math.PI * 2)) % 1 + 1) % 1; // 0..1 through one wave
  const s = ph < 0.35 ? Math.sin((ph / 0.35) * (Math.PI / 2)) : ph < 0.5 ? 1 : ph < 0.95 ? 1 - (ph - 0.5) / 0.45 : 0;
  const reach = 4 + 4 * (0.5 + 0.5 * Math.sin(wx * 0.013 + 0.6)) + 2 * hashf(wx >> 3, 0, 5);
  return Math.max(0, s * reach);
}

export interface SeaView {
  /** `minute`: the game clock; `sun`: the weather's 0..1 sunshine (the path hides in rain and under cloud) */
  update(dt: number, night: number, minute?: number, sun?: number): void;
}

/** The foam and the crabs of a room with sea (null when it has none or the art is missing). `reg` registers objects for the room's teardown. */
export function buildSea(scene: Phaser.Scene, m: Manifest, def: RoomDef, reg: <O extends Phaser.GameObjects.GameObject>(o: O) => O): SeaView | null {
  const frames = [0, 1, 2].map((k) => m.sprites[`fx/onda_${k}`]).filter(Boolean);
  if (frames.length !== 3) return null;
  const foam = shoreTiles(def.floor).map((t) => {
    const img = reg(scene.add.image(t.x * T, t.y * T - 1, frames[0].atlas, frames[0].frame)).setOrigin(0, 0).setDepth(DEPTH.groundDecal + 5);
    return { img, phase: t.x % 3 };
  });
  const cd = m.sprites['critters/caranguejo'];
  const crabs = cd
    ? crabHomes(def.floor).map((h, i) => {
        const spr = reg(scene.add.sprite(h.x * T + 8, h.y * T + 12, cd.atlas, cd.frame)).setOrigin(cd.ax / cd.w, cd.ay / cd.h).setVisible(false);
        return { spr, home: h.x * T + 8, y: h.y * T + 12, x: h.x * T + 8, dir: i % 2 ? 1 : -1, t: i * 0.7 };
      })
    : [];
  // the sun's path: a column of short warm dashes over the open sea, redrawn a few times a second so it shimmers
  const col = sunPathColumn(def.floor);
  const path = col ? reg(scene.add.graphics()).setDepth(DEPTH.groundDecal + 6).setAlpha(0).setBlendMode(1 /* ADD */) : null;
  let pathFrame = -1;
  const drawPath = (frame: number) => {
    if (!path || !col) return;
    path.clear();
    const cx = col.x * T + 8;
    const h = (col.y1 - col.y0 + 1) * T;
    for (let i = 0; i < h; i += 2) {
      const k = i / h; // 0 at the horizon, 1 at the bottom: the path widens toward the viewer
      const r1 = hashf(i, frame, 1), r2 = hashf(i, frame, 2), r3 = hashf(i, frame, 3);
      if (r1 > 0.4 + k * 0.3) continue;
      const w = 2 + Math.floor(r2 * (3 + k * 6));
      const dx = Math.round((r3 - 0.5) * (6 + k * 26));
      path.fillStyle(r2 < 0.5 ? 0xffd27a : 0xfff0b8, r1 < 0.15 ? 0.9 : 0.55);
      path.fillRect(cx + dx - (w >> 1), col.y0 * T + i, w, 1);
    }
  };
  // the still shading: one canvas, nearest-neighbour, just over the water tiles and under every decal
  const shade = paintSeaShade(def.floor);
  if (shade) {
    const key = 'sea_shade';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const ct = scene.textures.createCanvas(key, shade.w, shade.h);
    if (ct) {
      // the game runs with pixelArt on, so a canvas texture samples nearest-neighbour already
      ct.getContext().putImageData(new ImageData(shade.data as unknown as Uint8ClampedArray<ArrayBuffer>, shade.w, shade.h), 0, 0);
      ct.refresh();
      reg(scene.add.image(shade.x, shade.y, key)).setOrigin(0, 0).setDepth(DEPTH.groundDecal + 1);
    }
  }
  // the moving water: the swash on the wet sand, swell lines and glints (a few hundred rects, redrawn ~10 times a second)
  const shore = seaShore(def.floor);
  const seaCols = shore.map((y, x) => ({ x, y })).filter((c) => c.y >= 0);
  const rows = def.floor.length;
  const cols = rows ? def.floor[0].length : 0;
  const reach = Math.min(10, SURROUND_TILES);
  const wash = seaCols.length ? reg(scene.add.graphics()).setDepth(DEPTH.groundDecal + 4) : null;
  const sparkle = seaCols.length ? reg(scene.add.graphics()).setDepth(DEPTH.groundDecal + 7) : null;
  const shoreY = (wx: number) => shore[Math.min(cols - 1, Math.max(0, Math.floor(wx / T)))];
  const isOpenWater = (wx: number, wy: number) => {
    const tx = Math.min(cols - 1, Math.max(0, Math.floor(wx / T))), ty = Math.min(rows - 1, Math.floor(wy / T));
    return def.floor[ty]?.[tx] === WATER && shoreY(wx) >= 0 && wy >= shoreY(wx) * T + 4;
  };
  const drawWash = (t: number) => {
    if (!wash) return;
    wash.clear();
    const x0 = -reach * T, x1 = (cols + reach) * T;
    let runX = x0, runH = -1, runY = 0;
    const flush = (to: number) => {
      if (runH <= 0) return;
      const y = runY;
      wash.fillStyle(0xbdeee2, 0.55).fillRect(runX, y - runH, to - runX, runH);
      wash.fillStyle(0xf4fbf8, 0.9).fillRect(runX, y - runH - 1, to - runX, 1);
      if (runH > 2) wash.fillStyle(0xd2efe6, 0.6).fillRect(runX, y - runH, to - runX, 1);
    };
    for (let wx = x0; wx <= x1; wx++) {
      const sy = wx < x1 ? shoreY(wx) : -1;
      const ch = wx < x1 && sy >= 0 ? def.floor[sy - 1]?.[Math.min(cols - 1, Math.max(0, Math.floor(wx / T)))] : undefined;
      // only where sand meets the sea (not under the pier)
      const hh = ch === 's' && def.floor[sy]?.[Math.min(cols - 1, Math.max(0, Math.floor(wx / T)))] === WATER ? Math.round(swashReach(wx, t)) : 0;
      const yy = sy * T;
      if (hh !== runH || yy !== runY) {
        flush(wx);
        runX = wx;
        runH = hh;
        runY = yy;
      }
    }
  };
  // swell lines and glints: positions from a hash, so nothing is stored per glint
  const SWELLS = 46, GLINTS = 70;
  const span = { x0: -reach * T, w: (cols + 2 * reach) * T };
  const seaTop = seaCols.length ? Math.min(...seaCols.map((c) => c.y)) * T : 0;
  const seaH = Math.max(T, (rows + reach) * T - seaTop);
  const drawSparkle = (t: number, glint: number) => {
    if (!sparkle) return;
    sparkle.clear();
    for (let i = 0; i < SWELLS; i++) {
      // a crest that rolls toward the beach and fades out over the shallows
      const life = 9 + hashf(i, 1, 11) * 5;
      const k = ((t / life + hashf(i, 2, 11)) % 1 + 1) % 1;
      const cycle = Math.floor(t / life + hashf(i, 2, 11));
      const x = span.x0 + Math.floor(hashf(i, cycle, 12) * span.w);
      const d0 = 30 + hashf(i, cycle, 13) * 120;
      const y = Math.round(shoreY(x) * T + d0 * (1 - k * 0.6));
      if (!isOpenWater(x, y)) continue;
      const len = 6 + Math.floor(hashf(i, cycle, 14) * 12);
      const a = Math.sin(k * Math.PI) * (d0 < 60 ? 0.5 : 0.35);
      sparkle.fillStyle(0x8fd6c8, a).fillRect(x, y, len, 1);
      sparkle.fillStyle(0x2b8783, a * 0.8).fillRect(x + 1, y + 1, len - 2, 1);
    }
    if (glint <= 0.02) return;
    const slot = Math.floor(t * 3);
    for (let i = 0; i < GLINTS; i++) {
      const s = slot + (i % 3);
      if ((s + i) % 3 !== 0) continue;
      const x = span.x0 + Math.floor(hashf(i, s, 21) * span.w);
      const y = seaTop + 6 + Math.floor(hashf(i, s, 22) * seaH);
      if (!isOpenWater(x, y)) continue;
      const big = hashf(i, s, 23) < 0.25;
      sparkle.fillStyle(0xffffff, 0.85 * glint).fillRect(x, y, big ? 3 : 2, 1);
      if (big) sparkle.fillStyle(0xffffff, 0.5 * glint).fillRect(x + 1, y - 1, 1, 3);
    }
  };
  // the lighthouse: two beams sweep round its lamp after dark (added light; strong, since the night grade darkens it after)
  const farolProp = def.props.find((p) => p.art === 'praia/farol');
  const farolArt = m.sprites['praia/farol'];
  const lamp = farolProp && farolArt ? (() => {
    const a = propAnchor(farolProp);
    return { x: a.wx - farolArt.ax + FAROL_LAMP.x, y: a.wy - farolArt.ay + FAROL_LAMP.y };
  })() : null;
  const beam = lamp ? reg(scene.add.graphics()).setDepth(DEPTH.overhead + 5).setBlendMode(1 /* ADD */).setVisible(false) : null;
  const drawBeam = (t: number, strength: number) => {
    if (!beam || !lamp) return;
    beam.setVisible(strength > 0.02);
    if (strength <= 0.02) return;
    beam.clear();
    const turn = (t / BEAM_PERIOD) * Math.PI * 2;
    for (const off of [0, Math.PI]) {
      const a = turn + off;
      // seen from above at a slant: the beam's ellipse of travel is flattened vertically
      for (const [len, half, alpha] of [[300, 0.14, 0.18], [230, 0.08, 0.24], [140, 0.045, 0.32]] as const) {
        const x1 = lamp.x + Math.cos(a - half) * len, y1 = lamp.y + Math.sin(a - half) * len * 0.55;
        const x2 = lamp.x + Math.cos(a + half) * len, y2 = lamp.y + Math.sin(a + half) * len * 0.55;
        beam.fillStyle(0xfff0c0, alpha * strength).fillTriangle(lamp.x, lamp.y, x1, y1, x2, y2);
      }
    }
    beam.fillStyle(0xfff6d8, 0.5 * strength).fillCircle(lamp.x, lamp.y, 5);
  };
  let washFrame = -1, sparkleFrame = -1;
  let clock = 0;
  return {
    update(dt, night, minute = 0, sun = 1) {
      clock += dt / 1000;
      const wf = Math.floor(clock * 10);
      if (wf !== washFrame) {
        washFrame = wf;
        drawWash(clock);
      }
      const sf = Math.floor(clock * 8);
      if (sf !== sparkleFrame) {
        sparkleFrame = sf;
        drawSparkle(clock, Math.max(0, Math.min(1, sun)) * (1 - Math.min(1, night * 1.5)));
      }
      drawBeam(clock, Math.max(0, Math.min(1, (night - 0.35) / 0.4)));
      const f = Math.floor(clock * FOAM_FPS);
      for (const w of foam) {
        const d = frames[(f + w.phase) % 3];
        w.img.setFrame(d.frame);
      }
      if (path) {
        const a = sunPathAlpha(minute) * Math.max(0, Math.min(1, sun)) * 0.75;
        path.setAlpha(a);
        const pf = Math.floor(clock * 4);
        if (a > 0 && pf !== pathFrame) {
          pathFrame = pf;
          drawPath(pf);
        }
      }
      const out = night > 0.5;
      for (const c of crabs) {
        c.spr.setVisible(out);
        if (!out || !cd?.anim) continue;
        c.t += dt / 1000;
        // a sideways scuttle, a pause, back the other way, never more than a tile and a half from home
        const moving = c.t % 4 < 1.6;
        if (moving) c.x += c.dir * 10 * (dt / 1000);
        if (Math.abs(c.x - c.home) > 24) c.dir = -c.dir;
        c.spr.setPosition(Math.round(c.x), c.y).setDepth(standingDepth(c.y, 'crab'));
        c.spr.setFrame(cd.anim.frames[moving ? Math.floor(c.t * 6) % cd.anim.frames.length : 0]);
      }
    },
  };
}
