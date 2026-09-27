# Padaria Art deltas v4 (Art Fly re-smoke of PR #17: FAIL/PARTIAL)

## Why v2 and v3 never reached Art on Fly

Art's `pr17-fly-live` shots don't show the v3 art. They show the **first bake** (`ced6a0b`):
- a white-topped balcão with a single yellow stripe,
- the register on a grey slab,
- a washed-orange estufa with three blobs.

See [`sprites/as-art-saw-on-fly/`](sprites/as-art-saw-on-fly). The PNGs on Fly were current (their md5 matches `main`), but the server sent every non-HTML file as `public, max-age=31536000, immutable`. Baked art keeps fixed names (`art/props/caixa.png`), so a browser that loaded Tudo Bem once kept the old sprites for a year.

The fix:
- `pnpm art` now stamps a content hash `v` on every manifest sprite (`scripts/art-stamp.mjs`).
- The loader requests `file?v=<hash>`.
- The server revalidates the manifest and any unversioned `/art/` request, and serves versioned art as immutable (`apps/server/src/cacheControl.ts`).
- Tests cover the stamp against the files on disk, and the cache policy.

The live code deltas (floor AO, glass overlay) did reach Fly; they were simply too weak at game scale. v4 strengthens them until they read at 1024 px.

## Evidence (1024×640, DPR 1: Art's framing)

Regenerate with `scripts/padaria-v4-shots.mjs` (see its header). `before/` is `main` @ 834d1c1 with fresh sprites (the best case of what Art should have seen), and `after/` is this branch. Each crop is kept at native game pixels, plus a `_3x` nearest-neighbour blow-up. `compare/` shows them side by side. `diff/` is a |Δ|×3 map.

| Art check | Before → after | Pixels changed (>30/765) |
| --- | --- | --- |
| 1. Glass-cool diagonal streaks + cool SALGADOS lid | [compare/d1_glass_case](compare/d1_glass_case.png) | 49% of crop |
| 2. Soft AO band at the wall feet | [compare/d2_floor_ao_wall](compare/d2_floor_ao_wall.png) | 25% |
| 2. Soft AO band at the counter feet | [compare/d2_floor_ao_counter](compare/d2_floor_ao_counter.png) | 32% |
| 3. Readable separate tray by the register | [compare/d3_register_tray](compare/d3_register_tray.png) | 23% |
| 4. Packed readable salgados | [compare/d4_salgados_case](compare/d4_salgados_case.png) | 56% |
| Full room (no regressions to window key, wall bands, loaf shelves, wood counter) | [before](before/00_padaria_full.png) · [after](after/00_padaria_full.png) | 3% of frame |

Baked sprites before/after: [`sprites/`](sprites).

## What changed

1. **Glass** (`caseGlass`/`caseLid` in `render/props.ts`, live overlay in `render/room.ts`):
   - A cyan wash over each pane.
   - Two bold diagonal streaks on the long pane and one on the short pane: a wide cyan band, a pale-cyan body and a near-white core.
   - A **cyan glass lid** on both cases, with its own diagonal glints, replacing the grey-white slab.
   - The live "+" twinkle is replaced by a cool pulse on the diagonal streak, and the sweeping glint is now cyan.
2. **Floor AO** (`drawFloorAO`): iso foreshortening squashes one tile of depth to about 13 px at 1024 px, so the old bands were only 2–5 px of darkening.
   - **Wall feet:** 1.5 tiles long, still ~42% dark at 0.45 tile.
   - **Counter feet:** a 1.6-tile gradient toward the customer side, from 85% at the kick to ~32% at half a tile.
   - Wall-base AO and the inner corner are darker too.
3. **Tray** (`caixa`): a large **oval honey-wood tray** (dark raised rim, grained floor, hard cast shadow, lit lip) holds a cafezinho and three pães de queijo. It replaces the small grey steel bandeja that read as a pad. The napkin holder moved off the caixa to free the space (the balcão still has two).
4. **Salgados** (`estufa`, `salgado`):
   - Nine big pastries with heavy outlines replace ~50 tiny blobs: an upper tray of 3 (×1.3) and a lower tray of 3+3 (×1.55 / ×1.85).
   - Distinct values per type: orange teardrop coxinha, pale-cream ball-cluster pão de queijo, dark fluted empada with a pale top.
   - The interior is darker so they pop, and the estufa glass is taller (26 → 34, `ESTUFA_GLASS_H`) so the pane is bigger.
   - The SALGADOS sign moved to stay clear of the trilho.

**Limit (stated honestly):** the case is one tile, so at Art's 1024 px framing the front pane is ~25 px wide. The pastries now read as distinct shapes and colours, but fine detail (the coxinha's tip, the empada's crimp) only resolves at the sprite level ([`sprites/after/estufa.png`](sprites/after/estufa.png)) or when zoomed in.
