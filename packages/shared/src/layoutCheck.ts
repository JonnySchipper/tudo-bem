/**
 * Design mode's pre-publish check: what a layout edit broke for someone walking the room.
 *
 * Blocked doors and unreachable interaction tiles are errors (a player gets stuck, or a game cannot be opened). Unreachable floor, objects off
 * the map and overlapping colliders are warnings. With a `baseline` (the layout being replaced), only problems the edit introduced are listed,
 * so the open-air maps' deliberate scenery (props past the edge, roofs stacked on facades) is not reported on every publish.
 */
import { buildGrid, isWalkable, key, propTiles, ROOMS, type PropDef, type RoomDef } from './rooms.js';
import type { RoomId, Tile } from './types.js';

export type LayoutIssueKind = 'door' | 'interact' | 'npc' | 'unreachable' | 'offmap' | 'overlap';

export interface LayoutIssue {
  kind: LayoutIssueKind;
  severity: 'error' | 'warn';
  /** Props involved (the editor selects them). */
  ids: string[];
  /** Tiles to mark on the map. */
  tiles: Tile[];
  pt: string;
  en: string;
}

const STEPS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Every tile reachable from `from`, with the walk rules of `findPath` (8 directions, no corner cutting). */
export function reachableFrom(grid: ReturnType<typeof buildGrid>, from: Tile): Set<string> {
  const seen = new Set<string>();
  if (!isWalkable(grid, from.x, from.y)) return seen;
  const queue: Tile[] = [from];
  seen.add(key(from.x, from.y));
  while (queue.length) {
    const cur = queue.pop()!;
    for (const [dx, dy] of STEPS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = key(nx, ny);
      if (seen.has(k) || !isWalkable(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!isWalkable(grid, cur.x + dx, cur.y) || !isWalkable(grid, cur.x, cur.y + dy))) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

/** Where a player can enter the room: the spawn, and the arrival tile of every door into it from another room. */
function entrances(room: RoomDef): Tile[] {
  const out: Tile[] = [room.spawn];
  for (const other of Object.values(ROOMS)) for (const p of other.portals) if (p.to === room.id) out.push(p.arrive);
  return out;
}

function analyse(room: RoomDef, objects: readonly PropDef[]) {
  const def: RoomDef = { ...room, props: objects as PropDef[] };
  const grid = buildGrid(def);
  const reach = new Set<string>();
  for (const e of entrances(room)) for (const k of reachableFrom(grid, e)) reach.add(k);
  return { def, grid, reach };
}

const inside = (room: RoomDef, t: Tile) => t.x >= 0 && t.y >= 0 && t.x < room.cols && t.y < room.rows;

/** A tile a player can stand on and get to: walkable and connected to the way in. */
const reachable = (a: ReturnType<typeof analyse>, t: Tile) => isWalkable(a.grid, t.x, t.y) && a.reach.has(key(t.x, t.y));

/** A walkable tile next to `t` that the player can reach (doors in a facade are entered from the tile in front). */
function reachableNear(a: ReturnType<typeof analyse>, t: Tile): boolean {
  if (reachable(a, t)) return true;
  return STEPS.some(([dx, dy]) => reachable(a, { x: t.x + dx, y: t.y + dy }));
}

function blockingTiles(objects: readonly PropDef[]): Map<string, string[]> {
  const at = new Map<string, string[]>();
  for (const p of objects) {
    if (!p.blocks || p.gaps) continue;
    for (const t of propTiles(p)) {
      const k = key(t.x, t.y);
      const list = at.get(k);
      if (list) list.push(p.id);
      else at.set(k, [p.id]);
    }
  }
  return at;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function overlaps(objects: readonly PropDef[]): Map<string, { ids: [string, string]; tiles: Tile[] }> {
  const out = new Map<string, { ids: [string, string]; tiles: Tile[] }>();
  for (const [k, ids] of blockingTiles(objects)) {
    if (ids.length < 2) continue;
    const [x, y] = k.split(',').map(Number);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pk = pairKey(ids[i]!, ids[j]!);
        const row = out.get(pk) ?? { ids: [ids[i]!, ids[j]!] as [string, string], tiles: [] };
        row.tiles.push({ x: x!, y: y! });
        out.set(pk, row);
      }
    }
  }
  return out;
}

function offMap(room: RoomDef, p: PropDef): boolean {
  return propTiles(p).some((t) => !inside(room, t));
}

/** Floor tiles nobody can walk to, grouped into connected areas (4-neighbour), biggest first. */
function strandedAreas(a: ReturnType<typeof analyse>, room: RoomDef): Tile[][] {
  const lost = new Set<string>();
  for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) if (isWalkable(a.grid, x, y) && !a.reach.has(key(x, y))) lost.add(key(x, y));
  const areas: Tile[][] = [];
  const done = new Set<string>();
  for (const k of lost) {
    if (done.has(k)) continue;
    const [sx, sy] = k.split(',').map(Number);
    const area: Tile[] = [];
    const stack: Tile[] = [{ x: sx!, y: sy! }];
    done.add(k);
    while (stack.length) {
      const t = stack.pop()!;
      area.push(t);
      for (const [dx, dy] of STEPS.slice(0, 4)) {
        const nk = key(t.x + dx, t.y + dy);
        if (lost.has(nk) && !done.has(nk)) {
          done.add(nk);
          stack.push({ x: t.x + dx, y: t.y + dy });
        }
      }
    }
    areas.push(area);
  }
  return areas.sort((p, q) => q.length - p.length);
}

/**
 * Problems in `objects` as the layout of `roomId`. With `baseline`, only the ones the edit introduced (a door that was already unreachable,
 * a prop that was already past the edge, a pair that already overlapped and floor that was already cut off are left out).
 */
export function checkLayout(roomId: RoomId, objects: readonly PropDef[], baseline?: readonly PropDef[]): LayoutIssue[] {
  const room = ROOMS[roomId];
  const now = analyse(room, objects);
  const was = baseline ? analyse(room, baseline) : null;
  const issues: LayoutIssue[] = [];

  for (const portal of room.portals) {
    const t = { x: portal.x, y: portal.y };
    if (reachableNear(now, t) || (was && !reachableNear(was, t))) continue;
    issues.push({
      kind: 'door',
      severity: 'error',
      ids: [],
      tiles: [t],
      pt: `A porta "${portal.label.pt}" ficou bloqueada.`,
      en: `The door "${portal.label.en}" is blocked.`,
    });
  }
  for (const other of Object.values(ROOMS)) {
    for (const portal of other.portals) {
      if (portal.to !== room.id) continue;
      const t = portal.arrive;
      if (isWalkable(now.grid, t.x, t.y) || (was && !isWalkable(was.grid, t.x, t.y))) continue;
      const by = objects.filter((p) => p.blocks && propTiles(p).some((q) => q.x === t.x && q.y === t.y)).map((p) => p.id);
      issues.push({
        kind: 'door',
        severity: 'error',
        ids: by,
        tiles: [t],
        pt: `Quem chega por "${portal.label.pt}" cai num lugar bloqueado.`,
        en: `Players arriving through "${portal.label.en}" land on a blocked tile.`,
      });
    }
  }

  for (const p of objects) {
    if (!p.action || !p.interact) continue;
    const old = baseline?.find((q) => q.id === p.id);
    if (reachable(now, p.interact)) continue;
    if (was && old?.interact && !reachable(was, old.interact) && old.interact.x === p.interact.x && old.interact.y === p.interact.y) continue;
    issues.push({
      kind: 'interact',
      severity: 'error',
      ids: [p.id],
      tiles: [p.interact],
      pt: `Ninguém alcança o ponto de uso de ${p.id}.`,
      en: `Nobody can reach the interaction tile of ${p.id}.`,
    });
  }

  for (const n of room.npcs) {
    if (n.schedule) continue;
    const t = { x: n.x, y: n.y };
    const covering = objects.filter((p) => p.blocks && propTiles(p).some((q) => q.x === t.x && q.y === t.y));
    const wasCovered = baseline?.some((p) => p.blocks && propTiles(p).some((q) => q.x === t.x && q.y === t.y));
    if (covering.length && !wasCovered) {
      issues.push({ kind: 'npc', severity: 'warn', ids: covering.map((p) => p.id), tiles: [t], pt: `${n.name} ficou dentro de um objeto.`, en: `${n.name} is standing inside an object.` });
    }
    if (!reachableNear(now, n.interact) && !(was && !reachableNear(was, n.interact))) {
      issues.push({ kind: 'npc', severity: 'warn', ids: [], tiles: [n.interact], pt: `Ninguém alcança ${n.name}.`, en: `Nobody can reach ${n.name}.` });
    }
  }

  const before = was ? new Set(strandedAreas(was, room).flat().map((t) => key(t.x, t.y))) : null;
  for (const area of strandedAreas(now, room)) {
    const fresh = before ? area.filter((t) => !before.has(key(t.x, t.y))) : area;
    if (!fresh.length) continue;
    issues.push({
      kind: 'unreachable',
      severity: 'warn',
      ids: [],
      tiles: fresh,
      pt: `${fresh.length} ${fresh.length === 1 ? 'piso ficou' : 'pisos ficaram'} sem acesso.`,
      en: `${fresh.length} floor ${fresh.length === 1 ? 'tile is' : 'tiles are'} cut off.`,
    });
  }

  const oldById = new Map((baseline ?? []).map((p) => [p.id, p]));
  for (const p of objects) {
    if (!offMap(room, p)) continue;
    const old = oldById.get(p.id);
    if (old && offMap(room, old)) continue;
    issues.push({ kind: 'offmap', severity: 'warn', ids: [p.id], tiles: [], pt: `${p.id} está fora do mapa.`, en: `${p.id} is off the map.` });
  }

  const oldPairs = baseline ? overlaps(baseline) : null;
  for (const [pk, row] of overlaps(objects)) {
    if (oldPairs?.has(pk)) continue;
    issues.push({
      kind: 'overlap',
      severity: 'warn',
      ids: row.ids,
      tiles: row.tiles,
      pt: `${row.ids[0]} e ${row.ids[1]} se sobrepõem.`,
      en: `${row.ids[0]} and ${row.ids[1]} overlap.`,
    });
  }

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}
