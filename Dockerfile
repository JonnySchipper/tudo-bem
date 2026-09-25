# Tudo Bem — single container: Node room server + static client.
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

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CLIENT_DIST=/app/public
# The server is bundled by esbuild (ws included), so no node_modules are needed at runtime.
COPY --from=build /app/apps/server/dist/index.js ./server.js
COPY --from=build /app/apps/client/dist ./public
RUN mkdir -p /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8787/healthz || exit 1
CMD ["node", "server.js"]
