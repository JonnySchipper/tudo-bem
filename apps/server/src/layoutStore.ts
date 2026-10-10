/**
 * Saved design-mode layouts. Stored in SQLite (`kv` key `layouts`) on the same volume as profiles.
 * A missing row means every room uses the layout shipped in the repo.
 *
 * Besides the live override per room it keeps the editor's autosaved draft and the last few published versions (so a publish can be
 * reverted). `rev` counts live changes per room; a draft remembers the rev it was started from, so a stale publish can be caught.
 */
import { isRoomId, validateRoomLayout, type PropDef, type RoomId } from '@tudobem/shared';

export interface LayoutIo {
  load: () => unknown;
  save: (state: unknown) => void;
}

export interface LayoutDraft {
  objects: PropDef[];
  at: number;
  by: string;
  /** Live rev the draft was started from. */
  baseRev: number;
}

/** A version that was live before a publish. `objects: null` is the code layout. */
export interface LayoutVersion {
  objects: PropDef[] | null;
  at: number;
  by: string;
}

/** Published versions kept per room for a revert. */
export const LAYOUT_HISTORY_KEEP = 5;

const copy = (objects: PropDef[]) => objects.map((o) => structuredClone(o));

export class LayoutStore {
  private rooms = new Map<RoomId, PropDef[]>();
  private drafts = new Map<RoomId, LayoutDraft>();
  private past = new Map<RoomId, LayoutVersion[]>();
  private revs = new Map<RoomId, number>();

  constructor(
    private io?: LayoutIo,
    private now: () => number = Date.now,
  ) {
    const raw = io?.load();
    if (!raw || typeof raw !== 'object') return;
    const state = raw as { rooms?: unknown; drafts?: unknown; history?: unknown; revs?: unknown };
    for (const [id, objects] of entries(state.rooms)) {
      const v = validateRoomLayout(id, objects);
      if (v.ok) this.rooms.set(v.room, v.objects);
      else console.error(`[layout] ignoring saved ${id}: ${v.en}`);
    }
    for (const [id, d] of entries(state.drafts)) {
      const row = d as Partial<LayoutDraft> | null;
      const v = validateRoomLayout(id, row?.objects);
      if (!v.ok || !row) continue;
      this.drafts.set(v.room, { objects: v.objects, at: Number(row.at) || 0, by: String(row.by ?? ''), baseRev: Number(row.baseRev) || 0 });
    }
    for (const [id, list] of entries(state.history)) {
      if (!Array.isArray(list)) continue;
      const out: LayoutVersion[] = [];
      for (const item of list as Partial<LayoutVersion>[]) {
        if (!item || typeof item !== 'object') continue;
        if (item.objects === null) {
          out.push({ objects: null, at: Number(item.at) || 0, by: String(item.by ?? '') });
          continue;
        }
        const v = validateRoomLayout(id, item.objects);
        if (v.ok) out.push({ objects: v.objects, at: Number(item.at) || 0, by: String(item.by ?? '') });
      }
      if (isRoomId(id) && out.length) this.past.set(id, out.slice(-LAYOUT_HISTORY_KEEP));
    }
    for (const [id, n] of entries(state.revs)) {
      if (isRoomId(id) && Number.isInteger(n)) this.revs.set(id, n as number);
    }
  }

  has(room: RoomId): boolean {
    return this.rooms.has(room);
  }

  /** The live override, or null when the room uses the code layout. */
  live(room: RoomId): PropDef[] | null {
    const o = this.rooms.get(room);
    return o ? copy(o) : null;
  }

  rev(room: RoomId): number {
    return this.revs.get(room) ?? 0;
  }

  overrides(): { room: RoomId; objects: PropDef[] }[] {
    return [...this.rooms.entries()].map(([room, objects]) => ({ room, objects: copy(objects) }));
  }

  /** `null` drops the override so the bundled layout is used again. Not kept in the history (the dashboard's reset uses `publish`). */
  set(room: RoomId, objects: PropDef[] | null): void {
    if (objects) this.rooms.set(room, copy(objects));
    else this.rooms.delete(room);
    this.revs.set(room, this.rev(room) + 1);
    this.persist();
  }

  draft(room: RoomId): LayoutDraft | null {
    const d = this.drafts.get(room);
    return d ? { ...d, objects: copy(d.objects) } : null;
  }

  draftRooms(): RoomId[] {
    return [...this.drafts.keys()];
  }

  setDraft(room: RoomId, objects: PropDef[] | null, by = '', baseRev = this.rev(room)): LayoutDraft | null {
    if (objects) this.drafts.set(room, { objects: copy(objects), at: this.now(), by, baseRev });
    else this.drafts.delete(room);
    this.persist();
    return this.draft(room);
  }

  history(room: RoomId): LayoutVersion[] {
    return (this.past.get(room) ?? []).map((v) => ({ ...v, objects: v.objects ? copy(v.objects) : null }));
  }

  /** Make `objects` live (null: the code layout). What was live goes on the history; the draft is done with. */
  publish(room: RoomId, objects: PropDef[] | null, by = ''): void {
    const list = this.past.get(room) ?? [];
    const was = this.rooms.get(room);
    list.push({ objects: was ? copy(was) : null, at: this.now(), by });
    this.past.set(room, list.slice(-LAYOUT_HISTORY_KEEP));
    this.drafts.delete(room);
    this.set(room, objects);
  }

  /** Put the version before the last publish back live. Undefined when there is none. */
  rollback(room: RoomId): LayoutVersion | undefined {
    const list = this.past.get(room);
    const prev = list?.pop();
    if (!prev) return undefined;
    if (!list!.length) this.past.delete(room);
    this.drafts.delete(room);
    this.set(room, prev.objects);
    return prev;
  }

  private persist(): void {
    const rooms: Record<string, PropDef[]> = {};
    for (const [id, props] of this.rooms) rooms[id] = props;
    const drafts: Record<string, LayoutDraft> = {};
    for (const [id, d] of this.drafts) drafts[id] = d;
    const history: Record<string, LayoutVersion[]> = {};
    for (const [id, list] of this.past) history[id] = list;
    const revs: Record<string, number> = {};
    for (const [id, n] of this.revs) revs[id] = n;
    this.io?.save({ version: 2, rooms, drafts, history, revs });
  }
}

function entries(v: unknown): [string, unknown][] {
  return v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : [];
}
