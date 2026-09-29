import { describe, expect, it } from 'vitest';
import { cssToWorld, feet, tileToWorld, worldToCss, worldToTile, type PixelCam } from './coords';

const cam: PixelCam = {
  scrollX: -24,
  scrollY: 40,
  zoom: 8,
  width: 1280,
  height: 800,
  originX: 0.5,
  originY: 0.5,
  cssWidth: 640,
  cssHeight: 400,
  offsetX: 12,
  offsetY: 8,
};

describe('tile coordinates', () => {
  it('places a tile center and the feet inside that tile', () => {
    expect(tileToWorld(0, 0)).toEqual({ wx: 8, wy: 8 });
    expect(feet(0, 0)).toEqual({ wx: 8, wy: 13 });
    expect(worldToTile(tileToWorld(3, 4).wx, tileToWorld(3, 4).wy)).toEqual({ x: 3, y: 4 });
    expect(worldToTile(feet(3, 4).wx, feet(3, 4).wy)).toEqual({ x: 3, y: 4 });
  });

  it('round-trips a tile center through the camera', () => {
    for (const [x, y] of [
      [0, 0],
      [5, 0],
      [7, 7],
      [13, 11],
    ] as const) {
      const center = tileToWorld(x, y);
      const css = worldToCss(cam, center.wx, center.wy);
      const back = cssToWorld(cam, css.px, css.py);
      expect(back.wx).toBeCloseTo(center.wx, 6);
      expect(back.wy).toBeCloseTo(center.wy, 6);
      expect(worldToTile(back.wx, back.wy)).toEqual({ x, y });
    }
  });

  it('round-trips a fractional point the way positionAlong does', () => {
    const center = tileToWorld(2.35, 6.8);
    const css = worldToCss(cam, center.wx, center.wy);
    const back = cssToWorld(cam, css.px, css.py);
    expect(back.wx).toBeCloseTo(center.wx, 6);
    expect(back.wy).toBeCloseTo(center.wy, 6);
  });
});
