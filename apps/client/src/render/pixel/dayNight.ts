/**
 * Day and night for the pixel view (HOWTO §5.8, Phase 6): the live game clock drives the outdoor grade, darkness and lamps; interiors keep the
 * fixed grade of their `RoomDef.lighting` but their window light follows the sky. Pure functions, so the schedule and the look are unit tested;
 * the Phaser side is `lightingRig.ts`.
 *
 * Lamps (`poste`, `poste_fios`), facade lit windows, the estufa glow and the banca light switch on at 18:00 and off at 06:00. Each light has
 * its own deterministic 0..40 game-minute delay (a hash of its position) and then eases over a few game minutes, so a street does not flip at once
 * and nothing pops.
 */
import { darknessAlpha, glowStrength, gradeAt, rgbToInt, shadowFill, sunGlow, type Rgb } from './lighting';
import { weatherGrade, type WeatherParams } from './weatherLook';
import { T, type Rect } from './coords';
import { allNorthDecor, decorArt } from './roomLayout';
import { rimLook, shadowLook, type RimSpec, type ShadowLook } from './shadows';

/** Game minute the lights switch on / off. */
export const LIGHTS_ON_MIN = 18 * 60;
export const LIGHTS_OFF_MIN = 6 * 60;
/** Longest per-light delay, in game minutes. */
export const MAX_LIGHT_DELAY = 40;
/** Game minutes a light takes to fade fully on (or off): 5 game minutes are 10 real seconds. */
export const LIGHT_FADE_MIN = 5;

/** Outdoor rooms have grass or asphalt in their floor; interiors have tile, parquet or tatame. Outdoor rooms follow the live clock and weather. */
export function isOutdoor(def: { floor: readonly string[] }): boolean {
  return def.floor.some((row) => row.includes('g') || row.includes('a'));
}

/**
 * The glass of the north-wall windows (`walls/janela` 32x30, `walls/janela_rua` 48x34, both anchored bottom-left on the wall base): panes as
 * [x, y, w, h] relative to the sprite's top-left corner, mullions left out. At night a dark sky with a few stars goes over them, so an
 * interior window does not show a blue afternoon at 23:00.
 */
const WINDOW_PANES: Partial<Record<string, { w: number; h: number; panes: [number, number, number, number][] }>> = {
  janela: { w: 32, h: 30, panes: [[3, 3, 12, 22], [17, 3, 12, 22]] },
  janela_rua: { w: 48, h: 34, panes: [[3, 3, 13, 22], [18, 3, 12, 22], [32, 3, 13, 22]] },
};

/** Window panes and a few star pixels for a room's north wall, in world px. */
export function windowPanes(room: Parameters<typeof allNorthDecor>[0]): { panes: Rect[]; stars: { x: number; y: number }[] } {
  const panes: Rect[] = [];
  const stars: { x: number; y: number }[] = [];
  for (const d of allNorthDecor(room)) {
    const win = WINDOW_PANES[d.kind];
    if (!win) continue;
    const x0 = Math.round(((d.from + d.to) * T) / 2 - win.w / 2);
    const y0 = (decorArt(d)?.bottom ?? 0) - win.h;
    for (const [px, py, pw, ph] of win.panes) {
      const r = { x0: x0 + px, y0: y0 + py, x1: x0 + px + pw, y1: y0 + py + ph };
      panes.push(r);
      for (let i = 0; i < 2; i++) {
        const h1 = hashPos01(r.x0 * 3 + i * 11, r.y0 + 5);
        const h2 = hashPos01(r.y0 * 7 + i * 5, r.x0 + 9);
        stars.push({ x: r.x0 + 1 + Math.floor(h1 * (pw - 2)), y: r.y0 + 1 + Math.floor(h2 * (ph * 0.6)) });
      }
    }
  }
  return { panes, stars };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Deterministic 0..1 hash of a position (integer world px). */
export function hashPos01(x: number, y: number): number {
  let h = Math.imul(Math.round(x) | 0, 0x9e3779b1) ^ Math.imul(Math.round(y) | 0, 0x85ebca6b) ^ 0x27d4eb2f;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The switch-on / switch-off delay of the light at a world position: 0..40 game minutes. */
export const lightDelay = (x: number, y: number): number => hashPos01(x, y) * MAX_LIGHT_DELAY;

/**
 * 0..1 strength of a light with `delay` game minutes of lag at game minute `minutes` (fractional, 0..1440).
 * Off in the day; eases on from 18:00 + delay; stays on through the night; eases off from 06:00 + delay.
 */
export function lightState(minutes: number, delay: number, fade = LIGHT_FADE_MIN): number {
  const t = ((minutes % 1440) + 1440) % 1440;
  const on = LIGHTS_ON_MIN + delay;
  const off = LIGHTS_OFF_MIN + delay;
  if (t >= on) return smooth(clamp01((t - on) / fade));
  if (t < off) return 1;
  if (t < off + fade) return 1 - smooth((t - off) / fade);
  return 0;
}

export interface SceneLook {
  /** multiply grade */
  grade: Rgb;
  /** cool SCREEN fill in the shadows */
  fill: { color: Rgb; alpha: number };
  /** night darkness overlay alpha (incl. storm gloom) */
  dark: number;
  /** 0..1 how night it is (drives rain color and the weather fade) */
  night: number;
  /** 0..1 glow of the local player's own light */
  playerGlow: number;
  /** 0..1 strength of unscheduled dynamic lights (car headlights): dusk, or rain */
  glow: number;
  /** alpha of the low-sun glow */
  sun: number;
  /** alpha of the sun-cast shadows */
  cast: number;
  /** V5: the sun's directional shadows (shear, strength, tint); alpha 0 in interiors, at night and under chuva */
  shadow: ShadowLook;
  /** V5: strength (0..1) of the ambient occlusion layer: stronger under an overcast sky, weaker at night, 0 in interiors */
  ao: number;
  /** V5: the sun's warm edge light on whatever faces it (alpha 0 = none) */
  rim: RimSpec;
  /** alpha and tint of the window light patches on the floor */
  patchAlpha: number;
  patchTint: number;
  /** 0..1 alpha of the night sky over the window panes (the live sky, also seen from inside) */
  windowNight: number;
  /** 0..1 strength of a scheduled light (lamp, lit window, estufa, banca) with this delay */
  lampOn: (delay: number) => number;
}

export interface LookInput {
  /** outdoor rooms follow the live clock; interiors keep `roomHour` */
  outdoor: boolean;
  /** the fixed grade hour of an interior (`ROOM_HOUR[RoomDef.lighting]`) */
  roomHour: number;
  /** live game minutes, fractional 0..1440 */
  minutes: number;
  /** the (smoothed) weather */
  weather: WeatherParams;
}

/** Peak night darkness of the outdoor overlay (the doc says 0.55; 0.5 keeps the night blue and readable next to the warm lights). */
export const NIGHT_DARK = 0.5;

/** Moonlight tint for the window patches at night. */
const MOON_TINT: Rgb = [0x8a, 0xa4, 0xec];

/** Everything the lighting rig draws for one frame. */
export function computeLook(inp: LookInput): SceneLook {
  const { weather: w } = inp;
  const liveHour = inp.minutes / 60;
  const dark0 = darknessAlpha(liveHour, NIGHT_DARK);
  const night = dark0 / NIGHT_DARK;

  // window light: warm sun by day (much less under cloud), a faint cool moon patch at night
  const dayK = Math.max(0, 1 - dark0 * 2.5);
  const patchSun = lerp(0.1, 1, w.sun);
  const moon = 0.3 * smooth(clamp01(night * 1.5)) * (1 - 0.5 * w.rain);
  const tintC = [0, 1, 2].map((k) => Math.round(lerp(255, MOON_TINT[k], smooth(clamp01(night * 1.3))))) as Rgb;
  const patchAlpha = dayK * patchSun + moon;
  const patchTint = rgbToInt(tintC);
  const windowNight = 0.85 * smooth(clamp01(night * 1.4));
  const lampOn = (delay: number) => lightState(inp.minutes, delay);

  if (!inp.outdoor) {
    const sf = shadowFill(inp.roomHour);
    return {
      grade: gradeAt(inp.roomHour),
      fill: { color: sf.color, alpha: sf.alpha },
      dark: 0,
      night: 0,
      playerGlow: 0,
      glow: 0,
      sun: sunGlow(inp.roomHour) * 0.2,
      cast: 1,
      shadow: { ...shadowLook(inp.roomHour, 1), alpha: 0 },
      ao: 0,
      rim: { side: 'l', alpha: 0, tint: 0xffa05a },
      patchAlpha,
      patchTint,
      windowNight,
      lampOn,
    };
  }

  const gloom = w.gloom * (1 - night);
  const sf = shadowFill(liveHour);
  const grade = weatherGrade(gradeAt(liveHour), w, night);
  return {
    grade,
    fill: { color: sf.color, alpha: sf.alpha * (0.5 + 0.5 * w.sun) },
    dark: dark0 + gloom * (1 - dark0),
    night,
    playerGlow: Math.min(1, dark0 / 0.35),
    glow: Math.max(glowStrength(liveHour), w.rain * 0.7),
    sun: sunGlow(liveHour) * 0.2 * w.sun,
    cast: Math.max(0.15, 1 - dark0 * 1.1) * w.sun,
    shadow: shadowLook(liveHour, w.sun, grade),
    ao: (0.8 + 0.2 * (1 - w.sun)) * (1 - 0.5 * night),
    rim: rimLook(shadowLook(liveHour, w.sun, grade)),
    patchAlpha,
    patchTint,
    windowNight,
    lampOn,
  };
}

/** The look of a plain fixed hour with no weather and no schedule: the style frame's time slider (lights follow `glowStrength`). */
export function hourLook(hour: number): SceneLook {
  const dark = darknessAlpha(hour);
  const sf = shadowFill(hour);
  const gs = glowStrength(hour);
  return {
    grade: gradeAt(hour),
    fill: { color: sf.color, alpha: sf.alpha },
    dark,
    night: dark / 0.55,
    playerGlow: Math.min(1, dark / 0.35),
    glow: gs,
    sun: sunGlow(hour) * 0.2,
    cast: Math.max(0.15, 1 - dark * 1.1),
    shadow: shadowLook(hour, 1),
    ao: 0.8 * (1 - 0.5 * (dark / 0.55)),
    rim: rimLook(shadowLook(hour, 1)),
    patchAlpha:Math.max(0, 1 - dark * 2.5),
    patchTint: 0xffffff,
    windowNight: 0,
    lampOn: () => gs,
  };
}
