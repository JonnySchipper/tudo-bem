## Phase 1: art intake and the style frame (gate for the look of the whole project)

Adds the import pipeline (`pnpm pixel`), the game-ready art under `apps/client/public/pixel/`, and a separate Vite entry, `apps/client/lifesim-frame.html`, that renders a 30x18 slice of praça with Phaser: petit-pavé with the São Paulo mosaic, ipês with canopy sway and falling petals, benches, lamps, the banca, animated fountain, shopfronts with Portuguese plaques, three composed characters (walking loop, sitting, idle) plus two more, pigeons, a cat, traffic, cloud shadows, the golden-hour grade and a 17:00 -> 20:00 slider that lights the lamps and windows. **The game itself is unchanged** (not linked from the game; `main.ts` and `render/*` untouched).

Open it: `pnpm --filter @tudobem/client dev`, then `/lifesim-frame.html` (params: `t=17.5`, `zoom=3`, `cx`, `cy`, `play=1`, `ui=0`, `labels=0`).

### Screenshots (docs/lifesim/shots/p1/)
| | 17:30 | 19:30 |
|---|---|---|
| 1280x800 | [frame_1730_1280x800.png](https://github.com/JonnySchipper/tudo-bem/blob/lifesim/p1-style-frame/docs/lifesim/shots/p1/frame_1730_1280x800.png) | [frame_1930_1280x800.png](https://github.com/JonnySchipper/tudo-bem/blob/lifesim/p1-style-frame/docs/lifesim/shots/p1/frame_1930_1280x800.png) |
| 390x844 | [frame_1730_390x844.png](https://github.com/JonnySchipper/tudo-bem/blob/lifesim/p1-style-frame/docs/lifesim/shots/p1/frame_1730_390x844.png) | [frame_1930_390x844.png](https://github.com/JonnySchipper/tudo-bem/blob/lifesim/p1-style-frame/docs/lifesim/shots/p1/frame_1930_390x844.png) |

Extra 4x detail shots: [17:30](https://github.com/JonnySchipper/tudo-bem/blob/lifesim/p1-style-frame/docs/lifesim/shots/p1/frame_1730_1280x800_z4.png), [19:30](https://github.com/JonnySchipper/tudo-bem/blob/lifesim/p1-style-frame/docs/lifesim/shots/p1/frame_1930_1280x800_z4.png). Also checked at DPR 2 (device zoom 6): crisp, no seams, no bleeding.

### What is derived, hand-authored, placeholder
- **Derived** (edited in the import script): ipê amarelo large + medium (LimeZu trees, canopy remapped to the LimeZu yellow ramp, split into trunk + overhead canopy, 3 sway frames), shopfronts (LimeZu "STORE" plaques rewritten: PADARIA, MERCADO, FLORES, LANCHES, SAPATOS, PIZZA).
- **Hand-authored** (`assets-src/custom/`, LimeZu palette only): calçada petit-pavé + its 16 mask tiles (2 phases), São Paulo mosaic (48x32), banca de jornal (3x2, "BANCA" sign), petals, zebra crossing, lane dashes, wildflowers, tufts, grime.
- **LimeZu as is** (cropped): benches, lamps, trash bin, hedges, bushes, flower pots, fountain (animated), cars, pigeons, cat, manhole.
- **Generated (light/particle only)**: contact shadows, cast shadows from sprite silhouettes, glow, cloud shadow.
- **Placeholders (magenta) on the frame: none.** Still missing from the HOWTO custom list (not on the frame yet): orelhão, padaria/edifício/academia facades, poste com fios, chapéus stall, missão kiosk, parrot perch, bus, kombi/fusca/moto, vira-lata, feira stalls, portraits. The 5 emote rows of the character sheet are placeholders that reuse idle S.

### Files
- `scripts/pixel-import.mjs` + `scripts/lib/pixel/*` + `apps/client/assets-src/import-map.json`; root script `"pixel"`. Output: `public/pixel/**` + `manifest.json` (about 150 KB).
- `apps/client/src/render/pixel/`: `palette.ts` (ramp + key swap, pure), `terrain.ts` (dual-grid masks, pure), `lighting.ts` (grade/darkness, pure), `charsheet.ts`, `manifest.ts`, `frame/*` (scene, layout, labels, page entry). New files only; `facing.ts` and `render/*` untouched.
- `apps/client/assets-src/LICENSES.md` (credit line + both licenses summarized), `assets-src/README.md` (source -> canonical row mapping, terrain conversion), `docs/lifesim/DECISIONS.md` (Phase 1 section).
- Footer on the page: "Art: LimeZu — limezu.itch.io".

### Tests
- New unit tests: `palette.test.ts` (monotonic ramps for every catalog color, key swap on a 2x2 buffer), `terrain.test.ts` (mask order, borders, variants, phases), `lighting.test.ts`, `scripts/lib/pixel/pixel.test.mjs` (mask tiles have no seams across adjacent display tiles, canonical sheet row mapping, key conversion, packer, shadow/tree helpers). `vitest.config.ts` also includes `scripts/lib/**/*.test.mjs`.
- `pnpm typecheck` passes; `pnpm build` passes (frame entry chunk is separate, 1.2 MB / 328 KB gzip; game bundle unchanged).
- `pnpm test`: **506 passed, 2 failed, both pre-existing on this Windows machine** (they fail identically on `lifesim/main` before my change): `safety.test.ts` compares `\\` vs `/` paths, `curriculum.test.ts` me-ve-um-orders sync fails under a CRLF checkout. Because of them `pnpm verify` exits before its build step, so I ran typecheck, build and e2e separately.
- e2e against the production build (`TB_TEST_ROLL=1`, Chrome): `pnpm e2e` passed ("Phase 0 play path passed") and `pnpm e2e:meveum` passed.

### Decisions I made (full list in `docs/lifesim/DECISIONS.md`, Phase 1 section)
- Custom pieces route (c), agent-made, no placeholders needed for P1.
- Terrain mask tiles are derived from a fill tile, not converted from the pack autotiles (those paint X over a base terrain, both opaque). Two kinds: `slab` (calçada, on top) and `flat` underlays (grama, asfalto). Deviates from the priority list in 5.6 (g above c).
- The wave paving has 2 phases (32 px wave over 16 px tiles). Mosaic is 3x2 tiles instead of 2x2 (aspect ratio of the state).
- Character sheet: 6-frame idle/walk from the pack, sit S/N faked from idle, emotes reuse idle S, eyes baked into the body, one `outfit_*` layer instead of top/bottom/shoes.
- Lighting: two cameras; grade is a MULTIPLY render texture with holes cut by light sources; softened golden-hour keyframes (17:30 `#ffcd9e`); extra low-sun glow.
- Frame zoom is 3 on both viewports for composition (game rule would be 4 / 2); at 2 on a phone the real map must be taller than the viewport or have a backdrop.

### Needs BR review
Plaques PADARIA, MERCADO, FLORES, LANCHES, SAPATOS, PIZZA; sign BANCA; demo bubble "Boa tarde! Pão de queijo, açaí, você, não, avó, Nº 42". None enters the game yet.

### 🧑 JONNY checkpoint
Please approve or redirect the look on the screenshots above before Phase 2 builds on it. Questions: (1) is the high-contrast petit-pavé OK or should it be quieter; (2) the golden-hour grade is softer than the HOWTO keyframes, OK?; (3) the pack's characters are small chibi figures (16x22 visible), fine for the game?

🤖 Generated with [Claude Code](https://claude.com/claude-code)
