/**
 * The pixel art of the flight in (ui/flightIntro.ts): everything is drawn by code on a small 2D canvas that CSS scales up by a whole
 * number (`image-rendering: pixelated`), the same way the title screen shows the Vila. No new image assets: the sky, the clouds, the
 * plane, the cabin and the Brazilian landscape are rasterized here once into sprites (crisp, no anti-aliasing) and composed per frame.
 * The characters are the game's own composed sheets (the player's look, Comissária Lia's), drawn by flightIntro.
 *
 * Two kinds of shot: `drawOutside` (the plane in the sky: night over the Atlantic, dawn, the descent, the runway) and `drawCabin`.
 */

// ---------------------------------------------------------------- colour and noise

type RGB = [number, number, number];

const rgbCache = new Map<string, RGB>();
function rgb(hex: string): RGB {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
  }
  return c;
}

const toHex = (c: RGB) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  const k = Math.max(0, Math.min(1, t));
  return toHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

/** A small deterministic random generator (mulberry32), so the stars and the hills are the same every time. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function sprite(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  if (ctx) paint(ctx);
  return c;
}

/** Fill every pixel where `inside(x, y)` holds, with a 1 px `outline` around the shape when given. */
function rasterize(w: number, h: number, inside: (x: number, y: number) => string | null, outline: string | null): HTMLCanvasElement {
  return sprite(w, h, (ctx) => {
    const img = ctx.createImageData(w, h);
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : inside(x, y));
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = at(x, y);
        if (!c && outline && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) c = outline;
        if (!c) continue;
        const [r, g, b] = rgb(c);
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  });
}

// ---------------------------------------------------------------- the sky

/** Time of day of a shot: 0 night, 1 dawn, 2 morning. */
export type SkyPhase = number;

const SKY: Record<'night' | 'dawn' | 'day', string[]> = {
  night: ['#070b22', '#101a42', '#1d2a5e', '#2e3772'],
  dawn: ['#2b3672', '#7a5a9a', '#e9857a', '#ffcf80'],
  day: ['#3d8fd6', '#6fb6ea', '#a6d7f4', '#e3f4fb'],
};

function skyStops(phase: SkyPhase): string[] {
  const a = phase <= 1 ? SKY.night : SKY.dawn;
  const b = phase <= 1 ? SKY.dawn : SKY.day;
  const t = phase <= 1 ? phase : phase - 1;
  return a.map((c, i) => mix(c, b[i]!, smooth(t)));
}

/** The sky as horizontal bands, dithered at each band's edge (a pixel-art gradient). `horizon` is where the last stop sits. */
export function drawSky(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, phase: SkyPhase, horizon = 1) {
  const stops = skyStops(phase);
  const bands = 18;
  const span = Math.max(1, h * horizon);
  for (let b = 0; b < bands; b++) {
    const t = b / (bands - 1);
    const seg = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    const color = mix(stops[i]!, stops[i + 1]!, seg - i);
    const top = y0 + Math.floor((b / bands) * span);
    const bottom = b === bands - 1 ? y0 + h : y0 + Math.floor(((b + 1) / bands) * span);
    rect(ctx, x0, top, w, bottom - top, color);
    // a checkered row of the next band's colour softens the step
    if (b < bands - 1) {
      const next = mix(stops[i]!, stops[i + 1]!, ((b + 1) / (bands - 1)) * (stops.length - 1) - i);
      ctx.fillStyle = next;
      for (let x = x0 + (b % 2); x < x0 + w; x += 2) ctx.fillRect(Math.round(x), bottom - 1, 1, 1);
    }
  }
}

export interface Star {
  x: number;
  y: number;
  tw: number;
  big: boolean;
}

export function makeStars(n: number, seed = 7): Star[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: r(), y: r() * r(), tw: r() * Math.PI * 2, big: r() < 0.08 }));
}

export function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], x0: number, y0: number, w: number, h: number, t: number, alpha: number, drift = 0) {
  if (alpha <= 0.02) return;
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(t * 1.7 + s.tw * 3);
    const a = alpha * tw;
    if (a < 0.15) continue;
    const x = x0 + ((((s.x * w - drift * (s.big ? 0.06 : 0.03)) % w) + w) % w);
    const y = y0 + s.y * h;
    ctx.globalAlpha = a;
    rect(ctx, x, y, 1, 1, '#fff8e0');
    if (s.big && tw > 0.8) {
      ctx.globalAlpha = a * 0.6;
      rect(ctx, x - 1, y, 1, 1, '#c9d6ff');
      rect(ctx, x + 1, y, 1, 1, '#c9d6ff');
      rect(ctx, x, y - 1, 1, 1, '#c9d6ff');
      rect(ctx, x, y + 1, 1, 1, '#c9d6ff');
    }
  }
  ctx.globalAlpha = 1;
}

let moonSprite: HTMLCanvasElement | null = null;
export function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
  if (alpha <= 0.02) return;
  moonSprite ??= rasterize(
    23,
    23,
    (px, py) => {
      const dx = px - 11;
      const dy = py - 11;
      const d = dx * dx + dy * dy;
      if (d > 110) return null;
      const crater = (cx: number, cy: number, r: number) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      if (crater(8, 8, 2.2) || crater(14, 13, 2.8) || crater(9, 15, 1.4) || crater(15, 7, 1)) return '#d6cfb4';
      // the lit edge, top left
      return dx + dy < -10 ? '#fffbe9' : '#f2ead0';
    },
    null,
  );
  ctx.globalAlpha = alpha * 0.18;
  ctx.fillStyle = '#fff3c8';
  ctx.beginPath();
  ctx.arc(Math.round(x), Math.round(y), 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.drawImage(moonSprite, Math.round(x - 11), Math.round(y - 11));
  ctx.globalAlpha = 1;
}

let sunSprite: HTMLCanvasElement | null = null;
export function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, alpha: number) {
  if (alpha <= 0.02) return;
  sunSprite ??= rasterize(
    29,
    29,
    (px, py) => {
      const d = (px - 14) ** 2 + (py - 14) ** 2;
      if (d > 196) return null;
      return d < 90 ? '#fff6c2' : d < 150 ? '#ffe07a' : '#ffc252';
    },
    null,
  );
  // glow rings and slow rays
  ctx.globalAlpha = alpha * 0.16;
  ctx.fillStyle = '#ffd98a';
  for (const r of [44, 30, 22]) {
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = '#fff1bf';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.05;
    const len = 34 + 8 * Math.sin(t * 0.8 + i);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - 0.05) * 16, y + Math.sin(a - 0.05) * 16);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a + 0.05) * 16, y + Math.sin(a + 0.05) * 16);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(sunSprite, Math.round(x - 14), Math.round(y - 14));
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- clouds

type CloudTone = 'night' | 'dawn' | 'day';
const CLOUD_COLORS: Record<CloudTone, [string, string, string]> = {
  night: ['#5a6497', '#3d4677', '#2b3360'],
  dawn: ['#ffe2b8', '#f2a48f', '#b8728f'],
  day: ['#ffffff', '#e6f1fa', '#bcd3e6'],
};

const cloudCache = new Map<string, HTMLCanvasElement>();

/** A puffy pixel cloud: overlapping circles, lit from the top, shaded underneath, outlined in its own shadow colour. */
function cloudSprite(seed: number, w: number, h: number, tone: CloudTone): HTMLCanvasElement {
  const key = `${seed}:${w}:${h}:${tone}`;
  let c = cloudCache.get(key);
  if (c) return c;
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  const n = 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const px = w * (0.15 + 0.7 * (i / (n - 1 || 1))) + (r() - 0.5) * w * 0.1;
    const pr = h * (0.28 + r() * 0.3) * (1 - Math.abs(i / (n - 1 || 1) - 0.5) * 0.7);
    puffs.push([px, h - pr - 1, pr]);
  }
  const [lit, mid, dark] = CLOUD_COLORS[tone];
  const inside = (x: number, y: number) => y < h - 1 && puffs.some(([px, py, pr]) => (x - px) ** 2 + (y - py) ** 2 <= pr * pr);
  c = rasterize(
    w,
    h,
    (x, y) => {
      if (!inside(x, y)) return null;
      if (!inside(x, y + 3) || y > h - 4) return dark;
      if (!inside(x, y - 2)) return lit;
      return y < h * 0.55 ? lit : mid;
    },
    null,
  );
  cloudCache.set(key, c);
  return c;
}

export interface CloudLayer {
  /** px of scroll per px of plane travel */
  par: number;
  y: number;
  clouds: { x: number; w: number; h: number; seed: number; dy: number }[];
  span: number;
}

export function makeCloudLayer(seed: number, count: number, span: number, size: [number, number], y: number, par: number): CloudLayer {
  const r = rng(seed);
  const clouds = Array.from({ length: count }, (_, i) => {
    const w = Math.round(size[0] * (0.7 + r() * 0.6));
    return { x: (i / count) * span + r() * (span / count) * 0.5, w, h: Math.round(size[1] * (0.7 + r() * 0.5)), seed: Math.floor(r() * 1e6), dy: (r() - 0.5) * size[1] * 0.6 };
  });
  return { par, y, clouds, span };
}

function toneMix(phase: SkyPhase): [CloudTone, CloudTone, number] {
  return phase <= 1 ? ['night', 'dawn', smooth(phase)] : ['dawn', 'day', smooth(phase - 1)];
}

export function drawCloudLayer(ctx: CanvasRenderingContext2D, layer: CloudLayer, scroll: number, x0: number, y0: number, w: number, phase: SkyPhase, alpha = 1) {
  const [a, b, k] = toneMix(phase);
  const off = ((scroll * layer.par) % layer.span + layer.span) % layer.span;
  for (const c of layer.clouds) {
    let x = c.x - off;
    while (x < -c.w) x += layer.span;
    for (; x < w; x += layer.span) {
      const px = x0 + x;
      const py = y0 + layer.y + c.dy - c.h;
      if (k < 1) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(cloudSprite(c.seed, c.w, c.h, a), Math.round(px), Math.round(py));
      }
      if (k > 0) {
        ctx.globalAlpha = alpha * k;
        ctx.drawImage(cloudSprite(c.seed, c.w, c.h, b), Math.round(px), Math.round(py));
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** The sea of cloud tops seen from cruising height: one band, lumpy on top, from `y` to the bottom. */
export function drawCloudSea(ctx: CanvasRenderingContext2D, scroll: number, x0: number, y: number, w: number, h: number, phase: SkyPhase) {
  const [a, b, k] = toneMix(phase);
  const col = (i: number) => mix(CLOUD_COLORS[a][i]!, CLOUD_COLORS[b][i]!, k);
  const lit = col(0);
  const mid = col(1);
  const dark = col(2);
  for (let x = 0; x < w; x++) {
    const wx = x + scroll;
    const top = y + Math.round(3 * Math.sin(wx * 0.07) + 2 * Math.sin(wx * 0.023 + 1) + 1.5 * Math.sin(wx * 0.13 + 2));
    rect(ctx, x0 + x, top, 1, 2, lit);
    rect(ctx, x0 + x, top + 2, 1, 4, mid);
    rect(ctx, x0 + x, top + 6, 1, h, dark);
    // a second ridge of puffs further down
    const t2 = top + 12 + Math.round(2 * Math.sin(wx * 0.05 + 3));
    rect(ctx, x0 + x, t2, 1, 1, mid);
  }
}

// ---------------------------------------------------------------- the plane

export const PLANE_W = 98;
export const PLANE_H = 30;

const planeCache = new Map<string, HTMLCanvasElement>();

/** Brazil's flag on the tail fin: a green field, the yellow rhombus, the blue disc with its white band. No red anywhere on the plane. */
export const FLAG = { green: '#2e9e5b', greenLo: '#2a7a45', yellow: '#f5cf3f', blue: '#2b4fa8', white: '#ffffff' } as const;

export function finColor(x: number, y: number): string {
  const dx = x - 13;
  const dy = y - 5;
  // the band: a white stripe across the disc, rising to the right
  if (dx * dx + dy * dy <= 5) return Math.round(dy + dx * 0.25) === 0 ? FLAG.white : FLAG.blue;
  if (Math.abs(dx) / 5.5 + Math.abs(dy) / 3.6 <= 1) return FLAG.yellow;
  return x <= 9 - (10 - y) * 0.6 + 1.5 ? FLAG.greenLo : FLAG.green;
}

/**
 * The airliner, side view, nose to the right: a white body with Brazil's green and yellow along it, the flag of Brazil on the tail,
 * windows lit warm at night.
 */
export function planeSprite(lit: boolean): HTMLCanvasElement {
  const key = lit ? 'lit' : 'day';
  const hit = planeCache.get(key);
  if (hit) return hit;
  const top = (x: number) => (x > 86 ? 10 + ((x - 86) / 9) ** 2 * 6 : 10);
  const bottom = (x: number) => (x > 86 ? 20 - ((x - 86) / 9) ** 1.6 * 4 : x < 24 ? 20 - (24 - x) * 0.33 : 20);
  const inBody = (x: number, y: number) => x >= 9 && x <= 95 && y >= top(x) && y <= bottom(x);
  const inFin = (x: number, y: number) => y >= 0 && y < 11 && x >= 9 - (10 - y) * 0.6 && x <= 23 - (10 - y) * 1.1;
  const inTailplane = (x: number, y: number) => y >= 14 && y <= 16 && x >= 3 && x <= 17 - (y - 14) * 2;
  const inWing = (x: number, y: number) => y >= 19 && y <= 27 && x >= 44 - (y - 19) * 1.25 && x <= 60 - (y - 19) * 2;
  const inEngine = (x: number, y: number) => y >= 21 && y <= 25 && x >= 51 && x <= 62;
  const c = rasterize(
    PLANE_W,
    PLANE_H,
    (x, y) => {
      if (inEngine(x, y)) return x >= 61 ? '#2a2233' : y >= 24 ? '#9b98a3' : '#dcd9df';
      if (inWing(x, y) && y >= 20) return y >= 26 ? '#8e8b97' : '#c3c0c9';
      if (inBody(x, y)) {
        // cockpit window
        if (x >= 88 && x <= 91 && y >= 12 && y <= 13) return '#24345e';
        // passenger windows
        if (y >= 12 && y <= 13 && x >= 26 && x <= 84 && x % 3 === 0) return lit ? '#ffd76a' : '#4a6a96';
        // the door
        if (x >= 82 && x <= 84 && y >= 11 && y <= 17) return x === 82 || x === 84 ? '#b9b5bf' : '#ebe7e1';
        if (y === 16) return '#2e9e5b';
        if (y === 17) return '#f2c230';
        if (y >= bottom(x) - 1.5) return '#bdb9c2';
        if (y <= top(x) + 0.8) return '#ffffff';
        return '#f3f0ea';
      }
      if (inFin(x, y)) return finColor(x, y);
      if (inTailplane(x, y)) return '#c3c0c9';
      return null;
    },
    '#2a2233',
  );
  planeCache.set(key, c);
  return c;
}

export interface PlanePose {
  /** centre of the plane on the canvas */
  x: number;
  y: number;
  /** nose up is negative (radians) */
  pitch: number;
  lit: boolean;
  gear: number;
  t: number;
  /** strobe and nav lights */
  lights: boolean;
  /** the contrail behind the engine (0-1) */
  trail: number;
}

export function drawPlane(ctx: CanvasRenderingContext2D, p: PlanePose) {
  const s = planeSprite(p.lit);
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  ctx.rotate(p.pitch);
  const ox = -Math.round(PLANE_W / 2);
  const oy = -Math.round(PLANE_H / 2);
  // contrails, fading behind the engine and the wing tip
  if (p.trail > 0.02) {
    for (let i = 0; i < 70; i++) {
      const a = p.trail * (1 - i / 70) * 0.5;
      ctx.globalAlpha = a;
      rect(ctx, ox + 50 - i * 2, oy + 23 + Math.round(Math.sin(i * 0.3 + p.t * 2) * 0.4), 2, 1, '#e8eefc');
    }
    ctx.globalAlpha = 1;
  }
  // landing gear (drawn under the body), sliding down with `gear`
  if (p.gear > 0.02) {
    const g = Math.round(p.gear * 5);
    rect(ctx, ox + 83, oy + 19, 1, g, '#5d5366');
    rect(ctx, ox + 82, oy + 19 + g, 3, 3, '#2a2233');
    rect(ctx, ox + 47, oy + 19, 1, g + 1, '#5d5366');
    rect(ctx, ox + 44, oy + 20 + g, 3, 3, '#2a2233');
    rect(ctx, ox + 48, oy + 20 + g, 3, 3, '#2a2233');
  }
  ctx.drawImage(s, ox, oy);
  if (p.lights) {
    const blink = Math.sin(p.t * 6) > 0.6;
    const strobe = p.t % 1.4 < 0.08;
    // the wing tip's nav light (green: this is the starboard side)
    rect(ctx, ox + 33, oy + 27, 2, 1, blink ? '#5dff8a' : '#1f7a45');
    if (strobe) {
      ctx.globalAlpha = 0.9;
      rect(ctx, ox + 2, oy + 0, 3, 3, '#ffffff');
      ctx.globalAlpha = 0.35;
      rect(ctx, ox + 0, oy - 2, 7, 7, '#ffffff');
      ctx.globalAlpha = 1;
    }
    // the beacon on the belly
    if (Math.sin(p.t * 3.2) > 0.3) rect(ctx, ox + 60, oy + 20, 2, 1, '#fff3c8');
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Brazil from the air: the landscape and the runway

export interface Land {
  far: number[];
  hills: number[];
  trees: { x: number; h: number; color: string; r: number }[];
  city: { x: number; w: number; h: number; tone: number }[];
  palms: number[];
  span: number;
}

export function makeLand(seed = 23, span = 1600): Land {
  const r = rng(seed);
  const far: number[] = [];
  const hills: number[] = [];
  for (let x = 0; x < span; x++) {
    const k = (x / span) * Math.PI * 2;
    far.push(14 + 9 * Math.sin(k * 3 + 1) + 6 * Math.sin(k * 7 + 2) + 3 * Math.sin(k * 17));
    hills.push(8 + 5 * Math.sin(k * 5 + 0.5) + 3 * Math.sin(k * 11 + 1.2) + 1.5 * Math.sin(k * 29));
  }
  const IPE = ['#f5cf3f', '#f5cf3f', '#e889a8', '#b57ad6', '#f5cf3f', '#ffffff'];
  const trees = Array.from({ length: 70 }, () => ({ x: r() * span, h: 3 + r() * 4, color: IPE[Math.floor(r() * IPE.length)]!, r: 2 + Math.floor(r() * 3) }));
  const city: Land['city'] = [];
  for (let x = span * 0.08; x < span * 0.62; ) {
    const w = 5 + Math.floor(r() * 9);
    city.push({ x, w, h: 8 + Math.floor(r() * r() * 36), tone: r() });
    x += w + Math.floor(r() * 3);
  }
  const palms = Array.from({ length: 22 }, () => r() * span);
  return { far, hills, trees, city, palms, span };
}

const wrap = (v: number, span: number) => ((v % span) + span) % span;

/**
 * The ground under the descent and the landing, as parallax bands. `scroll` is the plane's travel; `ground` is the canvas y of the
 * runway's surface (it rises into view as the plane comes down); `phase` tints it from dawn to morning.
 */
export function drawLand(ctx: CanvasRenderingContext2D, land: Land, scroll: number, x0: number, w: number, ground: number, phase: SkyPhase, runwayX: number) {
  const haze = phase < 2 ? 1 - smooth(phase - 1) : 0;
  // far mountains (the Serra do Mar), hazy blue
  const farY = ground - 30;
  const farCol = mix('#7f9fc0', '#c99aa8', haze * 0.6);
  for (let x = 0; x < w; x++) {
    const hgt = land.far[Math.floor(wrap(x + scroll * 0.12, land.span))]!;
    rect(ctx, x0 + x, farY - hgt, 1, hgt + 40, farCol);
  }
  // the city on the horizon: São Paulo's skyline, pale
  const cityY = ground - 22;
  for (const b of land.city) {
    let x = b.x - wrap(scroll * 0.22, land.span);
    if (x < -b.w) x += land.span;
    if (x > w) continue;
    const col = mix(mix('#9eb0c6', '#c8d3df', b.tone), '#d9a9b2', haze * 0.5);
    rect(ctx, x0 + x, cityY - b.h, b.w, b.h + 6, col);
    rect(ctx, x0 + x, cityY - b.h, 1, b.h + 6, mix(col, '#ffffff', 0.25));
    // windows catching the sun
    ctx.fillStyle = mix(col, '#fff2c0', 0.5);
    for (let wy = cityY - b.h + 2; wy < cityY; wy += 3) for (let wx = x + 2; wx < x + b.w - 1; wx += 2) if ((wx * 7 + wy * 3 + b.x) % 5 < 2) ctx.fillRect(Math.round(x0 + wx), Math.round(wy), 1, 1);
  }
  // green hills with ipê trees in bloom
  const hillY = ground - 9;
  for (let x = 0; x < w; x++) {
    const hgt = land.hills[Math.floor(wrap(x + scroll * 0.45, land.span))]!;
    rect(ctx, x0 + x, hillY - hgt, 1, 1, '#7ccf6a');
    rect(ctx, x0 + x, hillY - hgt + 1, 1, hgt + 30, '#4f9b55');
  }
  for (const tr of land.trees) {
    let x = tr.x - wrap(scroll * 0.45, land.span);
    if (x < -6) x += land.span;
    if (x > w + 6) continue;
    const base = hillY - land.hills[Math.floor(wrap(tr.x, land.span))]! + 1;
    rect(ctx, x0 + x, base - tr.h, 1, tr.h, '#6b4a2e');
    ctx.fillStyle = tr.color;
    for (let dy = -tr.r; dy <= tr.r; dy++)
      for (let dx = -tr.r; dx <= tr.r; dx++) if (dx * dx + dy * dy <= tr.r * tr.r + 1) ctx.fillRect(Math.round(x0 + x + dx), Math.round(base - tr.h - tr.r + dy), 1, 1);
  }
  // the airfield: grass, the runway, its lights, palms
  rect(ctx, x0, ground - 3, w, 400, '#5fae4f');
  rect(ctx, x0, ground - 3, w, 1, '#7ccf6a');
  // the runway, from its threshold on (before it, the approach is grass)
  const thr = runwayX - scroll;
  if (thr < w) {
    const rx = Math.max(0, Math.round(thr));
    rect(ctx, x0 + rx, ground, w - rx, 6, '#4a4752');
    rect(ctx, x0 + rx, ground, w - rx, 1, '#6a6672');
    rect(ctx, x0 + rx, ground + 6, w - rx, 1, '#3a3842');
    const dash = wrap(scroll, 24);
    for (let x = -dash; x < w; x += 24) if (x > thr + 16) rect(ctx, x0 + x, ground + 3, 12, 1, '#f3f0ea');
    for (let x = -wrap(scroll, 12); x < w; x += 12) if (x >= thr) rect(ctx, x0 + x, ground - 1, 1, 1, phase < 1.6 ? '#ffd76a' : '#d9d2c0');
    // the threshold: piano-key stripes
    if (thr > -16) for (let i = 0; i < 3; i++) rect(ctx, x0 + thr + 2, ground + 1 + i * 2, 10, 1, '#f3f0ea');
  }
  for (const p of land.palms) {
    let x = p - wrap(scroll * 1.25, land.span);
    if (x < -10) x += land.span;
    if (x > w + 10) continue;
    drawPalm(ctx, x0 + x, ground + 14);
  }
}

function drawPalm(ctx: CanvasRenderingContext2D, x: number, base: number) {
  for (let i = 0; i < 14; i++) rect(ctx, x + Math.round(Math.sin(i * 0.25) * 1.5), base - i, 2, 1, i % 3 ? '#8a6a44' : '#6b4a2e');
  const tx = x + Math.round(Math.sin(14 * 0.25) * 1.5);
  const ty = base - 14;
  ctx.fillStyle = '#2e9e5b';
  for (const [dx, dy] of [
    [-6, 2], [-5, 1], [-4, 0], [-3, -1], [-2, -1], [-1, -1], [0, -2], [1, -1], [2, -1], [3, -1], [4, 0], [5, 1], [6, 2], [-3, 1], [3, 1], [0, -1], [1, 0], [-1, 0],
  ] as [number, number][])
    ctx.fillRect(Math.round(tx + dx), Math.round(ty + dy), 2, 1);
  rect(ctx, tx, ty + 1, 2, 2, '#6b4a2e');
}

/** The terminal and the tower, at world x `at` on the ground line. */
export function drawTerminal(ctx: CanvasRenderingContext2D, sx: number, ground: number, t: number) {
  const x = Math.round(sx);
  const y = ground - 3;
  // the building: long and low, glass, a terracotta roof line
  rect(ctx, x, y - 18, 120, 18, '#efe3c8');
  rect(ctx, x, y - 20, 120, 2, '#c45c26');
  for (let i = 0; i < 14; i++) rect(ctx, x + 4 + i * 8, y - 15, 6, 9, (i + Math.floor(t)) % 7 === 0 ? '#e3f4fb' : '#9fc3d6');
  rect(ctx, x + 52, y - 10, 16, 10, '#2f5d50');
  // the sign
  rect(ctx, x + 36, y - 28, 48, 7, '#1d4f9c');
  ctx.fillStyle = '#ffffff';
  // "VILA IPÊ" in 3x5 letters
  const glyphs: Record<string, string[]> = {
    V: ['101', '101', '101', '010', '010'],
    I: ['111', '010', '010', '010', '111'],
    L: ['100', '100', '100', '100', '111'],
    A: ['010', '101', '111', '101', '101'],
    P: ['110', '101', '110', '100', '100'],
    E: ['111', '100', '110', '100', '111'],
  };
  let gx = x + 40;
  for (const ch of 'VILA IPE') {
    const gl = glyphs[ch];
    if (gl) gl.forEach((row, ry) => [...row].forEach((b, rx) => b === '1' && ctx.fillRect(gx + rx, y - 27 + ry, 1, 1)));
    gx += ch === ' ' ? 3 : 4;
  }
  // the Ê's hat
  ctx.fillRect(gx - 4, y - 28, 1, 1);
  ctx.fillRect(gx - 2, y - 28, 1, 1);
  ctx.fillRect(gx - 3, y - 29, 1, 1);
  // the control tower
  rect(ctx, x + 130, y - 40, 6, 40, '#e8dfcf');
  rect(ctx, x + 126, y - 48, 14, 8, '#2a2233');
  rect(ctx, x + 127, y - 47, 12, 5, '#9fc3d6');
  rect(ctx, x + 126, y - 50, 14, 2, '#c45c26');
  if (Math.sin(t * 4) > 0) rect(ctx, x + 132, y - 53, 2, 2, '#ff4a4a');
  // a windsock
  rect(ctx, x - 20, y - 14, 1, 14, '#5d5366');
  rect(ctx, x - 19, y - 14 + Math.round(Math.sin(t * 2)), 6, 2, '#f08a24');
}

/** Tyre smoke and dust: a puff born at (x, y) at time `born`. */
export interface Puff {
  x: number;
  y: number;
  born: number;
  vx: number;
  vy: number;
  r: number;
}

export function drawPuffs(ctx: CanvasRenderingContext2D, puffs: Puff[], t: number) {
  for (const p of puffs) {
    const age = t - p.born;
    if (age < 0 || age > 1.6) continue;
    const k = age / 1.6;
    const r = Math.round(p.r * (0.6 + k * 1.6));
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.fillStyle = k < 0.3 ? '#ffffff' : '#e3ded6';
    const cx = p.x + p.vx * age;
    const cy = p.y + p.vy * age;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- the cabin

/** Where things stand in the cabin, for flightIntro to place the people. */
export interface CabinLayout {
  /** the seat line: y of the seat cushion top */
  seatY: number;
  /** x centre of the player's seat (by the window) */
  mySeat: number;
  /** x centre of the seat next to it, where a passenger sleeps */
  nextSeat: number;
  /** where Lia stands in the aisle (feet), and the trolley */
  aisleX: number;
  floorY: number;
  windows: { x: number; y: number }[];
  /** the seatbelt sign over the player */
  sign: { x: number; y: number };
}

/** Window spacing along the wall, art px. */
const PITCH = 72;

/**
 * The row sits in the upper two thirds of the screen (the speech box covers the bottom), the player's seat by a window, the sleeper's
 * next to it, then the aisle where Lia stands with her trolley: the group is centred.
 */
export function cabinLayout(w: number, h: number): CabinLayout {
  const cx = Math.round(w / 2);
  const floorY = Math.round(h * (h > w * 1.1 ? 0.56 : 0.66));
  const seatY = floorY - 22;
  const mySeat = cx - 36;
  const winY = seatY - 46;
  const windows: { x: number; y: number }[] = [];
  for (let x = mySeat - 37 - PITCH * Math.ceil((mySeat + 40) / PITCH); x < w + PITCH; x += PITCH) windows.push({ x, y: winY });
  return { seatY, mySeat, nextSeat: mySeat + 24, aisleX: mySeat + 57, floorY, windows, sign: { x: mySeat + 12, y: winY - 26 } };
}

/** Seat pitch along a row, art px. */
export const SEAT_PITCH = 24;
/** How far up the row behind sits: only its headrests and its passengers' heads show over the row in front. */
export const BACK_ROW_RISE = 25;

/**
 * A full cabin: the player's row runs across the screen (seats on the window side of the aisle, the player's and the sleeper's among
 * them, then more past the aisle where Lia stands), and the row behind it shows over their headrests. Seat centres, art px, left to right.
 */
export function cabinRows(L: CabinLayout, w: number): { front: number[]; back: number[] } {
  const front: number[] = [];
  for (let x = L.mySeat - SEAT_PITCH * Math.ceil((L.mySeat + 12) / SEAT_PITCH); x <= L.nextSeat; x += SEAT_PITCH) front.push(x);
  for (let x = L.aisleX + 36; x < w + 12; x += SEAT_PITCH) front.push(x);
  // the row behind sits half a seat over, so its heads show between the headrests in front; only where a seat in front stands on both
  // sides (a seat behind half over the aisle would show a passenger cut off over bare wall)
  const has = (x: number) => front.includes(x);
  const back = front.filter((x) => has(x + SEAT_PITCH)).map((x) => x + SEAT_PITCH / 2);
  return { front, back };
}

/** A folded newspaper held in front of a seated passenger (chest at `y`); its page turns now and then. */
export function drawNewspaper(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, phase: number) {
  const turning = (t + phase) % 7 < 0.35;
  const w = turning ? 6 : 12;
  const x0 = Math.round(x - 6);
  rect(ctx, x0 - 1, y - 1, 14, 10, '#2a2233');
  rect(ctx, x0, y, 12, 8, '#efe9dc');
  if (turning) rect(ctx, x0 + 6, y - 1, 7, 9, '#d9d2c2');
  ctx.fillStyle = '#9a9488';
  for (let ly = 2; ly < 8; ly += 2) ctx.fillRect(x0 + 1, y + ly, w - 2 - (ly === 4 ? 3 : 0), 1);
  rect(ctx, x0 + 1, y + 1, 4, 1, '#2e9e5b');
}

/** A small coffee cup: it rests on the armrest and comes up for a sip every few seconds (`k` 0 resting, 1 at the lips). */
export function drawCup(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  const cy = Math.round(y - k * 7);
  rect(ctx, x - 1, cy - 1, 5, 6, '#2a2233');
  rect(ctx, x, cy, 3, 4, '#ffffff');
  rect(ctx, x, cy, 3, 1, '#8a5a3a');
  rect(ctx, x + 3, cy + 1, 1, 2, '#2a2233');
}

const seatCache = new Map<string, HTMLCanvasElement>();

/** A seat facing the camera: the back with a cream headrest cover, the cushion; `front` is the armrest drawn over the sitter. */
function seatSprite(part: 'back' | 'front'): HTMLCanvasElement {
  let c = seatCache.get(part);
  if (c) return c;
  if (part === 'back')
    c = rasterize(
      22,
      30,
      (x, y) => {
        const round = (x < 2 || x > 19) && y < 2;
        if (round) return null;
        if (y < 7 && x >= 3 && x <= 18) return y === 6 ? '#d9cfb8' : '#f5ecd8';
        if (y >= 22) return y === 22 ? '#4a8f8a' : '#2a6560';
        if (x === 1 || x === 20) return '#2a6560';
        return (x + y) % 6 === 0 ? '#34807a' : '#2f7f7a';
      },
      '#1f2a33',
    );
  else
    c = rasterize(
      26,
      14,
      (x, y) => {
        // two armrests, and the cushion's front edge
        if ((x <= 3 || x >= 22) && y <= 9) return y === 0 ? '#9a9aa4' : '#6b6b78';
        if (y >= 9) return y === 9 ? '#4a8f8a' : '#2a6560';
        return null;
      },
      '#1f2a33',
    );
  seatCache.set(part, c);
  return c;
}

export function drawSeatBack(ctx: CanvasRenderingContext2D, x: number, seatY: number) {
  ctx.drawImage(seatSprite('back'), Math.round(x - 11), Math.round(seatY - 22));
}

export function drawSeatFront(ctx: CanvasRenderingContext2D, x: number, seatY: number) {
  ctx.drawImage(seatSprite('front'), Math.round(x - 13), Math.round(seatY - 2));
}

/** The cabin wall, ceiling, bins, windows (with the sky outside, scrolling), carpet. The people go on top. */
export function drawCabin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  L: CabinLayout,
  o: { t: number; phase: SkyPhase; scroll: number; stars: Star[]; clouds: CloudLayer[]; sign: boolean; shake: number },
) {
  const wallTop = L.windows[0]!.y - 22;
  // ceiling and overhead bins
  rect(ctx, 0, 0, w, h, '#d9cfbd');
  rect(ctx, 0, 0, w, wallTop, '#cfc4b0');
  const bin0 = L.windows[0]!.x - 25;
  for (let x = bin0; x < w; x += PITCH) {
    rect(ctx, x + 1, wallTop - 20, PITCH - 2, 18, '#ebe3d4');
    rect(ctx, x + 1, wallTop - 4, PITCH - 2, 2, '#bdb2a0');
    rect(ctx, x + PITCH / 2 - 6, wallTop - 8, 12, 2, '#8e8b97');
    rect(ctx, x + 1, wallTop - 20, PITCH - 2, 1, '#fff8ea');
    rect(ctx, x, wallTop - 20, 1, 18, '#a99d8a');
  }
  if (wallTop - 20 > 0) {
    // the ceiling's curve above the bins, and its strip of lights
    rect(ctx, 0, 0, w, wallTop - 20, '#e4dccb');
    rect(ctx, 0, wallTop - 24, w, 3, '#d3c9b6');
    for (let x = 3; x < w; x += 9) rect(ctx, x, wallTop - 28, 4, 1, '#fff3cf');
  }
  // the reading lights and the seatbelt sign
  rect(ctx, 0, wallTop - 2, w, 3, '#b8ad9a');
  rect(ctx, L.sign.x - 7, L.sign.y - 3, 14, 7, '#3a3842');
  const lit = o.sign;
  ctx.fillStyle = lit ? '#ffcf4a' : '#5d5366';
  // a little seatbelt icon: a person with a belt
  ctx.fillRect(L.sign.x - 4, L.sign.y - 2, 2, 2);
  ctx.fillRect(L.sign.x - 5, L.sign.y, 4, 3);
  ctx.fillRect(L.sign.x + 1, L.sign.y - 1, 4, 1);
  ctx.fillRect(L.sign.x + 1, L.sign.y + 1, 4, 1);
  if (lit) {
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(o.t * 6);
    rect(ctx, L.sign.x - 10, L.sign.y - 6, 20, 13, '#ffd76a');
    ctx.globalAlpha = 1;
  }
  // the wall: panels, a dado line
  rect(ctx, 0, wallTop, w, L.seatY - wallTop + 10, '#efe6d6');
  for (let x = bin0 + PITCH - 1; x < w; x += PITCH) rect(ctx, x, wallTop, 1, L.seatY - wallTop, '#e0d6c4');
  rect(ctx, 0, L.windows[0]!.y + 34, w, 1, '#d6ccb8');
  // windows with the sky going by
  for (const win of L.windows) drawWindow(ctx, win.x, win.y, o);
  // the floor: the aisle carpet with its pattern
  rect(ctx, 0, L.floorY - 10, w, h, '#4b4e7a');
  rect(ctx, 0, L.floorY - 10, w, 1, '#3a3c62');
  ctx.fillStyle = '#5a5d8c';
  for (let y = L.floorY - 6; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < w; x += 6) ctx.fillRect(x, y, 1, 1);
  // a strip of floor lights down the aisle
  for (let x = 4; x < w; x += 10) rect(ctx, x, L.floorY + 6, 2, 1, o.phase < 1 ? '#8fb4ff' : '#c9c2e0');
}

const windowFrame = new Map<string, HTMLCanvasElement>();
function windowSprite(kind: 'mask' | 'frame'): HTMLCanvasElement {
  let c = windowFrame.get(kind);
  if (c) return c;
  const inside = (x: number, y: number) => {
    const dx = (x - 10.5) / 8.5;
    const dy = (y - 15) / 13;
    return Math.abs(dx) ** 3 + Math.abs(dy) ** 3 <= 1;
  };
  const near = (x: number, y: number) => {
    const dx = (x - 10.5) / 10.5;
    const dy = (y - 15) / 15;
    return Math.abs(dx) ** 3 + Math.abs(dy) ** 3 <= 1;
  };
  c =
    kind === 'mask'
      ? rasterize(22, 31, (x, y) => (inside(x, y) ? '#000000' : null), null)
      : rasterize(22, 31, (x, y) => (inside(x, y) ? null : near(x, y) ? (y < 15 ? '#cfc6b6' : '#b9ae9b') : null), '#9a8f7c');
  windowFrame.set(kind, c);
  return c;
}

const windowBuf = typeof document !== 'undefined' ? document.createElement('canvas') : null;

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, o: { t: number; phase: SkyPhase; scroll: number; stars: Star[]; clouds: CloudLayer[]; shake: number }) {
  if (!windowBuf) return;
  windowBuf.width = 22;
  windowBuf.height = 31;
  const b = windowBuf.getContext('2d');
  if (!b) return;
  b.imageSmoothingEnabled = false;
  // the outside, as seen through this window (offset by where it is on the wall, so the clouds go from one window to the next)
  drawSky(b, 0, 0, 22, 31, o.phase, 0.95);
  drawStars(b, o.stars, -x, 0, 400, 26, o.t, 1 - smooth(o.phase), o.scroll * 0.2);
  if (o.phase > 0.5) drawSun(b, 30 - x * 0.02, 34 - (o.phase - 0.5) * 18, o.t, smooth((o.phase - 0.5) * 2) * (x > -40 ? 1 : 0));
  for (const layer of o.clouds) drawCloudLayer(b, layer, o.scroll, -x, 0, 22 + x, o.phase);
  b.globalCompositeOperation = 'destination-in';
  b.drawImage(windowSprite('mask'), 0, 0);
  b.globalCompositeOperation = 'source-over';
  ctx.drawImage(windowBuf, Math.round(x), Math.round(y));
  ctx.drawImage(windowSprite('frame'), Math.round(x), Math.round(y));
  // the shade, half up
  rect(ctx, x + 3, y + 1, 16, 4, '#e6dccb');
  rect(ctx, x + 3, y + 5, 16, 1, '#c5baa6');
  // a glint on the glass
  ctx.globalAlpha = 0.35;
  rect(ctx, x + 5, y + 9, 1, 5, '#ffffff');
  rect(ctx, x + 6, y + 8, 1, 2, '#ffffff');
  ctx.globalAlpha = 1;
}

/** Light from outside in the cabin: blue and dim at night, a warm wash at dawn, plus the reading light over the player. */
export function drawCabinLight(ctx: CanvasRenderingContext2D, w: number, h: number, L: CabinLayout, phase: SkyPhase, t: number) {
  const night = 1 - smooth(phase);
  if (night > 0.02) {
    ctx.globalAlpha = night * 0.3;
    rect(ctx, 0, 0, w, h, '#1a2252');
    ctx.globalAlpha = 1;
  }
  // the reading light: a soft cone over the player's seat
  ctx.globalAlpha = 0.1 * night;
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.moveTo(L.mySeat - 2, L.sign.y + 6);
  ctx.lineTo(L.mySeat + 2, L.sign.y + 6);
  ctx.lineTo(L.mySeat + 14, L.seatY + 6);
  ctx.lineTo(L.mySeat - 14, L.seatY + 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  const dawn = phase > 0.4 ? smooth((phase - 0.4) / 0.6) : 0;
  if (dawn > 0.02) {
    // god rays from each window across the cabin
    ctx.globalAlpha = dawn * 0.16;
    ctx.fillStyle = '#ffc875';
    for (const win of L.windows) {
      ctx.beginPath();
      ctx.moveTo(win.x + 4, win.y + 6);
      ctx.lineTo(win.x + 18, win.y + 6);
      ctx.lineTo(win.x + 44 + Math.sin(t) * 2, L.floorY + 10);
      ctx.lineTo(win.x + 14 + Math.sin(t) * 2, L.floorY + 10);
      ctx.fill();
    }
    ctx.globalAlpha = dawn * 0.12;
    rect(ctx, 0, 0, w, h, '#ff9d5c');
    ctx.globalAlpha = 1;
  }
}

/** The drinks trolley, side on, at its left edge `x`, wheels on `floor`. */
export function drawTrolley(ctx: CanvasRenderingContext2D, x: number, floor: number) {
  const top = floor - 24;
  rect(ctx, x, top, 20, 22, '#2a2233');
  rect(ctx, x + 1, top + 1, 18, 20, '#c8c8d0');
  rect(ctx, x + 1, top + 1, 18, 2, '#e8e8ee');
  rect(ctx, x + 1, top + 8, 18, 2, '#2e9e5b');
  rect(ctx, x + 1, top + 10, 18, 1, '#f2c230');
  rect(ctx, x + 9, top + 3, 1, 18, '#9a9aa4');
  rect(ctx, x + 2, floor - 2, 3, 2, '#2a2233');
  rect(ctx, x + 15, floor - 2, 3, 2, '#2a2233');
  // on top: a coffee pot, cups, a little bowl of pão de queijo
  rect(ctx, x + 2, top - 5, 4, 5, '#2a2233');
  rect(ctx, x + 3, top - 4, 2, 4, '#e5572f');
  for (const cx of [8, 11]) rect(ctx, x + cx, top - 3, 2, 3, '#ffffff');
  rect(ctx, x + 14, top - 2, 5, 2, '#b98555');
  rect(ctx, x + 14, top - 4, 2, 2, '#f2c26a');
  rect(ctx, x + 16, top - 4, 2, 2, '#e9b64e');
  rect(ctx, x + 15, top - 5, 2, 1, '#f2c26a');
}

/** "z z z" rising from a sleeper. */
export function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.5 + i / 3) % 1;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
    const zx = Math.round(x + k * 8 + Math.sin(k * 6) * 1.5);
    const zy = Math.round(y - k * 14);
    const s = k > 0.5 ? 3 : 2;
    ctx.fillRect(zx, zy, s, 1);
    ctx.fillRect(zx + s - 1, zy + 1, 1, 1);
    if (s === 3) ctx.fillRect(zx + 1, zy + 1, 1, 1);
    ctx.fillRect(zx, zy + (s === 3 ? 2 : 2), s, 1);
  }
  ctx.globalAlpha = 1;
}
