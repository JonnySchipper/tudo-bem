/**
 * Top-down room view for `?view=pixel`.
 * Reuses the Phase 1 manifest, terrain masks, character composer and grade math.
 * Phaser does not own input or game truth.
 */
import Phaser from 'phaser';
import {
  SKIN_TONES,
  furnitureById,
  gameMinutes,
  isCpuId,
  positionAlong,
  seatTiles,
  type PropKind,
  type RoomDef,
  type Tile,
} from '@tudobem/shared';
import { game } from '../../state';
import type { Guide, Hit } from '../view';
import { animKey, composeCharacter, sitFrame, type Facing } from './charsheet';
import {
  DEPTH_DECAL,
  DEPTH_OVERHEAD,
  DEPTH_TERRAIN,
  T,
  cameraZoom,
  cssZoomFor,
  feet,
  standingDepth,
  tileToWorld,
  worldToTile,
} from './coords';
import { FACING } from './facing';
import { pickHit, type ScreenBox } from './hitbox';
import { gradeAt } from './lighting';
import type { Manifest } from './manifest';
import { maskAt, phasedIndex, tileIndex } from './terrain';

/** Outdoor sprites that already exist in the Phase 1 atlas. */
const PROP_SPRITE: Partial<Record<PropKind, string>> = {
  ipe: 'props/ipe_medium',
  banco: 'props/bench_wide',
  poste: 'props/lamp_old',
  lixeira: 'props/trash',
  banca: 'props/banca',
  canteiro: 'props/planter_grass',
  floreira: 'props/pot_red',
  vaso: 'props/pot_teal',
};

/** Floors with no mask tileset yet. Flat brand fills, recorded as missing art. */
const FLOOR_FILL: Record<string, number> = {
  t: 0xc4a574,
  l: 0xd7c4a8,
  m: 0x8b5e3c,
  j: 0x2f5d50,
  k: 0xf5e6d3,
};

const NORTH_WALL_TILES = 3;

interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image | null;
}

export class WorldScene extends Phaser.Scene {
  manifest: Manifest | null = null;
  base = '';
  dpr = 1;
  cssZoom = 3;
  readonly artMissing: string[] = [];
  private now = 0;
  private roomKey = '';
  private roomRoot: Phaser.GameObjects.Container | null = null;
  private actors = new Map<string, Actor>();
  private labels: HTMLElement | null = null;
  private grade: Phaser.GameObjects.Rectangle | null = null;
  private boxes: ScreenBox[] = [];
  private loggedSkips = new Set<string>();

  constructor(private readonly guidesOf: () => Guide[]) {
    super('world');
  }

  setNow(now: number): void {
    this.now = now;
  }

  preload(): void {
    const m = this.manifest;
    if (!m) return;
    const b = this.base;
    for (const [name, a] of Object.entries(m.atlases)) this.load.atlas(name, b + a.image, b + a.data);
    this.load.image('terrainTs', b + m.terrain.tileset);
    for (const [key, file] of Object.entries(m.chars)) this.load.image(`layer:${key}`, b + file);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#1d1b26');
    this.applyZoom();
    if (this.manifest) {
      SKIN_TONES.forEach((skin, i) => {
        composeCharacter(
          this,
          `char_skin_${i}`,
          [
            { texture: 'layer:body_medio', ramps: { skin } },
            { texture: 'layer:outfit_o01', ramps: { top: '#c9582c', bottom: '#3d5d8f' } },
            { texture: 'layer:hair_h02', ramps: { hair: '#3a241a' } },
          ],
          this.manifest!.sheet,
        );
      });
    }
    this.grade = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff)
      .setScrollFactor(0)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(90000);
    this.ensureLabels();
    this.scale.on('resize', () => this.applyZoom());
  }

  private updateFailed = false;

  override update(): void {
    try {
      this.step();
    } catch (e) {
      if (!this.updateFailed) {
        this.updateFailed = true;
        console.error('[TB] pixel update failed', e);
      }
    }
  }

  private step(): void {
    this.paintGrade();
    const room = game.roomDef;
    const state = game.room;
    if (!room || !state || !this.manifest) {
      this.destroyRoom();
      this.roomKey = '';
      this.syncActors(null);
      return;
    }
    const key = `${state.room}:${state.instanceId}:${state.ownerId ?? ''}:${game.furniture.map((f) => `${f.uid}@${f.x},${f.y},${f.rot}`).join('|')}`;
    if (key !== this.roomKey) {
      this.destroyRoom();
      this.buildRoom(room);
      this.roomKey = key;
    }
    this.syncActors(room);
    this.follow(room);
    this.updateLabels(room);
  }

  tileToClient(x: number, y: number): { px: number; py: number } {
    const c = tileToWorld(x, y);
    return this.clientOf(c.wx, c.wy);
  }

  hitTest(px: number, py: number): Hit | null {
    const room = game.roomDef;
    if (!room) return null;
    const picked = pickHit(this.boxes, px, py, {
      editMode: game.editMode,
      placing: !!game.placing,
      selfId: game.room?.selfId ?? null,
      isCpu: isCpuId,
    });
    if (picked) return picked;
    const tile = this.tileAt(px, py);
    if (!tile) return null;
    const portal = room.portals.find((p) => p.x === tile.x && p.y === tile.y);
    if (portal && !game.placing) return { kind: 'portal', portal };
    return { kind: 'tile', tile };
  }

  tileAt(px: number, py: number): Tile | null {
    const room = game.roomDef;
    if (!room) return null;
    const w = this.worldOf(px, py);
    const tile = worldToTile(w.wx, w.wy);
    if (tile.x < 0 || tile.y < 0 || tile.x >= room.cols || tile.y >= room.rows) return null;
    return tile;
  }

  private applyZoom(): void {
    const cssW = this.game.canvas.clientWidth || window.innerWidth;
    const cssH = this.game.canvas.clientHeight || window.innerHeight;
    this.cssZoom = cssZoomFor(cssW, cssH);
    this.cameras.main.setZoom(cameraZoom(this.cssZoom, this.dpr));
    this.grade?.setSize(this.scale.width, this.scale.height);
  }

  private paintGrade(): void {
    if (!this.grade) return;
    const [r, g, b] = gradeAt(gameMinutes(Date.now()) / 60);
    this.grade.setFillStyle((r << 16) | (g << 8) | b, 1);
  }

  private destroyRoom(): void {
    this.roomRoot?.destroy(true);
    this.roomRoot = null;
    this.boxes = [];
  }

  private buildRoom(room: RoomDef): void {
    const root = this.add.container(0, 0);
    this.roomRoot = root;
    this.buildTerrain(room, root);
    this.buildWalls(room, root);
    this.buildProps(room, root);
    if (room.private) {
      for (const f of game.furniture) this.placeholder(`furniture/${f.itemId}`, f.x + 0.5, f.y + 1, root);
    }
    this.cameras.main.setBounds(-T, -NORTH_WALL_TILES * T, (room.cols + 2) * T, (room.rows + NORTH_WALL_TILES + 2) * T);
    this.cameras.main.setBackgroundColor(room.wallColor);
  }

  private buildTerrain(room: RoomDef, root: Phaser.GameObjects.Container): void {
    const t = this.manifest!.terrain;
    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: room.cols + 1, height: room.rows + 1 });
    const ts = map.addTilesetImage('terrain', 'terrainTs', T, T, t.margin, t.spacing);
    if (ts) {
      const order = (['a', 'c', 'g'] as const).filter((c) => t.layers[c]);
      order.sort((a, b) => Number(t.layers[a].edge === 'slab') - Number(t.layers[b].edge === 'slab'));
      order.forEach((ch, li) => {
        const def = t.layers[ch];
        const layer = map.createBlankLayer(`terrain_${room.id}_${ch}`, ts, -T / 2, -T / 2, room.cols + 1, room.rows + 1);
        if (!layer) return;
        layer.setDepth(DEPTH_TERRAIN + li);
        root.add(layer);
        for (let j = 0; j <= room.rows; j++) {
          for (let i = 0; i <= room.cols; i++) {
            const mask = maskAt(room.floor, ch, i, j, ' ');
            const idx = def.edge === 'slab' ? phasedIndex(def.first, mask, i, def.phases) : tileIndex(def.first, mask, i, j, def.variants);
            if (idx >= 0) layer.putTileAt(idx, i, j);
          }
        }
      });
    }
    const seen = new Set<string>();
    for (let y = 0; y < room.rows; y++) {
      const row = room.floor[y] ?? '';
      for (let x = 0; x < room.cols; x++) {
        const ch = row[x] ?? ' ';
        if (!ch || ch === ' ' || t.layers[ch]) continue;
        if (!seen.has(ch)) {
          seen.add(ch);
          this.noteMissing(`terrain:${ch}`);
        }
        const fill = FLOOR_FILL[ch] ?? 0xff00ff;
        root.add(this.add.rectangle(x * T, y * T, T, T, fill, fill === 0xff00ff ? 0.35 : 1).setOrigin(0, 0).setDepth(DEPTH_TERRAIN + 2));
      }
    }
  }

  private buildWalls(room: RoomDef, root: Phaser.GameObjects.Container): void {
    const color = parseHex(room.wallColor, 0xf5e6d3);
    const trim = parseHex(room.wallTrim, 0xc45c26);
    root.add(this.add.rectangle(0, -NORTH_WALL_TILES * T, room.cols * T, NORTH_WALL_TILES * T, color).setOrigin(0, 0).setDepth(DEPTH_DECAL));
    root.add(this.add.rectangle(0, -2, room.cols * T, 3, trim).setOrigin(0, 1).setDepth(DEPTH_DECAL + 1));
    root.add(this.add.rectangle(-T, 0, T, room.rows * T, color).setOrigin(0, 0).setDepth(DEPTH_DECAL));
    if (!this.loggedSkips.has(room.id)) {
      this.loggedSkips.add(room.id);
      const skipped = room.walls.filter((w) => w.wall === 'left').map((w) => w.kind);
      if (skipped.length) console.info(`[pixel] ${room.id} west-wall decor skipped until it can sit on the north wall:`, skipped.join(', '));
    }
    for (const wall of room.walls) {
      if (wall.wall !== 'right') continue;
      const mid = (wall.from + wall.to) / 2;
      if (wall.kind === 'fachada_padaria' && this.manifest?.sprites['buildings/shop_padaria']) this.place('buildings/shop_padaria', mid, -0.2, root);
      else this.placeholder(`wall:${wall.kind}`, mid, -1, root, Math.max(1, wall.to - wall.from));
    }
    for (const portal of room.portals) {
      root.add(
        this.add
          .rectangle(portal.x * T + T / 2, portal.y * T + T - 2, 10, 16, trim)
          .setOrigin(0.5, 1)
          .setDepth(standingDepth(portal.y * T + T, portal.id)),
      );
    }
  }

  private buildProps(room: RoomDef, root: Phaser.GameObjects.Container): void {
    for (const prop of room.props) {
      const key = prop.hero ? 'props/ipe_large' : PROP_SPRITE[prop.kind];
      const tx = prop.x + (prop.w ?? 1) / 2;
      const ty = prop.y + (prop.h ?? 1);
      if (key && this.manifest?.sprites[key]) this.place(key, tx, ty, root);
      else this.placeholder(`props/${prop.kind}`, tx, ty, root, prop.w ?? 1, prop.h ?? 1);
      if (key === 'props/ipe_large' || key === 'props/ipe_medium') {
        const canopy = key === 'props/ipe_large' ? 'props/ipe_large_canopy' : 'props/ipe_medium_canopy';
        if (this.manifest?.sprites[canopy]) this.place(canopy, tx, ty, root, DEPTH_OVERHEAD);
      }
    }
  }

  private place(key: string, tx: number, ty: number, root: Phaser.GameObjects.Container, depth = NaN): void {
    const d = this.manifest!.sprites[key];
    const wx = Math.round(tx * T);
    const wy = Math.round(ty * T);
    root.add(
      this.add
        .sprite(wx, wy, d.atlas, d.frame)
        .setOrigin(d.ax / d.w, d.ay / d.h)
        .setDepth(Number.isNaN(depth) ? standingDepth(wy, key) : depth),
    );
    if (!d.shadow) return;
    const s = this.manifest!.sprites[d.shadow];
    if (!s) return;
    root.add(this.add.image(wx, wy - 1, s.atlas, s.frame).setOrigin(s.ax / s.w, s.ay / s.h).setDepth(DEPTH_DECAL + 4));
  }

  private placeholder(key: string, tx: number, ty: number, root: Phaser.GameObjects.Container, w = 1, h = 1): void {
    this.noteMissing(key);
    const wy = ty * T;
    root.add(
      this.add
        .rectangle(tx * T, wy, w * T, h * T, 0xff00ff, 0.35)
        .setOrigin(0.5, 1)
        .setStrokeStyle(1, 0xff00ff, 1)
        .setDepth(standingDepth(wy, key)),
    );
  }

  private noteMissing(key: string): void {
    if (this.artMissing.includes(key)) return;
    this.artMissing.push(key);
    const tb = (window as unknown as { __tb?: { artMissing?: string[] } }).__tb;
    if (tb) tb.artMissing = this.artMissing;
  }

  private syncActors(room: RoomDef | null): void {
    const meta = this.manifest?.sheet;
    const alive = new Set<string>();
    if (room && meta) {
      for (const npc of room.npcs) alive.add(`npc:${npc.id}`);
      for (const a of game.avatars.values()) alive.add(a.pub.id);
    }
    for (const [id, actor] of this.actors) {
      if (alive.has(id)) continue;
      actor.sprite.destroy();
      actor.shadow?.destroy();
      this.actors.delete(id);
    }
    if (!room || !meta) {
      this.boxes = [];
      return;
    }
    for (const npc of room.npcs) {
      const p = feet(npc.x, npc.y);
      this.pose(this.actor(`npc:${npc.id}`, 'char_skin_2'), p.wx, p.wy, FACING[npc.dir], false, false, `npc:${npc.id}`);
    }
    for (const a of game.avatars.values()) {
      const pos = positionAlong(a.from, a.path, this.now - a.start, a.pub.dir);
      const p = feet(pos.x, pos.y);
      const emote = a.emote && this.now - a.emote.t0 < 1200;
      const bob = emote ? Math.sin((this.now - (a.emote?.t0 ?? 0)) / 80) * 2 : 0;
      const sheet = `char_skin_${a.pub.appearance.skin}`;
      this.pose(this.actor(a.pub.id, sheet), p.wx, p.wy - bob, FACING[pos.dir], pos.moving, a.pub.sitting, a.pub.id);
    }
    this.rebuildBoxes(room);
  }

  private actor(id: string, sheet: string): Actor {
    const existing = this.actors.get(id);
    if (existing) {
      if (existing.sprite.texture.key !== sheet) existing.sprite.setTexture(sheet);
      return existing;
    }
    const shadowDef = this.manifest?.sprites['fx/shadow_16'];
    const shadow = shadowDef
      ? this.add.image(0, 0, shadowDef.atlas, shadowDef.frame).setOrigin(shadowDef.ax / shadowDef.w, shadowDef.ay / shadowDef.h).setDepth(DEPTH_DECAL + 5)
      : null;
    const actor = { sprite: this.add.sprite(0, 0, sheet, 0).setOrigin(0.5, 1), shadow };
    this.actors.set(id, actor);
    return actor;
  }

  private pose(actor: Actor, wx: number, wy: number, facing: Facing, moving: boolean, sitting: boolean, id: string): void {
    const meta = this.manifest!.sheet;
    const sheet = actor.sprite.texture.key;
    actor.sprite.setPosition(wx, wy).setDepth(standingDepth(wy, id));
    actor.shadow?.setPosition(wx, wy - 1);
    if (sitting) {
      actor.sprite.anims.stop();
      actor.sprite.setFrame(sitFrame(meta, facing));
      return;
    }
    const key = animKey(sheet, moving ? 'walk' : 'idle', facing);
    if (this.anims.exists(key) && actor.sprite.anims.currentAnim?.key !== key) actor.sprite.play(key);
  }

  private follow(room: RoomDef): void {
    const actor = game.room?.selfId ? this.actors.get(game.room.selfId) : undefined;
    if (!actor) return;
    const cam = this.cameras.main;
    const viewW = cam.width / (cam.zoom || 1);
    const viewH = cam.height / (cam.zoom || 1);
    const roomW = room.cols * T;
    const top = -NORTH_WALL_TILES * T;
    const contentH = room.rows * T - top;
    const cx = roomW / 2;
    const cy = top + contentH / 2;
    // A view larger than the room cannot scroll inside tight bounds, so Phaser pins the map to the corner.
    if (viewW >= roomW && viewH >= contentH) {
      const bw = Math.max(roomW + 2 * T, viewW);
      const bh = Math.max(contentH + 2 * T, viewH);
      cam.setBounds(cx - bw / 2, cy - bh / 2, bw, bh);
      cam.stopFollow();
      cam.centerOn(cx, cy);
    } else {
      cam.setBounds(-T, top, roomW + 2 * T, contentH + 2 * T);
      cam.startFollow(actor.sprite, true, 0.12, 0.12);
    }
  }

  private rebuildBoxes(room: RoomDef): void {
    const boxes: ScreenBox[] = [];
    const add = (wx: number, wy: number, hw: number, hh: number, hit: Hit, depth: number) => {
      const a = this.clientOf(wx - hw, wy - hh);
      const b = this.clientOf(wx + hw, wy);
      boxes.push({ x0: Math.min(a.px, b.px), y0: Math.min(a.py, b.py), x1: Math.max(a.px, b.px), y1: Math.max(a.py, b.py), hit, depth });
    };
    for (const prop of room.props) {
      if (prop.seat) {
        const seat = seatTiles(room).find((s) => s.prop?.id === prop.id);
        if (seat) add((seat.x + 0.5) * T, (seat.y + 1) * T, 12, 16, { kind: 'seat', tile: { x: seat.x, y: seat.y } }, seat.y);
      } else if (prop.action) {
        add((prop.x + (prop.w ?? 1) / 2) * T, (prop.y + (prop.h ?? 1)) * T, ((prop.w ?? 1) * T) / 2, (prop.h ?? 1) * T, { kind: 'prop', prop }, prop.y + 1);
      }
    }
    for (const portal of room.portals) add((portal.x + 0.5) * T, (portal.y + 1) * T, 14, 22, { kind: 'portal', portal }, portal.y + 2);
    for (const npc of room.npcs) add((npc.x + 0.5) * T, (npc.y + 1) * T - 3, 8, 28, { kind: 'npc', npc }, npc.y + 3);
    for (const f of game.furniture) {
      const def = furnitureById(f.itemId);
      const hit: Hit = !game.editMode && def?.seat ? { kind: 'seat', tile: { x: f.x, y: f.y } } : { kind: 'furniture', f };
      add((f.x + 0.5) * T, (f.y + 1) * T, 12, 18, hit, f.y);
    }
    for (const a of game.avatars.values()) {
      const pos = positionAlong(a.from, a.path, this.now - a.start, a.pub.dir);
      const p = feet(pos.x, pos.y);
      add(p.wx, p.wy, 8, 28, { kind: 'avatar', id: a.pub.id }, pos.y);
    }
    this.boxes = boxes;
  }

  private ensureLabels(): void {
    let layer = document.getElementById('world-labels');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'world-labels';
      document.body.appendChild(layer);
    }
    this.labels = layer;
  }

  private updateLabels(room: RoomDef): void {
    const layer = this.labels;
    if (!layer) return;
    layer.replaceChildren();
    const put = (text: string, cls: string, wx: number, wy: number) => {
      const p = this.clientOf(wx, wy);
      const el = document.createElement('div');
      el.className = cls;
      el.textContent = text;
      el.style.transform = `translate(${Math.round(p.px)}px, ${Math.round(p.py)}px) translate(-50%, -100%)`;
      layer.appendChild(el);
    };
    for (const npc of room.npcs) {
      const f = feet(npc.x, npc.y);
      put(npc.name, 'tb-plate tb-plate-npc', f.wx, f.wy - 30);
    }
    for (const a of game.avatars.values()) {
      const pos = positionAlong(a.from, a.path, this.now - a.start, a.pub.dir);
      const f = feet(pos.x, pos.y);
      const me = a.pub.id === game.room?.selfId;
      put(a.pub.name, me ? 'tb-plate tb-plate-me' : 'tb-plate tb-plate-player', f.wx, f.wy - 30);
      const bubble = a.bubbles[0];
      if (bubble) put(bubble.text, 'tb-bubble', f.wx, f.wy - 46);
    }
    for (const g of this.guidesOf()) {
      const c = tileToWorld(g.x, g.y);
      put(g.label, 'tb-guide', c.wx, c.wy - 16);
    }
  }

  private clientOf(wx: number, wy: number): { px: number; py: number } {
    const cam = this.cameras.main;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    const sx = (wx - cam.scrollX - hw) * cam.zoom + hw;
    const sy = (wy - cam.scrollY - hh) * cam.zoom + hh;
    const rect = this.game.canvas.getBoundingClientRect();
    return { px: rect.left + sx / this.dpr, py: rect.top + sy / this.dpr };
  }

  private worldOf(px: number, py: number): { wx: number; wy: number } {
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const sx = (px - rect.left) * this.dpr;
    const sy = (py - rect.top) * this.dpr;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    const zoom = cam.zoom || 1;
    return { wx: cam.scrollX + hw + (sx - hw) / zoom, wy: cam.scrollY + hh + (sy - hh) / zoom };
  }
}

function parseHex(hex: string, fallback: number): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
}
