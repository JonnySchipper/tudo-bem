# Tudo Bem — single container: Node room server + static client + the Jev chat-safety model.
FROM node:22-alpine AS build
WORKDIR /app
# pnpm runs node-gyp for better-sqlite3 (see onlyBuiltDependencies). The musl prebuild is already
# in the package, so Python and make are enough for node-gyp to notice it and skip the compile.
# The runtime image uses the glibc prebuild from the sqlite stage, not this Alpine binary.
RUN apk add --no-cache python3 make && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Jev model (Horizon-Labs/multilingual-toxicity-small, Apache-2.0): pinned revision, sha256-checked, re-saved with
# external weights so ONNX Runtime keeps about half as much in resident memory. Cached unless the script changes.
FROM python:3.12-slim AS model
RUN pip install --no-cache-dir onnx==1.23.2
COPY scripts/fetch-jev-model.py /fetch-jev-model.py
RUN python /fetch-jev-model.py --external /models/jev-tox-small

# ONNX Runtime ships glibc binaries, so the runtime image is Debian slim (not Alpine).
# The version is the one apps/server/package.json pins (exact), so the bundle and the native addon agree.
FROM node:22-bookworm-slim AS ort
WORKDIR /ort
COPY apps/server/package.json /tmp/server-package.json
RUN echo '{"private":true}' > package.json \
  && ONNXRUNTIME_NODE_INSTALL=skip npm install --omit=dev --no-audit --no-fund \
    "onnxruntime-node@$(node -p "require('/tmp/server-package.json').dependencies['onnxruntime-node']")" \
  && cd node_modules/onnxruntime-node/bin/napi-v6 \
  && find . -mindepth 2 -maxdepth 2 -type d ! -path ./linux/x64 -exec rm -rf {} + \
  && rm -f linux/x64/libonnxruntime_providers_*

# better-sqlite3 ships a glibc prebuild (prebuilds/linux-x64.node). Install it on bookworm so the
# runtime image does not pick up the musl binary from the Alpine build stage. If a future release
# drops that prebuild, node-gyp needs python3, make, and g++ in this stage.
FROM node:22-bookworm-slim AS sqlite
WORKDIR /sqlite
# Copy the manifest only to read the version. Installing it in place fails: it depends on
# workspace:* and npm would try to install the whole server package. The version there is exact
# (the same one pnpm-lock.yaml resolves), so this stage cannot drift to a newer release.
COPY apps/server/package.json /tmp/server-package.json
RUN v="$(node -p "require('/tmp/server-package.json').dependencies['better-sqlite3']")" \
  && case "$v" in [0-9]*.[0-9]*.[0-9]*) ;; *) echo "better-sqlite3 must be pinned exactly in apps/server/package.json (got $v)"; exit 1 ;; esac \
  && npm install --omit=dev --no-audit --no-fund "better-sqlite3@$v" \
  && node -e "const D=require('better-sqlite3'); const db=new D('/tmp/t.sqlite'); db.pragma('journal_mode=WAL'); if (db.pragma('journal_mode',{simple:true})!=='wal') { console.error('journal', db.pragma('journal_mode',{simple:true})); process.exit(1); } console.log('better-sqlite3', db.prepare('select sqlite_version() v').get().v);"

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CLIENT_DIST=/app/public \
    TB_JEV_MODEL_DIR=/app/models/jev-tox-small \
    NODE_OPTIONS=--enable-source-maps
# The server is bundled by esbuild (ws included). ONNX Runtime and better-sqlite3 stay native.
COPY --from=ort /ort/node_modules ./node_modules
COPY --from=sqlite /sqlite/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=model /models ./models
COPY --from=build /app/apps/server/dist/index.js ./server.js
# server.js ends with `sourceMappingURL=index.js.map`; stack traces then name the .ts file and line.
COPY --from=build /app/apps/server/dist/index.js.map ./index.js.map
COPY --from=build /app/apps/client/dist ./public
# Run as the image's `node` user (uid 1000). The Fly volume is mounted over /data as root, so the entrypoint
# starts as root, applies a pending restore.sqlite, hands /data to node, then drops privileges and execs the
# server (still PID 1, so SIGTERM reaches it). scripts/docker-entrypoint.sh
COPY scripts/docker-entrypoint.sh /usr/local/bin/tb-entrypoint
RUN chmod 755 /usr/local/bin/tb-entrypoint && mkdir -p /data && chown node:node /data && command -v setpriv
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/tb-entrypoint"]
CMD ["node", "server.js"]
# fly launch --no-deploy --copy-config  (then)  fly volumes create tudobem_data --size 1  &&  fly deploy
