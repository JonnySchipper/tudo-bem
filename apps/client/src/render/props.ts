import { furnitureById, type Dir, type FurnitureDef, type PropDef } from '@tudobem/shared';
import { box, circle, diamond, ellipse, FONT_BODY, FONT_TITLE, grain, iso, metalEdge, poly, rrect, shade, shadow, type Ctx } from './draw';
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

/** Glass streaks on a box face (W→S or S→E base edge, extruded up by h). */
function glassStreaks(ctx: Ctx, a: Pt, b: Pt, h: number, lift: number) {
  const up = (p: Pt, k: number): Pt => [p[0], p[1] - lift - h * k];
  for (const [f0, w] of [[0.18, 0.1], [0.36, 0.04]] as const) {
    const p1 = up(lerp2(a, b, f0), 0.05);
    const p2 = up(lerp2(a, b, f0 + w), 0.05);
    const p3 = up(lerp2(a, b, f0 + w + 0.22), 0.95);
    const p4 = up(lerp2(a, b, f0 + 0.22), 0.95);
    poly(ctx, [p1, p2, p3, p4], 'rgba(255,255,255,0.55)');
  }
}

function balcaoSlice(ctx: Ctx, cx: number, cy: number, i: number, n: number) {
  box(ctx, cx, cy, 1.0, 0.8, 38, '#a8662f', 0, { left: '#b5452e', right: '#8e3620', stroke: 'rgba(0,0,0,0.12)' });
  // Wood-grain kick panel on the customer side
  const [kx, ky] = iso(0, 0.4);
  ctx.save();
  ctx.transform(1, -0.5, 0, 1, cx + kx - 16, cy + ky + 8);
  grain(ctx, 0, -40, 32, 30, 'rgba(70,25,10,0.3)', 'rgba(255,190,150,0.18)', i, true);
  ctx.restore();
  const top = box(ctx, cx, cy, 1.02, 0.92, 5, '#efe9e1', 38, { stroke: 'rgba(0,0,0,0.1)' }).top;
  // Marble veining + the toldo's soft stripe shadow falling across the counter top.
  ctx.save();
  ctx.beginPath();
  top.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,140,130,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy - 44 + i);
  ctx.bezierCurveTo(cx - 8, cy - 48, cx + 4, cy - 40, cx + 24, cy - 45 - i);
  ctx.stroke();
  const [N, E, S, W] = top as [Pt, Pt, Pt, Pt];
  for (let k = 0; k < 4; k += 2) {
    poly(ctx, [lerp2(N, E, k / 4), lerp2(N, E, (k + 1) / 4), lerp2(W, S, (k + 1) / 4), lerp2(W, S, k / 4)], 'rgba(90,45,20,0.13)');
  }
  ctx.restore();
  const [lx, ly] = iso(0, 0.4);
  rrect(ctx, cx + lx - 12, cy + ly - 30, 24, 3, 1, '#f2c230');
  if (i === 0) {
    // Açucareiro + canela shakers
    for (const [dx, cap] of [[-6, '#b8b8c0'], [0, '#C45C26']] as const) {
      rrect(ctx, cx + dx - 2.5, cy - 52, 5, 8, 1.5, 'rgba(235,242,246,0.9)', '#9aa4a8', 0.6);
      ctx.fillStyle = dx ? '#fff' : '#8a5a3c';
      ctx.fillRect(cx + dx - 1.8, cy - 48, 3.6, 3.5);
      rrect(ctx, cx + dx - 2.5, cy - 54, 5, 2.5, 1, cap);
    }
  }
  if (i === 1) {
    ellipse(ctx, cx - 4, cy - 47, 9, 4, '#d9913f');
    ellipse(ctx, cx - 6, cy - 49, 4, 1.4, 'rgba(255,230,170,0.6)');
    ellipse(ctx, cx + 8, cy - 46, 7, 3, '#e8a94f');
  }
  if (i === 2) {
    // Porta-guardanapo with a stack of paper napkins
    rrect(ctx, cx - 6, cy - 50, 12, 6, 1, '#b8b8c0', '#8a8a92', 0.6);
    for (let k = 0; k < 4; k++) poly(ctx, [[cx - 5 + k * 0.6, cy - 50 - k * 1.2], [cx + 5 + k * 0.6, cy - 50 - k * 1.2], [cx + 4 + k * 0.6, cy - 56 - k * 1.2], [cx - 4 + k * 0.6, cy - 56 - k * 1.2]], k % 2 ? '#fffdf7' : '#f1ece2', 'rgba(0,0,0,0.12)', 0.4);
  }
  if (i === n - 2) {
    rrect(ctx, cx - 6, cy - 55, 10, 12, 2, '#fff6e6', '#2a2233');
    ctx.fillStyle = '#6b3f1f';
    ctx.fillRect(cx - 5, cy - 52, 8, 3);
  }
}

function vitrineSlice(ctx: Ctx, cx: number, cy: number, i: number) {
  box(ctx, cx, cy, 1.0, 0.8, 22, '#d6cfc4', 0, { stroke: 'rgba(0,0,0,0.12)' });
  const glass = box(ctx, cx, cy, 0.96, 0.76, 24, 'rgba(197,213,222,0.35)', 22, { left: 'rgba(197,213,222,0.42)', right: 'rgba(160,190,210,0.5)', stroke: 'rgba(110,150,180,0.7)' });
  const sweets = i === 0 ? ['#f2d27a', '#e889a8', '#f4efe6', '#c77b3a'] : ['#c77b3a', '#f2c230', '#8a4a2a', '#e889a8'];
  for (let row = 0; row < 2; row++)
    sweets.forEach((c, k) => {
      const [dx, dy] = iso(-0.3 + k * 0.2, row ? -0.15 : 0.12);
      ellipse(ctx, cx + dx, cy + dy - 29 - row * 2, 5, 3, row ? shade(c, -0.08) : c);
      ellipse(ctx, cx + dx - 1, cy + dy - 30 - row * 2, 3, 1.2, 'rgba(255,255,255,0.5)');
    });
  // Cool specular on the glass: 1–2 highlight streaks per face.
  glassStreaks(ctx, glass.W, glass.S, 24, 22);
  glassStreaks(ctx, glass.S, glass.E, 24, 22);
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
  ellipse(ctx, cx - 5, cy - 35, 8, 2.4, 'rgba(255,255,255,0.8)');
  rrect(ctx, cx - 9, cy - 42, 7, 8, 2, '#fff', '#c8c0b4');
  ellipse(ctx, cx + 7, cy - 35, 6, 2.5, '#fff');
  ellipse(ctx, cx + 7, cy - 37, 3.5, 2, '#e8a94f');
  // Sugar shaker + napkin holder: the padaria table kit
  rrect(ctx, cx - 1, cy - 44, 4, 7, 1.2, 'rgba(235,242,246,0.9)', '#9aa4a8', 0.5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - 0.4, cy - 41, 2.8, 3);
  rrect(ctx, cx - 1, cy - 46, 4, 2, 1, '#b8b8c0');
  rrect(ctx, cx + 1, cy - 40, 7, 4, 1, '#b8b8c0');
  poly(ctx, [[cx + 1.5, cy - 40], [cx + 7.5, cy - 40], [cx + 7, cy - 45], [cx + 2, cy - 45]], '#fffdf7', 'rgba(0,0,0,0.15)', 0.4);
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

/** Estufa — heated glass case of salgados. */
function estufa(ctx: Ctx, cx: number, cy: number) {
  box(ctx, cx, cy, 1.0, 0.8, 22, '#d6cfc4', 0, { stroke: 'rgba(0,0,0,0.12)' });
  const warmGlass = box(ctx, cx, cy, 0.96, 0.76, 26, 'rgba(255,196,120,0.4)', 22, { left: 'rgba(255,190,110,0.42)', right: 'rgba(240,170,90,0.45)', stroke: 'rgba(180,120,60,0.6)' });
  const salgados: [number, number, 'coxinha' | 'pastel' | 'esfiha'][] = [
    [-0.28, -0.2, 'esfiha'],
    [-0.02, -0.22, 'coxinha'],
    [0.24, -0.2, 'esfiha'],
    [-0.14, -0.04, 'coxinha'],
    [0.12, -0.04, 'pastel'],
    [-0.3, 0.12, 'coxinha'],
    [-0.04, 0.14, 'pastel'],
    [0.22, 0.12, 'coxinha'],
  ];
  for (const [dx, dy, k] of salgados) {
    const [ox, oy] = iso(dx, dy);
    const x = cx + ox;
    const y = cy + oy - 30;
    if (k === 'coxinha') {
      ctx.fillStyle = '#d0822f';
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.bezierCurveTo(x + 6, y - 2, x + 5, y + 3, x, y + 3);
      ctx.bezierCurveTo(x - 5, y + 3, x - 6, y - 2, x, y - 7);
      ctx.fill();
    } else if (k === 'pastel') {
      ctx.fillStyle = '#e8b25a';
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 3.5, 0, Math.PI, 0);
      ctx.lineTo(x - 7, y);
      ctx.fill();
      ctx.fillRect(x - 7, y - 0.5, 14, 2);
    } else {
      ctx.fillStyle = '#d99a4a';
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 2);
      ctx.lineTo(x + 5, y + 2);
      ctx.lineTo(x, y - 6);
      ctx.closePath();
      ctx.fill();
      circle(ctx, x, y - 0.5, 1.6, '#b8423a');
    }
  }
  glassStreaks(ctx, warmGlass.W, warmGlass.S, 26, 22);
  box(ctx, cx, cy, 1.0, 0.8, 3, '#efe9e1', 48, { stroke: 'rgba(0,0,0,0.1)' });
  const g = ctx.createRadialGradient(cx, cy - 40, 2, cx, cy - 36, 26);
  g.addColorStop(0, 'rgba(255,190,90,0.35)');
  g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 26, cy - 62, 52, 40);
  label(ctx, 'SALGADOS', cx, cy - 58, '#b5452e', '#fff', 7);
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

export function furnitureIcon(itemId: string, size = 80): string {
  const baked = spriteUrl(`furniture/${itemId}_0`);
  if (baked) return baked;
  const cacheKey = `${itemId}@${size}`;
  const cached = furnitureIconCache.get(cacheKey);
  if (cached) return cached;
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
  const url = canvas.toDataURL();
  furnitureIconCache.set(cacheKey, url);
  return url;
}
