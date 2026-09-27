import { describe, expect, it } from 'vitest';
import { HAIR_STYLES, HATS } from '@tudobem/shared';
import { EYE_CLEAR, hatSeat, MAX_LIFT } from './fit';
import { faceReach } from './hats';
import { HEAD } from './rig';

describe('hat skull fit (avatar enhance v2)', () => {
  it('every hat on every hair keeps the eyes readable under the brim', () => {
    const bad: string[] = [];
    for (const hair of HAIR_STYLES)
      for (const hat of HATS) {
        const seat = hatSeat(hair, hat.shape);
        const edge = seat.band + faceReach(hat.shape) * seat.s;
        if (edge > EYE_CLEAR + 1e-6) bad.push(`${hat.id} on ${hair}: brim edge ${edge.toFixed(2)} > ${EYE_CLEAR}`);
      }
    expect(bad).toEqual([]);
  });

  it('clears the eyes by shaping the brim, not by floating the hat off the skull', () => {
    const skullTop = -HEAD.top / 0.95;
    for (const hair of HAIR_STYLES)
      for (const hat of HATS) {
        const seat = hatSeat(hair, hat.shape);
        expect(seat.lift, `${hat.id} on ${hair}`).toBeLessThan(MAX_LIFT - 0.2);
        // The band stays below the crown of the skull (big hair carries the hat on its own volume)
        if (hair !== 'black') expect(seat.band, `${hat.id} on ${hair}`).toBeGreaterThan(skullTop + 1.5);
      }
  });

  it('big hair keeps its authored seat', () => {
    for (const hat of HATS) expect(hatSeat('black', hat.shape).lift, hat.id).toBe(0);
  });
});
