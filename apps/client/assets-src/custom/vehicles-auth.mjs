// Authored vehicles (art1): fusca (beetle) and moto (motoboy with a delivery box). The LimeZu pack has neither.
// Drawn with masks + the pack's edge lighting (light from the upper left) and the pack palette only. Facing east; west is a mirror.
import { blank, setPx, hexPx, C, K, rect, hline, vline, dot, drawShaded, newMask, fillMask, ellipse, union, rectP, minus, outlineAround } from './kit.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';

function disc(img, cx, cy, r, hex) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) setPx(img, x, y, hexPx(hex));
  }
}

function wheel(img, cx, cy, r, phase = 0) {
  disc(img, cx, cy, r, C.navy);
  disc(img, cx, cy, r - 1.4, C.navy2);
  disc(img, cx, cy, r - 3, C.slate2);
  disc(img, cx, cy, r - 4, C.slate);
  const pts = phase ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
  for (const [dx, dy] of pts) setPx(img, Math.floor(cx) + (dx > 0 ? 0 : -1), Math.floor(cy) + (dy > 0 ? 0 : -1), hexPx(C.lav3));
}

// ------------------------------------------------------------------ fusca
function fuscaFrame(phase) {
  const W = 56, H = 34;
  const img = blank(W, H);
  const yl = [C.y4, C.y3, C.y2, C.y1]; // fusca amarelo
  const inMask = (m) => (x, y) => m.a[Math.floor(y) * W + Math.floor(x)] === 1;
  const low = newMask(W, H);
  fillMask(low, union(ellipse(28, 23.6, 26, 5.4), ellipse(45, 22.2, 10.5, 5.2), ellipse(10, 22.6, 9, 5.6)));
  const dome = newMask(W, H);
  fillMask(dome, minus(ellipse(27, 20, 13.8, 12.4), rectP(0, 20, W, H)));
  const body = newMask(W, H);
  fillMask(body, union(inMask(low), inMask(dome)));
  // wheel arches go in before the body so the fenders overlap the tyres
  drawShaded(img, body, 0, 0, yl, { rimLit: 1, rimShade: 3 });
  const glass = (pred) => {
    const g = newMask(W, H);
    fillMask(g, (x, y) => pred(x, y) && inMask(dome)(x, y));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g.a[y * W + x]) continue;
      const n = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && g.a[yy * W + xx]; };
      if ((n(-1, 0) || n(1, 0) || n(0, -1) || n(0, 1)) && body.a[y * W + x]) setPx(img, x, y, hexPx(C.navy2));
    }
    drawShaded(img, g, 0, 0, ['#8fa1c8', '#a4bbd5', '#bad2e0', '#e2f2f3'], { rimLit: 1, rimShade: 1, outline: false });
  };
  glass((x, y) => x >= 35 && x < 40.5 && y >= 12 && y < 19);
  glass((x, y) => x >= 22 && x < 34 && y >= 11.5 && y < 19);
  glass((x, y) => x >= 14.5 && x < 21 && y >= 12.5 && y < 19);
  vline(img, 22, 19, 8, C.y4);
  dot(img, 31, 20, C.lav4); dot(img, 30, 20, C.y4);
  hline(img, 6, 27, 40, C.y4);
  disc(img, 52, 20.5, 2, C.navy); disc(img, 52, 20.5, 1.3, C.lav4); dot(img, 52, 20, C.white);
  rect(img, 50, 26, 6, 1, C.lav2); hline(img, 50, 27, 6, C.mist);
  rect(img, 0, 25, 5, 1, C.lav2); hline(img, 0, 26, 5, C.mist);
  dot(img, 2, 22, C.r2); dot(img, 2, 23, C.r4);
  for (const cx of [14, 43]) { disc(img, cx, 27, 5.8, C.navy); wheel(img, cx, 27.6, 4.6, phase); }
  return img;
}

export async function fusca() {
  const f = [fuscaFrame(0), fuscaFrame(1)];
  const meta = { footprint: [3, 1], shadow: 'fx/shadow_48' };
  return [
    { key: 'vehicles/fusca_e', frames: f, fps: 8, anchor: [28, 31], meta },
    { key: 'vehicles/fusca_w', frames: f.map(flipH), fps: 8, anchor: [27, 31], meta },
  ];
}

// ------------------------------------------------------------------ moto
function motoFrame(phase) {
  const W = 34, H = 26;
  const img = blank(W, H);
  const line = (x0, y0, x1, y1, hex) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) dot(img, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), hex);
  };
  // wheels first, the bike is drawn over them
  wheel(img, 8, 20, 4.5, phase); wheel(img, 25, 20, 4.5, phase);
  // frame: swing arm, engine block, exhaust, fork
  line(8, 19, 14, 15, C.slate2); line(8, 20, 14, 16, C.slate);
  rect(img, 12, 13, 8, 5, C.slate2); hline(img, 12, 13, 8, C.mist); rect(img, 13, 16, 6, 2, C.slate); hline(img, 12, 17, 8, C.navy2);
  line(12, 17, 4, 18, C.mist2); line(12, 18, 4, 19, C.slate);
  line(25, 20, 22, 9, C.mist2); line(26, 20, 23, 9, C.slate2);
  // fender over the front wheel
  hline(img, 22, 14, 6, C.slate2); hline(img, 23, 13, 4, C.mist);
  // tank + seat
  const tank = newMask(12, 6); fillMask(tank, ellipse(6, 3, 5.6, 2.8));
  drawShaded(img, tank, 12, 8, [C.r5, C.r3, C.r2, C.r0], { rimShade: 2 });
  rect(img, 6, 11, 8, 2, C.navy2); hline(img, 6, 11, 8, C.slate);
  // headlight + handlebar
  line(21, 9, 25, 8, C.navy2);
  rect(img, 26, 10, 3, 3, C.y1); dot(img, 28, 11, C.white); vline(img, 29, 10, 3, C.navy);
  // delivery box (bau): red with a mustard band, sits on the rear rack
  rect(img, 0, 3, 10, 9, C.r3); rect(img, 0, 3, 10, 1, C.r1); vline(img, 0, 3, 9, C.r1); vline(img, 9, 4, 8, C.r5); hline(img, 0, 11, 10, C.r5);
  rect(img, 1, 6, 8, 2, C.y3); hline(img, 1, 6, 8, C.y1);
  outlineAround(img);
  hline(img, 2, 13, 6, C.slate);
  // rider: leg, jacket, arm, helmet
  rect(img, 12, 9, 4, 5, C.b4); vline(img, 12, 9, 5, C.b3); rect(img, 15, 13, 4, 2, C.b4); hline(img, 17, 15, 3, C.navy);
  const torso = newMask(9, 8); fillMask(torso, ellipse(4.5, 4, 3.6, 3.8));
  drawShaded(img, torso, 11, 1, [C.y4, C.y3, C.y2, C.y1], { rimShade: 2 });
  line(17, 5, 21, 7, C.y3); line(17, 6, 21, 8, C.y4); dot(img, 22, 8, C.navy2);
  const helm = newMask(7, 7); fillMask(helm, ellipse(3.5, 3.5, 3.4, 3.2));
  drawShaded(img, helm, 15, 0, [C.r5, C.r3, C.r2, C.r0], { rimShade: 2 });
  rect(img, 19, 2, 3, 2, C.navy); dot(img, 19, 2, C.b1);
  return img;
}

export async function moto() {
  const f = [motoFrame(0), motoFrame(1)];
  const meta = { footprint: [2, 1], shadow: 'fx/shadow_32' };
  return [
    { key: 'vehicles/moto_e', frames: f, fps: 10, anchor: [17, 23], meta },
    { key: 'vehicles/moto_w', frames: f.map(flipH), fps: 10, anchor: [16, 23], meta },
  ];
}
