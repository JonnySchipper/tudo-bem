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
    **Amended (diagonal flicker fix):** the per-frame delta comparison flipped E/W <-> S/N every frame on an exact diagonal (float noise at |dx| = |dy|), so walking facing now comes from the path STEP (`facingAlongPath` in `render/pixel/facing.ts`): decided once per step from tiles, diagonals face E/W, smoothed over the next two steps so an A* cardinal jog does not turn the sprite. After a walk the walking facing stays while standing; the wire Dir only turns the sprite when it changes (its diagonal values are isometric and ambiguous). Keyboard: a lone first key waits 60 ms (`KEY_CHORD_MS`) for its partner so W+D steps diagonally instead of straight-then-turn. `scripts/e2e-facing.mjs` records the per-frame facing.
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

### Performance (`__tb.perf`, headless Chrome / SwiftShader on a shared, busy box, 1280 x 800, full effects pinned on)

Busiest scene, 19:30 chuva with traffic, bus, headlights and the CPU crowd: 49 fps, avg 20.4 ms, p90 30.8 ms, 236 particles (rain 188 drops + 31 splashes + 5 ripples, ambient 12). Sunny noon with the bus, clouds, 8 butterflies and petals: 92 fps, p90 18.6 ms, 26 particles. Without the pin the governor trips to low-fx on this box under load (p90 over 25 ms), as designed.

### Known weaknesses

The pigeons' flap is a sprite flip; vehicles fade at the map edge instead of driving out of a real opening; the audio has not been heard by a human in this track (no speakers here), so levels are educated guesses from the synthesis code and need an ear; the title screen is a still map with petals and parrots (no moving cars or people in it); the headless box trips the low-fx fallback under load, so the shots script pins it off.

## Decisions made in Phase 8b (NPC schedules)

Branch `lifesim/p8b-npc-schedules`. Shots: `docs/lifesim/shots/p8b/` (`closed_stall_2100`, `closed_stall_shop`, `carlos_bench_2230`, `padaria_2300_graca`, `academia_prof_bia`). Night run: `scripts/e2e-night.mjs` (`PHASE=a|b`, server started with `TB_TEST_CLOCK_OFFSET_MIN`).

### Model

1. **A schedule is a pure function of the game clock** (`schedules.ts` data + `npcMotion.ts`). Slots tile 0..1440 (`from` inclusive, `to` exclusive; 05:59 belongs to the slot ending 06:00). At a boundary the NPC walks from the previous slot's tile to the new one with `findPath` over the room's static grid; cross-room is two legs (walk to the portal tile and vanish, appear at the portal's arrival tile and walk on); `em_casa` is a walk to a home door (padaria door, or the Edifício Ipê door in the praça) and back out of it. Nothing is stored, so reconnects, every instance and the tests agree, and a walk in progress resumes from any moment.
2. **Slots carry an `interact` tile** (where to stand to talk to or hand something to the NPC in that slot). `NpcDef.x/y` is the fallback, `NpcDef.schedule` optional. `ScheduleSlot.activity`: `trabalhando | passeando | sentado | em_casa`.
3. **The padaria counter is behind the balcão** (a pocket no path reaches), so NPC paths use `npcNavGrid`, which opens the vase tile (9,2) as a staff gap. Players still cannot enter.
4. **Walks take up to about 6 real seconds; 1 game minute is 2 real seconds**, so an NPC is still walking a few game minutes after a boundary (tests assert every transition under 30 s).

### Schedule table (game time)

| NPC | Slots |
|---|---|
| Seu Carlos | 00:00-06:00 em_casa · 06:00-22:00 padaria counter (3,1), talk from (3,3) · 22:00-23:30 praça bench banco_2 (28,17), talk from (28,18) · 23:30-24:00 em_casa |
| Dona Graça | 00:00-06:00 padaria counter · 06:00-17:00 em_casa · 17:00-22:00 padaria table chair (6,6), talk from (6,5) · 22:00-24:00 padaria counter |
| Nanda | 00:00-08:00 em_casa · 08:00-20:00 at her stall (35,13), talk from (34,15) · 20:00-24:00 em_casa |
| Júlia | 00:00-07:00 by the banca (21,6), talk from (20,6) · 07:00-17:00 kiosk path (22,19), talk from (22,20) · 17:00-23:00 bench banco_3 (20,25), talk from (20,26) · 23:00-24:00 banca |
| Professora Bia | no schedule: (8,4) by the tatame, talk from (8,5), every hour |

Júlia's evening bench is banco_3, not banco_1, because the e2e clicks banco_1 for real.

### Protocol

5. **NPCs are avatars** (no new message types): `PublicAvatar` gained `npc?: NpcId`, `npcInteract?: Tile`, `activity?: NpcActivity`; the id is `npc-<id>` (`npcAvatarId`). They arrive in `roomState.avatars`, and `avatarJoined / avatarMoved / avatarLeft` are broadcast like the CPUs' (a world tick every second diffs each instance against the last walk sent, `NpcPose.legId`). A player joining mid-walk also gets one `avatarMoved` per walking NPC (tile reached + rest of the path). `serverNow` (welcome, roomState) now carries the game clock, which adds the test offset.
6. **Test clock**: `WorldOptions.clockOffsetMs`, env `TB_TEST_CLOCK_OFFSET_MIN` (real minutes added to the game clock only; timers are untouched).

### Blocking and interact tiles

7. `buildGrid` blocks an NPC's tile only when it has no schedule (Professora Bia). For scheduled NPCs `World.grid` adds the tile each NPC has reached right now (server side, per call), so players cannot walk or sit onto an NPC and the tile frees when it leaves. CPUs stay off the tiles NPCs stand on or head for (`CrowdHost.reserved`). Recado `give`, nearby-NPC greeting and talk use the NPC's current tile and its slot's interact tile; an NPC who is not in the room is "não está aqui".

### D12

8. **The baker on duty.** The scene (`scene start`) accepts `carlos` or `graca` in the padaria and runs the same authored graph; the talk bond goes to whoever is on duty (`bakerOnDuty`), order events stay `carlos` (the counter role; the daily Pedido RV is once per day for the counter). `sameNpcRole(step, actual)`: Dona Graça counts for Seu Carlos in recado steps (`pedir`, `falar`, `entregar`, `cumprimentar`), not the reverse. `give` to `carlos` works with Graça at the counter. Me vê um needs only the padaria.
9. **Dona Graça** is a real NPC (removed from `OFFSTAGE_NPCS`), with a `CONVERSA_CAST` entry enabled with Carlos's two subjects and a `persona` line in the system prompt. Known gap: a few authored chips still say "Seu Carlos" (offline Conversa).
10. **Nanda's closed stall**: the stall sprite and canopy are dimmed and a plate "Fechado · volta às 8h" shows while she is not standing at it; clicking it opens the hat shop with the note "Nanda volta às 8h". Buying never depended on her.
11. **Professora Bia** (`prof`): `graca_agua_pra_academia` is now `pedir carlos agua 1; ir academia; entregar prof agua 1` (recados.md regenerated). Her look is an off-white gi with the NPC apron layer in near-black as a belt (existing layers only; it reads dark and heavy, art track can replace it). Her portrait is a placeholder: `PORTRAIT_PLACEHOLDER` makes `portraits/julia_*` stand in.
12. **Memory gated on bond**: the Conversa prompt gets `memory` only at 2 hearts or more with that NPC (`MEMORY_MIN_HEARTS`).

### Client

13. The Phaser scene no longer builds NPCs from `ROOMS[...].npcs`: NPC avatars reuse the avatar sprite, walk, sit and label code (terracotta plate with the role, bubbles keyed by NpcId, hit boxes become `{kind:'npc'}` with the live tile and slot interact). `game.liveNpcs(now)` gives live `NpcDef`s to guides, idle talk, `__tb.interact`, the minimap (schedule at the game clock when outside the praça) and the padaria guide (points at whoever is on duty). NPCs are excluded from the head-count and the friends list. The e2e follows the baker on duty by game clock.

### Risks

A player sitting on a seat when an NPC's slot starts there overlaps it; Nanda's delivery recados cannot finish while she is home (they stay active); the evening/night NPC positions at the exact boundary minute lag by up to the tick (1 s); Bia's look and portrait are placeholders.

### Needs BR review

New PT strings: Dona Graça idle lines "Warm bread at night" = "De noite o pão sai quentinho!", "Boa noite! Bora de cafezinho?", "Ih, a noite é longa. Chega mais!"; Professora Bia: name "Professora Bia", role "Professora de jiu-jitsu" (EN: Jiu-jitsu teacher), lines "Oss! Bora treinar?", "Respeito primeiro, depois o tatame.", "Água é vida. Bebe bastante!"; recado `graca_agua_pra_academia` ask "Ei! Você vai na academia? Leva uma água pra Professora Bia! Quem treina tem que beber água."; "Nanda volta às 8h" (EN: Nanda is back at 8 am); stall plate "Fechado · volta às 8h"; counter greeting "Bom dia / Boa tarde / Boa noite! Chega mais, pode pedir!" (chosen by the hour); scene error "O café da manhã é no balcão da padaria." (EN: Breakfast is at the bakery counter.); Graça persona (EN prompt text).

## Decisions: art track 4 (polish: roofs, west block, sky margin, night light, rain, Professora Bia, fountain)

Branch `lifesim/art4-polish`. Before/after shots in `docs/lifesim/shots/art4/` (`before_*` / `after_*`: `map`, `south_west`, `south_east`, `west_block`, `top_edificio`, `lamps_1930`, `lamps_2300`, `praca_1930`, `rain_1500`, `fountain` (+ `_f2`, `_f3` frames), `academia_bia`; `bia_look.png` and `bia_portraits.png` for her sheet). Shots are clean 2560 x 1600 (1280 x 800 at DPR 2) from `node scripts/lifesim-shots-art4.mjs` (`TAG=before|after`), which places the camera with a new debug mode `?shot=cam:<tileX>,<tileY>,<zoom>` (`__tb.renderer.setShot('cam:28,10,4')`). `node scripts/lifesim-bia-sheet.mjs` composes her look with the game's own code.

1. **South roofs**: nine different rooftops (`custom/telhados.mjs`, keys `telhados/r1..r9`, 6 or 7 x 4 tiles, authored in the pack palette): concrete laje with a parapet, caixa d'água, laundry line and plants; colonial tile roof (capa e canal) with a chimney, TV antenna and skylight; corrugated fibrocimento held down by bricks with a dish and mast; a terraço with a brick grill, parasol table and AC units; a slab with a puxadinho (little room with a corrugated roof, door and window); a slate hip roof; a roof garden with planter beds and a pergola. The old one-terrace `telhados/terraco_*` art is gone. `rooms.ts` only swapped the `art` of `telhado_1..9` (ids, positions and blocking unchanged).
2. **West block**: a mango tree (`props/manga`, the ipê tree shape recoloured to deep greens, with its sway canopy) on the lawn strip beside the house, and an edícula (`props/edicula`, a little back house with a barred window and a tile roof) in the fenced garden. The garden flowers, pot and bike moved a tile or two inside the fence to make room (ids kept). Both are in tiles nobody can reach (`cen` props), so no path or lane changes; `rooms.test.ts` is green.
3. **Sky margin above the north row**: `roomBounds` for an outdoor map now starts 2 tiles (32 px) above row 0 (`OUTDOOR_TOP_MARGIN_TILES`), so the camera shows the Edifício's caixa d'água and antenna whole; the margin holds `backdrop/sky_0..3` (224 x 32 chunks: dithered soft-sky gradient, pixel clouds and two layers of far São Paulo buildings with rooftop tanks and antennas, a crane), depth -9500, feet hidden behind the facades. Door and interact tiles are untouched. `vilaIpe.test.ts` expects the new bounds.
4. **Amber night pools**: the pool under a lamp was the ungraded (lavender) calçada, lifted by the erase hole, plus an additive glow that clipped toward white. Now, after the hole, the rig stamps the light colour pulled 90% toward the lamp's amber as a multiply tint in the hole (`warmPool`), scaled by how dark it is, for every light that is not the player's (so the facade window spill is amber too), and the additive pool glow is 0.4 instead of 0.55. Night stays blue-grey around the pools and readable.
5. **Rain vs the facades**: `WeatherFx` builds a ground mask per room (paving, asphalt, grass, bricks, not blocked) and the top/bottom building bands (rows with under 40% open ground). Splash crowns only spawn where a drop lands on a ground tile; streaks fade to 0 over the facade rows, the sky margin and the south roofs. The particle plan (caps, low-fx, reduced motion) is untouched.
6. **Professora Bia**: a new `npc_gi` character layer (`buildGi` in `custom/chars.mjs`, all three body types): crossed lapels on the front frames and a black belt with its knot and tails across the last two torso rows, derived per frame from the silhouette of the camisa + calça outfit, so it follows walk and idle frames. Her look is that outfit in off-white plus `gi: true` (the NPC apron hack is gone), short dark hair, arms crossed. Portraits `portraits/prof_neutro|feliz|surpreso|pensativo` (`custom/portraits.mjs`, same generator as the other five: warm brown skin, short dark hair with a side fringe, white gi with crossed lapels on a dark rashguard, a blue patch, a blue academia backdrop). **One-liner left for Phase 7**: `PORTRAIT_PLACEHOLDER` lives in `ui/pixelArt.ts` (not touched here); change it to `{}` (and the `prof -> julia_feliz` line in `ui/pixelArt.test.ts`) and her own portraits are used; they are already in `manifest.images`.
7. **Fountain spray**: the old 2 px droplets were invisible on the bright basin. Droplets are now 3 x 4 px (white head, light-blue body, blue tail); four of the ten form a central jet (22 px high), six arc out to 16 px into the basin. Same ten-particle budget. Three consecutive shots (`after_fountain*.png`) show the motion.

### Tests
`scripts/lib/pixel/art4.test.mjs` (nine distinct roofs at the layout widths, opaque sky chunks, Bia's four portraits and the gi layer in the manifest), a `looks.test.ts` case for her look, and the updated bounds test.

### Known weaknesses
The roofs are seen from above so the near edge is simply the map edge (no wall face); the mango is the ipê silhouette in green (no mangoes); the west block is still mostly one house, the tree and a garden shed (there is no free walkable space for more without changing the map); Bia's gi is 6 rows of body at 16 x 32 so the lapels read only as a light V; the night pools are warm but a little dimmer than before on the sidewalks; splashes are fewer under the building bands by design.

### Needs BR review
No new Portuguese strings (no pixel text added).
## Decisions made in Phase 7 (in-world dialogue, readable world, Caderno)

Branch `lifesim/p7-dialogue-hotspots-caderno`. Shots in `docs/lifesim/shots/p7/` (`BASE_URL=... node scripts/lifesim-shots-p7.mjs`; 1280x800 and 390x844).

### Dialogue box (`ui/dialogue.ts`, `ui/dialogueLogic.ts`, `styles/dialogue.css`)

1. **One box, three flows, no protocol change.** Callers keep their own state and describe each beat with a `BoxSpec` (`showDialogueBox`): Conversa (`ui/conversa.ts`), Pedido rápido = the Carlos `scene` messages (`ui/pedido.ts`), and every `showDialogue` user (Júlia's help, the parrot perch, the old `showScene`). `?dialogue=modal` keeps the old centred modals for one release (each module branches on `dialogueMode()`).
2. **Layout.** Bottom-anchored, max 880 px, full width on phones; 1x pixel panel frame; portrait 2x (1x on phones); name tag in the NPC colour (`NPC_TAG_COLORS`); the PT line types out at 45 chars/s (`Typewriter`; Space or a click finishes it; the untyped rest is laid out but invisible, so the box never grows while typing; `?notype` and reduced motion show it whole); EN gloss behind the persisted "Mostrar inglês" switch (`tb_show_en`, default on); 🔊 Ouvir; chips numbered 1-4 (keys work, not while typing in the field); reply field "Responda em português…"; Esc / ✕ closes. The bottom bar and joystick hide while it is open. Measured height: Nanda 24-27%, Conversa 30-33%, Pedido 34-38% of the screen.
3. **Nothing lost:** Perfeito/score chips, the ticket (a compact 3-slot strip), payout and "Já pediu hoje", the conta (grade stamp, three meters, tips, RV line), offline and private notes, the Gate A toasts, `pensativo` portrait while an AI turn is pending (pulsing dots). Stable ids kept (`conversa-input`, `pedido-input`, `data-chip`, `pedido-ticket`, `btn-pedido-play-mg`, `data-action="pedido-rapido"`, `.line-bubble .pt`); `data-modal="conversa|pedido"` became `#dialogue-box[data-dialogue=...]` (a `data-modal` attribute would hide the joystick and trip old modal CSS); e2e updated.
4. **Camera** (`render/pixel/dialogueCam.ts`, hook in `WorldScene.updateCamera`): +1 CSS zoom step (`round(dpr)` device px, so it stays an integer at rest), centred between the player and the NPC in the part of the screen above the box, 0.28 s ease-out, instant under `reducedMotion()`. The mid-tween zoom is fractional for a few frames. World clicks are ignored and `game.modalOpen` stops walking while the box is open. `closeDialogue()` closes the box and tells the owner (`onDismiss`), so leaving the room ends a Conversa.
5. **Live NPCs (after merging 8b):** the talk target is whoever you clicked (live NPC); the baker on duty (Carlos or Graça) and the closed-stall hat shop note are untouched. The authored Conversa chips say "Seu Carlos"; with Graça they are rewritten to "Dona Graça" client-side (`addressed`).

### Talk with Nanda, Júlia, Graça and Bia

6. `packages/shared/src/npcTalk.ts`: 3 lines with 2 chips each per NPC (`{nome}`, `{obrigad}` placeholders), tested (reachable nodes, A1 length, chat filter). Opening one sends the new `{ t: 'talk', npc }`; `RecadoTracker.talk` checks the NPC is in the room now (live position or interact tile within 3 tiles), fires `talked` (bond +2 once a day, `falar` steps) and the world marks the opener as seen in the Caderno (9 server lines, `apps/server/src/talk.test.ts`). Nanda's box has "Ver chapéus" and a "Gostei! Quero ver." chip that opens the shop; Júlia's "Sim, preciso de ajuda." opens her existing help menu (4 questions on keys 1-4, "Tchau" is a button); Bia borrows Júlia's portrait (`PORTRAIT_PLACEHOLDER`); Graça keeps her Conversa at the counter (her greeting is only a fallback). `RECADO_FLAGS.dialogue = true` (13 of 15 recados are offered now, `feira` stays off).

### Readable world (`packages/shared/src/hotspots.ts`)

7. 28 hotspots: 17 in Vila Ipê (building signs, Nº 42, the banca, R. dos Ipês, orelhão, bins, the café table prices, bike rack, bus stop, parking meter, mailbox, fountain, EM BREVE), 4 in the padaria (cardápio with R$ prices, sign, caixa, estufa), 2 in the kitnet, 5 in the academia. Optional `up` extends the click box over a sign painted on an interior north wall; a sign high on a facade gets a footprint that comes down to within 3 tiles of the sidewalk. Tests: in bounds, a reachable walkable tile within 3 tiles, no overlap with doors, NPCs or props with an action, card ids exist and really appear in the text, prices equal `PRICES` (carlos.ts) and cover every item the scene sells.
8. New `Hit` kind `hotspot` (rank between NPC and prop). Clicking walks to the nearest walkable tile within 3 tiles (`readSpot`), opens the card (large PT, price lines as leader lists, 🔊, EN gloss, "Guardar no caderno") and sends `read`. "Guardar no caderno" is shown when the sign teaches cards; the words are already counted as seen by the read, so the button confirms and opens the Caderno on that group, highlighting them. The 👁 cue (`ui/hotspotCue.ts`, max 4 nearest) floats over signs within 3 tiles and is clickable.

### Caderno panel (`ui/caderno.ts`, `ui/cadernoView.ts`)

9. Top-bar "Caderno" button (new pixel icon `ui/icon_caderno`, `pnpm pixel` stays deterministic; the 9th button needed tighter padding on desktop). Tabs per backend group with progress bars, words as PT/EN with seen/heard/used counters, ✓ when learned, "???" until met; 🔊 plays the word and sends `heard` (via `ui/heard.ts`; every 🔊 in the game reports its cards). The group reward is the server's normal reward toast; the panel shows "Completo! +15 RV".

### Needs BR review (every new PT string)

- Dialogue UI: "Mostrar inglês", "Ouvir", "Responda em português…", "Fechar", "Ver chapéus", "Guardar no caderno", "Guardado ✓", "Claro! O que você quer saber?", "Tchau, Júlia!", "Não consigo chegar perto disso."
- Nanda: "Oi, {nome}! Tudo bem? Eu sou a Nanda." / "Oi, Nanda! Tudo bem!" / "Beleza! E você?" / "Tudo ótimo! Gostou dos chapéus? Tem boné, boina e chapéu de sol." / "Gostei! Quero ver." / "Agora não, {obrigado/a}." / "Beleza! Volte sempre. Tchau!" / "Tchau, Nanda!" / "Valeu! Tchau!"
- Júlia: "Oi, {nome}! Eu sou a Júlia. Tudo bem?" / "Oi, Júlia! Tudo bem!" / "Tudo bom! E você?" / "Que bom! Eu sou a guia da praça. Posso te ajudar?" / "Sim, preciso de ajuda." / "Não, {obrigado/a}. Estou só passeando." / "Beleza! Aproveite a praça. Tchau!" / "Tchau, Júlia!" / "Valeu! Até logo!"
- Dona Graça: "Boa noite, {nome}! Eu sou a Dona Graça, a padeira da noite." / "Boa noite, Dona Graça!" / "Tudo bem? E a senhora?" / "Tudo bem! Quer um cafezinho pra noite?" / "Quero, por favor." / "Agora não, {obrigado/a}." / "Tá bom! Volte sempre. Tchau!" / "Tchau, Dona Graça!" / "Valeu! Tchau!"
- Professora Bia: "Oss, {nome}! Tudo bem? Eu sou a professora Bia." / "Oss, professora! Tudo bem!" / "Beleza! E você?" / "Tudo ótimo! O tatame está livre. Quer treinar?" / "Quero, sim!" / "Hoje não, {obrigado/a}." / "Beleza! Até a próxima. Oss!" / "Oss! Tchau, professora!" / "Valeu! Até logo!"
- Hotspots (PT; EN in the file): "PADARIA / DO SEU CARLOS", "TUDO BEM?", "EDIFÍCIO IPÊ", "Nº 42", "ACADEMIA / DO BAIRRO", "BANCA / HOJE: Chuva à noite / Feira livre: em breve / Padaria faz festa", "R. DOS IPÊS", "ORELHÃO / Telefone público", "LIXO" (x2), "Café R$ 4 / Pão na chapa R$ 6", "BICICLETÁRIO", "ÔNIBUS / Linha 875 · Centro", "ESTACIONAMENTO / R$ 5 por hora", "Praça Central / Fonte de 1985", "CORREIO", "EM BREVE / A feira livre!", "CARDÁPIO" (7 items with R$ prices), "PADARIA DO SEU CARLOS / Desde 1978", "CAIXA / Aceitamos Pix", "Salgado bem quente! / Coxinha R$ 7 · Pastel R$ 8", "SÃO PAULO / A cidade que não para", "Minha família / e meus amigos", "REGRAS / 1. Tire os sapatos. / 2. Respeite o parceiro. / 3. Diga “oss”!", "TREINO / COMUNIDADE", "AULAS / Segunda a sexta: 18h / Sábado: 10h", "FAIXAS / branca · azul · roxa / marrom · preta", "VESTIÁRIO / Guarde suas coisas aqui". The invented facts (line 875, 1985, Pix, class times, headlines) need a check.
- Caderno: "Caderno de palavras", "Caderno" (button), "aprendidas", "Aprenda todas: +15 RV", "Completo!", "Aprendida = vista e ouvida, ou usada", "Ainda não vista", "Vista", "Ouvida", "Usada".

### Proposed cards

None added. Words on signs without a card (padaria, banca, orelhão, ônibus, correio, lixo, faixa colours, regras) are not in the Caderno yet: `lex.rua.*` and `lex.academia.*` packs would let more signs teach words.

### Known weaknesses

The mid-tween camera zoom is fractional for ~0.28 s (a brief soft frame); the Conversa box is the tallest state (33% desktop, 38-50% on a phone during the ended conta); Nanda stays partly hidden behind her stall canopy when you talk to her; signs without cards have no "Guardar" button; Carlos-scene `seen` for Nanda/Júlia greetings is server-side only for the opener line; `scripts/lifesim-shots.mjs` (old) still expects the hat shop when clicking Nanda.

## Decisions made in Phase 8a (the player-facing life-sim loop)

Branch `lifesim/p8a-recados-ui`. Shots in `docs/lifesim/shots/p8a/` (`BASE_URL=... node scripts/lifesim-shots-p8a.mjs`, 1280x800 and 390x844; the script also walks one whole recado and asserts it). Run the server with `TB_TEST_CLOCK_OFFSET_MIN` so the game clock reads daytime (Seu Carlos 06-22, Nanda 08-20) and `TB_TEST_OFFER=carlos_cafe_pra_nanda`.

### Offers, hand-overs, the tracker, the journal (`ui/recados.ts`, `ui/recadoView.ts`, `styles/recados.css`)

1. **A beat before the usual talk.** `talkTo` (main.ts) asks `runPrelude` first: a hand-over box (`give-<npc>`: "Entregar {item}" per active `entregar` step whose item is in the bag, plus "Só conversar") and then an offer box (`offer-<npc>`: the giver's `ask`, the reward, chips "Pode deixar!" / "Agora não"). Accepting sends the existing `recados accept`, handing over the existing `give`; both close the box and the tracker and the thanks card take over. "Agora não" is remembered for the page session (no nagging) and goes on with the usual dialogue (Conversa, or the Phase 7 talk tree). Nothing in the protocol changed for this.
2. **The `talk` message moved**: it is now sent by `talkTo` when you first speak to an NPC without a Conversa, so a recado accepted or a hand-over made in the prelude still counts as talking (bond +2 once a day, `falar` steps).
3. **Tracker** (`#recado-tracker`, right side under whatever the top bar wrapped to, max 3 entries): the welcome chain first ("Bem-vindo à Vila Ipê", Júlia's portrait, the next tutorial step, `n/8`), then the active recados with the step from `describeStep` (`hint`) and `n/m`. A step done (or a recado finished) plays a ✓ stamp and a flash (stepped animation, off under reduced motion). One tap opens the journal. It hides while a dialogue or a modal is open. On a phone it is a slim card (232 px max) under the top bar: measured clear of the joystick and the chat bar by the shots script (an assertion), and it is not hidden any more (the old checklist was `display:none` below 700 px).
4. **Tutorial re-skin**: `checklist` is gone from `hud.ts`. The `tutorial` flags, the `tutorial` message, the toasts and the bonus logic are untouched; only the presentation is the welcome chain (tracker line + the 8 steps in the journal). It leaves when every step is done and the bonus is paid, as the checklist did.
5. **Journal** (top-bar "Recados" / "Errands", new pixel icon `ui/icon_recados`): welcome chain with all steps, "Em andamento" (giver portrait, reward, step list with done / now / later), **Mochila** (`profile.bag` with the `icons/<itemId>` art and quantities), "Hoje na vila" (today's offers, with who to talk to), finished today, and "Amizades" (ten hearts per NPC with a half-filled next heart, and the three milestones).
6. **Thanks card** (`#recado-done`, from the board diff: an id moved into `done`): the giver's portrait (happy), their `thanks` line, "+RV", "♥ +bond" and the item reward. The server's own notices for the step and the thanks are tagged (`notice.tag`: `recado_step`, `recado_thanks`, `bond`) and the client does not toast them again; the `Recado: …` reward toast is replaced by the card.

### Hearts and milestones

7. **Hearts**: `♥ n` next to the NPC name tag in every dialogue box (`dbx-hearts`, grey `♡ 0` before the first), `Nanda  ♥ 2` in the hover label, a **heart-up toast** whenever the whole-heart count of an NPC rises between two profile pushes (never on the first push), ten hearts per friend in the journal.
8. **2 hearts, the name**: `fillTalk` drops ", {nome}" until `hearts >= 2` ("Boa tarde! Tudo bem? Eu sou a Nanda." then "Boa tarde, Jonny! …"), and the server sends a notice when the line is crossed. Memory stays bond-gated server-side (`MEMORY_MIN_HEARTS`).
9. **4 hearts, a Conversa subject**: one new A1 subject `o_bairro` ("O bairro" / "The neighborhood", `minHearts: 4`) on Seu Carlos and Dona Graça (the only NPCs with a Conversa). At 4 hearts the baker first asks "Sobre o que a gente conversa hoje?" with the two subjects as chips (`subjectChoices`); below that the Conversa just starts as before. The server only honours a locked `subjectId` when the hearts allow it (it falls back to the default), on start and on every turn. "Cumprimentos" stays out of the chooser (it was never reachable and "one extra subject" is the spec).
10. **6 hearts, a gift**: `profile.furniture[item] += 1` once per NPC (`profile.bondGifts`, optional, normalised on load), notice with the item name. Items (existing catalog ids): Seu Carlos `radio`, Dona Graça `luminaria`, Nanda `tapete`, Júlia `planta`, Professora Bia `pufe_amarelo`, Tia Lu `rede`. All three effects run in one place (`RecadoTracker.gain`), wherever bond is paid (talk, recado, good Conversa), and are tested once-only.

### Time-of-day greetings (`clock.ts`: `localizeGreeting`)

11. `localizeGreetingText` swaps a greeting that STARTS a line for the one `greetingFor(minute)` gives (bom dia 05-11:59, boa tarde 12-17:59, boa noite 18-04:59), PT and EN independently, keeping the case. Used by: the Carlos scene (`SceneCtx.minute`, set at scene start from the game clock): opener, the slow opener, and the chips the player greets with; Me vê um customers (`makeOrder(..., minute)`, the served-ticket de-duplication compares them as mornings); the Conversa (`presentConversaTurn(turn, priorChips, minute)` on the NPC line and on every chip, offline and online, plus a "TIME OF DAY" line in the AI system prompt so the model greets right); NPC idle bubbles (main.ts); the padaria entry line (already did); the talk trees (`{saudacao}` / `{greeting}`: Nanda's, Júlia's and Dona Graça's openers and the chips that greet them).
12. **Scoring**: the typed accept list of the Carlos greeting chip takes all three greetings (and the "… Seu Carlos" and "tudo bem" variants) at any hour. The exact-hour rule lives only in the recado `timeCorrect` check (`greetingKind` vs `greetingFor`), unchanged.
13. Dona Graça's talk line "Quer um cafezinho pra noite?" became "Quer um cafezinho?" (she is at the table from 17:00).

### Tests and tooling

14. New: `recadoView.test.ts` (tracker, hearts, give / offer logic, diffs, journal), `bondMilestones.test.ts` (2 / 4 / 6 hearts, once-only gift, old saves), `greetings.test.ts` (greeting by hour at the edges, scene, chips, typed accept, Conversa, Me vê um, subject unlock), npcTalk (`fillTalk` hearts and time). `TB_TEST_OFFER=id,id` (server env, test only) puts those recados first on the board. `scripts/e2e.mjs` plays one whole recado (offer from Seu Carlos, order the coffee in Pedido rápido, "Entregar café com leite" to Nanda, RV + bond) when the server has `TB_TEST_OFFER=carlos_cafe_pra_nanda`, and skips it with a log line otherwise; its NPC clicks go through `openNpc`, which declines offers. `scripts/e2e-night.mjs` still targets the pre-Phase 7 modals (stale before this phase, not touched).

### Needs BR review (every new PT string)

- Offer box: "Pode deixar!" (EN You got it!), "Agora não" (Not now), "Recado: {título}". Hand-over box: "{Bom dia / Boa tarde / Boa noite}! Trouxe algo pra mim?", "Entregar {item}", "Só conversar". Chooser: "Sobre o que a gente conversa hoje?".
- Tracker / journal: "Recados" (Errands), "Bem-vindo à Vila Ipê", "Quase lá! O bônus já vem.", "Em andamento", "Hoje na vila", "Feitos hoje: n", "Mochila", "Amizades", "Nenhum recado agora. Fale com os vizinhos!", "Sem novidades por hoje.", "Vazia. Peça algo na padaria!", "{título} · fale com ele(a) pra aceitar", "2 ♥ sabe seu nome · 4 ♥ assunto novo · 6 ♥ presente".
- Hearts: toast "♥ {NPC} gosta de você! n coração/corações"; notices "{NPC} já sabe o seu nome e lembra de você!", "{NPC} tem um assunto novo pra conversar: O bairro!", "{NPC} te deu um presente: {móvel}! Tá no seu inventário (Decorar)."
- Subject `o_bairro`: title "O bairro", goal "Converse sobre o bairro: onde você mora, a praça e os vizinhos.", openers "E aí, tá gostando do bairro?", "Você mora aqui perto?", "Já conheceu a Nanda e a Júlia?", "A praça tá bonita hoje, né?"; chips "Gosto muito do bairro!", "Moro aqui perto.", "Ainda tô conhecendo.", "Moro na kitnet, na praça.", "Moro aqui perto, sim.", "Não, moro longe.", "Já conheci, sim!", "Ainda não conheci.", "A Nanda vende chapéus!", "Tá linda mesmo!", "Gosto da praça.", "Ainda tô olhando."
- Talk trees: "Quer um cafezinho?" (Graça); the greeting chips now read "{Saudação}, Nanda / Júlia / Dona Graça!".

### Proposed cards

None added. Without cards: moro, gosto, bairro, vizinho(a), recado (as a word), mochila, entregar.

### Known weaknesses

The tracker covers a little of the world on a phone (about 5% of the screen under three button rows); a real heart-up needs 10 bond points, which one recado does not give (the shots fake the second push); the heart rows in the journal are CSS shapes, not a pixel sprite; accepted recados are not removable; the offer beat appears for every offered recado of that giver one after the other (declining all of them costs a click each); Graça's offers only appear when she is the NPC you click (offers are tied to the giver id).

## Decisions made in Phase 9 (Feira livre)

Branch `lifesim/p9-feira`. Shots in `docs/lifesim/shots/p9/` (`desktop_*` 1280x800 and `phone_*` 390x844, from `scripts/e2e-feira.mjs`: `feira_open_0900`, `price_dialogue`, `payment_tray`, `change_line`, `feira_closed_1600`, `closed_note`, `hortifruti`). New e2e: `scripts/e2e-feira.mjs` (`PHASE=day|night`; `node scripts/e2e-feira.mjs --offset day|night` prints the `TB_TEST_CLOCK_OFFSET_MIN` that puts the server clock at about 08:40 / 15:40).

### The lot (`rooms.ts`, east lot x41-55, y14-29)

1. The fence `cerca_leste` got `PropDef.gaps`: a fence with gaps blocks only its perimeter, minus the gap tiles (the inside is open ground). The gate is x41, y21-22, in line with the brick bar of the praça. Floors: a brick aisle from the gate (`t`, x41-54, y21-22) and a brick front for each row of stalls. Four stalls (`PropKind` `feira`, 3x2, `art` = the open sprite `feira/<name>`, `action: 'feira_stall'`, `vendor`): frutas (44,17), verduras (50,17), pastel (44,24), flores (50,24); the vendor stands behind (north), customers in front at `interact` (x+1, y+2). Crates, price chalkboards and ipês dress the lot. New banner sprite `props/feira_livre` (5x1, "FEIRA LIVRE", replaces "EM BREVE"; the `emBreve` generator in `custom/vila.mjs` now paints the new text, renamed in the import map only).
2. **Open/closed by the game clock** (06:00-13:00, `feiraOpen`): the scene builds both variants of each stall (open sprite + tarp overhead, `_fechada` + `_roll`) and shows one (`updateFeira`), so no new engine code beyond one scene method. A plate "Feira fechada · volta às 6h" hangs over the banner while closed.
3. **D12 (my call).** Outside the hours the learning content stays reachable two ways: (a) the **Hortifrúti corner at the banca** (`PropKind` `hortifruti`, crates at (18,7) and (17,7), interact (19,7), a chalkboard + hotspot "HORTIFRÚTI" at (17,6)): Tia Lu's box, sells banana, laranja, maçã, alface, tomate and flores at every hour, same dialogue, same prices; hot food (pastel, caldo) is stall-only. (b) Clicking a folded stall (or a vendor sitting on a bench) opens a short closed box: the vendor's closed line plus "A feira volta amanhã às 6h. O hortifrúti da banca está aberto!". The server refuses stall purchases when the vendor is not working (`feira_closed`) and serves the banca always. Door ambiance spots moved to (15,7), (14,7), (16,7) because the crates took (17,7), (18,7).

### Vendors (`schedules.ts`, `looks.ts`)

4. New `NpcId`s `ze`, `chico`, `rosa` next to `tia_lu`; all four are real scheduled NPCs in `ROOMS.praca.npcs` (`OFFSTAGE_NPCS` is now empty). Schedules: at the stall 06:00-13:00, otherwise `em_casa` (through the Edifício door); Tia Lu sits on `banco_4` (28,25) 13:00-17:00, home after. A vendor's interact tile is 3 tiles from the NPC tile (a stall is 2 deep), so the schedule test allows `<= 3` now. Looks from existing layers (`NPC_STYLES`): Zé panama + olive apron, Chico yellow bucket hat + white apron, Rosa flower crown. Portraits are placeholders (`PORTRAIT_PLACEHOLDER`): Zé and Chico borrow Carlos', Rosa borrows Graça's (needs art). Bia's placeholder was dropped (art track 4 drew her portrait).
5. **Calls** are the vendors' `idleLines` (same PT as `VENDORS[id].calls`, tested) plus a dedicated 7 s timer in `main.ts` that picks a working vendor and shows a call with its gloss (not while a dialogue box is open). The weather idle-talk ratio is untouched.

### "Quanto custa?" (`packages/shared/src/feira.ts`, `apps/server/src/feira.ts`, `ui/feira.ts`, `styles/feira.css`)

6. **Data (shared, server-authoritative).** Money is integer centavos; the tray is R$ 0,50 / 1 / 2 / 5 / 10 / 20 so every price is payable exactly. `GOODS`: banana R$ 2 (3 for R$ 5, so "Olha a banana! Três por cinco!" is true; qty 1, 3, 6), laranja R$ 1 (1, 2, 4), maçã R$ 1,50 (1-3), alface R$ 3,50 (1, 2), tomate R$ 2,50 (1-3), pastel R$ 6 (1, 2; the padaria's is R$ 8 on purpose), caldo de cana R$ 5 (1, 2), flores R$ 12 per buquê (1, 2). `moneyPt` / `moneyEn` say prices in words (R$ 3,50 = "três reais e cinquenta centavos"; built on `numbers.ts`); `hotspotCard.spokenText` now also reads "R$ 3,50" in words on every sign.
7. **Protocol.** `{ t: 'feira', action: 'price', vendor, itemId }` answers `{ t: 'feira', phase: 'price', options, line }`; `{ t: 'feira', action: 'pay', vendor, itemId, qty, paid: number[] }` answers `{ phase: 'pay', result: 'exact' | 'change' | 'short', price, paid, change?, missing?, line, rv }`. The server checks the vendor id, that the stall sells the item, the room, distance (3 tiles of the vendor or 2 of the talking spot, 3 of the crates), that the vendor is working (the schedule is the single source of truth for the hours), that the quantity is offered, and that `paid` is 1-40 known tray pieces. `short` buys nothing. `exact` and `change` put the goods in the bag through the recados engine's `ordered` event (so a matching `pedir` step advances) and pay RV: 5 for exact, 3 with change, for the first 4 purchases per real day (`profile.feira = { date, n }`, optional, normalized on load). The tray money is not the player's RV.
8. **Flow (dialogue box, key `feira`).** Ask: one chip per good ("Quanto custa a banana?") plus a typed field scored by `scoreAsk` with the accept-list rules (accents, case, punctuation, article optional, "Quanto é", "Quanto fica", "Qual é o preço"; naming the item only gets the price and a "Dica"; English scores 1 with the Portuguese to say; nonsense gets "Como? Pode repetir?"). The price is spoken with the existing `speak`. Quantity: chips "Me vê três bananas, por favor." with the total as an EN-side tag, or typed (`parseQty`: words, digits, "uma por favor", full sentences). Pay: the total is said in words, a tray panel (CSS-drawn coins and notes, a brown counter strip, running sum, Pagar / Limpar). Result lines: exact "Pronto! Valor certinho.", change "Aqui o seu troco: …" (also shown as change pieces), short "Faltam …" (tray kept). Opening a vendor also sends `talk` (daily bond, `falar` steps).
9. **Items and icons.** New ids `laranja`, `maca`, `alface`, `tomate`, `caldo_de_cana` (`EXTRA_ITEMS`, the validator list in `build-curriculum.mjs`); five icons in `custom/icons.mjs` in the art track 2 style (`icons/<id>`); `pnpm pixel` stays deterministic.

### Recados and signs

10. `RECADO_FLAGS.feira = true`. The two Tia Lu recados work as written (`pedir tia_lu banana/flores`): a purchase counts as bought from the stall's owner (`ownerOf`), so Dona Rosa's flowers and every Hortifrúti purchase count for Tia Lu where the recado says so. Three new recados (`recados.md`, `needs_br`): `nanda_maca` (bond 10), `carlos_salada_do_ze` (bond 10; two `pedir ze`), `julia_pastel_caldo_pra_bia` (bond 20; two `pedir chico`, then the academia). Two `pedir` to a feira vendor may sit side by side (each purchase is its own event); buying the second item first leaves it in the bag and the player buys it again. The old "no two pedir in a row" rule is for Seu Carlos only.
11. Hotspots: `feira_livre` (the banner: "FEIRA LIVRE / Todo dia · 6h às 13h"), four price tags (`feira_preco_*`, with the real prices; the pastel one teaches `lex.padaria.pastel`, so it has "Guardar no caderno"), `hortifruti_placa`; the banca headline now says "Feira livre: todo dia, 6h às 13h". A test checks every priced line against `GOODS`.
12. **Ambient shoppers.** `CpuCrowd` takes the game minute (`CrowdHost.minute`): while the feira is open, walkers' legs end in front of the stalls (`PRACA_AMBIANCE.feiraSpots`), new walkers spawn there, and the sitter share drops to 60% of its usual.

### Tests

`feira.test.ts` (shared, 29: money words, change, tray, prices, ask scoring, qty parsing, hours, vendors on the map, hotspot prices), `apps/server/src/feira.test.ts` (11: price range and refusals, exact / change / short, junk trays, the daily RV limit, a recado finished by a purchase, Rosa's flowers for Tia Lu, closed stalls at 15:00, the Hortifrúti at 15:00, vendors present at 09:00 and gone at 21:00). Updated for the new counts and NPCs: recados, curriculum, rooms, schedules, minimap, npcs, pixelArt tests.

### Needs BR review (every new PT string)

- Vendors: names "Tia Lu", "Seu Zé", "Seu Chico", "Dona Rosa"; roles "Frutas da feira", "Verduras da feira", "Pastel e caldo de cana", "Flores da feira", "Barraca da feira", "Hortifrúti".
- Calls: "Olha a banana! Três por cinco!", "Laranja doce, freguesa!", "Maçã fresquinha, leva uma!", "Olha o tomate! Bem vermelhinho!", "Alface fresca, freguesa!", "Pastel quentinho!", "Caldo de cana geladinho!", "Flores, freguesa!", "Flor bonita pra casa, leva!"
- Greetings: "Bom dia, freguês! Tá fresquinha a fruta hoje! O que vai ser?", "Bom dia! Alface e tomate fresquinhos. O que vai levar?", "Bom dia! Pastel quentinho e caldo de cana gelado! O que vai ser?", "Bom dia! Flores bonitas pra você! Quer levar um buquê?", "Hortifrúti da banca: fruta, verdura e flores o dia todo. O que vai ser?"
- Closed: "A feira já fechou. Volte amanhã às seis da manhã!", "Já fechei a banca. Amanhã tem mais, às seis!", "Acabou o pastel por hoje. Volte amanhã às seis!", "As flores já descansaram por hoje. Volte amanhã às seis!", "A feira volta amanhã às 6h.", "A feira volta amanhã às 6h. O hortifrúti da banca está aberto!", plate "Feira fechada · volta às 6h".
- Prices and results: "A banana custa dois reais. Três por cinco reais!" (template "O/A X custa …"), "Três bananas: cinco reais." (template), "Pronto! Valor certinho. Obrigado/Obrigada!", "Aqui o seu troco: três reais e cinquenta centavos. Obrigada!", "Faltam cinquenta centavos.", "Você ainda não pagou nada.", "Como? Pode repetir? Pergunte: “Quanto custa a banana?”", "Dica: pergunte “Quanto custa…?”", "Em português: “Quanto custa…?”", "Tente: “Quanto custa a banana?”".
- Chips and UI: "Quanto custa a banana / a laranja / a maçã / a alface / o tomate / o pastel / o caldo de cana / o buquê de flores?" (also "Quanto é", "Quanto fica", "Qual é o preço da/do"), "Me vê uma banana / três bananas / seis bananas / dois pastéis / um buquê de flores, por favor.", "Só estou olhando, obrigado/a.", "Agora não, obrigado/a.", "Quero mais uma coisa.", "Tchau, valeu!", "Tá bom, obrigado/a!", "Pois não. Mais alguma coisa?", "Pois não! O que mais vai ser?", "Pagar", "Limpar", "Preço", "Você deu", "Toque nas moedas e notas", "Pergunte o preço em português…", "Quantos? Responda em português…", "Perguntar", "Responder".
- Hotspots: "FEIRA LIVRE / Todo dia · 6h às 13h", "FRUTAS DA TIA LU", "VERDURAS DO SEU ZÉ", "PASTEL E CALDO DE CANA", "FLORES DA DONA ROSA / Buquê R$ 12", "HORTIFRÚTI / … / Aberto o dia todo", banca "Feira livre: todo dia, 6h às 13h". Invented facts: all prices, "3 bananas R$ 5", the feira hours.
- Recados: `nanda_maca` ("Uma maçã pra Nanda": "Tô com vontade de uma maçã! A Tia Lu vende na feira. Compra uma pra mim?" / "Que maçã boa! Valeu, você é gente boa!"), `carlos_salada_do_ze` ("Salada do Seu Zé": "Preciso de alface e tomate pro lanche. O Seu Zé vende na feira. Traz pra mim?" / "Isso aí! Agora o lanche vai ficar bom. Valeu!"), `julia_pastel_caldo_pra_bia` ("Pastel e caldo pra Professora Bia": "A Professora Bia adora pastel com caldo de cana depois do treino. Compra no Seu Chico e leva pra ela?" / "Oss! Que delícia. Obrigada, viu?"). Item names: laranja, maçã, alface, tomate, caldo de cana.

### Proposed cards (not added)

`lex.feira.quanto_custa` (Quanto custa …?), `lex.feira.troco` (troco), `lex.feira.banana`, `laranja`, `maca`, `alface`, `tomate`, `caldo_de_cana`, `flores`, numbers above 20 and the money words (reais, centavos).

### Known weaknesses

Vendors stand behind the stall and the tarp hides most of them (as with Nanda; their plates mark them); portraits of Zé, Chico and Rosa are borrowed; the tray money is infinite (nothing is spent), so it teaches paying, not budgeting; the Hortifrúti has no vendor figure (two crates and a chalkboard); a second `pedir` item bought out of order stays in the bag; the folded-stall closed note is a dialogue, not an in-world sign.

## Decisions made in Phase 10 (cleanup, hardening, docs)

Branch `lifesim/p10-cleanup` (from `lifesim/main`). Scope was the user's list for the final agent (reliable tests, known visual bugs, dead code, BR pack, docs, perf, solo); the HOWTO's Phase 10 steps 2 and 3 (mobile pass, text-size setting, keyboard-only play) were **not** part of it and are still open.

### Reliable tests

1. **A pinned game clock is now required by every e2e and shot script.** `scripts/lib/clock-pin.mjs`: `requirePinnedClock(base, { min, max, target })` reads `/healthz` (which now reports `gameMinute`), sets the hour through the new test endpoint when the server allows it, otherwise accepts a server already inside the window, otherwise **fails fast** with the exact `TB_TEST_CLOCK_OFFSET_MIN=<n>` to start the server with (`node scripts/lib/clock-pin.mjs 08:30` prints `n` for any hour). `assertPageClock(page, ...)` repeats the check against `__tb.clock` after the player is in the world (it must come after the room is known: before the first `welcome` the client clock is the real one).
2. **`TB_TEST_CLOCK_CONTROL=1`** (server env, test only) enables `POST /__test/clock?min=<0..1439>` (`World.setClockMinute`, which moves the offset of the game clock only; timers are untouched). The clock still runs afterwards (1 game minute per 2 real seconds), so each script pins its own hour right before it starts: 08:30 `e2e`, 08:50 / 15:35 `e2e-feira` day / night, 20:52 / 22:15 `e2e-night` a / b. A frozen clock was rejected: the night script waits for 21:00 and 22:30 to pass, and the client re-syncs its skew only on `welcome` / `roomState`, so a frozen server would drift against the client.
3. **`pnpm e2e:all`** (`scripts/e2e-all.mjs`) starts one server (temp `DATA_DIR`, `TB_TEST_CLOCK_CONTROL`, `TB_TEST_OFFER=carlos_cafe_pra_nanda`, `TB_TEST_ROLL`), runs e2e, e2e-feira day and night, e2e-night a and b, stops it, then runs `e2e:meveum`, which keeps its own server on another port because it restarts it twice on purpose (it now starts it with `TB_TEST_CLOCK_OFFSET_MIN` computed for 08:30 at every start). So "one server" holds for all but the Me vê um restart script. Chrome is found by `scripts/lib/chrome.mjs` on Windows, macOS and Linux.
4. **The recado is part of `e2e` by default**: without `TB_TEST_OFFER=carlos_cafe_pra_nanda` the script fails with that message (`SKIP_RECADO=1` and `SOLO` skip it).
5. **`e2e-night`** moved to the Phase 7 dialogue box (`#dialogue-box[data-dialogue=...]`, offers declined first). `e2e-feira` day also declines a recado offer before Tia Lu's price box (it did not since 8a). `lifesim-shots.mjs`: clicking Nanda is now her dialogue box (`nanda_dialogue`), the hat shop panel opens from the stall prop. `lifesim-shots-p7` / `p8a` require the pin.
6. **Flakes:** `dayNight.test.ts` "never pops" did 130k `expect` calls in a loop and timed out under load; it tracks a max and asserts once (the test was never time-dependent, only slow). The Windows EPERM on the tmp-then-rename write in `app.test.ts` / `auth.test.ts`: both stores now use `atomicWriteFileSync` (`apps/server/src/atomicWrite.ts`): a tmp name unique per write (pid + counter) and a rename retried on EPERM / EBUSY / EACCES.
7. **CI:** `ci.yml` runs `pnpm e2e:all` (its own pinned server; it used to run `e2e` against a plain `pnpm start`, which had no recado offer and depended on the hour, plus `e2e:meveum`). `pages.yml` also runs the new `e2e:solo`.
8. **Solo e2e is pinned too:** `localNet.ts` reads `?tbclockmin=<n>` (the solo twin of `TB_TEST_CLOCK_OFFSET_MIN`) and `SOLO=1 pnpm e2e` appends it, so it passes at any hour (it did not: Nanda's stall needs 08:00 to 20:00). The e2e also blurs the chat field before pressing Escape on the sign card (a programmatic `interact` does not take focus away from it).

### Visual bugs

9. **Money in Nunito:** the pixel font's 5 read as `$` ("R$ $"). `feira.css` sets the sum line, the receipt and the coin / note labels in `--font-body`.
10. **`PORTRAIT_PLACEHOLDER`:** Bia was already dropped in Phase 9 (she has `portraits/prof_*` and the test checks it). The map still has `{ ze: carlos, chico: carlos, rosa: graca }` because those three vendors have no portrait art; it cannot be `{}` until the art track draws them. Comment fixed.
11. **Label de-overlap** (`deoverlapStacks` in `labels.ts`, pure, tested): stacks are placed nearest first (lowest on screen); a farther stack's nameplate is lifted above any plate or bubble pile already placed, and its bubble pile above any plate or pile, up to 140 px. The lift is applied with `bottom` on the plate and the bubbles.
12. **Phone dialogue box** (CSS plus one `<details>`): the conta's three meters fold into "Detalhes" on phones (open by default on wider screens), the stamp and card shrink, chips and ticket are tighter, "what you said" is one line. Measured at 390 x 844: Conversa 33 to 29.5%, Pedido 38 to 32.4%, Pedido mid-scene 47 to 37.9%, ended conta 52.8 to 26.9% (desktop 1280 x 800 unchanged: 29.8 / 33.5 / 40.8 / 39.9%). The mid-scene state (feedback chip + ticket + four chips) is still a little above 35%.
13. **Stall tarps:** a canopy of a feira stall or the hat stall fades to 0.3 while you talk to the vendor behind it (`WorldScene.setDialogue` already knew the NPC's tile) and to 0.45 while you stand in the two tiles in front of it, so Nanda and the vendors show through.
14. **Dialogue zoom** snaps in whole device-pixel steps (`dialogueFraming`: `Math.round(step * e)`), so it never renders at a fractional zoom; the camera centre still eases.

### Dead code and a cache bug

15. Deleted: `apps/client/public/art/**` (94 baked iso PNGs, `manifest.json` and the UI SVGs; nothing loads them: the HUD icons come from `public/pixel/ui`), the `?dialogue=modal` fallback (`dialogueMode`, the modal render paths of `conversa.ts`, `pedido.ts`, `panels.ts`, `npcTalk.ts`) and the 90 CSS rules only it used in `styles.css`, and the one-off review scripts `intro-shots`, `lifesim-bia-sheet`, `lifesim-shots-art4`, `lifesim-shots-p6a`, `lifesim-shots-p6b`. Kept: `docs/art/**` (104 MB of Phase 0 review sheets, now marked as history; deleting it needs a decision), `lifesim-twowin.mjs` (still a valid two-window check), `lifesim-frame-shots` (the style-frame page still builds), `character-lineup` and `pixel-contact` (referenced by `assets-src/README.md`). No orphan source module was found.
16. **Cache bug found while removing `public/art`:** `cacheControl.ts` made everything outside `/art/` `immutable` for a year, and `public/pixel/**` has fixed file names and no `?v=` hash, so a returning player would have kept an old atlas next to a new manifest after any deploy. Everything under `/pixel/` is now `no-cache` (about 150 KB), `/art/` rule removed, test updated.

### BR pack, docs, perf, solo

17. `docs/lifesim/BR-REVIEW.md`: 462 numbered strings in 17 sections plus the proposed cards, generated from the data modules (recados, talk trees, hotspots, feira, weather, rooms, subjects) and the diff of the branch for strings embedded in code (UI labels, server notices, errors). The generator was a throwaway vitest file; the doc is the artifact.
18. README rewritten for Vila Ipê (what it is, play path, run, the pinned clock, the pixel pipeline, credits incl. LimeZu); `PHASE0_STATUS.md` has a new top section; `docs/screenshots/` holds four current shots (`scripts/readme-shots.mjs`); `docs/art/README.md` points to the pixel pipeline.
19. **Perf** (`scripts/perf-check.mjs`, headless Chrome on software GL, `__tb.perf` read at 4.5 s so the low-fx governor cannot have tripped): desktop 1280 x 800, 19:30 chuva street with traffic and the bus: p90 15.8 ms (avg 11.2, 90 fps, 239 particles); 12:30 chuva at the open feira: p90 8.1 ms. Phone 390 x 844: p90 8.1 ms in both. All under the 25 ms budget, so **no change was needed** (no darkness-RT or rain change); the governor never tripped.
20. **Solo build** (`VITE_LOCAL_WORLD=1`): boots as a guest, `pnpm e2e:solo` (new) walks a tutorial step, accepts the first offered recado and buys a banana at the Hortifrúti with no server traffic; `SOLO=1 pnpm e2e` passes the whole play path. Vite replaces `process.env.X` with `{}.X` in the browser bundle, so the `TB_TEST_*` reads in `world.ts` and `recados.ts` are safe there.

### Still open (blocks or advises a merge into main)

No native review of any Portuguese (BR-REVIEW.md, 462 strings and the invented facts in section J); vendor portraits for Zé, Chico and Rosa; the audio zones were never heard by a person; HOWTO Phase 10 steps 2 and 3 (mobile pass at 844 x 390, text-size setting 100 / 125 / 150%, keyboard-only play with an E-to-interact key); mid-scene Pedido on a phone is 37.9% of the screen; the Pedido name tag truncates ("Seu Carl…") next to the heart and tools on a phone; `docs/art` (104 MB) and `lifesim-frame.html` are history that could go; Academia poses (`bjjPoses.ts`) are still canvas art.

## Zoom 3

Jonny wanted a finer world on desktop, so each art pixel is drawn smaller. `cssZoomFor` is now `floor(min(innerW / (26 * T), innerH / (14 * T)))` clamped to 2..5 (was 20 x 12 tiles): about 26-28 tiles across. 1280x800 and 1366x768 give 3, 1920x1080 gives 4, 2560x1440 gives 5, a 390x844 phone stays at 2. The integer-zoom rule and DPR handling (`deviceZoomFor`) are unchanged. The padaria, kitnet and academia fit whole at 3 with no step-down (the `roomZoom` step-down stays for larger zooms); the dialogue zoom-in is still +1 step (3 -> 4). The title-screen snapshot uses `introZoom = floor(vw / 420)` (min with `floor(vh / 200)`), so 1280 wide gives 3. The art-frame tool (`FrameScene`) default follows the same rule. Before/after shots and `compare.png` are in `docs/lifesim/shots/zoom3/` (`scripts/zoom3-shots.mjs`). Hit-testing checks: tiles hovered at the new zoom match the computed tile; points on non-walkable tiles report no hover tile, as before. Labels, bubbles, guides and the HUD line up at 3.

## Visual pass V5 (lighting)

Branch `lifesim/v5-lighting`. Before/after shots in `docs/lifesim/shots/v5/` (`before_*` from the pre-V5 build, `after_*` from this branch merged with zoom 3): the praça fountain and the north street, desktop 1280 x 800 and phone 390 x 844, at 07:00, 12:00, 17:30, 19:30, 23:00, 15:00 chuva and 21:00 chuva (desktop also 05:30, 18:30 and 15:00 nublado). `node scripts/lifesim-shots-v5.mjs` (`TAG=before|after`, `--vp`, `--area`, `--times`, `--perf`, `--eval=<js>`); `EXTRA='&v5=0'` takes the shots with every V5 layer off.

### What each piece is

1. **Directional cast shadows** (`shadows.ts` pure, `silhouette.ts` pure, `shadowLayer.ts` Phaser). The sun walks east, north, west (Sul): the shadow bearing goes from -68 degrees (left) at sunrise (05:54) through 0 (down the screen) at noon to +68 (right) at sunset (18:36). The shadow of a point `z` px high lands `z * (lx, ly)` away, so a shadow is the sprite's silhouette flipped over its foot line and sheared. The length `L` is compressed (raw cot(elevation) is 3 at 07:00): 0.26 at noon, about 1.2 at 07:00 and 17:30, so a 100 px facade throws a capped 66 px shadow and a tree a long one. Strength follows elevation (pale at the first and last light) and the weather's `sun` (none under chuva or garoa, a faint one under nublado), and is 0 at night.
   - **How it is drawn.** The silhouette (white, alpha = sprite alpha times a contact-hardening ramp, 1 px blur, rows below the foot dropped) is generated once per sprite frame and packed into ONE 1024 canvas texture, LINEAR filtered. The shear is done by the GPU: Phaser cannot shear a sprite, but a Container (rotation, scale) over a sprite (rotation) is a general 2x2 matrix (`shearTransform`, an SVD, tested by recomposing), so the shadow slides smoothly with the clock and nothing is regenerated when the sun moves. MULTIPLY blend with a tint that is computed against the grade (`tint = final / grade`), so shadows stay violet-blue under the gold grade instead of going olive.
   - **Who casts.** Every sprite the scene draws with `shadow = true`, every canopy and tarp (their own sprite from its own height), every avatar (one silhouette per sheet, shorter when sitting), the ambient vehicles and the dog (`ShadowLayer.follow`). `castPreset(key)` is the data: flat art (decals, wires, ground, roofs) is on a no-cast list, buildings are capped and softer, vehicles short. A new prop gets a shadow with no data. Interiors and low-fx keep the baked `cast` frames (`rig.bakedCast`).
2. **Ambient occlusion** (`ao.ts`, `aoLayer.ts`). One map-sized canvas painted once per room and drawn as one MULTIPLY image under the shadows: a band along every building base, a foot ellipse under every standing prop, a soft ellipse under each tree canopy, the footprint under awnings (not the feira tarps, which fold), and a gradient strip on the grass and asphalt side of every curb. Painted with canvas Gaussian shadow blur; only the layer alpha follows the sky (stronger under overcast, weaker at night).
3. **Rim light.** A second mask per tall static sprite (`buildRim`: 1 px edge facing the sun plus a faint second px and the top edge) drawn ADD, warm (peach at dawn, orange at dusk), only at low sun and clear sky. Characters have none (their frame changes every step).
4. **Golden hour and dawn.** New grade keys: violet 05:18, pink 05:54, peach 06:30 to 07:00, then a deeper 17:30 (`#ffc48e`), coral 18:00 to 18:18 and a violet 18:42 handing over to the night grade. The warm sun glow now sits on the side of the sun (`sunScreenX`: right in the morning, left in the afternoon) and has a dawn peak (05:30 to 08:00), peak alpha 0.3. Lamps stay on their 18:00 + 0..40 min schedule: at 17:30 they are off in the gold, by 18:30 they are on in the coral dusk.
5. **Noon.** Not flat any more because of the shadows, not a global trick: short crisp cool shadows (alpha 1, tint 58% / 64% / 85%), the AO under trees and along curbs, the cool shadow fill and the rim at the low-sun hours.
6. **Weather mood.** New `wet` weather param (garoa 0.6, chuva 1) that rises in 2.5 s and dries over 40 s (so a street stays damp after the rain). Wet paving gets a darker, bluer multiply tint on its terrain layers (`groundWetTint`, grass much less). At night each lamp has a shimmering vertical streak mirrored below its foot in the wet paving, and each puddle near a lamp or window mirrors that light's colour (a tinted ADD copy of the puddle). Nublado: no cast shadows, stronger AO.
7. **Water.** `water.ts` / `waterMath.ts`: the basin's water pixels are found in the sprite (blue/teal), four caustic frames are masked to them and cycled at 4 fps (ADD), seven sparkle pixels twinkle in the sun, and at night the same caustics glow teal over the underwater lights. Reduced motion freezes it; low-fx drops the sparkle.
8. **Lights from data.** `lightPresets.ts`: `LIGHT_PRESETS[spriteKey]` (fountain with underwater lights, `props/coreto` with `stringLights`, pipoqueiro, coconut cart) and the new optional `PropDef.lightAtNight` flag (generic warm pool). The manifest `light` and `PROP_LIGHT` still win. Facade windows already spill amber pools on the sidewalk (art track 4); unchanged.

### Perf (headless Chrome on software GL, a shared box, so noisy)

`scripts/perf-v5.mjs` runs the same scene with the V5 layers on and off (`?v5off=`), read at 4.7 s before the low-fx governor can trip. Busiest scene (21:00 chuva, north street, traffic, headlights, 225 particles): desktop avg 12.7 ms, p90 17 (V5 on) against avg 12.5 to 12.9, p90 17 (V5 off), phone 12.5 against 11.9 to 12.8 in the quiet runs. 17:30 clear (all shadows, rims, AO): vsync-capped 165 fps with and without V5. On a loaded box any config can swing from 13 to 40 ms and trip the governor (it did, with V5 on and off alike), so the numbers that count are the paired quiet runs. Budgets kept: one shadow atlas texture (+ the AO canvas, the caustic frames), no new particles, 185 shadow containers + 115 rims in the praça at 17:30. Low-fx drops shadows, AO and the water sparkle first (the baked shadows come back), and keeps the rain rules.

### Tests

`shadows.test.ts` (sun by time, symmetry, length, shear decomposition, weather and night, presets, cap), `silhouette.test.ts` (silhouette, ramp, blur, packer), `v5light.test.ts` (AO plan, rim mask and look, caustics and water mask, light presets and string lights, sun glow side, wet blend and tint), `lighting.test.ts` updated for the new grade keys.

### Known weaknesses

Characters have no rim light and one silhouette per sheet (the shadow does not follow the walk cycle); shadows do not fall on other props or darken characters standing in them; a building's shadow is capped at 66 px so it never reaches the far side of the street; the shadow is bilinear-soft while the art is crisp (a deliberate choice, but it is the one non-pixel edge in the world); nublado is cooler, not greyer (the grade is near white at 15:00, so desaturation has little to bite on); the wet tint is a multiply on top of the weather grade, so it is kept mild; the south-row roofs cast nothing (they are top-down art).


## Visual pass V1 (ground)

Scope: critique section A (ground materials). Terrain art and rendering, decal art and placement only; no prop, tile, walkability or layout change.

1. **Calçada.** The 1 px knit (2x2 stones, random tints) is replaced by a calm two-tone wave: smooth bands, 64 px wavelength, 32 px band period (`WAVES.A` in `custom/calcada.mjs`), with the petit-pavé only suggested by a quiet 4 px stone grid in running bond (1 px joints, one-step tone variation per stone, no per-pixel noise). Slab terrains now take a 2D phase grid (`phases` x `phasesY`, `phasedIndex2` for slab and flush alike); the calçada is 4 x 2 phases. Three options were compared at zoom 4 (`shots/v1/calcada_variants_z4.png`): A big wave (picked), B 32 px wave with whole-stone tones (reads as zigzag blocks), C 32 px wave without joints (busy ripples). `CALCADA_VARIANT=A|B|C` selects one at import time.
2. **Meio-fio.** `buildSlabTiles` draws the same raised stone curb on every side of every paved area: outline, lit top, groove; on the south side the vertical face too; 16 px stone joints; down-right contact shadow. Lawn corners and the slab's outer corners are rounded (radius 5 px, inside the tile, so the no-seam test still holds). This gives every lawn bed and both sidewalks of both streets a curb.
3. **Streets.** Asphalt is a custom flat terrain (`custom/ground.mjs`, `terrain.a` in `import-map.d/ground.json`): 7 calm variants repeated for weight, plus 2 cracks, 1 patch, 1 oil stain (about one tile in ten). Grime decals no longer land on asphalt. Crosswalk is bold 4 px bars on an 8 px pitch with rounded ends; lane dash 12 px; the "BUS" lettering is gone, `decals/faixa_onibus` is a clean yellow bay with hatch ticks, and lane dashes skip it.
4. **Mosaic.** São Paulo state redrawn (better outline, 3x3 super-sampled, 64x48 = 4x3 tiles, stone frame, 4 px petit-pavé grid, mid-grey field instead of near-black). Only two instances, at the first free paved 4x3 spots (27,13) and (29,29); `sceneryFor` skips a spot when a prop or non-paving is under it. The mosaic list lives in `scenery.ts`, not `rooms.ts`. One manhole moved from (22,23) to (26,25) so the 4x4 detail test still passes.
5. **Grass.** Pack grass tiles stay as the base. New decals: large soft light/dark value patches (Bayer dither, no alpha), pale flat worn-dirt patches (mostly next to the brick paths), clover, blade tufts, all on grass only. Fence footprints no longer count as occupied for decals (only their ring), so the feira lot is dressed too. These decals are excluded from the "empty 4x4" detail test, like grime.
6. **Brick.** Dusty clay (about 25% saturation), lit top row, a few worn pixels, three greys of mortar; a 1 px warm rim against grass and calçada.
7. **Floors.** Tatame mats 15% less saturated; ladrilho, taco and xadrez untouched (already calm, consistent with the new paving).
8. **Tools.** `apps/client/tools/ground-preview.ts` paints terrain and decals offline with the game's own `terrainTiles` and `sceneryFor` (run with the tsx in `apps/server/node_modules`); `scripts/ground-shots.mjs` takes the area shots (same cameras as `visual-audit.mjs`). Before/after: `shots/v1/compare_*.png`, `after_*`, `before_*`.
9. **Tests.** `scripts/lib/pixel/ground.test.mjs` (periodic wave, no noise, curb and rounded corners, no seams, mosaic, asphalt weights, crosswalk, bay, brick) and `render/pixel/ground.test.ts` (mosaic placement, dressing on grass only, bay free of dashes, 4x2 phases).
## Visual pass V3 (buildings and interiors)

Scope: critique section C. Art keys and interior decoration only; no tile, collision, id, door, seat or interact changed.

### Roofs of the north row (`custom/v3.mjs`, `custom/vila.mjs`)
- The gray "picture frame" was the pack's one-floor townhouse terrace (a top-down deck panel with one AC blob) kept as the top 40 rows of the amarelo, azul and west (verde) fronts. `reroof` erases rows 0-44 of those fronts and paints a real top: a hipped clay-tile roof with ridge cap and chimney (azul), a laje behind a pastel parapet with caixa d'água, antenna, dish, laundry and pots peeking over the coping (amarelo), and a casinha da laje with slab roof, door, grilled window and a brown tank (west house). The cornice and ground floor are still the pack's.
- Every north front also gets `dressUp` details: window grilles, striped toldos over windows, an outdoor AC condenser, wall lanterns, mailboxes, potted plants on the step, open louvered shutters (sobrado verde). Doors and portals were not touched.
- Contact with the ground: `soleira` darkens the last three rows of each facade (padaria, edifício, academia and the houses) in steps, so the walls look planted; V5 adds cast shadows on top of these clean bases.

### South row (`custom/fundos.mjs`, keys `fundos/f1..f9`, `_lit` overlays)
- Replaces the nine top-down `telhados/r*` (still generated; art4.test.mjs checks them) with rear facades in the same three-quarter view as the north row: roof strip on top (clay, slate, fibro with bricks, or a laje deck with parapets), a rear wall below with back doors (metal, wood, garage roll-up), windows with grilles, cobogó, shutters, AC condensers, drainpipes, meter boxes, washing lines on the wall; two slots (f3, f7) are a high garden wall with a gate under a tree crown (ipê roxo, mangueira with bougainvillea spilling over). Windows are reported for the night overlay like the north row.
- `rooms.ts`: only the nine `front('telhado_N', ...)` art strings changed (same x, y, w, h, blocks).
- Known: the dual-grid terrain draws a half tile of calçada below the last map row (V1's edge).

### Interiors (`custom/frame3.mjs`, `WorldScene.buildShell`)
- Interiors were a room in a void. `buildShell` (called at the end of `buildWalls`) adds the east wall strip (the west strip mirrored), the south wall (cap + exterior face with plinth, corners closed) and a quiet 64 px night sidewalk (`walls/exterior`) tiled 22 tiles around, below the terrain. All three keys are optional (missing = nothing drawn). Camera bounds are unchanged; the shell extends past them.

### Academia (`custom/gym3.mjs`, `floors.mjs`)
- Floor `j` is now interlocking EVA puzzle mats (32 px mats in two close blues, jigsaw tab on every seam, foam dots, lit/shaded rims); the whole room is `j` (the checker + parquet mix is gone).
- `props/tatame` (decal) is a green mat block with a red border and white boundary line. The wall `mural_s` (only the academia uses it) became a gallery: bunting, a Brazil flag, two group photos and a trophy shelf. New non-blocking, non-seat decor: `banco_gym` (5,8) and `bebedouro` (10,8). Prop ids, seats and interacts of the roll and schedules are unchanged.

### Tools
- `scripts/sprite-peek.mjs` (upscaled atlas sprites), `scripts/v3-shots.mjs` (shots for this pass: `docs/lifesim/shots/v3/after`, before = `v3/before`, copied from the audit).

### Known weaknesses
- The padaria and kitnet interiors only got the shell; the kitnet parquet and padaria tile are unchanged. No window variety change on the padaria / edifício / academia fronts beyond the soleira.
- The exterior sidewalk still has a visible wave at zoom 3; a calmer or lamp-lit street is possible.
10. **Atlas height.** The outdoor atlas was at 2035 of 2048 rows on lifesim/main, so any new art doubled it to 512x4096 (8 MB) and tripped the 8 MB budget test. `packAtlas` now rounds the height up to a multiple of 64 instead of a power of two (width stays pow2): 512x2176, 4.4 MB.

## Visual pass V2 (composition)

Branch `lifesim/v2-composition`. Scope: critique section B (composition and variety of the outdoor map): `rooms.ts` decoration and layout, the vendor schedule tiles, the CPU spots, and new prop art. Shots in `docs/lifesim/shots/v2/` (`before_*` from the pre-V2 map, `after_*` from this branch merged with V3 and zoom 3): `scripts/v2-shots.mjs` takes the full map (`?shot=map`), the praça centre and each quadrant, the feira, the west block and both streets, at 12:00 (feira open) and 17:30 (feira closed), desktop 1280x800 and phone 390x844, against the solo build (no server). The before shots of the feira and the west block were framed at the map edge (void on one side); the after shots use the corrected cameras.

### The praça gets focal points (each quadrant has its own idea)

1. **North-east: the coreto** (`props/coreto`, 5x3, footprint at (33,18)): authored (`custom/v2coreto.mjs`): an octagonal wood platform on a cream skirt with a terracotta band, steps toward the brick bar, eight bottle-green iron columns and railings, a hip roof of terracotta tiles (an `overhead` part, so it fades when you walk behind it) on a cream fascia with festa-junina bunting and a mustard finial. Two round beds flank it, a purple ipê and a palm frame it. Hotspot `coreto_placa`.
2. **North-west: the founder's bust** (`props/canteiro_busto`, footprint (16,18) 2x2): a verdigris bronze bust on a plinth with a mustard plaque, standing in a round stone-ringed bed. Hotspot `busto_placa` (needs_br). The hero yellow ipê stays, a picnic towel lies under it, a clipped bear (topiary) stands at the lawn's edge.
3. **South-east: the seniors' corner**: a domino table (green felt, white tiles) and a chess table, one tile each, with four stools around each (`props/banquinho`, seats facing the table). **CPUs:** the stools are seats like any other, but `CpuCrowd` keeps them for seniors: a sitter that spawns takes a table stool with 85% probability when a senior look is free (`aposentado`: panama, moustache; `tia_do_bairro`: sun hat, bun), and stays there (no re-seating); no other look ever takes those stools (tested over 30 runs). At most one senior per senior look, because the crowd's "never two of the same look" rule is kept (so two seniors at a time on a normal crowd). A sibipiruna shades the corner; towels and the pipoqueiro sit by it.
4. **South-west: the playground**: a sand pit decal (7x5 tiles, timber frame, bucket and spade), a swing, an arch slide, a seesaw and monkey bars (LimeZu `School_Yard_Toy_*`), a bench watching, an oiti and a yellow ipê at the edge.
5. **Carts**: `props/pipoqueiro` (the red-and-white striped street cart with a glass popcorn machine, paper cones and a PIPOCA board; the cart is LimeZu, the rest authored) and `props/carrinho_coco` (the umbrella cart repainted green and white, a pile of green coconuts, an ice box with cut ones, a COCO board). Hotspots `pipoqueiro_placa`, `coco_placa` (needs_br, invented prices).
6. **Flower beds of different shapes**: `props/canteiro_redondo` (round, stone ring, clipped shrub), `props/canteiro_losango` (diamond parterre with four colour quarters; art made, not placed in this layout), plus the existing rectangular beds. Topiary: a clipped dog (west corner), a clipped bear, a topiary pot by the Edifício.
7. **Bike parking** (two more `bicicletario`), a **magazine rack** (`props/revisteiro` by the banca), a hopscotch painted on the south sidewalk (`decals/amarelinha`), picnic towels (LimeZu beach towels as ground decals), a dog's water bowl, worn dirt patches (`decals/trilha_a..e`) in front of benches, around the tables and into the playground.

### Trees

The yellow ipê stays the hero. New: **ipê roxo** (`ipe_roxo_large|medium|medium_b`) and **ipê branco** (`ipe_branco_large|medium`), recolours of the same derived tree (same sway canopy); an **oiti** (tall trunk), a **sibipiruna** (wide flat crown), a **figueira** (art made, not placed: it is huge), two **jerivá palms** (the beach palm, orange ring removed, mirrored for variety), and **sidewalk pit trees** (`props/arvore_rua`, stone pit, 2x1): 3 on the north sidewalk of Rua dos Ipês, 4 on the south one, 4 on the north sidewalk of Rua Jacarandá, 2 in the feira lot, placed clear of every door and crosswalk. New `PropKind` `arvore` (sprite by `art`, no fallen petals; the yellow ipês keep kind `ipe` with an optional `art`). The old ids are kept: `ipe_2` is the purple ipê now, `ipe_3` a second purple one, `ipe_4` the oiti, `ipe_5` a flipped yellow, `ipe_6` the large white ipê.

### The feira

The lot ground is **asphalt** inside the fence (a closed street; the gate stands on the brick bar). **Vendors stand in front of their stalls, facing the aisle** (visible, not hidden by the tarp): schedule tile = (stall x + 1, stall y + 2), customer / interact tile = (x + 1, y + 3). Stall ids, prices and the feira logic are untouched. Dressing: produce crates (`feira/cx_tomate|banana|melancia|repolho`), sacks of potatoes, platform scales beside each vendor, two LimeZu carts (fruit, flowers), festa-junina bunting over the aisle (thin overhead strings, so people stay visible: a solid tarp over the aisle would hide shoppers and vendors), market litter decals (leaves, cardboard). A 2-wide gap at x47-48 in the south row keeps the wide lane to the south stalls.

### The streets

**Parked vehicles on the south curb row** of each street (rows 11 and 35): 9 cars (LimeZu singles, eight colours, two taxis) plus an authored Fusca, a Kombi and two delivery motorbikes (static frame 0 of the traffic art). They block their own curb tiles only; crosswalks, the bus stop curb (x32-40 of Rua dos Ipês) and every sidewalk stay free. To make room the **traffic lanes moved** up (`ambientData.ts`: west lane feet at y0*16+19, east lane at y0*16+40; it was +29 / +60) and the lane dashes with them (`scenery.ts`: y0*16+29). Parking was only possible on the south curb: a car's body rises 17 px above its feet, so on the north curb it would hide pedestrians on the sidewalk.

### Moved coordinates (everything else is where it was)

| What | Before | After |
|---|---|---|
| Vendors Tia Lu / Seu Zé (tile, interact) | (45,16) (45,19) / (51,16) (51,19) | (45,19) (45,20) / (51,19) (51,20) |
| Seu Chico / Dona Rosa | (45,23) (45,26) / (51,23) (51,26) | (45,26) (45,27) / (51,26) (51,27) |
| Stall prop `interact` | (x+1, y+2) | (x+1, y+3) |
| Benches `banco_6` | (36,20) | (31,19) (`banco_5` stays at (14,20)) |
| `ipe_3` / `ipe_4` / `ipe_5` / `ipe_6` | (35,17) (13,26) (18,24) (37,26) | purple (38,16), oiti (19,27), yellow (19,23), white (39,27) |
| `flor_p2`, `arbusto_3` | (27,28), (11,24) | (26,29), (10,24) |
| CPU spots | (8,7), (44,7), (16,27) | (11,7), (46,7), (19,25), plus five new ones (coreto steps, playground edge, lawns, coconut cart, pipoqueiro) |
| Feira ground, aisle | grass with brick strips | asphalt (brick only at the gate x41, y21-22) |

Scripts that walked to (45,19) (`e2e-feira`, `perf-check`, `readme-shots`, `visual-audit`) now walk to (45,20).

### Pipeline and tests

- `import-map.d/v2.json`; `custom/v2*.mjs` (coreto, props, feira dressing, decals, prep hooks). `pixel-import.mjs` gained: an inline `sheet` spec (`ext:...png`, a single sprite of a pack without an alias), an optional `rect` (whole image), a `prep` hook (`stripGrass`, `stripRing`, `hardAlpha`, `cutRows`) and `flip` for the tree kind. The helpers of `feira.mjs` are exported for reuse.
- **The outdoor atlas** had grown to the texture limit (512x4096); it is 1024x2048 now (same area, safer shape). `art3.test.ts` checks `<= 8 MB` and `max side <= 2048`.
- `sceneryV2.ts` (ground decals, called from `sceneryFor`), `PropKind` `arvore`, `props.ts` (`art` for kind `ipe`, `arvore` in the art field list), `minimap.ts` (trees).
- Tests: `packages/shared/src/v2layout.test.ts` (focal points, tree variety, stools face their table, parked vehicles on the curb row only and off crosswalks and the bus stop, pit trees off the doors, vendors in front, paved lot), a seniors test in `apps/server/src/ambiance.test.ts`, updated `rooms.test.ts`, `feira.test.ts`, `roomLayout.test.ts`, `vilaIpe.test.ts`. The path and 2-wide-lane tests of `rooms.test.ts` pass with their rules unchanged.

### Known weaknesses (honest)

- The pack sedans are drawn closer to top-down than the traffic cars, so a parked sedan next to a moving hatchback shows two perspectives; a moving east-lane car and a parked car still overlap a little in body height.
- The worn-grass patches are small and brown (they read as dirt, not as a faded path); real desire lines would need a grass-edge autotile.
- The jerivá is the beach coconut palm (feathery fronds, thicker trunk).
- The seniors are two looks (the retiree, the tia do bairro): at most two sit at the tables at once.
- The coconut cart's pile is cluttered at 1x; the coreto is blocked (you cannot walk onto the stage).
- The figueira and the diamond bed are authored but unplaced (too large for the current lawns).
- The west block is still one house, a garden, a shed, a tree and the dog corner.

### Needs BR review

Hotspot strings (also invented facts): "DONA IPÊ / Fundadora da Vila / 1897", "CORETO DA PRAÇA / Banda toda domingo, às 10h", "DOMINÓ / Quem perde paga o café", "PIPOCA / R$ 5 o saquinho", "ÁGUA DE COCO / Geladinha · R$ 7"; labels "Coreto da praça", "Busto da fundadora", "Pipoqueiro", "Carrinho de água de coco", "Revisteiro da banca". Painted in pixels: PIPOCA, COCO.

### V1 + V2 merge fix

Root cause: V2 turned the feira lot to asphalt and filled the other lawns with beds, play gear, a sand pit, towels and dirt trails, so V1's lawn dressing found almost no room. The dressing already read the terrain (only `g` tiles), but (a) it knew nothing of V2's hand-placed ground decals (`sceneryV2.ts`), so flowers, clover, tufts and patches could land on the sand pit, towels and trails, and (b) the soft light/dark patches tried one spot per 3x3 cell, which no longer fits (1 patch left, the test wants 2 light and 2 dark). Fix: `v2DecalTiles(def)` exports the tiles of those decals; `sceneryFor` treats them as occupied (lawn dressing, mosaic, tufts); the patches try 16 spots across the neighbourhood and may run under props (they are drawn beneath) but not under another decal. The test's dressing amount is now relative to the grass area (one piece per 14 grass tiles) instead of a fixed 40, as the lawns shrank. The feira asphalt gets no grass dressing (tufts only on paving). Mosaic: only (29,29) is free now (the (27,13) spot is taken by the coconut cart and V2 props), so the map has one mosaic. Lane dashes (y0*16+29), the bus bay and the curbs around V2's beds and the asphalt lot were checked in shots (`shots/merge-v2/`): no overlap. Note: the solo (`VITE_LOCAL_WORLD`) dev build fails at this commit (`process` in `world.ts`), so the shots use the pinned server.

## Fix: solo (browser) build and bare `process`

Branch `lifesim/fix-solo`. `world.ts` (`ROLL_QUEUE_MS`, `TB_TEST_ROLL`, `TB_TEST_CLOCK_OFFSET_MIN`) and `recados.ts` (`TB_TEST_OFFER`) read `process.env.X` directly, and LocalNet bundles both into the browser. A production Vite build rewrites `process.env.X` to `{}.X`, which is why Phase 10's `e2e:solo` passed; anywhere that rewrite does not happen (the Vite dev server with `VITE_LOCAL_WORLD=1`, other bundlers) the page throws `ReferenceError: process is not defined`. The bare reads came in with the Academia roll (`ROLL_QUEUE_MS`), `TB_TEST_OFFER` in p8a and the clock offset / roll hints in the Phase 10 pinned-clock commit. Fix: `apps/server/src/env.ts` `readEnv(name)` (guards `typeof process`), used by those modules; `browserSafe.test.ts` greps every module reachable from `world`, `store` and `services/stubs` for bare `process.` and constructs a `World` with `process` undefined. `pnpm e2e:all` now ends with `e2e:solo` (it builds the static solo client into a temp dir and serves it; ports via `E2E_SOLO_PORT`).
## Visual pass V4 (UI)

Branch `lifesim/v4-ui` (from `lifesim/main`, merged with zoom 3 and V3). Shots in `docs/lifesim/shots/v4/` (`before_*` and `after_*`, same script: `BASE_URL=... node scripts/v4-shots.mjs --tag=after`, which also prints the HUD coverage and the phone tap targets). Scope: `VISUAL-CRITIQUE.md` sections D (labels, creator preview) and E (UI).

### The HUD (`ui/hud.ts`, `ui/hudLayout.ts`, `styles/hud.css`; the old top bar rules were pruned from `styles.css`, `pixel-ui.css`, `clock.css` (deleted) and `dialogue.css`)

1. **One plate, one icon bar.** Top left: brand mark (pixel), "Tudo Bem", where you are (the instance suffix drops on a phone) and the clock, in one slab. Top right: Verde plate and RV in a slab, and a bar of five pixel icons (Mapa, Recados, Caderno, Chapéus, Amigos) plus a gear. The labels (PT bold, EN gloss) show as a pixel tooltip on hover and keyboard focus. The gear opens a popover with Música, Voz (with a sim / não state), Créditos and Sair. Ids are the old ones (`btn-map`, `btn-recados`, `btn-caderno`, `btn-wardrobe`, `btn-friends`, `btn-music`, `btn-sound`, `btn-credits`, `btn-logout`, `btn-decor`, `recado-tracker`, `chat-input`, `chat-send`, `data-emote`); new: `btn-menu` (gear), `btn-burger`, `btn-emotes`. **e2e / shots scripts open `#btn-menu` before clicking `#btn-logout` / `#btn-credits`** (`#btn-music` and `#btn-sound` are read by text only).
2. **The frame** is drawn with box-shadows (2 px warm-ink edge with the corners cut, a bevel, a hard 3 px shadow), not a border-image: it is crisp at any zoom and does not make its children a containing block (the phone drawer is `position: fixed`). New pixel icons from the pipeline (`uiicons.mjs`): `gear`, `burger`, `emote`, `rv` (the coin), `verde` (the sprout) and `mark` (sun over a padaria awning). `--art-coin`, `--art-seed`, `--art-mark`, `--art-close` are the PNGs now; the smooth SVG coin, seedling and logo are gone from the HUD.
3. **Toasts have their own stack** (`.toasts`): under the plate on the left on a desktop (the tracker is on the right), full width under the tracker pill on a phone. `hudLayout.ts` measures the top bar, the tracker and the mission chip and writes `--hud-bottom` / `--toast-top`; max 3 toasts, a stepped slide-in, the level as a coloured bar.
4. **Tracker** (`ui/recados.ts`, `recados.css`): a card whose head folds it (state in `localStorage` `tb_tracker`); a tap on a row opens the journal. Desktop starts open; a phone starts as a one-line pill and opens by itself for 5 s when a step moves.
5. **Phone** (`max-width: 640px` or `max-height: 520px`, so a landscape phone too): one strip (mark, place, clock, RV, burger), a drawer behind the burger (2 columns, 3 in landscape, 54 px rows, the gear's items inline, a scrim under it, toasts and the joystick hide while it is open); the emote chips hide behind a smiley in the chat bar (the row opens above it); the joystick sits above the chat bar in portrait and in the lower-left corner in landscape (chat bar to its right, 500 px max). Every button is at least 44 px (the shots script prints any that is not).
6. **HUD coverage while walking** (union of the HUD boxes: top plates, tracker, emotes, chat bar, joystick, toasts; `scripts/v4-shots.mjs` prints it, `shots/v4/*_hud_stats.json` keeps it). 1280 x 800: before 16.8% idle (with the tutorial toast up) / 18.3% with the tracker and a toast; after **9.6% idle**, 10.9% right after arriving (toast + tracker) and 12.0% with a recado toast and two tracker rows. Phone 390 x 844: before 29.7% / 31.7%; after 16.5% idle (the 112 px joystick is 3.8 of it), 20.3% with tracker + toast. Landscape phone 844 x 390: before 50.9% / 54.7% (it got the desktop layout); after 19.1% / 22.9%.
7. **Legibility (D9) fix found on the way:** Pixelify Sans closes the opening of its capital C at weights 600 / 700, so "Criar conta" read "Oriar oonta" and "Caderno" read "Oaderno" (it did before this pass too). `index.html` now loads only weight 500 (the C keeps its opening), `html { font-synthesis-weight: none }` stops any faux bold, and the small labels that carry Portuguese words (tabs, the sign-in button, tracker head and titles, NPC name tags, Caderno tabs, the Conta header, hotspot kicker, the mission chip) are Nunito 800. The pixel font stays for the brand, the clock, numbers and 18 px+ headings.

### Labels (`render/pixel/labels.ts`, `WorldScene.pushLabels`, `state.hoverKey`)

8. CPU nameplates show only on hover, within 3.5 tiles of you, or while they emote (a stepped fade; hidden plates leave the de-overlap). Players and NPCs always show their name; the NPC role (`Seu Carlos · Padeiro`) only on hover. The bubble 9-slice (`ui/bubble`) is redrawn with the warm ink outline, a smaller corner radius and a two-step shade (same slice, same size, so `labels.ts` is unchanged).

### Out-of-world screens

9. **Avatar creator** (`ui/onboarding.ts`, `styles/creator.css`): the backdrop is the title screen's pixel Vila Ipê (`createIntroHeroScene`, the same snapshot and slow pan, dimmed by `.onb-dim`), the card is a notched pixel plate. Two columns with grouped fields (Quem é você? / Seu visual / Roupa) fit 1280 x 800 with nothing cut off; one column on a phone (stage first, rules at the end, a sticky CTA, 44 px chips). The preview stands on a stepped pedestal in front of a little padaria wall (awning, tiles, checkered floor), at 6x (5x on a phone, 4x in a short landscape window: integer scales of the 28 x 36 art), with a **Girar** and a new **Andar** button (`charPreview.setWalking`, the walk cycle of the current facing). The hat shop's preview uses the same stage.
10. **Title / sign-in / sign-up** (`styles/intro-pixel.css`): the wordmark in the pixel font with a stepped outline, a pixel brand mark, a notched card with a square-scalloped awning, pixel tabs, fields and buttons, no blur or rounded corners. **The parrots are pixel sprites now**: `flock/papagaio_strip` and `flock/arara_strip` (30 x 22 px, 4 wing-beat frames, made by `assets-src/custom/flock.mjs` through `pnpm pixel`), drawn at whole-number zoom (1x far to 6x for the glider), mirrored for birds flying left, with the old flock model (arcs, layers, tests) unchanged; the 350 lines of vector wing / body drawing are deleted. Idle-kick birds use the same sprites.

### Panels (`styles/panels.css`)

11. One panel style for every modal except Me vê um / Roll (own themes): notched 3 px ink frame on cream, a padaria awning along the top, pixel-font title, a square terracotta close key with the kit's X, square pixel buttons (primary terracotta, green), square cards (hats, rooms, friends). The map's room cards keep their colours.

### Known weaknesses

The avatar's hair art still covers part of the face at 6x on dark hair (the art, not the preview); the room cards in the map keep smooth gradients (inline colours); the pixel parrots have no flight path variety beyond the old arcs; the phone tracker pill is 44 px tall (a tap target) so it costs more area than a text line; the landscape phone shows the chat bar at 8% of the screen (it has to be a 44 px field); the Me vê um, Roll and dialogue panels keep their own older chrome; no human has read the new PT labels (Ajustes, Andar, Parar, Quem é você?, Seu visual, Roupa, Menu).

### Needs BR review

New PT strings: "Ajustes", "Andar" / "Parar", "Quem é você?", "Seu visual", "Roupa", "Menu", "Emoções".

### Tests and tooling

`hudLayout.test.ts` (toast placement, the pixel flock's whole-number zoom and wing frames; 1095 -> 1125 tests with the merged branches). `scripts/v4-shots.mjs` (before / after, HUD coverage, tap-target check, phone portrait + landscape). e2e: `#btn-menu` is opened before `#btn-logout` (`e2e.mjs`), before `#btn-credits` in the shots scripts. `pnpm e2e:all`: 6 of 6 pass on the first run of this branch; on a later run `e2e-night` a and b failed in 4 s each with "Game clock reads 08:31" (the page's clock had not synced to the pinned server yet, a harness race); each passes alone against a pinned server.
### V5 fix: blank world after the clock swept through both sun sides

**Bug.** The shadow atlas was one 1024 x 1024 canvas texture that was thrown away and recreated when it filled up. Static props, rims and shadows for one side of the sun fill it to about 75%; the rim masks for the other side (07:00 after 17:30, or the other way round) overflowed it, `makeAtlas()` destroyed the texture mid-frame, a shadow sprite then rendered with a frame of the destroyed texture and Phaser threw `Cannot read properties of null (reading 'glTexture')` inside its render. An exception in the render stops Phaser's loop for good: a frozen, blank world with only the DOM labels. It showed up in the shot sequence (07:00, then 12:00, then 17:30 in one page) and in a clock sweep; a fresh page at 17:30 was fine, which is why the first shots looked right.
**Fix.** The atlas is now pages (up to four 1024 x 1024; a page is added when one is full and existing frames are never destroyed while sprites may draw them). Pages are only reset between rooms, with every follower hidden and re-resolved before it draws again. At the page budget a sprite simply has no shadow.
**Never silent.** `PixelView` shows a "Recarregar" overlay when the WebGL context is lost or when a watchdog sees Phaser's frame counter stand still for 6 s. `__tb.renderer.textureInfo()` reports the texture count; `__tb.perf.shade` reports pages and how full they are.
**Soak.** `scripts/soak-v5.mjs` sweeps 24 hours x 4 weathers x praça and padaria in ONE page (`--loops=3` for the long run), asserting every step that the canvas is not blank (screenshot stats), no context loss, no page or console error, and the texture count under 140. 576 steps x 3 loops pass (56 textures flat, 2 pages in the praça after a 07:00 / 17:30 alternation). The shot script now refuses a blank frame (retries, then fails the run).

## Wave 2: render fixes

Branch `lifesim/w2-render`. Before/after shots in `docs/lifesim/shots/w2/` (`before_*` from the pre-fix build and the audit-2 set, `after_*` from this branch; `node scripts/w2-shots.mjs`, `TAG=before|after`, `--only=street,padaria,praca,feira`, `EVAL=<js>` prints a page expression, `EXTRA='&v5off=shadow'` bisects a V5 layer).

1. **Night vehicles.** Root cause: not a blend or depth bug. Bisecting with `?v5=0` / `v5off=shadow` showed the same dark cars, so no V5 layer was making them translucent. By night a vehicle is the colour of the asphalt after the grade and the darkness; the parked bege car also sat half behind the bus shelter (`park_bege_l` at x 27 overlapped the stop at x 30), and the lamp behind the south-sidewalk tree lit the canopy through the lamp's hole in the darkness plus its ADD glow, which saturated the green (the "glowing tree"). Fix: `LightingRig.liftBody` gives every vehicle (parked props and moving ambient traffic) a faint cool ADD twin that follows the sprite's frame, flip, alpha and depth + 0.0005, alpha `min(0.4, dark * 0.45)`: the body keeps its shape and stays solid on the road; it removes itself with the sprite. Headlights are unchanged (cone and glow only in front). Canopies that are not stall tarps are tinted down by up to a third as it gets dark (`updateCanopies`), so a lamp under a tree reads as lit leaves, not neon. `park_bege_l` moved to x 26 (still off the crosswalk at 24-25, still asphalt, still off the bus curb), clear of the shelter.
2. **Padaria.** Root cause: Seu Carlos stands on tile (3,1) directly behind the counter (row 2). His sprite is 32 px tall with its feet at y 29 while the counter sprite's top is at about y 18, so the counter (depth 48 against his 29) cut him off at the chin: only a big white chef hat and the top of his hair showed, and the nameplate and bubble sat on that, so he read as a washed-out ghost. The bubble itself faded out over its last 700 ms, which in the audit shot caught it half see-through over the shelves. Fix: an NPC standing still, indoors, with a blocked tile right south of it is drawn `COUNTER_LIFT = 11` px higher (sprite, shadow, labels and click box; depth, tile and logic unchanged), so head and shoulders clear the counter at full opacity. `bubbleAlpha` no longer fades out: a bubble is opaque from its 120 ms fade-in until it is removed at 7 s.
3. **Noon shadows.** `shadowLook`: the midday colour is a neutral cool grey (`FINAL_NOON` 0x9ca2b0, was the saturated violet 0x8490d2) and the strength drops to `NOON_ALPHA` 0.74 as the sun climbs (over 30 to 60 degrees of elevation), so a noon shadow is modest. Golden hour and dawn are untouched (long, violet, alpha 1). Length: it was already 0.26 to 0.27 of the height from 11:00 to 13:00 (under the 0.3 to 0.5 asked), so `MIN_LENGTH` is unchanged; the "too long" read came from the violet and the opacity. Tests: noon 11 to 13 short (< 0.34), saturation < 0.15, alpha < 0.8; 06:36 and 17:42 long (> 0.9), saturation > 0.25, alpha > 0.8.
4. **Feira lot.** New floor kind `paralelepipedo` (char `p`, `FLOOR_CHARS`): granite setts, 8 x 8 px stones in running bond with soft joints and rounded corners, pale granite tones, a few tiles worn (moss in the joints, a sunk stone, a tar patch); generator `custom/feiralot.mjs`, terrain `p` in `import-map.d/ground.json`, drawn after the asphalt. It is walkable and a flat underlay like the asphalt, so walkability is unchanged. Treated like paving everywhere: wet tint, puddles, AO, minimap colour, footstep sound. Decals: chalk price scribbles (`decals/feira_giz_0..4`, one in front of each vendor's board), damp stains (`feira_mancha_0..2`), cabbage leaves (`feira_repolho_0..1`), a flattened box (`feira_caixa`), the old `feira_lixo` litter now on the setts, and a manhole at (50,23). No lane markings (the setts option was taken instead). Tests updated: `rooms.test.ts`, `v2layout.test.ts`.
5. **Soak and other glitches.** `node scripts/soak-v5.mjs`: SOAK OK, 192 steps, no blank frame, textures bounded (max 56). Night and rain shots of the street and praça were checked: no other blend or depth fault seen.

### Known weaknesses

The night body lift is a plain ADD twin: it brightens the whole sprite evenly, so a dark blue van reads but stays dim; real brake or parking lights would need new art. The counter lift is a render offset for any standing NPC with a blocked tile south of it, which today is only the padaria's two bakers.

## Wave 2: UI fixes

1. **Solo indicator.** V4 had moved the "Modo solo" note into the closed settings menu, so `e2e:solo` (and players) never saw it. It is now a small tan chip (`#solo-pill`, "Modo solo" + "Solo mode" on desktop, Portuguese only on a phone) at the end of the top-left plate, always visible in solo builds. `scripts/e2e-solo.mjs` asserts `#solo-pill`.
2. **Pixel font: Jersey 10 replaces Pixelify Sans.** Pixelify's capital C still read as an O in 18 px headings ("Orie seu avatar") at every weight. Rendered "Crie seu avatar · Coração Cardápio Ação" in Pixelify 500/700, VT323, Silkscreen, Jersey 10/15, Tiny5, Handjet, Press Start 2P, DotGothic16, Micro 5, Workbench and Nunito 800 (`shots/w2ui/fontlab2.png` style comparison) and picked Jersey 10: open C, clear C/O/Q/G, all Portuguese accents present, bold pixel weight in one style (no faux bold). Known gap: Jersey 10 has no `º`/`ª`; those fall back to Baloo 2 (none sit in a heading today). Jersey has a short x-height, so `html { font-size-adjust: 0.484 }` (Nunito's) sizes it like the body text and leaves Nunito alone. The earlier rule stays: Portuguese learning labels with c/C that were moved to Nunito 800 in V4 remain Nunito.
3. **The clipped "Esse…" card near the bus stop** was a world speech bubble (an NPC/player line, in `#world-labels`) sitting under the HUD tracker. `labels.ts` now hides a whole nameplate/bubble stack while any part of it overlaps a HUD box (`.hud-slab`, `.rtrack`, `#mission-pill`, `.toast`, `.chatbar`, `.hud-chip`; rects refreshed every 250 ms) and shows it again once it clears, so nothing is ever half under the HUD.
4. **Panels.** Me vê um (`.mg`), the Academia roll (`.roll`) and the map's room cards now use the V4 panel system: the `:not(.mg):not(.roll)` exclusions are gone from `panels.css` / `pixel-ui.css`, so they get the awning, notched frame, pixel title and the square close key (their ✕ buttons are now `.close.ghost`; e2e's `.mg-head button.ghost` still matches). Rails, tickets, stations, trays, chips, belt, disclaimer and the pose stage lost their radii and got the hard 2 px frames; the roll's BJJ pose canvases are untouched (they sit on a square plate). Map cards are flat colours (`--card`, `--card2` set in `panels.ts`) with a stepped band along the bottom instead of the smooth gradient. Phone: extra top padding keeps the awning off the heading and the close key off the pose.
5. **Dialogue on a landscape phone (844x390)** overflowed by ~8 px (the compact spacing only applied below 640 px wide). A `(max-height: 520px) and (min-width: 641px)` block applies the same tightening; measured scrollHeight == clientHeight now.

Shots: `docs/lifesim/shots/w2ui/` (`before_*` / `after_*`; panels by `scripts/w2ui-shots.mjs`, HUD/creator by `scripts/v4-shots.mjs`).
## Wave 2: characters

Branch `lifesim/w2-chars`. Before/after shots in `docs/lifesim/shots/w2chars/` (`before_*` from origin/lifesim/main at 85af60f27, `after_*` from this branch): `*_lineup.png` (`node scripts/character-lineup.mjs`, new sections for the pulled-up fringes on 8 skin tones, every CPU archetype and the garb pieces), `*_parade_praca_1200_z5.png` and `*_parade_praca_1730_z5.png` (24 neighbours injected client-side into the south street of the praça, zoom 5, same crowd in both builds), `*_creator_hair.png` (the avatar creator preview at 6x, five dark-hair styles on dark and mid skin), `*_emotes_1..3.png` (five emotes at +0.3 / +0.7 / +1.0 s). `node scripts/lifesim-shots-w2chars.mjs` (`TAG=before|after`, `--what=parade,emotes,creator`, `--cam`, `--rows`), `scripts/character-peek.mjs` (zoomed single frames from a JSON spec), `scripts/character-dump.mjs`, `scripts/cpu-looks-dump.mjs`, `scripts/png-zoom.mjs`.

1. **Readability (`charfx.ts`, run inside `composeLook`, so the game, the creator and the lineup all get it).** `outlineSheet`: one 1 px outline on the OUTER silhouette of every composed frame, in a dark shade of the part it surrounds (`outlineShade`: the part's colour x 0.3, a little blue, very light parts capped so a white shirt does not get a grey outline). The pack's own navy pixels that sit on the silhouette are re-tinted, any silhouette pixel with no outline (an authored gesture, an afro's edge) gets one, and the navy lines between the parts inside the figure stay as they are. `highlightEdges`: a lift of the pixels just inside the outer outline on the top and left edges of the hair and outfit layers (strongest left of centre), so the crown and the shoulders catch the top-left light. Honest size of the effect: the pack already outlined its characters; what changed is that the outline is now darker and warmer than the ground everywhere, the same on every part, and gets the warm rim at low sun. The highlight is subtle on purpose.
2. **Faces.** `eyeWhites` (build time): every eye (a 1x2 px dark lash over an iris pixel) gets a white pixel next to the iris (inner side from the front, behind the iris in profile), so the eyes read on all 8 skin tones (on skin 7 they used to vanish). `openFringe`: on the front (S) frames of `cacheado`, `black`, `ondulado` and `longo` the hair pixels in the face columns at or below the eye line (a widow's peak on `cacheado` / `black`) are removed, so the forehead and the eyes show; `curto`, `raspado`, `undercut`, `coque` and `trancas` already cleared the eyes. The face is still small: the pack's head is 13 rows with a 5-row face, I did not redraw heads.
3. **Variety (`Appearance.garb`, CPU-only).** New optional string field `garb` (ids of `GARB_IDS` joined by `+`); `sanitizeAppearance` never copies it, so players cannot carry one, and an old client ignores it. Art in `custom/garb.mjs` (authored in the pack style, key-coloured, body-anchored, warped for the three body types): `jersey` (vertical striped football shirt on the top and accent ramps, no crest), `jaqueta` (reflective band on the chest and sleeves, a zip), `macacao` (dungarees), `chinelo` (flip-flops: bare feet, coloured sole, a Y strap), `mochila` (backpack), `caixa` (delivery box on the back), `sacola` (tote on a strap), `carrinho` (feira cart on wheels beside the walker), and a `balde` bucket hat (`hats.mjs`, wider and slouchier than the yellow one). Back pieces are two layers: `_u` under the body (from the front and the side only the edges that stick out show) and `_o` over everything (the back view). `characters.ts` `GARBS` maps ids to layers and fixed colours (the jacket takes the wearer's top colour); `looks.ts` places them (under, over the outfit, over the hair, with the hats). Wardrobe (`packages/shared/src/looks.ts`): 3 + 4 new archetypes (`avo_feira` with the cart, `torcedora` in a green striped jersey with chinelos, `comerciaria` with a tote; `motoboy` with helmet, jacket and box, `corintiano` in a black-and-white striped jersey and chinelos, `jardineiro` in dungarees and a bucket hat, `corredor`), and garbs on `estudante`, `universitaria`, `skatista` (backpacks), `executiva` (tote). 14 -> 21 archetypes, each mapped to a name in `NAMED` so the crowd test that every archetype is used still holds; the test that two neighbours differ on 3 reads now also counts the garb. The brazilian touches: the striped jerseys (no crests or logos), the flip-flops, the bucket hat, the delivery box, the feira cart. Kids: there is no short body type, so "a kid with a backpack" is a student with one.
4. **Emotes.** The gestures were 2 to 4 px slivers beside the head and invisible on a dark hair. Now: a 5 x 6 px open hand with a navy outline, a lit palm and an outlined forearm (wave, two frames with spread fingers), a fist with the thumb up (valeu), 4 px hands for the dance, squeezed-shut eyes and a wide open mouth for rir. The gesture layer is drawn after the hat (a sun hat's brim used to hide the hand). Pop-up icons: `fx/emote_oi|valeu|rir|dancar|desculpa` (`custom/emotefx.mjs`, a 12 x 12 paper bubble with an 8 x 8 picture), `WorldScene.updateEmoteIcon`: above the head's right side for 1.1 s, rising 4 px in 0.16 s and fading in the last 0.25 s, also while the avatar walks (the gesture itself only plays standing still). Honest limit: over dark hair a dark hand still has little contrast (the frame is 16 px wide, the hand cannot leave the head), so the icon carries the message.
5. **Parrot.** 10 x 15 -> 8 x 10 (4 frames, `emotefx.mjs`, replaces the perch crop; the perch prop keeps its own parrot), hovering a little lower (`wy - 14`); the creator preview follows the new size.
6. **V5 rim.** `ShadowLayer.follow(.., { rim: true })`: a character gets the same warm ADD rim as a prop, from its live animation frame (mask per sheet, frame and side, packed into the shadow atlas on first use, flipped with the sprite), at 0.8 of the prop strength. The shadow keeps its one silhouette per sheet: following the frame would pack a silhouette per frame per look (several times the atlas use of the whole crowd) for a 1 px wobble, so I kept it (V5's decision stands).

### Known weaknesses

The outline pass makes sprites a touch heavier on pale ground; the flip-flop, jersey and cart read at zoom 3 and up, not at zoom 2; sitting avatars show the garb pieces but the side-view sit poses are approximate; no real child, wheelchair or pram art; the pop-up icons are 5 emotes only (no custom icon for an emote added later).

## Wave 3: streets

Branch `lifesim/w3-streets`. Scope: the two streets (Rua dos Ipês rows 8-13, Rua Jacarandá rows 30-35) re-laid so that parked cars, tree pits, lamps, utility poles, the bus shelter and the moving traffic stop overlapping. Shots in `docs/lifesim/shots/w3/` (`before_*` from lifesim/main, `after_*` from this branch; `scripts/w3-shots.mjs`: the full map, both halves of each street and the bus stop, at 12:00 and 21:00, solo build). Test: `render/pixel/streets.test.ts`.

**Why it overlapped.** A parked car's sprite is 37-46 px tall and a street is 64 px, so a car parked on the street's last row (the V2 layout) reached up into the eastbound lane, the sidewalk's tree crowns (80 px tall) and the poles (64 px, x-aligned with the cars) rose through it, and the shelter (30,12) sat beside a tree and a lamp on the bus bay's curb. Nothing was wrong in the footprints, everything was wrong in the drawn extents, so the new test measures sprite rects from the manifest.

1. **Rua dos Ipês: recessed parking bays.** The south sidewalk is 2 rows, so the cars now stand in two asphalt bays cut into its first row (`PARKING_BAYS_IPES` = x4-8 and x44-48 on row 12, `rooms.ts`; the terrain draws their curbs like any paved edge). A car stands on row 12 (its sprite spans y168-208), the lanes' sprites end at y168, so no moving vehicle reaches a parked one. Lanes moved to y0*16+17 (westbound) and +36 (eastbound); the bus keeps the eastbound lane, so the bus bay decal (`faixa_onibus`, 7 tiles) is centred on its wheels (y 144-176) and the lane dashes sit between the lanes (+26). Parked here: the green car (4) and the taxi (44); the rest of the curb is sidewalk (coconut cart, trees, hydrant, bins), because the cart's umbrella rises into row 11 at x28-31 and a car would sit under it.
2. **Rua Jacarandá: one-way.** Its south side has no sidewalk (the roofs start at row 36), so a bay is impossible; the street is **one-way eastbound** (`Street.lanes` is a list now; one lane at y0*16+16, sprite bottom at +20, above the tallest parked sprite at +22) and the parked row on row 35 keeps its 8 vehicles, re-spaced with a 0.6 tile gap or more between sprites and a tile clear of every crosswalk (x12-13, 24-25, 38-39). The dashes mark the parking row's edge (+45). `ambientSim.test.ts`: the lane-order check allows the single eastbound lane of `jacaranda`.
3. **Sidewalks.** Pit trees `arv_s1/s2/s4` stand between the bays and the poles (rhythm: pole every 8 tiles at x2,10,18,...,50 as before, trees centred between poles, cars between poles too), none within a tile of a crosswalk ramp; `arv_s3` moved to the north sidewalk of Rua Jacarandá, the Jacarandá trees `arv_j*` moved from row 31 to row 30 (a moving car's body no longer covers a pit; `arv_j1` at x10 keeps the vira-lata's roam set sane) and `ipe_lote_2` from (42,15) to (42,17) (its crown hung over the taxi). `lampada_n2` 9 to 10 and `lampada_n4` 29 to 30 (they touched the trees). Hydrant `hidrante_s` (5,12) to (11,12), `flor_s1` to (19,13), `flor_s2` to (51,13), `parquimetro` to (22,12), `lixeira_s1` to (23,13), `lixeira_s2` to (35,12): nothing else moved, every id is kept.
4. **Bus stop.** The shelter `ponto` moved from (30,12), where it stood by the coconut cart and a tree, to (36,12) (x36-38, centred on the bus: stopX 36.5 tiles), so the bus stands on the painted bay in front of it and the shelter's roof meets the bus sprite only in its wheel-shadow padding (4 px). The hotspot `ponto_onibus` follows (36,12). `AMBIENT.praca.bus.stopTile` is (37,13). Nanda and her hat stall stay where they were (tile (35,13)).
5. **Wires.** The pole-to-pole wires still sag across the bays (they are an overhead layer drawn at 70% alpha, like in life); they are not removed.
6. **Tests.** `streets.test.ts` (7 tests): bays are asphalt with sidewalk on both sides; gaps of 8 px or more; no parked car (inflated 4 px) overlaps a tree with its canopy, a lamp, a pole, the shelter, a hydrant, a crosswalk, a door, the bus bay or the bus at the stop; no tree pit, lamp or the shelter on asphalt or in a parked car's columns; sidewalk trees, lamps and shelter do not touch each other; every lane sprite ends above the parked sprites and sorts behind them; the dashes are never under a parked car; the shelter sits behind the bus. Adjusted: `v2layout.test.ts` (parking rows 12 and 35, crosswalks keyed 12), `rooms.test.ts` ((34,12) is the sidewalk), `ambientSim.test.ts` (one-way lane).

## Academia roll redesign (art)

Branch `lifesim/academia-art`. Art for "Treino no tatame" (brief: `ACADEMIA-REDESIGN.md`); gameplay consumes the keys in parallel. Contact sheet: `docs/lifesim/shots/academia-art/sheet.png` (every key at 4x, strips for animations, each pair with 4 skin / hair / belt swaps).

- **How it is drawn.** Authored (no pack art exists for grappling) with a procedural puppet renderer rather than frame-by-frame ASCII: 112 frames from 7 hand-posed positions and a few standing / finishing poses. It keeps the LimeZu look (big head, navy outline on every limb, upper-left light) and makes transitions free: they interpolate joint angles between two position poses with a small lift arc. Poses are authored on a 27 px figure and drawn at 0.84 with a 10 px head, so the pair matches the 16x32 characters' chibi proportions.
- **Contract.** Exactly the keys the brief lists; `pair_*` / `trans_*` / `finish_tap` / `win_raise` / `fistbump` / `face_off` are 56x42 (anchor bottom centre), `ref_*` 16x32. On the ground fighter A (player, white gi) is always the dominant one, B (partner, blue gi) under; positions are drawn side-on with lying heads tilted toward the camera (the usual 3/4 trick), so cem quilos is a T seen across B's chest.
- **Key ramps.** Added `skin2`, `hair2`, `belt` to `KEY_RAMPS`. Fighter B's belt is a fixed black; A's belt swaps (white / blue). The unit test checks that every bjj frame only uses key ramp colors plus the gi / outline / FX palette.
- **Referee.** Bia's signals are redrawn on the same rig (not cut from her sprite sheet): colors follow the standard skin / hair ramps, so swap them to her appearance when drawing. Fingers for 2 / 3 / 4 points are explicit glyphs.
- **Mat polish (`rooms.ts`, art only).** New non-blocking `cenario` props: `placar` (8,3), flags `bandeira_no/ne/so/se` at the mat corners. The wall poster text is now `RESPEITO · TREINO · AMIZADE` (art key `walls/poster_respeito`, `poster_oss` removed). No tile, collision or existing id changed.
- **For the gameplay side.** Scoreboard digits are DOM (cell rectangles in the assets README). No baked contact shadow in the pair sprites (use `fx/shadow_*` or none).

## Academia roll redesign (gameplay)

Branch `lifesim/academia-game`. "Treino no tatame" as built from `ACADEMIA-REDESIGN.md`: the match is IN THE WORLD on the academia mat (no modal), the server owns the bout, the pure rules live in `packages/shared`. Shots: `docs/lifesim/shots/academia/` (`scripts/academia-shots.mjs`: desktop, phone portrait, phone landscape, and the partner's side). The art is the other branch's (`ACADEMIA-REDESIGN.md`, `apps/client/assets-src/README.md`), merged here from `lifesim/main`.

### The rules (numbers; `packages/shared/src/bout.ts`, `academia.ts`, `challenges.ts`)

- **Ladder.** `rung` -4..+4 (positive: you are ahead): de pé 0, guarda fechada / meia-guarda ±1, cem quilos ±2, joelho na barriga ±3, montada or costas ±4 (the intent that took you up chooses which: Girar gives costas). One exchange moves at most one rung, so every step is one of the art's directed transitions.
- **Exchange.** Pick an intent (2-3 chips by rung: a safe one first, a steady one, usually a bold one), answer an A1 challenge, resolve. Intents (power / cost of a miss): Esperar 4 / 0 (halves the partner's push), Segurar 9 / 3 (a right answer always adds pegada), Puxar 15 / 7, Empurrar 15 / 7, Levantar 21 / 12, Girar 25 / 16. Risk pips on the chip: 1 / 2 / 3.
- **Force.** Right: power x (0.55 + 0.45 x speed); wrong or out of time: minus the miss cost. Speed is 1.0 inside the first 20% of the limit, 0 at 90%, linear between; "fast" (a pegada point) is speed >= 0.6, about the first half of the time. The partner rolls the same from its profile (intent by aggression, right by accuracy minus 0.04 per risk step, speed from its speed +-0.15) and pushes 1.3x (`PARTNER_PUSH`). A defender blunts your push by 0.35 x defense once you are at rung 2 or more.
- **Momentum.** `-100..100`, `m = 0.8 m + yours - theirs`. Past +-26 a rung moves and momentum is left at +-9; pressing past +-17 without moving earns one advantage per rung and side. The bar shows progress to the next rung (full = about to move).
- **Points (BJJ-like, announced by Bia).** Climbing to rung 1 = 2 (takedown), rung 2 = 3 (pass), rung 3 = 2 (knee), rung 4 = 4; advantage for a close press. Moving back scores nothing. "Dois pontos!", "Três pontos!", "Quatro pontos!", "Vantagem!" (also spoken, so it is number practice).
- **Pegada (grip) 0..3.** +1 per fast right answer (or any right Segurar), -1 per miss, -1 when you lose a rung. Full pegada at the top rung offers **Final!** (was "Finalização!" before the #49 lock): one long reorder (17 s) or three quick prompts in a row (3 x 7.5 s), x max(0.65, timer scale) x (1 - 0.2 x defense); the hardest defender (Daniel) always gets the three. Success: the partner taps, Bia calls it, your hand is raised. Failure: back to guarda fechada, pegada 0.
- **Escape.** The partner's pegada fills the same way. Pinned at -4 with it full, it goes for the finish with probability 0.3 + 0.65 x aggression each step: one quick prompt (9 s) decides: right = back to cem quilos, wrong = tap (you lose by the finish).
- **Clock.** 5:00 game time at x2 real time. An exchange costs max(16.7 s, (real ms spent + 2 s of resolve) x 2) of game time, and at most 18 exchanges, so a match is 2:20-2:40 of play (simulated over seeds, see the balance test). Time up: points, then advantages, then a draw.
- **Timers: generous at the start, shrinking only with the level** (belt + stripes, 0..8): `1 - 0.06 x level`, floor 0.55. Base limits: pick an intent 10 s (x max(0.7, scale)), cloze / choice 14 s, listening 15 s, typed 20 s, reorder 22 s.
- **Partners (unlock level = stripes on white 0-3, the blue belt 4).** Mateus balanced (acc .60, speed .45, aggr .45, def .45; level 0); Felipe fast but sloppy (.54, .90, .55, .25; 1); Helena slow and precise (.86, .32, .30, .60; 2); Daniel defensive (.72, .50, .20, .92; 3); Rafael aggressive (.74, .62, .92, .35; 4). First names from the CPU allowlist with their authored looks; a portrait card (the character preview) and a one-line PT bio each.
- **Belts.** 3 wins = a stripe, 4 stripes on white = the blue belt (12 wins), then stripes again; `bjj.belt` is optional and defaulted (old saves normalise), derived from wins, never purchasable. Worn in the academia (the gi layer's belt recoloured white / blue on every player, `PublicAvatar.belt`), shown on the profile card, in the lobby and on the end card. Superseded 2026-10-05: see "Belt pace" below. The live curve is `BELT_LADDER` in `academia.ts`.
- **Rewards (existing paths).** Win 12 RV, win by finalização 18, draw 7, loss 5; nothing when fewer than 3 answers were sent (an idle match pays nothing). Friendship with Bia: +1 per match, +3 per win, capped at 8 a day (`RecadoTracker.grantBond`, so heart milestones and gifts work as before). The Caderno learns: prompts are seen, a listened phrase is heard, a typed word is used.
- **Balance (400 seeds per cell, `bout.test.ts`).** A careless player (acc .5) wins under 25% against every partner; a learner (.75, mixed intents) wins about half against Mateus and far less against Helena and Rafael; a good bold player (.9) wins over 80% against all; bold play scores 3x and finishes more than waiting.

### Challenges (A1 Portuguese only; `needs_br`)

106 items: 31 cloze, 17 choice, 21 typed (one word, `normalizeAnswer` rules: accents and case optional, never a digit), 14 reorder, 18 listening (prebaked clips only, through `speak()`; none when sound is off) plus 6 long reorders for the finalização. Picked by the intent's kind weights and weighted 1x-4x toward Caderno cards not yet learned (an item with no card counts 0.3). No technique trivia, no "Oss", no "rola" (`challenges.test.ts` scans every prompt, option and phrase).

### Protocol `v: 1` (`t: 'bout'`, replaces `t: 'roll'`)

Client: `open`, `start {partner, listen}`, `intent {seq, intent | 'finalizar'}`, `answer {seq, answer: choice | order | text}`, `quit`. Server: `lobby`, `intro`, `intent {seq, intents, finish, pickMs}`, `challenge {seq, role: exchange | finish | escape, step, steps, challenge, limitMs}`, `resolve {seq, st, yours, partner, delta, events, holdMs}`, `finish_end`, `end`. Every message that moves the bout carries a `BoutSnapshot`; the client is stateless. The server validates: the `seq` must be the prompt on screen, the intent must have been offered, one answer per prompt, answers inside the limit plus 0.9 s (later = a miss, decided by a server timer, not by the client), answers within 150 ms of the prompt are ignored, a missing intent pick auto-chooses the safe one. `TB_TEST_ROLL=1` (solo `?rolltest`) adds `debugCorrect` to a challenge, shortens the pauses (x0.35) and the intro (0.5 s; `TB_TEST_BOUT_INTRO_MS` / `?boutintro=` override).

### The world side

- **Camera.** The dialogue framing reused: +1 CSS zoom step, centred on the mat in the space between the scoreboard and the panel (`withBout`), eased 0.4 s, instant under `reducedMotion()`. The HUD steps aside (`body.bout-on`); `game.modalOpen` blocks walking.
- **Stage (`boutStage.ts`).** The pair sprite on the mat centre (frames recoloured per palette signature from the atlas pixels with `swapKeys`, cached, removed at the end), transition clips, the tap, the raised hand and the fist bump; the two fighters walk on with the character sheets (white gi / blue gi looks), face off, bump, Bia calls "Combate!"; Bia swaps to her referee frame; spectators pop 👏 🔥 😮 and "Vai! Isso! Segura! Boa!" (DOM, glued to their heads); dust puffs, sweat sparkles, an 80 ms hit-stop and a 1-2 px camera nudge on scrambles (all off under `reducedMotion()`); the mat scoreboard shows the live digits in DOM cells over `props/placar`. Missing art is a magenta box and a note in `artMissing`.
- **Gi colours (the choice the art asked for).** In the art A (white gi) is always the one on top. The game's rule: **the player always wears the white gi (own skin, hair, belt), the partner always the blue gi with a black belt.** When the partner is on top, the same frame is drawn with the two slots exchanged by one exact-colour table: the top fighter gets the partner's skin and hair, the white gi turned blue and a black belt; the one underneath gets the player's skin and hair, the blue gi turned white and the player's belt (`pairTable` in `bjjArt.ts`, covered by tests). The player never changes colour.
- **Overlay (`ui/bout.ts`, `styles/bout.css`).** A bottom panel (partner cards, intent chips, the challenge card with a timer ring, momentum bar, pegada meter and a nine-step ladder, the result strip, the end card) and a pinned pixel scoreboard (Pontos / Vantagens / Tempo, the clock runs x2 between server snapshots). Phone portrait stays under 35% of the screen (measured 24-34.6% on 390x844), landscape 26-34% (on 844x390 the English glosses of the prompt and chips are dropped to fit; the EN toggle stays). "Mostrar inglês" is the same preference as the dialogue box.
- **Sound (`audio/boutSfx.ts`, `ambience.sfx`).** Synthesized, no samples: mat slap, crowd cheer with claps, "ooh", whistle, tap-out slaps, a soft gong; Bia's calls are spoken.
- **Removed.** `render/bjjPoses.ts` (+ test), `render/canvas2d.ts`, `ui/roll.ts`, the old `.roll` CSS, `ROLL_QUEUE_MS`, `rollQueueMs`, the old `roll` messages, the "(v0)" and "word game" clutter in the match UI (the welcome toast keeps its one line).
- **Scrubbed.** "Oss" is gone from learner-facing copy: Bia's idle line, her talk tree, the rules sign, Júlia's thanks in the pastel recado (`recados.md` / `.json`); the poster is the art branch's `RESPEITO · TREINO · AMIZADE`.

### New Portuguese for native review (all `needs_br`)

Intents: Esperar / Wait, Segurar / Hold, Puxar / Pull, Empurrar / Push, Levantar / Lift, Girar / Spin. Risk: Seguro, Firme, Ousado. Bia: Combate! / Begin!, Dois pontos!, Três pontos!, Quatro pontos!, Vantagem!, Pare! / Stop!, Vitória!. Crowd: Vai!, Isso!, Segura!, Boa!. End lines: "Finalização! Vitória sua!", "Finalização! Boa defesa da próxima vez.", "Vitória nos pontos!", "Vitória nas vantagens!", "Vitória do parceiro nos pontos." / "...nas vantagens.", "Empate!", "Partida encerrada.", "Obrigado pela partida.". Server lines: "Escapou! De volta pra guarda.", "Boa defesa! Você saiu!", "Esse parceiro ainda está bloqueado. Ganhe mais listras!", "Esse parceiro não existe.", "O tatame fica na academia.", "Versão do jogo desatualizada. Recarregue a página.", rewards "Treino no tatame: vitória!" / "Treino no tatame na academia". Overlay: Treino no tatame, Começar, "Parceiros novos abrem com listras e com a faixa azul.", "O que você faz?", Finalização!, Defesa, Finalização 1/3, Escute e escolha., Monte a frase., Responder, "Escreva aqui…", "Acentos são opcionais.", Ouvir, Rápido!, Certo!, Errou!, Tempo!, "Faixa azul conquistada!", "Nova listra!", "Professora Bia gostou do treino.", De novo, Sair, "Sair mesmo?", Pegada / Grip, Pontos, Vantagens, Tempo, Você, Parceiro, "você por cima", "em pé", "{nome} por cima", "1 listra / N listras", "Faixa azul", belts "Faixa branca", "Faixa azul". Partners (style / bio): Equilibrado "Calmo e justo. Um ótimo parceiro pra começar."; Rápido, mas bagunçado "Rápido demais, erra bastante. Chega antes, mas nem sempre acerta."; Lenta e precisa "Devagar, mas quase nunca erra. Paciência é tudo."; Defensivo "Difícil de finalizar. Segura firme e espera o erro."; Agressivo "Vai pra cima desde o começo e procura a finalização cedo.". Changed: "Bora treinar?" (Bia idle), Bia's talk tree without "Oss" (rows 71, 72, 77, 78 of BR-REVIEW), "Cumprimente com um sorriso." (rules sign), "Que delícia! Obrigada, viu?" (Júlia's thanks). The 106 challenge items are in `packages/shared/src/challenges.ts`.

### Known weaknesses

The fighters on the mat are one sprite, so a transition is a 4-frame clip and not a fluid grapple. The walk-in uses street-sized character sprites in a gi layer over their outfit. On a very small landscape phone the placar is partly under the panel. Listening needs sound on (it is skipped otherwise). PvP is still not there: the partner is always a CPU.

## Integrate main 2: the #49 lock on Treino no tatame

`origin/main` carried Jonny's #49 ("Academia chrome: hide remaining technique nameplates") on the old roll game, plus older Cursor merges of our branches. `lifesim/main` won every conflict (the old `ui/roll.ts` and `render/bjjPoses.ts` stay deleted; the stale intro map/pan files from the old snapshot were dropped). The e2e title tweak (`2c9fd4a40`, do not insist on clicking Pular) was ported by hand.

The new lock, applied to the bout:

1. **Overlay position chip.** Before: "De pé · em pé", "Montada · você por cima", "Costas · você por cima", "Guarda fechada · ...". After: `boutStepLabel(rung)` from `academia.ts`: level ground is "Em pé" / Standing; otherwise the size of the lead, "Vantagem" (1), "Pressão" (2), "Quase lá" (3), "Final" (4), plus "· Você por cima" / "· <partner> por cima". "Virada" stays in `BOUT_STEP_CHROME` for a future reversal toast and is not shown yet. The pose id still rides on `data-pos` and picks the art.
2. **Finish copy.** "Finalização!" chance → "Final!" (EN "Go for the finish"); role tag "Finalização n/m" → "Final n/m" (EN "Finish: step n of m"); end lines "Finalização! Vitória sua!" → "Final! Vitória sua!" and the partner's "Final! Boa defesa da próxima vez." (EN Submission → Finish); failed-finish line "Escapou! De volta pra guarda." → "Escapou! O jogo recomeça." (EN "Play resumes."). We dropped the generic "Finalização" too because #49 removed "finaliza" from its chrome regex. Protocol ids (`finalizacao`, `finalizar`) are internal and unchanged.
3. **Partner bios.** Daniel "Difícil de finalizar..." → "Difícil de vencer no final..."; Rafael "procura a finalização cedo" → "procura o final cedo".
4. **Bundle.** `POSITION_LABELS` and `positionLabel` are deleted, so no readable position name is in the client code at all. `apps/client/src/academia-lock.test.ts` runs a real `vite build` in memory and fails if any chunk contains Guarda fechada, Meia-guarda, Cem quilos, Joelho na barriga, Closed guard, Half guard, Side control, Knee on belly, Back control, a Mount / Montada / Costas label, or Finalização / Submission. It also checks the end lines and partner bios.
5. **Shots.** `docs/lifesim/shots/lock49/` (desktop intent, desktop Final chance, phone challenge).

## Correria no Balcão (art)

Branch `lifesim/correria-art`. Art for the counter work area of "Correria no Balcão" (brief: `CORRERIA-REDESIGN.md`, "Visual targets"); gameplay consumes the keys in parallel. Contact sheet: `docs/lifesim/shots/correria-art/sheet.png` (every key at 4x, animations as strips, plus a mock composite of the work area at game zoom 3; regenerate with `node scripts/balcao-sheet.mjs`).

- **How it is drawn.** All authored in `custom/balcao.mjs` with the padaria's own look: navy outline added once at the end (`outlineAround`), light from the upper left, LimeZu ramps (crust, gold, fry, steel, lavender enamel) plus the padaria accents (terracotta, cream, mustard, red gingham). The pack has no usable food or griddle art; the 16 px icons (`icons/*`) were the style reference, redrawn big, and `tray_full` reuses three of them.
- **Contract.** Every frame is its own sprite key (no `anim` block), so the game picks frames itself. Anchors are bottom centre of the contact point.

  | Key | Frames | Size | Anchor |
  |---|---|---|---|
  | `balcao/item_<id>` x 12 (all of `meveum.ts` SHELF) | 1 each | 28x28 | (14, 26) |
  | `balcao/tray`, `balcao/tray_full` | 1 each | 64x16, 64x34 | (32, 14), (32, 32) |
  | `balcao/bag`, `balcao/plate` | 1 each | 24x30, 28x12 | (12, 28), (14, 10) |
  | `balcao/chapa_idle`, `chapa_sizzle_0..2`, `chapa_burnt` | 1 + 3 + 1 | 40x36 | (20, 35) |
  | `balcao/coffee_idle`, `coffee_pour_0..3` | 1 + 4 | 34x42 | (17, 41) |
  | `balcao/register` | 1 | 26x24 | (13, 23) |
  | `balcao/bell_0..1` (still, rung) | 2 | 22x16 | (11, 14) |
  | `balcao/tipjar_0..3` (empty, coins, coins + notes, full) | 4 | 20x24 | (10, 23) |
  | `balcao/patience_0..4` (full to out of patience) | 5 | 14x14 | (7, 14) |
  | `fx/steam_0..3` | 4 | 14x24 | (7, 23) |

- **Food.** Pão francês is a pointed oval with a pale split "ear"; pão na chapa is a split roll with grill marks and a glossy melting butter pat on a plate; pastel is a flat blistered half-moon with a fork-crimped seam; coxinha is the breaded drop; bolo is a carrot-cake slice with chocolate glaze drips (the padaria classic); café and café com leite are in a copo americano on a saucer (black with hazel crema vs milky with foam); suco is an orange juice with a paper straw and an orange wheel; água is a 500 ml bottle with a blue cap and wave label; pão de queijo is four cheese balls on a red gingham liner; misto-quente is a toasted sandwich cut in two showing cheese and ham; guaraná is a plain green can with a yellow wave and a red berry (no brand, no letters).
- **Chapa and coffee.** The chapa is a stainless flat griddle with a hinged press propped open at the back (so the bread stays visible), dials and a pilot light, grease shine. Sizzle frames toast the loaf pale / golden / brown with bubbling butter and sparks; `chapa_burnt` is black with smoke and embers. The coffee machine is a classic red-enamel padaria espresso with a cup-warmer rail, gauge and chrome group head; `coffee_idle` has no glass, the four pour frames put a copo americano under the spout and fill it (the stream stops on frame 3).
- **Overlay pieces.** `patience_*` is a clock-pie that drains clockwise and goes green / lime / yellow / orange / red, with a red "!" at 4; it is drawn to sit over a customer's head and stays readable at zoom 2-3. The steam is the only part with partial alpha (soft wisps); everything else is hard pixels (the unit test checks it).
- **Tests.** `scripts/lib/pixel/balcao.test.mjs`: every contract key is in the manifest, single-frame, with the generator's size and an anchor inside; no extra `balcao/*` keys; item sizes 24-32; hard pixels; the strips differ frame to frame.
- **Known weaknesses.** The press on the chapa reads a little like a panini grill; the pastel crimp is a comb-like band at 1x; no baked contact shadows (the counter top is the shadow); the tray holds 16 px icons in `tray_full`, not the 28 px items.

## Correria no Balcão (gameplay)

Branch `lifesim/correria-game`. The padaria counter game, formerly "Me vê um…", as built from `CORRERIA-REDESIGN.md`. It runs IN THE WORLD behind the padaria counter (no modal), the server owns the shift, the pure rules live in `packages/shared/src/correria.ts` (a plain-object state machine: `newShift`, `shiftAdvance(dt)`, `shiftAct(action)`, `shiftSnapshot`). The art is the other branch's (`balcao/*`, `fx/steam_*`), merged from `lifesim/main`; the contract and the layout are `apps/client/src/render/pixel/correriaArt.ts` (with a test against the manifest). Shots: `docs/lifesim/shots/correria/` (`scripts/correria-shots.mjs`: desktop, phone portrait, phone landscape).

### The rename (learner-facing)

"Correria no Balcão" (EN "Counter Rush") now appears in: the guide arrow label, the ticket-rail prop label (`rooms.ts` `trilho`, the hotspot), the tutorial step (`TUTORIAL_STEPS` "Jogue a “Correria no Balcão”"), the daily mission step ("Monta um pedido na Correria no Balcão"), the Pedido rápido button ("Jogar “Correria no Balcão”"), the map's padaria card, the welcome-panel blurb, Seu Carlos's closing line, the "not enough coins" hint, the RV reward label, the overlay, the end card, the README and BR-REVIEW (rows 294, 435). "Me vê um…" stays what customers SAY (the order phrase). Internal ids are unchanged (`t: 'mg'`, `meveum.ts`, `tutorial.meveum`, the `me-ve-um-orders` pack), so the curriculum tests and saves are untouched. Seu Carlos's closing line is not in the prebaked audio yet (`node scripts/bake-tts.mjs` needs edge-tts): until it is re-baked the pt-BR system voice speaks it, and `library.test.ts` pins that exception.

### The design (numbers)

- **Shift.** 3 waves of 4 + 5 + 6 = 15 customers, at most 3 at the counter (the front one plus a queue). A customer walks in for 1.8 s, then waits. Gap between arrivals per wave 10 / 8 / 6.5 s (x0.85 to x1.35 by level, +5 s breather between waves). A shift is about 3 to 4 minutes.
- **Patience.** `order.timeMs x 0.9 x level multiplier x wave factor (1 / .85 / .7)`, at least 16 s, at most 100 s; regulars +15%. The front customer loses it at 1x, the queue at 0.45x. A wrong tray costs 15%. The meter over the head is `balcao/patience_0..4` (4 = more than 75%).
- **Beta founder badge (2026-10-05).** A mustard `Fundador` chip sits beside the overhead nameplate (`FOUNDER_BADGE`, `needs_br`). All legacy profiles backfill `founder: true` on load; new profiles get it while `TB_FOUNDER_GRANT_NEW` is not `0`/`false`/`off`. Turning the env off only stops new grants.
- **Padaria MASTER PLAN Slice 1 (2026-10-05).** Counter juice: card slap on order land, burn pop, pour glug, chain clink at combo 3 perfect serves, wrong-plate tray squash and shrug emote. Order subtitle fades in ~1 s; TTS on land. Listening replay: full text + audio after first replay; costs 1 then 2 patience pips (`PATIENCE_PIPS` = 4), third tap ignored (Carlos sigh, `needs_br`). RV ownership table in `padariaEconomy.ts` (no spend UI). **Size tiers** (Jonny lock: ownership v1 ships Balcão 900 / Padaria 1500 / Restaurante 3000 RV — menu scope only in comments) are not built in S1. Fundar, hat, sweet tiers, gerente, stitches: still out of scope.
- **Orders.** The curriculum pack (`me-ve-um-orders`) early, generated combos with number/gender agreement later (never at Verde), only items open on this shift's menu, no repeats while a fresh one exists, greeted by the game hour. Modes: written (bubble + overlay mirror) or listening (voice only through `speak()`, the words hidden until replay; follow-ups come 7-11 s after the customer steps up: "Ah, e mais um pão!", "Não, um suco em vez do café." A follow-up does not add pra viagem. The order the counter wants changes; the tray is checked against it.
- **Levels** from total shift stars: Verde (0), Pegando o jeito (3), Na correria (8), Mestre do balcão (16). Verde: patience x1.6, gaps x1.35, written only in wave 1 (listening 0 / 10 / 20% by wave, follow-ups 0 / 0 / 10%, "Quanto é?" 0 / 20 / 30% as three chips), glosses locked on. The top level: listening 30 / 45 / 60%, follow-ups 15 / 30 / 40%, "Quanto é?" typed (numbers or words, accents optional).
- **Assembling (every step is a server-judged action).** Shelf, vitrine, estufa and geladeira items go straight to the tray (a miniature hops on). Pão na chapa and misto-quente go on the chapa: ready after 2.4 s (a green ring on the grill), they burn after 5.4 s (a burnt piece is thrown away when tapped); one spot, two with the unlock. The coffee machine: tap to start the pour (café or café com leite), the cup fills on its own for 1.8 s (1.3 s with the unlock), tap again inside 70% to 108% of the fill; too early is "faltou café", too late spills; leaving it past 1.7× spills by itself, like the chapa burns. Bag = pra viagem, plate = pra comer aqui (tap again to put it back); "sem açúcar" and "bem quente" are chips. Tray cap 9.
- **Serving.** Entregar compares the tray with what the customer wants now. Right on the first try is perfect: 10 + up to 5 for the patience left + a combo bonus min(5, combo-1) + the tip. A wrong tray gets a correction with its gloss and costs patience; fixing it is "segunda" (6 points, combo broken); a second wrong tray and they walk out. Corrections: the count first ("Não, eu pedi DOIS pães…"), then "Faltou …", "Eu não pedi …", then the mods ("Era pra viagem!").
- **"Quanto é?".** After a serve a customer may ask the total; the card lists the items with their prices (R$) and gives 15 s. Right: +3 (+1 for a regular) +1 tip; wrong or late: they say the total and pay anyway. They pay with the smallest note (5 / 10 / 20 / 50 / 100); the line says it ("Toma, vinte reais.") and the event carries the change (`pay - total`); it is spoken and shown, not a separate tap step.
- **Tips and combos.** Tip 1, +1 (patience over 50%), +1 (combo of 3+), doubled for a regular; reais in the jar (`tipjar_0..3` at 1 / 10 / 24 R$). The baker cheers at combos 3 / 5 / 8 / 12 ("Isso aí!") and the screen nudges 1 px.
- **Stars and RV.** Points over 330 (max) give stars at 28% / 50% / 70%. RV is `ECONOMY.minigameMin..Max` by points (a flawless fast shift on the starter menu reaches 20), times the menu scale below, nothing when nobody was served. **Daily gate:** the first 3 paid shifts of the real day pay RV; later shifts pay 0, but stars, levels and unlocks still count ("Hoje já pagamos os turnos do dia. As estrelas contam!"). Regulars served perfectly give +1 friendship (up to 3 per paid shift).
- **Unlocks (stars only, never pay-to-win).** `profile.correria` is `{stars, shifts, best, date?, paid?, taught?}`, optional and defaulted on load; tool unlocks are derived from the stars. 2: the "pastel e coxinha" milestone (the items themselves are on the shift ladder, not behind this star); 4: a second chapa spot; 7: a faster coffee machine; 10: Saturday orders (game clock "Sáb": 40% of customers bring a 3-line order for +50% points). The item "feijoada" itself was NOT added, so the art contract stays the 12 shelf ids.

### Menu ladder (2026-10-07)

The counter menu is derived from completed `shifts` (`ITEM_EVERY_SHIFTS = 2`), not stored as a separate list. A new player has café and pão francês. Then, in order: água, pão de queijo, café com leite, suco de laranja, pão na chapa, coxinha, pastel, bolo, guaraná, misto-quente. The whole ladder is open at 20 shifts; an old save with shifts and no `taught` is treated as already taught. An owned padaria's `menuIds` still caps the pool (size 1 stays café and pão). Orders, follow-ups and "Quanto é?" only use that pool. Suco is still a fridge grab (no juicer).

The first shift that shows a new item (or packing) sends a one-time on-screen card (`lesson`, marked in `taught` before the shift starts, so a crash does not repeat it). English on that card stays visible when the player hides other glosses. From 6 open items (`WHERE_MENU_AT`, shifts ≥ 8) every order says pra viagem or pra comer aqui and the player packs it with the bag or the plate; before that those mods are absent. The packing card wins over the new item on the shift it unlocks.

Pay is today's coins plus 6% of that base per item past the first two (`PAY_STEP_PCT`), so 1.00 at two items and 1.60 at twelve (a perfect shift pays 32 RV, not more). The shift start and the end card say "+1 item no cardápio: pagamento +6%" when the counter actually grew. Lessons and that line are not spoken. Coffee is tap to start, tap again to stop (`pour_start` then `pour_end`); the client does not require a held click.
- **Regulars.** Friends at 1+ hearts (Nanda, Júlia, Bia, Seu Zé, Seu Chico, Dona Rosa, Tia Lu) come as customers: 32% per customer, once each per shift, weighted by hearts, in their authored look. Neighbours get the CPU look of an allowlist first name.
- **D12.** The baker on duty (Seu Carlos by day, Dona Graça at night) stands at the side of the board and cheers; the game is playable at any hour.

### Protocol (`t: 'mg'`, replaces the tray protocol)

Client: `start`, `act { act }` (`grab {item}`, `chapa_put {slot, item}`, `chapa_take {slot}`, `pour_start {item}`, `pour_end`, `pack {kind: bag | plate | null}`, `mod {id}`, `clear`, `serve`, `replay`, `answer {value}`), `quit`, `sync`. Server: `state {snap, ev[], resync?}` (the whole shift picture plus the one-shot events that just happened) and `end {end, carlos, lost?}`. The server advances the shift clock itself (250 ms ticks, a 4 s heartbeat snapshot; the client only interpolates the meters), judges every step (a finished tray cannot be sent: there is no tray in the message), measures the chapa and the pour on its own clock, and ignores malformed actions. A customer's order lines never reach the client (only the text); `TB_TEST_MG=1` (solo `?crtest`) adds them for bots. `sync` is not real input for the idle kick.

### Restart and reconnect

The shift is memory-only on purpose (as before). A deploy drops it: the client's overlay stays up, reconnects, rejoins and sends `sync`; the server has no shift and answers the "perdi a comanda" end card (no RV, no stats). `scripts/e2e-meveum.mjs` restarts the server twice (between customers, and mid-build with an item on the tray) and checks it. A dropped socket instead parks the shift for 20 s and the rejoin resumes it with the clock paused (the time away burns no patience).

### Files

Shared `correria.ts` (+ test); server `correria.ts` (engine), `correriaTestKit.ts` and tests; client `render/pixel/correriaArt.ts`, `correriaFeed.ts`, `correriaStage.ts`, `ui/correria.ts`, `ui/correriaLogic.ts`, `styles/correria.css`, `audio/correriaSfx.ts` (synthesized: grab pop, sizzle, ready ding, burnt buzz, pour glug, bell, coin clink, register, paper, door chime, nope, combo arpeggio). Deleted: `ui/meveum-ui.ts`, `meveum-batch`, `meveum-clock` (with their tests) and the old modal CSS. `meveum.ts` stays as the order pack and its helpers.

### New Portuguese for native review (all `needs_br`)

Customers: "Perfeito, obrigado!" / "obrigada!", "Isso mesmo, valeu!", "Rapidinho! Obrigado!", "Show! Tá ótimo.", "Nossa, que rapidez! Obrigado!", "Que atendimento! Parabéns!", "Agora sim! Obrigado.", "Tudo certo agora. Valeu!", "Você é o melhor do balcão!", "Sempre perfeito! Obrigado, viu?". Leaving: "Ai, não dá, tô atrasado!" / "atrasada! Tchau.", "Demorou demais, vou embora!", "Deixa pra lá, eu vou em outra padaria.", "Ai, desisto. Tchau!". Follow-ups: "Ah, e é pra viagem!", "Ah, e é pra comer aqui!", "Ah, e mais um/uma …!", "Não, um/uma … em vez do/da ….". Corrections: "Não, eu pedi DOIS pães…", "Faltou …!", "Eu não pedi ….", "Era pra viagem!" / "Era sem açúcar!", "Não era pra comer aqui.", "Hmm, não é bem isso.". Saturday: "Sábado! Hoje é festa: me vê …". Cash: "Quanto é?", "Isso! Doze reais. Toma, vinte reais.", "Hm, são doze reais. Toma, vinte reais.". Baker: "Isso aí!", "Boa!", "Tá voando!", "Lá vem gente! Calma e capricho.", "Mais uma rodada. Bora!", "Última leva! Dá conta!". Game: "Ainda está cru!", "Queimou!", "Faltou café!", "Derramou!", "A chapa está cheia.", "A bandeja está vazia.", "A bandeja está cheia.", "Esse vai na chapa.", "Esse sai da cafeteira.", "Esse item ainda está trancado.", "Isso não vai na chapa.", "A chapa já está ocupada.", "Esse lugar da chapa ainda está trancado.". Overlay: "Onda 1/3", "clientes", Pontos, Combo, Gorjeta, Entregar, Limpar, "Bandeja vazia", Sacola, Prato, Cafeteira, "Esperando o próximo cliente…", "Escute o pedido…", "Ouvir de novo", "Escreva o total…", Responder, "Fim do turno", "Clientes atendidos", "Pedidos perfeitos", "Melhor combo", Gorjetas, "“Quanto é?” certos", "Palavras novas no Caderno", "Novidade no balcão!", "Jogar de novo", Sair. Levels: Verde, Pegando o jeito, Na correria, Mestre do balcão. Unlocks: "Pastel e coxinha na estufa" ("Pastel e coxinha entram na estufa quando o cardápio chega neles."), "Segunda chapa" ("A chapa agora tem dois lugares."), "Cafeteira mais rápida" ("A cafeteira novinha enche mais rápido."), "Pedidos de sábado" ("Aos sábados vêm pedidos grandes, com bônus."). End lines: "Valeu pela ajuda! Aqui estão N reais virtuais.", "Turno encerrado. Aqui estão N reais virtuais pelo que você já serviu.", "Turno encerrado. Dessa vez não deu RV — pode começar de novo quando quiser.", "Que turno! Hoje já pagamos o que dava, mas as estrelas contam.", "RV de hoje: já pagamos os turnos do dia. As estrelas contam!". Unchanged: "Ih, perdi a comanda! Bora começar um turno novo?", "Até a próxima, ajudante!". Renamed: "Correria no Balcão" (prop label, tutorial, mission, buttons, map card) and Seu Carlos's "Quer ajudar no balcão? É a “Correria no Balcão”.".

## Music: one theme, everywhere

The intro song is now **the** theme ("Tudo Bem"), and the whole game is built from it. Listening copies: `docs/audio/`.

1. **The theme (`audio/theme.ts`, pure data).** The old 8-bar loop (Dmaj9 · Bm9 · Em9 · A13 · F♯m7 · Bm9 · Gmaj9 · A13 and the whistled line) is kept note for note as section A of a 32-bar form: **A · A' · B · A''**. A' answers with a more active melody and a vibraphone third underneath; B is a bridge (Gmaj9, F♯m7, Bm9, Em9, Gmaj7, **Gm6**, F♯m7, A13) with the electric piano on the tune; A'' brings the bell and the band back. The hook is bars 0-1: **E F♯ · C♯ D E** (degrees 2 3 7 1 2). Tests (`theme.test.ts`) check that the hook is in every arrangement and stinger, that everything is in key (only the Gm6 B♭ is borrowed), that bars fit and loops repeat.
2. **A real band (`audio/synth.ts`).** Plucked strings are Karplus-Strong buffers rendered once per pitch (nylon guitar, cavaquinho, upright bass), keys are FM (electric piano), vibes, music box and bell are additive, the whistle and flute have breath and a scoop, the clarinet is a wavetable, the accordion and brass are filtered saws. Percussion: shaker, brush, cross-stick clave, surdo, pandeiro. Every voice is panned and goes through a room reverb (a generated stereo impulse) and a gentle compressor (`Rig`).
3. **Intro.** Plays the whole form and builds: the title beat is pad, bass, guitar, whistle and shaker through the muffled tone filter; when the sign-in card arrives the filter opens **and** the band steps up one level (clave, picking, surdo, bells).
4. **Praça (`audio/conductor.ts`).** The random pentatonic plucks are gone. Every 15-45 s a phrase of the real tune plays (hook, A, the answer, the bridge, a tag), always ending on the tonic, by **mood**: morning whistle with picking; midday vibes with a whistle double; golden hour electric piano over the accordion; night a music box in a low register, slower; rain a soft electric piano over a felt pad. The radio in the houses plays the theme through a telephone-band filter instead of the old made-up tune, and goes quiet when you walk away (the clock keeps running).
5. **Rooms.** Padaria: choro in G by day (cavaquinho, accordion, clarinet, pandeiro); after 22:00 a slow vibes version, and the bed swaps when the clock crosses the hour. Kitnet: a music box plays the first eight bars, then eight bars of room. Academia: a soft samba pulse with the hook on vibes (it used to share the kitnet's bed). Treino no tatame is a **scene** like the intro: batucada and brass stabs on the hook, one level higher on a finishing chance or an escape, gone at the end card.
6. **Stingers (`ambience.sting`).** Fragments of the tune on the moments that matter: recado done (hook start and a Dmaj9 arpeggio), a heart (E up to B), RV and Caderno group (bells), the daily mission (the whole hook, strummed), a bout win (the hook as a fanfare) and loss (the hook that settles on D), the padaria door bell. They honor the music switch and the speech ducking.
7. **Cost.** All of it is Web Audio generated at run time. Strings are rendered once per pitch and shared between beds; the reverb impulse is cached per context.

Not done: nobody has listened on real speakers yet (the numbers are checked, not the taste: levels and the mix are one constant each in `ambience.ts` `MUSIC_LEVEL` and the `PEAK`-style gains in `synth.ts`), and no native review is needed (no new Portuguese).

## Music pass 2: a mix, not a stack

Goal: the same music, but seamless and "official": nothing jumps out, places flow into each other, the tune leads. Everything was
measured with a new offline lab (`scripts/audio-lab.mjs`, integrated loudness with K-weighting and gating, per voice and per place).

1. **Clicks.** Every enveloped gain started at Web Audio's default 1.0, and automation starting between two samples only takes hold
   on the next one, so the first sample of every hit passed at full gain: a one-sample click on each shaker, pandeiro, clave and
   noise hit (measured at up to -6 dBFS on a stem whose loudness was -50 LUFS), on every footstep, chirp and bout effect too.
   `vca()` (a gain that starts at 0) is now used for every envelope in synth, ambience and boutSfx. This was most of the harshness.
2. **No hidden compressors.** Each rig had a DynamicsCompressor, and Chrome's adds automatic make-up gain, so quiet parts were
   pushed up and transients spiked. Rigs are now clean (a bus EQ: 38 Hz high-pass, -2.5 dB at 260 Hz, -2 dB shelf above 8.5 kHz);
   one soft limiter sits on the master (`mix.createMaster`), well above the music's peaks.
3. **The tune on top.** Stems showed the strummed guitar and the bass 4 dB *over* the whistle. `VOICE_DB` (synth) now sets the band:
   tune at the top, bass and guitar about 4 dB under, pads and arpeggio further back, the shaker, brush and pandeiro brought up from
   inaudible to a texture. Each arrangement trims it (`sequencer.MIX`).
4. **Levels between places.** Before, the padaria (-22 LUFS) was louder than the intro (-23) and the big stingers (-18) jumped 5 LU
   over everything. Now every bed, Praça mood and stinger has a target in `mix.ts` and a measured `calibration.json`; gain = target
   minus measurement (table in `docs/audio/README.md`). A stinger dips the bed under it (-4.4 dB) while it plays, and plays in the
   bed's key (the padaria is in G). The bout's effects were tuned before the bout had music; they now sit at the music's level
   (`SFX_TRIM_DB`).
5. **Flow.** Room changes are an overlapping exponential crossfade (about 1.5 s) instead of a 0.7 s linear one. A bed you come back
   to within 90 s picks its tune up at the next four-bar phrase instead of restarting. The speech duck goes to -10 dB with a soft
   attack and a slower release (it was -15 dB with a 0.12 s ramp both ways). The Praça's phrases hold back while the houses' radio
   (which plays the tune too) is audible, so two versions never overlap.
6. **Feel.** The sequencer no longer plays the grid dead straight: off 16ths swing a little (bossa and samba both lean on it), a few
   ms of seeded timing and velocity variation, and the tune sits a hair behind the beat. Deterministic, so renders and tests are stable.
7. **Sound.** A new room impulse (early reflections, a darkening tail, normalized), a tempo-synced ping-pong echo on the lead voices,
   a darker strummed guitar, less sub on the bass, a softer brass section (a swell, not a snap), a gentler bell and pandeiro. In the
   padaria the cavaquinho plays a choro figure instead of straight eighths and the clarinet rests in the bridge (vibes take it).

Still not done: nobody has listened on real speakers; the numbers are right, the taste needs ears. Every level is one number in
`mix.ts`, and `node scripts/audio-lab.mjs calibrate` keeps them true after any change.

## Split into areas

Branch `lifesim/split-areas`. Jonny: the one 56 x 40 outdoor map "goes a little slow", is "a little over-stimulating", and the feira should be its own area so it can grow. Vila Ipê (room `praca`) is now three open-air rooms joined by edge portals.

- **The areas.** `rua` Rua dos Ipês, 40 x 16: the building row (padaria, banca + Hortifrúti, Edifício Ipê, academia doors, all still on row 5), the street with traffic and the bus stop, two sidewalks, a lawn strip with a brick path. `praca` Praça Central, 32 x 24, the spawn room (id kept: saves, `tb_last_room` and tests keep working): fountain plaza, coreto, bust, playground, domino and chess tables, kiosk, Nanda's stall, parrot perch, the vira-lata corner, pipoqueiro and coco cart. `feira` Feira Livre, 32 x 20: fenced lot of setts, four stalls and their vendors, bunting, shoppers. Rua Jacarandá, the south roofs (the `fundos/*` art stays in the manifest) and the west houses are gone.
- **Connections.** `rua` south edge (row 15, x18-21) <-> `praca` north edge (row 0, x14-17); `praca` east edge (col 31, y10-13) <-> `feira` west gate (col 0, y7-10). `PortalDef.edge: true`: one portal per border tile, each arriving at the matching tile of the neighbour (never on an edge tile, so no ping-pong). The server moves a player when a walk ends on an edge tile (`World.move` `done`), so click, arrow keys and joystick all work; edge portals have no door art, click box or minimap door (the minimap shows one marker per opening). Interiors exit onto the `rua`.
- **NPCs.** `npcMotion.legsBetween` now routes through any chain of public rooms (BFS over portals, the nearest portal tile of an opening, one leg per room, `vanish` between legs), so Seu Carlos walks padaria -> rua -> praça to his bench at 22:00, the vendors walk home -> rua -> praça -> feira before 06:00, Tia Lu feira -> praça at 13:00, Nanda and Júlia between the Edifício door and the praça. Home door: the Edifício (`NPC_HOME_DOORS.rua`). Júlia is by the banca on the rua in the small hours and 23:00-24:00, in the praça otherwise. Every NPC and prop id that still exists is unchanged. `feira.ts` checks the room (`feira` for stalls, `rua` for the Hortifrúti crate); the kiosk, Nanda's shop and the parrot stay praça-only; the mission greeting counts in any outdoor room.
- **Less to look at.** Praça: 54 props (excluding hedges and fences) in 768 tiles, 0.07 per tile, against 58 in the old praça block's 496 tiles (0.117 per tile), about 40% calmer, focal points kept; benches 8 -> 5, trees 10 -> 9 with no pit-tree rows, 4 canteiros -> 2, hedges and lamps halved. CPUs: Praça 4, Rua 3, Feira 3 at most (the old map had 8), thinning as players arrive. Ambient: 5 butterflies (was 8), 10 fireflies (16), one fountain, the dog only in the praça, traffic and headlights only on the rua, pigeon flocks 2 / 2 / 1 (10 before). At most two ambient NPC speech bubbles at once (`ambientBubblesFull`). CPU nameplates stay quiet as before.
- **Feira room to grow.** `FEIRA_SLOTS` (rooms.ts) is the stall grid, 3 x 2 stalls on a 6-tile pitch, two rows: four built, four free (`vaga_*` slates chalked VAGA, `feira/vaga`, with a "Vaga livre" label; never a blank board), plus a free paving band to the south and a free column to the east. To add a stall: give a free slot a vendor (`feiraStall`, `feira.ts`, `schedules.ts`) or extend the grid.
- **Per-room data.** `ambientData.ts` (streets / bus / dog / fountain optional), `scenery.ts` `DRESSING` (crosswalks, bus bay, manholes), `sceneryV2.ts` `V2` (sand pit, towels, trails, hopscotch, market litter; the old feira litter was never drawn because the fence's whole footprint counted as occupied), `ambiance.ts` (`RUA_` / `PRACA_` / `FEIRA_AMBIANCE`, `cpuTarget`), audio zones (street hum only on the rua, fountain only in the praça), one shared outdoor music bed for the three areas (`ambience.ts` `target()`), hotspots re-placed by id, guides (`updateGuides` per area), the Mapa panel (tabs for the three areas, cards for all rooms, the locked "Feira" card is gone), the title picture (rua above the praça on the shared brick path, 640 x 640, so the intro pan never shows void on a phone).
- **Perf** (`scripts/perf-areas.mjs`, headless software GL, camera pinned at zoom 3, chuva, `__tb.perf` at 4.6 s). Before, one map: desktop 17:30 fps 55, avg 18.1 ms, p90 28.2; 19:30 (bus, traffic, headlights) fps 22-24, avg 42-45, p90 60-62; phone 17:30 fps 66-69, avg 14.5, p90 22; 19:30 fps 38-44, avg 23-26, p90 34-37; about 2090 scene objects, 50 textures, 108-236 particles, 13 labels. After: Rua (the busy street) desktop 17:30 fps 64, avg 15.7, p90 28.5; 19:30 fps 37, avg 27, p90 43; phone fps 156 / 94, avg 6.4 / 10.7, p90 6.5 / 15.6; about 860-910 objects. Praça desktop fps 153 / 70, avg 6.5 / 14.3, p90 6.4 / 27; phone 163 / 123; about 910-965 objects. Feira desktop and phone fps 165, avg 6.1 ms; 480-540 objects. Each area has less than half the old map's objects and no area pays for the others. `scripts/soak-v5.mjs` on `rua`, `praca`, `feira` (all four weathers, 6 hours, desktop): no blank frame, no context loss, textures bounded (max 53).
- **Tests and scripts.** The rooms, schedules, hotspots, ambiance, audio, minimap, intro, streets and scenery tests are rewritten for the three areas (new: edge connectivity both ways, no open border tile, `FEIRA_SLOTS`, multi-room routes, CPU targets per area). Browser scripts use `scripts/lib/areas.mjs` `goArea(page, 'rua')` to walk off the edges; `e2e`, `e2e-feira` (day, night), `e2e-night` (a, b), `e2e:meveum`, `e2e:solo` and the soak are updated and green (`pnpm e2e:all`). New: `scripts/perf-areas.mjs`, `scripts/split-shots.mjs`, shots in `docs/lifesim/shots/split/`. The older one-off shot scripts (`v2-shots`, `w3-shots`, `lifesim-shots*`, `visual-audit`, ...) still use the old 56 x 40 coordinates and are legacy.
- **Known weaknesses.** The signposts that would name the next area were dropped (the only street-sign sprite reads "R. DOS IPÊS"): the edges are announced by the brick path between hedges and, during the tutorial, by the guide arrows. The rua at 19:30 in rain is still the heaviest scene (bus, headlights, wet reflections). The praça has fewer lawn patches than before.

### Correria: area-split merge and the board polish

- **Merge.** `origin/lifesim/main` (the area split: `rua` / `praca` / `feira`, interiors exit to the rua) is merged. Both sides kept: the map panel has the area tabs and the padaria card reads "Bakery — breakfast + “Correria no Balcão”", the guide arrow says "← Rua" and "Correria no Balcão", the e2e walks praça → rua → padaria (`goArea`), then plays the shift. `scripts/correria-shots.mjs` does the same walk.
- **A clean grid (`correriaArt.ts`, checked by `correriaArt.test.ts`: every piece inside the board and no two rectangles overlapping, labels included).** The wooden board now reaches up over the north wall (room y -38 to 129). Shelf: four columns x three rows (12 items drawn at 0.72 scale, 27 px between columns, 32 between rows, the name 12 px under each). Right column: the coffee machine over the chapa (the cups and the raw bread are the shelf cells next to them), the plate under it. Pack row: tray and bag. Service row: register, tip jar, bell. The queue stands on the right of the floor, so nothing the customers' meters or tags cover is a tap target. The shelf labels scale with the zoom and are hidden below about 2.2 css px per world px (phones); tapping an item always says its name with its gloss on the line under the order.
- **Nothing on top of the board during a shift.** The guide arrows, the NPC nameplates and bubbles (`#world-labels`) and the hotspot eye cues are hidden while the counter is up (`body.cr-on`). Customers carry a small name tag (a heart for a regular, a speaker while a listening order is open) and a speech bubble only when they say something extra (a regular's greeting or a follow-up); the order text is in the overlay. The baker's cheer is a name-tagged bubble over the coffee machine (the floor is the queue's, so there is no baker sprite).
- **Personality.** Each regular has a greeting when they step up and two thank-yous of their own (`REGULAR_VOICE` in `correria.ts`, all `needs_br`): Nanda "Oi! Bom te ver no balcão." / "Ficou lindo! Valeu, viu?" / "Você já podia vender chapéu comigo!"; Júlia "E aí! Já tô com fome!" / "Tá ótimo! Obrigada, viu?" / "Ai, que cheirinho bom!"; Bia "Bom dia! Hoje tem treino." / "Muito bem! Isso é disciplina." / "Rápido e certinho. Gostei!"; Seu Zé "Fala! Vim buscar meu café." / "Tá certo, tá certo! Obrigado." / "Nota dez, hein?"; Seu Chico "Opa! Cheguei com fome." / "Show! Tá na mão." / "Quase tão bom quanto o meu pastel!"; Dona Rosa "Bom dia, flor! Tudo bem?" / "Que capricho! Obrigada." / "Até as flores sorriram!"; Tia Lu "Oi, meu bem! Rapidinho, tá?" / "Ai, que delícia! Obrigada." / "Você é um amor!". Names of the tapped items appear as a line with their gloss ("pão de queijo · cheese bread").
- **Camera.** The +1 zoom step was never applied before (the room key is `padaria|padaria#1|`, not `padaria`); now it is, and it backs off so the board and queue (162 x 170 world px) stay in the band between the HUD and the strip. Landscape phones get the whole board small, strip 22-29%; portrait 18-33%.

## The street is two areas (rua + rua_leste)

Jonny: the Rua dos Ipês (40 x 16: five facades, the traffic and the bus, parked cars, lamps, a night full of lights, CPU neighbours) still lags. Same pattern as "Split into areas": two open-air rooms joined by edge portals.

- **The cut.** At x21, the seam between Edifício Ipê (x11-20) and the academia (x21-30): no facade, door, crosswalk, parking bay or prop is split. `rua` (id kept, 21 x 16, west): padaria (door `praca_padaria`), banca + Hortifrúti, empena, Edifício Ipê (door `praca_kitnet`), the brick path to the praça. `rua_leste` (new, 19 x 16, "Rua dos Ipês (leste)" / "Ipê Street (east)"): academia (door `praca_academia`), escola (door `rua_escola`), the bus stop, the parked taxi, the east barricade. Door portal ids are unchanged. Props of the east half are the old rua's x minus 21 (`RUA_CUT`).
- **Connections.** `rua` col 20, rows 6-13 <-> `rua_leste` col 0, rows 6-13 (`rua_leste_N` / `leste_rua_N`): both sidewalks and the whole street; the one-tile lawn strip (row 14) is closed at the seam by a bush so no border tile is open. The brick path to the praça moved from x18-21 to x15-18 (the old one straddled the cut): `rua_praca_N` at row 15, x15-18, arrive at praça x14-17 (`praca_rua_N` maps x+1). Interiors exit onto the half their door is on: `academia_praca` -> `rua_leste` (5,6), `escola_rua` -> `rua_leste` (12,6), padaria and kitnet -> `rua` as before. The rua spawn moved to (16,13), rua_leste's is (8,7).
- **Traffic.** Each half has its own lanes (`street('ipes', 8, 11, cols)`): cars enter and leave at that half's two ends, so the street reads as continuous. The bus stop (and the bus, its bay and painted lane) is in `rua_leste`; the headlight pool scales with the street length (10 per 40 tiles). `TrafficSim` works unchanged in both (its tests run on the east half, with the person at x200).
- **Per-room data.** `scenery.ts` DRESSING (crosswalks and 2 manholes west; bus bay, dashes and 2 manholes east), `sceneryV2` (hopscotch on the path at x15), `ambientData` (flocks, audio zones, the radio in the west), hotspots re-placed by id (`academia_letreiro`, `placa_rua_ipes`, `ponto_onibus`, `lixeira_praca` -> `rua_leste`; `parquimetro` moved to x14), ambiance CPUs (2 per half, was 3 for the whole street; `RUA_LESTE_AMBIANCE`), the shared outdoor music bed, `WALL_STYLE`, the HUD room name, the Mapa (four tabs and a card for the east half), the minimap (one marker per opening), the title picture (the two halves side by side on top, the praça 1 tile in), the tutorial guide arrows (`updateGuides`: an arrow to the seam toward the academia, and back toward the rua from the east half), `scripts/lib/areas.mjs` (`AREA_EDGES`: rua_leste - rua - praca - feira) and the e2e scripts that enter the academia (`goArea(page, 'rua_leste')` first). Poles: `rua` keeps one wire span (poste_2 - poste_3), `rua_leste` has one pole and no span.
- **Measured** (`_quick.mjs` harness, headless software GL, 1280 x 800, solo build, one human + CPUs, `window.__tb.perf` and a wrapped WebGL). Old rua, night 20:30: 19 draw calls and 19 framebuffer binds per frame, 7921 vertices, 691 scene objects, 47 lights (16 windows, 20 lamps, 10 headlights, the player), 2 vehicles, 4 avatars. New `rua` at night: 16 draw calls, 19 binds, 4504 vertices, 421 objects, 32 lights, 3 avatars; new `rua_leste` at night: 16.9 draw calls, 19 binds, 3678 vertices, 363 objects, 17 lights (5 windows, 6 lamps, 5 headlights), 3 avatars. Day (08:40): old rua 5 draw calls / 3 binds, 6940 vertices, 690 objects; new `rua` 424 objects / 3838 vertices, `rua_leste` 360 objects / 3311 vertices. The framebuffer binds per frame are the lighting passes (a constant), which a smaller room does not shrink; what falls is vertices, objects, lights, CPUs and vehicles on screen. Shots in `docs/lifesim/shots/split/street_split_*.png`.
- **Known weaknesses.** The seam has no signpost: it is the open street, plus the guide arrow during the tutorial. `perf-areas.mjs` was not re-run on real hardware (the software-GL fps in the probe is not comparable). The old one-off shot scripts that still use 56 x 40 coordinates stay legacy.

## Belt pace (Jonny lock 2026-10-05)

`BELT_LADDER` in `packages/shared/src/academia.ts`. Wins per stripe: white 5, blue 10, purple 20, brown 40, black 80. Four stripes promote — the fourth stripe is the next belt, so a belt is worn with 0–3 stripes. Black keeps earning stripes. Cumulative wins: blue 20, purple 60, brown 140, black 300. The product brief's cumulative cells said brown 100 and black 260; CEO confirmed those were arithmetic typos, and the 4× totals (140 and 300) are the source of truth. Fundar (player academies, slice 1) reads brown from `normalizeBjj` and therefore opens at 140 wins. There is no second win counter. A draw is not a win. A loss does not remove a stripe. Every load recomputes belt and stripes from `wins`, so an account saved on the old 3/6/12/24/48 ladder wears the new rank for the same wins (15 wins was blue and is now three white stripes; 105 was brown and is now purple with two stripes; 225 was black and is now brown with two stripes). Moves above the new rank drop off. The move that used to be taught at four stripes (Base on white, Americana on blue) is granted when that belt is left, because that stripe is the promotion.

## Padaria ownership polish (2026-10-06)

Brief: make the owned-padaria loop (Fundar → hat → re-enter → work → upgrade) findable and fun. Shots: `node scripts/padaria-shots.mjs` (solo build; see its header), `docs/lifesim/shots/padaria-own/`.

- **Upgrades charge before they apply.** `upgradePadaria` used to set the new size or sweet on the row and only then check RV, so a short owner kept the upgrade (and it was saved with the next `padarias.json` write). Rules live in `checkPadariaUpgrade` (pure) / `applyPadariaUpgrade`; the server checks, charges, then applies. `nextPadariaUpgrade` picks what to point an owner at (Padaria size, sweets cheapest first, Restaurante).
- **Re-entry.** The profile push carries a derived `padaria {id, name, size}` (never stored; flag-on only). Seu Carlos's facade door on Rua dos Ipês asks an owner "Qual padaria?" (theirs first). The street shows a guide with the shop's name over that door once the Carlos tutorial step is done. The door fund's hover reads "Sua padaria: <nome>", and its modal for an owner is just "Entrar na minha padaria" plus the tip that the door works too. The own shop still does not list itself in "Padarias do bairro".
- **Inside an owned padaria.** HUD subtitle "Sua padaria · Balcão" / "De <dono> · Padaria" (was "Seu Carlos's Bakery"). The shop's name is chalked on the lousa (a DOM `sign` plate). Seu Carlos's "Desde 1978" shelf sign and his tutorial greeting are skipped. The vaso by the door is the book of **Melhorias** (owner: three size cards and three sweet cards with what each unlocks, cost, or the RV still missing; visitor: the shop's card). The floating floor bar is gone (it covered Cartela / Recados and sat over the Correria board). Guides: "Seu balcão: Correria" and "Melhorias" for the owner; "Balcão da casa" and "← Rua" for visitors. A one-time welcome card (per padaria, localStorage) says what is where.
- **Balcão da casa.** The `balcao` prop has `action: 'padaria_counter'` (interact 2,3). Shared padaria: the baker on duty takes the order (as clicking him did). Owned: the house menu by size and sweets, specials first. Before this nothing in an owned room opened its counter, so Restaurante and the sweets had no effect anywhere. A visitor's reais go to the owner's coins (a transfer, never new RV) with a notice if the owner is online; the owner buying in their own shop pays as anyone does.
- **Correria in your own shop.** Board items stay the shared 12 capped by size (Balcão: café and pão only). The owned-only SKUs have no board art or spot, so they are sold at the balcão da casa, and the copy says so. Cheers are signed "Freguesia", not Seu Carlos. The end line is about your own till ("Turno fechado na <nome>! O caixa fez N RV."), and the end card shows the next upgrade and the RV missing.
- **Founder hat.** `chapeu_padeiro_casa` is now an `EARNED_HATS` catalog entry (white toque, mustard band like the founder mark). Before, it had no catalog colours and rendered as the `#c9582c` fallback, an orange block. The wardrobe lists earned hats; the stall refuses to sell them (`isStallHat`).
- **Copy.** Fundar: "<nome>: porta aberta!"; size: "<nome> cresceu: agora é Padaria!"; sweet: "Brigadeiro na vitrine!"; buys name the gap ("Faltam N RV."). All new Portuguese is `needs_br`.
- **Later slices (not built).** Board art and shelf spots for the owned-only items (so sweets and plates can be Correria orders); carry sprites for them (an owned item in hand draws nothing); décor and a sign style for the facade; management; per-padaria name flavour after N shifts.

## Reading words without floor plates (2026-10-06)

Jonny: the coloured word plates (DESCONTO, PROMOÇÃO, FARMÁCIA, PARE… 41 `diary/sign_*` sprites dropped on the floor, one per room per day) were ugly and everywhere. They are gone from the world.

- **Where the words live now.** Each reading word (`s_<word>` in `diaryWorld.ts`) is written on a real thing already in the room, and is only a hotspot over it (no prop, no sprite): street words on posts and street furniture (PARE on the post at the crossing, DEVAGAR, TRAVESSA, SENTIDO ÚNICO, IGREJA and BANHEIRO as direction plates), shop words on the ground floor of the existing buildings (FARMÁCIA and LOTÉRICA on the Academia block, AÇOUGUE and MERCADO on the Escola block, SALÃO / BARBEARIA / LAVANDERIA under Edifício Ipê), market words on the thing they label (R$ / KG and UNIDADE on the scales, DÚZIA and ORGÂNICO on crates), interiors on the matching object or wall (DESCONTO on the vitrine, PROMOÇÃO taped to the window, CHAMADA on the classroom blackboard; wall signs use the hotspot `up` rows). Clicking reads it with the usual hotspot card and grants the word, as before.
- **Finding them.** A small pixel twinkle (`fx:glint`, 7 x 7, generated in code, the guide arrow's gold) sits at the top of each word this player has not read yet, and goes away once the word is in the diary. Steady under reduced motion; hidden during Correria, a bout and the camera.
- **No rotation for signs.** With nothing on the floor there is no clutter to ration, so every reading word is readable every day (`diaryVisible` is true for signs; `DAILY_SIGNS` is gone). The small camera objects (`d_*`) still rotate two a day.
- The `diary/sign_*` frames stay in the atlas, unused.

## Treino no tatame and player academies: polish pass (2026-10-06)

Brief (Jonny): "a full and complete polish of the jiu jitsu game and ownership… take full creative ownership". Shots: `node scripts/bjj-shots.mjs` (bout) and `ACADEMY=1 node scripts/bjj-shots.mjs` (founding and the floor), `docs/lifesim/shots/bjj/`.

**What was wrong when played.** Both fighters re-took a grip they already held, so whole matches went by with grips and ended 0-0. The five partners had accuracy / speed / aggression / defense on their cards, but the mat loop never read them (every partner fought the same). The moves hid behind six tabs, with tiny labels and no word on what they do. Guide arrows and every NPC nameplate stayed over the mat. The end card had no score, no next step and no tip. A new player (10 RV) was offered an 18 RV gi it could not buy. The academy floor was an empty room with a bar over the HUD and nothing to do.

- **Rules (`matFight.ts`).** `gripHeld`: a grip the fighter holds is neither offered nor playable. `resolveMat(..., edge)`: a percent nudge for the partner's accuracy, clamped to 5..95 and never opening a locked move. `matEffect`: what a move does if it lands (points, the pose it ends in, who is on top, finish, finish-miss risk).
- **Partners have character (`matStyle`, `chooseBot(..., style)`).** Edge = (accuracy - 0.6) x 40 (Mateus 0, Felipe -2, Helena +10, Daniel +5, Rafael +6). Aggression 0.8+ (Rafael): any finish at 20%+ first, and takedowns straight from standing (no grip fight). Defense 0.8+ (Daniel): escapes first, Postura against grips, holds a lead unless a scoring move expects 1.5+. Speed 0.8+ (Felipe): shoots once he has one grip. With no style the old policy is unchanged (its tests stand). `thinkMsFor(speed)` = 4200 - speed x 2200, clamped 2200..4600 (inside the 2-5 s the slower opponent turn asked for); the intro sends `thinkMs`, and the server's reveal wait uses the same number.
- **Picker.** Every legal move is a card: the gag track as a coloured header (Pegada blue, Quedas orange, Raspagem green, Defesa purple, Passagem gold, Final red), the name, the odds (green 60%+, yellow 35%+, red long shot) and one line of effect: "+2 · você por cima", "Vale a vitória!" (with "Se errar: você por baixo"), "+10% nas quedas", "Solta as pegadas", "Sai de baixo". Hold is a narrow quiet card ("Passa a vez"). Keys 1-9 and H. No tabs. The #49 lock holds: effects say who is on top, never a position name (the strings are tested against the lock regex; "Segurar guarda a vitória" was reworded because "guarda" trips it).
- **End card.** The score (`Lia 5 × 3 Mateus`), a bar to the next stripe and the move it teaches (`nextStripe`, `moveTaughtAt`), and one tip from Professora Bia that fits the result and the moves the player has (`coachTip`).
- **Stage.** Tutorial guides are off while the bout is open. Neighbours' and NPC nameplates are hidden under the mat camera (their bubbles still talk). No scoreboard in the lobby; no stale position line on the end card.
- **First visit.** The gi dialog says how much RV is missing and where it comes from when the player is short, instead of a buy that only errors. The academia welcome says "No tatame é brincadeira: escolha os golpes, faça pontos e respeito sempre." (it still called the mat a word game), and the mat sign's EN gloss is "Mat practice".
- **Player academies (slice 2 of the floor).** The floor's mat trains (`andar_tatame` has `bjj_roll`; the server accepts bouts on `andar` as on the flagship; the stage finds any tatame, the referee and scoreboard are optional). The floor bar is gone: the HUD reads "Sua academia · ✿ 1 membro" / "De <dono> · …", the crest and name sit on a plate over the board, and the board (`andar_brasao`, `academy_board`) opens the look editor for the owner or a team card (join / leave, free) for anyone else. The founding form and the look editor have labelled fields, labelled picker buttons and a live preview (crest, name, gi swatch with its stamp). Guides: "Treinar" on the mat, "Brasão e kimono" / "Entrar na equipe" on the board. The slice-1 test that said the floor has no `bjj_roll` now says it has its own mat.
- All new Portuguese is `needs_br`.

## Tatame v2: grip strategy and fight visuals (#129, 2026-10-08)

Brief (Jonny, #129): grips should be strategy, not a flat bonus; the fight should look like a fight. Locks: centred and seamless; every answer reads as ground gained or lost; no BJJ quiz (the mat teaches Portuguese only); keep the 5/10/20/40/80 stripe pace; do not touch #57. Shots: `node scripts/jiu-jitsu-shots.mjs` (builds the solo client itself; `--views=desktop|phone --bouts=N --out=dir`), `docs/lifesim/shots/jiu-jitsu/` (1280x800 and 390x844).

- **Rules (`matFight.ts`).** Every throw from standing needs a grip (Queda and Tornozelo any grip; Abraço a grip, or their collar on you). Gola: Queda +25 and opens **Arrastar** (to the back). Manga: their attacks on you −20 (the shield) and opens **Puxar** (pull to guard, keep the sleeve: the next sweep +20). Both: **Arremesso**, the strongest throw. A lone collar is punished (their Abraço +15). The combos come with the grips (`COMBOS`), not with stripes, so `UNLOCK_ORDER` and the stripe pace are unchanged. A throw spends its grips, hit or miss. **Postura** strips one grip (collar first) and braces against grips and takedowns; **Base** braces against takedowns (and sweeps, from on top); **Recuperar** from the bottom of the guard braces against passes. A brace waits for one move only. An attack that runs into a brace and misses is a **Vantagem** for the defender; advantages break a points tie (`reason: 'vantagens'`). A grip held through three of your own turns slips and you are tired (−10) for one move.
- **The control meter (`matMeter`).** −100..100 from the player's seat: position rung x17, grips held x9, advantages x5, a brace up ±4, a tired fighter ±4, and who won the last exchange ±7. Every move moves it (a grip, a brace, a miss), so the resolve card always says ▲ "Você ganhou terreno" or ▼ "Você perdeu terreno"; only Hold reads even. It is a read, not a score: points and advantages still decide the match.
- **The partner telegraphs (`planBot`, `botCommit`).** On your pick screen the server shows what the partner will do next ("Mateus vai tentar a queda.") and flags the cards that answer it (`planAnswers`). The AI is a two-ply expected-value search weighed by the partner card. After your move it keeps the telegraphed move unless your answer made it illegal or clearly worse (`PLAN_INERTIA` 0.6 points); then the resolve says "Mudou de plano!". Rolls stay on the server. In `matSim.test.ts`, reading the telegraph beats always taking the biggest percent against Mateus (about 56% wins against 41%).
- **HUD (`ui/bout.ts`).** A tug-of-war meter (your green from the left, their red from the right, a gold mark where they meet), built once per match and slid with a CSS transition. Each side has **Gola** / **Manga** chips with three pips for the turns left (they blink on the last one) and a gold glow when you hold both. A shield chip shows a brace that is up, and a dashed **Cansado** chip shows a tired fighter. The telegraph banner sits in the "Sua vez" row with "Responda com …" chips. On the cards: `Responde!` and `Combo` badges, brace cards drawn as shields (double border), the odds parts ("Gola +25", "Manga dele −20"), and the server's few words on what a setup opens. A quiet dashed row lists owned follow-ups still waiting for a grip ("Arrastar · Precisa da gola"). On desktop the cards sit in one row, so the panel stays short.
- **Stage (`boutStage.ts`, `gagCartoon.ts`).** The fight camera sizes the fighters, not the mat: integer zoom so the figures (the lower 32 px of the 56x42 pair frame) fill about 70% of the band between the scoreboard and the overlay, never less than the lobby step. It walks there one device px at a time and works around the tallest the overlay has been this match, so it holds still between phases. The partner wears their own belt on the blue gi (the bot is a student at your belt), not the baked black belt. Held grips are little hands on the gis (gold yours, red theirs; blinking before a slip). Queda, Arrastar, Puxar, Arremesso (a full turn over), Postura and Base each have a routine instead of one lean, and a brace sinks wide and low (`read: 'brace'`). At the cartoon's impact: a white flash on a throw or points, word pops over the fighter who earned them (Vantagem!, Pegou a gola!, Soltou!, Escorregou!, Base firme!), and ▲ Ganhou! / ▼ Perdeu! under their feet. Panels ease in instead of cutting. Reduced motion drops the flash, the blink, the slides and the pops' motion.
- **e2e.** `scripts/lib/bout-play.mjs` has a `read` pick (play the answer to the telegraph) and `readBoutHud`. `e2e.mjs` checks the meter, the chips and the telegraph on the first pick. The shots script asserts the meter, the telegraph, a brace card, lit chips, a ground read, no missing bout art and no page errors.
- All new Portuguese is `needs_br`. No new spoken lines (the referee calls are unchanged), so no `pnpm tts`.

## A portrait is a close-up of the sprite (2026-10-08, #126)

Jonny: the dialogue portraits were "absolutely horrendous and don't look anything like the characters". They were hand-drawn busts in a flat, smooth style, so the face in the dialogue box was not the person the player had just clicked.

- **The rule.** A portrait is a close-up of that NPC's world sprite, not a separate drawing. `assets-src/custom/portraits.mjs` composes the sprite with the game's own look code (`looks.ts` → `composeLook`, bundled by `custom/lookkit.mjs`) from the char layers `pnpm pixel` just built. Skin, hair, hat, outfit, apron, glasses, earrings and props are the sprite's own pixels, so a change to `NPC_STYLES` or a regular's signature art shows up in the portrait on the next `pnpm pixel`.
- **How.** The bust is the south idle frame, 20 × 20 sprite px from the hat down to the shoulders. The eye row and the row above it are shown twice (three times for a pack face, which has the jaw right under the eyes), and a hair or hat row that repeats the one under it is dropped. The window is scaled 3× with Scale3x: every output pixel copies one sprite pixel, so there is no blur and no new colour. The silhouette outline is then thinned back to 1 px. The face marks are lifted off (including the navy eye marks of the LimeZu body) and the eyes, brows and mouth are redrawn per expression (`neutro`, `feliz`, `surpreso`, `pensativo`) in the sprite's own iris, brow, skin and lip colours. Glasses are redrawn as thin frames.
- **Hand-touches** live in `TUNE`: Rosa's eyes go on her face (her sprite has them on the locks of hair beside it), Júlia's mouth pixels are listed by hand, and the agent's brows are under his cap.
- **One frame, a room behind them** (`custom/portraitbg.mjs`): navy edge and a wood ring for everyone. The background is the NPC's room in `ROOMS`: padaria wall and azulejos, the feira tarp in that vendor's stripe colour, praça sky and ipê, escola chalkboard, academia mats, airport glass.
- **Small cards crop to the face.** Each portrait's manifest entry has `face: [x, y]`. `npcPortrait` sets `--face-x` / `--face-y`, and the tracker and journal cards (`recados.css`) centre their crop on it, clamped to the 64 px card. Sizes are unchanged (64 × 64, 2× on desktop, 1× on phones), and the 48 PNGs total about 54 KB (57 KB before).
- The player avatar and the parrot are not touched. Contact sheet: `node scripts/portrait-sheet.mjs` → `docs/lifesim/shots/portraits/contact-sheet.png`. In-game before / after: `node scripts/portrait-shots.mjs --out=…`.

## Escola: lessons, streaks and earned nameplate colours (#125, 2026-10-08)

Dona Lúcia's desk was one multiple-choice card. It is now a lesson loop over the player's own diary words (`packages/shared/src/escola.ts`, server `apps/server/src/escola.ts`, client `apps/client/src/ui/escola.ts`).

- **Lessons.** 10 exercises over 6 words (at most 3 brand-new), then up to 3 retries of the misses. Six kinds, dealt and checked by the server one at a time (the client never holds an answer): pick the Portuguese, pick the meaning, listen, type it (accent-tolerant, "almost" for a missing accent), build a real line from tiles, and a match race of 5 pairs. Every reveal plays the word's neural clip; Dona Lúcia's lines are voiced.
- **Spaced repetition.** A Leitner box per word, 1-5; due again after 0 / 30 min / 6 h / 20 h / 3 days; a mastered word answered right rests 7 days; a miss drops it two boxes (not below 1) and makes it due now. Only a due word moves up, so cramming the same word in one sitting does not master it.
- **XP, goal, streak.** +1 per right answer (+2 from a ×5 combo), +3 per finished lesson, +5 for a perfect one, +5 for the daily word mission. Daily goal 10 / 20 / 30 XP (player's choice). The streak follows the player's own calendar day (`tz` from the client). A streak freeze is earned every 7 days (max 2), never bought. The HUD shows a small goal chip (today's XP / goal, the flame) until the goal is met; it is a reminder, never a notification.
- **RV stays R$1 per word (#120).** 1 virtual RV per right first answer, capped at 10 per lesson and 30 per day so the desk is not a farm. Virtual only; the beta stays free, nothing here is bought.
- **Nameplate colours.** Earned by words mastered (box 5) and never lost: Verde 0, Amarela 15, Azul 60, Roxa 150, Dourada 300 plus a 30-day best streak. Each colour has a shape (seedling, sun, drop, star, crown) so it reads without telling colours apart. Shown everywhere a player's name is: the overhead plate (others and yourself), the HUD and phone drawer, the profile card, the friends list, the "Nesta sala" roster and the minimap's "você" dot. The room gets a notice when someone earns a colour.
- **Nameplate colour vs English help.** The plate used to mean "sees English". They are now separate: English glosses under chat are the player's own toggle (Ajustes → Inglês, on by default), and earning a colour never turns help off. Conversa replies stay at the shortest length while English help is on, whatever the plate.
- **Saves from before.** Every diary word starts at box 0 (learned, not mastered), so everyone starts Verde; `normalizeEscola` fills the rest.
- **Test hook.** `POST /__test/escola` (only with `TB_TEST_CLOCK_CONTROL=1`) seeds an online player's escola for screenshots.
- All new Portuguese is `needs_br`.

## Espremedor automático (#131, 2026-10-08)

Suco de laranja is no longer a grab from the fridge. It comes off the espremedor on the right-hand tower, above the coffee machine (`JUICE` in `packages/shared/src/correria.ts`). Shots: `node scripts/juicer-shots.mjs` (built client, `TB_TEST_CLOCK_CONTROL=1`), `docs/lifesim/shots/juicer/`.

- **One tap, one orange.** `juice_drop` sends the next orange through the machine (roll, cut, press, pour, peel, 640 ms). Three sizes, seeded: pequena 0.26, média 0.34, grande 0.40 of the line. The glass has a line (`JUICE_LINE_ROWS` 7). Tap the glass (`juice_take`) to serve. The server judges it: under 0.80 is short (thrown out), over 1.20 overflows at once, between them lands. Every glass still under 0.80 has room for the biggest orange.
- **When it unlocks.** Suco is the step after pão na chapa on `MENU_LADDER` (one new item every 2 completed shifts, so the 7th item opens at 10). That shift's pay bump is the usual +6%.
- **The card.** Lesson id is `espremedor`, not the item id, so a player who already saw the old suco card still gets this one once. On screen, not spoken. `pendingLesson` still shows the packing card first when that one is due.
- **Old saves.** `normalizeCorreria` with no `taught` and shifts already played marks every old item card and `where` as seen. It does not mark `espremedor`, so the juicer card still shows once. A save that already lists `taught` is kept as it is.
- **Reduced motion.** The cycle is not played: the machine stays on the idle frame and the glass jumps to the server's level.
- **On screen.** The camera `NEED` is 162×216 and `FOCUS` sits at (80, 40), so the tower (it starts above the old shelf) stays under the HUD and the zoom backs off a step when the free band is short. The lesson card is tall enough that Entendi is inside the card. Shelf taps (`#cr-hot`, z-index 12 as a body sibling) paint over `#ui`, so while a step lesson is open (`body.cr-lesson-open`) `#ui` stacks above the taps and the card ignores pointer events except Entendi.
- **Free beta.** Nothing here is bought. The shift still pays the existing virtual RV, scaled by the menu as before.
- All new Portuguese is `needs_br`.

## Feira cart games: daily rotation, Tapioca (2026-10-08)

Three skill games share one cart in the Feira. This PR ships the framework and the first game (Tapioca). Pastel and Caldo de cana are later PRs: adding one is a game-logic module plus a client view, registered in `FEIRA_GAME_MODULES` and `FEIRA_IMPLEMENTED_GAMES`.

- **Rotation.** `daysSinceEpoch(America/New_York date) mod 3` over the fixed order `['tapioca', 'pastel', 'caldo']`. `featuredGame(etDate)` is the helper. A slot whose game is not implemented yet falls back to the previous implemented game in the cycle, so until Pastel and Caldo land every day is Tapioca, and the day they register the schedule becomes the real 3-day cycle. The ET date (not the game clock) picks the game, including across the 23:30 / 00:30 ET boundary and the DST days.
- **Scoring.** The client sends per-order quality (`perfect` / `ok` / `soft` / `miss`) and timing. The server recomputes the score from the seed's orders and hard-caps it at `FEIRA_GAME_MAX_SCORE` (500). A finish under 8 seconds is rejected. Extra or forged rows are dropped, never trusted. A mistimed flip is a soft fail (score only), never a game over.
- **RV.** Same band as Correria (`ECONOMY.minigameMin` 8 to `minigameMax` 20), with a flawless run paying 25. Nothing when nobody was served. The first `FEIRA_DAILY_PAID_RUNS` (3) runs of an ET day pay; later runs still count for the board and pay 0, with a bilingual note. Beta is free: no purchase and no real-money gate.
- **Board, medals, crown.** One ET-day board of each player's best score (any Feira game). Ties go to whoever reached the score first. At midnight ET (lazy, on any read/write and on the idle timer) 1st/2nd/3rd receive a permanent gold/silver/bronze medal, copied onto the profile and listed in the diary under "Medalhas da Feira". The board then starts empty. The live leader wears a small pixel crown ("Fada da Feira") on the overhead nameplate until midnight. The crown is a display overlay only: belts, nameplate tiers and stripes are untouched. The sign `placa_jogos` opens today's game, the live top 3 and all-time medal counts.
- **Cart and sign.** `carrinho_jogos` is its own sprite (`props/carrinho_feira`: striped awning, chapa, tapiocas, a TAPIOCA board), interact tile (22, 9). The sign `placa_jogos` is its own bright easel (`props/placa_feira`, not the mat scoreboard), on the aisle just west of the cart, interact (19, 8). Usable at any game-clock hour (D12). The Tapioca view builds its DOM once and updates it in place, so a real mouse click lands on the button that received it. DOM ids for a screenshot script: `#feira-cart-panel`, `#feira-cart-play`, `#tapioca-root`, `#tapioca-pan-0`, `#tapioca-end`.
- All new Portuguese is `needs_br`.

## Feira cart games: Pastel (2026-10-08)

Pastel joins the rotation. With Caldo de cana merged too, all three slots are real games; a slot whose game is switched off falls back to the previous switched-on game in the cycle.

- **Play.** Made to order: massa, the filling, the fork, then the oil. Two pastels fry at once from the start (a third slot after 4 serves). Pull while it is golden. Leave it and the ladder is golden → dark → black → a charcoal block → fire. "Apaga!" puts the fire out. There is no extinguisher. Burnt, raw, or a fire you smothered is a soft fail (score only). The run does not end. Combo fillings (frango com catupiry, camarão com catupiry, Romeu e Julieta, banana com canela) are two bowl taps, arrive from the sixth customer on, and use a shorter golden window.
- **Score.** Same server path as Tapioca: per-order quality, recomputed from the seed, hard cap 500, RV in the Correria band, first 3 runs of the ET day pay. Beta stays free. Chat, belts, nameplates and stripes are untouched.
- **Registry.** Pastel is registered the same way as the other cart games: the id is in `FEIRA_ROTATION_ORDER`, `FEIRA_IMPLEMENTED_GAMES`, and `FEIRA_GAME_MODULES`. The admin list is that rotation order, so Pastel is its own toggle (`#admin-feira-pastel`) and a missing flag is off. Caldo has its own real toggle (`#admin-feira-caldo`), also off by default. Shots turn Pastel on from the credits admin door, and the solo pin `?feiraon=pastel` does the same switch. Neither assumes the cart is open.
- **Shots.** `GAME=pastel node scripts/feira-games-shots.mjs` adds `?feiraon=pastel`. Real mouse clicks, including one pastel left until it catches fire. Shots in `docs/lifesim/shots/feira-games/`.
- All new Portuguese is `needs_br`.

## Outdoor framing: the street fills the window (#123, 2026-10-08)

On a desktop the open-air maps were stepping down a zoom so the whole map fit, which left a small square of street with black around it. Shots: `docs/lifesim/shots/street-framing/` (`node scripts/street-framing-shots.mjs`).

- **Framing (`outdoorFraming` in `coords.ts`).** An open-air map keeps the window's own integer device zoom. It does not step down to fit. The camera follows the avatar and clamps to the map edges (an axis narrower than the window stays centred). While you stand on the north sidewalk the tops of the building fronts stay in view, then the camera eases into following. Interiors are unchanged: `roomFraming` still steps down one integer zoom when that shows the whole room, and a room that fits stays centred and does not follow the avatar.
- **Surround (`surround.ts`).** Past the walkable tiles the scene draws the real neighbouring areas (one town grid, from the edge portals: the east half of the street beside the rua, the street above the praça, the feira beside it) and, past the street barricades, generated blocks of terrace houses, lamps, trees and parked cars. The ground and the skyline continue further, so the window is town and sky instead of black. Nothing in it is walkable or clickable: it lies outside the room grid (pathfinding and the server never see it) and its props carry no action, label, seat or interact.
- **How much of it a phone draws.** Props, dashes and the neighbours' dressing stop 8 tiles past the map edge (a 1920×1080 window at the street zoom sees about 6; a phone less). Further out is ground and sky only. Those surround sprites are static: no sun-shadow caster and no lamp. A first cut that kept 16 tiles, with shadows and lamps, copied most of the next area into the scene and cost a phone about +20% to +50% frame time on the street. 8 tiles and static sprites stay under that.
- **Phone, before and after.** Headless Chrome, 390×844, `scripts/perf-areas.mjs` against a built `main` and against this branch (`__tb.perf`; the probe pins the camera at zoom 3, so this is the surround's cost, not the zoom change; chuva at 17:30 and 19:30). Average frame time, main → this branch: praça 42.9 ms (23 fps) → 41.3 ms (24 fps) and 39.8 ms (25 fps) → 36.4 ms (27 fps); rua 32.8 ms (30 fps) → 36.6 ms (27 fps) and 36.9 ms (27 fps) → 40.8 ms (25 fps); rua_leste 31.3 ms (32 fps) → 35.6 ms (28 fps) and 29.4 ms (34 fps) → 32.9 ms (30 fps); feira 27.5 ms (36 fps) → 29.0 ms (35 fps) and 29.4 ms (34 fps) → 30.8 ms (33 fps). The worst street case is about +14% (rua_leste at 17:30, 31.3 → 35.6 ms). These are the same headless run, not a handset's real frame rate. Objects went from 488–848 to 674–1081. The probe does not report draw calls.

## Tap-to-walk and street framing polish (#154, 2026-10-08)

The Opus pass over #127 (tap to walk, joystick gone) and #134 (full-screen street framing). Shots: `docs/lifesim/shots/opus-polish/tap-walk-framing/` (`node scripts/tap-walk-shots.mjs --phase=after`), at 1280×800, 390×844, 1920×1080 and an 844×390 landscape phone.

- **Tap feedback (`render/pixel/tapMark.ts`).** A floor tap pops a white pixel ring on the tile, which settles and stays until the avatar gets there. A tap on a person, a stall, a door, a sign or a seat puts the ring in gold on the tile the avatar walks to, so "go and do something" reads apart from "go there". A tap where nobody can stand (a planter, a wall, a tile with no path to it, or the town drawn around the map) shows a red cross that shakes once and fades, and sends nothing. The art is baked into small textures and drawn as an Image over the world: live Graphics blurred across two device px at half-pixel camera scrolls, and on the ground the ring hid behind the bench in front of the tile. Reduced motion drops the pop and the shake.
- **Tap, hold and drag (`tapGesture.ts`).** A mouse click is unchanged. A finger lifted within 10 px is a tap. A finger dragged past that, or held still on the floor for 320 ms, steers: the avatar walks toward the finger and follows it, at most one `move` every 150 ms and only when the tile under the finger changes (so still the same server `move` messages, D4). A hold on a person or a door is still a tap when released. A second tap on the tile the avatar is already walking to sends nothing, because a new `move` restarts the path from the server's tile, which looked like a small pop backwards.
- **Camera.** The follow keeps its own unsnapped centre and only what is drawn is snapped to device px. Before this, the snapped centre was fed back into the follow: steps under half a device px were rounded away every frame (a dead zone), then the camera jumped once the gap grew. A walking avatar is placed on device px instead of whole art px, so it no longer shakes against the street at zoom 3–4. Standing avatars stay on the art grid. The outdoor clamp has a 2-tile soft knee (`softClamp`, quadratic, so position and speed stay continuous). It never shows past the map, and on the north sidewalk the view can sit up to 8 px under the sky margin's top.
- **Surround reach.** The 8-tile prop reach is now a floor. `surroundReachFor` works out how far past the map the window can see at its zoom, adds a tile, and rounds up to a multiple of 4, capped at the 24-tile ground. Phones keep 8. A 1920×1080 or 4K desktop gets enough that the place where the props stop is off screen. The surround is rebuilt only when the window grows past what it was built for, never every frame or when it shrinks. The sprites are still static, with no shadow casters and no lamps.
- **HUD insets.** These now follow the HUD's own compact query (`(max-width: 640px), (max-height: 520px)`, `hudInsets`). A portrait phone keeps 124 px at the top for the strip and tracker pill, and 72 px at the bottom for the chat bar. The old 168 px was leftover joystick space. A landscape phone keeps 60/64, so most of its 390 px height is street, where it used to get the desktop 64/110.
- **Perf against main.** `scripts/perf-areas.mjs` (headless, software GL, so the frame times are only good for comparison). Scenes praça 16,16 / rua 12,9 / rua_leste 8,7 / feira 4,8, chuva at 17:30 and 19:30. Phone 390×844, average ms, main → this branch: praça 105.1 → 105.9 and 109.9 → 110.0; rua 95.2 → 98.5 and 128.9 → 125.6; rua_leste 88.8 → 86.8 and 97.4 → 99.6; feira 73.3 → 72.7 and 91.5 → 90.4. Object counts are within ±3. Desktop 1280×800 is within noise too (for example rua_leste 248.8 → 253.2, feira 214.5 → 212.7), with 2–3 more objects.

## Leaderboards in the Praça (2026-10-08)

Jonny (via TB Brainstorm): two live boards, visible in the world, not buried in a menu.

- **Most Words Learned.** Score = diary length (`normalizeDiary(p.diary).length`). Pure effort; safe to rank.
- **Highest Current Streak.** Score = Escola `currentStreak` for America/São_Paulo today. Reuses the #132 streak; no parallel tracker. Belts, nameplates and stripe pace are untouched.
- **Surfacing.** A `props/placar` board in the Praça (`placar_vila`, action `leaderboard`) — tap to open the full list. The Padaria counter NPC (Seu Carlos / Dona Graça) occasionally mentions the #1 streak holder by display name when you enter the padaria (at most once per player per São Paulo day, ~1 in 4 enters); the line is unvoiced because the name is dynamic.
- **Rules.** Display names only. Ties share a rank (1, 2, 2, 4). Top 10 plus your own row if you are outside. Server-authoritative; the client refreshes on open and every 15 s while the panel is up. Free beta: no purchases or real-money rewards on either board. Chat is never rewritten.
- **Code.** `packages/shared/src/leaderboards.ts` (pure rank), `apps/server/src/leaderboards.ts`, client `apps/client/src/ui/leaderboards.ts`. Shots: `docs/lifesim/shots/leaderboards/`.

## Feira cart games: Caldo de cana (2026-10-08)

Caldo de cana is the third slot in the same rotation (`tapioca`, `pastel`, `caldo`). A day whose game is switched off falls back to the previous game that is both built and switched on.

- **Off until an admin turns it on.** Cart games use the rotation registry (`off` | `on` | `rotation`, default off). The admin panel lists one switch per id in `FEIRA_ROTATION_ORDER`, so Caldo is `admin-feira-caldo` and starts off. Turning only Caldo on features it every day. A start is refused with `feira_closed` while the cart is closed. Solo screenshots call `__tb.enableFeiraGame('caldo')` before opening the cart.
- **Play.** Load cane, turn the lever, catch the juice under the spout (a miss spills into a puddle), pump the flavor, add gelo when the order asks, and serve before the customer leaves. Several orders wait at once. A second crank while the press is already full overflows it. A wrong flavor, missing ice, or a spill costs points and annoys the customer; it does not end the run. Drag is pointer events (mouse and touch) with a click-click fallback. The stall DOM is built once and updated in place.
- **Orders and score.** `caldoOrders(seed)` is pure. Lines are bilingual, for example "Um caldo de cana com limão, com gelo, por favor." / "A sugarcane juice with lime, with ice, please." Flavors: limão, abacaxi, maracujá, gengibre, hortelã, laranja, abacaxi com hortelã. The server recomputes the score and keeps the same 500 cap, 8–20 RV band, +5 flawless (25), and 3 paid runs a day. Beta stays free. Chat, belts, nameplates, and stripes are untouched.
- **Code.** `packages/shared/src/feiraCaldo.ts`, `apps/client/src/ui/feiraCaldo.ts`, `apps/client/src/styles/feiraCaldo.css`. Shots: `docs/lifesim/shots/feira-games/` (`play-*-caldo-*`).

## Admin Testes (2026-10-08)

The credits admin panel has a Testes section for the signed-in admin's own profile (or one username). It reuses the existing password check (`s.admin` after `adminPasswordMatches`). Nothing in it is shown to a normal player, and every action is refused until that check passes.

- **testUser.** A boolean on the profile, set when a Testes action writes the profile, including the personal clock and a day roll. A teleport does not write the profile and does not set the flag. The public words and streak boards (`Leaderboards.rebuild` and `entriesFromProfiles`) skip `testUser` before they rank. The Feira cart board does the same: a test profile's runs are not written into the public scores, they cannot hold the Fada da Feira crown, and they are left out of the top 3 and of the permanent medals. Their paid-run count lives on the profile (`testFeiraPaid`), so resetting their cap does not touch the public board. A side table of touched ids would not survive a restart; the flag does.
- **Belts.** Wins stay the source of truth (`normalizeBjj` / `BELT_LADDER`). Picking a belt or a stripe count writes the win total that rank already means (white 5, blue 10, purple 20, brown 40, black 80; four stripes, then promote). Brown at 140 wins can found an academy; 139 cannot. The grip-fight protocol is untouched.
- **Public belt.** The overhead belt is still the gi, or the academy uniform. A Testes belt change updates that profile's HUD, and that player's own screen can show the belt. It does not put a belt on other players who are not wearing a gi.
- **Verde.** Verde mode forces the plate the HUD and the nameplate show to Verde. `escola.tier` is kept and comes back when the mode is off.
- **Day roll and the Testes clock.** These apply only to the targeted profile. `testDayOffset` is a whole number of calendar days added when that profile's daily keys are computed (Feira paid runs, escola lesson RV, correria, conversa, pedido, cartela, the bond cap). `testClockOffsetMs` moves only that profile's sky and errand board. Neither one changes `clockOffsetMs`, the shared neighborhood clock, anyone else's caps, or the public Feira day. A day roll does not call `rollBoard` and does not mint medals. The existing Admin "Horário" control is still the shared neighborhood clock.
- **Not in this change.** Billing, the Lemon Squeezy webhook, learning content, and chat moderation.
- **Shots.** `docs/lifesim/shots/admin/`.


<<<<<<< HEAD
## Mapa: one big illustrated map (#173, 2026-10-08)

The Mapa panel is now one pixel-art map of Vila Ipê. The named room cards and the per-area minimap tabs are gone (`ui/minimap.ts` was removed).

- **Each place is the button.** Aeroporto, Edifício Ipê (kitnet), Padaria, Academia, Escola, Rua dos Ipês, Rua dos Ipês (leste) with the 875 bus stop, Praça (fountain, ipês, the puleiro) and Feira are each drawn as their own place. Hover or keyboard focus lifts a place, makes it glow and shows "PT · EN". The label is the room's own `name` and `gloss` from the shared room list.
- **Travel rules unchanged.** A click sends the same `join` the old cards sent: the server's existing fast travel, with no new teleport rules. On touch, the first tap lifts the place and shows "Toque de novo para ir · Tap again to go", and a second tap travels. Tapping the place you are already in closes the map.
- **Room ids.** `ROOM_ON_MAP: Record<RoomId, …>` in `ui/townMapData.ts`, so a new RoomId does not compile until it is placed. `andar` (a player academy's floor) is `{ via: 'academia' }`: it is not its own button, and "você está aqui" shows on the Academia.
- **Você está aqui.** A bobbing pin with "Você está aqui · You are here" on your current place.
- **Coming soon.** Praia (sea, sand, a coconut kiosk, parasols, a boat) and Fazenda (barn, fence, animals, fields) sit on the map edges. They are desaturated under a pixel fog, with an "Em breve · Coming soon" ribbon. Tapping one shows a small bilingual teaser and never travels. Copy is marked `needs_br`. The teaser is not spoken, so it needs no TTS.
- **Screens.** Desktop: the map fits the window at about 3.6× (1280×800). Phone: a full-screen sheet where the map fills the height (about 3.4 px per art pixel, so every place is at least 44 px) and pans sideways, starting centred on you.
- **Shots.** `docs/lifesim/shots/map-redo/`, from `scripts/map-redo-shots.mjs`. The script also checks that a click on every place joins that room and that Praia and Fazenda never travel.
=======
## Feira cart polish (2026-10-08)

One cart look for Tapioca, Pastel and Caldo de cana (#149). Display only: the server still scores every run (500 cap, 8–20 RV, 25 flawless, first 3 runs a day pay), and every game still ships off in the admin registry.

- **The cart names its game.** The world cart has a sprite per game (`props/carrinho_feira` TAPIOCA, `props/carrinho_feira_pastel` PASTEL, `props/carrinho_feira_caldo` CALDO DE CANA), each with its own counter props and awning colours. `feiraRoomFor(room, cartSnapshot)` hides the cart when nothing is featured and otherwise swaps in the featured game's sprite, so a Pastel day never shows the TAPIOCA plaque.
- **Room fixes.** The x21 lamp (`lampada_f3`) moved to x26: it stood in front of the cart and covered the plaque. Free stall slots show a slate chalked VAGA (`feira/vaga`) instead of a blank cream board.
- **Stall kit.** `ui/feiraStall.ts` + `styles/feiraStall.css`: a cart roof (FEIRA plate, the game's banner, a scalloped awning), counter props, an order ticket (icon of the order) on each customer, a freguesia meter in the HUD (starts in the middle; each served customer moves it right, each one who leaves moves it left), floating +pts and "Foi embora", and shakes on a torn or stuck flip, a fire, a spill or an overflow. Tapioca's flip meter and Pastel's fry meter show the sweet spot (`feiraMeterWindow`); Caldo pops when a cup is full.
- **End card.** Stamped with ground gained or lost from served vs. left (`feiraEndTier`: Barraca lotada!, Ganhou freguesia, Freguesia na mesma, Perdeu freguesia). Score, RV, best and place are the server's numbers.
- **Code.** `packages/shared/src/feiraStall.ts` (+ tests), `apps/client/src/ui/feiraStall.ts`, `apps/client/src/styles/feiraStall.css`, `apps/client/assets-src/custom/v2props.mjs` (`feiraGameCart`), `apps/client/assets-src/custom/feira.mjs` (`vagaSign`).
>>>>>>> 902769208 (Feira cart e2e checks the PASTEL plaque; decisions; Chrome path)
