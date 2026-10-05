/**
 * Player academies. Same shape as the profile store: an adapter loads and saves the rows.
 * Node writes `academies.json`. Solo mode uses localStorage. Tests pass null (memory only).
 * Browser-safe: no `process`, no `node:fs`.
 */
import { normalizeAcademy, type PlayerAcademy } from '@tudobem/shared';

export interface AcademyPersistence {
  load(): unknown[];
  save(rows: PlayerAcademy[]): void;
  describe(): string;
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class AcademyStore {
  private byId = new Map<string, PlayerAcademy>();
  private byName = new Map<string, string>();

  constructor(private adapter: AcademyPersistence | null) {
    if (!adapter) return;
    try {
      for (const raw of adapter.load()) {
        const row = normalizeAcademy(raw);
        if (row && !this.byId.has(row.id) && !this.byName.has(row.nameKey)) this.index(row);
      }
    } catch (e) {
      console.error('[academies] could not read academies, starting fresh', e);
    }
  }

  private index(row: PlayerAcademy) {
    this.byId.set(row.id, row);
    this.byName.set(row.nameKey, row.id);
  }

  newId() {
    return randomHex(6);
  }

  get(id: string) {
    return this.byId.get(id);
  }

  byNameKey(key: string) {
    const id = this.byName.get(key);
    return id ? this.byId.get(id) : undefined;
  }

  ownedBy(ownerId: string) {
    for (const row of this.byId.values()) if (row.ownerId === ownerId) return row;
    return undefined;
  }

  list(): PlayerAcademy[] {
    return [...this.byId.values()].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  }

  add(row: PlayerAcademy) {
    this.index(row);
    this.save();
  }

  /** Synchronous. The file is small, and a found name has to survive a restart immediately. */
  save() {
    this.adapter?.save(this.list());
  }

  count() {
    return this.byId.size;
  }
}
