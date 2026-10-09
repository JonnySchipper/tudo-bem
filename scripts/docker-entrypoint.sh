#!/bin/sh
# Container entrypoint (Dockerfile). Starts as root only to prepare the data volume, then runs the server as
# the image's `node` user. exec keeps the server as PID 1, so SIGTERM / SIGINT reach its graceful close.
set -e
data="${DATA_DIR:-/data}"

if [ "$(id -u)" = 0 ]; then
  mkdir -p "$data"

  # Restore: put a backup at $DATA_DIR/restore.sqlite and restart the machine (docs/SQLITE.md). The live
  # database and its WAL are kept beside it under one suffix, so that copy still opens with its last writes.
  if [ -f "$data/restore.sqlite" ]; then
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    for ext in '' -wal -shm; do
      if [ -f "$data/tudobem.sqlite$ext" ]; then mv "$data/tudobem.sqlite$ext" "$data/tudobem.sqlite.before-restore-$stamp$ext"; fi
    done
    mv "$data/restore.sqlite" "$data/tudobem.sqlite"
    echo "[entrypoint] restored tudobem.sqlite from restore.sqlite (previous kept as tudobem.sqlite.before-restore-$stamp)"
  fi

  # The Fly volume is mounted root-owned, and older releases (and `fly ssh console` tools) wrote files as root.
  chown -R node:node "$data"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
