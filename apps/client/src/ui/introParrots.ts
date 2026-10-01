/**
 * Brazilian parrot flock — TB Art brief + Jonny lock (2026-09-27).
 * Painted side-view araras / papagaios; shared by the intro cinematic pass and idle-kick birds.
 */

export type ParrotSpecies = 'arara' | 'papagaio';

export type ParrotPalette = {
  /** Back / crown. */
  body: string;
  /** Upper-wing flight feathers. */
  wing: string;
  tail: string;
  beak: string;
  cheek?: string;
  /** Belly / chest. */
  belly: string;
  /** Warm red-gold flash: underwing on the downstroke + covert band. */
  flash: string;
  flashDeep: string;
};

/** SP warmth — deep teal / SP-green with mustard + terracotta flash; no neon cyan/magenta. */
export const ARARA_SCHEMES: ParrotPalette[] = [
  { body: '#1f5d63', wing: '#1d4a5c', tail: '#24506a', beak: '#4a3423', cheek: '#f5e6d3', belly: '#e2b43a', flash: '#e9b93a', flashDeep: '#c45c26' },
  { body: '#1f5d50', wing: '#1c4a44', tail: '#8f3e15', beak: '#4a3423', cheek: '#f5e6d3', belly: '#d9a441', flash: '#e07a3f', flashDeep: '#b14f1f' },
  { body: '#2b5b78', wing: '#23465e', tail: '#c45c26', beak: '#5a3d28', cheek: '#fffaf2', belly: '#e8b64c', flash: '#f2c230', flashDeep: '#c45c26' },
];

export const PAPAGAIO_SCHEMES: ParrotPalette[] = [
  { body: '#3f8f5a', wing: '#2e7a4c', tail: '#2f6b48', beak: '#8b5e3c', cheek: '#f2d27a', belly: '#6fae6a', flash: '#d4602c', flashDeep: '#a94c1e' },
  { body: '#2e8a55', wing: '#2f5d50', tail: '#2f6b48', beak: '#8b5e3c', cheek: '#f5e6d3', belly: '#79b06d', flash: '#e9b93a', flashDeep: '#c45c26' },
];

type DepthLayer = 'far' | 'mid' | 'near';

export interface FlockBird {
  species: ParrotSpecies;
  layer: DepthLayer;
  /** 0 (far) … 1 (near). */
  depth: number;
  scheme: ParrotPalette;
  /** Seconds after mount when the bird enters the frame. */
  start: number;
  /** Seconds to cross the full width. */
  duration: number;
  /** Normalized band heights (0 = top, 1 = bottom) at enter / apex / exit. */
  arc: [number, number, number];
  /** px offset perpendicular to the flight line (formation spread). */
  lane: number;
  scale: number;
  wingPhase: number;
  /** Wing beats per second. */
  wingHz: number;
  /** +1 flies left→right, −1 right→left. */
  dir: 1 | -1;
  seed: number;
  /** The one slow, close glider that sells depth (near layer, but unhurried). */
  hero?: boolean;
}

export interface SkyBand {
  top: number;
  bottom: number;
}

const LAYER_HAZE: Record<DepthLayer, number> = { far: 0.42, mid: 0.12, near: 0 };
/** Golden-hour upper sky the far birds dissolve into. */
const SKY = [176, 174, 186];

function pick<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function hexRgb(hex: string): number[] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function haze(hex: string, t: number): string {
  if (t <= 0) return hex;
  const c = hexRgb(hex);
  const m = c.map((v, i) => Math.round(v + (SKY[i]! - v) * t));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

function darken(hex: string, k: number): string {
  const c = hexRgb(hex).map((v) => Math.round(v * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function hazedScheme(s: ParrotPalette, t: number): ParrotPalette {
  return {
    body: haze(s.body, t),
    wing: haze(s.wing, t),
    tail: haze(s.tail, t),
    beak: haze(s.beak, t),
    cheek: s.cheek ? haze(s.cheek, t) : undefined,
    belly: haze(s.belly, t),
    flash: haze(s.flash, t),
    flashDeep: haze(s.flashDeep, t),
  };
}

/** Quadratic arc through the band; returns normalized y (0 top … 1 bottom). */
export function arcY(arc: [number, number, number], u: number): number {
  const v = 1 - u;
  return v * v * arc[0] + 2 * v * u * arc[1] + u * u * arc[2];
}

function makeBird(
  species: ParrotSpecies,
  layer: DepthLayer,
  depth: number,
  start: number,
  duration: number,
  arc: [number, number, number],
  lane: number,
  scale: number,
): FlockBird {
  return {
    species,
    layer,
    depth,
    scheme: hazedScheme(pick(species === 'arara' ? ARARA_SCHEMES : PAPAGAIO_SCHEMES), LAYER_HAZE[layer]),
    start,
    duration,
    arc,
    lane,
    scale,
    wingPhase: Math.random() * Math.PI * 2,
    wingHz: species === 'arara' ? 2.1 + Math.random() * 0.4 : 3 + Math.random() * 0.6,
    dir: 1,
    seed: Math.random() * 10,
  };
}

/**
 * One cinematic pass: 6–12 birds, mixed species, far / mid / near layers.
 * Far birds ride high and slow; the near pair crosses fast and low for parallax;
 * one large near arara glides through slowly and late, so the frame reads deep.
 */
export function spawnCinematicFlock(birds: FlockBird[], targetCount: number) {
  const n = Math.max(6, Math.min(12, targetCount));
  const near = n >= 11 ? 2 : 1;
  const far = Math.max(2, Math.round((n - near - 1) * 0.4));
  const mid = n - near - far - 1;
  for (let i = 0; i < far; i++) {
    birds.push(
      makeBird(i % 2 ? 'papagaio' : 'arara', 'far', 0.12 + i * 0.05, -1.6 + i * 0.5, 11 + Math.random(), [0.4, 0.02, 0.22], (i % 2 ? -1 : 1) * (6 + i * 5), 0.46 + Math.random() * 0.08),
    );
  }
  for (let i = 0; i < mid; i++) {
    const species: ParrotSpecies = i === 1 || i === 4 ? 'papagaio' : 'arara';
    birds.push(
      makeBird(species, 'mid', 0.4 + i * 0.05, -0.7 + i * 0.24 + Math.random() * 0.08, 7 + Math.random() * 0.6, [0.78, 0.1, 0.42], (i % 2 ? 1 : -1) * (8 + i * 7), 0.82 + Math.random() * 0.14),
    );
  }
  for (let i = 0; i < near; i++) {
    birds.push(makeBird(i ? 'papagaio' : 'arara', 'near', 0.85 + i * 0.05, 1.1 + i * 1.1, 4.4, [0.86, 0.34, 0.66], i * -30, 1.3 - i * 0.12));
  }
  const hero = makeBird('arara', 'near', 0.95, 1.9, 10.5, [0.62, 0.3, 0.08], 14, 1.5);
  hero.hero = true;
  hero.scheme = ARARA_SCHEMES[2]!;
  hero.wingHz = 1.35;
  birds.push(hero);
}

// ---------------------------------------------------------------- pixel sprites (V4): the flock is art from the pipeline now (assets-src/custom/flock.mjs)
const FRAME_W = 30;
const FRAME_H = 22;
const FRAMES = 4;
const strips = new Map<ParrotSpecies, HTMLImageElement>();

function strip(species: ParrotSpecies): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = strips.get(species);
  if (!img) {
    img = new Image();
    img.src = `${import.meta.env.BASE_URL}pixel/flock/${species}_strip.png`;
    strips.set(species, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/** Warm the two strips so the first frame of the flock already has its sprites. */
export function preloadFlock(): Promise<void> {
  strip('arara');
  strip('papagaio');
  return Promise.all([...strips.values()].map((i) => i.decode().catch(() => undefined))).then(() => undefined);
}

/** Whole-number zoom for a bird of the flock's float `size` (far birds 1x, near birds 4x, the glider 5-6x). Pixel art is never scaled by a fraction. */
export function spriteZoom(size: number): number {
  return Math.max(1, Math.min(6, Math.round(size * 2.4)));
}

/** Which of the 4 wing-beat frames a bird shows at time `t` (seconds): its own beat rate and phase; the glider holds half-up between beats. */
export function wingFrame(b: Pick<FlockBird, 'wingPhase' | 'wingHz' | 'hero' | 'seed'>, t: number): number {
  const cycle = b.wingPhase / (Math.PI * 2) + t * b.wingHz;
  let f = Math.floor(((cycle % 1) + 1) % 1 * FRAMES);
  if (b.hero && Math.sin(t * 0.55 + b.seed) < -0.1) f = 1;
  return f;
}

export function drawParrot(ctx: CanvasRenderingContext2D, b: FlockBird, x: number, y: number, _angle: number, size: number, t: number) {
  const img = strip(b.species);
  if (!img) return;
  const z = spriteZoom(size);
  const w = FRAME_W * z;
  const h = FRAME_H * z;
  const sx = wingFrame(b, t) * FRAME_W;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (b.dir === -1) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, 0, FRAME_W, FRAME_H, -Math.round(w / 2), -Math.round(h / 2), w, h);
  ctx.restore();
  ctx.imageSmoothingEnabled = prev;
}

const LAYER_ALPHA: Record<DepthLayer, number> = { far: 0.78, mid: 0.96, near: 1 };

function birdPose(b: FlockBird, t: number, w: number, band: SkyBand) {
  const u = (t - b.start) / b.duration;
  if (u < 0 || u > 1) return null;
  const span = band.bottom - band.top;
  const x0 = -0.14 * w;
  const x1 = 1.14 * w;
  const xu = (v: number) => (b.dir === 1 ? x0 + (x1 - x0) * v : x1 - (x1 - x0) * v);
  const yu = (v: number) => band.top + span * arcY(b.arc, v) + b.lane;
  const x = xu(u);
  const bob = Math.sin(b.wingPhase + t * b.wingHz * Math.PI * 2 + Math.PI / 2) * 1.6 * b.scale;
  const y = yu(u) + bob;
  const du = 0.01;
  const angle = Math.atan2(yu(u + du) - yu(u), Math.abs(xu(u + du) - xu(u))) * b.dir;
  return { x, y, angle };
}

function baseSize(w: number) {
  return Math.min(1.35, Math.max(0.72, w / 560));
}

export function paintFlockFrame(ctx: CanvasRenderingContext2D, birds: FlockBird[], layer: DepthLayer, t: number, w: number, band: SkyBand) {
  const base = baseSize(w);
  for (const b of birds) {
    if (b.layer !== layer) continue;
    const pose = birdPose(b, t, w, band);
    if (!pose) continue;
    ctx.globalAlpha = LAYER_ALPHA[layer];
    drawParrot(ctx, b, pose.x, pose.y, pose.angle, b.scale * base, t);
  }
  ctx.globalAlpha = 1;
}

/** Reduced-motion still: three birds held mid-glide in the sky band. */
function drawStaticFlock(ctx: CanvasRenderingContext2D, w: number, band: SkyBand) {
  const base = baseSize(w);
  const span = band.bottom - band.top;
  const poses: [ParrotSpecies, DepthLayer, number, number, number, number, number][] = [
    ['arara', 'far', 0.66, 0.18, 0.5, -0.05, 0],
    ['papagaio', 'far', 0.78, 0.34, 0.44, -0.08, 1],
    ['arara', 'mid', 0.3, 0.56, 0.92, -0.12, 0],
  ];
  for (const [species, layer, px, py, s, a, scheme] of poses) {
    const pool = species === 'arara' ? ARARA_SCHEMES : PAPAGAIO_SCHEMES;
    const b = makeBird(species, layer, 0.5, 0, 1, [0.5, 0.5, 0.5], 0, s);
    b.scheme = hazedScheme(pool[scheme]!, LAYER_HAZE[layer]);
    b.wingPhase = 0;
    b.seed = -Math.PI / 2 - 0.8;
    ctx.globalAlpha = LAYER_ALPHA[layer];
    drawParrot(ctx, b, px * w, band.top + py * span, a, s * base, 0);
  }
  ctx.globalAlpha = 1;
}

export interface IntroParrotsMount {
  teardown: () => void;
  syncClip: () => void;
}

export interface IntroParrotsOptions {
  /** Sky band above the wordmark (viewport px). Measured by the caller from the title layout. */
  band?: () => SkyBand;
  /** Elements near birds must never paint over (wordmark, card). */
  keepClear?: () => (HTMLElement | null)[];
  /** Flock animation (or reduced-motion still) waits until this promise resolves — sync with Enter + music. */
  waitForStart?: Promise<void>;
}

/** Narrow screens cross faster so birds keep a similar px/s instead of crawling. */
export function crossingPace(width: number): number {
  return Math.min(1.15, Math.max(0.6, width / 1200));
}

function defaultBand(h: number): SkyBand {
  return { top: h * 0.04, bottom: h * 0.26 };
}

function sizeCanvas(c: HTMLCanvasElement, dprCap: number) {
  const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
  const w = c.clientWidth;
  const h = c.clientHeight;
  c.width = Math.max(1, Math.floor(w * dpr));
  c.height = Math.max(1, Math.floor(h * dpr));
  const ctx = c.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, ctx };
}

/**
 * Cinematic one-pass flock for the intro title screen, then an occasional distant pair.
 * Far + mid paint behind the veil; near paints in front but is clipped out of keep-clear rects.
 */
export function mountIntroParrots(
  root: HTMLElement,
  panelEl: HTMLElement | null,
  reducedMotion: boolean,
  opts: IntroParrotsOptions = {},
): IntroParrotsMount {
  void preloadFlock();
  const mk = (cls: string) => {
    const c = document.createElement('canvas');
    c.className = `intro-parrots ${cls}`;
    c.setAttribute('aria-hidden', 'true');
    return c;
  };
  const far = mk('intro-parrots-far tb-parrot-layer-far');
  const mid = mk('intro-parrots-back tb-parrot-layer-mid');
  const frontWrap = document.createElement('div');
  frontWrap.className = 'intro-parrots-front-wrap tb-parrot-layer-near';
  const front = mk('intro-parrots-front');
  frontWrap.append(front);

  const veil = root.querySelector('.intro-veil');
  if (veil) {
    root.insertBefore(far, veil);
    root.insertBefore(mid, veil);
  } else root.append(far, mid);
  root.append(frontWrap);

  const mobile = window.matchMedia('(max-width: 480px)').matches;
  const dprCap = mobile ? 1.75 : 2;
  const band = () => opts.band?.() ?? defaultBand(root.clientHeight);
  const keepClear = () => opts.keepClear?.() ?? [panelEl];

  if (reducedMotion) {
    const paint = () => {
      const { w, ctx } = sizeCanvas(mid, 1.5);
      if (!ctx) return;
      ctx.clearRect(0, 0, w, mid.clientHeight);
      drawStaticFlock(ctx, w, band());
    };
    const ro = new ResizeObserver(paint);
    ro.observe(root);
    const start = () => {
      paint();
      void preloadFlock().then(paint);
    };
    if (opts.waitForStart) void opts.waitForStart.then(start);
    else start();
    return {
      syncClip: paint,
      teardown: () => {
        ro.disconnect();
        far.remove();
        mid.remove();
        frontWrap.remove();
      },
    };
  }

  const birds: FlockBird[] = [];
  spawnCinematicFlock(birds, mobile ? 9 : 12);
  const pace = crossingPace(root.clientWidth);
  for (const b of birds) {
    b.duration *= pace;
    b.start *= pace;
  }

  let dims = { w: 0, h: 0 };
  const ctxs: Record<DepthLayer, CanvasRenderingContext2D | null> = { far: null, mid: null, near: null };
  const resize = () => {
    const a = sizeCanvas(far, dprCap);
    ctxs.far = a.ctx;
    ctxs.mid = sizeCanvas(mid, dprCap).ctx;
    ctxs.near = sizeCanvas(front, dprCap).ctx;
    dims = { w: a.w, h: a.h };
  };
  resize();

  let cachedBand = band();
  let t0 = performance.now();
  let raf = 0;
  let idleTimer = 0;
  let running = true;
  let flockStarted = !opts.waitForStart;

  const clipNear = (ctx: CanvasRenderingContext2D) => {
    const rr = root.getBoundingClientRect();
    ctx.beginPath();
    ctx.rect(0, 0, dims.w, dims.h);
    for (const el of keepClear()) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).opacity === '0') continue;
      ctx.rect(r.left - rr.left - 8, r.top - rr.top - 8, r.width + 16, r.height + 16);
    }
    ctx.clip('evenodd');
  };

  const scheduleAmbient = () => {
    idleTimer = window.setTimeout(() => {
      if (!running) return;
      const t = (performance.now() - t0) / 1000;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < 2; i++) {
        const b = makeBird(i ? 'papagaio' : 'arara', 'far', 0.15, t + i * 0.45, 13, [0.3, 0.05, 0.25], i * 10, 0.42);
        b.dir = dir;
        birds.push(b);
      }
      loop();
    }, 14000 + Math.random() * 9000);
  };

  const loop = () => {
    if (!flockStarted) return;
    cancelAnimationFrame(raf);
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      for (let i = birds.length - 1; i >= 0; i--) {
        const b = birds[i]!;
        if (t > b.start + b.duration + 0.2) birds.splice(i, 1);
      }
      for (const layer of ['far', 'mid', 'near'] as DepthLayer[]) {
        const ctx = ctxs[layer];
        if (!ctx) continue;
        ctx.clearRect(0, 0, dims.w, dims.h);
        if (layer === 'near') {
          ctx.save();
          clipNear(ctx);
          paintFlockFrame(ctx, birds, layer, t, dims.w, cachedBand);
          ctx.restore();
        } else paintFlockFrame(ctx, birds, layer, t, dims.w, cachedBand);
      }
      if (birds.length === 0) {
        scheduleAmbient();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    resize();
    cachedBand = band();
  };
  const ro = new ResizeObserver(sync);
  ro.observe(root);

  let hiddenAt = 0;
  const onVis = () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      cancelAnimationFrame(raf);
    } else if (hiddenAt) {
      t0 += performance.now() - hiddenAt;
      hiddenAt = 0;
      if (birds.length) loop();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  const beginFlock = () => {
    flockStarted = true;
    t0 = performance.now();
    loop();
  };
  if (opts.waitForStart) void opts.waitForStart.then(beginFlock);
  else beginFlock();

  return {
    syncClip: sync,
    teardown: () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      far.remove();
      mid.remove();
      frontWrap.remove();
    },
  };
}

/** Idle-kick: 1–2 distant birds only, held mid-glide (auth-agent mounts into slot). */
export function mountIdleKickBirds(slot: HTMLElement): () => void {
  slot.classList.add('tb-idle-kick-birds');
  const canvas = document.createElement('canvas');
  canvas.className = 'tb-idle-kick-birds-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  slot.append(canvas);

  const birds = [makeBird('papagaio', 'far', 0.2, 0, 1, [0.5, 0.5, 0.5], 0, 0.5), makeBird('arara', 'far', 0.2, 0, 1, [0.5, 0.5, 0.5], 0, 0.58)];
  for (const b of birds) b.seed = -Math.PI / 2 - 0.8;

  const paint = () => {
    const { w, h, ctx } = sizeCanvas(canvas, 1.5);
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.6;
    drawParrot(ctx, birds[0]!, w * 0.34, h * 0.62, -0.06, 0.5, 0);
    drawParrot(ctx, birds[1]!, w * 0.62, h * 0.4, -0.1, 0.58, 0);
    ctx.globalAlpha = 1;
  };
  paint();
  void preloadFlock().then(paint);
  const ro = new ResizeObserver(paint);
  ro.observe(canvas);

  return () => {
    ro.disconnect();
    canvas.remove();
    slot.classList.remove('tb-idle-kick-birds');
  };
}
