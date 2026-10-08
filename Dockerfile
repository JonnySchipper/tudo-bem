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

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CLIENT_DIST=/app/public \
    TB_JEV_MODEL_DIR=/app/models/jev-tox-small
# The server is bundled by esbuild (ws included); only ONNX Runtime's native addon stays in node_modules.
COPY --from=ort /ort/node_modules ./node_modules
COPY --from=model /models ./models
COPY --from=build /app/apps/server/dist/index.js ./server.js
COPY --from=build /app/apps/client/dist ./public
RUN mkdir -p /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
# fly launch --no-deploy --copy-config  (then)  fly volumes create tudobem_data --size 1  &&  fly deploy
