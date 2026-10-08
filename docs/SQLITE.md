# SQLite persistence

The server stores players, accounts, and the small world singletons in one SQLite file on the existing Fly volume:

`DATA_DIR/tudobem.sqlite` (production: `/data/tudobem.sqlite`).

Nothing new is paid for. The file is mode `0600`. The connection uses WAL, `synchronous=NORMAL`, and a 5 second busy timeout.

`better-sqlite3` is the driver. Node 22's `node:sqlite` is still experimental and its `DatabaseSync` has no online backup API. The published package includes a glibc prebuild, and the Fly image installs that package on `node:22-bookworm-slim` so the native addon matches the runtime.

## Schema

Each row is the same JSON object the old files held, keyed by id. Writes update that row. They do not rewrite the whole table.

| Table | Key | What it holds |
| --- | --- | --- |
| `accounts` | `id` (email unique) | Account object, including the existing scrypt `passwordHash` |
| `sessions` | `hash` | SHA-256 of the session cookie, account id, expiry. Never the cookie |
| `profiles` | `id` | Profile JSON without photo bytes |
| `photos` | `profile_id` | That player's photo array |
| `academies` | `id` | One academy |
| `padarias` | `id` | One padaria |
| `feedback` | `id` | One note. `created_at` is the sort key |
| `feira_cart` | `id = 'state'` | Cart on/off blob |
| `feira_games` | `id = 'state'` | Board, medals, paid runs |
| `kv` | `key` | Small singletons. `layouts` is the design-mode override blob |
| `meta` | `key` | Import bookkeeping (`json_imported`, `json_import_stamp`) |

Lemon Squeezy state stays on the profile (`subscription`, `billingEventIds`). There is no separate billing file. The append-only moderation log stays `moderation.jsonl`.

`#160` (admin Testes) stores its flags on the profile JSON. `#163` (design mode) is not on main; if `layouts.json` is already on the volume it is imported into `kv.layouts`, and `layoutFileAdapter` reads and writes that row.

## Boot migration

On startup, if the database has no player rows and any of these files exist, they are imported in one transaction:

`profiles.json`, `photos.json`, `accounts.json`, `academies.json`, `padarias.json`, `feedback.json`, `feiraCart.json`, `feiraGames.json`, `layouts.json`.

Photos that still sit inline on a profile move to the `photos` table. A `photos.json` entry for the same id wins. Password hashes are copied as stored. They are not rehashed.

After the insert, row counts are checked against the files. A mismatch or invalid JSON rolls the transaction back, leaves the JSON files where they are, and the process exits. The log line is counts only (`accounts=2 profiles=3`), never an email, hash, token, or row.

When the counts match, the process renames each imported file to `name.json.migrated-<UTC stamp>`. It does not delete them.

Restart safety:

- Crash before commit: database still empty, JSON still in place, next boot imports again.
- Crash after commit, before rename: `meta.json_imported` is set, so the next boot does not insert again. It only renames leftover source files.
- Second boot with a populated database: no import. Leftover source files are archived if the import flag is set.

A database that already has rows and was never imported (no flag) is left alone. The JSON files stay put.

## Backups

While the process runs it takes an online backup (`better-sqlite3`'s `backup()`, the SQLite backup API) to `DATA_DIR/backups/tudobem-<stamp>.sqlite`:

- First attempt about a minute after boot, then hourly.
- Another attempt on SIGTERM / SIGINT if the newest backup is older than an hour.
- At most 48 files, and the `backups/` directory stays under 200 MB (oldest removed first, newest always kept).
- Skipped when the live database itself is over 200 MB, or the volume does not have room for another copy plus 32 MB.

That keeps backup disk use well under the 1 GB volume. The live database is the same data the JSON files already held, plus a small amount of SQLite overhead.

## Restore a backup

Stop the machine first so nothing writes the file.

```bash
fly machine stop -a tudo-bem <machine-id>
fly ssh console -a tudo-bem
cd /data
cp tudobem.sqlite tudobem.sqlite.before-restore
rm -f tudobem.sqlite tudobem.sqlite-wal tudobem.sqlite-shm
cp backups/tudobem-<stamp>.sqlite tudobem.sqlite
chmod 600 tudobem.sqlite
exit
fly machine start -a tudo-bem <machine-id>
```

A backup is a single consistent file. It does not need the `-wal` from the live database. Confirm with the boot log (`contas carregadas`, `perfis carregados`) and a login.

## Roll back to the JSON files

Post-migration play is only in SQLite. The renamed `*.json.migrated-*` files are the snapshot from the moment of import. To go back to a build that reads JSON, export the live database first, then deploy that older image.

On the new image, inside the machine:

```bash
fly ssh console -a tudo-bem
cd /app
TB_SQLITE_EXPORT_JSON=1 node server.js
```

That writes `profiles.json`, `photos.json`, `accounts.json`, `academies.json`, `padarias.json`, `feedback.json`, `feiraCart.json`, `feiraGames.json`, and `layouts.json` (whichever tables have rows) and exits. Hashes are unchanged. `accounts.json` and `feedback.json` are mode `0600`. It does not delete `tudobem.sqlite`.

Then move the database aside so the old process cannot be confused with it, and deploy the previous release:

```bash
mv /data/tudobem.sqlite /data/tudobem.sqlite.rollback
rm -f /data/tudobem.sqlite-wal /data/tudobem.sqlite-shm
```

The previous release reads the exported JSON and ignores the `.rollback` file and the `*.json.migrated-*` copies.

To undo a bad rollback and stay on SQLite, move `tudobem.sqlite.rollback` back to `tudobem.sqlite` and deploy this release again. If the database file is gone but the migrated JSON is still there, rename `*.json.migrated-<stamp>` back to `*.json` and start this release: an empty database imports them again.

## Fly

No new service, secret, or volume size change. The 1 GB volume at `/data` is enough. Deploy the image as usual. The first boot imports and renames the JSON files. Watch the log for `imported accounts=…` and, after an hour or a restart, `backup tudobem-….sqlite`.

`moderation.jsonl` is unchanged.
