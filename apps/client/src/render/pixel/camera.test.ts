import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { EDGE_KNEE, T, cssZoomFor, deviceZoomFor, fitsAt, outdoorFraming, roomFraming, roomZoom, viewTop, type Insets } from './coords';
import { roomBounds } from './roomLayout';

// Phase 4a: the whole room, wall band included, when it fits; otherwise follow the avatar with the north wall in view.
/** The bounds of the old 14 x 12 praça (a facade rising above its wall band): a room bigger than the screen at zoom 4, the interior rules still apply to it. */
const OLD_PRACA = { x0: -T, y0: -96, x1: 14 * T, y1: 12 * T };
const desktop = { w: 1280, h: 800 };
const desktopIns: Insets = { top: 64, bottom: 110, left: 0, right: 0 }; // what PixelView reserves for the HUD
const phone = { w: 390 * 2, h: 844 * 2 }; // dpr 2
const phoneIns: Insets = { top: 124 * 2, bottom: 168 * 2, left: 0, right: 0 };

describe('roomZoom', () => {
  it('the padaria fits whole at the default 1280 x 800 zoom (3) with no step down; at 4 it would not, so a bigger window steps down to 3', () => {
    const b = roomBounds(ROOMS.padaria);
    expect(cssZoomFor(1280, 800)).toBe(3);
    expect(fitsAt(desktop, b, desktopIns, 3)).toBe(true);
    expect(roomZoom(desktop, b, desktopIns, cssZoomFor(1280, 800), 1)).toBe(3);
    expect(fitsAt(desktop, b, desktopIns, 4)).toBe(false);
    expect(roomZoom(desktop, b, desktopIns, 4, 1)).toBe(3);
  });

  it('every interior fits whole at a 1280 x 800 desktop, at an integer zoom', () => {
    for (const id of ['padaria', 'kitnet', 'academia'] as const) {
      const z = roomZoom(desktop, roomBounds(ROOMS[id]), desktopIns, 4, 1);
      expect(Number.isInteger(z), id).toBe(true);
      expect(fitsAt(desktop, roomBounds(ROOMS[id]), desktopIns, z), id).toBe(true);
    }
  });

  it('keeps the window zoom when the room already fits, or when even one step lower would not fit (the praça)', () => {
    expect(roomZoom(desktop, roomBounds(ROOMS.kitnet), desktopIns, 3, 1)).toBe(3);
    expect(roomZoom(desktop, OLD_PRACA, desktopIns, 4, 1)).toBe(4);
  });

  it('never goes below CSS zoom 2, and stays an integer at fractional DPRs', () => {
    expect(roomZoom(phone, roomBounds(ROOMS.padaria), phoneIns, 2, 2)).toBe(4);
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const w = Math.round(1280 * dpr);
      const h = Math.round(800 * dpr);
      const z = roomZoom({ w, h }, roomBounds(ROOMS.academia), { top: 64 * dpr, bottom: 110 * dpr, left: 0, right: 0 }, 4, dpr);
      expect(Number.isInteger(z)).toBe(true);
      expect(z).toBeGreaterThanOrEqual(deviceZoomFor(3, dpr));
    }
  });
});

describe('roomFraming', () => {
  it('a room that fits is centred with its whole wall band in view', () => {
    const b = roomBounds(ROOMS.padaria);
    const f = roomFraming(desktop, b, { x: 5 * T, y: 7 * T }, desktopIns, 4, 1);
    expect(f.fits).toBe(true);
    expect(viewTop(desktop, f.cy, f.zoom, desktopIns)).toBeLessThanOrEqual(b.y0 + 0.01);
    // the bounds' bottom is visible too: the top of the HUD-free region plus the room height stays inside it
    const freeH = (desktop.h - desktopIns.top - desktopIns.bottom) / f.zoom;
    expect(b.y1 - b.y0).toBeLessThanOrEqual(freeH);
    // and it does not move with the avatar
    const g = roomFraming(desktop, b, { x: 2 * T, y: 2 * T }, desktopIns, 4, 1);
    expect(g).toEqual(f);
  });

  it('a room that does not fit follows the avatar but never hides the north wall while the avatar is in the top 3 rows', () => {
    const b = OLD_PRACA; // the praça (facade above the band) is bigger than the screen at zoom 4
    for (let row = 0; row < 3; row++) {
      for (const col of [0, 5, 13]) {
        const focus = { x: (col + 0.5) * T, y: (row + 1) * T - 3 - 10 }; // what WorldScene follows: the avatar's feet minus 10
        const f = roomFraming(desktop, b, focus, desktopIns, 4, 1);
        expect(f.fits).toBe(false);
        // the whole 3-tile wall band is in view (the facade rising above it may be cropped)
        expect(viewTop(desktop, f.cy, f.zoom, desktopIns), `row ${row}`).toBeLessThanOrEqual(-3 * T + 0.01);
        // and the avatar is still comfortably on screen (not pushed under the chat bar)
        const feetScreen = (focus.y + 10 - f.cy) * f.zoom + desktop.h / 2;
        expect(feetScreen, `row ${row}`).toBeLessThan(desktop.h - desktopIns.bottom);
      }
    }
  });

  it('an avatar on row 3 of the praça (just below the top rows) is still well inside the free region', () => {
    const b = OLD_PRACA;
    const f = roomFraming(desktop, b, { x: 8 * T, y: 4 * T - 3 - 10 }, desktopIns, 4, 1);
    const feetScreen = (4 * T - 3 - f.cy) * f.zoom + desktop.h / 2;
    expect(feetScreen).toBeLessThan(desktop.h - desktopIns.bottom - 40);
  });

  it('eases into following: the camera never jumps as the avatar leaves the top rows, and never moves up as it walks down', () => {
    const b = OLD_PRACA;
    let prev = roomFraming(desktop, b, { x: 7 * T, y: 0 }, desktopIns, 4, 1).cy;
    for (let y = 1; y <= 11 * T; y++) {
      const cy = roomFraming(desktop, b, { x: 7 * T, y }, desktopIns, 4, 1).cy;
      expect(cy).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(cy - prev).toBeLessThanOrEqual(3); // while easing the camera target moves up to about 2.5x as fast as the avatar (WorldScene smooths it further)
      prev = cy;
    }
  });

  it('an avatar in rows 3-5 sees most of the wall band (the view top is within a tile or two of it)', () => {
    const b = roomBounds(ROOMS.padaria);
    // a small window that does not fit the padaria at zoom 2: 800 x 300 css px
    const small = { w: 800, h: 300 };
    const ins: Insets = { top: 10, bottom: 10, left: 0, right: 0 };
    const f = roomFraming(small, b, { x: 5 * T, y: 3 * T + 3 }, ins, 2, 1);
    expect(f.fits).toBe(false);
    expect(viewTop(small, f.cy, f.zoom, ins) - b.y0).toBeLessThanOrEqual(2 * T);
  });

  it('following an avatar at the south end shows the south edge, not the wall (bounds clamp)', () => {
    const b = OLD_PRACA;
    const f = roomFraming(desktop, b, { x: 7 * T, y: 11 * T }, desktopIns, 4, 1);
    const bottom = f.cy + (desktop.h / 2 - desktopIns.bottom) / f.zoom;
    expect(bottom).toBeCloseTo(b.y1, 5);
  });

  it('is a phone: interiors fit at zoom 2 (dpr 2 = device zoom 4) and are centred', () => {
    const b = roomBounds(ROOMS.academia);
    const f = roomFraming(phone, b, { x: T, y: 7 * T }, phoneIns, 2, 2);
    expect(f.zoom).toBe(4);
    expect(f.fits).toBe(true);
  });
});

// Issue #123: an open-air map keeps the window's zoom and follows the avatar. Interiors stay on roomFraming above.
describe('outdoorFraming', () => {
  const wide = { w: 1920, h: 1080 };

  it('keeps the window zoom with no step-down (a street that fits one zoom lower stays at the window zoom)', () => {
    const css = cssZoomFor(desktop.w, desktop.h); // 3
    for (const id of ['rua', 'rua_leste'] as const) {
      const b = roomBounds(ROOMS[id]);
      const focus = { x: 8 * T, y: 12 * T };
      const out = outdoorFraming(desktop, b, focus, desktopIns, css, 1);
      expect(out.zoom, id).toBe(deviceZoomFor(css, 1));
      // the interior rule would step down: the street fits whole at zoom 2
      expect(roomZoom(desktop, b, desktopIns, css, 1), id).toBe(css - 1);
      expect(roomFraming(desktop, b, focus, desktopIns, css, 1).zoom, id).toBe(css - 1);
    }
    const rua = roomBounds(ROOMS.rua);
    expect(outdoorFraming(wide, rua, { x: 8 * T, y: 12 * T }, desktopIns, 4, 1).zoom).toBe(4);
    expect(roomZoom(wide, rua, desktopIns, 4, 1)).toBe(3);
  });

  it('is an integer device zoom, including fractional DPRs, and a phone stays at css zoom 2', () => {
    const b = roomBounds(ROOMS.praca);
    const focus = { x: 16 * T, y: 16 * T };
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      const view = { w: Math.round(1280 * dpr), h: Math.round(800 * dpr) };
      const ins: Insets = { top: desktopIns.top * dpr, bottom: desktopIns.bottom * dpr, left: 0, right: 0 };
      const f = outdoorFraming(view, b, focus, ins, 3, dpr);
      expect(Number.isInteger(f.zoom), `dpr ${dpr}`).toBe(true);
      expect(f.zoom, `dpr ${dpr}`).toBe(deviceZoomFor(3, dpr));
    }
    const phoneOut = outdoorFraming(phone, roomBounds(ROOMS.rua), { x: 10 * T, y: 10 * T }, phoneIns, 2, 2);
    expect(phoneOut.zoom).toBe(4);
    expect(Number.isInteger(phoneOut.zoom)).toBe(true);
  });

  it('follows the avatar and clamps at the map edges; an axis narrower than the window stays centred', () => {
    const b = roomBounds(ROOMS.praca); // bigger than 1280 x 800 at zoom 3 on both axes
    const css = 3;
    // the clamp is the HUD-free region; the bars themselves may show the town drawn around the map
    const free = (f: { cx: number; cy: number; zoom: number }) => ({
      x0: f.cx - (desktop.w / 2 - desktopIns.left) / f.zoom,
      x1: f.cx + (desktop.w / 2 - desktopIns.right) / f.zoom,
      y0: viewTop(desktop, f.cy, f.zoom, desktopIns),
      y1: f.cy + (desktop.h / 2 - desktopIns.bottom) / f.zoom,
    });
    // north-west corner: the free region sits on the map's top and left edges
    const nw = outdoorFraming(desktop, b, { x: b.x0 + T, y: b.y0 + T }, desktopIns, css, 1);
    const seenNw = free(nw);
    expect(seenNw.x0).toBeCloseTo(b.x0, 5);
    expect(seenNw.y0).toBeCloseTo(b.y0, 5);
    // south-east corner: the free region sits on the map's bottom and right edges
    const se = outdoorFraming(desktop, b, { x: b.x1 - T, y: b.y1 - T }, desktopIns, css, 1);
    const seenSe = free(se);
    expect(seenSe.x1).toBeCloseTo(b.x1, 5);
    expect(seenSe.y1).toBeCloseTo(b.y1, 5);
    expect(seenSe.x0).toBeGreaterThanOrEqual(b.x0 - 1e-6);
    expect(seenSe.y0).toBeGreaterThanOrEqual(b.y0 - 1e-6);
    // mid-map, below the north-sidewalk hold: the camera has followed down and is not pinned to an edge
    const north = outdoorFraming(desktop, b, { x: 16 * T, y: 4 * T }, desktopIns, css, 1);
    const mid = outdoorFraming(desktop, b, { x: 16 * T, y: 14 * T }, desktopIns, css, 1);
    // the soft edge (issue #154) may leave the view a few px short of the sky margin's top, never past it, and never into the map itself
    expect(free(north).y0).toBeGreaterThanOrEqual(b.y0 - 1e-6);
    expect(free(north).y0).toBeLessThanOrEqual(b.y0 + EDGE_KNEE / 4);
    expect(free(north).y0).toBeLessThan(0);
    expect(mid.cy).toBeGreaterThan(north.cy);
    expect(mid.cx).toBeCloseTo(16 * T, 5);
    const seenMid = free(mid);
    expect(seenMid.x0).toBeGreaterThan(b.x0 + T);
    expect(seenMid.x1).toBeLessThan(b.x1 - T);
    expect(seenMid.y0).toBeGreaterThan(b.y0 + T);
    expect(seenMid.y1).toBeLessThan(b.y1 - T);

    // the rua is narrower than the window at zoom 3: x stays centred wherever the avatar stands, y still clamps
    const rua = roomBounds(ROOMS.rua);
    const west = outdoorFraming(desktop, rua, { x: T, y: 12 * T }, desktopIns, css, 1);
    const east = outdoorFraming(desktop, rua, { x: (ROOMS.rua.cols - 1) * T, y: 12 * T }, desktopIns, css, 1);
    expect(west.cx).toBeCloseTo((rua.x0 + rua.x1) / 2, 5);
    expect(east.cx).toBeCloseTo(west.cx, 5);
    const south = outdoorFraming(desktop, rua, { x: 8 * T, y: rua.y1 + 100 }, desktopIns, css, 1);
    const seenSouth = free(south);
    expect(seenSouth.y1).toBeCloseTo(rua.y1, 5);
    expect(seenSouth.y0).toBeGreaterThanOrEqual(rua.y0 - 1e-6);
  });

  it('leaves interiors on the old rule: step down to fit, and a room that fits does not follow the avatar', () => {
    const b = roomBounds(ROOMS.padaria);
    const interior = roomFraming(desktop, b, { x: 2 * T, y: 8 * T }, desktopIns, 4, 1);
    const moved = roomFraming(desktop, b, { x: 8 * T, y: 2 * T }, desktopIns, 4, 1);
    expect(interior.zoom).toBe(3);
    expect(interior.fits).toBe(true);
    expect(moved).toEqual(interior);
    // the same window, treated as outdoor, would have kept zoom 4
    expect(outdoorFraming(desktop, b, { x: 2 * T, y: 8 * T }, desktopIns, 4, 1).zoom).toBe(4);
  });
});
