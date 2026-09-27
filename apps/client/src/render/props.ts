import { furnitureById, type Dir, type FurnitureDef, type PropDef } from '@tudobem/shared';
import { box, circle, diamond, ellipse, FONT_BODY, FONT_TITLE, grain, hash, iso, metalEdge, poly, rrect, shade, shadow, type Ctx } from './draw';
import { spriteUrl } from '../art/sprites';

function label(ctx: Ctx, text: string, x: number, y: number, bg: string, fg = '#fff', size = 9) {
  ctx.font = `800 ${size}px ${FONT_BODY}`;
  const w = ctx.measureText(text).width + 10;
  rrect(ctx, x - w / 2, y - size, w, size * 1.9, 4, bg);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - size * 0.05);
}

function ipe(ctx: Ctx, cx: number, cy: number, t: number, scale = 1) {
  if (scale !== 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }
  shadow(ctx, cx, cy, 30, 12, 0.3);
  // Dappled canopy shadow on the ground, offset away from the upper-left key light.
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 7; i++) shadow(ctx, cx + 8 + Math.cos(i * 2.1) * 26, cy + 4 + Math.sin(i * 2.1) * 9, 16, 7, 0.16);
  ctx.restore();
  // Trunk with bark: warm lit left face, dark right face, a few vertical fissures.
  box(ctx, cx, cy, 0.2, 0.2, 72, '#6b4a2e', 0, { left: '#7d5a3a', right: '#4f3521', stroke: 'rgba(40,20,10,0.4)' });
  ctx.strokeStyle = 'rgba(40,22,10,0.45)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 5 + i * 3, cy - 4);
    ctx.lineTo(cx - 5 + i * 3 + (i % 2 ? 1 : -1), cy - 66);
    ctx.stroke();
  }
  ctx.strokeStyle = '#5a3d25';
  ctx.lineCap = 'round';
  const branch = (x1: number, y1: number, x2: number, y2: number, w: number) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx + x1, cy + y1);
    ctx.quadraticCurveTo(cx + (x1 + x2) / 2 + 4, cy + (y1 + y2) / 2, cx + x2, cy + y2);
    ctx.stroke();
  };
  branch(0, -60, -24, -92, 4.5);
  branch(0, -64, 20, -96, 4.5);
  branch(0, -70, -4, -112, 3.5);
  branch(-14, -80, -34, -100, 2.5);
  branch(12, -84, 32, -104, 2.5);
  const sway = Math.sin(t * 0.8) * 1.5;
  // Leaf/blossom clusters: dark underside, mid body, sunlit crown on the upper-left.
  const clusters: [number, number, number][] = [
    [-30, -98, 15], [28, -102, 15], [-10, -94, 14], [12, -96, 13],
    [-36, -114, 13], [36, -118, 13], [-18, -118, 16], [18, -120, 16],
    [0, -108, 16], [-6, -134, 15], [16, -138, 13], [-24, -132, 12], [4, -150, 11],
  ];
  const layers: [string, number, number][] = [
    ['#b07a08', 3, 3],
    ['#dca10f', 0, 0],
    ['#f2c230', -2, -3],
    ['#ffe07a', -4, -6],
  ];
  layers.forEach(([color, ox, oy], li) => {
    ctx.fillStyle = color;
    clusters.forEach(([dx, dy, r], ci) => {
      const n = li === 3 ? 3 : 7;
      const rr = r * (li === 0 ? 1 : li === 1 ? 0.92 : li === 2 ? 0.68 : 0.36);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + ci;
        const d = rr * 0.55;
        ctx.beginPath();
        ctx.arc(cx + dx + ox + sway + Math.cos(a) * d, cy + dy + oy + Math.sin(a) * d * 0.8, rr * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
  ctx.fillStyle = '#fff4c2';
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39;
    const rr = 6 + (i % 6) * 6;
    ctx.beginPath();
    ctx.arc(cx - 6 + Math.cos(a) * rr + sway, cy - 122 + Math.sin(a) * rr * 0.7, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (scale !== 1) ctx.restore();
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
  shadow(ctx, cx, cy, 11, 5, 0.3);
  box(ctx, cx, cy, 0.16, 0.16, 8, '#2f4a3a');
  rrect(ctx, cx - 2, cy - 110, 4, 104, 2, '#2f4a3a');
  metalEdge(ctx, cx - 1.4, cy - 108, 100, 0.9);
  rrect(ctx, cx - 9, cy - 124, 18, 14, 4, '#2f4a3a');
  metalEdge(ctx, cx - 7, cy - 123, 1.2, 12);
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

/** Step glyphs for the Missão do dia (shared by the kiosk sign; the UI panel uses the SVG twins). */
export function missionGlyph(ctx: Ctx, kind: 'cumprimenta' | 'pede' | 'monta', x: number, y: number, s = 1, ink = '#2C2C2C') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'cumprimenta') {
    // Waving hand
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.roundRect(-4.5, -1, 9, 8, 3);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.roundRect(-4.5 + i * 2.4, -7 + (i === 0 || i === 3 ? 1.5 : 0), 2.1, 7, 1);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(6.5, -6);
    ctx.quadraticCurveTo(8.5, -3, 6.5, 0);
    ctx.stroke();
  } else if (kind === 'pede') {
    // Cafezinho with steam
    ctx.fillStyle = '#F5E6D3';
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.lineTo(5, -2);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, 1.2, 2, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#6b3f1f';
    ctx.fillRect(-4.2, -1.2, 8.4, 1.6);
    ctx.beginPath();
    ctx.moveTo(-1.5, -4);
    ctx.quadraticCurveTo(-3, -6, -1.5, -8);
    ctx.moveTo(1.8, -4);
    ctx.quadraticCurveTo(0.3, -6, 1.8, -8);
    ctx.stroke();
  } else {
    // Tray with a pão and a cup
    ctx.fillStyle = '#C45C26';
    ctx.beginPath();
    ctx.moveTo(-7, 3);
    ctx.lineTo(7, 3);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9913f';
    ctx.beginPath();
    ctx.ellipse(-2.5, 0.5, 3.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F5E6D3';
    ctx.beginPath();
    ctx.roundRect(2, -3, 3.6, 5, 1);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Missão do dia kiosk — a terracotta totem with the step icon row and the +25 RV badge. */
function quiosque(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 26, 11, 0.32);
  box(ctx, cx, cy, 0.86, 0.86, 7, '#b9b0a0', 0, { left: '#c9c0b0', right: '#9f9686' });
  box(ctx, cx, cy, 0.5, 0.5, 64, '#C45C26', 7, { left: '#d06a33', right: '#9e4418', stroke: 'rgba(44,44,44,0.45)' });
  // Cream band + touch screen on the front face
  const [fx, fy] = iso(0.25, 0);
  poly(ctx, [[cx + fx - 7, cy + fy - 46], [cx + fx + 7, cy + fy - 53], [cx + fx + 7, cy + fy - 31], [cx + fx - 7, cy + fy - 24]], '#2F5D50', '#2C2C2C', 1);
  ctx.fillStyle = 'rgba(230,255,235,0.8)';
  for (let i = 0; i < 3; i++) poly(ctx, [[cx + fx - 4, cy + fy - 42 + i * 5], [cx + fx + 4, cy + fy - 46 + i * 5], [cx + fx + 4, cy + fy - 45 + i * 5], [cx + fx - 4, cy + fy - 41 + i * 5]], 'rgba(230,255,235,0.8)');
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(cx - 7, cy - 68, 1.2, 56);
  // Sign board on a post above the totem
  const w = 98;
  const hgt = 56;
  const x0 = cx - w / 2 - 6;
  const y0 = cy - 146;
  rrect(ctx, cx - 2.5, y0 + hgt - 2, 5, 22, 1, '#7a3a18');
  rrect(ctx, x0 + 2, y0 + 3, w, hgt, 8, 'rgba(58,34,22,0.3)');
  rrect(ctx, x0, y0, w, hgt, 8, '#F5E6D3');
  rrect(ctx, x0, y0, w, 17, [8, 8, 0, 0], '#C45C26');
  ctx.strokeStyle = '#2C2C2C';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, hgt, 8);
  ctx.stroke();
  ctx.font = `900 10px ${FONT_BODY}`;
  ctx.fillStyle = '#F5E6D3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MISSÃO DO DIA', x0 + w / 2 - 8, y0 + 9);
  const steps = ['cumprimenta', 'pede', 'monta'] as const;
  steps.forEach((k, i) => {
    const sx = x0 + 19 + i * 30;
    circle(ctx, sx, y0 + 36, 12, '#fff6e6', '#2C2C2C', 1.2);
    missionGlyph(ctx, k, sx, y0 + 36, 1.15);
    if (i < 2) circle(ctx, sx + 15, y0 + 36, 1.8, '#C45C26');
  });
  // +25 RV coin badge on the sign's corner
  const bx = x0 + w + 2;
  const by = y0 - 2;
  circle(ctx, bx + 1, by + 1.5, 13.5, 'rgba(58,34,22,0.3)');
  circle(ctx, bx, by, 13.5, '#D4A017', '#2C2C2C', 1.4);
  circle(ctx, bx, by, 10.5, '#f2c230');
  ctx.fillStyle = '#2C2C2C';
  ctx.font = `900 9px ${FONT_BODY}`;
  ctx.fillText('+25', bx, by - 3);
  ctx.font = `800 6.5px ${FONT_BODY}`;
  ctx.fillText('RV', bx, by + 5.5);
}

function mesaCafe(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 26, 11, 0.26);
  const chair = (dx: number, dy: number, backLeft: boolean) => {
    const [ox, oy] = iso(dx, dy);
    const x = cx + ox;
    const y = cy + oy;
    shadow(ctx, x, y, 9, 4, 0.2);
    for (const [lx, ly] of [[-4, 0], [4, 0], [-3, 2], [3, 2]]) rrect(ctx, x + lx - 0.6, y + ly - 14, 1.2, 14, 0.5, '#2C2C2C');
    ellipse(ctx, x, y - 14, 7, 3.4, '#C45C26');
    ellipse(ctx, x, y - 15, 7, 3.4, '#d8703a');
    rrect(ctx, x + (backLeft ? -7 : 3), y - 30, 4, 16, 2, '#C45C26', '#2C2C2C', 0.8);
  };
  chair(-0.32, 0, true);
  rrect(ctx, cx - 1.5, cy - 26, 3, 26, 1, '#3a3a44');
  metalEdge(ctx, cx - 1, cy - 26, 24, 0.8);
  ellipse(ctx, cx, cy - 1, 8, 3, '#3a3a44');
  ellipse(ctx, cx, cy - 27, 16, 7, '#cfc8bc');
  ellipse(ctx, cx, cy - 29, 16, 7, '#f2eee8');
  ellipse(ctx, cx - 4, cy - 31, 6, 2, 'rgba(255,255,255,0.7)');
  // Cafezinho + açucareiro + napkins
  ellipse(ctx, cx + 5, cy - 30, 4.5, 2, '#fff');
  rrect(ctx, cx + 3, cy - 36, 4.5, 5, 1, '#fff', '#c8c0b4', 0.6);
  ellipse(ctx, cx + 5.2, cy - 36, 2, 0.8, '#6b3f1f');
  rrect(ctx, cx - 9, cy - 38, 4.5, 8, 1.5, 'rgba(230,240,245,0.85)', '#9aa4a8', 0.6);
  rrect(ctx, cx - 9, cy - 40, 4.5, 2.5, 1, '#b8b8c0');
  chair(0, 0.34, false);
}

function jornais(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 18, 8, 0.26);
  const stack = (dx: number, dy: number, n: number) => {
    const [ox, oy] = iso(dx, dy);
    for (let i = 0; i < n; i++) {
      box(ctx, cx + ox, cy + oy, 0.42, 0.3, 2.6, i % 2 ? '#e9e4d8' : '#f4f0e6', i * 2.6, { stroke: 'rgba(80,70,60,0.25)' });
    }
    const top = n * 2.6;
    // Headline block + photo on the top copy
    const [hx, hy] = iso(-0.05, 0);
    poly(ctx, [[cx + ox + hx - 8, cy + oy + hy - top - 1], [cx + ox + hx, cy + oy + hy - top - 5], [cx + ox + hx + 3, cy + oy + hy - top - 3.5], [cx + ox + hx - 5, cy + oy + hy - top + 0.5]], '#2C2C2C');
    poly(ctx, [[cx + ox + hx + 2, cy + oy + hy - top + 1], [cx + ox + hx + 7, cy + oy + hy - top - 1.5], [cx + ox + hx + 9, cy + oy + hy - top], [cx + ox + hx + 4, cy + oy + hy - top + 2.5]], '#C45C26');
    // Twine
    ctx.strokeStyle = '#b08850';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + ox, cy + oy - top + 2);
    ctx.lineTo(cx + ox, cy + oy + 2);
    ctx.stroke();
  };
  stack(-0.15, -0.12, 7);
  stack(0.18, 0.16, 4);
}

function sacoLixo(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 13, 6, 0.3);
  ctx.fillStyle = '#34343c';
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 2);
  ctx.bezierCurveTo(cx - 14, cy - 14, cx - 6, cy - 22, cx - 2, cy - 21);
  ctx.lineTo(cx + 2, cy - 21);
  ctx.bezierCurveTo(cx + 7, cy - 22, cx + 14, cy - 14, cx + 11, cy - 2);
  ctx.quadraticCurveTo(cx, cy + 2, cx - 11, cy - 2);
  ctx.fill();
  ctx.fillStyle = '#26262c';
  ctx.beginPath();
  ctx.moveTo(cx + 2, cy - 20);
  ctx.bezierCurveTo(cx + 12, cy - 15, cx + 12, cy - 6, cx + 8, cy - 1);
  ctx.lineTo(cx + 11, cy - 2);
  ctx.bezierCurveTo(cx + 14, cy - 14, cx + 7, cy - 22, cx + 2, cy - 21);
  ctx.fill();
  poly(ctx, [[cx - 3, cy - 21], [cx - 5, cy - 27], [cx, cy - 24], [cx + 5, cy - 28], [cx + 3, cy - 21]], '#3e3e46');
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 14);
  ctx.quadraticCurveTo(cx - 6, cy - 18, cx - 3, cy - 18);
  ctx.stroke();
}

function floreira(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 24, 10, 0.26);
  box(ctx, cx, cy, 0.72, 0.72, 18, '#b9b1a3', 0, { left: '#c8c0b1', right: '#a0988a', stroke: 'rgba(60,50,40,0.3)' });
  box(ctx, cx, cy, 0.78, 0.78, 3, '#d4ccbd', 18, { stroke: 'rgba(60,50,40,0.25)' });
  diamond(ctx, cx, cy - 21, 0.62, 0.62, '#5a3a24');
  const shrubs: [number, number, number][] = [[-0.16, -0.14, 9], [0.16, -0.12, 8], [0, 0.12, 9], [-0.2, 0.16, 6], [0.2, 0.18, 6]];
  for (const [layer, col] of [[0, '#2F5D50'], [1, '#3f7a52'], [2, '#6fa35a']] as const) {
    for (const [dx, dy, r] of shrubs) {
      const [ox, oy] = iso(dx, dy);
      circle(ctx, cx + ox - layer * 1.5, cy + oy - 26 - layer * 2.5, r * (1 - layer * 0.28), col);
    }
  }
  for (let i = 0; i < 7; i++) {
    const [ox, oy] = iso(-0.22 + (i % 4) * 0.15, -0.15 + Math.floor(i / 4) * 0.28);
    circle(ctx, cx + ox, cy + oy - 32, 2.2, i % 3 === 0 ? '#E07A5F' : i % 3 === 1 ? '#f2c230' : '#fff6e6');
  }
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

function bike(ctx: Ctx, cx: number, cy: number, frame: string, s = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = '#2C2C2C';
  ctx.lineWidth = 1.6;
  for (const dx of [-10, 10]) {
    ctx.beginPath();
    ctx.arc(dx, -9, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,200,210,0.8)';
    ctx.lineWidth = 0.5;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(dx + Math.cos(k * 0.8) * 7, -9 + Math.sin(k * 0.8) * 7);
      ctx.lineTo(dx - Math.cos(k * 0.8) * 7, -9 - Math.sin(k * 0.8) * 7);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2C2C2C';
    ctx.lineWidth = 1.6;
  }
  ctx.strokeStyle = frame;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -9);
  ctx.lineTo(-2, -21);
  ctx.lineTo(8, -21);
  ctx.lineTo(10, -9);
  ctx.moveTo(-2, -21);
  ctx.lineTo(0, -9);
  ctx.lineTo(8, -21);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-1.5, -21.8);
  ctx.lineTo(7.5, -21.8);
  ctx.stroke();
  rrect(ctx, -6, -25, 8, 3, 1, '#2C2C2C');
  rrect(ctx, 6, -27, 6, 2, 1, '#2C2C2C');
  ctx.restore();
}

/** Bike rack with a couple of bikes locked up. */
function bicicletario(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 26, 10, 0.24);
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = 2.2;
  for (const [dx, dy] of [[-0.3, -0.2], [0, 0], [0.3, 0.2]] as [number, number][]) {
    const [ox, oy] = iso(dy, dx);
    ctx.beginPath();
    ctx.moveTo(cx + ox - 6, cy + oy);
    ctx.lineTo(cx + ox - 6, cy + oy - 12);
    ctx.quadraticCurveTo(cx + ox, cy + oy - 20, cx + ox + 6, cy + oy - 12);
    ctx.lineTo(cx + ox + 6, cy + oy);
    ctx.stroke();
  }
  bike(ctx, cx - 6, cy - 3, '#f07a1a', 0.85);
  bike(ctx, cx + 6, cy + 5, '#2F5D50', 0.85);
}

type Pt = [number, number];
const lerp2 = (p: Pt, q: Pt, f: number): Pt => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];

/** Clip to a polygon, run `draw`, restore. */
function clipTo(ctx: Ctx, pts: Pt[], draw: () => void) {
  ctx.save();
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  draw();
  ctx.restore();
}

type CaseGeo = { N: Pt; E: Pt; S: Pt; W: Pt; up: (p: Pt, k?: number) => Pt };

/** Fill a polygon with any fill style (gradients included). */
function fillPts(ctx: Ctx, pts: Pt[], style: string | CanvasGradient) {
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

/**
 * Glass case shell: brushed-steel plinth with a dark kick, then the case interior (back walls + floor)
 * the goods sit in front of. The interior is kept a few values darker than the glass so the goods
 * and the specular streaks read — a pale interior behind pale glass is what made the case a flat box.
 */
function caseShell(ctx: Ctx, cx: number, cy: number, gh: number, warm: boolean): CaseGeo {
  const base = box(ctx, cx, cy, 1.0, 0.8, 22, '#c3c7ce', 0, { left: '#a7acb5', right: '#7f848e', stroke: 'rgba(40,44,52,0.4)' });
  for (const [a, b] of [[base.W, base.S], [base.S, base.E]] as [Pt, Pt][]) {
    poly(ctx, [a, b, [b[0], b[1] - 4], [a[0], a[1] - 4]], '#3e4048');
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] - 12);
    ctx.lineTo(b[0], b[1] - 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,34,40,0.28)';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] - 11);
    ctx.lineTo(b[0], b[1] - 11);
    ctx.stroke();
  }
  const [ax, ay] = iso(0.48, 0);
  const [bx, by] = iso(0, 0.38);
  const y0 = cy - 22;
  const N: Pt = [cx - ax - bx, y0 - ay - by];
  const E: Pt = [cx + ax - bx, y0 + ay - by];
  const S: Pt = [cx + ax + bx, y0 + ay + by];
  const W: Pt = [cx - ax + bx, y0 - ay + by];
  const up = (p: Pt, k = 1): Pt => [p[0], p[1] - gh * k];
  const wall = ctx.createLinearGradient(0, N[1] - gh, 0, S[1]);
  wall.addColorStop(0, warm ? '#6a3f22' : '#a9bcc8');
  wall.addColorStop(1, warm ? '#2e1a0e' : '#647e8e');
  fillPts(ctx, [W, N, up(N), up(W)], wall);
  fillPts(ctx, [N, E, up(E), up(N)], wall);
  fillPts(ctx, [N, E, S, W], warm ? '#7a5534' : '#e6e0d6');
  if (warm) {
    // Heat lamp: a hot core under the lid spilling down onto the trays.
    const lamp = ctx.createRadialGradient(cx, y0 - gh + 4, 2, cx, y0 - gh * 0.4, 30);
    lamp.addColorStop(0, 'rgba(255,206,120,0.5)');
    lamp.addColorStop(0.5, 'rgba(255,180,90,0.14)');
    lamp.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(cx - 32, y0 - gh - 2, 64, gh + 14);
  }
  return { N, E, S, W, up };
}

/**
 * Front panes over the goods (palette.md glass-cool #C5D5DE). Judged at game scale — a pane is only
 * ~40×20 px on a 1024 px screen — so the glass is drawn as obvious shapes, not subtle gradients: a cool
 * cyan wash over the whole pane, then bold diagonal specular streaks (a wide cyan band with a
 * near-white core, plus a thin partner), a cool floor reflection at the foot and a dark steel frame.
 */
function caseGlass(ctx: Ctx, g: CaseGeo) {
  const { E, S, W, up } = g;
  const pane = (a: Pt, b: Pt, k: number, streaks: readonly (readonly [number, number])[]) => {
    const pts: Pt[] = [a, b, up(b), up(a)];
    const top = Math.min(up(a)[1], up(b)[1]);
    const bot = Math.max(a[1], b[1]);
    const gr = ctx.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, `rgba(150,214,238,${0.55 * k})`);
    gr.addColorStop(0.25, `rgba(130,200,230,${0.18 * k})`);
    gr.addColorStop(0.75, `rgba(120,190,225,${0.1 * k})`);
    gr.addColorStop(1, `rgba(60,110,140,${0.4 * k})`);
    fillPts(ctx, pts, gr);
    clipTo(ctx, pts, () => {
      // Diagonal streaks: foot at f0 along the pane, leaning 0.3 of the pane toward b at the top.
      const band = (fa: number, fb: number, style: string) => {
        const p1 = up(lerp2(a, b, fa), -0.1);
        const p2 = up(lerp2(a, b, fb), -0.1);
        const p3 = up(lerp2(a, b, fb + 0.3), 1.1);
        const p4 = up(lerp2(a, b, fa + 0.3), 1.1);
        poly(ctx, [p1, p2, p3, p4], style);
      };
      for (const [f0, w] of streaks) {
        band(f0 - 0.04, f0 + w + 0.04, `rgba(120,214,246,${0.55 * k})`);
        band(f0, f0 + w, `rgba(178,236,255,${0.85 * k})`);
        band(f0 + w * 0.3, f0 + w * 0.7, `rgba(246,253,255,${0.95 * k})`);
      }
    });
  };
  // Two streaks on the long pane (a wide one off the left post, a thin partner past the middle) and one
  // on the short pane, leaving the goods clear between them.
  pane(W, S, 1, [[-0.1, 0.13], [0.56, 0.05]]);
  pane(S, E, 0.8, [[0.02, 0.1]]);
  // Steel frame: base channel, top rail and corner posts.
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3e4a56';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (const p of [W, S, E]) {
    ctx.moveTo(...p);
    ctx.lineTo(...up(p));
  }
  ctx.moveTo(...W);
  ctx.lineTo(...S);
  ctx.lineTo(...E);
  ctx.stroke();
  // Lit front post catching the window key (cool, not white, so it reads as glass-edge light).
  ctx.strokeStyle = 'rgba(190,238,255,0.95)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(S[0] - 1.2, S[1] - 1);
  ctx.lineTo(S[0] - 1.2, S[1] - (S[1] - up(S)[1]) + 1);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Glass lid over a case: a cool-tinted pane (not a white slab) with its own diagonal glints. */
function caseLid(ctx: Ctx, cx: number, cy: number, lift: number) {
  const lid = box(ctx, cx, cy, 1.0, 0.8, 3, '#9fd0e4', lift, { left: '#7fb2c8', right: '#5f8ea4', stroke: 'rgba(30,60,80,0.55)' });
  const [N, E, S, W] = lid.top as [Pt, Pt, Pt, Pt];
  clipTo(ctx, lid.top as Pt[], () => {
    const sky = ctx.createLinearGradient(W[0], W[1], E[0], E[1]);
    sky.addColorStop(0, 'rgba(210,244,255,0.55)');
    sky.addColorStop(1, 'rgba(90,150,180,0.25)');
    ctx.fillStyle = sky;
    ctx.fillRect(W[0] - 2, N[1] - 2, E[0] - W[0] + 4, S[1] - N[1] + 4);
    poly(ctx, [lerp2(N, E, 0.18), lerp2(N, E, 0.36), lerp2(W, S, 0.2), lerp2(W, S, 0.02)], 'rgba(240,252,255,0.85)');
    poly(ctx, [lerp2(N, E, 0.46), lerp2(N, E, 0.52), lerp2(W, S, 0.36), lerp2(W, S, 0.3)], 'rgba(220,248,255,0.7)');
  });
}

/** Wood-warm plank grain across an iso top face, running along the N→E (x) axis. */
function woodTop(ctx: Ctx, top: Pt[], seed: number) {
  const [N, E, S, W] = top as [Pt, Pt, Pt, Pt];
  clipTo(ctx, top, () => {
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const f = (r + 0.5) / rows;
      const a = lerp2(N, W, f);
      const b = lerp2(E, S, f);
      const wob = (hash(r, seed, 3) - 0.5) * 1.6;
      ctx.strokeStyle = r % 3 === 1 ? 'rgba(255,222,176,0.32)' : 'rgba(70,38,16,0.28)';
      ctx.lineWidth = r % 3 === 1 ? 0.9 : 0.6;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.bezierCurveTo(a[0] + (b[0] - a[0]) * 0.35, a[1] + (b[1] - a[1]) * 0.35 + wob, a[0] + (b[0] - a[0]) * 0.7, a[1] + (b[1] - a[1]) * 0.7 - wob, b[0], b[1]);
      ctx.stroke();
    }
    // Plank seams + a knot now and then.
    for (const f of [0.34, 0.67]) poly(ctx, [lerp2(N, W, f), lerp2(E, S, f), lerp2(E, S, f + 0.012), lerp2(N, W, f + 0.012)], 'rgba(60,30,12,0.35)');
    if (hash(seed, 7) > 0.4) {
      const k = lerp2(lerp2(N, W, 0.5), lerp2(E, S, 0.5), 0.2 + hash(seed, 8) * 0.6);
      ellipse(ctx, k[0], k[1], 2.4, 1, 'rgba(70,38,16,0.35)');
    }
    // Window key from the left: sheen on the near-left half, falling off to the right.
    const g = ctx.createLinearGradient(W[0], W[1], E[0], E[1]);
    g.addColorStop(0, 'rgba(255,236,196,0.22)');
    g.addColorStop(1, 'rgba(255,236,196,0)');
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(W[0], N[0]) - 2, N[1] - 2, E[0] - W[0] + 4, S[1] - N[1] + 4);
  });
}

function balcaoSlice(ctx: Ctx, cx: number, cy: number, i: number, n: number) {
  const body = box(ctx, cx, cy, 1.0, 0.8, 38, '#a8662f', 0, { left: '#b5452e', right: '#8e3620', stroke: 'rgba(0,0,0,0.12)' });
  const front: Pt[] = [body.W, body.S, [body.S[0], body.S[1] - 38], [body.W[0], body.W[1] - 38]];
  clipTo(ctx, front, () => {
    // Wood-grain kick panel on the customer side
    const [kx, ky] = iso(0, 0.4);
    ctx.save();
    ctx.transform(1, -0.5, 0, 1, cx + kx - 16, cy + ky + 8);
    grain(ctx, 0, -40, 32, 30, 'rgba(70,25,10,0.3)', 'rgba(255,190,150,0.18)', i, true);
    ctx.restore();
    // Awning stripe shadow across the front edge, under the top lip.
    for (let k = 0; k < 4; k += 2) {
      const a = lerp2(body.W, body.S, k / 4);
      const b = lerp2(body.W, body.S, (k + 1) / 4);
      poly(ctx, [[a[0], a[1] - 38], [b[0], b[1] - 38], [b[0], b[1] - 22], [a[0], a[1] - 26]], 'rgba(70,30,12,0.28)');
    }
    const lip = ctx.createLinearGradient(0, cy - 44, 0, cy - 28);
    lip.addColorStop(0, 'rgba(58,24,10,0.3)');
    lip.addColorStop(1, 'rgba(58,24,10,0)');
    ctx.fillStyle = lip;
    ctx.fillRect(body.W[0] - 2, cy - 60, 70, 36);
    // Floor AO at the kick.
    const kick = ctx.createLinearGradient(0, cy - 2, 0, cy + 22);
    kick.addColorStop(0, 'rgba(58,24,10,0)');
    kick.addColorStop(1, 'rgba(58,24,10,0.3)');
    ctx.fillStyle = kick;
    ctx.fillRect(body.W[0] - 2, cy - 8, 70, 36);
  });
  const top = box(ctx, cx, cy, 1.02, 0.92, 5, '#9c6a44', 38, { left: '#7a4f30', right: '#6a4228', stroke: 'rgba(60,30,12,0.25)' }).top;
  woodTop(ctx, top, i);
  const [N, E, S, W] = top as [Pt, Pt, Pt, Pt];
  // The toldo's soft stripe shadow falling across the counter top.
  clipTo(ctx, top, () => {
    for (let k = 0; k < 4; k += 2) poly(ctx, [lerp2(N, E, k / 4), lerp2(N, E, (k + 1) / 4), lerp2(W, S, (k + 1) / 4), lerp2(W, S, k / 4)], 'rgba(60,28,10,0.2)');
  });
  // Cream rail on the customer edge.
  const [rx, ry] = iso(0, 0.42);
  box(ctx, cx + rx, cy + ry, 1.02, 0.1, 3, '#F5E6D3', 42, { left: '#e2cfb6', right: '#cdb89c', stroke: 'rgba(90,60,30,0.3)' });
  const [lx, ly] = iso(0, 0.4);
  rrect(ctx, cx + lx - 12, cy + ly - 30, 24, 3, 1, '#f2c230');
  if (i === 0) {
    // Açucareiro + canela shakers, with the paper napkin stack beside them.
    for (const [dx, cap] of [[-6, '#b8b8c0'], [0, '#C45C26']] as const) {
      ellipse(ctx, cx + dx + 0.5, cy - 44, 3.4, 1.3, 'rgba(58,34,22,0.3)');
      rrect(ctx, cx + dx - 2.5, cy - 52, 5, 8, 1.5, 'rgba(225,238,246,0.9)', '#8fa2ac', 0.6);
      ctx.fillStyle = dx ? '#fff' : '#8a5a3c';
      ctx.fillRect(cx + dx - 1.8, cy - 48, 3.6, 3.5);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(cx + dx - 2, cy - 51, 0.9, 6);
      rrect(ctx, cx + dx - 2.5, cy - 54, 5, 2.5, 1, cap);
    }
    ellipse(ctx, cx + 9, cy - 43, 5, 1.8, 'rgba(58,34,22,0.25)');
    for (let k = 0; k < 5; k++) diamond(ctx, cx + 9, cy - 44 - k * 1.1, 0.26, 0.2, k % 2 ? '#fffdf7' : '#efe8da', 'rgba(0,0,0,0.1)', 0.4);
  }
  if (i === 1) {
    // Tábua with a fresh pão italiano + two pães franceses.
    ellipse(ctx, cx - 2, cy - 44, 13, 4.5, 'rgba(58,34,22,0.28)');
    ellipse(ctx, cx - 2, cy - 45.5, 12, 4.4, '#c9a06a');
    ellipse(ctx, cx - 4, cy - 48, 8, 4.4, '#b87433');
    ellipse(ctx, cx - 6, cy - 50, 4, 1.4, 'rgba(255,230,170,0.6)');
    ctx.strokeStyle = 'rgba(255,228,180,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 48);
    ctx.lineTo(cx + 1, cy - 49);
    ctx.stroke();
    ellipse(ctx, cx + 8, cy - 47, 6.5, 2.8, '#d9913f');
    ellipse(ctx, cx + 6.5, cy - 48.5, 3, 0.9, 'rgba(255,230,170,0.6)');
  }
  if (i === 2) {
    // Porta-guardanapo with a stack of paper napkins
    ellipse(ctx, cx, cy - 44, 8, 2.4, 'rgba(58,34,22,0.28)');
    rrect(ctx, cx - 6, cy - 50, 12, 6, 1, '#b8b8c0', '#8a8a92', 0.6);
    for (let k = 0; k < 4; k++) poly(ctx, [[cx - 5 + k * 0.6, cy - 50 - k * 1.2], [cx + 5 + k * 0.6, cy - 50 - k * 1.2], [cx + 4 + k * 0.6, cy - 56 - k * 1.2], [cx - 4 + k * 0.6, cy - 56 - k * 1.2]], k % 2 ? '#fffdf7' : '#f1ece2', 'rgba(0,0,0,0.12)', 0.4);
  }
  if (i === n - 2) {
    // Copo americano of pingado on a saucer.
    ellipse(ctx, cx - 1, cy - 44, 7, 2.4, 'rgba(58,34,22,0.3)');
    ellipse(ctx, cx - 1, cy - 45, 6.5, 2.2, '#fffaf2');
    rrect(ctx, cx - 5, cy - 56, 8, 11, 1.5, 'rgba(236,244,248,0.85)', '#8fa2ac', 0.6);
    ctx.fillStyle = '#b58250';
    ctx.fillRect(cx - 4.4, cy - 52, 6.8, 6.4);
    ctx.fillStyle = '#e9d2b0';
    ctx.fillRect(cx - 4.4, cy - 53, 6.8, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(cx - 4, cy - 55, 1, 9);
  }
}

function vitrineSlice(ctx: Ctx, cx: number, cy: number, i: number) {
  const glass = caseShell(ctx, cx, cy, 24, false);
  // Back row: tall slices of bolo (layer wedges) on a doily; front row: brigadeiro pyramid + sonhos.
  const cakes = ['#c77b3a', '#e889a8', '#f2d27a'];
  cakes.forEach((c, k) => {
    const [dx, dy] = iso(-0.26 + k * 0.26, -0.16);
    const x = cx + dx;
    const y = cy + dy - 28;
    ellipse(ctx, x, y + 1, 6, 2, 'rgba(255,253,247,0.9)');
    poly(ctx, [[x - 5, y], [x + 4, y + 1], [x + 4, y - 10], [x - 5, y - 11]], shade(c, -0.05), 'rgba(90,50,20,0.35)', 0.5);
    ctx.fillStyle = 'rgba(255,248,232,0.9)';
    ctx.fillRect(x - 5, y - 6.5, 9, 1.4);
    poly(ctx, [[x - 5, y - 11], [x + 4, y - 10], [x + 6, y - 12], [x - 3, y - 13]], shade(c, 0.18));
  });
  const [px, py] = iso(-0.2, 0.14);
  for (const [dx, dy, r] of [[-4, 0, 0], [0, 0, 0], [4, 0, 0], [-2, -3.2, 1], [2, -3.2, 1], [0, -6.4, 2]] as const) {
    circle(ctx, cx + px + dx, cy + py - 28 + dy, 2.2, r === 2 ? '#8a4a2a' : '#6e3a22');
    circle(ctx, cx + px + dx - 0.6, cy + py - 28.8 + dy, 0.7, 'rgba(255,230,190,0.6)');
  }
  for (const k of [0, 1]) {
    const [dx, dy] = iso(0.12 + k * 0.2, 0.12);
    ellipse(ctx, cx + dx + 0.5, cy + dy - 27.5, 5, 2, 'rgba(58,34,22,0.22)');
    ellipse(ctx, cx + dx, cy + dy - 30, 5, 3.6, i ? '#d59a4c' : '#c98a3e');
    ellipse(ctx, cx + dx, cy + dy - 32, 4, 1.6, 'rgba(255,250,240,0.85)');
  }
  caseGlass(ctx, glass);
  caseLid(ctx, cx, cy, 46);
  // Redoma on top: a bolo de fubá under a glass dome — breaks the flat case top line.
  ellipse(ctx, cx + 1, cy - 49, 12, 3.6, 'rgba(58,34,22,0.22)');
  ellipse(ctx, cx, cy - 50, 11, 3.4, '#d6cfc4');
  rrect(ctx, cx - 7.5, cy - 58, 15, 7, 2, '#e0a83e', 'rgba(120,70,20,0.45)', 0.5);
  ellipse(ctx, cx, cy - 58, 7.5, 2.4, '#f2c65a');
  ellipse(ctx, cx - 2, cy - 58.5, 3, 0.9, 'rgba(255,250,230,0.8)');
  ctx.fillStyle = 'rgba(197,213,222,0.3)';
  ctx.strokeStyle = 'rgba(96,136,164,0.75)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 50);
  ctx.bezierCurveTo(cx - 10, cy - 70, cx + 10, cy - 70, cx + 10, cy - 50);
  ctx.fill();
  ctx.stroke();
  circle(ctx, cx, cy - 66, 1.6, '#8fa2ac');
  ctx.strokeStyle = 'rgba(240,250,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy - 55, 7.5, Math.PI * 1.1, Math.PI * 1.4);
  ctx.stroke();
}

function caixa(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy + 2, 26, 11, 0.3);
  box(ctx, cx, cy, 1.0, 0.8, 38, '#a8662f', 0, { left: '#b5452e', right: '#8e3620' });
  const top = box(ctx, cx, cy, 1.02, 0.92, 5, '#9c6a44', 38, { left: '#7a4f30', right: '#6a4228', stroke: 'rgba(60,30,12,0.25)' }).top;
  woodTop(ctx, top, 11);
  // Register pushed to the back corner (+ its soft contact on the wood) so the tray owns the front.
  const [rx, ry] = iso(-0.12, -0.2);
  ellipse(ctx, cx + rx - 1, cy + ry - 43, 12, 4.5, 'rgba(58,34,22,0.32)');
  box(ctx, cx + rx, cy + ry, 0.45, 0.4, 14, '#3a3a44', 43);
  box(ctx, cx + rx - 3, cy + ry - 2, 0.3, 0.1, 10, '#1e2a3a', 57);
  ctx.fillStyle = '#7ff0a0';
  ctx.font = `800 6px ${FONT_BODY}`;
  ctx.textAlign = 'center';
  ctx.fillText('R$', cx + rx - 3, cy + ry - 62);
  // Açúcar + canela shakers at the back-right corner.
  const [kx, ky] = iso(0.32, -0.3);
  for (const [dx, cap, fill] of [[-3.2, '#b8b8c0', '#fff'], [3.2, '#C45C26', '#8a5a3c']] as const) {
    const x = cx + kx + dx;
    const y = cy + ky - 43;
    ellipse(ctx, x + 0.5, y + 0.4, 3.4, 1.3, 'rgba(58,34,22,0.32)');
    rrect(ctx, x - 2.6, y - 9, 5.2, 9, 1.6, 'rgba(225,238,246,0.92)', '#8fa2ac', 0.6);
    ctx.fillStyle = fill;
    ctx.fillRect(x - 1.9, y - 4.5, 3.8, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x - 2.1, y - 8, 0.9, 6.5);
    rrect(ctx, x - 2.6, y - 11.5, 5.2, 3, 1.2, cap, 'rgba(0,0,0,0.3)', 0.4);
  }
  // Bandeja: a big oval wooden serving tray in front of the till, judged at game scale (~30×14 px on a
  // 1024 px screen) — a pale honey-wood dish with a dark raised rim and a hard cast shadow, so it reads as
  // its own object on the darker counter wood, not a pad. Holds a cafezinho and three pães de queijo.
  const tx = cx + iso(0.08, 0.2)[0];
  const ty = cy + iso(0.08, 0.2)[1] - 43;
  const oval = (dy: number, rx: number, ry: number, fill: string | CanvasGradient, stroke?: string, lw = 1) => {
    ctx.beginPath();
    ctx.ellipse(tx, ty + dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  };
  oval(2.6, 23, 9.6, 'rgba(40,18,6,0.5)');
  // Rim wall (the tray's side), then the rim lip, then the recessed floor with grain.
  oval(0, 22, 9.2, '#6e3c18', '#2e1406', 1.1);
  oval(-2.4, 22, 9.2, '#c98a4a', '#3a1a08', 1.1);
  const floor = ctx.createLinearGradient(tx - 18, ty - 8, tx + 18, ty + 4);
  floor.addColorStop(0, '#f2c486');
  floor.addColorStop(1, '#d99a58');
  oval(-2.2, 18.5, 7.4, floor, 'rgba(90,44,12,0.7)', 0.8);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(tx, ty - 2.2, 18.5, 7.4, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,84,30,0.45)';
  ctx.lineWidth = 0.7;
  for (const gy of [-6, -3, 0, 3]) {
    ctx.beginPath();
    ctx.moveTo(tx - 20, ty - 2.2 + gy);
    ctx.bezierCurveTo(tx - 6, ty - 3.2 + gy, tx + 6, ty - 1.2 + gy, tx + 20, ty - 2.2 + gy);
    ctx.stroke();
  }
  ctx.restore();
  // Window-key catch on the near rim lip.
  ctx.strokeStyle = 'rgba(255,232,190,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(tx, ty - 2.4, 21, 8.6, 0, Math.PI * 0.62, Math.PI * 0.95);
  ctx.stroke();
  // Cafezinho: saucer, white demitasse, dark coffee, tiny handle.
  const x0 = tx - 8;
  const y0 = ty - 2;
  ellipse(ctx, x0 + 0.6, y0 + 0.8, 6.4, 2.4, 'rgba(58,34,22,0.35)');
  ellipse(ctx, x0, y0, 6, 2.3, '#fffaf2');
  ctx.strokeStyle = '#8a8070';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.ellipse(x0, y0, 6, 2.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  rrect(ctx, x0 - 3.2, y0 - 6.5, 6.4, 6.5, [0, 0, 2.6, 2.6], '#ffffff', '#6e665a', 0.6);
  ctx.strokeStyle = '#6e665a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + 3.8, y0 - 3.6, 1.5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ellipse(ctx, x0, y0 - 6.5, 3.2, 1.2, '#4a2616');
  ellipse(ctx, x0 - 0.8, y0 - 6.7, 1.3, 0.45, 'rgba(230,180,120,0.8)');
  // Three pães de queijo heaped on the right of the tray.
  for (const [dx, dy] of [[4, -1], [10, -0.4], [7, -4.2]] as const) {
    const x = tx + dx;
    const y = ty - 2 + dy;
    ellipse(ctx, x + 0.4, y + 2.2, 3.4, 1.2, 'rgba(58,34,22,0.35)');
    circle(ctx, x, y, 3.4, '#f0cc6e', 'rgba(96,44,12,0.8)', 0.7);
    circle(ctx, x - 1.1, y - 1.2, 1.1, 'rgba(255,250,225,0.9)');
  }
}

function banqueta(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 13, 5.5, 0.3);
  rrect(ctx, cx - 1.5, cy - 24, 3, 24, 1, '#b8b8c0');
  metalEdge(ctx, cx - 1, cy - 23, 21, 0.7);
  ellipse(ctx, cx, cy - 1, 8, 3.5, '#8a8a94');
  ellipse(ctx, cx - 1.5, cy - 2, 4.5, 1.4, 'rgba(255,255,255,0.35)');
  // Seat: dark underside, red cushion, a rim catching the window key from the left.
  ellipse(ctx, cx, cy - 25, 11.5, 5.2, '#8e1f30');
  ellipse(ctx, cx, cy - 27, 11, 5, '#b8283e');
  ellipse(ctx, cx, cy - 29, 11, 5, '#d8354d');
  ctx.strokeStyle = 'rgba(255,214,190,0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 29, 10.4, 4.5, 0, Math.PI * 0.8, Math.PI * 1.45);
  ctx.stroke();
  ellipse(ctx, cx - 3, cy - 30.5, 4, 1.4, 'rgba(255,255,255,0.28)');
}

function mesa(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 22, 9, 0.3);
  rrect(ctx, cx - 2, cy - 30, 4, 30, 1, '#3a3a44');
  metalEdge(ctx, cx - 1.4, cy - 29, 27, 0.8);
  ellipse(ctx, cx, cy - 1, 10, 4, '#3a3a44');
  ellipse(ctx, cx - 2, cy - 2, 5, 1.5, 'rgba(255,255,255,0.18)');
  ellipse(ctx, cx, cy - 31, 20, 9, '#d8d2c8');
  ellipse(ctx, cx, cy - 33, 20, 9, '#f2eee8');
  ellipse(ctx, cx - 5, cy - 35, 8, 2.4, 'rgba(255,255,255,0.8)');
  // Média on its saucer — the cup sits, it doesn't float.
  ellipse(ctx, cx - 5.5, cy - 34, 6.5, 2.6, 'rgba(58,34,22,0.22)');
  ellipse(ctx, cx - 5.5, cy - 35, 6, 2.4, '#fffaf2');
  ctx.strokeStyle = '#c8c0b4';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(cx - 5.5, cy - 35, 6, 2.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  rrect(ctx, cx - 9, cy - 42, 7, 7, 2, '#fff', '#c8c0b4', 0.6);
  ellipse(ctx, cx - 5.5, cy - 42, 3.3, 1, '#b58250');
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx - 1.6, cy - 38.5, 1.8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // Pão de queijo on a plate.
  ellipse(ctx, cx + 7, cy - 34, 6.5, 2.5, 'rgba(58,34,22,0.2)');
  ellipse(ctx, cx + 7, cy - 35, 6, 2.5, '#fff');
  circle(ctx, cx + 5.5, cy - 37, 2.2, '#eac566');
  circle(ctx, cx + 8.8, cy - 36.6, 2.2, '#f0cc6e');
  circle(ctx, cx + 7, cy - 38.8, 2, '#f2d27a');
  // Sugar shaker + napkin holder: the padaria table kit
  rrect(ctx, cx - 1, cy - 44, 4, 7, 1.2, 'rgba(235,242,246,0.9)', '#9aa4a8', 0.5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - 0.4, cy - 41, 2.8, 3);
  rrect(ctx, cx - 1, cy - 46, 4, 2, 1, '#b8b8c0');
  rrect(ctx, cx + 1, cy - 40, 7, 4, 1, '#b8b8c0');
  poly(ctx, [[cx + 1.5, cy - 40], [cx + 7.5, cy - 40], [cx + 7, cy - 45], [cx + 2, cy - 45]], '#fffdf7', 'rgba(0,0,0,0.15)', 0.4);
}

function cadeiraPadaria(ctx: Ctx, cx: number, cy: number, dir: Dir) {
  shadow(ctx, cx, cy, 14, 6, 0.3);
  // Seat cast: the window key is behind-left, so the seat's shadow falls forward-right of the legs.
  const [sx, sy] = iso(0.1, 0.06);
  diamond(ctx, cx + sx, cy + sy, 0.56, 0.5, 'rgba(58,34,22,0.2)');
  const legs = [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]] as [number, number][];
  for (const [dx, dy] of legs) {
    const [lx, ly] = iso(dx, dy);
    // Tight dark contact under each foot + a short cast streak away from the window.
    ellipse(ctx, cx + lx + 0.6, cy + ly + 0.2, 3.4, 1.5, 'rgba(40,22,14,0.3)');
    ellipse(ctx, cx + lx, cy + ly, 2, 0.9, 'rgba(30,16,10,0.6)');
    poly(ctx, [[cx + lx - 0.8, cy + ly], [cx + lx + 0.8, cy + ly], [cx + lx + 6, cy + ly + 2.6], [cx + lx + 4.6, cy + ly + 2.8]], 'rgba(40,22,14,0.22)');
  }
  for (const [dx, dy] of legs) {
    const [lx, ly] = iso(dx, dy);
    rrect(ctx, cx + lx - 1, cy + ly - 18, 2, 18, 1, '#2a2233');
  }
  diamond(ctx, cx, cy - 17, 0.5, 0.5, '#7a2a18');
  diamond(ctx, cx, cy - 18, 0.5, 0.5, '#b5452e', '#7a2a18');
  const [hx, hy] = iso(-0.12, -0.12);
  ellipse(ctx, cx + hx, cy + hy - 18, 5, 1.6, 'rgba(255,214,190,0.3)');
  const back: Record<Dir, [number, number]> = { SE: [-0.24, 0], SW: [0, -0.24], NE: [0, 0.24], NW: [0.24, 0] };
  if (dir === 'SE' || dir === 'SW') {
    const [bx, by] = iso(...back[dir]);
    box(ctx, cx + bx, cy + by, dir === 'SW' ? 0.5 : 0.06, dir === 'SW' ? 0.06 : 0.5, 18, '#2a2233', 18);
  }
}

function trilho(ctx: Ctx, cx: number, cy: number, t: number) {
  shadow(ctx, cx, cy, 20, 8);
  box(ctx, cx, cy, 0.8, 0.6, 36, '#6b4a2e', 0, { left: '#7d5836', right: '#553820' });
  box(ctx, cx, cy, 0.84, 0.64, 4, '#8a5a2e', 36);
  // Stacked trays waiting on the stand
  for (let k = 0; k < 3; k++) box(ctx, cx - 2, cy - 2, 0.5, 0.36, 1.6, k % 2 ? '#C45C26' : '#a94c1e', 40 + k * 1.8, { stroke: 'rgba(0,0,0,0.2)' });
  rrect(ctx, cx - 22, cy - 92, 44, 4, 2, '#c9c9c9');
  metalEdge(ctx, cx - 21, cy - 92, 1, 42);
  rrect(ctx, cx - 1.5, cy - 92, 3, 52, 1, '#8a8a8a');
  metalEdge(ctx, cx - 1, cy - 90, 48, 0.8);
  for (let i = 0; i < 3; i++) {
    const sw = Math.sin(t * 2 + i) * 1.5;
    rrect(ctx, cx - 20 + i * 14 + sw, cy - 88, 11, 16, 1, '#fffdf2', 'rgba(0,0,0,0.2)');
    ctx.fillStyle = '#c9b99c';
    ctx.fillRect(cx - 18 + i * 14 + sw, cy - 84, 7, 1.5);
    ctx.fillRect(cx - 18 + i * 14 + sw, cy - 80, 5, 1.5);
  }
  // Hanging “Me vê um…” board with a soft mustard halo so the minigame reads from across the room.
  const pulse = 0.32 + Math.sin(t * 2.2) * 0.08;
  const halo = ctx.createRadialGradient(cx, cy - 112, 4, cx, cy - 112, 54);
  halo.addColorStop(0, `rgba(242,194,48,${pulse})`);
  halo.addColorStop(1, 'rgba(242,194,48,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 56, cy - 166, 112, 110);
  ctx.strokeStyle = '#6b4a2e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy - 101);
  ctx.lineTo(cx - 14, cy - 92);
  ctx.moveTo(cx + 20, cy - 101);
  ctx.lineTo(cx + 14, cy - 92);
  ctx.stroke();
  rrect(ctx, cx - 33, cy - 120, 68, 22, 6, 'rgba(58,34,22,0.3)');
  rrect(ctx, cx - 34, cy - 122, 68, 22, 6, '#C45C26', '#2C2C2C', 1.5);
  rrect(ctx, cx - 30, cy - 104, 60, 2, 1, '#D4A017');
  ctx.font = `900 12px ${FONT_BODY}`;
  ctx.fillStyle = '#F5E6D3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ME VÊ UM…', cx, cy - 112);
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

/** Orelhão — São Paulo’s egg-shaped public phone shell. */
function orelhao(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 16, 6, 0.28);
  box(ctx, cx, cy, 0.3, 0.3, 4, '#8a8a8a');
  rrect(ctx, cx - 2, cy - 70, 4, 68, 2, '#5d5d66');
  metalEdge(ctx, cx - 1.3, cy - 68, 64, 0.9);
  // Shell
  ctx.save();
  ctx.translate(cx + 2, cy - 76);
  ctx.fillStyle = '#e8741a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c85c10';
  ctx.beginPath();
  ctx.ellipse(-2, 1, 17, 21, 0, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  // Opening facing the viewer
  ctx.fillStyle = '#3b2a22';
  ctx.beginPath();
  ctx.ellipse(4, 6, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-8, -8, 3, 7, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Phone
  rrect(ctx, 0, 0, 9, 13, 2, '#c9c9cf');
  rrect(ctx, 1.5, 2, 6, 3, 1, '#2a2233');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(1.8 + i * 2, 6.5 + j * 2.3, 1.2, 1.2);
  ctx.strokeStyle = '#2a2233';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(9, 7);
  ctx.quadraticCurveTo(13, 13, 8, 17);
  ctx.stroke();
  ctx.restore();
}

/** Blue São Paulo street sign on a pole. */
function placaRua(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 8, 3);
  rrect(ctx, cx - 1.5, cy - 104, 3, 104, 1, '#2f4a3a');
  const plate = (y: number, w: number, text: string, sub?: string) => {
    rrect(ctx, cx - w / 2, y, w, sub ? 22 : 15, 2, '#1d4f9c', '#ffffff', 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 7.5px ${FONT_BODY}`;
    ctx.fillText(text, cx, y + 7.5);
    if (sub) {
      ctx.font = `700 5.5px ${FONT_BODY}`;
      ctx.fillText(sub, cx, y + 16);
    }
  };
  plate(cy - 116, 66, 'R. DOS IPÊS', 'BAIRRO IPÊ');
  plate(cy - 92, 54, 'PRAÇA CENTRAL');
}

/** Glass height of the SALGADOS estufa (the live glass overlay in room.ts matches it). */
export const ESTUFA_GLASS_H = 34;

type Salgado = 'coxinha' | 'pastel' | 'esfiha' | 'paoqueijo' | 'empada' | 'kibe';

/**
 * One salgado at (x0, y0), its base on the tray, drawn `s`× size. Heavy ink outline so each one keeps
 * its silhouette (teardrop coxinha, ball cluster pão de queijo, crimped empada) at game scale.
 */
function salgado(ctx: Ctx, x0: number, y0: number, k: Salgado, s = 1) {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(s, s);
  const x = 0;
  const y = 0;
  const ink = 'rgba(70,28,6,0.85)';
  ellipse(ctx, x + 0.6, y + 2.6, 5.4, 1.9, 'rgba(60,24,6,0.4)');
  if (k === 'coxinha') {
    ctx.fillStyle = '#e08a34';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.bezierCurveTo(x + 6.5, y - 2, x + 5.5, y + 3, x, y + 3);
    ctx.bezierCurveTo(x - 5.5, y + 3, x - 6.5, y - 2, x, y - 8);
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, x - 1.8, y - 1.5, 1.4, 2.8, 'rgba(255,214,150,0.6)');
    circle(ctx, x, y - 7.6, 0.8, '#8a4a1a');
  } else if (k === 'pastel') {
    ctx.fillStyle = '#e8b25a';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 7.5, 4.5, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,100,40,0.8)';
    ctx.beginPath();
    for (let q = -6; q <= 6; q += 2.4) {
      ctx.moveTo(x + q, y + 1);
      ctx.lineTo(x + q * 0.9, y - 0.6);
    }
    ctx.stroke();
    ellipse(ctx, x - 2, y - 1.8, 2.6, 0.9, 'rgba(255,240,200,0.6)');
  } else if (k === 'esfiha') {
    poly(ctx, [[x - 5.5, y + 2], [x + 5.5, y + 2], [x, y - 7]], '#d99a4a', ink, 0.6);
    circle(ctx, x, y - 0.5, 1.8, '#b8423a');
    ctx.fillStyle = 'rgba(255,230,180,0.55)';
    ctx.fillRect(x - 3, y - 2.5, 1, 3);
  } else if (k === 'empada') {
    rrect(ctx, x - 4.5, y - 3.5, 9, 5.5, 1.5, '#a8621f', ink, 0.6);
    ellipse(ctx, x, y - 3.5, 4.5, 1.8, '#f6d98c');
    ellipse(ctx, x - 1.2, y - 3.9, 1.8, 0.6, 'rgba(255,252,236,0.9)');
    ctx.strokeStyle = 'rgba(140,80,30,0.6)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let q = -3; q <= 3; q += 1.5) {
      ctx.moveTo(x + q, y - 2);
      ctx.lineTo(x + q, y + 1.6);
    }
    ctx.stroke();
  } else if (k === 'kibe') {
    ctx.fillStyle = '#8a4e28';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y - 1.5, 6, 3.6, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, x - 2, y - 3, 2.2, 0.9, 'rgba(255,200,150,0.45)');
  } else {
    circle(ctx, x - 2.6, y, 2.6, '#f4d888', ink, 0.5);
    circle(ctx, x + 2.4, y + 0.4, 2.6, '#f8e09a', ink, 0.5);
    circle(ctx, x, y - 2.6, 2.5, '#fbe7a8', ink, 0.5);
    circle(ctx, x - 0.8, y - 3.4, 0.9, 'rgba(255,248,220,0.85)');
  }
  ctx.restore();
}

/**
 * Estufa — heated glass case of salgados, packed with a few big, outlined pieces rather than many tiny
 * ones (at game scale the front pane is ~25 px wide): an upper tray of three, a lower tray of two
 * staggered rows of three. Back rows first so the front rows overlap them.
 */
function estufa(ctx: Ctx, cx: number, cy: number) {
  // Taller than the vitrine so the pane (and the salgados behind it) stays readable at game scale.
  const gh = ESTUFA_GLASS_H;
  const glass = caseShell(ctx, cx, cy, gh, true);
  const trays: { dy0: number; dy1: number; lift: number; rows: { dy: number; s: number; items: [number, Salgado][] }[] }[] = [
    {
      dy0: -0.36,
      dy1: -0.1,
      lift: 40,
      rows: [{ dy: -0.22, s: 1.3, items: [[-0.3, 'paoqueijo'], [0, 'coxinha'], [0.3, 'empada']] }],
    },
    {
      dy0: -0.04,
      dy1: 0.34,
      lift: 22,
      rows: [
        { dy: 0.04, s: 1.55, items: [[-0.3, 'empada'], [0, 'paoqueijo'], [0.3, 'coxinha']] },
        { dy: 0.24, s: 1.85, items: [[-0.27, 'coxinha'], [0.02, 'paoqueijo'], [0.3, 'empada']] },
      ],
    },
  ];
  for (const tr of trays) {
    const [tx, ty] = iso(0, (tr.dy0 + tr.dy1) / 2);
    const tray = box(ctx, cx + tx, cy + ty, 0.92, tr.dy1 - tr.dy0, 2, '#c8ccd2', tr.lift - 2, { left: '#9ea3ac', right: '#80858e', stroke: 'rgba(40,44,52,0.6)' });
    poly(ctx, tray.top, '#f4ead6');
    for (const row of tr.rows) {
      for (const [dx, k] of row.items) {
        const [ox, oy] = iso(dx, row.dy);
        salgado(ctx, cx + ox, cy + oy - tr.lift, k, row.s);
      }
    }
  }
  caseGlass(ctx, glass);
  caseLid(ctx, cx, cy, 22 + gh);
  // Nudged left so the trilho's hanging comandas (next tile) don't cover the sign.
  label(ctx, 'SALGADOS', cx - 13, cy - 60, '#b5452e', '#fff', 7);
}

function tatameMat(ctx: Ctx, cx: number, cy: number, w: number, h: number) {
  shadow(ctx, cx, cy, 44 * w, 20 * h, 0.28);
  // Terracotta safety border framing the hero mat, just proud of the floor mats.
  const [mx, my] = iso(((w - 1) * 0.92) / 2, ((h - 1) * 0.92) / 2);
  box(ctx, cx + mx, cy + my, (w - 1) * 0.92 + 1.26, (h - 1) * 0.92 + 1.26, 4, TB_TERRACOTTA, 0, { left: '#a44a1e', right: '#8a3c16', stroke: 'rgba(44,44,44,0.45)' });
  const light = '#3a8a5c';
  const dark = '#2f5f7a';
  for (let dx = 0; dx < w; dx++)
    for (let dy = 0; dy < h; dy++) {
      const [ox, oy] = iso(dx * 0.92, dy * 0.92);
      const base = (dx + dy) % 2 ? dark : light;
      box(ctx, cx + ox, cy + oy, 0.9, 0.9, 3, base, 2);
      if (dx > 0) {
        ctx.strokeStyle = 'rgba(30,50,40,0.35)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx + ox - 6, cy + oy);
        ctx.lineTo(cx + ox - 6, cy + oy - 10);
        ctx.stroke();
      }
    }
  ctx.font = `800 5.5px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ACADEMIA DO BAIRRO', cx, cy - Math.max(8, h * 3.5));
}

const TB_TERRACOTTA = '#C45C26';
const TB_WOOD = '#8B5E3C';
const TB_INK = '#2C2C2C';
const TB_GREEN = '#2F5D50';
const TB_MUSTARD = '#D4A017';
const TB_CONCRETE = '#9A9A92';

/**
 * Run `draw` in a wall-aligned frame: x runs along the wall in screen px, y is screen-up height.
 * `slope` is -0.5 for planes facing +x (the left wall), +0.5 for planes facing +y (the right wall).
 */
function onPlane(ctx: Ctx, ox: number, oy: number, slope: number, draw: () => void) {
  ctx.save();
  ctx.transform(1, slope, 0, 1, ox, oy);
  draw();
  ctx.restore();
}

function planeText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, weight = 900) {
  ctx.font = `${weight} ${size}px ${FONT_BODY}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/** A belt draped over a peg: band across the board, knot, and two tails; black belt gets its red bar. */
function draped(ctx: Ctx, x: number, y: number, w: number, color: string, black = false) {
  const edge = color === '#f7f4ec' ? 'rgba(44,44,44,0.7)' : 'rgba(0,0,0,0.35)';
  rrect(ctx, x - w / 2, y, w, 5, 2, color, edge, 0.8);
  for (const [dx, len] of [[-3, 13], [3, 11]] as const) {
    rrect(ctx, x + dx - 2, y + 3, 4, len, 1.5, color, edge, 0.8);
    if (black) rrect(ctx, x + dx - 2, y + len - 4, 4, 4, 1, '#c23b2e');
  }
  rrect(ctx, x - 3.5, y - 1, 7, 7, 2, color, edge, 0.8);
  circle(ctx, x, y - 3, 1.6, '#b8b0a2');
}

/** Parede de faixas — a wall-hung belt board over a cubby of folded gis, on the left wall. */
function paredeFaixas(ctx: Ctx, cx: number, cy: number) {
  const [wx, wy] = iso(-0.46, 0);
  onPlane(ctx, cx + wx, cy + wy, -0.5, () => {
    rrect(ctx, -27, -126, 58, 98, 4, 'rgba(58,34,22,0.22)');
    rrect(ctx, -30, -130, 60, 98, 4, TB_WOOD, TB_INK, 1.4);
    rrect(ctx, -26, -112, 52, 76, 2, '#efe0c6');
    rrect(ctx, -30, -130, 60, 18, [4, 4, 0, 0], TB_GREEN, TB_INK, 1.4);
    planeText(ctx, 'FAIXAS', 0, -121, 11, '#F5E6D3');
    const belts: [string, boolean][] = [
      ['#f7f4ec', false],
      ['#2b5ba8', false],
      ['#7a4fb0', false],
      ['#6b3f24', false],
      ['#2a2a2e', true],
    ];
    belts.forEach(([c, black], i) => draped(ctx, i % 2 ? 9 : -9, -106 + i * 13, 26, c, black));
    ctx.fillStyle = 'rgba(255,240,210,0.35)';
    ctx.fillRect(-26, -112, 3, 76);
  });
  // Cubby shelf on the floor under the board, with folded gis (white, blue, white).
  const [bx, by] = iso(-0.26, 0);
  shadow(ctx, cx + bx, cy + by, 30, 13, 0.26);
  const shelf = box(ctx, cx + bx, cy + by, 0.44, 1.6, 26, TB_WOOD, 0, { left: '#9a6a45', right: '#6f4a2e', stroke: 'rgba(44,44,44,0.45)' });
  for (let k = 1; k < 4; k++) {
    const a = lerp2(shelf.S, shelf.E, k / 4);
    poly(ctx, [[a[0] - 0.6, a[1]], [a[0] + 0.6, a[1]], [a[0] + 0.6, a[1] - 26], [a[0] - 0.6, a[1] - 26]], 'rgba(40,24,12,0.45)');
  }
  const gis = ['#fbf8f1', '#3f6ea8', '#fbf8f1'];
  gis.forEach((c, i) => {
    const [gx, gy] = iso(-0.26, -0.5 + i * 0.5);
    for (let k = 0; k < 2; k++) box(ctx, cx + gx, cy + gy, 0.3, 0.34, 4, c, 26 + k * 4, { stroke: 'rgba(44,44,44,0.35)' });
  });
}

/** Fila do tatame — a tall lectern clipboard facing the approach tile, with a big ROLAR plate. */
function quadroFila(ctx: Ctx, cx: number, cy: number, t: number) {
  shadow(ctx, cx, cy, 26, 12, 0.28);
  box(ctx, cx, cy, 0.7, 0.44, 6, '#6f4a2e', 0, { stroke: 'rgba(44,44,44,0.45)' });
  box(ctx, cx, cy, 0.14, 0.14, 62, TB_WOOD, 6, { stroke: 'rgba(44,44,44,0.45)' });
  const [fx, fy] = iso(0, 0.1);
  onPlane(ctx, cx + fx, cy + fy, 0.5, () => {
    rrect(ctx, -23, -128, 50, 66, 4, 'rgba(58,34,22,0.25)');
    rrect(ctx, -26, -132, 52, 66, 4, '#9a6a45', TB_INK, 1.4);
    rrect(ctx, -22, -126, 44, 56, 2, '#fffdf7', 'rgba(44,44,44,0.35)', 0.8);
    rrect(ctx, -9, -136, 18, 9, 2, TB_MUSTARD, TB_INK, 1);
    planeText(ctx, 'FILA DO', 0, -118, 8, TB_INK);
    planeText(ctx, 'TATAME', 0, -109, 9.5, TB_INK);
    for (let i = 0; i < 3; i++) {
      const y = -99 + i * 7;
      circle(ctx, -15, y, 2.2, i === 0 ? '#3a8a5c' : '#fff', 'rgba(44,44,44,0.6)', 0.7);
      rrect(ctx, -10, y - 1.2, i === 0 ? 26 : 20 - i * 3, 2.4, 1, 'rgba(44,44,44,0.45)');
    }
    const pulse = 0.5 + Math.sin(t * 2.4) * 0.5;
    rrect(ctx, -19, -81, 38, 10, 5, '#3a8a5c');
    circle(ctx, -13.5, -76, 1.8 + pulse * 0.8, '#d8f5c0');
    planeText(ctx, 'ABERTO', 3, -76, 6.5, '#fff', 800);
    // ROLAR plate on its own post above the board — the room's call to action.
    rrect(ctx, -1.5, -150, 3, 16, 1, '#6f4a2e');
    rrect(ctx, -26, -166, 52, 18, 5, 'rgba(58,34,22,0.3)');
    rrect(ctx, -27, -168, 52, 18, 5, TB_TERRACOTTA, TB_INK, 1.4);
    planeText(ctx, 'ROLAR', -1, -158.5, 11, '#F5E6D3');
  });
}

function quadroFoto(ctx: Ctx, cx: number, cy: number) {
  shadow(ctx, cx, cy, 18, 8, 0.2);
  box(ctx, cx, cy, 0.3, 0.7, 42, '#8B5E3C', 8);
  rrect(ctx, cx - 11, cy - 38, 22, 18, 2, '#d8cbb6', '#6a5040', 1);
  rrect(ctx, cx - 9, cy - 36, 18, 14, 1, '#3a6f8c');
  circle(ctx, cx - 3, cy - 30, 3, '#f5f2ea');
  circle(ctx, cx + 4, cy - 28, 3, '#f5f2ea');
  label(ctx, 'ACAD. DO BAIRRO', cx, cy - 48, '#2f4f6f', '#fff', 5);
}

/**
 * Spectator bleacher: a front seat step at the default sit height (17, so seated avatars line up) and a
 * taller back step with a rail, a towel and a squeeze bottle. Runs along the tile axis perpendicular to
 * the seat's facing.
 */
function bancoEspectador(ctx: Ctx, cx: number, cy: number, dir: Dir = 'SW') {
  const face: Record<Dir, [number, number]> = { SE: [1, 0], SW: [0, 1], NE: [0, -1], NW: [-1, 0] };
  const [fx, fy] = face[dir];
  const alongX = fy !== 0;
  const L = 1.25;
  const D = 0.42;
  const ext = (a: number, d: number): [number, number] => (alongX ? [a, d] : [d, a]);
  const wood = { left: '#9a6a45', right: '#6f4a2e', stroke: 'rgba(44,44,44,0.45)' };
  const frame = { left: '#8e8a82', right: '#6e6a64', stroke: 'rgba(44,44,44,0.4)' };
  const step = (k: number, lift: number) => {
    const [ox, oy] = iso(-fx * D * k, -fy * D * k);
    const x = cx + ox;
    const y = cy + oy;
    box(ctx, x, y, ...ext(L * 0.96, D * 0.9), lift - 4, TB_CONCRETE, 0, frame);
    const top = box(ctx, x, y, ...ext(L, D), 4, TB_WOOD, lift - 4, wood).top;
    woodTop(ctx, top, 20 + k);
    return { x, y };
  };
  shadow(ctx, cx + iso(-fx * 0.2, -fy * 0.2)[0], cy + iso(-fx * 0.2, -fy * 0.2)[1], 42, 18, 0.26);
  const steps = [
    { k: 1, lift: 34 },
    { k: 0, lift: 17 },
  ];
  if (fx + fy < 0) steps.reverse();
  let back = { x: cx, y: cy };
  for (const s of steps) {
    const at = step(s.k, s.lift);
    if (s.k === 1) {
      back = at;
      const [rx, ry] = iso(-fx * D * 0.45, -fy * D * 0.45);
      for (const e of [-0.55, 0.55]) {
        const [px, py] = iso(...ext(e, 0));
        rrect(ctx, back.x + rx + px - 1.5, back.y + ry + py - 58, 3, 24, 1, '#5d5d66');
      }
      box(ctx, back.x + rx, back.y + ry, ...ext(L * 0.98, 0.06), 4, TB_TERRACOTTA, 54, { stroke: 'rgba(44,44,44,0.5)' });
      // Mustard towel folded over the step edge + a squeeze bottle.
      const [tx, ty] = iso(...ext(-0.3, 0));
      box(ctx, back.x + tx, back.y + ty, ...ext(0.3, 0.34), 3, TB_MUSTARD, 34, { stroke: 'rgba(44,44,44,0.35)' });
      const [qx, qy] = iso(...ext(0.32, 0));
      rrect(ctx, back.x + qx - 3, back.y + qy - 48, 6, 12, 2.5, '#3aa6a0', 'rgba(44,44,44,0.5)', 0.8);
      rrect(ctx, back.x + qx - 1.5, back.y + qy - 51, 3, 3, 1, '#fff');
    }
  }
}

/** Vestiário · alongamento — a bank of lockers on the left wall with a rolled stretch mat beside it. */
function vestiario(ctx: Ctx, cx: number, cy: number) {
  const [bx, by] = iso(-0.31, 0.2);
  shadow(ctx, cx + bx, cy + by, 26, 12, 0.28);
  const lk = box(ctx, cx + bx, cy + by, 0.34, 0.74, 80, '#7f97a8', 0, { top: '#9fb3c1', left: '#8aa1b2', right: '#6c8292', stroke: 'rgba(44,44,44,0.5)' });
  const w = lk.E[0] - lk.S[0];
  onPlane(ctx, lk.S[0], lk.S[1], -0.5, () => {
    const dw = (w - 4) / 3;
    for (let i = 0; i < 3; i++) {
      const x0 = 2 + i * dw;
      rrect(ctx, x0 + 0.6, -62, dw - 1.2, 56, 1.5, undefined, 'rgba(30,40,50,0.55)', 0.9);
      for (let k = 0; k < 3; k++) rrect(ctx, x0 + 2.5, -57 + k * 3, dw - 5, 1.2, 0.5, 'rgba(30,40,50,0.45)');
      rrect(ctx, x0 + dw - 3.5, -36, 2, 6, 1, i === 1 ? TB_MUSTARD : '#d8dde2');
    }
    rrect(ctx, 1, -77, w - 2, 12, 2, '#4a5560', TB_INK, 1);
    planeText(ctx, 'VESTIÁRIO', w / 2, -71, 6.5, '#F5E6D3');
  });
  // Rolled stretch mat standing on end next to the lockers.
  const [mx, my] = iso(0.08, 0.42);
  shadow(ctx, cx + mx, cy + my, 8, 4, 0.3);
  rrect(ctx, cx + mx - 5, cy + my - 38, 10, 38, 5, TB_TERRACOTTA, TB_INK, 1);
  ellipse(ctx, cx + mx, cy + my - 36, 4.4, 2.2, '#e27a45');
  ctx.strokeStyle = '#8a3c16';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx + mx, cy + my - 36, 2.4, 1.1, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Scale a prop about its floor anchor. */
function scaled(ctx: Ctx, cx: number, cy: number, s: number, draw: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

export function drawProp(ctx: Ctx, p: PropDef, cx: number, cy: number, t: number, slice = 0, opts: { parrotAdopted?: boolean } = {}) {
  switch (p.kind) {
    case 'ipe':
      return ipe(ctx, cx, cy, t, p.hero ? 1.35 : 1);
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
    case 'orelhao':
      return orelhao(ctx, cx, cy);
    case 'placa_rua':
      return placaRua(ctx, cx, cy);
    case 'estufa':
      return estufa(ctx, cx, cy);
    case 'mesa_cafe':
      return mesaCafe(ctx, cx, cy);
    case 'jornais':
      return jornais(ctx, cx, cy);
    case 'saco_lixo':
      return sacoLixo(ctx, cx, cy);
    case 'floreira':
      return floreira(ctx, cx, cy);
    case 'tatame':
      if (slice === 0) return tatameMat(ctx, cx, cy, p.w ?? 1, p.h ?? 1);
      return;
    case 'parede_faixas':
      return paredeFaixas(ctx, cx, cy);
    case 'quadro_fila':
      return quadroFila(ctx, cx, cy, t);
    case 'banco_espectador':
      return bancoEspectador(ctx, cx, cy, p.seat ?? 'SW');
    case 'vestiario':
      return vestiario(ctx, cx, cy);
    case 'quadro_foto':
      return scaled(ctx, cx, cy, 1.5, () => quadroFoto(ctx, cx, cy));
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
      const wood = { top: shade(c, 0.18), left: shade(c, 0.02), right: shade(c, -0.14), stroke: 'rgba(60,30,10,0.35)' };
      const [bx, by] = iso(...((dir === 'SE' ? [-0.24, 0] : [0, -0.24]) as [number, number]));
      const back = () => {
        box(ctx, cx + bx, cy + by, dir === 'SW' ? 0.52 : 0.07, dir === 'SW' ? 0.07 : 0.52, 24, c, 20, wood);
        const [sx, sy] = iso(...((dir === 'SE' ? [-0.2, 0] : [0, -0.2]) as [number, number]));
        rrect(ctx, cx + sx - 6, cy + sy - 36, 12, 3, 1, shade(c, 0.3));
      };
      back();
      box(ctx, cx, cy, 0.52, 0.52, 4, c, 16, wood);
      break;
    }
    case 'poltrona': {
      shadow(ctx, cx, cy, 24, 10, 0.2);
      const fabric = { top: shade(c, 0.2), left: shade(c, 0.02), right: shade(c, -0.16), stroke: 'rgba(20,50,30,0.35)' };
      const se = dir === 'SE';
      const at = (dx: number, dy: number) => iso(...((se ? [dx, dy] : [dy, dx]) as [number, number]));
      const ext = (ax: number, ay: number): [number, number] => (se ? [ax, ay] : [ay, ax]);
      // Back first, then the far arm, seat + cushion, and the near arm last.
      const [bx, by] = at(-0.3, 0);
      box(ctx, cx + bx, cy + by, ...ext(0.2, 0.84), 40, c, 0, fabric);
      const [fx, fy] = at(0.02, se ? -0.34 : -0.34);
      box(ctx, cx + fx, cy + fy, ...ext(0.62, 0.16), 26, c, 0, fabric);
      const [kx, ky] = at(0.06, 0);
      box(ctx, cx + kx, cy + ky, ...ext(0.6, 0.54), 16, c, 0, fabric);
      box(ctx, cx + kx, cy + ky, ...ext(0.56, 0.5), 5, shade(c, 0.12), 16, { ...fabric, top: shade(c, 0.3) });
      const [nx, ny] = at(0.02, 0.34);
      box(ctx, cx + nx, cy + ny, ...ext(0.62, 0.16), 26, c, 0, fabric);
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
    case 'rede': {
      // Hammock between two posts, striped like the ones sold at the feira.
      shadow(ctx, cx, cy, 28, 9, 0.15);
      const along: [number, number] = rot === 0 ? [0.42, 0] : [0, 0.42];
      const [ax, ay] = iso(-along[0], -along[1]);
      const [bx, by] = iso(along[0], along[1]);
      rrect(ctx, cx + ax - 2, cy + ay - 44, 4, 44, 1, '#6a3f22');
      rrect(ctx, cx + bx - 2, cy + by - 44, 4, 44, 1, '#6a3f22');
      const stripes = [c, '#f2c230', '#2e9e5b', '#2b5ba8', '#f4efe6'];
      ctx.lineCap = 'round';
      stripes.forEach((col, i) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx + ax, cy + ay - 38 + i * 1.5);
        ctx.quadraticCurveTo(cx + (ax + bx) / 2, cy + (ay + by) / 2 - 2 + i * 2.6, cx + bx, cy + by - 38 + i * 1.5);
        ctx.stroke();
      });
      ctx.strokeStyle = '#f4efe6';
      ctx.lineWidth = 0.8;
      for (let k = 1; k < 8; k++) {
        const f = k / 8;
        const px = cx + ax + (bx - ax) * f;
        const py = cy + ay + (by - ay) * f - 26 + Math.sin(f * Math.PI) * 14;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + 5);
        ctx.stroke();
      }
      break;
    }
    case 'filtro': {
      // Filtro de barro: two stacked clay chambers with a little tap.
      shadow(ctx, cx, cy, 16, 6);
      box(ctx, cx, cy, 0.55, 0.55, 18, '#8a5433');
      const clay = c;
      rrect(ctx, cx - 11, cy - 44, 22, 24, 7, clay);
      ellipse(ctx, cx, cy - 44, 11, 4, shade(clay, 0.12));
      rrect(ctx, cx - 10, cy - 64, 20, 20, 7, shade(clay, 0.05));
      ellipse(ctx, cx, cy - 64, 10, 3.5, shade(clay, 0.18));
      circle(ctx, cx, cy - 67, 2.5, shade(clay, -0.2));
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 60);
      ctx.lineTo(cx - 6, cy - 48);
      ctx.stroke();
      rrect(ctx, cx + 8, cy - 28, 6, 3, 1, '#c9c9cf');
      rrect(ctx, cx + 12, cy - 28, 2, 5, 1, '#c9c9cf');
      rrect(ctx, cx - 17, cy - 26, 6, 7, 1, '#ffffff', '#c8c0b4');
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

const furnitureIconCache = new Map<string, string>();
/** Pooled canvas for icon rendering to prevent allocation thrash. */
let iconCanvas: HTMLCanvasElement | null = null;
const MAX_ICON_CACHE = 64;

export function furnitureIcon(itemId: string, size = 80): string {
  const baked = spriteUrl(`furniture/${itemId}_0`);
  if (baked) return baked;
  const cacheKey = `${itemId}@${size}`;
  const cached = furnitureIconCache.get(cacheKey);
  if (cached) return cached;
  const def = furnitureById(itemId);
  const dpr = 2;
  const w = size * dpr;
  const h = size * dpr;
  // Reuse pooled canvas if it fits; only reallocate when needed
  if (!iconCanvas || iconCanvas.width < w || iconCanvas.height < h) {
    iconCanvas = document.createElement('canvas');
    iconCanvas.width = Math.max(w, 160);
    iconCanvas.height = Math.max(h, 160);
  }
  const ctx = iconCanvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, iconCanvas.width, iconCanvas.height);
  ctx.scale(dpr, dpr);
  if (def) {
    ctx.translate(size / 2, size * 0.78);
    const s = size / 90;
    ctx.scale(s, s);
    drawFurniture(ctx, def, 0, 0, 0, 1);
  }
  // Draw only the portion we need to the data URL
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(iconCanvas, 0, 0, w, h, 0, 0, w, h);
  const url = out.toDataURL();
  // Evict oldest entries when cache grows too large
  if (furnitureIconCache.size >= MAX_ICON_CACHE) {
    const first = furnitureIconCache.keys().next().value;
    if (first) furnitureIconCache.delete(first);
  }
  furnitureIconCache.set(cacheKey, url);
  return url;
}

/** Clear furniture icon cache on room change to free memory. */
export function clearFurnitureIconCache() {
  furnitureIconCache.clear();
}
