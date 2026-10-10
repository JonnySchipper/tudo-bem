/**
 * SQLite persistence for the Fly volume (`DATA_DIR/tudobem.sqlite`).
 *
 * better-sqlite3 (not `node:sqlite`): Node 22 still marks `node:sqlite` experimental, and
 * `DatabaseSync` has no online backup API. better-sqlite3 is synchronous, ships glibc and musl
 * prebuilds, and `backup()` is the SQLite online backup API. WAL + synchronous=NORMAL + busy_timeout
 * so a reader and the one game process can share the file.
 *
 * One connection per data directory. Adapters write changed rows inside a transaction; they do not
 * rewrite a whole JSON document.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { archiveSourceJson, migrateJson, type MigrateCounts } from './sqliteMigrate.js';

export type SqliteDatabase = Database;

export const SQLITE_FILE = 'tudobem.sqlite';
/** Hourly snapshots, kept while they fit. */
export const BACKUP_KEEP = 48;
/** All files under `backups/` together. The live database is separate. */
export const BACKUP_MAX_BYTES = 200 * 1024 * 1024;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  json TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(email);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
  profile_id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS photo_images (
  profile_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  image TEXT NOT NULL,
  PRIMARY KEY (profile_id, photo_id)
);
CREATE TABLE IF NOT EXISTS academies (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS padarias (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feira_cart (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feira_games (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  summary TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  snapshot_json TEXT
);
CREATE INDEX IF NOT EXISTS admin_audit_at ON admin_audit(at);
CREATE TRIGGER IF NOT EXISTS admin_audit_no_update BEFORE UPDATE ON admin_audit BEGIN SELECT RAISE(ABORT, 'admin_audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS admin_audit_no_delete BEFORE DELETE ON admin_audit BEGIN SELECT RAISE(ABORT, 'admin_audit is append-only'); END;
CREATE TABLE IF NOT EXISTS billing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  profile_id TEXT,
  status TEXT,
  outcome TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS billing_events_at ON billing_events(at);
`;

const openDbs = new Map<string, Database>();
const dbFiles = new WeakMap<Database, string>();

export function sqlitePath(dataDir: string): string {
  return path.join(path.resolve(dataDir), SQLITE_FILE);
}

export function openDatabase(dataDir: string): Database {
  const dir = path.resolve(dataDir);
  const cached = openDbs.get(dir);
  if (cached?.open) return cached;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, SQLITE_FILE);
  const db = new Database(file, { timeout: 5000 });
  try {
    const journal = db.pragma('journal_mode = WAL', { simple: true });
    if (journal !== 'wal') throw new Error(`[sqlite] journal_mode is ${String(journal)}`);
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA);
    db.pragma('user_version = 1');
    tighten(file);
    const migrated = migrateJson(db, dir);
    if (migrated.action === 'imported') {
      console.log(`[sqlite] imported ${formatCounts(migrated.counts)}`);
      const n = archiveSourceJson(dir, migrated.stamp);
      console.log(`[sqlite] archived json files=${n} suffix=.migrated-${migrated.stamp}`);
    } else if (migrated.action === 'already' && migrated.stamp) {
      const n = archiveSourceJson(dir, migrated.stamp);
      if (n) console.log(`[sqlite] archived leftover json files=${n} suffix=.migrated-${migrated.stamp}`);
    }
    tighten(file);
  } catch (e) {
    try {
      db.close();
    } catch {
      /* the original error is the one to surface */
    }
    throw e;
  }
  openDbs.set(dir, db);
  dbFiles.set(db, file);
  return db;
}

export function closeDatabase(dataDir: string): void {
  const dir = path.resolve(dataDir);
  const db = openDbs.get(dir);
  if (!db) return;
  openDbs.delete(dir);
  if (db.open) db.close();
}

export function databaseFile(db: Database): string | undefined {
  return dbFiles.get(db);
}

/** 0600: the file holds password hashes, session hashes, and feedback contacts. */
export function tighten(file: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = file + suffix;
    try {
      if (fs.existsSync(p)) fs.chmodSync(p, 0o600);
    } catch {
      /* a chmod failure must not take the game down */
    }
  }
}

function tightenDb(db: Database): void {
  const file = dbFiles.get(db);
  if (file) tighten(file);
}

export interface JsonRow {
  id: string;
  json: string;
}

export function rowsOf(db: Database, sql: string): JsonRow[] {
  return db.prepare(sql).all() as JsonRow[];
}

export function countOf(db: Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
  return row.n;
}

/**
 * Insert, update, or delete rows by id. Unchanged JSON is left untouched.
 * Does not open a transaction; callers that need atomicity wrap this.
 * `upsert` binds the per-row `params` array.
 */
export function syncRows(db: Database, selectSql: string, upsertSql: string, deleteSql: string, rows: { id: string; json: string; params: unknown[] }[]): void {
  const existing = new Map<string, string>();
  for (const row of db.prepare(selectSql).all() as JsonRow[]) existing.set(row.id, row.json);
  const upsert = db.prepare(upsertSql);
  const del = db.prepare(deleteSql);
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(row.id);
    if (existing.get(row.id) !== row.json) upsert.run(...row.params);
  }
  for (const id of existing.keys()) if (!seen.has(id)) del.run(id);
}

/** One immediate transaction around `syncRows`, then 0600 on the database file. */
export function syncRowsCommitted(db: Database, selectSql: string, upsertSql: string, deleteSql: string, rows: { id: string; json: string; params: unknown[] }[]): void {
  const tx = db.transaction(() => syncRows(db, selectSql, upsertSql, deleteSql, rows));
  tx.immediate();
  tightenDb(db);
}

export function commitImmediate(db: Database, fn: () => void): void {
  const tx = db.transaction(fn);
  tx.immediate();
  tightenDb(db);
}

export function loadJsonList(db: Database, sql: string): unknown[] {
  const out: unknown[] = [];
  for (const row of db.prepare(sql).all() as { json: string }[]) {
    try {
      out.push(JSON.parse(row.json));
    } catch {
      console.error('[sqlite] skipped unreadable row');
    }
  }
  return out;
}

export function loadSingleton(db: Database, table: 'feira_cart' | 'feira_games'): unknown {
  const row = db.prepare(`SELECT json FROM ${table} WHERE id = 'state'`).get() as { json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.json);
  } catch {
    console.error(`[sqlite] skipped unreadable ${table}`);
    return null;
  }
}

export function saveSingleton(db: Database, table: 'feira_cart' | 'feira_games', state: unknown): void {
  const json = JSON.stringify(state);
  const row = db.prepare(`SELECT json FROM ${table} WHERE id = 'state'`).get() as { json: string } | undefined;
  if (row?.json === json) return;
  db.prepare(`INSERT INTO ${table} (id, json) VALUES ('state', ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json`).run(json);
  tightenDb(db);
}

export function loadKv(db: Database, key: string): unknown {
  const row = db.prepare('SELECT json FROM kv WHERE key = ?').get(key) as { json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.json);
  } catch {
    console.error('[sqlite] skipped unreadable kv row');
    return null;
  }
}

export function saveKv(db: Database, key: string, state: unknown): void {
  const json = JSON.stringify(state);
  const row = db.prepare('SELECT json FROM kv WHERE key = ?').get(key) as { json: string } | undefined;
  if (row?.json === json) return;
  db.prepare('INSERT INTO kv (key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json').run(key, json);
  tightenDb(db);
}

function formatCounts(counts: MigrateCounts): string {
  return Object.entries(counts)
    .map(([k, n]) => `${k}=${n}`)
    .join(' ');
}

export interface BackupOptions {
  /** Write even when the newest backup is under an hour old. */
  force?: boolean;
  keep?: number;
  maxBytes?: number;
}

export interface BackupFile {
  path: string;
  mtimeMs: number;
  size: number;
}

/** Backup files under `dir` (normally `dataDir/backups`), newest first. */
export function listBackups(dir: string): BackupFile[] {
  if (!fs.existsSync(dir)) return [];
  const out: BackupFile[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('tudobem-') || !name.endsWith('.sqlite')) continue;
    const file = path.join(dir, name);
    const st = fs.statSync(file);
    if (!st.isFile()) continue;
    out.push({ path: file, mtimeMs: st.mtimeMs, size: st.size });
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

function pruneBackups(dir: string, keep: number, maxBytes: number): number {
  let files = listBackups(dir);
  const drop = (file: BackupFile) => {
    fs.rmSync(file.path, { force: true });
    files = files.filter((f) => f.path !== file.path);
  };
  while (files.length > keep) drop(files[files.length - 1]!);
  const total = () => files.reduce((n, f) => n + f.size, 0);
  while (files.length > 1 && total() > maxBytes) drop(files[files.length - 1]!);
  return files.length;
}

/**
 * Online backup (better-sqlite3 `backup()`, the SQLite backup API) into `dataDir/backups`.
 * Skips when the newest file is under an hour old, when one copy would blow the byte cap,
 * or when the volume does not have room for another copy. Keeps the last `keep` files and
 * trims oldest-first so the directory stays under `maxBytes`.
 */
export async function backupDatabase(db: Database, dataDir: string, opts: BackupOptions = {}): Promise<string | null> {
  const dir = path.resolve(dataDir);
  const backupDir = path.join(dir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  try {
    fs.chmodSync(backupDir, 0o700);
  } catch {
    /* best effort */
  }
  const keep = opts.keep ?? BACKUP_KEEP;
  const maxBytes = opts.maxBytes ?? BACKUP_MAX_BYTES;
  const existing = listBackups(backupDir);
  const newest = existing[0];
  if (!opts.force && newest && Date.now() - newest.mtimeMs < BACKUP_INTERVAL_MS) return null;

  const live = dbFiles.get(db) ?? sqlitePath(dir);
  let liveBytes = 0;
  try {
    // The backup API writes one consistent file about the size of the main database, not the WAL.
    liveBytes = fs.statSync(live).size;
  } catch {
    liveBytes = 0;
  }
  if (liveBytes > maxBytes) {
    console.error(`[sqlite] backup skipped live_bytes=${liveBytes} cap=${maxBytes}`);
    return null;
  }
  try {
    const free = fs.statfsSync(dir);
    const avail = Number(free.bavail) * Number(free.bsize);
    if (avail > 0 && avail < liveBytes + 32 * 1024 * 1024) {
      console.error(`[sqlite] backup skipped free_bytes=${avail} need=${liveBytes}`);
      return null;
    }
  } catch {
    /* statfs is best-effort; the backup itself still runs */
  }

  pruneBackups(backupDir, Math.max(1, keep - 1), Math.max(0, maxBytes - liveBytes));
  const stamp = new Date().toISOString().replace(/:/g, '-');
  const dest = path.join(backupDir, `tudobem-${stamp}.sqlite`);
  await db.backup(dest);
  try {
    fs.chmodSync(dest, 0o600);
  } catch {
    /* best effort */
  }
  const kept = pruneBackups(backupDir, keep, maxBytes);
  const size = fs.statSync(dest).size;
  console.log(`[sqlite] backup ${path.basename(dest)} bytes=${size} kept=${kept}`);
  return dest;
}
