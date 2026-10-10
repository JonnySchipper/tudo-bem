# Pet Shop do Seu Dito: implementation plan

**Status:** planner spec (Fable, 10 Oct 2026) for issue #234. Written against `main` at `3b00d7494`. The implementer (Opus) ships it as **one PR** following the build order in section 11.
**Brief (Jonny):** "Make a pet store. Real building, real interior, shop owner. You can adopt cats and dogs of all types if you're a subscriber. Full feature add, huge upgrade."

## 0. Read this first

### What already exists (do not rebuild)

| Thing | Where | What it does today |
|---|---|---|
| Subscriber dog and cat | `packages/shared/src/subscription.ts` (`PetId = 'dog' \| 'cat'`, `PET_COPY`, `visiblePet`, `revertPerks`), `types.ts:248` (`PrivateProfile.pet`, `petNames`), `types.ts:95` (`PublicAvatar.pet`, `petName`) | One pet "out" at a time, chosen on the Apoiar panel (`ui/support.ts`). No adoption, no ownership list, no breeds. |
| Following and commands | `apps/client/src/render/pixel/petFollow.ts` (`createPetFollow`, `stepPet`, `parsePetCommand`: `senta`, `deita`, `vem`), `WorldScene.ts:1912` `updatePet` | Pure client logic driven by the owner's position and chat bubbles. Nothing about the pet is sent over the wire except `pub.pet` and `pub.petName`. |
| Pet art | `apps/client/assets-src/custom/pets.mjs` (`petStrips`, 24×20, 20 frames: walkE/S/N, idleS, sitE/S/N, lieE/S/N), manifest `chars/pet_dog`, `chars/pet_cat` | One caramel dog (collar added to the praça stray's side frames) and one ginger tabby, fixed colours. |
| Moderated names | `packages/shared/src/petName.ts` (`validatePetName`, `petNameDecision`, `PET_NAME_SUGGESTIONS`, `PET_NAME_MAX = 16`), server `World.namePet` (`world.ts:2307`), client `ui/petName.ts` (`openPetName`, `maybeAskPetName`, `bindPetName`) | Shape check, then the chat classifier (Jev), rejected names are flagged. No approval queue. |
| Subscription gate | `hasPerkAccess(sub, now)` (`subscription.ts:111`). Comps (`provider: 'comp'`) pass it. | The one gate. There is no `isSubscriber`. |
| Admin | `adminOps.ts` (`withProfile`, `comp`, `setItem`, `ITEM_KINDS`), `adminApi.ts` (`POST` table), `admin/main.ts` `viewPlayer` | No pet op yet; the player page only shows `pet` and `petNames`. |
| Shops | `parrotShop.ts` (`buyParrotColor`, pure rule), `World.buy` (`world.ts:2382`), `ui/panels.ts` stall kit (`stallCard`, `stallShelf`, `stallVitrine`, `stallWallet`), `styles/stalls.css` | The Puleiro is a **prop** in the praça, not a room; Nanda's hats likewise. The gi and snacks check Chebyshev distance ≤ 2 to `prop.interact`. |
| Rooms | `rooms.ts` (`RoomDef`, `PropDef`, `PortalDef`, `NpcDef`), layouts in `packages/shared/layouts/<room>.json` via `roomLayoutFiles.ts`, `buildGrid` | The escola (`rooms.ts:784`) is the newest and simplest interior: copy its shape. |
| Diary | `content/curriculum/phase0/diary-words.json` (areas + 490 words), `diaryPack.ts` rules, `diary.ts` API, server `DiaryTracker` (`apps/server/src/diary.ts`), `ui/journalView.ts` chapters | A chapter is an **area**. Four sources: camera (object), reading (sign), conversation (line), game. One Portuguese word may appear once in the whole catalog. |
| Voices | `content/voices.json`, `packages/shared/src/spokenLines.ts` (`collectSpokenLines`), `content/tts/extra-lines.json`, `pnpm tts` / `pnpm tts:check` | Lines in `NPC_TALK`, `idleLines`, `DIARY_WORDS` are found automatically. Anything else goes in `extra-lines.json`. |

### Facts that shape this plan

1. **The street is full.** `rua` (21 cols) + `rua_leste` (19 cols) = 40, asserted by `rooms.test.ts:341`. Facades on `rua_leste`: academia x0 w10, escola (`casa_3`) x10 w6, `empena_2` x16 w3. The only way to add a real building is to **widen `rua_leste` by 6 columns** (section 1).
2. **Pets are drawn from the owner's state only.** To show breeds to other players we add two small fields to `PublicAvatar`; the pet's position still never goes over the wire.
3. **Pet art is procedural in `pets.mjs`,** so "all types" is feasible by turning it into a **shape × pattern × key-colour** system (section 3.2) that reuses the character pipeline's `swapKeys` / `buildRamp`.
4. **The diary has no gates and no time windows.** Learning stays free by construction: every pet-shop word is earned by walking in, reading, petting and talking, none by adopting.
5. **`docs/brainstorm/subscription.md` is stale** ("nothing built yet"). Everything in it has shipped. Update its pet paragraph as part of this PR.

### Locks (from the issue, all honoured)

- Learning is free. No word, card or chapter is behind the subscription. Adoption words are earned by petting, not adopting.
- RV is earned only. The lojinha sells for RV; nothing sells RV.
- Chat text is never altered. Commands (`senta`, `busca`) are read from the chat line as today; the line still goes out unchanged.
- No waving animations. Seu Dito never plays the `oi` emote row. Pets have no wave pose (a tail wag is not a wave; it stays).
- No math in games. No hunger meters, no stats, no counters the player must manage. Food and toys are scenes, not systems.
- Each event gets its own reusable word list. The pet shop is a **place**, not an event; its list is the `petshop` diary area. A future "Semana da Adoção" event is sketched in section 12 with its own list.

---

## 1. Placement

### 1.1 Decision: widen Rua dos Ipês (leste) by 6 columns

`rua_leste` goes from 19 to **25** columns. The pet shop front sits at **x16–21, rows 0–5**, between the escola and the gable (`empena_2`), which moves to x22. Everything with `x >= 16` in `layouts/rua_leste.json` shifts `+6` (the empena, `arv_n3` stays at 15, `sebe_s_17` → 23, `d_buzina` → 22, the east barricade `barreira_l_8` and `sebe_l_*` → 23). The two lawn rows, sidewalks and asphalt are generated from `RUA_LESTE_COLS`, so they grow by themselves.

```ts
// packages/shared/src/rooms.ts
const RUA_CUT = 21;
const RUA_COLS = RUA_CUT;
/** The east half grew by the pet shop's front (6 tiles) in #234; the street was one 40-tile map before that. */
const PETSHOP_FRONT_W = 6;
const RUA_LESTE_COLS = 40 - RUA_CUT + PETSHOP_FRONT_W; // 25
```

Door: portal `rua_petshop` at **(19, 5)** on `rua_leste`, `doorAt: { x: 19, y: 5 }`, `to: 'petshop'`, `arrive: { x: 1, y: 6 }`, `arriveDir: 'SE'`, label `{ pt: 'Pet Shop do Seu Dito', en: 'Seu Dito’s pet shop' }`. The interior exit arrives at `{ x: 19, y: 6 }` (the test at `rooms.test.ts:316` demands `{x: door.x, y: 6}`).

Facade prop (`layouts/rua_leste.json`):
```json
{ "id": "petshop", "kind": "fachada", "x": 16, "y": 0, "w": 6, "h": 6, "blocks": true,
  "label": { "pt": "Pet Shop do Seu Dito", "en": "Seu Dito’s pet shop" }, "art": "facades/petshop" }
```
Sidewalk dressing in front (rows 6–7, x16–21): one `floreira` at (17, 7), a sandwich-board sign `cenario` `props/placa_petshop` (reads "ADOTE") at (21, 6) `blocks: true`, and a water bowl `cenario` `props/tigela_calcada` at (16, 6) `blocks: false` (the bowl shops leave out for strays). Keep the 2-tile lane in front of the door clear (x18–20, rows 6–7).

### 1.2 Everything that must change with the width

| File | Change |
|---|---|
| `packages/shared/src/rooms.ts` | `RUA_LESTE_COLS` as above; the `rua_petshop` portal; `RoomId` gains `'petshop'` (in `types.ts:57`). |
| `packages/shared/src/rooms.test.ts:341` | `expect(ROOMS.rua.cols + ROOMS.rua_leste.cols).toBe(46)` and the comment; `:293` the non-edge portal list of `rua_leste` becomes `['academia', 'aeroporto', 'escola', 'petshop']`. |
| `packages/shared/layouts/rua_leste.json` | Shift `x >= 16` by +6, add the facade and dressing. |
| `apps/client/src/ui/townMapData.ts` | `MAP_COLS = 80`; `AREA_AT.aeroporto = [50, 0]`; `petshop: place('petshop', [at('rua_leste', 16, 0, 6, 6)])`. `townMapData.test.ts:27` id list and `:67` area pairs gain `petshop`; `:84` style facade check `front('rua_leste', 'facades/petshop')`. |
| `apps/client/src/ui/townMapArt.ts` | Nothing hard-coded should break (`ruaLesteForMap()` reads `ROOMS.rua_leste`); verify the bus road still reaches the aeroporto column (`townMapData.test.ts:173`). |
| `apps/client/src/ui/introSnapshot.ts:195` | `VILA_SNAPSHOT.width = (ROOMS.rua.cols + ROOMS.rua_leste.cols) * T` (736). `introSnapshot.test.ts` adjusts. The intro pan still never shows void: the praça stays 1 tile in, the filler lawn (`grassOf`) widens with it. |
| `apps/client/src/render/pixel/surround.ts` | `STREET_EAST` derives from cols: no change. `surround.test.ts:82` still finds a facade east of the map. |
| `apps/client/src/render/pixel/ambientData.ts:104`, `scenery.ts:67`, `sceneryV2.ts:68` | Lanes use `cols`; the bus bay and manholes are west of x16: no shift. Add one lamp pool entry if the night check in `vilaIpe.test.ts:126` (`['rua_leste', 4]` lit windows) counts the new facade's windows: bump to 5. |
| `scripts/lib/areas.mjs` | `AREA_EDGES` unchanged (the shop is a door, not an area). |
| `docs/lifesim/DECISIONS.md` | Append "Pet shop (#234)" with the width decision. |

### 1.3 Facade art: `facades/petshop` (new, derived + authored)

Written in a new generator `apps/client/assets-src/custom/petshop.mjs`, registered in `custom/derive.mjs` (`petshopSet`) with its entries in `import-map.d/petshop.json`. Method:

1. Start from LimeZu's STORE front the way `buildings/shop_flores` does (kind `shop`, `9_Shopping_Center_and_Markets`), which is 80×106 (5 tiles). **Widen to 96 px** by duplicating the middle 16-px column band once (the same trick `custom/facades.mjs` used for the padaria), so the front is 6 tiles like the escola.
2. `patchSign(img, 'PET SHOP')` from `custom/shop.mjs` rewrites the plaque in the 3×5 font. Verify it fits (`text3Width('PET SHOP')` < plaque width); if not, use `'PETSHOP'`.
3. Authored dressing on top (LimeZu palette + brand colours, navy outline): an sp-green `#2F5D50` scalloped awning over the door, a mustard paw-print decal on the left window, a dog bed with a sleeping caramel dog silhouette in the left window, a cat loaf on a shelf in the right window, a hanging bone-shaped sign under the awning.
4. `findGlass(img)` gives the window rects for the night overlay (`windows`), and a `_lit` overlay (`facades/petshop_lit`) with the warm interior glow like the padaria's.
5. Manifest key `facades/petshop`, `footprint: [6, 6]`, anchor bottom-centre, `windows` reported. Add it to `townMapArt`'s facade list if it keys fronts by art (check `townMapData.test.ts:77` `front()`).

Contact sheet: `node scripts/pixel-contact.mjs --set petshop` (add the set) → `docs/lifesim/shots/petshop-art/`.

### 1.4 The interior: room `petshop`

12 × 9 tiles, ladrilho floor (`l`), wall style `padaria` (cream + wood trim) in `WALL_STYLE` (`roomLayout.ts:107`), `lighting: 'manha'`, `private: false`, spawn `(1, 6)`.

```ts
// packages/shared/src/rooms.ts
const petshop: RoomDef = {
  id: 'petshop',
  name: 'Pet Shop do Seu Dito', // needs_br: true
  gloss: 'Seu Dito’s pet shop',
  cols: 12, rows: 9,
  floor: Array.from({ length: 9 }, () => 'l'.repeat(12)),
  wallHeight: 140, wallColor: '#F5E6D3', wallTrim: '#8B5E3C', lighting: 'manha',
  spawn: { x: 1, y: 6 },
  props: bundledObjects('petshop'),
  walls: [
    { kind: 'poster', wall: 'right', from: 1, to: 3, text: 'ADOÇÃO' },
    { kind: 'quadro_racas', wall: 'right', from: 4, to: 7 },
    { kind: 'placa', wall: 'right', from: 8, to: 10, text: 'BANHO E TOSA' },
    { kind: 'janela', wall: 'right', from: 10, to: 11 },
  ],
  pixelWalls: /* same four, north wall */,
  portals: [{ id: 'petshop_rua', x: 0, y: 6, wall: 'left', to: 'rua_leste', arrive: { x: 19, y: 6 }, arriveDir: 'SW', label: { pt: 'SAÍDA · Rua', en: 'Exit to the street' } }],
  npcs: [DITO],
  private: false,
};
```

`WallDecor.kind` gains `'quadro_racas'` (the breed chart); `decorArt()` in `roomLayout.ts:124` maps it to `walls/quadro_racas`.

Floor plan (`packages/shared/layouts/petshop.json`). Column 0 is the west wall strip (the door at (0, 6) draws `doors/west` + `props/doormat`), so every prop sits at `x >= 1`. Every id is referenced later by the diary and the e2e:

```
 x: 0  1  2  3  4  5  6  7  8  9  10 11
y0  |  .  .  .  .  .  C  C  C  G  G  .      C = cercadinho (dog pen 3x2, interact 7,2)   G = gatil (cat pen 2x2, interact 9,2)
y1  |  D  .  .  .  .  C  C  C  G  G  A      D = Seu Dito (1,1)   A = arranhador (11,1)
y2  |  B  B  B  B  B  .  .  .  .  .  .      B = balcão slices (w5); caixa on (5,2), aquário on (3,2)
y3  |  .  i  .  .  .  .  .  .  .  .  .      i = interact tile of the counter (2,3)
y4  |  R  .  .  .  .  .  .  .  t  T  W      R = prateleira de ração (1,4)(1,5)   t = toalha (9,4)  T = mesa de tosa (10,4)  W = banheira (11,4)
y5  |  R  .  .  .  .  .  .  .  .  .  s      s = secador (11,5)
y6  ◄  .  p  .  .  .  .  .  .  .  .  .      ◄ = exit (0,6), spawn (1,6)   p = d_pata decal (2,6), walkable
y7  |  .  .  .  K  K  .  P  .  .  S  .      K = caminhas (4,7)(5,7)   P = pote duplo (7,7)   S = balança (10,7)
y8  |  R  c  .  .  .  .  .  .  .  .  .      R = prateleira de ração (1,8)   c = cesto de brinquedos (2,8)
```

Concrete objects (kinds in `PropKind` + `layout.ts KINDS`; new kinds marked ★):

| id | kind | x,y | w×h | blocks | action / interact | art (manifest key) |
|---|---|---|---|---|---|---|
| `balcao` | `balcao` | 1,2 | 5×1 | yes | `petshop_counter`, interact (2,3) | `props/balcao_<i>_of_5` (existing slices) |
| `caixa` | `cenario` | 5,2 | 1×1 | no | | `props/caixa` (existing), `oy: -10` |
| `aquario` | `aquario` ★ | 3,2 | 1×1 | no | | `props/aquario` (new, 2-frame bubble loop), `oy: -12` |
| `cercadinho` | `cercadinho` ★ | 6,0 | 3×2 | yes | `petshop_pen`, interact (7,2) | `props/cercadinho` (new 48×40, fence + blanket) |
| `gatil` | `gatil` ★ | 9,0 | 2×2 | yes | `petshop_pen`, interact (9,2) | `props/gatil` (new 32×44: shelf pen + cat tree) |
| `arranhador` | `cenario` | 11,1 | 1×1 | yes | | `props/arranhador` (new 16×36) |
| `prateleira_racao_1..3` | `prateleira_racao` ★ | 1,4 / 1,5 / 1,8 | 1×1 | yes | | `props/prateleira_racao` (new, bags with the `diary/racao` icon) |
| `cesto_brinquedos` | `cenario` | 2,8 | 1×1 | yes | | `props/cesto_brinquedos` (new: bin with ball, bone, mouse) |
| `caminha_1`, `caminha_2` | `cenario` | 4,7 / 5,7 | 1×1 | yes | | `props/caminha_xadrez`, `props/caminha_azul` (new; also the furniture art) |
| `pote` | `cenario` | 7,7 | 1×1 | no | | `props/pote_duplo` (new double bowl; reuses `diary/pote` pixels) |
| `balanca` | `cenario` | 10,7 | 1×1 | yes | | `props/balanca_pet` (new) |
| `mesa_tosa` | `cenario` | 10,4 | 1×1 | yes | | `props/mesa_tosa` (new) |
| `banheira` | `banheira` ★ | 11,4 | 1×1 | yes | | `props/banheira_tosa` (new, 2-frame foam) |
| `secador` | `cenario` | 11,5 | 1×1 | no | | `props/secador` (new, on the wall side) |
| `toalha` | `cenario` | 9,4 | 1×1 | no | | `props/toalha_pet` (new) |
| `d_*` diary objects | `cenario` | see §5 | 1×1 | no | | `diary/<word>` (new diary items via `custom/diaryItems.mjs`) |

Pen animals are **not props**: the client draws them (section 3.4). The `cercadinho` and `gatil` props are the furniture; their `action: 'petshop_pen'` opens the carinho / adoption flow for whatever is in that pen.

`PropAction` (`rooms.ts:54`) and `layout.ts ACTIONS` gain `'petshop_counter' | 'petshop_pen'`.

### 1.5 Art inventory for the interior

| Piece | Source | How |
|---|---|---|
| Counter, register, stools | existing `props/balcao_*`, `props/caixa` | reuse |
| Floor, walls, door, doormat | existing `l` terrain, `walls/*_padaria`, `doors/west`, `props/doormat` | reuse |
| Poster, placa, janela | existing wall decor kinds | reuse (`poster` with text `ADOÇÃO`; `placa` with `BANHO E TOSA`) |
| `walls/quadro_racas` | **new** 64×24 wall chart: six tiny silhouettes (dog big, dog small, salsicha, cat, fluffy cat, slim cat) over the words `RAÇAS` | authored in `petshop.mjs`, 3×5 font via `draw.mjs text3` |
| `props/cercadinho` 48×40, `props/gatil` 32×44, `props/arranhador`, `props/prateleira_racao`, `props/cesto_brinquedos`, `props/caminha_xadrez`, `props/caminha_azul`, `props/caminha_cesta`, `props/pote_duplo`, `props/saco_racao`, `props/balanca_pet`, `props/mesa_tosa`, `props/banheira_tosa` (2 frames), `props/secador`, `props/toalha_pet`, `props/aquario` (2 frames), `props/placa_petshop`, `props/tigela_calcada` | **new** | authored in `petshop.mjs` with `paint.mjs` (`shape`, `ell`, `box`, `NAVY`), LimeZu palette + brand colours, light upper-left, 1-px navy outline, `fx/shadow_16` contact shadows. Each with `footprint`, anchor bottom-centre. |
| `walls/poster_adocao` | optional: the generic `poster` decor already takes `text`; only author a bespoke one if the generic poster cannot show two lines | |
| Pet strips | see §3.2 | |
| `fx/carinho_0..2` | **new** 3 frames of two small hearts rising (14×14) | authored in `custom/emotefx.mjs` next to the emote pops; used by the carinho and by the kitnet |
| Portrait `portraits/dito_{neutro,feliz,surpreso,pensativo}` | pipeline | add `dito` to `NPCS` in `custom/portraits.mjs`; `pnpm pixel` renders it from the sprite |
| Item icons `icons/<itemId>` for the 13 lojinha items | **new** 16×16 | authored in `custom/icons.mjs` (DOM `<img>` in the panel, like the padaria shelf icons) |

Rule from the art bible: nothing drawn in code at runtime. All of the above is baked by `pnpm pixel` into the `outdoor` atlas (small enough; no lazy atlas needed). Add the new kinds to `apps/client/src/render/pixel/props.ts` `ART` map and the `ART_FIELD` list where `p.art` is used. `manifest.test.ts` / `art3.test.ts`-style contract test: `scripts/lib/pixel/petshop.test.mjs` (every key present, sizes, outline sealed, no magenta).

### 1.6 Other registries that must learn the room

- `packages/shared/src/roomLayoutFiles.ts` `FILES.petshop`.
- `packages/shared/src/adminTestes.ts:10` `ADMIN_TEST_ROOMS` (so Testes can jump there).
- `apps/client/src/render/pixel/roomLayout.ts:107` `WALL_STYLE.petshop = 'padaria'`.
- `apps/client/src/ambience.ts:681` `target()`: `petshop` → the `padaria` day bed (no new music in this PR; a dedicated bed is an optional follow-up with the compose-music skill).
- `apps/client/src/main.ts:942` remembered rooms: add `petshop`.
- `apps/client/src/ui/vilaGuideData.ts:22` "Lugares" line mentions the pet shop.
- `apps/client/src/ui/howToPlayData.ts`: card `petshop` (`kind: 'place'`, selector `.backdrop[data-modal="petshop"]`), goal "Meet the animals, learn their words, and (as a supporter) adopt one." Steps: pet an animal in a pen, read the signs, talk to Seu Dito, the lojinha sells with RV. Update the id list in `wayfinding.test.ts:57`.
- `apps/client/src/render/pixel/surround.test.ts:7` INTERIOR list, `dayNight.test.ts` if it enumerates interiors.
- `packages/shared/src/ambiance.ts`: **no** `ROOM_AMBIANCE` entry (no CPU crowd inside; the shop stays calm).
- Hotspots (`packages/shared/src/hotspots.ts`): `petshop_letreiro` on the facade (`rua_leste`, x17 y1 w4 h2, `PET SHOP`), and the three interior signs (`petshop_adocao`, `petshop_racas`, `petshop_banho_tosa`) so they are readable and teach words (§5).

---

## 2. Shop owner: Seu Dito

**Name:** Seu Dito (Benedito Alves). **NpcId:** `dito`. **Role:** `{ pt: 'Dono do pet shop', en: 'Pet shop owner' }`.

**Personality:** 62, grew up on a sítio in Minas, came to São Paulo at twenty and never stopped talking to animals as if they were people. Calls every customer "meu filho / minha filha", gives every animal a nickname, knows each one's habits ("essa aqui dorme de barriga pra cima"). Patient, slow, warm, proud of the shop. Never pushy: adoption is "quando o coração mandar". Lives upstairs, so he is in the shop at every hour (D12: every learning activity reachable at every game hour). No schedule, stands at (1, 1) behind the counter, `dir: 'SW'`, `interact: { x: 2, y: 3 }`.

**Look** (`NpcDef.appearance`, mirrored in `NPC_STYLES.dito` in `apps/client/src/render/pixel/looks.ts:176`): `{ body: 'forte', skin: 6, hair: 'raspado', hairColor: 4 (grey), top: 'camisa', topColor: 3 (sp-green), bottom: 'calca', bottomColor: 5 (khaki), shoes: 1, face: 'maduro', extra: 'barba', idle: 'bracos' }`, `hat: null`. Signature: the NPC apron (`prop_npc_avental`, `accent` recoloured mustard) with a small paw stamp if the apron prop accepts a decal; otherwise plain apron. He never plays the `oi` row (lock).

**Voice sheet** (`content/voices.json`, distinct from carlos 0/0, ze +6/+4, chico −6/−6, agente −4/−3, comandante −6/−5):
```json
"dito": { "voice": "pt-BR-AntonioNeural", "rate": "-3%", "pitch": "+2Hz", "about": "Seu Dito, pet shop: slow, warm, talks to the animals like people" }
```

**Registries to extend** (two are exhaustive `Record<NpcId,…>` and fail typecheck if missed): `NpcId` (`rooms.ts:120`); `CONVERSA_CAST` (`conversa.ts:130`, `{ npc: 'dito', name: 'Seu Dito', room: 'petshop', enabled: false, subjects: [] }`); `NPC_STYLES` (`looks.ts:176`); `NPC_IDS` (`bonds.ts:24`); `SPEAKER` (`ui/npcTalk.ts:34`); `SPEAKER_ROLE` / `SPEAKER_ROLE_EN` (`ui/recados.ts:40,52`); `NPCS` in `custom/portraits.mjs`; `content/voices.json`.

### 2.1 Dialogue (PT with EN gloss). All `needs_br: true`; file in BR-REVIEW section W.

**Talk tree** (`NPC_TALK.dito` in `packages/shared/src/npcTalk.ts`; `openNpcTalk` gains two special `next` values: `'adopt'` → `hooks.openAdopt()` and `'petshop'` → `hooks.openShop()` on the lojinha tab):

| node | line (PT) | EN | chips → next |
|---|---|---|---|
| `oi` (start) | {saudacao}, {nome}! Bem-vindo ao pet shop. Quer ver os bichinhos? | {greeting}, {name}! Welcome to the pet shop. Want to see the little animals? | "Quero ver os bichinhos." / "I want to see the animals." → `bichos` · "O que tem na loja?" / "What's in the shop?" → `loja` |
| `bichos` | Tem cachorro e gato esperando um lar. Pode fazer carinho, eles adoram. | There are dogs and cats waiting for a home. You can pet them, they love it. | "Posso adotar um?" / "Can I adopt one?" → `adotar` · "Vou fazer carinho." / "I'll go pet them." → `end` |
| `adotar` | Vamos ver quem tá esperando um lar! Escolhe com calma, viu? | Let's see who's waiting for a home! Choose calmly, okay? | "Quero ver!" / "Show me!" → `adopt` · "Deixa eu pensar." / "Let me think." → `end` |
| `loja` | Tem ração, brinquedo, coleira e caminha. Tudo com reais virtuais, {nome}. | There's food, toys, collars and beds. All with virtual reais, {name}. | "Quero ver a lojinha." / "I want to see the shop." → `petshop` · "E banho e tosa?" / "And bath and grooming?" → `tosa` |
| `tosa` | O banho e tosa é ali no canto. O bichinho sai cheiroso! | The bath and grooming is over in the corner. The little one comes out smelling great! | "Que legal!" / "Nice!" → `end` · "{obrigad}, Seu Dito." / "Thank you, Seu Dito." → `end` |

**Idle lines** (`NpcDef.idleLines`, each is a diary line anchor `dito.idle0..3`):

| # | PT | EN | teaches |
|---|---|---|---|
| idle0 | Hoje chegou um filhote novo! | A new puppy arrived today! | filhote |
| idle1 | Carinho atrás da orelha, eles adoram. | A scratch behind the ear, they love it. | orelha |
| idle2 | Senta! Isso. Bom menino. | Sit! That's it. Good boy. | (senta is a command word; see §5) |
| idle3 | Vira-lata é o cachorro mais fiel que existe. | A mutt is the most loyal dog there is. | vira-lata |

**Pen lines** (new anchor family `dito.pen_<key>`, spoken when you pet an animal; the server picks by species and a rotating index; see §5 and §7):

| key | PT | EN | teaches |
|---|---|---|---|
| `pen_dog_1` | Olha o rabo abanando! Ele gostou de você. | Look at the tail wagging! He liked you. | rabo |
| `pen_dog_2` | Essa aqui adora carinho na barriga. | This one loves a belly rub. | carinho |
| `pen_dog_3` | Cuidado, ele lambe o nariz de todo mundo! | Careful, he licks everyone's nose! | nariz |
| `pen_cat_1` | Tá ouvindo? Ele tá ronronando. | Hear that? He's purring. | ronronando (`match`) |
| `pen_cat_2` | Olha o bigode dela, todo arrepiado. | Look at her whiskers, all bristled. | bigode |
| `pen_cat_3` | Esse gato brinca com tudo. Até com o rabo! | This cat plays with everything. Even its tail! | brinca (`match`) |

**Adoption and shop lines** (spoken by the panel through `speak(text, { speaker: 'dito' })`, listed in `content/tts/extra-lines.json`):

| id (for `PETSHOP_LINES` in `petShop.ts`) | PT | EN |
|---|---|---|
| `adopt_pick` | Esse aqui? Boa escolha. Agora é só dar um nome. | This one? Good choice. Now just give a name. |
| `adopt_done` | Parabéns! Agora faz parte da família. | Congratulations! Now it's part of the family. |
| `adopt_full` | Seis já é uma matilha, {nome}! Deixa um em casa primeiro. | Six is already a pack, {name}! Leave one at home first. (spoken nameless) |
| `gate` | Adoção é pra quem apoia a Vila. Mas carinho é de graça, viu? | Adoption is for those who support the Vila. But petting is free, okay? |
| `buy_done` | Prontinho. Seu bichinho vai adorar. | All set. Your pet will love it. |
| `buy_short` | Faltam uns reais virtuais ainda. Volta depois, sem pressa. | You're a few virtual reais short. Come back later, no rush. |
| `switch_out` | Vai passear? Leva a guia! | Going for a walk? Take the leash! |
| `switch_home` | Deixa em casa que eu sei que ele fica bem. | Leave it at home, I know it'll be fine. |

### 2.2 TTS line list

Everything above is spoken by `dito` except the diary words (speaker `ui`). `collectSpokenLines` finds the talk tree (all greetings × ele/ela, nameless), the idle lines and the diary words by itself. Add to `content/tts/extra-lines.json`: the six pen lines and the eight adoption/shop lines (nameless forms). Then:

```bash
pnpm tts          # bakes only the missing clips; commits apps/client/public/audio/tts/*.mp3 + manifest.json
pnpm tts:check    # must print 0 missing
```

Expected new clips: 5 nodes × 3 greetings × 2 pronouns ≈ 30 (fewer: only `oi` has `{saudacao}`), + 4 idle + 6 pen + 8 shop + ~40 words ≈ **90 clips**. If the implementer's environment cannot reach `speech.platform.bing.com`, run `pnpm tts:check -- --update-pending` so `pending.json` lists them and `spoken.test.ts` passes, and say so in the PR; Jonny bakes them before merge (CLAUDE.md rule).

---

## 3. Adoption

### 3.1 Catalog: `packages/shared/src/petBreeds.ts`

```ts
export type PetSpecies = 'dog' | 'cat';
export type DogShape = 'medio' | 'grande' | 'pequeno' | 'peludo' | 'salsicha';
export type CatShape = 'comum' | 'peludo' | 'esguio';
export type PetShape = DogShape | CatShape;
/** Marking masks drawn in the `coat2` key ramp over the `coat` base. */
export type PetPattern = 'solido' | 'peito' | 'manchado' | 'pintado' | 'tigrado' | 'sela' | 'pontas';
export interface CoatOption { id: string; pt: string; en: string; coat: string; coat2: string; }
export interface BreedDef {
  id: string; species: PetSpecies; pt: string; en: string;
  shape: PetShape; pattern: PetPattern;
  /** First entry is the default coat. */
  coats: CoatOption[];
  size: 'pequeno' | 'medio' | 'grande';
  /** Brazilian breed or type: shown first in the pens and the catalog. */
  br?: boolean;
  needsBr?: boolean;
}
export const BREEDS: BreedDef[];
export const breedById = (id: string) => BREEDS.find((b) => b.id === id);
export const coatOf = (breed: BreedDef, coatId: string | null | undefined) => breed.coats.find((c) => c.id === coatId) ?? breed.coats[0];
export interface PetLook { species: PetSpecies; shape: PetShape; pattern: PetPattern; coat: string; coat2: string; collar: string; }
export const petLook = (breedId: string, coatId: string | null, collar: string | null): PetLook;
/** Every (species, shape, pattern) strip the art pipeline must bake: derived from BREEDS, tested against the manifest. */
export const petStripKeys = (): string[]; // `chars/pet_${species}_${shape}_${pattern}`
```

**Dogs (24).** `br` marks Brazilian types; the first coat is the default.

| id | pt | en | shape | pattern | coats (id: coat / coat2) |
|---|---|---|---|---|---|
| `vira_lata_caramelo` br | Vira-lata caramelo | Caramel mutt | medio | peito | caramelo `#daa463`/cream · (the one and only; it is a cultural icon) |
| `vira_lata` br | Vira-lata | Mutt (SRD) | medio | manchado | preto_branco · marrom_branco · cinza · tricolor |
| `fila_brasileiro` br | Fila brasileiro | Fila Brasileiro | grande | pontas | fulvo (fawn, dark mask) · tigrado (switch pattern to `tigrado`, see note) · preto |
| `terrier_brasileiro` br | Terrier brasileiro (Fox Paulistinha) | Brazilian Terrier | pequeno | manchado | tricolor branco/preto · branco/marrom |
| `labrador` | Labrador | Labrador | grande | solido | amarelo · chocolate · preto |
| `golden` | Golden retriever | Golden retriever | grande | solido | dourado · creme |
| `pastor_alemao` | Pastor-alemão | German shepherd | grande | sela | preto/castanho · preto |
| `rottweiler` | Rottweiler | Rottweiler | grande | sela | preto/ferrugem |
| `boxer` | Boxer | Boxer | grande | pontas | fulvo · tigrado |
| `husky` | Husky siberiano | Siberian husky | grande | peito | cinza/branco · preto/branco · ruivo/branco |
| `border_collie` | Border collie | Border collie | medio | peito | preto/branco · marrom/branco · merle (cinza mesclado) |
| `beagle` | Beagle | Beagle | medio | sela | tricolor · limão/branco |
| `cocker` | Cocker spaniel | Cocker spaniel | medio | solido | dourado · preto · chocolate |
| `dalmata` | Dálmata | Dalmatian | grande | pintado | branco/preto · branco/fígado |
| `poodle` | Poodle | Poodle | peludo | solido | branco · preto · damasco · cinza |
| `shih_tzu` | Shih-tzu | Shih Tzu | peludo | manchado | dourado/branco · preto/branco · cinza/branco |
| `lhasa_apso` | Lhasa apso | Lhasa Apso | peludo | solido | dourado · creme · preto/branco (manchado) |
| `maltes` | Maltês | Maltese | peludo | solido | branco |
| `yorkshire` | Yorkshire | Yorkshire terrier | peludo | sela | aço/dourado |
| `spitz_alemao` | Spitz alemão (lulu-da-pomerânia) | Pomeranian | peludo | solido | laranja · creme · preto |
| `pinscher` | Pinscher | Miniature pinscher | pequeno | sela | preto/castanho · vermelho |
| `chihuahua` | Chihuahua | Chihuahua | pequeno | solido | caramelo · preto · branco · chocolate |
| `buldogue_frances` | Buldogue francês | French bulldog | pequeno | manchado | tigrado (pattern `tigrado`) · fulvo · preto/branco · creme |
| `pug` | Pug | Pug | pequeno | pontas | fulvo (máscara preta) · preto |
| `dachshund` | Dachshund (salsicha) | Dachshund | salsicha | sela | preto/castanho · vermelho · chocolate · arlequim (manchado) |

Note: a breed is one `pattern`; a coat that needs another pattern (fila tigrado, buldogue tigrado, lhasa manchado, dachshund arlequim) is modelled as a **separate `BreedDef` with the same `pt`** and id suffix (`fila_brasileiro_tigrado`), grouped in the UI by `pt`. Keeps the look a pure function of `(breed, coat)`.

**Cats (14).**

| id | pt | en | shape | pattern | coats |
|---|---|---|---|---|---|
| `gato_srd` br | Gato vira-lata (SRD) | Mixed-breed cat | comum | solido | preto · branco · cinza · laranja |
| `gato_laranja` br | Gato laranja | Orange cat | comum | tigrado | laranja/creme (the meme cat; Brazilians love him) |
| `frajola` br | Frajola (preto e branco) | Tuxedo cat | comum | peito | preto/branco |
| `escaminha` br | Gata escaminha (casco de tartaruga) | Tortoiseshell | comum | manchado | preto/laranja · tricolor (with white) |
| `tigrado` | Gato tigrado | Tabby cat | comum | tigrado | cinza · marrom |
| `siames` | Siamês | Siamese | esguio | pontas | seal · blue · chocolate · lilás |
| `persa` | Persa | Persian | peludo | solido | branco · creme · cinza · preto |
| `maine_coon` | Maine coon | Maine Coon | peludo | tigrado | marrom · cinza · ruivo |
| `ragdoll` | Ragdoll | Ragdoll | peludo | pontas | seal/branco · blue/branco |
| `angora` | Angorá | Angora | peludo | solido | branco |
| `british` | British shorthair | British Shorthair | comum | solido | azul (cinza-azulado) · lilás · creme |
| `bengal` | Bengal | Bengal | esguio | pintado | dourado/preto · prata/preto |
| `sphynx` | Sphynx | Sphynx | esguio | solido | rosa · cinza |
| `oriental` | Oriental | Oriental shorthair | esguio | solido | preto · branco · chocolate |

Every `pt` and `en` is `needs_br` and goes into BR-REVIEW section W.

### 3.2 Sprite plan: shape × pattern strips, key-coloured, recoloured at runtime

Refactor `apps/client/assets-src/custom/pets.mjs` (keep the frame contract, 24×20, 20 frames, `PET_ANIMS`, side views face east; the existing `pets.test.mjs` keeps passing on the vira-lata strip):

1. **Key colours.** Add to `KEY_RAMPS` in `apps/client/src/render/pixel/palette.ts` (so `manifest.keyRamps` carries them): `coat` (4 ranks), `coat2` (4 ranks), `collar` (2 ranks). Draw every frame with these instead of `COAT`/`FAR`/`CREAM`/`GINGER`/`COLLAR`. Eyes, nose, inner ear pink and the navy outline stay fixed.
2. **Shapes.** One generator per shape, each producing the 20 frames: dogs `medio` (today's dog, from `dog.mjs` + front/back/sit/lie), `grande` (deeper chest, +2 px taller, floppy ears, straight tail), `pequeno` (big head, short legs, bat ears, curled tail), `peludo` (fluffy outline, hair hides the legs, top-knot), `salsicha` (long low body, short legs, long ears); cats `comum` (today's cat), `peludo` (ruff, plumed tail, rounder), `esguio` (long legs, big ears, whip tail, narrow face). Share `leg`, `eye`, `sealOutline`, `fit`, the walk bob and the lift tables.
3. **Patterns** are mask functions `(shape, frameIndex, x, y) → boolean` applied after the base coat: pixels inside the mask become the `coat2` rank matching the `coat` rank they replace. `solido` none; `peito` chest, muzzle, socks and tail tip; `manchado` two or three patches (head one side, back, rump) from a per-shape patch table; `pintado` scattered dots (hash of x,y, density 0.18); `tigrado` diagonal stripes on back and legs; `sela` a saddle over the back plus the ear tops, with `coat2` cheeks (the tan points); `pontas` ears, mask, paws and tail tip.
4. **Bake only what the catalog uses.** `custom/petshapes.mjs` exports `PET_STRIPS = [{ species, shape, pattern }]` (the distinct combos in §3.1: 20 dog + 10 cat = 30). `petStrips()` returns `chars/pet_<species>_<shape>_<pattern>` for each, plus the legacy keys `chars/pet_dog` = `pet_dog_medio_peito` and `chars/pet_cat` = `pet_cat_comum_tigrado` in their **final colours** (so nothing that reads the old keys breaks before Phase 4 of the build). `petBreeds.test.ts` loads `public/pixel/manifest.json` and asserts every `petStripKeys()` entry exists.
5. **Runtime compose** in a new `apps/client/src/render/pixel/petLook.ts`:
   ```ts
   export const petTextureKey = (l: PetLook) => `pet:${l.species}:${l.shape}:${l.pattern}:${l.coat}:${l.coat2}:${l.collar}`;
   /** Loads the key-coloured strip (manifest.chars), swaps coat / coat2 / collar ramps, adds the spritesheet + anims. LRU 32, evicts textures. */
   export function ensurePetTexture(scene: Phaser.Scene, look: PetLook): string;
   ```
   Uses `buildRamp(base)` and `swapKeys` from `charcompose.ts` (pure, already unit-tested). Animations are created per texture key with the existing `createPetAnims` (parameterised by key). All strips are preloaded in `preload` (each is 480×20; about 30 files, a few KB each).
6. **Collar** is the `collar` ramp; a collar item (§6) sets `look.collar`; no collar = the mustard default.
7. **Contact sheet** `scripts/pet-breeds-sheet.mjs` → `docs/lifesim/shots/petshop-art/breeds.png`: every breed × coat, idle S and walk E, at 4×. Opus reviews it with the Beauty checklist (`docs/lifesim/HOWTO.md` §4.6) before opening the PR.

No wave pose, no new emotes.

### 3.3 Ownership model

```ts
// packages/shared/src/petShop.ts
export const PET_MAX_OWNED = 6;
export interface OwnedPet {
  id: string;              // `p<base36 time><2 random>`; stable, never reused
  species: PetSpecies;
  breed: string;           // BreedDef.id
  coat: string;            // CoatOption.id
  name: string | null;     // moderated like today
  collar: string | null;   // PET_ITEMS id of kind 'coleira'
  toy: string | null;      // PET_ITEMS id of kind 'brinquedo'
  adoptedAt: number;       // unix ms (server clock)
  legacy?: true;           // migrated from `pet` / `petNames`
}
export interface PetOwner { pets?: OwnedPet[]; activePetId?: string | null; petItems?: string[]; pet?: 'dog' | 'cat' | null; petNames?: { dog?: string; cat?: string } }
export function normalizePets(p: PetOwner): { pets: OwnedPet[]; activePetId: string | null; petItems: string[] };
export function activePet(p: PetOwner): OwnedPet | null;
export function adoptPet(p: PetOwner, breedId: string, coatId: string, now: number, id: string): 'ok' | 'unknown' | 'full';
export function setActivePet(p: PetOwner, petId: string | null): 'ok' | 'unknown';
export function renameOwnedPet(p: PetOwner, petId: string, name: string): boolean;
export function releasePet(p: PetOwner, petId: string): boolean; // admin only; never from the game
```

**Migration (in `normalizePets`, run from `normalizeProfile`, idempotent):** if `pets` is missing and `pet` or `petNames` is set, create `{ id: 'legacy_dog', breed: 'vira_lata_caramelo', coat: 'caramelo', name: petNames.dog ?? null, legacy: true }` and/or `legacy_cat` (`gato_laranja`, `laranja`, `petNames.cat`); `activePetId = p.pet ? 'legacy_' + p.pet : null`. Keep writing `p.pet = activePet(p)?.species ?? null` and `p.petNames` as **mirrors** on every save for one release (older clients, `subscriber-perk-shots.mjs`, leaderboards tests read them). `PET_NAME_SUGGESTIONS` and `validatePetName` are reused unchanged.

**Limits and rules (decisions):**
- A player owns up to **6** pets. The 7th adoption is refused with `adopt_full`.
- Exactly one pet is **active** (out, following). The others **live in the kitnet** (§3.5).
- Any owned pet can be adopted again? No: each adoption creates a new pet; there is no duplicate limit per breed (two caramelos with different names is fine).
- Adoption costs **no RV** (it is a subscriber perk, and selling animals for coins reads badly). The lojinha costs RV.
- Names are per pet (`OwnedPet.name`), moderated by the same `namePet` path, max 16 chars.

### 3.4 The flow: browse → meet → name → confirm

Everything happens in one DOM panel, `apps/client/src/ui/petShop.ts` (`openPetShop(tab, actions)`, modal id `petshop`, styles in `styles/petShop.css` reusing the stall kit classes from `stalls.css`), with three tabs: **Adotar**, **Meus pets**, **Lojinha**.

**Pens (the world side).** `PET_PENS` in `petShop.ts`: `{ id: 'cercadinho', species: 'dog', tiles: [[6,0],[7,0],[8,0],[6,1],[7,1],[8,1]], shows: 3 }` and `{ id: 'gatil', species: 'cat', tiles: [[9,0],[10,0],[9,1],[10,1]], shows: 2 }`. `penLitter(penId, gameDay)` picks the animals of the day deterministically: Brazilian types weighted ×2, breed and coat chosen by `hash(gameDay, penId, slot)`, never two of the same breed in one pen. The client (`WorldScene` `buildRoom` for `petshop`, new `penPets.ts`) draws them with `ensurePetTexture`, idle/sit/lie, each on its own tile, drifting one tile every 6–14 s inside the pen (deterministic from the clock so every player sees the same litter). They are hit targets (`kind: 'pen'`) that resolve to the pen's `action`.

**Browse.** Click a pen or the counter → walk to `interact` → `propAction('petshop_pen' | 'petshop_counter')` → `openPetShop('adotar' | 'lojinha')`. The Adotar tab shows two shelves: **"Na loja hoje"** (the litter: big cards with the live sprite at 4× idle S, breed `pt · en`, coat name) and **"Catálogo de raças"** (every breed grouped by species, Brazilian first, each with its coats as swatches). Non-subscribers see the same shelves plus the gate card (§4).

**Meet.** A card click opens the meet view: the sprite walks E/S/N in a loop, a line of Seu Dito for the species (`adopt_pick` spoken), and **Fazer carinho** (sends `{t:'pet', action:'carinho', penId}`, plays `fx/carinho`, earns the pen word; works for everyone, 1 per animal per visit, no cooldown nag) and **Adotar** (subscribers; otherwise the Apoiar card).

**Name.** Adotar opens the existing name dialog (`ui/petName.ts`, generalised: `openPetName({ species, suggest, onSave })`) with Sortear and the 16-char rule. The name is validated **on the server as part of the adopt message**, so one round trip: `{ t: 'pet', action: 'adopt', breed, coat, name }`. A rejected name returns `error code 'petName'` (same as today) and the dialog stays open.

**Confirm.** Server replies with the new profile (`pets` + `activePetId` set to the new pet, which immediately follows you out of the shop), `notice level 'reward'` with `adopt_done`, and the panel plays the sticker thump used by the Diário. The old active pet goes home.

**Switching the active pet.** Meus pets tab: a row per owned pet (sprite, name or "sem nome", breed) with **Levar** / **Em casa** (`{t:'pet', action:'active', petId | null}`), **Renomear** (`{t:'pet', action:'rename', petId, name}`), collar and toy pickers (§6). The same list replaces the Nenhum/Cachorro/Gato buttons in `ui/support.ts` (plus a link "Adotar no Pet Shop" that opens the Mapa on the shop). In the kitnet, clicking a resting pet opens a tiny two-button card: Levar / Fechar.

**Legacy message** `{t:'perk', action:'pet', pet}` stays: `'dog'`/`'cat'` activates the first owned pet of that species, `null` sends everyone home; with no such pet → `err('perk', 'Adote um no Pet Shop do Seu Dito.', 'Adopt one at Seu Dito’s pet shop.')`.

### 3.5 Where pets live: the kitnet

Owned, inactive pets rest in the owner's kitnet. Server: when a session joins a `kitnet` instance, `roomState` gains `homePets?: HomePet[]` (`{ id, look: PetLook, name, pose: 'lie' | 'sit' | 'idle', tile }`) computed from the **owner's** profile (`ownerId` of the instance), so visitors see them too. Positions come from `homePetSpots(apartment, pets)` in `petShop.ts`: a placed `caminha_*` furniture first (one pet per bed, pose `lie`), then the `tapete` if any (`lie`), then fixed free tiles `[(6,5), (4,6), (2,2), (6,3)]` (`sit`/`idle`), skipping blocked tiles. Client `homePets.ts` draws them with `ensurePetTexture`, blink and a slow pose change every 20–40 s. The active pet is not in the list (it is behind you). On `avatarUpdated`/`profile` changes the server re-sends `homePets` with a small `{ t: 'homePets', pets }` message to everyone in that instance.

Lapsed subscription: pets still rest in the kitnet (it is their home, and nothing is deleted); they cannot be taken out (§4).

---

## 4. Subscriber gate

- **Adopt** requires `hasPerkAccess(p.subscription, now)` (active, cancelled-in-period, dev, or **comp** from the admin). Server refuses otherwise with `err('petshop', PETSHOP_LINES.gate)`.
- **Take a pet out** (`action: 'active'` with a non-null id) requires the same. `publicAvatar` keeps doing `visiblePet(...)` with the access check, now reading `activePet(p)`.
- **Everything else is open to everyone:** entering, petting (and its diary words), talking to Seu Dito, reading signs, the lojinha (beds and ração are furniture; collars and toys sit in `petItems` until a pet exists).
- **The upsell** is one inline card in the Adotar tab for non-subscribers, under the pens, never a modal, never repeated as a toast: Seu Dito's `gate` line (spoken once per panel open), the perk list in two lines, and two buttons: **Apoiar a Vila** (opens the existing `openSupport`) and **Só olhar** (closes the card for this session). `showSupportButton` logic unchanged; when billing is off (`billingReady === false`) the card says "Em breve" and has no button.
- **Admin comp** already grants access; add the direct **grant pet** op (§7.4) for cases where Jonny wants to gift one animal without a comp.
- **Lapse:** `revertPerks` (`subscription.ts:178`) changes from `p.pet = null` to `p.activePetId = null` (and the `pet` mirror). `pets`, names, collars and toys are **kept forever**. Re-subscribing shows the Meus pets list again with everything intact. `wipeProgress` (admin reset) keeps pets as it keeps the subscription today.
- **Rankings:** nothing here touches `learningLeaderboard`; the diary words are free, so they count like any other place's.

---

## 5. Learning

### 5.1 The `petshop` diary chapter

Add the area `{ "id": "petshop", "pt": "Pet Shop", "en": "Pet shop" }` to `diary-words.json` and the words below (~38). Rules enforced by `diaryPackProblems`: unique Portuguese across the whole catalog (accents and case ignored), camera → an object in `layouts/petshop.json` (or `DIARY_PLACEMENTS`), reading → a hotspot whose text contains the word, conversation → a line that contains it (`match` for inflected forms). **Already taken, do not reuse:** coleira, tigela, ração, gato, cama, tapete, pote, água, guia, escova, lata, saco, sacola, balança, papagaio, pombo. The implementer runs `pnpm test -- diary` after adding and renames any collision to the form listed in the "if taken" column.

| word (pt) | en | source | anchor | if taken |
|---|---|---|---|---|
| cachorro | dog | camera | object `cercadinho` | cachorrinho |
| filhote | puppy / kitten | conversation | `dito.idle0` | |
| gatinho | kitten | camera | object `gatil` | gatil (the pen) |
| arranhador | scratching post | camera | `arranhador` | |
| cercadinho | pen | camera | `d_cercadinho` (diary item on the pen fence) | |
| aquário | aquarium | camera | `aquario` | |
| peixe | fish | camera | `d_peixe` (1×1 on the counter) | peixinho |
| caminha | pet bed | camera | `caminha_1` (also `caminha_2`) | |
| brinquedo | toy | camera | `cesto_brinquedos` | |
| bolinha | little ball | camera | `d_bolinha` | |
| ossinho | little bone | camera | `d_ossinho` | osso |
| pelúcia | plush toy | camera | `d_pelucia` | |
| petisco | treat | reading | sign `petshop_lojinha` ("RAÇÃO · PETISCO · BRINQUEDO") | |
| prateleira de ração | pet-food shelf | camera | `prateleira_racao_1` (also `_2`, `_3`) | (a `diary/prateleira` item exists, so plain "prateleira" is likely taken) |
| banheira | bathtub | camera | `banheira` | |
| banho | bath | reading | sign `petshop_banho_tosa` ("BANHO E TOSA") | |
| tosa | grooming | reading | sign `petshop_banho_tosa` | |
| secador | hair dryer | camera | `secador` | |
| toalha | towel | camera | `toalha` | (taken? → toalhinha) |
| xampu | shampoo | camera | `d_xampu` | |
| adoção | adoption | reading | sign `petshop_adocao` ("ADOÇÃO · ADOTE UM AMIGO") | |
| raça | breed | reading | sign `petshop_racas` (the chart: "RAÇAS · VIRA-LATA · FILA BRASILEIRO · POODLE · SIAMÊS · PERSA") | |
| vira-lata | mutt | reading | sign `petshop_racas` | (praça has "Viralata Caramello": different key, allowed) |
| fila brasileiro | Fila Brasileiro | reading | sign `petshop_racas` | |
| poodle | poodle | reading | sign `petshop_racas` | |
| siamês | Siamese | reading | sign `petshop_racas` | |
| persa | Persian | reading | sign `petshop_racas` | |
| pet shop | pet shop | reading | hotspot `petshop_letreiro` (facade, "PET SHOP") | |
| carinho | affection / petting | conversation | `dito.pen_dog_2` | |
| rabo | tail | conversation | `dito.pen_dog_1` | rabinho |
| nariz | nose | conversation | `dito.pen_dog_3` | focinho |
| orelha | ear | conversation | `dito.idle1` | |
| ronronar | to purr | conversation | `dito.pen_cat_1`, `match: "ronronando"` | |
| bigode | whiskers | conversation | `dito.pen_cat_2` | (taken by the avatar extra? the diary has no "bigode"; verify) |
| brincar | to play | conversation | `dito.pen_cat_3`, `match: "brinca"` | |
| senta | sit! | conversation | `dito.idle2` | sentar |
| pata | paw | camera | `d_pata` (paw-print decal on the floor by the door) | patinha |
| veterinário | vet | reading | sign `petshop_vet` on the north wall ("VETERINÁRIO · TERÇA E QUINTA") | |

Words tied to **taking part**: the six pen words are earned only by petting an animal (free), the sign words by reading, the rest by photographing. No word is earned by adopting, so the chapter is completable by a free player. The pen words are **conversation** words anchored to a new `DiaryLineKind` `'pen'`: `diaryLine('dito.pen_dog_1')` resolves from `PEN_LINES` in `petShop.ts` (extend `packages/shared/src/diaryLines.ts` with the family, mirroring `COUNTER_LINES`).

### 5.2 Everything the new area touches

- `packages/shared/src/diary.test.ts:116` `TOTALS.petshop = [camera, reading, conversation, game]` counts, `toHaveLength(490 + N)`, origin counts, `roomsOf.petshop = 'petshop'`.
- `apps/server/src/diaryCatalog.test.ts:76,187` literal totals; it must be able to earn every word: camera by photo range (`PHOTO_RANGE` 8 covers a 12×9 room from the spawn), reading via `{t:'read', hotspotId}`, conversation via `{t:'diary', action:'line', anchor}` for idle/talk lines and via `{t:'pet', action:'carinho'}` for the pen lines (the server earns the line itself after the proximity check, calling `DiaryTracker.earnLine(s, anchor)`; add that small public method).
- `packages/shared/src/diaryWorld.ts` `DIARY_PLACEMENTS`: the `d_*` items above (`art: 'diary/<word>'`, drawn by `custom/diaryItems.mjs` grids in `custom/diary/petshop.mjs`, entries in `import-map.d/diary.json`).
- `packages/shared/src/hotspots.ts`: the five signs.
- `apps/client/src/ui/journalView.ts` `CHAPTER_STYLE.petshop = { color: '#2F5D50', ink: '#F5E6D3', emblem: 'pata' }`; `journalArt.ts` `EMBLEMS.pata` (a 12×12 paw).
- `packages/shared/src/escola.ts:396` `UNIT_ORDER` gains `petshop` after `escola`; `AREA_IN.petshop = 'no pet shop'`; `GAME_HINT` n/a (no game words). `escola.test.ts:343` list.
- `docs/lifesim/BR-REVIEW.md`: new section **W. Pet shop** with every PT string of this PR (words, lines, item names, UI copy), all `needs_br`.
- The how-found hints in `journalView.ts howFound()` already say "Fotografe algo em: Pet Shop" / "Converse com Seu Dito" from the area and the speaker; verify the speaker name resolves for `dito`.

### 5.3 Caderno

No new lexeme deck in this PR (the Diário is the learning surface for places). The three commands the pet obeys (`senta`, `deita`, `vem`) plus the two toy commands (`busca`, `brinca`) show in the Meus pets tab as a bilingual cheat sheet with 🔊 (speaker `ui`, so they need clips: add the five words to `extra-lines.json`).

---

## 6. Optional RV items: the lojinha

`PET_ITEMS` in `packages/shared/src/petShop.ts`, bought with **earned RV only**, no RV sold anywhere:

| id | kind | pt | en | RV | effect |
|---|---|---|---|---|---|
| `coleira_vermelha` | coleira | Coleira vermelha | Red collar | 8 | `OwnedPet.collar`; swaps the `collar` ramp; everyone sees it |
| `coleira_azul` | coleira | Coleira azul | Blue collar | 8 | |
| `coleira_verde` | coleira | Coleira verde | Green collar | 8 | |
| `coleira_rosa` | coleira | Coleira rosa | Pink collar | 8 | |
| `bandana_brasil` | coleira | Bandana do Brasil | Brazil bandana | 15 | collar ramp green + a yellow pixel; same slot |
| `bolinha` | brinquedo | Bolinha | Little ball | 10 | dogs: chat `busca` (`busca!`, `pega a bolinha`): the pet runs 3 tiles ahead and trots back (new `PetVoice` `'fetch'` in `petFollow.ts`) |
| `ratinho` | brinquedo | Ratinho de pano | Toy mouse | 10 | cats: chat `brinca`: pounce loop (sitS → idleS alternating 2 s) |
| `ossinho` | brinquedo | Ossinho | Little bone | 12 | dogs: carried on the lie pose (a 6×3 overlay sprite `fx/ossinho`) |
| `pelucia` | brinquedo | Pelúcia | Plush toy | 12 | both: carried on the lie pose (`fx/pelucia`) |
| `caminha_xadrez` | caminha | Caminha xadrez | Plaid pet bed | 20 | kitnet furniture `kind: 'caminha'`; a home pet lies on it |
| `caminha_azul` | caminha | Caminha azul | Blue pet bed | 20 | |
| `caminha_cesta` | caminha | Cesta de vime | Wicker basket | 25 | |
| `saco_racao` | racao | Saco de ração + pote | Food bag + bowl | 15 | kitnet furniture; when you enter, home pets gather at it for 6 s (idle S facing the bowl) then go back. No hunger, no timer, no numbers. |

Prices sit inside the existing range (hats 0–60, furniture 10–45, parrots 0–20). Beds and the ração are entries in `FURNITURE` (`catalog.ts`) with a new optional field `shop: 'petshop'` so the kitnet atelier **hides** them and `World.buy('furniture')` refuses them (sold only via `{t:'pet', action:'buy'}`). Collars and toys live in `p.petItems: string[]` (one of each, like hats) and are equipped per pet with `{t:'pet', action:'equip', petId, slot: 'collar' | 'toy', itemId | null}`. Purchases are refused outside the shop (`s.instance.def.id !== 'petshop'`) or further than 2 tiles from the counter's `interact`, like the gi. The toy commands follow the `senta` rule: the chat line is sent unchanged; the pet reacts on top (`parsePetCommand` gains `busca` → `'fetch'`, `brinca` → `'play'`, both only when `pub.petToy` allows).

`PublicAvatar` gains `petBreed?: string`, `petCoat?: string`, `petCollar?: string | null`, `petToy?: string | null` (all set from `activePet(p)` in `World.publicAvatar`, hidden with the same `hasPerkAccess` check).

---

## 7. Server

### 7.1 Profile data model (`packages/shared/src/types.ts`)

```ts
// PrivateProfile (add; keep `pet` and `petNames` as mirrors for one release)
pets?: OwnedPet[];
activePetId?: string | null;
petItems?: string[];
// PublicAvatar (add)
petBreed?: string; petCoat?: string; petCollar?: string | null; petToy?: string | null;
```
`StoredProfile` needs nothing server-only. `toPrivate` strips nothing new. SQLite: profiles are one JSON row (`profiles(id, json)`), **no schema migration**; `normalizeProfile` (`store.ts:311`) gains:
```ts
const n = normalizePets(p);
p.pets = n.pets; p.activePetId = n.activePetId; p.petItems = n.petItems;
p.pet = activePet(p)?.species ?? null;                 // mirror
p.petNames = mirrorPetNames(p);                         // first named dog / cat
```
`docs/SQLITE.md` gets one line: pets live on the profile JSON.

### 7.2 Protocol (`packages/shared/src/protocol.ts`)

```ts
// ClientMsg
| { t: 'pet'; action: 'adopt'; breed: string; coat: string; name: string }
| { t: 'pet'; action: 'active'; petId: string | null }
| { t: 'pet'; action: 'rename'; petId: string; name: string }
| { t: 'pet'; action: 'buy'; itemId: string }
| { t: 'pet'; action: 'equip'; petId: string; slot: 'collar' | 'toy'; itemId: string | null }
| { t: 'pet'; action: 'carinho'; penId: string; slot: number }
// ServerMsg
| { t: 'homePets'; pets: HomePet[] }                    // also `roomState.homePets?: HomePet[]`
| { t: 'petshop'; phase: 'adopted'; pet: OwnedPet }     // the panel's confirm moment
// error codes: 'petshop' (gate, room, distance, full), 'petName' (unchanged), 'coins' (unchanged)
```

### 7.3 Handlers: `apps/server/src/petShop.ts`

New class `PetShopSystem` (constructed in `World`, same pattern as `DiaryTracker`), dispatched from `World.handle` with `case 'pet': return this.petShop.handle(s, msg)`. Every field is checked by hand (strings, `breedById`, `coatOf`, `PET_PENS`), as the other handlers do. Rules, in order:

- `adopt`: in room `petshop` and ≤ 2 tiles from the pen or counter interact → `hasPerkAccess` else `err('petshop', gate)` → `validatePetName` + `safety.classify` + `petNameDecision` (exactly `namePet`'s steps; refactor `namePet` to share `moderatePetName(s, raw)`) → `adoptPet(p, breed, coat, now, id)` (`'full'` → `err('petshop', adopt_full)`) → `name` set on the new pet, `activePetId = id` → `store.save`, `pushProfile`, `broadcastAvatar`, `send({t:'petshop', phase:'adopted', pet})`, `notice reward adopt_done`.
- `active`: `petId === null` always allowed; a non-null id needs `hasPerkAccess` and an owned pet. Save, push, broadcast; if the session is in a kitnet instance, re-send `homePets` to the instance.
- `rename`: owned pet, moderation as above, save, push, broadcast.
- `buy`: room `petshop`, distance ≤ 2 from `balcao.interact`, `petItemById`, not owned, `coins >= price` else `err('coins', …)`; `coins -= price`; furniture kinds → `p.furniture[id]++`, others → `p.petItems.push(id)`; `notice reward buy_done`.
- `equip`: owned pet and owned item of the right kind (or `null`); save, push, broadcast.
- `carinho`: room `petshop`, distance ≤ 2 from the pen's interact, `slot < pen.shows`; once per `(pen, slot)` per session visit (`s.petted: Set<string>` reset on room change); picks the line `dito.pen_<species>_<1 + (gameDay + slot) % 3>`, `send({ t: 'npcSay', npc: 'dito', pt, en })` (reuse whatever message the idle talk uses to show a bubble on an NPC; if none exists, send a `notice` with level `talk`) and `this.diary.earnLine(s, anchor)`.
- `World.perk` `'pet'` keeps working as the compatibility shim (§3.4). `revertPerks` and `syncEntitlements` as in §4.
- `World.join` for a `kitnet` instance attaches `homePets: homePetsFor(ownerProfile)` to `roomState`; `World.publicAvatar` adds the four pet fields.

### 7.4 Admin hooks

`apps/server/src/adminOps.ts`:
```ts
export function petGrant(ctx, actor, body)   // { id, breed, coat?, name? } → adoptPet regardless of subscription; audit 'player.pet-grant'
export function petRemove(ctx, actor, body)  // { id, petId } → releasePet; if it was active, activePetId = null; audit 'player.pet-remove' with the pet as `before`
export function petActive(ctx, actor, body)  // { id, petId | null } → setActivePet (no access check; an admin can put a pet away)
```
Each uses `withProfile` → mutate → `ctx.store.save(p.id)` → `ctx.world.changed(p.id, { avatar: true })` → `ctx.audit.append`. Routes in `adminApi.ts` `POST`: `/api/admin/player/pet-grant`, `/player/pet-remove`, `/player/pet-active`. `GET /api/admin/catalogs` adds `breeds` (id, pt, species, coats) for the picker. `adminApi.test.ts` covers 401 for the new routes automatically and gets one write test each. `playerDetail` adds `pets`, `activePetId`, `petItems`.

Dashboard (`apps/client/src/admin/main.ts` `viewPlayer`): a **Pets** card: the list (sprite not needed: breed pt, name, active pill), per row **Levar / Em casa** and **Remover** (typed confirm of the pet's name), and a grant form (breed select from catalogs, coat select, optional name) → `act('player/pet-grant', …, 'Pet granted.')`. The old items card note about "Subscriber pets come with a comp" becomes "Adoption needs a comp or a direct grant (Pets card)". `docs/ADMIN.md` table row and rules updated; `scripts/admin-shots.mjs` reshoots `2b-player-detail.png`.

In-game Testes (`adminTestes.ts` `writePerk`): `testPerk.pet` maps to the shim; add nothing else.

### 7.5 Validation and limits

No zod. Every handler checks types, ranges and catalog membership, and answers with `this.err` (never throws). The WebSocket bucket (`wsLimits.ts`, 20/s burst 40) already bounds message rates; `carinho` has the per-visit once rule, `adopt` is bounded by `PET_MAX_OWNED`. Names go through the same classifier path as chat, with the same moderation flag on refusal. The `pet` message is ignored before `createProfile` like every other.

---

## 8. Client summary (files)

| File | Work |
|---|---|
| `ui/petShop.ts` + `styles/petShop.css` (new) | The panel: Adotar / Meus pets / Lojinha, meet view, gate card, cheat sheet |
| `ui/petName.ts` | Generalise to `openPetName({ species, suggest, onSave })`; keep ids `#pet-name-*` |
| `ui/support.ts` | Owned-pet list instead of dog/cat buttons; "Adotar no Pet Shop" |
| `render/pixel/petLook.ts` (new), `WorldScene.ts` `preload`/`updatePet`/`createPetAnims` | Breed textures, collar/toy, fetch/play poses |
| `render/pixel/penPets.ts`, `render/pixel/homePets.ts` (new) | Pen litter and kitnet residents |
| `render/pixel/petFollow.ts` | `fetch`, `play` voices; `parsePetCommand` gated by toy |
| `render/pixel/props.ts`, `roomLayout.ts` | New kinds, decor kind, wall style |
| `main.ts` | `propAction` cases, hit kind `pen`, `talkTo` hooks `openAdopt` / `openShop` for `dito`, remembered rooms, guide arrow "Pet Shop →" on `rua_leste` during the Vila guide's places step |
| `ui/npcTalk.ts` | `next: 'adopt'` and `'petshop'` |
| `ui/townMapData.ts`, `townMapArt.ts`, `introSnapshot.ts`, `howToPlayData.ts`, `vilaGuideData.ts`, `journalView.ts`, `journalArt.ts`, `ambience.ts` | Registrations (§1.2, §1.6, §5.2) |
| `admin/main.ts` | Pets card |

---

## 9. Tests, e2e, screenshots

### 9.1 Unit (vitest)

- `packages/shared/src/petBreeds.test.ts`: every breed has ≥1 coat, unique ids, `petLook` is total, Brazilian types present (`vira_lata_caramelo`, `fila_brasileiro`, `terrier_brasileiro`, `gato_srd`, `gato_laranja`, `frajola`, `escaminha`), every `petStripKeys()` key exists in `public/pixel/manifest.json`.
- `packages/shared/src/petShop.test.ts`: `normalizePets` migration (dog only, cat only, both, names, idempotent, garbage in), `adoptPet` ok/unknown/full at 6, `setActivePet`, `releasePet` clears active, `homePetSpots` (beds first, never a blocked tile, never two on one tile), `penLitter` deterministic and Brazilian-weighted, `PET_ITEMS` prices within 1..60, `buyPetItem` rules.
- `packages/shared/src/rooms.test.ts`: widths (46), `petshop` door on row 5 inside the facade, exit arrives at `{19, 6}`, 2-tile lane from `rua_leste` spawn to the door, interior path spawn → counter interact → both pen interacts → exit.
- `packages/shared/src/subscription.test.ts`: `revertPerks` clears `activePetId` and keeps `pets`.
- `packages/shared/src/diary.test.ts`, `escola.test.ts`, `diaryLines.test.ts`: the new area, counts, `dito.pen_*` anchors resolve.
- `apps/server/src/petShop.test.ts` (new, `World` harness as in `diary.test.ts`): adopt refused without access, allowed with comp, name moderated (refused name keeps the pet un-adopted), 7th refused, active switch, lapse keeps pets, `homePets` in kitnet `roomState` and after a switch, buy outside the room / far from the counter / short on RV, equip wrong kind refused, carinho once per visit earns the word and only in range, legacy `perk pet` shim, `publicAvatar` fields hidden without access.
- `apps/server/src/adminApi.test.ts`: 401s (automatic) + one happy path per route + audit rows.
- `apps/server/src/petName.test.ts`: still green (shared `moderatePetName`).
- `apps/client/src/render/pixel/petFollow.test.ts`: `busca` / `brinca` parse only with the toy; fetch returns to the trail.
- `apps/client/src/render/pixel/petLook.test.ts`: texture key stability, LRU eviction calls `textures.remove`.
- `apps/client/src/ui/petShopLogic.test.ts`: pure view-model (shelves, gate card visible iff no access, Meus pets rows, cheat sheet) like `stallLogic.test.ts`.
- `apps/client/src/ui/townMapData.test.ts`, `wayfinding.test.ts`, `vilaGuideData.test.ts`, `surround.test.ts`, `vilaIpe.test.ts`, `introSnapshot.test.ts`: updated lists.
- `scripts/lib/pixel/petshop.test.mjs`, `pets.test.mjs`: art contracts (keys, sizes, sealed outline, no magenta, pattern masks only write `coat2` keys, key-colour-only strips).
- `apps/client/src/audio/spoken.test.ts`: passes after `pnpm tts` (or with `pending.json`).

### 9.2 e2e: `scripts/e2e-pet-shop.mjs`

Registered as `pnpm e2e:pet-shop`, in `scripts/e2e-all.mjs` `SUITES` (`{ key: 'pet-shop', name: 'e2e-pet-shop', script: 'e2e-pet-shop.mjs', env: { SHOTS: '0' } }`). **CI matrix:** `.github/workflows/ci.yml:50` must add `pet-shop` to the `pet-name,feira-cart,stalls` group; the GitHub App cannot edit workflows, so the PR description asks Jonny to make that one-line change (or Opus does it if its token allows). Script skeleton from `e2e-pet-name.mjs` + `scripts/lib/areas.mjs` `goArea(page, 'rua_leste')`:

1. Sign up (guest), `finishArrival`, clock 11:00 sol. `goArea('rua_leste')`, `interact({ portal: 'rua_petshop' })`, assert room `petshop`, no page errors.
2. Free player: `interact({ prop: 'cercadinho' })` → panel opens on Adotar; the gate card is visible; click Fazer carinho on slot 0 → diary length +1 and the `#world-labels` shows Seu Dito's bubble; read `petshop_banho_tosa` via `interact({ hotspot })` → +2; Adotar button absent.
3. Grant the test subscription (same path as `subscriber-perk-shots.mjs`: `grantTestSubscription` via the rolltest session, or the admin `grantSub` WS action on the server build).
4. Adopt `vira_lata_caramelo` / `caramelo`, name "Paçoca" → `profile.pets.length === 1`, `activePetId` set, `pub.petBreed === 'vira_lata_caramelo'`, pet trails behind (reuse the `freezeWalking` assertion from `subscriber-perk-shots.mjs`).
5. Adopt `siames` / `seal` named "Mel" → 2 pets, the siamês is active; Meus pets: click Levar on Paçoca → active flips.
6. Lojinha: buy `coleira_vermelha` (RV drops by 8), equip on Paçoca → `pub.petCollar`; buy `caminha_xadrez` → furniture count.
7. Walk to the kitnet (`goArea('rua')`, `interact({ portal: 'praca_kitnet' })`): `roomState.homePets` has Mel; place the caminha; Mel lies on it after the next `homePets`.
8. Second browser sees Paçoca's breed and collar on the first player's avatar (`avatars[].pub.petBreed`).
9. Revoke the test subscription: `activePetId` null, `pets.length === 2`, Meus pets still lists both with Levar disabled.
10. Admin dashboard (server build only): `POST /api/admin/player/pet-grant` for a third pet, `pet-remove` it, audit rows exist.

### 9.3 Screenshots: `scripts/pet-shop-shots.mjs` → `docs/lifesim/shots/petshop/`

1280×800 and 390×844: the facade on the street at 11:00 and 19:30 (lit windows), the interior with the litter, the Adotar tab (free player with the gate card, subscriber), the meet view with hearts, the name dialog, the adoption moment, Meus pets, Lojinha, the kitnet with three resting pets (one on a caminha), the Diário on the Pet Shop chapter, the Mapa with the new front, the breeds contact sheet (`pet-breeds-sheet.mjs`). Opus looks at every shot against the Beauty checklist before opening the PR.

### 9.4 Acceptance criteria

| Part | Done when |
|---|---|
| Placement | You can walk the whole street, enter and leave the shop by the door, the Mapa shows and travels to it, the intro pan has no void, `pnpm e2e:all` passes, `rooms.test.ts` green at 46 columns. |
| Owner | Seu Dito is at the counter at every hour with a portrait, voiced lines (`pnpm tts:check` = 0 or `pending.json`), a talk tree that opens the panel. He never waves. |
| Catalog + art | 38 breeds × their coats render from about 30 baked strips; the contact sheet reads at 4× with no smeared pixels; the praça stray and the legacy keys are unchanged. |
| Adoption | Subscriber adopts, names (moderated), the pet follows out of the door; 6 max; switch in the panel, in Apoiar and in the kitnet; other players see breed, coat and collar. |
| Gate | Free player can enter, pet, read, talk, buy furniture; one inline Apoiar card, no modal, no nag; lapse hides the follower, keeps everything; comp and admin grant work. |
| Learning | The Pet Shop chapter is completable by a free player; counts in `diary.test.ts` and `diaryCatalog.test.ts` match; every PT string is in BR-REVIEW W. |
| Lojinha | 13 items, RV only, refused outside the shop or short on RV; collars visible to all; beds and ração appear in the kitnet; `busca` / `brinca` work only with the toy and the chat line is unchanged. |
| Server | Old profiles migrate on load with no data loss (`normalizeProfile` idempotent test with a captured pre-#234 profile JSON); admin routes audited; `pnpm verify` green. |

---

## 10. Copy (UI, all `needs_br`, EN gloss beside PT in the panel)

- Tabs: Adotar · Adopt / Meus pets · My pets / Lojinha · Little shop.
- Shelves: "Na loja hoje" · In the shop today / "Catálogo de raças" · Breed catalog / "Raças brasileiras" · Brazilian breeds.
- Buttons: Fazer carinho · Pet / Adotar · Adopt / Levar · Take along / Em casa · At home / Renomear · Rename / Comprar · Buy / Usar · Equip / Apoiar a Vila · Support the Vila / Só olhar · Just looking.
- Gate card title: "Adoção é pra apoiadores" · Adoption is for supporters. Body: Seu Dito's `gate` line.
- Empty Meus pets: "Nenhum pet ainda. Os bichinhos estão esperando no Pet Shop do Seu Dito." · No pets yet. The animals are waiting at Seu Dito's pet shop.
- Lapsed note (Meus pets): "Seus pets estão em casa, na kitnet. Pra passear com eles, apoie a Vila de novo." · Your pets are at home in the kitnet. To walk them again, support the Vila again.
- Cheat sheet: senta · sit / deita · lie down / vem · come / busca · fetch / brinca · play.
- Kitnet pet card: "{nome} quer passear?" · Does {name} want a walk? → Levar / Fechar.

---

## 11. Build order (one PR, WIP checkpoints)

Branch: the PR branch Opus is given. Commit prefixes `feat(petshop):`, `art(petshop):`, `test(petshop):`. Every checkpoint ends with `pnpm verify` green and a WIP commit; the e2e runs at checkpoints 5, 7 and 8.

| # | Checkpoint | Scope | Verify |
|---|---|---|---|
| 0 | **Scaffold** | `RoomId 'petshop'`, `NpcId 'dito'`, every exhaustive record filled with placeholders (`NPC_STYLES`, `CONVERSA_CAST`, `WALL_STYLE`, `ROOM_ON_MAP`, `FILES`), empty `layouts/petshop.json`, room def, widen `rua_leste`, portal, facade prop with a **magenta placeholder key**. Fix every list test (§1.2, §1.6). | `pnpm typecheck`, `pnpm test`; you can walk in and out of a magenta box. |
| 1 | **Street + interior art** | `custom/petshop.mjs`, `import-map.d/petshop.json`, facade (widened STORE + PET SHOP plaque + dressing + lit), all interior props, `walls/quadro_racas`, diary items, icons, `fx/carinho`. `pnpm pixel`. Props and decor kinds in `props.ts`, `roomLayout.ts`, `layout.ts`. Lay out `petshop.json`. Contact sheets. | `petshop.test.mjs`; shots of the facade (day/night) and the empty interior. |
| 2 | **Seu Dito** | NpcDef, look, portrait, voices.json, talk tree, idle lines, hotspots, how-to-play card, Vila guide line. `pnpm tts` (or pending). | `spoken.test.ts`; talk to him in the browser. |
| 3 | **Breed system** | `petBreeds.ts`, `petshapes.mjs`, key-coloured `pets.mjs` with 5 + 3 shapes and 7 patterns, `pnpm pixel`, `petLook.ts`, `WorldScene` uses `ensurePetTexture` for the **legacy** dog/cat (same look as before), breeds sheet. | `petBreeds.test.ts`, `pets.test.mjs`, `petLook.test.ts`; `subscriber-perk-shots.mjs` still produces the same walk. |
| 4 | **Ownership + protocol + server** | `petShop.ts` (shared + server), types, protocol, `normalizePets` migration + mirrors, `PetShopSystem` (adopt/active/rename/carinho), `publicAvatar` fields, `revertPerks`, `perk` shim, `homePets` in `roomState`. | `petShop.test.ts` (shared + server), `subscription.test.ts`, `petName.test.ts`, migration test with a captured old profile. |
| 5 | **Panel + pens + kitnet** | `ui/petShop.ts`, meet view, gate card, name dialog reuse, `penPets.ts`, `homePets.ts`, `support.ts` list, kitnet pet card, Apoiar link. | `petShopLogic.test.ts`; **first e2e run** (steps 1–5, 7–9 of §9.2). |
| 6 | **Diary chapter** | Area, words, line family, placements, signs, `CHAPTER_STYLE`, emblem, `UNIT_ORDER`, totals in tests, `diaryCatalog.test.ts` earning path, BR-REVIEW W. `pnpm tts` for the words. | `diary.test.ts`, `diaryCatalog.test.ts`, `escola.test.ts`; e2e step 2. |
| 7 | **Lojinha** | `PET_ITEMS`, buy/equip handlers, furniture entries with `shop: 'petshop'`, collar ramp + toy overlays, `busca`/`brinca`, ração gathering, icons. | `petFollow.test.ts`, server buy tests; e2e step 6. |
| 8 | **Admin + docs + shots** | `adminOps` pet ops, routes, dashboard card, `ADMIN.md`, `SQLITE.md` line, `DECISIONS.md` entry, `subscription.md` pet paragraph, `assets-src/README.md` rows, `pet-shop-shots.mjs`, all screenshots in the PR. | `adminApi.test.ts`; e2e step 10; `pnpm e2e:all`. |

PR description must list: the width decision, the TTS state (baked or pending), the CI matrix line for Jonny, every "Decisions I made", and the screenshots.

---

## 12. Open questions for Jonny

1. **Street width.** The plan widens Rua dos Ipês (leste) by 6 tiles (19 → 25) to fit a real 6-tile front between the escola and the gable. The alternatives were a 3-tile front in the gable's slot (too small for a shop) or a door off the praça (no building row there). OK to grow the street?
2. **Adoption price.** Decided: free for subscribers (no RV). If you would rather have a symbolic RV "taxa de adoção" (say 10 RV, to make the moment feel earned), say so; the catalog field already exists.
3. **Cap of 6 pets.** Enough? The kitnet has room for about four resting pets plus beds; above 6 the room gets crowded.
4. **Pitbull and other guard breeds.** Left out (family-room safety and the breed's reputation). Fila brasileiro and rottweiler are in because they are very Brazilian / very common. Add, remove, or keep?
5. **Lapsed subscribers.** Decided: pets stay at home in the kitnet and cannot be taken out; nothing is deleted. Should a lapsed player still be able to rename and equip collars at home?
6. **Visitors in the kitnet.** `homePets` is sent to everyone in the instance, so friends who visit see your pets. Fine?
7. **A "Semana da Adoção" event** (future, not in this PR): one week where the pens show rare coats (merle, arlequim) and five exclusive words (`lar temporário`, `castrado`, `vacinado`, `microchip`, `padrinho`) earned by petting, under `events-requirements.md`. Want it on the calendar?
8. **Music.** The shop reuses the padaria day bed. Want a dedicated bed (compose-music skill) now or later?
9. **CI workflow.** The pet-shop e2e suite needs one line in `.github/workflows/ci.yml` that the bot cannot write. You add it when the PR is up?
10. **TTS baking.** If Opus's environment cannot reach the Edge TTS host, the ~90 clips go to `pending.json` and you bake them before merge. OK?
