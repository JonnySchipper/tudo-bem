import { describe, expect, it } from 'vitest';
import { T, bufferPixels, cameraCenter, canvasToWorld, cssZoomFor, deviceZoomFor, feet, snapToDevice, tileAtWorld, tileCenterToCanvas, tileToWorld, worldToCanvas, type CamState } from './coords';

const cam = (over: Partial<CamState> = {}): CamState => ({ zoom: 4, dpr: 1, cx: 112, cy: 96, w: 1280, h: 800, ...over });

describe('zoom rule (HOWTO §5.3)', () => {
  it('is 4 on a 1280-wide desktop and 2 on a 390 phone', () => {
    expect(cssZoomFor(1280, 800)).toBe(4);
    expect(cssZoomFor(390, 844)).toBe(2);
  });
  it('clamps to 2..5', () => {
    expect(cssZoomFor(200, 200)).toBe(2);
    expect(cssZoomFor(4000, 3000)).toBe(5);
  });
  it('is always an integer in device pixels', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) for (const css of [2, 3, 4, 5]) expect(Number.isInteger(deviceZoomFor(css, dpr))).toBe(true);
    expect(deviceZoomFor(4, 1.25)).toBe(5);
    expect(deviceZoomFor(3, 2)).toBe(6);
  });
});

describe('tileToClient ∘ tileAt round trip', () => {
  const cols = 14;
  const rows = 12;
  for (const [name, c] of [
    ['desktop dpr 1', cam()],
    ['phone dpr 2', cam({ zoom: 4, dpr: 2, w: 780, h: 1688, cx: 60, cy: 150 })],
    ['dpr 1.25', cam({ zoom: 5, dpr: 1.25, w: 1600, h: 1000, cx: 70, cy: 80 })],
  ] as const) {
    it(`every tile centre maps back to its own tile (${name})`, () => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const p = tileCenterToCanvas(c, x, y);
          const w = canvasToWorld(c, p.px, p.py);
          expect(tileAtWorld(w.wx, w.wy, cols, rows)).toEqual({ x, y });
        }
      }
    });
  }

  it('world <-> canvas are inverses', () => {
    const c = cam({ cx: 101.5, cy: 77 });
    const p = worldToCanvas(c, 40, 50);
    const w = canvasToWorld(c, p.px, p.py);
    expect(w.wx).toBeCloseTo(40);
    expect(w.wy).toBeCloseTo(50);
  });

  it('the canvas centre is the camera centre', () => {
    const c = cam();
    const w = canvasToWorld(c, c.w / 2 / c.dpr, c.h / 2 / c.dpr);
    expect(w.wx).toBeCloseTo(c.cx);
    expect(w.wy).toBeCloseTo(c.cy);
  });

  it('one art pixel is `zoom / dpr` CSS px (cam.scale)', () => {
    const c = cam({ zoom: 5, dpr: 1.25 });
    const a = worldToCanvas(c, 10, 10);
    const b = worldToCanvas(c, 11, 10);
    expect(b.px - a.px).toBeCloseTo(4);
  });

  it('tileAt is null outside the room', () => {
    expect(tileAtWorld(-1, 5, 14, 12)).toBeNull();
    expect(tileAtWorld(14 * T, 5, 14, 12)).toBeNull();
    expect(tileAtWorld(5, 12 * T, 14, 12)).toBeNull();
    expect(tileAtWorld(0, 0, 14, 12)).toEqual({ x: 0, y: 0 });
  });
});

describe('world anchors', () => {
  it('tile centres and feet (HOWTO §5.4)', () => {
    expect(tileToWorld(2, 3)).toEqual({ wx: 40, wy: 56 });
    expect(feet(2, 3)).toEqual({ wx: 40, wy: 61 });
  });
});

describe('cameraCenter', () => {
  const none = { top: 0, bottom: 0, left: 0, right: 0 };
  const view = { w: 1280, h: 800, zoom: 4 }; // sees 320 x 200 world px

  it('centres a room smaller than the screen on both axes', () => {
    const c = cameraCenter(view, { x0: 0, y0: 0, x1: 160, y1: 120 }, { x: 10, y: 10 }, none);
    expect(c).toEqual({ cx: 80, cy: 60 });
  });

  it('follows the focus when the room is bigger, and never shows outside the bounds', () => {
    const bounds = { x0: 0, y0: 0, x1: 900, y1: 700 };
    expect(cameraCenter(view, bounds, { x: 450, y: 350 }, none)).toEqual({ cx: 450, cy: 350 });
    expect(cameraCenter(view, bounds, { x: 0, y: 0 }, none)).toEqual({ cx: 160, cy: 100 });
    expect(cameraCenter(view, bounds, { x: 900, y: 700 }, none)).toEqual({ cx: 740, cy: 600 });
  });

  it('works per axis: wide room follows x, short room centres y', () => {
    const c = cameraCenter(view, { x0: 0, y0: 0, x1: 900, y1: 120 }, { x: 450, y: 60 }, none);
    expect(c.cx).toBe(450);
    expect(c.cy).toBe(60);
  });

  it('HUD insets shift a centred room into the free region', () => {
    const c = cameraCenter(view, { x0: 0, y0: 0, x1: 160, y1: 60 }, { x: 0, y: 0 }, { top: 40, bottom: 400, left: 0, right: 0 });
    // the free region is screen y 40..400 (centre 220): the room centre (world 30) must appear there, 45 world px above the middle
    expect(c.cy).toBeCloseTo(30 + 45, 5);
  });

  it('snaps to the device pixel grid', () => {
    expect(snapToDevice(10.13, 4)).toBe(10.25);
    expect(snapToDevice(10.1, 4)).toBe(10);
  });
});

describe('bufferPixels (#48: stay inside the WebGL texture limit)', () => {
  it('leaves ordinary windows alone', () => {
    expect(bufferPixels(1280, 800, 1)).toEqual({ dpr: 1, width: 1280, height: 800 });
    expect(bufferPixels(390, 844, 3)).toEqual({ dpr: 3, width: 1170, height: 2532 });
  });
  it('lowers the dpr so neither side exceeds 4096', () => {
    const r = bufferPixels(2500, 1400, 2);
    expect(r.width).toBeLessThanOrEqual(4096);
    expect(r.height).toBeLessThanOrEqual(4096);
    expect(r.dpr).toBeCloseTo(4096 / 2500, 5);
    const t = bufferPixels(1600, 1000, 3);
    expect(t.width).toBeLessThanOrEqual(4096);
    expect(t.height).toBeLessThanOrEqual(4096);
  });
  it('clamps the dpr to 1..3 and tolerates junk', () => {
    expect(bufferPixels(800, 600, 5).dpr).toBe(3);
    expect(bufferPixels(800, 600, 0.5).dpr).toBe(1);
    expect(bufferPixels(800, 600, NaN).dpr).toBe(1);
    expect(bufferPixels(0, 0, 2).width).toBeGreaterThanOrEqual(1);
  });
});
