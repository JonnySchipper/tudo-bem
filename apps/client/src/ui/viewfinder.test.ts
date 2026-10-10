import { describe, expect, it } from 'vitest';
import { FRAME_H, FRAME_W, cameraFrameAt, clientRectToCanvas, clientRectToWorld, framedIds, framedShare, inShot, type DrawnView } from './viewfinder';
import { worldToCanvas } from '../render/pixel/coords';

describe('cameraFrameAt', () => {
  it('centres the frame on the pointer', () => {
    expect(cameraFrameAt(500, 400, 1280, 800)).toEqual({ x: 500 - FRAME_W / 2, y: 400 - FRAME_H / 2, w: FRAME_W, h: FRAME_H });
  });
  it('slides the frame back on screen near an edge, so the print has no blank side', () => {
    expect(cameraFrameAt(10, 790, 1280, 800)).toEqual({ x: 0, y: 800 - FRAME_H, w: FRAME_W, h: FRAME_H });
    expect(cameraFrameAt(1279, 2, 1280, 800)).toEqual({ x: 1280 - FRAME_W, y: 0, w: FRAME_W, h: FRAME_H });
  });
  it('centres it on an axis smaller than the frame', () => {
    expect(cameraFrameAt(10, 50, 200, 800).x).toBe(100 - FRAME_W / 2);
  });
});

describe('clientRectToWorld', () => {
  // a 1280 x 800 window at dpr 2 (a 2560 x 1600 backing store), 6 device px per art px, looking at world (300, 200)
  const view: DrawnView = { cx: 300, cy: 200, zoom: 6, w: 2560, h: 1600 };
  const canvas = { x: 0, y: 0, w: 1280, h: 800 };

  it('maps the canvas centre to the camera centre and a CSS px to 1/3 art px', () => {
    const r = clientRectToWorld({ x: 640, y: 400, w: 3, h: 6 }, canvas, view);
    expect(r).toEqual({ x0: 300, y0: 200, x1: 301, y1: 202 });
  });

  it('is the inverse of the pixel view’s world -> canvas mapping', () => {
    const cam = { zoom: 6, dpr: 2, cx: 300, cy: 200, w: 2560, h: 1600 };
    const a = worldToCanvas(cam, 250, 180);
    const b = worldToCanvas(cam, 290, 210);
    const r = clientRectToWorld({ x: a.px, y: a.py, w: b.px - a.px, h: b.py - a.py }, canvas, view);
    expect(r.x0).toBeCloseTo(250);
    expect(r.y0).toBeCloseTo(180);
    expect(r.x1).toBeCloseTo(290);
    expect(r.y1).toBeCloseTo(210);
  });

  it('uses the canvas’ displayed box, so an offset or stretched canvas still names what the print shows', () => {
    // the canvas drawn 10 px down and stretched to 820 tall (100dvh taller than the backing store's height)
    const shown = { x: 0, y: 10, w: 1280, h: 820 };
    const frame = { x: 100, y: 300, w: 220, h: 148 };
    const crop = clientRectToCanvas(frame, shown, { w: view.w, h: view.h });
    const world = clientRectToWorld(frame, shown, view);
    // the crop's device px, through the camera, are exactly the world rect
    expect(view.cx + (crop.x - view.w / 2) / view.zoom).toBeCloseTo(world.x0);
    expect(view.cy + (crop.y - view.h / 2) / view.zoom).toBeCloseTo(world.y0);
    expect(view.cx + (crop.x + crop.w - view.w / 2) / view.zoom).toBeCloseTo(world.x1);
    expect(view.cy + (crop.y + crop.h - view.h / 2) / view.zoom).toBeCloseTo(world.y1);
  });
});

describe('framedIds', () => {
  // a frame of 80 x 50 world px
  const frame = { x0: 100, y0: 100, x1: 180, y1: 150 };

  it('counts a tall thing by its art: a lamp post whose head is in the frame though the tile it stands on is not', () => {
    const post = { id: 'poste', art: [{ x0: 130, y0: 90, x1: 146, y1: 150 }] };
    expect(framedIds(frame, [post])).toEqual(['poste']);
    // the old footprint test: the floor tile under it (y 150..166) is outside the frame
    expect(inShot(framedShare(frame, [{ x0: 130, y0: 150, x1: 146, y1: 166 }]))).toBe(false);
  });

  it('does not count something that only grazes the edge of the frame', () => {
    const bench = { id: 'banco', art: [{ x0: 170, y0: 140, x1: 202, y1: 160 }] };
    expect(framedIds(frame, [bench])).toEqual([]);
  });

  it('counts something mostly inside', () => {
    const bin = { id: 'lixeira', art: [{ x0: 172, y0: 120, x1: 188, y1: 140 }] };
    expect(framedIds(frame, [bin])).toEqual(['lixeira']);
  });

  it('counts a thing bigger than the frame when it fills a good part of it (a building front, the runway)', () => {
    const front = { id: 'padaria', art: [{ x0: 40, y0: 20, x1: 200, y1: 160 }] };
    const runway = { id: 'hall_pista', art: [{ x0: 0, y0: 130, x1: 480, y1: 162 }] };
    const sliver = { id: 'muro', art: [{ x0: 0, y0: 145, x1: 480, y1: 400 }] };
    expect(framedIds(frame, [front, runway, sliver]).sort()).toEqual(['hall_pista', 'padaria']);
  });

  it('adds up every sprite of one thing (a stall and its canopy, a long counter)', () => {
    const stall = { id: 'banca', art: [{ x0: 150, y0: 140, x1: 190, y1: 170 }, { x0: 150, y0: 100, x1: 190, y1: 140 }] };
    const s = framedShare(frame, stall.art)!;
    expect(s.ofThing).toBeCloseTo((30 * 50) / (40 * 70));
    expect(framedIds(frame, [stall])).toEqual(['banca']);
  });

  it('lists the things nearest the reticle first, and a thing named twice once', () => {
    const near = { id: 'fonte', art: [{ x0: 132, y0: 117, x1: 148, y1: 133 }] };
    const far = { id: 'vaso', art: [{ x0: 101, y0: 101, x1: 117, y1: 117 }] };
    const chairA = { id: 'cadeira', art: [{ x0: 160, y0: 130, x1: 176, y1: 148 }] };
    const chairB = { id: 'cadeira', art: [{ x0: 140, y0: 112, x1: 156, y1: 130 }] };
    expect(framedIds(frame, [far, chairA, near, chairB])).toEqual(['fonte', 'cadeira', 'vaso']);
  });
});
