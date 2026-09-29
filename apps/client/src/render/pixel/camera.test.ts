import { describe, expect, it } from 'vitest';
import { ROOMS } from '@tudobem/shared';
import { T, cssZoomFor, deviceZoomFor, fitsAt, roomFraming, roomZoom, viewTop, type Insets } from './coords';
import { roomBounds } from './roomLayout';

// Phase 4a: the whole room, wall band included, when it fits; otherwise follow the avatar with the north wall in view.
const desktop = { w: 1280, h: 800 };
const desktopIns: Insets = { top: 64, bottom: 110, left: 0, right: 0 }; // what PixelView reserves for the HUD
const phone = { w: 390 * 2, h: 844 * 2 }; // dpr 2
const phoneIns: Insets = { top: 124 * 2, bottom: 168 * 2, left: 0, right: 0 };

describe('roomZoom', () => {
  it('takes one integer zoom lower when that makes the whole room fit (padaria on a 1280 x 800 desktop: 4 -> 3)', () => {
    const b = roomBounds(ROOMS.padaria);
    expect(fitsAt(desktop, b, desktopIns, 4)).toBe(false);
    expect(roomZoom(desktop, b, desktopIns, cssZoomFor(1280, 800), 1)).toBe(3);
    expect(fitsAt(desktop, b, desktopIns, 3)).toBe(true);
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
    expect(roomZoom(desktop, roomBounds(ROOMS.praca, 96), desktopIns, 4, 1)).toBe(4);
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
    const b = roomBounds(ROOMS.praca, 96); // the praça (facade above the band) is bigger than the screen at zoom 4
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
    const b = roomBounds(ROOMS.praca, 96);
    const f = roomFraming(desktop, b, { x: 8 * T, y: 4 * T - 3 - 10 }, desktopIns, 4, 1);
    const feetScreen = (4 * T - 3 - f.cy) * f.zoom + desktop.h / 2;
    expect(feetScreen).toBeLessThan(desktop.h - desktopIns.bottom - 40);
  });

  it('eases into following: the camera never jumps as the avatar leaves the top rows, and never moves up as it walks down', () => {
    const b = roomBounds(ROOMS.praca, 96);
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
    const b = roomBounds(ROOMS.praca, 96);
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
