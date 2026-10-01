/**
 * The sun and the shadows it casts (V5 lighting). Pure math, no Phaser, so the sun by time, the shear of a shadow and the weather fade are unit
 * tested; `shadowLayer.ts` is the Phaser side that turns this into sprites.
 *
 * Model. The game is top-down with things standing up on the screen (a point `z` px above its footprint is drawn `z` px higher). The sun walks
 * east -> north -> west (São Paulo is in the southern hemisphere), so a shadow falls west (left) in the morning, south (down the screen) at
 * noon and east (right) in the afternoon. A point at height `z` over the ground lands at `z * (lx, ly)` from its foot: that is a shear. The
 * shadow of a sprite is the sprite's silhouette flipped over its ground line and sheared by `(lx, ly)`; long when the sun is low, short at noon.
 *
 * The raw `cot(elevation)` is 3 at 07:00 (a 100 px building would throw a 300 px shadow), so the length is compressed to something that reads as
 * "long and soft" and still fits a sidewalk (`shadowLength`).
 */

export interface Rgb3 {
  r: number;
  g: number;
  b: number;
}

/** Game hours the sun is on the horizon. 17:30 is long shadows and deep gold; the grade and the darkness take over after it. */
export const SUNRISE = 5.9;
export const SUNSET = 18.6;
/** Peak elevation in degrees (kept lower than the real Tropic noon so the noon shadow is still a visible shape, not a dot). */
export const NOON_ELEVATION = 66;
/** Bearing of the shadow from "straight down the screen", at sunrise and sunset (degrees; negative = west / left). */
export const MAX_BEARING = 68;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (d: number) => (d * Math.PI) / 180;

export interface SunPos {
  /** 0 at sunrise .. 1 at sunset; null while the sun is down */
  u: number | null;
  /** degrees above the horizon (0 while down) */
  elevation: number;
  /** degrees of the shadow's bearing: 0 = straight down the screen, -90 = left, +90 = right */
  bearing: number;
}

/** Where the sun is at game hour `hour` (any real, wraps at 24). */
export function sunAt(hour: number): SunPos {
  const h = ((hour % 24) + 24) % 24;
  if (h <= SUNRISE || h >= SUNSET) return { u: null, elevation: 0, bearing: h < 12 ? -MAX_BEARING : MAX_BEARING };
  const u = (h - SUNRISE) / (SUNSET - SUNRISE);
  return { u, elevation: NOON_ELEVATION * Math.sin(Math.PI * u), bearing: lerp(-MAX_BEARING, MAX_BEARING, u) };
}

/**
 * Shadow length as a multiple of the object's height. Raw `1 / tan(elevation)` is compressed: 0.26 near noon, about 1.2 at 07:00 and 17:30,
 * up to `MAX_LENGTH` in the last minutes of light (where the alpha is already fading out).
 */
export const MIN_LENGTH = 0.26;
export const MAX_LENGTH = 1.3;
export function shadowLength(elevationDeg: number): number {
  if (elevationDeg <= 0.5) return MAX_LENGTH;
  const cot = 1 / Math.tan(rad(elevationDeg));
  return lerp(MIN_LENGTH, MAX_LENGTH, smooth(clamp01((cot - 0.35) / 2.4)));
}

/**
 * 0..1 how strong the sun's shadows are: fades in over the first ~7 degrees of elevation (so the dawn and the last light give soft, pale shadows),
 * and with the weather's direct sun (`sun`: 1 clear, 0.28 nublado, 0 chuva). Overcast has no shadows at all.
 */
export function shadowStrength(elevationDeg: number, sun: number): number {
  const skyK = smooth(clamp01((sun - 0.12) / 0.62));
  return smooth(clamp01(elevationDeg / 7)) * skyK;
}

export interface ShadowLook {
  /** shadow ground offset of a point `z` px high, per px of height: x' = z * lx, y' = z * ly (screen px, y down) */
  lx: number;
  ly: number;
  /** 0..1 strength (alpha of the multiply stamp) */
  alpha: number;
  /** length multiple (hypot of lx, ly) */
  length: number;
  /** multiply tint of the shadow, 0xRRGGBB: cool lavender-blue, warmer-violet at the golden hour so it stays complementary to the gold */
  tint: number;
  /** degrees above the horizon and 0..1 `up` factor, for the rim light and the haze */
  elevation: number;
  bearing: number;
}

/**
 * What a shadowed patch of ground should look like AFTER the grade, as a multiplier on the ground's own colour: cool and a little violet, never
 * grey. (The stamp is a multiply, so `tint = final / grade`: under the orange golden-hour grade the stamp has to be bluer than the final shadow.)
 */
const FINAL_NOON: Rgb3 = { r: 0x84, g: 0x90, b: 0xd2 };
const FINAL_GOLD: Rgb3 = { r: 0x5c, g: 0x64, b: 0xb0 };
const FINAL_DAWN: Rgb3 = { r: 0x78, g: 0x6c, b: 0xb6 };

const toInt = (c: Rgb3) => (Math.round(c.r) << 16) | (Math.round(c.g) << 8) | Math.round(c.b);
const ch = (c: Rgb3, k: 'r' | 'g' | 'b') => c[k];
const mix3 = (a: Rgb3, b: Rgb3, t: number): Rgb3 => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });

/**
 * The shadow of the sun at game hour `hour` under a weather with `sun` direct light left. `grade` is the multiply grade of the moment
 * (0..255 per channel): the stamp's tint divides it out so the shadow stays blue under a gold grade.
 */
export function shadowLook(hour: number, sun = 1, grade: [number, number, number] = [255, 255, 255]): ShadowLook {
  const s = sunAt(hour);
  const length = shadowLength(s.elevation);
  const b = rad(s.bearing);
  const strength = shadowStrength(s.elevation, sun);
  // a lower sun = redder light = the shadows turn more violet; the dawn leans pink-violet, the evening gold-violet
  const low = 1 - smooth(clamp01((s.elevation - 8) / 30));
  const morning = s.u !== null && s.u < 0.5;
  const fin = mix3(FINAL_NOON, morning ? FINAL_DAWN : FINAL_GOLD, low);
  const tint: Rgb3 = { r: Math.min(255, (ch(fin, 'r') * 255) / Math.max(40, grade[0])), g: Math.min(255, (ch(fin, 'g') * 255) / Math.max(40, grade[1])), b: Math.min(255, (ch(fin, 'b') * 255) / Math.max(40, grade[2])) };
  return {
    lx: length * Math.sin(b),
    ly: length * Math.cos(b),
    alpha: strength,
    length,
    tint: toInt(tint),
    elevation: s.elevation,
    bearing: s.bearing,
  };
}

/** How the shadow fades with how much it blocks: at night the moon casts nothing (kept as a function so a moon shadow can come later). */
export const moonShadow = (): number => 0;

export interface ShearTransform {
  /** the container: rotation and scale applied LAST (outer) */
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** the child sprite's own rotation (applied first, inner) */
  childRotation: number;
}

/**
 * Phaser sprites only rotate and scale, never shear, but a Container's transform times its child's is a general 2x2 matrix, so a shear is a
 * container (rotation, scale) over a child (rotation): `M = Rot(rotation) * diag(scaleX, scaleY) * Rot(childRotation)` (a 2x2 SVD).
 * `M` maps a sprite-local point (u, v) (v negative = up) relative to the foot to its shadow on the ground: x' = u - v*lx, y' = -v*ly,
 * i.e. `M = [[1, -lx], [0, -ly]]`. The y flip is a negative scale, so the container is `scaleY < 0`.
 */
export function shearTransform(lx: number, ly: number, flip = 1): ShearTransform {
  // M = [[a, b], [c, d]] with x' = a x + b y, y' = c x + d y; `flip` mirrors the sprite horizontally (a sprite facing west)
  const a = flip;
  const b = -lx;
  const c = 0;
  const d = -ly;
  const E = (a + d) / 2;
  const F = (a - d) / 2;
  const G = (c + b) / 2;
  const H = (c - b) / 2;
  const Q = Math.hypot(E, H);
  const R = Math.hypot(F, G);
  const a1 = Math.atan2(G, F);
  const a2 = Math.atan2(H, E);
  return { scaleX: Q + R, scaleY: Q - R, childRotation: (a2 - a1) / 2, rotation: (a2 + a1) / 2 };
}

/** Applies a `ShearTransform` to a sprite-local point (for tests and for sizing the shadow's footprint). */
export function applyShear(t: ShearTransform, u: number, v: number): [number, number] {
  const cr = Math.cos(t.childRotation);
  const sr = Math.sin(t.childRotation);
  const x1 = cr * u - sr * v;
  const y1 = sr * u + cr * v;
  const x2 = x1 * t.scaleX;
  const y2 = y1 * t.scaleY;
  const co = Math.cos(t.rotation);
  const so = Math.sin(t.rotation);
  return [co * x2 - so * y2, so * x2 + co * y2];
}

// ------------------------------------------------------------------ what casts

/** How one sprite casts: `cast` false = not at all; `hScale` scales the length (low things like cars cast short); `capPx` limits the shadow's reach. */
export interface CastPreset {
  cast: boolean;
  hScale: number;
  /** longest the shadow may be along its own direction, art px (a 100 px facade at L = 1.2 would reach 120 px) */
  capPx: number;
  /** multiplies the global shadow strength */
  alpha: number;
  /** blur radius in art px applied to the silhouette before it is sheared (softness) */
  blur: number;
}

const NO_CAST: readonly string[] = ['decals/', 'fx/', 'backdrop/', 'ui/', 'walls/', 'doors/', 'telhados/', 'furniture/', 'props/fios', 'props/doormat', 'props/tatame', 'critters/pigeon', 'chars/parrot'];

/** Sprites that are a building front: tall, they cast a capped, softer shadow. */
const BUILDING: readonly string[] = ['facades/', 'buildings/', 'casas/', 'fundos/', 'props/edicula', 'props/ponto_onibus', 'props/feira_livre'];
/** Things that are low or lean (vehicles, dogs): a shorter, tighter shadow. */
const LOW: readonly string[] = ['vehicles/', 'critters/'];

/**
 * The shadow preset of a manifest sprite key. Every prop casts by default (so a new prop gets a sensible shadow with no data), except the flat
 * things (decals, wires, ground art), which are on the `NO_CAST` list.
 */
export function castPreset(key: string, def?: { decal?: boolean; h?: number; footprint?: [number, number] }): CastPreset {
  if (def?.decal || NO_CAST.some((p) => key.startsWith(p))) return { cast: false, hScale: 0, capPx: 0, alpha: 0, blur: 0 };
  if (BUILDING.some((p) => key.startsWith(p))) return { cast: true, hScale: 1, capPx: 66, alpha: 0.92, blur: 1.2 };
  if (LOW.some((p) => key.startsWith(p))) return { cast: true, hScale: 0.55, capPx: 40, alpha: 1, blur: 0.6 };
  if (key.startsWith('chars/')) return { cast: true, hScale: 0.85, capPx: 44, alpha: 1, blur: 0.6 };
  if (key.includes('canopy') || key.includes('_tarp') || key.includes('_roll')) return { cast: true, hScale: 1, capPx: 70, alpha: 0.78, blur: 1.6 };
  return { cast: true, hScale: 1, capPx: 70, alpha: 1, blur: 0.9 };
}

/**
 * The shear a particular caster uses: the look's `(lx, ly)` scaled by the preset's `hScale`, then limited so a shadow whose tallest point
 * is `height` px high is no longer than `capPx`.
 */
export function casterShear(look: Pick<ShadowLook, 'lx' | 'ly'>, p: Pick<CastPreset, 'hScale' | 'capPx'>, height: number): { lx: number; ly: number } {
  let lx = look.lx * p.hScale;
  let ly = look.ly * p.hScale;
  const len = Math.hypot(lx, ly) * height;
  if (len > p.capPx && len > 0) {
    const k = p.capPx / len;
    lx *= k;
    ly *= k;
  }
  return { lx, ly };
}

// ------------------------------------------------------------------ silhouette sizing

/** Padding (art px) around a silhouette so its blur is not clipped. */
export const SIL_PAD = 3;

/**
 * Rows of a frame that belong to the shadow: those at or above the foot line (`ay`: the foot's y inside the frame). Rows below the foot are in
 * front of the footprint (a bench's front lip) and would project toward the sun.
 */
export const shadowRows = (h: number, ay: number): number => Math.max(0, Math.min(h, Math.ceil(ay)));

/** The contact-hardening ramp: 1 at the foot, down to `tip` at the top of the sprite (a shadow is sharpest and darkest where it touches). */
export function rampAlpha(z: number, zMax: number, tip = 0.55): number {
  if (zMax <= 0) return 1;
  return lerp(1, tip, smooth(clamp01(z / zMax)));
}

// ------------------------------------------------------------------ rim light

export interface RimSpec {
  /** where the sun is: `l` = the left of the screen (afternoon), `r` = the right (morning) */
  side: 'l' | 'r';
  /** 0..1 alpha of the warm edge */
  alpha: number;
  /** ADD tint 0xRRGGBB: peach-pink at dawn, orange at dusk */
  tint: number;
}

const RIM_DAWN = 0xffb7a4;
const RIM_DUSK = 0xffa05a;

/**
 * The warm edge light on whatever faces the sun, strongest when the sun is low (the first and last hours of light), gone by the time it is high
 * and under a grey sky: it follows the shadow's strength, so garoa and chuva have none.
 */
export function rimLook(s: Pick<ShadowLook, 'lx' | 'alpha' | 'elevation' | 'bearing'>): RimSpec {
  const low = 1 - smooth(clamp01((s.elevation - 6) / 34));
  const morning = s.bearing < 0;
  return { side: s.lx > 0 ? 'l' : 'r', alpha: 0.9 * low * s.alpha, tint: morning ? RIM_DAWN : RIM_DUSK };
}
