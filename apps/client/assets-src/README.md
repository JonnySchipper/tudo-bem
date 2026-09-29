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
| NPC portraits (5 x 4 expressions, 64x64) | **authored** (`custom/portraits.mjs`, painter helpers in `custom/paint.mjs`) | none (the Interiors pack has no face art) |
| Item icons (15, 16x16) | **authored** (`custom/icons.mjs`) | none (the packs only have a few tiny food pieces) |
| UI kit: paper panel, speech bubble, button x3 states, guide arrow | **authored** (`custom/ui.mjs`), after the pack's bubble and bobbing arrow in `UI_16x16.png` | `4_User_Interface_Elements` (reference only) |
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

## Characters: source rows -> canonical sheet

LimeZu's Character Generator ships layered sheets, one PNG per body / eyes / outfit / hairstyle / accessory, all in the same
layout: 56 columns of 16x32 frames, row `r` at `y = 32 r`. We use the layered sheets (never the desktop GUI tool). The canonical
sheet (HOWTO 5.5) is 8 columns x 17 rows of 16x32, facing row order **S, W, E, N**.

Source layout used (row index = y / 32):

| Source row | Content | Frames |
|---|---|---|
| 1 | idle | 24 = 4 facings x 6, block order **E, N, W, S** (verified from the eyes layer: eye x-centroid 11 / none / 4 / 8) |
| 2 | walk | 24 = 4 x 6, same block order |
| 4 | sit | 12: cols 0-5 face E, cols 6-11 face W (there is no front or back sit) |
| 0, 3, 5+ | previews, sleep, phone, gift, lift, throw, hit, punch, gun... | not used yet |

Canonical rows produced by `scripts/lib/pixel/chars.mjs`:

| Canonical row | Animation | Built from |
|---|---|---|
| 0-3 | idle S, W, E, N (6 frames, 5 fps) | source row 1, blocks S(3), W(2), E(0), N(1) |
| 4-7 | walk S, W, E, N (6 frames, 10 fps) | source row 2, same blocks |
| 8 | sit S | idle S frame lowered by 4 px (the bench seat hides the legs) |
| 9 | sit W | source row 4, col 6 |
| 10 | sit E | source row 4, col 0 |
| 11 | sit N | idle N frame lowered by 4 px |
| 12-16 | oi, dancar, rir, valeu, desculpa | **placeholder: idle S frames 0-3** (the pack has no wave/dance/laugh/thumbs/sorry rows). The renderer bounces the sprite 2 px until the art exists |

Layers in the P1 map: `body_medio` (Body_01 + Eyes_01 baked together), three outfits, three hairstyles. The pack's outfits are
one layer for top + bottom, so P1 has an `outfit_*` layer instead of separate `top_*` / `bottom_*` / `shoes_*` layers (Phase 3
decides how to split or extend). No hat art exists in the pack for the straw hat; that stays a Phase 3 item.

### Palette swap

Every layer is stored in **key colors** (`KEY_RAMPS` in `apps/client/src/render/pixel/palette.ts`: skin 4, hair 4, top 4,
bottom 4, shoes 3). At import time `import-map.json` lists each layer's source shades per group (for example hair
`#ab6736 #b37b3f #cc9659`); they are sorted by luminance and mapped to key ranks (2 shades -> ranks 2,3; 3 shades -> 1,2,3;
4 shades -> 0..3). At load time `buildRamp(base)` makes the target ramp (shadows darker and shifted toward purple, highlights
lighter and shifted toward yellow, HOWTO 5.5) and `swapKeys` replaces key -> target on an RGBA buffer. The outline navy
(`#3a3a50`, `#46465e`) and the white details are shared and never swapped. Pure functions, unit-tested
(`palette.test.ts`).

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
| `icons/<itemId>` (the 12 padaria shelf ids + `jornal`, `flores`, `banana`) | 16x16 | none |
| `ui/panel`, `ui/bubble`, `ui/button`, `ui/button_hover`, `ui/button_pressed` | 20x20, 30x27, 16x16 | `slice: { top, right, bottom, left }`, `css: "t r b l"`, `demo` |
| `ui/guide_arrow_strip` | 64x20 (4 frames of 16x20) | `frames: 4, frameW: 16, fps: 6` |

Use a 9-slice like this (integer display scale, `image-rendering: pixelated`):

```css
.panel { border-style: solid; border-width: 21px; /* slice x scale 3 */
  border-image: url(/pixel/ui/panel.png) 7 7 7 7 fill / 21px / 0 stretch; image-rendering: pixelated; }
```

The guide arrow is also a normal atlas sprite, `ui/guide_arrow` (4 frames, anchored at the bottom centre of the bounce range) for the world.
Contact sheets: `node scripts/pixel-contact.mjs --set portraits|feira|icons|ui|fixes` (writes `docs/lifesim/shots/art2/`).
