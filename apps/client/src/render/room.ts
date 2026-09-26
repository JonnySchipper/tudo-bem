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
        rrect(ctx, 0, y0 - 3, L, 4, 1, '#8B5E3C');
        for (let i = 0; i < L / sw; i++) {
          ctx.fillStyle = i % 2 ? '#F5E6D3' : '#C45C26';
          ctx.fillRect(i * sw, y0, sw, 10);
          ctx.beginPath();
          ctx.arc(i * sw + sw / 2, y0 + 10, sw / 2, 0, Math.PI);
          ctx.fill();
        }
        const shadeG = ctx.createLinearGradient(0, y0 + 10, 0, y0 + 30);
        shadeG.addColorStop(0, 'rgba(70,35,15,0.22)');
        shadeG.addColorStop(1, 'rgba(70,35,15,0)');
        ctx.fillStyle = shadeG;
        ctx.fillRect(0, y0 + 12, L, 18);
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
        rrect(ctx, 0, top - 5, L, 5, 0, '#D4A017');
        rrect(ctx, 0, top - 6, L, 1.2, 0, '#8B5E3C');
        break;
      }
      case 'prateleira_paes': {
        rrect(ctx, 4, -H + 8, L - 8, 24, 5, '#b5452e');
        wallText(ctx, d.text ?? '', L / 2, -H + 20, 12, '#fff6e6', { maxW: L - 20 });
        for (let s = 0; s < 3; s++) {
          const y = -H + 66 + s * 24;
          rrect(ctx, 6, y, L - 12, 5, 1, '#7a4a24');
          grain(ctx, 6, y, L - 12, 5, 'rgba(60,30,10,0.4)', 'rgba(255,220,170,0.25)', s);
          ctx.fillStyle = 'rgba(60,30,10,0.18)';
          ctx.fillRect(6, y + 5, L - 12, 3);
          for (let k = 0; k < (L - 16) / 11; k++) {
            const bx = 12 + k * 11;
            const type = (k + s) % 4;
            if (type === 0) {
              ellipse(ctx, bx, y - 5, 6.5, 4.5, '#c97f35');
              ellipse(ctx, bx - 1.5, y - 7, 3.5, 1.6, 'rgba(255,230,170,0.55)');
              ctx.strokeStyle = '#9a5a22';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(bx - 3, y - 7);
              ctx.lineTo(bx - 1, y - 3);
              ctx.moveTo(bx + 1, y - 7);
              ctx.lineTo(bx + 3, y - 3);
              ctx.stroke();
            } else if (type === 1) {
              circle(ctx, bx - 3, y - 4, 3.5, '#f2d27a');
              circle(ctx, bx + 3, y - 4, 3.5, '#eac566');
              circle(ctx, bx, y - 8, 3.3, '#f0cc6e');
            } else if (type === 3) {
              // Baguette-style bisnagas leaning on each other
              ctx.save();
              ctx.translate(bx, y - 7);
              ctx.rotate(-0.5);
              rrect(ctx, -2.5, -8, 5, 16, 2.5, '#d18c42');
              ctx.restore();
              ctx.save();
              ctx.translate(bx + 3, y - 7);
              ctx.rotate(-0.3);
              rrect(ctx, -2.5, -8, 5, 16, 2.5, '#c47d36');
              ctx.restore();
            } else {
              rrect(ctx, bx - 5, y - 12, 10, 12, 3, '#b87a3a');
              rrect(ctx, bx - 4, y - 11, 4, 3, 1.5, 'rgba(255,225,170,0.4)');
              ctx.strokeStyle = '#8f5a26';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(bx - 3, y - 10);
              ctx.lineTo(bx - 1.5, y - 2);
              ctx.moveTo(bx + 1.5, y - 10);
              ctx.lineTo(bx + 3, y - 2);
              ctx.stroke();
            }
          }
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
      patch([[0, d.from + 0.2], [0, d.to - 0.2], [2.6, d.to + 0.9], [2.6, d.from + 1.1]], [0, m], [2.6, m + 0.9], 0.24, [[[0, m], [2.6, m + 1]]]);
    }
  }
  ctx.restore();
}

/** Ambient occlusion where the floor meets the back walls. */
function drawFloorAO(ctx: Ctx, room: RoomDef) {
  floorSpace(ctx, () => {
    const gl = ctx.createLinearGradient(0, 0, 0.9, 0);
    gl.addColorStop(0, 'rgba(58,34,22,0.26)');
    gl.addColorStop(1, 'rgba(58,34,22,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, 0.9, room.rows);
    const gr = ctx.createLinearGradient(0, 0, 0, 0.9);
    gr.addColorStop(0, 'rgba(58,34,22,0.22)');
    gr.addColorStop(1, 'rgba(58,34,22,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, room.cols, 0.9);
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
  for (const d of room.walls) drawDecor(ctx, room, d);
  // AO where the wall meets the floor, then baseboards + top caps
  for (const side of ['left', 'right'] as const) {
    const len = side === 'left' ? room.rows : room.cols;
    onWall(ctx, side, 0, len, (L) => {
      const ao = ctx.createLinearGradient(0, -34, 0, 0);
      ao.addColorStop(0, 'rgba(58,34,22,0)');
      ao.addColorStop(1, 'rgba(58,34,22,0.2)');
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
    // Warm morning interior; soft beams from the side window.
    const warm = ctx.createLinearGradient(0, 0, w, h);
    warm.addColorStop(0, 'rgba(255,214,150,0.14)');
    warm.addColorStop(1, 'rgba(120,60,30,0.08)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);
    // Faint dust shimmer in the window light (floor patch is baked into the static layer).
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const px = w * (0.3 + ((i * 0.137) % 0.3)) + Math.sin(t * 0.4 + i) * 12;
      const py = h * (0.3 + ((i * 0.211) % 0.35)) + Math.cos(t * 0.3 + i * 1.7) * 10;
      ctx.fillStyle = `rgba(255,236,190,${0.18 + Math.sin(t + i) * 0.08})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    vignette('rgba(60,30,15,0.22)');
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
