# Tudo Bem

Brazilian Portuguese learning social virtual world (VMK-inspired). Browser, desktop-first, modern 2.5D isometric.
**Friendly hangout first — learning is the weather.**

This repo contains the **Phase 0 vertical slice**: Praça Central → Padaria do Seu Carlos → your Kitnet, fully playable end-to-end.

| Praça Central (Verde gloss under PT bubbles) | Seu Carlos breakfast scene (chips only) |
| --- | --- |
| ![Praça](docs/screenshots/praca.png) | ![Padaria](docs/screenshots/padaria_carlos.png) |
| **“Me vê um…” tray minigame** | **Kitnet — place a chair, friend visits** |
| ![Me vê um](docs/screenshots/meveum.png) | ![Kitnet](docs/screenshots/kitnet.png) |

---

## Run it (one command)

Requires **Node ≥ 22.12** and **pnpm 10** (`corepack enable` gives you pnpm).

```bash
pnpm install
pnpm dev          # room server (:8787) + Vite client (:5173) with hot reload
```

Open **http://localhost:5173**. Open a second browser/incognito window to play with a “friend”.

Production build (single Node process serves the client and the WebSocket):

```bash
pnpm build && pnpm start      # → http://localhost:8787
```

Checks:

```bash
pnpm typecheck    # all packages
pnpm test         # vitest: safety filter, gloss, scene graph, minigame, rooms, world server
pnpm e2e          # headless-Chrome play-through of the whole Phase 0 path (needs `pnpm start` running)
pnpm verify       # typecheck + test + build
```

`pnpm e2e` env: `BASE_URL` (default `http://localhost:8787`), `CHROME_PATH`, `SHOTS_DIR` (save screenshots), `HEADED=1`.

## Play path (≈10 minutes)

1. **Age gate** — birth month + year; 13+ only for now (the date is not stored).
2. **Create your avatar** — body, skin, hair, free starter clothes, and how NPCs should address you (*ele / ela / só meu nome*).
3. **Praça Central** — click the floor to walk, click a bench to sit, press **Oi!** to wave, type in chat. Júlia (guide, by the quest kiosk) explains the basics. The *Primeiros passos* checklist tracks it all.
4. **Padaria do Seu Carlos** — walk through the door with the red awning. Click **Seu Carlos** for the authored breakfast scene: pick reply chips (keys 1–4). Good Portuguese earns more RV; English or vague answers make him rephrase slower. ~5 turns → **6–14 RV**.
5. **“Me vê um…”** — at the ticket rail on the counter. Read (or 🔊 listen to) each Portuguese order, click items onto the tray (keys 1–0/-), **Entregar** (Enter). Miss once and Carlos repeats slowly; combos pay extra. 6 orders → **8–20 RV**.
6. **Hat** — back in the Praça, visit **Nanda’s stall** (2 free hats, 10 more at 8–60 RV). Buying equips it; **Chapéus** in the top bar is your wardrobe.
7. **Kitnet** — door **Nº 42** (Edifício Ipê). Click **Decorar**, pick your free *cadeira de madeira*, click a tile. **R** rotates. The *Atelier* tab sells more furniture. Click the chair (outside edit mode) to sit.
8. Finish every step → **+25 RV** bonus. Optional: adopt the parrot at the perch (it whispers study words), add friends (click an avatar or **Amigos**), visit a friend’s kitnet.

## What’s in the box

```
packages/shared   Content + rules shared by client and server (pure TS, tested)
  rooms.ts          Praça / Padaria / Kitnet layouts, props, NPCs, portals, grid + furniture rules
  carlos.ts         Authored Seu Carlos scene graph (chips, scores, pronoun agreement, payouts)
  meveum.ts         “Me vê um…” order generator (PT number/gender agreement), tray check, payouts
  safety.ts         Jev-style chat filter stub: PII regex + EN/PT blocklists → allow / warn / block / escalate
  gloss.ts          Phrasebook gloss for Verde plates + EN/PT language detect
  cards.ts          Item-bank cards (GDD §5.5 schema), padaria + greetings deck
  catalog.ts        12 hats, 12 furniture items
  protocol.ts       Typed WebSocket messages
apps/server       Authoritative Node room server (ws). Client is a puppet.
  world.ts          Instances (cap 16, overflow → “· Sul”, “· Leste”…), movement, chat, scene, minigame,
                    shop, kitnet, friends, parrot, tutorial rewards
  services/         Interfaces + Phase 0 stubs for Jev safety, gloss, NPC dialogue, student model, moderation queue
  store.ts          JSON-file profile store (swap for Postgres)
apps/client       Vite + Canvas 2D isometric renderer, DOM UI
scripts/e2e.mjs   Playwright-core end-to-end play-through
```

### Design rules enforced in code

- **Brazilian Portuguese only** in world content; English appears only as glosses / UI subtitles.
- **Disney-safe constitution** — no alcohol, dating, sensuality, slurs, politics. Unit tests run every authored Carlos line, chip, generated order, hat and furniture name through the filter.
- **Chat safety** — the same filter runs client-side (instant feedback) and server-side (authoritative). PII, contact exchange, slurs, sexual content, dating, scams → **block**; alcohol / politics / platform names / mild insults → **warn** (masked `•••` and delivered); self-harm and “kys” → **escalate** (not delivered, supportive note, moderation log). Tuned against false blocks on normal slang (*tá, cara, legal, pelada, rola, vinho, lula*…). Rate limit 5 msgs / 10 s. Report button on profiles.
- **No pay-to-win** — RV is earned only from graded language acts (scene, minigame) and the tutorial; nameplates can’t be bought. Everyone is **Verde** in Phase 0.
- **No generative NPCs yet** — Carlos is an authored chip graph behind `NpcDialogueService`; an LLM provider can drop in later with the authored one as the Jev-down fallback.
- **13+ age gate** until a real parental-consent flow exists. Only “passed the gate” is stored.

## Configuration

| Env | Default | Meaning |
| --- | --- | --- |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | Server listen address |
| `DATA_DIR` | `./data` | Profiles (`profiles.json`) + moderation log (`moderation.jsonl`) |
| `ROOM_CAP` | `16` | Players per instance (lower it to demo overflow instances, e.g. `ROOM_CAP=2`) |
| `CLIENT_DIST` | auto | Built client directory served by the server |
| `VITE_WS_URL` | same origin `/ws` | Build-time override when the client is hosted separately |
| `TB_SERVER` | `http://localhost:8787` | Dev only: where Vite proxies `/ws` |

## Deploy

The production artifact is one process: `apps/server/dist/index.js` (esbuild bundle, `ws` included, no `node_modules` needed) serving `apps/client/dist` and `/ws`. Health check: `GET /healthz`.

- **Docker** — `docker build -t tudo-bem . && docker run -p 8787:8787 -v tb-data:/data tudo-bem`
- **Fly.io** — `fly launch --no-deploy --copy-config`, `fly volumes create tudobem_data --size 1`, `fly deploy` (config in `fly.toml`, region `gru`).
- **Render** — New → Blueprint → this repo (`render.yaml`, Docker runtime, WebSockets supported). Free plan disk is ephemeral — profiles reset on redeploy.
- **Railway** — New project → Deploy from repo; it picks up the `Dockerfile`. Add a volume at `/data`.
- **Vercel / static hosts** — can host only the client (`apps/client/dist`); build with `VITE_WS_URL=wss://your-server/ws` and run the server elsewhere (Vercel functions don’t hold WebSockets).
- **Instant preview from any machine** — `pnpm build && pnpm start`, then `cloudflared tunnel --url http://localhost:8787` prints a temporary public `https://*.trycloudflare.com` URL.

CI (`.github/workflows/ci.yml`) runs typecheck, unit tests, build, and the browser e2e on every PR.

See **[PHASE0_STATUS.md](PHASE0_STATUS.md)** for what works, known gaps, and Phase 1 tickets. The design source of truth is the GDD v1.0.
