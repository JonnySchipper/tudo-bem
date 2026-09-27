# Avatar enhance v2 (TB Art, 2026-09-27)

Brief: [`avatar-enhance-v2-brief-2026-09-27.md`](../avatar-enhance-v2-brief-2026-09-27.md) (hard locks). CEO brief: [`avatar-modernize-v2-brief-2026-09-27.md`](../avatar-modernize-v2-brief-2026-09-27.md).
Rooms, gameplay and the Padaria / Conversa holds are unchanged. Only the character renderer changed.

**Before** is the v1 bake: [`../characters-v1/after/`](../characters-v1/after).
**After** shots go in [`after/`](after). They haven't been rendered yet (see *Regenerate* below).

## What changed vs v1

| Lock | v1 | v2 |
| --- | --- | --- |
| Paper-doll / sticker feel | A grey 50% halo up to 2.2 device px around the whole figure, so it read as a cutout sticker | A thin warm-ink edge (≤1.4 px, `OUTLINE_INK`). Hats keep a stronger halo so they're still the first read at 1280. |
| Material parity with rooms | Each part is shaded on its own, so they read as stacked flat pieces | A **whole-figure light pass** (`lightPass` in `render/avatar.ts`), clipped to the silhouette. It adds occlusion that rises from the floor to the hip, a soft key from screen-left with shadow-side falloff, and a rim in the room's color wrapping the far edge, crown and shoulders. Skin, cloth and hair now share one light. |
| Cloth ≥2 value bands | Light → base → core shadow | Light → base → **half-tone** → core shadow → **reflected bounce** (`paint` in `shape.ts`). This applies to jeans, tops, aprons, skin and hair. |
| Soft-shaded face | Near-black lash line | A warm dark lash mixed from the skin's deep tone, deeper eye sockets and a soft lower-lid light plane |
| Contact shadow 30–35% | 32% | 34%, plus the existing tight occlusion under each sole |
| Carlos toque (parked #4) | Scaled 0.8 | Scaled 0.68 (height 10 → 8.6), so his face and apron win the silhouette |

Carried from v1, where the tests already enforce them:
- ~6.3 heads
- Layer order body → clothes → hair → face → hat
- 12 hats fitted to the skull
- ≥5 distinct CPU reads (differing on ≥3 of hair / top / bottoms / posture / accessory)
- Enlarged Júlia GUIA badge

## Regenerate shots

```sh
VITE_LOCAL_WORLD=1 VITE_BASE=/tudo-bem/ pnpm --filter @tudobem/client build
node scripts/serve-static.mjs apps/client/dist 4173 /tudo-bem/ &
SHOTS_DIR=docs/art/characters-v2/after node scripts/character-shots.mjs
mkdir -p docs/art/characters-v2/before && cp docs/art/characters-v1/after/*.png docs/art/characters-v2/before/
DIR=docs/art/characters-v2 node scripts/character-contact.mjs
```

Required shots for Art acceptance:
- `sheet_player`: front, three-quarter and hat on
- `07_carlos_zoom`: Carlos at the counter
- `03_julia_zoom`: Júlia in the Praça
- `04_nanda_zoom`: Nanda at her stall
- `sheet_crowd` and `02_crowd_zoom`: CPU lineup
