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

## Decisions: art track 1 (Brazilian set pieces)

Branch `lifesim/art1-set-pieces` (folded in from `decisions-art1.md`). Contact sheet: `docs/lifesim/shots/art1/pieces.png`;
frame screenshots (17:30 and 19:30): `docs/lifesim/shots/art1/frame_*_1280x800.png`.

### Pipeline

1. **New import kind `derive`** (`scripts/pixel-import.mjs` -> `emitParts`, generators in `assets-src/custom/derive.mjs`). A generator gets
   `{ load(spec), sheet(alias), map }` and returns *parts* (`{ key?, img | frames[], fps?, anchor, meta? }`). The first part inherits the
   import-map line (footprint, shadow, cast, light); extra parts (lit-window overlays, canopy, wire spans, the west facing) carry their own
   `meta`. Rendered PNGs of every part land in `assets-src/custom/png/` like the P1 custom pieces. `pnpm pixel` stays deterministic.
2. **Two new optional manifest fields** (`SpriteDef` in `manifest.ts`): `lit` (key of a same-size overlay sprite with the lit window panes) and
   `attach` (offset from the anchor to the wire attach point, on `props/poste_fios`). Existing fields reused: `overhead` (also on the hat
   stall now, not only trees), `windows`, `anim`.
3. **Shared toolkit** `custom/kit.mjs`: rank recolor, exact swap, band stretch/cut (`stretchCols`, `stackRows`), mask shading with the pack's
   edge lighting (`drawShaded`: 1 px lit rim on the north/west edge, 2-3 px shaded rim on the south/east edge, navy outline outside), grid stamping.
   `custom/font5.mjs`: a 5x7 sign font (capitals + 2, 4) and a 3x5 extension with digits and the "º" of "Nº". No accented glyphs in pixels (HOWTO D8):
   the sign say PADARIA, ACADEMIA DO BAIRRO, EDIFICIO IPE, R. DOS IPES; the accented forms are DOM labels.

### Key naming and facings

4. **East/west facings use suffixes `_e` / `_w`** (`vehicles/onibus_e`, `critters/vira_lata_walk_w`), matching the compass in HOWTO 5.2. P1's cars
   keep their `_l` / `_r` names. The west variant of authored pieces is a mirror of the east one (fusca, moto, dog); the LimeZu-derived bus and
   kombi use the pack's own west sprites so the light stays upper-left.
5. **Footprints follow the brief** (facades `[8,6]`, `[10,6]`, `[10,6]`; bus `[6,2]`; kombi `[4,2]`, fusca `[3,1]`, moto `[2,1]`). For the facades
   the footprint is the whole 6-tile-tall front; Phase 5 can block only the base row if it prefers. The Edifício sprite is 160x124: the 96 px body
   plus 28 px of rooftop (caixa d'água, dish, antenna) that pokes above the 6 tiles. Its anchor is the bottom centre of the body.
6. **Animated pieces**: bus, fusca, moto have 2 wheel frames (hub rotated 90 degrees, or lug pattern flipped); `props/poleiro` has 4 idle frames
   (blink, head turn, head bob, tail flick); dog: idle 4 (tail wag), walk 4, sleep 2 (breathing), each in E and W.
7. **Utility wires** (`props/fios_seg` 16 px tileable, `props/fios_4/6/8` = 4/6/8 tiles pole to pole) are `overhead` sprites. Place the sprite's
   anchor (its left end, first wire row) at `pole.x`, `pole.y - 51 px` (`props/poste_fios` `attach`), lay spans end to end. The frame draws them at alpha 0.7
   so three cables plus a tangle do not fight the plaza art. `fios_6` carries a pair of sneakers thrown over the wire (a common bairro sight).

### Lit windows

8. **Night windows are an overlay sprite** (`facades/*_lit`, same size as the facade, only the panes are opaque: warm gradient, bread on the
   padaria shelves, gym silhouettes) referenced by `lit` on the facade. The frame fades it in with `glowStrength` and still punches light holes
   from the facade's `windows` rects. Without `lit` the frame falls back to the P1 additive rectangles.

### Lighting

9. **Golden-hour shadow fill.** `lighting.ts` gains `shadowFillStrength(hour)` / `shadowFill(hour)`: 0 before 16:30, ramp to 1 at 17:30, held to
   18:15, out by 19:45 (smooth steps). The frame draws a full-screen `#3454a8` rectangle with the SCREEN blend at alpha `0.2 * strength`, between the
   multiply grade and the night darkness, so shadows read cool blue against the warm ground instead of one orange wash. Three unit tests added
   (`lighting.test.ts`). Chosen values are constants (`SHADOW_FILL_COLOR`, `SHADOW_FILL_MAX`) if the boss wants more or less.

### Terrain

10. **Calçada contrast about 40% lower.** The light/dark stone pools (`PAVE` in `custom/calcada.mjs`) moved to pack lavenders: light stones ~luma 192
    (was 233), dark ~128 (was 125): contrast 64 vs 108 (-41%, tested in `art1.test.mjs`: ratio between 0.5 and 0.7). Pattern unchanged. The São Paulo
    mosaic keeps the old stone values (`STONE`), so it now stands out a little more than the paving, as requested. The mask tile edges (curb, lip) are unchanged.

### What is derived, authored, placeholder

| Key | How |
|---|---|
| `props/orelhao` | authored (mask shading + orange ramp + pack greys/reds), inspired by `Public_Phone` |
| `props/placa_rua` | LimeZu plain sign pole (`3_City_Props`, cropped) + authored blue plate, 3x5 text "R.DOS / IPES" |
| `props/lixeira` | authored orange cylinder bin (orange/terracotta ramp) |
| `props/quiosque` | authored terracotta totem with mustard screen and star (kiosk silhouette from the pack's ticket kiosk) |
| `props/barraca_chapeus` + `_canopy` | LimeZu `Street_Food_Cart_1` split into standing part + overhead canopy, 7 authored hats |
| `props/poleiro` | authored perch + parrot (4 frames); the pack has no parrot |
| `props/poste_fios`, `props/fios_*` | LimeZu crossarm utility pole (cropped) + authored wire spans |
| `facades/padaria` (+`_lit`) | LimeZu Market front (tan/brown) cut and widened, red/white toldo recolor + continuous awning, authored sign and bread |
| `facades/edificio_ipe` (+`_lit`) | LimeZu Generic Building yellow modules (48+32+32+48), authored grilles, varal, tank, dish, plaque, garage shutter |
| `facades/academia` (+`_lit`) | LimeZu Market front (ochre/blue) cut and widened, blue/white toldo, authored sign and gym silhouettes |
| `vehicles/onibus_e/w` | LimeZu `Bus_Right_5` / `Bus_Left_5` (red, green stripe), wheel hub spin as frame 2 |
| `vehicles/kombi_e/w` | LimeZu `Camper` shortened by 22 px, roof clutter painted out, two-tone white / teal |
| `vehicles/fusca_e/w`, `vehicles/moto_e/w` | authored (mask shading + pack palette), 2 wheel frames |
| `critters/vira_lata_*` | authored caramel dog (pack has none) |
| `critters/gato` | not added: the pack cat is already `critters/cat` (18-frame lying/tail flick). A sitting/walking cat is not made |
| `terrain` calçada | retuned, see 10 |

No sprite is a magenta placeholder. Gaps: no gato walk/sit, no dog N/S facings (E/W only), no bus stop (P6), fontain unchanged.

### Known weaknesses (honest list)

- The moto and the dog are the weakest pieces: tiny hand-built silhouettes next to LimeZu's polish. The sleeping dog reads as a caramel loaf.
- The kombi is a repainted camper (boxy); it says "van" rather than "Kombi" (no V-nose, no split windscreen).
- Wires are 1 px lines in the pack's wire grey; from far away they read as a dark band, hence the 0.7 alpha in the frame.
- Facade rooftops: only the Edifício has rooftop details; padaria and academia are flat parapets. Facade side walls and corner pieces are not made.
- The mirrored west facings of fusca / moto / dog flip the highlight to the wrong side (barely visible at 1 art px rims).

### Needs BR review

New PT text painted into signs (uppercase, no accents in pixels): PADARIA / DO SEU CARLOS, ACADEMIA / DO BAIRRO, EDIFICIO IPE, Nº 42, R. DOS IPES.
Accented forms for the DOM labels: Padaria do Seu Carlos, Academia do Bairro, Edifício Ipê Nº 42, R. dos Ipês.

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

---

## Content: recados

Scope: HOWTO Phase 8 step 7 (the first 15 recados) and the tooling around it. Content plus small engine hooks; no client, no schedules, no new cards.

### Where things live

| What | File |
|---|---|
| The 15 recados (canonical, `needs_br: true`) | `content/curriculum/phase0/recados.md` |
| Generated, validated JSON | `content/curriculum/phase0/recados.json` (`pnpm content`) |
| Parser and validator (`buildRecados`, `parseRecadoStep`, id lists) | `scripts/build-curriculum.mjs` |
| `RECADOS` (loaded from the JSON), `RECADO_FLAGS`, `recadoEnabled`, `requires` on `RecadoDef` | `packages/shared/src/recados.ts` |
| New NPC ids (`OFFSTAGE_NPCS`) | `packages/shared/src/rooms.ts` |
| In-sync test, validator/engine id mirror test, DNT scan and "Give me" scan over the recados | `packages/shared/src/curriculum.test.ts` |
| Pack invariants, flag behaviour | `packages/shared/src/recados.test.ts` |

### Decisions

1. **Authoring format** follows the lexeme packs: one `### id` block per recado with `- **field:** value` lines (`title_pt/en`, `ask_pt/en`, `thanks_pt/en`, `steps`, `reward`, `cards`, `needs_br`). Steps are one line, `;`-separated: `pedir carlos cafe_com_leite 1; entregar nanda cafe_com_leite 1`. `cumprimentar [npc] [timeCorrect]`, `ir <room>`, `falar <npc>`. The markdown is canonical; the JSON is generated and an in-sync test fails on drift.
2. **The build fails loudly** on an unknown giver, NPC, item, room, card, flag or step kind, a bad reward line, a duplicate id, a missing field, or a recado without `needs_br: true`. The validator's id lists (NPCs, rooms, items) are hardcoded in the script (it is plain `.mjs` and cannot import the TS), and a test asserts they equal the engine's (`NPC_IDS`, `ROOMS`, `ITEMS`), so a drift on either side fails CI.
3. **`pnpm content` did nothing on Windows** (the "run as main" guard compared `import.meta.url` with `file://${argv[1]}`, which never matches a `C:\` path). Fixed with `pathToFileURL`. The tests import the builders directly, so they were never affected.
4. **`NpcId` gained `graca` and `tia_lu`** through `OFFSTAGE_NPCS` (name and role each) in `rooms.ts`. They are not in any room yet (Graça arrives with the schedules, Tia Lu with the feira), so `NPC_IDS` (used by `isNpcId`, `normalizeBond`, `normalizeNpcMemory`, `normalizeRecados`) is now rooms plus offstage. Without that, bond for a giver with no room would be silently dropped on load and the recados of Graça and Tia Lu could never pay. `npcName` falls back to `OFFSTAGE_NPCS`. The one exhaustive `Record<NpcId, ...>` is `CONVERSA_CAST`: two disabled entries added (`graca`: padaria, `tia_lu`: praça as a placeholder for the feira), no subjects, so no Conversa can start.
5. **Flags.** `RECADO_FLAGS = { feira: false, dialogue: false }` is a plain mutable object. `RecadoDef.requires?: 'feira' | 'dialogue'`. `offerFor` and `rollRecadoDay` skip a recado while its flag is off (`recadoEnabled`), and both take an optional `flags` argument so a test can pass its own map instead of mutating the global. Phase 7 flips `dialogue`, Phase 9 flips `feira` (a one-line change each, plus the emit of the matching events). Recados already `active` are never removed by a flag; the flags only affect what is offered.
6. **Four are gated:** `tia_lu_banana_pra_nanda`, `tia_lu_flores_pra_julia` (feira: the items only exist there) and `julia_conhecer_nanda`, `nanda_pergunta_pro_carlos` (dialogue: `falar` with Nanda has no interaction yet). The rule is checked by a test (feira if Tia Lu is the giver or a step target, dialogue if a step is `falar` with anyone but Seu Carlos).
7. **The other 11 are finishable today**, and tests enforce it: every ungated step involves an NPC that exists in a room (Carlos, Nanda, Júlia); every `pedir` is from Carlos, with quantity 1, and for an item the Carlos scene can order (`pao_na_chapa`, `coxinha`, `pastel`, `cafe`, `cafe_com_leite`, `suco_de_laranja`, `agua`; `pao`, `bolo`, `pao_de_queijo`, `misto_quente`, `guarana` only appear through the Me vê um minigame, whose order is not the player's choice, so they are used as rewards, not as orders); every `entregar` hands over something an earlier `pedir` of the same recado ordered; no two `pedir` sit side by side (one scene orders one food and one drink, in a single event). (`ir` as a first step, as in `julia_volta_pela_vizinhanca`, needs you to step out of the room and back in if you already stand there; that is a walk, not a dead end.)
8. **Dona Graça and Tia Lu are givers only.** Nobody can talk to or hand something to Graça before the schedules exist, so her three recados (`graca_pao_pra_julia`, `graca_agua_pra_academia`, `graca_cumprimenta_julia`) send you to Carlos, Júlia and the academia, and none of them is a step target. Her bond can only grow through those recados (talking to her is not possible yet), so her bond-30 recado (`graca_cumprimenta_julia`) is reachable after roughly a week of game days; that is intended for a night-shift acquaintance.
9. **Spread.** Bond 0: 6 (`carlos_cafe_pra_nanda`, `nanda_coxinha`, `julia_cumprimento_certo`, `graca_pao_pra_julia`, `nanda_um_oi_pro_carlos`, `tia_lu_banana_pra_nanda`). Bond 10: 5. Bond 20 to 30: 4 (`carlos_manha_de_entregas` and `nanda_pergunta_pro_carlos` at 20, `graca_cumprimenta_julia` and `julia_volta_pela_vizinhanca` at 30). A new player therefore sees three of five open recados a day. Rewards 8 to 15 RV and 3 to 6 bond, never above `ECONOMY.sceneMax` + 1 (a test checks it); the four-step morning and the feira flowers pay the most (15). Two recados pay a shelf item on top (`pao_de_queijo`, `bolo`).
10. **The four starters were kept as they were** (same ids, text, steps and rewards), so the existing server fixtures stay meaningful. The random daily offer is now a 3-of-5 draw, so the server tests pin `recados.offered` (`offer(client, ids...)`) before accepting a specific recado, and assert the board draws only from the five open ones.
11. **Distinct step shapes on purpose:** two-step pedir + entregar (most), a four-step chain of two orders (`carlos_manha_de_entregas`), `cumprimentar` with `timeCorrect` (twice: any greeting-fits-the-hour, and specifically to Júlia), `cumprimentar` a named NPC (`nanda_um_oi_pro_carlos`: the greeting counts when said within 3 tiles of Carlos), `ir` (`graca_agua_pra_academia`, a walking loop `ir academia; ir praca; cumprimentar julia`), and `falar` (two, gated).
12. The Portuguese of every recado also goes through the existing do-not-teach and `classifyChat` scans and the "never Give me" scan.

### Known small things

- `graca_agua_pra_academia` leaves the water in the bag after the trip (there is no NPC at the academia to hand it to). It is harmless (bag cap 20).
- `julia_volta_pela_vizinhanca` greets Júlia by the "nearest NPC within 3 tiles" rule, so the player has to type the greeting next to her.
- A stale `offered` list is not re-filtered on accept, only on the daily roll; flags only ever turn on, so this cannot expose a gated recado early.

### Proposed cards (not added; no card exists yet)

`banana`, `flores`, `jornal` (items already exist in `ITEMS` without a `cardId`); `praça` / `academia` as places; `água` is covered. `Volta sempre` and `Isso aí` exist as cards but are not used here. Phrases the recados use that are not cards: `Leva ... pra ela?`, `Tô com fome`, `dá um oi`, `Que bom!`, `Valeu!`, `Pergunta pro...`. Suggested set for the Curriculum team: `lex.social.valeu`, `lex.social.que_bom`, `lex.padaria.leva` (Leva um ... pra ela?), `lex.feira.banana`, `lex.feira.flores`, `lex.rua.praca`, `lex.rua.academia`.

### Needs BR review

Every string in `recados.md` (15 titles, asks and thanks, PT and EN). Watch: `Olha a banana!` (feira call), `Você é gente boa`, `Água é vida`, `Pão na chapa é o melhor despertador`, `Uma volta pela vizinhança`, and the register of Dona Graça and Tia Lu (a joker and a loud friendly seller; kept mild in A1).

## Decisions: art track 3 (interiors: floors, walls, doors, padaria, kitnet, academia, praça leftovers)

Branch `lifesim/art3-interiors`. Contact sheets in `docs/lifesim/shots/art3/`: `floors.png`, `walls.png`, `padaria.png`, `kitnet.png`, `academia.png`, `praca.png`, plus
`?view=pixel` room shots (`1280x800_*`, `390x844_*`; they are taken with `--clean --furnish` so nothing covers the art and every catalog item is in the kitnet).
`pnpm pixel` is deterministic (two runs give identical hashes for `public/pixel/**` and `custom/png/**`). `window.__tb.artMissing` is empty in all four rooms.

### Pipeline

1. **`import-map.d/*.json` fragments** (`scripts/lib/pixel/importmap.mjs`, tested in `importmap.test.mjs`): every fragment is merged after `import-map.json` in file-name order.
   Arrays (`sprites`, `images`) are appended, objects (`roots`, `sheets`, `recolors`, `terrain`, `atlas`) are shallow-merged, a duplicate sprite key throws, any other top-level key throws.
   All art track 3 entries live in `import-map.d/interiors.json`; the character track edits `import-map.json`.
2. **`sprite` kind gained `trim`, `foot`, `swap`, `ramp`** (crop on the pack's 16 px cells, drop the transparent margin, anchor at the bottom centre lifted by `foot` px; exact colour swap or luminance-rank
   recolour before the crop). Most interior art is `derive` generators (`custom/walls.mjs`, `padaria.mjs`, `kitnet.mjs`, `gym.mjs`, `floors.mjs`).
3. **New terrain kind `flush`** (`buildFlushTiles`, `terrain-gen.mjs`): the 16 mask tiles are the fill cut along the 8x8 quadrants, no chamfer, no curb, no shadow, optional 1 px `rim`. Two flush
   terrains, or a flush terrain and the slab under it, meet exactly on the world tile edge. Used for `t l m k j`. Phases can be a 2D grid (`phasesY`, `phasedIndex2` in `terrain.ts`, tested):
   ladrilho 1x1, tatame 4x4 (32 px mats, blue/green checker), the others 1x1. A `flush` layer draws above the slab layer; a slab layer counts the flush terrain inlaid in it as itself
   (`FLUSH_ON_SLAB = { t: 'c' }` in `terrainLayers.ts`), so the brick path has no curb against the calçada. Between brick and grass there is a hard cut (no curb art).
   The `FLOOR_SUBSTITUTE` / `FLOOR_PLACEHOLDER` fallbacks are gone except `d -> g` (no room uses dirt).
4. **Floors**: `t` brick pavers in running bond, authored (pack brick palette); `l` ladrilho hidráulico, authored (cream + terracotta diamond ring, centre bead, corner triangles that make a second diamond
   with the neighbours, 1 px grout; one calm colourway, a first 2x2 inverted version was too loud in the room); `m` taco / herringbone parquet, the pack's chevron floor recoloured to warm woods; `k` xadrez
   bone / slate 8 px checker, authored; `j` tatame foam mats, authored.

### Walls, decor, doors (mapping in `roomLayout.ts`)

5. **Wall tiles per room style** (`WALL_STYLE`: praca, padaria, kitnet, academia): `walls/north_<style>_l|_m|_r` (16 x 48 columns, 4 alpha rows of floor shadow below; `_l` is the corner over the west
   strip, `_r` the east end), `walls/west_<style>` and `_b` (16 px strip + 4 px of shadow). All authored in the pack look (navy outline, white cap, noisy plaster). Styles: padaria cream plaster (the terracotta azulejo
   wainscot is the `walls/azulejos` decor, tiled over the north span); kitnet plaster with a wood baseboard; academia painted block courses (cream over blue); praça street-wall plaster.
6. **Decor table** `decorArt(d)` maps a `WallDecor.kind` to key, `tile | center`, and the anchor height. All 17 keys exist (`azulejos, prateleira_paes, lousa, janela_rua, janela, relogio, tv, cobogo, foto, placa,
   poster (+ poster_oss), toldo, mural (+ mural_s), predio, metro, parede_faixas`). Text is DOM except the short words painted into signs: ACADEMIA DO BAIRRO, SAMPA, METRO, SP, OSS (no accents in pixels, D8).
   The lousa is blank.
7. **West-wall decor moves to the north wall** (`relocatedWestDecor`, pure, tested): a west wall cannot be seen edge-on, so each item takes the first free stretch of columns -1..cols-1 (column -1 is the corner above the
   west strip), posters and TVs first; `rooms.ts` is not touched and `describeSkipped` still lists the west items. Result today: padaria TV in the corner; kitnet SP poster right of the cobogo and a cobogo in the
   corner; academia OSS poster at the east end. Dropped for lack of room: padaria clock and window, academia window, the praça buildings / mural / metro (all north-wall space is taken). Phase 4/5 should author
   those positions in `rooms.ts`.
8. **Doors**: `doors/north` (16 x 32 wood + glass, used by the academia door), `doors/west` (a doorway in the west strip with the leaf open at an angle), `props/doormat` on the portal tile.

### Props (keys, sources, conventions)

9. **Sliced props**: `propSlices` in `props.ts` returns one `<base>_<i>_of_<w>` sprite per footprint tile for `balcao` (5) and `banco_espectador` (4); another width shows a placeholder.
   `cadeira_padaria` picks `_e | _s | _n | _w` from the seat Dir (SE, SW, NE, NW); the N and S chairs share one head-on sprite.
10. **Padaria**: balcão = the ice-cream-shop glass counter recoloured (pink stripes to terracotta, lavender whites to cream) with breads painted in the panes; vitrine, estufa (+ `props/estufa_lit` glow overlay,
    wired through the rig's `litOverlays` like the facades), trilho de pedidos (2 frames), caixa, banqueta, mesa (checkered cloth) authored; chairs are the pack's kitchen chairs.
11. **Kitnet**: `props/cama` = pack headboard + blanket tile + painted pillows; `props/cozinha` authored (sink, stove with a moka pot, terracotta backsplash); 14 catalog items x 2 rotations
    (`furniture/<id>_0|1`, rot 0 faces SE / east, rot 1 faces SW / south). Pack: cadeira (kitchen chairs), luminária (living-room floor lamp), estante (living-room shelf cut to 1 tile), gato (the pack cat recoloured
    orange, 18 frames, mirrored for rot 1). Authored: poltrona verde, pufe amarelo, mesinha, planta (costela-de-adão), tapete, rádio, ventilador (3 frames), rede, filtro de barro, quadro de ipê (easel).
    Symmetric pieces are mirrored for rot 1.
12. **Academia**: tatame decal 96 x 64 (blue mat, white line, mustard safety border), quadro da fila, parede de faixas (vertical rack, plus a wide wall version `walls/parede_faixas`), arquibancada slices, vestiário
    (lockers), quadro de foto: all authored. **Praça**: bicicletário (two bikes on a rail), mesa de café, jornais: authored.
13. **WorldScene changes beyond mapping tables** (needed for the art to show, no game behaviour): `buildWalls` / `buildDecor`, door sprites, the slice loop and `lit` overlay in `buildProp`, and furniture drawn from
    `furniture/<id>_<rot>` (sprite + contact shadow + a selection outline, magenta box when the art is missing; a rotation swaps the sprite). `lifesim-shots.mjs` gained `--clean` (hide all DOM overlays), `--furnish`
    (client side: one of every catalog item in the kitnet) and prints `artMissing`.
14. **Base note**: `render/pixel/looks.ts` (character track) did not typecheck on `lifesim/main` after the content track added `graca` and `tia_lu` to `NpcId`; it is not touched here (see the final report for the merge state).

### Known weaknesses

The ladrilho and the academia mats are still busy at 4x; the west door art is small and odd (open leaf drawn diagonally); padaria and academia have no clock / window (no free north-wall span); the N and S chairs are
the same sprite; the bikes read as a blob at 1x; the taco parquet is dark; desktop zoom 4 does not fit a whole interior vertically (Phase 2 camera decision), so desktop shots show only part of each room.

### Needs BR review

Pixel text added: ACADEMIA / DO BAIRRO (placa), SAMPA (mural), METRO, SP and OSS (posters). No accents in pixels; the DOM labels carry the accented forms.

## Decisions made in Phase 3 (layered characters)

Scope: HOWTO Phase 3 steps 1-6 plus the boss directives (outfit table, every creator option visible, 12 hats, real emote frames, parrot companion, NPC looks, idle variety, pixel creator preview and hat icons in both views). Branch `lifesim/p3-characters`. Contact sheet `docs/lifesim/shots/p3/lineup.png` (`node scripts/character-lineup.mjs`, composed with the same code the game runs); creator shot `docs/lifesim/shots/p3/1280x800_avatar_creator.png`.

### Structure

1. **Pure pipeline, three consumers.** `charcompose.ts` (key-color swap + alpha-over, pure), `composeLook.ts` (look -> sheet pixels), `characters.ts` (`CHAR_LAYERS`, `OUTFITS`, `HAT_LIFT`, `pick` with log-once fallback), `looks.ts` (`lookForAppearance`, `NPC_STYLES`, `lookKey`), `charAssets.ts` (decoded layer PNGs, one shared load per page), `bodytype.ts` (height), `charPreview.ts` (DOM preview and hat icons), `charsheet.ts` / `charCache.ts` (Phaser texture + animations, LRU cache with an injected backend so eviction is tested without Phaser). The Phaser scene, the creator preview, the hat shop and the style frame all compose through `composeLook`, so what the creator shows is what the world draws.
2. **Layers are decoded once (all 95 PNGs, about 28 MB of RGBA in memory) instead of loaded as Phaser textures**, because the iso view has no Phaser but needs the same composition for the creator and the shop. The whole set is about 90 KB of PNG on the wire.
3. **`pnpm pixel` builds the layers** (`assets-src/custom/chars.mjs`; the old per-layer list in `import-map.json` is gone). Everything is deterministic (two runs give identical hashes).

### Outfits: the (top x bottom) table

4. All 33 LimeZu outfits share one silhouette (long pants and shoes), so bermuda / saia / regata cannot be picked from the pack. The table (`OUTFITS` in `characters.ts`, tested to resolve all 15 at all 3 body types) maps each top style to a real outfit for the torso (camiseta and regata -> Outfit_01, moletom -> 10, camisa -> 08, blusa -> 11) and **edits** that outfit's legs: `bermuda` (pants stop a row early, legs split from the front), `saia` (A-line flare), `regata` (sleeves cut off). Documented in the table (`source`, `edit`) and in `assets-src/README.md`.
5. **Every outfit is recolorable in all three ramps**: torso -> `topColor`, pants -> `bottomColor`, shoes -> `SHOE_COLORS[shoes]`. Bands are cut by row relative to the feet row (not by color), so a white shirt over white pants still gets two colors.
6. The 5 tops do look different, but at 16x32 (a 3-row torso and 2 rows of pants) the differences are small: collar and placket (camisa), wide cuffs (moletom), bare arms (regata), the ruffle pattern (blusa).

### Every creator option is visible

7. **Body type**: width is baked per layer (`__esguio`, `__forte`: 2 torso columns dropped or doubled on body-attached layers), height is applied to the composed sheet (`esguio` +1 px taller, `forte` -1 px shorter and the head sinks with it). Feet never move.
8. **Hair (9)**: curto (Hairstyle 12), raspado (20, close crop), undercut (26), cacheado (25), black power (25 grown 2 px with a redrawn outline), ondulado (07), longo (15), coque (16 + an authored bun), trancas (16 + authored braids). **Face (4)**: the pack's eyes differ by iris color only, so `suave / marcante / doce / maduro` = 4 iris colors + authored brows, blush, smile lines. **Extras**: oculos, barba, bigode from the pack; brincos and sardas authored. Beard and mustache follow the hair color.
9. Hat art is stamped on each frame's head anchor, so hats follow the walk bob, the sit poses and the bow.

### Hats

10. **Derived from the pack** (recolored onto the `hat` / `accent` ramps with the catalog colors): bone_verde (snapback), panama (detective hat), chapeu_chef (chef), gorro_listrado (beanie + authored stripes). **Authored in the pack style** (`custom/hats.mjs`): chapeu_palha, viseira_azul, boina_vermelha, chapeu_sol, bucket_amarelo, capacete_bike, coroa_flores, cartola, plus Tia Lu's `pano` headscarf. The `hat` and `accent` key ramps were added to `KEY_RAMPS` (`palette.ts`); `keyMapForShades` now spreads layers with more shades than ranks by luminance (`ranksFor`).
11. Nameplates stand above the hat (`HAT_LIFT`, `lookHeadLift`).

### Emotes (canonical rows 12-16) and poses

12. **Sources** (`assets-src/README.md` has the row table): `oi` = idle S frames 0-5 (real) + authored raised hand; `dancar` = the real walk-S cycle in place + authored hands up; `rir` = idle S frames 0-3 (real) + authored mouth; `valeu` = idle S frames 0-3 (real) + authored fist with thumb up; `desculpa` = **all real**, the pack's "pick up" bow (source row 9, S block). The pack has no wave, dance, laugh or thumbs-up rows, so four of five are real body frames plus a small authored gesture layer (drawn over the hair so a raised hand shows beside the head). **The 2 px bounce is no longer used** for any emote; the scene keeps it only as the fallback for a sheet with no such animation (none today). Emotes play the real frames facing S for their duration plus the hold, then go back to idle.
13. **Idle poses**: `celular` plays the pack's phone loop (row 17, facing S only, other facings use the idle) with the Smartphone layer; `cafe` (cup), `bolsa` (shoulder bag), `bracos` (crossed arms), `bolsos` (hands covered, pocket slits) and `cintura` (fists on the hips) are authored props on the idle rows; `solto` is the plain idle. Every pose also has its own pace and every avatar a per-seed start frame and +-10% speed jitter, so a crowd never breathes in sync.

### Parrot

14. `PublicAvatar.parrot` draws the poleiro parrot (head and body cropped free of the perch, 4 idle frames, `chars/parrot` sprite + `chars/parrot_strip` for the DOM previews) hovering at the avatar's far side, mirrored to face its owner, with a small bob. It is 10x15 px, big next to a 14 px head (known weakness).

### NPC looks (`NPC_STYLES`, keyed by id, so `graca` and `tia_lu` work before they have a room)

15. Carlos: forte, chef hat, apron (white) over a terracotta camisa, grey mustache, arms crossed. Nanda: esguio, straw hat, mustard camiseta, dark curls, hoops, hands on hips. Júlia: blusa, long chestnut hair, jeans, shoulder bag. Dona Graça: grey bun (coque, grey), round glasses, pale-blue apron over a plum blusa. Tia Lu: red headscarf (`pano`, red with cream), gold hoops, green top, orange apron. The style's appearance wins over the room's `appearance`, so portraits and sprites agree. The `Appearance` model and `sanitizeAppearance` are untouched.

### Avatar creator and shop (both views)

16. `ui/onboarding.ts` shows the composed character at **8x** (6x on phones) with `image-rendering: pixelated`, a turn button (`#turn-avatar`, S -> E -> N -> W) and the wave on entry; all e2e ids are unchanged. The hat shop and wardrobe use the same preview (with the selected hat and the parrot) and the **S-facing hat layer at 4x** as icons (`hatIconUrl`, a tight crop in a fixed 72 px box so the scale is never stretched). The profile card uses the pixel preview too. The Conversa NPC portrait card and the tutorial NPC card still use the iso `renderAvatarPreview` (Phase 7 rebuilds the dialogue).

### Tests

17. New: layer table coverage (every enum, all 15 outfits x 3 body types, all 12 hats, every key in the manifest), look colors and NPC looks, compose (swap, alpha blend, size guard), cache eviction (cap, LRU, in-use sheets survive), body height, import build checks (15 different outfits, all layers key-colored, hats follow the head, gestures and props only touch their rows).

### Environment note

18. Port 8791 was taken by another process on this machine, so the local server and e2e runs used `PORT=8793`.

### Known weaknesses

Body types and the 15 outfits are subtle at 16x32; the gestures (raised hand, thumb) are 2-4 px and low contrast on skin-toned heads; the parrot is oversized; dark hair on dark skin hides the face at small sizes (a pack limitation); `panama` is a recolored detective hat (pointed crown); the dark-skin `maduro` smile lines read reddish; walking frames of `bermuda` and `saia` are only approximations because the legs stride.

### Needs BR review

New PT strings: the creator turn button "Girar" and its label "Girar o avatar" (EN: "turn around"). Hat and face names already exist in `LABELS` / `catalog.ts`. No curriculum cards.

---

## Decisions made in Phase 4b (interface half of Phase 4: pixel UI, credits, pixel by default)

Branch `lifesim/p4b-ui-default`. Phase 4a (labels, camera, patterns, decorate ghost) runs in parallel; this branch only touches `render/pixel/manifest.ts` inside `render/pixel/`.

### Manifest images

1. `render/pixel/manifest.ts` has a typed `ImageDef` and `Manifest.images`, plus `imageUrl(key)`, `imageDef(key)`, `nineSlice(key)` (url, slice, border widths, `borderImage(scale)` shorthand), `loadUiManifest()` / `setUiManifest()`. Files are named after their key, so `imageUrl` is right even before the manifest loads. `main.ts` loads the manifest once at boot (both views) and awaits it before building any UI.

### DOM art (both views, integer zoom, `image-rendering: pixelated`)

2. New `ui/pixelArt.ts`: `foodIcon(id, zoom)` (16 px icons, 3x = 48 px in Me vê um), `furnitureIcon(id)` (the rot-0 atlas sprite cropped to a PNG data URL, cached, 2x in a fixed 72 px box), `npcPortrait(npc, expression, cls)`, `parrotPortrait` (the `chars/parrot_strip` as a CSS steps animation, replaces the drawn parrot at the perch), `expressionForScore` (score 3 feliz, 0 surpreso) and `expressionForGrade` (Conversa: pass feliz, tryAgain surpreso, only after the conta), Pedido rápido feliz once it paid out. Portraits are 64 px shown at 2x (1x under 640 px wide, by CSS).
3. `grep -rn "render/icons\|render/props\|render/avatar\|render/room\|render/world'" apps/client/src/ui` returns nothing (`bjjPoses` in `ui/roll.ts` stays). `art/ui.ts` and `art/registry.ts` still import the old renderer (they draw the generated SVG HUD icons); they go with the Phase 5 deletion.

### Pixel chrome (light touch)

4. `styles/pixel-ui.css` (new). `applyChrome` turns the manifest's ui kit into CSS variables (`--px-panel`, `--px-panel-2`, `--px-button*`) and adds `html.px-ui`; without the manifest the old chrome stays. Nothing was renamed: ids, classes and layout are the old ones.
5. 9-slice `border-image` on: modal panels, the NPC dialogue and the decor panel (2x, so 14 px frames), HUD pills, brand, checklist, chat bar and toasts (1x), top-bar buttons and Enviar (kit button, hover and pressed variants). Toasts keep their level color as a bar inside the frame. Emote chips stay cream, squared, with a hard shadow (the frame would add about 8 px to each). Me vê um (`.panel.mg`), Roll, Conversa and Pedido keep their own wood/paper themes. The frame's soft `box-shadow` was replaced by a crisp `drop-shadow`. The azulejo strip on top of panels is gone under `px-ui` (the kit frame replaces it).
6. **Pixel font: Pixelify Sans** (Google Fonts, OFL, weights 500-700). Checked with "Pão de queijo, açaí, você, não, avó, Nº 42" at 16 px and 32 px next to Silkscreen, VT323, Jersey 10, Tiny5 and Press Start 2P: it is the only one that is both legible and complete (Jersey 10 has no `º`, Silkscreen is all-caps and wide). Used only for headings, pills, the brand, speaker/NPC names, RV numbers and the credits roles. All learning text stays Nunito (D9).
7. **Less UI while walking.** *Primeiros passos* collapses to a one-line pill (`Primeiros passos 1/8 ▸`) as soon as the first step is done, and stays as the player leaves it after a manual toggle (keyboard accessible). Phone HUD (<= 640 px): row 1 is the brand (wordmark over the room name, mark hidden) plus the Verde and RV pills, row 2 the icon buttons (44 px), the emotes are one scrolling row. Measured on the 390x844 shot the HUD covers about 19% of the screen area and the bottom bar ends below the joystick (the shots run the phone with touch so the joystick is visible).

### Credits (license requirement)

8. Top-bar button **Créditos / Credits** (`#btn-credits`, new `info` icon) opens `ui/credits.ts`: "Arte: LimeZu — limezu.itch.io" as a real link (`target=_blank rel=noopener`), voices (edge-tts pt-BR Antonio and Francisca), fonts, Phaser, and the sound line. There is no `apps/client/public/audio/CREDITS.md` yet (all sound is synthesized in Web Audio), so the sound line says so; CC0 files must be added to `creditsData.ts` when Phase 6 brings them. The title/sign-in screen has a small footer "Art: LimeZu — limezu.itch.io".

### Pixel is the default

9. `render/pickView.ts`: `?view=iso` (or `VITE_VIEW=iso`) selects the isometric renderer, anything else is pixel. `scripts/lifesim-shots.mjs` defaults to the app default view, runs the phone with touch, and now also shoots the dialogue, hat shop, credits, Conversa, Pedido rápido, Me vê um and the kitnet decorate panel.

### Tests

10. `manifest.test.ts` (images typed, every bag item has an icon, every NPC has 4 expressions, every furniture item has a rot-0 sprite, `nineSlice`), `pixelArt.test.ts` (expressions, chrome variables), `credits.test.ts`, `pickView.test.ts`. 759 -> 773.

### Known weaknesses

The generated SVG icons in the top bar are smooth vector art next to pixel frames (no pixel icons exist for them); the frame borders use 1 art pixel = 1 CSS px on pills and buttons but 2 on modals, so the two densities differ; the modals for Me vê um, Roll and the Conversa/Pedido scenes keep their older themes; the checklist stays hidden on phones (existing rule); border-image on fractional device pixel ratios (1.25) is uneven.

### Needs BR review

New PT strings: "Créditos", "Arte", "Vozes", "Fontes", "Motor do mundo", "Música e sons" and the credit notes (with English glosses) in `creditsData.ts`. No curriculum cards.

---

## Decisions made in Phase 4a (in-world polish of the pixel view)

Scope: the in-world half of HOWTO Phase 4 (labels, guides, camera, calmer floors, west door, dropped decor, decorate mode, padaria life). The DOM chrome, credits, icons and the switch of the default view are Phase 4b. Branch `lifesim/p4a-world-polish`, shots in `docs/lifesim/shots/p4a/` (`node scripts/lifesim-shots.mjs --view=pixel --phase=p4a --decorate --chat`).

### Labels and guides (`labels.ts`, `guides.ts`, `pixel.css`)

1. **Bubbles use the art track 2 `ui/bubble` 9-slice at 2x**, file, slice and size read from the manifest's `images` (`LabelLayer.setArt`, called by `PixelView` once the manifest has loaded; `manifest.ts` is untouched, its `images` type already existed). The tail is bottom-left; a canvas-mirrored copy (tail bottom-right, slice insets swapped) is used when the speaker is in the right half of the screen, with 24 px of hysteresis (`bubbleSide`). The tail tip sits over the speaker (`bubbleLeft`), the bubble is clamped inside the screen, older lines stack above with their tail tips touching the bubble below. Until the manifest arrives (or if the art is missing) a plain cream box is used.
2. **Nameplates**: stepped-corner pixel plates (two `clip-path` layers, 2 px edge): Verde for players, terracotta for NPCs, mustard edge on yourself. Plate and bubble sizes are measured only when their text changes and the plate width is forced even, so positions are always whole CSS px and text stays crisp. DOM elements are keyed and reused; bubble lines are rewritten only when their text changes; transforms and opacity are written only when they change.
3. **Guides**: the bouncing arrow is `ui/guide_arrow_strip` (4 frames, the bounce is drawn into the strip) as a CSS steps animation at 2x, with the label in a mustard plate. `pinGuide` (pure, tested) clamps the tip to the HUD-free part of the screen (`host.insets()` plus 4 px) and picks down / up / left / right by the larger overshoot; the arrow is turned with `rotate()` in multiples of 90 degrees, which is lossless for pixel art.

### Camera (`coords.ts`: `roomZoom`, `roomFraming`)

4. **Interiors fit whole when they can.** The zoom is still an integer in device px. `roomZoom` starts from the HOWTO 5.3 zoom for the window and takes one integer CSS zoom lower (never below 2) if that makes the whole room, walls included, fit in the HUD-free region: the padaria, academia and kitnet on a 1280 x 800 desktop go 4 -> 3 and are centred with the whole north wall band in view; phones already fit. Rooms that still do not fit (the praça, 288 art px tall with its facade) keep the window zoom and follow the avatar. `cam.scale` follows the chosen zoom, so e2e's `clickTile` is unaffected.
5. **North wall rule when following**: while the avatar is in the top 3 rows the view sits at the top of the 3-tile wall band; over the next 4 rows it eases into plain following (`NORTH_ROWS`). The band, not a facade rising above it, is what is kept (using the facade top pushed the avatar under the chat bar and broke the e2e floor click; found and fixed by the e2e). The camera target can move up to about 2.5x the avatar's speed while easing; `WorldScene` smooths it further.

### Floors, door, decor

6. **Contrast -38%** for the ladrilho, the taco parquet and the tatame checker: `calm()` in `custom/floors.mjs` pulls every pixel toward the mean colour of the whole fill set (all tatame phases together) with gain 0.62; luma standard deviation 30.2 -> 18.7, 45.2 -> 28.2, 20.3 -> 12.7 (tested against those baselines, 0.58..0.67). The taco is also 12 luma lighter. The drawings are unchanged, only the tones are closer. Brick, checker and calçada are untouched.
7. **West door redrawn** (`doors/west`): a closed door in a frame in the wall strip: the wall cap runs on past it, navy outline, wooden jambs and lintel, a light wood leaf with a small glass window and glint, a lower panel, a brass handle. No open leaf. The doormat is still the portal tile in front of it.
8. **Dropped decor is authored on the north wall** through a new optional `RoomDef.pixelWalls` in `rooms.ts` (the whole top-down north wall, all `wall: 'right'`, columns -1..cols-1 with -1 = the corner). When present the pixel view draws exactly it and the relocation heuristic is off for that room; the isometric view keeps using `walls` untouched (its left-wall decor also drives the iso window lighting, so moving those items would have changed the iso view). Padaria: TV | 4 tiles of shelves under the toldo | window | clock | blackboard (shelf, toldo and blackboard art re-cut to 64, 64, 32 px). Academia: OSS poster | ACADEMIA DO BAIRRO sign | window | mural. Praça: EDIFICIO building from the west corner to the facade with a slim METRO sign hung on it (`walls/metro` is now 32 x 14), the padaria facade, the SAMPA mural around the academia door. Not shown: the second praça `predio` ("EDIFÍCIO IPÊ", the same art as the first) and the "TUDO BEM?" mural: the facade covers columns 2-9 and the academia door column 10, so 2.5 + 3 tiles were free. Kitnet is unchanged (its relocation already shows everything). Interact tiles, portals, props and both room test suites are unchanged.

### Decorate mode (`decorate.ts`)

9. **Ghost**: `ghostFor` (pure, tested against `canPlaceFurniture` on every tile) returns the piece, rotation, tile and validity for `game.placing`, or for the selected piece in edit mode (moving it; its own uid is ignored). The scene draws the real `furniture/<id>_<rot>` sprite at alpha 0.72 with a light multiplicative tint (green `0x9dffb0`, red `0xff8272`) above the tile highlight (green / red). R rotates through the existing key handler (`game.placing.rot`). The selected placed piece gets a navy + mustard 1 px outline hugging its sprite with corner studs, pulsing slightly.

### Padaria life

10. **Ticket rail**: `props/trilho_pedidos` is still (frame 0) until `modalId() === 'minigame'`, then plays its 2 frames at 2.4x speed; back to still when it closes (read-only use of `ui/modal`). Checked in a browser: idle `playing: false`, with Me vê um open `playing: true`.
11. **Window light patch**: `fx/light_patch_32|48` (generated in `custom/fx.mjs`: a slanted, warm, three-band dithered parallelogram with the mullion and transom shadows as gaps, light from the upper left) drawn ADD-blended on the floor under every north-wall window (`windowPatches`), registered in the lighting rig (`LightingRig.patches`, faded out with the night darkness). Padaria, academia and kitnet windows all get one.

### Tests

Guide edge pinning, camera framing (zoom step-down, top rows, easing, phone), ghost validity colour, bubble placement, room decor layout (pixelWalls disjoint, in bounds, kinds present, windows), floor contrast and the door / decor art (`scripts/lib/pixel/art4a.test.mjs`). 759 -> 801+ tests.

### Environment notes

`pnpm verify` can fail once on a Windows EPERM tmp rename in `app.test.ts` / auth tests (passes alone and on rerun). The e2e signup rate limit needs a server restart between runs. `e2e:meveum` was run with `BASE_URL=.../?view=pixel`.

### Known weaknesses

The praça's second building and the TUDO BEM mural are still not shown; the slim METRO sign is small and simple; the ghost chair is only 16 px, so the green tile does most of the signalling; the window light patch on the green tatame tints toward cyan; on a desktop the interiors are at zoom 3, so characters are smaller than in the praça (zoom 4); bubbles of two neighbours can overlap each other's plates (no collision handling).

## Decisions made in Phase 6a (clock, day/night lighting, weather)

Scope: HOWTO Phase 6 steps 1 to 4 plus the performance and accessibility rules of section 5.11. Ambient life, audio zones and the intro rebuild (steps 5 to 7) are not part of this track. New code lives in new modules; `WorldScene.ts`, `lightingRig.ts`, `main.ts`, `ui/hud.ts` and `props.ts` got small hooks.

### Clock

1. **`gameClock.ts`** (client, `GameClock` + a singleton `clock`). `skew = serverNow - Date.now()` is taken from the first `welcome` / `roomState` stamp and only replaced when a later stamp disagrees by more than 1 s, so latency jitter never moves the sky. `minutesExact()` is the smooth (fractional) version of `gameMinutes` that the lighting uses, so the grade does not step once per game minute.
2. **Overrides.** `?clock=N` (1..600), `?time=HH:MM` (freezes the time of day; runs at `?clock` speed if both are given) and `?weather=` are honoured only when `import.meta.env.DEV`. The scripts and e2e run against the production build, so the same controls are also `window.__tb.setClock({ time, weather, speed })`, next to the other `__tb` test hooks (`walkTo`, `interact`). `__tb.clock` is the clock itself.

### Lighting (outdoor rooms live, interiors fixed)

3. **`dayNight.ts` is the pure look.** `computeLook({ outdoor, roomHour, minutes, weather })` returns everything the rig draws (grade, shadow fill, darkness, sun glow, cast shadows, window patches, lamp strength function); the rig only draws it (`LightingRig.apply(look | hour)`; the style frame still passes a plain hour and gets the old look). Outdoor is decided by floor chars (`g` or `a` present), so it survives a new map. The Phase 1 keyframes, softened golden hour and `shadowFill` are used unchanged.
4. **Night is capped at 0.50 darkness** (the doc says 0.55): with the cool grade and the navy overlay the plaza read as flat dark; 0.50 keeps the blue night and lets the warm lamp pools carry it. Lamp halo and pool glow alphas went up (0.4 to 0.6, 0.26 to 0.55) and the local player has a small warm light (a `player` light that follows the avatar, radius 30 art px), as HOWTO 5.8 asks.
5. **Light schedule** (`lightState`): on from 18:00, off from 06:00, each light shifted by `lightDelay(x, y)` = a hash of its world position mapped to 0..40 game minutes, and eased over 5 game minutes (10 real seconds) so nothing pops. It drives lamps (`poste`, `poste_fios`, the manifest `light` of the lamp sprites and the quiosque), facade windows, the estufa `_lit` overlay and a new synthetic banca light (`PROP_LIGHT.banca`). Interiors use the same schedule for their own lit pieces (the estufa), although their grade is fixed.
6. **Every facade window is its own light.** The facade `_lit` overlay is cropped per window rectangle (`setCrop`, 1 px slack; the overlay's opaque pixels are inside the manifest window rects except 36 and 16 edge pixels on the padaria and academia), so windows of one building switch on at different minutes. Each window also owns its light hole and glow.
7. **Interiors**: the grade is `gradeAt(ROOM_HOUR[lighting])` whatever the time. What follows the live clock is the sky: the window light patches lose the warm sun after dusk, take a faint cool moon tint (alpha up to 0.3) and are dimmed by weather; the window glass gets a dark night sky with two stars per pane (`windowPanes`, drawn over the pane rectangles of `walls/janela` and `walls/janela_rua`, mullions left alone), faded by the live clock. These are flat rectangles and single pixels, not art.

### Weather

8. **`weatherLook.ts` (pure) holds what each weather does**: grade tint and desaturation, sun left, storm gloom, rain density, puddles. `WeatherBlend` eases the live numbers toward the target weather (time constant 2 s) so the 06:00 roll or a dev change fades instead of popping. Weather tint and desaturation are multiplied by a night factor so the night grade is not doubled down.
9. **Grades.** nublado: desaturated 0.5, cool tint, sun 0.28 (cast shadows, sun glow and window patches shrink with it). garoa: blue-grey, sun 0.12, gloom +0.08. chuva: darker blue-grey, no sun (no cast shadows, no low-sun glow), gloom +0.17, car headlights on. There are no cloud shadows in the scene yet (`fx/cloud_shadow` is not used), so nublado has nothing to switch off there; the ambient track can read `params.sun`.
10. **Rain is a pool of images, not an emitter** (`weatherFx.ts`), so the particle count is exact: `MAX_DROPS` 190 + `MAX_SPLASHES` 34 + `MAX_RIPPLES` 14 = 238 at most, under the 300 cap with room for petals and critters (a test asserts drops + splashes + ripples <= cap - 40 for every weather and fx level). Streaks are tiny canvas textures drawn in art pixels (3x7 slanted, a shorter far layer) scaled by the integer camera zoom, in screen space on the `fx` camera. Garoa: about 100 fine drops. Chuva: 190 drops, splash crowns where drops land, and ripples on puddles.
11. **Puddles** are runtime pixel-ellipse decals (soft lip on the lit upper edge, darker below, three sizes, two shapes) on free calçada and asfalto tiles (`c`, `a`, not blocked by props or NPCs), chosen by a tile hash (11% of eligible tiles, at most 160), so every player sees the same wet street. They fade with the weather. Nothing about weather is drawn in interiors (rain fades in 0.45 s at the door).

### NPC small talk

12. **Idle lines are chosen on the client** (`main.ts`), so the mix lives in `idleTalk.ts`: `IdleTalk.next` takes a weather line (`WEATHER_IDLE_LINES`) only after at least three ordinary lines, with a 50% chance, so it is at most 1 in 4 (tested with an always-yes roll). Sunny and cloudy chat is kept out of the night (21:00 to 06:00); rain lines are allowed any time. No new PT strings were written (the weather lines were already `needs_br`).

### Performance and accessibility

13. **`perf.ts`**: `FrameProbe` (5 s rolling window of frame times, stalls over 500 ms ignored), `LowFxGovernor` (trips once when p90 > 25 ms across a full 5 s window; never un-trips) and `reducedMotion()` (re-read once a second). `window.__tb.perf` returns fps, avg / p50 / p90 / max ms, low-fx state and reason, reduced motion, particle counts, weather and darkness. Low-fx (`?lowfx=1` or the fallback): vignette removed, rain halved, no splashes or ripples. Reduced motion: 40% of the rain, slower, no splashes. There is no tweened zoom in the scene yet (the camera zoom is an integer step per room), so that clause has nothing to switch off; Phase 7's dialogue zoom must read `reducedMotion()`.
14. **Fallback verified** by throttling the CPU 12x through CDP: the governor tripped after the first 5 s window with p90 25.1 ms.

### HUD

15. **Clock pill** (`ui/clockPill.ts`, `styles/clock.css`): `.top-left` wraps the brand and the pill; it is a normal `.pill`, so the pixel chrome applies. `Seg · 17:40 · ☀️`, tooltip and `aria-label` `Monday · 5:40 pm · Sunny`; a clear night shows a moon; garoa 🌦️, chuva 🌧️, nublado ☁️. It re-renders only when the text changes (polled every 500 ms). **On a phone (<= 640 px) the weekday and the separator move to the tooltip** (`17:40 ☀️`) and the brand's English sub-line is hidden so the row still fits brand + clock + Verde + RV at 390 px.

### Tests and tools

16. New unit tests: skew and clock progression (`gameClock.test.ts`), schedule with per-light delay, no-pop, interior fixed grade, window dimming, weather look (`dayNight.test.ts`), weather to FX mapping and particle plan (`weatherLook.test.ts`), probe and governor (`perf.test.ts`), NPC talk ratio (`idleTalk.test.ts`), pill text (`ui/clockPill.test.ts`).
17. `scripts/lifesim-shots-p6a.mjs`: the time-of-day and weather shots (`--interiors` adds padaria and academia at 12:00, chuva and 23:00; `--perf` prints `__tb.perf` per scene; `--throttle=N`, `--lowfx`, `--reduced`, `--only=`). The shots use `__tb.setClock`.

### Known weaknesses

Rain streaks are screen-space, so they do not react to the buildings (they fall over facades and the dark backdrop outside the map); the splash crowns are drawn where a drop lands on screen, which can be on a wall; the night is blue-grey outside the lamp pools and the pools themselves are more white than amber (the erased hole shows the neutral ground; the amber comes from the additive glow); interior lit pieces (estufa) barely change at night because the interior grade is fixed; the weather tint is a multiply on a screen grade, so saturated props stay fairly colourful under chuva; the weekday is only in the tooltip on phones.

## Integration with main (#47, #48)

`origin/main` gained two squashed commits from other agents: #47 (a squashed copy of our early Phase 1 plus a simpler pixel `WorldView`) and #48 (the intro-crash fix).

1. **lifesim/main wins every conflict.** All 40 add/add and content conflicts were resolved with our version (the pixel view, coords, manifest, clock, weather, joystick, shared index, DECISIONS, generators). Their auto-merged edits to `styles.css` (a `#world-labels` block that our `pixel.css` already owns), `styles/intro.css` and `scripts/e2e.mjs` (a duplicate `interact` helper) were dropped too; the #48 behaviours are re-implemented below.
2. **Main-only files removed** as dead duplicates (nothing imports them): `render/pixel/moveStep.ts` and `hitbox.ts` with their tests, `docs/lifesim/decisions-p1.md` (already folded into this file), four `docs/lifesim/shots/p2/*.png` and six orphan `public/pixel/chars/{hair,outfit}_*.png` (`pnpm pixel` no longer writes them). `pnpm pixel` reproduces the tree exactly.
3. **#48 ported, surgically.** (a) `PixelView` no longer boots Phaser in its constructor; `start()` is called from `main.ts` `boot()` after the intro gate resolves (or is skipped by a live session), before `net.connect()`. Solo builds go through the same path. (b) `main.ts` puts `view-pixel` on `<body>`; `intro.css` ends with `body.view-pixel #world { filter: none; transform: none }`. (c) `coords.ts` `bufferPixels()` clamps the dpr to 1..3 and lowers it so neither side of the backing store exceeds 4096; `PixelView` uses it at boot and resize, and `WorldScene.updateCamera` reads the effective `cam.dpr` instead of `devicePixelRatio` so the device zoom stays an integer. At dpr 3 and 1600x1000 the canvas is 4096x2560.

## Decisions made in Phase 5 (Vila Ipê, the neighborhood map)

Branch `lifesim/p5-vila-ipe`. Shots in `docs/lifesim/shots/p5/` (`node scripts/lifesim-shots.mjs --phase=p5`, golden hour 17:30 through `__tb.setClock`, plus `praca_1930`; `extra_street`, `extra_buildings`, `extra_fountain`, `extra_full_map` are clean shots without the HUD).

### The deletion (own commit)

1. Deleted `render/{room,props,world,iso,draw,avatar,icons,pickView}` (+ `pickView.test`), `render/avatar/*`, the art studio (`art.html`, `art/{registry,sprites,studio,studio.css,manifest.test}`), `scripts/{bake-art,art-stamp,shots,padaria-shots,padaria-v4-shots,character-shots,character-contact}.mjs`, the `pnpm art` script and the `art` Vite entry. `?view=iso` is ignored with a console note. `public/art/*` (baked iso PNGs) stays on disk for Phase 10; nothing references it. `bjjPoses` keeps its two canvas helpers in `render/canvas2d.ts`. Tests dropped with the code: `pickView`, the art manifest test, and the two `academia-branding` tests that read the deleted files.
2. **Top-bar icons are pixel now**: 16 authored 16x16 icons (`custom/uiicons.mjs`, keys `ui/icon_<name>`), shown by `icon(name, size)` at the nearest whole zoom (16-23 px 1x, 24-39 px 2x). Coin, seedling, logo and the intro patterns stay small SVG CSS variables (`SP_MAP` copied into `art/ui.ts`).
3. **The style frame page stays** (`lifesim-frame.html`): it is the art reference, still builds and shares terrain and lighting code with the game. It can go whenever nobody needs it.

### The map (`packages/shared/src/rooms.ts`, room id `praca`, "Vila Ipê" / "Ipê Village", 56 x 40)

4. Rows: 0-5 north building row | 6-7 calçada | 8-11 Rua dos Ipês | 12-13 calçada | 14-29 Praça Central x10-40 (west houses x0-9, fenced feira lot x41-55) | 30-31 calçada | 32-35 Rua Jacarandá | 36-39 roofs. Deviation from the plan: the north row is x0-5 sobrado, x6-11 terraço, padaria x12-19, party wall + banca x20-22, Edifício x23-32, academia x33-42, terraço x43-48, sobrado x49-55 (the pack houses are 6 or 7 tiles wide; the plan's 10-tile house blocks do not divide).
5. New `PropKind`s `fachada` (`art` = sprite key, footprint = the whole front), `cenario` (any sprite, `art`), `sebe` (hedges, planters, hydrants, `art`), `cerca` (fenced rectangle or street barricade, `art`), `fonte`, `ponto_onibus`; `PropDef.art`. `PortalDef.wall` is optional, `PortalDef.doorAt` (fractional tile) is where the door art is (guide arrow, click box). `RoomDef.outdoor`; `pixelWalls` is gone for praça. `buildGrid` un-blocks a portal tile (the door is inside its facade's footprint) and reserves the room's spawn.
6. **Coordinates.** Spawn (25,27). Doors (portal tile, door art x, tile you land on outside): padaria (16,5), 15.5, (16,6); Edifício Ipê / kitnet (24,5), 24, (24,6); academia (38,5), 37.5, (38,6). Interior arrive tiles are unchanged (padaria 1,6; kitnet 1,5; academia 1,6); the three exit portals now arrive at the sidewalk tiles above. NPCs (interact tile): Nanda (35,13) behind her stall, (34,15); Júlia (22,19), (22,20). Kiosk (20,14), interact (21,14). Hat stall `barraca` (34,14) 2x1, interact (34,15). Parrot perch (30,24), interact (29,24). Fountain (23,20) 4x3. Banca (20,4) 3x2 in front of the party wall. Bus stop (30,12) 3x1. Benches (2x1, seat SW): (20,17) (28,17) (20,25) (28,25) (14,20) (36,20) (15,29) (33,29) plus (1,25). Ipês: hero (12,16) 2x2 and medium (17,18) (35,17) (13,26) (18,24) (37,26) (3,27) (8,24), two more inside the lot.
7. **Edges are closed**: buildings on the north and south, barricades across each street end, hedges across each sidewalk end, fences along the west lawns and the lot (tested: every border tile is blocked). The Edifício's rooftop (28 px above its 6 rows) is cropped by the map top.
8. **Tests** (`rooms.test.ts`): sizes and names, zones, props inside the map and off each other, doors on row 5 inside a facade, `findPath` from spawn to every door, sidewalk-in-front, NPC and prop interact tile and every seat, a 2x2-block "wide lane" BFS from spawn to all of them, blocked borders. `maxNodes` did not need raising. `vilaIpe.test.ts`: every prop and decal resolves to the manifest, facades are as wide as their footprints, and **no 4x4 window of tiles is free of visible detail** (props with their overhead parts, fences, non-grime decals).

### Art (all through `pnpm pixel`, `artMissing` stays empty)

9. Houses derive from the pack's brown "Generic Buildings" townhouses (`custom/vila.mjs`): one-floor with terrace, two-floor, four-floor cropped to 6 rows, wall / trim / door ramps swapped for pastel colourways (salmão, amarelo, azul, verde, lilás), lit-window overlays. The 4-row roofs across Rua Jacarandá are the terrace of the one-floor house (rim recoloured, deck kept). Authored: the party wall with a "TUDO BEM?" mural, the bus stop ("ONIBUS"), the "EM BREVE" banner. From the pack singles: flower planters, hydrants, mailbox, parking meter, traffic barricade, two fence sets, the BUS road marking. Only short unaccented words are painted into pixels (D8).
10. `scenery.ts` (pure): crosswalks, lane dashes, the São Paulo mosaic, manholes, the bus lane, wildflowers, tufts, grime and the pole-to-pole wire runs, deterministic. The scene draws them; facades sort at the top of their bottom row so a walker on the door tile stands in front of the door.

### Rendering, camera, UI

11. Outdoor rooms skip the wall band, the facade-on-door logic and the west strip; terrain runs to the edge (no curb at the border). `?shot=map` (and `__tb.renderer.setShot('map')`) fits the whole map at the biggest integer zoom (1x on 1280 x 800). The camera follows and clamps to the map; while you stand on the north calçada (rows 0-8) it stays at the top so the building fronts are whole (`OUTDOOR_NORTH`).
12. **Guides** (`main.ts guideAt`) find the portal / prop / NPC by id in the room data. **Mapa** panel: a pixel minimap (`ui/minimap.ts`, 2 px per tile drawn once into a canvas, terrain plus shaded buildings, trees and fences, doors, NPCs and "você" while you are outside), shown 3x (2x on phones) above the room cards; the panel title is "São Paulo · Vila Ipê".
13. **`cpuTarget(humans, room)`**: for `praca` 8 CPUs at 0-1 humans, 6 at 2, 5 at 3-4, 3 at 5-6, 2 at 7-8, 1 at 9-12, 0 above; other rooms keep the old table (test: never rises with more humans). Ambiance spots, door spots and entries (street ends) are new; the server tests use the new coordinates. e2e: real canvas clicks on a floor tile and on bench (21,17) near the kiosk, CPUs 4-8, `artMissing` empty; two-window walks (30,27) and (20,27).

### Known weaknesses

Roofs across the south street are plain (one terrace, five colourways, no dishes); the west block is one house plus a garden and a corner; the dog is a static sleeper (Phase 6 makes it move); the streets have no traffic yet; the 4x4 rule is checked against sprite bounds, so a big tree canopy counts even where it is mostly transparent.

### Needs BR review

Painted in pixels: TUDO BEM?, EM BREVE, ONIBUS, BUS (pack). DOM/labels: "Ponto de ônibus", "Em breve: a feira livre!" / "Coming soon: the street market!", "Fonte da praça", "Vira-lata caramelo", "Mapa da Vila Ipê", the minimap key ("portas", "vizinhos", "você").

## Decisions made in Phase 6b (ambient life, audio zones, the title screen)

Branch `lifesim/p6b-ambient-audio-intro`. Shots in `docs/lifesim/shots/p6b/` (`node scripts/lifesim-shots-p6b.mjs [--only=..] [--intro] [--perf]`). Scope: HOWTO Phase 6 steps 5 to 7. New modules, small hooks in `WorldScene.ts`, `PixelView.ts`, `main.ts` and `ui/intro.ts`.

### Ambient life (`render/pixel/ambient*.ts`)

1. **Three files.** `ambientData.ts` (per room id: street lanes, bus stop, dog home, pigeon flocks, fountain, audio zones; Phase 5 coordinates), `ambientSim.ts` (pure, tested: traffic, bus, dog, pigeons, gates, cloud blobs), `ambient.ts` (Phaser pools, one `AmbientLife` per scene, `buildRoom` / `update` / `clearRoom`). `__tb.ambient` = `{ info(), bus(inMs) }`; `perfInfo()` adds `ambient` and counts its particles.
2. **Time.** Movement runs on the server-synced wall clock (`Date.now() + clock.skewMs`), not the game clock, so a pinned `setClock({time})` does not freeze the cars. Gates that follow the day use the game minute (no traffic 01:00 to 05:00, the dog's naps, butterflies, fireflies); a vehicle's gate uses the minute it entered at, so nothing vanishes when 01:00 strikes.
3. **Traffic.** One slot per 4 s per lane, seeded by `hash2(slot, lane)`: chance 0.22 by day (0.16 evening, 0.10 dawn, 0.07 late, 0 at 01:00 to 05:00), Rua Jacarandá at 0.7 of that. Types: two cars, kombi, fusca, moto. Right-hand traffic: westbound in the upper lane, eastbound in the lower lane. Vehicles queue behind the one that entered before them (nobody passes; tested: no overlap in a lane). They enter and leave behind the barricades (alpha ramp at the map edge). Depth is the wheels' y; purely visual.
4. **Bus.** Every 6 game hours (at normal clock speed 05:30, 11:30, 17:30, 23:30, from the real time `t mod 720 s`), eastbound lane of Rua dos Ipês, braking 1.8 s, standing 8 s on the painted BUS marking (stopX = 36.5 tiles), pulling away. Cars queue behind it. `__tb.ambient.bus(-900)` brings one to the stop for shots.
5. **Headlights** are the rig's existing `car` lights (a pool of 10: darkness hole + warm glow), lit when the rig's `look.glow` is (night, rain).
6. **Vira-lata.** `DogSim`: asleep at its corner 12:00 to 15:00 and 22:00 to 06:00 (walks home when a nap starts), otherwise idle 5 to 14 s, then a BFS path to a seeded waypoint at 15 px/s, only on walkable tiles within 6 tiles of (5,26). The Phase 5 static prop `vira_lata` stays in the room data (its tile stays blocked; rooms.ts untouched) but the scene skips its art when an ambient dog exists.
7. **Pigeons.** Three flocks (4 + 3 + 3). The first bird someone comes within 2 tiles of (all avatars, CPUs included) takes the whole flock off, each bird 0.07 s apart, away from that person and up (the sprite flips at 14 Hz and is lifted, its shadow stays), fades, stays away 18 to 40 s and returns only when nobody is within 4 tiles of its spot. The pack has no flying frames, so the flap is the flip.
8. **Butterflies** (8, tiny generated 2-frame pixel textures; day, not in rain, never in low-fx or reduced motion), **fireflies** (16, night, drawn on the fx camera above the darkness as one integer-zoom pixel plus an additive halo so the night cannot swallow them), **petals** (pool of 26 using `fx/petal_a|b`, spawned under the canopies on screen, more in gusts, fewer in rain), **cloud shadows** (4 crops of `fx/cloud_shadow`, alpha 0.28 at most, drifting 6 px/s, only when `params.sun` is above 0.55 so never under nublado, garoa or chuva, gone by dusk), **fountain spray** (10 droplets on arcs). **Laundry flutter was skipped**: the pack has no separate laundry art (the wire on the Edifício is part of the facade sprite).
9. **Budget.** Ambient particles are at most 26 petals + 16 (fireflies or butterflies, never both) + 10 spray = 52 on top of the rain's 238 at most (274 under chuva, since butterflies and fireflies are off in rain). Low-fx: 12 petals, no butterflies, fireflies or clouds, half the pigeons. Reduced motion: 6 petals, no butterflies, fireflies, clouds or spray; traffic, the dog and the pigeons carry on.

### Audio zones (`ambience.ts`, `audio/zones.ts`, `audio/zonesFeed.ts`)

10. **Everything is synthesized** (no sample files, nothing to credit). The Praça bed keeps wind and the pluck and gains six zone layers, each behind its own gain node: traffic (brown noise, a swell, passing swooshes), fountain (band-passed white noise with a burble), birds (the old chirps, more often, gated by the mix), crickets (3-pulse bursts on about 4.1 and 4.4 kHz), rain (hiss and drumming), a distant radio (telephone-band triangle notes with static). `zoneMix` (pure) gives 0..1 per layer from the player's position and the game minute: traffic within 40 px of a street centre line fading to 0 at 180 px (so the middle of the praça is quiet), fountain 44 to 200 px, radio 26 to 150 px around two house windows (08:00 to 22:00), birds and crickets cross-fade with daylight, rain follows the weather. Interior beds are untouched; the mix is silent indoors.
11. **Footsteps.** One step per 10 px walked by the local avatar (a teleport or room change resets it); a short filtered noise burst (plus a low thump on wood and tatame) per terrain from `floorAt`, at most 0.06 gain, pitch and filter within plus or minus 5 %. It goes through the same duck gain as the beds, so speech ducks it.
12. **Toggles.** The switch that matters is the existing Música one (`ambience.enabled`), which also gates footsteps and the zones; the Voz toggle (`game.sound`) is speech only and stays so. Nothing plays before the first gesture, or during the intro bed.

### The title screen (`ui/introHeroScene.ts`, `introSnapshot.ts`, `introCamera.ts`)

13. **No second Phaser game.** `planSnapshot` (pure, tested) turns the real `praca` room into a depth-sorted list of draw ops (terrain tiles through the new `terrainPlan.terrainTiles`, which `terrainLayers.ts` now shares; decals, props, facades, fences, shadows, canopies, wires); `paintSnapshot` draws it once on an offscreen 2D canvas (896 x 640 art px) from the atlas and tileset and applies the game's own 17:30 grade (`computeLook`: multiply, cool fill, cast shadows). The canvas is panned with CSS transforms at an integer zoom (`introZoom`: 2 on a phone, 4 at 1280 x 800), `image-rendering: pixelated`, offsets rounded to device pixels, there and back along a 110 s route at under 6 art px/s with eased ends. A warm CSS light and softened CSS grades sit over it; the sky gradient is the fallback while the snapshot loads. On a phone the picture lifts into the strip between wordmark and card when the card arrives. Reduced motion: one still frame.
14. **Kept:** all intro logic and ids (`#intro-enter`, `#intro-skip`, the card), the atmosphere canvas (petals, motes), the parrots (pure canvas, they fit), the "Art: LimeZu" footer. **Deleted:** the procedural SVG scene (skyline, Padaria, fountain and passer-by drawn in code, about 600 lines), its CSS (about 350 lines) and the two camera tests of the old framing.

### Tests

`ambientSim.test.ts`, `zones.test.ts`, `introSnapshot.test.ts` (31 new tests in all): determinism, lane directions, no overlap, night gate, bus schedule and stop, queue behind the bus, dog hours and walkable wandering, pigeon scare radius, flight and return, cloud gating, zone gains by position, hour and weather, footsteps per terrain, pitch, step clock, snapshot plan, zoom, pan, no void.

### Known weaknesses

The pigeons' flap is a sprite flip; vehicles fade at the map edge instead of driving out of a real opening; the audio has not been heard by a human in this track (no speakers here), so levels are educated guesses from the synthesis code and need an ear; the title screen is a still map with petals and parrots (no moving cars or people in it); the headless box trips the low-fx fallback under load, so the shots script pins it off.
