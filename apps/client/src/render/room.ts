import { floorAt, type PortalDef, type RoomDef, type WallDecor, type WallSide } from '@tudobem/shared';
import { HH, HW, toScreen } from './iso';
import { box, circle, ellipse, FONT_BODY, FONT_TITLE, hash, poly, rrect, shade, type Ctx } from './draw';

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

export function drawFloorTile(ctx: Ctx, room: RoomDef, x: number, y: number) {
  const kind = floorAt(room, x, y);
  switch (kind) {
    case 'ladrilho':
      onTile(ctx, x, y, () => drawLadrilho(ctx));
      break;
    case 'calcada': {
      // São Paulo calçada: black & white wave mosaic.
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const X = x + (i + 0.5) / n;
          const Y = y + (j + 0.5) / n;
          const s = Math.sin((X + Y) * 1.25 + Math.sin((X - Y) * 0.55) * 2.1);
          const dark = s > 0.42;
          const jitter = hash(x * 7 + i, y * 7 + j) * 0.06;
          subDiamond(ctx, x, y, i, j, n, dark ? shade('#2c2a2e', jitter) : shade('#ece4d3', -jitter));
        }
      break;
    }
    case 'grama': {
      const n = 3;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const r = hash(x * 5 + i, y * 5 + j, 3);
          subDiamond(ctx, x, y, i, j, n, shade('#69a84a', (r - 0.5) * 0.16));
        }
      if (hash(x, y, 9) > 0.7) {
        const c = toScreen(x + 0.3 + hash(x, y, 4) * 0.4, y + 0.3 + hash(x, y, 5) * 0.4);
        circle(ctx, c.sx, c.sy, 2, hash(x, y, 6) > 0.5 ? '#f2c230' : '#ffffff');
      }
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
          g.addColorStop(0, '#2b5ba8');
          g.addColorStop(0.5, '#7a4fb0');
          g.addColorStop(1, '#e5572f');
        } else {
          g.addColorStop(0, '#3aa6a0');
          g.addColorStop(1, '#2e9e5b');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, -H, L, H);
        // Big sun + leaves
        circle(ctx, L * 0.78, -H * 0.68, 26, '#f2c230');
        circle(ctx, L * 0.78, -H * 0.68, 18, '#ffd95a');
        for (let i = 0; i < 7; i++) {
          ctx.save();
          ctx.translate(L * (0.08 + hash(i, 1, d.from) * 0.85), -18 - hash(i, 2, d.from) * 50);
          ctx.rotate(hash(i, 3) * 3);
          ellipse(ctx, 0, 0, 16, 6, i % 2 ? '#2e9e5b' : '#1d7a45');
          ctx.restore();
        }
        if (d.text === 'SAMPA') {
          // Skyline silhouette + heart
          ctx.fillStyle = 'rgba(20,16,40,0.55)';
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
        break;
      }
      case 'azulejos': {
        const top = -46;
        rrect(ctx, 0, top, L, -top, 0, '#f6f8fb');
        const s = 11.5;
        for (let i = 0; i < L / s; i++)
          for (let j = 0; j < 4; j++) {
            const x = i * s;
            const y = top + j * s;
            ctx.strokeStyle = 'rgba(40,80,160,0.25)';
            ctx.lineWidth = 0.6;
            ctx.strokeRect(x, y, s, s);
            ctx.fillStyle = '#2b5ba8';
            ctx.beginPath();
            ctx.arc(x + s / 2, y + s / 2, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(43,91,168,0.5)';
            for (const [dx, dy] of [[0, 0], [s, 0], [0, s], [s, s]]) {
              ctx.beginPath();
              ctx.arc(x + dx, y + dy, 2.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        rrect(ctx, 0, top - 4, L, 4, 0, '#2b5ba8');
        break;
      }
      case 'prateleira_paes': {
        rrect(ctx, 4, -H + 8, L - 8, 24, 5, '#b5452e');
        wallText(ctx, d.text ?? '', L / 2, -H + 20, 12, '#fff6e6', { maxW: L - 20 });
        for (let s = 0; s < 3; s++) {
          const y = -H + 58 + s * 26;
          rrect(ctx, 6, y, L - 12, 5, 1, '#7a4a24');
          for (let k = 0; k < (L - 20) / 16; k++) {
            const bx = 14 + k * 16;
            const type = (k + s) % 3;
            if (type === 0) ellipse(ctx, bx, y - 5, 7, 4.5, '#d9913f');
            else if (type === 1) {
              circle(ctx, bx - 3, y - 4, 3.5, '#f2d27a');
              circle(ctx, bx + 3, y - 4, 3.5, '#eac566');
            } else {
              rrect(ctx, bx - 7, y - 12, 14, 12, 3, '#b87a3a');
              ctx.strokeStyle = '#8f5a26';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(bx - 4, y - 10);
              ctx.lineTo(bx - 2, y - 2);
              ctx.moveTo(bx + 2, y - 10);
              ctx.lineTo(bx + 4, y - 2);
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
        rrect(ctx, 4, -H + 18, L - 8, 78, 4, '#f4efe6');
        const x0 = 10;
        const y0 = -H + 24;
        const w = L - 20;
        const h = 66;
        const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, '#3b2c6b');
        g.addColorStop(0.55, '#e5572f');
        g.addColorStop(1, '#f2c230');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0, w, h);
        let bx = x0;
        let k = 0;
        while (bx < x0 + w) {
          const bw = 14 + hash(k, 1) * 16;
          const bh = 22 + hash(k, 2) * 36;
          ctx.fillStyle = k % 2 ? '#2a2233' : '#3a3050';
          ctx.fillRect(bx, y0 + h - bh, Math.min(bw, x0 + w - bx), bh);
          for (let wy = y0 + h - bh + 4; wy < y0 + h - 4; wy += 7)
            for (let wx = bx + 3; wx < bx + bw - 3 && wx < x0 + w - 3; wx += 5) if (hash(wx, wy) > 0.55) {
              ctx.fillStyle = '#ffd98a';
              ctx.fillRect(wx, wy, 2, 3);
            }
          bx += bw + 2;
          k++;
        }
        circle(ctx, x0 + w * 0.8, y0 + 14, 6, '#fff3c0');
        ctx.fillStyle = '#f4efe6';
        ctx.fillRect(L / 2 - 1.5, y0, 3, h);
        ctx.fillRect(x0, y0 + h / 2 - 1, w, 3);
        // Curtains
        ctx.fillStyle = '#e5572f';
        ctx.beginPath();
        ctx.moveTo(0, -H + 12);
        ctx.quadraticCurveTo(20, -H + 50, 6, -H + 100);
        ctx.lineTo(0, -H + 100);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(L, -H + 12);
        ctx.quadraticCurveTo(L - 20, -H + 50, L - 6, -H + 100);
        ctx.lineTo(L, -H + 100);
        ctx.fill();
        rrect(ctx, -4, -H + 8, L + 8, 6, 3, '#6a3f22');
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
    ctx.fillStyle = shade('#c9bcc9', light);
    ctx.beginPath();
    ctx.moveTo(xa, top + wave(xa));
    ctx.lineTo(xb + 0.5, top + wave(xb));
    ctx.lineTo(xb + 0.5, baseY);
    ctx.lineTo(xa, baseY);
    ctx.closePath();
    ctx.fill();
  }
  // Brise-soleil bands
  ctx.strokeStyle = 'rgba(95,80,105,0.5)';
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
  ctx.fillStyle = 'rgba(40,30,60,0.12)';
  ctx.fillRect(x0 + w - 12, top, 12, h);
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
  const palette = ['#b9a9c8', '#c7b2a8', '#a99fb8', '#d0bfb0', '#9c93ad'];
  items.forEach((b, i) => {
    b.c = palette[i % palette.length];
    b.d = b.x + b.y;
  });
  items.sort((a, b) => a.d - b.d);
  const copanAt = toScreen(room.cols * 0.62, -3.2);
  drawCopan(ctx, copanAt.sx, copanAt.sx / 2 - room.wallHeight + 40);
  for (const b of items) {
    const c = toScreen(b.x + 0.5, b.y + 0.5);
    box(ctx, c.sx, c.sy, 1.3, 1.3, b.h, b.c, 0, { stroke: 'rgba(0,0,0,0.08)' });
    // Lit windows on the two visible faces
    for (let r = 0; r < b.h / 14 - 1; r++)
      for (let q = 0; q < 3; q++) {
        if (hash(b.x * 13 + q, r + b.y * 17) > 0.45) continue;
        const fx = (q + 0.5) / 3.2;
        const lp = toScreen(b.x + 0.5 - 0.65 + fx * 1.3, b.y + 0.5 + 0.65);
        ctx.fillStyle = 'rgba(255,217,138,0.85)';
        ctx.fillRect(lp.sx - 2, lp.sy - b.h + 10 + r * 14, 3, 5);
        const rp = toScreen(b.x + 0.5 + 0.65, b.y + 0.5 + 0.65 - fx * 1.3);
        ctx.fillStyle = 'rgba(255,217,138,0.6)';
        ctx.fillRect(rp.sx - 1, rp.sy - b.h + 12 + r * 14, 3, 5);
      }
  }
}

export function drawBackground(ctx: Ctx, room: RoomDef, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (room.lighting === 'tarde') {
    g.addColorStop(0, '#6c5a9e');
    g.addColorStop(0.45, '#e98a6b');
    g.addColorStop(1, '#f7c88a');
  } else if (room.lighting === 'manha') {
    g.addColorStop(0, '#5a3a2c');
    g.addColorStop(1, '#8a5a3c');
  } else {
    g.addColorStop(0, '#1b1838');
    g.addColorStop(1, '#3a2c55');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Static layer: skyline, walls, wall decor, doors, floor. World-space coordinates. */
export function drawRoomStatic(ctx: Ctx, room: RoomDef) {
  const H = room.wallHeight;
  if (room.id === 'praca') drawSkyline(ctx, room);

  // Walls
  onWall(ctx, 'left', 0, room.rows, (L) => {
    rrect(ctx, 0, -H, L, H, 0, shade(room.wallColor, -0.06));
  });
  onWall(ctx, 'right', 0, room.cols, (L) => {
    rrect(ctx, 0, -H, L, H, 0, room.wallColor);
  });
  for (const d of room.walls) drawDecor(ctx, room, d);
  // Baseboards + top caps
  for (const side of ['left', 'right'] as const) {
    const len = side === 'left' ? room.rows : room.cols;
    onWall(ctx, side, 0, len, (L) => {
      rrect(ctx, 0, -7, L, 7, 0, shade(room.wallTrim, -0.1));
      rrect(ctx, 0, -H - 8, L, 8, 0, room.wallTrim);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, -H, L, 3);
    });
  }
  // Corner post
  const c0 = toScreen(0, 0);
  rrect(ctx, c0.sx - 3, c0.sy - H - 8, 6, H + 8, 1, shade(room.wallTrim, -0.2));
  for (const p of room.portals) drawPortalDoor(ctx, room, p);

  // Floor
  for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) drawFloorTile(ctx, room, x, y);
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
  if (room.lighting === 'tarde') {
    const g = ctx.createLinearGradient(w, 0, 0, h);
    g.addColorStop(0, 'rgba(255,170,90,0.20)');
    g.addColorStop(0.6, 'rgba(255,140,80,0.05)');
    g.addColorStop(1, 'rgba(90,60,140,0.10)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (room.lighting === 'manha') {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, w * 0.7, h);
    g.addColorStop(0, 'rgba(255,230,170,0.16)');
    g.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = g;
    for (let i = 0; i < 3; i++) {
      const off = i * w * 0.12 + Math.sin(t * 0.3 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(w * 0.05 + off, 0);
      ctx.lineTo(w * 0.12 + off, 0);
      ctx.lineTo(w * 0.62 + off, h);
      ctx.lineTo(w * 0.48 + off, h);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    const g = ctx.createRadialGradient(w * 0.6, h * 0.45, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(255,200,120,0.08)');
    g.addColorStop(1, 'rgba(20,20,60,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
