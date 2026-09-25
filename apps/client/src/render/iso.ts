export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;

/** Tile-space (x, y) → world pixels (tile corner projection). */
export function toScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * HW, sy: (x + y) * HH };
}

/** Center of a tile, on the floor. */
export function tileCenter(x: number, y: number) {
  return toScreen(x + 0.5, y + 0.5);
}

export function toTile(sx: number, sy: number): { x: number; y: number } {
  const a = sx / HW;
  const b = sy / HH;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

export interface Camera {
  scale: number;
  ox: number;
  oy: number;
  dpr: number;
}

export function computeCamera(
  canvasW: number,
  canvasH: number,
  cols: number,
  rows: number,
  wallH: number,
  dpr: number,
  insets: { top: number; bottom: number; left?: number; right?: number } = { top: 70, bottom: 120 },
): Camera {
  const worldW = (cols + rows) * HW + 40;
  const worldH = (cols + rows) * HH + wallH + 90;
  const left = insets.left ?? 0;
  const availW = canvasW - left - (insets.right ?? 0);
  const availH = canvasH - insets.top - insets.bottom;
  const scale = Math.max(0.55, Math.min(1.9, Math.min(availW / worldW, availH / worldH)));
  const minX = -rows * HW;
  const maxX = cols * HW;
  const cx = (minX + maxX) / 2;
  const topY = -wallH - 40;
  const botY = (cols + rows) * HH + 50;
  const cy = (topY + botY) / 2;
  return {
    scale,
    ox: left + availW / 2 - cx * scale,
    oy: insets.top + availH / 2 - cy * scale,
    dpr,
  };
}

export function screenToWorld(cam: Camera, px: number, py: number) {
  return { wx: (px - cam.ox) / cam.scale, wy: (py - cam.oy) / cam.scale };
}

export function worldToClient(cam: Camera, wx: number, wy: number) {
  return { px: wx * cam.scale + cam.ox, py: wy * cam.scale + cam.oy };
}
