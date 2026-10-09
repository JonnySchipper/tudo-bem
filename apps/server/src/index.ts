import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import type { CookieSecure } from './auth.js';
import { readOpsSmokeConfig } from './opsSmoke.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';
import { exportSqliteToJson } from './sqliteExport.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
const CLIENT_DIST = process.env.CLIENT_DIST ?? [path.resolve(here, '../../client/dist'), path.resolve(process.cwd(), 'apps/client/dist')].find((p) => fs.existsSync(p));
const ROOM_CAP_RAW = Number(process.env.ROOM_CAP ?? 16);
const ROOM_CAP = Number.isFinite(ROOM_CAP_RAW) && ROOM_CAP_RAW >= 1 ? Math.floor(ROOM_CAP_RAW) : 16;
/** Praça / Academia ambiance CPUs: `on` for “feel” playtests (default), `off` for empty-room playtests. */
const CPU_AMBIANCE = (process.env.LIVEOPS_CPU_AMBIANCE ?? 'on').toLowerCase() !== 'off';
/** Idle kick after this many seconds without real input (default 15 min). */
const IDLE_KICK_SECONDS = Number(process.env.IDLE_KICK_SECONDS ?? 900);
/** `auto` (default): Secure when the request came over HTTPS (Fly sets X-Forwarded-Proto). */
const COOKIE_SECURE: CookieSecure = ({ '1': true, true: true, '0': false, false: false } as Record<string, boolean>)[String(process.env.COOKIE_SECURE ?? '').toLowerCase()] ?? 'auto';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

const idleKickMs = Number.isFinite(IDLE_KICK_SECONDS) && IDLE_KICK_SECONDS > 0 ? IDLE_KICK_SECONDS * 1000 : 900_000;
const opsSmoke = readOpsSmokeConfig();

if (process.env.TB_SQLITE_EXPORT_JSON === '1') {
  try {
    const db = openDatabase(DATA_DIR);
    const n = exportSqliteToJson(db, DATA_DIR);
    console.log(`[sqlite] exported files=${n}`);
    closeDatabase(DATA_DIR);
  } catch {
    console.error('[sqlite] export failed');
    process.exit(1);
  }
  process.exit(0);
}

const app = createApp({
  dataDir: DATA_DIR,
  clientDist: CLIENT_DIST,
  roomCap: ROOM_CAP,
  ambiance: CPU_AMBIANCE,
  idleKickMs,
  idleSweepMs: Math.min(15_000, Math.max(1000, idleKickMs / 10)),
  cookieSecure: COOKIE_SECURE,
  allowedOrigins: ALLOWED_ORIGINS,
  sessionTtlMs: Number.isFinite(SESSION_TTL_DAYS) && SESSION_TTL_DAYS > 0 ? SESSION_TTL_DAYS * 24 * 60 * 60_000 : undefined,
  opsSmoke,
  sqliteBackups: true,
});

app.server.listen(PORT, HOST, () => {
  console.log(`\n  Tudo Bem · servidor da praça em http://localhost:${PORT}`);
  console.log(
    `  client: ${CLIENT_DIST ?? '(dev mode — use Vite on :5173)'} · data: ${DATA_DIR} · cap ${ROOM_CAP}/instância · CPUs ${CPU_AMBIANCE ? 'on' : 'off'} · idle kick ${app.world.idleKickMs / 1000}s · ops smoke ${opsSmoke.ready ? 'on' : 'off'}\n`,
  );
});

const shutdown = () => {
  void app.close().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 15_000).unref();
};
// A stray rejection (a fire-and-forget promise somewhere) is logged; the world keeps running.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection', reason);
});
// After an uncaught exception the process state is unknown: save profiles synchronously, best effort, and exit so Fly restarts the machine.
process.on('uncaughtException', (err) => {
  console.error('[process] uncaught exception', err);
  try {
    app.store.flush();
  } catch (e) {
    console.error('[process] profile flush failed', e);
  }
  process.exit(1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
