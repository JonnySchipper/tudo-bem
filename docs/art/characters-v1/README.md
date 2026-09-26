# Character redesign v1 (TB Art, 2026-09-26)

This pass is characters only: bodies, faces, clothes, hats and NPCs. The rooms stay exactly as room polish v2 left them. The TB Art hard overrides (`character-redesign-v1-art-deltas.md`) are binding wherever they conflict with the softer interim brief.

**Contact sheets:**
- [`contact_required.png`](contact_required.png): the acceptance #7 shots
- [`contact_lineups.png`](contact_lineups.png): before/after studio lineups
- [`contact_ingame.png`](contact_ingame.png): before/after in the solo Pages build at 1280×800, closeups at 2×

Individual shots are in [`before/`](before) and [`after/`](after).

## Required shots (Art acceptance #7)

| Shot | File |
| --- | --- |
| Player front + 3/4 + back + hat on (both starter presets) | [`after/sheet_player.png`](after/sheet_player.png) |
| Seu Carlos behind the counter | [`after/07_carlos_zoom.png`](after/07_carlos_zoom.png) · [dialogue](after/08_carlos_dialogue.png) |
| Júlia in the Praça | [`after/03_julia_zoom.png`](after/03_julia_zoom.png) |
| Nanda at her stall | [`after/04_nanda_zoom.png`](after/04_nanda_zoom.png) |
| CPU lineup | [`after/sheet_crowd.png`](after/sheet_crowd.png) · [in the Praça](after/02_crowd_zoom.png) |
| Extra: hats × big hair (no clip) · 9 hair silhouettes · Kitnet daylight · counter stool | [`sheet_hatfit`](after/sheet_hatfit.png) · [`sheet_hair`](after/sheet_hair.png) · [`10_kitnet_player`](after/10_kitnet_player_zoom.png) · [`09_counter_stool`](after/09_counter_stool_zoom.png) |

## Before / after

| | Before | After |
| --- | --- | --- |
| NPCs (front + back) | [sheet_npcs](before/sheet_npcs.png) | [sheet_npcs](after/sheet_npcs.png) · [closeup 2×](after/sheet_closeup.png) |
| CPU neighbors | [sheet_crowd](before/sheet_crowd.png) | [sheet_crowd](after/sheet_crowd.png) |
| 12 hats worn | [sheet_hats](before/sheet_hats.png) | [sheet_hats](after/sheet_hats.png) · [shop icons](../sheet_hats.png) |
| Creator range | [sheet_creator](before/sheet_creator.png) · [preview](before/00_creator_preview.png) | [sheet_creator](after/sheet_creator.png) · [preview](after/00_creator_preview.png) |
| Poses + emotes | [sheet_poses](before/sheet_poses.png) | [sheet_poses](after/sheet_poses.png) |
| Praça | [01_praca](before/01_praca.png) · [zoom](before/01_praca_zoom.png) · [crowd](before/02_crowd_zoom.png) | [01_praca](after/01_praca.png) · [zoom](after/01_praca_zoom.png) · [crowd](after/02_crowd_zoom.png) |
| Júlia / Nanda | [03_julia](before/03_julia_zoom.png) · [04_nanda](before/04_nanda_zoom.png) | [03_julia](after/03_julia_zoom.png) · [04_nanda](after/04_nanda_zoom.png) |
| Seu Carlos | [07_carlos](before/07_carlos_zoom.png) · [dialogue](before/08_carlos_dialogue.png) | [07_carlos](after/07_carlos_zoom.png) · [dialogue](after/08_carlos_dialogue.png) |
| Hat shop | [05_hat_shop](before/05_hat_shop.png) | [05_hat_shop](after/05_hat_shop.png) |

To regenerate: build and serve the solo build, then run `SHOTS_DIR=docs/art/characters-v1/after node scripts/character-shots.mjs` and `node scripts/character-contact.mjs`. Each script's header has the full commands.

## Art overrides, lock by lock

| Override | What shipped |
| --- | --- |
| **1 North star** | Premium iso-social quality matched to room polish v2, with SP street-casual fashion: adult proportions and faces, soft rendering, intentional silhouettes. No AC/Cozy Grove softness, no chibi. |
| **2 Height / head** | ≈6.3 heads (crown ≈ −88, head ≈ 14 units). The legs carry the length: hip at −44, thigh 20.4, shin 20.6. Normal adult head, no bobble. |
| **2 Limbs** | Tapered variable-width limbs (thigh → knee → calf → ankle, shoulder → elbow → wrist) with 2–3 value bands: light plane, body tone, then a tighter core-shadow step into reflected shadow. Warm rim on the shadow edge. |
| **2 Outline** | A soft warm plum-ink silhouette edge at about 1 device px in game, plus colored line work inside. Never a black comic outline. |
| **2 Face** | The nose is soft planes: bridge shadow, tip glow and nostril wings, no triangle. Eyes are almond or round with sclera, iris (warm lower ring), catchlight, a lid shade and a lash line; no pie-cut. Brows carry emotion (rest, up, worried, soft). The mouth has a lip line and a lower-lip value, with cheek warmth. There are 4 face styles and 6 details. |
| **2 Skin** | 8 creator tones spanning the Brazilian range from light to deep. Each has a warm key, a red-brown subsurface fill, cheek warmth and a jaw turn. |
| **2 Hair** | 9 silhouettes: curto, degradê (fade), **undercut / side-part**, cacheado, black power, **ondulado (shoulder waves)**, longo, coque, tranças. Each is built from clumped masses with a broken sheen and a light rim, and grey hair gets salt-and-pepper strands. All nine are drawn in three views: three-quarter, back, and straight-on front. |
| **2 Starter clothes** | Free presets in the creator (**Visual inicial**): Jeans + camiseta, **Blusa + calça**, Camisa + calça, Moletom + bermuda. Details: <ul><li>Jeans: fade, knee breaks, stitched seam and a flat rolled cuff.</li><li>Tee: rib and drag folds.</li><li>Soft blouse: V neck, flutter sleeves, drape, and gathers at the tuck, with a leather belt and metal buckle.</li><li>Button shirt: collar, placket, pocket and rolled sleeves.</li><li>Hoodie: hood, drawstrings, pocket and ribbed hem.</li><li>Skirt: pleats.</li></ul> |
| **3 Layer order** | Body/skin → starter clothes → hair → face → hat. The face features are painted after the hair, and the hat sits on the skull above the hair volume. Hair peeks out at the sides and nape (bun under the hat, braids, afro sides). The creator and hat equip work unchanged. |
| **4 Seu Carlos** | Mid-age, solid build, salt-and-pepper hair and a full mustache. Patient brow and calm mouth. A **white flour-dusted apron over a warm terracotta shirt** with a soft flour smudge, no slapstick. Also a pano de prato, a slim watch and a low padaria toque. Reads half-body behind the counter. |
| **4 Júlia** | A contemporary SP young adult in an open, welcoming stance, palm out. **Shoulder waves, a cream blouse with a coral lanyard, jeans**, a crossbody bag and no visor. Every ~9 s she points toward the loop. |
| **4 Nanda** | **Mustard shirt + jeans, a coral pochete, and her own straw hat**, which reads at stall distance. She leans toward the player, has playful brows and a grin, and every ~7 s lifts a yellow bucket hat to show it. Box braids with gold cuffs. |
| **4 Player** | Customizable, with a straight-on front view in the creator. The hat reads first. |
| **5 CPUs** | Helena, Daniel, Mateus, Felipe and Rafael are fully authored. Every other name maps to one of 14 archetypes. Tests enforce that any two neighbors who can share the square differ on **≥3 of hair / top / bottoms / posture / accessory**. The named five also all have distinct faces. Postures vary in lean: pockets lean back, arms crossed, phone leans forward, hand on hip, tote. Verde plates stay, and there's no CPU chat art. |
| **6 Hats** | All 12 were rebaked on the new skull. Each hat scales to the hair volume, with brims tipped so faces stay visible. In the straight-on front view, cap and visor brims point at the camera. [`sheet_hatfit`](after/sheet_hatfit.png) shows every hat on the afro, curls, bun, undercut and waves with no clipping. The hats carry a stronger ink halo, so they're the first read at 1280. The shop icons were rebaked too. |
| **7 Materials / light** | <ul><li>Skin: key + fill + cheek warmth.</li><li>Hair: 2–3 value clumps + rim.</li><li>Cloth: fold breaks (apron, jeans, blouse).</li><li>Accents, used sparingly: belt buckle, cap button, watch, pochete zip.</li><li>Contact shadow under the feet: warm-ink ellipse at ≈35% core, plus a tight occlusion under each sole.</li><li>Rim light per room: Praça late-afternoon gold, Padaria morning cream on Carlos, Kitnet neutral daylight on the player.</li></ul> |

## Gameplay and data (the Phase 0 loop is unchanged)

- `Appearance` gains optional `face`, `extra` and `idle`, sanitized server-side. Older saves load with defaults.
- `HAIR_STYLES` gains `undercut` and `ondulado`, and `TOP_STYLES` gains `blusa`; `CLOTH_COLORS` gains coral. All existing indices are stable.
- The creator adds **Visual inicial**, **Rosto** and **Detalhe**. The 18+ confirmation is untouched.
- Paper-doll creation, hat equip, Seu Carlos's *Me vê um…*, the Missão do dia, sitting, the 18+ gate, curriculum and safety are all unchanged. The server e2e and the solo Pages e2e both pass.
- Nameplates and hit boxes follow each silhouette's real height, so tall hats and afros never hide under the plate. Counter stools report their seat height so people sit on them.

## Pipeline

- **Renderer:** `apps/client/src/render/avatar.ts` (compositor + public API) and `render/avatar/`:
  - `rig.ts`: skeleton, IK, walk cycle, postures and lean, emotes, NPC gestures, front/three-quarter turn
  - `body.ts`: legs, shoes, bottoms, tops, arms, hands, held props, NPC layers
  - `head.ts`: three views of the head, face, extras and 9 hair styles
  - `hats.ts`: hats and shop icons
  - `shape.ts`, `color.ts`: shading and tone math
- **Frame cache:** each distinct pose is painted once per device scale into a cached frame with the silhouette outline composited in, then blitted. A warm Praça frame is about 1 ms in headless Chrome. First-time paints are capped at two per tick.
- `pnpm art` rebakes the hat icons and all avatar and character review renders. The `/art.html` studio's **Personagens** section has every lineup above.
