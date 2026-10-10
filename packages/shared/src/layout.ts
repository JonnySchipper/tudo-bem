/**
 * Design-mode layouts: validate a room's props, install them on the live room (walk grid included), and serialize the JSON the repo stores.
 */
import { invalidateRoomNavigation } from './npcMotion.js';
import { bundledObjects } from './roomLayoutFiles.js';
import { ROOM_IDS, ROOMS, isRoomId, type PropAction, type PropDef, type PropKind } from './rooms.js';
import type { Dir, RoomId, Tile } from './types.js';

export const LAYOUT_MAX_OBJECTS = 800;
export const LAYOUT_MARGIN = 16;
const MAX_SPAN = 32;
const MAX_NUDGE = 256;
const MAX_TEXT = 160;
const MAX_GAPS = 64;
/** Largest draw-order bias design mode may give a prop, in world px either way. */
export const LAYOUT_MAX_Z = 256;

export const LAYOUT_KINDS: readonly PropKind[] = [
  'ipe', 'banco', 'poste', 'banca', 'barraca_chapeus', 'quiosque', 'poleiro', 'canteiro', 'lixeira', 'bicicletario', 'balcao', 'vitrine',
  'banqueta', 'mesa', 'cadeira_padaria', 'trilho_pedidos', 'vaso', 'cama', 'cozinha', 'caixa', 'orelhao', 'placa_rua', 'estufa', 'mesa_cafe',
  'jornais', 'saco_lixo', 'floreira', 'tatame', 'parede_faixas', 'quadro_fila', 'banco_espectador', 'vestiario', 'quadro_foto', 'fachada',
  'cenario', 'fonte', 'cerca', 'sebe', 'ponto_onibus', 'arvore', 'feira', 'hortifruti',
];
export const LAYOUT_ACTIONS: readonly PropAction[] = [
  'shop_hats', 'minigame', 'kiosk', 'parrot_perch', 'catalog', 'bjj_roll', 'feira_stall', 'street_snack', 'checkers', 'buy_gi', 'escola',
  'academy_elevator', 'academy_board', 'padaria_door', 'padaria_counter', 'feira_cart', 'feira_sign', 'leaderboard',
];
export const LAYOUT_DIRS: readonly Dir[] = ['SE', 'SW', 'NE', 'NW'];
export const LAYOUT_VENDORS = ['tia_lu', 'ze', 'chico', 'rosa', 'banca'] as const;
const KEY_ORDER = ['id', 'kind', 'x', 'y', 'w', 'h', 'blocks', 'seat', 'action', 'interact', 'label', 'hero', 'art', 'vendor', 'gaps', 'lightAtNight', 'ox', 'oy', 'flip', 'z'] as const;

const kindSet = new Set<string>(LAYOUT_KINDS);
const actionSet = new Set<string>(LAYOUT_ACTIONS);
const dirSet = new Set<string>(LAYOUT_DIRS);
const vendorSet = new Set<string>(LAYOUT_VENDORS);

export interface LayoutFailure {
  ok: false;
  pt: string;
  en: string;
}
export interface LayoutSuccess {
  ok: true;
  room: RoomId;
  objects: PropDef[];
}

const fail = (pt: string, en: string): LayoutFailure => ({ ok: false, pt, en });

function intIn(n: unknown, lo: number, hi: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
}

function tile(v: unknown, lo: number, hi: number): Tile | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as { x?: unknown; y?: unknown };
  if (!intIn(t.x, lo, hi) || !intIn(t.y, lo, hi)) return null;
  return { x: t.x, y: t.y };
}

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > MAX_TEXT) return null;
  return s;
}

/** Known prop types, in-bounds coordinates, and a size cap. Returns a sanitized copy. */
export function validateRoomLayout(roomId: string, objects: unknown): LayoutSuccess | LayoutFailure {
  if (!isRoomId(roomId)) return fail('Sala desconhecida.', 'Unknown room.');
  if (!Array.isArray(objects)) return fail('O layout precisa ser uma lista.', 'The layout must be a list.');
  if (objects.length > LAYOUT_MAX_OBJECTS) return fail('Objetos demais nessa sala.', 'Too many objects in this room.');
  const room = ROOMS[roomId];
  const loX = -LAYOUT_MARGIN;
  const hiX = room.cols - 1 + LAYOUT_MARGIN;
  const loY = -LAYOUT_MARGIN;
  const hiY = room.rows - 1 + LAYOUT_MARGIN;
  const ids = new Set<string>();
  const out: PropDef[] = [];
  for (const raw of objects) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Objeto inválido.', 'Invalid object.');
    const o = raw as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(o.id)) return fail('Id de objeto inválido.', 'Invalid object id.');
    if (ids.has(o.id)) return fail(`Id repetido: ${o.id}.`, `Duplicate id: ${o.id}.`);
    ids.add(o.id);
    if (typeof o.kind !== 'string' || !kindSet.has(o.kind)) return fail(`Tipo desconhecido: ${String(o.kind)}.`, `Unknown type: ${String(o.kind)}.`);
    if (!intIn(o.x, loX, hiX) || !intIn(o.y, loY, hiY)) return fail(`Fora do mapa: ${o.id}.`, `Out of bounds: ${o.id}.`);
    if (typeof o.blocks !== 'boolean') return fail(`Colisão inválida: ${o.id}.`, `Invalid collision: ${o.id}.`);
    const prop: PropDef = { id: o.id, kind: o.kind as PropKind, x: o.x, y: o.y, blocks: o.blocks };
    if (o.w !== undefined) {
      if (!intIn(o.w, 1, MAX_SPAN)) return fail(`Largura inválida: ${o.id}.`, `Invalid width: ${o.id}.`);
      prop.w = o.w;
    }
    if (o.h !== undefined) {
      if (!intIn(o.h, 1, MAX_SPAN)) return fail(`Altura inválida: ${o.id}.`, `Invalid height: ${o.id}.`);
      prop.h = o.h;
    }
    if (o.seat !== undefined) {
      if (typeof o.seat !== 'string' || !dirSet.has(o.seat)) return fail(`Assento inválido: ${o.id}.`, `Invalid seat: ${o.id}.`);
      prop.seat = o.seat as Dir;
    }
    if (o.action !== undefined) {
      if (typeof o.action !== 'string' || !actionSet.has(o.action)) return fail(`Ação desconhecida: ${o.id}.`, `Unknown action: ${o.id}.`);
      prop.action = o.action as PropAction;
    }
    if (o.interact !== undefined) {
      const t = tile(o.interact, loX - MAX_SPAN, hiX + MAX_SPAN);
      if (!t) return fail(`Interação inválida: ${o.id}.`, `Invalid interact tile: ${o.id}.`);
      prop.interact = t;
    }
    if (o.label !== undefined) {
      if (!o.label || typeof o.label !== 'object') return fail(`Rótulo inválido: ${o.id}.`, `Invalid label: ${o.id}.`);
      const label = o.label as { pt?: unknown; en?: unknown };
      const pt = text(label.pt);
      const en = text(label.en);
      if (!pt || !en) return fail(`Rótulo inválido: ${o.id}.`, `Invalid label: ${o.id}.`);
      prop.label = { pt, en };
    }
    if (o.hero !== undefined) {
      if (typeof o.hero !== 'boolean') return fail(`Objeto inválido: ${o.id}.`, `Invalid object: ${o.id}.`);
      if (o.hero) prop.hero = true;
    }
    if (o.art !== undefined) {
      if (typeof o.art !== 'string' || o.art.length > 80 || o.art.includes('..') || !/^[a-z0-9_./-]+$/i.test(o.art)) {
        return fail(`Sprite inválido: ${o.id}.`, `Invalid sprite: ${o.id}.`);
      }
      prop.art = o.art;
    }
    if (o.vendor !== undefined) {
      if (typeof o.vendor !== 'string' || !vendorSet.has(o.vendor)) return fail(`Vendedor inválido: ${o.id}.`, `Invalid vendor: ${o.id}.`);
      prop.vendor = o.vendor as PropDef['vendor'];
    }
    if (o.gaps !== undefined) {
      if (!Array.isArray(o.gaps) || o.gaps.length > MAX_GAPS) return fail(`Cerca inválida: ${o.id}.`, `Invalid fence gaps: ${o.id}.`);
      const gaps: Tile[] = [];
      for (const g of o.gaps) {
        const t = tile(g, loX - MAX_SPAN, hiX + MAX_SPAN);
        if (!t) return fail(`Cerca inválida: ${o.id}.`, `Invalid fence gaps: ${o.id}.`);
        gaps.push(t);
      }
      prop.gaps = gaps;
    }
    if (o.lightAtNight !== undefined) {
      if (o.lightAtNight !== true && o.lightAtNight !== false) return fail(`Objeto inválido: ${o.id}.`, `Invalid object: ${o.id}.`);
      if (o.lightAtNight) prop.lightAtNight = true;
    }
    if (o.ox !== undefined) {
      if (!intIn(o.ox, -MAX_NUDGE, MAX_NUDGE)) return fail(`Deslocamento inválido: ${o.id}.`, `Invalid nudge: ${o.id}.`);
      if (o.ox !== 0) prop.ox = o.ox;
    }
    if (o.oy !== undefined) {
      if (!intIn(o.oy, -MAX_NUDGE, MAX_NUDGE)) return fail(`Deslocamento inválido: ${o.id}.`, `Invalid nudge: ${o.id}.`);
      if (o.oy !== 0) prop.oy = o.oy;
    }
    if (o.flip !== undefined) {
      if (o.flip !== true && o.flip !== false) return fail(`Espelho inválido: ${o.id}.`, `Invalid flip: ${o.id}.`);
      if (o.flip) prop.flip = true;
    }
    if (o.z !== undefined) {
      if (!intIn(o.z, -LAYOUT_MAX_Z, LAYOUT_MAX_Z)) return fail(`Ordem inválida: ${o.id}.`, `Invalid draw order: ${o.id}.`);
      if (o.z !== 0) prop.z = o.z;
    }
    out.push(prop);
  }
  return { ok: true, room: roomId, objects: out };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Replace one room's props and drop cached walk paths so the next step uses the new collision. */
export function installRoomProps(room: RoomId, objects: PropDef[]): void {
  ROOMS[room].props = objects.map((o) => clone(o));
  invalidateRoomNavigation(room);
}

/** Put the repo layout back. */
export function revertRoomProps(room: RoomId): PropDef[] {
  const objects = bundledObjects(room);
  installRoomProps(room, objects);
  return objects;
}

/** Move a prop by whole tiles and keep its interact tile and fence gaps attached. */
export function shiftProp(p: PropDef, dx: number, dy: number): void {
  if (!dx && !dy) return;
  p.x += dx;
  p.y += dy;
  if (p.interact) p.interact = { x: p.interact.x + dx, y: p.interact.y + dy };
  if (p.gaps) p.gaps = p.gaps.map((g) => ({ x: g.x + dx, y: g.y + dy }));
}

export interface PaletteEntry {
  key: string;
  kind: PropKind;
  art?: string;
  label: string;
  template: PropDef;
}

/** One entry per existing prop sprite/type already used somewhere in the world. */
export function propPalette(): PaletteEntry[] {
  const seen = new Map<string, PaletteEntry>();
  for (const id of ROOM_IDS) {
    for (const p of bundledObjects(id)) {
      const key = [p.kind, p.art ?? '', p.w ?? 1, p.h ?? 1, p.seat ?? '', p.action ?? '', p.blocks ? '1' : '0'].join('|');
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        kind: p.kind,
        ...(p.art ? { art: p.art } : {}),
        label: p.label?.pt ?? p.art?.split('/').pop() ?? p.kind,
        template: clone(p),
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt') || a.kind.localeCompare(b.kind));
}

function ordered(p: PropDef): Record<string, unknown> {
  const src = p as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of KEY_ORDER) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

/** The file design mode commits: `{ room, objects }`, stable key order. */
export function serializeLayout(room: RoomId, objects: PropDef[]): string {
  return JSON.stringify({ room, objects: objects.map(ordered) }, null, 2) + '\n';
}

export interface LayoutDiff {
  added: string[];
  removed: string[];
  /** Same id, different fields: which fields changed. */
  changed: { id: string; fields: string[] }[];
}

/** What changed from `before` to `after`, by prop id. */
export function layoutDiff(before: readonly PropDef[], after: readonly PropDef[]): LayoutDiff {
  const old = new Map(before.map((p) => [p.id, ordered(p)]));
  const now = new Map(after.map((p) => [p.id, ordered(p)]));
  const out: LayoutDiff = { added: [], removed: [], changed: [] };
  for (const [id, p] of now) {
    const q = old.get(id);
    if (!q) {
      out.added.push(id);
      continue;
    }
    const fields = KEY_ORDER.filter((k) => JSON.stringify(p[k]) !== JSON.stringify(q[k]));
    if (fields.length) out.changed.push({ id, fields });
  }
  for (const id of old.keys()) if (!now.has(id)) out.removed.push(id);
  return out;
}

/** One line for an audit row or a status: `+2 -1 ~3`. */
export function layoutDiffSummary(d: LayoutDiff): string {
  return `+${d.added.length} -${d.removed.length} ~${d.changed.length}`;
}

/** Repo path of a room layout, relative to the repository root. */
export function layoutRepoPath(room: RoomId): string {
  return `packages/shared/layouts/${room}.json`;
}
