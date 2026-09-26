import {
  buildGrid,
  furnitureById,
  isCpuId,
  isWalkable,
  key,
  positionAlong,
  propTiles,
  ROOMS,
  type Dir,
  type NpcDef,
  type PlacedFurniture,
  type PortalDef,
  type PropDef,
  type RoomDef,
  type Tile,
} from '@tudobem/shared';
import { game, type Bubble, type ClientAvatar } from '../state';
import { computeCamera, HH, HW, tileCenter, toScreen, toTile, screenToWorld, worldToClient, type Camera } from './iso';
import { diamond, ellipse, FONT_BODY, rrect, shadow, wrapText, type Ctx, circle } from './draw';
import { drawBackground, drawLighting, drawRoomStatic } from './room';
import { drawFurniture, drawProp, SLICED_PROPS } from './props';
import { drawAvatar } from './avatar';
import { drawSprite, furnitureKey, propKey } from '../art/sprites';

export type Hit =
  | { kind: 'avatar'; id: string }
  | { kind: 'npc'; npc: NpcDef }
  | { kind: 'prop'; prop: PropDef }
  | { kind: 'portal'; portal: PortalDef }
  | { kind: 'seat'; tile: Tile }
  | { kind: 'furniture'; f: PlacedFurniture }
  | { kind: 'tile'; tile: Tile };

interface HitBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  hit: Hit;
  depth: number;
}

interface Drawable {
  depth: number;
  draw: () => void;
}

interface Pigeon {
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  flip: boolean;
  peck: number;
}

const PROP_HEIGHT: Partial<Record<PropDef['kind'], number>> = {
  barraca_chapeus: 120,
  quiosque: 156,
  poleiro: 95,
  trilho_pedidos: 110,
  banca: 80,
};

export class WorldRenderer {
  readonly ctx: Ctx;
  cam: Camera = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  private staticLayer: HTMLCanvasElement | null = null;
  private staticKey = '';
  private staticBounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private hitBoxes: HitBox[] = [];
  private pigeons: Pigeon[] = [];
  private w = 0;
  private h = 0;
  private lastT = 0;
  /** Tiles to point a guide arrow at (tutorial hints). */
  guides: { x: number; y: number; lift: number; label: string }[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.cam.dpr = dpr;
    this.staticKey = '';
  }

  private ensureCamera(room: RoomDef) {
    const narrow = this.w < 700;
    const p = game.profile;
    const checklist = !!p && !(p.tutorialRewarded && Object.values(p.tutorial).every(Boolean));
    const wide = this.w > 1100;
    this.cam = computeCamera(this.w, this.h, room.cols, room.rows, room.wallHeight, this.cam.dpr, {
      top: narrow ? 60 : 64,
      bottom: narrow ? 130 : 110,
      left: checklist && wide ? 250 : 0,
      right: game.editMode && wide ? 300 : 0,
    });
    const k = `${room.id}:${this.w}x${this.h}:${this.cam.scale.toFixed(3)}`;
    if (k !== this.staticKey) {
      this.staticKey = k;
      this.buildStatic(room);
      this.initPigeons(room);
    }
  }

  private buildStatic(room: RoomDef) {
    const pad = room.id === 'praca' ? 360 : 60;
    const x0 = -room.rows * HW - pad;
    const x1 = room.cols * HW + pad;
    const y0 = -room.wallHeight - (room.id === 'praca' ? 320 : 40);
    const y1 = (room.cols + room.rows) * HH + 30;
    const s = this.cam.scale * this.cam.dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * s);
    c.height = Math.ceil((y1 - y0) * s);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    drawRoomStatic(ctx, room);
    this.staticLayer = c;
    this.staticBounds = { x0, y0, x1, y1 };
  }

  private initPigeons(room: RoomDef) {
    this.pigeons = [];
    if (room.id !== 'praca') return;
    const g = buildGrid(room);
    const spots: Tile[] = [];
    for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) if (isWalkable(g, x, y)) spots.push({ x, y });
    // A few loners plus two little flocks pecking together (pigeons cluster in real praças).
    const flocks = [spots[(11 * 37 + 5) % spots.length], spots[(3 * 53 + 17) % spots.length]];
    for (let i = 0; i < 10; i++) {
      const s = i < 3 ? spots[(i * 37 + 11) % spots.length] : flocks[i % 2];
      const jx = i < 3 ? 0.3 : 0.15 + ((i * 0.37) % 0.7);
      const jy = i < 3 ? 0.3 : 0.15 + ((i * 0.61) % 0.7);
      this.pigeons.push({ x: s.x + jx, y: s.y + jy, tx: s.x + jx, ty: s.y + jy, wait: i * 0.7, flip: i % 2 === 0, peck: 0 });
    }
  }

  private updatePigeons(dt: number, room: RoomDef, avatars: { x: number; y: number }[]) {
    const g = buildGrid(room, game.furniture);
    for (const p of this.pigeons) {
      const near = avatars.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 1.2);
      p.wait -= dt;
      if (near || p.wait <= 0) {
        for (let tries = 0; tries < 6; tries++) {
          const ang = Math.random() * Math.PI * 2;
          const d = near ? 2.5 : 0.6 + Math.random() * 1.5;
          const tx = p.x + Math.cos(ang) * d;
          const ty = p.y + Math.sin(ang) * d;
          if (isWalkable(g, Math.floor(tx), Math.floor(ty))) {
            p.tx = tx;
            p.ty = ty;
            break;
          }
        }
        p.wait = 2 + Math.random() * 4;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const sp = (near ? 4 : 1.1) * dt;
      if (dist > 0.02) {
        p.x += (dx / dist) * Math.min(sp, dist);
        p.y += (dy / dist) * Math.min(sp, dist);
        p.flip = dx - dy < 0;
        p.peck = 0;
      } else p.peck += dt;
    }
  }

  private drawPigeon(p: Pigeon, t: number) {
    const ctx = this.ctx;
    const { sx, sy } = toScreen(p.x, p.y);
    ctx.save();
    ctx.translate(sx, sy);
    if (p.flip) ctx.scale(-1, 1);
    const peck = p.peck > 0 ? Math.max(0, Math.sin(p.peck * 6 + p.x)) * 3 : 0;
    const hop = p.peck === 0 ? Math.abs(Math.sin(t * 18 + p.y)) * 1.5 : 0;
    shadow(ctx, 0, 0, 6, 2.5, 0.28);
    ellipse(ctx, 0, -6 - hop, 7, 5, '#8d8d99');
    ellipse(ctx, -3, -6 - hop, 4, 3, '#6e6e7a');
    circle(ctx, 5, -10 - hop + peck, 3.2, '#6b6b7d');
    ellipse(ctx, 4, -8 - hop + peck, 2, 1.2, '#5aa89a');
    ctx.fillStyle = '#e8a94f';
    ctx.fillRect(7.5, -10.5 - hop + peck, 2.5, 1.2);
    ctx.strokeStyle = '#d9776a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-1, -2 - hop);
    ctx.lineTo(-1, 0);
    ctx.moveTo(1.5, -2 - hop);
    ctx.lineTo(1.5, 0);
    ctx.stroke();
    ctx.restore();
  }

  avatarPos(a: ClientAvatar, now: number) {
    return positionAlong(a.from, a.path, now - a.start, a.pub.dir);
  }

  tileToClient(x: number, y: number) {
    const c = tileCenter(x, y);
    return worldToClient(this.cam, c.sx, c.sy);
  }

  frame(now: number) {
    const room = game.roomDef;
    const ctx = this.ctx;
    const t = now / 1000;
    const dt = Math.min(0.1, t - (this.lastT || t));
    this.lastT = t;
    ctx.setTransform(this.cam.dpr, 0, 0, this.cam.dpr, 0, 0);
    if (!room || !game.room) {
      ctx.fillStyle = '#2a2233';
      ctx.fillRect(0, 0, this.w, this.h);
      return;
    }
    this.ensureCamera(room);
    drawBackground(ctx, room, this.w, this.h);
    if (this.staticLayer) {
      const b = this.staticBounds;
      const tl = worldToClient(this.cam, b.x0, b.y0);
      ctx.drawImage(this.staticLayer, tl.px, tl.py, (b.x1 - b.x0) * this.cam.scale, (b.y1 - b.y0) * this.cam.scale);
    }

    const s = this.cam.scale;
    const setWorld = () => ctx.setTransform(this.cam.dpr * s, 0, 0, this.cam.dpr * s, this.cam.dpr * this.cam.ox, this.cam.dpr * this.cam.oy);
    setWorld();
    this.hitBoxes = [];
    const hitRect = (wx: number, wy: number, w: number, h: number, hit: Hit, depth: number) => {
      const a = worldToClient(this.cam, wx - w / 2, wy - h);
      const b = worldToClient(this.cam, wx + w / 2, wy);
      this.hitBoxes.push({ x0: a.px, y0: a.py, x1: b.px, y1: b.py, hit, depth });
    };

    const grid = buildGrid(room, game.furniture);

    // ---- floor overlays
    for (const f of game.furniture) {
      const def = furnitureById(f.itemId);
      if (def?.kind === 'tapete') {
        const c = tileCenter(f.x, f.y);
        if (!drawSprite(ctx, furnitureKey(f.itemId, f.rot), c.sx, c.sy)) drawFurniture(ctx, def, f.rot, c.sx, c.sy, t);
        hitRect(c.sx, c.sy + 8, 50, 20, { kind: 'furniture', f }, -1);
      }
    }
    if (game.hoverTile && !game.modalOpen) {
      const ht = game.hoverTile;
      const c = tileCenter(ht.x, ht.y);
      const ok = game.placing ? this.canPlaceHere(room, ht) : isWalkable(grid, ht.x, ht.y);
      if (ht.x >= 0 && ht.y >= 0 && ht.x < room.cols && ht.y < room.rows)
        diamond(ctx, c.sx, c.sy, 1, 1, ok ? 'rgba(255,255,255,0.22)' : 'rgba(229,87,47,0.25)', ok ? 'rgba(255,255,255,0.8)' : 'rgba(229,87,47,0.8)', 2);
    }
    const self = game.self;
    if (self && self.path.length) {
      const end = self.path[self.path.length - 1];
      const pos = this.avatarPos(self, now);
      if (pos.moving) {
        const c = tileCenter(end.x, end.y);
        const pulse = 0.5 + Math.sin(t * 8) * 0.2;
        ellipse(ctx, c.sx, c.sy, 14 * (1 + pulse * 0.3), 7 * (1 + pulse * 0.3), `rgba(242,194,48,${0.5 * pulse + 0.2})`);
      }
    }

    // ---- depth-sorted world objects
    const items: Drawable[] = [];
    for (const p of room.props) {
      if (SLICED_PROPS.has(p.kind)) {
        propTiles(p).forEach((tile, i) => {
          const c = tileCenter(tile.x, tile.y);
          items.push({ depth: tile.x + tile.y, draw: () => drawSprite(ctx, propKey(p, i), c.sx, c.sy) || drawProp(ctx, p, c.sx, c.sy, t, i) });
        });
        continue;
      }
      const c = tileCenter(p.x, p.y);
      const depth = p.x + (p.w ?? 1) - 1 + p.y + (p.h ?? 1) - 1;
      items.push({ depth, draw: () => drawSprite(ctx, propKey(p), c.sx, c.sy) || drawProp(ctx, p, c.sx, c.sy, t, 0, { parrotAdopted: !!game.profile?.parrotOwned }) });
      if (p.action) {
        const [ox, oy] = [((p.w ?? 1) - 1) * HW * 0.5 - ((p.h ?? 1) - 1) * HW * 0.5, (((p.w ?? 1) - 1) + ((p.h ?? 1) - 1)) * HH * 0.5];
        hitRect(c.sx + ox, c.sy + oy + 10, 34 + ((p.w ?? 1) - 1) * 40, PROP_HEIGHT[p.kind] ?? 70, { kind: 'prop', prop: p }, depth);
      } else if (p.seat) {
        hitRect(c.sx, c.sy + 10, 40, 40, { kind: 'seat', tile: { x: p.x, y: p.y } }, depth);
      }
    }
    for (const f of game.furniture) {
      const def = furnitureById(f.itemId);
      if (!def || def.kind === 'tapete') continue;
      const c = tileCenter(f.x, f.y);
      const sel = game.selectedFurniture === f.uid;
      items.push({
        depth: f.x + f.y,
        draw: () => {
          if (sel) diamond(ctx, c.sx, c.sy, 1, 1, 'rgba(242,194,48,0.35)', '#f2c230', 2);
          if (!drawSprite(ctx, furnitureKey(f.itemId, f.rot), c.sx, c.sy)) drawFurniture(ctx, def, f.rot, c.sx, c.sy, t);
        },
      });
      hitRect(c.sx, c.sy + 8, 44, 60, game.editMode || !def.seat ? { kind: 'furniture', f } : { kind: 'seat', tile: { x: f.x, y: f.y } }, f.x + f.y);
    }
    if (game.placing && game.hoverTile && this.canPlaceHere(room, game.hoverTile)) {
      const def = furnitureById(game.placing.itemId);
      const ht = game.hoverTile;
      if (def) {
        const c = tileCenter(ht.x, ht.y);
        const rot = game.placing.rot;
        items.push({
          depth: ht.x + ht.y + 0.5,
          draw: () => {
            ctx.save();
            ctx.globalAlpha = 0.6;
            const ok = drawSprite(ctx, furnitureKey(def.id, rot), c.sx, c.sy);
            ctx.restore();
            if (!ok) drawFurniture(ctx, def, rot, c.sx, c.sy, t, true);
          },
        });
      }
    }
    for (const n of room.npcs) {
      const c = tileCenter(n.x, n.y);
      items.push({
        depth: n.x + n.y + 0.02,
        draw: () => drawAvatar(ctx, c.sx, c.sy, n.appearance, n.hat, false, { dir: n.dir, t, moving: false, sitting: false, seed: n.x * 1.7 }),
      });
      hitRect(c.sx, c.sy + 6, 36, 104, { kind: 'npc', npc: n }, n.x + n.y + 0.5);
    }
    const avatarScreen: { a: ClientAvatar; sx: number; sy: number; sitting: boolean }[] = [];
    for (const a of game.avatars.values()) {
      const pos = this.avatarPos(a, now);
      const sitting = !pos.moving && (a.pub.sitting || a.sitOnArrive);
      let dir: Dir = pos.dir;
      if (sitting) dir = grid.seats.get(key(pos.tile.x, pos.tile.y)) ?? dir;
      if (!pos.moving && !sitting && !a.path.length) dir = a.pub.dir;
      const c = tileCenter(pos.x, pos.y);
      avatarScreen.push({ a, sx: c.sx, sy: c.sy, sitting });
      items.push({
        depth: pos.x + pos.y + 0.05,
        draw: () =>
          drawAvatar(ctx, c.sx, c.sy, a.pub.appearance, a.pub.hat, a.pub.parrot, { dir, t, moving: pos.moving, sitting, emote: a.emote, seed: a.seed }),
      });
      hitRect(c.sx, c.sy + 6 + (sitting ? 13 : 0), 34, 100, { kind: 'avatar', id: a.pub.id }, pos.x + pos.y + 0.6);
    }
    if (this.pigeons.length) {
      this.updatePigeons(
        dt,
        room,
        avatarScreen.map((s) => {
          const p = this.avatarPos(s.a, now);
          return { x: p.x + 0.5, y: p.y + 0.5 };
        }),
      );
      for (const p of this.pigeons) items.push({ depth: p.x + p.y - 1, draw: () => this.drawPigeon(p, t) });
    }
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();

    // ---- portals hit areas (door on the wall + its floor tile)
    for (const p of room.portals) {
      const along = p.wall === 'left' ? toScreen(0, p.y + 0.5) : toScreen(p.x + 0.5, 0);
      hitRect(along.sx, along.sy + 4, 34, 96, { kind: 'portal', portal: p }, -0.5);
    }

    ctx.setTransform(this.cam.dpr, 0, 0, this.cam.dpr, 0, 0);
    drawLighting(ctx, room, this.w, this.h, t);

    // ---- screen-space overlays: guides, nameplates, bubbles
    for (const g of this.guides) {
      const c = tileCenter(g.x, g.y);
      const p = worldToClient(this.cam, c.sx, c.sy - g.lift);
      this.drawGuide(p.px, p.py + Math.sin(t * 4) * 5, g.label);
    }
    for (const n of room.npcs) {
      const c = tileCenter(n.x, n.y);
      const p = worldToClient(this.cam, c.sx, c.sy - 97);
      this.drawPlate(p.px, p.py, n.name, 'npc', n.role.pt);
      const b = game.npcBubbles.get(n.id);
      if (b) this.drawBubbles(p.px, p.py - 18, [b], now);
    }
    for (const s of avatarScreen) {
      const hatLift = s.a.pub.hat ? 10 : 0;
      const p = worldToClient(this.cam, s.sx, s.sy - 93 - hatLift + (s.sitting ? 13 : 0));
      const isSelf = s.a.pub.id === game.room.selfId;
      this.drawPlate(p.px, p.py, s.a.pub.name, isSelf ? 'self' : 'verde');
      s.a.bubbles = s.a.bubbles.filter((b) => now - b.at < 7000);
      if (s.a.bubbles.length) this.drawBubbles(p.px, p.py - 16, s.a.bubbles.slice(-2), now);
    }
  }

  private canPlaceHere(room: RoomDef, t: Tile) {
    const g = buildGrid(room, []);
    if (t.x < 0 || t.y < 0 || t.x >= room.cols || t.y >= room.rows) return false;
    if (g.reserved.has(key(t.x, t.y))) return false;
    return !game.furniture.some((f) => f.x === t.x && f.y === t.y);
  }

  private drawGuide(x: number, y: number, text: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `800 12px ${FONT_BODY}`;
    const w = ctx.measureText(text).width + 18;
    rrect(ctx, x - w / 2, y - 44, w, 24, 12, '#f2c230', '#2a2233', 2);
    ctx.fillStyle = '#2a2233';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - 32);
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 20);
    ctx.lineTo(x + 8, y - 20);
    ctx.lineTo(x, y - 8);
    ctx.closePath();
    ctx.fillStyle = '#f2c230';
    ctx.fill();
    ctx.strokeStyle = '#2a2233';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawPlate(x: number, y: number, name: string, style: 'verde' | 'self' | 'npc', role?: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `800 12px ${FONT_BODY}`;
    ctx.textBaseline = 'middle';
    const label = role ? `${name} · ${role}` : name;
    const tw = ctx.measureText(label).width;
    const icon = style === 'npc' ? 0 : 16;
    const w = tw + 16 + icon;
    // Solid plates in palette.md tokens: sp-green Verde, terracotta NPC, mustard ring on yourself.
    const bg = style === 'npc' ? '#C45C26' : '#2F5D50';
    rrect(ctx, x - w / 2 + 1, y - 8, w, 20, 10, 'rgba(44,30,20,0.3)');
    rrect(ctx, x - w / 2, y - 10, w, 20, 10, bg, '#2C2C2C', 1);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 3, y - 8.5, w - 6, 7, 5);
    ctx.fill();
    if (style === 'self') rrect(ctx, x - w / 2 - 2.5, y - 12.5, w + 5, 25, 12.5, undefined, '#D4A017', 2.5);
    if (icon) {
      // Seedling icon (Verde plate) — shape + color so it reads for colorblind players.
      const ix = x - w / 2 + 13;
      circle(ctx, ix, y, 7.5, '#F5E6D3');
      ctx.strokeStyle = '#2F5D50';
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ix, y + 5);
      ctx.lineTo(ix, y - 0.5);
      ctx.stroke();
      ctx.fillStyle = '#3f8a4a';
      ctx.beginPath();
      ctx.ellipse(ix - 2.8, y - 1.8, 3, 1.7, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5fb35a';
      ctx.beginPath();
      ctx.ellipse(ix + 2.8, y - 3.2, 3, 1.7, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFF8EC';
    ctx.textAlign = 'left';
    ctx.fillText(label, x - w / 2 + 8 + icon, y + 0.5);
    ctx.restore();
  }

  private drawBubbles(x: number, y: number, bubbles: Bubble[], now: number) {
    const ctx = this.ctx;
    let by = y;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      const age = now - b.at;
      const alpha = Math.min(1, age / 120) * Math.min(1, (7000 - age) / 700);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      const maxW = 230;
      ctx.font = `800 13.5px ${FONT_BODY}`;
      const lines = wrapText(ctx, b.text, maxW);
      ctx.font = `italic 600 12px ${FONT_BODY}`;
      const glines = b.gloss ? wrapText(ctx, b.gloss, maxW - 22) : [];
      ctx.font = `800 13.5px ${FONT_BODY}`;
      let w = Math.max(...lines.map((l) => ctx.measureText(l).width));
      ctx.font = `italic 600 12px ${FONT_BODY}`;
      if (glines.length) w = Math.max(w, ...glines.map((l) => ctx.measureText(l).width + 22));
      w += 20;
      const h = lines.length * 17 + (glines.length ? glines.length * 15 + 9 : 0) + 12;
      const top = by - h - 8;
      rrect(ctx, x - w / 2 + 1.5, top + 2.5, w, h, 12, 'rgba(44,30,20,0.18)');
      rrect(ctx, x - w / 2, top, w, h, 12, '#FFFBF2', 'rgba(44,44,44,0.8)', 1);
      if (i === bubbles.length - 1) {
        ctx.beginPath();
        ctx.moveTo(x - 7, top + h - 0.5);
        ctx.lineTo(x, top + h + 8);
        ctx.lineTo(x + 7, top + h - 0.5);
        ctx.fillStyle = '#FFFBF2';
        ctx.fill();
        ctx.strokeStyle = 'rgba(44,44,44,0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#2a2233';
      ctx.font = `800 13.5px ${FONT_BODY}`;
      lines.forEach((l, k) => ctx.fillText(l, x, top + 7 + k * 17));
      if (glines.length) {
        const gy = top + 7 + lines.length * 17 + 3;
        ctx.strokeStyle = 'rgba(46,158,91,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + 10, gy);
        ctx.lineTo(x + w / 2 - 10, gy);
        ctx.stroke();
        glines.forEach((l, k) => {
          ctx.font = `italic 600 12px ${FONT_BODY}`;
          const lw = ctx.measureText(l).width;
          const lx = x - (lw + 22) / 2;
          if (k === 0) {
            ctx.font = `800 9px ${FONT_BODY}`;
            ctx.fillStyle = '#2e9e5b';
            ctx.textAlign = 'left';
            ctx.fillText('EN', lx, gy + 6);
          }
          ctx.font = `italic 600 12px ${FONT_BODY}`;
          ctx.fillStyle = '#5d5366';
          ctx.textAlign = 'left';
          ctx.fillText(l, lx + 20, gy + 4 + k * 15);
        });
      }
      ctx.restore();
      by = top - 4;
    }
  }

  hitTest(px: number, py: number): Hit | null {
    const room = game.roomDef;
    if (!room) return null;
    const hits = this.hitBoxes.filter((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
    if (game.editMode || game.placing) {
      const f = hits.filter((h) => h.hit.kind === 'furniture').sort((a, b) => b.depth - a.depth)[0];
      if (f && !game.placing) return f.hit;
    } else if (hits.length) {
      // Prefer people and actions over seats/furniture when stacked.
      const rank = (h: Hit) => (h.kind === 'avatar' && isCpuId(h.id) ? 0 : h.kind === 'npc' || h.kind === 'avatar' ? 3 : h.kind === 'prop' || h.kind === 'portal' ? 2 : 1);
      hits.sort((a, b) => rank(b.hit) - rank(a.hit) || b.depth - a.depth);
      const top = hits[0].hit;
      if (!(top.kind === 'avatar' && top.id === game.room?.selfId)) return top;
      if (hits[1]) return hits[1].hit;
    }
    const w = screenToWorld(this.cam, px, py);
    const tt = toTile(w.wx, w.wy);
    const tile = { x: Math.floor(tt.x), y: Math.floor(tt.y) };
    if (tile.x < 0 || tile.y < 0 || tile.x >= room.cols || tile.y >= room.rows) return null;
    const portal = room.portals.find((p) => p.x === tile.x && p.y === tile.y);
    if (portal && !game.placing) return { kind: 'portal', portal };
    return { kind: 'tile', tile };
  }

  tileAt(px: number, py: number): Tile | null {
    const room = game.roomDef;
    if (!room) return null;
    const w = screenToWorld(this.cam, px, py);
    const tt = toTile(w.wx, w.wy);
    const tile = { x: Math.floor(tt.x), y: Math.floor(tt.y) };
    if (tile.x < 0 || tile.y < 0 || tile.x >= room.cols || tile.y >= room.rows) return null;
    return tile;
  }
}

export function roomDef(id: keyof typeof ROOMS) {
  return ROOMS[id];
}
