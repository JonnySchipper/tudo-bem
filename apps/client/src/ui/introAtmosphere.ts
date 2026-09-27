/** SP autumn air for the intro: a few ipê petals / leaves drifting down + warm motes in the sun beam. */

const LEAF_COLORS = ['#e9b93a', '#d4a017', '#c45c26', '#b8743a', '#d98aa5', '#e0a3b8'];

interface Leaf {
  x: number;
  y: number;
  size: number;
  vy: number;
  drift: number;
  spin: number;
  phase: number;
  color: string;
  petal: boolean;
}

interface Mote {
  x: number;
  y: number;
  r: number;
  phase: number;
}

export function mountIntroAtmosphere(canvas: HTMLCanvasElement, reducedMotion: boolean): () => void {
  if (reducedMotion) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let w = 0;
  let h = 0;
  const leaves: Leaf[] = [];
  const motes: Mote[] = [];
  const spawnLeaf = (anywhere: boolean): Leaf => ({
    x: Math.random() * w * 1.1,
    y: anywhere ? Math.random() * h : -20 - Math.random() * 60,
    size: 4 + Math.random() * 5,
    vy: 18 + Math.random() * 22,
    drift: -8 - Math.random() * 14,
    spin: 0.6 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]!,
    petal: Math.random() < 0.45,
  });

  const resize = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = w < 560 ? 12 : 22;
    while (leaves.length < want) leaves.push(spawnLeaf(true));
    leaves.length = want;
    if (motes.length === 0) {
      for (let i = 0; i < 16; i++) motes.push({ x: Math.random(), y: Math.random(), r: 0.8 + Math.random() * 1.8, phase: Math.random() * 6 });
    }
  };

  let last = performance.now();
  let raf = 0;
  const draw = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);

    for (const m of motes) {
      const mx = (m.x * 0.55 + Math.sin(t * 0.2 + m.phase) * 0.02) * w;
      const my = (m.y * 0.5 + Math.cos(t * 0.17 + m.phase) * 0.02) * h;
      const a = 0.18 + 0.2 * Math.sin(t * 0.9 + m.phase);
      ctx.fillStyle = `rgba(255, 236, 190, ${Math.max(0, a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx, my, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i]!;
      l.y += l.vy * dt;
      l.x += (l.drift + Math.sin(t * 1.3 + l.phase) * 16) * dt;
      if (l.y > h + 20 || l.x < -30) leaves[i] = spawnLeaf(false);
      const flip = Math.cos(t * l.spin + l.phase);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(t * l.spin * 0.6 + l.phase);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(flip));
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      if (l.petal) {
        ctx.ellipse(0, 0, l.size * 0.7, l.size * 0.45, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(-l.size, 0);
        ctx.quadraticCurveTo(0, -l.size * 0.7, l.size, 0);
        ctx.quadraticCurveTo(0, l.size * 0.7, -l.size, 0);
      }
      ctx.fill();
      if (!l.petal) {
        ctx.strokeStyle = 'rgba(111, 72, 41, 0.45)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-l.size * 0.9, 0);
        ctx.lineTo(l.size * 0.9, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  };

  resize();
  raf = requestAnimationFrame(draw);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const onVis = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else {
      last = performance.now();
      raf = requestAnimationFrame(draw);
    }
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  };
}
