# Tudo Bem

Tudo Bem is a Brazilian Portuguese learning virtual world (Vila Ipê). It is a pnpm monorepo: `packages/shared` (rules and content), `apps/server` (authoritative Node world), and `apps/client` (Vite + Phaser).

## Test and build

Node 22 and pnpm 10 (see `packageManager` in the root `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

## Rules

- Open a pull request. Never push to `main`.
- Never deploy. Do not run the Fly or Pages workflows, and do not publish packages.
- Keep the beta free. No real-money gates, purchases, or selling in-game RV for real money.
- New spoken dialogue needs `pnpm tts`. See [docs/VOICES.md](docs/VOICES.md).
