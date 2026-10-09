/**
 * Write the SQLite tables back out as the JSON files the previous server build reads.
 * Used by `TB_SQLITE_EXPORT_JSON=1`. Does not delete the database.
 */
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { atomicWriteFileSync } from './atomicWrite.js';

function parsed(db: Database, sql: string): unknown[] {
  const out: unknown[] = [];
  for (const row of db.prepare(sql).all() as { json: string }[]) out.push(JSON.parse(row.json) as unknown);
  return out;
}

function write(file: string, value: unknown, mode?: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomicWriteFileSync(file, JSON.stringify(value), mode);
}

/** Returns how many JSON files were written. */
export function exportSqliteToJson(db: Database, dataDir: string): number {
  const dir = path.resolve(dataDir);
  let n = 0;
  const profiles = parsed(db, 'SELECT json FROM profiles ORDER BY id');
  const photos: Record<string, unknown> = {};
  for (const row of db.prepare('SELECT profile_id AS id, json FROM photos ORDER BY profile_id').all() as { id: string; json: string }[]) {
    photos[row.id] = JSON.parse(row.json) as unknown;
  }
  if (profiles.length || Object.keys(photos).length) {
    write(path.join(dir, 'profiles.json'), profiles);
    write(path.join(dir, 'photos.json'), photos);
    n += 2;
  }
  const accounts = parsed(db, 'SELECT json FROM accounts ORDER BY id');
  const sessions = parsed(db, 'SELECT json FROM sessions ORDER BY hash');
  if (accounts.length || sessions.length) {
    write(path.join(dir, 'accounts.json'), { version: 1, accounts, sessions }, 0o600);
    n += 1;
  }
  const academies = parsed(db, 'SELECT json FROM academies ORDER BY id');
  if (academies.length) {
    write(path.join(dir, 'academies.json'), academies);
    n += 1;
  }
  const padarias = parsed(db, 'SELECT json FROM padarias ORDER BY id');
  if (padarias.length) {
    write(path.join(dir, 'padarias.json'), padarias);
    n += 1;
  }
  const feedback = parsed(db, 'SELECT json FROM feedback ORDER BY created_at, id');
  if (feedback.length) {
    write(path.join(dir, 'feedback.json'), { version: 1, items: feedback }, 0o600);
    n += 1;
  }
  const cart = db.prepare(`SELECT json FROM feira_cart WHERE id = 'state'`).get() as { json: string } | undefined;
  if (cart) {
    write(path.join(dir, 'feiraCart.json'), JSON.parse(cart.json));
    n += 1;
  }
  const games = db.prepare(`SELECT json FROM feira_games WHERE id = 'state'`).get() as { json: string } | undefined;
  if (games) {
    write(path.join(dir, 'feiraGames.json'), JSON.parse(games.json));
    n += 1;
  }
  const layouts = db.prepare(`SELECT json FROM kv WHERE key = 'layouts'`).get() as { json: string } | undefined;
  if (layouts) {
    write(path.join(dir, 'layouts.json'), JSON.parse(layouts.json));
    n += 1;
  }
  return n;
}
