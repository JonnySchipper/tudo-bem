# Simplification and progressive-disclosure review

**Date:** 2026-10-10 · **Commit reviewed:** `37a1d7cf1` (branch `main`) · **Trigger:** player feedback that the game is too complicated and too overwhelming in a lot of places.

This document is written to be executed by implementation agents. Every work item has: the problem, the evidence (file:line as of the commit above; re-grep before editing, lines drift), the change, acceptance criteria, and the tests or scripts that will need updating. Items are grouped into tiers and ordered by impact within each tier. A reader who only wants the conclusion should read sections 1 to 3.

---

## 1. Diagnosis in one page

**The last fix for "overwhelming" added explanation. This round must remove and defer.** On 2026-10-09 the same feedback was answered with 19 "How it works" cards, 3 HUD notes, a Vila guide card and a Júlia Q&A menu (`docs/lifesim/DECISIONS.md` "First-time help", #215). The next day, twelve-plus new systems shipped on top (feira cart games, pet shop, Praia with fishing and boats and a party boat, padaria ownership, Tatame v3, Diário sticker album, Achado!, recados overhaul, fly-in cutscene, arrivals-hall tutorial, bate-papos). The player's working memory has not grown with the feature list. More cards cannot fix that.

**What a brand-new player is asked to absorb**

| Measure | Count | Source |
|---|---|---|
| Screens, cards and modals before the first favor | ~25 | §4 onboarding review |
| Discrete taps or choices before the first favor | ~55-60 | §4 |
| Distinct named concepts before the first favor | ~75 (about 45 before reaching the Vila) | §4 |
| Instructional text before the first favor | 1,500+ words | §4 |
| Sequential checklists | 5 (arrivals hall 11 steps, airport 5, welcome chain 8, kitnet guide 8, Correria practice) | §4 |
| Persistent HUD chrome elements in the Vila (desktop) | ~25 (33+ with conditional ones) | §5 |
| Modals by id | 40 | §5 |
| Non-modal card and overlay kinds | 15 | §5 |
| Parallel help systems | 6 (Vila guide, 19 how-to cards, 3 HUD notes, Júlia Q&A, Tutorial replay, Ways-out banners) | §5 |
| Toasts and banners in a 30-minute first session | 30-50, plus 10-20 full-screen cards | §5 |
| Progress tracks a player can accumulate | 31 | §6 |
| Competing daily loops with their own counters | 5 (Missão do dia, Cartela, Vizinho do dia, Escola Meta XP, Escola streak) | §6 |
| Different "day" boundaries in play | 5 (48-minute game day, player-local day, New York day, São Paulo day, UTC day) | §6 |
| Vocabulary ledgers tracking the same words | 3 (Caderno, Diário, Escola boxes) | §6 |
| Ways to order at the padaria | 3 (counter chips, Correria, dead Pedido rápido) | §8 |
| "Serve customers against a patience bar" games | 4 (Correria, Tapioca, Pastel, Caldo) | §8 |
| Controls in the tatame bout | 17 buttons + 9 keys, 6 moves from the first match | §8 |
| NPC interaction modes | ~14, up to 4 boxes stacked on one click | §7 |
| Concepts needed to finish the simplest two-step favor | ~12 across 5-6 UI surfaces | §7 |

**The single idea behind every recommendation:** a new player should see one loop (favors, walking, talking, words into the Diário) with one currency (RV), one progress surface (the Favores tracker) and one explanation per concept, delivered at the moment of first use. Everything else is hidden until a trigger fires, and the triggers are listed in §3.

**The model to copy already exists in the codebase.** Fishing (`apps/client/src/ui/pesca/`) has one gesture, one label on the first cast, no digits and no card that opens by itself. The Correria practice round (`apps/client/src/ui/correriaPracticeLogic.ts:22-67`) teaches one action per coach mark. The belt chip already waits for a gi (`apps/client/src/ui/hudNotesData.ts:61-70`). The pattern is proven; it needs to be applied everywhere.

---

## 2. Rules for implementers

1. **Do not add explanation.** No new how-to cards, HUD notes, tooltips, guide lines or toasts. If a feature needs a paragraph to be understood, the fix is to the feature.
2. **Hide, don't delete, unless the item says delete.** Most items are gating: the system stays, its UI waits for a trigger. Deletions are marked explicitly and are limited to dead code and true duplicates.
3. **Gate on profile state, not localStorage, wherever the state already exists server-side** (`PrivateProfile` in `packages/shared/src/types.ts`: `tutorial`, `arrivalIntroDone`, `desembarqueDone`, `diary`, `recados`, `bonds`, `cartela`, `giOwned` etc.). localStorage "seen" flags are per-browser and already exist for cards (`tb_howto`, `tb_vila_guia`, `tb_kitnet_guia`, `tb_diario_visto`, `tb_aero`, `tb_desemb`, `tb_room_seen`, `tb_tracker`); use them only for "seen once" card state.
4. **Put every gate in a pure, tested function**, like `hudShows()` in `apps/client/src/ui/hudNotesData.ts:61`. Add the disclosure ladder (§3) as one module, `apps/client/src/ui/disclosure.ts` (pure, with `disclosure.test.ts`), and have HUD, journal, tracker and dialogue read from it rather than scattering conditions.
5. **No new Portuguese lines unless unavoidable.** New spoken dialogue needs `pnpm tts` (`docs/VOICES.md`) and every new PT string goes in `docs/lifesim/BR-REVIEW.md`. Prefer removing and reusing lines.
6. **Repo rules apply:** open a PR per item or per tier, never push to `main`, never deploy, keep the beta free (nothing in this document adds a paywall; one item removes a paywall card from the player's path).
7. **Run before pushing:** `pnpm typecheck && pnpm test`. The e2e scripts (`scripts/e2e*.mjs`, `scripts/lib/arrival.mjs`) assert on first-time cards and tutorial toasts; each item lists which to update. `scripts/lib/arrival.mjs:73` `quietFirstTimeCards` marks cards as seen for play paths; keep it in sync with any card you remove or rename.
8. **Each item is independently shippable** unless its "Depends on" line says otherwise. Tier A can be done in parallel by separate agents.

---

## 3. The disclosure ladder

Define four player stages. Every HUD element, panel section, chip, card and NPC option is assigned to the first stage at which it may appear. The stage is a pure function of the profile.

| Stage | Trigger (profile state) | What the player is doing |
|---|---|---|
| **S0 Arrival** | `desembarqueDone !== true` or `arrivalIntroDone !== true` | Hall, airport, bus |
| **S1 Newcomer** | In the Vila, `tutorial.carlos !== true` (has not yet ordered from Seu Carlos) | Meeting Júlia, first favor |
| **S2 Resident** | `tutorial.carlos === true` and at least one recado done (`recados.done.length >= 1`) | Doing favors, collecting words, visiting places |
| **S3 Regular** | Any of: `diary.length >= 25`, or 3+ recados done, or any Escola lesson finished, or gi owned | Daily loops, minigames, meta progression |

**Assignment table.** "Appears at" is the stage; "and also" is an extra per-feature trigger that must also be true.

| Surface | Appears at | And also |
|---|---|---|
| RV counter | S0 | after Célia or the first RV event |
| Diário button | S0 | after the journal reveal |
| Mapa button | S0 | after the hall "mapa" step, or S1 |
| Favores button and tracker | S1 | |
| Câmera button | S0 | after Célia hands the camera |
| Chat bar with Enviar | S0 | |
| Emote row (Oi!, Valeu!, Kkkk, Dançar, Desculpa) | S1 | collapsed behind the smiley on desktop as on phone until S2 |
| Ajustes gear (Música, Voz, Inglês, Conta, Sair) | S0 | |
| Ajustes → Guia, Tutorial, Créditos, Apoiar | S2 | |
| Fala (feedback) | S0 | as a gear entry, not a slab |
| Visual button | S2 | |
| Chapéus button | S2 | and owns ≥1 hat, or has visited Nanda's stall |
| Amigos button | S2 | multiplayer only, and ≥1 other player seen in the room or a friend request pending |
| Decorar button | own kitnet only | unchanged |
| Verde nameplate chip | S3 | and has visited the Escola |
| Escola Meta XP chip and streak flame | S3 | and ≥1 lesson finished |
| Belt chip | gi owned | unchanged |
| Cartela chip | S3 | and ≥1 stamp earned |
| Missão do dia pill | taken | unchanged, but the kiosk itself: S3 |
| Diário new-word badge | S1 | |
| Hearts in dialogue header | S2 | and that NPC has ≥1 bond point |
| "Vamos bater um papo?" chip | S2 | and the player has finished one greeting talk with that NPC |
| Tracker head stars (Vizinho do dia) | S3 | and ≥1 recado done today |
| Favores panel: Mochila section | S1 | bag non-empty |
| Favores panel: Amizades section | S2 | any NPC ≥1 ♥ |
| Favores panel: Vizinho do dia banner | S3 | |
| Favores panel: Bem-vindo chain section | S1 | until chain done, then hidden |
| Diário: chapter tabs | per chapter | chapter has ≥1 word |
| Diário: Caderno tab | removed from player view (item B2) | |
| Diário: Início stats row (streak, due, XP) | S3 | |
| Diário: mastery tier bar, medals shelf | S3 | |
| Diário chapter: sorts, source filters, "Mostrar o que falta" | chapter has ≥8 words | |
| Escola home: tier bar, goal picker, freezes, unit path | ≥1 lesson finished | first visit shows "Começar" only |
| Padaria door ownership meter | RV ≥ 300 | |
| Academia "Fundar" block | purple belt | |
| Pet shop Lojinha tab | owns ≥1 pet | |
| Pet shop Apoiar card | removed from panel (item C5) | |
| Bout: defense pad, grips/brace/control row, feints | stripe ≥1 | first 3 wins: chain pad only |
| Bout lobby: all 5 partner cards | after first win | before: the suggested partner + "Mais parceiros" |
| Feira cart games | S3 | one game, no daily rotation, in beta |
| Leaderboards (Placar da Vila) | S3 | |
| Ways-out banner | first visit to a room only | only where door tags do not already glow |
| Vila guide card | never auto-opens | Ajustes → Guia and Júlia's question keep it |
| How-it-works place cards (balcao, recados, diario, cartela, papo, camera, missao) | never auto-open | `autoOpen: false`; the "?" keeps them |

---

## 4. Onboarding: title screen to first favor

### 4.1 What happens today

**A. Title and sign-in** (`apps/client/src/ui/intro.ts`): Entrar layer and hint (`:77-89`), 4.4 s title pan (`introTitleBeat.ts`, skip at `intro.ts:70`), sign-in card (`:153-371`) with Entrar/Criar conta tabs, email, password, 18+ tick, Terms/Privacy, "Esqueci a senha", Google, "Explorar como visitante" (in multiplayer this only throws and flips to Criar conta, `:345-352`), and the line "Fase 0 · sua conta guarda seu avatar, suas RV e sua kitnet" (`:370`). About 90 bilingual words; introduces RV, kitnet, Fase 0 and visitante before the player has seen the game.

**B. Name card** (`apps/client/src/ui/onboarding.ts:286-355`): "Seu cartão de embarque", name, pronoun (ele/ela/só meu nome, glossed as grammar agreement), a "Regras da praça" block (~35 words), Embarcar. About 90 words.

**C. Flight cutscene** (`apps/client/src/ui/flightIntro.ts:913-1038`, `packages/shared/src/flightTalk.ts`): 5 narration lines, Júlia's letter (~70 words), Lia's walk, seat pick (this is the avatar choice), 5 asks with 2-3 replies each, 3 Lia lines, 2 think lines, 2 captain lines, seatbelt, descent, "BRASIL · Dia 1". About 20 taps and 350 words. Skippable (`flightIntro.ts:141, 281-290`). Nothing is saved (`flightTalk.ts:9-10`).

**D. Arrivals hall** (`apps/client/src/ui/desembarqueLogic.ts:36-129`, `desembarqueTutorial.ts`): 11 steps, each a card of ~30 words with an arrow or HUD pulse, a ✓ toast and a sting: `andar`, `falar` (journal reveal cinematic, `journalReveal.ts:51-130`), `diario` (opens the modal), `placa` (Nova palavra card, `diaryPanel.ts:196-211`), `chat`, `pegar`, `beber`, `dinheiro` (an RV explainer of ~60 words, `desembarqueTutorial.ts:271-286`, that lists favores, cartela, jogos, lanches, chapéus, móveis and filme before any exist, `desembarqueLogic.ts:177-185`), `mapa` (the map refuses to travel, `main.ts:1413-1416`), `fala` (opens the feedback form), `porta`. The door is locked until the other ten are done (`desembarqueLogic.ts:155-162`, `main.ts:319-325`). Skip is a small footer button with a confirm (`desembarqueTutorial.ts:306-335`). 17 concepts.

**E. Airport** (`apps/client/src/ui/airportTutorialLogic.ts:40-77`, `airportTutorial.ts`): a "You're in the airport!" card with 3 goals (`airportTutorialLogic.ts:127-135`) and then a "Next steps n/5" checklist (`airportTutorial.ts:161-171`, called from `main.ts:1096`) with the same content. Steps `celia` (one box stacking the camera, "N filmes", the cartela "Completa 7 e ganha +X RV", Júlia's 4-line note and a thanks chip, `airportTutorial.ts:315-353`), `foto` (each plane part is a word, so several sequential Nova palavra cards, `airportTutorialLogic.ts:52`), `passaporte` (greeting-by-hour quiz with retry and reason chips, 3-4 boxes, `airportTutorial.ts:430-470`), `lanche`, `onibus`. Only Célia is required (`desembarqueLogic.ts:170-174`) but nothing says so. About 10 concepts.

**F. Vila arrival** (within ~2 seconds): bus welcome toast (`main.ts:1100`), "Ways out · Saídas" banner for 9 s (`wayfinding.ts:75-94`), the Vila guide card of ~220 words after 1.8 s (`vilaGuide.ts:80`, text `vilaGuideData.ts:21-34`), the tracker with Júlia's 8-step chain (`packages/shared/src/constants.ts:116-125`) plus up to 3 "!" offers (`recadoView.ts:98-114`), the Cartela pill, the Verde plate, the clock, up to 3 simultaneous arrows (`main.ts:803-832, 865-867`), glowing door tags, and the "Quer mudar o seu visual?" toast (`hud.ts:465`). Then Júlia: idle-line box with a lone Continuar chip (`main.ts:421-437`), possibly an offer box, a 3-node greeting with 2 chips each plus "Vamos bater um papo?" (`ui/npcTalk.ts:522-523`) and a 5-question help menu (`packages/shared/src/juliaTalk.ts:243-265`). About 30 more concepts.

**G. First favor** (e.g. `carlos_cafe_pra_nanda`): padaria greeting bubble (`main.ts:1108-1114`), "Balcão" how-it-works card of ~100 words (`howToPlayData.ts:138-152`), order chips with prices, carry, Nanda's tree, done card, heart toast, new-word cards; opening Favores triggers its ~150-word card (`howToPlayData.ts:170-184`). A first favor crosses 3-4 auto-opening cards.

### 4.2 Findings

- **Five sequential checklists** teach overlapping things. The welcome chain's `andar`, `sentar`, `acenar`, `conversar` repeat what the hall just did. In the hall, one chat line fires both the server's "✓ Mande uma mensagem" toast and the hall's "✓ Say hi" (`main.ts:1343` only suppresses `andar`/`sentar`/`acenar`).
- **The cartela is explained five times** before a stamp can be earned: RV note (`desembarqueLogic.ts:181`), Célia's gift box (`airportTutorial.ts:334`), Célia's answer (`airportTalk.ts:197`), Vila guide (`vilaGuideData.ts:29`), Cartela card (`howToPlayData.ts:200-212`). The Diário is explained four times, Favores and RV four times each.
- **The hall front-loads tools the player has no use for yet**: Map (cannot travel), Fala (feedback), Beber, RV explainer.
- **The passport greeting quiz repeats** as the recado `julia_cumprimento_certo` (`content/curriculum/phase0/recados.md:59-70`).
- **The arrival stack** (toast, banner, guide card, tracker peek, arrows, pills, door glow) is the single most overwhelming moment in the game.

### 4.3 Work items (Tier A unless noted)

**A1. Cut the arrivals hall to 5 steps and unlock the door.**
- Files: `apps/client/src/ui/desembarqueLogic.ts:36-129` (steps), `:155-162` (door lock), `:170-185` (RV note copy), `apps/client/src/ui/desembarqueTutorial.ts:271-302` (RV note card), `:306-335` (skip), `apps/client/src/main.ts:319-325` (door refusal).
- Change: keep `andar`, `falar`, `placa`, `chat`, `porta`. Remove `diario`, `pegar`, `beber`, `dinheiro`, `mapa`, `fala` from `DESEMB_STEPS`. The journal reveal after `falar` stays (it is the one cinematic that lands). The door is never locked; `porta` is simply the last arrow. Delete the RV explainer note; RV is explained once, on the first purchase (item A7).
- Acceptance: a new account reaches the airport in ≤5 arrows and reads ≤150 words in the hall; `desembarqueDone` is set on the door, not on step completion; no toast fires for a hall step that the tracker already ticks.
- Tests: `apps/client/src/ui/desembarqueLogic.test.ts`, `scripts/e2e*.mjs` and `scripts/lib/arrival.mjs` (they walk the hall).

**A2. Airport: one required step, the rest optional and labelled so.**
- Files: `apps/client/src/ui/airportTutorialLogic.ts:40-77, 127-135`, `apps/client/src/ui/airportTutorial.ts:161-171, 315-353, 430-470`, `apps/client/src/main.ts:1096, 1413`.
- Change: delete `showAirportNext` and `AIRPORT_NEXT` (the second card repeats the first). Keep `celia` and `onibus` as guided steps. Keep `foto` as the one optional "try the camera" step with a single combined Nova palavra card for the plane (batch the plane-part words into one card; see `diaryPanel.ts:245-249`). Drop `passaporte` (the recado covers it) and `lanche` (the first purchase happens at the padaria, item A7). Célia's hand-over box gives the camera only; the cartela moves to a later moment (item B5).
- Acceptance: a new account can board the bus after talking to Célia and (optionally) one photo; no step shows "n/5"; at most one Nova palavra card for the plane.
- Tests: `airportTutorial.test.ts`, `airportPlanePhoto.test.ts`, e2e scripts that step through the airport.

**A3. One Vila checklist.**
- Files: `packages/shared/src/constants.ts:116-125` (`TUTORIAL_STEPS`), `apps/client/src/ui/recadoView.ts:100`, `apps/client/src/main.ts:1340-1348` (toasts), `apps/server/src/world.ts` (step completion).
- Change: reduce `TUTORIAL_STEPS` to `carlos` (order at the padaria), `chapeu` (optional, later), `cadeira` (optional, later) and drop `andar`, `sentar`, `acenar`, `conversar`, `meveum` from the chain (the hall taught walking and chat; Correria has its own practice). Alternative with lower risk: keep the ids server-side for old saves but auto-complete the four hall-taught steps when `desembarqueDone` is true, and never show them in the tracker. Remove the per-step `✓` toast in `main.ts:1344`; the tracker row flash is the signal.
- Acceptance: on arrival the tracker shows exactly one row ("Fale com a Júlia" or the first favor) and no ✓ toasts for walking, sitting, waving or chatting; the `ECONOMY.tutorialBonus` still pays once.
- Tests: `apps/server/src/world.test.ts` (tutorial steps), `apps/client/src/ui/recadoView` tests, `scripts/e2e.mjs` asserts step strings.

**A4. Stagger the Vila arrival.**
- Files: `apps/client/src/ui/vilaGuide.ts:68-80` (auto-open), `apps/client/src/ui/vilaGuideData.ts:40-46` (`shouldShowVilaGuide`), `apps/client/src/ui/recadoView.ts:98-114` (offers in tracker), `apps/client/src/main.ts:803-832, 865-867` (arrows), `main.ts:1100` (bus toast), `apps/client/src/ui/hud.ts:465` (look-hint toast), `apps/client/src/ui/wayfinding.ts:75-94, 229-248` (Ways-out banner).
- Change: `shouldShowVilaGuide` returns false always for auto-open (keep Ajustes → Guia and Júlia's question). Until `profileMetJulia()` is true: no recado offers in the tracker or as "!" markers, exactly one arrow (Júlia), no Ways-out banner, no look-hint toast. The bus toast is the only toast. Ways-out banner shows only in rooms whose door tags are not already glowing, and only on first visit.
- Acceptance: in the first 10 seconds in the Vila the player sees the world, the top bar, one tracker row, one arrow and one toast. Nothing else.
- Tests: `vilaGuideData.test.ts`, `wayfinding.test.ts`, `recadoView` tests; `scripts/lib/arrival.mjs` `quietFirstTimeCards` can drop the guide.

**A5. Place cards never auto-open; trim them.**
- Files: `apps/client/src/ui/howToPlayData.ts` entries `balcao` (`:138-152`), `papo`, `recados` (`:170-184`), `diario`, `cartela` (`:200-212`), `missao`, `camera`, `kimono`, `academias`, `placar-feira`; `apps/client/src/ui/howToPlay.ts:100` (the "?" button).
- Change: set `autoOpen: false` on every `kind: 'place'` card (the fishing card already does this, `howToPlayData.ts:288`). Trim each to 3 bullets; delete bullets that describe other systems (e.g. the recados card's hearts milestones and Bem-vindo bonus, the balcão card's Correria mention, the diário card's Escola box names). Game cards (`tapioca`, `pastel`, `caldo`, `bout`, `escola`, `damas`, `feira`) keep auto-open for now; items C1-C3 replace them with in-play teaching.
- Acceptance: opening the padaria counter, the Favores panel, the Diário, the camera or a bate-papo for the first time shows the thing itself with a "?" and no card.
- Tests: `howToPlay` tests, `scripts/e2e-solo.mjs` (opens the Cartela card from "?", keep), `scripts/lib/arrival.mjs`.

**A6. Sign-in and name card.**
- Files: `apps/client/src/ui/intro.ts:187-194, 345-352, 370`, `apps/client/src/ui/onboarding.ts:286-355`.
- Change: remove the "Fase 0 … RV … kitnet" line; hide "Explorar como visitante" in multiplayer builds (it only errors); move "Regras da praça" to a link to the existing legal/rules page (`apps/server/src/legalPages.ts`); the pronoun question stays but with a one-line gloss, not a grammar explanation.
- Acceptance: the sign-in card has no game nouns; the name card is name + pronoun + Embarcar.
- Tests: `apps/client/src/auth/client.test.ts`, intro tests, e2e sign-up path.

**A7. Explain RV once, at the first purchase.** (Tier B, depends on A1/A2 removing the earlier explainers.)
- Files: `apps/client/src/ui/padariaCounter.ts:12-19` (price note), `apps/client/src/ui/giShop.ts:28-31`, `apps/client/src/ui/padariaOwn.ts:296`, `apps/client/src/ui/petShop.ts:364`, wherever `rvPriceNote` is defined (grep `rvPriceNote`).
- Change: one `rvPriceNote` used everywhere, shown only the first time a price list opens (localStorage `tb_rv_note:<profile>`), one sentence: "RV (reais virtuais) is play money. You earn it doing favors and playing at the counter."
- Acceptance: the string "reais virtuais" is explained in exactly one copy source and appears at most once per profile per browser.

**A8. Flight: trim, keep.** (Tier C)
- Files: `packages/shared/src/flightTalk.ts:64-106` (`FLIGHT_CABIN` asks), `apps/client/src/ui/flightIntro.ts:141` (Pular).
- Change: 3 asks instead of 5; make Pular a visible button from the first frame. No new lines needed (removal only).
- Tests: `flightIntro.test.ts`, `flightIntroLogic` tests.

**A9. Júlia's help menu becomes the one "what is there to do" entry.** (Tier C)
- Files: `packages/shared/src/juliaTalk.ts:243-265`.
- Change: keep the menu; its answers are now the only in-world orientation, so make sure the three that matter (favors, the padaria, where words come from) are the first three. No new voiced lines: reorder only.

---

## 5. HUD, chrome, panels and notifications

### 5.1 What is on screen in the Vila today

Built in `apps/client/src/ui/hud.ts:139-546`, styled in `apps/client/src/styles/hud.css` and `styles/recados.css`.

| # | Element | Where built | Shown when | New player needs it in the first 15 min? |
|---|---|---|---|---|
| 1 | Logo and parrot mark | `hud.ts:280-281` | always | no |
| 2 | Room name, gloss, `n/cap aqui · n vizinhos` | `hud.ts:447` | always | name yes, counts no |
| 3 | Clock pill (day, time, weather) | `clockPill.ts` | always | no |
| 4 | Solo pill | `hud.ts:285` | solo builds | no |
| 5 | Belt chip | `hud.ts:163, 453` | after gi | no (already gated) |
| 6 | Verde nameplate chip | `hud.ts:160, 454-455` | out of intro | no |
| 7 | Meta XP chip and streak flame | `hud.ts:162, 480-489`; `escolaGoalChip` at `hud.ts:40-44` | once the diary has 1 word | no |
| 8 | RV counter | `hud.ts:290` | always | yes |
| 9 | "Fala pra gente" slab | `hud.ts:251-266` | always, full width | no |
| 10-17 | Icon bar: Decorar, Mapa, Favores, Diário, Câmera, Visual, Chapéus, Amigos | `hud.ts:191, 230-244, 458` | mostly once in the Vila | Mapa, Favores, Diário yes; rest no |
| 18 | Ajustes gear with 9 entries: Música, Voz, Inglês, Apoiar, Guia, Tutorial, Créditos, Conta, Sair | `hud.ts:194-225` | always | no |
| 19 | Diário new-word badge, burger dot on phone | `journal.ts:77-103` | count > 0 | no |
| 20 | Missão do dia pill `0/3` with 3 mini icons | `hud.ts:145, 490-496` | mission taken | no |
| 21 | Cartela pill `0/7`, 7 dots, `Hoje 0/4` | `hud.ts:146-159, 456, 509-513` | from `arrivalIntroDone` (`hudNotesData.ts:61-70`) | no |
| 22 | Favores tracker: head (icon, title, gold `!`, `★★☆`, caret) + up to 3 rows + first-time note | `recados.ts:101-223`, `:202-211`; `recadoView.ts:41` `TRACKER_MAX = 3` | any entry exists (always for a new player) | the single next step, yes; the rest no |
| 23 | Toast stack, max 3 | `hud.ts:103-118` | event-driven | — |
| 24 | Emote row: Oi!, Valeu!, Kkkk, Dançar, Desculpa (+ Levantar, Dica do papagaio, Guardar papagaio) | `hud.ts:402-414` | always on desktop | one (Oi!) |
| 25 | Chat bar: emote toggle, carry button, input, hint, Enviar | `hud.ts:336-415` | always | yes |

Also in-world: guide arrows (`main.ts:767-807`), NPC `!`/`?` markers (`recadoView.ts:128`), door tags and the Ways-out banner (`wayfinding.ts:229-248`), hover label (`hud.ts:556`), camera banner with film count (`diaryPanel.ts:23-63, 302-319`), the how-to "?" (`howToPlay.ts:100`), kitnet guide card (`kitnetGuide.ts:28`).

**Modals (40 ids via `openModal`):** academy, academy-board, academy-look, account, admin, admin-login, caderno (the Diário), cartela, checkers, credits, escola, feedback, feedback-thanks, feira-cart, feira-sign, friends, hats, hotspot, intro-admin, kiosk, leaderboards, look, map, padaria-book, padaria-choose, padaria-door, padaria-welcome, parrot-shop, party-end, party-invite, party-summary, pesca-caderneta, pesca-sell, pet-name, petshop, petshop-home, profile, recados, support.

**Non-modal cards (15 kinds):** dialogue box, 3 HUD notes (`hudNotes.ts`), 19 how-to cards, Vila guide, Nova palavra card (`diaryPanel.ts:159`), photo print, recado-done card (`recados.ts:257`), cartela banner (`cartela.ts:36`), mission banner (`hud.ts:121`), parrot whisper (`hud.ts:548`), room intro, reconnect banner, overlay message, idle-kicked card, decor side panel (`panels.ts:656`), airport and hall tutorial cards.

**Tabs:** Diário has 13 tabs (Início + 10 chapters + Fotos + Caderno, `journal.ts:220, 616-621`); the Início page has an owner stamp, a progress ring, a 4-tier mastery bar, 3 stats (streak, due, XP), medals, search, a "new stickers" shelf and the chapter list (`journal.ts:284-379`); each chapter page has search, up to 5 source filters, 4 sorts, "Mostrar o que falta" and a replay button (`journal.ts:390-471`). Caderno has 4 group sub-tabs, each row with 👁/🔊/✎ counts (`caderno.ts:146-152, 181-199`). Favores has 6 sections (`recados.ts:319, 356, 399, 409, 420` + Vizinho banner). Friends 4 sections (`panels.ts:544-601`). Pet shop 3 tabs (`petShop.ts:315`). Account 4 sections. Gear 9 entries. Leaderboards 2 boards. Feedback 3 categories.

**Keyboard (~12, overloaded):** WASD/arrows walk; Enter focuses chat or opens the padaria door (`main.ts:1840-1845`); Esc cancels placement, closes menus, modals, chat; R rotates furniture (`main.ts:1846`) and replays in Correria (`correria.ts:204`); C clears in Correria; H holds in the bout (`bout.ts:246`); 1-4 pick chips, Space skips the typewriter (`dialogueLogic.ts:74-83`); ←/→/PgUp/PgDn turn Diário pages (`journal.ts:918-950`).

**Notifications:** 56 client `toast(` call sites and 67 server `t: 'notice'` sends plus `reward` messages. In one first session: look hint, bus welcome, Ways-out ×~5, Vila guide, 8 tutorial ✓ toasts each with a tracker flash and a phone peek (`recados.ts:157-167`), "Primeiros passos completos", kitnet gift notice, kitnet toast (`main.ts:1103`), kitnet guide card, "Pronto! A kitnet é sua" (`kitnetGuide.ts:131`), a Nova palavra card with sting for every word (5-15 on a Praça walk), a toast per cartela stamp (`main.ts:1229`), mission banner, `+N RV` scene rewards (`main.ts:1245`), recado done card + heart-up toast (`recados.ts:182`) + Vizinho line, "Comprou: X" per purchase, Escola toasts (`escola.ts:132`), academia welcome (`main.ts:1119`), friend requests, chat warn/block (`hud.ts:344`). Estimate: 30-50 toasts and 10-20 full cards in 30 minutes.

### 5.2 Findings

1. **Five daily loops compete** at once: Missão do dia, Cartela (two counters), Vizinho do dia stars, Meta XP, the streak flame. Plus RV, nameplate, belt and the Diário badge: up to 8 counters before the player has done anything countable.
2. **The same progress is shown in several places:** streak/due/XP in the HUD chip and the Diário Início (`journal.ts:311-313` vs `hud.ts:480`); the tutorial chain as a tracker row, a Favores section, per-step toasts and arrows; offers as a tracker row, an NPC `!`, a journal section and the offer beat; film count in the frame, the banner and the Fotos page; nameplate tier in the HUD chip, the drawer chip, the profile card and the note.
3. **Six help systems** and two English toggles (gear "Inglês" `hud.ts:194`, dialogue "Mostrar inglês" `dialogueLogic.ts:87`).
4. **Shown before relevant:** Cartela pill, Verde plate (changes at 15 mastered words, `packages/shared/src/escola.ts:88-94`), Chapéus/Visual/Amigos, the Meta chip, empty chapter tabs, `???` Caderno rows, Vizinho stars, the permanent Fala slab.
5. **Same event, several signals:** tutorial step = toast + flash + peek; stamp = toast + chip animation + sfx; purchase = server toast + stall stamp (`panels.ts:301`); recado done = card + hearts toast + bonus line.

### 5.3 Work items

**B1. Build the disclosure ladder and gate the HUD.** (Tier A)
- Files: new `apps/client/src/ui/disclosure.ts` + test; `apps/client/src/ui/hudNotesData.ts:61-70` (`hudShows`, extend or replace); `apps/client/src/ui/hud.ts:452-458` (where `shows` is applied), `:454-455` (plate), `:456` (cartela), `:480-489` (goal chip), `:458` (icon bar), `:402-414` (emotes), `:251-266` (Fala slab), `:447` (room counts), `:194-225` (gear entries).
- Change: implement the §3 table. `stage(profile)` returns S0-S3; `hudShows(profile, room)` returns a boolean per element. Fala becomes a gear entry (keep the `#btn-fala` id for e2e if a script clicks it; or update the script). Room seat/neighbour counts hidden until S2. Emotes collapsed behind the smiley on desktop until S2 (the phone layout already does this, `hud.css:1143-1162`).
- Acceptance: at S1 the top bar shows logo, room name, clock, RV, Mapa, Favores, Diário, Câmera (if owned), gear. Nothing else. `disclosure.test.ts` asserts the full table.
- Tests: `hudNotesData.test.ts`, `hudLayout.test.ts`, e2e scripts that click Chapéus/Amigos/Fala early (grep `btn-wardrobe`, `btn-friends`, `btn-fala` in `scripts/`).

**B2. One word home: fold the Caderno into the Diário.** (Tier A; largest single simplification)
- Files: `apps/client/src/ui/journal.ts:220, 562, 616-621` (tabs), `apps/client/src/ui/caderno.ts` (the Caderno spread), `apps/client/src/ui/cadernoView.ts`, `apps/client/src/ui/hotspotCard.ts:849-866` ("Guardar no caderno"), `packages/shared/src/caderno.ts:18` (group payout), server `apps/server/src/caderno.ts` (keep the state; stop surfacing it).
- Change: remove the Caderno tab and "Guardar no caderno" from the player's view (the `read` already records the sign, `hotspotCard.ts:826`). Keep the server-side Caderno state and the `cardsInText` weighting for the tatame bank (`packages/shared/src/challenges.ts:328-339`); do not delete the module. Retire the per-group "+15 RV" payout from the UI (and, when safe, from the rules: it is a second currency source nobody can see). "Learned" means one thing: a Diário sticker with its Escola box.
- Acceptance: the word "Caderno" does not appear in the Vila UI; the Diário has Início, chapters, Fotos only; a sign card has Ouvir and close.
- Tests: `cadernoView.test.ts`, `journalView.test.ts`, `caderno.test.ts` (server) keep passing for the state; e2e steps that click "Guardar no caderno" (grep `Guardar`) are removed.

**B3. Diário progressive disclosure.** (Tier B)
- Files: `apps/client/src/ui/journal.ts:284-379` (Início), `:390-471` (chapter toolbar), `:616-621` (tabs); `apps/client/src/ui/journalView.ts` (model).
- Change: chapter tabs appear only for chapters with ≥1 word (`model.chapters.filter(c => c.earned > 0)`); the Início stats row, mastery tier bar and medals shelf wait for S3; sorts, source filters and "Mostrar o que falta" wait until the chapter has ≥8 words; empty slots in a chapter still show (they are the "how to find it" hints and work well), but cap them to the next 6 unfound slots per chapter instead of every slot.
- Acceptance: a diary of 3 words shows Início (ring + search + new shelf), one or two chapter tabs, Fotos.
- Tests: `journalView.test.ts`.

**B4. Favores tracker and panel.** (Tier A)
- Files: `apps/client/src/ui/recados.ts:101-223` (tracker), `:199` (stars), `:202-211` (first-time note), `:301-436` (panel sections), `:451` (13-word subtitle), `:482` (role strings); `apps/client/src/ui/recadoView.ts:41` (`TRACKER_MAX`), `:98-114` (offer rows).
- Change: while the welcome chain is pending, the tracker shows one row (the next step). Stars (Vizinho do dia) hidden until S3 and ≥1 done today. The first-time note is dropped once "!" markers exist. The panel becomes two sections, "Em andamento" and "Hoje na vila"; Mochila shows only when the bag is non-empty; Amizades shows only once any NPC has ≥1 ♥ and loses its milestone legend (the milestones announce themselves when reached); the Bem-vindo section is hidden once the chain is done; the Vizinho do dia banner is S3. Subtitle: one short line. Role strings PT only, EN in `title`.
- Acceptance: a newcomer's Favores panel has at most two sections and no empty-state copy ("Peça algo na padaria!").
- Tests: `recadoView` tests, `scripts/e2e.mjs` (asserts panel strings around the recado).

**B5. One daily loop for the beta: keep Favores, hide the Cartela and the kiosk mission.** (Tier A for the hide; Tier C for any removal)
- Files: Cartela: `apps/client/src/ui/hud.ts:146-159, 456, 509-513`, `apps/client/src/ui/cartela.ts`, `apps/client/src/main.ts:1229` (stamp toast), `apps/client/src/ui/airportTutorial.ts:329-335` and `packages/shared/src/arrival.ts:410` (Célia's hand-over), `apps/client/src/ui/airportTalk.ts:196-199`, `apps/client/src/ui/vilaGuideData.ts:29`, `packages/shared/src/cartela.ts`. Kiosk: `packages/shared/src/ambiance.ts:137-175`, `apps/client/src/ui/hud.ts:145, 490-496`, kiosk modal in `panels.ts`.
- Change: the Cartela chip and its stamp toasts appear at S3 and only after the first stamp is earned; Célia hands over the camera only (the cartela "gift" moves to the first stamp: the chip animates in with a one-line toast). The kiosk is interactable only at S3; its pill shows only when a mission is taken. Keep both systems in rules and server; this is gating. Consider for a later pass folding the kiosk's three steps into recado steps and deleting the kiosk.
- Acceptance: a newcomer never sees "Cartela", "carimbo", "Missão do dia" or "Vizinho do dia" in the first session.
- Tests: `cartela.test.ts` (server and client), `scripts/e2e-solo.mjs` (opens the Cartela card: move that assertion behind an S3 fixture or drop), `hudNotesData.test.ts`.

**B6. De-duplicate notifications.** (Tier B)
- Files: `apps/client/src/main.ts:1344` (tutorial ✓ toasts), `:1229` (stamp toasts), `:1245` (scene rewards), `:1100-1103` (bus and kitnet toasts), server "Comprou:" notices (grep `Comprou` in `apps/server/src`), `apps/client/src/ui/recados.ts:180-183` (heart-up toast after the done card), `apps/client/src/ui/hud.ts:103-118` (stack size), `apps/client/src/ui/diaryPanel.ts:159-232` (Nova palavra card).
- Change: one signal per event. Tutorial step: tracker flash only. Stamp: chip animation only. Purchase: the stall stamp only, no server toast. Recado done: the done card carries the heart change; no second toast. Toast stack max 2 at S1-S2. Nova palavra: the card stays for the first 3 words of a session; after that a photo or sign shows the word in the small Achado/word-flight animation only and the card is reachable from the Diário badge. (The reward animations `achado.ts`, `wordFlight.ts`, `heardWord.ts` already exist and never take the pointer.)
- Acceptance: a 10-minute Praça walk produces ≤5 toasts and ≤3 full cards.
- Tests: e2e scripts that wait on `✓` toast text (grep `✓` in `scripts/`).

**B7. One help entry and one English toggle.** (Tier B)
- Files: `apps/client/src/ui/hud.ts:194` (gear Inglês), `apps/client/src/ui/dialogueLogic.ts:87` and `dialogue.ts` (Mostrar inglês), `apps/client/src/ui/howToPlay.ts:100` ("?"), `apps/client/src/ui/hudNotes.ts`, `apps/client/src/ui/vilaGuide.ts`.
- Change: the dialogue "Mostrar inglês" switch reads and writes the same `game.englishHelp` flag as the gear (one toggle, two places is fine; two flags is not). The "?" is the one help affordance: on a HUD chip it opens the HUD note, in an activity the how-to card, in the open world the Vila guide. Remove the separate Guia and Tutorial gear entries at S1-S2 (they return at S2 per §3).
- Acceptance: toggling English anywhere changes glosses everywhere; "?" exists in every context that has help and nothing else opens help.

**B8. Keyboard: one list, fewer overloads.** (Tier C)
- Files: `apps/client/src/main.ts:1840-1850`, `apps/client/src/ui/correria.ts:204`, `apps/client/src/ui/bout.ts:246`, `apps/client/src/ui/journal.ts:918-950`.
- Change: R only rotates furniture (Correria replay gets another key or stays on-screen); arrow keys never turn Diário pages while a dialogue is open; add the list to the Guia card.

---

## 6. Progression, currencies and daily mechanics

### 6.1 Inventory: 31 tracks

| # | Track | Earned | Shown or spent | Explained to a new player? |
|---|---|---|---|---|
| 1 | RV | recados, scenes, Correria and feira runs (capped), Escola, Cartela, Caderno groups, mission, fish sales | hats, furniture, parrots, gi, snacks, film, pet items, padaria upgrades, boats | yes |
| 2 | Film rolls | camera grant (3), Júlia sells 6 for 4 RV (`packages/shared/src/diary.ts:244-249`) | each photo | yes |
| 3 | Bag items (`recados.ts:263-291`) | ordering, feira | recado `entregar` steps | no |
| 4 | Street snacks, session-only (`streetSnacks.ts:2`) | carts | carried, not saved | partly |
| 5 | Diário words (`diary.ts:99`) | camera, sign, line, game | album, Escola, leaderboard | yes |
| 6 | Diário per-area and per-source counts (`diary.ts:154-193`) | same | chapter progress lines | no |
| 7 | Caderno seen/heard/used per card (`caderno.ts:9-15`) | NPC lines, 🔊, typing | Caderno tab; tatame weighting (`challenges.ts:328`) | no |
| 8 | Caderno group completion +15 RV (`caderno.ts:18, 877`) | all cards in a group | one-off payout | no |
| 9 | Escola Leitner box 0-5 per word (`escola.ts:103-114`) | due-word right answers | pips in album and end card | no |
| 10 | Escola lifetime XP (`escola.ts:118`) | lessons | end card | no |
| 11 | Escola daily XP vs goal 10/20/30 (`escola.ts:67-69, 241-253`) | lessons | HUD Meta chip | yes (HUD note) |
| 12 | Escola streak and best (`escola.ts:198-238`) | one lesson a day | HUD flame, leaderboard, Lúcia's greeting | yes (HUD note) |
| 13 | Streak freezes, max 2 (`escola.ts:75, 233-236`) | every 7 streak days | auto-consumed, tiny ×n icon | no |
| 14 | Lesson combo (`escola.ts:53-58`) | consecutive rights | in-lesson | no |
| 15 | Unit crowns 0-5 and node states per area (`escola.ts:374-423`) | area strength | Escola path | no |
| 16 | Daily word mission +5 XP (`escola.ts:502-510`) | find a word in a picked area | mission card | no |
| 17 | Nameplate tier Verde→Dourado (`escola.ts:88-94`) | mastered words, +30-day streak for gold | overhead plate, HUD, rooms | yes (HUD note) |
| 18 | BJJ wins → stripes → belts (`academia.ts:75-99`) | tatame wins | HUD belt, academies gate | after gi |
| 19 | Partner unlock level (`academia.ts:259, 332`) | bjjLevel | partner picker | no |
| 20 | Bond points per NPC 0-100 → hearts → 3 milestones + gift (`bonds.ts:7-11, 35-39, 67`) | talk, papo, recados, bouts (daily caps) | Amigos, papo gate (`papos.ts:534`), recado offers | no |
| 21 | Recados active/done/day bonus (`recados.ts:75-81`) | errands | Favores | yes |
| 22 | Kiosk mission, 3 steps, +25 RV (`ambiance.ts:140-162`) | Praça kiosk | HUD pill | yes (card) |
| 23 | Cartela 7 stamps, 4 activities, NY day (`cartela.ts:7-9`) | tatame, balcão, feira, praça papo | HUD chip, panel | yes (Célia) |
| 24 | Correria stars → levels 0/3/8/16 + 4 unlocks (`correria.ts:185-208`) | shift stars | shift end | partly |
| 25 | Correria shifts → menu ladder (`correria.ts:212-235`) | shifts | menu growth | partly |
| 26 | Feira purchases per day → leaderboard `feiraScore` (`types.ts:235`, `subscription.ts:316`) | feira buys | ranking | no |
| 27 | Feira cart daily board + permanent medals (`feiraGames.ts:398-425`) | runs | Placar, Diário | partly |
| 28 | Pesca log: species, best cm, balde, rentals, party counts (`pescaProgress.ts:16-28`) | fishing | Praia panels | no |
| 29 | Padaria size tier 1-3, 3 sweets, gear (`playerPadaria.ts:221-240`, `padariaEconomy.ts:11-41`) | 900-3000 RV | owner menu | no |
| 30 | Player academy membership, crest, gi (`playerAcademy.ts:74-86`) | brown belt to found | elevator | no |
| 31 | Collections: hats, furniture (incl. 5 earned beach items), parrot colours, pets ≤6 + items, photos ≤12, founder badge/banner, tutorial checklist | various | wardrobe, kitnet, album | partly |

(All paths in this table are under `packages/shared/src/` unless noted.)

### 6.2 Gates and the five "days"

Gates: camera → camera-source diary words (`grants.ts:49-60`); any Diário word → Escola at all (`escola.ts:630-634`); Escola unit nodes by area strength (`escola.ts:419-420`); mastered words → nameplate (`escola.ts:88-94`); gi (18 RV, `academia.ts:99`) → belt chip → bouts → stripes → partners (`academia.ts:332`) → brown belt (140 wins) → Fundar (`playerAcademy.ts:117-120`); bond ≥ minBond → recado offered (`recados.ts:28, 394`, silently); hearts → papos (`papos.ts:534`), story at 4, gift at 6; 900 RV → own padaria → 1500 → sweets 300/400/500 → 3000 (`playerPadaria.ts:279-294`); Correria stars → tools, shifts → menu; subscription → pet adoption, bubble styles (`subscription.ts:61-65, 120-125`, `petShop.ts:5`); boat tiers 15/40/90/150 RV → fish (`pesca.ts:22-30`); Caderno "learned" = seen+heard or used (`caderno.ts:826-828`, invisible).

Day boundaries: 48-minute game day (`clock.ts:8`: recado offers `recados.ts:401-411`, daily talk and papo bond, scene payout decay `carlos.ts:334-340`, rotating diary objects `diaryDaily.ts:17`, pen litters `petShop.ts:280`, feira hours `feira.ts:15-18`, NPC schedules, greeting correctness `recados.ts:348-354`); player-local calendar day (Escola streak, goal, RV cap, `escola.ts:189-191`); New York day (Cartela `cartela.ts:90-92`, feira cart runs and medals `feiraGames.ts:372-373`); São Paulo day (fish sales cap `pescaProgress.ts:23`, leaderboard streak); UTC or server day (Correria paid shifts `correria.ts:1500`, kiosk mission `ambiance.ts:155`, feira purchase RV cap `types.ts:235`).

### 6.3 Findings

- **Three vocabulary ledgers** (Caderno per card, Diário per word, Escola box per Diário word) with two different meanings of "aprendidas" (`caderno.ts:826` vs `escola.ts:297-310`). Item B2 covers it.
- **Five day boundaries** make "today" unlearnable. A player hits "the cart has paid what it could today" (`feiraGames.ts:387`), then sees recados renew after 48 minutes, then the Cartela reset at New York midnight.
- **Five parallel daily to-do systems** with overlapping steps (kiosk "Monta" = Cartela "balcão" = a Correria shift).
- **Rules that cannot be inferred from play:** Leitner intervals; crowns = floor(strength×5); the Caderno learned rule; minBond (the player only sees fewer offers); scene payout halving (`carlos.ts:339-340`, reads as a bug); streak freezes; the feira `n` ranking.
- **Shown too early:** nameplate and Meta chip at Vila load (`hudNotesData.ts:69`); the Escola home renders streak, goal picker, tier bar, counts, mission and the 10-unit path with 1 word (`apps/client/src/ui/escola.ts:145-262`); the padaria door shows "0/900 RV" to a player holding 10 RV (`apps/client/src/ui/padariaOwn.ts:276`).
- **Endgame systems with beta-visible UI:** padaria ownership (30+ days of capped income), player academies (140 wins), Dourado (300 mastered + 30-day streak), 6-pet adoption, boat tiers, feira medals.

### 6.4 Work items

**D1. One day boundary for player-facing caps.** (Tier B; server change)
- Files: `packages/shared/src/cartela.ts:90-92`, `packages/shared/src/feiraGames.ts:372-373`, `packages/shared/src/pescaProgress.ts:23`, `packages/shared/src/correria.ts:1500`, `packages/shared/src/ambiance.ts:155`, `packages/shared/src/types.ts:235`, `packages/shared/src/escola.ts:189-191` (the one to standardise on), `packages/shared/src/leaderboards.ts`.
- Change: every cap, streak, stamp card, paid-run counter and mission uses the player-local day the Escola already uses (the client sends its UTC offset; the server stores the day key). The 48-minute game day stays for ambience only (feira hours, schedules, greetings, offer rolls). Document the one exception in the Guia card ("the Vila's clock runs fast; your day is your day").
- Acceptance: a single `playerDay(now, tzOffset)` helper is the only day function imported by those modules; a test asserts no module under `packages/shared/src` imports `America/New_York` or `America/Sao_Paulo` day helpers for a cap.
- Tests: `cartela.test.ts`, `feiraGames.test.ts`, `correria.test.ts`, `escola.test.ts`, `pescaProgress` tests, `leaderboards.test.ts`, server `clockControl.test.ts`.

**D2. Escola home: first visit is one button.** (Tier A)
- Files: `apps/client/src/ui/escola.ts:145-262` (home: `flame`, `tierBar` at `:171-180`, `goalPick` at `:201-213`, units path `:198`, mission `:199`).
- Change: when `counts.studied === 0` (no lesson finished), the home shows Dona Lúcia's greeting, the word count, and "Começar". After the first lesson: add the streak and the path. After 3 lessons: goal picker. Tier bar, freezes and the word mission wait for S3. The end card keeps XP, streak and words; drop the combo multiplier line.
- Acceptance: the first Escola visit has one actionable control.
- Tests: `escola.test.ts` (client view-model if any), e2e `18-escola-board` shot script.

**D3. Hide endgame doors until relevant.** (Tier B)
- Files: `apps/client/src/ui/padariaOwn.ts:276, 296` (door meter), `apps/client/src/ui/academy.ts` (Fundar block), `apps/client/src/ui/petShop.ts:76-104, 315` (Adotar gate, Lojinha), `packages/shared/src/padariaEconomy.ts:11-39`.
- Change: padaria door meter only at RV ≥ 300 (before that the door is a plain locked door with Carlos's line); Fundar block only at purple belt; pet shop Lojinha only when a pet is owned. Candidates to cut from the beta build (flag, not delete): padaria size 3, gear and décor tiers; academy crest and gi editor; boat tiers above `pesca`.
- Acceptance: a newcomer in the padaria, the academia lobby and the pet shop sees no price above their RV and no "founder" or "owner" vocabulary.

**D4. Bond: say the rule instead of hiding the offer.** (Tier C; needs one new PT line, so TTS and BR-REVIEW)
- Files: `packages/shared/src/recados.ts:394` (minBond filter), `apps/client/src/ui/recados.ts:356` (Hoje na vila).
- Change: when a recado is withheld by minBond, show it greyed with "Fale mais com X" (one voiced line reused per NPC is not needed: this is panel text, not spoken). Reduce milestones shown to hearts only; the 6-♥ furniture gift announces itself when it happens.

**D5. Scene payout decay: explain or remove.** (Tier C)
- Files: `packages/shared/src/carlos.ts:334-341`.
- Change: remove the halving (pay the full amount for `sceneFullPerDay`, then zero with a one-line "Volte amanhã" notice) or show the decayed amount on the chip before the player commits. Prefer removal; the Pedido rápido scene that pays it is dead code (item C4).

**D6. Leaderboards: words and streak only.** (Tier C)
- Files: `packages/shared/src/subscription.ts:316` (`feiraScore`), `packages/shared/src/types.ts:235`, `apps/client/src/ui/leaderboards.ts`, `apps/server/src/leaderboards.ts`.
- Change: drop the feira purchase ranking; feira medals stay cosmetic in the Diário. Placar da Vila is S3.

---

## 7. Dialogue, NPCs, favors, words and chat

### 7.1 What one click on an NPC does today

Up to four boxes before the real talk (`apps/client/src/main.ts:396-439`): (1) an idle-line box with a lone "Continuar" chip if that NPC still has an unlearned idle word (`:421-437`); (2) a hand-over beat per carried item (`apps/client/src/ui/recados.ts:484-504`); (3) an offer beat with reward strip and "Pode deixar!" / "Agora não" (`:508-530`; declining re-runs the prelude, so a second offer can follow); (4) the talk itself: counter, stall, or `NPC_TALK` greeting.

Each box (`apps/client/src/ui/dialogue.ts:137-232`) carries: portrait, name tag, hearts (`:143`, shown at ♡ 0), role, optional meta and notes, 🔊 Ouvir, "Mostrar inglês", ✕, the typed PT line at 45 cps, EN gloss, optional extras (ticket, reward, cart board), up to 6 chips (`:197`; keys only reach 1-4, `dialogueLogic.ts:374`), optional text input + Send (`:206-220`, Pedido rápido only), optional footer button. The camera zooms and the player is frozen (`:271-276`).

Greeting talks (`packages/shared/src/npcTalk.ts`) are 3 nodes × 2 chips; the first beat appends "Vamos bater um papo?" (`apps/client/src/ui/npcTalk.ts:522-523`), and Nanda, Júlia and Dito add a footer button ("Ver chapéus", "Filme · N RV", "Ver os bichinhos", `:560-567`): a first-visit box can carry 3 chips + footer + 🔊 + EN toggle + hearts + ✕ = 8 controls. Praia NPCs open with 4 chips (`npcTalk.ts:566-571, 601-607, 637-643`), 5 with the papo chip, beyond the 1-4 keys. The counter (`padariaCounter.ts:12-19`): N menu chips with prices + Bater papo + Agora não + a price note.

Modes an NPC can offer (~14): idle line, hand-over, offer, greeting talk, bate-papo (3 per NPC, 15 total; story at 4 ♥), counter order, stall purchase, off-duty vendor talk, shop/adopt/mat/help panels, film purchase, hour-based greeting variants, name-use at 2 ♥, gift at 6 ♥, street-snack carts. Plus the Pedido rápido scene (`ui/pedido.ts`), still wired on `scene` messages (`main.ts:1249-1270`) although no client code sends `scene start` any more.

### 7.2 Favors

18 recados (`content/curriculum/phase0/recados.json`), 1-5 steps, 6 at bond 0; step kinds falar / pedir / entregar / ir / ler / cumprimentar (`packages/shared/src/recados.ts:17-23`); 3 offered per game day, 3 active, Vizinho do dia +15 RV (`:75-78`). Three offer surfaces: the gold "!" (`recadoView.ts:660-672`), a tracker row (`:637-644`), the journal's "Hoje na vila" cards (`recados.ts:356-387`). The tracker head carries icon, title, "!" badge, ★★☆ day stars and a caret; rows carry portrait, title, "1/2", step text and a 📍 line with the NPC's schedule. The panel stacks six sections. Done = a card with RV + ♥ + item + possible ★★★ (`:257-283`), a sting, then a separate heart-up toast (`:180-183`).

Concepts to finish the simplest favor (pedir + entregar): the "!", accept chip, tracker, RV, hearts, bag, "the counter order puts it in the bag", the right NPC and their schedule, hand-over chip, done card, day stars, the journal: about 12 concepts across 5-6 surfaces. Step copy is terse and code-ish: "Peça 1× café com leite (Seu Carlos)." (`packages/shared/src/recados.ts:342`). Greeting steps require typing in the chat ("diga “Oi!” no chat", `:360`) while the Oi! button is an emote that does not count, and the tutorial says "Wave hello (Oi button)" (`constants.ts:119`).

### 7.3 Word capture

Paths in: sign card `read` + "Guardar no caderno" (`hotspotCard.ts:849-866`, `main.ts:498-503`), some signs via the Achado burst (`main.ts:502`); 🔊 on any line (`heard.ts:675-678`); diary line anchors (`diaryLines.ts`) flying out of the line (`heardWord.ts`); camera (`main.ts:591`; 392 of 598 catalog words); games (52 words); chat typing marks a card used (`cadernoView.ts:7`). Shown afterward in: Nova palavra card, Diário album, Caderno tab, dialogue gloss, chat gloss (`gloss.ts`), Escola boxes.

### 7.4 Chat bar

`hud.ts:336-415`: input "Diga oi! (Say hi — Portuguese or English)", a hint that becomes "Vai com aviso · Sends with a warning / Vai pra revisão / Não pode" while typing (`:364`), Enviar, an emote toggle hiding 5 emotes, carry/stand/parrot buttons. There are no Portuguese quick-reply chips; "Oi!" is a wave, not a line. Block = toast with the rule note (`safety.ts:215-227`); warn = the hint only. "Vai pra revisão" exposes moderation internals to a learner.

### 7.5 Work items

**E1. One box per click: collapse the prelude.** (Tier A)
- Files: `apps/client/src/main.ts:396-439` (`talkTo`), `apps/client/src/ui/recados.ts:484-530` (`runPrelude`), `apps/client/src/ui/talkIdle.ts`.
- Change: the idle line becomes the first line of the greeting box (same box, no Continuar-only beat); a hand-over or an offer replaces the greeting's first node rather than preceding it; declining an offer never queues a second offer in the same click. Max one box per click, always.
- Acceptance: clicking any NPC opens exactly one dialogue box; `talkIdle.test.ts` and `dialogueLogic.test.ts` updated.

**E2. Cap chips at 3 + one exit; move secondary actions behind the last node.** (Tier A)
- Files: `apps/client/src/ui/npcTalk.ts:522-567` (papo chip, footer buttons), `packages/shared/src/npcTalk.ts:566-571, 601-607, 637-643` (Praia 4-chip openers), `apps/client/src/ui/dialogue.ts:197` (6-chip cap), `apps/client/src/ui/padariaCounter.ts:12-19`.
- Change: a dialogue box shows at most 3 content chips plus one exit ("Tchau" / "Agora não"). "Vamos bater um papo?" appears only at S2 and only after one finished greeting talk with that NPC (profile `bonds[npc] > 0` is a usable proxy). Footer shop buttons ("Ver chapéus", "Filme", "Ver os bichinhos") appear on the greeting's last node, not the first. Praia openers trimmed to 3 (removal only, no new lines). The counter shows up to 4 menu chips at S1 (the cheapest), the full menu from S2.
- Acceptance: no box exceeds 4 chips; keys 1-4 reach every chip.
- Tests: `npcTalk.test.ts`, `dialogueLogic.test.ts`, `padaria` e2e.

**E3. Hearts, stars, bag and friends appear when earned.** (Tier A; overlaps B4)
- Files: `apps/client/src/ui/dialogue.ts:143` (hearts in the header), `apps/client/src/ui/recados.ts:199, 405-436, 514` (stars, Mochila, Amizades, offer reward strip).
- Change: the header heart row renders only when that NPC has ≥1 bond point; the offer box shows the RV reward only (hearts and item are discovered on completion).

**E4. Step copy as sentences; make the Oi! button count.** (Tier B; new PT strings go to BR-REVIEW, no TTS since unspoken)
- Files: `packages/shared/src/recados.ts:336-362` (`describeStep`), `:360` (greeting step), `packages/shared/src/constants.ts:119`, `apps/client/src/ui/hud.ts:404-410`, server `cumprimentar` check.
- Change: "Peça um café com leite pro Seu Carlos." instead of "Peça 1× café com leite (Seu Carlos)."; the greeting step accepts the Oi! emote or a typed greeting; add 3 Portuguese quick-reply chips to the chat bar at S1 (Oi!, Bom dia / Boa tarde / Boa noite by the hour, Valeu!) that send real chat lines.
- Acceptance: a player can finish `julia_cumprimento_certo` without typing.

**E5. Soften chat hints.** (Tier C)
- Files: `apps/client/src/ui/hud.ts:364`, `packages/shared/src/safety.ts:215-227`.
- Change: one friendly hint for warn, one for block ("Essa não dá, tenta de outro jeito"); never "Vai pra revisão".

**E6. Delete the dead Pedido rápido path.** (Tier A; deletion)
- Files: `apps/client/src/ui/pedido.ts`, `apps/client/src/ui/pedido-ticket.ts` (+ test), `apps/client/src/main.ts:100` (import), `:1249-1270` (`scene` handler), `packages/shared/src/carlos.ts` scene nodes (keep what `papos.ts` or `accept.ts` still reference; check `curriculum.test.ts`), server `scene` handling in `apps/server/src/world.ts` / `npcs.ts`, `apps/server/src/caderno.test.ts:61-84` and `npcs.test.ts:263` (tests that drive `scene start`), `apps/client/src/ui/dialogue.ts:206-220` (text input + Send are only used by this scene).
- Change: remove the client scene UI and the dialogue box's typed-input mode. Server: keep the `scene` protocol only if `curriculum.test.ts` depends on the accept-list grading through it; otherwise remove it and move accept-list tests to call `accept.ts` directly. The "modo offline" and "Só você vê esta conversa" meta chips in the dialogue header go with it.
- Acceptance: `grep -rn "scene" apps/client/src` returns only the Phaser scene; the dialogue box has no text input.

---

## 8. Minigames and activities

### 8.1 Per-activity verdicts

| Activity | Entry and gate | Controls | Rules | Taught by | Text before play | Verdict and cause |
|---|---|---|---|---|---|---|
| **Correria no Balcão** (`ui/correria.ts`, `shared/correria.ts`) | vitrine prop (`main.ts:617, 737`), forced one-customer practice first (`correriaPracticeLogic.ts:110`), 3 paid shifts/day (`shared/correria.ts:1500`) | 16 (grab, chapaPut, chapaTake, pourStart/End, juiceDrop, juiceTake, pack bag/plate, serve, clear, replay, `ui/correria.ts:85-101`; Entregar, Limpar, EN, ✕, ? `:72-76`) | ~20: 3 waves 4/5/6 (`:43-45`), 4 levels with listening-only and change-of-mind chances (`:178-183`), star thresholds (`:186`), 4 unlocks (`:202-207`), 12-item ladder one per 2 shifts (`:217`), mandatory packing at 6 items (`:221`), grill window (`:57`), coffee zones + 35% extra-hot from shift 1 (`:63, 567, 607`), juicer with 3 orange sizes (`:76`), patience, replay cost, combos, tips, regulars | best in the game: practice with Ana + ~11 coach marks (`correriaPracticeLogic.ts:22-67`) | ~10 words | **heavy**: gentle entry, management-sim tail; the end card stacks RV, stars, 4 stat rows, words, ladder strip, unlock notice, Treino (`ui/correria.ts:636-660`). Server computes `lesson` cards the client no longer renders (`apps/server/src/correria.ts:148-158`) |
| **Padaria counter** (`ui/padariaCounter.ts:10-34`) | click Carlos/Graça | 2 | 0 | none needed | ~30 words | **fine** |
| **Pedido rápido** (`ui/pedido.ts`) | nothing sends `scene start` | chips + typed input | accept-list scoring, daily decay | — | ~40 + ticket | **dead, delete** (E6) |
| **Tatame bout** (`ui/bout.ts`, `shared/matFight.ts`) | mat or Bia (`main.ts:479, 625`), gi 18 RV (`academia.ts:99`) | 17 buttons + 9 keys: 4 cards + Segurar (`bout.ts:650-700, 489-496`), 6 commands, 4 defenses (`matFight.ts:178, 192`), ✕, EN; 1-6, H, Enter, Esc | ~25: chain windows by level with Perfeito/Boa/Errou, collar and sleeve grips with slip after 3 turns, Postura strip, braces, Vantagem, Ritmo, partner clean chance, feints from blue, Sai! mash, points 2/3/2/4, 12 s pick timeout (`docs/lifesim/TATAME-V3.md` §B-E); **6 moves at white belt 0 stripes including the finisher** (`matFight.ts:291-297`) | 3 coach notes in the first match (`boutLogic.ts:250-253`), stripe drills, a lobby hint (`bout.ts:455`), end-card tip (`boutLogic.ts:263-276`) | ~150 words (gi shop, 5 partner cards with name, style, 5 stars, bio, lock) | **overwhelming**: each pick card shows keycap, chevrons, "Responde!" badge, PT, EN, "does", "risk" (`bout.ts:665-690`); the HUD row has Gola/Manga pips, brace shield, control tug and Ritmo from match one (`bout.ts:1231`); ten words on two pads before anything lands |
| **Feira "Quanto custa?"** (`ui/feira.ts:47, 140-156`) | vendors 06:00-13:00 (`shared/feira.ts:16, 148`) | 3 | 1 | chips | ~30 | **fine** |
| **Tapioca** (`ui/feiraTapioca.ts`, `shared/feiraTapioca.ts:24-50`) | cart, daily rotation, config default off (`shared/feiraGames.ts:10, 25`), 3 paid runs/day (`:373`) | 6 | ~6 (4 fillings, 120 s, 11 customers, pans 2 and 3 mid-run) | one intro sentence then 3-2-1 (`ui/feiraGames.ts:47-70`) | ~45 | **heavy** |
| **Pastel** (`ui/feiraPastel.ts`, `shared/feiraPastel.ts:55-58, 113`) | same | 8 | ~9 (9 fillings, 4 two-drag combos from customer 5, raw/golden/dark/black/brick/fire, 2→3 fryer slots) | none in-play (error pops only, `feiraPastel.ts:57`) | ~45 | **overwhelming** |
| **Caldo de cana** (`ui/feiraCaldo.ts`, `shared/feiraCaldo.ts:26-48`) | same | 7 | ~7 (7 flavours × ice, 12 customers in 90 s, 24 s patience) | none in-play | ~45 | **overwhelming** |
| **Pesca** (`ui/pesca/pescaPlay.ts`, `pescaSim.ts:55-84`) | free, beach spots | 1 (press/release) | tension sim, telegraphed runs, wider bite window for the first 3 catches | "Segura… solta!" on the first cast (`pescaStage.ts:73`), Neide's one-time lines (`pescaLines.ts:28-32`) | ~5 words | **fine: the template** |
| **Boats and party boat** (`barcoMenu.ts:46-76`, `party.ts`) | RV 15/40/90/150 (`shared/pesca.ts:30`) | chips | trips, invites, cap 6 | — | ~40 | **fine for S3**; hide tiers above `pesca` in beta |
| **Pet shop** (`ui/petShop.ts:83-104, 249-270, 294, 315`) | door, pens, Seu Dito | ~12 across 3 tabs | ~6 | none (commands sheet in a tab) | 60-80 (gate line, gate card, tabs, pen cards) | **heavy**: the only activity with a paywall card in the loop; most of the panel is inert for a free player |
| **Checkers** (`ui/checkers.ts`) | — | 2 | mandatory captures | — | ~10 | fine, but zero Portuguese |
| **Street snacks**, **cartela**, **achado**, **photoFind**, **wordFlight**, **heardWordMatch**, **viewfinder** | — | ≤2 | — | — | — | fine |

### 8.2 Findings

- **Too deep for a beta:** the bout, Correria's late game, Pastel, Caldo.
- **Duplicates:** three ways to order at the padaria; four "serve customers under patience bars with a timing window" games (Tapioca's flip ring, Pastel's fry window and Caldo's cup line are Correria's chapa, pour and juicer re-skinned with less Portuguese per order); two reading-word reward spectacles (harmless).
- **Everything at once:** bout lobby, pick cards, HUD meters row, defense pad from match 1; Correria extra-hot coffee and juicer sizes from shift 1; the Correria end card; the pet shop's three tabs; Caldo's 7×2 flavour grid; Pastel combos inside the first run.
- **Digits on screen** (clock, score, combo in `feiraStage.ts:477-485`) that the Praia plan explicitly bans and that fishing proves unnecessary.

### 8.3 Work items

**C1. Stage the bout.** (Tier A; biggest single activity fix)
- Files: `packages/shared/src/matFight.ts:291-297` (`UNLOCK_ORDER`), `apps/client/src/ui/bout.ts:445-458` (lobby), `:665-690` (pick cards), `:1231` (meters row), `:489-496, 650-700` (cards and Segurar), `apps/client/src/ui/boutLogic.ts:250-276`, `docs/lifesim/TATAME-V3.md` §C.4 (brace path).
- Change: white belt 0 stripes starts with 3 moves (`collar_tie`, `double_leg`, `passar`); `hook_sweep`, `posture`, `armbar` move to stripes 1-3. For the first 3 wins the partner's attacks auto-brace (no defense pad); the defense pad arrives with stripe 1 and its own 3 coach notes. The grips/brace/control/Ritmo row is hidden until stripe 1. Pick cards show name + chevrons until the first win; "does"/"risk"/badge after. Lobby shows the suggested partner and a "Mais parceiros" fold.
- Acceptance: a first match asks the player to learn ≤4 words and ≤5 controls; `boutLogic.test.ts`, `matFight.test.ts`, `matSim.test.ts` updated for the new unlock order; old profiles with stripes keep their moves (unlock order is monotonic).
- Note: belts and stripes already earned are untouched; this only changes what the empty white belt has.

**C2. One cart game in the beta, taught like Correria.** (Tier A)
- Files: `packages/shared/src/feiraGames.ts:10, 25` (config and rotation), `apps/client/src/ui/feiraGames.ts:47-70` (intro modal), `apps/client/src/ui/feiraStage.ts:477-485` (HUD digits), `packages/shared/src/feiraTapioca.ts:24-50`, `apps/client/src/ui/correriaPracticeLogic.ts:22-67` (the coach-mark pattern to reuse), `apps/client/src/ui/howToPlayData.ts` entries `tapioca`, `pastel`, `caldo`.
- Change: default config `on` for Tapioca only, no rotation (Pastel and Caldo stay implemented, switchable from the admin dashboard; the stale "Caldo not implemented" comment at `feiraGames.ts:8` is updated). Tapioca gets a one-customer practice with one coach mark per action and no auto-opening card; its clock becomes a sun arc or the freguesia meter, its score becomes the customers' faces (no digits). If Pastel is turned on later: no combos before run 3 (`feiraPastel.ts:113`), no brick/fire stages in the first run.
- Acceptance: the feira cart teaches by doing; the `tapioca` how-to card has `autoOpen: false`.
- Tests: `feiraGames.test.ts` (shared and server), `feiraTapioca` tests, `scripts/e2e-stalls.mjs`.

**C3. Trim Correria's first-shift modifiers and its end card.** (Tier B)
- Files: `packages/shared/src/correria.ts:57, 63, 76, 178-183, 202-207, 217-221, 567, 607`, `apps/client/src/ui/correria.ts:636-660`, `apps/server/src/correria.ts:148-158`.
- Change: extra-hot coffee off until level 2; listening-only orders at level 1 start at 0 (the `verde` row already does for wave 1; make waves 2-3 also 0 at level 0); one orange size until `cafe_rapido`; packing lesson at 8+ items; fold the 4 star unlocks into the shift ladder (one progression, not two); first shift 2 waves. End card: RV, stars, words, one "next" line. Delete the unrendered server `lesson` computation.
- Acceptance: a first shift has no coffee-temperature or juice-size decisions; the end card has ≤4 rows.
- Tests: `correria.test.ts` (shared and server), `correriaLogic.test.ts`, `scripts/e2e-meveum.mjs`.

**C4. Pet shop: two tabs, no paywall card in the panel.** (Tier B)
- Files: `apps/client/src/ui/petShop.ts:76-104` (gate), `:315` (tabs), `:294` (Lojinha).
- Change: tabs Adotar and Meus pets; Lojinha only once a pet is owned; equip slots and the command sheet behind "?"; the Apoiar card leaves the panel (Seu Dito's dialogue can mention supporters in one line; the existing line at `:103` can move there). Keep petting, reading and photographing fully open, as now.
- Acceptance: a free player's pet shop panel has no inert buttons and no subscription copy.
- Tests: `petShopLogic.test.ts`, `petShop.test.ts` (server), pet-shop shot scripts.

**C5. Hide the Cartela until two of its activities have been touched** (merged into B5).

**C6. Checkers: add Portuguese or hide at S3.** (Tier C) `apps/client/src/ui/checkers.ts` carries no language content; either the pieces call their moves in PT (new TTS) or the board is S3-only.

---

## 9. Suggested execution order

**Tier A (do first; each is a separate PR; independent of each other):** A1, A2, A3, A4, A5, A6 (onboarding); B1 (ladder + HUD gating), B2 (Caderno fold), B4 (tracker and panel), B5 (hide Cartela and kiosk); E1, E2, E3 (dialogue), E6 (delete Pedido rápido); C1 (bout), C2 (one cart game); D2 (Escola home).

Suggested grouping into PRs so that e2e scripts are touched once per area: (1) A1+A2 "hall and airport", (2) A3+A4+A5+A6 "arrival and cards", (3) B1 "disclosure ladder and HUD", (4) B2 "one word home", (5) B4+B5+E3 "favors and daily loops", (6) E1+E2+E6 "one box per click", (7) C1 "stage the bout", (8) C2 "one cart game", (9) D2 "Escola first visit".

**Tier B:** A7, B3, B6, B7, C3, C4, D1, D3, E4.

**Tier C:** A8, A9, B8, C6, D4, D5, D6, E5.

**Do not do in this round:** add cards, notes, tooltips or toasts; redesign art; change the server's authority model; touch billing beyond hiding its UI; change the 48-minute clock itself.

---

## 10. How to tell it worked

Measure a fresh account in the solo build (`VITE_LOCAL_WORLD=1`, `pnpm e2e:solo` for the mechanics) and by hand:

| Metric | Today | Target after Tier A |
|---|---|---|
| Screens/cards before the first favor | ~25 | ≤12 |
| Instructional words before the first favor | 1,500+ | ≤400 |
| Distinct concepts before the first favor | ~75 | ≤25 |
| HUD elements at S1 (desktop) | ~25 | ≤10 |
| Counters visible at S1 | up to 8 | 1 (RV) |
| Boxes per NPC click | up to 4 | 1 |
| Chips per box | up to 6 | ≤4 |
| Toasts in the first 10 minutes in the Vila | 15-25 | ≤5 |
| Words that end up in two ledgers | all | none |
| Controls to learn in the first bout | 17 + 9 keys | ≤5 |

Add a client test, `apps/client/src/ui/disclosure.test.ts`, that walks a fixture profile through S0→S3 and asserts the §3 table, so the ladder cannot regress the way the HUD did. Add a lint-style test that fails when a `kind: 'place'` how-to card has `autoOpen !== false`.

---

## Appendix: reviewer notes on things that are already good

- Fishing: one gesture, one label, no digits, no auto card. Copy this pattern.
- Correria practice round and coach marks: one action per mark, shown once, replayable from "?".
- The belt chip waits for a gi. The `hudShows` pattern is the right shape; §3 generalises it.
- The Diário's empty slots that say how to find a word: they are a guide that costs no reading. Keep, but cap per chapter (B3).
- "No math at the feira" (one-tap Pagar) is the right kind of removal and the model for C2 and C3.
- Bate-papos replacing the graded Conversa (#243) was a simplification in the right direction; E2 only moves when the chip appears.
