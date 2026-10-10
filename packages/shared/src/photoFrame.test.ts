import { describe, expect, it } from 'vitest';
import { PHOTO_FRAME_MAX_TILES, frameNearPlayer, frameReaches, photoFrame } from './photoFrame.js';

describe('photoFrame', () => {
  it('takes a viewfinder-sized world rect and refuses anything else', () => {
    expect(photoFrame({ x0: 10, y0: 20, x1: 83, y1: 69 })).toEqual({ x0: 10, y0: 20, x1: 83, y1: 69 });
    expect(photoFrame(undefined)).toBeNull();
    expect(photoFrame({ x0: 10, y0: 20, x1: 5, y1: 69 })).toBeNull();
    expect(photoFrame({ x0: 0, y0: 0, x1: Number.NaN, y1: 10 })).toBeNull();
    expect(photoFrame({ x0: 0, y0: 0, x1: '40', y1: 10 })).toBeNull();
    expect(photoFrame({ x0: 0, y0: 0, x1: (PHOTO_FRAME_MAX_TILES.w + 1) * 16, y1: 10 })).toBeNull();
  });

  it('must be on the player’s screen', () => {
    const f = { x0: 30 * 16, y0: 4 * 16, x1: 34 * 16, y1: 7 * 16 };
    expect(frameNearPlayer(f, { x: 2, y: 5 })).toBe(true);
    expect(frameNearPlayer(f, { x: 80, y: 5 })).toBe(false);
  });

  it('reaches what stands under it (tall art rises above its tiles), not what is far to the side or above', () => {
    // a frame over tiles x 10..14, y 2..5
    const f = { x0: 160, y0: 32, x1: 224, y1: 80 };
    // a tree standing 6 rows below the frame: its crown is in it
    expect(frameReaches(f, { x: 12, y: 11 })).toBe(true);
    // a thing well above the frame cannot show in it
    expect(frameReaches(f, { x: 12, y: -6 })).toBe(false);
    // nor something far to the side
    expect(frameReaches(f, { x: 30, y: 3 })).toBe(false);
    // nor something 20 rows south
    expect(frameReaches(f, { x: 12, y: 25 })).toBe(false);
  });
});
