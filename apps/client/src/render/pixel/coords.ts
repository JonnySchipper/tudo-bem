/** Art pixels per tile. World tile (x, y) occupies [x*T, (x+1)*T) × [y*T, (y+1)*T). */
export const T = 16;

export const DEPTH_TERRAIN = -10000;
export const DEPTH_DECAL = -5000;
export const DEPTH_OVERHEAD = 50000;

/** Center of world tile (x, y), in art pixels. x and y may be fractional. */
export const tileToWorld = (x: number, y: number): { wx: number; wy: number } => ({
  wx: (x + 0.5) * T,
  wy: (y + 0.5) * T,
});

/** Feet of a character standing on tile (x, y). Origin (0.5, 1) sits here. */
export const feet = (x: number, y: number): { wx: number; wy: number } => ({
  wx: (x + 0.5) * T,
  wy: (y + 1) * T - 3,
});

/** World pixel → tile index. Negative coordinates floor toward −∞. */
export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  return { x: Math.floor(wx / T), y: Math.floor(wy / T) };
}

/** Standing-object depth: bottom-edge world y, plus a tiny stable tiebreak. */
export function standingDepth(bottomY: number, id: string): number {
  return bottomY + (hashId(id) % 100) / 1000;
}

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * CSS pixels per art pixel. Shows about 20 tiles across on a desktop and about 12 on a phone.
 * Always an integer in [2, 5].
 */
export function cssZoomFor(innerWidth: number, innerHeight: number): number {
  const across = innerWidth / (20 * T);
  const down = innerHeight / (12 * T);
  return Math.min(5, Math.max(2, Math.floor(Math.min(across, down))));
}

/** Device-pixel camera zoom. Integer so art pixels stay crisp. */
export function cameraZoom(cssZoom: number, dpr: number): number {
  return Math.max(1, Math.round(cssZoom * dpr));
}

/**
 * Camera numbers needed to convert world art-pixels ↔ CSS client pixels.
 * Matches Phaser's camera matrix when rotation is 0: scroll is the world point at the
 * camera's top-left in unzoomed game pixels, and the origin (default 0.5) is the look-at.
 */
export interface PixelCam {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  cssWidth: number;
  cssHeight: number;
  offsetX: number;
  offsetY: number;
}

export function worldToCss(cam: PixelCam, wx: number, wy: number): { px: number; py: number } {
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  const gx = (wx - cam.scrollX - ox) * cam.zoom + Math.floor(ox + 0.5);
  const gy = (wy - cam.scrollY - oy) * cam.zoom + Math.floor(oy + 0.5);
  const sx = cam.width > 0 ? cam.cssWidth / cam.width : 1;
  const sy = cam.height > 0 ? cam.cssHeight / cam.height : 1;
  return { px: cam.offsetX + gx * sx, py: cam.offsetY + gy * sy };
}

export function cssToWorld(cam: PixelCam, px: number, py: number): { wx: number; wy: number } {
  const ox = cam.width * cam.originX;
  const oy = cam.height * cam.originY;
  const sx = cam.width > 0 ? cam.cssWidth / cam.width : 1;
  const sy = cam.height > 0 ? cam.cssHeight / cam.height : 1;
  const gx = sx !== 0 ? (px - cam.offsetX) / sx : 0;
  const gy = sy !== 0 ? (py - cam.offsetY) / sy : 0;
  const zoom = cam.zoom || 1;
  return {
    wx: cam.scrollX + ox + (gx - Math.floor(ox + 0.5)) / zoom,
    wy: cam.scrollY + oy + (gy - Math.floor(oy + 0.5)) / zoom,
  };
}
