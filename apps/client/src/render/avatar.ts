/**
 * Paper-doll characters (TB Art character redesign v1).
 *
 * The figure is rigged (IK legs/arms, ~6 heads tall) and painted in layers — hair behind → far arm →
 * legs → bottoms → neck → top → signature layers (apron, lanyard, pochete) → near arm → head/face →
 * hair → hat — with form shading, warm shadows and a room-matched rim light. Each pose is rendered
 * once per device scale into a cached frame with a soft silhouette outline (and a stronger halo on
 * the hat so it reads first), then blitted, so a full Praça crowd stays cheap to draw.
 */
import { CLOTH_COLORS, HAIR_COLORS, SHOE_COLORS, SKIN_TONES, hatById, type Appearance, type Dir, type EmoteKind, type HatDef, type NpcId } from '@tudobem/shared';
import { rrect, shadow, type Ctx } from './draw';
import { drawArm, drawHeld, drawLeg, drawNeck, drawPelvis, drawSignature, drawTorso, drawTote, type Look } from './avatar/body';
import { mix, rgba, RIM, tone, type Light } from './avatar/color';
import { clipHead, drawHairBehind, drawHairFront, drawHead, hatFit } from './avatar/head';
import { brimShade, drawHat as drawHatShape, drawHatIconArt, HAT_W, hatHeight } from './avatar/hats';
import { buildRig, HEAD, sitDrop, Y, type Rig, type RigState } from './avatar/rig';
import { glow, smoothClosed, type P } from './avatar/shape';

export { SEAT_H } from './avatar/rig';

export interface AvatarPose {
  dir: Dir;
  t: number;
  moving: boolean;
  sitting: boolean;
  emote?: { kind: EmoteKind; t0: number } | null;
  /** Seed so avatars don't bob or blink in sync. */
  seed?: number;
  /** Room mood for the rim light (Praça tarde, Padaria manhã, Kitnet dia). */
  light?: Light;
  /** Authored NPC signature layers. */
  npc?: NpcId;
  /** Seat surface height when sitting (defaults to bench height). */
  seatH?: number;
}

// ---------------------------------------------------------------- pose → frame state

interface FrameState {
  rs: RigState;
  hat: HatDef | undefined;
  hatT: number;
  flip: boolean;
  light: Light;
  key: string;
}

const TAU = Math.PI * 2;
const JULIA_CYCLE = 9;
const NANDA_CYCLE = 7;

function frameState(a: Appearance, hatId: string | null, pose: AvatarPose): FrameState {
  const front = pose.dir === 'SE' || pose.dir === 'SW';
  const flip = pose.dir === 'SW' || pose.dir === 'NW';
  const t = pose.t + (pose.seed ?? 0);
  const age = pose.emote ? pose.t - pose.emote.t0 : 99;
  const emote = pose.emote && age < 2.6 ? pose.emote.kind : null;
  const ageQ = emote ? Math.floor(age * 15) / 15 : 0;
  const phaseQ = pose.moving ? ((Math.round(((((t * 11) % TAU) + TAU) % TAU) / TAU * 12) % 12) + 12) % 12 : 0;
  const breathQ = pose.moving || pose.sitting ? 0 : Math.round(((Math.sin(t * 1.7) + 1) / 2) * 3);
  const blink = !emote && Math.sin(t * 1.3) > 0.984;
  let gestQ = 0;
  if (pose.npc === 'julia' || pose.npc === 'nanda') {
    const cyc = pose.npc === 'julia' ? JULIA_CYCLE : NANDA_CYCLE;
    const win = pose.npc === 'julia' ? 2.4 : 1.8;
    const p = (((t % cyc) + cyc) % cyc) / win;
    gestQ = p < 1 ? Math.round(p * 14) : 0;
  }
  const hat = hatById(hatId);
  let hatQ = 0;
  if (hat?.shape === 'sol') hatQ = Math.round((((t * 2) % TAU) / TAU) * 8) % 8;
  if (hat?.shape === 'cartola') hatQ = Math.round((((t * 3) % TAU) / TAU) * 6) % 6;
  const hatT = hat?.shape === 'sol' ? (hatQ / 8) * Math.PI : hat?.shape === 'cartola' ? ((hatQ / 6) * TAU) / 3 : 0;
  const light = pose.light ?? 'tarde';
  const rs: RigState = {
    a,
    front,
    moving: pose.moving,
    sitting: pose.sitting,
    phase: (phaseQ / 12) * TAU,
    breath: breathQ / 3,
    blink,
    emote,
    age: ageQ,
    npc: pose.npc,
    gesture: gestQ / 14,
    seatH: pose.sitting ? pose.seatH : undefined,
  };
  const ak = `${a.body}${a.skin}${a.hair}${a.hairColor}${a.top}${a.topColor}${a.bottom}${a.bottomColor}${a.shoes}${a.face ?? ''}${a.extra ?? ''}${a.idle ?? ''}`;
  const key = `${ak}|${hatId ?? ''}|${pose.npc ?? ''}|${pose.dir}|${light}|${pose.sitting ? (pose.seatH ?? 's') : 0}${pose.moving ? 1 : 0}|${phaseQ}|${breathQ}|${blink ? 1 : 0}|${emote ?? ''}${ageQ}|${gestQ}|${hatQ}`;
  return { rs, hat, hatT, flip, light, key };
}

function lookFor(a: Appearance, fs: FrameState): Look {
  const L = fs.flip ? 1 : -1;
  return {
    a,
    skin: tone(SKIN_TONES[a.skin] ?? SKIN_TONES[3], 'skin'),
    top: tone(CLOTH_COLORS[a.topColor] ?? CLOTH_COLORS[0]),
    bottom: tone(CLOTH_COLORS[a.bottomColor] ?? CLOTH_COLORS[2]),
    shoe: tone(SHOE_COLORS[a.shoes] ?? SHOE_COLORS[0], 'shoe'),
    hair: tone(HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0], 'hair'),
    L,
    rim: RIM[fs.light],
    npc: fs.rs.npc,
    front: fs.rs.front,
  };
}

// ---------------------------------------------------------------- layered painter

function hatPlacement(a: Appearance) {
  const fit = hatFit(a.hair);
  return { band: fit.band, s: Math.max(0.94, Math.min(1.3, fit.w / HAT_W)) };
}

function inHead(ctx: Ctx, r: Rig, fn: () => void) {
  ctx.save();
  ctx.translate(r.head.x, r.head.y);
  ctx.rotate(r.head.tilt);
  fn();
  ctx.restore();
}

function heldHat(ctx: Ctx, id: string, x: number, y: number, s: number, rot: number) {
  const h = hatById(id);
  if (!h) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  drawHatShape(ctx, h, { L: -1, rim: '#ffcf8c', front: true, t: 0 });
  ctx.restore();
}

function paintBody(ctx: Ctx, r: Rig, k: Look, fs: FrameState) {
  const front = r.front;
  const [far, near] = r.arms;
  const [legFar, legNear] = r.legs;
  // In back view the +x side is the one nearer the camera.
  const behindArm = front ? far : near;
  const frontArm = front ? near : far;
  const bi = front ? 0 : 1;
  const fi = front ? 1 : 0;
  if (front) inHead(ctx, r, () => drawHairBehind(ctx, r, k));
  if (!behindArm.over) {
    drawArm(ctx, r, behindArm, bi, k);
    drawHeld(ctx, r, bi as 0 | 1, k, heldHat);
  }
  if (front) {
    drawLeg(ctx, r, legFar, 0, k);
    drawLeg(ctx, r, legNear, 1, k);
  } else {
    drawLeg(ctx, r, legNear, 1, k);
    drawLeg(ctx, r, legFar, 0, k);
  }
  drawPelvis(ctx, r, k);
  drawNeck(ctx, r, k);
  drawTorso(ctx, r, k);
  drawSignature(ctx, r, k);
  drawTote(ctx, r, k);
  const head = () =>
    inHead(ctx, r, () => {
      drawHead(ctx, r, k);
      drawHairFront(ctx, r, k, !!fs.hat);
      if (fs.hat) brimShadow(ctx, k, fs.hat, front);
    });
  // From behind, hair falls over the back, so the head goes before the arms.
  if (!front) head();
  if (behindArm.over) {
    drawArm(ctx, r, behindArm, bi, k);
    drawHeld(ctx, r, bi as 0 | 1, k, heldHat);
  }
  drawArm(ctx, r, frontArm, fi, k);
  drawHeld(ctx, r, fi as 0 | 1, k, heldHat);
  if (front) head();
}

/** The hat's own shade on the forehead/eyes. */
function brimShadow(ctx: Ctx, k: Look, hat: HatDef, front: boolean) {
  const hp = hatPlacement(k.a);
  const depth = brimShade(hat.shape);
  ctx.save();
  clipHead(ctx, k.a.face, front);
  const g = ctx.createLinearGradient(0, hp.band, 0, hp.band + 6.5);
  g.addColorStop(0, rgba(k.skin.lo, depth + 0.1));
  g.addColorStop(0.55, rgba(k.skin.lo, depth * 0.45));
  g.addColorStop(1, rgba(k.skin.lo, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-HEAD.rx - 1, hp.band - 1, HEAD.rx * 2 + 2, 8);
  ctx.restore();
}

function paintHat(ctx: Ctx, r: Rig, k: Look, fs: FrameState) {
  if (!fs.hat) return;
  const hp = hatPlacement(k.a);
  inHead(ctx, r, () => {
    ctx.translate(0.15, hp.band);
    ctx.scale(hp.s, hp.s);
    drawHatShape(ctx, fs.hat!, { L: k.L, rim: k.rim, front: r.front, t: fs.hatT });
  });
}

// ---------------------------------------------------------------- frame cache + compositing

const X0 = -34;
const X1 = 34;
const Y0 = -124;
const Y1 = 11;
const PAD = 3;
const OUTLINE_INK = 'rgba(38,20,30,0.5)';
const HAT_INK = 'rgba(38,20,30,0.78)';
const BUDGET_PX = 12_000_000;

interface Frame {
  c: HTMLCanvasElement;
  ax: number;
  ay: number;
  px: number;
}

const frames = new Map<string, Frame>();
/** Most recent frame per avatar look + facing, reused while the paint budget is spent. */
const latest = new Map<string, Frame>();
let framePx = 0;
let budgetTick = -1;
let budget = 2;
const scratch: HTMLCanvasElement[] = [];

function canvas(i: number, w: number, h: number): HTMLCanvasElement {
  let c = scratch[i];
  if (!c) c = scratch[i] = document.createElement('canvas');
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
  const x = c.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  return c;
}

function tint(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, w: number, h: number, r: number, ink: string, tmpIndex: number) {
  const t = canvas(tmpIndex, w, h);
  const tc = t.getContext('2d')!;
  const steps = r > 1.6 ? 12 : 8;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    tc.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
  }
  tc.globalCompositeOperation = 'source-in';
  tc.fillStyle = ink;
  tc.fillRect(0, 0, w, h);
  tc.globalCompositeOperation = 'source-over';
  dst.drawImage(t, 0, 0);
}

function renderFrame(a: Appearance, fs: FrameState, ps: number, out?: HTMLCanvasElement): Frame {
  const w = Math.ceil((X1 - X0) * ps) + PAD * 2;
  const h = Math.ceil((Y1 - Y0) * ps) + PAD * 2;
  const ax = PAD - X0 * ps;
  const ay = PAD - Y0 * ps;
  const r = buildRig(fs.rs);
  const k = lookFor(a, fs);
  const layer = (i: number, fn: (c: Ctx) => void) => {
    const c = canvas(i, w, h);
    const x = c.getContext('2d')!;
    x.setTransform(ps, 0, 0, ps, ax, ay);
    if (fs.flip) x.scale(-1, 1);
    fn(x);
    return c;
  };
  const body = layer(0, (x) => paintBody(x, r, k, fs));
  const hat = fs.hat ? layer(1, (x) => paintHat(x, r, k, fs)) : null;
  const dst = out ?? document.createElement('canvas');
  if (dst.width !== w || dst.height !== h) {
    dst.width = w;
    dst.height = h;
  }
  const o = dst.getContext('2d')!;
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, w, h);
  const rad = Math.max(0.9, Math.min(2.2, ps * 0.42));
  tint(o, body, w, h, rad, OUTLINE_INK, 2);
  o.drawImage(body, 0, 0);
  if (hat) {
    tint(o, hat, w, h, rad * 1.45, HAT_INK, 2);
    o.drawImage(hat, 0, 0);
  }
  return { c: dst, ax, ay, px: w * h };
}

let preview: HTMLCanvasElement | null = null;

function getFrame(a: Appearance, fs: FrameState, ps: number): Frame {
  // Big previews (creator, shop) repaint every frame instead of filling the cache.
  if (ps > 3.2) {
    preview ??= document.createElement('canvas');
    return renderFrame(a, fs, ps, preview);
  }
  const key = `${fs.key}@${ps}`;
  const base = `${fs.key.split('|', 6).join('|')}@${ps}`;
  const hit = frames.get(key);
  if (hit) {
    frames.delete(key);
    frames.set(key, hit);
    latest.set(base, hit);
    return hit;
  }
  // Spread first-time paints across ticks so a crowd walking in doesn't hitch.
  const tick = Math.floor(performance.now() / 16);
  if (tick !== budgetTick) {
    budgetTick = tick;
    budget = 2;
  }
  const stale = latest.get(base);
  if (budget <= 0 && stale) return stale;
  budget--;
  const f = renderFrame(a, fs, ps);
  latest.set(base, f);
  frames.set(key, f);
  framePx += f.px;
  while (framePx > BUDGET_PX && frames.size > 1) {
    const [k0, f0] = frames.entries().next().value as [string, Frame];
    frames.delete(k0);
    framePx -= f0.px;
  }
  if (latest.size > 600) latest.clear();
  return f;
}

// ---------------------------------------------------------------- public API

export function drawAvatar(ctx: Ctx, x: number, y: number, a: Appearance, hatId: string | null, parrot: boolean, pose: AvatarPose) {
  const fs = frameState(a, hatId, pose);
  shadow(ctx, x + (pose.sitting ? 5 : 0.5), y + (pose.sitting ? 4 : 0), BODY_SHADOW[a.body] ?? 13, 6.2, 0.32);
  const m = ctx.getTransform();
  const ps = Math.round(Math.hypot(m.a, m.b) * 100) / 100;
  const f = getFrame(a, fs, ps);
  const dx = m.a * x + m.c * y + m.e;
  const dy = m.b * x + m.d * y + m.f;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(f.c, Math.round(dx - f.ax), Math.round(dy - f.ay));
  ctx.restore();

  const r = parrot ? buildRig(fs.rs) : null;
  if (parrot && r) {
    ctx.save();
    ctx.translate(x, y);
    if (fs.flip) ctx.scale(-1, 1);
    drawParrot(ctx, r.m.sh - 1.4 + r.bx, r.shY - 0.4, pose.t + (pose.seed ?? 0), fs.rs.front);
    ctx.restore();
  }
  if (fs.rs.emote) drawEmoteTag(ctx, x, y + avatarTop(a, hatId, pose.sitting, pose.seatH) - 14, fs.rs.emote, pose.t - pose.emote!.t0);
}

const BODY_SHADOW: Record<Appearance['body'], number> = { esguio: 11.5, medio: 12.5, forte: 14.5 };

/** Highest point of the silhouette above the floor point (negative y), for plates and tags. */
export function avatarTop(a: Appearance, hatId: string | null, sitting: boolean, seatH?: number): number {
  const hairTop: Record<Appearance['hair'], number> = { raspado: 0.3, curto: 1.4, cacheado: 2.8, black: 10, longo: 1.2, coque: 5.4, trancas: 1 };
  let top = Y.head - HEAD.top - (hairTop[a.hair] ?? 1);
  const hat = hatById(hatId);
  if (hat) {
    const hp = hatPlacement(a);
    top = Math.min(top, Y.head + hp.band - hatHeight(hat.shape) * hp.s - (hat.shape === 'gorro' ? 3 : 0));
  }
  return top + (sitting ? sitDrop(seatH) : 0);
}

/** A hat on its own with the in-world ink outline, for shop icons (64×64 box at the ctx origin). */
export function drawHatIcon(ctx: Ctx, hat: HatDef) {
  const m = ctx.getTransform();
  const ps = Math.hypot(m.a, m.b);
  const size = Math.ceil(64 * ps);
  const art = canvas(0, size, size);
  const ax = art.getContext('2d')!;
  ax.setTransform(ps, 0, 0, ps, 0, 0);
  drawHatIconArt(ax, hat);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const o = out.getContext('2d')!;
  tint(o, art, size, size, Math.max(1, ps * 0.6), HAT_INK, 2);
  o.drawImage(art, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(out, Math.round(m.e), Math.round(m.f));
  ctx.restore();
}

/** Papagaio-verdadeiro: green, blue forehead, yellow face, red wing patch. */
export function drawParrot(ctx: Ctx, x: number, y: number, t: number, front: boolean) {
  const hop = Math.abs(Math.sin(t * 3)) * 1.2;
  const g = tone('#3a9a4a');
  ctx.save();
  ctx.translate(x, y - hop);
  const tail: P[] = [
    [-1.6, 1],
    [-5.4, 11],
    [-3.6, 11.6],
    [0.4, 3],
  ];
  ctx.beginPath();
  smoothClosed(ctx, tail, 0.6);
  ctx.fillStyle = mix(g.base, '#1f5a8a', 0.35);
  ctx.fill();
  const body: P[] = [
    [0.2, -9],
    [3.4, -6.4],
    [3.2, -0.6],
    [0.4, 3.6],
    [-2.6, 1],
    [-2.6, -5.6],
  ];
  ctx.beginPath();
  smoothClosed(ctx, body, 1);
  const bg = ctx.createLinearGradient(-3, 0, 3.5, 0);
  bg.addColorStop(0, g.hi);
  bg.addColorStop(0.5, g.base);
  bg.addColorStop(1, g.lo);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = g.line;
  ctx.lineWidth = 0.4;
  ctx.stroke();
  // Wing with scalloped feathers + red patch
  const wing: P[] = [
    [-2.2, -5],
    [1.4, -4],
    [1.6, 1],
    [-1.4, 3],
    [-2.8, 0],
  ];
  ctx.beginPath();
  smoothClosed(ctx, wing, 0.9);
  ctx.fillStyle = g.lo;
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-1 + i * 0.3, -2 + i * 1.6, 1.4, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = rgba(g.deep, 0.7);
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  glow(ctx, -0.6, -4.2, 1.2, 0.8, '#d8342c', 0.95);
  glow(ctx, -1.4, 2.4, 1.3, 0.8, '#2f6fb8', 0.8);
  // Head: blue forehead, yellow face, eye ring, hooked beak
  ctx.beginPath();
  ctx.arc(1.6, -10.2, 3.4, 0, TAU);
  ctx.fillStyle = g.base;
  ctx.fill();
  ctx.strokeStyle = g.line;
  ctx.lineWidth = 0.4;
  ctx.stroke();
  glow(ctx, 1.4, -12.6, 2.2, 1.2, '#4a86d0', 0.95);
  glow(ctx, 2.8, -9.4, 1.8, 1.6, '#f2cc3a', 0.95);
  ctx.beginPath();
  ctx.arc(2.6, -10.6, 0.9, 0, TAU);
  ctx.fillStyle = '#f7f1ea';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2.8, -10.6, 0.5, 0, TAU);
  ctx.fillStyle = '#1b1210';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(front ? 4.4 : 4, -11);
  ctx.quadraticCurveTo(7, -10.6, 5.4, -7.8);
  ctx.quadraticCurveTo(4.6, -8.8, 4.2, -8.8);
  ctx.closePath();
  ctx.fillStyle = '#4a4550';
  ctx.fill();
  ctx.restore();
}

const EMOTE_WORDS: Record<EmoteKind, string> = { oi: 'Oi!', dancar: '♪ ♫', rir: 'Kkkk!', valeu: 'Valeu!', desculpa: 'Desculpa!' };

function drawEmoteTag(ctx: Ctx, x: number, y: number, kind: EmoteKind, age: number) {
  const a = Math.min(1, age * 6) * Math.min(1, (2.6 - age) * 3);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.font = `800 13px Nunito, system-ui, sans-serif`;
  const w = ctx.measureText(EMOTE_WORDS[kind]).width + 16;
  const yy = y - Math.min(1, age * 4) * 6;
  rrect(ctx, x - w / 2, yy - 12, w, 22, 11, '#fff6e6', '#2a2233', 1.5);
  ctx.fillStyle = '#2a2233';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(EMOTE_WORDS[kind], x, yy);
  ctx.restore();
}

/** Standalone preview renderer (creator, shop, portraits). */
export function renderAvatarPreview(
  canvas: HTMLCanvasElement,
  a: Appearance,
  hat: string | null,
  parrot: boolean,
  t: number,
  opts: { scale?: number; dir?: Dir; emote?: EmoteKind | null; emoteT0?: number; footY?: number; npc?: NpcId; light?: Light } = {},
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const s = opts.scale ?? 2.4;
  ctx.save();
  ctx.translate(w / 2, opts.footY ?? h - 16);
  ctx.scale(s, s);
  drawAvatar(ctx, 0, 0, a, hat, parrot, {
    dir: opts.dir ?? 'SE',
    t,
    moving: false,
    sitting: false,
    emote: opts.emote ? { kind: opts.emote, t0: opts.emoteT0 ?? 0 } : null,
    npc: opts.npc,
    light: opts.light,
  });
  ctx.restore();
}
