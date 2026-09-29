/**
 * Body type height (esguio / forte), applied to a fully composed sheet so the head, hair and hats move together with the torso.
 *
 * Per frame, one torso row (feet row - 6: the arm row) is duplicated for `esguio` (the head and everything above rise 1 px, longer arms)
 * or deleted for `forte` (the head sinks 1 px, stockier). The feet never move. The width part of the body types (2 center columns
 * removed / doubled on body-attached layers) is baked into the layer sheets at import (`__esguio`, `__forte`).
 * Pure: works on an RGBA buffer.
 */
export interface Geometry {
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
}

/** Last opaque row of every frame of a body sheet (-1 for an empty frame), indexed row * cols + col. */
export function frameBottoms(body: ArrayLike<number>, g: Geometry): Int8Array {
  const W = g.frameW * g.cols;
  const out = new Int8Array(g.rows * g.cols).fill(-1);
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      let bottom = -1;
      for (let y = g.frameH - 1; y >= 0 && bottom < 0; y--) {
        for (let x = 0; x < g.frameW; x++) {
          if (body[((r * g.frameH + y) * W + c * g.frameW + x) * 4 + 3]) {
            bottom = y;
            break;
          }
        }
      }
      out[r * g.cols + c] = bottom;
    }
  }
  return out;
}

/** Offset of the cut row above the feet row. */
export const CUT_ABOVE_FEET = 6;

/** Returns a new buffer with the height change applied (`medio` returns the input unchanged). */
export function applyBodyHeight(rgba: Uint8ClampedArray, g: Geometry, bottoms: Int8Array, mode: 'esguio' | 'medio' | 'forte'): Uint8ClampedArray {
  if (mode === 'medio') return rgba;
  const W = g.frameW * g.cols;
  const out = new Uint8ClampedArray(rgba);
  const rowBytes = g.frameW * 4;
  const copyRow = (r: number, c: number, from: number, to: number) => {
    const s = ((r * g.frameH + from) * W + c * g.frameW) * 4;
    const d = ((r * g.frameH + to) * W + c * g.frameW) * 4;
    out.set(rgba.subarray(s, s + rowBytes), d);
  };
  const clearRow = (r: number, c: number, y: number) => {
    const d = ((r * g.frameH + y) * W + c * g.frameW) * 4;
    out.fill(0, d, d + rowBytes);
  };
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const b = bottoms[r * g.cols + c];
      if (b < 8) continue;
      const cut = b - CUT_ABOVE_FEET;
      if (mode === 'esguio') {
        // rows 1..cut move up one, the cut row stays (so it appears twice)
        for (let y = 0; y < cut; y++) copyRow(r, c, y + 1, y);
      } else {
        // rows 0..cut-1 move down one; the old cut row is overwritten and row 0 is emptied
        for (let y = cut; y >= 1; y--) copyRow(r, c, y - 1, y);
        clearRow(r, c, 0);
      }
    }
  }
  return out;
}
