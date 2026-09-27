# Art deltas — Character Redesign v1 (override CEO interim)

Owner: TB Art. Opus treats these as **hard locks** over anything softer in `character-redesign-v1.md`. Rooms stay as polish v2; this pass is bodies/faces/clothes/hats/NPCs only.

## Why the interim needs tightening

North star drifts toward Animal Crossing / Cozy Grove softness → chibi risk. NPC locks are personality-only (no silhouette). Layer order conflicts `avatar-hats.md`. CPUs have names but no distinct-read checklist. Materials language too vague for canvas bake. Hats lack skull-fit rules.

## Override 1 — North star (replace soft refs)

Characters must match **room polish v2 quality**, not undercut it. Feel: modern premium isometric social avatar (VMK / high-end iso hangout after a 2026 art pass) × São Paulo street-casual fashion cues. Soft rendering + intentional silhouette + appealing adult faces. Warm, friendly, slightly stylized — **not** Habbo stubs, not MS Paint kids, not early Flash, not deep chibi AC.

Drop AC / Cozy Grove / Spiritfarer as primary refs (too soft/cute). Keep family-safe hangout energy for 18+ players.

## Override 2 — Construction locks

| Rule | Lock |
|------|------|
| Height | ~6–6.5 heads; legs carry length; no stubby torso |
| Head | Normal adult; slight style OK; **no** bobble / deep chibi |
| Limbs | Soft volume with 2–3 shade bands — **not** one-tone sausage |
| Outline | Soft warm-ink edge (1px-feel), never hard black comic outline as the style |
| Face | Soft form nose (no triangle); almond/round eyes with iris + soft lid (no pie-cut); brows that carry emotion; mouth with soft lip value; cheek warmth optional |
| Skin | At least **4** creator skin tones spanning light→deep BR range; each with soft key + fill (not flat plastic) |
| Hair | Clumped masses + rim light; 6+ creator styles with distinct silhouette (short, fade, bun, shoulder waves, curls, undercut/side-part) |
| Starter clothes | 2 presentation presets min: casual jeans+tee, soft blouse/shirt+pants — fabric folds, not flat recolors. Free, cool enough you’d keep them |

## Override 3 — Paper-doll layer order (resolve conflict)

Lock: **body/skin → starter clothes → hair → face → hat**.

Hats sit on skull **above** hair volume; hair peeks at sides/nape where silhouette needs it. Creator + equip must still work. Rebake all ~12 hats to new crown height (see Override 5).

## Override 4 — NPC silhouette locks (must-communicate → must-look-like)

| Character | Visual lock |
|-----------|-------------|
| **Seu Carlos** | Mid-age BR man, solid build, salt-and-pepper or dark-with-grey hair, patient brow/calm mouth. White flour-dusted apron over warm shirt; soft flour smudge on apron OK — **not** slapstick. Readable half-body behind counter; “Pois não” kindness in face, not clown |
| **Júlia** | Contemporary SP young adult woman; welcoming open posture. Shoulder-length or tidy bun; light blouse + jeans or simple dress in palette (cream / soft coral accent OK). Host energy without cheerleader costume |
| **Nanda** | Hat-stall merchant; lively lean toward player. Distinct colorful-but-tasteful top (mustard or mural-coral accent) + jeans; **her own signature hat** equipped so stall identity reads at distance. Playful eyes, not meme face |
| **Player** | Customizable paper-doll; cool enough you’d want to dress them; hat reads first at 1280 |

## Override 5 — CPU neighbors (anti-clone army)

Ship **≥5 distinct reads** among Helena, Daniel, Mateus, Felipe, Rafael (and any extras). Each must differ on **≥3** of: hair silhouette, top color/shape, bottoms, posture lean, accessory. Verde plates stay. No autonomous chat art (Live Ops rule). Face variety required — shirt recolor alone = **fail**.

## Override 6 — Hats (silhouette heroes, new skulls)

- All ~12 hats from `avatar-hats.md` rebaked to new head proportions
- Crown/brim clearance: no clip into skull or hair mass; hat remains the first read at 1280
- Equip still obvious in screenshot (Boné verde etc.)
- Out unchanged: licensed kits, gi, adult/clubwear

## Override 7 — Materials (canvas-bake language)

Match polish v2 materials bar on characters:
- Skin: soft key + fill + optional cheek warmth (subsurface *feel*, not plastic)
- Hair: 2–3 value clumps + light rim
- Cloth (apron, jeans, blouse): visible fold breaks, not flat fill
- Leather/metal accents sparingly (belt buckle, hat button)
- Soft **contact shadow** ellipse under feet (warm-ink, ~20–35% opacity) — matches rooms

Lighting: Praça late-afternoon warm key; Padaria morning warm on Carlos; Kitnet neutral daylight on player — same as `palette.md`.

## Override 8 — Acceptance (Art hard bar)

Pass only if before/after contact sheet + Pages shots show:

1. Instant “modern / not 90s clipart” jump vs current
2. Carlos / Júlia / Nanda unmistakable **and** appealing at counter / host / stall distance
3. ≥5 CPU distinct reads (face + outfit + hair)
4. Hats + Verde still crisp; no clip on new skulls
5. No regress on room polish v2
6. Family-safe SP warmth; no carnival stereotype, no chibi-creepy, no meme faces
7. Required shots in `docs/art/characters-v1/`: player front + 3/4 + hat-on; Carlos behind counter; Júlia Praça; Nanda at stall; CPU lineup

Fail → numbered Art deltas; Opus rebakes. No scope creep (rooms / Praia / BJJ / Sol out).

## Hand-off note for Opus

Follow CEO interim for PR / CI / `pnpm art` / Pages path. Prefer **these Art overrides** wherever they conflict with softer language in the interim brief.
