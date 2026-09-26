import { hatById } from '@tudobem/shared';
import { circle, ellipse, rrect, type Ctx } from './draw';
import { spriteUrl } from '../art/sprites';
import { drawHatIcon as drawHatArt } from './avatar';

const cache = new Map<string, string>();

function make(key: string, size: number, draw: (ctx: Ctx) => void): string {
  const k = `${key}@${size}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const ctx = c.getContext('2d')!;
  ctx.scale((size * 2) / 64, (size * 2) / 64);
  draw(ctx);
  const url = c.toDataURL();
  cache.set(k, url);
  return url;
}

function cup(ctx: Ctx, color: string, small: boolean, foam?: string) {
  const w = small ? 20 : 26;
  const h = small ? 18 : 26;
  const x = 32 - w / 2;
  const y = 50 - h;
  ellipse(ctx, 32, 54, w * 0.9, 5, '#e8e2d8');
  ellipse(ctx, 32, 53, w * 0.75, 3.5, '#fff');
  rrect(ctx, x, y, w, h, [2, 2, 8, 8], '#ffffff', '#d6cfc4', 1.5);
  ctx.strokeStyle = '#d6cfc4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + w + 2, y + h / 2, 5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ellipse(ctx, 32, y + 3, w / 2 - 2, 3, color);
  if (foam) ellipse(ctx, 30, y + 3, w / 4, 1.8, foam);
}

const FOOD: Record<string, (ctx: Ctx) => void> = {
  pao: (ctx) => {
    ellipse(ctx, 32, 40, 22, 13, '#c9822f');
    ellipse(ctx, 32, 37, 20, 10, '#e2a04a');
    ctx.strokeStyle = '#f7d38f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(18, 38);
    ctx.quadraticCurveTo(32, 30, 46, 38);
    ctx.stroke();
  },
  pao_na_chapa: (ctx) => {
    rrect(ctx, 12, 26, 40, 24, 8, '#d18b3a');
    rrect(ctx, 14, 24, 36, 20, 7, '#f0c27a');
    ctx.strokeStyle = '#a8662f';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(18 + i * 8, 26);
      ctx.lineTo(14 + i * 8, 42);
      ctx.stroke();
    }
    rrect(ctx, 26, 28, 12, 7, 2, '#fff3b0');
  },
  pao_de_queijo: (ctx) => {
    for (const [x, y] of [[22, 42], [40, 42], [31, 30]]) {
      circle(ctx, x, y, 10, '#e9c060');
      circle(ctx, x - 2, y - 3, 6, '#f6dc8e');
      circle(ctx, x + 3, y + 2, 1.2, '#c99a30');
    }
  },
  coxinha: (ctx) => {
    ctx.fillStyle = '#c77b2e';
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.bezierCurveTo(52, 30, 52, 54, 32, 54);
    ctx.bezierCurveTo(12, 54, 12, 30, 32, 12);
    ctx.fill();
    ctx.fillStyle = '#e39a45';
    ctx.beginPath();
    ctx.moveTo(32, 16);
    ctx.bezierCurveTo(46, 30, 46, 48, 32, 49);
    ctx.bezierCurveTo(20, 48, 20, 32, 32, 16);
    ctx.fill();
    for (let i = 0; i < 10; i++) circle(ctx, 24 + (i * 7) % 18, 26 + (i * 11) % 22, 1.2, '#a8601f');
  },
  misto_quente: (ctx) => {
    ctx.fillStyle = '#d9913f';
    ctx.beginPath();
    ctx.moveTo(10, 44);
    ctx.lineTo(54, 44);
    ctx.lineTo(32, 18);
    ctx.fill();
    ctx.fillStyle = '#f4c9a0';
    ctx.fillRect(14, 40, 36, 3);
    ctx.fillStyle = '#f7d54a';
    ctx.fillRect(13, 43, 38, 3);
    ctx.fillStyle = '#e3a352';
    ctx.beginPath();
    ctx.moveTo(10, 47);
    ctx.lineTo(54, 47);
    ctx.lineTo(52, 51);
    ctx.lineTo(12, 51);
    ctx.fill();
  },

  bolo: (ctx) => {
    ctx.fillStyle = '#e9b949';
    ctx.beginPath();
    ctx.moveTo(12, 46);
    ctx.lineTo(52, 46);
    ctx.lineTo(52, 30);
    ctx.lineTo(24, 20);
    ctx.lineTo(12, 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c98f2a';
    ctx.beginPath();
    ctx.moveTo(12, 30);
    ctx.lineTo(24, 20);
    ctx.lineTo(52, 30);
    ctx.lineTo(40, 36);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 8; i++) circle(ctx, 18 + (i * 9) % 30, 36 + (i * 5) % 8, 1, '#c98f2a');
  },
  cafe: (ctx) => cup(ctx, '#3b2012', true),
  cafe_com_leite: (ctx) => cup(ctx, '#b07a4a', false, '#f4e3cf'),
  pastel: (ctx) => {
    // Half-moon fried pastry with a crimped edge.
    ctx.fillStyle = '#d9913f';
    ctx.beginPath();
    ctx.moveTo(8, 44);
    ctx.quadraticCurveTo(32, 6, 56, 44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f0bd6a';
    ctx.beginPath();
    ctx.moveTo(12, 42);
    ctx.quadraticCurveTo(32, 12, 52, 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c47a2c';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(10 + i * 5.5, 44, 2.6, 0, Math.PI);
      ctx.fill();
    }
    for (let i = 0; i < 6; i++) circle(ctx, 22 + (i * 7) % 22, 30 + (i * 5) % 8, 1.3, '#fbe3a8');
  },
  agua: (ctx) => {
    rrect(ctx, 24, 10, 16, 6, 2, '#2b5ba8');
    ctx.fillStyle = 'rgba(190,225,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(24, 16);
    ctx.lineTo(40, 16);
    ctx.quadraticCurveTo(46, 22, 45, 30);
    ctx.lineTo(45, 54);
    ctx.lineTo(19, 54);
    ctx.lineTo(19, 30);
    ctx.quadraticCurveTo(18, 22, 24, 16);
    ctx.fill();
    rrect(ctx, 19, 32, 26, 12, 1, '#3aa6a0');
    ctx.fillStyle = '#fff';
    ctx.font = '800 7px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ÁGUA', 32, 40.5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(22, 20, 3, 30);
  },
  suco_de_laranja: (ctx) => {
    ctx.fillStyle = 'rgba(220,240,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(20, 14);
    ctx.lineTo(44, 14);
    ctx.lineTo(40, 54);
    ctx.lineTo(24, 54);
    ctx.fill();
    ctx.fillStyle = '#f39c1f';
    ctx.beginPath();
    ctx.moveTo(21, 22);
    ctx.lineTo(43, 22);
    ctx.lineTo(40, 52);
    ctx.lineTo(24, 52);
    ctx.fill();
    circle(ctx, 42, 16, 7, '#f7b733');
    circle(ctx, 42, 16, 4.5, '#ffd36b');
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(25, 24, 3, 24);
  },
  guarana: (ctx) => {
    rrect(ctx, 20, 12, 24, 42, 6, '#2e9e3a');
    rrect(ctx, 20, 12, 24, 5, 3, '#c9c9c9');
    ellipse(ctx, 32, 32, 9, 11, '#f4efe6');
    circle(ctx, 32, 30, 4, '#c23b4e');
    circle(ctx, 32, 30, 1.6, '#2a2233');
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(23, 18, 3, 32);
  },
};

/** Food icon in a 64×64 box. */
export function drawFoodIcon(ctx: Ctx, itemId: string) {
  ellipse(ctx, 32, 56, 22, 4, 'rgba(0,0,0,0.12)');
  (FOOD[itemId] ?? FOOD.pao)(ctx);
}

/** A hat on its own with a soft floor shadow, in a 64×64 box. */
export function drawHatIcon(ctx: Ctx, hatId: string) {
  const hat = hatById(hatId);
  if (hat) drawHatArt(ctx, hat);
}

export function foodIcon(itemId: string, size = 64): string {
  return spriteUrl(`food/${itemId}`) ?? make(`food:${itemId}`, size, (ctx) => drawFoodIcon(ctx, itemId));
}

export function hatIcon(hatId: string, size = 72): string {
  return spriteUrl(`hats/${hatId}`) ?? make(`hat:${hatId}`, size, (ctx) => drawHatIcon(ctx, hatId));
}
