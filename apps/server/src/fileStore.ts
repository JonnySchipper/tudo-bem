/**
 * Store adapters backed by SQLite. The classes World and auth already use (`ProfileStore`,
 * `AccountStore`, `AcademyStore`, …) keep the same load/save surface. Each save writes changed
 * rows in one transaction.
 *
 * Profiles: `ProfileStore` calls `upsert` with only the profiles that changed since the last flush and
 * `remove` for an explicit deletion. `save` (whole set, deletes rows missing from it) stays for tools
 * and tests.
 *
 * Photos stay out of the profiles table. A save rewrites a photo row only when that profile's
 * photo ids change (same rule as the old `photos.json` split: image bytes live under an id).
 *
 * Design-mode `layouts.json` is a kv row. A volume that already has the file is imported, and
 * `layoutFileAdapter` is what `LayoutStore` loads and saves.
 */
import type { PlayerAcademy } from '@tudobem/shared';
import type { AcademyPersistence } from './academyStore.js';
import type { AccountPersistence, AccountsData } from './auth.js';
import type { FeedbackFile, FeedbackPersistence } from './feedbackStore.js';
import type { PadariaPersistence } from './padariaStore.js';
import type { PersistenceAdapter, StoredProfile } from './store.js';
import { commitImmediate, countOf, loadJsonList, loadKv, loadSingleton, openDatabase, rowsOf, saveKv, saveSingleton, sqlitePath, syncRows, syncRowsCommitted, type SqliteDatabase } from './sqliteDb.js';

type Photos = NonNullable<StoredProfile['photos']>;

const photoSignature = (photos: Photos | undefined) => (photos ?? []).map((p) => p.id).join(',');

function dbFor(dataDir: string): SqliteDatabase {
  return openDatabase(dataDir);
}

function writable(db: SqliteDatabase): boolean {
  return db.open;
}

export function fileAdapter(dataDir: string): PersistenceAdapter {
  const db = dbFor(dataDir);
  /** Photo ids last written or loaded, by profile id. Missing key means no photo row. */
  const written = new Map<string, string>();
  return {
    describe: () => sqlitePath(dataDir),
    load: () => {
      written.clear();
      const photos = new Map<string, Photos>();
      for (const row of rowsOf(db, 'SELECT profile_id AS id, json FROM photos')) {
        try {
          const parsed = JSON.parse(row.json) as Photos;
          if (Array.isArray(parsed) && parsed.length) {
            photos.set(row.id, parsed);
            written.set(row.id, photoSignature(parsed));
          }
        } catch {
          console.error('[sqlite] skipped unreadable photo row');
        }
      }
      const rows: StoredProfile[] = [];
      for (const row of rowsOf(db, 'SELECT id, json FROM profiles')) {
        try {
          const profile = JSON.parse(row.json) as StoredProfile;
          const kept = photos.get(profile.id);
          if (kept) profile.photos = kept;
          rows.push(profile);
        } catch {
          console.error('[sqlite] skipped unreadable profile row');
        }
      }
      return rows;
    },
    save: (rows) => {
      if (!writable(db)) return;
      const profiles = rows.map((row) => {
        const json = profileJson(row);
        return { id: row.id, json, params: [row.id, json] };
      });
      const next = new Map<string, string>();
      commitImmediate(db, () => {
        syncRows(
          db,
          'SELECT id, json FROM profiles',
          'INSERT INTO profiles (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
          'DELETE FROM profiles WHERE id = ?',
          profiles,
        );
        const seen = new Set(rows.map((r) => r.id));
        const photoIds = new Set((db.prepare('SELECT profile_id AS id FROM photos').all() as { id: string }[]).map((r) => r.id));
        const upsert = db.prepare('INSERT INTO photos (profile_id, json) VALUES (?, ?) ON CONFLICT(profile_id) DO UPDATE SET json = excluded.json');
        const del = db.prepare('DELETE FROM photos WHERE profile_id = ?');
        for (const row of rows) {
          const has = !!row.photos?.length;
          if (!has) {
            if (photoIds.has(row.id) || written.has(row.id)) del.run(row.id);
            continue;
          }
          const sig = photoSignature(row.photos);
          next.set(row.id, sig);
          if (written.get(row.id) === sig && photoIds.has(row.id)) continue;
          upsert.run(row.id, JSON.stringify(row.photos));
        }
        for (const id of photoIds) if (!seen.has(id)) del.run(id);
      });
      written.clear();
      for (const [id, sig] of next) written.set(id, sig);
    },
    upsert: (rows) => {
      if (!writable(db) || !rows.length) return;
      // No SELECT of the table: SQLite skips a row whose JSON did not change (the WHERE on the upsert).
      const next = new Map<string, string | null>();
      commitImmediate(db, () => {
        const profile = db.prepare('INSERT INTO profiles (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json WHERE profiles.json IS NOT excluded.json');
        const photo = db.prepare('INSERT INTO photos (profile_id, json) VALUES (?, ?) ON CONFLICT(profile_id) DO UPDATE SET json = excluded.json');
        const delPhoto = db.prepare('DELETE FROM photos WHERE profile_id = ?');
        for (const row of rows) {
          profile.run(row.id, profileJson(row));
          if (!row.photos?.length) {
            if (written.has(row.id)) delPhoto.run(row.id);
            next.set(row.id, null);
            continue;
          }
          const sig = photoSignature(row.photos);
          if (written.get(row.id) !== sig) photo.run(row.id, JSON.stringify(row.photos));
          next.set(row.id, sig);
        }
      });
      for (const [id, sig] of next) {
        if (sig === null) written.delete(id);
        else written.set(id, sig);
      }
    },
    remove: (ids) => {
      if (!writable(db) || !ids.length) return;
      commitImmediate(db, () => {
        const delProfile = db.prepare('DELETE FROM profiles WHERE id = ?');
        const delPhoto = db.prepare('DELETE FROM photos WHERE profile_id = ?');
        for (const id of ids) {
          delProfile.run(id);
          delPhoto.run(id);
        }
      });
      for (const id of ids) written.delete(id);
    },
  };
}

const profileJson = (row: StoredProfile) => JSON.stringify(row, (k, v) => (k === 'photos' ? undefined : v));

export function academyFileAdapter(dataDir: string): AcademyPersistence {
  const db = dbFor(dataDir);
  return {
    describe: () => sqlitePath(dataDir),
    load: () => loadJsonList(db, 'SELECT json FROM academies ORDER BY id'),
    save: (rows: PlayerAcademy[]) => {
      if (!writable(db)) return;
      saveIdRows(db, 'academies', rows);
    },
  };
}

export function padariaFileAdapter(dataDir: string): PadariaPersistence {
  const db = dbFor(dataDir);
  return {
    describe: () => sqlitePath(dataDir),
    load: () => loadJsonList(db, 'SELECT json FROM padarias ORDER BY id'),
    save: (rows) => {
      if (!writable(db)) return;
      saveIdRows(db, 'padarias', rows);
    },
  };
}

export function feedbackFileAdapter(dataDir: string): FeedbackPersistence {
  const db = dbFor(dataDir);
  return {
    describe: () => sqlitePath(dataDir),
    load: () => {
      const items = loadJsonList(db, 'SELECT json FROM feedback ORDER BY created_at, id');
      return { version: 1, items };
    },
    save: (data: FeedbackFile) => {
      if (!writable(db)) return;
      const rows = data.items.map((row) => ({
        id: row.id,
        json: JSON.stringify(row),
        params: [row.id, row.createdAt, JSON.stringify(row)],
      }));
      syncRowsCommitted(
        db,
        'SELECT id, json FROM feedback',
        'INSERT INTO feedback (id, created_at, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET created_at = excluded.created_at, json = excluded.json',
        'DELETE FROM feedback WHERE id = ?',
        rows,
      );
    },
  };
}

export function feiraCartFileAdapter(dataDir: string): { load: () => unknown; save: (state: unknown) => void } {
  const db = dbFor(dataDir);
  return {
    load: () => loadSingleton(db, 'feira_cart'),
    save: (state) => {
      if (writable(db)) saveSingleton(db, 'feira_cart', state);
    },
  };
}

export function feiraGamesFileAdapter(dataDir: string): { load: () => unknown; save: (state: unknown) => void } {
  const db = dbFor(dataDir);
  return {
    load: () => loadSingleton(db, 'feira_games'),
    save: (state) => {
      if (writable(db)) saveSingleton(db, 'feira_games', state);
    },
  };
}

/** Design-mode overrides. Missing row means every room uses the layout shipped in the repo. */
export function layoutFileAdapter(dataDir: string): { load: () => unknown; save: (state: unknown) => void } {
  const db = dbFor(dataDir);
  return {
    load: () => loadKv(db, 'layouts'),
    save: (state) => {
      if (writable(db)) saveKv(db, 'layouts', state);
    },
  };
}

/** Dashboard game-variable overrides (gameConfig.ts). Missing row means every value is the shipped default. */
export function gameConfigFileAdapter(dataDir: string): { load: () => unknown; save: (state: unknown) => void } {
  const db = dbFor(dataDir);
  return {
    load: () => loadKv(db, 'gameConfig'),
    save: (state) => {
      if (writable(db)) saveKv(db, 'gameConfig', state);
    },
  };
}

export function accountsFileAdapter(dataDir: string): AccountPersistence {
  const db = dbFor(dataDir);
  return {
    load: () => {
      if (countOf(db, 'accounts') === 0 && countOf(db, 'sessions') === 0) return null;
      const accounts = loadJsonList(db, 'SELECT json FROM accounts ORDER BY id') as AccountsData['accounts'];
      const sessions = loadJsonList(db, 'SELECT json FROM sessions ORDER BY hash') as AccountsData['sessions'];
      return { version: 1, accounts, sessions };
    },
    save: (data: AccountsData) => {
      if (!writable(db)) return;
      const accounts = data.accounts.map((row) => ({
        id: row.id,
        json: JSON.stringify(row),
        params: [row.id, row.email, JSON.stringify(row)],
      }));
      const sessions = data.sessions.map((row) => ({
        id: row.hash,
        json: JSON.stringify(row),
        params: [row.hash, row.accountId, row.expiresAt, JSON.stringify(row)],
      }));
      commitImmediate(db, () => {
        syncRows(
          db,
          'SELECT id, json FROM accounts',
          'INSERT INTO accounts (id, email, json) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, json = excluded.json',
          'DELETE FROM accounts WHERE id = ?',
          accounts,
        );
        syncRows(
          db,
          'SELECT hash AS id, json FROM sessions',
          'INSERT INTO sessions (hash, account_id, expires_at, json) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET account_id = excluded.account_id, expires_at = excluded.expires_at, json = excluded.json',
          'DELETE FROM sessions WHERE hash = ?',
          sessions,
        );
      });
    },
  };
}

function saveIdRows(db: SqliteDatabase, table: 'academies' | 'padarias', rows: { id: string }[]): void {
  syncRowsCommitted(
    db,
    `SELECT id, json FROM ${table}`,
    `INSERT INTO ${table} (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json`,
    `DELETE FROM ${table} WHERE id = ?`,
    rows.map((row) => {
      const json = JSON.stringify(row);
      return { id: row.id, json, params: [row.id, json] };
    }),
  );
}
