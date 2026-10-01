/**
 * Weather as numbers (HOWTO Phase 6 step 4): what each `Weather` does to the grade, the sun and the rain, the smoothing that blends one
 * weather into the next, and the particle budget. Pure, so it is unit tested; the Phaser side is `weatherFx.ts` and `lightingRig.ts`.
 */
import type { Weather } from '@tudobem/shared';
import type { Rgb } from './lighting';

/** HOWTO §5.11: at most 300 particles alive. The rain stays well under it and leaves room for petals and critters. */
export const PARTICLE_CAP = 300;
export const MAX_DROPS = 190;
export const MAX_SPLASHES = 34;
export const MAX_RIPPLES = 14;

export interface WeatherParams {
  /** the color the grade is multiplied by (a cool grey-blue), and how strongly */
  tint: Rgb;
  tintMix: number;
  /** 0..1 pull of the grade toward its own grey */
  desat: number;
  /** 0..1 how much direct sun is left: scales cast shadows, the low-sun glow and the window light patches */
  sun: number;
  /** extra darkness overlay alpha in daylight (storm gloom) */
  gloom: number;
  /** 0..1 rain density (1 = chuva) */
  rain: number;
  /** 0..1 puddles and ripples on the ground */
  puddles: number;
  /** V5: 0..1 how wet the ground is: darker, glossier paving, lamp reflections, puddles that mirror lights. Rises with the rain, dries slowly. */
  wet: number;
}

export const WEATHER_PARAMS: Record<Weather, WeatherParams> = {
  sol: { tint: [255, 255, 255], tintMix: 0, desat: 0, sun: 1, gloom: 0, rain: 0, puddles: 0, wet: 0 },
  nublado: { tint: [0xc8, 0xd6, 0xe8], tintMix: 0.8, desat: 0.5, sun: 0.28, gloom: 0.03, rain: 0, puddles: 0, wet: 0 },
  garoa: { tint: [0xb6, 0xc4, 0xdc], tintMix: 0.82, desat: 0.55, sun: 0.12, gloom: 0.08, rain: 0.55, puddles: 0, wet: 0.6 },
  chuva: { tint: [0x9a, 0xa8, 0xc6], tintMix: 0.92, desat: 0.68, sun: 0, gloom: 0.17, rain: 1, puddles: 1, wet: 1 },
};


const NUM_KEYS = ['tintMix', 'desat', 'sun', 'gloom', 'rain', 'puddles', 'wet'] as const;

/** Seconds for the ground to get wet (time constant) and to dry again: a street stays damp long after the rain stops. */
export const WET_TAU_UP = 2.5;
export const WET_TAU_DOWN = 40;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpParams(a: WeatherParams, b: WeatherParams, t: number): WeatherParams {
  const out = { ...a, tint: [0, 1, 2].map((k) => lerp(a.tint[k], b.tint[k], t)) as Rgb };
  for (const k of NUM_KEYS) out[k] = lerp(a[k], b[k], t);
  return out;
}

/**
 * Eases the live weather parameters toward the target weather so a change of weather (the 06:00 roll, or a dev override) fades in over a
 * few seconds instead of popping. `tau` is the time constant in seconds.
 */
export class WeatherBlend {
  current: WeatherParams;
  constructor(
    start: Weather = 'sol',
    private readonly tau = 2,
  ) {
    this.current = { ...WEATHER_PARAMS[start], tint: [...WEATHER_PARAMS[start].tint] };
  }
  /** Snap to a weather (first frame, or a room change that must not fade). */
  snap(w: Weather): void {
    this.current = { ...WEATHER_PARAMS[w], tint: [...WEATHER_PARAMS[w].tint] };
  }
  step(target: Weather, dtSec: number): WeatherParams {
    const k = 1 - Math.exp(-Math.max(0, dtSec) / this.tau);
    const wet0 = this.current.wet;
    this.current = lerpParams(this.current, WEATHER_PARAMS[target], k);
    // the ground dries far slower than the sky clears
    const wt = WEATHER_PARAMS[target].wet;
    this.current.wet = wet0 + (wt - wet0) * (1 - Math.exp(-Math.max(0, dtSec) / (wt >= wet0 ? WET_TAU_UP : WET_TAU_DOWN)));
    return this.current;
  }
}

const luma = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * The multiply grade under a weather: pulled toward its own grey (`desat`), then multiplied by the cool tint (`tintMix`). Both fade with
 * `night` (0 day .. 1 night) because the night grade is already blue and dark, and a second multiply would black it out.
 */
export function weatherGrade(grade: Rgb, p: WeatherParams, night = 0): Rgb {
  const fade = 1 - 0.65 * Math.min(1, Math.max(0, night));
  const g = luma(grade);
  const d = p.desat * fade;
  const m = p.tintMix * fade;
  return [0, 1, 2].map((k) => {
    const desat = lerp(grade[k], g, d);
    const tinted = (desat * p.tint[k]) / 255;
    return Math.max(0, Math.min(255, Math.round(lerp(desat, tinted, m))));
  }) as Rgb;
}

/**
 * The multiply tint of wet paving: calçada, asfalto and tijolo get darker and a little bluer as the ground wets (0xRRGGBB, white = dry). Kept
 * out of the grass: grass gets darker and richer when wet, but far less.
 */
export function groundWetTint(wet: number, kind: 'paving' | 'grass' = 'paving'): number {
  const k = Math.min(1, Math.max(0, wet));
  const to = kind === 'paving' ? [0xa6, 0xb0, 0xc8] : [0xcc, 0xd6, 0xd0];
  const c = to.map((v) => Math.round(lerp(255, v, k)));
  return (c[0] << 16) | (c[1] << 8) | c[2];
}

export interface FxLevel {
  /** `?lowfx=1` or the p90 frame-time fallback */
  lowfx: boolean;
  /** `prefers-reduced-motion` */
  reduced: boolean;
}

export interface RainPlan {
  drops: number;
  splashes: number;
  ripples: number;
  /** multiplier on fall speed (calmer under reduced motion) */
  speed: number;
}

/**
 * How many rain drops, ground splashes and puddle ripples to keep alive. Low-fx halves the rain and drops the extras (splashes, ripples);
 * reduced motion cuts it to 40% and slows it. The total is always under the particle cap.
 */
export function rainPlan(p: Pick<WeatherParams, 'rain'>, fx: FxLevel): RainPlan {
  const level = Math.max(0, Math.min(1, p.rain));
  const density = (fx.lowfx ? 0.5 : 1) * (fx.reduced ? 0.4 : 1);
  const extras = !fx.lowfx && !fx.reduced && level > 0.6;
  return {
    drops: Math.round(MAX_DROPS * level * density),
    splashes: extras ? Math.round(MAX_SPLASHES * level) : 0,
    ripples: !fx.lowfx && level > 0.6 ? Math.round(MAX_RIPPLES * (fx.reduced ? 0.5 : 1)) : 0,
    speed: fx.reduced ? 0.6 : 1,
  };
}

/** Puddle decals: how many the room may carry and the chance per eligible tile (deterministic by tile hash). */
export const MAX_PUDDLES = 46;
export const PUDDLE_DENSITY = 0.11;

/** The weather's tint color for the rain streaks: pale day-blue, dimmer and bluer at night. */
export function rainColor(night: number): Rgb {
  const t = Math.min(1, Math.max(0, night));
  return [Math.round(lerp(0xe4, 0x9a, t)), Math.round(lerp(0xee, 0xae, t)), Math.round(lerp(0xfa, 0xe0, t))];
}
