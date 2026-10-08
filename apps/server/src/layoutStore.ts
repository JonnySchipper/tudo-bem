/**
 * Saved design-mode layouts. Same volume as profiles (`layouts.json` beside `profiles.json`).
 * Missing file means every room uses the layout shipped in the repo.
 */
import { validateRoomLayout, type PropDef, type RoomId } from '@tudobem/shared';

export interface LayoutIo {
  load: () => unknown;
  save: (state: unknown) => void;
}

export class LayoutStore {
  private rooms = new Map<RoomId, PropDef[]>();

  constructor(private io?: LayoutIo) {
    const raw = io?.load();
    if (!raw || typeof raw !== 'object') return;
    const rooms = (raw as { rooms?: unknown }).rooms;
    if (!rooms || typeof rooms !== 'object') return;
    for (const [id, objects] of Object.entries(rooms as Record<string, unknown>)) {
      const v = validateRoomLayout(id, objects);
      if (v.ok) this.rooms.set(v.room, v.objects);
      else console.error(`[layout] ignoring saved ${id}: ${v.en}`);
    }
  }

  has(room: RoomId): boolean {
    return this.rooms.has(room);
  }

  overrides(): { room: RoomId; objects: PropDef[] }[] {
    return [...this.rooms.entries()].map(([room, objects]) => ({ room, objects: objects.map((o) => structuredClone(o)) }));
  }

  /** `null` drops the override so the bundled layout is used again. */
  set(room: RoomId, objects: PropDef[] | null): void {
    if (objects) this.rooms.set(room, objects.map((o) => structuredClone(o)));
    else this.rooms.delete(room);
    const body: Record<string, PropDef[]> = {};
    for (const [id, props] of this.rooms) body[id] = props;
    this.io?.save({ version: 1, rooms: body });
  }
}
