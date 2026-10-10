/**
 * The editor's drawing layer over the world canvas: tile grid, collision (blocked / cut-off floor), interaction zones (use tiles, doors,
 * seats, spawn), NPC spots and schedule points, issues, the selection, the marquee and the placement ghost.
 * Screen math comes from the renderer (`__tb.propClientRect`), so it lines up with the picture at any zoom and pan.
 */
import { buildGrid, isWalkable, key, propTiles, reachableFrom, type PropDef, type RoomDef, type Tile } from '@tudobem/shared';
import type { Art } from './art';
import { T, type Box } from './model';

export interface OverlayView {
  room: RoomDef;
  /** The whole draft (hidden layers included: collision is about the layout, not the picture). */
  objects: readonly PropDef[];
  grid: boolean;
  collision: boolean;
  hotspots: boolean;
  npcs: boolean;
  selected: ReadonlySet<string>;
  hover: string | null;
  boxOf: (p: PropDef) => Box;
  marquee: Box | null;
  ghost: { sprite: string | null; tile: Tile; w: number; h: number; flip?: boolean; ok: boolean } | null;
  /** A tile pick in progress (interaction tile, fence gap): highlight the tile under the pointer. */
  pickTile: Tile | null;
  issueTiles: readonly Tile[];
  /** NPC selected in the NPC list: its schedule points in this room. */
  npcFocus: { id: string; points: { tile: Tile; label: string }[] } | null;
  preview: boolean;
}

type Tb = { propClientRect?: (p: { x: number; y: number; w?: number; h?: number }) => { x: number; y: number; w: number; h: number } | null };
const tb = (): Tb => (window as unknown as { __tb?: Tb }).__tb ?? {};

/** World px -> client px: the origin of tile (0, 0) on screen and CSS px per art px. */
export function screenMap(): { ox: number; oy: number; s: number } | null {
  const r = tb().propClientRect?.({ x: 0, y: 0, w: 1, h: 1 });
  if (!r || !r.w) return null;
  return { ox: r.x, oy: r.y, s: r.w / T };
}

export class Overlay {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gridKey = '';
  private cache: { blocked: Set<string>; lost: Set<string> } | null = null;

  constructor(private art: Art) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dm-overlay';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Collision and reachability, rebuilt only when the layout changed. */
  private walk(room: RoomDef, objects: readonly PropDef[]) {
    const sig = `${room.id}:${objects.length}:${objects.map((p) => `${p.x},${p.y},${p.w ?? 1},${p.h ?? 1},${p.blocks ? 1 : 0}`).join(';')}`;
    if (sig === this.gridKey && this.cache) return this.cache;
    const grid = buildGrid({ ...room, props: objects as PropDef[] });
    const reach = reachableFrom(grid, room.spawn);
    const lost = new Set<string>();
    for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) if (isWalkable(grid, x, y) && !reach.has(key(x, y))) lost.add(key(x, y));
    this.gridKey = sig;
    this.cache = { blocked: grid.blocked, lost };
    return this.cache;
  }

  draw(v: OverlayView): void {
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (this.canvas.width !== Math.round(W * dpr) || this.canvas.height !== Math.round(H * dpr)) {
      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);
    }
    const c = this.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const m = screenMap();
    if (!m) return;
    const sx = (wx: number) => m.ox + wx * m.s;
    const sy = (wy: number) => m.oy + wy * m.s;
    const ts = T * m.s;
    const tileRect = (t: Tile, fill: string, inset = 0) => {
      c.fillStyle = fill;
      c.fillRect(sx(t.x * T) + inset, sy(t.y * T) + inset, ts - inset * 2, ts - inset * 2);
    };
    const { room } = v;

    if (v.preview) {
      // preview: only the issue tiles, so a stuck door still shows while walking
      for (const t of v.issueTiles) tileRect(t, 'rgba(214, 48, 49, 0.35)');
      return;
    }

    if (v.collision) {
      const w = this.walk(room, v.objects);
      for (const k of w.blocked) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        if (x < 0 || y < 0 || x >= room.cols || y >= room.rows) continue;
        tileRect({ x, y }, 'rgba(214, 48, 49, 0.28)');
        c.strokeStyle = 'rgba(160, 30, 30, 0.45)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(sx(x * T) + 2, sy((y + 1) * T) - 2);
        c.lineTo(sx((x + 1) * T) - 2, sy(y * T) + 2);
        c.stroke();
      }
      for (const k of w.lost) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        tileRect({ x, y }, 'rgba(242, 160, 48, 0.38)');
      }
    }

    if (v.grid) {
      // dark on light paving, and still readable on dark grass
      c.strokeStyle = 'rgba(30, 24, 20, 0.38)';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x <= room.cols; x++) {
        const px = Math.round(sx(x * T)) + 0.5;
        c.moveTo(px, sy(0));
        c.lineTo(px, sy(room.rows * T));
      }
      for (let y = 0; y <= room.rows; y++) {
        const py = Math.round(sy(y * T)) + 0.5;
        c.moveTo(sx(0), py);
        c.lineTo(sx(room.cols * T), py);
      }
      c.stroke();
    }
    // the map edge, always: props past it are scenery players never reach
    c.strokeStyle = 'rgba(143, 62, 21, 0.85)';
    c.lineWidth = 2;
    c.setLineDash([6, 4]);
    c.strokeRect(sx(0), sy(0), room.cols * ts, room.rows * ts);
    c.setLineDash([]);

    if (v.hotspots) {
      const label = (text: string, x: number, y: number, bg: string) => {
        c.font = '600 11px Nunito, system-ui, sans-serif';
        const w = c.measureText(text).width + 8;
        c.fillStyle = bg;
        c.fillRect(x - w / 2, y - 16, w, 15);
        c.fillStyle = '#fffaf2';
        c.textAlign = 'center';
        c.fillText(text, x, y - 5);
      };
      for (const p of v.objects) {
        if (p.seat) for (const t of propTiles(p)) this.marker(sx((t.x + 0.5) * T), sy((t.y + 0.5) * T), '#2f5d50', 'seat', m.s);
        if (!p.interact) continue;
        const cx = sx((p.interact.x + 0.5) * T);
        const cy = sy((p.interact.y + 0.5) * T);
        const { w, h } = { w: p.w ?? 1, h: p.h ?? 1 };
        c.strokeStyle = 'rgba(242, 194, 48, 0.9)';
        c.lineWidth = 2;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(sx((p.x + w / 2) * T), sy((p.y + h / 2) * T));
        c.stroke();
        c.setLineDash([]);
        this.marker(cx, cy, '#d4a017', 'use', m.s);
        if (p.action && v.selected.has(p.id)) label(p.action, cx, cy - ts * 0.4, '#8f3e15');
      }
      const edges = new Map<string, Tile[]>();
      for (const portal of room.portals) {
        const cx = sx((portal.x + 0.5) * T);
        const cy = sy((portal.y + 0.5) * T);
        this.marker(cx, cy, '#2b5ba8', 'door', m.s);
        if (portal.edge) edges.set(portal.to, [...(edges.get(portal.to) ?? []), portal]);
        else label(`→ ${portal.label.pt}`, cx, cy - ts * 0.45, 'rgba(43, 91, 168, 0.92)');
      }
      // one label per map edge exit, on its middle tile
      for (const tiles of edges.values()) {
        const mid = tiles[Math.floor(tiles.length / 2)]!;
        const portal = room.portals.find((p) => p.x === mid.x && p.y === mid.y)!;
        label(`→ ${portal.label.pt}`, sx((mid.x + 0.5) * T), sy((mid.y + 0.5) * T) - ts * 0.45, 'rgba(43, 91, 168, 0.92)');
      }
      this.marker(sx((room.spawn.x + 0.5) * T), sy((room.spawn.y + 0.5) * T), '#2e8a55', 'spawn', m.s);
      for (const p of v.objects) for (const g of p.gaps ?? []) tileRect(g, 'rgba(46, 138, 85, 0.35)', 2);
    }

    if (v.npcs) {
      for (const n of room.npcs) this.marker(sx((n.x + 0.5) * T), sy((n.y + 0.5) * T), '#7a4fa3', 'npc', m.s, n.name.slice(0, 1));
      if (v.npcFocus) {
        for (const pt of v.npcFocus.points) {
          const cx = sx((pt.tile.x + 0.5) * T);
          const cy = sy((pt.tile.y + 0.5) * T);
          this.marker(cx, cy, '#7a4fa3', 'npc', m.s, '•');
          c.font = '600 11px Nunito, system-ui, sans-serif';
          c.fillStyle = '#3d2552';
          c.textAlign = 'center';
          c.fillText(pt.label, cx, cy + ts * 0.75);
        }
      }
    }

    for (const t of v.issueTiles) {
      c.strokeStyle = '#d63031';
      c.lineWidth = 2;
      c.strokeRect(sx(t.x * T) + 1, sy(t.y * T) + 1, ts - 2, ts - 2);
    }

    // selection: the sprite box dashed, the footprint filled
    for (const p of v.objects) {
      const sel = v.selected.has(p.id);
      if (!sel && v.hover !== p.id) continue;
      const b = v.boxOf(p);
      if (sel) {
        c.fillStyle = 'rgba(242, 194, 48, 0.18)';
        c.fillRect(sx(p.x * T), sy(p.y * T), (p.w ?? 1) * ts, (p.h ?? 1) * ts);
      }
      c.strokeStyle = sel ? '#f2c230' : 'rgba(255, 250, 242, 0.9)';
      c.lineWidth = sel ? 2 : 1;
      c.setLineDash(sel ? [5, 3] : []);
      c.strokeRect(Math.round(sx(b.x0)) + 0.5, Math.round(sy(b.y0)) + 0.5, Math.round((b.x1 - b.x0) * m.s), Math.round((b.y1 - b.y0) * m.s));
      c.setLineDash([]);
      if (sel) {
        c.strokeStyle = 'rgba(44, 44, 44, 0.6)';
        c.lineWidth = 1;
        c.strokeRect(Math.round(sx(b.x0)) - 0.5, Math.round(sy(b.y0)) - 0.5, Math.round((b.x1 - b.x0) * m.s) + 2, Math.round((b.y1 - b.y0) * m.s) + 2);
      }
    }

    if (v.pickTile) {
      tileRect(v.pickTile, 'rgba(242, 194, 48, 0.45)');
      c.strokeStyle = '#8f3e15';
      c.lineWidth = 2;
      c.strokeRect(sx(v.pickTile.x * T), sy(v.pickTile.y * T), ts, ts);
    }

    if (v.ghost) {
      const g = v.ghost;
      c.fillStyle = g.ok ? 'rgba(46, 138, 85, 0.3)' : 'rgba(214, 48, 49, 0.3)';
      c.fillRect(sx(g.tile.x * T), sy(g.tile.y * T), g.w * ts, g.h * ts);
      c.globalAlpha = 0.7;
      if (g.sprite) this.art.draw(c, g.sprite, sx((g.tile.x + g.w / 2) * T), sy((g.tile.y + g.h) * T), m.s, g.flip);
      c.globalAlpha = 1;
      c.strokeStyle = g.ok ? '#2e8a55' : '#d63031';
      c.lineWidth = 2;
      c.strokeRect(sx(g.tile.x * T), sy(g.tile.y * T), g.w * ts, g.h * ts);
    }

    if (v.marquee) {
      const b = v.marquee;
      c.fillStyle = 'rgba(43, 91, 168, 0.12)';
      c.strokeStyle = '#2b5ba8';
      c.lineWidth = 1;
      c.setLineDash([4, 3]);
      c.fillRect(sx(b.x0), sy(b.y0), (b.x1 - b.x0) * m.s, (b.y1 - b.y0) * m.s);
      c.strokeRect(sx(b.x0) + 0.5, sy(b.y0) + 0.5, (b.x1 - b.x0) * m.s, (b.y1 - b.y0) * m.s);
      c.setLineDash([]);
    }
  }

  /** A small round pin with a glyph: use tile, door, seat, spawn, NPC. */
  private marker(x: number, y: number, color: string, kind: 'use' | 'door' | 'seat' | 'spawn' | 'npc', s: number, letter?: string): void {
    const c = this.ctx;
    const r = Math.max(5, Math.min(10, 4 * s));
    c.fillStyle = color;
    c.strokeStyle = '#fffaf2';
    c.lineWidth = 2;
    c.beginPath();
    if (kind === 'use') {
      c.moveTo(x, y - r);
      c.lineTo(x + r, y);
      c.lineTo(x, y + r);
      c.lineTo(x - r, y);
      c.closePath();
    } else if (kind === 'door') c.rect(x - r * 0.8, y - r, r * 1.6, r * 2);
    else c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const glyph = letter ?? { use: '!', door: '', seat: 'h', spawn: '★', npc: '' }[kind];
    if (!glyph) return;
    c.fillStyle = '#fffaf2';
    c.font = `700 ${Math.round(r * 1.2)}px Nunito, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(glyph, x, y + 0.5);
    c.textBaseline = 'alphabetic';
  }
}
