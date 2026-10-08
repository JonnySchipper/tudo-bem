# Tudo Bem — single container: Node room server + static client + the Jev chat-safety model.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
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
FROM node:22-bookworm-slim AS ort
WORKDIR /ort
RUN echo '{"private":true}' > package.json \
  && ONNXRUNTIME_NODE_INSTALL=skip npm install --omit=dev --no-audit --no-fund onnxruntime-node@1.30.0 \
  && cd node_modules/onnxruntime-node/bin/napi-v6 \
  && find . -mindepth 2 -maxdepth 2 -type d ! -path ./linux/x64 -exec rm -rf {} + \
  && rm -f linux/x64/libonnxruntime_providers_*

# better-sqlite3 ships a glibc prebuild (prebuilds/linux-x64.node). Install it on bookworm so the
# runtime image does not pick up the musl binary from the Alpine build stage. If a future release
# drops that prebuild, node-gyp needs python3, make, and g++ in this stage.
FROM node:22-bookworm-slim AS sqlite
WORKDIR /sqlite
COPY apps/server/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund \
    "better-sqlite3@$(node -p "require('./package.json').dependencies['better-sqlite3']")" \
  && node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); db.pragma('journal_mode=WAL'); if (db.pragma('journal_mode',{simple:true})!=='wal') process.exit(1); console.log('better-sqlite3', db.prepare('select sqlite_version() v').get().v);"

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CLIENT_DIST=/app/public \
    TB_JEV_MODEL_DIR=/app/models/jev-tox-small
# The server is bundled by esbuild (ws included). ONNX Runtime and better-sqlite3 stay native.
COPY --from=ort /ort/node_modules ./node_modules
COPY --from=sqlite /sqlite/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=model /models ./models
COPY --from=build /app/apps/server/dist/index.js ./server.js
COPY --from=build /app/apps/client/dist ./public
RUN mkdir -p /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
# fly launch --no-deploy --copy-config  (then)  fly volumes create tudobem_data --size 1  &&  fly deploy
