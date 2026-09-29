# Vila Ipê: decisions log

Locked decisions come from [HOWTO.md](./HOWTO.md) section 3 (copied below, unchanged). Everything after that is what each phase or track decided where the HOWTO left a detail open, or where it deliberately deviated. Append new items as a section per phase; don't edit old ones.

## Locked decisions (HOWTO section 3)

| # | Decision | Why |
|---|---|---|
| D1 | **Top-down ¾ pixel art on a 16×16 px tile grid.** Characters are 16×32 px frames. | Stardew/Eastward look. It's the most widely available asset style and the most forgiving to produce consistently. |
| D2 | **Engine: Phaser 3** (latest 3.x release). Don't use Phaser 4, PixiJS, Three.js or a custom WebGL layer. | Tilemaps, cameras, sprite animation, particles, tweens and FX built in. Very well documented. |
| D3 | **Phaser is a view only.** Phaser input is fully disabled. `main.ts` keeps owning input, networking and state. The Phaser scene reads `game` (from `state.ts`) every frame and draws it. Never store game truth in Phaser objects. | Keeps the server-authoritative design and the existing UI logic intact. |
| D4 | **The server stays authoritative and tile-based.** Movement stays A* over tiles (`findPath`), with `move` messages and `positionAlong` interpolation. Keyboard and joystick movement send `move` to nearby tiles. No client physics. | Zero protocol risk; `world.ts` keeps working. |
| D5 | **Tile coordinates don't change meaning.** `x` goes right and `y` goes down on screen. The wire type `Dir` stays `'SE' \| 'SW' \| 'NE' \| 'NW'` and is mapped to facing: `SE→E`, `SW→S`, `NE→N`, `NW→W` (section 5.2). | The existing rooms render top-down immediately, with no server or protocol change. |
| D6 | **Art comes from files, never from code.** The new renderer must not draw props, buildings, characters or terrain with canvas paths. Only light gradients, particles and placeholders may be generated. | That's why the current look plateaued. |
| D7 | **Base art = a purchased commercial pixel pack in the modern-city style**, extended with custom Brazilian set pieces in the same style (section 4.3). | The only way to reach "beautiful" at this scope and speed. |
| D8 | **Text is DOM, not pixels.** Nameplates, speech bubbles, hover labels, the dialogue box, signs you read, and HUD text are HTML positioned over the canvas. Only very short in-world words painted into signs (for example "PADARIA") are pixels. | Crisp at every zoom, keeps accents (ã ç é õ), accessible, reuses the current CSS. |
| D9 | **Learning text uses a legible font.** Portuguese sentences and English glosses stay in Nunito (already loaded). Pixel fonts are for headings, labels and numbers only. | Learners must be able to read *você, não, açaí* instantly. |
| D10 | **Maps are authored in TypeScript** (`rooms.ts`): terrain as ASCII rows with autotiling, objects as coordinates. There is no Tiled/LDtk dependency. | An agent can write and review maps as text. The server already reads this format. |
| D11 | **A shared game clock** where 1 game day = 48 real minutes, computed deterministically from server time (section 5.7). | Everyone sees the same sky, and everyone gets to see every time of day. |
| D12 | **Every learning activity is reachable at every game hour.** Schedules can move NPCs around, but a learning loop is never locked behind the clock. If an NPC is away, a named colleague covers. | Learners play whenever they have 15 minutes. |

---

## Decisions made in Phase 1 (art intake + style frame)

Each item is a decision the HOWTO left open, or a deliberate deviation from it.

### Art sourcing

1. **Custom Brazilian pieces: route (c), agent-made.** No artist and no AI image tool, so each custom piece is either
   *derived* from a LimeZu sprite by an edit in the import script, or *hand-authored* as a pixel grid / rects with LimeZu palette
   colors only. Sources in `apps/client/assets-src/custom/` (`.mjs` generators + rendered PNGs in `custom/png/`).
   Derived: ipê amarelo (large + medium), shopfronts (plaque text). Authored: calçada petit-pavé, São Paulo mosaic, banca,
   petals, zebra crossing, lane dashes, flowers, tufts, grime. Nothing is a placeholder on the frame.
2. **Credits.** `apps/client/assets-src/LICENSES.md` summarizes both LimeZu licenses (credit + limezu.itch.io, no redistribution of
   raw files). The frame footer shows "Art: LimeZu — limezu.itch.io". The in-game credits screen is a later phase.
3. **Only the 16x16 folders** of the packs are used. `public/pixel/` holds only what `import-map.json` lists (about 145 KB).

### Terrain

4. **Mask tiles are derived from a fill, not converted from the pack autotiles.** LimeZu's autotiles (47-tile blobs and the
   RPG-Maker style sheets) paint "terrain X over a base terrain" with both sides opaque, which can't be layered one terrain per
   layer, and they aren't corner-mask sets. `scripts/lib/pixel/terrain-gen.mjs` builds the 16 corner-mask tiles from the terrain's
   fill tile (quadrant union, chamfered convex corners, navy outline, lit lip, 3 px curb wall, down-right contact shadow).
   Documented in `assets-src/README.md`; tested for "no seams" (adjacent display tiles agree along every shared edge).
5. **Two terrain kinds.** `slab` terrains (calçada) draw on top with edge tiles; `flat` underlays (grama, asfalto) draw first and
   are opaque wherever any corner is that terrain. This deviates from the priority list in HOWTO 5.6, which puts `g` above `c`:
   with a dual grid that draws grass over paving, the grass would need transparent-edged tiles; the city look wants a curbed
   slab over grass instead. There is no flat-to-flat transition art yet (no such edge exists on the P1 map).
6. **The wave has two phases.** A 32 px wave over 16 px tiles: tile index = `first + (i mod 2) * 16 + mask`
   (`phasedIndex`, tested). Grass and asphalt use hash-picked fill variants (`tileIndex`).
7. **Mosaic is 3x2 tiles (48x32), not 2x2.** The state's aspect ratio is about 1.6:1; at 2x2 it was an unrecognizable blob.

### Manifest (differences from the sketch in HOWTO 5.12)

8. `terrain` = `{ tileset, tile, margin, spacing, columns, count, layers: { c: { first, phases, variants, edge } } }` (extruded
   tileset via `tile-extruder`, `margin 1 / spacing 2`). Atlases also list their JSON (`data`). Sprite entries gain optional
   `shadow` (contact shadow key), `cast` (generated cast-shadow frame), `light`, `windows` (glass rects for lit windows) and
   `decal`. Extra top-level keys: `sheet` (canonical character sheet layout + animation table), `keyRamps`, `fx`.
   Anchors may lie outside the sprite (canopy overhead parts): `ay` is measured in the sprite's own coordinates.

### Characters

9. **Layered sheets, no GUI tool.** Source rows -> canonical rows are in `assets-src/README.md`. Idle and walk are 6 frames
   (the pack's count) instead of "up to 4" idle. Sit W/E come from the pack; sit S/N are the idle frame lowered 4 px (the bench
   seat hides the legs). The 5 emote rows are **placeholders that reuse idle S** (the pack has no such art).
10. **Eyes are baked into the body layer**; outfits are one layer covering top + bottom (`outfit_*`), so P1 has no separate
    `top_*` / `bottom_*` / `shoes_*` layers. Phase 3 decides whether to split them or accept the pack's outfits.
11. **Key-ramp swap is reusable pure code** (`palette.ts`, unit-tested): `buildRamp`, `rampMap`, `swapKeys`, `keyMapForShades`.
    Layers are stored in exact key colors (`KEY_RAMPS`); the import script maps each layer's source shades to key ranks by luminance.
12. `charsheet.ts` has its own `CANON_FACING_ROW` (S 0, W 1, E 2, N 3) so P1 doesn't depend on Phase 0's `facing.ts`
    (this branch must not touch it). On merge, replace it with `FACING_ROW` from `facing.ts`.

### Rendering / lighting (style frame)

13. **Two cameras.** `main` (integer device zoom) draws the world; `fx` (zoom 1, screen space) draws the grade, the night
    darkness and the additive glow, so light stays smooth at screen resolution while sprites stay crisp. Non-integer scaling
    is used only on light textures (glow, cloud shadow); no sprite is ever scaled non-integer or rotated.
14. **Grade is a MULTIPLY render texture with holes.** Light sources erase holes in it (and in the darkness overlay), so lamp
    pools and lit windows aren't tinted by the grade; additive glow sits on top. This is what makes the night readable.
15. **Golden-hour keyframes were softened** for beauty: 16:30 `#ffe3bd`, 17:30 `#ffcd9e`, 18:18 `#f2a48f`, 19:00 `#7a78ae`
    (the HOWTO suggested `#ffd9a0 / #ffbd80 / #e08c78 / #6b6fa8`, which turned greens olive and stones brown). A separate warm
    "low sun" glow (`sunGlow`, peaks at 17:30) adds warmth without darkening. Cast shadows stay cool navy against the warm ground.
16. **Zoom on the frame is 3 on both screenshots** for composition: desktop shows 26.7 x 16.7 of the 30 x 18 tiles; the phone
    shot is 8 tiles wide. The game's zoom rule (HOWTO 5.3) would give 4 on desktop and 2 on phone; at 2 on a phone the 18-row
    slice is shorter than the 26 visible rows, so the real map (Phase 5) must be larger than the viewport or have a backdrop.
    Camera position and zoom are URL params (`?zoom=4&cx=16&cy=9.5`).
17. The frame draws DOM nameplates and a bubble over the canvas (HOWTO D8) so text stays crisp and accents render
    ("Pão de queijo, açaí, você, não, avó, Nº 42"). Nunito loads from Google Fonts; the page falls back to system-ui offline.
18. **Shop plaques** are LimeZu "STORE" plaques with the text replaced by a 3x5 pixel font: PADARIA, MERCADO, FLORES, LANCHES,
    SAPATOS, PIZZA; and the banca sign says BANCA. Words without accents on purpose (D8: only very short words in pixels).

### Tooling

19. New root devDeps `sharp`, `tile-extruder`; `phaser@^3` in `apps/client` (resolved 3.90.0, the last 3.x). Root script
    `"pixel": "node scripts/pixel-import.mjs"`. The import script loads `palette.ts` / `terrain.ts` directly with Node's type
    stripping, so the runtime and the import share one implementation (those two files must stay free of relative imports and of
    non-erasable TypeScript syntax).
20. `vitest.config.ts` now also includes `scripts/lib/**/*.test.mjs` (tests for the import helpers).
21. `lifesim-frame.html` is a separate Vite entry (`lifesimFrame`), not linked from the game; the game's own bundle is unchanged
    (Phaser is only in the frame entry's chunk, about 1.2 MB / 328 KB gzip).
22. Environment note (Windows): `pnpm` was not on PATH, `corepack pnpm` works. Two tests fail on this machine both before and after
    this change (`safety.test.ts` compares `\\` vs `/` paths, `curriculum.test.ts` me-ve-um-orders sync fails under CRLF checkout).

### Needs BR review

Every new PT string is marked here so it can go into the content review list: shop plaques PADARIA, MERCADO, FLORES, LANCHES,
SAPATOS, PIZZA; sign BANCA; frame demo bubble "Boa tarde! Pão de queijo, açaí, você, não, avó, Nº 42" (gloss: "Good afternoon!
Cheese bread, açaí, you, no, grandma, No. 42"). None of it enters the game yet. No new curriculum cards were added.

## Decisions: logic track 2 (recados, bag, bonds)

Scope: HOWTO Phase 8 steps 1, 2 and 4, plus the data model. Server engine only. No client, no schedules (step 6), no NPC memory (step 5), no tutorial re-skin (step 3), no final 15 recados (step 7).

### Where things live

| Piece | File |
|---|---|
| Types, `ITEMS`, bag helpers, step logic (`stepMatches`, `advance`), daily offer (`offerFor`, `rollRecadoDay`), the 4 starter recados, wire views | `packages/shared/src/recados.ts` |
| Bond points, `hearts`, gains, milestones (data only) | `packages/shared/src/bonds.ts` |
| `HOTSPOTS` (empty, typed), range and distance helpers | `packages/shared/src/hotspots.ts` |
| `RecadoTracker` (`onEvent`, `give`, `read`, `request`, `onConversaEnd`) | `apps/server/src/recados.ts` |
| Profile defaults on load | `normalizeProfile` in `apps/server/src/store.ts` |

### Decisions

1. **Item ids reuse the padaria shelf ids** from `meveum.ts` (`pao`, `pao_de_queijo`, `cafe_com_leite`, and the rest of the shelf). There is no `pao_frances`: bread is `pao`. `ITEMS` is the whole shelf (names come from the cards, no invented PT) plus `jornal`, `flores`, `banana`, which have no cards yet (see "Proposed cards").
2. **`give` sends no quantity.** The server hands over exactly what the active `entregar` step asks for (its `qty`). If no active step wants that item for that NPC, nothing is taken (an info notice says so), so a player never loses an item by mistake.
3. **"Adjacent" for `give` = Chebyshev distance <= 1 to the NPC's tile OR to the NPC's `interact` tile.** NPC tiles are blocked and the interact tile is 1-2 tiles away (Seu Carlos at (3,1), counter spot (3,3)), so a strict "<= 1 tile from the NPC" would make Carlos and Nanda impossible to reach. The NPC must be in the player's current room.
4. **`read`**: distance <= 3 (Chebyshev to the nearest tile of the hotspot's footprint), same room, and the id must be in `HOTSPOTS`. Unknown ids get `error: hotspot`; far ones `error: far`. The list is empty today, so every `read` is refused until hotspots are authored.
5. **Bag** is capped at 20 per item (`BAG_MAX_PER_ITEM`). Items enter the bag when an order succeeds: a finished Carlos scene (food and drink from the scene context, `nada` dropped), a correct Me vê um order (its lines), a Conversa order (see 9), or a recado's `reward.itemId`. They leave only through `give`.
6. **`recados.done` means "finished today"** and is cleared at game midnight, so recados come back the next game day (repeatable, and RV is paid on each completion). `active` recados carry over across days. The offer is rolled once per game day from the bond the player has at that moment; a bond that rises mid-day unlocks new recados the next game day. The RNG is seeded from (profile id, game day), so the offer is stable across reconnects.
7. **Extra state fields** (allowed by the task): `recados.talked` (NPCs that already gave the daily talk bond today) and `recados.graded` (NPCs that already gave the good-Conversa bond today). Both reset with the day. A never-rolled profile has `day: -1`.
8. **Max 3 active recados** (`RECADO_MAX_ACTIVE`), matching the "max 3 lines" tracker in the HOWTO. `accept` needs the id to be in today's `offered`.
9. **Conversa runs over HTTP** (`/api/conversa`), not the WebSocket, so the hook is a new optional `onConversaEnd` dep in `conversaApi.ts` (wired in `app.ts` to `World.conversaEnded`). It counts as a talk (+2, once per game day), and a `pass` grade earns +3 (once per NPC per game day). Today the turn responses always carry `order: {}`, so no order items are passed; `onConversaEnd` and `World.conversaEnded` already accept an optional `ConversaOrder` for when the order is tracked.
10. **Talk events exist only for Seu Carlos** (scene start). Nanda and Júlia have no talk interaction yet, so a `falar` step for them cannot complete until the Phase 7 dialogue box adds one (the tracker's `onEvent({ kind: 'talked', npc })` is ready). The starter recados avoid `falar` for that reason, and avoid `ler` (no hotspots yet), so none is a dead end.
11. **Greetings**: `greetingKind(text)` reads bom dia / boa tarde / boa noite / oi / olá (accent- and case-insensitive; the time greetings win). `timeCorrect` requires the greeting to equal `greetingFor(minute)`; plain `oi` never satisfies a `timeCorrect` step. The hook sits next to the daily mission's Cumprimenta check and does not change it. The event carries `company` (someone else was in the room), and a greeting to an empty room does not count unless an NPC is within 3 tiles (the tracker fills `npc` with the nearest NPC within 3 tiles).
12. **Rewards** go through the existing `World.reward` (coins, `reward` message, profile push). Bond is added to the giver. A `notice` (level `reward`) carries the giver's `thanks` line prefixed with the NPC's name. Each step also sends a `✓ <step>` info notice, like the mission does.
13. **Milestones are data only** (`BOND_MILESTONES`, `milestonesCrossed`). No effect and no notice is wired.
14. **Old saves**: `normalizeProfile` runs when the store indexes a profile (load and `add`) and defaults `bag`, `bond`, `recados`, dropping unknown keys and bad values without throwing. Solo mode uses the same store.
15. **Untouched**: `MISSION_*`, the daily mission, tutorial flags and their tests. Recados run alongside them. Making the mission the first recado of the day is not done here (HOWTO step 2 says to keep its copy and RV rule; that is a UI/board concern for a later track).

### Protocol additions

Client to server:
- `{ t: 'give'; npc: NpcId; itemId: string }`
- `{ t: 'read'; hotspotId: string }`
- `{ t: 'recados'; action: 'accept' | 'list'; id?: string }`

Server to client:
- `{ t: 'recados'; day: number; offered: RecadoOfferView[]; active: RecadoActiveView[]; done: string[] }`, sent on `list`, on every join, and after any change. `offered` excludes recados already active or done today. `RecadoActiveView.hint` is the one-line instruction for the current step.
- The bag and bond arrive on the existing `profile` push (`PrivateProfile.bag`, `.bond`, `.recados`). Rewards reuse `reward` and `notice`. Errors reuse `error` (codes `give`, `far`, `bag`, `hotspot`, `recado`).

### Proposed cards (no card exists; not added)

`jornal` (newspaper), `flores` (flowers), `banana`. Also `mochila` (bag) if the client labels the inventory in PT.

### Needs BR review

Listed in the task report; every string is marked `needs_br` in code comments. Includes the four starter recados, the step lines in `describeStep`, the milestone labels, and the error and notice copy in `apps/server/src/recados.ts`.

## Decisions: logic track 3 (Caderno de palavras backend, NPC memory)

Scope: HOWTO Phase 7 step 3 (server side) and Phase 8 step 5. Server and shared only. No client, no panel, no audio wiring.

### Where things live

| Piece | File |
|---|---|
| `cardsInText`, `maskCards`, `recordSeen/Heard/Used`, `groupProgress`, `completedGroups`, `isLearned`, normalizers, `CADERNO_GROUP_RV` | `packages/shared/src/caderno.ts` |
| `normalizeNpcMemory`, `vetMemory`, `templateMemory` | `packages/shared/src/npcMemory.ts` |
| `memoryPromptBlock`, `MEMORY_MAX_CHARS`, `buildCarlosSystemPrompt(subject, ctx, memory?)`, `ConversaTurnRequest.memory` | `packages/shared/src/conversa.ts` |
| `CadernoTracker` (`seen`, `used`, `heard`, group payout) | `apps/server/src/caderno.ts` |
| `ConversaMemory` (Conversa log, template + AI summary, storing) | `apps/server/src/conversaMemory.ts` |
| `summarizeConversa`, `MEMORY_SUMMARY_SYSTEM_PROMPT` | `apps/server/src/services/xai.ts` |
| Profile defaults on load | `normalizeProfile` in `apps/server/src/store.ts` |

### Caderno

1. **Profile fields** (all optional, defaulted on load, junk dropped): `caderno`, `cadernoPaid` (group ids already paid), `npcMemory`.
2. **Card matching** reuses the typed-answer forgiveness (`normalizeAnswer`: accents, case, punctuation, digits to words, obrigada = obrigado, uma = um) plus hyphens as spaces. Whole-word only, longest form first and consumed, so "café com leite" counts one card and not also "café", and "pão de queijo" does not count "pão". Forms are `form` and `plural`, each side of a slash. `accepts` are not used as forms (they are typing variants, mostly redundant with `form`).
3. **Groups** come from the card id (`lex.<group>.<name>`): `padaria` (Padaria, 28 cards), `social` (Cumprimentos, 10), `num` (Números, 20). The `places` field is unusable for this (most cards have `[]` or `["*"]`). A new pack with a new id segment groups itself (label falls back to the segment name).
4. **Learned card**: `used >= 1`, or `seen >= 1 && heard >= 1`. Seeing alone or hearing alone is not enough. A group is complete when every card in it is learned. This is my call; HOWTO only says "completing a group".
5. **Events**
   - `seen`: the Carlos scene start view, every scene node the player is shown (after each chip or typed answer), each Conversa NPC line (opener and replies), and a hotspot read (its `cards` plus any card found in its `pt`).
   - `used`: a typed scene answer the accept list matched to a chip (safety already passed), a chat line that was delivered (any card form in it), a Conversa player line that passed Gate A (warn lines deliver, blocked ones do not). Chips (clicked) are not `used`, and neither are Me vê um orders.
   - `heard`: new `ClientMsg` `{ t: 'heard'; cardIds: string[] }`.
6. **`heard` validation**: an array of 1 to 10 strings, each a known card id (repeats count once). Anything else gets `error` code `heard`. Rate limit: 4 messages per second per session; extra ones are dropped silently (a mashed 🔊 button is not an error the player should see).
7. **Payout**: `CADERNO_GROUP_RV = 15`, paid through `World.reward`. The group id is pushed to `cadernoPaid` before paying, so it can never pay twice, and it survives reconnects. Reward reason: "Caderno completo: <grupo>!".
8. Every change saves (debounced) and pushes the profile, so the future panel can read `profile.caderno`.
9. **Hook budget**: `world.ts` grew by 17 lines. `RecadoTracker` gets an optional `onRead(s, hotspot)` dep so the hotspot hook lives next to its `read` validation.

### NPC memory

1. **The Conversa runs over HTTP and `end` carries no transcript**, so `ConversaMemory` keeps a short in-process log per (player, NPC) while a Conversa runs: last 14 lines, 240 chars each, at most 200 logs, 3 h expiry, dropped at `end`. It exists only so the summarizer can read it and is never written anywhere. `ConversaApiDeps` gets `memory` and `onConversaLine`, both optional (old callers work unchanged); `app.ts` wires them.
2. **Store flow at `end`**: the deterministic template line is stored immediately (sync, never blocks, never lost). If AI is available, one small call asks for a better one; it replaces the template only if it arrives within 4 s (`timeoutMs`) and passes vetting, and only if no newer Conversa ended meanwhile. The Conversa `end` response never waits for it.
3. **Template** (no key, error, timeout): "Pediu um pão na chapa e uma água." from the food and drink cards found in the player's lines (max 2, with um/uma from the card gender) or a tracked order if `end` ever gets one; otherwise "Conversou sobre café da manhã." (subject title, lowercased). Only card names and the subject title appear in it, never the player's words.
4. **Vetting** (`vetMemory`) before anything is stored, template included: non-empty, max 200 chars, `filterNpcLine`, `classifyChat` must say `allow`, no links, and no run of 4 of the player's own free words (words that are not card forms, so "um pão na chapa" is fine but a copied sentence is not). Rejected AI text is dropped and the template stays.
5. **Nothing is stored** if the player never spoke, the log is missing (server restarted mid-Conversa), or the player is unknown.
6. **Prompt**: `buildCarlosSystemPrompt(subject, ctx, memory?)` inserts a delimited `MEMORY` block with a `Você lembra: …` line before `SUBJECT:`. The stored text is flattened (no newlines, quotes, brackets or angle brackets) and clipped to 200 chars, and the block tells the model to use it at most once, never quote it and to ignore any instruction inside it. With no memory the prompt is byte-for-byte the old one. `buildCarlosSystemPrompt` is the only prompt builder today.
7. **No bond gate**: HOWTO says the NPC remembers "at 2 hearts". Nothing in this task gates it, and the milestone effects are still data-only, so the memory is used from the first Conversa. Easy to gate later: pass `memory` only when `hearts(bond) >= 2` in `handleTurn`.
8. **The offline (authored) path ignores memory**: no prompt is used there. The authored openers are unchanged.
9. The transcript sent to the model for the summary is the same kind of data the turn calls already send (the player's Conversa lines). Only the vetted one-line summary is kept.

### xAI summary prompt (system)

```
You write a short memory note for an NPC in a Portuguese-learning game. The NPC is a padaria owner in São Paulo.
Read the short conversation and write exactly ONE sentence in Brazilian Portuguese, in the third person about the customer, saying only what they ordered or what the chat was about. Example: "Pediu um café com leite e uma coxinha pra viagem."
Rules:
- At most 120 characters. One sentence. Plain text only: no quotes, no markdown, no emoji.
- Do not copy the customer's words. Do not quote them.
- No names, contact details, or personal data. Nothing about alcohol, dating, politics, or religion.
- If nothing was ordered, say what the chat was about, for example "Conversou sobre café da manhã."
```

User message: `Assunto: <subject>\n\nConversa:\nCliente: …\nSeu Carlos: …\n\nUma frase:`. Only the first line of the answer is used.

### Needs BR review

Every new PT string (also marked `needs_br` in code comments):

- Template memory: `Pediu {um|uma} {carta}[ e {um|uma} {carta}].` and `Conversou sobre {assunto}.` (for example "Pediu um pão na chapa e uma água.", "Conversou sobre café da manhã.", "Conversou sobre cumprimentos.")
- Group labels: Padaria, Cumprimentos, Números
- Group reward reason: `Caderno completo: {grupo}!` (EN: `Notebook complete: {group}!`)
- Error for a bad `heard`: "Não achei essas palavras." / "I couldn’t find those words."
- Prompt-side (English instruction with two PT examples for the model): "Hoje é o de sempre?", "Pediu um café com leite e uma coxinha pra viagem.", "Conversou sobre café da manhã."

### Proposed cards

None new. `jornal`, `flores`, `banana` from logic2 still have no cards, so they cannot enter the Caderno.

### Not done here

The panel, the 🔊 button wiring, hotspot authoring, and the bond-2 gate on memory (see 7).

## Decisions: art track 2 (portraits, feira, icons, UI kit, redraws)

Branch `lifesim/art2-portraits-feira-ui`. Contact sheets in `docs/lifesim/shots/art2/`: `portraits.png`, `feira.png`, `icons.png`, `ui.png`,
`fixes.png` (before | after), plus frame shots (`frame_*.png`, `frame_1730_feira_z4.png`). `pnpm pixel` is deterministic (two runs give identical
hashes for `public/pixel/**` and `custom/png/**`), output grew to about 370 KB.

### Pipeline

1. **Standalone images for the DOM.** Portraits, icons and the UI kit are shown by HTML (`<img>`, CSS `border-image`) at 2-4x, so they are
   separate PNGs under `public/pixel/{portraits,icons,ui}/`, not atlas frames. New `images` list in `import-map.json` (`{ "fn": ... }`),
   generators registered as `IMAGES` in `custom/derive.mjs`, output in a new top-level `manifest.images[key] = { file, w, h, ...meta }`.
   `apps/client/src/render/pixel/manifest.ts` (owned by the P2 agent) does not know this field yet; the integration should add
   `images?: Record<string, { file: string; w: number; h: number; slice?: {...}; css?: string; frames?: number; frameW?: number; fps?: number }>`.
2. **World pieces stay atlas sprites** (`feira/*`, `vehicles/*`, `critters/*`, `ui/guide_arrow`), through the existing `derive` kind.
3. `custom/paint.mjs` is a small painter shared by the new generators (`shape` = a mask lit as an ellipsoid from the upper left with a 4-tone
   ramp and a navy / tinted outline, `grid`, `ring`, `hoop`, polygon and profile predicates). `scripts/pixel-contact.mjs` now takes
   `--set art1|portraits|feira|icons|ui|fixes` and draws 9-slices stretched to two sizes so slice insets can be checked by eye.
4. Tests: `scripts/lib/pixel/art2*.test.mjs` (sizes, hard alpha, expressions differ, feira parts and overhead links, icons cover every bag
   item, 9-slice insets leave a flat stretch centre).

### Portraits (5 NPCs x 4 expressions, 64x64)

5. **Authored, no base art.** `UI_16x16.png` (the only Interiors UI sheet) has speech bubbles and emotes, no faces; the character generator
   heads are 16 px tall. So each portrait is drawn from shapes: a bust in a 2 px wood frame with a soft diagonal light backdrop (cream, sky, leaf
   green, night lilac, peach per NPC), skin from the pack's body ramps (tan, light, brown, deep, warm), hair from the pack hair ramps.
   `neutro / feliz / surpreso / pensativo` differ in eyes (open, closed arcs, wide, half-lidded looking up), brows (flat, raised arcs, high,
   one raised and one lowered) and mouth (line, open smile with teeth, "o", crooked); `feliz` adds blush.
6. **Appearances (invented, please review with the NPC art direction):** Seu Carlos: white baker's cap, salt-and-pepper mustache and sideburns,
   white apron over a terracotta shirt. Nanda: her own straw hat (terracotta band), dark curly hair, mustard top, gold hoops and chain.
   Júlia: chestnut side-parted hair, sky-blue blouse, red guide lanyard with a badge, a small green scarf. Dona Graça: grey bun, round glasses,
   wrinkles, pale-blue apron over a plum top. Tia Lu: red polka-dot headscarf with a bow, green top with an orange apron, bead necklace, hoops.
   Keys: `portraits/carlos_*`, `nanda_*`, `julia_*`, `graca_*`, `tia_lu_*`.
7. Light is upper-left, outlines are navy against the backdrop and a tinted dark between parts (sel-out), no gradients (one dithered diagonal
   light band in the backdrop, in the pack's dither style).

### Feira livre (3x2 footprint each)

8. **Four open stalls** `feira/frutas | verduras | pastel | flores` and four folded variants `feira/<name>_fechada`. The standing part is 48x44
   (bottom 32 px = the 3x2 footprint); the striped tarp is a separate `overhead` sprite `feira/<name>_tarp` (56x24, scallop tips end 9 px below the
   top of the standing part), same convention as `props/barraca_chapeus`. Closed: goods hidden under a tied sheet of the stall's colour, tarp rolled
   on the crossbar (`feira/<name>_roll`, overhead). Tarp colours: red (frutas), green (verduras), yellow (pastel), blue (flores), each with cream.
   The pastel stall has the glass case of pastéis, a fryer, a blank menu slate and the caldo de cana press (green cabinet, hopper, flywheel,
   cane bundle, jug). `feira/caixotes` (1x1, stacked crates with oranges). Price tags are blank (prices are DOM text): `feira/preco_papel`,
   `preco_lousa` (little chalkboard on a stick), `preco_placa`; the stalls also have three blank cream tags hung on the table front.

### Icons (16x16, `icons/<itemId>`)

9. All 15 bag items: `pao`, `pao_na_chapa`, `pastel`, `coxinha`, `bolo` (bolo de cenoura with chocolate), `cafe`, `cafe_com_leite`,
   `suco_de_laranja`, `agua`, `pao_de_queijo`, `misto_quente`, `guarana` (unbranded green can with a yellow band and the red berry), `jornal`,
   `flores`, `banana`. The packs only have a handful of tiny bread/bottle pieces (kitchen and grocery sheets, 6-12 px), so none is cropped.

### UI kit

10. **Panel** `ui/panel` 20x20, slice 7 (cream `#f5e6d3` paper, 1 px warm ink `#573c2c` edge, terracotta `#c45c26` trim, mustard rivets in the
    corner slices). **Bubble** `ui/bubble` 30x27, slice `7 7 13 16`: cream paper, pack navy outline, tail bottom-left inside the left slice (put the
    tail side under the speaker; mirror in CSS with `scaleX(-1)` for the other side if needed). **Button** `ui/button`, `_hover`, `_pressed`
    16x16, slice `6 6 7 6` (terracotta, lit rim, shaded lip; pressed sinks 1 px). The manifest carries `slice` and a `css` string
    (`"top right bottom left"`), see the README for the CSS snippet.
11. **Guide arrow:** chunky terracotta down arrow, 4 bounce offsets (4, 2, 0, 2 px), as `ui/guide_arrow_strip` (64x20, for a CSS steps animation)
    and as an atlas sprite `ui/guide_arrow` (anchored at the bottom centre). The pack's own bobbing arrow is only 8 px wide, too small over a
    door at world scale, so this one is authored after it (outline and shading), not derived.

### Fixes from art track 1

12. **Kombi** (authored now, no longer a repainted camper): white over turquoise, split windscreen, white V on the turquoise nose with the emblem,
    round headlights, chrome bumper and belt line, sliding-door seams; the east end is turned slightly toward the viewer so the V reads. 68x46.
13. **Fusca**: round dome cabin, separate front and rear fender bulges over the wheels, a bug-eye headlight on the fender, running board between
    the wheels, chrome bumpers, sand-beige (the yellow read as a taxi). 60x38.
14. **Moto**: bigger (44x34) and readable: red delivery box (baú) with a mustard band on the rack, motoboy in an orange jacket with a reflective
    stripe, blue jeans and boots, white helmet with a red stripe and a dark visor, red tank, headlight, mirror.
15. **Vira-lata**: redrawn 24x17 (was 20x14): big head, two perky pointed ears, cream muzzle and chest, curled tail, four legs with pale socks.
    idle x4 (tail wag + blink), walk x4, sleep x2 curled up (round back, tail along the belly, head on the paws with an ear up). Keys unchanged
    (`critters/vira_lata_{idle,walk,sleep}_{e,w}`), the shadow is now `fx/shadow_16` and the anchors moved, so re-check placements.
16. The west variants are still mirrors, so the 1 px lit rim flips (as in art1).
17. Style frame (`frame/layout.ts`): the fruit stall, crates and a price slate on the grass at the right edge (a shot at `cx=25.6&cy=10.6&zoom=4`
    shows them); the fixed vehicles and dog are picked up automatically through their keys.

### Known weaknesses

Portrait faces are stylized and a little flat (shading is cel bands, no dithering); Dona Graça's dark skin reads with low contrast; the dog's neck-to-head
seam is a hard outline; the moto is still busy at 1x; the fusca is closer to a generic 60s sedan with a dome than a perfect Beetle; icons are
recognizable at 3-4x but `guarana` and `agua` are generic.

### Needs BR review

No new Portuguese strings are painted into art (the stalls, tags and tarp have no text). Item and expression names are existing ids.

## Decisions made in Phase 2 (pixel view skeleton behind `?view=pixel`)

Scope: HOWTO Phase 2 steps 1 to 7. The iso view is still the default and is untouched (only `main.ts` gained the view switch, the keyboard block and a joystick option).

### Structure (one implementation for the frame and the game)

1. **Shared modules in `render/pixel/`.** `terrainLayers.ts` (dual-grid Tilemap layers), `lightingRig.ts` (the two-camera grade / shadow fill / darkness / glow rig), `spriteUtil.ts`, plus the Phase 1 `charsheet.ts`, `palette.ts`, `terrain.ts`, `lighting.ts`, `manifest.ts`. `FrameScene` now calls `buildTerrainLayers`, `LightingRig` and `spriteUtil` instead of its own copies; the frame page renders the same as before (checked against the art1 shots). Its label overlay (`frame/labels.ts`) is hard-wired to the frame layout, so the game has its own generic `labels.ts` in the same visual language (plates, cream bubbles) with the CSS classes prefixed `wl-`.
2. **Pure, tested logic is split from Phaser code** so the scene stays thin: `coords.ts` (zoom rule, world/canvas math, camera framing), `hit.ts` (`pickHit` over a hit-box list), `reconcile.ts` (`diffIds`, `syncViews`, `roomKey`), `roomLayout.ts` (walls, doors, decor, skipped west decor), `props.ts` (PropKind to sprite key, anchors, depth), `looks.ts`, `lru.ts`, `ui/keys.ts`. `WorldScene.ts` and `PixelView.ts` hold all the Phaser and DOM code.
3. **Phaser is loaded only for `?view=pixel`.** `main.ts` does `await import('./render/pixel/PixelView')`, so the default bundle does not pay for it (the main chunk grew by about 2 KB). Phaser gets `audio: { noAudio: true }` so it never creates an AudioContext next to the game's own audio, and all Phaser input is off (D3).

### Camera, zoom, backdrop

4. **Zoom** is the HOWTO 5.3 integer rule (`cssZoomFor`, `deviceZoomFor`): 4 on a 1280 wide desktop, 2 on a 390 phone. Fractional DPRs round the device zoom down. `cam.scale` is CSS px per art px (`zoom / dpr`), which is what e2e's `clickTile` multiplies by.
5. **The camera is driven by hand, not by `startFollow` / `setBounds`.** Phaser's bounds clamp aligns a too-small room to the top-left instead of centring it, and HUD insets (top 64 / bottom 110 CSS px, 124 / 168 on phones, same numbers as the iso renderer) need to count. `cameraCenter` does it per axis: a room narrower than the free screen region is centred in it (backdrop `#1d1b26` around it plus the vignette), a bigger one follows the avatar clamped to the room, with an exponential lerp of about 0.12 per 60 fps frame and a snap to the device pixel grid. Desktop interiors do not fit vertically at zoom 4 (padaria 12 x 11 tiles incl. walls vs 156 free world px) so they follow the avatar; on a phone they fit and are centred.
6. **Per-room grade** (`ROOM_HOUR`): `tarde` uses the 17:30 golden-hour grade, `manha` 08:00, `dia` 12:00, through the same `gradeAt` / `shadowFill` / `sunGlow` as the frame. No darkness or lamps until the game clock exists (Phase 6). Lamp lights are registered from the manifest (`light`) and switch on with the night grade later.

### Terrain and walls

7. **Terrain** = the Phase 1 dual grid per room, with `outside: 'x'` so the map border gets real curbs instead of a half tile of terrain spilling off the map. Floor chars with no art: `t`, `k` (brick, checker) are drawn as calçada and `d` as grama (`FLOOR_SUBSTITUTE`), and still reported in `artMissing` as `terrain/t`. Interior floors (`l`, `m`, `j`) are **flat muted fills, not magenta** (`FLOOR_PLACEHOLDER`): a magenta floor made the interiors unreadable in review. Deviation from HOWTO 5.10 (which says magenta at alpha 0.35); everything that is a sprite stays magenta.
8. **Walls are flat fills from the room's own `wallColor` / `wallTrim`** (placeholders `walls/north`, `walls/west`): a north band 3 tiles tall above row 0, a west strip 1 tile wide left of column 0. Wall decor on the north wall is a magenta box per item at `from..to` (`walls/<kind>`). West doors are a magenta `doors/west` box in the strip plus a `props/doormat` box on the portal tile; north doors without facade art are `doors/north`.
9. **Facades.** Only the padaria facade (`facades/padaria`, 8 x 6) is drawn, centred on the padaria portal. The academia facade is 10 tiles wide and would overlap it inside the 14-tile Praça (Phase 5 has the room), so the academia door is a `doors/north` placeholder for now. `facades/edificio_ipe` belongs to the kitnet's west-wall door and is unused until Phase 4/5. The lit-window overlays are wired to the rig (invisible at golden hour).
10. **Skipped west-wall decor** (`skippedWestDecor`, logged on room build): praca: predio 0-2, predio 2-6 "EDIFÍCIO IPÊ", mural 6-9 "TUDO BEM?", metro 9-12 "METRÔ"; padaria: azulejos 0-9, janela 2-4, relogio 7-8, tv 0-2; kitnet: poster 1-3 "SP", cobogo 6-8; academia: janela 3-5, poster 6-8 "OSS · RESPEITO". Phase 4 moves them to the north wall or to floor props.

### Props, NPCs, characters

11. **Anchors and depth** follow HOWTO 5.4: sprites are anchored at the bottom-centre of the `PropDef` footprint (w x h, default 1 x 1), depth = bottom-edge world y plus an id-hash tiebreak below 0.1 (`standingDepth`), overhead parts at 50000, terrain -10000, walls -9000. A sitter draws 0.5 above the bench's bottom edge. Ipê canopies fade to 0.45 while the local avatar's feet are inside.
12. **Real sprites now** (art track 1): ipê (large for the hero, medium otherwise, with canopy), banco = `bench_small`, poste = `poste_fios` (plus a synthetic lamp light, `PROP_LIGHT`), banca, barraca_chapeus (+ canopy), quiosque, poleiro, orelhao, placa_rua, lixeira, canteiro = `planter_grass`, vaso = `pot_teal`, floreira = `pot_red`, saco_lixo = `trash`, fallen petals under each ipê, padaria facade. Everything else is a placeholder, reported once each in `window.__tb.artMissing`: terrain `t`, `l`, `m`, `j`; walls `north`, `west`, `predio`, `mural`, `azulejos`, `prateleira_paes`, `toldo`, `lousa`, `janela_rua`, `cobogo`, `foto`, `placa`; `doors/north`, `doors/west`, `props/doormat`; props `bicicletario`, `mesa_cafe`, `jornais`, `caixa`, `balcao`, `vitrine`, `estufa`, `trilho_pedidos`, `banqueta`, `mesa`, `cadeira_padaria`, `cama`, `cozinha`, `tatame`, `quadro_fila`, `parede_faixas`, `quadro_foto`, `banco_espectador`, `vestiario`; and `furniture/<itemId>` for anything placed in a kitnet. Placed furniture is a magenta 1-tile box (`furniture/<itemId>`) until Phase 4, but clicks, seats and selection work.
13. **Characters: one base sheet, recoloured.** Every player, CPU and NPC uses `body_medio` + one outfit + one hair layer, palette-swapped from `SKIN_TONES[skin]`, `HAIR_COLORS[hairColor]`, `CLOTH_COLORS[topColor / bottomColor]` (the Phase 1 swap is already there, so I used it instead of an unswapped key-colored sheet). NPCs get their own outfit / hair layer (`NPC_LAYERS`) so Carlos, Nanda and Júlia read apart. No hats, parrot, shoes, hair or outfit shape choices: Phase 3. Sheets are cached by look (`CharSheets` + `Lru`, cap 64, in-use sheets are never evicted, eviction removes the texture and its animations).
14. **Facing.** Idle and sitting use the wire Dir through `FACING` (D5); a sitter uses the seat's Dir. While walking, facing comes from the actual movement vector (dominant axis) so diagonals face E/W/N/S sensibly instead of whatever the iso `dirBetween` picked.
15. **Emotes** are a 2 px bounce of the idle S pose for 1.3 s (the sheet's emote rows are placeholders, Phase 1 decision 9).

### Hit testing, labels

16. **`hitTest`** collects hit boxes: static ones at room build (props with an action: sprite bounds plus 2 px; seats; portals: door + tile; NPCs 18 x 34) and dynamic ones per frame (avatars, furniture). Order and ties are `hitRank` in `hit.ts` (avatar, npc, prop, portal, seat, furniture; CPUs below all; ties by depth), then the tile fallback. A single-tile seat is clickable over its whole sprite plus 3 px of slack, because e2e's bench click aims 14 art px above the tile centre (HOWTO 7.6, real canvas click kept).
17. **Labels** (`labels.ts`, `#world-labels` inserted right after the canvas, `pointer-events: none`): one stack per avatar / NPC (bubbles above the plate, plate 5 px above the head), reused elements keyed by id, positions rounded to CSS px. Bubble rules are the iso ones (last 2, 7 s life with fade, gloss only when the state carries one, CPUs never show bubbles). Guides: the iso `lift` is in iso px, so it is mapped to `min(48, max(12, lift * 0.3))` art px above the tile; an off-screen target pins the arrow to the nearest screen edge with a direction glyph. `?debug=art` prints each placeholder's key on it. Missing keys are also in `window.__tb.artMissing` and logged once per room build.

### Input

18. **Keyboard (WASD / arrows) is active only in the pixel view**, so the iso view's behaviour does not change. It steps to the adjacent tile (diagonal for two perpendicular keys, sliding along a free axis when the diagonal is blocked) whenever the avatar is idle and no request went out in the last 140 ms, which chains steps as the avatar arrives. It is ignored while an input has focus, a modal is open, in decorate / placing mode, or after the idle kick; held keys clear on blur. Steps are plain `move` messages over tiles (D4). The wait for arrival costs one round trip per tile; pre-sending mid-step would snap the avatar back on the server (its `currentTile` rounds), so it is not done.
19. **Joystick** takes `mode: 'iso' | 'topdown'`; `joystickStep` is the pure mapping (topdown: right = +x, down = +y).

### Not done (by design, later phases)

Layered characters, hats, parrot (P3); prop / furniture / wall art, decorate ghost sprite and rotation, trilho animation, DOM label polish and pixel chrome (P4); the neighbourhood map and edge buildings (P5); clock, darkness, weather, ambient life, audio zones (P6). The intro / title screen still uses its own canvases.
