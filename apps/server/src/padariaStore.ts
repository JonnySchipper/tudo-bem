/**
 * Player-owned padarias. Same persistence pattern as academies (SQLite `padarias`).
 */
import { normalizePadaria, type PlayerPadaria } from '@tudobem/shared';

export interface PadariaPersistence {
  load(): unknown[];
  save(rows: PlayerPadaria[]): void;
  describe(): string;
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class PadariaStore {
  private byId = new Map<string, PlayerPadaria>();
  private byName = new Map<string, string>();

  constructor(private adapter: PadariaPersistence | null) {
    if (!adapter) return;
    try {
      for (const raw of adapter.load()) {
        const row = normalizePadaria(raw);
        if (row && !this.byId.has(row.id) && !this.byName.has(row.nameKey)) this.index(row);
      }
    } catch (e) {
      console.error('[padarias] could not read padarias, starting fresh', e);
    }
  }

  private index(row: PlayerPadaria) {
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

  list(): PlayerPadaria[] {
    return [...this.byId.values()].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
  }

  add(row: PlayerPadaria) {
    this.index(row);
    this.save();
  }

  remove(id: string) {
    const row = this.byId.get(id);
    if (!row) return false;
    this.byId.delete(id);
    if (this.byName.get(row.nameKey) === id) this.byName.delete(row.nameKey);
    this.save();
    return true;
  }

  save() {
    this.adapter?.save(this.list());
  }

  count() {
    return this.byId.size;
  }
}
