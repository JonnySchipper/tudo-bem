import { furnitureById, type Dir, type FurnitureDef, type PropDef } from '@tudobem/shared';
import { box, circle, diamond, ellipse, FONT_BODY, FONT_TITLE, iso, poly, rrect, shade, shadow, type Ctx } from './draw';

function label(ctx: Ctx, text: string, x: number, y: number, bg: string, fg = '#fff', size = 9) {
  ctx.font = `800 ${size}px ${FONT_BODY}`;
  const w = ctx.measureText(text).width + 10;
  rrect(ctx, x - w / 2, y - size, w, size * 1.9, 4, bg);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - size * 0.05);
}

function ipe(ctx: Ctx, cx: number, cy: number, t: number) {
  shadow(ctx, cx, cy, 34, 14, 0.25);
  box(ctx, cx, cy, 0.18, 0.18, 70, '#6b4a2e');
  ctx.strokeStyle = '#6b4a2e';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 60);
  ctx.lineTo(cx - 18, cy - 88);
  ctx.moveTo(cx, cy - 64);
  ctx.lineTo(cx + 16, cy - 92);
  ctx.stroke();
  const sway = Math.sin(t * 0.8) * 1.5;
  const blobs: [number, number, number, string][] = [
    [-22, -96, 22, '#e0a80d'],
    [20, -100, 22, '#e0a80d'],
    [0, -118, 26, '#f2c230'],
    [-26, -112, 17, '#f5cf3f'],
    [26, -116, 18, '#f5cf3f'],
    [-6, -95, 20, '#f2c230'],
    [10, -132, 16, '#ffd95a'],
    [-14, -128, 15, '#ffdf6e'],
  ];
  for (const [dx, dy, r, c] of blobs) circle(ctx, cx + dx + sway, cy + dy, r, c);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39;
    circle(ctx, cx + Math.cos(a) * (8 + (i % 5) * 5) + sway, cy - 110 + Math.sin(a) * (6 + (i % 4) * 5), 2, '#fff1a8');
  }
}

function palmeira(ctx: Ctx, cx: number, cy: number, t: number) {
  shadow(ctx, cx, cy, 24, 10);
  ctx.strokeStyle = '#8a6a44';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 2);
  ctx.quadraticCurveTo(cx + 10, cy - 60, cx + 4, cy - 120);
  ctx.stroke();
  const sway = Math.sin(t * 0.9) * 0.08;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.55 + sway;
    ctx.save();
    ctx.translate(cx + 4, cy - 122);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 ? '#2e8a4a' : '#3aa65a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(12, -24, 0, -48);
    ctx.quadraticCurveTo(-10, -24, 0, 0);
    ctx.fill();
    ctx.restore();
  }
}

function banco(ctx: Ctx, cx: number, cy: number, dir: Dir) {
  shadow(ctx, cx, cy, 26, 10, 0.18);
  const alongX = dir === 'SW' || dir === 'NE';
  const ex = alongX ? 0.85 : 0.4;
  const ey = alongX ? 0.4 : 0.85;
  box(ctx, cx, cy, ex * 0.9, ey * 0.9, 12, '#9a9a9a');
  box(ctx, cx, cy, ex, ey, 4, '#b5703a', 12);
  // Backrest on the side opposite the facing direction
  const back: Record<Dir, [number, number]> = { SE: [-0.2, 0], SW: [0, -0.2], NE: [0, 0.2], NW: [0.2, 0] };
  const [bx, by] = iso(...back[dir]);
  box(ctx, cx + bx, cy + by, alongX ? 0.85 : 0.08, alongX ? 0.08 : 0.85, 16, '#a8622f', 18);
}

function poste(ctx: Ctx, cx: number, cy: number, t: number) {
  shadow(ctx, cx, cy, 10, 4);
  box(ctx, cx, cy, 0.14, 0.14, 8, '#2f4a3a');
  rrect(ctx, cx - 2, cy - 110, 4, 104, 2, '#2f4a3a');
  rrect(ctx, cx - 9, cy - 124, 18, 14, 4, '#2f4a3a');
  const glow = 0.55 + Math.sin(t * 2) * 0.05;
  const g = ctx.createRadialGradient(cx, cy - 112, 2, cx, cy - 112, 40);
  g.addColorStop(0, `rgba(255,220,140,${glow})`);
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 40, cy - 152, 80, 80);
  circle(ctx, cx, cy - 110, 5, '#ffe7a8');
}

function banca(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 30, 14);
  box(ctx, cx, cy, 0.9, 1.9, 62, '#2e7d4a');
  const top = box(ctx, cx, cy, 1.05, 2.05, 6, '#1f5a35', 62).top;
  // Magazines on the front (+x) face
  for (let i = 0; i < 6; i++) {
    const [ox, oy] = iso(0.45, -0.75 + i * 0.3);
    const colors = ['#e5572f', '#f2c230', '#2b5ba8', '#e889a8', '#3aa6a0', '#fff6e6'];
    poly(ctx, [[cx + ox - 5, cy + oy - 40], [cx + ox + 5, cy + oy - 45], [cx + ox + 5, cy + oy - 25], [cx + ox - 5, cy + oy - 20]], colors[i], 'rgba(0,0,0,0.2)');
  }
  const mid = top[0];
  label(ctx, 'BANCA', (top[0][0] + top[2][0]) / 2, (mid[1] + top[2][1]) / 2 - 6, '#f2c230', '#2a2233', 9);
}

function barracaChapeus(ctx: Ctx, cx: number, cy: number, t: number) {
  // Footprint 2×1 starting at the prop tile; center shifts half a tile along +x.
  const [ox, oy] = iso(0.5, 0);
  const x = cx + ox;
  const y = cy + oy;
  shadow(ctx, x, y, 44, 16);
  box(ctx, x, y, 1.7, 0.7, 30, '#b5703a');
  box(ctx, x, y, 1.8, 0.8, 4, '#8a5428', 30);
  // Hats on the table
  const hats = ['#2e9e5b', '#e2c078', '#c23b4e', '#f2c230', '#2b5ba8'];
  hats.forEach((c, i) => {
    const [hx, hy] = iso(-0.65 + i * 0.32, 0);
    ellipse(ctx, x + hx, y + hy - 36, 8, 3, shade(c, -0.1));
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x + hx, y + hy - 37, 5.5, 6, 0, Math.PI, 0);
    ctx.fill();
  });
  // Poles + striped awning
  for (const s of [-1, 1]) {
    const [px, py] = iso(s * 0.85, -0.35);
    rrect(ctx, x + px - 1.5, y + py - 92, 3, 92, 1, '#6b4a2e');
  }
  const a1 = iso(-0.95, -0.55);
  const a2 = iso(0.95, -0.55);
  const a3 = iso(0.95, 0.5);
  const a4 = iso(-0.95, 0.5);
  const lift = 92 + Math.sin(t * 1.5) * 0.8;
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    const f0 = i / stripes;
    const f1 = (i + 1) / stripes;
    const lerp = (p: [number, number], q: [number, number], f: number): [number, number] => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    const p1 = lerp(a1, a2, f0);
    const p2 = lerp(a1, a2, f1);
    const p3 = lerp(a4, a3, f1);
    const p4 = lerp(a4, a3, f0);
    poly(ctx, [[x + p1[0], y + p1[1] - lift - 8], [x + p2[0], y + p2[1] - lift - 8], [x + p3[0], y + p3[1] - lift + 6], [x + p4[0], y + p4[1] - lift + 6]], i % 2 ? '#fff6e6' : '#e5572f', 'rgba(0,0,0,0.12)');
  }
  // Small hanging sign on the front pole; Nanda's own nameplate names the stall.
  const [sx, sy] = iso(0.85, 0.5);
  label(ctx, 'CHAPÉUS', x + sx, y + sy - 58, '#7a4fb0', '#fff', 8);
}

function quiosque(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 24, 10);
  box(ctx, cx, cy, 0.7, 0.7, 50, '#2b5ba8');
  box(ctx, cx, cy, 0.9, 0.9, 6, '#f2c230', 50);
  const [fx, fy] = iso(0.36, 0);
  poly(ctx, [[cx + fx - 10, cy + fy - 44], [cx + fx + 12, cy + fy - 55], [cx + fx + 12, cy + fy - 25], [cx + fx - 10, cy + fy - 14]], '#fff6e6', '#2a2233');
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 ? '#2e9e5b' : '#c9b99c';
    ctx.fillRect(cx + fx - 6, cy + fy - 40 + i * 8 - i * 1.5, 12, 3);
  }
  label(ctx, 'MISSÕES', cx, cy - 72, '#e5572f', '#fff', 9);
}

function poleiro(ctx: Ctx, cx: number, cy: number, t: number, empty: boolean) {
  shadow(ctx, cx, cy, 14, 6);
  box(ctx, cx, cy, 0.35, 0.35, 5, '#8a8a8a');
  rrect(ctx, cx - 2, cy - 64, 4, 60, 2, '#8a5a2e');
  rrect(ctx, cx - 16, cy - 66, 32, 4, 2, '#6b4a2e');
  ellipse(ctx, cx + 12, cy - 60, 5, 2.5, '#d9d9d9');
  if (!empty) {
    const hop = Math.abs(Math.sin(t * 2.4)) * 3;
    ctx.save();
    ctx.translate(cx - 4, cy - 68 - hop);
    ctx.fillStyle = '#1f8a3a';
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(-8, 16);
    ctx.lineTo(2, 2);
    ctx.fill();
    ellipse(ctx, 0, -6, 6, 9, '#2fb350');
    circle(ctx, 2, -16, 5.5, '#3fcf60');
    ctx.fillStyle = '#f08a24';
    ctx.beginPath();
    ctx.moveTo(6, -18);
    ctx.quadraticCurveTo(11, -16, 7, -12);
    ctx.fill();
    circle(ctx, 4, -17, 1.2, '#111');
    ctx.restore();
  }
  label(ctx, 'PAPAGAIO', cx, cy - 92, '#2e9e5b', '#fff', 8);
}

function canteiro(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 26, 11, 0.15);
  box(ctx, cx, cy, 0.9, 0.9, 16, '#a39a8c');
  diamond(ctx, cx, cy - 16, 0.78, 0.78, '#5a3a24');
  const colors = ['#e5572f', '#f2c230', '#e889a8', '#ffffff', '#7a4fb0'];
  for (let i = 0; i < 10; i++) {
    const [dx, dy] = iso(-0.3 + (i % 4) * 0.2, -0.3 + Math.floor(i / 4) * 0.25);
    circle(ctx, cx + dx, cy + dy - 22, 5, '#3f8a3a');
    circle(ctx, cx + dx, cy + dy - 26, 2.6, colors[i % colors.length]);
  }
}

function lixeira(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 10, 4);
  rrect(ctx, cx - 1.5, cy - 28, 3, 28, 1, '#555');
  rrect(ctx, cx - 9, cy - 46, 18, 22, [3, 3, 8, 8], '#f07a1a');
  ellipse(ctx, cx, cy - 46, 9, 3, '#c55f0e');
  ctx.fillStyle = '#fff6e6';
  ctx.font = `800 6px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText('LIXO', cx, cy - 34);
}

function bicicletario(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 22, 8, 0.15);
  ctx.strokeStyle = '#f07a1a';
  ctx.lineWidth = 2.5;
  for (const dx of [-11, 11]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 11, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 11);
  ctx.lineTo(cx - 2, cy - 24);
  ctx.lineTo(cx + 8, cy - 24);
  ctx.lineTo(cx + 11, cy - 11);
  ctx.moveTo(cx - 2, cy - 24);
  ctx.lineTo(cx, cy - 11);
  ctx.lineTo(cx + 8, cy - 24);
  ctx.stroke();
  rrect(ctx, cx - 6, cy - 28, 8, 3, 1, '#2a2233');
  rrect(ctx, cx + 6, cy - 30, 6, 2, 1, '#2a2233');
}

function balcaoSlice(ctx: Ctx, cx: number, cy: number, i: number, n: number) {
  box(ctx, cx, cy, 1.0, 0.8, 38, '#a8662f', 0, { left: '#b5452e', right: '#8e3620', stroke: 'rgba(0,0,0,0.12)' });
  box(ctx, cx, cy, 1.02, 0.92, 5, '#efe9e1', 38, { stroke: 'rgba(0,0,0,0.1)' });
  const [lx, ly] = iso(0, 0.4);
  rrect(ctx, cx + lx - 12, cy + ly - 30, 24, 3, 1, '#f2c230');
  if (i === 1) {
    ellipse(ctx, cx - 4, cy - 47, 9, 4, '#d9913f');
    ellipse(ctx, cx + 8, cy - 46, 7, 3, '#e8a94f');
  }
  if (i === n - 2) {
    rrect(ctx, cx - 6, cy - 55, 10, 12, 2, '#fff6e6', '#2a2233');
    ctx.fillStyle = '#6b3f1f';
    ctx.fillRect(cx - 5, cy - 52, 8, 3);
  }
}

function vitrineSlice(ctx: Ctx, cx: number, cy: number, i: number) {
  box(ctx, cx, cy, 1.0, 0.8, 22, '#d6cfc4', 0, { stroke: 'rgba(0,0,0,0.12)' });
  box(ctx, cx, cy, 0.96, 0.76, 24, 'rgba(200,235,255,0.35)', 22, { left: 'rgba(200,235,255,0.35)', right: 'rgba(170,215,240,0.4)', stroke: 'rgba(120,160,190,0.6)' });
  const sweets = i === 0 ? ['#f2d27a', '#e889a8', '#f4efe6'] : ['#c77b3a', '#f2c230', '#8a4a2a'];
  sweets.forEach((c, k) => {
    const [dx, dy] = iso(-0.25 + k * 0.25, 0.1);
    ellipse(ctx, cx + dx, cy + dy - 30, 6, 3.5, c);
    ellipse(ctx, cx + dx, cy + dy - 31, 4, 1.5, 'rgba(255,255,255,0.5)');
  });
  box(ctx, cx, cy, 1.0, 0.8, 3, '#efe9e1', 46, { stroke: 'rgba(0,0,0,0.1)' });
}

function caixa(ctx: Ctx, cx: number, cy: number) {
  box(ctx, cx, cy, 1.0, 0.8, 38, '#a8662f', 0, { left: '#b5452e', right: '#8e3620' });
  box(ctx, cx, cy, 1.02, 0.92, 5, '#efe9e1', 38);
  box(ctx, cx, cy, 0.45, 0.4, 14, '#3a3a44', 43);
  box(ctx, cx - 3, cy - 2, 0.3, 0.1, 10, '#1e2a3a', 57);
  ctx.fillStyle = '#7ff0a0';
  ctx.font = `800 6px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText('R$', cx - 3, cy - 62);
}

function banqueta(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 11, 5, 0.18);
  rrect(ctx, cx - 1.5, cy - 24, 3, 24, 1, '#b8b8c0');
  ellipse(ctx, cx, cy - 1, 8, 3.5, '#9a9aa4');
  ellipse(ctx, cx, cy - 26, 11, 5, '#b8283e');
  ellipse(ctx, cx, cy - 28, 11, 5, '#d8354d');
}

function mesa(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 20, 8, 0.2);
  rrect(ctx, cx - 2, cy - 30, 4, 30, 1, '#3a3a44');
  ellipse(ctx, cx, cy - 1, 10, 4, '#3a3a44');
  ellipse(ctx, cx, cy - 31, 20, 9, '#d8d2c8');
  ellipse(ctx, cx, cy - 33, 20, 9, '#f2eee8');
  rrect(ctx, cx - 9, cy - 42, 7, 8, 2, '#fff', '#c8c0b4');
  ellipse(ctx, cx + 7, cy - 35, 6, 2.5, '#fff');
  ellipse(ctx, cx + 7, cy - 37, 3.5, 2, '#e8a94f');
}

function cadeiraPadaria(ctx: Ctx, cx: number, cy: number, dir: Dir) {
  shadow(ctx, cx, cy, 13, 5, 0.18);
  for (const [dx, dy] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]] as [number, number][]) {
    const [lx, ly] = iso(dx, dy);
    rrect(ctx, cx + lx - 1, cy + ly - 18, 2, 18, 1, '#2a2233');
  }
  diamond(ctx, cx, cy - 18, 0.5, 0.5, '#b5452e', '#7a2a18');
  const back: Record<Dir, [number, number]> = { SE: [-0.24, 0], SW: [0, -0.24], NE: [0, 0.24], NW: [0.24, 0] };
  if (dir === 'SE' || dir === 'SW') {
    const [bx, by] = iso(...back[dir]);
    box(ctx, cx + bx, cy + by, dir === 'SW' ? 0.5 : 0.06, dir === 'SW' ? 0.06 : 0.5, 18, '#2a2233', 18);
  }
}

function trilho(ctx: Ctx, cx: number, cy: number, t: number) {
  shadow(ctx, cx, cy, 20, 8);
  box(ctx, cx, cy, 0.8, 0.6, 36, '#6b4a2e');
  box(ctx, cx, cy, 0.84, 0.64, 4, '#8a5a2e', 36);
  rrect(ctx, cx - 22, cy - 92, 44, 4, 2, '#c9c9c9');
  rrect(ctx, cx - 1.5, cy - 92, 3, 52, 1, '#8a8a8a');
  for (let i = 0; i < 3; i++) {
    const sw = Math.sin(t * 2 + i) * 1.5;
    rrect(ctx, cx - 20 + i * 14 + sw, cy - 88, 11, 16, 1, '#fffdf2', 'rgba(0,0,0,0.2)');
    ctx.fillStyle = '#c9b99c';
    ctx.fillRect(cx - 18 + i * 14 + sw, cy - 84, 7, 1.5);
    ctx.fillRect(cx - 18 + i * 14 + sw, cy - 80, 5, 1.5);
  }
  label(ctx, 'ME VÊ UM…', cx, cy - 104, '#e5572f', '#fff', 9);
}

function vaso(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 14, 6);
  ctx.fillStyle = '#b5452e';
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 22);
  ctx.lineTo(cx + 10, cy - 22);
  ctx.lineTo(cx + 7, cy - 1);
  ctx.lineTo(cx - 7, cy - 1);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.4;
    ellipse(ctx, cx + Math.cos(a) * 12, cy - 30 + Math.sin(a) * 14, 7, 4, i % 2 ? '#2e7d4a' : '#3f9a5a');
  }
}

function cama(ctx: Ctx, cx: number, cy: number) {
  const [ox, oy] = iso(0.5, 0.5);
  const x = cx + ox;
  const y = cy + oy;
  shadow(ctx, x, y, 50, 22, 0.2);
  box(ctx, x, y, 1.8, 1.8, 16, '#8a5433');
  box(ctx, x, y, 1.7, 1.7, 10, '#f4efe6', 16);
  // Blanket (front 2/3)
  const [bx, by] = iso(0.25, 0);
  box(ctx, x + bx, y + by, 1.2, 1.72, 3, '#3aa6a0', 26, { top: '#3aa6a0' });
  for (let i = 0; i < 4; i++) {
    const [sx, sy] = iso(-0.2 + i * 0.28, 0);
    diamond(ctx, x + sx + bx, y + sy + by - 29, 0.1, 1.6, 'rgba(242,194,48,0.7)');
  }
  const [px, py] = iso(-0.6, 0);
  box(ctx, x + px, y + py, 0.35, 1.2, 8, '#ffffff', 26);
  const [hx, hy] = iso(-0.9, 0);
  box(ctx, x + hx, y + hy, 0.1, 1.8, 40, '#6a3f22');
}

function cozinha(ctx: Ctx, cx: number, cy: number) {
  const [ox, oy] = iso(0.5, 0);
  const x = cx + ox;
  const y = cy + oy;
  box(ctx, x, y, 1.9, 0.85, 40, '#f4efe6', 0, { left: '#e2dbd0', right: '#cfc7ba' });
  box(ctx, x, y, 1.95, 0.9, 4, '#8a8a92', 40);
  const [sx, sy] = iso(-0.45, 0);
  diamond(ctx, x + sx, y + sy - 44, 0.6, 0.5, '#b8c4cc', '#8a96a0');
  rrect(ctx, x + sx - 1.5, y + sy - 60, 3, 16, 1, '#8a96a0');
  const [fx, fy] = iso(0.5, 0);
  for (const [dx, dy] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]] as [number, number][]) {
    const [bx, by] = iso(dx, dy);
    ellipse(ctx, x + fx + bx, y + fy + by - 44, 5, 2.5, '#2a2233');
  }
  rrect(ctx, x + fx - 7, y + fy - 58, 14, 10, 3, '#c23b4e');
}

export function drawProp(ctx: Ctx, p: PropDef, cx: number, cy: number, t: number, slice = 0, opts: { parrotAdopted?: boolean } = {}) {
  switch (p.kind) {
    case 'ipe':
      return ipe(ctx, cx, cy, t);
    case 'palmeira':
      return palmeira(ctx, cx, cy, t);
    case 'banco':
      return banco(ctx, cx, cy, p.seat ?? 'SE');
    case 'poste':
      return poste(ctx, cx, cy, t);
    case 'banca':
      return banca(ctx, cx + iso(0, 0.5)[0], cy + iso(0, 0.5)[1]);
    case 'barraca_chapeus':
      return barracaChapeus(ctx, cx, cy, t);
    case 'quiosque':
      return quiosque(ctx, cx, cy);
    case 'poleiro':
      return poleiro(ctx, cx, cy, t, !!opts.parrotAdopted);
    case 'canteiro':
      return canteiro(ctx, cx, cy);
    case 'lixeira':
      return lixeira(ctx, cx, cy);
    case 'bicicletario':
      return bicicletario(ctx, cx, cy);
    case 'balcao':
      return balcaoSlice(ctx, cx, cy, slice, p.w ?? 1);
    case 'vitrine':
      return vitrineSlice(ctx, cx, cy, slice);
    case 'caixa':
      return caixa(ctx, cx, cy);
    case 'banqueta':
      return banqueta(ctx, cx, cy);
    case 'mesa':
      return mesa(ctx, cx, cy);
    case 'cadeira_padaria':
      return cadeiraPadaria(ctx, cx, cy, p.seat ?? 'SE');
    case 'trilho_pedidos':
      return trilho(ctx, cx, cy, t);
    case 'vaso':
      return vaso(ctx, cx, cy);
    case 'cama':
      return cama(ctx, cx, cy);
    case 'cozinha':
      return cozinha(ctx, cx, cy);
  }
}

/** Props with multi-tile footprints that must be depth-sorted per tile. */
export const SLICED_PROPS = new Set(['balcao', 'vitrine']);

// ---------------- furniture ----------------

export function drawFurniture(ctx: Ctx, def: FurnitureDef, rot: 0 | 1, cx: number, cy: number, t: number, ghost = false) {
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.6;
  const c = def.color;
  const dir: Dir = rot === 0 ? 'SE' : 'SW';
  switch (def.kind) {
    case 'cadeira': {
      shadow(ctx, cx, cy, 13, 5, 0.18);
      for (const [dx, dy] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]] as [number, number][]) {
        const [lx, ly] = iso(dx, dy);
        rrect(ctx, cx + lx - 1.5, cy + ly - 18, 3, 18, 1, shade(c, -0.25));
      }
      box(ctx, cx, cy, 0.52, 0.52, 4, c, 16);
      const [bx, by] = iso(...((dir === 'SE' ? [-0.24, 0] : [0, -0.24]) as [number, number]));
      box(ctx, cx + bx, cy + by, dir === 'SW' ? 0.52 : 0.07, dir === 'SW' ? 0.07 : 0.52, 22, shade(c, -0.1), 20);
      break;
    }
    case 'poltrona': {
      shadow(ctx, cx, cy, 22, 9, 0.2);
      box(ctx, cx, cy, 0.8, 0.8, 16, c);
      const [bx, by] = iso(...((dir === 'SE' ? [-0.3, 0] : [0, -0.3]) as [number, number]));
      box(ctx, cx + bx, cy + by, dir === 'SW' ? 0.8 : 0.2, dir === 'SW' ? 0.2 : 0.8, 22, shade(c, -0.1), 16);
      const arms: [number, number][] = dir === 'SE' ? [[0, -0.32], [0, 0.32]] : [[-0.32, 0], [0.32, 0]];
      for (const a of arms) {
        const [ax, ay] = iso(...a);
        box(ctx, cx + ax, cy + ay, dir === 'SE' ? 0.8 : 0.16, dir === 'SE' ? 0.16 : 0.8, 10, shade(c, -0.05), 16);
      }
      break;
    }
    case 'pufe': {
      shadow(ctx, cx, cy, 15, 6, 0.2);
      ellipse(ctx, cx, cy - 8, 15, 8, shade(c, -0.2));
      rrect(ctx, cx - 15, cy - 22, 30, 14, 0, shade(c, -0.1));
      ellipse(ctx, cx, cy - 22, 15, 7, c);
      break;
    }
    case 'mesinha': {
      shadow(ctx, cx, cy, 20, 8, 0.2);
      for (const [dx, dy] of [[-0.28, -0.28], [0.28, -0.28], [0.28, 0.28], [-0.28, 0.28]] as [number, number][]) {
        const [lx, ly] = iso(dx, dy);
        rrect(ctx, cx + lx - 1.5, cy + ly - 16, 3, 16, 1, shade(c, -0.25));
      }
      box(ctx, cx, cy, 0.75, 0.75, 4, c, 16);
      rrect(ctx, cx - 4, cy - 30, 8, 8, 2, '#fff', '#ccc');
      break;
    }
    case 'planta': {
      shadow(ctx, cx, cy, 14, 6);
      ctx.fillStyle = '#f4efe6';
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 20);
      ctx.lineTo(cx + 10, cy - 20);
      ctx.lineTo(cx + 7, cy - 1);
      ctx.lineTo(cx - 7, cy - 1);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.5 + Math.sin(t + i) * 0.03;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * 12, cy - 38 + Math.sin(a) * 16);
        ctx.rotate(a + Math.PI / 2);
        ellipse(ctx, 0, 0, 7, 11, i % 2 ? c : shade(c, 0.15));
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'tapete': {
      diamond(ctx, cx, cy, 0.95, 0.95, c, shade(c, -0.3), 2);
      diamond(ctx, cx, cy, 0.6, 0.6, '#f2c230');
      diamond(ctx, cx, cy, 0.3, 0.3, '#2b5ba8');
      break;
    }
    case 'radio': {
      shadow(ctx, cx, cy, 14, 6);
      box(ctx, cx, cy, 0.6, 0.35, 18, c);
      const [fx, fy] = iso(0.3, 0);
      circle(ctx, cx + fx - 2, cy + fy - 10, 5, '#2a2233');
      circle(ctx, cx + fx - 2, cy + fy - 10, 2, '#777');
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.8 + i * 0.5) % 1;
        ctx.globalAlpha = (ghost ? 0.6 : 1) * (1 - k);
        ctx.fillStyle = '#2a2233';
        ctx.font = `800 ${10 + i * 2}px ${FONT_TITLE}`;
        ctx.fillText(i ? '♫' : '♪', cx + 6 + i * 8, cy - 26 - k * 22);
      }
      ctx.globalAlpha = ghost ? 0.6 : 1;
      break;
    }
    case 'ventilador': {
      shadow(ctx, cx, cy, 12, 5);
      ellipse(ctx, cx, cy - 2, 10, 4, '#9aa4a8');
      rrect(ctx, cx - 1.5, cy - 40, 3, 38, 1, '#9aa4a8');
      circle(ctx, cx, cy - 46, 13, 'rgba(220,230,235,0.5)', '#9aa4a8', 1.5);
      const a = t * 12;
      for (let i = 0; i < 3; i++) {
        const ang = a + (i * Math.PI * 2) / 3;
        ellipse(ctx, cx + Math.cos(ang) * 6, cy - 46 + Math.sin(ang) * 6, 6, 3, '#c9d6db');
      }
      circle(ctx, cx, cy - 46, 2.5, '#6a767a');
      break;
    }
    case 'gato': {
      shadow(ctx, cx, cy, 14, 5);
      ellipse(ctx, cx, cy - 7, 13, 7, c);
      circle(ctx, cx + 10, cy - 12, 6.5, c);
      poly(ctx, [[cx + 6, cy - 17], [cx + 8, cy - 23], [cx + 11, cy - 17]], c);
      poly(ctx, [[cx + 11, cy - 17], [cx + 14, cy - 23], [cx + 15, cy - 15]], c);
      ctx.strokeStyle = '#2a2233';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy - 12);
      ctx.lineTo(cx + 10, cy - 12);
      ctx.moveTo(cx + 12, cy - 12);
      ctx.lineTo(cx + 14, cy - 12);
      ctx.stroke();
      ctx.strokeStyle = c;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 7);
      ctx.quadraticCurveTo(cx - 22, cy - 10 + Math.sin(t * 2.5) * 5, cx - 18, cy - 20);
      ctx.stroke();
      for (let i = 0; i < 3; i++) rrect(ctx, cx - 6 + i * 5, cy - 13, 2, 7, 1, shade(c, -0.2));
      const z = (t * 0.6) % 1;
      ctx.globalAlpha = (ghost ? 0.6 : 1) * (1 - z);
      ctx.fillStyle = '#2a2233';
      ctx.font = `800 9px ${FONT_BODY}`;
      ctx.fillText('z', cx + 16 + z * 6, cy - 24 - z * 14);
      ctx.globalAlpha = ghost ? 0.6 : 1;
      break;
    }
    case 'luminaria': {
      shadow(ctx, cx, cy, 10, 4);
      ellipse(ctx, cx, cy - 2, 8, 3, '#2a2233');
      rrect(ctx, cx - 1.5, cy - 60, 3, 58, 1, '#2a2233');
      const g = ctx.createRadialGradient(cx, cy - 64, 2, cx, cy - 50, 50);
      g.addColorStop(0, 'rgba(255,220,140,0.55)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 50, cy - 110, 100, 110);
      poly(ctx, [[cx - 7, cy - 74], [cx + 7, cy - 74], [cx + 12, cy - 60], [cx - 12, cy - 60]], c);
      break;
    }
    case 'estante': {
      shadow(ctx, cx, cy, 18, 7);
      box(ctx, cx, cy, 0.7, 0.35, 70, c);
      const books = ['#e5572f', '#2b5ba8', '#f2c230', '#2e9e5b', '#e889a8', '#7a4fb0'];
      for (let s = 0; s < 3; s++)
        for (let b = 0; b < 5; b++) {
          const [bx, by] = iso(-0.28 + b * 0.14, 0.18);
          rrect(ctx, cx + bx - 2.5, cy + by - 20 - s * 22, 5, 14 - (b % 2) * 3, 1, books[(b + s) % books.length]);
        }
      break;
    }
    case 'quadro': {
      shadow(ctx, cx, cy, 14, 6);
      ctx.strokeStyle = '#6a3f22';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx, cy - 56);
      ctx.lineTo(cx + 12, cy);
      ctx.stroke();
      rrect(ctx, cx - 16, cy - 58, 32, 26, 2, '#fff6e6', '#6a3f22', 2);
      rrect(ctx, cx - 13, cy - 55, 26, 20, 1, '#9ed0f0');
      circle(ctx, cx - 3, cy - 45, 7, c);
      circle(ctx, cx + 5, cy - 47, 6, shade(c, 0.2));
      rrect(ctx, cx, cy - 40, 2, 5, 1, '#6b4a2e');
      break;
    }
  }
  ctx.restore();
}

export function furnitureIcon(itemId: string, size = 80): string {
  const def = furnitureById(itemId);
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  if (def) {
    ctx.translate(size / 2, size * 0.78);
    const s = size / 90;
    ctx.scale(s, s);
    drawFurniture(ctx, def, 0, 0, 0, 1);
  }
  return canvas.toDataURL();
}
