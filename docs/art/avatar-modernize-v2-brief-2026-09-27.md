# Avatar modernization v2 — anti-Habbo A+ (CEO lock 2026-09-27)
**Ask:** Jonny — characters still read Habbo / cheap social-hotel. Full enhancement: modernize, super cool, impressive.  
**Eng:** Claude Opus 5.5 via Jonny’s Claude Pro account (`claude --model opus`). Not Cursor cloud for this bake.  
**Art co-owner:** TB Art soft-check after Fly; prior v1 Art deltas + parked improve list are inputs.  
**Out of scope:** room tiles, Pedido/Conversa/Me vê um gameplay, Praia/BJJ/Sol.

## North star
Premium 2026 isometric hangout avatars (VMK after a real art pass) × São Paulo street-casual. Adult-readable (~6–6.5 heads), soft warm rendering, intentional silhouette.  
**Kill:** Habbo stub body, candy primaries, bobble/chibi head, hard black comic outline, flat plastic skin, one-tone sausage limbs, MS Paint / early Flash kids, meme faces, carnival stereotype.

## Must ship
1. **Player paper-doll** — body/skin → clothes → hair → face → hat. Free base (skin/hair/face/body) stays; shop hats still equip and **read first at 1280**.
2. **NPCs** — Carlos / Júlia / Nanda silhouette locks from `character-redesign-v1-art-deltas.md` Override 4 (keep personality + look).
3. **CPUs** — ≥5 distinct reads (hair + outfit + face), no clone army.
4. **Materials** — skin ≥4 tones with key/fill; hair clumps + rim; cloth fold bands; warm contact shadow under feet (~30–35%).
5. **Parked Art improve** — Júlia GUIA badge contrast; cloth value; stronger contact shadows; Carlos toque slightly shorter; Fernanda flower-crown soft carnival watch; material parity with Padaria/Praça polish.
6. **Shots** — before/after contact + in-room: player front/¾/hat-on; Carlos counter; Júlia Praça; Nanda stall; CPU lineup under `docs/art/characters-v2/`.
7. **Tests** — `pnpm test` + e2e green; open PR against main.

## Done when
PR open, CI green, Fly-deployable. Art reviews screenshots for “modern / not Habbo” jump. Iterate until Art PASS impressive.
