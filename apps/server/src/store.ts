import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { PrivateProfile } from '@tudobem/shared';

export interface StoredProfile extends PrivateProfile {
  token: string;
  /** Only the fact of passing the 13+ gate is kept — never the birth date. */
  ageGate13: true;
  daily: { date: string; sceneClears: Record<string, number> };
  lastSeen: number;
}

export const today = () => new Date().toISOString().slice(0, 10);

/** JSON-file profile store. Swap for Postgres in Phase 1 (same method surface). */
export class ProfileStore {
  private byId = new Map<string, StoredProfile>();
  private byToken = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;
  private file: string | null;

  constructor(dataDir: string | null) {
    this.file = dataDir ? path.join(dataDir, 'profiles.json') : null;
    if (this.file && fs.existsSync(this.file)) {
      try {
        const rows = JSON.parse(fs.readFileSync(this.file, 'utf8')) as StoredProfile[];
        for (const p of rows) this.index(p);
        console.log(`[store] ${rows.length} perfis carregados`);
      } catch (e) {
        console.error('[store] could not read profiles, starting fresh', e);
      }
    }
  }

  private index(p: StoredProfile) {
    this.byId.set(p.id, p);
    this.byToken.set(p.token, p.id);
  }

  newId() {
    return crypto.randomBytes(6).toString('hex');
  }

  newToken() {
    return crypto.randomBytes(24).toString('base64url');
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
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 800);
  }

  flush() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify([...this.byId.values()]));
    fs.renameSync(tmp, this.file);
  }

  count() {
    return this.byId.size;
  }
}

export function toPrivate(p: StoredProfile): PrivateProfile {
  const { token: _t, ageGate13: _a, daily: _d, lastSeen: _l, ...rest } = p;
  return structuredClone(rest);
}
