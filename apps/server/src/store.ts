import { freshMission, normalizeBjj, type PrivateProfile } from '@tudobem/shared';

export interface StoredProfile extends PrivateProfile {
  token: string;
  /** Created under the Phase 0 adult (18+) policy; older 13+ profiles lack it and sign up again. No birth date is ever collected. */
  ageGate18: true;
  /** Email/password account that owns this profile. Absent for solo guests and not-yet-claimed legacy profiles. */
  accountId?: string;
  daily: {
    date: string;
    sceneClears: Record<string, number>;
    /** Conversa daily cap: npcId -> America/Sao_Paulo date (YYYY-MM-DD). */
    conversaClears?: Record<string, string>;
    /** Conversa RV already paid: npcId -> America/Sao_Paulo date. */
    conversaRvGranted?: Record<string, string>;
    /** Pedido rápido RV already paid: npcId -> America/Sao_Paulo date. Once per calendar day. */
    pedidoRvGranted?: Record<string, string>;
  };
  lastSeen: number;
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Get today's date in America/São_Paulo timezone (YYYY-MM-DD). */
export function todaySaoPaulo(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

/** Where profiles persist. Node: JSON file. Browser solo mode: localStorage. Tests: none. */
export interface PersistenceAdapter {
  load(): StoredProfile[];
  save(rows: StoredProfile[]): void;
  describe(): string;
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Profile store (isomorphic). Swap the adapter for Postgres in Phase 1 (same method surface). */
export class ProfileStore {
  private byId = new Map<string, StoredProfile>();
  private byToken = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private adapter: PersistenceAdapter | null) {
    if (!adapter) return;
    try {
      const rows = adapter.load();
      for (const p of rows) this.index(p);
      if (rows.length) console.log(`[store] ${rows.length} perfis carregados (${adapter.describe()})`);
    } catch (e) {
      console.error('[store] could not read profiles, starting fresh', e);
    }
  }

  private index(p: StoredProfile) {
    this.byId.set(p.id, p);
    this.byToken.set(p.token, p.id);
  }

  newId() {
    return randomHex(6);
  }

  newToken() {
    return randomToken(24);
  }

  byTokenGet(token: string | undefined): StoredProfile | undefined {
    if (!token) return undefined;
    const id = this.byToken.get(token);
    return id ? this.byId.get(id) : undefined;
  }

  get(id: string) {
    return this.byId.get(id);
  }

  add(p: StoredProfile) {
    this.index(p);
    this.save();
  }

  /** Debounced write. */
  save() {
    if (!this.adapter || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 800);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.adapter?.save([...this.byId.values()]);
  }

  count() {
    return this.byId.size;
  }
}

export function toPrivate(p: StoredProfile): PrivateProfile {
  const { token: _t, ageGate18: _a, accountId: _acc, daily: _d, lastSeen: _l, ...rest } = p;
  const mission = p.mission?.date === today() ? p.mission : freshMission(today());
  return structuredClone({ ...rest, mission, bjj: normalizeBjj(p.bjj) });
}
