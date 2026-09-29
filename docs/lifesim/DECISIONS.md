# Decisions

Locked choices from the life-sim how-to, plus calls made while building. Phase 1 details stay in `decisions-p1.md`. Do not redo that art pass.

## Locked (how-to §3)

| # | Decision |
|---|---|
| D1 | Top-down 16×16 pixel art. Characters are 16×32 frames. |
| D2 | Phaser 3. Not Phaser 4, Pixi, or Three. |
| D3 | Phaser is a view only. It does not capture input or store game truth. |
| D4 | The server stays authoritative and tile-based. |
| D5 | Tile coordinates keep their meaning. `SE→E`, `SW→S`, `NE→N`, `NW→W`. |
| D6 | Props, buildings, characters and terrain come from files. |
| D7 | Base art is LimeZu Modern Exteriors and Modern Interiors, 16×16. |
| D8 | Text is DOM. Only very short sign words are pixels. |
| D9 | Learning text stays in Nunito. |
| D10 | Maps are TypeScript in `rooms.ts`. |
| D11 | One game day is 48 real minutes. |
| D12 | Every learning activity is reachable at every game hour. |

## Calls made here

1. **Keep the Phase 1 look.** High-contrast petit-pavé stays. The softened golden-hour grade already in `lighting.ts` stays (do not restore the harsher how-to keyframes). LimeZu chibi characters are the game characters.
2. **Do not rewrite finished modules.** `palette.ts`, `terrain.ts`, `lighting.ts`, `charsheet.ts`, the import script, the style frame, `clock.ts`, `weather.ts`, `facing.ts`, `coords.ts`, `hitbox.ts` and `moveStep.ts` are inputs. Later phases call them.
3. **`charsheet.ts` keeps `CANON_FACING_ROW`.** It matches `FACING_ROW`. A test locks that. The style frame does not need an edit.
4. **Pixel view is opt-in** (`?view=pixel` or `VITE_VIEW=pixel`). The isometric renderer remains the default until the four rooms look right.
5. **Missing prop sprites are magenta placeholders.** Floors that have no mask tileset yet (`l`, `m`, `j`, `t`, `k`) use a flat brand fill and are listed in `artMissing`, so interiors stay walkable. West-wall decor is skipped until it can move onto the north wall.
6. **One outfit in this pass, one sheet per skin tone.** `composeCharacter` builds `char_skin_0..n` (body, terracotta top, jeans, hair). Do not `setTint` those sheets: multiply tint crushed the already-shaded pixels into silhouettes. Layered hair, clothes and hats come next and must keep using `composeCharacter`.
7. **The grade uses `gameMinutes`.** Night darkness holes and weather particles wait until lamps are in the room data. `weather.ts` is ready and unused on screen. A shot taken near 23:00 game time looks night-blue on purpose.
8. **A room smaller than the view is centered.** Camera bounds grow to the view so Phaser does not pin the map into the corner. The backdrop is the room wall color.
