/**
 * Brazilian parrot flock — TB Art brief + Jonny lock (2026-09-27).
 * Shared draw paths for intro cinematic pass + idle-kick distant birds.
 */

export type ParrotSpecies = 'arara' | 'papagaio';

export type ParrotPalette = {
  body: string;
  wing: string;
  tail: string;
  beak: string;
  cheek?: string;
};

/** SP warmth — no neon cyan/magenta (palette.md cousins). */
export const ARARA_SCHEMES: ParrotPalette[] = [
  { body: '#1f5d50', wing: '#d4a017', tail: '#c45c26', beak: '#d4a017', cheek: '#2f5d50' },
  { body: '#244a3f', wing: '#e07a5f', tail: '#8f3e15', beak: '#8b5e3c', cheek: '#2e8a55' },
  { body: '#2b5ba8', wing: '#f2c230', tail: '#c45c26', beak: '#d4a017' },
];

export const PAPAGAIO_SCHEMES: ParrotPalette[] = [
  { body: '#2e8a55', wing: '#3a9e62', tail: '#2f5d50', beak: '#d4a017', cheek: '#f5e6d3' },
  { body: '#2f5d50', wing: '#5cb87a', tail: '#244a3f', beak: '#8b5e3c', cheek: '#fffaf2' },
];

type Path2D = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number };

/** Sky arcs only — above wordmark / card (normalized y ≈ 0.05–0.32). */
const SKY_PATHS: Path2D[] = [
  { x0: -0.14, y0: 0.1, cx: 0.48, cy: 0.05, x1: 1.14, y1: 0.16 },
  { x0: -0.12, y0: 0.18, cx: 0.52, cy: 0.1, x1: 1.12, y1: 0.24 },
  { x0: -0.1, y0: 0.08, cx: 0.4, cy: 0.04, x1: 1.1, y1: 0.14 },
  { x0: 1.14, y0: 0.2, cx: 0.5, cy: 0.12, x1: -0.12, y1: 0.15 },
];

type DepthLayer = 'far' | 'mid' | 'near';

export interface FlockBird {
  species: ParrotSpecies;
  path: number;
  u: number;
  speed: number;
  depth: number;
  layer: DepthLayer;
  scheme: ParrotPalette;
  wingPhase: number;
  wingSpeed: number;
}

function depthLayer(depth: number): DepthLayer {
  if (depth < 0.34) return 'far';
  if (depth < 0.67) return 'mid';
  return 'near';
}

function bez(p: Path2D, t: number, w: number, h: number) {
  const u = 1 - t;
  const x = u * u * p.x0 * w + 2 * u * t * p.cx * w + t * t * p.x1 * w;
  const y = u * u * p.y0 * h + 2 * u * t * p.cy * h + t * t * p.y1 * h;
  const dx = 2 * u * (p.cx - p.x0) * w + 2 * t * (p.x1 - p.cx) * w;
  const dy = 2 * u * (p.cy - p.y0) * h + 2 * t * (p.y1 - p.cy) * h;
  return { x, y, angle: Math.atan2(dy, dx) };
}

function pickScheme(species: ParrotSpecies): ParrotPalette {
  const pool = species === 'arara' ? ARARA_SCHEMES : PAPAGAIO_SCHEMES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function spawnBird(path: number, u: number, depth: number, species: ParrotSpecies): FlockBird {
  return {
    species,
    path,
    u,
    speed: (0.0001 + Math.random() * 0.00008) * (0.7 + depth * 0.45),
    depth,
    layer: depthLayer(depth),
    scheme: pickScheme(species),
    wingPhase: Math.random() * Math.PI * 2,
    wingSpeed: 0.1 + Math.random() * 0.06,
  };
}

/** One cinematic pass: ~6–12 birds, mixed species, 2–3 depth layers. */
export function spawnCinematicFlock(birds: FlockBird[], targetCount: number) {
  const path = Math.floor(Math.random() * SKY_PATHS.length);
  const n = Math.max(6, Math.min(12, targetCount));
  for (let i = 0; i < n; i++) {
    const depth = 0.15 + (i / (n - 1 || 1)) * 0.75 + (Math.random() - 0.5) * 0.08;
    const species: ParrotSpecies = i % 3 === 0 || i % 5 === 0 ? 'papagaio' : 'arara';
    birds.push(spawnBird(path, -0.12 - i * 0.048, Math.min(0.92, Math.max(0.12, depth)), species));
  }
}

const INK = 'rgba(44, 44, 44, 0.88)';

/* OPUS-VISUAL: parrot flock polish — feather barbs, specular wing flash, soft belly shadow */
function drawArara(ctx: CanvasRenderingContext2D, wing: number, c: ParrotPalette, scale: number) {
  const flap = Math.sin(wing) * 0.32;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.35 / scale;

  ctx.fillStyle = 'rgba(44, 44, 44, 0.1)';
  ctx.beginPath();
  ctx.ellipse(2, 11, 16, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.tail;
  ctx.beginPath();
  ctx.moveTo(-18, 1);
  ctx.lineTo(-34, -6 + flap * 2);
  ctx.lineTo(-32, 10);
  ctx.lineTo(-20, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.quadraticCurveTo(-12, -16 - flap * 11, 5, -5);
  ctx.quadraticCurveTo(10, 3 + flap * 7, -2, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(12, -3, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (c.cheek) {
    ctx.fillStyle = c.cheek;
    ctx.beginPath();
    ctx.arc(15, 1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = c.beak;
  ctx.beginPath();
  ctx.moveTo(18, -2);
  ctx.lineTo(25, -1);
  ctx.lineTo(18, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fffaf2';
  ctx.beginPath();
  ctx.arc(14, -5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(14.3, -5, 0.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawPapagaio(ctx: CanvasRenderingContext2D, wing: number, c: ParrotPalette, scale: number) {
  const flap = Math.sin(wing) * 0.28;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3 / scale;

  ctx.fillStyle = 'rgba(44, 44, 44, 0.1)';
  ctx.beginPath();
  ctx.ellipse(1, 9, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.tail;
  ctx.beginPath();
  ctx.moveTo(-12, 2);
  ctx.lineTo(-18, 0 + flap);
  ctx.lineTo(-14, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.quadraticCurveTo(-9, -12 - flap * 9, 4, -3);
  ctx.quadraticCurveTo(7, 4 + flap * 5, -1, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(10, -2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (c.cheek) {
    ctx.fillStyle = c.cheek;
    ctx.beginPath();
    ctx.arc(13, 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = c.beak;
  ctx.beginPath();
  ctx.moveTo(16, -1);
  ctx.lineTo(22, 0);
  ctx.lineTo(16, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fffaf2';
  ctx.beginPath();
  ctx.arc(12, -4, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(12.3, -4, 0.65, 0, Math.PI * 2);
  ctx.fill();
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  wing: number,
  bird: FlockBird,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (bird.species === 'arara') drawArara(ctx, wing, bird.scheme, scale);
  else drawPapagaio(ctx, wing, bird.scheme, scale);
  ctx.restore();
}

function layerScale(layer: DepthLayer, depth: number): number {
  if (layer === 'far') return 0.5 + depth * 0.25;
  if (layer === 'mid') return 0.78 + depth * 0.28;
  return 0.95 + depth * 0.22;
}

function layerAlpha(layer: DepthLayer, depth: number): number {
  if (layer === 'far') return 0.42 + depth * 0.2;
  if (layer === 'mid') return 0.62 + depth * 0.22;
  return 0.72 + depth * 0.2;
}

function drawStaticFlock(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const poses: { x: number; y: number; s: number; a: number; bird: FlockBird }[] = [
    {
      x: 0.22,
      y: 0.14,
      s: 0.9,
      a: 0.12,
      bird: { species: 'arara', path: 0, u: 0.5, speed: 0, depth: 0.55, layer: 'mid', scheme: ARARA_SCHEMES[0]!, wingPhase: 0.3, wingSpeed: 0 },
    },
    {
      x: 0.62,
      y: 0.1,
      s: 0.65,
      a: -0.08,
      bird: { species: 'papagaio', path: 0, u: 0.5, speed: 0, depth: 0.25, layer: 'far', scheme: PAPAGAIO_SCHEMES[0]!, wingPhase: 0.5, wingSpeed: 0 },
    },
    {
      x: 0.78,
      y: 0.18,
      s: 1.05,
      a: 0.2,
      bird: { species: 'arara', path: 0, u: 0.5, speed: 0, depth: 0.72, layer: 'near', scheme: ARARA_SCHEMES[1]!, wingPhase: 0.2, wingSpeed: 0 },
    },
  ];
  for (const p of poses) {
    ctx.globalAlpha = layerAlpha(p.bird.layer, p.bird.depth);
    drawBird(ctx, p.x * w, p.y * h, p.a, p.s, p.bird.wingPhase, p.bird);
  }
  ctx.globalAlpha = 1;
}

function mountFlockLoop(
  back: HTMLCanvasElement,
  front: HTMLCanvasElement,
  birds: FlockBird[],
  dprCap: number,
): () => void {
  const ctxB = back.getContext('2d');
  const ctxF = front.getContext('2d');
  if (!ctxB || !ctxF) return () => {};
  let w = 0;
  let h = 0;
  let raf = 0;
  const resize = () => {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    w = back.clientWidth;
    h = back.clientHeight;
    for (const c of [back, front]) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    ctxB.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxF.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const drawOn = (ctx: CanvasRenderingContext2D, layers: DepthLayer[]) => {
    ctx.clearRect(0, 0, w, h);
    for (const b of birds) {
      if (!layers.includes(b.layer)) continue;
      if (b.u < -0.08 || b.u > 1.08) continue;
      const pt = bez(SKY_PATHS[b.path], b.u, w, h);
      const scale = layerScale(b.layer, b.depth);
      ctx.globalAlpha = layerAlpha(b.layer, b.depth);
      b.wingPhase += b.wingSpeed;
      drawBird(ctx, pt.x, pt.y, pt.angle, scale, b.wingPhase, b);
    }
    ctx.globalAlpha = 1;
  };
  const draw = () => {
    for (const b of birds) b.u += b.speed;
    for (let i = birds.length - 1; i >= 0; i--) {
      if (birds[i].u > 1.18) birds.splice(i, 1);
    }
    drawOn(ctxB, ['far', 'mid']);
    drawOn(ctxF, ['near']);
    raf = requestAnimationFrame(draw);
  };
  resize();
  draw();
  const ro = new ResizeObserver(resize);
  ro.observe(back);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

export interface IntroParrotsMount {
  teardown: () => void;
  syncClip: () => void;
}

function skyClipTop(root: HTMLElement, panelEl: HTMLElement | null, wrap: HTMLElement): number {
  const rr = wrap.getBoundingClientRect();
  let top = rr.height * 0.48;
  if (panelEl) {
    const pr = panelEl.getBoundingClientRect();
    top = Math.min(top, pr.top - rr.top - 8);
  }
  const shell = root.querySelector('.intro-shell');
  if (shell) {
    const hero = shell.querySelector('.intro-hero');
    if (hero) {
      const hr = hero.getBoundingClientRect();
      top = Math.min(top, hr.bottom - rr.top + 12);
    }
  }
  return Math.max(72, top);
}

/**
 * Cinematic one-pass flock for intro title screen.
 * Near layer clipped above wordmark + form — never through tap targets.
 */
export function mountIntroParrots(root: HTMLElement, panelEl: HTMLElement | null, reducedMotion: boolean): IntroParrotsMount {
  const back = document.createElement('canvas');
  back.className = 'intro-parrots intro-parrots-back tb-parrot-layer-far-mid';
  back.setAttribute('aria-hidden', 'true');

  const frontWrap = document.createElement('div');
  frontWrap.className = 'intro-parrots-front-wrap tb-parrot-layer-near';
  const front = document.createElement('canvas');
  front.className = 'intro-parrots intro-parrots-front';
  front.setAttribute('aria-hidden', 'true');
  frontWrap.append(front);

  const veil = root.querySelector('.intro-veil');
  if (veil) root.insertBefore(back, veil);
  else root.append(back);
  root.append(frontWrap);

  const mobile = window.matchMedia('(max-width: 480px)').matches;
  const dprCap = mobile ? 1.5 : 2;

  const updateClip = () => {
    const top = skyClipTop(root, panelEl, frontWrap);
    frontWrap.style.clipPath = `polygon(0 0, 100% 0, 100% ${top}px, 0 ${top}px)`;
  };

  if (reducedMotion) {
    const ctx = back.getContext('2d');
    const resizeStatic = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = back.clientWidth;
      const h = back.clientHeight;
      back.width = Math.floor(w * dpr);
      back.height = Math.floor(h * dpr);
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStaticFlock(ctx, w, h);
    };
    resizeStatic();
    const ro = new ResizeObserver(resizeStatic);
    ro.observe(back);
    updateClip();
    const roPanel = panelEl ? new ResizeObserver(updateClip) : null;
    if (panelEl) roPanel!.observe(panelEl);
    return {
      syncClip: updateClip,
      teardown: () => {
        ro.disconnect();
        roPanel?.disconnect();
        back.remove();
        frontWrap.remove();
      },
    };
  }

  const birds: FlockBird[] = [];
  spawnCinematicFlock(birds, mobile ? 8 : 10);

  const teardownLoop = mountFlockLoop(back, front, birds, dprCap);

  updateClip();
  const roClip = new ResizeObserver(updateClip);
  roClip.observe(root);
  if (panelEl) roClip.observe(panelEl);
  window.addEventListener('orientationchange', updateClip);

  return {
    syncClip: updateClip,
    teardown: () => {
      teardownLoop();
      roClip.disconnect();
      window.removeEventListener('orientationchange', updateClip);
      back.remove();
      frontWrap.remove();
    },
  };
}

/** Idle-kick: 1–2 distant birds only (auth-agent mounts into slot). */
export function mountIdleKickBirds(slot: HTMLElement): () => void {
  slot.classList.add('tb-idle-kick-birds');
  const canvas = document.createElement('canvas');
  canvas.className = 'tb-idle-kick-birds-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  slot.append(canvas);

  const birds: FlockBird[] = [
    spawnBird(0, 0.35, 0.22, 'papagaio'),
    spawnBird(2, 0.62, 0.18, 'arara'),
  ];
  birds.forEach((b) => {
    b.speed = 0;
    b.layer = 'far';
  });

  const ctx = canvas.getContext('2d');
  let ro: ResizeObserver | null = null;
  const paint = () => {
    if (!ctx) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight || 48;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const b of birds) {
      const pt = bez(SKY_PATHS[b.path], b.u, w, h);
      ctx.globalAlpha = 0.38;
      drawBird(ctx, pt.x, pt.y, 0.05, layerScale('far', b.depth) * 0.85, b.wingPhase, b);
    }
    ctx.globalAlpha = 1;
  };
  paint();
  ro = new ResizeObserver(paint);
  ro.observe(canvas);

  return () => {
    ro?.disconnect();
    canvas.remove();
    slot.classList.remove('tb-idle-kick-birds');
  };
}
