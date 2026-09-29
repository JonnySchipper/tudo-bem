# Decisions made in Phase 1 (art intake + style frame)

To be merged into `DECISIONS.md` by the boss. Each item is a decision the HOWTO left open, or a deliberate deviation from it.

## Art sourcing

1. **Custom Brazilian pieces: route (c), agent-made.** No artist and no AI image tool, so each custom piece is either
   *derived* from a LimeZu sprite by an edit in the import script, or *hand-authored* as a pixel grid / rects with LimeZu palette
   colors only. Sources in `apps/client/assets-src/custom/` (`.mjs` generators + rendered PNGs in `custom/png/`).
   Derived: ipê amarelo (large + medium), shopfronts (plaque text). Authored: calçada petit-pavé, São Paulo mosaic, banca,
   petals, zebra crossing, lane dashes, flowers, tufts, grime. Nothing is a placeholder on the frame.
2. **Credits.** `apps/client/assets-src/LICENSES.md` summarizes both LimeZu licenses (credit + limezu.itch.io, no redistribution of
   raw files). The frame footer shows "Art: LimeZu — limezu.itch.io". The in-game credits screen is a later phase.
3. **Only the 16x16 folders** of the packs are used. `public/pixel/` holds only what `import-map.json` lists (about 145 KB).

## Terrain

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

## Manifest (differences from the sketch in HOWTO 5.12)

8. `terrain` = `{ tileset, tile, margin, spacing, columns, count, layers: { c: { first, phases, variants, edge } } }` (extruded
   tileset via `tile-extruder`, `margin 1 / spacing 2`). Atlases also list their JSON (`data`). Sprite entries gain optional
   `shadow` (contact shadow key), `cast` (generated cast-shadow frame), `light`, `windows` (glass rects for lit windows) and
   `decal`. Extra top-level keys: `sheet` (canonical character sheet layout + animation table), `keyRamps`, `fx`.
   Anchors may lie outside the sprite (canopy overhead parts): `ay` is measured in the sprite's own coordinates.

## Characters

9. **Layered sheets, no GUI tool.** Source rows -> canonical rows are in `assets-src/README.md`. Idle and walk are 6 frames
   (the pack's count) instead of "up to 4" idle. Sit W/E come from the pack; sit S/N are the idle frame lowered 4 px (the bench
   seat hides the legs). The 5 emote rows are **placeholders that reuse idle S** (the pack has no such art).
10. **Eyes are baked into the body layer**; outfits are one layer covering top + bottom (`outfit_*`), so P1 has no separate
    `top_*` / `bottom_*` / `shoes_*` layers. Phase 3 decides whether to split them or accept the pack's outfits.
11. **Key-ramp swap is reusable pure code** (`palette.ts`, unit-tested): `buildRamp`, `rampMap`, `swapKeys`, `keyMapForShades`.
    Layers are stored in exact key colors (`KEY_RAMPS`); the import script maps each layer's source shades to key ranks by luminance.
12. `charsheet.ts` has its own `CANON_FACING_ROW` (S 0, W 1, E 2, N 3) so P1 doesn't depend on Phase 0's `facing.ts`
    (this branch must not touch it). On merge, replace it with `FACING_ROW` from `facing.ts`.

## Rendering / lighting (style frame)

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

## Tooling

19. New root devDeps `sharp`, `tile-extruder`; `phaser@^3` in `apps/client` (resolved 3.90.0, the last 3.x). Root script
    `"pixel": "node scripts/pixel-import.mjs"`. The import script loads `palette.ts` / `terrain.ts` directly with Node's type
    stripping, so the runtime and the import share one implementation (those two files must stay free of relative imports and of
    non-erasable TypeScript syntax).
20. `vitest.config.ts` now also includes `scripts/lib/**/*.test.mjs` (tests for the import helpers).
21. `lifesim-frame.html` is a separate Vite entry (`lifesimFrame`), not linked from the game; the game's own bundle is unchanged
    (Phaser is only in the frame entry's chunk, about 1.2 MB / 328 KB gzip).
22. Environment note (Windows): `pnpm` was not on PATH, `corepack pnpm` works. Two tests fail on this machine both before and after
    this change (`safety.test.ts` compares `\\` vs `/` paths, `curriculum.test.ts` me-ve-um-orders sync fails under CRLF checkout).

## Needs BR review

Every new PT string is marked here so it can go into the content review list: shop plaques PADARIA, MERCADO, FLORES, LANCHES,
SAPATOS, PIZZA; sign BANCA; frame demo bubble "Boa tarde! Pão de queijo, açaí, você, não, avó, Nº 42" (gloss: "Good afternoon!
Cheese bread, açaí, you, no, grandma, No. 42"). None of it enters the game yet. No new curriculum cards were added.
