/**
 * Audio zones of an outdoor map (HOWTO Phase 6 step 6): how loud each ambient layer is at the listener's position, and the footstep
 * sound of each terrain. Pure and Web-Audio-free, so it is unit tested; `ambience.ts` turns the numbers into gains and oscillators.
 *
 * All gains are 0..1 "how present is this layer"; the loudness of a layer at full presence is set where it is synthesized.
 */
import type { FloorKind } from '@tudobem/shared';
import type { AudioZones } from '../render/pixel/ambientData';

export interface ZoneMix {
  /** cars on the two streets (from the nearest street) */
  traffic: number;
  /** the water in the fountain basin */
  fountain: number;
  /** daytime birdsong */
  birds: number;
  /** night crickets */
  crickets: number;
  /** rain on the ground (the weather, everywhere outdoors) */
  rain: number;
  /** a radio behind a window of the houses */
  radio: number;
}

export const SILENT_MIX: ZoneMix = { traffic: 0, fountain: 0, birds: 0, crickets: 0, rain: 0, radio: 0 };

export interface ZoneEnv {
  /** listener, world px */
  x: number;
  y: number;
  /** game minute 0..1439 (fractional is fine) */
  minute: number;
  /** 0..1 rain density (`WeatherParams.rain`) */
  rain: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (t: number) => {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
};

/** 1 inside `inner`, 0 beyond `outer`, a smooth ramp between (distances in px). */
export function falloff(d: number, inner: number, outer: number): number {
  if (d <= inner) return 1;
  if (d >= outer) return 0;
  return 1 - smooth((d - inner) / (outer - inner));
}

/** Distance from a point to the segment (x0..x1, y). */
export function distToStreet(px: number, py: number, s: { y: number; x0: number; x1: number }): number {
  const cx = Math.max(s.x0, Math.min(s.x1, px));
  return Math.hypot(px - cx, py - s.y);
}

/** 0 at night, 1 in full daylight: dawn 05:30-07:30, dusk 17:30-19:30. */
export function daylight(minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m < 330 || m >= 1170) return 0;
  if (m < 450) return smooth((m - 330) / 120);
  if (m < 1050) return 1;
  return 1 - smooth((m - 1050) / 120);
}

/** How busy the streets sound: nothing but the odd car from 01:00 to 05:00 (the traffic itself stops there), thin late at night. */
export function trafficPresence(minute: number): number {
  const m = ((minute % 1440) + 1440) % 1440;
  if (m >= 60 && m < 300) return 0.12;
  if (m < 60 || m >= 1320) return 0.5;
  if (m >= 1140 || m < 360) return 0.75;
  return 1;
}

/** A radio plays 08:00-22:00. */
export function radioOn(minute: number): boolean {
  const m = ((minute % 1440) + 1440) % 1440;
  return m >= 480 && m < 1320;
}

/** The mix at the listener's spot. */
export function zoneMix(z: AudioZones, e: ZoneEnv): ZoneMix {
  const day = daylight(e.minute);
  const dry = 1 - clamp01(e.rain * 0.85);
  let street = 0;
  for (const s of z.streets) street = Math.max(street, falloff(distToStreet(e.x, e.y, s), 40, 180));
  const fountain = falloff(Math.hypot(e.x - z.fountain.x, e.y - z.fountain.y), 44, 200);
  let radio = 0;
  for (const r of z.radios) radio = Math.max(radio, falloff(Math.hypot(e.x - r.x, e.y - r.y), 26, 150));
  return {
    traffic: clamp01(street * trafficPresence(e.minute) * (1 + 0.2 * clamp01(e.rain))),
    fountain: fountain * (1 - clamp01(e.rain) * 0.3),
    birds: day * dry,
    crickets: (1 - day) * dry,
    rain: clamp01(e.rain),
    radio: radioOn(e.minute) ? radio * (1 - clamp01(e.rain) * 0.6) : 0,
  };
}

// ---------------------------------------------------------------- footsteps

export interface FootstepSound {
  /** filter centre, Hz */
  freq: number;
  q: number;
  filter: BiquadFilterType;
  /** seconds */
  dur: number;
  gain: number;
  /** a low thump under the click (wood, tatami), Hz, or 0 */
  thump: number;
}

/** Quiet by design: the world is the star, not the shoes. */
export const FOOTSTEPS: Record<FloorKind, FootstepSound> = {
  calcada: { freq: 2100, q: 1.1, filter: 'bandpass', dur: 0.05, gain: 0.05, thump: 0 },
  grama: { freq: 900, q: 0.6, filter: 'lowpass', dur: 0.09, gain: 0.042, thump: 0 },
  tijolo: { freq: 1500, q: 1.4, filter: 'bandpass', dur: 0.055, gain: 0.05, thump: 0 },
  xadrez: { freq: 2800, q: 1.6, filter: 'bandpass', dur: 0.04, gain: 0.05, thump: 0 },
  ladrilho: { freq: 3000, q: 1.8, filter: 'bandpass', dur: 0.04, gain: 0.048, thump: 0 },
  madeira: { freq: 700, q: 1.2, filter: 'bandpass', dur: 0.07, gain: 0.05, thump: 120 },
  paralelepipedo: { freq: 1500, q: 1.1, filter: 'bandpass', dur: 0.05, gain: 0.05, thump: 20 },
  asfalto: { freq: 1100, q: 0.9, filter: 'bandpass', dur: 0.06, gain: 0.046, thump: 0 },
  tatame: { freq: 420, q: 0.7, filter: 'lowpass', dur: 0.08, gain: 0.04, thump: 90 },
  // the airport's polished stone: a bright, short click
  granilite: { freq: 3200, q: 1.7, filter: 'bandpass', dur: 0.04, gain: 0.046, thump: 0 },
};

/** Playback-rate / filter multiplier for one step: 1 ± 5%. `r` is a 0..1 random. */
export const stepPitch = (r: number): number => 0.95 + 0.1 * clamp01(r);

/** Art px walked between two footsteps (a tile is 16 px; a stride is about two thirds of it). */
export const STEP_PX = 10;

/**
 * Turns the local avatar's movement into footstep events: one every `STEP_PX` walked. Jumps bigger than `maxJump` (a room change, a
 * teleport) reset instead of counting; standing still keeps the remainder so the next step is not early.
 */
export class FootstepClock {
  private lx = Number.NaN;
  private ly = 0;
  private acc = 0;
  constructor(
    private readonly stride = STEP_PX,
    private readonly maxJump = 48,
  ) {}

  /** Number of steps to sound for this frame's position. */
  update(x: number, y: number, moving: boolean): number {
    let n = 0;
    if (Number.isFinite(this.lx) && moving) {
      const d = Math.hypot(x - this.lx, y - this.ly);
      if (d <= this.maxJump) {
        this.acc += d;
        n = Math.floor(this.acc / this.stride);
        this.acc -= n * this.stride;
      } else this.acc = 0;
    }
    if (!moving) this.acc = Math.min(this.acc, this.stride * 0.5);
    this.lx = x;
    this.ly = y;
    return n;
  }

  reset(): void {
    this.lx = Number.NaN;
    this.acc = 0;
  }
}
