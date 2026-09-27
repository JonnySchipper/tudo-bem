import type { HairStyle, HatDef } from '@tudobem/shared';
import { EYE_Y, hatFit } from './head';
import { faceReach, HAT_W } from './hats';

/** Lowest any hat edge may come over the face (head space): above the upper lash line plus the hat's ink halo. */
export const EYE_CLEAR = EYE_Y - 1.5;
/** Most a hat is pushed back off its band to clear the eyes; any more and it would hover off the skull. */
export const MAX_LIFT = 1.2;

export interface HatSeat {
  /** Band line in head space, after any lift. */
  band: number;
  s: number;
  lift: number;
}

/** Where a hat sits on a hair style: on the skull above the hair volume, pushed back just enough to keep the eyes readable. */
export function hatSeat(hair: HairStyle, shape: HatDef['shape']): HatSeat {
  const fit = hatFit(hair);
  const s = Math.max(0.94, Math.min(1.3, fit.w / HAT_W));
  const lift = Math.min(MAX_LIFT, Math.max(0, fit.band + faceReach(shape) * s - EYE_CLEAR));
  return { band: fit.band - lift, s, lift };
}
