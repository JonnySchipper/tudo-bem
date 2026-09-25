# Phase 0 status — Tudo Bem vertical slice

Target: `TudoBem-Phase0-MVP.md` (success criteria 1–4) and GDD v1.0 §14.1.

**Verdict: the slice is playable end-to-end.** `pnpm e2e` checks that an under-18 birth date is turned away, then drives a fresh adult user through every success-criteria step in headless Chrome, plus a second player for chat, gloss, friends, and a kitnet visit. It passes against the production build, the Vite dev server, and a public tunnel URL.

## What works

| Area | Status |
| --- | --- |
| Age gate | **Adults only (18+)** per CEO decision. Birth month/year must compute to 18+, **and** the create-avatar screen requires ticking “Confirmo que tenho 18 anos ou mais” (`confirm18`). The server enforces both. Under-18 users get an adults-only screen (sticky on that browser). Birth date is **not stored** — only `ageGate18: true`. Pre-policy profiles must sign up again. No COPPA, parental-consent, or kid UI is built. See `docs/AGE_POLICY.md`. |
| Avatar create | Body type (3), skin (8), hair style (7) + color (8), top (4) + color (10), bottoms (3) + color, sneakers (5); addressed as *ele / ela / nome*. Name filtered (no PII, no long numbers, constitution). |
| Rooms | **Praça Central** (spawn), **Padaria do Seu Carlos**, **Kitnet** (private per owner). Walk (A*, 8-dir), sit on benches/stools/chairs/placed furniture, doors between rooms, free fast travel via **Mapa**. |
| Instances | Authoritative server, cap **16** per instance (`ROOM_CAP` to soft-cap). Overflow opens *Praça Central · Sul / · Leste / …*; empty overflow instances are dropped. Kitnets: owner + friends, cap 16. Second login kicks the older tab. |
| Emotes & bubbles | Oi (wave), Valeu, Kkkk, Dançar, Desculpa. Speech bubbles stack over heads; readable **Verde nameplates** (seedling icon + color) and orange NPC plates. |
| Chat safety | Jev-style stub on client **and** server: PII regex (phones, emails, links, @handles, street addresses, school, full names) → EN+PT blocklists (slurs, profanity, sexual, dating, scams, contact exchange) → **block**; alcohol / politics / platform names / mild insults → **warn** (masked `•••`, still delivered, note to sender); self-harm / “kys” → **escalate** (not delivered, supportive note incl. 988, moderation log). Allow-list guards normal slang. Rate limit 5/10 s. Report button → moderation queue (`data/moderation.jsonl`). |
| English gloss | Every Portuguese chat line gets an EN gloss under the bubble for Verde viewers (phrasebook + patterns + lexicon, case-preserving; English lines are not glossed). NPC lines are authored bilingual. |
| Seu Carlos scene | Authored, **chip-only** graph (11 nodes, 5 turns on the happy path, rephrase-slower nodes on weak answers), pronoun agreement (*meu filho / minha filha / name*, *bem-vindo/a*, *obrigado/a/valeu*), numbers in words, “por conta da casa”. Score 0–3 per chip → 6–14 RV, daily cap with decay (2 full clears, then half, then 0). Every choice is logged to the student-model stub. pt-BR TTS via the browser (🔊 Ouvir). |
| Me vê um… | 6 orders, escalating from 1 item to 3 lines with quantities and correct PT agreement (*duas coxinhas*, *três pães de queijo*, *mistos-quentes*). Timer per order, **Carlos repeats once** (slower TTS) on a miss or timeout, combo streaks, 8–20 RV. Server validates trays. Keyboard play (1–0/-, Enter). |
| RV economy | Start 10 RV; scene + minigame + tutorial bonus 25 RV. One honest session buys a mid-price hat *and* a chair (≈45–60 RV). |
| Hat shop | Nanda’s stall: 12 hats (2 free, 8–60 RV), try-on preview, buy = equip, wardrobe in the top bar. |
| Kitnet | Painted-street window, bed, kitchenette. Free starter chair; **Decorar** mode: place / move / rotate (R) / pick up; **Atelier** catalog with 12 items (rug, radio with notes, fan, sleeping cat, lamp…). Friends can visit. |
| Parrot | Optional companion adopted at the Praça perch; rides your shoulder; **Dica do papagaio** whispers a scheduled study card (PT + gloss, TTS) on a 45 s cooldown. Not a translator. |
| Friends stub | Request from a profile card or the Amigos panel, accept/decline, online status + current room, **Ir até** (hop into their instance if there’s a seat), **Visitar kitnet**, remove. |
| Onboarding | *Primeiros passos* checklist (walk, sit, wave, chat, Carlos, minigame, hat, chair), guide arrows over the next objective, Júlia the scripted guide NPC. |
| AI seams | `ChatSafetyService`, `GlossService`, `NpcDialogueService`, `StudentModelService`, `ModerationQueue` interfaces with Phase 0 stubs; `GradedAct` logging per GDD §12.5; item-bank `Card` schema per §5.5. |
| Art | **Generated in-repo by the build agent** (procedural canvas + SVG), baked by `pnpm art` into 68 runtime sprites + 15 UI SVGs + manifest, with review contact sheets in `docs/art` and a live gallery at `/art.html`. New authentic pieces: ladrilho hidráulico padaria floor, taco kitnet floor, cobogó, orelhão, blue street sign, salgados estufa, padaria TV, Copan-style tower, hammock, filtro de barro, outlined avatars, generated icon set / RV coin / logo / azulejo + calçada patterns. Canvas 2.5D isometric: São Paulo black-and-white wave calçada, ipê amarelo trees, SAMPA and “TUDO BEM?” murals, padaria facade with striped awning, Edifício Ipê, closed Metrô entrance, newsstand, orange *lixeira*, bike rack, pigeons, skyline; padaria azulejos, bread shelves, chalkboard menu, checkered floor, morning light beams; night kitnet. |
| Tooling | pnpm TS monorepo, `pnpm dev` one command, 63 vitest tests, typecheck, esbuild single-file server, Dockerfile, `fly.toml`, `render.yaml`, GitHub Actions CI incl. browser e2e. |

## Known gaps (honest list)

- **No permanent public deploy.** No hosting credentials were available to the build agent. The configs are ready (Fly / Render / Railway / Docker). A temporary `trycloudflare.com` tunnel was used for verification only.
- **Age assurance is self-declared** (birth date + 18+ checkbox), with no ID or age-estimation check. That fits an internal adult preview; revisit before a public launch.
- **Persistence** is a JSON file; fine for internal testers, not for concurrency or scale. Guest identity is a random token in `localStorage` (no accounts, email, or password; clearing storage loses the avatar).
- **Safety is a stub**, not Jev: blocklists and regex miss creative obfuscation (e.g. `f*ck`, spaced letters) and can’t judge context beyond a few rules. No human review UI for the queue; no mute/kick/ban tools yet.
- **Gloss is a phrasebook**, so it’s literal or partial on free-form sentences (unknown words pass through untranslated).
- **Minigame is solo.** No CPU/human seats sharing a counter yet; no per-day minigame cap.
- **Friends:** no private messages; requests are in-memory (lost on server restart); no “hide my instance”; no party system.
- **Kitnet:** owner can’t boot guests or set room name / Português-only mode; one theme, 8×8 floor.
- **Placement test, student-model persistence, spaced repetition, Amarelo+ plates, translation economy:** not in Phase 0 (everyone is Verde).
- **Audio** uses the browser’s speech synthesis (voice quality varies; some Linux browsers have no pt-BR voice). No music or ambient beds.
- **Accessibility:** keyboard play for chips/minigame and colorblind-safe plates (icon + color), but no font-scale setting, no screen-reader pass on the canvas, no touch/mobile layout.
- **Art review pending:** TB Art hasn’t reviewed the generated art yet (see `docs/art`). Hand-painted overrides currently get overwritten by `pnpm art`; they need a protected `overrides/` folder.
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
17. Multiplayer Me vê um… (2–4 seats + CPU fill), daily kiosk quests (*cumprimente 2 pessoas, peça um suco, jogue um jogo*), first-visit pins.
18. Private friend messages (filtered), parties (≤6) with sticky instances, “hide my instance”.
19. Art pass after TB Art review of `docs/art`: `overrides/` folder the bake never touches, texture atlas packing, 4-direction avatars, eat/sit/dance polish, day/evening lighting per room; font-scale setting; mobile/touch layout.
20. Load test: 16 avatars/instance at 60 fps idle on a mid laptop; server soak with bots.
