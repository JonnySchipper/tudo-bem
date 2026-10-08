// Issue #154: the tap marker, the soft edge of the outdoor camera, the HUD insets after the joystick, and the surround's prop reach.
import { describe, expect, it } from 'vitest';
import { ROOMS, type RoomId } from '@tudobem/shared';
import { EDGE_KNEE, T, cameraCenter, cssZoomFor, hudInsets, outdoorFraming, softClamp, type Insets } from './coords';
import { roomBounds } from './roomLayout';
import { SURROUND_PROP_REACH, SURROUND_TILES, surroundFor, surroundReachFor } from './surround';
import { CROSS_PIXELS, TAP_HOLD_MAX_S, TAP_POP_S, TAP_REFUSED_S, ringPixels, tapFrame } from './tapMark';

const OUTDOOR: RoomId[] = ['praca', 'rua', 'rua_leste', 'feira', 'aeroporto'];

describe('softClamp', () => {
  it('passes the middle through and never leaves the range', () => {
    expect(softClamp(50, 0, 100, 10)).toBe(50);
    for (let v = -40; v <= 140; v += 0.5) {
      const c = softClamp(v, 0, 100, 10);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(100);
    }
    expect(softClamp(-5, 0, 100, 10)).toBeGreaterThan(0); // eased, not pinned yet
    expect(softClamp(-30, 0, 100, 10)).toBe(0);
    expect(softClamp(130, 0, 100, 10)).toBe(100);
  });

  it('is continuous and never moves backwards, with no jump in speed at the knee', () => {
    let prev = softClamp(-50, 0, 100, 16);
    let prevSlope = 0;
    for (let v = -50; v <= 150; v += 0.25) {
      const c = softClamp(v, 0, 100, 16);
      expect(c).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(c - prev).toBeLessThanOrEqual(0.25 + 1e-9);
      const slope = (c - prev) / 0.25;
      expect(Math.abs(slope - prevSlope)).toBeLessThan(0.1);
      prev = c;
      prevSlope = slope;
    }
  });

  it('a knee of 0 is the hard clamp, and a range narrower than two knees still fits', () => {
    for (const v of [-3, 0, 4, 9, 13]) expect(softClamp(v, 0, 10, 0)).toBe(Math.min(10, Math.max(0, v)));
    expect(softClamp(5, 0, 10, 50)).toBeCloseTo(5, 6);
    expect(softClamp(-100, 0, 10, 50)).toBe(0);
    expect(softClamp(100, 0, 10, 50)).toBe(10);
  });
});

describe('outdoor camera edge', () => {
  const desktop = { w: 1280, h: 800 };
  const ins: Insets = { top: 64, bottom: 110, left: 0, right: 0 };

  it('slows into the edge of the map instead of stopping dead, and still sits on the edge once the avatar is there', () => {
    const b = roomBounds(ROOMS.praca);
    const hard = (x: number) => cameraCenter({ ...desktop, zoom: 3 }, b, { x, y: 16 * T }, ins).cx;
    const soft = (x: number) => outdoorFraming(desktop, b, { x, y: 16 * T }, ins, 3, 1).cx;
    const min = hard(b.x0);
    expect(soft(b.x0 + T)).toBeCloseTo(min, 6);
    // at the clamp point itself the hard camera has stopped; the soft one is still a little short of the edge and moving
    expect(soft(min)).toBeGreaterThan(min);
    expect(soft(min + 1) - soft(min)).toBeGreaterThan(0);
    // two tiles further in, both follow the avatar exactly
    expect(soft(min + EDGE_KNEE + 1)).toBeCloseTo(min + EDGE_KNEE + 1, 6);
  });
});

describe('hudInsets', () => {
  it('desktop keeps the old numbers', () => {
    expect(hudInsets(1280, 800, false)).toEqual({ top: 64, bottom: 110, left: 0, right: 0 });
  });

  it('a portrait phone no longer keeps the joystick space at the bottom', () => {
    const p = hudInsets(390, 844, true);
    expect(p.top).toBe(124);
    expect(p.bottom).toBeLessThan(110);
  });

  it('a landscape phone keeps most of its height for the street', () => {
    const l = hudInsets(844, 390, true);
    expect(390 - l.top - l.bottom).toBeGreaterThanOrEqual(250);
    // the safe areas (notch, home bar) still add on top
    expect(hudInsets(844, 390, true, 20, 21)).toEqual({ ...l, top: l.top + 20, bottom: l.bottom + 21 });
  });
});

describe('surroundReachFor', () => {
  const visiblePast = (id: RoomId, w: number, h: number) => {
    const def = ROOMS[id];
    const z = cssZoomFor(w, h);
    const ins = hudInsets(w, h, w <= 640 || h <= 520);
    return { def, z, ins, reach: surroundReachFor(def, { w, h }, z, ins) };
  };

  it('a phone keeps the old 8-tile reach (perf, issue #123)', () => {
    for (const id of OUTDOOR) expect(visiblePast(id, 390, 844).reach, id).toBe(SURROUND_PROP_REACH);
  });

  it('never stops short of what the window shows past the map, from a laptop to 4K', () => {
    for (const [w, h] of [[1280, 800], [1920, 1080], [2560, 1440], [3840, 2160]] as const) {
      for (const id of OUTDOOR) {
        const { def, z, reach } = visiblePast(id, w, h);
        const pastX = Math.max(0, (w / z - def.cols * T) / 2) / T;
        const pastY = Math.max(0, (h / z - def.rows * T) / 2) / T;
        expect(reach, `${id} ${w}x${h}`).toBeGreaterThanOrEqual(Math.min(SURROUND_TILES, Math.ceil(Math.max(pastX, pastY)) + 1));
        expect(reach).toBeLessThanOrEqual(SURROUND_TILES);
        expect(reach % 4).toBe(0);
      }
    }
  });

  it('a longer reach builds more of the town, still all outside the walkable map', () => {
    const near = surroundFor(ROOMS.rua, 8)!;
    const far = surroundFor(ROOMS.rua, 16)!;
    expect(far.props.length).toBeGreaterThan(near.props.length);
    expect(far.dashes.length).toBeGreaterThan(near.dashes.length);
    expect(far.reach.x0).toBe(-16 * T);
    expect(surroundFor(ROOMS.rua)).toEqual(near);
    for (const p of far.props) expect(p.blocks).toBe(false);
  });
});

describe('tapFrame', () => {
  it('a floor or target ring pops out, then settles until the avatar arrives', () => {
    for (const kind of ['walk', 'target'] as const) {
      const pop = tapFrame(kind, TAP_POP_S / 2, false)!;
      const settled = tapFrame(kind, TAP_POP_S + 0.5, false)!;
      expect(pop.radius).toBeGreaterThan(settled.radius);
      expect(settled.alpha).toBeGreaterThan(0.3);
      // arriving while it still pops lets the pop finish; after that the ring goes
      expect(tapFrame(kind, TAP_POP_S / 2, true)).not.toBeNull();
      expect(tapFrame(kind, TAP_POP_S + 0.5, true)).toBeNull();
      expect(tapFrame(kind, TAP_HOLD_MAX_S + 0.1, false)).toBeNull();
    }
  });

  it('a steer has no pop (it moves several times a second)', () => {
    expect(tapFrame('steer', 0.05, false)!.radius).toBe(tapFrame('walk', TAP_POP_S + 1, false)!.radius);
  });

  it('the refused cross shakes and fades within half a second', () => {
    const early = tapFrame('refused', 0.03, false)!;
    expect(early.alpha).toBeGreaterThan(0.9);
    const shakes = new Set<number>();
    for (let t = 0; t < TAP_REFUSED_S; t += 0.01) shakes.add(tapFrame('refused', t, false)!.shake);
    expect(shakes.size).toBeGreaterThan(1);
    expect(tapFrame('refused', TAP_REFUSED_S, false)).toBeNull();
  });

  it('reduced motion: no pop, no shake', () => {
    expect(tapFrame('walk', 0.05, false, true)!.radius).toBe(tapFrame('walk', TAP_POP_S + 1, false, true)!.radius);
    for (let t = 0; t < TAP_REFUSED_S; t += 0.02) expect(tapFrame('refused', t, false, true)!.shake).toBe(0);
  });
});

describe('ringPixels', () => {
  it('is a closed one-pixel ring, flattened to the ground, every pixel once', () => {
    for (const r of [2, 4, 7]) {
      const px = ringPixels(r);
      expect(new Set(px.map(([x, y]) => `${x},${y}`)).size).toBe(px.length);
      for (const [x, y] of px) {
        expect(Math.abs(x)).toBeLessThanOrEqual(r);
        expect(Math.abs(y)).toBeLessThan(r);
      }
      // every pixel has a neighbour in the ring (8-connected): no gaps
      for (const [x, y] of px) expect(px.some(([a, b]) => (a !== x || b !== y) && Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1)).toBe(true);
    }
  });

  it('the cross is symmetric', () => {
    for (const [x, y] of CROSS_PIXELS) expect(CROSS_PIXELS.some(([a, b]) => a === -x && b === y)).toBe(true);
  });
});
