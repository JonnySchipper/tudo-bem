import { describe, expect, it } from 'vitest';
import { dialogueFraming, easeOut, stepBlend } from './dialogueCam';

const base = { zoom: 4, cx: 100, cy: 100 };
const args = {
  base,
  view: { w: 1280, h: 800 },
  bounds: { x0: 0, y0: 0, x1: 900, y1: 600 },
  insets: { top: 64, bottom: 110, left: 0, right: 0 },
  boxPx: 260,
  self: { x: 300, y: 300 },
  npc: { x: 340, y: 260 },
  blend: 1,
  step: 1,
};

describe('dialogue camera framing', () => {
  it('no dialogue gives back the normal framing untouched', () => {
    expect(dialogueFraming({ ...args, blend: 0 })).toBe(base);
  });

  it('fully open: one integer zoom step in, centred between the player and the NPC above the box', () => {
    const f = dialogueFraming(args);
    expect(f.zoom).toBe(5);
    expect(Number.isInteger(f.zoom)).toBe(true);
    expect(f.cx).toBeCloseTo(320, 5); // between x 300 and 340
    // the free region is 64 px at the top and 260 px at the bottom, so the midpoint sits above the screen centre: the camera centre is lower
    const midY = 280;
    expect(f.cy).toBeGreaterThan(midY);
    // the two speakers are inside the free region (device px from the top of the screen)
    const topOf = (wy: number) => 400 + (wy - f.cy) * f.zoom;
    for (const y of [300, 260]) {
      expect(topOf(y)).toBeGreaterThan(args.insets.top);
      expect(topOf(y)).toBeLessThan(800 - args.boxPx);
    }
  });

  it('a step of 2 (a 2x display pixel ratio) is still an integer zoom', () => {
    expect(dialogueFraming({ ...args, base: { ...base, zoom: 8 }, step: 2 }).zoom).toBe(10);
  });

  it('tweens between the two framings', () => {
    const half = dialogueFraming({ ...args, blend: 0.5 });
    const full = dialogueFraming(args);
    expect(half.zoom).toBeCloseTo(4.5, 5);
    expect(half.cx).toBeCloseTo((base.cx + full.cx) / 2, 5);
  });

  it('talking to nobody in particular centres on the player', () => {
    const f = dialogueFraming({ ...args, npc: null });
    expect(f.cx).toBeCloseTo(300, 5);
  });

  it('a room that fits at the dialogue zoom is centred, not followed', () => {
    const small = { x0: 0, y0: 0, x1: 100, y1: 100 };
    const f = dialogueFraming({ ...args, bounds: small, self: { x: 10, y: 10 }, npc: { x: 20, y: 10 } });
    expect(f.cx).toBeCloseTo(50, 5);
  });
});

describe('tween progress', () => {
  it('moves toward the target over 0.28 s, both ways, and never overshoots', () => {
    expect(stepBlend(0, 1, 0.14)).toBeCloseTo(0.5, 5);
    expect(stepBlend(0.9, 1, 1)).toBe(1);
    expect(stepBlend(1, 0, 0.14)).toBeCloseTo(0.5, 5);
    expect(stepBlend(0.1, 0, 1)).toBe(0);
    expect(stepBlend(0.4, 0, 0)).toBe(0.4);
  });

  it('is instant under reduced motion (no zoom tween)', () => {
    expect(stepBlend(0, 1, 0.016, 0.28, true)).toBe(1);
    expect(stepBlend(1, 0, 0.016, 0.28, true)).toBe(0);
  });

  it('easeOut runs 0..1 and starts fast', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.75, 5);
    expect(easeOut(2)).toBe(1);
  });
});
