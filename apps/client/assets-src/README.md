# assets-src: raw art and how it becomes game art

`assets-src/` holds the **licensed source art** (LimeZu Modern Interiors + Modern Exteriors, 16x16 folders only) and our
**original custom pieces**. Nothing here is served to players. `pnpm pixel` (`scripts/pixel-import.mjs`) reads
`import-map.json` and writes the small game-ready subset to `apps/client/public/pixel/` (never edit that folder or its
`manifest.json` by hand). Licenses and the required credit line: [LICENSES.md](LICENSES.md).

```
assets-src/
  limezu-modern-exteriors/   licensed, do not redistribute (use only the Modern_Exteriors_16x16 folders)
  limezu-modern-interiors/   licensed, do not redistribute (use only the 16x16 folders)
  custom/                    original pieces authored for Vila Ipê (.mjs generators + rendered PNGs in custom/png/)
  import-map.d/*.json        fragments merged after import-map.json (art track 3 lives in interiors.json)
  import-map.json            hand-written mapping: source sheet + rect -> our key, anchor, footprint, overhead part
  LICENSES.md  README.md
```

Ignore the `32x32` and `48x48` folders: everything in the game is authored on the 16 px grid.

## Running the import

```bash
pnpm pixel        # rewrites apps/client/public/pixel/** and manifest.json (deterministic; safe to re-run)
```

Add a sprite by adding one line to `import-map.json` (`sheet` alias + `rect`, `anchor`, `footprint`, optional `shadow`,
`cast`, `light`), then run `pnpm pixel`. Sheets are aliases under `sheets` (paths relative to a `roots` entry).
Find rects with a contact sheet or by looking at the sheet at 4x; sprites in the LimeZu theme sorters sit on a 16 px grid.

Sprite entry kinds: `derive` (a generator in `custom/derive.mjs` that returns one or more parts: frames, overhead, lit overlay), `sprite` (crop a rect, optional `recolor`, `isolate`, `flip`), `tree` (split into trunk + overhead
canopy + 3-frame sway, optional yellow `recolor`), `strip` (animation frames laid out in a row), `shop` (crop + rewrite the
plaque text + find the window glass), `custom` (a generator from `custom/`).

## What is derived, hand-authored, or placeholder (P1)

| Piece | How it is made | Source |
|---|---|---|
| Ipê amarelo (large, medium) | **derived**: LimeZu deciduous tree, canopy greens remapped to the LimeZu yellow/orange ramp by luminance rank, canopy split onto its own overhead sprite, 3 sway frames from whole-pixel row shifts | `3_City_Props` trees |
| Falling petals, ground petals | **hand-authored** (`custom/fx.mjs`), LimeZu yellow ramp only | none |
| Calçada petit-pavé + 16 mask tiles | **hand-authored** pattern (`custom/calcada.mjs`, 2x2 px stones in running bond, 32 px wave over two alternating tiles), edge tiles derived from it | none |
| São Paulo state mosaic (48x32) | **hand-authored**: rasterized state outline as light stones on a dark field | none |
| Banca de jornal (3x2) | **hand-authored** with rects and 1 px navy outlines (`custom/banca.mjs`), LimeZu palette only | none |
| Zebra crossing, lane dashes, wildflowers, grass tufts | **hand-authored** (`custom/street.mjs`) | none |
| Shopfronts (6) | **derived**: LimeZu "STORE" shops with the plaque text rewritten in a 3x5 pixel font (PADARIA, MERCADO, FLORES, LANCHES, SAPATOS, PIZZA) | `9_Shopping_Center_and_Markets` |
| Benches, lamps, trash bin, hedges, bushes, flower pots, fountain (animated), cars, pigeons, manhole | **LimeZu as is** (cropped) | `3_City_Props`, `17_Garden`, `10_Vehicles`, `Animated_sheets` |
| Orelhão, lixeira laranja, placa de rua, quiosque Missão, poleiro + papagaio, poste com fios + fios | **authored / derived** (`custom/props.mjs`, `wires.mjs`, `critters.mjs`), see docs/lifesim/decisions-art1.md | pole and sign pole cropped from `3_City_Props` |
| Barraca de chapéus | **derived**: street-food cart split into standing part + overhead canopy, authored hats (`custom/stall.mjs`) | `10_Vehicles` Street_Food_Cart_1 |
| Padaria, Edifício Ipê, Academia facades (+ lit overlays) | **derived + authored**: pack building fronts cut/widened, authored signs, toldo, grilles, varal, tank, bread, gym silhouettes (`custom/facades.mjs`, `edificio.mjs`, `academia.mjs`) | `9_Shopping_Center_and_Markets`, `4_Generic_Buildings` |
| Ônibus | **derived**: pack bus (wheel spin frame) (`custom/vehicles.mjs`) | `10_Vehicles` singles |
| Kombi, fusca, moto (motoboy) | **authored** (art2 redraw): white-over-turquoise kombi with split windscreen and V nose, round beetle, motoboy with delivery box (`custom/vehicles-auth.mjs`) | none |
| Vira-lata caramelo | **authored** (art2 redraw, 24x17): big head, perky ears, curled tail; idle / walk / curled sleep (`custom/dog.mjs`) | none |
| Feira livre stalls (frutas, verduras, pastel + caldo de cana, flores), closed variants, crates, price tags | **authored** (`custom/feira.mjs`): 3x2 stalls with the striped tarp as an overhead part, folded-tarp roll when closed | none |
| Placar da Vila (`props/placar_vila`, 52x56, anchor (26, 54)): the Praça leaderboard board, wooden notice board under a terracotta roof with bunting, a PLACAR plaque and two pinned sheets (words / streak) with medal rows | **authored** (`custom/v2props.mjs` `vilaBoard`, entry in `import-map.d/v2.json`) | none |
| The airport (the arrival tutorial): airliner, jet bridge, control tower, baggage tug, curtain-wall glass (half transparent) with the gate and the AEROPORTO letters, seats, departures board, information desk, passport booths, the animated baggage carousel, x-ray, café, wayfinding signs, the diary's small objects; the granilite floor (`z`) | **authored** (`custom/aeroporto.mjs`, `custom/floors.mjs`, entry in `import-map.d/aeroporto.json`) | none (the packs have no airport) |
| The Praia (PRAIA-PLAN.md 1.6): the coconut kiosk with an overhead thatched roof and a lit overlay, three striped umbrellas (`_copa` overhead canopies, `_fechado` closed), beach chairs, Bento's boat shack (BARCOS DO BENTO plaque, lit window), the lifeguard tower, pier posts / railings / lamp / end, the four boats (remo, pesca, alto-mar, festa, with cabins as overhead parts), costão, rocks, the canoe, the PESCA stake and bollard, painted signs, sand details, the party deck's grill, speaker, cooler, rails and sign; the gull flock recolour and the crab; `fx/onda_0..2` foam strips; 14 fish icons, the junk and the bottle, Jô's snacks; the beach kitnet furniture; the fishing stage backdrops (`pesca/fundo_<water>`); the terrains `s` areia, `o` agua (a `shore` edge with a foam line) and `b` deque | **authored** (`custom/praia.mjs`, `custom/floors.mjs`, entry in `import-map.d/praia.json`); `praia/*` packs into its own `praia` atlas because the outdoor atlas is at its 1024x2048 cap. Sea teal `#3FA9A0` and sand `#EBD9A8` are the beach tokens in `docs/art/palette.md` | none (the packs have no beach) |
| NPC portraits (12 x 4 expressions, 64x64) | **the sprite itself** (`custom/portraits.mjs` via `custom/lookkit.mjs`): a 20x20 window on the head and shoulders of the NPC's composed south frame at 3x, every output pixel one sprite pixel; the expressions are the sprite's own frames (idle, the laugh, the blink or the closed-eye smile, the idle with brows and eyes lifted one row and an "o" mouth); shared frame and room backgrounds in `custom/portraitbg.mjs` | the Character Generator layers (via the char sheets) |
| Item icons (15, 16x16) | **authored** (`custom/icons.mjs`) | none (the packs only have a few tiny food pieces) |
| UI kit: paper panel, speech bubble, button x3 states, guide arrow | **authored** (`custom/ui.mjs`), after the pack's bubble and bobbing arrow in `UI_16x16.png` | `4_User_Interface_Elements` (reference only) |
| Language diary objects (264) and sign boards (41) | **authored** (`custom/diaryItems.mjs`, grids in `custom/diary/*.mjs`, entries in `import-map.d/diary.json`): one letter per colour with a navy outline added, signs painted from a 3x5 font; a few pieces reuse pack art (pigeon, manhole, doormat, bowl, moto, kombi, flags) | none |
| Contact shadows, cast shadows | **generated** from sprite silhouettes (down-right) | none |
| Glow, cloud shadow | **generated** light textures (allowed by D6) | none |

No placeholder (magenta) piece is on the P1 frame. Everything still missing from the custom set-piece list in the HOWTO
(4.3) is simply not on the frame yet: orelhão, padaria/edifício/academia facades, poste com fios, chapéus stall, missão
kiosk, parrot perch, bus, kombi/fusca/moto, dogs and cats, feira stalls, portraits.
(Art tracks 1 and 2 have since added all of those except the cat walk/sit poses; see the tables above.)
In the renderer a missing manifest key draws a flat magenta box (HOWTO 5.10); the frame page does the same
(`window.__frame.artMissing`).

## Terrain: dual-grid 16-tile mask order

HOWTO 5.6 wants each terrain as 16 tiles in corner-mask order (`TL*8 + TR*4 + BL*2 + BR`). The LimeZu autotiles
(`Autotiles_16x16/Godot_*` 47-tile blobs, and the RPG-Maker style sheets in `1_Terrains_and_Fences`) paint **terrain X over a
base terrain** (both sides opaque), so they cannot be layered one terrain per layer and they are not corner-mask tiles.
The import therefore **derives the 16 mask tiles from the terrain's fill tile(s)** (`scripts/lib/pixel/terrain-gen.mjs`):

- shape = union of the 8x8 quadrants whose corner bit is set (quadrant TL belongs to world tile (i-1, j-1), see `terrain.ts`);
- convex corners at the tile centre are chamfered by 1 px;
- edges get the LimeZu outline treatment: navy outline, lit top/left lip, a 3 px shaded curb wall on the south side and a soft
  contact shadow cast down-right onto whatever is underneath.

Two kinds of terrain (`import-map.json` -> `terrain`):

- `slab` (calçada `c`): the tiles above; drawn on top of the underlays; `phases: 2` because the wave has a 32 px wavelength
  over 16 px tiles, so tile index = `first + (i mod 2) * 16 + mask` (`phasedIndex` in `terrain.ts`).
- `flat` (grama `g`, asfalto `a`): full-fill underlays taken from LimeZu tiles (mask != 0 draws the fill); several fill tiles
  are stored as variants and picked by `hash2(i, j)` (`tileIndex`). There is no soft transition art between two flat terrains
  yet (P1 never puts them next to each other).

Tests: `terrain.test.ts` (mask order, borders, variants, phases) and `scripts/lib/pixel/pixel.test.mjs` (mask 15 is the
untouched fill, adjacent display tiles agree along every shared edge, so there are no seams).

## Characters (Phase 3): LimeZu layers + authored pieces -> canonical key-colored sheets

`custom/chars.mjs` (with `charart.mjs`, `hats.mjs` and the helpers in `scripts/lib/pixel/chars.mjs` + `charedit.mjs`) builds every character layer
into `public/pixel/chars/<key>.png`: 8 columns x 18 rows of 16x32 frames, facing row order **S, W, E, N**, all pixels in **key colors**
(`KEY_RAMPS` in `palette.ts`: skin, hair, top, bottom, shoes, hat, accent) that the client swaps for the appearance colors.

### Source rows -> canonical rows

LimeZu layer sheets are 56 columns of 16x32 frames, row `r` at `y = 32 r`; facing block order is **E, N, W, S**.

| Canonical row | Animation | Built from |
|---|---|---|
| 0-3 | idle S, W, E, N (6 frames, 5 fps) | source row 1, blocks S(3), W(2), E(0), N(1) |
| 4-7 | walk S, W, E, N (6 frames, 10 fps) | source row 2, same blocks |
| 8-11 | sit S, W, E, N | W / E: source row 4 (cols 6 / 0); S / N: the idle frame lowered 4 px (the bench seat hides the legs) |
| 12 | `oi` (wave), 6 frames | idle S frames 0-5 (real) + the authored raised hand (`emote_gestures`) |
| 13 | `dancar`, 6 frames | the real walk-S cycle played in place (source row 2, block S) + authored hands up (`emote_gestures`) |
| 14 | `rir` (laugh), 4 frames | idle S frames 0-3 (real) + authored open / closed mouth |
| 15 | `valeu` (thumbs up), 4 frames, hold 600 ms | idle S frames 0-3 (real) + authored outlined fist with the thumb up |
| 16 | `desculpa` (sorry), 8 frames, hold 600 ms | **all real**: the pack's "pick up" row (source row 9, block S = cols 36-42, 46): a bow and back up |
| 17 | `phone` (idle pose *celular*), 6 frames, loop | source row 6, cols 3-8 (the pack's phone-in-hand loop, facing S) |

No emote falls back to the 2 px bounce any more; the renderer keeps that bounce only for a sheet that has no such animation.

### Layers

| Layer key | Derived from LimeZu | Authored |
|---|---|---|
| `body_medio` (skin ramp), `body_medio__esguio`, `__forte` | Body_01 | the two width variants (see below) |
| `eyes_suave / marcante / doce / maduro` | | wave 3: 2 px eyes per style with a white and a coloured iris, closed on one idle frame in six (`charart.mjs` EYE_ART, BLINK_ART) |
| `face_suave / marcante / doce / maduro` | | brows, a mouth, a nose shadow (marcante, maduro), blush (semi-transparent) and smile lines, anchored to the head |
| `outfit_<top>_<bottom>` x 3 body types (15 x 3) | Outfit_01 (camiseta, regata), 10 (moletom), 08 (camisa), 11 (blusa); torso, pants and shoes are re-keyed onto the top, bottom and shoes ramps | pants edits: bermuda (pants stop a row early, legs split), saia (A-line flare); regata (sleeves removed); per-top details (`topdetail.mjs`, wave 3) |
| `hair_curto`, `raspado`, `undercut`, `cacheado`, `ondulado`, `longo` | Hairstyle 12 / 20 / 26 / 25 / 07 / 15 | |
| `hair_black` (black power) | Hairstyle 25, grown by 2 px with a redrawn outline | the puff |
| `hair_coque`, `hair_trancas` | Hairstyle 16 | the bun, and two front braids (one long back braid seen from behind) |
| `extra_oculos`, `extra_barba`, `extra_bigode` | Accessory 15 (glasses), 13 (beard), 12 (mustache, on the hair ramp) | |
| `extra_brincos`, `extra_sardas` | | gold hoops, freckles |
| `hat_bone_verde`, `hat_panama`, `hat_chapeu_chef`, `hat_gorro_listrado` | Accessory 04 (snapback), 08 (detective hat), 18 (chef), 11 (beanie) recolored onto the hat / accent ramps | the beanie stripes |
| `hat_chapeu_palha`, `viseira_azul`, `boina_vermelha`, `chapeu_sol`, `bucket_amarelo`, `capacete_bike`, `coroa_flores`, `cartola`, `pano` | | drawn in `hats.mjs`, stamped on each frame's head (S, E, N; W is E mirrored) so they follow the walk bob and the bow |
| `emote_gestures`, `pose_cafe`, `pose_bolsa`, `pose_bracos`, `pose_bolsos`, `pose_cintura`, `npc_apron` | | body-anchored props (`charart.mjs`); `pose_*` only have pixels on the idle rows |
| `npc_gi`, `gi_patch` x 3 body types | | the jiu-jitsu gi over the camisa + calça outfit and the academy stamp on it (`gi.mjs`, see "Characters, wave 3") |
| `acc_phone` | Smartphone_1 (row 6) | |

**Recolorable ramps.** Every outfit has all three: torso -> `top`, pants -> `bottom`, shoes -> `shoes`. Bands are cut by row relative to the frame's feet
row (`bandFeetRow`: the front / back sit frames are the idle frame lowered 4 px with the legs cut off, so their bands are cut from the lowered feet row,
not from the last opaque row), so a white shirt over white pants still gets two different colors. Hair, beard, mustache, brows and braids use `hair`; hats use `hat`
(HatDef.color) and `accent` (HatDef.accent); gestures and pose props use `skin` and `top`; the NPC apron uses `accent`. Outline navy is never swapped.

**Body types.** Width is baked per layer at import (`charedit.mjs warpLayer`, on body-attached layers only: body, outfits, the crossed-arms pose, the
apron): `esguio` drops the 2 center columns of the torso rows, `forte` doubles them (skipped where the row is already the full 16 px). Height is applied to
the fully composed sheet at runtime (`bodytype.ts`): `esguio` duplicates the arm row and lifts everything above it 1 px (taller), `forte` deletes it (shorter);
the feet never move, and the head, hair and hat move with the torso.

### Anchoring authored pieces

`charedit.mjs anchors()` measures each body frame (head top, feet row, head and torso x extent). A pattern (ASCII rows + a legend of key colors) is authored
against the reference frame of its facing and shifted by the frame's own offset, so one drawing works for idle, walk, sit and the emotes.

### Palette swap

Every layer is stored in **key colors**. At load time `buildRamp(base)` makes the target ramp (shadows darker and shifted toward purple, highlights
lighter and shifted toward yellow, HOWTO 5.5) and `swapKeys` replaces key -> target on an RGBA buffer (`charcompose.ts`, pure, unit-tested). Ramps with more
source shades than key ranks are spread over the ranks by luminance (`ranksFor`). Contact sheet of the result: `node scripts/character-lineup.mjs`.

## Notes on the LimeZu art

- Palette: `limezu-modern-exteriors/Palette.png` (yellow ramp `#fff59a #ffe57b #f8d239 #f2b22b #ed931e #66451e #381a08`),
  outline navy `#3a3a50` / `#46465e`. Custom pieces use only these colors (plus the brand colors from `docs/art/palette.md`).
- The pack draws a contact shadow inside some sprites and none in others, so the renderer adds one shared ellipse
  (`fx/shadow_10/16/32/48`) plus a generated cast shadow per sprite (`<key>#cast`).
- Sprites in the theme sorters are cropped by rectangle; a few neighbors overlap the crop box, hence the `isolate` option
  (keep one connected component).

## Standalone images: portraits, icons, UI kit (art2)

Portraits, item icons and the UI kit are shown by the DOM (`<img>`, CSS `border-image`), at 2-4x, so they are **not** in the Phaser
atlas. `import-map.json` has an `images` list (`{ "fn": "portraits" | "icons" | "ui" }`, generators registered as `IMAGES` in
`custom/derive.mjs`); each returns `[{ key, img, meta? }]` and `pnpm pixel` writes `public/pixel/<key>.png` and
`manifest.images[key] = { file, w, h, ...meta }`:

| Key | Size | meta |
|---|---|---|
| `portraits/<npc>_<expr>` (`carlos`, `nanda`, `julia`, `graca`, `tia_lu` x `neutro`, `feliz`, `surpreso`, `pensativo`) | 64x64 (bust in a 2 px framed card) | none |
| `icons/<itemId>` (the 12 padaria shelf ids + `jornal`, `flores`, `banana`, the feira and street snacks, `pipoca_leite`, and the empties `saquinho_vazio`, `coco_vazio`, `copinho_vazio`, `copo_vazio`) | 16x16 | none |
| `ui/panel`, `ui/bubble`, `ui/button`, `ui/button_hover`, `ui/button_pressed` | 20x20, 30x27, 16x16 | `slice: { top, right, bottom, left }`, `css: "t r b l"`, `demo` |
| `ui/guide_arrow_strip` | 64x20 (4 frames of 16x20) | `frames: 4, frameW: 16, fps: 6` |

Use a 9-slice like this (integer display scale, `image-rendering: pixelated`):

```css
.panel { border-style: solid; border-width: 21px; /* slice x scale 3 */
  border-image: url(/pixel/ui/panel.png) 7 7 7 7 fill / 21px / 0 stretch; image-rendering: pixelated; }
```

The guide arrow is also a normal atlas sprite, `ui/guide_arrow` (4 frames, anchored at the bottom centre of the bounce range) for the world.
Contact sheets: `node scripts/pixel-contact.mjs --set portraits|feira|icons|ui|fixes` (writes `docs/lifesim/shots/art2/`).

## Interiors (art track 3)

Floors are `flush` terrains (`custom/floors.mjs`), walls / decor / doors are in `custom/walls.mjs`, padaria props in `custom/padaria.mjs`, kitnet and catalog furniture in `custom/kitnet.mjs`, academia and praça leftovers in `custom/gym.mjs`.
Key conventions: `walls/north_<style>_l|_m|_r`, `walls/west_<style>[_b]`, `props/<kind>_<i>_of_<w>` (sliced), `props/cadeira_padaria_e|s|n|w`, `furniture/<id>_0|1`. Sources and tables: docs/lifesim/DECISIONS.md, art track 3.
Contact sheets: `node scripts/pixel-contact.mjs --set floors|walls|padaria|kitnet|academia|praca` (writes docs/lifesim/shots/art3/).

## Characters, wave 2

- **Garbs** (`custom/garb.mjs`): CPU-only pieces (`Appearance.garb`, ids joined by `+`): `garb_jersey` (stripes from the outfit's torso mask), `garb_jaqueta`, `garb_macacao`, `garb_chinelo` (all derived from the outfit alpha of every frame), `garb_mochila_u|o`, `garb_caixa_u|o`, `garb_sacola_o`, `garb_carrinho_u|o` (ASCII patterns anchored to the feet row; `_u` is drawn under the body, `_o` over everything), `hat_balde` (`hats.mjs`). All are key-coloured and have `__esguio` / `__forte` variants except the hat. The table that places them is `GARBS` in `characters.ts`; the crowd that wears them is `packages/shared/src/looks.ts`.
- **Faces**: `openFringe` pulls the fringe of `cacheado`, `black`, `ondulado` and `longo` up and aside on the front frames (`scripts/lib/pixel/charedit.mjs`).
- **Emote art**: the gestures in `emote_gestures` (`charart.mjs`: `wave`, `thumb`, `handsUp`, `laugh`), the pop-up bubbles `fx/emote_<kind>` and the 8 x 10 parrot (`custom/emotefx.mjs`).
- **Runtime, not art**: the outer outline and the top-left light are applied when a look is composed (`render/pixel/charfx.ts`), so they follow any recolor and body type and never need a re-import.
- Review tools: `node scripts/character-lineup.mjs`, `scripts/character-peek.mjs <out> <scale> <spec.json>`, `scripts/character-dump.mjs <layer> <row> <col>`, `scripts/cpu-looks-dump.mjs`.

## Characters, wave 3: the avatar plus-up

- **The gi** (`custom/gi.mjs`, layers `npc_gi` + `__esguio` / `__forte`): built per frame from the outfit's alpha, standing, walking, sitting (the
  front / back sits are lowered 4 px, the side sits keep the standing torso over the lap: `torsoFeetRow`, `torsoSpan`), the emotes and the phone loop.
  Top down: the pack's neck line is the collar's dark edge (from behind, a light collar band across the shoulders), the lapel seams run down in a V
  from it to the knot in the pack's inner navy (`#46465e`, so they read on a white gi) with the lapels lit beside them, the wearer's right lapel
  crossing over; **one belt row** on the `belt` key ramp (`#406040 #608060 #80a080`: knot shade and tail tips, band, knot light) with a two-pixel knot
  and two tails of two rows; the jacket's skirt in the cloth's shade where the shirt / pants waist line used to be; sleeve cuffs in the shade. Cloth is
  on the `top` ramp, so an academy's blue / black / red gi recolours the whole jacket. The belt used to be two rows plus a knot and tails on a
  five-row torso; the runtime builds its ramp from the earned belt (`GI_BELT_BASE` in `looks.ts`; the white belt is a touch warmer and greyer than
  the white gi so it reads on it; no belt is Bia's black one).
- **The academy stamp** (`gi_patch`): a 4x2 crest on the back and a 1x2 one on the chest, `accent` ramp, swapped for the crest's fill
  (`CRESTS[stamp].fill`) when a member wears the academy gi; a vestiário gi has no layer, so it stays plain.
- **Per-top details** (`custom/topdetail.mjs`, on every `outfit_*` sheet, in the `top` ramp): tee sleeve hems; hoodie hood rim, drawstrings and
  kangaroo pocket (the hood's shadow on the back); shirt collar points and chest pocket; blouse V neck (the `skin` ramp: the outfit layer now takes
  `skin` too) with a light trim and puffed sleeve tops. The regata is cut from the detailed tee.
- **Faces** (`custom/charart.mjs` EYE_ART / BLINK_ART / FACE_ART): the pack's eyes were one lash pixel over one iris pixel and the default face
  had no brows and no mouth. Every style now has 2 px eyes (a navy lash, a coloured iris on the outer side, a white on the inner side; `doce`
  2x3, `marcante` with a lash flicking outward), brows (`suave` light ones in the hair colour), a two-pixel mouth in a fixed lip colour (`M`
  in the legend, reads on every skin tone) and, on `marcante` / `maduro`, a nose shadow. Idle frame 4 of 6 (front and side rows) closes the
  eyes: a blink every loop. The body gets a **cheek contour** (`chars.mjs cheekContour`: the outermost skin pixel of the four rows from the
  brow line to the jaw takes the shade rank on the front frames) and every hair sheet a **glint** (`hairShine`: two half-transparent white
  pixels on the crown, blended at runtime over whatever hair colour).
- **Runtime shade** (`render/pixel/charfx.ts shadeEdges`, with `highlightEdges` on the body, hair and outfit layers): the pixels just inside the
  silhouette on the bottom and right get a cooler shade, so every part has a lit side and a shaded side (the far cheek, the right sleeve and leg, the
  underside of the fringe, the sole of a shoe) without a second authored colour. The portraits are composed through the same code, so they carry it.
- Review: `node scripts/character-lineup.mjs` has an "Academia gi" section; before / after shots in `docs/lifesim/shots/avatars-v3/`. Contract test on
  the shipped sheet: `src/render/pixel/giArt.test.ts` (one belt row, tails, the V, the sits, the stamp, the top details, the sit bands).

## Academia roll art (`bjj/*`, `props/placar`)

Authored with a small puppet renderer (`custom/bjj-rig.mjs`: head disc, torso capsule, two-bone arms and legs, navy sticker outlines, light from the upper left, chibi proportions like the 16x32 characters), poses in `bjj-poses.mjs`, loops / transitions / extras in `bjj-anim.mjs`, the move clips and the standing grip loops in `bjj-moves.mjs`, Bia in `bjj-ref.mjs`, glue in `bjj.mjs` (`import-map.d/bjj.json`, derive fn `bjjSet`). Preview tools: `node scripts/bjj-preview.mjs <out> <scale> pos:<id>,struggle:<id>,trans:<a>><b>,finish,win,bump,face,ref` and `node scripts/bjj-sheet.mjs` (the contact sheet, `docs/lifesim/shots/academia-art/sheet.png`).

The gi is drawn as a gi (#166): a thick collar running down as crossed lapels (the chest in the V above), the jacket's skirt and opening under the belt, loose sleeves with a dark cuff, pants with a cuff at the ankle, the belt knot and tails. Each head also carries optional hair pieces in their own key colours (`src/render/pixel/bjjKeys.ts`: a curly / long volume with its outline and seam, a bun, a beard over the lower face); the runtime swap (`bjjSwap.ts`) shows the pieces a fighter wears and clears the rest, so curly Mateus, Helena's bun and Rafael's beard come from the same frames. The partner's gi colour is swapped too (`PARTNER_GI` in `bjjArt.ts`).

**Move clips** (`bjj/mv_<move>__<from>_<h|m>_<0..7>`, contract in `src/render/pixel/bjjClips.ts`): every move the rules allow from each position, landed and missed, 8 frames (wind-up, action, the big frame 4: the grip snap or the body in the air, the landing 5, settle). The mover is art slot A; bodies in the air are turned joint by joint (`rotateFighter`), never as a tilted bitmap. A clip starts exactly on its `from` idle frame and a landed one ends exactly on its `to` idle frame (a test checks the silhouettes), mirrored when the fighter taken down falls away from the mover. Clip frames are drawn on an 80x56 canvas and trimmed, each with its own anchor (the pair anchor). The standing loops with grips held are `bjj/stand_<you><partner>_<0..3>` (n / c / s / b). These 560 frames live in their own atlas (`bjj`, `lazy`), loaded by the bout stage when a match starts.

| Key | Frames | Notes |
|---|---|---|
| `bjj/pair_<pos>_<0..3>`, pos = `de_pe`, `guarda_fechada`, `meia_guarda`, `cem_quilos`, `joelho`, `montada`, `costas` | 4 each, loop | 56x42, anchor bottom centre (28, 42). Fighter A (white gi, the player) is on top / dominant, B (blue gi, partner) is under |
| `bjj/trans_<from>__<to>_<0..3>` | 4 each, play once | all 16 directed ladder steps: de_pe<>guarda_fechada, de_pe<>meia_guarda, guarda_fechada<>cem_quilos, meia_guarda<>cem_quilos, cem_quilos<>joelho, joelho<>montada, joelho<>costas, montada<>costas. Frame 3 is close to (not equal to) the target `pair_*_0` |
| `bjj/finish_tap_<0..3>` | 4, loop | rear choke, B's free hand taps in the air (frames 0 and 2 are the contact, with yellow rays) |
| `bjj/win_raise_<0..2>` | 3 | two fighters standing front-on (A at left raises the arm toward the middle, B at right bows); the referee is separate, hold A's raised hand at about (27, 12) of the frame |
| `bjj/fistbump_<0..3>`, `bjj/face_off_<0..1>` | 4 / 2 | standing facing each other |
| `bjj/ref_<combate, pontos2, pontos3, pontos4, vantagem, parar, vitoria, espera>` | 1 each | Professora Bia, 16x32, anchor (8, 32), skin / hair on the key ramps, white gi, black belt. `espera` (hands on the belt) is her stance at the referee's spot beside the mat between calls |
| `props/placar` | 1 | 30x34 scoreboard on short legs, anchor (15, 33), narrow enough to stand between the mat's east edge and the wall. Blank DOM digit cells (x, y, w, h): clock `[5,3,20,7]`, player pontos `[11,13,7,7]` / vantagens `[21,13,7,7]`, partner pontos `[11,22,7,7]` / vantagens `[21,22,7,7]` (`PLACAR_CELLS` in `bjj.mjs`) |
| `props/bandeira_br`, `props/bandeira_sp` | 1 | corner flags 16x32, anchor (4, 31) |
| `walls/poster_respeito` | 1 | the RESPEITO / TREINO / AMIZADE wall poster (replaces `poster_oss`) |

**Colors.** Every pair frame uses only: key ramps (A `skin` / `hair`, B `skin2` / `hair2`, A's belt `belt`), the gi ramps (white for A, blue for B), B's fixed black belt, the navy outline and a few FX yellows (`GI_PALETTE` in `bjj-rig.mjs`). New key ramps in `palette.ts` (so `manifest.keyRamps` has them): `skin2` `#a03a00 #c05000 #e06800 #ff8020`, `hair2` `#5a00a0 #7000c0 #8800e0 #a020ff`, `belt` (3 ranks) `#406040 #608060 #80a080`, plus the optional hair piece keys of `bjjKeys.ts`. Swap a frame with `pairSwap` + `applySwap` (`bjjArt.ts` / `bjjSwap.ts`: cleared pieces turn transparent). Test: `scripts/lib/pixel/bjj.test.mjs`.

## Correria no Balcão art (`balcao/*`, `fx/steam_*`)

`custom/balcao.mjs` (registered as `balcaoSet` in `derive.mjs`, entry in `import-map.d/correria.json`) authors every piece of the counter work area. Each frame is its own sprite key in the `outdoor` atlas (no `anim` blocks); the gameplay side picks frames. All art is authored: the packs have no usable food, griddle or espresso art, so it is drawn with the padaria palette (navy outline added last with `outlineAround`, light from the upper left).

| Keys | Frames | Size | Notes |
|---|---|---|---|
| `balcao/item_<itemId>` (12 shelf items) | 1 each | 28x28, anchor (14, 26) | pao, pao_na_chapa, pastel, coxinha, bolo, cafe, cafe_com_leite, suco_de_laranja, agua, pao_de_queijo, misto_quente, guarana |
| `balcao/tray`, `tray_full`, `bag`, `plate` | 1 each | 64x16, 64x34, 24x30, 28x12 | `tray_full` carries three 16 px icons |
| `balcao/chapa_idle`, `chapa_sizzle_0..2`, `chapa_burnt` | 1 + 3 + 1 | 40x36, anchor (20, 35) | sizzle 0 pale, 1 golden, 2 brown; burnt is black with smoke |
| `balcao/coffee_idle`, `coffee_pour_0..3` | 1 + 4 | 34x42, anchor (17, 41) | idle has no glass; pour 0..3 fills a copo americano |
| `balcao/register` | 1 | 26x24 | matches the padaria's cream register |
| `balcao/bell_0..1`, `tipjar_0..3`, `patience_0..4` | 2, 4, 5 | 22x16, 20x24, 14x14 | bell still / rung; jar empty to full; patience full to out (clock-pie, red "!" at 4) |
| `fx/steam_0..3` | 4 | 14x24, anchor (7, 23) | the only partly transparent art |

Contact sheet (every key at 4x, strips, and a mock work area at zoom 3): `node scripts/balcao-sheet.mjs` -> `docs/lifesim/shots/correria-art/sheet.png`. Contract test: `scripts/lib/pixel/balcao.test.mjs`.
