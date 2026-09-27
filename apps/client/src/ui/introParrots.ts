/** Brazilian parrot flock for the intro title screen (Composer scaffold). */

export type ParrotPalette = {
  body: string;
  wing: string;
  tail: string;
  beak: string;
  cheek?: string;
};

const SCHEMES: ParrotPalette[] = [
  { body: '#1d4f9c', wing: '#f2c230', tail: '#c41e3a', beak: '#2c2c2c', cheek: '#2e9e5b' }, // arara
  { body: '#c41e3a', wing: '#1d4f9c', tail: '#f2c230', beak: '#2c2c2c', cheek: '#2e9e5b' },
  { body: '#2e9e5b', wing: '#3fcf60', tail: '#1d4f9c', beak: '#2c2c2c' },
  { body: '#f08a24', wing: '#f2c230', tail: '#c45c26', beak: '#2c2c2c' },
  { body: '#3aa6a0', wing: '#2b5ba8', tail: '#7a4fb0', beak: '#2c2c2c', cheek: '#f2c230' },
];

type Path2D = { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number };

const PATHS: Path2D[] = [
  { x0: -0.12, y0: 0.2, cx: 0.45, cy: 0.1, x1: 1.12, y1: 0.26 },
  { x0: -0.15, y0: 0.34, cx: 0.55, cy: 0.22, x1: 1.14, y1: 0.3 },
  { x0: -0.1, y0: 0.14, cx: 0.38, cy: 0.06, x1: 1.1, y1: 0.18 },
  { x0: 1.12, y0: 0.38, cx: 0.5, cy: 0.28, x1: -0.14, y1: 0.22 },
];

interface Bird {
  path: number;
  u: number;
  speed: number;
  depth: number;
  scheme: ParrotPalette;
  wingPhase: number;
  wingSpeed: number;
  layer: 'back' | 'front';
}

function bez(p: Path2D, t: number, w: number, h: number) {
  const u = 1 - t;
  const x = u * u * p.x0 * w + 2 * u * t * p.cx * w + t * t * p.x1 * w;
  const y = u * u * p.y0 * h + 2 * u * t * p.cy * h + t * t * p.y1 * h;
  const dx = 2 * u * (p.cx - p.x0) * w + 2 * t * (p.x1 - p.cx) * w;
  const dy = 2 * u * (p.cy - p.y0) * h + 2 * t * (p.y1 - p.cy) * h;
  return { x, y, angle: Math.atan2(dy, dx) };
}

function spawnBird(path: number, u: number, depth: number): Bird {
  const layer = depth >= 0.62 ? 'front' : 'back';
  return {
    path,
    u,
    speed: (0.00011 + Math.random() * 0.00014) * (0.65 + depth * 0.55),
    depth,
    scheme: SCHEMES[Math.floor(Math.random() * SCHEMES.length)]!,
    wingPhase: Math.random() * Math.PI * 2,
    wingSpeed: 0.14 + Math.random() * 0.08,
    layer,
  };
}

function spawnWave(birds: Bird[], count: number) {
  const path = Math.floor(Math.random() * PATHS.length);
  for (let i = 0; i < count; i++) {
    birds.push(spawnBird(path, -0.08 - i * 0.055, 0.25 + Math.random() * 0.7));
  }
}

/* OPUS-VISUAL: parrot flock polish — feather barbs, specular wing, soft shadow on belly */
function drawParrot(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number, wing: number, c: ParrotPalette) {
  const flap = Math.sin(wing) * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = 'rgba(44,44,44,0.12)';
  ctx.beginPath();
  ctx.ellipse(2, 10, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#2c2c2c';
  ctx.lineWidth = 1.4;
  ctx.fillStyle = c.tail;
  ctx.beginPath();
  ctx.moveTo(-16, 2);
  ctx.lineTo(-28, -4 + flap * 2);
  ctx.lineTo(-26, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.quadraticCurveTo(-10, -14 - flap * 10, 4, -4);
  ctx.quadraticCurveTo(8, 2 + flap * 6, -2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(11, -3, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (c.cheek) {
    ctx.fillStyle = c.cheek;
    ctx.beginPath();
    ctx.arc(14, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = c.beak;
  ctx.beginPath();
  ctx.moveTo(17, -2);
  ctx.lineTo(23, -1);
  ctx.lineTo(17, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(13, -5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.arc(13.4, -5, 0.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawStaticFlock(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const poses = [
    { x: 0.18, y: 0.16, s: 1.1, a: 0.15, scheme: SCHEMES[0]! },
    { x: 0.72, y: 0.12, s: 0.85, a: -0.2, scheme: SCHEMES[2]! },
    { x: 0.48, y: 0.22, s: 1.35, a: 0.05, scheme: SCHEMES[1]! },
  ];
  for (const p of poses) {
    drawParrot(ctx, p.x * w, p.y * h, p.a, p.s, 0.4, p.scheme);
  }
}

function mountFlockLoop(
  back: HTMLCanvasElement,
  front: HTMLCanvasElement,
  birds: Bird[],
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
  const drawLayer = (ctx: CanvasRenderingContext2D, layer: 'back' | 'front') => {
    ctx.clearRect(0, 0, w, h);
    for (const b of birds) {
      if (b.layer !== layer) continue;
      if (b.u < -0.05 || b.u > 1.05) continue;
      const pt = bez(PATHS[b.path], b.u, w, h);
      const scale = (0.55 + b.depth * 0.95) * (layer === 'front' ? 1.08 : 1);
      ctx.globalAlpha = 0.55 + b.depth * 0.45;
      b.wingPhase += b.wingSpeed;
      drawParrot(ctx, pt.x, pt.y, pt.angle, scale, b.wingPhase, b.scheme);
    }
    ctx.globalAlpha = 1;
  };
  const draw = () => {
    for (const b of birds) b.u += b.speed;
    for (let i = birds.length - 1; i >= 0; i--) {
      if (birds[i].u > 1.15) birds.splice(i, 1);
    }
    drawLayer(ctxB, 'back');
    drawLayer(ctxF, 'front');
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

/**
 * Staggered arara / papagaio waves across the intro sky.
 * Back layer behind UI shell; front layer clipped above the auth panel.
 */
export function mountIntroParrots(root: HTMLElement, panelEl: HTMLElement | null, reducedMotion: boolean): IntroParrotsMount {
  const back = document.createElement('canvas');
  back.className = 'intro-parrots intro-parrots-back';
  back.setAttribute('aria-hidden', 'true');

  const frontWrap = document.createElement('div');
  frontWrap.className = 'intro-parrots-front-wrap';
  const front = document.createElement('canvas');
  front.className = 'intro-parrots intro-parrots-front';
  front.setAttribute('aria-hidden', 'true');
  frontWrap.append(front);

  const cafe = root.querySelector('.intro-cafe-scene');
  if (cafe) root.insertBefore(back, cafe);
  else root.append(back);
  root.append(frontWrap);

  const mobile = window.matchMedia('(max-width: 480px)').matches;
  const dprCap = mobile ? 1.5 : 2;
  const maxBirds = mobile ? 10 : 16;

  const updateClip = () => {
    if (!panelEl) return;
    const pr = panelEl.getBoundingClientRect();
    const rr = frontWrap.getBoundingClientRect();
    const top = Math.max(0, pr.top - rr.top - 6);
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

  const birds: Bird[] = [];
  spawnWave(birds, mobile ? 4 : 6);
  window.setTimeout(() => spawnWave(birds, mobile ? 3 : 5), 2200);
  window.setTimeout(() => spawnWave(birds, mobile ? 3 : 4), 4800);

  const waveTimer = window.setInterval(() => {
    while (birds.length > maxBirds) birds.shift();
    if (birds.every((b) => b.u > 0.35)) spawnWave(birds, mobile ? 3 : 5);
  }, 11_000);

  const teardownLoop = mountFlockLoop(back, front, birds, dprCap);

  updateClip();
  const roClip = new ResizeObserver(updateClip);
  roClip.observe(root);
  if (panelEl) roClip.observe(panelEl);
  window.addEventListener('orientationchange', updateClip);

  return {
    syncClip: updateClip,
    teardown: () => {
      clearInterval(waveTimer);
      teardownLoop();
      roClip.disconnect();
      window.removeEventListener('orientationchange', updateClip);
      back.remove();
      frontWrap.remove();
    },
  };
}
