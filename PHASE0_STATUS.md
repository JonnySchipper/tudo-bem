# Phase 0 status — Tudo Bem vertical slice

Target: `TudoBem-Phase0-MVP.md` (success criteria 1–4) and GDD v1.0 §14.1.

**Verdict: the slice is playable end-to-end.** `pnpm e2e` signs up with email + password (optional 18+ tick, no birth date), checks the session survives a reload and that logout → wrong password → login works, then drives a fresh adult user through every success-criteria step in headless Chrome, plus a second player for chat, gloss, friends, and a kitnet visit. It passes against the production build, the Vite dev server, and a public tunnel URL.

## Live URL

- **Right now:** https://peace-spent-episode-festival.trycloudflare.com — full multiplayer build served from the build agent's VM through a Cloudflare quick tunnel. **Temporary**: it stops when that VM shuts down.
- **Permanent:** needs one action from Jonny. The agent had no hosting credentials, and GitHub refuses to let Actions enable Pages on this private repo ("Resource not accessible by integration"). Everything else is automated; pick one:
  1. Add repo secret **`FLY_API_TOKEN`** → `deploy-fly.yml` deploys multiplayer to **https://tudo-bem.fly.dev** on the next push to `main`.
  2. Render → New → Blueprint → this repo (`render.yaml`).
  3. Settings → Pages → Source: GitHub Actions (needs Pro/Team for a private repo) → `pages.yml` deploys the **solo** build to **https://jonnyschipper.github.io/tudo-bem/**.
- **Solo build:** the authoritative `World` runs in the browser, so the whole play path works from any static host. The solo e2e passes against it under `/tudo-bem/`, including on GitHub Actions.

## Character redesign v1 (2026-09-26)

TB Art **character redesign v1**, with the Art hard overrides binding. The rooms are unchanged.

**Renderer:**
- A rigged paper-doll at about 6.3 heads, with form-shaded cloth and 2–3 value bands.
- A soft warm-ink edge, and faces with iris + lid eyes and soft noses.
- The layer order skin → clothes → hair → face → hat.
- A straight-on front view in the creator.

**Content:**
- 9 hair silhouettes and 4 starter presets, including Blusa + calça.
- All 12 hats rebaked on the new skull.

**NPC locks:** Carlos in a white apron over a warm shirt, Júlia in a blouse with jeans, and Nanda in a mustard top with jeans and her own straw hat.

**CPUs:** the named five are authored, and tests enforce ≥3 read differences between any two neighbors.

The Phase 0 loop is unchanged, and both e2e runs pass. Shots are in [`docs/art/characters-v1/`](docs/art/characters-v1/README.md).

## Art polish v2 (2026-09-26)

TB Art **polish brief v2**: all five levers, applied inside Praça, Padaria, Kitnet, the paper-doll, hats, Verde plates and the UI. No new rooms, no deploy changes. Details and before/after screenshots at 1280 are in [`docs/art/README.md`](docs/art/README.md#polish-v2-tb-art-brief-v2-2026-09-26) and `docs/art/polish-v2/`.

- **Depth:** soft warm-ink contact shadows everywhere, floor and wall AO, and a hazy far skyline.
- **Lighting:** Praça late-afternoon key from the upper-left with lamp pools. Padaria warm morning with a window sun patch, glass specular and a toldo stripe shadow on the counter. Kitnet daylight with the window as the brightest plane and a vignette into the corners.
- **Materials:** petit-pavé calçada with the SP map set in as mosaic, grass curbs, wood grain, ladrilho wear, plaster mottling, metal highlights, and an ipê canopy made of leaf clusters.
- **Praça density:** café table, newspaper stack, trash bag, planters, filled bike rack, pigeon flocks and metrô posters, all off the CPU lanes and interact tiles. The hero ipê moved to (4,7) and Júlia to (8,4) so the kiosk is never covered.
- **Avatar + UI:** slightly taller avatars with a hat halo, solid sp-green / terracotta plates, cream chrome with a 1px ink edge, a terracotta CTA, and a chat bar that sits on a wood edge like a counter.
- **Missão do dia:** the kiosk totem and panel carry the Curriculum-locked copy (**Missão do dia** · **Pegar missão** · **Cumprimenta · Pede · Monta** · **Missão completa! +25 RV**) with an icon row and a +25 RV badge. It works in the solo Pages build, and e2e asserts the strings on both builds.
- `node scripts/shots.mjs` regenerates the review screenshots from a served solo build.

## Phase 0 polish (2026-09-25, second pass)

Landed on top of the vertical slice. No deploy changes; the permanent URL still needs the one-time action above.

- **Curriculum fold.** The six former engineering-seed cards (*pão de queijo, misto-quente, guaraná, pois não, tá na mão, por conta da casa*) now come from `lexemes-padaria-a1.md` with the glosses Curriculum locked in `reviews/ENG-SEED-REVIEW-2026-09-25.md`. They're `needs_br` like every other card, and nothing is flagged `needs_curriculum_and_br` any more. Tray tickets use Curriculum's EN (“I’ll take…”, not “Give me…”). `pnpm content` now also generates `me-ve-um-orders.json`, parsing each PT ticket into tray lines + modifiers from card forms. Carlos chips, the phrasebook, the ticket-rail label and generated combo tickets were moved off “Give me” too, and a test stops it coming back.
- **Praça ambiance (Live Ops).** Scripted CPUs keep the square alive: 5 with one player, thinning to 4 / 3 / 2 / 1 / 0 as players arrive (Live Ops §1 table). About 60% sit on benches; the rest walk edge → Padaria door → bench. They are **outside the 16-seat cap** (not instance members), use **Verde plates** and **first names from the 48-name Curriculum allowlist** (`cpu-name-allowlist.md` → `cpu-names.json`, still needs BR sign-off), **never chat**, and never enter the Padaria or a Kitnet. They wave when a player walks up, the nearest one waves back when a player says *Oi!*, and a CPU gets up when a player heads for its bench. Clicks always go to the bench/prop/door underneath, never to a CPU. The header shows players only (`2/16 aqui · 4 vizinhos`). Toggle: `LIVEOPS_CPU_AMBIANCE=on|off` (default on); `?cpu=off` in solo builds.
- **Daily kiosk.** The quest kiosk opens *Missão do dia* Set A with Curriculum's informal verbs: **Cumprimenta** alguém na praça (wave or say *oi/olá* with a player or CPU around) → **Pede** o café da manhã com o Seu Carlos → **Monta** um pedido em Me vê um… (one correct tray). Taking the mission is required. It pays **+25 RV once per server day** and a top-bar pill tracks progress.
- **Art deltas** (rebaked with `pnpm art`). Padaria and Kitnet walls are palette cream `#F5E6D3` with terracotta / wood-warm trim; the padaria's pale-blue azulejo band is a glazed terracotta wainscot. The palm is gone: three ipês, with the centre one at hero scale. The Kitnet window is a painted **daylight street** under a new neutral `dia` lighting (it was a night skyline). The calçada floor and `pattern_calcada` use the **São Paulo state-map mosaic** instead of the Copacabana wave. Avatars have a smaller head and longer body; brimmed hats keep their size as the silhouette hero, and snug caps hug the head. Two extra Praça benches (6 total) give players and CPUs room to share.
- **Hand-painted overrides are protected.** `pnpm art` copies anything in `apps/client/art-overrides/<key>.png` (optional `<key>.json` framing) over the generated sprite and flags it in the manifest; a test fails if one gets clobbered. The folder is empty today. Before this, the bake overwrote hand-painted files in `public/art`.

**Smoke the ambiance locally:** `pnpm build && pnpm start`, open http://localhost:8787 and create an avatar. You land with 5 neighbors (`1/16 aqui · 5 vizinhos`). Press **Oi!** near one and it waves back. Click a bench a CPU is sitting on and it gets up for you. Open a second window and the crowd thins to 4. `curl localhost:8787/healthz` shows `ambiance` counts per instance. Run the server with `LIVEOPS_CPU_AMBIANCE=off` for an empty Praça. For the kiosk, click the terracotta *Missão do dia* kiosk at the back-left of the Praça → *Pegar missão*.

## Safety v0.1 fold (2026-09-26)

**TB Safety v0.1** (`/workspace/tb-safety/phase0/`) is folded into `content/safety/phase0/`. Every v0.1 JSON pack was converted from its `entries` into the engineering ingest shape the game already reads (`_meta` / `rules` / `terms` / `patterns`), and every phase0 JSON is `_meta.status: safety-v0.1`. The chat filter, stub Jev, PII check and CI fixtures read those files. The four engineering overlays stay, with their `TODO(T&S)` notes cleared. No `engineering-draft` / `TODO(T&S)` markers remain, and a test keeps them out. The v0.1 markdown (README, constitution, CEO locks, ops, under-13 notes) is used as-is. The age gate is still **18+ only**; the under-13 notes are design-only and nothing reads them.

A verbatim copy of the v0.1 JSON is in `content/safety/source-v0.1/` (the game doesn't read it). `safety.test.ts` checks the conversion against it: every v0.1 term sits in a rule with the same action, every allowlist term / rewrite hint / explicitly allowed drink is kept, every PII fixture keeps its examples, and every labeled Jev example is a fixture with the same labels.

**What replaced what**

| Engineering draft (PR #2) | Now (`_meta.status: safety-v0.1`) |
| --- | --- |
| `en-pt-slurs.json` (draft term lists) | v0.1 entries grouped into `ethnic_insult` (*macaco/japa/portuga* + variants), `slurs`, `profanity` (*cu* whole word), plus `slurs_extra` / `profanity_extra` kept from the draft and marked `source: eng`. `preto` moved to `ethnic-tokens`. |
| `dating-flirting.json` | v0.1 entries grouped by category × action: `body_comment`, `sexual`, `dating`, `off_platform_adjacent` (block); `sensual_warn`, `dating_warn`, `high_fp_body_words` (*gostoso/gostosa*), `high_fp_pelada` (warn). The v0.1 `block_if: flirt_or_body_directed` becomes the `flirt_body_directed` (dating) and `body_directed_sexual` pattern rules. |
| `prohibited-substance.json` | v0.1 `alcohol` (incl. drunkenness) and `drinking_venue` block; `bar_venue` warn with place-name allow contexts; draft extras and drugs as `source: eng`. v0.1 `rewrite_hints` (NPC/store only) and `explicitly_allowed` carried over. |
| `allowlist-pt-slang.json` | All v0.1 terms (with their reasons in `term_notes`) plus the draft's guard terms and sentences. |
| `ethnic-tokens.json` (overlay) | Kept. `preto_context` = v0.1 `preto` (escalate, color/food senses) + CEO-LOCKS §1 contexts. |
| `politics-religion.json`, `scam-rmt.json`, `harassment-selfharm.json` (overlays) | Kept, TODOs cleared, each rule tied to a constitution section or v0.1 example. `mild_insult` now **blocks** per v0.1 pc05. |
| `pii/regex-fixtures.json` (11 draft patterns) | 14 v0.1 fixtures converted to `patterns` (reviewer notes moved out of `noMatch` into `notes`), plus 7 eng patterns (links, other platform names, contact asks, full-name bait, school/home phrases, other-country phone runs). |
| `jev/public-chat-pack.json` (43 draft fixtures) | 20 v0.1 labeled examples (`source: v0.1`, all five typed answers checked, toxicity ±0.15) + 81 eng regression fixtures (CEO-lock edges, e2e lines, false-block guards). |
| `jev/npc-reply-pack.json` | `fixtures` (the node-based Carlos accept-list cases the game already tested) kept; the 12 v0.1 examples added as `jev_fixtures`, answered by a new `jevNpcReply()`. Typed Carlos replies log these answers on the `GradedAct`. |
| `ops/…`, `under13/…` placeholder notes | v0.1 docs. Queue rows now carry the ops fields: `surface`, `labels`, `rules`, `toxicity`, `status: pending` for escalations and reports. |

**CEO locks kept, all in CI:** *macaco/japa/portuga* block; *preto/preta* escalate unless color/food; *cu* exact whole word; *gostoso/gostosa/pelada/bar* warn, with person-directed forms (and non-place *bar*) handled as before; `rewrite_not_used`, so player chat is never rewritten. Alcohol and politics block per the constitution.

**Behavior changes from v0.1 (intended)**
- Mild insults (*idiota*, *burro*, *cala a boca*) now **block** (they used to warn), per v0.1 pc05.
- *kiss me* / *me beija* now **warn** (they used to block); *te amo* / *I love you* warn.
- Street names in free chat block as PII (`address_hint_br`), e.g. *a rua dos ipês é linda*; v0.1 accepts this FP outside a lesson channel. Same for *escola* + a name.
- *vinho* blocks everywhere, so *camiseta vinho* (wine-colored) is an accepted false positive.
- A bare `@handle` without a contact verb is allowed, per v0.1's note that bare handles are softer.

**One divergence from v0.1 labels:** pc18 (*vote no candidato X 2026*) is labeled `escalate`; the engine **blocks** it, per the constitution matrix and the CEO direction. The fixture keeps the v0.1 value under `canon`, and CI allows no other divergence.

**For T&S (next pack):** add a politics and a self-harm `content_class` (both answer `insult` for now). Two PII patterns fail their own examples as written: `social_handle_at` (PCRE `(?i)`, no word boundary, so it fires inside *obrigado*) and `school_name_hint` (misses "Lincoln High School"). The converted `patterns` use hardened versions and keep `canon_regex` + `hardening`. Some `examples_nomatch` entries are notes rather than samples. `regex-fixtures.json` and the under-13 notes still say "13+".

**Kitnet art (TB Art review-pr3).** The room already had palette-cream walls and the painted daylight-street window, and a fresh `pnpm art` bake leaves the kitnet sprites unchanged. The last teal/night-blue kitnet surface was the **Mapa** fast-travel card. It is now cream with a daylight-sky fade and dark text.

## Content ingest (2026-09-25)

**Curriculum Phase 0** → `content/curriculum/phase0/`. The markdown is canonical; `cards.json` (58 cards) is generated by `pnpm content` and CI checks the sync.

- Carlos is wired to the voice sheet + CEO lock (above).
- Me vê um… tickets come from `me-ve-um-orders.md`, and the pack's modifiers are playable.
- Accept-list rules are in code (`packages/shared/src/accept.ts`) and tested against typed replies to every Carlos node (`curriculum.test.ts`).
- A CI scan checks that nothing on the do-not-teach list appears in any authored PT surface.
- **Needs BR sign-off:** every card (`signoff: needs_br`): all 28 padaria cards (including the six reviewed by Curriculum on 2026-09-25) and 30 greetings/numbers cards, the 14 tray tickets and their EN glosses, the Carlos lines, the voice sheet, and the 48 ambiance CPU names.
- **Needs Curriculum + BR:** nothing. The former engineering seeds are folded (see *Phase 0 polish* above).

**Safety Phase 0** → `content/safety/phase0/`. The first handoff had only the constitution, README and CEO locks; engineering drafted the rest. The drafts were replaced by TB Safety v0.1 on 2026-09-26 (see *Safety v0.1 fold* above).

## What works

| Area | Status |
| --- | --- |
| Age gate | **Adults only (18+)** in intent, per CEO decision. **No birth-date step** (removed 27 Sep 2026). The only age prompt is an optional “Tenho 18 anos ou mais” tick on the Create account form, recorded as `confirmed18At` when ticked. The avatar creator asks nothing. No date of birth is collected or stored. Pre-policy profiles must sign up again. No COPPA, parental-consent, or kid UI is built. See `docs/AGE_POLICY.md`. |
| Accounts | **Email + password** required for multiplayer (`/api/auth/register · login · logout · me`). scrypt-hashed passwords, `HttpOnly; SameSite=Lax` session cookie (`Secure` over HTTPS) stored hashed in `DATA_DIR/accounts.json`, 30-day sliding expiry, per-email/IP rate limits, same-origin checks on auth POSTs and `/ws`. A pre-accounts browser links its old avatar on first signup. Solo mode stays guest-only. |
| Idle kick | Server-authoritative: no real input for **15 min** → warning at 14 min, then kicked (WS close 4001) and the seat is freed. Pings, reconnect hellos and client timers don't count as activity. The client shows *Até já!* with **Voltar pra Praça**. `IDLE_KICK_SECONDS` to tune. |
| Avatar create | Starter look preset (4), body type (3), skin (8), face (4), detail (6: glasses, beard, mustache, earrings, freckles), hair style (9) + color (8), top (5) + color (13), bottoms (3) + color, sneakers (5); addressed as *ele / ela / nome*. Name filtered (no PII, no long numbers, constitution). |
| Praça ambiance | Scripted Verde-plate CPUs (allowlisted first names) outside the 16 cap: sit, stroll to the Padaria door, wave. No chat, never in Padaria/Kitnet, yield benches to players. `LIVEOPS_CPU_AMBIANCE`. |
| Daily kiosk | *Missão do dia* Set A: Cumprimenta / Pede / Monta → +25 RV once a day. |
| Rooms | **Praça Central** (spawn), **Padaria do Seu Carlos**, **Kitnet** (private per owner). Walk (A*, 8-dir), sit on benches/stools/chairs/placed furniture, doors between rooms, free fast travel via **Mapa**. |
| Instances | Authoritative server, cap **16** per instance (`ROOM_CAP` to soft-cap). Overflow opens *Praça Central · Sul / · Leste / …*; empty overflow instances are dropped. Kitnets: owner + friends, cap 16. Second login kicks the older tab. |
| Emotes & bubbles | Oi (wave), Valeu, Kkkk, Dançar, Desculpa. Speech bubbles stack over heads; readable **Verde nameplates** (seedling icon + color) and orange NPC plates. |
| Chat safety | Jev stub on client **and** server, reading **TB Safety v0.1** from `content/safety/phase0` (converted to the engineering `rules` / `patterns` shape, `_meta.status: safety-v0.1`). Stack: PII regex fixtures → stub-Jev overlays (harassment, politics, scam) → EN/PT blocklists (slang allowlist consulted first) → escalate queue. Typed answers for the public-chat and NPC-reply question packs (GDD §12.4). Actions **allow / warn / block / escalate** only; player chat is **never rewritten or masked** (CEO lock §3). CEO locks: *macaco/japa/portuga* block; *preto/preta* escalate unless color/food context; *cu* exact block; *gostoso/gostosa/pelada* warn → block if flirt/body-directed; *bar* warn unless clear place-name. Alcohol and politics **block** per the constitution matrix. Warned messages are delivered verbatim and logged. Every v0.1 Jev example, PII example and the PT-slang false-block KPI (0%) run in CI. Rate limit 5/10 s. Blocks, warns, escalations and reports → `data/moderation.jsonl` with surface, labels, rule ids, toxicity and `status: pending` for human review. |
| English gloss | Every Portuguese chat line gets an EN gloss under the bubble for Verde viewers (phrasebook + patterns + lexicon, case-preserving; English lines are not glossed). NPC lines are authored bilingual. |
| Seu Carlos scene | Authored graph per `voice-seu-carlos.md` + CEO lock (13 nodes, 5 turns on the happy path). **Pois não** is the primary ack and “Pode falar” is never used. *Meu filho / minha filha* appears **at most once per scene** and only for ele/ela (CI checks every path for all three pronouns). Verde lines ≤ 18 words. Beats: hesitant “Ainda tô olhando” → “Sem pressa…”, drink/food, **pra comer aqui / pra viagem**, “por conta da casa”, “Tá na mão. Volte sempre!”. Reply by **chips or typing**: typed replies go through chat safety, then accept-list rules (accents optional, obrigado≡obrigada, *me dá/quero* → 2, bare order → 1, English → Carlos rephrases). Score 0–3 → 6–14 RV with daily decay. Browser TTS. |
| Me vê um… | Shelf = 12 curriculum pack items (pão, pão na chapa, pastel, coxinha, bolo, café, café com leite, suco de laranja, água, pão de queijo, misto-quente, guaraná). Rounds 1–2 serve the pack’s Verde tickets and rounds 3–4 the level-bump tickets, **verbatim from `me-ve-um-orders.md`** with no repeats. Rounds 5–6 generate combos with PT number/gender agreement. **Modifiers** *pra viagem, pra comer aqui, sem açúcar, bem quente* are toggles checked by the server. Timer, Carlos repeats once, combos, 8–20 RV, keyboard play. |
| RV economy | Start 10 RV; scene + minigame + tutorial bonus 25 RV. One honest session buys a mid-price hat *and* a chair (≈45–60 RV). |
| Hat shop | Nanda’s stall: 12 hats (2 free, 8–60 RV), try-on preview, buy = equip, wardrobe in the top bar. |
| Kitnet | Painted-street window, bed, kitchenette. Free starter chair; **Decorar** mode: place / move / rotate (R) / pick up; **Atelier** catalog with 12 items (rug, radio with notes, fan, sleeping cat, lamp…). Friends can visit. |
| Parrot | Optional companion adopted at the Praça perch; rides your shoulder; **Dica do papagaio** whispers a scheduled study card (PT + gloss, TTS) on a 45 s cooldown. Not a translator. |
| Friends stub | Request from a profile card or the Amigos panel, accept/decline, online status + current room, **Ir até** (hop into their instance if there’s a seat), **Visitar kitnet**, remove. |
| Onboarding | *Primeiros passos* checklist (walk, sit, wave, chat, Carlos, minigame, hat, chair), guide arrows over the next objective, Júlia the scripted guide NPC. |
| AI seams | `ChatSafetyService`, `GlossService`, `NpcDialogueService`, `StudentModelService`, `ModerationQueue` interfaces with Phase 0 stubs; `GradedAct` logging per GDD §12.5; item-bank `Card` schema per §5.5. |
| Art | **Generated in-repo by the build agent** (procedural canvas + SVG), baked by `pnpm art` into 68 runtime sprites + 15 UI SVGs + manifest, with review contact sheets in `docs/art` and a live gallery at `/art.html`. New authentic pieces: ladrilho hidráulico padaria floor, taco kitnet floor, cobogó, orelhão, blue street sign, salgados estufa, padaria TV, Copan-style tower, hammock, filtro de barro, outlined avatars, generated icon set / RV coin / logo / azulejo + calçada patterns. Canvas 2.5D isometric: São Paulo state-map calçada, ipê amarelo trees (hero ipê in the centre), SAMPA and “TUDO BEM?” murals, padaria facade with striped awning, Edifício Ipê, closed Metrô entrance, newsstand, orange *lixeira*, bike rack, pigeons, skyline; padaria terracotta tile wainscot on cream walls, bread shelves, chalkboard menu, morning light beams; cream-walled kitnet in daylight with a painted street window. Hand-painted overrides live in `apps/client/art-overrides/` (bake-protected). |
| Tooling | pnpm TS monorepo, `pnpm dev` one command, **245 vitest tests**, typecheck, esbuild single-file server, `pnpm art`, `pnpm content`, Dockerfile, `fly.toml`, `render.yaml`. GitHub Actions: CI with browser e2e, `pages.yml` (solo build + solo e2e + Pages deploy), `deploy-fly.yml` (auto-deploy when `FLY_API_TOKEN` is set). |

## Known gaps (honest list)

- **No permanent public deploy yet.** It needs the one-time action above (Fly token, Render blueprint, or enabling Pages). Until then the tunnel URL is temporary.
- **Age assurance is self-declared** (an optional 18+ checkbox at signup), with no ID or age-estimation check. That fits an internal adult preview; revisit before a public launch.
- **Persistence** is a JSON file; fine for internal testers, not for concurrency or scale. Accounts (email + password) live in `accounts.json` on the same volume. There's no email verification or password reset yet (Phase 1: needs an email provider). Solo mode is still a guest token in `localStorage`.
- **Safety is a stub**, not Jev. Blocklists and regex miss creative obfuscation (e.g. `f*ck`, spaced letters). Context comes only from the named conditions (*preto* color/food, *bar* place-names, flirt/body-directed patterns). There's no human review UI for the queue, no report-reason picker (v0.1 ops lists a minimum set), and no mute/kick/ban tools yet. Carlos doesn't yet use the substance pack's `rewrite_hints` to offer guaraná when a typed order is blocked.
- **Accepted false positives:** the animal *macaco* blocks. Food compliments (*coxinha gostosa*) and pickup football (*pelada*) get a warn note, though they're delivered verbatim. From v0.1: street names and *escola* + name block as PII in free chat, and *vinho* as a color blocks.
- **Gloss is a phrasebook**, so it’s literal or partial on free-form sentences (unknown words pass through untranslated).
- **Minigame is solo.** No CPU/human seats sharing a counter yet; no per-day minigame cap.
- **Praça ambiance is scripted scenery.** CPUs don't path around each other or players, have no idle animations beyond sit/walk/wave, and only live in the Praça. Only kiosk **Set A** is built (Live Ops sets B/C rotation isn't), and the Live Ops five-chip host tutorial isn't wired into Júlia yet (she still does the Q&A chips). Memory tiles aren't built.
- **Friends:** no private messages; requests are in-memory (lost on server restart); no “hide my instance”; no party system.
- **Kitnet:** owner can’t boot guests or set room name / Português-only mode; one theme, 8×8 floor.
- **Placement test, student-model persistence, spaced repetition, Amarelo+ plates, translation economy:** not in Phase 0 (everyone is Verde).
- **Audio** uses the browser’s speech synthesis (voice quality varies; some Linux browsers have no pt-BR voice). No music or ambient beds.
- **Accessibility:** keyboard play for chips/minigame and colorblind-safe plates (icon + color), but no font-scale setting, no screen-reader pass on the canvas, no touch/mobile layout.
- **Art review pending:** TB Art hasn’t signed off the second pass yet (see `docs/art`). Floors, walls, trees and avatars are drawn live in code, so they can't be replaced through `art-overrides/`; only static sprites and UI SVGs can.
- **Rendering:** Canvas 2D with procedural art baked to sprites for static pieces (animated pieces, floors, walls and avatars still draw live); 2 facing directions mirrored; long multi-tile props are sliced for depth sorting, but occlusion edge cases exist.
- **Currency naming:** Carlos quotes prices in *reais* for teaching, but the scene is on the house; RV = Reais Virtuais is the only wallet.

## Phase 1 tickets (closed alpha, GDD §14.2)

**Platform / backend**
1. Postgres (profiles, inventory, apartments, friendships, graded acts) behind the existing `ProfileStore` surface; migrations.
2. Real accounts: email magic link, session tokens, device list; keep the **18+** gate (adult product). Younger audiences are a separate, later rollout after thorough testing — not a Phase 1 ticket.
3. Horizontal instances: room shards across processes (Redis pub/sub or a room router), friend hop across shards, VMK-style queue pass for full rooms.
4. Moderation tools: staff console for the queue, mute / kick / temp-ban / permaban, owner boot in kitnets, per-user rate limits, report reasons.
5. Telemetry: GDD §15 metrics (D1/D7, session length, % sessions with another human, % with a graded act, RV source/sink).

**AI platform**
6. Jev gateway: typed question packs for chat safety (§12.4) with EN+PT labeled fixtures; swap `JevStubSafety`; keep the stub as the fallback path.
7. Student model v0: per-card stats persisted, simple half-life SRS, `scheduled()` driving parrot hints, minigame order selection, and NPC target cards.
8. Placement test (4–6 min adaptive) → seeds the student model and nameplate; **Verde + Amarelo** plates (Amarelo: gloss on new words only).
9. Generative Carlos + Dona Lurdes behind `NpcDialogueService`: word caps by plate, must-include cards, constitution check via Jev before display, authored chips as fallback; free-text replies scored 0–3 by Jev.
10. Better gloss: translation service (cached, Jev-gated) replacing the phrasebook; tap-to-reveal word glosses for Amarelo.

**Content / curriculum**
11. Feira room + *Balança e pechincha* minigame (numbers to 100, kilos, colors, bargaining); Dona Lurdes voice sheet.
12. Metrô room + *Linha certa* minigame (line colors, *sentido*, *próxima estação*); Rafa voice sheet.
13. A1 decks: padaria + feira + greetings + numbers (≈300 cards) with human Brazilian review; accept-lists (accent-flexible, *obrigado/obrigada*); do-not-teach list.
14. Prebaked pt-BR TTS for authored lines (two voices) replacing browser speech synthesis.

**Client / world**
15. Apartment furniture set v1 (30+ items), wall items, second room theme (subscription later), room name + Português-only toggle, hallway listing board.
16. Parrot v0 proper: skins (cosmetic), hop animation set, hint driven by the student model.
17. Multiplayer Me vê um… (2–4 seats + CPU fill), kiosk sets B/C rotation + Lanchonete suco quest once that room exists, Live Ops host tutorial chips for Júlia, first-visit pins.
18. Private friend messages (filtered), parties (≤6) with sticky instances, “hide my instance”.
19. Art pass after TB Art review of `docs/art`: texture atlas packing, 4-direction avatars, eat/sit/dance polish, day/evening lighting per room; font-scale setting; mobile/touch layout.
20. Load test: 16 avatars/instance at 60 fps idle on a mid laptop; server soak with bots.
