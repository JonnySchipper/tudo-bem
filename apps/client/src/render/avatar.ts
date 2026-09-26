import { CLOTH_COLORS, HAIR_COLORS, SHOE_COLORS, SKIN_TONES, hatById, type Appearance, type Dir, type EmoteKind, type HatDef } from '@tudobem/shared';
import { circle, ellipse, rrect, shade, shadow, type Ctx } from './draw';

export interface AvatarPose {
  dir: Dir;
  t: number;
  moving: boolean;
  sitting: boolean;
  emote?: { kind: EmoteKind; t0: number } | null;
  /** Seed so avatars don't bob in sync. */
  seed?: number;
}

const BODY_W = { esguio: 16, medio: 20, forte: 25 } as const;
/** Brimmed hats keep the old, larger head size so the hat is the avatar's silhouette hero; snug caps hug the head. */
const HAT_R = 11.5;
const SNUG_HATS = new Set<HatDef['shape']>(['bone', 'viseira', 'gorro', 'capacete']);
const OUTLINE = 'rgba(42,26,40,0.6)';

/** Stroke a segment with a dark outline underneath, for a clean cartoon silhouette. */
function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w + 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawAvatar(ctx: Ctx, x: number, y: number, a: Appearance, hatId: string | null, parrot: boolean, pose: AvatarPose) {
  const skin = SKIN_TONES[a.skin] ?? SKIN_TONES[3];
  const hair = HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0];
  const top = CLOTH_COLORS[a.topColor] ?? CLOTH_COLORS[0];
  const bottom = CLOTH_COLORS[a.bottomColor] ?? CLOTH_COLORS[2];
  const shoe = SHOE_COLORS[a.shoes] ?? SHOE_COLORS[0];
  const bw = BODY_W[a.body] ?? 20;
  const front = pose.dir === 'SE' || pose.dir === 'SW';
  const flip = pose.dir === 'SW' || pose.dir === 'NW';
  const t = pose.t + (pose.seed ?? 0);
  const emoteAge = pose.emote ? pose.t - pose.emote.t0 : 99;
  const emote = pose.emote && emoteAge < 2.6 ? pose.emote.kind : null;

  const phase = t * 11;
  const walk = pose.moving ? Math.sin(phase) : 0;
  let bob = pose.moving ? -Math.abs(Math.sin(phase)) * 2.2 : Math.sin(t * 2) * 0.6;
  let sway = 0;
  if (emote === 'dancar') {
    bob = -Math.abs(Math.sin(emoteAge * 9)) * 6;
    sway = Math.sin(emoteAge * 9) * 3;
  }
  if (emote === 'rir') sway = Math.sin(emoteAge * 30) * 1.2;
  const sitDrop = pose.sitting ? 13 : 0;

  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 0, bw * 0.8 + 4, 7);
  if (flip) ctx.scale(-1, 1);
  ctx.translate(sway, bob + sitDrop);

  // Grown-up proportions (head ≈ ¼ of height, not chibi ⅓).
  const hipY = -27;
  const shoulderY = -54;
  const headY = -66;
  const headR = 9.8;
  const legW = a.body === 'forte' ? 8 : 7;
  const legX = bw / 2 - legW / 2 - 1;

  // ---- back hair layer
  if (a.hair === 'black') circle(ctx, 0, headY - 3, headR * 1.5, hair);
  if (a.hair === 'longo') rrect(ctx, -headR - 1, headY - 4, headR * 2 + 2, 26, 8, shade(hair, -0.1));
  if (a.hair === 'trancas' && !front) {
    ctx.strokeStyle = hair;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 7, headY);
      ctx.lineTo(s * 8, headY + 26);
      ctx.stroke();
    }
  }

  // ---- legs
  const legColor = a.bottom === 'calca' ? bottom : skin;
  const drawLeg = (lx: number, swing: number) => {
    if (pose.sitting) {
      // Thigh forward (toward facing side), shin down.
      const kneeX = lx + (front ? 3 : 2) + 9;
      limb(ctx, lx, hipY + 2, kneeX, hipY + 5, legW, a.bottom === 'saia' ? skin : bottom);
      limb(ctx, kneeX, hipY + 5, kneeX + 1, -sitDrop - 2, legW, legColor);
      ellipse(ctx, kneeX + 3, -sitDrop - 1, 6, 3.8, OUTLINE);
      ellipse(ctx, kneeX + 3, -sitDrop - 1, 5, 3, shoe);
      return;
    }
    const footX = lx + swing * 4;
    const lift = swing > 0 ? swing * 2 : 0;
    ctx.lineCap = 'round';
    if (a.bottom === 'bermuda') {
      limb(ctx, lx + swing * 1.5, hipY + 10, footX, -3 - lift, legW - 1, skin);
      limb(ctx, lx, hipY + 1, lx + swing * 1.5, hipY + 11, legW + 1, bottom);
    } else {
      limb(ctx, lx, hipY + 1, footX, -3 - lift, legW, legColor);
    }
    ellipse(ctx, footX + 1.5, -2 - lift, 6, 3.8, OUTLINE);
    ellipse(ctx, footX + 1.5, -2 - lift, 5, 3, shoe);
    ellipse(ctx, footX + 1.5, -3 - lift, 3.5, 1.2, 'rgba(255,255,255,0.35)');
  };
  drawLeg(-legX, walk);
  drawLeg(legX, -walk);

  // ---- arms (behind torso when seen from the back)
  const armSwing = pose.moving ? Math.sin(phase + Math.PI) * 0.5 : 0;
  const sleeveLong = a.top === 'moletom' || a.top === 'camisa';
  const noSleeve = a.top === 'regata';
  const drawArm = (side: -1 | 1) => {
    const sx = side * (bw / 2 + 1);
    const sy = shoulderY + 4;
    let ang = Math.PI / 2 + side * 0.18 + (side === 1 ? armSwing : -armSwing);
    let len = 22;
    if (emote === 'oi' && side === 1) ang = -Math.PI / 2 + 0.35 + Math.sin(emoteAge * 14) * 0.45;
    if (emote === 'dancar') ang = -Math.PI / 2 + side * (0.5 + Math.sin(emoteAge * 9 + (side === 1 ? 0 : Math.PI)) * 0.35);
    if (emote === 'valeu' && side === 1) {
      ang = -Math.PI / 4;
      len = 17;
    }
    if (emote === 'desculpa') {
      ang = Math.PI / 2 - side * 0.9;
      len = 15;
    }
    if (emote === 'rir' && side === 1) ang = Math.PI / 2 - 0.9;
    if (pose.sitting && !emote) ang = Math.PI / 2 - side * 0.1 - 0.35;
    const hx = sx + Math.cos(ang) * len;
    const hy = sy + Math.sin(ang) * len;
    limb(ctx, sx, sy, hx, hy, 6, sleeveLong ? top : skin);
    if (!sleeveLong && !noSleeve) {
      ctx.strokeStyle = top;
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * 7, sy + Math.sin(ang) * 7);
      ctx.stroke();
    }
    circle(ctx, hx, hy, 3.6, skin, OUTLINE, 1);
    if (emote === 'valeu' && side === 1) {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx, hy - 6);
      ctx.stroke();
    }
  };
  if (!front) {
    drawArm(-1);
    drawArm(1);
  }

  // ---- torso
  if (a.bottom === 'saia') {
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 1, hipY - 3);
    ctx.lineTo(bw / 2 - 1, hipY - 3);
    ctx.lineTo(bw / 2 + 5, hipY + 12);
    ctx.lineTo(-bw / 2 - 5, hipY + 12);
    ctx.closePath();
    ctx.fillStyle = bottom;
    ctx.fill();
  } else {
    rrect(ctx, -bw / 2, hipY - 4, bw, 8, 3, bottom);
  }
  rrect(ctx, -bw / 2, shoulderY, bw, hipY - shoulderY, [9, 9, 4, 4], top, OUTLINE, 1.2);
  rrect(ctx, -bw / 2 + 3, shoulderY + 2, 3, hipY - shoulderY - 6, 2, 'rgba(255,255,255,0.18)');
  // Torso shading on the far side
  rrect(ctx, bw / 2 - 5, shoulderY + 3, 4, hipY - shoulderY - 5, 2, 'rgba(0,0,0,0.12)');
  if (noSleeve) {
    circle(ctx, -bw / 2 + 1, shoulderY + 4, 3.5, skin);
    circle(ctx, bw / 2 - 1, shoulderY + 4, 3.5, skin);
  }
  if (front) {
    if (a.top === 'camisa') {
      ctx.fillStyle = shade(top, 0.35);
      ctx.beginPath();
      ctx.moveTo(-5, shoulderY);
      ctx.lineTo(0, shoulderY + 6);
      ctx.lineTo(5, shoulderY);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3; i++) circle(ctx, 0.5, shoulderY + 10 + i * 5, 1, shade(top, -0.4));
    } else if (a.top === 'moletom') {
      rrect(ctx, -bw / 2 + 4, hipY - 11, bw - 8, 7, 3, shade(top, -0.15));
      ctx.strokeStyle = shade(top, 0.4);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-3, shoulderY + 2);
      ctx.lineTo(-3, shoulderY + 10);
      ctx.moveTo(3, shoulderY + 2);
      ctx.lineTo(3, shoulderY + 10);
      ctx.stroke();
    } else {
      ctx.strokeStyle = shade(top, -0.25);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, shoulderY, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else if (a.top === 'moletom') {
    rrect(ctx, -8, shoulderY - 2, 16, 8, 5, shade(top, -0.12));
  }

  if (front) {
    drawArm(-1);
    drawArm(1);
  }

  // ---- neck + head
  rrect(ctx, -3.2, headY + 7, 6.4, shoulderY - headY - 5, 2, shade(skin, -0.08));
  circle(ctx, 0, headY, headR, skin, OUTLINE, 1.2);
  ellipse(ctx, -4, headY - 5, 4, 2.5, 'rgba(255,255,255,0.18)');
  circle(ctx, -headR + 0.5, headY + 1, 2.6, shade(skin, -0.06));
  circle(ctx, headR - 0.5, headY + 1, 2.6, shade(skin, -0.06));

  if (front) {
    const fx = 2;
    const blink = Math.sin(t * 1.3) > 0.985;
    ctx.fillStyle = '#231a1f';
    if (blink) {
      ctx.fillRect(fx - 5.5, headY - 0.5, 3.5, 1.2);
      ctx.fillRect(fx + 2, headY - 0.5, 3.5, 1.2);
    } else {
      ellipse(ctx, fx - 3.8, headY, 1.7, 2.3, '#231a1f');
      ellipse(ctx, fx + 3.8, headY, 1.7, 2.3, '#231a1f');
      circle(ctx, fx - 3.3, headY - 0.9, 0.6, '#fff');
      circle(ctx, fx + 4.3, headY - 0.9, 0.6, '#fff');
    }
    ctx.strokeStyle = shade(hair, 0.05);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(fx - 5.6, headY - 4.4);
    ctx.lineTo(fx - 2, headY - 5);
    ctx.moveTo(fx + 2, headY - 5);
    ctx.lineTo(fx + 5.6, headY - 4.4);
    ctx.stroke();
    ellipse(ctx, fx - 5.6, headY + 3.2, 1.9, 1.1, 'rgba(232,110,110,0.3)');
    ellipse(ctx, fx + 5.6, headY + 3.2, 1.9, 1.1, 'rgba(232,110,110,0.3)');
    ctx.strokeStyle = '#7a3b2e';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (emote === 'rir' || emote === 'oi' || emote === 'dancar') {
      ctx.fillStyle = '#7a2e2e';
      ctx.arc(fx, headY + 3.6, 3, 0, Math.PI);
      ctx.fill();
    } else if (emote === 'desculpa') {
      ctx.arc(fx, headY + 5.8, 2.2, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.arc(fx, headY + 3.2, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  drawHair(ctx, a.hair, hair, headY, headR, front);
  const hat = hatById(hatId);
  if (hat) {
    const hr = SNUG_HATS.has(hat.shape) ? headR + 0.8 : HAT_R;
    drawHat(ctx, hat, headY + hr - headR, hr, front, t);
  }
  if (parrot) drawParrot(ctx, bw / 2 + 1, shoulderY - 2, t, front);

  ctx.restore();

  if (emote) drawEmoteTag(ctx, x, y - 104 + (pose.sitting ? 13 : 0), emote, emoteAge);
}

function drawHair(ctx: Ctx, style: Appearance['hair'], color: string, hy: number, r: number, front: boolean) {
  ctx.fillStyle = color;
  const cap = (depth: number) => {
    ctx.beginPath();
    ctx.arc(0, hy, r + 1.2, Math.PI, 0);
    ctx.lineTo(r + 1.2, hy - depth);
    ctx.quadraticCurveTo(0, hy - r * 0.35, -r - 1.2, hy - depth);
    ctx.closePath();
    ctx.fill();
  };
  if (!front && style !== 'raspado') {
    circle(ctx, 0, hy - 0.5, r + 1.2, color);
  }
  switch (style) {
    case 'raspado':
      ctx.globalAlpha = 0.55;
      cap(1);
      ctx.globalAlpha = 1;
      break;
    case 'curto':
      cap(-2);
      ctx.beginPath();
      ctx.moveTo(-r, hy - 3);
      ctx.quadraticCurveTo(-2, hy - r - 6, r + 1, hy - 5);
      ctx.lineTo(r + 1, hy - 2);
      ctx.quadraticCurveTo(0, hy - 6, -r, hy - 1);
      ctx.fill();
      break;
    case 'cacheado':
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI + (i / 8) * Math.PI;
        circle(ctx, Math.cos(ang) * (r + 0.5), hy + Math.sin(ang) * (r + 0.5) - 1, 4.4, color);
      }
      circle(ctx, -3, hy - r - 2, 4.2, color);
      circle(ctx, 4, hy - r - 2, 4.2, color);
      circle(ctx, -r - 1, hy + 3, 3.6, color);
      circle(ctx, r + 1, hy + 3, 3.6, color);
      break;
    case 'black':
      if (front) {
        ctx.beginPath();
        ctx.arc(0, hy - 3, r * 1.5, Math.PI * 1.05, Math.PI * 1.95);
        ctx.quadraticCurveTo(0, hy - 8, -r * 1.45, hy - 7);
        ctx.fill();
      }
      break;
    case 'longo':
      cap(-1);
      if (front) {
        rrect(ctx, -r - 2, hy - 4, 5, 22, 3, color);
        rrect(ctx, r - 3, hy - 4, 5, 22, 3, color);
      }
      break;
    case 'coque':
      cap(-1);
      circle(ctx, 0, hy - r - 4, 5.5, color);
      circle(ctx, -1.5, hy - r - 5.5, 1.8, shade(color, 0.2));
      break;
    case 'trancas':
      cap(0);
      if (front) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * (r - 1), hy);
          ctx.lineTo(s * (r + 1), hy + 22);
          ctx.stroke();
          circle(ctx, s * (r + 1), hy + 23, 2.4, '#f2c230');
        }
      }
      break;
  }
}

export function drawHat(ctx: Ctx, hat: HatDef, hy: number, r: number, front: boolean, t = 0) {
  const top = hy - r;
  const c = hat.color;
  const acc = hat.accent;
  const fwd = front ? 1 : -1;
  switch (hat.shape) {
    case 'bone': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, top + 6, r + 1.5, r * 0.8, 0, Math.PI, 0);
      ctx.fill();
      ellipse(ctx, fwd * 8, top + 6, 11, 3.2, shade(c, -0.2));
      circle(ctx, 0, top - 3.2, 1.8, acc);
      rrect(ctx, -6, top + 0, 12, 3, 1.5, acc);
      break;
    }
    case 'palha': {
      ellipse(ctx, 0, top + 6, 20, 5.5, c);
      ellipse(ctx, 0, top + 6, 20, 5.5, 'rgba(120,80,20,0.12)');
      rrect(ctx, -9, top - 6, 18, 12, [8, 8, 2, 2], shade(c, 0.05));
      rrect(ctx, -9, top + 1, 18, 3, 1, acc);
      ctx.strokeStyle = 'rgba(120,80,20,0.35)';
      ctx.lineWidth = 0.8;
      for (let i = -16; i <= 16; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, top + 3);
        ctx.lineTo(i * 1.15, top + 9);
        ctx.stroke();
      }
      break;
    }
    case 'gorro': {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, top + 7, r + 2, r + 2, 0, Math.PI, 0);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = c;
      ctx.fillRect(-r - 3, top - 8, 2 * r + 6, 16);
      ctx.fillStyle = acc;
      for (let i = 0; i < 3; i++) ctx.fillRect(-r - 3, top - 5 + i * 5, 2 * r + 6, 2);
      ctx.restore();
      rrect(ctx, -r - 2, top + 3, 2 * r + 4, 5, 2, shade(c, -0.2));
      circle(ctx, 0, top - 7, 4, acc);
      break;
    }
    case 'viseira': {
      rrect(ctx, -r - 1, top + 3, 2 * r + 2, 5, 2, c);
      ellipse(ctx, fwd * 9, top + 7, 10, 3, shade(c, -0.15));
      rrect(ctx, -3, top + 4, 6, 2.5, 1, acc);
      break;
    }
    case 'boina': {
      ctx.save();
      ctx.translate(0, top + 1);
      ctx.rotate(fwd * -0.18);
      ellipse(ctx, 0, 0, r + 4, 5.5, c);
      ellipse(ctx, 0, 2, r + 1, 3, shade(c, -0.25));
      rrect(ctx, -1, -8, 2, 4, 1, acc);
      ctx.restore();
      break;
    }
    case 'sol': {
      const wob = Math.sin(t * 2) * 0.6;
      ellipse(ctx, 0, top + 6 + wob, 23, 6.5, c);
      ctx.fillStyle = shade(c, -0.12);
      ctx.beginPath();
      ctx.ellipse(0, top + 5, r + 0.5, r * 0.85, 0, Math.PI, 0);
      ctx.fill();
      rrect(ctx, -r, top + 2, 2 * r, 3.5, 1.5, acc);
      circle(ctx, fwd * (r - 2), top + 3.5, 3, acc);
      break;
    }
    case 'bucket': {
      ctx.fillStyle = shade(c, -0.1);
      ctx.beginPath();
      ctx.moveTo(-r - 7, top + 10);
      ctx.lineTo(r + 7, top + 10);
      ctx.lineTo(r + 2, top + 4);
      ctx.lineTo(-r - 2, top + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-r - 1, top + 5);
      ctx.lineTo(r + 1, top + 5);
      ctx.lineTo(r - 2, top - 5);
      ctx.quadraticCurveTo(0, top - 8, -r + 2, top - 5);
      ctx.closePath();
      ctx.fill();
      rrect(ctx, -r - 1, top + 2, 2 * r + 2, 2.5, 1, acc);
      break;
    }
    case 'capacete': {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, top + 6, r + 3, r + 1, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = acc;
      for (let i = -1; i <= 1; i++) rrect(ctx, i * 5 - 1.5, top - 3, 3, 8, 1.5, acc);
      ellipse(ctx, fwd * 10, top + 6, 5, 2, shade(c, -0.25));
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r, top + 7);
      ctx.lineTo(-r + 2, hy + 9);
      ctx.moveTo(r, top + 7);
      ctx.lineTo(r - 2, hy + 9);
      ctx.stroke();
      break;
    }
    case 'panama': {
      ellipse(ctx, 0, top + 6, 18, 4.8, c);
      rrect(ctx, -9, top - 6, 18, 12, [5, 5, 1, 1], shade(c, 0.05));
      ctx.fillStyle = shade(c, -0.12);
      ctx.beginPath();
      ctx.moveTo(-4, top - 6);
      ctx.lineTo(0, top - 3);
      ctx.lineTo(4, top - 6);
      ctx.fill();
      rrect(ctx, -9, top + 1, 18, 3.2, 1, acc);
      break;
    }
    case 'flores': {
      const colors = [c, acc, '#e889a8', '#ffffff', '#7a4fb0'];
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI + (i / 8) * Math.PI;
        const fx = Math.cos(ang) * (r + 1);
        const fy = top + 5 + Math.sin(ang) * 5;
        const col = colors[i % colors.length];
        for (let p = 0; p < 5; p++) circle(ctx, fx + Math.cos((p / 5) * Math.PI * 2) * 2.2, fy + Math.sin((p / 5) * Math.PI * 2) * 2.2, 1.9, col);
        circle(ctx, fx, fy, 1.3, '#f2c230');
      }
      ctx.fillStyle = '#2e9e5b';
      ellipse(ctx, -r - 2, top + 8, 3, 1.4, '#2e9e5b');
      ellipse(ctx, r + 2, top + 8, 3, 1.4, '#2e9e5b');
      break;
    }
    case 'chef': {
      rrect(ctx, -r + 1, top - 2, 2 * r - 2, 8, 2, c, acc, 1);
      circle(ctx, -6, top - 8, 6.5, c);
      circle(ctx, 6, top - 8, 6.5, c);
      circle(ctx, 0, top - 12, 7.5, c);
      ctx.strokeStyle = acc;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, top - 12, 7.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      break;
    }
    case 'cartola': {
      ellipse(ctx, 0, top + 5, 15, 4, shade(c, -0.25));
      rrect(ctx, -9, top - 17, 18, 22, 2, c);
      ellipse(ctx, 0, top - 17, 9, 2.4, shade(c, 0.15));
      rrect(ctx, -9, top - 2, 18, 4, 1, acc);
      const sp = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255,240,150,${0.5 + sp * 0.5})`;
      star(ctx, fwd * 12, top - 16, 3 + sp);
      break;
    }
  }
}

function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.35 : r;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawParrot(ctx: Ctx, x: number, y: number, t: number, front: boolean) {
  const hop = Math.abs(Math.sin(t * 3)) * 1.5;
  ctx.save();
  ctx.translate(x + 2, y - hop);
  ctx.fillStyle = '#1f8a3a';
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(-6, 13);
  ctx.lineTo(0, 5);
  ctx.fill();
  ellipse(ctx, 0, -3, 5, 7, '#2fb350');
  ellipse(ctx, -1.5, -2, 3, 5, '#1f8a3a');
  circle(ctx, 1.5, -11, 4.5, '#3fcf60');
  ellipse(ctx, 2, -9, 2, 1.5, '#f2c230');
  ctx.fillStyle = '#f08a24';
  ctx.beginPath();
  ctx.moveTo(front ? 5 : 4, -12);
  ctx.quadraticCurveTo(9, -11, 5.5, -8);
  ctx.closePath();
  ctx.fill();
  circle(ctx, 3, -12.5, 1.1, '#111');
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
export function renderAvatarPreview(canvas: HTMLCanvasElement, a: Appearance, hat: string | null, parrot: boolean, t: number, opts: { scale?: number; dir?: Dir; emote?: EmoteKind | null; emoteT0?: number; footY?: number } = {}) {
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
  });
  ctx.restore();
}
