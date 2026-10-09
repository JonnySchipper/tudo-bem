/**
 * One-time import of the JSON stores into SQLite.
 *
 * The import is a single immediate transaction. A crash before commit leaves the database empty
 * and the JSON files in place, so the next boot tries again. A crash after commit is recorded in
 * `meta` (`json_imported`); the next boot only renames leftover `*.json` files and does not insert
 * again. Renames use `*.json.migrated-<stamp>` and never delete.
 *
 * Logs are counts only. This file does not log emails, password hashes, tokens, or row bodies.
 */
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

export const JSON_FILES = [
  'profiles.json',
  'photos.json',
  'accounts.json',
  'academies.json',
  'padarias.json',
  'feedback.json',
  'feiraCart.json',
  'feiraGames.json',
  'layouts.json',
] as const;

export interface MigrateCounts {
  accounts: number;
  sessions: number;
  profiles: number;
  photos: number;
  academies: number;
  padarias: number;
  feedback: number;
  feira_cart: number;
  feira_games: number;
  layouts: number;
}

export type MigrateResult = { action: 'imported'; counts: MigrateCounts; stamp: string } | { action: 'already'; stamp: string | null } | { action: 'skipped' };

const USER_TABLES = ['accounts', 'sessions', 'profiles', 'photos', 'academies', 'padarias', 'feedback', 'feira_cart', 'feira_games', 'kv'] as const;

export class SqliteMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqliteMigrationError';
  }
}

function metaGet(db: Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function metaSet(db: Database, key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function userRows(db: Database): number {
  let n = 0;
  for (const table of USER_TABLES) {
    n += (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  }
  return n;
}

function readJson(dir: string, name: string): { missing: true } | { missing: false; value: unknown } {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return { missing: true };
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new SqliteMigrationError(`${name} could not be read`);
  }
  try {
    return { missing: false, value: JSON.parse(text) as unknown };
  } catch {
    throw new SqliteMigrationError(`${name} is not valid JSON`);
  }
}

function asArray(name: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new SqliteMigrationError(`${name} is not an array`);
  return value;
}

function idOf(name: string, row: unknown, index: number): string {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new SqliteMigrationError(`${name} row ${index} is not an object`);
  const id = (row as { id?: unknown }).id;
  if (typeof id !== 'string' || !id) throw new SqliteMigrationError(`${name} row ${index} is missing an id`);
  return id;
}

function assertUnique(name: string, ids: string[]): void {
  if (new Set(ids).size !== ids.length) throw new SqliteMigrationError(`${name} contains a duplicate id`);
}

interface PhotoBag {
  [id: string]: unknown;
}

function mergedPhotos(profiles: unknown[], photosFile: unknown): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>();
  for (const row of profiles) {
    if (!row || typeof row !== 'object') continue;
    const photos = (row as { photos?: unknown }).photos;
    const id = (row as { id?: unknown }).id;
    if (typeof id === 'string' && Array.isArray(photos) && photos.length) map.set(id, photos);
  }
  if (photosFile && typeof photosFile === 'object' && !Array.isArray(photosFile)) {
    for (const [id, photos] of Object.entries(photosFile as PhotoBag)) {
      if (Array.isArray(photos) && photos.length) map.set(id, photos);
      else map.delete(id);
    }
  }
  return map;
}

function profileJson(row: unknown): string {
  return JSON.stringify(row, (k, v) => (k === 'photos' ? undefined : v));
}

function expectCount(name: string, fileCount: number, dbCount: number): void {
  if (fileCount !== dbCount) throw new SqliteMigrationError(`${name} count mismatch file=${fileCount} db=${dbCount}`);
}

export function migrateJson(db: Database, dataDir: string): MigrateResult {
  const dir = path.resolve(dataDir);
  const run = db.transaction(() => {
    const flag = metaGet(db, 'json_imported');
    if (flag === '1') return { action: 'already' as const, stamp: metaGet(db, 'json_import_stamp') };
    if (userRows(db) > 0) {
      metaSet(db, 'json_imported', 'preexisting');
      return { action: 'skipped' as const };
    }
    const present = JSON_FILES.some((name) => fs.existsSync(path.join(dir, name)));
    if (!present) return { action: 'skipped' as const };

    const profilesFile = readJson(dir, 'profiles.json');
    const photosFile = readJson(dir, 'photos.json');
    const accountsFile = readJson(dir, 'accounts.json');
    const academiesFile = readJson(dir, 'academies.json');
    const padariasFile = readJson(dir, 'padarias.json');
    const feedbackFile = readJson(dir, 'feedback.json');
    const feiraCartFile = readJson(dir, 'feiraCart.json');
    const feiraGamesFile = readJson(dir, 'feiraGames.json');
    const layoutsFile = readJson(dir, 'layouts.json');

    const profiles = profilesFile.missing ? [] : asArray('profiles.json', profilesFile.value);
    const profileIds = profiles.map((row, i) => idOf('profiles.json', row, i));
    assertUnique('profiles.json', profileIds);
    const photos = mergedPhotos(profiles, photosFile.missing ? null : photosFile.value);

    const accountsRaw = accountsFile.missing ? null : accountsFile.value;
    let accounts: unknown[] = [];
    let sessions: unknown[] = [];
    if (accountsRaw != null) {
      if (!accountsRaw || typeof accountsRaw !== 'object' || Array.isArray(accountsRaw)) throw new SqliteMigrationError('accounts.json is not an object');
      const body = accountsRaw as { accounts?: unknown; sessions?: unknown };
      accounts = asArray('accounts.json accounts', body.accounts ?? []);
      sessions = asArray('accounts.json sessions', body.sessions ?? []);
    }
    const accountIds = accounts.map((row, i) => idOf('accounts.json', row, i));
    assertUnique('accounts.json', accountIds);
    const emails: string[] = [];
    for (const row of accounts) {
      const email = (row as { email?: unknown }).email;
      if (typeof email !== 'string' || !email) throw new SqliteMigrationError('accounts.json account is missing an email');
      emails.push(email);
    }
    if (new Set(emails).size !== emails.length) throw new SqliteMigrationError('accounts.json contains a duplicate email');
    const sessionHashes = sessions.map((row, i) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new SqliteMigrationError(`accounts.json session ${i} is not an object`);
      const hash = (row as { hash?: unknown }).hash;
      const accountId = (row as { accountId?: unknown }).accountId;
      if (typeof hash !== 'string' || !hash) throw new SqliteMigrationError(`accounts.json session ${i} is missing a hash`);
      if (typeof accountId !== 'string' || !accountId) throw new SqliteMigrationError(`accounts.json session ${i} is missing an accountId`);
      return hash;
    });
    assertUnique('accounts.json sessions', sessionHashes);

    const academies = academiesFile.missing ? [] : asArray('academies.json', academiesFile.value);
    const academyIds = academies.map((row, i) => idOf('academies.json', row, i));
    assertUnique('academies.json', academyIds);
    const padarias = padariasFile.missing ? [] : asArray('padarias.json', padariasFile.value);
    const padariaIds = padarias.map((row, i) => idOf('padarias.json', row, i));
    assertUnique('padarias.json', padariaIds);

    let feedback: unknown[] = [];
    if (!feedbackFile.missing) {
      const raw = feedbackFile.value;
      if (Array.isArray(raw)) feedback = raw;
      else if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) feedback = (raw as { items: unknown[] }).items;
      else throw new SqliteMigrationError('feedback.json is not a list');
    }
    const feedbackIds = feedback.map((row, i) => idOf('feedback.json', row, i));
    assertUnique('feedback.json', feedbackIds);

    const insertProfile = db.prepare('INSERT INTO profiles (id, json) VALUES (?, ?)');
    for (const row of profiles) {
      const id = (row as { id: string }).id;
      insertProfile.run(id, profileJson(row));
    }
    const insertPhoto = db.prepare('INSERT INTO photos (profile_id, json) VALUES (?, ?)');
    for (const [id, list] of photos) insertPhoto.run(id, JSON.stringify(list));

    const insertAccount = db.prepare('INSERT INTO accounts (id, email, json) VALUES (?, ?, ?)');
    for (const row of accounts) {
      const account = row as { id: string; email: string };
      insertAccount.run(account.id, account.email, JSON.stringify(account));
    }
    const insertSession = db.prepare('INSERT INTO sessions (hash, account_id, expires_at, json) VALUES (?, ?, ?, ?)');
    for (const row of sessions) {
      const session = row as { hash: string; accountId: string; expiresAt?: unknown };
      const expires = typeof session.expiresAt === 'number' && Number.isFinite(session.expiresAt) ? Math.trunc(session.expiresAt) : 0;
      insertSession.run(session.hash, session.accountId, expires, JSON.stringify(session));
    }

    const insertAcademy = db.prepare('INSERT INTO academies (id, json) VALUES (?, ?)');
    for (const row of academies) insertAcademy.run((row as { id: string }).id, JSON.stringify(row));
    const insertPadaria = db.prepare('INSERT INTO padarias (id, json) VALUES (?, ?)');
    for (const row of padarias) insertPadaria.run((row as { id: string }).id, JSON.stringify(row));
    const insertFeedback = db.prepare('INSERT INTO feedback (id, created_at, json) VALUES (?, ?, ?)');
    for (const row of feedback) {
      const item = row as { id: string; createdAt?: unknown };
      const at = typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? Math.trunc(item.createdAt) : 0;
      insertFeedback.run(item.id, at, JSON.stringify(item));
    }

    const feiraCart = !feiraCartFile.missing && feiraCartFile.value != null;
    const feiraGames = !feiraGamesFile.missing && feiraGamesFile.value != null;
    const layouts = !layoutsFile.missing && layoutsFile.value != null;
    if (feiraCart) db.prepare(`INSERT INTO feira_cart (id, json) VALUES ('state', ?)`).run(JSON.stringify(feiraCartFile.value));
    if (feiraGames) db.prepare(`INSERT INTO feira_games (id, json) VALUES ('state', ?)`).run(JSON.stringify(feiraGamesFile.value));
    if (layouts) db.prepare(`INSERT INTO kv (key, json) VALUES ('layouts', ?)`).run(JSON.stringify(layoutsFile.value));

    const counts: MigrateCounts = {
      accounts: accounts.length,
      sessions: sessions.length,
      profiles: profiles.length,
      photos: photos.size,
      academies: academies.length,
      padarias: padarias.length,
      feedback: feedback.length,
      feira_cart: feiraCart ? 1 : 0,
      feira_games: feiraGames ? 1 : 0,
      layouts: layouts ? 1 : 0,
    };
    expectCount('accounts', counts.accounts, (db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n);
    expectCount('sessions', counts.sessions, (db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n);
    expectCount('profiles', counts.profiles, (db.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n);
    expectCount('photos', counts.photos, (db.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number }).n);
    expectCount('academies', counts.academies, (db.prepare('SELECT COUNT(*) AS n FROM academies').get() as { n: number }).n);
    expectCount('padarias', counts.padarias, (db.prepare('SELECT COUNT(*) AS n FROM padarias').get() as { n: number }).n);
    expectCount('feedback', counts.feedback, (db.prepare('SELECT COUNT(*) AS n FROM feedback').get() as { n: number }).n);
    expectCount('feira_cart', counts.feira_cart, (db.prepare('SELECT COUNT(*) AS n FROM feira_cart').get() as { n: number }).n);
    expectCount('feira_games', counts.feira_games, (db.prepare('SELECT COUNT(*) AS n FROM feira_games').get() as { n: number }).n);
    expectCount('layouts', counts.layouts, (db.prepare(`SELECT COUNT(*) AS n FROM kv WHERE key = 'layouts'`).get() as { n: number }).n);

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    metaSet(db, 'json_imported', '1');
    metaSet(db, 'json_import_stamp', stamp);
    return { action: 'imported' as const, counts, stamp };
  });

  const result = run.immediate();
  if (result.action === 'already') return result;
  if (result.action === 'imported') return result;
  return { action: 'skipped' };
}

/** Rename leftover source JSON files. Never overwrites an existing migrated file. */
export function archiveSourceJson(dataDir: string, stamp: string): number {
  const dir = path.resolve(dataDir);
  let n = 0;
  for (const name of JSON_FILES) {
    const src = path.join(dir, name);
    if (!fs.existsSync(src)) continue;
    let dest = path.join(dir, `${name}.migrated-${stamp}`);
    let i = 2;
    while (fs.existsSync(dest)) {
      dest = path.join(dir, `${name}.migrated-${stamp}-${i}`);
      i += 1;
    }
    fs.renameSync(src, dest);
    n += 1;
  }
  return n;
}
