# Avatar enhance v2 (TB Art, 2026-09-27)

Brief: [`avatar-enhance-v2-brief-2026-09-27.md`](../avatar-enhance-v2-brief-2026-09-27.md) (hard locks). CEO brief: [`avatar-modernize-v2-brief-2026-09-27.md`](../avatar-modernize-v2-brief-2026-09-27.md).
Rooms, gameplay and the Padaria / Conversa holds are unchanged. Only the character renderer and the CPU wardrobe colors changed.

**Before** ([`before/`](before)) is a copy of the v1 bake ([`../characters-v1/after/`](../characters-v1/after)).
**After** ([`after/`](after)) is this branch, rendered headless from the solo build. Contact sheets:

- [`contact_required.png`](contact_required.png): the Art acceptance shots (after only)
- [`contact_lineups.png`](contact_lineups.png): studio lineups, before and after
- [`contact_ingame.png`](contact_ingame.png): in-game shots, before and after

The Praça shots use live CPUs, so who is standing where changes between runs.

## What changed vs v1

| Lock | v1 | v2 |
| --- | --- | --- |
| Paper-doll / sticker feel | A grey 50% halo up to 2.2 device px around the whole figure, so it read as a cutout sticker | A thin, near-solid warm-ink edge (≤1.1 px, `OUTLINE_INK` at 82%). At 58% the edge came out lighter than dark cloth and read as a pale ring at closeup. The per-part rim is now a hairline accent (60% strength, 1 unit wide), not a tan band inside every contour. Hats keep a stronger halo so they're still the first read at 1280. |
| Material parity with rooms | Each part is shaded on its own, so they read as stacked flat pieces | A **whole-figure light pass** (`lightPass` in `render/avatar.ts`), clipped to the silhouette. It adds occlusion that rises from the floor to the hip, a soft key from screen-left with shadow-side falloff, and a rim in the room's color wrapping the far edge, crown and shoulders. The rim is feathered (a wide faint pass, then a thin bright one), capped in device px and screen-blended, so it lifts the cloth's own hue. Skin, cloth and hair now share one light. |
| No sterile white | Off-white folds shaded toward a cool grey-violet | Light cloth folds shade toward a warm taupe (`tone` in `color.ts`) |
| Cloth ≥2 value bands | Light → base → core shadow | Light → base → **half-tone** → core shadow → **reflected bounce** (`paint` in `shape.ts`). This applies to jeans, tops, aprons, skin and hair. |
| Soft-shaded face | Near-black lash line | A warm dark lash mixed from the skin's deep tone, deeper eye sockets and a soft lower-lid light plane |
| Contact shadow 30–35% | 32% | 34%, plus the existing tight occlusion under each sole |
| Carlos toque (parked #4) | Scaled 0.8 | Scaled 0.68 (height 10 → 8.6), so his face and apron win the silhouette |
| Hats sit on the skull, never swallow the face | Sol, bucket, palha and panamá brims (and the boné brim in the creator's front view) landed on or below the eye line. Beatriz, Diego and the bucket-hat Jogadora had no visible eyes. | Wide brims are worn tipped back: flatter at the front, sides still on the band. `hatSeat` (`render/avatar/fit.ts`) pushes a hat back by at most ~0.8 head units, so the front edge stays above the lash line on every hair style. `fit.test.ts` checks all 12 hats × 9 hair styles against the same curves the painter draws. |
| CPUs not clones | Daniel, Paulo and Renata all wore an off-white top with graphite trousers, and 5 of 12 neighbors wore off-white | Non-authored archetypes are recolored so no two archetypes can share a top + bottom color block, and off-white is only Daniel's executive shirt (tests in `looks.test.ts`). Helena, Daniel, Mateus, Felipe and Rafael keep their authored looks. |

Carried from v1, where the tests already enforce them:
- ~6.3 heads
- Layer order body → clothes → hair → face → hat
- ≥5 distinct CPU reads (differing on ≥3 of hair / top / bottoms / posture / accessory)
- Enlarged Júlia GUIA badge

## Regenerate shots

```sh
pnpm install
VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
SHOTS_DIR=docs/art/characters-v2/after node scripts/character-shots.mjs
mkdir -p docs/art/characters-v2/before && cp docs/art/characters-v1/after/*.png docs/art/characters-v2/before/
DIR=docs/art/characters-v2 NAME="Avatar enhance v2" node scripts/character-contact.mjs
```

On a box with little free memory, headless Chrome can crash on the 2× Conversa dialogue shot. Set `SKIP_DIALOGUE=1` to skip `08_carlos_dialogue` / `08b_carlos_portrait` (the previous files are kept), and `BASE_URL` if port 4173 is taken. In the 2026-09-27 rebake, `08*` and `contact_ingame.png` are from the previous bake of this branch because of that. They predate the edge and rim fix, but the proportions, face and wardrobe are the same.

The scripts look for Chrome at `/usr/local/bin/google-chrome`, `/usr/bin/google-chrome` or `/usr/bin/chromium`. Set `CHROME_PATH` to use a different one.

Required shots for Art acceptance:
- `sheet_player`: front, three-quarter and hat on
- `07_carlos_zoom`: Carlos at the counter
- `03_julia_zoom`: Júlia in the Praça
- `04_nanda_zoom`: Nanda at her stall
- `sheet_crowd` and `02_crowd_zoom`: CPU lineup
- `sheet_hatfit`: every hat on the big hair silhouettes
