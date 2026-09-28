/** Color math for the character renderer: warm shadows, sheen, colored line work. */
export type RGB = [number, number, number];

const parsed = new Map<string, RGB>();

export function toRgb(c: string): RGB {
  const hit = parsed.get(c);
  if (hit) return hit;
  let out: RGB;
  if (c[0] === '#') {
    const n = parseInt(c.length === 4 ? c.slice(1).replace(/./g, (d) => d + d) : c.slice(1, 7), 16);
    out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    const m = c.match(/[\d.]+/g) ?? ['0', '0', '0'];
    out = [Number(m[0]), Number(m[1]), Number(m[2])];
  }
  parsed.set(c, out);
  return out;
}

export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a);
  const y = toRgb(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
}

export function rgba(c: string, a: number): string {
  const x = toRgb(c);
  return `rgba(${x[0]},${x[1]},${x[2]},${a})`;
}

export function lum(c: string): number {
  const [r, g, b] = toRgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface Tone {
  hi: string;
  base: string;
  lo: string;
  deep: string;
  line: string;
}

const tones = new Map<string, Tone>();

/** Shadow ink leans warm plum (SP late afternoon), never grey. */
const INK = '#2a1624';

export function tone(base: string, kind: 'cloth' | 'skin' | 'hair' | 'shoe' | 'metal' = 'cloth'): Tone {
  const k = `${kind}:${base}`;
  const hit = tones.get(k);
  if (hit) return hit;
  const L = lum(base);
  let t: Tone;
  if (kind === 'skin') {
    t = {
      hi: mix(base, L > 0.5 ? '#fff3e6' : '#f2c9a4', L > 0.5 ? 0.3 : 0.2),
      base,
      lo: mix(base, L > 0.42 ? '#9c3a2c' : '#3a130e', L > 0.42 ? 0.26 : 0.34),
      deep: mix(base, '#2a0d0a', L > 0.42 ? 0.42 : 0.5),
      line: mix(base, '#240a0a', L > 0.42 ? 0.55 : 0.6),
    };
  } else if (kind === 'hair') {
    t = {
      hi: mix(base, L < 0.18 ? '#a69aa8' : '#fff2d8', L < 0.18 ? 0.34 : 0.36),
      base,
      lo: mix(base, '#140a10', 0.38),
      deep: mix(base, '#0c0608', 0.6),
      line: mix(base, '#0c0608', 0.55),
    };
  } else {
    const light = L > 0.78;
    t = {
      hi: mix(base, '#fff6e6', light ? 0.5 : L < 0.25 ? 0.2 : 0.24),
      base,
      // Light cloth folds lean warm taupe, not grey-violet (no sterile white; avatar enhance v2)
      lo: light ? mix(base, '#806658', 0.22) : mix(base, INK, L < 0.25 ? 0.36 : 0.3),
      deep: light ? mix(base, '#5a4148', 0.4) : mix(base, INK, 0.55),
      line: light ? mix(base, '#45303a', 0.5) : mix(base, INK, L < 0.25 ? 0.62 : 0.58),
    };
  }
  tones.set(k, t);
  return t;
}

/** Rim light per room mood (palette.md lighting). */
export const RIM = {
  tarde: '#ffcf8c',
  manha: '#fff0cc',
  dia: '#e4efff',
} as const;

export type Light = keyof typeof RIM;
