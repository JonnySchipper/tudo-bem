# Character redesign v1 (TB Art brief, 2026-09-26)

This pass redoes the characters only. The founder's read was that they looked cheap and 1990s next to the room polish v2 rooms. The rooms are unchanged. The one room-adjacent change is that counter stools now report their seat height, so people sit *on* them instead of sinking in.

**Contact sheets:** [`contact_lineups.png`](contact_lineups.png) (studio lineups) · [`contact_ingame.png`](contact_ingame.png) (solo Pages build at 1280×800, closeups at 2×). Individual shots are in [`before/`](before) and [`after/`](after).

| | Before | After |
| --- | --- | --- |
| NPCs (front + back) | [sheet_npcs](before/sheet_npcs.png) | [sheet_npcs](after/sheet_npcs.png) · [closeup 2×](after/sheet_closeup.png) |
| CPU neighbors | [sheet_crowd](before/sheet_crowd.png) | [sheet_crowd](after/sheet_crowd.png) |
| 12 hats worn | [sheet_hats](before/sheet_hats.png) | [sheet_hats](after/sheet_hats.png) · [shop icons](../sheet_hats.png) |
| Creator range | [sheet_creator](before/sheet_creator.png) · [preview](before/00_creator_preview.png) | [sheet_creator](after/sheet_creator.png) · [preview](after/00_creator_preview.png) |
| Poses + emotes | [sheet_poses](before/sheet_poses.png) | [sheet_poses](after/sheet_poses.png) |
| Praça | [01_praca](before/01_praca.png) · [zoom](before/01_praca_zoom.png) · [crowd](before/02_crowd_zoom.png) | [01_praca](after/01_praca.png) · [zoom](after/01_praca_zoom.png) · [crowd](after/02_crowd_zoom.png) |
| Júlia / Nanda | [03_julia](before/03_julia_zoom.png) · [04_nanda](before/04_nanda_zoom.png) | [03_julia](after/03_julia_zoom.png) · [04_nanda](after/04_nanda_zoom.png) |
| Seu Carlos | [07_carlos](before/07_carlos_zoom.png) · [dialogue](before/08_carlos_dialogue.png) | [07_carlos](after/07_carlos_zoom.png) · [dialogue](after/08_carlos_dialogue.png) · [counter stool](after/09_counter_stool_zoom.png) |
| Hat shop | [05_hat_shop](before/05_hat_shop.png) | [05_hat_shop](after/05_hat_shop.png) |

To regenerate, build and serve the solo build, then run `SHOTS_DIR=docs/art/characters-v1/after node scripts/character-shots.mjs` and `node scripts/character-contact.mjs`. The header of each script has the full commands.

## What changed

**Design levers from the brief:**

1. **Proportions:** figures are now about 6 heads tall: crown ≈ 86 units, head ≈ 14.6. Bobble heads are gone. The legs, arms and neck lengths are real, with a trapezius slope into the neck, and the three body types differ in shoulders, waist, hips, belly and limb thickness. Standing idle has a gentle contrapposto: weight on the back leg, front knee soft.
2. **Faces:** a 3/4 head shape with jaw and chin that vary by face style. Eyes are built from sclera, iris, catchlight and a heavier upper lid. Brows, a soft nose plane with a tip highlight, and a lip line with a lower-lip glow replace the old dots and pie-cut shapes. Emotion states: idle smile, Carlos's patient calm, open smile (oi), laugh with happy eyes (rir), grin (valeu), and worried brows with a small mouth (desculpa). Blinks.
3. **Materials:**
   - Every part is form-shaded. There is a lit-side → shadow-side ramp, the shadows are warm (plum-brown for cloth, red-brown for skin), and line work is colored rather than black.
   - Jeans have fades, knee creases, stitched outer seams and rolled cuffs. Tees have crew ribs and drag folds; hoodies have a hood, drawstrings, a kangaroo pocket and ribbed hems. Button shirts have collars, placket, buttons, a pocket and sleeves rolled at the elbow. Skirts have soft pleats.
   - Sneakers have soles, laces and a side panel. Hair is built from clumps with a broken sheen band. The afro and curls are coily volumes.
4. **Silhouette variety:**
   - Seven hair shapes. Four face styles and six details: glasses, beard, mustache, earrings, freckles.
   - Seven idle postures: relaxed, hands in pockets, arms crossed, phone, copo americano, hand on hip, tote bag.
5. **Lighting:** each frame gets a rim light matched to the room. The Praça is late-afternoon gold, the Padaria warm morning cream, the Kitnet cool daylight. The key light stays on the upper-left of the screen even when the figure is mirrored. A soft contact shadow sits under the feet, and brimmed hats cast shade onto the face.
6. **Paper-doll tech:** the layer order is kept (hair behind → body → clothes → signature layers → arms → head/face → hair → hat), and the creator and hat equip work unchanged.

**Hats (silhouette heroes):** all 12 are redrawn as objects:
- caps: 6-panel cap with stitched brim, snapback from behind; visor; bike helmet with vents and strap
- knit and felt: knit beanie with ribbed cuff and pompom; felt beret
- brimmed straw and felt: woven straw brim with ribbon; floppy sun hat with bow; stitched bucket; panamá with dent, pinch and band
- novelty: flower crown with shaded petals and leaves; pleated baker's toque; satin top hat with a sequin band and plume

Hats scale to the hair volume (the afro wears hats higher and wider) and never clip into the skull. The hat also gets a stronger ink halo than the body, so it reads first. The shop icons are the same hats on a soft floor shadow.

**Authored NPCs:**

- **Seu Carlos:** a stocky, mid-age padaria owner. Salt-and-pepper hair and a full mustache, patient calm brows and smile. He wears a canvas bib apron with mustard stitching, a pocket with a pencil and a light dusting of flour, over a white shirt with rolled sleeves. A *pano de prato* hangs over his shoulder, plus a slim leather watch and the pleated toque. There's no slapstick, and he reads clearly above the counter.
- **Júlia:** the Praça host, a contemporary young paulistana. She has curls under the blue visor, earrings, a green tee, jeans, a mustard lanyard with a GUIA badge, a crossbody leather bag and a folded map. Every ~9 s she **points toward the loop**.
- **Nanda:** the hat merchant. Box braids with gold cuffs under the flower crown, earrings, beaded bracelets, a petróleo shirt, a mustard skirt and a pochete. She holds a straw hat and **lifts it to show you** every ~7 s, with her other hand on her hip.

**CPU neighbors:** there's no clone army anymore. `packages/shared/src/looks.ts` is an authored wardrobe of 14 São Paulo street looks. Each name always wears the same look. Helena is the tia do bairro, Daniel the executivo, Mateus the skatista, Felipe the ciclista and Rafael the barista. The rest map to archetypes by name. When the server fills the Praça, it picks names whose look isn't already there, so a crowd of 4–6 is always 4–6 different silhouettes.

**Palette:** clothing moved to fashion-muted street colors in `palette.md` warmth: verde, mostarda, jeans, terracota, off-white, grafite, tijolo, ameixa, petróleo, rosa antigo, cáqui, oliva. The indices are stable, so existing saves keep their color family. Skin tones are unchanged.

## Gameplay and data (unchanged loop)

- `Appearance` gains optional `face`, `extra` and `idle`. The server sanitizes them, and saves from before the redesign load with defaults (`suave` / `nenhum` / `solto`).
- The creator adds **Rosto** and **Detalhe** chips. Everything else is the same flow, including the 18+ confirmation.
- Paper-doll creation, hat equip, Seu Carlos's *Me vê um…*, the Missão do dia, sitting, the 18+ gate, curriculum and safety all still work. The server e2e and the solo Pages e2e both pass.
- Nameplates (Verde / NPC / self) and hit boxes now follow each silhouette's real height, so tall hats and afros never cover their plate.

## Pipeline

- **Renderer:** `apps/client/src/render/avatar.ts` (compositor + public API) and `render/avatar/`:
  - `rig.ts`: skeleton, IK, walk cycle, postures, emotes, NPC gestures
  - `body.ts`: legs, shoes, bottoms, tops, arms, hands, held props, NPC layers
  - `head.ts`: head, face, extras, hair
  - `hats.ts`: hats and shop icons
  - `shape.ts`, `color.ts`: shading and tone math
- **Frame cache:** avatars still draw live, because they animate. Each distinct pose is painted once per device scale into a cached frame with the silhouette outline composited in, then blitted.
  - Walk is quantized to 12 frames, idle breath to 4, emotes to 15 fps.
  - Warm frames cost about 1 ms for a full Praça in headless Chrome.
  - First-time paints are capped at two per tick. Big previews (creator, shop) repaint directly instead of filling the cache.
- `pnpm art` rebakes the hat icons and the avatar/character review renders. The `/art.html` studio has a new **Personagens** section with these lineups.
