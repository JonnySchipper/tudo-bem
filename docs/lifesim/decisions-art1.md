# Decisions made in Art 1 (Brazilian set pieces)

Branch `lifesim/art1-set-pieces`. To be merged into `DECISIONS.md` by the boss. Contact sheet: `docs/lifesim/shots/art1/pieces.png`;
frame screenshots (17:30 and 19:30): `docs/lifesim/shots/art1/frame_*_1280x800.png`.

## Pipeline

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

## Key naming and facings

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

## Lit windows

8. **Night windows are an overlay sprite** (`facades/*_lit`, same size as the facade, only the panes are opaque: warm gradient, bread on the
   padaria shelves, gym silhouettes) referenced by `lit` on the facade. The frame fades it in with `glowStrength` and still punches light holes
   from the facade's `windows` rects. Without `lit` the frame falls back to the P1 additive rectangles.

## Lighting

9. **Golden-hour shadow fill.** `lighting.ts` gains `shadowFillStrength(hour)` / `shadowFill(hour)`: 0 before 16:30, ramp to 1 at 17:30, held to
   18:15, out by 19:45 (smooth steps). The frame draws a full-screen `#3454a8` rectangle with the SCREEN blend at alpha `0.2 * strength`, between the
   multiply grade and the night darkness, so shadows read cool blue against the warm ground instead of one orange wash. Three unit tests added
   (`lighting.test.ts`). Chosen values are constants (`SHADOW_FILL_COLOR`, `SHADOW_FILL_MAX`) if the boss wants more or less.

## Terrain

10. **Calçada contrast about 40% lower.** The light/dark stone pools (`PAVE` in `custom/calcada.mjs`) moved to pack lavenders: light stones ~luma 192
    (was 233), dark ~128 (was 125): contrast 64 vs 108 (-41%, tested in `art1.test.mjs`: ratio between 0.5 and 0.7). Pattern unchanged. The São Paulo
    mosaic keeps the old stone values (`STONE`), so it now stands out a little more than the paving, as requested. The mask tile edges (curb, lip) are unchanged.

## What is derived, authored, placeholder

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

## Known weaknesses (honest list)

- The moto and the dog are the weakest pieces: tiny hand-built silhouettes next to LimeZu's polish. The sleeping dog reads as a caramel loaf.
- The kombi is a repainted camper (boxy); it says "van" rather than "Kombi" (no V-nose, no split windscreen).
- Wires are 1 px lines in the pack's wire grey; from far away they read as a dark band, hence the 0.7 alpha in the frame.
- Facade rooftops: only the Edifício has rooftop details; padaria and academia are flat parapets. Facade side walls and corner pieces are not made.
- The mirrored west facings of fusca / moto / dog flip the highlight to the wrong side (barely visible at 1 art px rims).

## Needs BR review

New PT text painted into signs (uppercase, no accents in pixels): PADARIA / DO SEU CARLOS, ACADEMIA / DO BAIRRO, EDIFICIO IPE, Nº 42, R. DOS IPES.
Accented forms for the DOM labels: Padaria do Seu Carlos, Academia do Bairro, Edifício Ipê Nº 42, R. dos Ipês.
