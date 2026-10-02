/**
 * Readability passes on composed characters (wave 2), pure and per frame:
 *
 *  - `highlightEdges`: a subtle light on the top and left edge just inside a layer's outline (hair crown, shoulders), so volumes read
 *    with the light from the top left (HOWTO 4.2 rule 3). Run on a recolored layer, before it is composited.
 *  - `outlineSheet`: one consistent 1 px outline on the OUTER silhouette of the composed sheet, in a dark shade of the part it surrounds
 *    (selective outline, never pure black). The pack's own outline pixels that sit on the silhouette are re-tinted, and any silhouette
 *    pixel that has no outline (an authored gesture, a hat edge, a puffed-up afro) gets one, so every character is closed the same way and
 *    pops off the ground. Outlines between the parts inside the figure keep the pack's navy.
 *
 * No Phaser, no DOM: the avatar creator preview, the game scene and the lineup sheet all go through `composeLook`.
 */
import type { Geometry } from './bodytype';

/** The pack's outline colours (packed RGB) that mark an outline pixel. */
const OUTLINE_PACKED = new Set([0x3a3a50, 0x46465e, 0x000000]);
const packAt = (d: ArrayLike<number>, i: number): number => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];

/** Strength of the outer outline against its part: the part's colour times this, cooled a little. */
const OUTLINE_MUL = 0.3;

export function outlineShade(r: number, g: number, b: number): [number, number, number] {
  // darker than the part, shifted toward blue-violet like the pack's own navy; never darker than near-black
  const l = Math.max(r, g, b);
  const cap = l > 150 ? 150 / l : 1; // very light parts (white shirts) must not give a mid-grey outline
  return [Math.round(r * cap * OUTLINE_MUL + 8), Math.round(g * cap * OUTLINE_MUL + 8), Math.round(b * cap * OUTLINE_MUL + 22)];
}

interface Cell {
  x0: number;
  y0: number;
  w: number;
  h: number;
  stride: number;
}

function cells(len: number, g: Geometry): Cell[] {
  const stride = g.frameW * g.cols;
  void len;
  const out: Cell[] = [];
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) out.push({ x0: c * g.frameW, y0: r * g.frameH, w: g.frameW, h: g.frameH, stride });
  return out;
}

const alphaOf = (d: ArrayLike<number>, cell: Cell, x: number, y: number): number =>
  x < 0 || y < 0 || x >= cell.w || y >= cell.h ? 0 : d[((cell.y0 + y) * cell.stride + cell.x0 + x) * 4 + 3];

/** Selective outline of the composed sheet (in place). */
export function outlineSheet(data: Uint8ClampedArray | Uint8Array, g: Geometry): void {
  const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const N8: [number, number][] = [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const cell of cells(data.length, g)) {
    const at = (x: number, y: number) => ((cell.y0 + y) * cell.stride + cell.x0 + x) * 4;
    const solid = (x: number, y: number) => alphaOf(data, cell, x, y) >= 128;
    const isOutline = (x: number, y: number) => solid(x, y) && OUTLINE_PACKED.has(packAt(data, at(x, y)));
    const adds: [number, number, number, number, number][] = [];
    const tints: [number, number, number, number, number][] = [];
    /** colour of the part next to (x, y): a 4-neighbour that is solid and not an outline, else any 8-neighbour */
    const partNear = (x: number, y: number): [number, number, number] | null => {
      for (const list of [N4, N8]) {
        for (const [dx, dy] of list) {
          const nx = x + dx, ny = y + dy;
          if (solid(nx, ny) && !isOutline(nx, ny)) {
            const i = at(nx, ny);
            return [data[i], data[i + 1], data[i + 2]];
          }
        }
      }
      return null;
    };
    for (let y = 0; y < cell.h; y++) {
      for (let x = 0; x < cell.w; x++) {
        const here = solid(x, y);
        const edge = N4.some(([dx, dy]) => !solid(x + dx, y + dy));
        if (here && edge && isOutline(x, y)) {
          const part = partNear(x, y);
          if (part) tints.push([x, y, ...outlineShade(...part)] as [number, number, number, number, number]);
        } else if (!here && alphaOf(data, cell, x, y) === 0) {
          // an empty pixel touching a part that is not outlined here gets the outline (4-neighbourhood: no fat corners)
          let part: [number, number, number] | null = null;
          for (const [dx, dy] of N4) {
            const nx = x + dx, ny = y + dy;
            if (solid(nx, ny) && !isOutline(nx, ny)) {
              const i = at(nx, ny);
              part = [data[i], data[i + 1], data[i + 2]];
              break;
            }
          }
          if (part) adds.push([x, y, ...outlineShade(...part)] as [number, number, number, number, number]);
        }
      }
    }
    for (const [x, y, r, gg, b] of [...tints, ...adds]) {
      const i = at(x, y);
      data[i] = r;
      data[i + 1] = gg;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
}

/** Mix toward a warm white. */
const lift = (v: number, w: number, white: number): number => Math.min(255, Math.round(v + (white - v) * w));

/**
 * Top-left light on one recolored layer (in place): the pixels just inside the outer outline on the top edge (strongest left of centre) and on
 * the left edge. Pure layer logic: "outer" means the outline pixel has nothing opaque outside it in the same layer.
 */
export function highlightEdges(data: Uint8ClampedArray | Uint8Array, g: Geometry, strength = 1): void {
  for (const cell of cells(data.length, g)) {
    const at = (x: number, y: number) => ((cell.y0 + y) * cell.stride + cell.x0 + x) * 4;
    const solid = (x: number, y: number) => alphaOf(data, cell, x, y) >= 128;
    const isOutline = (x: number, y: number) => solid(x, y) && OUTLINE_PACKED.has(packAt(data, at(x, y)));
    const hits: [number, number, number][] = [];
    for (let y = 0; y < cell.h; y++) {
      for (let x = 0; x < cell.w; x++) {
        if (!solid(x, y) || isOutline(x, y)) continue;
        const outer = (dx: number, dy: number) => isOutline(x + dx, y + dy) && !solid(x + dx * 2, y + dy * 2);
        const top = outer(0, -1) || !solid(x, y - 1);
        const left = outer(-1, 0) || !solid(x - 1, y);
        if (top) hits.push([x, y, x <= 8 ? 0.26 : 0.12]);
        else if (left) hits.push([x, y, 0.18]);
      }
    }
    for (const [x, y, w] of hits) {
      const i = at(x, y);
      data[i] = lift(data[i], w * strength, 255);
      data[i + 1] = lift(data[i + 1], w * strength, 244);
      data[i + 2] = lift(data[i + 2], w * strength, 214);
    }
  }
}
