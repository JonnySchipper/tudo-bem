# Praia: the beach room, fishing, boats and the party boat

**Status:** implementation plan, written 10 Oct 2026 by the Fable planner for issue #235. Jonny: "Do the beach plan from TB Brainstorm. Fishing, boats, everything." He is starting it now, which overrides the "not until December" note in `docs/brainstorm/beach-fishing.md`.
**Implementer:** one Claude Opus PR on a branch off `main`, following the build order in section 10. Steps that are too big for the PR are marked **Later** and collected in section 11.
**Sources:** `docs/brainstorm/beach-fishing.md` (the spec), `docs/brainstorm/events-requirements.md` (exclusive words), `docs/lifesim/DECISIONS.md` ("Mapa: one big illustrated map (#173)" and "Split into areas"), `docs/lifesim/HOWTO.md` (locked decisions D1 to D12, the art bible, the beauty checklist), `docs/VOICES.md`, `docs/SQLITE.md`, `docs/ADMIN.md`, `CLAUDE.md`.

## 0. Locks (do not reopen)

- **Learning is free.** No word, fishing spot, lesson or Escola review sits behind the subscription. The subscription's "Prévia da Praia" perk is only an early-access window the admin can switch on (section 1.2); it never gates a word.
- **RV is earned only.** Boats are rented with RV, fish are sold for RV, nothing is sold for real money. No RV is sold.
- **Chat text is never altered.** The party boat is an ordinary server `Instance`, so chat goes through `World.chat()` unchanged: `classify`, then `broadcastFrom`, verbatim or not delivered.
- **No waving animations anywhere.** No `oi` emote on the beach: not on the lifeguard, not on the CPUs on the towels, not on the party deck, not in any catch celebration. Celebrations use `rir`, `valeu` and `dancar` only.
- **No math in games.** The fishing stage shows no digits: no timer, no score, no points, no percentages. Size is a word (pequeno, médio, grande, enorme). The only numbers the player sees are prices and the RV they receive at the barraca, which is commerce, the same as the hat stall.
- **Each event gets its own reusable word list.** The beach, each boat tier, the lagoa and the party boat each have their own list (section 4.3), exported as data so the fishing tournament (later) can reuse it.
- **Feira carts stay off by default.** Nothing here touches `FeiraCartStore`, `FEIRA_ROTATION_ORDER` or the cart registry.
- **Belts, nameplates and stripes are untouched.** The captain hat is a hat in `EARNED_HATS`, never a plate or a belt.
- **Family-room safe.** A festa on the boat is music, food and friends. No alcohol anywhere, including on signs, menus and in the fish-selling lines.
- **Brazilian Portuguese only**, with English glosses. Every new PT string is `needs_br` and listed in `docs/lifesim/BR-REVIEW.md` (new section W).
- **Never deploy, never push to `main`.** Open a PR.

## 1. The Praia room

### 1.1 How it is reached

**From the town.** The 875 bus already carries players between `rua_leste` and `aeroporto` through a plain door portal next to the bus shelter (`rua_aeroporto` in `packages/shared/src/rooms.ts`). The beach reuses that exactly:

- `rua_leste` gets a second sign at the shelter: a `cenario` prop `placa_praia` (art `props/placa_praia`, a blue bus plaque reading `875 · PRAIA`) at `(5, 12)` in `packages/shared/layouts/rua_leste.json`, and a portal
  `{ id: 'rua_praia', x: 5, y: 12, to: 'praia', arrive: { x: 3, y: 4 }, arriveDir: 'SW', doorAt: { x: 5, y: 12 }, label: { pt: 'Ônibus para a Praia', en: 'Bus to the beach' } }` in `ruaLeste.portals`.
- The Praia's own bus stop (a `ponto_onibus` prop at `(2..4, 2)`) has the return portal
  `{ id: 'praia_vila', x: 3, y: 3, to: 'rua_leste', arrive: { x: 7, y: 13 }, arriveDir: 'SW', doorAt: { x: 3, y: 2.5 }, label: { pt: 'Ônibus para a Vila', en: 'Bus to the Vila' } }`.
- The hotspot `ponto_onibus` text in `hotspots.ts` becomes `ÔNIBUS\nLinha 875 · Centro · Aeroporto · Praia` (needs_br). The airport tutorial's `onibus` step is untouched: it still completes on the `aeroporto → rua_leste` room change (`main.ts` `offTheBus`).
- Like the airport ride, the trip is a `join`. No cutscene in this PR (section 11 lists a short bus-window fade as later polish).

**From the map.** `apps/client/src/ui/townMapData.ts`:
- `SoonId` becomes `'fazenda'` only. Remove the praia entry from `SOON_SPOTS` and `SOON_AT.praia`.
- Add `praia: place('praia', [[SOON_AT.col * MAP_T, 20 * MAP_T, (MAP_COLS - SOON_AT.col) * MAP_T, 10 * MAP_T]])` to `ROOM_ON_MAP` (the same corner it occupied as a teaser, so the picture does not move). `ROOM_ON_MAP` is a full `Record<RoomId, …>`, so this is the compile error that proves the room is placed.
- `townMapArt.ts` `groundForMap()`: the fogged teaser patch becomes a real small picture of the beach drawn from the praia layout (sand, the kiosk, two umbrellas, the pier head, water), the same way the other areas are drawn from their layouts. Keep the Fazenda fogged.
- `townMap.ts` help copy becomes "Tap a place to go there. Fazenda is coming soon." (the PT ribbon text stays for the Fazenda).
- `townMapData.test.ts`: the travelable-room list gains `praia`; the `SOON_SPOTS` assertion becomes `[fazenda]`.
- `scripts/map-redo-shots.mjs`: the "Praia never travels" check flips to "Praia travels", Fazenda still never travels.

**Closed state.** When the admin mode (section 1.2) is `closed`, the map shows the praia as "Em breve" again (the `MapSpot` gets `room: null` and the old teaser text at runtime from `game.world.praia`), and `World.join('praia')` answers `this.err(s, 'praia', 'A praia ainda não abriu.', 'The beach is not open yet.')`. The bus sign portal gives the same error.

### 1.2 Open, preview, closed

A new kv singleton, the same shape as the feira cart blob (`FeiraCartStore` in `apps/server/src/feiraCart.ts`, SQLite row `praia`, `id = 'state'`):

```ts
// packages/shared/src/praia.ts
export type PraiaMode = 'open' | 'preview' | 'closed';
export interface PraiaConfig { mode: PraiaMode; partyBoat: boolean; }
export const PRAIA_DEFAULT: PraiaConfig = { mode: 'open', partyBoat: true };
export function praiaAllows(cfg: PraiaConfig, sub: PlayerSubscription | null | undefined, now: number): boolean {
  if (cfg.mode === 'open') return true;
  if (cfg.mode === 'preview') return isPreviewUnlocked({ subscription: sub }, 'praia', now);
  return false;
}
```

- `PREVIEW_FLAGS.praia` in `subscription.ts` finally gets a reader: `praiaAllows` in `preview` mode. `ui/support.ts` line 62 keeps its perk row; its text becomes "Prévia da Praia: entre antes de todo mundo quando uma prévia estiver aberta." (needs_br).
- Default is `open` because the beta is free and Jonny is launching now. The dashboard can set `preview` for a founders-first day, or `closed` to pull the room (section 8.5).
- `RoomStateMsg` is not changed for this; the client learns the mode through a new `{ t: 'praia'; phase: 'mode'; mode: PraiaMode; partyBoat: boolean }` message sent in `attachProfile` and broadcast on change (the `cartMsg()` pattern in `adminFeiraCartSet`).

### 1.3 Layout

New room id `praia` (`RoomId` in `packages/shared/src/types.ts`), `outdoor: true`, `lighting: 'tarde'`, `private: false`, `40 × 28` tiles, `spawn: { x: 3, y: 4 }` (the bus stop). The fictional beach is **Praia do Jerivá**, on the litoral paulista (Santos/Guarujá feel, never Rio: no Copacabana wave). The room's `name` is `'Praia'`, `gloss: 'Beach'`, so the map label and the HUD stay short; the sign on the calçadão says the full name.

Three new floor chars in `FLOOR_CHARS` / `FloorKind`:

| Char | FloorKind | Walk | Art (`custom/floors.mjs`, the granilite `z` pattern) |
| --- | --- | --- | --- |
| `s` | `areia` (sand) | yes | warm pale sand, 2 to 4 fill variants with sparse footprint and shell specks, 16 mask tiles with a soft lit lip |
| `o` | `agua` (sea water) | **no** | two-tone teal with a 1 px lighter ripple every 3rd row; 16 mask tiles whose edge against sand is a foam line |
| `b` | `deque` (wooden deck) | yes | grey-brown planks running east-west with 1 px gaps; used for the pier and every boat deck |

`buildGrid` (`rooms.ts`) blocks `o` the way the HOWTO's `w` was meant to be blocked; add a unit test ("water is never walkable, sand and deck are"). `floorAt` returns the new kinds, so footsteps (`ambience.ts`) get a `areia` soft crunch and `deque` a hollow wood tap.

The floor plan (the implementer paints it with `floorGrid`, then refines props in design mode; coordinates are the starting point, not a lock):

```
y 0-1   a   Avenida Beira-Mar: asphalt, traffic lanes (ambientData street, cars only, no bus sprite: the bus stop is a portal)
y 2-3   c   Calçadão: bus stop x2-4 (portal back), lamp posts every 8, lixeiras, the big sign "PRAIA DO JERIVÁ", a bike rack, benches facing the sea
y 4-5   s   Dune strip: jerivás and coqueiros, restinga hedges (sebe), a low wooden fence (cerca) with gaps at x3-4, x12-13, x24-25, x30-31
            Barraca da Jô (quiosque de coco) x6-8 y4-5 (3x2, thatched roof overhead), interact (7,6)
            Posto de salva-vidas (lifeguard tower) x20-21 y4-5 (2x2, lightAtNight), ladder tile (21,6), nobody waves from it
            Galpão "BARCOS DO BENTO" x26-29 y3-5 (4x3 shack with plaque), Bento at (28,6), interact (28,7)
y 6-17  s   The sand: 7 umbrellas (guarda_sol_a/b/c with overhead canopy) each with a towel decal and a beach chair, 2 sand castles (decal),
            a frescobol pair of CPUs, the vira-lata's cousin (a sleeping beach dog, later), a coconut-shell bin
            Lagoa pocket x1-6 y8-12: ring of `o` inside sand with pedras (rocks) on its north bank and a `pesca_spot` on the south bank
            Dona Neide's bench (25,12) by the pier root, her bucket and rod props beside it
y 18    s   The shore row: `fx/onda_*` foam strips animate on this row (section 1.5); two `pesca_spot` props at (10,18) and (16,18) face south
y 19-27 o   The sea. The pier: `b` from (28,12) to (29,25) (2 wide), posts along both edges, a lamp at (28,18) and (28,24), railings overhead
            Boats moored along the pier, each a prop plus `b` deck tiles under it (the only walkable water):
              barco_remo      x30-31 y16     (2x1)  pesca_spot tier 'remo'     seat on (30,16)
              barco_pesca     x30-32 y19-20  (3x2)  pesca_spot tier 'pesca'    stand on (31,20)
              barco_alto_mar  x30-33 y22-23  (4x2)  pesca_spot tier 'alto_mar' stand on (32,23)
              barco_festa     x23-27 y22-24  (5x3)  action 'party_boat' from the pier tile (28,23): boarding goes to the barco_festa room
x 34-39     Costão: rocks (cenario, blocks) from the dune to the water, gulls perch here
x 0         West edge: hedges and the fence; no open border tile (the surround test needs this)
```

Rules the implementer keeps (from the HOWTO beauty checklist and the praça tests): a 2-tile walkable lane from the spawn to every door, NPC and `interact` tile (add the `findPath` test the praça has); no empty 4×4 sand without a detail (shell decals, driftwood, footprints decal); edges are never open void.

**Props.** New `PropKind` values (add each to `KINDS` in `layout.ts`, or design-mode saves are rejected, and to `render/pixel/props.ts`):
`quiosque_praia`, `guarda_sol`, `cadeira_praia`, `posto_salva_vidas`, `galpao_barcos`, `barco`, `pesca_spot`, `pedras`, `canoa`. Umbrellas and the kiosk roof are `overhead` parts (the barraca-de-chapéus split pattern in `custom/stall.mjs`). `pesca_spot` is a 1×1 non-blocking prop with `action: 'pesca'`, an `interact` tile and a new optional `PropDef.water: WaterId` (section 3.1); its art is a small "PESCA" stake on sand and a bollard with a rope on decks. `barco` props carry `art` per tier and `blocks: false` so the deck tiles under them stay walkable (the sprite's hull pixels sit over `o` tiles, which block by terrain).

New `PropAction` values: `'pesca'` (open the fishing stage), `'boat_rental'` (Bento's menu), `'party_boat'` (board or create a trip), `'fish_sell'` (Jô's "Compro peixe"), `'beach_shop'` (Jô's snacks and hats). Add to `ACTIONS` in `layout.ts` and to `propAction` in `apps/client/src/main.ts`.

**Signs** (`hotspots.ts`, each one reading word is in the diary catalog): `PRAIA DO JERIVÁ` (the calçadão sign), `BARCOS DO BENTO · Aluguel` (the shack plaque), `SALVA-VIDAS · Posto 1`, `BARRACA DA JÔ · Água de coco · Queijo coalho` (prices on the board), `PERIGO · Correnteza` on the costão, `PROIBIDO PESCAR AQUI` by the lifeguard (a joke the mentor explains), `PÍER` at the pier root.

**Layout file.** `packages/shared/layouts/praia.json` `{ "room": "praia", "objects": [...] }`, imported in `roomLayoutFiles.ts` `FILES`; `RoomDef.props = bundledObjects('praia')`. The implementer authors it by hand first, then opens `/?design=praia` and uses design mode to nudge, and commits the serialized file (key order from `KEY_ORDER`).

**Every list a RoomId must be added to** (from the research; each is a compile error or a failing test when missed):

| Where | What |
| --- | --- |
| `packages/shared/src/types.ts` `RoomId` | add `'praia'` and `'barco_festa'` (section 5) |
| `packages/shared/src/rooms.ts` `ROOMS` | both RoomDefs |
| `packages/shared/src/roomLayoutFiles.ts` | both JSON imports |
| `apps/client/src/render/pixel/roomLayout.ts` `WALL_STYLE` | full Record: `praia: 'none'`-style outdoor entry, same for `barco_festa` |
| `apps/client/src/ui/townMapData.ts` `ROOM_ON_MAP` | `praia` as a place; `barco_festa: { via: 'praia' }` |
| `scripts/build-curriculum.mjs` `RECADO_ROOM_IDS` and `RECADO_NPC_IDS` | the new rooms and NPC ids (`curriculum.test.ts` checks drift) |
| `apps/server/src/feedbackStore.ts` `ROOMS` | so feedback from the beach keeps its room |
| `packages/shared/src/adminTestes.ts` `ADMIN_TEST_ROOMS` | admin teleport |
| `apps/client/src/main.ts` remembered-room list (`tb_last_room`) | add `praia` only (a party deck is never remembered; a reconnect lands on the pier) |
| `apps/client/src/ui/wayfinding.ts`, `vilaGuideData.ts` | the place lists |
| `packages/shared/src/playerPadaria.ts` `CHEF_HAT_SOCIAL_ROOMS` | add `praia` (the founder hat is worn on the beach too) |
| `scripts/lib/areas.mjs` `AREA_EDGES` | `praia` is reached by the bus portal, not an edge; add a `goPraia(page)` helper that clicks the sign portal |
| `apps/client/src/ui/escola.ts` `UNIT_ORDER`, `AREA_IN`, `GAME_HINT` | the Praia chapter (section 4.4) |
| `apps/client/src/ui/journalView.ts` `CHAPTER_STYLE` | the Praia chapter colour and emblem |

### 1.4 Day, night, weather

- The room is `outdoor`, so `dayNight.ts` follows the live 48-minute clock automatically, and `weatherFx.ts` rains on it. Nothing to write for the grade.
- **Lights at night** (`lightAtNight: true` on the props, presets in `lightPresets.ts`): the lifeguard tower lamp, the two pier lamps, the kiosk string lights (warm), the shack window, the party boat's bunting bulbs. Golden hour over water is the signature shot: `sceneryV2.ts` gets a `praia` entry with a `sunPath` decal strip on the water (the sun's reflection, drawn only 16:30 to 18:30, same hours as the grade's golden keyframes).
- **Weather** is global (`weatherAt`). On the beach: `garoa` and `chuva` close the umbrellas (a closed sprite variant, the feira stall `closed` pattern via `feiraRoomFor`-style swapping in `WorldScene.buildProp`; if this costs too much, Later), send the CPU beachgoers under the kiosk roof (`ROOM_AMBIANCE.praia.rainSpots`), and the fishing sim gets `weather` as an input: rain shortens the wait and raises the common-fish share (section 3.4). `nublado` does nothing visible beyond the grade.
- **Tides and hours** are flavour only in this PR: Dona Neide's lines mention the maré; the sim gets `minute` so night casts lean to sardinha and bagre, and dawn (05:00 to 07:00) is the best robalo hour. No tide table UI.

### 1.5 Ambience and sound

- **Sea motion.** `render/pixel/sea.ts` (new, small): on each shore tile (an `s` tile whose south neighbour is `o`), place a 3-frame foam strip sprite `fx/onda_0..2` at 2 fps, phase-offset by column so the foam rolls. Over the whole `o` region, lay one `WaterFx` caustic overlay (reuse `waterMath.causticAt` and `waterMask` from `water.ts`; mask from the terrain layer's own pixels, which are teal, so the existing blue/teal detector works). Night: the same ripples glow faintly under the pier lamps. Budget: at most 40 foam sprites and one caustic texture; `?lowfx=1` drops the caustics.
- **Living things** (`render/pixel/ambientData.ts` `AMBIENT.praia`): a gull flock (`flock.mjs`, a white/grey recolour of the pigeon flock, wings a touch longer) that lifts off from the costão when a player walks within 2 tiles; crabs on the shore row at night only (1×1 critter, 2 frames, 3 at most); CPU beachgoers (`packages/shared/src/ambiance.ts` `ROOM_AMBIANCE.praia`: spots on the towels, at the kiosk, on the calçadão benches; `cpuTarget` 3, thinning as humans arrive); a frescobol pair that bats back and forth (two CPUs in `frescobol` idle poses, no new animation needed beyond a 2-frame swing; **no waving**).
- **Audio zones** (`apps/client/src/audio/zones.ts`): add `waves` and `gulls` to `ZoneMix`; sources in `AMBIENT.praia.audio` (waves along the shore row, loud at the pier end, gulls on the costão by day, crickets on the dunes at night, rain as usual). Synthesized in `audio/synth.ts` like the fountain: pink noise through a slow LFO lowpass for waves, short filtered chirps for gulls.
- **Music bed.** This PR maps `praia` and `barco_festa` to the shared outdoor bed in `ambience.ts` `target()` (the same `'praca'` bed the three areas use), with the waves zone mixed up so the beach sounds like itself. A beach bed of its own ("Maré Mansa", the theme as a slow bossa cousin, and a festa arrangement for the party deck) is **Later**, composed with the `compose-music` skill through `docs/audio/COMPOSING.md` §3.
- **Fishing sounds** are new synth stingers in `apps/client/src/audio/pescaSfx.ts` (the `boutSfx.ts` pattern, measured by `scripts/audio-lab.mjs sfx`): cast whoosh, plop, nibble tick, the "Fisgou!" sting (a short rising fifth on the hook's own pitches), reel ratchet while holding, a creak as tension rises, line snap, splash, catch jingle (the theme's hook on vibes, two bars), the trophy fanfare (the win stinger plus a surdo). Levels in `audio/mix.ts`.

### 1.6 Art plan

Rules: D6 (art from files, never from code), one pixel density, LimeZu outline convention, the brand palette plus sea teal `#3FA9A0` and sand `#EBD9A8` (add both to `docs/art/palette.md` as beach tokens). Everything new is authored in `apps/client/assets-src/custom/praia.mjs` (one generator file, like `aeroporto.mjs`) with an `import-map.d/praia.json` fragment, then `pnpm pixel`. `art3.test.ts` fails until every floor char and prop key resolves.

**Already in the manifest (reuse):** `props/jeriva`, `props/jeriva_b` (palms), `props/carrinho_coco` (the coconut cart, now parked at Jô's), `decals/areia_pg`, `decals/toalha_azul`, `decals/toalha_amarela`, `diary/toalha`, `props/ponto_onibus`, `props/poste*`, `props/lixeira*`, `props/banco*`, `props/bandeirinha` (bunting), `props/cerca_*`, `sebe/*`, the fountain caustic helpers, the pigeon flock as the gull base, the LimeZu "STORE" shopfront as the shack base (plaque rewrite with the 3×5 font, the shopfront pattern in `derive.mjs`).

**New pixel art (footprints in tiles; sprites may be taller):**

| Key | Size | Notes |
| --- | --- | --- |
| terrain `s`, `o`, `b` | 16-tile mask sets | `custom/floors.mjs`, see 1.3 |
| `fx/onda_0..2` | 16×6 strip | foam roll, 3 frames |
| `praia/quiosque_coco` + `_telhado` (overhead) | 3×2 | thatched kiosk, counter with coconuts, a chalk board, string lights lit overlay |
| `praia/guarda_sol_a/b/c` + `_copa` overhead | 1×1 | striped (terracotta/cream, mustard/cream, sp-green/cream); `_fechado` closed variant |
| `praia/cadeira_praia` | 1×1 | folding chair, 2 colours |
| `praia/posto_salva_vidas` | 2×2 | wooden tower, red flag, lamp (lit overlay); the guard is a CPU look (`NPC_STYLES` entry `salva_vidas`, red shorts, **idle `bracos`, never `oi`**) |
| `praia/galpao_barcos` | 4×3 | the shack, "BARCOS DO BENTO" plaque, a life ring, oars on the wall, lit window |
| `praia/pier_poste`, `praia/pier_grade` (overhead rail), `praia/pier_fim` | 1×1 | pier furniture; the deck itself is terrain `b` |
| `praia/barco_remo` | 2×1 | rowboat, oars shipped |
| `praia/barco_pesca` | 3×2 | white and blue hull, cabin, nets, a mast with a pennant |
| `praia/barco_alto_mar` | 4×2 | bigger hull, radar dome, rod holders |
| `praia/barco_festa` | 5×3 | two decks, bunting, speakers, a grill (churrasco, no bar) |
| `praia/canoa` | 2×1 | a caiçara canoe pulled up on the sand (decor, a camera word) |
| `praia/pedras_a/b/c` | 1×1 to 2×2 | rocks for the costão and the lagoa bank |
| `praia/pesca_stake`, `praia/pesca_bollard` | 1×1 | the two spot markers |
| `praia/placa_praia`, `praia/placa_jo`, `praia/placa_perigo`, `praia/placa_proibido` | 1×1 | painted signs (`font5.mjs`) |
| `praia/rede_secando`, `praia/balde`, `praia/vara_apoiada`, `praia/castelo_areia` (decal), `praia/concha_*` (decals), `praia/madeira_mar` | 1×1 | sand detail and Neide's kit |
| `critters/gaivota_*`, `critters/caranguejo_*` | 1×1 | gulls (fly/perch), crab (2 frames) |
| `icons/peixe_<id>` × 14, `icons/queijo_coalho`, `icons/picole`, `icons/concha` | 16×16 | fish and snack icons, `icons.mjs` |
| `carry/queijo_coalho`, `carry/picole`, `carry/palito_vazio`, `carry/palito_picole` | held items | the `carry.ts` pattern |
| hats `chapeu_pescador` (bucket hat), `viseira` (visor), `chapeu_capitao` (captain's cap) | character layer | `hats.mjs` plus a draw recipe in `render/pixel/characters.ts` |
| `pesca/fundo_praia`, `_lagoa`, `_remo`, `_pesca`, `_alto_mar`, `_festa` | 320×180 | the fishing stage backdrops (section 2.2); horizon, water bands, boat foreground, rod |
| `pesca/boia_*`, `pesca/vara_*`, `pesca/splash_*`, `pesca/peixe_sombra_*`, `pesca/peixe_<id>` (the catch, 32 px) | stage sprites | drawn by `custom/pesca.mjs` |
| portraits `bento`, `neide`, `jo` × 4 expressions | 64×64 | automatic from the composed sprite (`portraits.mjs`) |
| `furniture/concha_grande`, `furniture/prancha`, `furniture/rede_pesca_parede`, `furniture/boia_parede`, `furniture/garrafa_mensagem` | kitnet items | both rotations, `kit.mjs` |

Gulls, crabs, the frescobol swing and the foam are the "3 moving things" the outdoor checklist wants, plus the caustics and the CPUs.

## 2. The fishing minigame

### 2.1 Feel

Stardew's hook, none of its bar. The whole loop is **hold and let go**. Three beats, each taught by doing on the first try, with the Caldo cart's "Solta!" label trick instead of instructions:

1. **Lançar (cast).** Press anywhere on the water and hold. A power arc swells and shrinks under the rod tip (a sine, 1.6 s period). Let go to cast; the bobber flies to where the arc was. Far casts lean toward the rarer part of the pool (the sim's `power` input), shown only as three faint rings on the water (`perto`, `meio`, `longe`), never as a number. Hold through two full swells and the line tangles ("Ih, enrolou!", a shake, re-cast for free). The first cast ever shows the label "Segura… solta!" over the arc.
2. **Fisgou! (the bite).** The bobber floats. Between 2 and 9 seconds the fish nibbles once or twice (a small dip, three dots over the bobber, a tick sound). Those are fakes. The real bite plunges the bobber, the rod bends, the word **Fisgou!** slams in, the phone vibrates (`navigator.vibrate(40)` when available) and the sting plays. Tap (or press) inside the bite window (1.2 s; 1.8 s until the player's third catch ever) to set the hook. Early: "Cedo demais!" and the bobber settles (the fish is gone, cast again). Late: "Escapou…". Both are free.
3. **Puxar (reel with tension).** The fish's shadow swims under the surface and pulls in runs. **Hold to reel, let go to let it run.** A ring around the reel (the Caldo flywheel look) fills while you hold against a run and drains when you release; if it fills to the top the line snaps ("Arrebentou a linha!", a crack, the rod springs back). Between runs, holding brings the shadow closer. A run is telegraphed 300 ms ahead by the rod dipping and a tug sound, so a player who watches learns the rhythm in two fish. Trophy fish run longer and harder; a bagre barely pulls. Fights last 3 to 14 s.
4. **Pegou! (the catch).** The fish leaps out with a splash and lands on a card: its name in Portuguese huge, the English gloss under it, its icon, the size as a word (pequeno, médio, grande, enorme) with a small ruler animation and no digits, and "Novo!" with the sticker thump when it is a new species. Then, when it is a diary word, the existing new-word card (`diaryWordQueue`) plays as it does everywhere else. Junk catches (um chinelo, uma lata, uma alga) get their own gag card and a laugh emote. A baiacu puffs up, says "Ih, um baiacu!" and is released on its own (it is never kept or sold).

Controls: mouse (press and release the left button, Space mirrors it), touch (press and release anywhere in the stage, nothing to aim), keyboard (Space for hold, Esc twice to leave). The whole stage is one hit area, so a phone thumb never has to find a button. `prefers-reduced-motion`: no shake, the ring becomes a bar, the leap is a fade.

Juice (all client-side, display only): rod bend with a tween, line as a 1 px quadratic curve redrawn each frame, bobber bob, ripples on the plop, splash particles, water sparkle at golden hour, screen shake on the snap and the trophy, floating bilingual pops (`pop()`), a slow-motion 400 ms on a trophy leap, the catch card dealt in like a sticker. The world stays visible behind nothing: the stage is full screen like the cart games, so the backdrop changes per tier (that is how a rented boat feels farther out).

### 2.2 Client code

- `apps/client/src/ui/pesca/pescaStage.ts`: the stage host. Copy only the four mechanics of `feiraStage.ts` that fishing needs (an integer-zoom canvas filling the window with landscape and portrait zones; one transparent DOM hit layer with `press(down)` for hold; `pop()` bilingual floating text; shake and particles). Do not subclass `FeiraStage`: it is built around customers and a HUD this game must not have. Root `#pesca-root` mounted into `#ui`, `body.pesca-on` hides world labels and guides (the Correria `cr-on` pattern). In DEV it exposes `window.__feiraStage`-style hooks as `window.__tb.pesca` (section 9).
- `apps/client/src/ui/pesca/pescaView.ts`: the game view over the stage. Runs the same pure sim as the server (`pescaStep`) locally for display, records `PescaEvent`s with the stage clock, sends `result` when the cast resolves. `PlayView`-like contract `{ destroy(); showResult(r) }`.
- `apps/client/src/ui/pesca/pescaCard.ts`: the catch card and the gag card. `styles/pesca.css`.
- `apps/client/src/ui/pesca/pescaHowTo.ts` is not a file: fishing has **no** How-to card. The first cast's labels teach it; the "?" button of `howToPlay.ts` gets a `place` card `pesca` (two lines, "Segura pra lançar, solta. Fisgou? Toca. Segura pra puxar, solta quando ele corre.") that opens only from "?" (`autoOpen: false`), so the stage never waits on a card.
- `apps/client/src/ui/pesca/index.ts`: `bindPesca(net)` and `onPescaMsg(m)`, wired in `main.ts` next to `bindFeiraGames`; `propAction('pesca')` sends `{ t: 'pesca', action: 'open', spotId }`.

### 2.3 Shared rules (pure, tested)

`packages/shared/src/pesca.ts` (rules) and `packages/shared/src/pescaSim.ts` (the fight):

```ts
export type WaterId = 'praia' | 'lagoa' | 'remo' | 'pesca' | 'alto_mar' | 'festa';
export type BoatTier = 'remo' | 'pesca' | 'alto_mar' | 'festa';            // praia and lagoa are free
export interface PescaCast { seed: number; water: WaterId; weather: Weather; minute: number; power: number; firstCatches: number; }
export type PescaEvent =
  | { k: 'hook'; ms: number }                 // the tap at the bite
  | { k: 'hold'; down: boolean; ms: number }  // reel press transitions
  | { k: 'quit'; ms: number };
export interface PescaRoll { fish: FishId | JunkId; cm: number; biteAtMs: number; nibblesAtMs: number[]; runs: { at: number; len: number; pull: number }[]; fightMaxMs: number; }
export type PescaOutcome =
  | { kind: 'caught'; fish: FishId; cm: number; sizeWord: SizeWord; trophy: boolean }
  | { kind: 'junk'; junk: JunkId }
  | { kind: 'released'; fish: 'baiacu' }
  | { kind: 'early' | 'late' | 'snapped' | 'escaped' | 'quit' | 'tangled' | 'rejected'; reason?: string };
export function pescaRoll(cast: PescaCast): PescaRoll;                       // mulberry32(seed), pool by water, weather and minute, power bias
export function pescaStep(state: FightState, roll: PescaRoll, holding: boolean, dtMs: number): FightState;  // tension and progress, 50 ms ticks
export function pescaJudge(cast: PescaCast, events: readonly PescaEvent[], elapsedMs: number): PescaOutcome;  // replays the events over the roll
export const PESCA_FIGHT = { tick: 50, holdFill: 0.55, runFill: 1.4, restDrain: 0.9, progressHold: 0.22, progressRunHold: 0.05, driftFree: 0.08, snapAt: 1, caughtAt: 1, biteWindowMs: 1200, biteWindowFirstMs: 1800, tangleMs: 3200 } as const;
```

`pescaJudge` rejects (`rejected`) any event list that is not monotonic, longer than 200 events, has a `hook` before `biteAtMs - 250` (early) or after the window (late), or an `elapsedMs` shorter than `biteAtMs + the shortest fight the runs allow`. Tuning is checked by a simulation test (the `matSim.test.ts` pattern): a "weak" holder (reacts 400 ms late, never releases) snaps on 60% of robalos and lands 90% of bagres; an "average" holder lands 75% of everything but marlim; a "strong" holder lands 60% of marlins. No percentages ever reach the screen.

### 2.4 Server

`apps/server/src/pesca.ts` `PescaEngine` (the `FeiraGamesEngine` shape: injected deps `now, store, reward, pushProfile, err, tileOf, diary, config, pin?`):

- `open`: the player must be within 1 tile of the `pesca_spot`'s `interact` tile in a room that has it (`praia` or `barco_festa`); the spot's `water` must be free (`praia`, `lagoa`) or covered by an active trip of that tier (`profile.pesca.trip`, section 8.1) or the party roster (`festa`). Replies `{ phase: 'spot', spotId, water, canCast: true }`.
- `cast`: makes `seed` from `rng()`, stores `s.pesca = { seq, spotId, cast, startedAt: now() }` on the `Session` (like `s.feiraGame`), replies `{ phase: 'cast', seq, seed, water, weather, minute, power }`. The client derives the same roll. At most one open cast per session; a new `cast` while one is open is refused with `pesca_busy`.
- `result { seq, events }`: `elapsed = now() - startedAt`; `pescaJudge`; then settle: a `caught` outcome adds to `pesca.balde[fish]`, updates `pesca.log[fish]` (count, bestCm, firstAt), grants the species word and any tier words earned by this moment (section 4.3) through `DiaryTracker.onPescaCatch` (a sibling of `onCorreriaWin`), grants the trophy furniture on a first marlim, and replies `{ phase: 'result', seq, outcome, newSpecies, record, words: [...], line: Bilingual }`. The RV is **not** paid here: fish pay when sold (section 7). A rejected result settles as `rejected` and logs once per session.
- `quit`: clears `s.pesca`. Disconnect clears it too.
- Test pin: `TB_TEST_PESCA=1` (and `?pescatest` in solo) makes `pescaRoll` return the pinned roll `{ fish: 'bagre', biteAtMs: 1500, runs: [] }` on the beach and `{ fish: 'robalo', biteAtMs: 1500, runs: [one short run] }` on the rowboat, so the e2e can play in under five seconds. It relaxes nothing else.

## 3. Boats and progression

### 3.1 The tiers (exactly the spec's five, plus the free lagoa)

| Tier | Water id | Where you stand | Stage backdrop | Fish pool (new fish in bold) | Price (proposal) |
| --- | --- | --- | --- | --- | --- |
| Da praia | `praia` | the shore row spots | sand at your feet, the shore, the pier to the right, bathers behind | **bagre, sardinha, baiacu**, junk (chinelo, lata, alga) | free |
| Lagoa (spec option a) | `lagoa` | the lagoa bank spot | still water, reeds, the dune, a jerivá | **tilápia, tambaqui, tucunaré** (the trophy here) | free |
| Barquinho a remo | `remo` | in the rowboat at the pier | gunwale and oars in the foreground, the beach small behind, the pier posts | praia pool + **robalo, tainha** | 15 RV |
| Barco de pesca | `pesca` | on the fishing boat's deck | the deck rail, nets, the cabin, open sea with the coast as a line | remo pool + **garoupa, pargo, corvina** | 40 RV |
| Barco de alto-mar | `alto_mar` | on the big boat's stern | only sea and sky, big swell, the horizon, the rod holders | **every fish** + **dourado-do-mar, atum, marlim** (the biggest sizes roll here) | 90 RV |
| Barco de festa | `festa` | the `barco_festa` room, rails on both sides | the party deck at sunset, bunting, friends' avatars on the rail | alto-mar pool + **garrafa com mensagem** (party-only "catch") | 150 RV, paid by the host |

Decisions taken (flagged in section 12 for Jonny): freshwater is option **(a)**, a lagoa pocket in the same room, because authenticity is a pillar and it costs one water patch; the lagoa is free so tilápia, Jonny's first fish, is on the list from day one. A rental is **per trip**: it starts when you board and ends when you leave the boat or after 12 real minutes (6 game hours), whichever is first; unlimited casts inside it. The party boat trip is 15 real minutes.

### 3.2 Prices against today's economy

From the research, a dedicated player earns about 150 to 200 RV a day (Correria 3 × up to 32, cart runs 3 × 8 to 25, recados 3 × 8 to 15 plus 15, the mission 25, Escola up to 30, Conversa 20, Carlos scenes). A casual one earns 40 to 60. Sinks today: hats 8 to 60, gi 18, furniture 10 to 45, a padaria 900 to 3000.

Proposed rentals: **remo 15, pesca 40, alto-mar 90, festa 150**, with daily fish sales capped at **60 RV** per player (section 7). A rowboat trip pays for itself with four robalos; a fishing-boat trip needs a good trip; the deep-sea boat is a goal worth two or three days of saving and does not pay back in sales (the sale cap sees to it), so the ladder is a sink, not a printer. The numbers are server tunables (section 8.5) sent to the client in the rental menu, never hard-coded on the client (`docs/ADMIN.md` warns that client-side price copies cannot be overridden).

### 3.3 Renting

- Bento's shack prop has `action: 'boat_rental'`. `propAction` sends `{ t: 'barco', action: 'menu' }`; the reply `{ t: 'barco', phase: 'menu', tiers: [{ tier, pt, en, price, canAfford, newFish: Bilingual[] }], trip: { tier, until } | null, partyBoat: boolean }` opens the rental panel (`ui/pesca/barcoMenu.ts`, a dialogue box with Bento's portrait and one chip per tier, prices on the chips like the hat shop; `styles/barco.css`). Tier chips name the new fish in words ("Robalo e tainha"), never a number of fish.
- `{ t: 'barco', action: 'rent', tier }`: within 2 tiles of the shack; no active trip; `p.coins >= price` else `this.err(s, 'coins', 'RV insuficiente. Pesque na praia e venda pra Jô!', 'Not enough RV. Fish from the beach and sell to Jô!')`; then `p.coins -= price`, `p.pesca.trip = { tier, until: now + tripMs, startedAt }`, `p.pesca.rentals[tier]++`, `store.save`, `pushProfile`, a `reward`-style notice "Boa pescaria!" and reply `{ phase: 'trip', tier, until }`. Bento's line: "Tá alugado. Volta antes da maré virar!" (needs_br).
- Boarding: walking onto the boat's deck tiles needs nothing; opening its `pesca_spot` checks the trip. A trip ends on `until`, on `quit` from the boat's spot with "Devolver o barco" (a chip on the spot's first screen), or when the player leaves the praia room. The avatar is nudged to the pier tile next to the boat when a trip ends while on deck (server `move`, the edge-portal pattern).
- The party tier's chip reads "Barco de festa · chamar amigos" and runs section 5 instead of a solo trip.
- Nothing is unlocked by level: any tier can be rented at any time with enough RV. Progression is the ladder of fish, the words and the sale cap.

## 4. Fish catalog, log and words

### 4.1 Species

`packages/shared/src/fish.ts`: `FISH: Record<FishId, FishDef>` with `{ id, pt, en, water: WaterId[], rarity: 'comum' | 'incomum' | 'raro' | 'trofeu', cm: [min, max], sell: number, sizeWords: [small, medium, large, huge] thresholds as fractions of the range, wordId }`. Sizes are rolled as a triangular distribution inside `cm`; `sizeWord(def, cm)` maps to pequeno / médio / grande / enorme; `trophy = cm >= 0.9 of range`.

| id | PT | EN gloss | Water | Rarity | cm | Sell RV |
| --- | --- | --- | --- | --- | --- | --- |
| `bagre` | bagre | sea catfish | praia, remo, pesca, alto_mar, festa | comum | 20 to 45 | 1 |
| `sardinha` | sardinha | sardine | praia, remo, pesca, alto_mar, festa | comum | 12 to 25 | 1 |
| `baiacu` | baiacu | pufferfish | praia, remo | comum (released) | 10 to 20 | 0 |
| `tainha` | tainha | mullet | remo, pesca, alto_mar, festa | comum | 30 to 60 | 3 |
| `robalo` | robalo | snook | remo, pesca, alto_mar, festa | incomum | 40 to 95 | 4 |
| `corvina` | corvina | croaker | pesca, alto_mar, festa | comum | 30 to 60 | 3 |
| `pargo` | pargo | red snapper | pesca, alto_mar, festa | incomum | 30 to 65 | 5 |
| `garoupa` | garoupa | grouper | pesca, alto_mar, festa | raro | 40 to 110 | 6 |
| `dourado` | dourado-do-mar | mahi-mahi | alto_mar, festa | incomum | 60 to 150 | 8 |
| `atum` | atum | tuna | alto_mar, festa | raro | 80 to 200 | 12 |
| `marlim` | marlim-azul | blue marlin | alto_mar, festa | trofeu | 200 to 350 | 20 |
| `tilapia` | tilápia | tilapia | lagoa | comum | 20 to 40 | 2 |
| `tambaqui` | tambaqui | tambaqui | lagoa | incomum | 50 to 100 | 6 |
| `tucunare` | tucunaré | peacock bass | lagoa | trofeu | 30 to 75 | 10 |

Junk (`JunkId`: `chinelo`, `lata`, `alga`) and the party-only `garrafa` (section 5.5) are not fish and never enter the log. Pool weights per water in `POOLS: Record<WaterId, { fish: FishId | JunkId; w: number }[]>`; `pescaRoll` multiplies weights by weather (`chuva` ×1.5 on comum), minute (night ×1.6 sardinha and bagre, dawn ×1.5 robalo), and power (far casts ×1.4 on incomum and raro, ×1.2 trofeu). The beach pool is 55% junk and baiacu on purpose: "free, simple, a bit funny" is the spec's tier-one feel.

A unit test pins every PT name, gloss and water list, and checks that every fish is reachable on `alto_mar` and that `lagoa` is the only water for the three freshwater species.

### 4.2 The log

`profile.pesca.log: Partial<Record<FishId, { n: number; bestCm: number; firstAt: number; firstWater: WaterId }>>` is the collection. It is shown in two places:

- **The Diário's Praia chapter** (section 4.4): every fish name is a diary word with `source: 'game'`, so an uncaught species is an empty slot whose hint names the water ("Pesque em: Barco de pesca"), and a caught one is a sticker. Tapping a fish sticker opens the usual word card plus a fish strip under it (`journalView.ts` `extras` from `profile.pesca.log` through `FISH_BY_WORD`): the icon, "Pescado N vezes", "Recorde: 42 cm", where it was first caught, and a gold frame when the record is a trophy size. The "no math" lock applies to games, not to a journal; the record in centimetres is the one place a number appears, because a record without a number is not a record.
- **Dona Neide's "Caderneta de pesca"** (chip on her talk tree, `ui/pesca/caderneta.ts`): the same data as a one-page list with silhouettes for uncaught fish, grouped by water, for players who want the overview without turning Diário pages. Display only.

### 4.3 Words: the reusable per-tier lists

Rule 1 of `events-requirements.md`: words a player can only earn by taking part. All rows are `needsBr: true`, `area: 'praia'`, `source: 'game'`, anchored on the diary game of their water (`anchor: { kind: 'game', id: 'pesca.<water>.<item>' }`), and listed in a new BR-REVIEW section W. They count toward the words board automatically (`Leaderboards.rebuild` scores `diary.length`) and are reviewed by the Escola automatically (`planLesson` reads the diary).

`packages/shared/src/pescaWords.ts` exports `PESCA_WORDS: Record<WaterId, { wordId: string; earn: EarnMoment }[]>` so the tournament can import the same lists later. `EarnMoment` is one of `first_cast`, `first_bite`, `first_catch`, `first_snap`, `first_release`, `board`, `row` (the oar tap on boarding), `trip_end`, `sunset_aboard`, `friend_catch`, `message_bottle`.

| Water | Words (PT · EN) and the moment that earns each |
| --- | --- |
| praia | anzol · hook (first cast), isca · bait (first bite), vara · fishing rod (first catch), linha · line (first snap), boia · bobber (first nibble), maré · tide (first cast at dawn or dusk) |
| lagoa | lagoa · lagoon (first cast there), água doce · fresh water (first catch there), margem · bank (board the spot), caniço · cane rod (first tucunaré) |
| remo | remo · oar (board), remar · to row (the oar tap, section 3.3), barquinho · little boat (first catch aboard), colete · life vest (first snap aboard), enseada · cove (trip end) |
| pesca | rede · net (board), convés · deck (first catch aboard), âncora · anchor (first snap aboard), pescador · fisherman (trip end), mar aberto · open sea (first garoupa) |
| alto_mar | alto-mar · high seas (board), onda · wave (first cast), profundo · deep (first catch), horizonte · horizon (sunset aboard), bússola · compass (trip end), troféu · trophy (first trophy-size catch) |
| festa | capitão · captain (host boards), tripulação · crew (a guest boards), convidado · guest (accept an invite), festa · party (the music starts), pôr do sol · sunset (sunset with two or more aboard), garrafa · bottle (the message bottle) |

Species words are the fish names in 4.1 (`diary.praia.<id>`), earned by the first catch of that species, anywhere. "Friends learn words together": on the party boat, a catch by any member earns that species word and the moment words for **everyone aboard** at that instant (`PartyTrip.members`, section 5.4), which is the spec's "shared moments on deck that count for everyone".

Beach camera words (source `camera`, `d_*` objects placed in `diaryWorld.ts` `DIARY_PLACEMENTS`), candidates: areia, mar, concha, píer, barco, salva-vidas, castelo de areia, gaivota, coqueiro, canoa, balde, pedra, caranguejo, prancha, protetor solar, bronzeado (a towel scene), sandália. Reading words (signs, `s_*`): praia, aluguel, perigo, correnteza, proibido, posto. **One PT word has one source** in the whole catalog (`diaryPackProblems` throws at import otherwise): `guarda-sol`, `água de coco`, `toalha` and `coco` already exist in other areas, so they are not added again; the implementer runs the pack check and drops or merges (`also`) any other clash.

### 4.4 Diário chapter

- `content/curriculum/phase0/diary-words.json`: a ninth area `{ "id": "praia", "pt": "Praia", "en": "Beach" }`, the word rows above, and `games[]` entries `pesca.praia`, `pesca.lagoa`, `pesca.remo`, `pesca.pesca`, `pesca.alto_mar`, `pesca.festa`, each `{ room: 'praia' | 'barco_festa', host: { npc: 'neide', name: 'Dona Neide' }, rv: 0, grants: [{ item, wordId }] }`.
- `escola.ts` `UNIT_ORDER` appends `praia`; `AREA_IN.praia = 'na praia'`; `GAME_HINT` gets the six game ids ("Pesque na praia", "Pesque no barquinho a remo", …).
- `journalView.ts` `CHAPTER_STYLE.praia = { color: '#3FA9A0', ink: '#1f5f5a', emblem: 'peixe' }` and a pixel emblem in `journalArt.ts`.
- `apps/server/src/diaryCatalog.test.ts` proves every praia word can really be earned (it walks the anchors); the fishing grants need the `game` branch extended to read `PESCA_WORDS`.

## 5. The party boat (Barco de festa)

### 5.1 The room

`barco_festa` RoomDef: `16 × 10`, `outdoor: true`, `private: false` (gating is by roster, not `private`), floor all `b` deck with a 1-tile `o` border so nobody walks off, props: rails (overhead), two `pesca_spot`s per side with `water: 'festa'`, a speaker and a grill at the bow (`cenario`, no alcohol, a sign "CHURRASCO · REFRI · MÚSICA"), bunting, a cooler, four benches with seats, the wheelhouse (blocks) with a `cenario` captain's wheel. No NPCs aboard. `WALL_STYLE.barco_festa` outdoor. The stage backdrop at sea moves (the `fundo_festa` art pans slowly). `ROOM_ON_MAP.barco_festa = { via: 'praia' }`.

### 5.2 The trip object

Server memory only, no table (a trip never outlives a process):

```ts
// apps/server/src/partyBoat.ts
interface PartyTrip { id: string; hostId: string; members: Set<string>; invited: Map<string, number>; startedAt: number; endsAt: number; catches: number; sunsetSeen: boolean; }
class PartyBoats { byHost: Map<string, PartyTrip>; byMember: Map<string, string>; create(host, now): PartyTrip; invite(trip, targetId, now): 'ok' | 'full' | 'not_friend' | 'blocked' | 'offline' | 'busy'; accept(targetId, tripId): PartyTrip | null; leave(id); end(trip, why); }
```

- Instance id `festa@<hostId>-<startedAt>` (never ends in `#1`, so `leaveInstance`'s garbage collection frees it when empty).
- `World.instanceFor` gets a `barco_festa` branch before the public-shard loop: the session's profile id must be in `parties.byMember` for the requested `instanceId`, else `{ error: { pt: 'Esse barco é de outra turma.', en: 'That boat belongs to another group.' } }`; a full boat answers `{ pt: 'O barco está lotado!', en: 'The boat is full!' }` (a hard error, not the silent fall-through public shards use).
- Cap: `partyBoatCap` tunable, default **6 including the host** (the mascot-photo rule from `events-requirements.md`; flagged). The room cap of 16 is irrelevant on the boat.
- Length: `partyTripMinutes`, default 15 real minutes. At `endsAt`, or when the host leaves, every member is moved to the pier tile `(28, 23)` with a `notice` "O barco voltou pro píer." and the trip summary card (fish caught aboard, words shared, who was aboard, display names only). The host leaving early is confirmed ("Encerrar a festa? Todo mundo volta pro píer.").
- Leaving: a guest walks to the gangway tile `(0, 5)` (an edge portal back to `praia` at the pier) or taps "Desembarcar" on the HUD pill that shows while aboard. The host can "Desembarcar" a guest from that guest's profile card (a `party remove` action), which kicks only that guest back to the pier with a neutral notice.

### 5.3 Protocol

```ts
// ClientMsg
| { t: 'party'; action: 'create' }                                 // from the shack chip; charges the host the festa price
| { t: 'party'; action: 'invite'; targetId: string }               // friends only, online only
| { t: 'party'; action: 'accept' | 'decline'; tripId: string }
| { t: 'party'; action: 'leave' }
| { t: 'party'; action: 'remove'; targetId: string }               // host only
| { t: 'party'; action: 'end' }                                    // host only
// ServerMsg
| { t: 'party'; phase: 'invite'; tripId: string; fromId: string; fromName: string; expiresAt: number }
| { t: 'party'; phase: 'state'; tripId: string; hostId: string; members: { id: string; name: string }[]; endsAt: number; cap: number }
| { t: 'party'; phase: 'ended'; summary: { fish: { fish: FishId; by: string }[]; words: string[]; members: string[] } }
```

- `create`: within 2 tiles of the shack; `partyBoat` must be on; no trip as host or member; pays `boatFestaRv` exactly like `rent`; `parties.create`; then `join(s, 'barco_festa', { instanceId: trip.id })`.
- `invite`: the target must be a friend (`p.friends.includes`), online, not blocked either way (`hasBlocked` both directions, the `friend()` rules), not already in a party; the boat has room counting pending invites. The invite expires in 90 s. Delivered as `{ phase: 'invite' }` plus the existing `toast`; the client shows a small modal with the host's name, "Bora pro barco de festa?" and **Aceitar / Agora não** (`ui/pesca/partyInvite.ts`). A player at the beach or anywhere in the Vila can accept; one who is in a Correria shift, a bout or a cart game is refused with `busy` and the host is told "está ocupado".
- `accept`: adds the member and runs `join('barco_festa', { instanceId })` from wherever they are (fast travel, like "Ir até"); `decline` just clears the invite. The Friends panel (`openFriends` in `panels.ts`) gets a "Convidar pro barco" button on each online friend row while you host a trip.
- `state` is sent to every member on any change; the HUD shows a `Barco de festa · 4 a bordo` pill with the time left as words ("quase acabando" in the last 2 minutes, never a countdown).

### 5.4 Shared moments

- Any member's `caught` result aboard raises `trip.catches` and broadcasts `{ t: 'pesca', phase: 'aboard', by: name, fish, pt, en }`: a toast and the fish word spoken (`speak(pt, { speaker: 'ui' })`), and the species word plus the `friend_catch`-moment words are granted to every member aboard (`DiaryTracker.earnMany` per member). The catcher keeps the fish in their own balde.
- `sunset_aboard`: when the game clock crosses 17:30 with two or more aboard, everyone gets `pôr do sol`, the deck music swells and the bunting lights come on.
- The music starts when the second member boards (`festa` word for all).

### 5.5 Unique items (only here)

- **Chapéu de capitão** (`chapeu_capitao`, `EARNED_HATS` in `catalog.ts`, never sold, not grantable from Nanda): granted to the host at the end of their first trip that had at least one guest aboard for at least 5 minutes, and to each guest at the end of their first trip as a guest with the same minimum. Everyone who sails earns it once; it is a status item people wear, so one per player. The grant is the `world.ts` founder-hat pattern (`p.hats.push`, equip, save, push) in `PartyBoats.end`.
- **Garrafa com mensagem** (`garrafa`): a `festa`-only roll (weight 6% of casts) that opens a card with a short PT message in a bottle ("Quem lê isso, me manda um 'oi' da praia!" and nine more, needs_br, no names, no contact details, authored in `pescaWords.ts` `BOTTLE_MESSAGES`), grants the `garrafa` word, and puts a `furniture/garrafa_mensagem` kitnet item in `p.furniture` the first time.
- **Concha gigante** (`furniture/concha_grande`): in the trip summary for everyone aboard when the trip had three or more catches. A wall `rede_pesca_parede` goes to the host of a trip where every member caught something.
- All three are furniture rows with `earned: true` (the `banner_fundadores` pattern) so the catalog panel shows them as earned, never priced.

### 5.6 Safety

- The deck is a plain `Instance`: chat runs `World.chat()` unchanged (classify, mute, rate, `broadcastFrom`, the chat log that reports snapshot), never rewritten. Report, block and mute work from the profile card as everywhere else; a block that happens during a trip removes the blocked player's future invites and, if the blocker is the host, kicks the blocked guest to the pier.
- Invites are friends-only and online-only, so a stranger cannot be pulled aboard; a declined or expired invite is silent to the inviter beyond "não respondeu".
- Leaving is always one tap. The host's "remove" sends the guest a neutral notice and nothing to the others.
- Display names only in every party message and in the summary. No alcohol words anywhere on the deck art, signs, lines or messages; the bottle messages go through `classifyChat` in a unit test like every authored line.

## 6. NPCs

Three new `NpcId`s: `bento`, `neide`, `jo`. Each needs the full set from the research: `NpcDef` in the praia RoomDef, `content/voices.json` cast entry, `NPC_TALK` tree, `idleLines`, the `SPEAKER` map in `ui/npcTalk.ts`, `NPC_TAG_COLORS`, four portraits, `NPC_STYLES` (`looks.test.ts`), `RECADO_NPC_IDS`, and `pnpm tts` (CLAUDE.md: new spoken dialogue needs it; if the bake cannot run in the implementer's environment, `pnpm tts:check -- --update-pending` records the gaps in `pending.json` and the PR says so).

Every line below is `needs_br`. `{saudacao}` / `{greeting}` and `{nome}` follow `npcTalk.ts` conventions (`{nome}` only from 2 hearts). No NPC waves.

### 6.1 Seu Bento, the boat rental owner

- `role: { pt: 'Aluguel de barcos', en: 'Boat rental' }`, stands at the shack `(28, 6)` all day, no schedule (D12: renting must work at every hour; his night idle line covers it). `appearance`: body `forte`, skin 4, hair `raspado`, hairColor 5, top `camisa` topColor 6 (faded blue), bottom `calca` bottomColor 1, shoes 2, face `maduro`, extra `barba`, idle `bracos`; hat `chapeu_capitao`-like? No: Bento wears a plain `chapeu_pescador` (bucket hat) so the captain's cap stays exclusive to players.
- Voice: `"bento": { "voice": "pt-BR-AntonioNeural", "rate": "-3%", "pitch": "-2Hz", "about": "Seu Bento, aluguel de barcos: calm, a little gravelly, the sea in his voice" }`.
- Idle lines: "Barco bom é barco que volta." / "A good boat is one that comes back."; "Hoje o mar tá manso." / "The sea is calm today."; "Quer ir mais longe? Aluga o de alto-mar." / "Want to go farther out? Rent the deep-sea boat."; night: "A maré não dorme, e eu também não." / "The tide doesn't sleep, and neither do I."
- Talk tree `NPC_TALK.bento`: `oi` → "{saudacao}! Eu sou o Bento. Esses barcos aí são todos meus." / "{greeting}! I'm Bento. Those boats there are all mine." with chips "Quanto custa alugar?" (→ `precos`, Bento lists the tiers in words and opens the menu, `next: 'shop'` reused as the rental), "Qual é o melhor barco?" (→ `melhor`: "Pra começar, o barquinho a remo. Pra peixe grande, o de alto-mar." / "To start, the little rowboat. For big fish, the deep-sea boat."), "E o barco de festa?" (→ `festa`: "Esse é pra ir com os amigos. Música, churrasco e muita pescaria." / "That one's for going with friends. Music, barbecue and lots of fishing."), "Tchau, Seu Bento!" (`end`).
- Rental lines (spoken from `barcoMenu.ts`, listed in `extra-lines.json`): "Tá alugado. Volta antes da maré virar!" / "It's rented. Be back before the tide turns!"; "RV insuficiente, viu? Pesca na praia e vende pra Jô." / "Not enough RV. Fish from the beach and sell to Jô."; "O barco voltou. Como foi lá fora?" / "The boat is back. How was it out there?"

### 6.2 Dona Neide, the fisherman mentor

- `role: { pt: 'Pescadora', en: 'Fisherwoman' }`. Schedule (`SCHEDULES.neide`): 04:30 to 11:00 on the pier `(28, 20)` facing the water with her rod (`trabalhando`); 11:00 to 16:00 on her bench `(25, 12)` (`sentada`, the shade); 16:00 to 20:30 back on the pier; 20:30 to 04:30 `em_casa` (she walks to the calçadão and vanishes at the bus stop, `NPC_HOME_DOORS.praia`). Fishing never needs her (D12); she is the voice of the place and the Caderneta.
- `appearance`: body `medio`, skin 6, hair `coque` (if the layer exists, else `curto`) hairColor 7 (grey), top `camiseta` topColor 9, bottom `calca` bottomColor 3, shoes 0, face `maduro`, extra `oculos`, idle `solto`; hat `chapeu_pescador`.
- Voice: `"neide": { "voice": "pt-BR-FranciscaNeural", "rate": "-7%", "pitch": "-6Hz", "about": "Dona Neide, pescadora: slow, warm, sure of herself" }` (Dona Graça is -10% / -8Hz; Neide must not sound like her twin, hence the lighter cut).
- Idle lines: "Peixe grande gosta de quem tem paciência." / "Big fish like patient people."; "Segura firme, solta quando ele corre." / "Hold tight, let go when it runs."; "De manhãzinha o robalo tá acordado." / "Early morning, the snook is awake."; rain: "Chuva fina, peixe bobo." / "Light rain, silly fish."
- Talk tree `NPC_TALK.neide`: `oi` → "{saudacao}, {nome}. Senta aí. Já pescou hoje?" / "{greeting}, {nome}. Sit down. Fished yet today?" chips: "Como é que pesca?" (→ `como`: three short nodes, one per beat: "Segura pra lançar, e solta." / "Hold to cast, and let go."; "Quando a boia afunda, é Fisgou! Toca rápido." / "When the bobber sinks, that's Fisgou! Tap fast."; "Puxa segurando. Ele corre? Solta um pouco." / "Reel by holding. He runs? Let go a bit." Each `com` node gets its own `heard` card word: lançar, fisgar, puxar), "Onde tem peixe grande?" (→ `grande`: "Na lagoa tem tucunaré. No alto-mar tem marlim. Mas cada um no seu dia." / "The lagoon has peacock bass. The high seas have marlin. Each on its own day."), "Minha caderneta de pesca" (→ `caderneta`, opens section 4.2's panel), "Tchau, Dona Neide!" (`end`).
- Mentor moments (spoken by `neide` from the stage through `extra-lines.json`, only when she is on the pier or the player is on the beach, once each per player, stored in `pesca.coached`): first snap: "Arrebentou. Da próxima, solta quando ele correr." / "It snapped. Next time, let go when it runs."; first trophy: "Olha isso! Esse vai pro recorde." / "Look at that! That's one for the record."; first baiacu: "Baiacu não se come, se devolve." / "Pufferfish aren't for eating, you give them back."

### 6.3 Jô, the beach vendor

- `role: { pt: 'Barraca da praia', en: 'Beach kiosk' }`, at the kiosk `(7, 5)` all day (no schedule; her idle lines change with the hour). `appearance`: body `esguio`, skin 5, hair `trancas` hairColor 0, top `regata` (if present, else `camiseta`) topColor 4 (mustard), bottom `shorts`-style bottom (if present, else `saia`) bottomColor 8, shoes 3 (sandals look), face `doce`, extra `brincos`, idle `cintura`; hat `viseira`.
- Voice: `"jo": { "voice": "pt-BR-FranciscaNeural", "rate": "+5%", "pitch": "+3Hz", "about": "Jô, the beach kiosk: quick, sunny, calls everyone 'meu bem'" }` (Nanda is +6% / +4Hz; Jô sits just under her and talks faster in the lines themselves).
- Idle lines: "Água de coco geladinha!" / "Ice-cold coconut water!"; "Queijo coalho na brasa, meu bem!" / "Grilled cheese on a stick, dear!"; "Compro peixe fresco! Traz pra cá!" / "I buy fresh fish! Bring it here!"; night: "Fechando a barraca, mas o gelo fica." / "Closing the kiosk, but the ice stays."
- Talk tree `NPC_TALK.jo`: `oi` → "{saudacao}, meu bem! Vai um coco?" / "{greeting}, dear! Coconut water?" chips: "Vou querer um lanche" (→ `shop`: the snack menu, section 7.2), "Quer comprar peixe?" (→ `peixe`: "Quero sim! Mostra o balde." / "Sure I do! Show me the bucket." and the sell panel), "Tem chapéu aí?" (→ the beach rack, section 7.3), "Só olhando, obrigad{obrigad}!" (`end`).
- Selling lines (`extra-lines.json`): "Peixe bom! Toma aqui." / "Nice fish! Here you go."; "Hoje já comprei o que dava. Amanhã tem mais." / "I've bought all I can today. More tomorrow."; "Balde vazio, meu bem. Vai pescar!" / "Empty bucket, dear. Go fish!"

### 6.4 TTS list

Everything `collectSpokenLines()` already walks: the three `NPC_TALK` trees (× 3 hours × 2 pronouns, nameless), the `idleLines`, every new `DIARY_WORDS[].pt` spoken by `ui` (fish names and tier words), the new hotspot signs. Runtime-only lines go in `content/tts/extra-lines.json`: Bento's rental lines (speaker `bento`), Neide's mentor moments (`neide`), Jô's selling lines (`jo`), and the stage words spoken by `ui`: "Fisgou!", "Pegou!", "Escapou…", "Cedo demais!", "Arrebentou a linha!", "Ih, enrolou!", "Ih, um baiacu!", "Novo!", the four size words, the junk names ("um chinelo", "uma lata", "uma alga"), "Boa pescaria!", "O barco voltou pro píer.", "Bora pro barco de festa?", and the ten bottle messages. The party summary and the aboard toasts carry display names, so they are shown, not spoken (the Placar precedent).

## 7. Rewards and sinks

### 7.1 Selling fish

- `profile.pesca.balde: Partial<Record<FishId, number>>` holds what you caught and have not sold; it has no size limit in this PR (**Later**: a 20-fish bucket and an ice box upgrade, a nice small sink).
- Jô's `fish_sell` action opens `ui/pesca/vender.ts`: a tray of your fish with icons, PT names and the price each, "Vender tudo" and per-fish chips. `{ t: 'pesca', action: 'sell', fish?: FishId }`: the server sums `FISH[id].sell × n` for the chosen fish, clamps to what is left of today's cap (`pescaSaleCapRv`, default 60, keyed by the player's day like `feira.n`, with `testDayOffset` respected), pays through `World.reward(s, rv, { pt: 'Peixe vendido pra Jô', en: 'Fish sold to Jô' })` (the one credit path), removes the sold fish, replies `{ phase: 'sold', rv, coins, left: balde, capLeft }`. Over the cap, the fish stay in the bucket and Jô says her "amanhã tem mais" line. Prices are the `FISH.sell` column (section 4.1) and are server-side only; the tray's prices come from the `sold`/`menu` messages.
- No cooking in this PR (**Later**: a moqueca grill at Jô's that turns two fish into a held dish worth more RV and a food word).

### 7.2 Jô's snacks (sinks)

`streetSnacks.ts` gains the kiosk's `propId: 'barraca_jo'` list: `agua_de_coco` (already 7 RV, same item), `queijo_coalho` (6, held, 3 bites, leaves `palito_vazio`), `picole` (4, held, leaves `palito_picole`), `milho_verde` (5, held, leaves `sabugo`). Each new `CarryId` in `types.ts` and `carry.ts`, icons and held art (section 1.6). These are the same `street_snack` action and `buyCounter`-style debit the pipoqueiro uses.

### 7.3 Cosmetics (sinks and rewards)

- **Beach rack at Jô's** (`beach_shop`, the `openHatShop` panel with a `'praia'` mode and `HATS_PRAIA` in `catalog.ts`; `isStallHat` learns the second stall): `chapeu_pescador` bucket hat 20 RV, `viseira` visor 12 RV, `bone_surf` 15 RV. Hats need the shop mode check in `World.buy` to accept room `praia` for these ids only.
- **Earned, never sold** (`EARNED_HATS`, `FURNITURE` with `earned: true`): `chapeu_capitao` (party boat), `furniture/concha_grande`, `furniture/rede_pesca_parede`, `furniture/garrafa_mensagem` (party boat), `furniture/boia_parede` (a life ring for the kitnet wall, first garoupa), `furniture/prancha` (first dourado).
- **Kitnet furniture sold at Jô's rack**: `prancha` is earned, so the sold ones are `cadeira_praia` 12 RV and `concha_pequena` 8 RV (decoration).
- Nothing on the beach counts toward any board, and no cosmetic changes play.

## 8. Server

### 8.1 Profile data model

`packages/shared/src/types.ts` `PrivateProfile.pesca?: PescaProgress`, normalized by `normalizePesca` (pure, idempotent, clamps, drops unknown ids) called from `normalizeProfile` in `apps/server/src/store.ts`:

```ts
export interface PescaProgress {
  casts: number; catches: number;
  log: Partial<Record<FishId, { n: number; bestCm: number; firstAt: number; firstWater: WaterId }>>;
  balde: Partial<Record<FishId, number>>;
  rentals: Partial<Record<BoatTier, number>>;
  trip: { tier: BoatTier; startedAt: number; until: number } | null;
  sales: { date: string; rv: number };
  words: string[];               // EarnMoment keys already fired, e.g. 'praia.first_cast' (prevents re-granting; the diary itself dedupes words)
  coached: string[];             // Neide's one-time lines
  party: { hosted: number; guested: number };
}
```

A missing `pesca` means "never fished". `createProfile` does not need to set it. Solo mode gets it for free (`localNet.ts` stores the same JSON). Nothing is server-only here, so `toPrivate` strips nothing new. `docs/SQLITE.md`'s table list gains the `praia` kv singleton (`PraiaConfig`) and nothing else: profiles stay one JSON row each, the balde and the log travel inside it.

### 8.2 Protocol summary

New `ClientMsg` families `pesca`, `barco`, `party` and the admin actions `praiaMode`, `praiaSet` (sections 2.4, 3.3, 5.3, 8.5); new `ServerMsg` families `pesca` (`spot`, `cast`, `result`, `aboard`, `sold`), `barco` (`menu`, `trip`), `party` (`invite`, `state`, `ended`), `praia` (`mode`). All validated by hand in the handlers (`typeof`, membership through `isFishId`, `isBoatTier`, `isWaterId`, `parsePescaEvents` with the 200-row cap and monotonic timestamps), the `parseFeiraOutcomes` style. `World.handle` dispatches `case 'pesca': return this.pesca.handle(s, msg)`, `case 'barco'`, `case 'party'`.

### 8.3 Validation and anti-cheat

- The client never sends a fish, a size, a score or an RV amount. It sends hold and tap timestamps; the server rolls the fish from its own seed and replays the events with the same pure sim (the feira cart model, chosen over a server-ticked fight so touch tension stays latency-free).
- Server-measured `elapsed` must cover the bite and the shortest fight; a `hook` outside the bite window fails; event lists are capped and monotonic; at most one open cast per session; a new cast at most every 2 s; results for a stale `seq` are dropped.
- RV only moves at the barraca, through `reward`, under a daily cap, and at the shack, through the one inline debit pattern. Rentals check `coins` and the absence of a trip. The party price is paid once by the host.
- Proximity: `open` within 1 tile of the spot's interact tile, `rent` and `create` within 2 tiles of the shack, `sell` within 2 tiles of the kiosk (`near()` from `feiraGames.ts`).
- Trips end on the server clock; the client's pill is cosmetic.
- `testUser` profiles fish normally; nothing here ranks, so no board scrubbing is needed beyond what the words board already does.

### 8.4 Persistence

- `profiles.json` row grows by `pesca` (schemaless JSON, no migration). Backups unchanged.
- New kv singleton `praia` (`fileStore.ts` next to `feira_cart`): `{ mode, partyBoat }`, read at boot in `app.ts` like the cart blob, exposed to `World` as `praiaStore`.
- Admin tunables persist in `kv.gameConfig` as today.

### 8.5 Admin dashboard hooks (#223)

- **World & areas**: a "Praia" card with the mode switch (`open` / `preview` / `closed`), the party boat on/off, and live stats (players on the beach now, trips active per tier, trips today per tier, catches today per species, RV paid at the barraca today, bottles found). Routes `GET /api/admin/praia` and `POST /api/admin/praia/mode` (`op(setPraiaMode)` in `adminOps.ts`, audited `before`/`after`, through `AdminWorldHost.setPraiaMode` and a `praia mode` broadcast). The in-game admin door (`admin` socket actions) gets the same two switches so solo screenshots can pin them (`?praia=closed` in solo, the `?feiraon` pattern).
- **Game variables**: a `praia` group in `TUNABLES`: `boatRemoRv` 15 (1 to 500), `boatPescaRv` 40, `boatAltoMarRv` 90, `boatFestaRv` 150, `pescaSaleCapRv` 60 (0 to 500), `tripMinutes` 12 (2 to 60), `partyTripMinutes` 15 (5 to 60), `partyBoatCap` 6 (2 to 16). The client reads prices from the `barco menu` message, so an override is safe (unlike shop prices).
- **Player page**: `playerDetail` summary gains `pesca: { casts, catches, species, record: { fish, cm }, balde, rentals, trip, salesToday, party }`; `setItem` already grants any `ALL_HATS` id, so the captain hat and the earned furniture appear there automatically; a "Reset pesca" action (audited) clears `pesca` for support cases. The profiles CSV gains `fish_species`.
- **Audit**: mode changes, tunable edits, hat grants and pesca resets all append to `admin_audit` through the existing `op()` wrapper.
- `docs/ADMIN.md`: the Sections table row for World & areas mentions the Praia card; the Game variables table gains the `praia` rows.

## 9. Tests, e2e, screenshots, acceptance

### 9.1 Unit tests (vitest, next to the code)

- `packages/shared/src/rooms.test.ts`: `praia` and `barco_festa` build a grid, water blocks, sand and deck walk, no open border tile except the praia bus portal and the deck gangway, a 2-wide lane from spawn to every interact tile and door, the lagoa ring is closed.
- `fish.test.ts`: names, glosses, waters, sizes, every fish on `alto_mar`, freshwater only in `lagoa`, sell prices never 0 except baiacu, `sizeWord` boundaries, junk never in the log.
- `pescaSim.test.ts`: `pescaRoll` is deterministic per seed; pool weights respond to weather, minute and power; `pescaJudge` on authored event lists gives `caught`, `early`, `late`, `snapped`, `escaped`, `tangled`, `rejected` (non-monotonic, too long, too fast, hook before bite); the three-profile simulation (section 2.3) holds; the pinned test roll.
- `pescaWords.test.ts`: every water has its list; every word id exists in the diary pack with `source: 'game'` and the right anchor; no PT duplicates against the whole catalog (`diaryKey`); the bottle messages and every new PT line pass `classifyChat` as `allow`.
- `praia.test.ts`: `praiaAllows` for the three modes with and without a subscription.
- `catalog.test.ts`: the captain hat is in `EARNED_HATS` and not sellable; the beach rack hats are stall hats only at the praia.
- Server: `pesca.test.ts` (open requires proximity and a free or rented water; cast then result pays nothing, fills the balde and the log, grants the species word once; sell pays through `reward`, respects the cap and the day roll; a rejected result changes nothing; trip expiry ends a cast on a boat), `barco.test.ts` (rent debits exactly the tunable, refuses without RV or with a trip running, the trip ends on time and on leaving the room), `partyBoat.test.ts` (create pays once; invite rules: friend, online, not blocked, not busy, cap counts pending invites; accept joins the instance; `instanceFor` refuses non-members and a full boat; host leave ends the trip and moves everyone; the hat and the furniture grants; shared words reach every member; the instance is garbage-collected when empty), `world.test.ts` (join `praia` under each mode; `barco_festa` is never a public shard), `adminApi.test.ts` (the two praia routes 401 without the cookie, the mode change is audited and broadcast), `diaryCatalog.test.ts` (every praia word is earnable).
- Client: `pescaView.test.ts` (the local sim mirrors the shared one tick for tick on a recorded event list), `townMapData.test.ts` (praia travels, fazenda does not), `journalView.test.ts` (the Praia chapter, the fish strip), `spoken.test.ts` (no new line without a clip or a `pending.json` row), `art3.test.ts`, `looks.test.ts`, `wayfinding.test.ts`.

### 9.2 e2e (`scripts/e2e-praia.mjs`, added to `SUITES` in `e2e-all.mjs` with `TB_TEST_PESCA=1`)

1. Register, `finishArrival`, `goArea('rua_leste')`, `__tb.interact({ portal: 'rua_praia' })`, assert `roomState.room === 'praia'` and the bus-stop hotspot text.
2. Talk to Neide (`__tb.interact({ npc: 'neide' })`), walk her "Como é que pesca?" chips, assert three `heard` cards.
3. `__tb.interact({ prop: 'pesca_praia_1' })`, drive the stage through `window.__tb.pesca` (`cast(power)`, `hook()`, `hold(down)` and `state()`), land the pinned bagre, assert the catch card, the new-word card for `bagre`, `profile.pesca.balde.bagre === 1` and `diary` includes `diary.praia.bagre` and `diary.praia.anzol`.
4. Sell at Jô's: assert `reward` and `coins` grew by 1 and the balde is empty; buy a queijo coalho and eat it (the held-snacks helpers).
5. Give RV through the credits admin door (the feira cart script's pattern) or `__tb.adminTest('coins')`, rent the rowboat, assert the trip, board, catch the pinned robalo, "Devolver o barco", assert the trip is null and `remo` and `robalo` words are in the diary.
6. Party: a second page (the two-window pattern from `e2e.mjs`), friends through the panel, the host creates a trip, invites, the guest accepts from the praça (fast travel), both see each other in `barco_festa`, the host says one chat line and the guest receives it verbatim, the guest catches the pinned fish and the host gets the word too, the host ends the trip, both land on the pier, the summary card shows both names, the host's `hats` includes `chapeu_capitao` (the 5-minute minimum is `TB_TEST_PESCA`-relaxed to 5 s).
7. Closed mode: through the admin door set `closed`, assert the map shows the teaser again and `join('praia')` errors; set `open` back.
8. Solo: `SOLO=1` runs steps 1 to 5 against the static build (the party step is skipped).

### 9.3 Screenshots (`scripts/praia-shots.mjs`, output `docs/lifesim/shots/praia/`, desktop 1280×800 and phone 390×844)

The beach at 09:00 sol, 17:30 sol (the sun path), 20:30 (lights, crabs), 11:00 chuva (closed umbrellas); the map with the praia as a place; Bento's rental menu; the stage on each of the six waters at the cast, the bite and the fight; the catch card (a trophy and a junk); the Diário Praia chapter and a fish card; Jô's sell tray and rack; the party invite modal; the party deck with two avatars; the trip summary; the dashboard Praia card (`admin-shots.mjs` gains it). The implementer opens every shot and checks it against the HOWTO beauty checklist before the PR.

### 9.4 Acceptance criteria per part

1. **Room**: the bus sign and the map both reach the praia; the return bus works; `closed` restores "Em breve"; every lane test passes; the beach passes the beauty checklist at four hours and in rain; perf on the beach (`perf-areas.mjs` with `praia` added) is no worse than the `rua` at 19:30.
2. **Fishing**: a new player casts, hooks and lands a bagre with no card read, by mouse and by touch; no digit is drawn on the stage; the three outcomes (snap, escape, catch) each occur in a 20-cast session; the server replay matches the client sim on every e2e cast; a forged `result` changes nothing.
3. **Boats**: each tier rents at the tunable price, shows its own backdrop and pool, ends on time, on return and on leaving; RV never goes negative; the sale cap holds across a day roll.
4. **Catalog and words**: all 14 species exist with PT and EN; the Praia chapter shows 14 fish slots plus the tier, camera and sign words; every word is earnable (`diaryCatalog.test.ts`); the words board counts them; the Escola reviews them.
5. **Party boat**: six aboard at most; only invited friends can join; chat is verbatim; report and block work on deck; leaving is one tap; the captain hat arrives once per player; the trip summary names only display names; the instance is freed when empty.
6. **NPCs**: three NPCs with trees, idle lines, portraits, voices; `pnpm tts:check` is clean or `pending.json` lists exactly the unbaked lines; `looks.test.ts` keeps the NPCs 3 reads apart from every CPU.
7. **Rewards and sinks**: selling is the only RV source on the beach; rentals, snacks and the rack are the sinks; earned items are never priced anywhere, including the dashboard's grant list labels.
8. **Server and admin**: `normalizePesca` is idempotent on every fixture profile; the two praia routes are audited; the tunables apply live and reach the rental menu.
9. **Docs**: `docs/lifesim/DECISIONS.md` gets a "Praia: fishing, boats and the party boat" entry (decisions made, tunings, known weaknesses, shots path); `BR-REVIEW.md` section W lists every new PT string; `docs/ADMIN.md`, `docs/SQLITE.md`, `docs/audio/README.md` (the waves zone and the shared bed note), `assets-src/README.md` (the praia generator) and `docs/art/palette.md` are updated; `docs/brainstorm/beach-fishing.md` gets a one-line "Built in #<PR>, see docs/PRAIA-PLAN.md" status note.

## 10. Build order (one PR, WIP checkpoints)

Branch `feat/praia` off `main`. Commit messages `feat(praia): …`, `art(praia): …`, `test(praia): …`, ending with the attribution line the harness gives. `pnpm verify` green at every checkpoint; the e2e suites that exist stay green at every checkpoint (`E2E_ONLY=` to run one). Each checkpoint is a commit with a shot in the PR description so Jonny can follow along.

**Step A: the room.** `RoomId`, both RoomDefs (`barco_festa` empty for now), floor chars and `buildGrid`, terrain art and `praia.mjs` (the three terrains, the kiosk, umbrellas, the shack, the pier furniture, the four boats, rocks, signs, the foam strips), `praia.json` layout, the bus portals both ways, the map place, `WALL_STYLE`, every RoomId list in 1.3, `sea.ts`, the ambient data (gulls, crabs, zones), the CPU spots, the ambience bed mapping, the hotspot signs, the praia mode store and admin switch with `open` default. **Checkpoint A:** walk from the Vila to the beach and back, day and night shots, `pnpm verify`, `e2e-all` green (existing suites). Nothing to fish yet.

**Step B: people and words.** The three NPCs (defs, schedules, looks, portraits, voices, trees, idle lines, `SPEAKER`, tag colours), the diary area and every word row, `DIARY_PLACEMENTS` for the camera words, the Praia chapter style, Escola order, `pescaWords.ts`, Jô's snacks and rack, `EARNED_HATS` and earned furniture entries, hat art, TTS bake or pending. **Checkpoint B:** talk to all three, photograph a camera word, read a sign, buy a coco; the Diário shows the Praia chapter with empty fish slots.

**Step C: fishing from the sand and the lagoa.** `fish.ts`, `pesca.ts`, `pescaSim.ts` with the simulation test, `PescaEngine` with the pinned roll, the stage, the view, the card, the sfx, `DiaryTracker.onPescaCatch`, the balde, selling at Jô's with the cap, Neide's coaching lines, the "?" place card. **Checkpoint C:** catch a bagre by mouse and by touch (phone shot), sell it, see the word in the Diário; `e2e-praia` steps 1 to 4 pass.

**Step D: boats.** `barco` protocol and engine, the tunables, the rental menu, trips, the boat spots, the three solo backdrops, trip end rules, Bento's rental lines. **Checkpoint D:** rent each tier, catch its new fish, return the boat; e2e step 5 passes; dashboard tunables reach the menu.

**Step E: the party boat.** `barco_festa` room and art, `PartyBoats`, the `instanceFor` branch, the `party` protocol, the invite modal and the Friends panel button, the HUD pill, shared words, the summary card, the hat and the furniture grants, the gangway and the remove action, the `partyBoat` admin switch. **Checkpoint E:** two browsers sail together; e2e step 6 passes. If the PR is already heavy when Step E starts, ship Steps A to D with `partyBoat: false` (the shack chip reads "Em breve") and finish Step E in the next PR; say so in the PR description.

**Step F: admin and polish.** The dashboard Praia card and player summary, `admin-shots.mjs`, `praia-shots.mjs`, the perf run, `DECISIONS.md`, `BR-REVIEW.md` W, `ADMIN.md`, `SQLITE.md`, the audio and art READMEs, the brainstorm status note. **Checkpoint F:** the full `e2e-all` including `e2e-praia` and the solo run; every shot checked; PR opened with the checkpoint shots, the decisions made, the open questions below, and the list of lines awaiting `pnpm tts` if any.

## 11. Later (phase 2, separate PRs)

- A praia music bed ("Maré Mansa") and a festa arrangement for the deck, through the `compose-music` skill and `COMPOSING.md`.
- The bus ride cutscene (a short window-and-road fade, the flight-in pattern) and a "zarpar" tween when a solo boat casts off.
- The fishing tournament (`torneio de pesca`): a rotating event with its own day board, prizes and tournament words, reusing `PESCA_WORDS` and the engine; the announcements board it needs is not built yet.
- Bait and gear (minhoca, camarão, a better reel that drains tension faster), bought at Bento's, as small sinks that change the pool weights.
- Cooking at Jô's (moqueca, peixe na brasa) as held food and food words; trading fish between players.
- A bucket limit and an ice box; weather-closed umbrellas if Step A skips the sprite swap; crabs scuttling from players; a beach dog; CPUs playing frescobol with a real two-frame swing if the idle poses are not enough.
- A tide table on the pier sign that changes the pools by the hour, with words (maré alta, maré baixa, vazante).
- The Fazenda stays "Em breve"; nothing here touches it.

## 12. Open questions for Jonny

1. **Prices.** Proposed remo 15, pesca 40, alto-mar 90, festa 150 (host pays), fish sales capped at 60 RV a day, bagre 1 to marlim 20. All are dashboard tunables, so the launch numbers can move without a deploy. OK to ship with these?
2. **Rental length.** Per trip, 12 real minutes or until you leave the boat; the party boat 15 minutes. The spec left per-trip versus per-day open; per-trip was chosen so a boat is a decision, not a subscription. OK?
3. **Freshwater.** Option (a), a free lagoa pocket on the same beach, so tilápia, tambaqui and tucunaré are real from day one. Confirm, or prefer the cartoon rule (b) with the freshwater fish in the sea pools?
4. **Party boat cap.** Six including the host, borrowed from the mascot photo rule. The host pays the whole price; guests pay nothing. Keep, or should guests chip in?
5. **The captain hat.** Everyone who completes a party trip earns it once (host or guest, five minutes aboard with company). That makes it common among social players and never available to solo ones. Keep it that way, or make it host-only?
6. **Launch mode.** Default `open` for everyone, with `preview` (subscribers only) available from the dashboard for a founders-first day if you want one. Which do you want on the day the PR merges?
7. **The record number.** The Diário fish card shows "Recorde: 42 cm". It is the one place a number appears in the feature. Keep it, or words only ("Recorde: enorme")?
8. **Neide's hours.** She walks home from 20:30 to 04:30 and fishing works without her. Fine, or should the mentor always be on the pier?
9. **Jô buys fish at every hour** ("the ice stays") so selling never depends on the clock (D12). OK?
10. **Step E cut line.** If the PR is heavy, the party boat ships switched off and lands in the next PR. Acceptable?
11. **TTS.** If the implementer's environment cannot reach `speech.platform.bing.com`, the PR will list the lines in `pending.json` and you run `pnpm tts` before merge. OK?
