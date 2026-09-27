import { floorAt, type PortalDef, type RoomDef, type WallDecor, type WallSide } from '@tudobem/shared';
import { HH, HW, tileCenter, toScreen } from './iso';
import { box, circle, ellipse, FONT_BODY, FONT_TITLE, grain, hash, poly, rrect, shade, type Ctx } from './draw';

/** Sub-tile diamond (i, j) of an n×n split of tile (x, y). */
function subDiamond(ctx: Ctx, x: number, y: number, i: number, j: number, n: number, fill: string) {
  const a = toScreen(x + i / n, y + j / n);
  const b = toScreen(x + (i + 1) / n, y + j / n);
  const c = toScreen(x + (i + 1) / n, y + (j + 1) / n);
  const d = toScreen(x + i / n, y + (j + 1) / n);
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(b.sx, b.sy);
  ctx.lineTo(c.sx, c.sy);
  ctx.lineTo(d.sx, d.sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  // Cover anti-alias seams.
  ctx.strokeStyle = fill;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/** Run `draw` with the unit square [0,1]² mapped onto tile (x, y). */
export function onTile(ctx: Ctx, x: number, y: number, draw: () => void) {
  const o = toScreen(x, y);
  ctx.save();
  ctx.transform(HW, HH, -HW, HH, o.sx, o.sy);
  draw();
  ctx.restore();
}

/** Ladrilho hidráulico — the cement floor tile of old São Paulo padarias. */
export function drawLadrilho(ctx: Ctx) {
  ctx.fillStyle = '#efe3c8';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillStyle = '#5a9690';
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 0.27, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#efe3c8';
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 0.19, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#cf7456';
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  // Four-petal flower
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(0.5, 0.5);
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.ellipse(0.15, 0, 0.13, 0.065, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#cf7456';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0.32, 0);
    ctx.lineTo(0.42, -0.05);
    ctx.lineTo(0.5, 0);
    ctx.lineTo(0.42, 0.05);
    ctx.closePath();
    ctx.fillStyle = '#5a9690';
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0.5, 0.5, 0.06, 0, Math.PI * 2);
  ctx.fillStyle = '#e0a82e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,40,0.28)';
  ctx.lineWidth = 0.02;
  ctx.strokeRect(0, 0, 1, 1);
}

/** Taco — the small hardwood block parquet of Brazilian apartments. */
export function drawTaco(ctx: Ctx, x: number, y: number) {
  const woods = ['#b98555', '#a8743f', '#c39461', '#9c6a38'];
  const n = 2;
  const s = 1 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const horizontal = (i + j + x + y) % 2 === 0;
      for (let k = 0; k < 3; k++) {
        const c = woods[Math.floor(hash(x * 7 + i * 3 + k, y * 7 + j * 3, 5) * woods.length)];
        ctx.fillStyle = shade(c, (hash(x + i, y + j + k, 2) - 0.5) * 0.12);
        if (horizontal) ctx.fillRect(i * s, j * s + (k * s) / 3, s, s / 3);
        else ctx.fillRect(i * s + (k * s) / 3, j * s, s / 3, s);
        // Grain: two-tone strokes along each block.
        ctx.lineWidth = 0.006;
        for (let g = 0; g < 3; g++) {
          const f = (g + 0.5 + (hash(x + k, y + g, i + j) - 0.5) * 0.6) / 3;
          ctx.strokeStyle = g % 2 ? 'rgba(80,45,20,0.28)' : 'rgba(255,230,190,0.22)';
          ctx.beginPath();
          if (horizontal) {
            const gy = j * s + (k * s) / 3 + (f * s) / 3;
            ctx.moveTo(i * s, gy);
            ctx.quadraticCurveTo(i * s + s / 2, gy + (hash(k, g, x) - 0.5) * 0.03, i * s + s, gy);
          } else {
            const gx = i * s + (k * s) / 3 + (f * s) / 3;
            ctx.moveTo(gx, j * s);
            ctx.quadraticCurveTo(gx + (hash(g, k, y) - 0.5) * 0.03, j * s + s / 2, gx, j * s + s);
          }
          ctx.stroke();
        }
      }
      ctx.strokeStyle = 'rgba(70,40,15,0.35)';
      ctx.lineWidth = 0.012;
      for (let k = 1; k < 3; k++) {
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(i * s, j * s + (k * s) / 3);
          ctx.lineTo(i * s + s, j * s + (k * s) / 3);
        } else {
          ctx.moveTo(i * s + (k * s) / 3, j * s);
          ctx.lineTo(i * s + (k * s) / 3, j * s + s);
        }
        ctx.stroke();
      }
      ctx.lineWidth = 0.02;
      ctx.strokeRect(i * s, j * s, s, s);
    }
}

/**
 * Outline of São Paulo state in a unit square — the motif of the city's black-and-white
 * sidewalk mosaic (Mirthes Bernardes, 1966). The Copacabana wave is Rio's, not ours.
 */
export const SP_MAP: [number, number][] = [
  [0.08, 0.47], [0.19, 0.37], [0.31, 0.34], [0.42, 0.26], [0.53, 0.24], [0.63, 0.15], [0.74, 0.16],
  [0.83, 0.24], [0.93, 0.29], [0.9, 0.41], [0.81, 0.5], [0.71, 0.59], [0.6, 0.67], [0.5, 0.78],
  [0.42, 0.73], [0.38, 0.62], [0.29, 0.58], [0.19, 0.56], [0.11, 0.53],
];

function insideMap(u: number, v: number) {
  let inside = false;
  for (let i = 0, j = SP_MAP.length - 1; i < SP_MAP.length; j = i++) {
    const [xi, yi] = SP_MAP[i];
    const [xj, yj] = SP_MAP[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Calçada paulista laid as petit-pavé: small limestone stones with grout, and the charcoal
 * São Paulo state map set into every other 2×2 block — so the motif reads as mosaic, not stickers.
 */
export function drawCalcadaSP(ctx: Ctx, x: number, y: number) {
  const n = 6;
  const bx = x - (((x % 2) + 2) % 2);
  const by = y - (((y % 2) + 2) % 2);
  const motif = ((bx / 2 + by / 2) & 1) === 0;
  ctx.fillStyle = '#c9bca5';
  ctx.fillRect(0, 0, 1, 1);
  const s = 1 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const r = hash(x * n + i, y * n + j, 13);
      const u = (x - bx + (i + 0.5) / n) / 2;
      const v = (y - by + (j + 0.5) / n) / 2;
      const dark = motif && insideMap(u, v);
      const base = dark ? '#3d3833' : '#ebe2cf';
      ctx.fillStyle = shade(base, dark ? (r - 0.5) * 0.35 : -r * 0.09);
      const jx = (hash(i, j, x * 31 + y) - 0.5) * 0.02;
      const jy = (hash(j, i, y * 17 + x) - 0.5) * 0.02;
      ctx.fillRect(i * s + 0.012 + jx, j * s + 0.012 + jy, s - 0.024, s - 0.024);
      if (!dark && r > 0.82) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(i * s + 0.02, j * s + 0.02, s * 0.35, s * 0.18);
      }
    }
}

/** Raised concrete curb on the sides of a grass bed that meet paving. */
function drawCurbs(ctx: Ctx, room: RoomDef, x: number, y: number) {
  const other = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= room.cols || ny >= room.rows) return false;
    return floorAt(room, nx, ny) !== 'grama';
  };
  const w = 0.09;
  ctx.fillStyle = '#d9d0bf';
  if (other(0, -1)) ctx.fillRect(0, 0, 1, w);
  if (other(-1, 0)) ctx.fillRect(0, 0, w, 1);
  ctx.fillStyle = '#cdc3b0';
  if (other(0, 1)) ctx.fillRect(0, 1 - w, 1, w);
  if (other(1, 0)) ctx.fillRect(1 - w, 0, w, 1);
  ctx.fillStyle = 'rgba(70,50,30,0.25)';
  if (other(0, -1)) ctx.fillRect(0, w, 1, 0.02);
  if (other(-1, 0)) ctx.fillRect(w, 0, 0.02, 1);
  if (other(0, 1)) ctx.fillRect(0, 1 - w - 0.02, 1, 0.02);
  if (other(1, 0)) ctx.fillRect(1 - w - 0.02, 0, 0.02, 1);
}

export function drawFloorTile(ctx: Ctx, room: RoomDef, x: number, y: number) {
  const kind = floorAt(room, x, y);
  switch (kind) {
    case 'ladrilho':
      onTile(ctx, x, y, () => {
        drawLadrilho(ctx);
        // Cement tiles wear unevenly: faint value shift per tile + a waxed sheen streak.
        const r = hash(x, y, 21);
        ctx.fillStyle = r > 0.5 ? `rgba(255,248,230,${(r - 0.5) * 0.22})` : `rgba(90,60,40,${(0.5 - r) * 0.12})`;
        ctx.fillRect(0, 0, 1, 1);
        // Grout depth: recessed shadow on the back edges, a lit bevel just inside them.
        ctx.fillStyle = 'rgba(70,45,28,0.22)';
        ctx.fillRect(0, 0, 1, 0.022);
        ctx.fillRect(0, 0, 0.022, 1);
        ctx.fillStyle = 'rgba(255,250,236,0.28)';
        ctx.fillRect(0.022, 0.022, 0.976, 0.014);
        ctx.fillRect(0.022, 0.022, 0.014, 0.976);
        if (hash(x, y, 22) > 0.6) {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.moveTo(0.1, 0.55);
          ctx.lineTo(0.55, 0.1);
          ctx.lineTo(0.7, 0.1);
          ctx.lineTo(0.1, 0.7);
          ctx.fill();
        }
      });
      break;
    case 'calcada':
      onTile(ctx, x, y, () => drawCalcadaSP(ctx, x, y));
      break;
    case 'grama': {
      const n = 3;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const r = hash(x * 5 + i, y * 5 + j, 3);
          subDiamond(ctx, x, y, i, j, n, shade('#5f9a45', (r - 0.5) * 0.14));
        }
      // Blade tufts: dark stems with a sunlit tip (key light from upper-left).
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (let k = 0; k < 14; k++) {
        const c = toScreen(x + 0.1 + hash(x, y, 20 + k) * 0.8, y + 0.1 + hash(y, x, 40 + k) * 0.8);
        const hgt = 2.5 + hash(k, x + y, 7) * 2.5;
        ctx.strokeStyle = hash(k, x, y) > 0.5 ? '#4a7f35' : '#3f7030';
        ctx.beginPath();
        ctx.moveTo(c.sx, c.sy);
        ctx.lineTo(c.sx - 1, c.sy - hgt);
        ctx.stroke();
        ctx.strokeStyle = '#9cc76a';
        ctx.beginPath();
        ctx.moveTo(c.sx + 1.5, c.sy);
        ctx.lineTo(c.sx + 1, c.sy - hgt * 0.7);
        ctx.stroke();
      }
      if (hash(x, y, 9) > 0.62) {
        const c = toScreen(x + 0.3 + hash(x, y, 4) * 0.4, y + 0.3 + hash(x, y, 5) * 0.4);
        circle(ctx, c.sx, c.sy, 1.8, hash(x, y, 6) > 0.5 ? '#f2c230' : '#fff6e6');
        circle(ctx, c.sx + 4, c.sy + 1.5, 1.4, '#f2c230');
      }
      onTile(ctx, x, y, () => drawCurbs(ctx, room, x, y));
      break;
    }
    case 'tijolo': {
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < 2; j++) {
          const r = hash(x * 3 + i, y * 3 + j, 2);
          const a = toScreen(x + i / n, y + j / 2);
          const b = toScreen(x + (i + 1) / n, y + j / 2);
          const c = toScreen(x + (i + 1) / n, y + (j + 1) / 2);
          const d = toScreen(x + i / n, y + (j + 1) / 2);
          poly(ctx, [[a.sx, a.sy], [b.sx, b.sy], [c.sx, c.sy], [d.sx, d.sy]], shade('#b8573a', (r - 0.5) * 0.18), 'rgba(80,30,20,0.35)', 0.8);
        }
      break;
    }
    case 'xadrez': {
      const n = 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) subDiamond(ctx, x, y, i, j, n, (i + j) % 2 ? '#c8553d' : '#f4ead5');
      break;
    }
    case 'madeira':
      onTile(ctx, x, y, () => drawTaco(ctx, x, y));
      break;
    case 'asfalto':
      subDiamond(ctx, x, y, 0, 0, 1, '#5a5a60');
      break;
  }
}

/** Run `draw` in the plane of a wall segment. Local u ∈ [0, len·HW] runs left→right on screen; v ≤ 0 goes up. */
export function onWall(ctx: Ctx, side: WallSide, from: number, to: number, draw: (L: number) => void) {
  ctx.save();
  if (side === 'left') {
    const o = toScreen(0, to);
    ctx.transform(1, -0.5, 0, 1, o.sx, o.sy);
  } else {
    const o = toScreen(from, 0);
    ctx.transform(1, 0.5, 0, 1, o.sx, o.sy);
  }
  draw((to - from) * HW);
  ctx.restore();
}

function wallText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string, opts: { font?: string; outline?: string; align?: CanvasTextAlign; maxW?: number } = {}) {
  ctx.font = `800 ${size}px ${opts.font ?? FONT_TITLE}`;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (opts.outline) {
    ctx.lineWidth = Math.max(2, size / 6);
    ctx.strokeStyle = opts.outline;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y, opts.maxW);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, opts.maxW);
}

/**
 * One loaf on a shelf, bottom at y. `tone` darkens the back row; the key light from the left
 * window gives every loaf a warm rim on its left shoulder and a lip shadow where it sits.
 */
function drawLoaf(ctx: Ctx, type: number, bx: number, y: number, tone: number, s: number) {
  const c = (hex: string) => (tone ? shade(hex, tone) : hex);
  ellipse(ctx, bx + 0.8, y - 0.4, 5.5 * s, 1.4, 'rgba(58,30,12,0.34)');
  const rim = (x: number, yy: number, rx: number, ry: number) => {
    ctx.strokeStyle = 'rgba(255,206,120,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, yy, rx, ry, 0, Math.PI * 0.95, Math.PI * 1.5);
    ctx.stroke();
  };
  switch (type) {
    case 0: {
      // Pão francês with its slashes
      ellipse(ctx, bx, y - 4.5 * s, 6.5 * s, 4.5 * s, c('#c97f35'));
      rim(bx, y - 4.5 * s, 6 * s, 4 * s);
      ctx.strokeStyle = c('#9a5a22');
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(bx - 3, y - 7 * s);
      ctx.lineTo(bx - 1, y - 3 * s);
      ctx.moveTo(bx + 1, y - 7 * s);
      ctx.lineTo(bx + 3, y - 3 * s);
      ctx.stroke();
      break;
    }
    case 1:
      // Pile of pães de queijo
      circle(ctx, bx - 3, y - 3.5, 3.5 * s, c('#eac566'));
      circle(ctx, bx + 3, y - 3.5, 3.5 * s, c('#e2bb58'));
      circle(ctx, bx, y - 8 * s, 3.3 * s, c('#f0cc6e'));
      rim(bx - 3, y - 3.5, 3 * s, 3 * s);
      rim(bx, y - 8 * s, 2.8 * s, 2.8 * s);
      break;
    case 2: {
      // Bisnagas leaning on each other
      for (const [dx, rot, col] of [[0, -0.5, '#d18c42'], [3, -0.3, '#c47d36']] as const) {
        ctx.save();
        ctx.translate(bx + dx, y - 7 * s);
        ctx.rotate(rot);
        rrect(ctx, -2.5, -8 * s, 5, 16 * s, 2.5, c(col));
        ctx.fillStyle = 'rgba(255,206,120,0.55)';
        ctx.fillRect(-2.2, -7 * s, 1, 13 * s);
        ctx.restore();
      }
      break;
    }
    case 3:
      // Pão de forma
      rrect(ctx, bx - 5, y - 12 * s, 10, 12 * s, 3, c('#b87a3a'));
      rrect(ctx, bx - 5, y - 12 * s, 10, 4, 3, c('#9c5f28'));
      ctx.fillStyle = 'rgba(255,206,120,0.55)';
      ctx.fillRect(bx - 5, y - 10 * s, 1.2, 9 * s);
      break;
    case 4:
      // Round pão italiano with a cross score
      ellipse(ctx, bx, y - 5 * s, 6 * s, 5.4 * s, c('#a9652c'));
      rim(bx, y - 5 * s, 5.5 * s, 5 * s);
      ctx.strokeStyle = c('#e8c38a');
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(bx - 3, y - 6 * s);
      ctx.lineTo(bx + 3, y - 6 * s);
      ctx.moveTo(bx, y - 8.5 * s);
      ctx.lineTo(bx, y - 3.5 * s);
      ctx.stroke();
      break;
    case 5: {
      // Croissant
      ctx.fillStyle = c('#d6953f');
      ctx.beginPath();
      ctx.ellipse(bx, y - 2.5, 6.5 * s, 4 * s, 0, Math.PI, 0);
      ctx.lineTo(bx + 3, y - 1);
      ctx.ellipse(bx, y - 1, 3, 1.5, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c('#a8682a');
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const q of [-3, 0, 3]) {
        ctx.moveTo(bx + q - 0.8, y - 6 * s);
        ctx.lineTo(bx + q + 0.8, y - 2);
      }
      ctx.stroke();
      rim(bx, y - 2.5, 6 * s, 3.6 * s);
      break;
    }
    case 7: {
      // Wicker cesto of bisnagas standing on end — the tallest silhouette on the shelf.
      for (const [dx, h, rot, col] of [[-3, 17, -0.18, '#c98239'], [0, 19, 0.02, '#d18c42'], [3, 16, 0.2, '#bf7532']] as const) {
        ctx.save();
        ctx.translate(bx + dx, y - 5);
        ctx.rotate(rot);
        rrect(ctx, -1.8, -h * s, 3.6, h * s, 1.8, c(col));
        ctx.fillStyle = 'rgba(255,206,120,0.6)';
        ctx.fillRect(-1.5, -h * s + 1.5, 0.9, h * s - 4);
        ctx.restore();
      }
      rrect(ctx, bx - 6, y - 6, 12, 6, [1, 1, 3, 3], c('#a8743c'), 'rgba(70,38,16,0.6)', 0.6);
      ctx.strokeStyle = 'rgba(70,38,16,0.45)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (const q of [-3, 0, 3]) {
        ctx.moveTo(bx + q, y - 6);
        ctx.lineTo(bx + q, y);
      }
      ctx.moveTo(bx - 6, y - 3);
      ctx.lineTo(bx + 6, y - 3);
      ctx.stroke();
      break;
    }
    case 8:
      // Two pães de forma stacked in their paper sleeve — a squat, tall block.
      rrect(ctx, bx - 5, y - 9 * s, 10, 9 * s, 2, c('#b87a3a'));
      rrect(ctx, bx - 4.5, y - 18 * s, 9, 9 * s, 3, c('#c4893f'));
      rrect(ctx, bx - 4.5, y - 18 * s, 9, 3, 3, c('#9c5f28'));
      ctx.fillStyle = 'rgba(245,230,211,0.85)';
      ctx.fillRect(bx - 5, y - 6 * s, 10, 3);
      ctx.fillStyle = 'rgba(255,206,120,0.55)';
      ctx.fillRect(bx - 4.5, y - 16 * s, 1.1, 14 * s);
      break;
    default:
      // Sonho dusted with sugar, a peek of creme
      ellipse(ctx, bx, y - 4 * s, 5.5 * s, 4 * s, c('#d59a4c'));
      ellipse(ctx, bx, y - 5.5 * s, 4.5 * s, 2 * s, 'rgba(255,250,240,0.75)');
      ellipse(ctx, bx + 2, y - 3.2, 2, 1.2, c('#f6e3a0'));
      rim(bx, y - 4 * s, 5 * s, 3.6 * s);
  }
}

function drawDecor(ctx: Ctx, room: RoomDef, d: WallDecor) {
  const H = room.wallHeight;
  onWall(ctx, d.wall, d.from, d.to, (L) => {
    switch (d.kind) {
      case 'predio': {
        rrect(ctx, 0, -H, L, H, 0, d.wall === 'left' ? '#c9bda8' : '#d6cab5');
        const cols = Math.max(1, Math.round(L / 28));
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < cols; c++) {
            const wx = (c + 0.5) * (L / cols) - 9;
            const wy = -H + 18 + r * 44;
            rrect(ctx, wx - 2, wy - 2, 22, 30, 2, '#8d7f6a');
            const lit = hash(c, r, d.from) > 0.55;
            rrect(ctx, wx, wy, 18, 26, 1, lit ? '#ffd98a' : '#7fa9c9');
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(wx + 2, wy + 2, 5, 22);
            if (hash(c, r, 7) > 0.6) {
              rrect(ctx, wx - 3, wy + 24, 24, 5, 1, '#6d6150');
              circle(ctx, wx + 4, wy + 22, 4, '#3f8a3a');
              circle(ctx, wx + 12, wy + 21, 5, '#4fa347');
            }
          }
        if (d.text) {
          rrect(ctx, L / 2 - 52, -44, 104, 18, 3, '#2a2233');
          wallText(ctx, d.text, L / 2, -35, 11, '#f2c230');
        }
        break;
      }
      case 'fachada_padaria': {
        rrect(ctx, 0, -H, L, H, 0, '#f7d98b');
        rrect(ctx, 0, -H, L, 8, 0, '#b5452e');
        // Sign board
        rrect(ctx, 8, -H + 12, L - 16, 30, 6, '#fff6e6', '#b5452e', 3);
        wallText(ctx, d.text ?? 'PADARIA', L / 2, -H + 27, 15, '#b5452e', { maxW: L - 30 });
        // Striped awning
        const aw = -H + 48;
        for (let i = 0; i < L / 12; i++) {
          ctx.fillStyle = i % 2 ? '#fff6e6' : '#d8452b';
          ctx.fillRect(i * 12, aw, 12, 16);
          ctx.beginPath();
          ctx.arc(i * 12 + 6, aw + 16, 6, 0, Math.PI);
          ctx.fill();
        }
        // Display windows with bread
        for (const wx of [8, L - 44]) {
          rrect(ctx, wx, -72, 36, 42, 3, '#8a5a2e');
          rrect(ctx, wx + 3, -69, 30, 36, 2, '#fff0c9');
          for (let k = 0; k < 3; k++) {
            ellipse(ctx, wx + 10 + k * 8, -40, 5, 3, '#d9913f');
            ellipse(ctx, wx + 12 + k * 7, -53, 4, 2.6, '#e8a94f');
          }
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(wx + 5, -67, 4, 30);
        }
        break;
      }
      case 'mural': {
        const g = ctx.createLinearGradient(0, -H, L, 0);
        if (d.text === 'SAMPA') {
          // Mural-coral accent wall (palette.md) — the one wall that pops.
          g.addColorStop(0, '#E07A5F');
          g.addColorStop(0.55, '#d8683f');
          g.addColorStop(1, '#C45C26');
        } else {
          g.addColorStop(0, '#2F5D50');
          g.addColorStop(1, '#3d7560');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, -H, L, H);
        // Painted sunburst rays behind the sun
        ctx.save();
        ctx.translate(L * 0.78, -H * 0.68);
        ctx.fillStyle = 'rgba(255,230,160,0.18)';
        for (let i = 0; i < 12; i++) {
          ctx.rotate(Math.PI / 6);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(90, -9);
          ctx.lineTo(90, 9);
          ctx.fill();
        }
        ctx.restore();
        circle(ctx, L * 0.78, -H * 0.68, 26, '#D4A017');
        circle(ctx, L * 0.78, -H * 0.68, 19, '#f2c230');
        circle(ctx, L * 0.78 - 6, -H * 0.68 - 6, 7, 'rgba(255,245,200,0.5)');
        for (let i = 0; i < 9; i++) {
          ctx.save();
          ctx.translate(L * (0.06 + hash(i, 1, d.from) * 0.88), -14 - hash(i, 2, d.from) * 54);
          ctx.rotate(hash(i, 3) * 3);
          ellipse(ctx, 0, 0, 17, 6.5, i % 3 === 0 ? '#1f4a3e' : i % 3 === 1 ? '#2F5D50' : '#4f8a6a');
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(-14, 0);
          ctx.lineTo(14, 0);
          ctx.stroke();
          ctx.restore();
        }
        if (d.text === 'SAMPA') {
          // Skyline silhouette + heart
          ctx.fillStyle = 'rgba(60,24,16,0.4)';
          let x = 10;
          while (x < L * 0.6) {
            const w = 12 + hash(x, 1) * 18;
            const h = 30 + hash(x, 2) * 55;
            ctx.fillRect(x, -26 - h, w, h);
            x += w + 3;
          }
          wallText(ctx, 'SAMPA', L * 0.42, -H * 0.5, 44, '#fff6e6', { outline: '#2a2233' });
          ctx.fillStyle = '#e889a8';
          ctx.beginPath();
          const hx = L * 0.9;
          const hy = -34;
          ctx.moveTo(hx, hy + 8);
          ctx.bezierCurveTo(hx - 14, hy - 4, hx - 6, hy - 16, hx, hy - 6);
          ctx.bezierCurveTo(hx + 6, hy - 16, hx + 14, hy - 4, hx, hy + 8);
          ctx.fill();
          // Toucan
          const tx = L * 0.2;
          const ty = -H * 0.72;
          ellipse(ctx, tx, ty, 12, 15, '#1b1b1f');
          ellipse(ctx, tx + 2, ty - 4, 7, 7, '#fff6e6');
          ctx.fillStyle = '#f08a24';
          ctx.beginPath();
          ctx.moveTo(tx + 8, ty - 8);
          ctx.quadraticCurveTo(tx + 34, ty - 6, tx + 26, ty + 2);
          ctx.quadraticCurveTo(tx + 16, ty + 1, tx + 8, ty - 2);
          ctx.fill();
          circle(ctx, tx + 4, ty - 6, 2, '#2a2233');
        } else {
          rrect(ctx, 12, -H + 22, L - 24, 50, 18, '#fff6e6', '#2a2233', 3);
          ctx.fillStyle = '#fff6e6';
          ctx.beginPath();
          ctx.moveTo(30, -H + 70);
          ctx.lineTo(24, -H + 88);
          ctx.lineTo(48, -H + 71);
          ctx.fill();
          wallText(ctx, d.text ?? '', L / 2, -H + 47, 20, '#e5572f', { maxW: L - 34 });
        }
        // Tags / paint drips
        for (let i = 0; i < 5; i++) rrect(ctx, hash(i, 9, d.to) * L, -H, 3, 10 + hash(i, 8) * 20, 2, 'rgba(255,255,255,0.25)');
        break;
      }
      case 'metro': {
        rrect(ctx, 0, -H, L, H, 0, '#e9e6df');
        for (let i = 0; i < L / 10; i++) for (let j = 0; j < H / 10; j++) if ((i + j) % 2) ctx.fillRect(i * 10, -H + j * 10, 10, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(0, -H, L, H);
        const lines = ['#2b5ba8', '#2e9e5b', '#c23b4e', '#f2c230'];
        lines.forEach((c, i) => rrect(ctx, 0, -H + 50 + i * 7, L, 5, 0, c));
        rrect(ctx, L / 2 - 50, -H + 12, 100, 30, 4, '#1c2a55');
        wallText(ctx, d.text ?? 'METRÔ', L / 2, -H + 27, 16, '#ffffff');
        // Closed gate
        rrect(ctx, L / 2 - 30, -70, 60, 70, 3, '#3a3a44');
        ctx.strokeStyle = '#8a8a96';
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(L / 2 - 26 + i * 9, -66);
          ctx.lineTo(L / 2 - 26 + i * 9, 0);
          ctx.stroke();
        }
        rrect(ctx, L / 2 - 34, -40, 68, 16, 4, '#f2c230');
        wallText(ctx, 'EM BREVE', L / 2, -32, 10, '#2a2233', { font: FONT_BODY });
        // Lambe-lambe posters and stickers pasted on the hoarding either side of the gate.
        const posters: [number, number, number, number, string, string][] = [
          [8, -76, 22, 30, '#F5E6D3', '#C45C26'],
          [26, -64, 18, 24, '#D4A017', '#2a2233'],
          [10, -40, 20, 26, '#2F5D50', '#F5E6D3'],
          [L - 34, -80, 24, 30, '#E07A5F', '#F5E6D3'],
          [L - 30, -44, 20, 24, '#F5E6D3', '#2F5D50'],
        ];
        posters.forEach(([px, py, pw, ph, bg, fg], i) => {
          ctx.save();
          ctx.translate(px + pw / 2, py + ph / 2);
          ctx.rotate((hash(i, 5) - 0.5) * 0.12);
          rrect(ctx, -pw / 2 + 1, -ph / 2 + 1.5, pw, ph, 1, 'rgba(0,0,0,0.18)');
          rrect(ctx, -pw / 2, -ph / 2, pw, ph, 1, bg);
          ctx.fillStyle = fg;
          ctx.fillRect(-pw / 2 + 3, -ph / 2 + 4, pw - 6, 4);
          for (let k = 0; k < 3; k++) ctx.fillRect(-pw / 2 + 3, -ph / 2 + 11 + k * 4, (pw - 6) * (0.5 + hash(i, k) * 0.5), 1.5);
          if (i % 2 === 0) circle(ctx, pw / 2 - 5, ph / 2 - 5, 3, fg);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(-pw / 2, -ph / 2, pw * 0.3, 1);
          ctx.restore();
        });
        for (let i = 0; i < 6; i++) circle(ctx, 6 + hash(i, 1, 9) * (L - 12), -12 - hash(i, 2, 9) * 16, 2.2, ['#f2c230', '#E07A5F', '#2F5D50', '#fff6e6'][i % 4]);
        break;
      }
      case 'toldo': {
        // Striped valance over the counter; its shadow falls on the counter top (props.ts).
        const y0 = -H + 34;
        const sw = 12;
        const n = Math.floor(L / sw);
        const shadeG = ctx.createLinearGradient(0, y0 + 12, 0, y0 + 32);
        shadeG.addColorStop(0, 'rgba(70,35,15,0.26)');
        shadeG.addColorStop(1, 'rgba(70,35,15,0)');
        ctx.fillStyle = shadeG;
        ctx.fillRect(0, y0 + 10, n * sw, 22);
        const scallops = () => {
          ctx.beginPath();
          ctx.moveTo(0, y0);
          ctx.lineTo(n * sw, y0);
          ctx.lineTo(n * sw, y0 + 10);
          for (let i = n - 1; i >= 0; i--) ctx.arc(i * sw + sw / 2, y0 + 10, sw / 2, 0, Math.PI);
          ctx.closePath();
        };
        ctx.save();
        scallops();
        ctx.clip();
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i % 2 ? '#fbf1e0' : '#C45C26';
          ctx.fillRect(i * sw, y0, sw, 17);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, y0, n * sw, 2);
        ctx.fillStyle = 'rgba(90,40,15,0.18)';
        ctx.fillRect(0, y0 + 8, n * sw, 9);
        ctx.restore();
        scallops();
        ctx.strokeStyle = 'rgba(90,50,25,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
        rrect(ctx, -2, y0 - 3, n * sw + 4, 4, 1, '#8B5E3C');
        break;
      }
      case 'foto': {
        // One framed family photo: a sunny afternoon in the praça.
        const fw = Math.min(L - 16, 48);
        const fx = (L - fw) / 2;
        const fy = -H + 34;
        const fh = 38;
        ctx.strokeStyle = 'rgba(80,50,30,0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(fx + 6, fy);
        ctx.lineTo(L / 2, fy - 10);
        ctx.lineTo(fx + fw - 6, fy);
        ctx.stroke();
        circle(ctx, L / 2, fy - 10, 1.6, '#8B5E3C');
        rrect(ctx, fx + 2, fy + 3, fw, fh, 2, 'rgba(60,35,20,0.2)');
        rrect(ctx, fx, fy, fw, fh, 2, '#8B5E3C');
        grain(ctx, fx, fy, fw, fh, 'rgba(60,30,10,0.35)', 'rgba(255,220,170,0.2)', 3);
        rrect(ctx, fx + 4, fy + 4, fw - 8, fh - 8, 1, '#F5E6D3');
        const px = fx + 7;
        const py = fy + 7;
        const pw = fw - 14;
        const ph = fh - 14;
        const sky = ctx.createLinearGradient(0, py, 0, py + ph);
        sky.addColorStop(0, '#A8C5D4');
        sky.addColorStop(1, '#f1dcc0');
        ctx.fillStyle = sky;
        ctx.fillRect(px, py, pw, ph);
        ctx.fillStyle = '#9A9A92';
        ctx.fillRect(px, py + ph - 5, pw, 5);
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(px + pw * 0.72, py + ph - 14, 1.6, 10);
        circle(ctx, px + pw * 0.72, py + ph - 16, 5, '#f2c230');
        circle(ctx, px + pw * 0.72 - 3, py + ph - 14, 3, '#D4A017');
        for (const [dx, c] of [[0.25, '#C45C26'], [0.42, '#2F5D50']] as const) {
          circle(ctx, px + pw * dx, py + ph - 12, 2.2, '#8a5a3c');
          rrect(ctx, px + pw * dx - 2.4, py + ph - 10, 4.8, 6, 1.5, c);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + pw * 0.35, py);
        ctx.lineTo(px, py + ph * 0.6);
        ctx.fill();
        break;
      }
      case 'azulejos': {
        // Glazed terracotta wainscot with cream grout and a mustard cap (palette.md: cream + terracotta).
        const top = -46;
        const s = 11.5;
        rrect(ctx, 0, top, L, -top, 0, '#C45C26');
        for (let i = 0; i < L / s; i++)
          for (let j = 0; j < 4; j++) {
            const x = i * s;
            const y = top + j * s;
            ctx.fillStyle = shade('#C45C26', (i + j) % 2 ? -0.07 : 0.05);
            ctx.fillRect(x, y, s, s);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(x + 1.5, y + 1.5, s * 0.35, 1.4);
            ctx.strokeStyle = 'rgba(245,230,211,0.7)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x, y, s, s);
            if ((i + j) % 2 === 0) {
              ctx.fillStyle = '#F5E6D3';
              ctx.beginPath();
              ctx.moveTo(x, y - 2);
              ctx.lineTo(x + 2, y);
              ctx.lineTo(x, y + 2);
              ctx.lineTo(x - 2, y);
              ctx.closePath();
              ctx.fill();
            }
          }
        // Value bands: the glaze catches more light near the cap and falls off toward the floor.
        const bands = ctx.createLinearGradient(0, top, 0, 0);
        bands.addColorStop(0, 'rgba(255,226,190,0.12)');
        bands.addColorStop(0.45, 'rgba(255,226,190,0)');
        bands.addColorStop(1, 'rgba(70,24,8,0.22)');
        ctx.fillStyle = bands;
        ctx.fillRect(0, top, L, -top);
        rrect(ctx, 0, top - 5, L, 5, 0, '#D4A017');
        ctx.fillStyle = 'rgba(255,245,210,0.45)';
        ctx.fillRect(0, top - 5, L, 1);
        rrect(ctx, 0, top - 0.2, L, 1.4, 0, shade('#C45C26', -0.35));
        rrect(ctx, 0, top - 6, L, 1.2, 0, '#8B5E3C');
        break;
      }
      case 'prateleira_paes': {
        // Sign: ink edge + soft drop so it hangs in space.
        rrect(ctx, 6, -H + 11, L - 8, 24, 5, 'rgba(58,34,22,0.28)');
        rrect(ctx, 4, -H + 8, L - 8, 24, 5, '#b5452e', '#2C2C2C', 1.2);
        ctx.fillStyle = 'rgba(255,220,180,0.3)';
        ctx.fillRect(8, -H + 10, L - 16, 1.2);
        wallText(ctx, d.text ?? '', L / 2, -H + 20, 12, '#fff6e6', { maxW: L - 20 });
        // Soft fill into the shelves: warm at the window end, falling off along the run so the far
        // shelves sit back (drawWallFalloff cools them further) and the bread glows against the plaster.
        const fill = ctx.createLinearGradient(0, 0, L, 0);
        fill.addColorStop(0, 'rgba(255,214,150,0.3)');
        fill.addColorStop(0.55, 'rgba(255,214,150,0.1)');
        fill.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = fill;
        ctx.fillRect(0, -H + 36, L, 100);
        // Coffee corner behind Seu Carlos: bule + stacked xícaras on the bottom shelf.
        const cafe0 = 30;
        const cafe1 = 86;
        for (let s = 0; s < 3; s++) {
          const y = -H + 66 + s * 24;
          // Back wall shadow of the shelf bracket + plank.
          ctx.fillStyle = 'rgba(58,34,22,0.12)';
          ctx.fillRect(6, y - 16, L - 12, 16);
          for (const bx of [10, L / 2, L - 14]) rrect(ctx, bx, y + 4, 3, 7, 1, '#5e3a1c');
          const coffee = s === 2;
          // Back row (darker, a touch higher) then front row, shapes varied by hash — never one repeated sprite.
          for (const row of [0, 1]) {
            for (let k = 0; k < (L - 14) / 9; k++) {
              const bx = 11 + k * 9 + (row ? 4.5 : 0) + (hash(k, s, row + 3) - 0.5) * 2;
              if (coffee && bx > cafe0 - 4 && bx < cafe1 + 4) continue;
              if (bx > L - 9) continue;
              // Every so often a tall piece (cesto of bisnagas / stacked forma) breaks the skyline.
              const tall = hash(k, s * 5 + row, 23);
              const type = tall > 0.84 ? (tall > 0.92 ? 7 : 8) : Math.floor(hash(k * 3 + row, s * 7 + 1, 17) * 7);
              drawLoaf(ctx, type, bx, y - (row ? 0 : 2.5), row ? 0 : -0.14, type >= 7 ? 0.9 : 0.78 + hash(k, s, row) * 0.5);
            }
          }
          if (coffee) {
            // Bule (enamel pot)
            ellipse(ctx, cafe0 + 8, y - 0.5, 8, 1.8, 'rgba(58,34,22,0.35)');
            rrect(ctx, cafe0 + 1, y - 15, 14, 15, [4, 4, 3, 3], '#e9e2d4', '#2C2C2C', 0.8);
            rrect(ctx, cafe0 + 3, y - 18, 10, 4, 2, '#C45C26', '#2C2C2C', 0.6);
            ctx.strokeStyle = '#2C2C2C';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(cafe0 + 15, y - 12);
            ctx.quadraticCurveTo(cafe0 + 21, y - 10, cafe0 + 15, y - 4);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect(cafe0 + 3, y - 13, 1.4, 10);
            // Steam
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cafe0 + 8, y - 20);
            ctx.bezierCurveTo(cafe0 + 5, y - 24, cafe0 + 11, y - 26, cafe0 + 7, y - 31);
            ctx.stroke();
            // Two stacks of xícaras on pires
            for (const [sx, n] of [[cafe0 + 28, 3], [cafe0 + 44, 2]] as const) {
              ellipse(ctx, sx, y - 0.5, 7, 1.6, 'rgba(58,34,22,0.3)');
              for (let q = 0; q < n; q++) {
                const cy = y - 1 - q * 6;
                ellipse(ctx, sx, cy, 6.5, 1.6, q % 2 ? '#F5E6D3' : '#fffaf2');
                rrect(ctx, sx - 4, cy - 5, 8, 5, [0, 0, 3, 3], q === n - 1 ? '#C45C26' : '#fffaf2', 'rgba(44,44,44,0.5)', 0.5);
              }
            }
            // Hanging canecas under the shelf above
            for (let q = 0; q < 3; q++) {
              const hx = cafe0 + 8 + q * 16;
              ctx.strokeStyle = '#5e3a1c';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(hx, y - 24 + 5);
              ctx.lineTo(hx, y - 24 + 8);
              ctx.stroke();
              rrect(ctx, hx - 3.5, y - 24 + 8, 7, 7, [1, 1, 2.5, 2.5], q === 1 ? '#2F5D50' : '#fffaf2', 'rgba(44,44,44,0.5)', 0.5);
            }
          }
          // Plank with grain, lit front lip, and a soft shadow under it.
          rrect(ctx, 6, y, L - 12, 5, 1, '#7a4a24');
          grain(ctx, 6, y, L - 12, 5, 'rgba(60,30,10,0.4)', 'rgba(255,220,170,0.25)', s);
          ctx.fillStyle = 'rgba(255,214,160,0.45)';
          ctx.fillRect(6, y, L - 12, 1);
          const under = ctx.createLinearGradient(0, y + 5, 0, y + 12);
          under.addColorStop(0, 'rgba(58,30,12,0.34)');
          under.addColorStop(1, 'rgba(58,30,12,0)');
          ctx.fillStyle = under;
          ctx.fillRect(6, y + 5, L - 12, 7);
        }
        break;
      }
      case 'lousa': {
        rrect(ctx, 8, -H + 14, L - 16, 88, 4, '#7a4a24');
        rrect(ctx, 13, -H + 19, L - 26, 78, 2, '#243b2e');
        wallText(ctx, d.text ?? 'CARDÁPIO', L / 2, -H + 30, 13, '#fff6e6');
        const items: [string, number][] = [
          ['Pão na chapa', 6],
          ['Pão de queijo', 5],
          ['Coxinha', 7],
          ['Café com leite', 5],
          ['Suco de laranja', 8],
          ['Cafezinho', 3],
        ];
        ctx.font = `700 7.5px ${FONT_BODY}`;
        items.forEach(([name, p], i) => {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#e8f3e9';
          ctx.fillText(name, 17, -H + 44 + i * 9.5, L - 52);
          ctx.textAlign = 'right';
          ctx.fillStyle = '#f2c230';
          ctx.fillText(String(p), L - 17, -H + 44 + i * 9.5);
        });
        break;
      }
      case 'relogio': {
        const cx = L / 2;
        const cy = -H + 40;
        circle(ctx, cx, cy, 14, '#fff6e6', '#b5452e', 3);
        const now = new Date();
        const hA = ((now.getHours() % 12) / 12) * Math.PI * 2 - Math.PI / 2;
        const mA = (now.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = '#2a2233';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(hA) * 7, cy + Math.sin(hA) * 7);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(mA) * 10, cy + Math.sin(mA) * 10);
        ctx.stroke();
        break;
      }
      case 'janela': {
        rrect(ctx, 6, -H + 26, L - 12, 64, 3, '#7a4a24');
        const g = ctx.createLinearGradient(0, -H + 30, 0, -H + 86);
        g.addColorStop(0, '#bfe3ff');
        g.addColorStop(1, '#fff3d0');
        ctx.fillStyle = g;
        ctx.fillRect(10, -H + 30, L - 20, 56);
        ctx.fillStyle = '#7a4a24';
        ctx.fillRect(L / 2 - 1.5, -H + 30, 3, 56);
        ctx.fillRect(10, -H + 56, L - 20, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(14, -H + 33, 4, 20);
        // Morning key: the window is the brightest plane in the room and blooms onto the plaster.
        const bloom = ctx.createRadialGradient(L / 2, -H + 58, 12, L / 2, -H + 58, L * 0.9);
        bloom.addColorStop(0, 'rgba(255,244,214,0.4)');
        bloom.addColorStop(1, 'rgba(255,244,214,0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(-L * 0.5, -H, L * 2, H);
        rrect(ctx, 2, -H + 90, L - 4, 4, 1.5, '#8B5E3C');
        ctx.fillStyle = 'rgba(255,236,196,0.6)';
        ctx.fillRect(3, -H + 90, L - 6, 1);
        break;
      }
      case 'janela_rua': {
        // Painted daylight street across from the kitnet (palette.md: neutral daylight through a painted street window).
        rrect(ctx, 4, -H + 18, L - 8, 78, 4, '#F5E6D3', '#8B5E3C', 2);
        const x0 = 10;
        const y0 = -H + 24;
        const w = L - 20;
        const h = 66;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, w, h);
        ctx.clip();
        const sky = ctx.createLinearGradient(0, y0, 0, y0 + h);
        sky.addColorStop(0, '#A8C5D4');
        sky.addColorStop(1, '#e3ecef');
        ctx.fillStyle = sky;
        ctx.fillRect(x0, y0, w, h);
        ellipse(ctx, x0 + w * 0.25, y0 + 9, 10, 3.5, 'rgba(255,255,255,0.85)');
        ellipse(ctx, x0 + w * 0.7, y0 + 6, 8, 3, 'rgba(255,255,255,0.7)');
        // Row of low buildings across the street, lit by day.
        const facades = ['#E8C9A0', '#C45C26', '#D4A017', '#9A9A92', '#E07A5F', '#F5E6D3'];
        const street = y0 + h - 12;
        let bx = x0 - 4;
        let k = 0;
        while (bx < x0 + w) {
          const bw = 18 + hash(k, 1) * 12;
          const bh = 24 + hash(k, 2) * 22;
          const c = facades[k % facades.length];
          ctx.fillStyle = c;
          ctx.fillRect(bx, street - bh, bw, bh);
          ctx.fillStyle = shade(c, -0.18);
          ctx.fillRect(bx, street - bh, bw, 3);
          for (let wy = street - bh + 7; wy < street - 12; wy += 9)
            for (let wx = bx + 3; wx < bx + bw - 5; wx += 7) {
              ctx.fillStyle = '#C5D5DE';
              ctx.fillRect(wx, wy, 4, 5);
              ctx.fillStyle = 'rgba(255,255,255,0.55)';
              ctx.fillRect(wx, wy, 1.2, 5);
            }
          if (k % 3 === 1) {
            for (let i = 0; i < bw / 4; i++) {
              ctx.fillStyle = i % 2 ? '#F5E6D3' : '#2F5D50';
              ctx.fillRect(bx + i * 4, street - 12, 4, 4);
            }
          }
          ctx.fillStyle = shade(c, -0.3);
          ctx.fillRect(bx + bw / 2 - 2.5, street - 8, 5, 8);
          bx += bw + 1;
          k++;
        }
        // Street tree (ipê) and a lamp post on the far sidewalk.
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(x0 + w * 0.78, street - 18, 2.5, 18);
        for (const [dx, dy, r] of [[0, -22, 8], [-6, -18, 6], [6, -19, 6], [0, -28, 5]] as const) circle(ctx, x0 + w * 0.78 + 1 + dx, street + dy, r, '#f2c230');
        ctx.fillStyle = '#4a4a50';
        ctx.fillRect(x0 + w * 0.15, street - 26, 1.6, 26);
        rrect(ctx, x0 + w * 0.15 - 2, street - 28, 6, 3, 1, '#4a4a50');
        // Sidewalk (calçada) + street.
        ctx.fillStyle = '#ece4d3';
        ctx.fillRect(x0, street, w, 5);
        for (let i = 0; i < w / 8; i++) {
          ctx.fillStyle = '#2f2d31';
          ctx.fillRect(x0 + i * 8 + 2, street + 1.5, 3, 2);
        }
        ctx.fillStyle = '#6a6a70';
        ctx.fillRect(x0, street + 5, w, 7);
        ctx.fillStyle = '#f2c230';
        for (let i = 0; i < w / 12; i++) ctx.fillRect(x0 + i * 12 + 3, street + 8, 6, 1.2);
        ctx.restore();
        // Mullions, sill and curtains
        ctx.fillStyle = '#F5E6D3';
        ctx.fillRect(L / 2 - 1.5, y0, 3, h);
        ctx.fillRect(x0, y0 + h / 2 - 1, w, 3);
        // Daylight bloom: the window is the brightest plane in the room.
        const bloom = ctx.createRadialGradient(L / 2, y0 + h / 2, 10, L / 2, y0 + h / 2, L * 0.75);
        bloom.addColorStop(0, 'rgba(255,253,240,0.35)');
        bloom.addColorStop(1, 'rgba(255,253,240,0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(-L * 0.3, y0 - 30, L * 1.6, h + 70);
        rrect(ctx, 2, -H + 94, L - 4, 5, 2, '#8B5E3C');
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(3, -H + 94, L - 6, 1);
        // Cloth curtains gathered with a tie-back: folds as alternating light/shadow strips.
        const curtain = (side: -1 | 1) => {
          const edge = side < 0 ? 0 : L;
          const inner = (yy: number) => {
            const tie = -H + 62;
            const k = Math.abs(yy - tie) / 50;
            return 7 + Math.min(1, k) * 14;
          };
          const folds = 4;
          for (let f = 0; f < folds; f++) {
            ctx.fillStyle = f % 2 ? '#a94c1e' : f === 0 ? '#d86f38' : '#C45C26';
            ctx.beginPath();
            for (let yy = -H + 12; yy <= -H + 102; yy += 6) {
              const wdt = inner(yy);
              const xx = edge - side * (wdt * (f / folds));
              if (yy === -H + 12) ctx.moveTo(xx, yy);
              else ctx.lineTo(xx, yy);
            }
            for (let yy = -H + 102; yy >= -H + 12; yy -= 6) {
              const wdt = inner(yy);
              ctx.lineTo(edge - side * (wdt * ((f + 1) / folds)), yy);
            }
            ctx.closePath();
            ctx.fill();
          }
          rrect(ctx, edge - side * 14 - 5, -H + 60, 10, 4, 2, '#D4A017');
        };
        curtain(-1);
        curtain(1);
        rrect(ctx, -4, -H + 8, L + 8, 6, 3, '#6a3f22');
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-3, -H + 9, L + 6, 1);
        break;
      }
      case 'poster': {
        rrect(ctx, 10, -H + 30, L - 20, 56, 3, '#f2c230', '#2a2233', 2);
        wallText(ctx, d.text ?? 'SP', L / 2, -H + 52, 22, '#2a2233');
        ctx.font = `700 8px ${FONT_BODY}`;
        ctx.fillStyle = '#2a2233';
        ctx.textAlign = 'center';
        ctx.fillText('eu ♥ São Paulo', L / 2, -H + 74);
        break;
      }
      case 'cobogo': {
        // Modernist breeze-block wall (cobogó), light through the holes.
        const top = -H + 14;
        const bottom = -10;
        const s = 16;
        const cols = Math.floor((L - 8) / s);
        const rows = Math.floor((bottom - top) / s);
        const x0 = (L - cols * s) / 2;
        rrect(ctx, x0 - 3, top - 3, cols * s + 6, rows * s + 6, 2, shade(room.wallColor, -0.25));
        for (let i = 0; i < cols; i++)
          for (let j = 0; j < rows; j++) {
            const x = x0 + i * s;
            const y = top + j * s;
            ctx.fillStyle = '#f7ecd6';
            ctx.fillRect(x, y, s, s);
            ctx.fillStyle = 'rgba(255,214,140,0.9)';
            ctx.beginPath();
            ctx.arc(x + s / 2, y + s / 2, s * 0.32, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f7ecd6';
            ctx.beginPath();
            ctx.arc(x + s / 2, y + s / 2, s * 0.12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,214,140,0.9)';
            for (const [dx, dy] of [[0, 0], [s, 0], [0, s], [s, s]]) {
              ctx.beginPath();
              ctx.arc(x + dx, y + dy, s * 0.16, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.strokeStyle = 'rgba(120,90,60,0.35)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x, y, s, s);
          }
        break;
      }
      case 'tv': {
        const w = Math.min(L - 12, 64);
        const x = (L - w) / 2;
        const y = -H + 22;
        rrect(ctx, x - 3, y - 3, w + 6, 42, 3, '#1e1e24');
        const g = ctx.createLinearGradient(0, y, 0, y + 36);
        g.addColorStop(0, '#3fa34d');
        g.addColorStop(1, '#2e8a3e');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, 36);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 4, y + 4, w - 8, 28);
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + 4);
        ctx.lineTo(x + w / 2, y + 32);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + w / 2, y + 18, 6, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 6; i++) circle(ctx, x + 10 + hash(i, 3) * (w - 20), y + 8 + hash(i, 4) * 20, 1.6, i % 2 ? '#f2c230' : '#2b5ba8');
        circle(ctx, x + w * 0.62, y + 20, 1.3, '#ffffff');
        rrect(ctx, x + 3, y + 3, 26, 8, 2, 'rgba(0,0,0,0.6)');
        ctx.font = `800 6px ${FONT_BODY}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('1 × 0', x + 6, y + 7.5);
        rrect(ctx, L / 2 - 2, y + 39, 4, 8, 1, '#3a3a44');
        break;
      }
      case 'placa':
        break;
    }
  });
}

/** Copan-style curved modernist tower — the silhouette that says “centro de São Paulo”. */
function drawCopan(ctx: Ctx, cx: number, baseY: number) {
  const w = 190;
  const h = 250;
  const x0 = cx - w / 2;
  const top = baseY - h;
  const wave = (x: number) => Math.sin(((x - x0) / w) * Math.PI * 1.6 - 0.6) * 10;
  // Body with curvature shading
  const steps = 38;
  for (let i = 0; i < steps; i++) {
    const xa = x0 + (i / steps) * w;
    const xb = x0 + ((i + 1) / steps) * w;
    const slope = Math.cos(((xa - x0) / w) * Math.PI * 1.6 - 0.6);
    const light = 0.1 + slope * 0.12;
    ctx.fillStyle = shade('#c3c9c8', light);
    ctx.beginPath();
    ctx.moveTo(xa, top + wave(xa));
    ctx.lineTo(xb + 0.5, top + wave(xb));
    ctx.lineTo(xb + 0.5, baseY);
    ctx.lineTo(xa, baseY);
    ctx.closePath();
    ctx.fill();
  }
  // Brise-soleil bands
  ctx.strokeStyle = 'rgba(90,100,110,0.4)';
  ctx.lineWidth = 1.4;
  for (let y = 6; y < h; y += 6) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i / steps) * w;
      const yy = top + y + wave(x) * (1 - y / h) * 0.9;
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,50,70,0.12)';
  ctx.fillRect(x0 + w - 12, top, 12, h);
  // Late sun rakes the left edge.
  ctx.fillStyle = 'rgba(255,200,140,0.25)';
  ctx.fillRect(x0, top + wave(x0), 8, h - wave(x0));
}

function drawPortalDoor(ctx: Ctx, room: RoomDef, p: PortalDef) {
  const from = p.wall === 'left' ? p.y : p.x;
  onWall(ctx, p.wall, from, from + 1, (L) => {
    const dh = 90;
    const x = 3;
    const w = L - 6;
    if (p.to === 'padaria') {
      rrect(ctx, x - 2, -dh - 3, w + 4, dh + 3, 3, '#7a4a24');
      rrect(ctx, x + 2, -dh + 2, w - 4, dh - 2, 2, '#cfe7f0');
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x + 5, -dh + 6, 4, dh - 12);
      rrect(ctx, x + 4, -dh + 30, w - 8, 12, 3, '#2e9e5b');
      wallText(ctx, 'ABERTO', L / 2, -dh + 36, 7.5, '#fff', { font: FONT_BODY });
    } else if (p.to === 'kitnet') {
      rrect(ctx, x - 3, -dh - 6, w + 6, dh + 6, 3, '#8d7f6a');
      rrect(ctx, x, -dh, w, dh, 2, '#2f7a52');
      rrect(ctx, x + 3, -dh + 6, w / 2 - 4, dh - 12, 2, '#9fd3c7');
      rrect(ctx, x + w / 2 + 1, -dh + 6, w / 2 - 4, dh - 12, 2, '#9fd3c7');
      rrect(ctx, L / 2 - 10, -dh - 20, 20, 12, 2, '#2a2233');
      wallText(ctx, 'Nº 42', L / 2, -dh - 14, 7, '#f2c230', { font: FONT_BODY });
    } else {
      rrect(ctx, x - 2, -dh - 3, w + 4, dh + 3, 3, shade(room.wallTrim, -0.25));
      rrect(ctx, x, -dh, w, dh, 2, '#a8662f');
      rrect(ctx, x + 4, -dh + 6, w - 8, dh / 2 - 8, 2, shade('#a8662f', 0.15));
      rrect(ctx, x + 4, -dh / 2 + 4, w - 8, dh / 2 - 10, 2, shade('#a8662f', 0.15));
      circle(ctx, x + w - 6, -dh / 2, 2, '#f2c230');
      rrect(ctx, L / 2 - 14, -dh - 18, 28, 12, 3, '#2e9e5b');
      wallText(ctx, 'SAÍDA', L / 2, -dh - 12, 7, '#fff', { font: FONT_BODY });
    }
  });
}

function drawSkyline(ctx: Ctx, room: RoomDef) {
  // Buildings behind the walls, drawn back-to-front.
  const items: { x: number; y: number; h: number; c: string; d: number }[] = [];
  for (let k = -2; k < room.rows; k += 1.6) items.push({ x: -2.2 - hash(k * 10, 1) * 1.5, y: k, h: room.wallHeight + 20 + hash(k * 10, 2) * 120, c: '', d: 0 });
  for (let k = 0; k < room.cols + 1; k += 1.7) if (k < room.cols * 0.42 || k > room.cols * 0.84) items.push({ x: k, y: -2.2 - hash(k * 10, 3) * 1.5, h: room.wallHeight + 20 + hash(k * 10, 4) * 120, c: '', d: 0 });
  // Far skyline sits in atmospheric haze: cool, soft, low contrast (near props stay crisp).
  const palette = ['#b8c3c6', '#c9c4ba', '#aebac0', '#cfc6b8', '#a7b2b9'];
  items.forEach((b, i) => {
    b.c = palette[i % palette.length];
    b.d = b.x + b.y;
  });
  items.sort((a, b) => a.d - b.d);
  const copanAt = toScreen(room.cols * 0.62, -3.2);
  drawCopan(ctx, copanAt.sx, copanAt.sx / 2 - room.wallHeight + 40);
  for (const b of items) {
    const c = toScreen(b.x + 0.5, b.y + 0.5);
    // Key light from the upper-left: the left face catches warm sun, the right face falls into cool shade.
    box(ctx, c.sx, c.sy, 1.3, 1.3, b.h, b.c, 0, { left: shade(b.c, 0.06), right: shade(b.c, -0.16), top: shade(b.c, 0.12), stroke: 'rgba(60,70,80,0.06)' });
    for (let r = 0; r < b.h / 14 - 1; r++)
      for (let q = 0; q < 3; q++) {
        if (hash(b.x * 13 + q, r + b.y * 17) > 0.5) continue;
        const fx = (q + 0.5) / 3.2;
        const lp = toScreen(b.x + 0.5 - 0.65 + fx * 1.3, b.y + 0.5 + 0.65);
        ctx.fillStyle = hash(q, r, 3) > 0.7 ? 'rgba(255,214,150,0.7)' : 'rgba(140,160,175,0.45)';
        ctx.fillRect(lp.sx - 2, lp.sy - b.h + 10 + r * 14, 3, 5);
        const rp = toScreen(b.x + 0.5 + 0.65, b.y + 0.5 + 0.65 - fx * 1.3);
        ctx.fillStyle = 'rgba(110,125,140,0.4)';
        ctx.fillRect(rp.sx - 1, rp.sy - b.h + 12 + r * 14, 3, 5);
      }
    // Haze veil toward the ground
    const base = toScreen(b.x + 0.5, b.y + 1.15);
    const hz = ctx.createLinearGradient(0, base.sy - b.h, 0, base.sy);
    hz.addColorStop(0, 'rgba(214,222,222,0)');
    hz.addColorStop(1, 'rgba(236,222,200,0.45)');
    ctx.fillStyle = hz;
    ctx.beginPath();
    const W = toScreen(b.x - 0.15, b.y + 1.15);
    const S = toScreen(b.x + 1.15, b.y + 1.15);
    const E = toScreen(b.x + 1.15, b.y - 0.15);
    ctx.moveTo(W.sx, W.sy);
    ctx.lineTo(S.sx, S.sy);
    ctx.lineTo(E.sx, E.sy);
    ctx.lineTo(E.sx, E.sy - b.h);
    ctx.lineTo(S.sx, S.sy - b.h);
    ctx.lineTo(W.sx, W.sy - b.h);
    ctx.closePath();
    ctx.fill();
  }
}

/** Plaster that isn't one flat slab: faint mottling, top-to-bottom value falloff, AO at the floor. */
function plaster(ctx: Ctx, L: number, H: number, base: string, seed: number) {
  rrect(ctx, 0, -H, L, H, 0, base);
  for (let i = 0; i < L / 22; i++) {
    const r = hash(i, seed, 51);
    ellipse(ctx, hash(i, seed, 52) * L, -hash(i, seed, 53) * H, 18 + r * 26, 10 + r * 16, r > 0.5 ? 'rgba(255,252,240,0.05)' : 'rgba(120,80,50,0.035)');
  }
  const g = ctx.createLinearGradient(0, -H, 0, 0);
  g.addColorStop(0, 'rgba(255,250,235,0.10)');
  g.addColorStop(0.6, 'rgba(255,250,235,0)');
  g.addColorStop(1, 'rgba(90,55,30,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, -H, L, H);
}

function floorSpace(ctx: Ctx, draw: () => void) {
  const o = toScreen(0, 0);
  ctx.save();
  ctx.transform(HW, HH, -HW, HH, o.sx, o.sy);
  draw();
  ctx.restore();
}

/** Fallen ipê blossoms carpet the ground under each tree. */
function drawPetals(ctx: Ctx, room: RoomDef) {
  for (const p of room.props) {
    if (p.kind !== 'ipe') continue;
    const reach = p.hero ? 2.2 : 1.6;
    for (let k = 0; k < (p.hero ? 70 : 40); k++) {
      const ang = hash(k, p.x, p.y) * Math.PI * 2;
      const d = Math.sqrt(hash(p.y, k, p.x + 3)) * reach;
      const tx = p.x + 0.5 + Math.cos(ang) * d;
      const ty = p.y + 0.5 + Math.sin(ang) * d;
      if (tx < 0.1 || ty < 0.1 || tx > room.cols - 0.1 || ty > room.rows - 0.1) continue;
      const c = toScreen(tx, ty);
      const col = ['#f2c230', '#e0a80d', '#ffd95a'][k % 3];
      ctx.save();
      ctx.translate(c.sx, c.sy);
      ctx.rotate(hash(k, 7, p.x) * 3);
      ellipse(ctx, 0, 0, 1.9, 1, col);
      ctx.restore();
    }
  }
}

/** Light pools on the floor: lamp glow (Praça), daylight through windows (Padaria, Kitnet). */
function drawFloorLight(ctx: Ctx, room: RoomDef) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  if (room.id === 'praca') {
    for (const p of room.props) {
      if (p.kind !== 'poste') continue;
      const c = tileCenter(p.x, p.y);
      ctx.save();
      ctx.translate(c.sx, c.sy);
      ctx.scale(1, 0.5);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 78);
      g.addColorStop(0, 'rgba(255,196,110,0.5)');
      g.addColorStop(0.5, 'rgba(255,180,100,0.18)');
      g.addColorStop(1, 'rgba(255,180,100,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const patch = (pts: [number, number][], from: [number, number], to: [number, number], a: number, mullions: [[number, number], [number, number]][]) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    floorSpace(ctx, () => {
      const g = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
      g.addColorStop(0, `rgba(255,248,225,${a})`);
      g.addColorStop(1, 'rgba(255,248,225,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      pts.forEach(([u, v], i) => (i ? ctx.lineTo(u, v) : ctx.moveTo(u, v)));
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    floorSpace(ctx, () => {
      ctx.strokeStyle = 'rgba(150,120,90,0.35)';
      ctx.lineWidth = 0.06;
      for (const [p, q] of mullions) {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      }
    });
    ctx.restore();
  };
  for (const d of room.walls) {
    if (d.kind === 'janela_rua' && d.wall === 'right') {
      const m = (d.from + d.to) / 2;
      patch([[d.from + 0.3, 0], [d.to - 0.3, 0], [d.to + 0.5, 2.8], [d.from + 1.1, 2.8]], [m, 0], [m + 0.4, 2.8], 0.2, [[[m, 0], [m + 0.8, 2.8]], [[d.from + 0.7, 1.4], [d.to + 0.1, 1.4]]]);
    }
    if (d.kind === 'janela' && d.wall === 'left') {
      const m = (d.from + d.to) / 2;
      patch([[0, d.from + 0.1], [0, d.to - 0.1], [3.8, d.to + 1.6], [3.8, d.from + 1.6]], [0, m], [3.8, m + 1.5], 0.62, [[[0, m], [3.8, m + 1.5]]]);
    }
  }
  ctx.restore();
}

/**
 * Upper-wall value bands for the padaria — three readable plaster bands over the azulejos:
 * a deeper warm dado above the tile cap, the lit mid field, and a cooler frieze under the ceiling,
 * split by a picture rail and a terracotta pinstripe. Faint mottling + trowel strokes so no band is a slab.
 */
function drawWallBands(ctx: Ctx, room: RoomDef) {
  const H = room.wallHeight;
  const RAIL = -76;
  const FRIEZE = -H + 26;
  for (const side of ['left', 'right'] as const) {
    const len = side === 'left' ? room.rows : room.cols;
    onWall(ctx, side, 0, len, (L) => {
      // Mottling: warm lifts and umber dips, larger and a touch stronger than the base plaster.
      for (let i = 0; i < L / 10; i++) {
        const r = hash(i, len, 61);
        ellipse(ctx, hash(i, len, 62) * L, -50 - hash(i, len, 63) * (H - 56), 10 + r * 24, 5 + r * 12, r > 0.5 ? 'rgba(255,252,240,0.11)' : 'rgba(139,94,60,0.08)');
      }
      // Trowel strokes: short diagonal sweeps that catch the light.
      ctx.lineWidth = 3;
      for (let i = 0; i < L / 18; i++) {
        const x = hash(i, len, 64) * L;
        const y = -52 - hash(i, len, 65) * (H - 60);
        ctx.strokeStyle = hash(i, len, 66) > 0.5 ? 'rgba(255,250,236,0.09)' : 'rgba(120,80,50,0.06)';
        ctx.beginPath();
        ctx.moveTo(x - 9, y + 2);
        ctx.quadraticCurveTo(x, y - 3, x + 10, y);
        ctx.stroke();
      }
      // Band 1 — dado: deeper warm plaster between the tile cap and the picture rail.
      const dado = ctx.createLinearGradient(0, RAIL, 0, -46);
      dado.addColorStop(0, 'rgba(139,94,60,0.3)');
      dado.addColorStop(1, 'rgba(139,94,60,0.18)');
      ctx.fillStyle = dado;
      ctx.fillRect(0, RAIL, L, RAIL * -1 - 46);
      // Picture rail: wood-warm with a lit top edge and a drop shadow onto the dado.
      rrect(ctx, 0, RAIL - 2.5, L, 3, 0, '#8B5E3C');
      ctx.fillStyle = 'rgba(255,236,200,0.6)';
      ctx.fillRect(0, RAIL - 2.5, L, 0.8);
      ctx.fillStyle = 'rgba(58,34,22,0.18)';
      ctx.fillRect(0, RAIL + 0.5, L, 2.5);
      // Band 2 — the lit field: the lightest plaster in the room.
      const field = ctx.createLinearGradient(0, FRIEZE, 0, RAIL);
      field.addColorStop(0, 'rgba(255,250,236,0.05)');
      field.addColorStop(0.5, 'rgba(255,250,236,0.2)');
      field.addColorStop(1, 'rgba(255,250,236,0.04)');
      ctx.fillStyle = field;
      ctx.fillRect(0, FRIEZE, L, RAIL - FRIEZE - 2.5);
      // Band 3 — frieze under the ceiling: cooler, darker, with a terracotta pinstripe.
      const frieze = ctx.createLinearGradient(0, -H, 0, FRIEZE);
      frieze.addColorStop(0, 'rgba(84,70,66,0.38)');
      frieze.addColorStop(1, 'rgba(84,70,66,0.2)');
      ctx.fillStyle = frieze;
      ctx.fillRect(0, -H, L, FRIEZE + H);
      rrect(ctx, 0, FRIEZE - 1, L, 2.2, 0, 'rgba(196,92,38,0.85)');
      ctx.fillStyle = 'rgba(255,244,220,0.35)';
      ctx.fillRect(0, FRIEZE + 1, L, 0.7);
    });
  }
}

/**
 * Morning key comes in the left window: the walls warm near it and fall off cooler toward the
 * far end and the ceiling, so the counter (warm, lit) pops against the back wall.
 */
function drawWallFalloff(ctx: Ctx, room: RoomDef) {
  const H = room.wallHeight;
  onWall(ctx, 'right', 0, room.cols, (L) => {
    // Key → fill: warm where the window light lands (near the corner), a soft cool fill by the far end.
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, 'rgba(255,214,150,0.22)');
    g.addColorStop(0.3, 'rgba(255,214,150,0.08)');
    g.addColorStop(0.6, 'rgba(255,214,150,0)');
    g.addColorStop(1, 'rgba(70,90,112,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -H, L, H);
    const top = ctx.createLinearGradient(0, -H, 0, -H * 0.45);
    top.addColorStop(0, 'rgba(70,90,112,0.18)');
    top.addColorStop(1, 'rgba(70,90,112,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, -H, L, H * 0.55);
  });
  onWall(ctx, 'left', 0, room.rows, (L) => {
    // u = 0 is the front (door) end of the left wall; the window sits near the back.
    const win = room.walls.find((d) => d.kind === 'janela' && d.wall === 'left');
    const wu = win ? (room.rows - (win.from + win.to) / 2) * HW : L * 0.6;
    const glow = ctx.createRadialGradient(wu, -H * 0.55, 8, wu, -H * 0.55, L * 0.45);
    glow.addColorStop(0, 'rgba(255,226,170,0.34)');
    glow.addColorStop(0.5, 'rgba(255,226,170,0.1)');
    glow.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, -H, L, H);
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, 'rgba(70,90,112,0.2)');
    g.addColorStop(0.45, 'rgba(70,90,112,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -H, L, H);
  });
}

/** Floor-level footprints of the fixed counter run (balcão, caixa, vitrine, estufa, trilho). */
const COUNTER_KINDS = new Set(['balcao', 'caixa', 'vitrine', 'estufa', 'trilho_pedidos']);

/** Ambient occlusion where the floor meets the back walls. */
function drawFloorAO(ctx: Ctx, room: RoomDef) {
  floorSpace(ctx, () => {
    if (room.lighting === 'manha') {
      // AO at the counter's feet: a hard contact band that swallows the tile pattern, then feathered
      // rings out to ~0.7 tile so the run sits in the floor instead of on it.
      for (const p of room.props) {
        if (!COUNTER_KINDS.has(p.kind)) continue;
        const w = p.w ?? 1;
        const h = p.h ?? 1;
        for (const [pad, a] of [[0.03, 0.5], [0.09, 0.26], [0.18, 0.16], [0.32, 0.1], [0.5, 0.06], [0.72, 0.035]] as const) {
          ctx.fillStyle = `rgba(52,28,16,${a})`;
          ctx.fillRect(p.x + 0.02 - pad, p.y + 0.1 - pad, w - 0.04 + pad * 2, h - 0.2 + pad * 2);
        }
      }
      // Loose furniture (mesas, cadeiras, banquetas, vasos) gets a soft pool too.
      for (const p of room.props) {
        if (COUNTER_KINDS.has(p.kind) || p.kind === 'trilho_pedidos') continue;
        const g = ctx.createRadialGradient(p.x + 0.5, p.y + 0.5, 0, p.x + 0.5, p.y + 0.5, 0.62);
        g.addColorStop(0, 'rgba(52,28,16,0.2)');
        g.addColorStop(1, 'rgba(52,28,16,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 0.2, p.y - 0.2, 1.4, 1.4);
      }
      // Floor falls off away from the window key (left wall), so the front corner sits back.
      const win = room.walls.find((d) => d.kind === 'janela' && d.wall === 'left');
      const wy = win ? (win.from + win.to) / 2 : room.rows / 2;
      const r = Math.hypot(room.cols, room.rows);
      const g = ctx.createRadialGradient(0, wy, 2, 0, wy, r);
      g.addColorStop(0, 'rgba(58,34,22,0)');
      g.addColorStop(1, 'rgba(58,34,22,0.3)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, room.cols, room.rows);
    }
    // Wall feet: a tight dark contact line plus a wider soft falloff (stronger in the padaria).
    // Padaria: a near-opaque contact line, a dense first 0.15 tile, and a long soft tail to ~1.7 tiles.
    const manha = room.lighting === 'manha';
    const reach = manha ? 1.7 : 0.9;
    const stops: [number, number][] = manha
      ? [[0, 0.62], [0.03, 0.46], [0.09, 0.3], [0.25, 0.15], [0.55, 0.05], [1, 0]]
      : [[0, 0.26], [0.2, 0.12], [1, 0]];
    for (const [side, len, darker] of [['left', room.rows, 1], ['right', room.cols, 0.88]] as const) {
      const g = side === 'left' ? ctx.createLinearGradient(0, 0, reach, 0) : ctx.createLinearGradient(0, 0, 0, reach);
      for (const [f, a] of stops) g.addColorStop(f, `rgba(52,28,16,${a * darker})`);
      ctx.fillStyle = g;
      if (side === 'left') ctx.fillRect(0, 0, reach, len);
      else ctx.fillRect(0, 0, len, reach);
    }
    if (manha) {
      // Inner corner: both walls occlude, so the floor at the corner goes a step darker.
      const c = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.6);
      c.addColorStop(0, 'rgba(52,28,16,0.3)');
      c.addColorStop(1, 'rgba(52,28,16,0)');
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1.6, 1.6);
    }
  });
}

export function drawBackground(ctx: Ctx, room: RoomDef, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (room.lighting === 'tarde') {
    // Soft-sky wash (palette.md #A8C5D4) warming to a late-afternoon horizon.
    g.addColorStop(0, '#A8C5D4');
    g.addColorStop(0.5, '#d9d7c9');
    g.addColorStop(1, '#f0c89a');
  } else if (room.lighting === 'manha') {
    g.addColorStop(0, '#4f3325');
    g.addColorStop(1, '#8a5a3c');
  } else {
    g.addColorStop(0, '#A8C5D4');
    g.addColorStop(1, '#e9dccb');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (room.lighting === 'tarde') {
    const sun = ctx.createRadialGradient(w * 0.06, h * 0.08, 10, w * 0.06, h * 0.08, w * 0.55);
    sun.addColorStop(0, 'rgba(255,236,196,0.75)');
    sun.addColorStop(0.35, 'rgba(255,214,160,0.25)');
    sun.addColorStop(1, 'rgba(255,214,160,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    for (const [cx, cy, s] of [[0.28, 0.12, 1], [0.7, 0.07, 0.8], [0.9, 0.2, 0.6]] as const) {
      for (let i = 0; i < 4; i++) ellipse(ctx, w * cx + (i - 1.5) * 26 * s, h * cy + (i % 2) * 4, 34 * s, 10 * s, 'rgba(255,250,240,0.35)');
    }
  }
}

/** Static layer: skyline, walls, wall decor, doors, floor. World-space coordinates. */
export function drawRoomStatic(ctx: Ctx, room: RoomDef) {
  const H = room.wallHeight;
  if (room.id === 'praca') drawSkyline(ctx, room);

  // Walls
  onWall(ctx, 'left', 0, room.rows, (L) => plaster(ctx, L, H, shade(room.wallColor, -0.07), 1));
  onWall(ctx, 'right', 0, room.cols, (L) => plaster(ctx, L, H, room.wallColor, 2));
  if (room.lighting === 'manha') drawWallBands(ctx, room);
  for (const d of room.walls) drawDecor(ctx, room, d);
  if (room.lighting === 'manha') drawWallFalloff(ctx, room);
  // AO where the wall meets the floor, then baseboards + top caps
  for (const side of ['left', 'right'] as const) {
    const len = side === 'left' ? room.rows : room.cols;
    onWall(ctx, side, 0, len, (L) => {
      const ao = ctx.createLinearGradient(0, -34, 0, 0);
      ao.addColorStop(0, 'rgba(58,34,22,0)');
      ao.addColorStop(1, `rgba(58,34,22,${room.lighting === 'manha' ? 0.42 : 0.2})`);
      ctx.fillStyle = ao;
      ctx.fillRect(0, -34, L, 34);
      rrect(ctx, 0, -7, L, 7, 0, shade(room.wallTrim, -0.1));
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(0, -7, L, 1);
      rrect(ctx, 0, -H - 8, L, 8, 0, room.wallTrim);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, -H - 8, L, 1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, -H, L, 3);
    });
  }
  // Inner corner shadow
  onWall(ctx, 'right', 0, 1, () => {
    const g = ctx.createLinearGradient(0, 0, 26, 0);
    g.addColorStop(0, 'rgba(58,34,22,0.16)');
    g.addColorStop(1, 'rgba(58,34,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -H, 26, H);
  });
  // Corner post
  const c0 = toScreen(0, 0);
  rrect(ctx, c0.sx - 3, c0.sy - H - 8, 6, H + 8, 1, shade(room.wallTrim, -0.2));
  for (const p of room.portals) drawPortalDoor(ctx, room, p);

  // Floor
  for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) drawFloorTile(ctx, room, x, y);
  if (room.id === 'praca') drawPetals(ctx, room);
  drawFloorLight(ctx, room);
  drawFloorAO(ctx, room);
  // Floor outline
  const a = toScreen(0, 0);
  const b = toScreen(room.cols, 0);
  const c = toScreen(room.cols, room.rows);
  const d = toScreen(0, room.rows);
  poly(ctx, [[a.sx, a.sy], [b.sx, b.sy], [c.sx, c.sy], [d.sx, d.sy]], undefined, 'rgba(0,0,0,0.25)', 2);
  // Floor front edge thickness
  poly(ctx, [[d.sx, d.sy], [c.sx, c.sy], [c.sx, c.sy + 10], [d.sx, d.sy + 10]], shade(room.lighting === 'tarde' ? '#8d8272' : '#6a4a34', -0.1));
  poly(ctx, [[c.sx, c.sy], [b.sx, b.sy], [b.sx, b.sy + 10], [c.sx, c.sy + 10]], shade(room.lighting === 'tarde' ? '#8d8272' : '#6a4a34', -0.25));
}

export function drawLighting(ctx: Ctx, room: RoomDef, w: number, h: number, t: number) {
  ctx.save();
  const vignette = (a: string) => {
    const v = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.35, w / 2, h * 0.48, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, a);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  };
  if (room.lighting === 'tarde') {
    // Late-afternoon key from the upper-left, cool soft fill toward the lower-right.
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(255,190,110,0.22)');
    g.addColorStop(0.5, 'rgba(255,170,100,0.04)');
    g.addColorStop(1, 'rgba(70,85,130,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    vignette('rgba(70,45,40,0.16)');
  } else if (room.lighting === 'manha') {
    // Warm morning interior: warm key from the left (window side), cooler toward the right.
    // Beams, dust and the counter pool live in world space (drawWorldLight).
    const warm = ctx.createLinearGradient(0, 0, w, h * 0.6);
    warm.addColorStop(0, 'rgba(255,210,140,0.2)');
    warm.addColorStop(0.5, 'rgba(255,210,140,0.03)');
    warm.addColorStop(1, 'rgba(80,100,130,0.14)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);
    vignette('rgba(60,30,15,0.24)');
  } else {
    // Neutral daylight from the street window (right wall), soft falloff into the corners.
    const g = ctx.createRadialGradient(w * 0.66, h * 0.3, 20, w * 0.66, h * 0.3, Math.max(w, h) * 0.6);
    g.addColorStop(0, 'rgba(255,252,240,0.16)');
    g.addColorStop(1, 'rgba(255,252,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    vignette('rgba(50,60,80,0.18)');
  }
  ctx.restore();
}

/** Screen point on the left wall at tile row y, height v (v ≤ 0 goes up). */
const leftWallPt = (y: number, v: number): [number, number] => {
  const p = toScreen(0, y);
  return [p.sx, p.sy + v];
};

/**
 * World-space light over props and avatars (Padaria morning): the window beam with dust in it,
 * a warm pool on the hero counter, and cool glints on the glass case. Call with the world transform.
 */
export function drawWorldLight(ctx: Ctx, room: RoomDef, t: number) {
  if (room.lighting !== 'manha') return;
  const H = room.wallHeight;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Counter pool (focal #1): Carlos + the balcão + Me vê um… sit in the warmest light.
  const balcao = room.props.find((p) => p.kind === 'balcao');
  if (balcao) {
    const c = toScreen(balcao.x + (balcao.w ?? 1) / 2 + 0.5, balcao.y + 0.6);
    ctx.save();
    ctx.translate(c.sx, c.sy - 40);
    ctx.scale(1, 0.55);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 230);
    g.addColorStop(0, 'rgba(255,206,140,0.2)');
    g.addColorStop(0.6, 'rgba(255,206,140,0.06)');
    g.addColorStop(1, 'rgba(255,206,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-240, -240, 480, 480);
    ctx.restore();
  }
  // Window beams: two shafts split by the mullion, from the glass down to the floor patch.
  const win = room.walls.find((d) => d.kind === 'janela' && d.wall === 'left');
  if (win) {
    // Broad soft key: the whole window's light spilling wide into the room, under the crisp shafts.
    const ka = leftWallPt(win.from - 0.3, -H + 24);
    const kb = leftWallPt(win.to + 0.3, -H + 24);
    const kc = toScreen(5.2, win.to + 3.2);
    const kd = toScreen(5.2, win.from + 0.6);
    const key = ctx.createLinearGradient(ka[0], ka[1], kc.sx, kc.sy);
    key.addColorStop(0, 'rgba(255,224,170,0.22)');
    key.addColorStop(0.6, 'rgba(255,224,170,0.07)');
    key.addColorStop(1, 'rgba(255,224,170,0)');
    ctx.fillStyle = key;
    ctx.beginPath();
    ctx.moveTo(...ka);
    ctx.lineTo(...kb);
    ctx.lineTo(...leftWallPt(win.to + 0.3, 0));
    ctx.lineTo(kc.sx, kc.sy);
    ctx.lineTo(kd.sx, kd.sy);
    ctx.closePath();
    ctx.fill();
    const y0 = win.to - 10 / HW;
    const y1 = win.from + 10 / HW;
    const mid = (y0 + y1) / 2;
    const top = -H + 30;
    const bot = -H + 86;
    const shafts: [number, number][] = [
      [y1, mid - 0.05],
      [mid + 0.05, y0],
    ];
    for (const [a, b] of shafts) {
      const fa = toScreen(3.8, a + 1.6);
      const fb = toScreen(3.8, b + 1.6);
      const wa = leftWallPt(a, top);
      const wb = leftWallPt(b, top);
      const g = ctx.createLinearGradient(wa[0], wa[1], fa.sx, fa.sy);
      g.addColorStop(0, 'rgba(255,236,190,0.5)');
      g.addColorStop(0.7, 'rgba(255,236,190,0.16)');
      g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(...wa);
      ctx.lineTo(...wb);
      ctx.lineTo(...leftWallPt(b, bot));
      ctx.lineTo(fb.sx, fb.sy);
      ctx.lineTo(fa.sx, fa.sy);
      ctx.closePath();
      ctx.fill();
    }
    // Dust drifting in the beam.
    for (let i = 0; i < 18; i++) {
      const u = (i * 0.137 + t * 0.012 * (1 + (i % 3))) % 1;
      const along = y1 + ((i * 0.61) % 1) * (y0 - y1);
      const wp = leftWallPt(along, top + 20);
      const fp = toScreen(3.6, along + 1.5);
      const x = wp[0] + (fp.sx - wp[0]) * u + Math.sin(t * 0.5 + i) * 4;
      const y = wp[1] + (fp.sy - wp[1]) * u + Math.cos(t * 0.4 + i * 1.7) * 3;
      ctx.fillStyle = `rgba(255,240,200,${(0.35 + Math.sin(t * 1.3 + i) * 0.15) * (1 - u)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Live glass on the case fronts (vitrine + SALGADOS estufa): the hard streaks and steel frame are
  // baked into the sprite; here a light top sheen, a lit corner and a slow glint sweeping across.
  for (const p of room.props) {
    if (p.kind !== 'vitrine' && p.kind !== 'estufa') continue;
    const lift = 22;
    const gh = p.kind === 'estufa' ? 26 : 24;
    const Wc = toScreen(p.x + 0.02, p.y + 0.88);
    const Sc = toScreen(p.x + 0.98, p.y + 0.88);
    const Ec = toScreen(p.x + 0.98, p.y + 0.12);
    const pane = (a: { sx: number; sy: number }, b: { sx: number; sy: number }, strength: number, phase: number) => {
      const at = (f: number, k: number): [number, number] => [a.sx + (b.sx - a.sx) * f, a.sy + (b.sy - a.sy) * f - lift - gh * k];
      const sheen = ctx.createLinearGradient(0, a.sy - lift - gh, 0, a.sy - lift);
      sheen.addColorStop(0, `rgba(197,213,222,${0.24 * strength})`);
      sheen.addColorStop(0.35, `rgba(197,213,222,${0.04 * strength})`);
      sheen.addColorStop(1, 'rgba(197,213,222,0)');
      ctx.fillStyle = sheen;
      ctx.beginPath();
      [at(0, 0), at(1, 0), at(1, 1), at(0, 1)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      // Glint sweeping across the pane every ~7s.
      const sweep = ((t + phase) % 7) / 1.4;
      if (sweep < 1) {
        const f = -0.2 + sweep * 1.2;
        ctx.fillStyle = `rgba(245,251,255,${0.55 * strength * Math.sin(sweep * Math.PI)})`;
        ctx.beginPath();
        [at(Math.max(0, f), 0.05), at(Math.max(0, Math.min(1, f + 0.06)), 0.05), at(Math.min(1, f + 0.2), 0.95), at(Math.min(1, Math.max(0, f + 0.14)), 0.95)].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
      }
    };
    pane(Wc, Sc, 1, p.x);
    pane(Sc, Ec, 0.6, p.x + 3.5);
    // Lit vertical corner + top-edge catch.
    ctx.strokeStyle = 'rgba(236,246,255,0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(Sc.sx, Sc.sy - lift - 1);
    ctx.lineTo(Sc.sx, Sc.sy - lift - gh + 1);
    ctx.moveTo(Wc.sx, Wc.sy - lift - gh + 0.5);
    ctx.lineTo(Sc.sx, Sc.sy - lift - gh + 0.5);
    ctx.stroke();
  }
  // Cool twinkle on the glass case corners (specular, not warm).
  for (const p of room.props) {
    if (p.kind !== 'vitrine' && p.kind !== 'estufa') continue;
    const c = toScreen(p.x + 0.98, p.y + 0.9);
    const tw = 0.5 + Math.sin(t * 1.7 + p.x * 2.3) * 0.5;
    ctx.strokeStyle = `rgba(226,242,255,${0.45 + tw * 0.4})`;
    ctx.lineWidth = 1;
    const s = 3 + tw * 2;
    const y = c.sy - 44;
    ctx.beginPath();
    ctx.moveTo(c.sx - s, y);
    ctx.lineTo(c.sx + s, y);
    ctx.moveTo(c.sx, y - s);
    ctx.lineTo(c.sx, y + s);
    ctx.stroke();
  }
  ctx.restore();
}
