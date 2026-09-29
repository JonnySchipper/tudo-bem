import { describe, expect, it } from 'vitest';
import { GUIDE_ROTATION, pinGuide } from './guides';

const view = { w: 1280, h: 800 };
const ins = { top: 64, bottom: 110, left: 0, right: 0 };
const pad = 4;

describe('pinGuide (arrow pinned to the nearest screen edge)', () => {
  it('an on-screen target keeps the arrow where it is, pointing down', () => {
    expect(pinGuide({ x: 640, y: 300 }, view, ins, pad)).toEqual({ x: 640, y: 300, off: false, dir: 'down' });
  });

  it('a target left of the screen pins to the left edge and points left', () => {
    const p = pinGuide({ x: -200, y: 400 }, view, ins, pad);
    expect(p).toEqual({ x: pad, y: 400, off: true, dir: 'left' });
  });

  it('right, above and below', () => {
    expect(pinGuide({ x: 1500, y: 400 }, view, ins, pad)).toEqual({ x: 1280 - pad, y: 400, off: true, dir: 'right' });
    const up = pinGuide({ x: 640, y: -300 }, view, ins, pad);
    expect(up).toEqual({ x: 640, y: ins.top + pad, off: true, dir: 'up' });
    const down = pinGuide({ x: 640, y: 1200 }, view, ins, pad);
    expect(down).toEqual({ x: 640, y: 800 - ins.bottom - pad, off: true, dir: 'down' });
  });

  it('keeps clear of the HUD: a target under the top bar pins just below it', () => {
    const p = pinGuide({ x: 640, y: 20 }, view, ins, pad);
    expect(p.off).toBe(true);
    expect(p.dir).toBe('up');
    expect(p.y).toBe(ins.top + pad);
  });

  it('a corner pins to the corner and points along the larger overshoot', () => {
    const a = pinGuide({ x: -900, y: -100 }, view, ins, pad);
    expect([a.x, a.y]).toEqual([pad, ins.top + pad]);
    expect(a.dir).toBe('left'); // 904 px left vs 168 px up
    const b = pinGuide({ x: 1400, y: 1500 }, view, ins, pad);
    expect([b.x, b.y]).toEqual([1280 - pad, 800 - ins.bottom - pad]);
    expect(b.dir).toBe('down'); // 120 px right vs 790 px down
  });

  it('the pinned point is always inside the free region, and the direction points at the target', () => {
    for (let x = -600; x <= 1900; x += 173) {
      for (let y = -500; y <= 1300; y += 149) {
        const p = pinGuide({ x, y }, view, ins, pad);
        expect(p.x).toBeGreaterThanOrEqual(pad);
        expect(p.x).toBeLessThanOrEqual(1280 - pad);
        expect(p.y).toBeGreaterThanOrEqual(ins.top + pad);
        expect(p.y).toBeLessThanOrEqual(800 - ins.bottom - pad);
        if (!p.off) continue;
        if (p.dir === 'left') expect(x).toBeLessThan(p.x);
        if (p.dir === 'right') expect(x).toBeGreaterThan(p.x);
        if (p.dir === 'up') expect(y).toBeLessThan(p.y);
        if (p.dir === 'down') expect(y).toBeGreaterThan(p.y);
      }
    }
  });

  it('never returns an inverted region on a tiny viewport', () => {
    const p = pinGuide({ x: 500, y: 500 }, { w: 40, h: 100 }, { top: 60, bottom: 60, left: 0, right: 0 }, pad);
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it('the rotations are multiples of 90 (pixel art stays crisp) and point the down arrow the right way', () => {
    for (const r of Object.values(GUIDE_ROTATION)) expect(r % 90).toBe(0);
    expect(GUIDE_ROTATION).toEqual({ down: 0, left: 90, up: 180, right: 270 });
  });
});
