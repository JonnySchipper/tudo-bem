/**
 * The Mapa panel's pixel minimap of Vila Ipê: the terrain at 2 px per tile, rendered once into a canvas, with the buildings and big props
 * shaded on top, then the doors, the NPCs and "você" marked. The pixels come from pure functions (`minimapPixels`, `markers`), so the
 * panel and the tests share them.
 */
import { buildGrid, key, propTiles, type RoomDef, type Tile } from '@tudobem/shared';

export const MINIMAP_PX = 2;

const TERRAIN: Record<string, [number, number, number]> = {
  c: [203, 190, 186], // calçada
  a: [92, 88, 92], // asfalto
  p: [140, 135, 134], // paralelepipedo
  g: [112, 164, 88], // grama
  t: [184, 102, 60], // tijolo
};
const BUILDING: [number, number, number] = [138, 90, 68];
const TREE: [number, number, number] = [226, 168, 52];
const FENCE: [number, number, number] = [150, 150, 168];
const OBJECT: [number, number, number] = [110, 92, 80];

/** RGBA of the map at MINIMAP_PX pixels per tile. */
export function minimapPixels(room: RoomDef): { w: number; h: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const w = room.cols * MINIMAP_PX;
  const h = room.rows * MINIMAP_PX;
  const data = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  const tileColor = new Map<string, [number, number, number]>();
  for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) tileColor.set(key(x, y), TERRAIN[room.floor[y]?.[x] ?? 'c'] ?? TERRAIN.c);
  const grid = buildGrid(room);
  for (const p of room.props) {
    const rgb = p.kind === 'fachada' ? BUILDING : p.kind === 'ipe' || p.kind === 'arvore' ? TREE : p.kind === 'cerca' ? FENCE : p.blocks ? OBJECT : null;
    if (!rgb) continue;
    for (const t of propTiles(p)) {
      if (p.kind === 'cerca') {
        // a fence is only its outline
        const w2 = p.w ?? 1;
        const h2 = p.h ?? 1;
        if (t.x !== p.x && t.y !== p.y && t.x !== p.x + w2 - 1 && t.y !== p.y + h2 - 1) continue;
      }
      if (grid.blocked.has(key(t.x, t.y)) || p.kind === 'ipe' || p.kind === 'arvore') tileColor.set(key(t.x, t.y), rgb);
    }
  }
  for (let y = 0; y < room.rows; y++) {
    for (let x = 0; x < room.cols; x++) {
      const c = tileColor.get(key(x, y)) ?? TERRAIN.c;
      for (let dy = 0; dy < MINIMAP_PX; dy++) {
        for (let dx = 0; dx < MINIMAP_PX; dx++) {
          const i = ((y * MINIMAP_PX + dy) * w + x * MINIMAP_PX + dx) * 4;
          // a checker of two near tones keeps big flat areas from looking dead
          const shade = (x + y) % 2 === 0 && dx === 0 && dy === 0 ? -10 : 0;
          data[i] = c[0] + shade;
          data[i + 1] = c[1] + shade;
          data[i + 2] = c[2] + shade;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { w, h, data };
}

export interface Marker {
  kind: 'door' | 'npc' | 'me';
  x: number;
  y: number;
  label: string;
}

/** Doors, NPCs and the player as tile coordinates (fractional door x for the wide facades). */
export function markers(room: RoomDef, me: Tile | null, npcs?: { name: string; x: number; y: number }[]): Marker[] {
  const out: Marker[] = [];
  for (const p of room.portals) out.push({ kind: 'door', x: p.doorAt?.x ?? p.x, y: p.y, label: p.label.pt });
  // NPCs walk their schedules: callers pass where they are now; without it the room's home tiles are marked
  for (const n of npcs ?? room.npcs) out.push({ kind: 'npc', x: n.x, y: n.y, label: n.name });
  if (me) out.push({ kind: 'me', x: me.x, y: me.y, label: 'você' });
  return out;
}

const COLORS = { door: '#f2c230', npc: '#c45c26', me: '#2f5d50' } as const;

/** Paints the terrain once and the markers on top; returns the canvas. */
export function drawMinimap(room: RoomDef, me: Tile | null, npcs?: { name: string; x: number; y: number }[]): HTMLCanvasElement {
  const px = minimapPixels(room);
  const canvas = document.createElement('canvas');
  canvas.width = px.w;
  canvas.height = px.h;
  canvas.className = 'minimap';
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.putImageData(new ImageData(px.data, px.w, px.h), 0, 0);
  for (const m of markers(room, me, npcs)) {
    const cx = Math.round((m.x + 0.5) * MINIMAP_PX);
    const cy = Math.round((m.y + 0.5) * MINIMAP_PX);
    const r = m.kind === 'me' ? 3 : 2;
    ctx.fillStyle = '#3a3a50';
    ctx.fillRect(cx - r - 1, cy - r - 1, 2 * r + 2, 2 * r + 2);
    ctx.fillStyle = m.kind === 'me' ? '#ffffff' : COLORS[m.kind];
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    if (m.kind === 'me') {
      ctx.fillStyle = COLORS.me;
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
    }
  }
  return canvas;
}
