# Tudo Bem → Vila Ipê: the life-sim conversion how-to

**Audience:** an AI coding agent (for example Sonnet) working in this repo, one phase at a time.
**Owner:** Jonny. He makes every decision marked **🧑 JONNY** and does every purchase, sign-up and final approval.
**Written:** 2026-09-28, against `main` at `0dcd7f2`.

---

## 0. How to use this document

Read sections 0–5 in full before you start any phase. Then work through **one phase at a time**, in order (section 6).

1. **One phase = one branch = one PR.** Name the branch `lifesim/p<N>-<short-slug>` (for example `lifesim/p2-pixel-view`). If a phase is big, split it into sub-PRs (`p3a`, `p3b`). Never mix two phases in one PR.
2. **Never skip a 🧑 JONNY checkpoint.** When you reach one, stop. Write what you need in the PR description and in your reply, then wait.
3. **Every PR must pass** `pnpm verify` (typecheck + unit tests + build) **and** the e2e run (section 7.3). If something was already failing on `main` before your change, say so in the PR. Don't hide it.
4. **Every PR that changes what's on screen must include screenshots** (section 7.4). Open the screenshots yourself with your image-reading tool and check them against the Beauty checklist (section 4.6) before you open the PR.
5. **If this document and the code disagree, the code wins on facts** (file names, function signatures). **This document wins on decisions** (engine, tile size, art rules). If a decision looks impossible, stop and ask Jonny. Don't quietly pick something else.
6. **Don't reopen locked decisions** (section 3). They were weighed already. Build them.
7. When you're unsure about a small detail, pick the simplest option that follows the rules and write one line about it under "Decisions I made" in the PR description.
8. Commit messages follow the repo style: `feat(lifesim): …`, `fix(lifesim): …`, `art(lifesim): …`. End every commit message with the co-author line your harness gives you.

---

## 1. The goal

Today, Tudo Bem is a small isometric hangout. The rooms float on a gradient, the art is drawn in code, and the learning happens in modal panels that cover the world.

**The target is _Vila Ipê_: a cozy, living São Paulo neighborhood you walk around in, top-down pixel art in the style of Stardew Valley and Eastward.** You run errands (*recados*) for neighbors, which makes you speak Portuguese in real situations: order at the padaria, read the price at the feira, greet by time of day. Neighbors remember you, and friendships grow. Days pass: golden hour, lamp-lit nights, *garoa* (São Paulo drizzle). Other players are part of the scenery and the social life, but the game is fun even when you're alone.

Picture this moment in the finished game:

> It's 17:40 game time. The sky over the Praça is amber and the ipê petals drift across the petit-pavé. A bus rolls by on Rua dos Ipês. A caramel stray (*vira-lata caramelo*) naps by the banca. Seu Carlos is wiping the counter through the padaria window, and its warm light spills onto the sidewalk. Your *recado* tracker says "Leve 6 pães franceses para a Dona Graça." You walk in, and the dialogue box slides up with Carlos's portrait while the world keeps moving behind it. "Boa tarde! O que vai ser?" You type "Me vê seis pães, por favor." The lamps flicker on as you walk out.

**"Beautiful and immersive" in this project means:** hand-made pixel art, never art drawn in code; light that changes with time; something always moving; sound that places you; and Portuguese written into the world (signs, menus, prices), not only in panels.

---

## 2. What stays, what changes, what goes

The client presentation layer is replaced. Everything else is kept and extended. **Do not rewrite anything in the "Keep" column** unless a phase tells you to.

| Area | Paths | Fate |
|---|---|---|
| Shared rules and content | `packages/shared/src/*` (curriculum, `accept.ts`, `carlos.ts`, `conversa.ts`, `meveum.ts`, `numbers.ts`, `safety.ts`, `gloss.ts`, `cards.ts`, `catalog.ts`, `protocol.ts`, `path.ts`, `academia.ts`) | **Keep.** Extend with new modules. |
| Room data | `packages/shared/src/rooms.ts` | **Keep the shape; change the data.** Rooms become bigger. The Praça becomes the Vila Ipê outdoor map (Phase 5). |
| Server | `apps/server/src/*` (`world.ts`, `ambiance.ts`, `auth.ts`, `store.ts`, `app.ts`, `services/*`) | **Keep.** New systems go in **new files**, called from small hooks in `world.ts`. |
| Content packs, TTS | `content/`, `apps/client/public/audio`, `scripts/bake-tts.mjs` (see `docs/VOICES.md`), `scripts/build-curriculum.mjs` | **Keep.** |
| Client state, net, auth | `apps/client/src/state.ts`, `net.ts`, `localNet.ts`, `auth/*` | **Keep.** |
| Client DOM UI | `apps/client/src/ui/*` | **Keep the logic, restyle it** (pixel chrome). The dialogue presentation is rebuilt in Phase 7. |
| Client entry | `apps/client/src/main.ts` | **Keep.** Refactor it to depend on a `WorldView` interface (Phase 0). |
| Isometric renderer + procedural art | `apps/client/src/render/*` (`room.ts`, `props.ts`, `world.ts`, `iso.ts`, `draw.ts`, `avatar.ts`, `avatar/*`, `icons.ts`) | **Replaced** by `render/pixel/*`. Deleted in Phase 5. `bjjPoses.ts` stays for now (Academia modal). |
| Baked isometric art + bake pipeline | `apps/client/public/art/{props,furniture,hats,food}`, `scripts/bake-art.mjs`, `apps/client/src/art/studio.ts`, contact-sheet scripts | **Replaced** by `apps/client/public/pixel/*` and `scripts/pixel-*.mjs`. Deleted in Phase 10. Keep `public/art/ui` (UI SVG icons) until the UI restyle replaces them. |
| Intro / title screen | `apps/client/src/ui/intro*.ts` | **Rebuilt in Phase 6** on top of the pixel map (a slow camera pan over Vila Ipê at golden hour). The sign-in logic stays. |
| Solo build | `VITE_LOCAL_WORLD=1`, `?solo`, `LocalNet` | **Must keep working** in every phase. |

---

## 3. Locked decisions (don't reopen these)

| # | Decision | Why |
|---|---|---|
| D1 | **Top-down ¾ pixel art on a 16×16 px tile grid.** Characters are 16×32 px frames. | Stardew/Eastward look. It's the most widely available asset style and the most forgiving to produce consistently. |
| D2 | **Engine: Phaser 3** (latest 3.x release). Don't use Phaser 4, PixiJS, Three.js or a custom WebGL layer. | Tilemaps, cameras, sprite animation, particles, tweens and FX built in. Very well documented. |
| D3 | **Phaser is a view only.** Phaser input is fully disabled. `main.ts` keeps owning input, networking and state. The Phaser scene reads `game` (from `state.ts`) every frame and draws it. Never store game truth in Phaser objects. | Keeps the server-authoritative design and the existing UI logic intact. |
| D4 | **The server stays authoritative and tile-based.** Movement stays A* over tiles (`findPath`), with `move` messages and `positionAlong` interpolation. Keyboard and joystick movement send `move` to nearby tiles. No client physics. | Zero protocol risk; `world.ts` keeps working. |
| D5 | **Tile coordinates don't change meaning.** `x` goes right and `y` goes down on screen. The wire type `Dir` stays `'SE' \| 'SW' \| 'NE' \| 'NW'` and is mapped to facing: `SE→E`, `SW→S`, `NE→N`, `NW→W` (section 5.2). | The existing rooms render top-down immediately, with no server or protocol change. |
| D6 | **Art comes from files, never from code.** The new renderer must not draw props, buildings, characters or terrain with canvas paths. Only light gradients, particles and placeholders may be generated. | That's why the current look plateaued. |
| D7 | **Base art = a purchased commercial pixel pack in the modern-city style**, extended with custom Brazilian set pieces in the same style (section 4.3). | The only way to reach "beautiful" at this scope and speed. |
| D8 | **Text is DOM, not pixels.** Nameplates, speech bubbles, hover labels, the dialogue box, signs you read, and HUD text are HTML positioned over the canvas. Only very short in-world words painted into signs (for example "PADARIA") are pixels. | Crisp at every zoom, keeps accents (ã ç é õ), accessible, reuses the current CSS. |
| D9 | **Learning text uses a legible font.** Portuguese sentences and English glosses stay in Nunito (already loaded). Pixel fonts are for headings, labels and numbers only. | Learners must be able to read *você, não, açaí* instantly. |
| D10 | **Maps are authored in TypeScript** (`rooms.ts`): terrain as ASCII rows with autotiling, objects as coordinates. There is no Tiled/LDtk dependency. | An agent can write and review maps as text. The server already reads this format. |
| D11 | **A shared game clock** where 1 game day = 48 real minutes, computed deterministically from server time (section 5.7). | Everyone sees the same sky, and everyone gets to see every time of day. |
| D12 | **Every learning activity is reachable at every game hour.** Schedules can move NPCs around, but a learning loop is never locked behind the clock. If an NPC is away, a named colleague covers. | Learners play whenever they have 15 minutes. |

---

## 4. Art bible

### 4.1 Mood

**Golden-hour São Paulo bairro.** Warm, humid, a bit worn, full of life. Keep the brand palette from `docs/art/palette.md` as the anchor: cream-wall `#F5E6D3`, terracotta `#C45C26`, mustard `#D4A017`, sp-green `#2F5D50`, soft-sky `#A8C5D4`, concrete `#9A9A92`, wood-warm `#8B5E3C`, plus ipê yellow and azulejo blue. Avoid neon, pure white and pure black.

### 4.2 Pixel rules (hard rules; screenshots are checked against these)

1. **One pixel density.** Every sprite is authored at 1 art pixel = 1 texture pixel on the 16 px grid. Never scale a sprite by a non-integer factor, and never rotate pixel art.
2. **Integer camera zoom only**, measured in device pixels (section 5.3).
3. **Light comes from the upper-left.** Shadows fall down-right. Every standing object has a soft contact shadow; use the pack's shadow sprite or one shared `shadow_16`/`shadow_32` ellipse.
4. **Outlines follow the pack's convention.** Usually that's a dark, tinted outline (sel-out), not pure black. Custom pieces must match it.
5. **Palette:** custom pieces reuse the pack's colors, plus the brand colors above. No gradients inside sprites apart from pixel dithering.
6. **Characters are 16×32 frames.** Heads and hats may overflow into the transparent top of the frame, but never outside it.

### 4.3 Where the art comes from (🧑 JONNY buys; the agent never purchases)

1. **Base pack (recommended):** LimeZu's **"Modern Exteriors"** and **"Modern Interiors"** (itch.io), 16×16 version. They include city tiles, buildings, props, interiors, animated pieces and a layered **character generator**. 🧑 JONNY: check the current license allows commercial use in a web game before buying. Save the license text to `apps/client/assets-src/LICENSES.md`.
   If Jonny picks a different pack, it must be top-down ¾, 16×16, modern/urban, and include layered characters with walk animations in 4 directions. Everything below still applies.
2. **Custom Brazilian pieces** (table below). Pick one of these and use it for all of them, so the style stays consistent:
   - (a) commission one pixel artist, giving them the base pack as the style reference; or
   - (b) generate with a pixel-art AI tool, then clean up by hand in Aseprite/LibreSprite (fix stray pixels, force the palette, match the outlines).
   🧑 JONNY chooses. Until a piece exists, the renderer shows a **placeholder** (section 5.10). Never draw the piece in code.
3. **Sound (Phase 6):** CC0 / public-domain ambience only (Kenney, freesound.org CC0 filter). Record every file in `apps/client/public/audio/CREDITS.md`.

**Custom set-piece list** (sizes are in 16 px tiles, W×H of the footprint; the sprite may be taller than its footprint):

| Piece | Footprint | Notes | Needed by |
|---|---|---|---|
| Ipê amarelo (large, medium, small) | 2×2, 1×1, 1×1 | Canopy on a separate **overhead** sprite; 3-frame sway; falling-petal particle texture | P1 |
| Calçada petit-pavé terrain | terrain | Black-and-white wave paving + a *São Paulo state map* 2×2 decal variant | P1 |
| Orelhão (phone booth) | 1×1 | The orange shell | P4 |
| Banca de jornal (newsstand) | 3×2 | Magazines on display; awning; "BANCA" pixel sign | P4 |
| Padaria do Seu Carlos, **facade** | 8×6 | Red/white striped awning (*toldo*), glass door, "PADARIA" sign, warm window glow sprite for night | P5 |
| Padaria interior pieces | various | Balcão (counter, split into 1-tile slices), vitrine, estufa de salgados, banquetas, mesas, prateleira de pães, lousa/cardápio, caixa registradora, TV with a football match | P4 |
| Edifício Ipê facade (Nº 42) | 10×6 | Window grilles, laundry lines (*varal*), water tank (*caixa d'água*) on the roof, lit-window variant | P5 |
| Academia do Bairro facade | 10×6 | "ACADEMIA DO BAIRRO" sign; the tatame etc. for the interior | P5 |
| Lixeira laranja (orange bin), placa de rua azul (blue street sign) | 1×1 | "R. DOS IPÊS" | P4 |
| Poste com fios (utility pole with tangled wires) | 1×1 + overhead wires | The wires are an overhead layer that spans poles | P5 |
| Barraca de chapéus da Nanda (hat stall) | 2×1 | Striped canopy; hats on display | P4 |
| Quiosque Missão do dia | 1×1 | Terracotta totem | P4 |
| Poleiro + papagaio (perch + parrot) | 1×1 | Parrot idle, 4 frames | P4 |
| Fonte (fountain) | 4×4 | Animated water, 4 frames | P5 |
| Ponto de ônibus + ônibus | 3×1 / 6×2 | The bus is a moving sprite with a 2-frame wheel animation | P6 |
| Kombi, fusca, moto (motoboy) | 3×2 / 2×1 | Traffic sprites, 4 facings are enough (E/W on the street) | P6 |
| Vira-lata caramelo, gato, pombos (stray dog, cat, pigeons) | 1×1 | Idle, walk, sleep | P6 |
| Feira livre stalls (street market) | 3×2 each | Striped tarp (*lona*), fruit crates, pastel stand, caldo de cana stand, price-tag sprites | P9 |
| NPC portraits | 64×64 | Carlos, Nanda, Júlia, and every new NPC. 4 expressions each: neutro, feliz, surpreso, pensativo | P7 |

### 4.4 Characters

Characters are built from layers so the existing `Appearance` model (`packages/shared/src/types.ts`) keeps working. The layers are: body type × skin, face extra, hair style × hair color, top × color, bottom × color, shoes × color, hat. See section 5.5 for the pipeline and the sheet layout.

### 4.5 Motion and life (Phase 6 onward, but plan space for it)

Every outdoor screen shows **at least 3 moving things** at any time. Pick from: leaves swaying, petals falling, pigeons, a dog, cloud shadows drifting over the ground, fountain water, traffic, laundry flapping, CPUs walking, and other players.

### 4.6 Beauty checklist (check this against your own screenshots for every visual PR)

- [ ] No blurry or smeared pixels anywhere. Zoom into the screenshot to check.
- [ ] No tile seams or bleeding lines between tiles.
- [ ] All sprites use the same pixel size. No sprite looks bigger or smaller in pixel density than its neighbors.
- [ ] Every standing object has a contact shadow.
- [ ] Characters are sorted correctly: in front of things above them, behind things below them.
- [ ] No empty area larger than 4×4 tiles without any detail (in outdoor maps; floors indoors may be calmer).
- [ ] At least 3 moving things are visible (outdoor, Phase 6+).
- [ ] All text is crisp and accents render correctly (test with "Pão de queijo, açaí, você, não, avó, Nº 42").
- [ ] The UI doesn't cover more than ~25% of the world while you're just walking.
- [ ] Phone (390×844) and desktop (1280×800) both look intentional, not squashed.

---

## 5. Technical specs

### 5.1 New files (overview)

```
apps/client/
  assets-src/                 # raw purchased/commissioned art + LICENSES.md (committed; repo is private)
    README.md                 # what each source file is, and how it maps to our keys
  public/pixel/               # processed, game-ready art (generated by scripts, committed)
    tiles/…  props/…  chars/…  portraits/…  fx/…  manifest.json
  src/render/view.ts          # WorldView interface (Phase 0)
  src/render/pixel/
    PixelView.ts              # implements WorldView, owns the Phaser.Game
    WorldScene.ts             # the Phaser scene: reconcile state → sprites each frame
    facing.ts                 # Dir → facing + animation names
    terrain.ts                # ASCII floor → dual-grid autotile indices
    characters.ts             # appearance → composed spritesheet (palette swap, cache)
    props.ts                  # PropDef/furniture → sprite keys, anchors, depth
    lighting.ts               # time-of-day tint, darkness overlay, light sources
    ambient.ts                # pigeons, dog, traffic, cloud shadows, petals (Phase 6)
    labels.ts                 # DOM overlay: nameplates, bubbles, guides, hover label
    manifest.ts               # loads public/pixel/manifest.json
scripts/
  pixel-import.mjs            # assets-src → public/pixel (slice, extrude, palette-key, manifest)
  lifesim-shots.mjs           # screenshots for PRs (copy the pattern of scripts/shots.mjs)
packages/shared/src/
  clock.ts                    # game clock (Phase 6)
  weather.ts                  # daily weather roll (Phase 6)
  recados.ts                  # errands data + validation (Phase 8)
  bonds.ts                    # NPC friendship (Phase 8)
  schedules.ts                # NPC schedules (Phase 8)
  hotspots.ts                 # readable signs/menus (Phase 7)
apps/server/src/
  recados.ts  npcs.ts         # server systems (Phase 8), hooked from world.ts
```

Add dependencies only where they're needed: `phaser` in `apps/client` (Phase 2); `sharp` and `tile-extruder` as root devDependencies for the import script (Phase 1). Don't add other runtime dependencies without asking.

### 5.2 Facing and animations

```ts
// apps/client/src/render/pixel/facing.ts
import type { Dir } from '@tudobem/shared';
export type Facing = 'S' | 'W' | 'E' | 'N';
/** Wire Dir is isometric-era naming. On the top-down grid: SE = +x = East, SW = +y = South, NE = −y = North, NW = −x = West. */
export const FACING: Record<Dir, Facing> = { SE: 'E', SW: 'S', NE: 'N', NW: 'W' };
export const FACING_ROW: Record<Facing, number> = { S: 0, W: 1, E: 2, N: 3 };
```

Unit-test this mapping. Server code that picks a `Dir` for sitting (`seat: 'SW'` etc.) needs no change: a bench with `seat: 'SW'` now means "sitter faces south". When you edit room data in Phase 5, choose seat `Dir`s with that meaning.

### 5.3 Phaser boot, canvas and zoom

- Reuse the existing `<canvas id="world">`. Phaser requires an explicit renderer type when you pass your own canvas.
- Disable **all** Phaser input so it never captures keys (a Phaser keyboard capture would stop players typing W/A/S/D and spaces in the chat box).

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 3);
new Phaser.Game({
  type: Phaser.WEBGL,
  canvas,                                  // the existing #world element
  pixelArt: true,                          // nearest-neighbour, no antialias
  roundPixels: true,
  backgroundColor: '#1d1b26',
  banner: false,
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  scale: { mode: Phaser.Scale.NONE, width: innerWidth * dpr, height: innerHeight * dpr, zoom: 1 / dpr },
  scene: [WorldScene],
});
```

- **Zoom rule** (art pixels → device pixels, always an integer):
  `cssZoom = clamp(floor(min(innerWidth / (20*16), innerHeight / (12*16))), 2, 5)` (shows about 20 tiles across on desktop and about 12 on a phone).
  `camera.setZoom(Math.max(1, Math.round(cssZoom * dpr)))`.
  Recompute on resize (`game.scale.resize(innerWidth*dpr, innerHeight*dpr)`).
- **Check** with screenshots at DPR 1, 1.25 and 2 (Playwright `deviceScaleFactor`). If pixels look uneven at 1.25, round the device zoom down instead of to nearest.
- The camera follows the local avatar with `startFollow(sprite, true, 0.12, 0.12)` and `setBounds(0, -topMargin, mapW, mapH + topMargin)`. Small maps (interiors) are centered instead of followed when they fit on screen.
- Rooms smaller than the screen: fill the outside with the room's backdrop color, plus a soft vignette, never a gradient sky.

### 5.4 World coordinates, depth and hit testing

```ts
export const T = 16;                                   // art px per tile
export const tileToWorld = (x: number, y: number) => ({ wx: (x + 0.5) * T, wy: (y + 0.5) * T });
/** Feet of a character standing on tile (x, y). */
export const feet = (x: number, y: number) => ({ wx: (x + 0.5) * T, wy: (y + 1) * T - 3 });
```

- Characters use origin `(0.5, 1)` at `feet(x, y)`. `x` and `y` may be fractional; use `positionAlong(...)` from `@tudobem/shared`, exactly like `render/world.ts` does today.
- **Depth:** terrain `-10000`; ground decals (rugs, crosswalks, the map mosaic) `-5000`; everything that stands (characters, props, furniture, building facades) uses **`depth = bottom-edge world y`** + a tiny tiebreak (`+ (hash(id) % 100) / 1000`); **overhead** layers (tree canopies, roofs, wires, awnings you walk under) `50000`; the lighting overlay `90000`.
- **Overhead fade:** if the local avatar's feet fall inside an overhead sprite's bounds, tween its alpha to 0.45 over 150 ms, and back to 1 when they leave.
- **`hitTest(px, py)`** returns the same `Hit` union as `render/world.ts`. Convert client coordinates to device pixels (`* dpr`, minus the canvas rect), then to world coordinates with `camera.getWorldPoint`. Test against the hit boxes you collected while drawing this frame, highest depth first: avatars (their 16×32 frame), NPCs, props with `action` (their sprite bounds), portals (their tile plus the door sprite), seats, furniture, then the tile under the pointer. Store the frame's hit boxes in an array rebuilt each `update`.
- **`tileToClient(x, y)`** returns the client coordinates of the tile center (inverse of the above). e2e depends on it.
- **`cam.scale`**: expose `cam: { scale: cssZoom }` so the e2e `clickTile` helper keeps working.

### 5.5 Character pipeline

**Canonical sheet** (the output of `scripts/pixel-import.mjs` for every layer; one PNG per layer variant):

- Frame 16×32. 8 columns (max frames). Row index = animation block + facing row (S, W, E, N).

| Rows | Animation | Frames | FPS | Loop |
|---|---|---|---|---|
| 0–3 | `idle` S/W/E/N | up to 4 | 5 | yes |
| 4–7 | `walk` S/W/E/N | 6 | 10 | yes |
| 8–11 | `sit` S/W/E/N | 1 | – | – |
| 12 | `oi` (wave), facing S | up to 6 | 8 | 2× then idle |
| 13 | `dancar` | up to 8 | 8 | 3× |
| 14 | `rir` (laugh) | up to 4 | 8 | 2× |
| 15 | `valeu` (thumbs up) | up to 4 | 8 | 1× + hold 600 ms |
| 16 | `desculpa` (sorry) | up to 4 | 8 | 1× + hold 600 ms |

If the base pack has no frames for an emote, reuse `idle` S for it and bounce the sprite 2 px (a tween) until the art exists. Write down in `assets-src/README.md` which source rows map to which canonical rows.

**Layers, back to front:** `body_<bodyType>` (skin-keyed) → `shoes` → `bottom_<style>` → `top_<style>` → `extra_<style>` (beard, freckles; glasses and earrings go after hair) → `hair_<style>` → `extra_front_<style>` → `hat_<id>`. Long hair may have a `hair_<style>_back` layer drawn **before** the body for N-facing rows.

**Palette swap.** Author (or convert) every layer in a **key ramp**: 4 exact colors for skin, 4 for hair, 4 for the top, 4 for the bottom, 3 for shoes. At load time:

1. Generate a target ramp from the base color in `SKIN_TONES[i]`, `HAIR_COLORS[i]`, `CLOTH_COLORS[i]` or `SHOE_COLORS[i]` (`packages/shared/src/constants.ts`). Pixel-art shading rule: shadows are darker **and shift in hue** toward cool/purple; highlights are lighter and shift toward warm/yellow. Suggested ramp in HSL: `[L−28, H−12] , [L−14, H−6], [L, H], [L+12, H+6]` (clamp).
2. Replace each key color with the target color of the same rank (sorted by luminance).
3. Draw the layers into one canvas in order → `scene.textures.addSpriteSheet(key, canvas, { frameWidth: 16, frameHeight: 32 })`.
4. Cache by `appearanceHash(appearance, hat)`. LRU cap 64. When evicting, call `scene.textures.remove(key)`.

Unit-test the ramp generator (monotonic luminance) and the key-color replacement (on a tiny 2×2 test canvas, using `@napi-rs/canvas` or a plain `Uint8ClampedArray` function that doesn't need a DOM).

**NPCs** (Carlos: white apron over a warm shirt; Júlia: blouse with jeans; Nanda: mustard top with jeans and a straw hat) use the same pipeline. Their unique pieces (apron, Nanda's straw hat) are extra layers.
**The avatar creator** (`ui/onboarding.ts`) must show the composed pixel character at an integer zoom (6× or 8×) with CSS `image-rendering: pixelated`.

### 5.6 Terrain: ASCII + dual-grid autotiling

The existing `floor: string[]` rows stay the source of truth. `FLOOR_CHARS` gains new characters as needed (document each one in `rooms.ts`):

| Char | Terrain | Char | Terrain |
|---|---|---|---|
| `c` | calçada (petit-pavé) | `a` | asfalto (asphalt) |
| `g` | grama (grass) | `f` | faixa (crosswalk; drawn as a decal on asfalto) |
| `t` | tijolo (brick pavers) | `w` | água (fountain water, not walkable) |
| `l` | ladrilho (padaria tiles) | `m` | madeira/taco (wood floor) |
| `j` | tatame | `d` | terra (dirt) |
| `k` | xadrez (checker) | `x` | void / not walkable, not drawn (outside interiors) |

**Algorithm (dual grid):** draw each terrain as its own tile layer, in priority order (low → high: `a`, `c`, `t`, `d`, `g`, `l`, `m`, `k`, `j`). The display grid is offset by half a tile. Each display tile at `(i, j)` looks at the 4 world tiles at its corners: TL = `(i−1, j−1)`, TR = `(i, j−1)`, BL = `(i−1, j)`, BR = `(i, j)`. The mask is `TL*8 + TR*4 + BL*2 + BR*1`, where each bit is "this corner is this terrain". Mask 0 draws nothing; mask 15 is the full tile (pick among 2–4 random variants using `hash(i, j)`). The terrain tileset for each terrain is therefore **16 tiles in mask order**. `terrain.ts` exports `maskAt(floor, terrainChar, i, j)`. Unit-test it.

The base pack's terrain probably comes in a different autotile layout. The import script converts it once into the 16-tile mask order. Document the mapping in `assets-src/README.md`. If a conversion can't be done automatically, 🧑 JONNY (or the artist) assembles the 16 tiles by hand.

Walkability is **not** decided by terrain (except `w` and `x`). Blocking stays in `buildGrid` via props, NPCs and furniture. Add `w`/`x` to the blocked set in `buildGrid`, and add a unit test.

### 5.7 Game clock

```ts
// packages/shared/src/clock.ts
export const GAME_DAY_MS = 48 * 60 * 1000;          // 48 real minutes = 1 game day
export const CLOCK_OFFSET_MS = 17 * 2 * 60 * 1000;   // tune so a fresh server boot lands near golden hour
export function gameMinutes(nowMs: number): number {  // 0..1439
  const t = (nowMs + CLOCK_OFFSET_MS) % GAME_DAY_MS;
  return Math.floor((t / GAME_DAY_MS) * 1440);
}
export function gameDay(nowMs: number): number { return Math.floor((nowMs + CLOCK_OFFSET_MS) / GAME_DAY_MS); }
export type Period = 'madrugada' | 'manha' | 'tarde' | 'noite';
export function period(min: number): Period { return min < 300 ? 'madrugada' : min < 720 ? 'manha' : min < 1080 ? 'tarde' : 'noite'; }
/** The greeting that fits the time: bom dia (05:00–11:59), boa tarde (12:00–17:59), boa noite (18:00–04:59). */
export function greetingFor(min: number): 'bom dia' | 'boa tarde' | 'boa noite' { … }
```

The server sends its `Date.now()` in the `welcome` and `roomState` messages (add an optional `serverNow: number` field to both in `protocol.ts`). The client stores `skew = serverNow - Date.now()` and always calls `gameMinutes(Date.now() + skew)`. **Server days (`gameDay`) are separate from the real-day resets that exist today** (daily mission, Conversa RV "already today"). Don't change those real-day rules.

### 5.8 Lighting (Phase 6)

Use these three simple, reliable pieces. Don't use Phaser `Light2D` or normal maps.

1. **Grade:** a full-screen rectangle (scrollFactor 0, depth 90000) with `BlendModes.MULTIPLY`, colored by time of day. Keyframes (game hour → color); interpolate in linear RGB:
   `0:#3b4a7c · 4.5:#4a4f86 · 5.5:#c98a8f · 7:#fff1e0 · 9:#ffffff · 15:#fff6e6 · 16.5:#ffd9a0 · 17.5:#ffbd80 · 18.3:#e08c78 · 19:#6b6fa8 · 20:#3b4a7c`
   Golden hour (16:30–18:30) is the signature look, so it gets the most keyframes.
2. **Darkness + light holes (night):** a `RenderTexture` the size of the view (scrollFactor 0, depth 90001), redrawn each frame: `fill(0x0b1030, alpha)` with `alpha` from 0 (day) to 0.55 (night), then `erase()` a soft radial-gradient texture at every light source in view (lamp posts, lit windows, the padaria interior spill, and a small glow around the local player at night).
3. **Colored glow:** additive sprites (`BlendModes.ADD`, depth 90002, alpha 0.25–0.4) in warm amber at the same light sources, visible only when darkness alpha > 0.1.

**Interiors** use a fixed grade from `RoomDef.lighting` (`manha` warm, `dia` neutral, `tarde` amber) plus window light patches. Light sources are declared in data: add optional `lights?: { x: number; y: number; r: number; color: string; night?: boolean }[]` to `RoomDef`, and optional `light?` to `PropDef`.

Add a camera vignette (`camera.postFX.addVignette(0.5, 0.5, 0.88, 0.22)`) and turn it off on low-end devices (section 5.11).

### 5.9 DOM overlay (labels, bubbles, guides)

`render/pixel/labels.ts` owns an absolutely positioned `<div id="world-labels">` over the canvas (`pointer-events: none`). Each frame it positions:

- **Nameplates** (the existing CSS classes: Verde plate for players, terracotta for NPCs, a mustard ring on yourself), 6 px above the head.
- **Speech bubbles** from `ClientAvatar.bubbles` and `game.npcBubbles`: PT line with the EN gloss underneath, following today's rules (`state.ts`). Use a pixel-style border (`border-image` from a 9-slice PNG in `public/pixel/ui/`).
- **Guides** (`view.guides`): a bouncing pixel arrow above the target tile. When the target is off-screen, pin the arrow to the nearest screen edge, pointing toward it.
- **Hover label:** keep `ui/hud.ts hoverLabel` as is.

Reuse DOM elements (keyed by id); don't recreate them every frame. Positions use `transform: translate(...)` rounded to whole CSS pixels.

### 5.10 Placeholders

When a sprite key is missing from the manifest, draw a **placeholder**: a flat rectangle the size of the footprint (tiles × 16), filled `#ff00ff` at alpha 0.35 with a 1 px `#ff00ff` border, plus the key name as a DOM label (only when `?debug=art`). Keep a running list of missing keys in `window.__tb.artMissing` and print it once in the console. **Never** paint a "nice" substitute in code.

### 5.11 Performance budget

- 60 fps on a mid laptop (integrated GPU), and ≥ 30 fps on an iPhone 12-class phone in the busiest outdoor scene.
- ≤ 8 textures bound per scene (use atlases). Terrain layers use Phaser `Tilemap` layers, not one sprite per tile.
- Initial art download ≤ 8 MB. Load interior art when you enter the interior.
- Particles: ≤ 300 alive. Darkness RenderTexture: at half resolution on phones.
- `?lowfx=1`, and automatically when the frame time p90 is over 25 ms for 5 s: turn off the vignette, cloud shadows, petals and half the ambient critters.
- Respect `prefers-reduced-motion`: no camera shake, fewer particles, no tweened zoom.

### 5.12 Asset manifest

`public/pixel/manifest.json` (written by `scripts/pixel-import.mjs`; never edit it by hand):

```json
{
  "version": 1,
  "tile": 16,
  "atlases": { "outdoor": "atlas/outdoor.png", "padaria": "atlas/padaria.png" },
  "terrain": { "c": { "atlas": "outdoor", "first": 0 }, "g": { "atlas": "outdoor", "first": 16 } },
  "sprites": {
    "props/banco": { "atlas": "outdoor", "frame": "banco", "w": 32, "h": 24, "ax": 16, "ay": 22, "footprint": [2, 1], "anim": null, "overhead": null },
    "props/ipe_large": { "atlas": "outdoor", "frame": "ipe_trunk", "w": 32, "h": 32, "ax": 16, "ay": 30, "footprint": [2, 2], "overhead": "props/ipe_large_canopy", "anim": { "frames": ["ipe_canopy_0", "ipe_canopy_1", "ipe_canopy_2"], "fps": 3 } }
  },
  "chars": { "body_medio": "chars/body_medio.png", "hair_cacheado": "chars/hair_cacheado.png" },
  "keyRamps": { "skin": ["#…", "#…", "#…", "#…"], "hair": ["…"], "top": ["…"], "bottom": ["…"], "shoes": ["…"] }
}
```

`ax`/`ay` is the anchor inside the sprite (pixel coordinates). It is placed at the **bottom-center of the footprint** in world space.

---

## 6. Phases

Each phase lists **Goal · Steps · Done when · Tests · Screenshots · Don't**.

---

### Phase 0: Safety net (no visible change)

**Goal:** make the switch possible without breaking anything.

**Steps**
1. Create `apps/client/src/render/view.ts`:
   ```ts
   import type { ClientAvatar } from '../state';
   import type { Hit } from './world';          // move the Hit type here in this PR; world.ts re-exports it
   export interface Guide { x: number; y: number; lift: number; label: string }
   export interface WorldView {
     readonly cam: { scale: number };
     guides: Guide[];
     resize(): void;
     frame(now: number): void;
     avatarPos(a: ClientAvatar, now: number): PathPos;        // PathPos from @tudobem/shared (path.ts)
     tileToClient(x: number, y: number): { px: number; py: number };
     hitTest(px: number, py: number): Hit | null;
     tileAt(px: number, py: number): Tile | null;
   }
   ```
   Check the real return types in `render/world.ts` and copy them exactly. Today `avatarPos` returns `positionAlong(a.from, a.path, now - a.start, a.pub.dir)`. Make `WorldRenderer implements WorldView`. In `main.ts`, type `renderer` as `WorldView`.
2. Add a view switch in `main.ts`: `const VIEW = new URLSearchParams(location.search).get('view') ?? import.meta.env.VITE_VIEW ?? 'iso';`. For now only `'iso'` exists.
3. Make e2e independent of the renderer. Add these hooks to `window.__tb`:
   - `walkTo(x, y, sit?)`: calls the same `walkTo` function the click handler uses.
   - `interact(target)`, where `target` is `{ npc: NpcId } | { prop: string /* prop id */ } | { portal: string /* portal id */ }`: looks it up in `ROOMS[game.room.room]` and calls `handleClick` with the matching `Hit`.
   Then change `scripts/e2e.mjs` and `scripts/e2e-meveum.mjs` so that **props, NPCs and portals are reached through `interact(...)` by id**. Keep **two** real canvas clicks (one floor tile, one bench) through `clickTile` so real input stays covered.
4. Add `apps/client/src/render/pixel/facing.ts` (section 5.2) with a unit test.
5. Next to this file, create `docs/lifesim/DECISIONS.md` (start it with a copy of the section 3 table). Every later "Decisions I made" item gets appended there.
6. Add `scripts/lifesim-shots.mjs` (copy the pattern of `scripts/shots.mjs`). It takes `?view=…` and writes 1280×800 and 390×844 shots of: praça, padaria, kitnet, academia, avatar creator. Save them to `docs/lifesim/shots/p<N>/`.

**Done when:** everything behaves exactly as before; `pnpm verify` and both e2e scripts pass; baseline shots are saved in `docs/lifesim/shots/p0/`.
**Don't:** change any visuals or server code.

---

### Phase 1: Art intake and the style frame (🧑 JONNY checkpoint)

**Goal:** prove the look on one screen before building everything.

**Steps**
1. 🧑 **JONNY:** buy the base pack(s) (section 4.3). Put the unzipped files in `apps/client/assets-src/<pack-name>/`. Add the license text to `assets-src/LICENSES.md`. Choose route (a) or (b) for custom pieces.
2. The agent writes `scripts/pixel-import.mjs` (root devDeps: `sharp`, `tile-extruder`). It:
   - reads a hand-written mapping file `apps/client/assets-src/import-map.json` (source file + rectangle → our key, anchor, footprint, animation frames, overhead part);
   - packs sprites into atlases (a simple shelf packer is fine) with **1 px extrusion** around every frame;
   - converts terrain into 16-tile mask order (section 5.6);
   - converts character layers into the canonical sheet (section 5.5) and records key ramps;
   - writes `public/pixel/**` and `manifest.json`.
   Add `"pixel": "node scripts/pixel-import.mjs"` to the root `package.json`.
3. Build a **style frame** page, `apps/client/lifesim-frame.html` (a separate Vite entry, not linked from the game). It's a Phaser scene with a hard-coded 30×18 slice of praça: calçada with the map mosaic, grass, 2 ipês with canopy sway and falling petals, 3 benches, a lamp post, the banca, 3 composed characters (1 walking a loop, 1 sitting, 1 idle), pigeons, cloud shadows, the golden-hour grade, and a time slider that moves 17:00 → 20:00 so the lamps come on. Use placeholders for pieces that don't exist yet.
4. Screenshot it at 17:30 and at 19:30, at 1280×800 and 390×844.

**Done when:** 🧑 **JONNY approves the style frame**, or asks for changes and you apply them. **Stop here until he approves.** Everything later copies this look.
**Don't:** touch `main.ts` or the game yet.

---

### Phase 2: Pixel view skeleton behind `?view=pixel`

**Goal:** the existing four rooms playable end-to-end in the new renderer, with placeholders allowed.

**Steps**
1. `pnpm --filter @tudobem/client add phaser@^3` (latest 3.x).
2. `render/pixel/PixelView.ts implements WorldView`. It creates the Phaser game (section 5.3), holds a reference to `WorldScene`, and implements `tileToClient`, `hitTest`, `tileAt`, `avatarPos` (reuse `positionAlong` exactly as `render/world.ts` does) and `resize`. `frame(now)` just stores `now`; Phaser runs its own loop.
3. `WorldScene.update()` **reconciles** state to sprites every frame:
   - When `game.room` changes (compare `room.room + instanceId + ownerId`), destroy the room layer and rebuild terrain, props, walls and NPCs from `ROOMS[id]`.
   - For each avatar in `game.avatars`: create its sprite if missing, update its position, facing, animation and depth, and destroy sprites whose ids are gone.
   - Rebuild the hit-box list.
4. **Interiors in top-down:** the wall at `y = 0` (the iso "right" wall) becomes the **north wall**, drawn as a band 3 tiles tall above row 0. Wall decor with `wall: 'right'` goes on it at `from..to`. The wall at `x = 0` (iso "left") becomes a **west wall** 1 tile wide. Portals with `wall: 'left'` become a door in that west wall (door-frame sprite plus doormat). Decor with `wall: 'left'` can't be seen edge-on: skip it in Phase 2 and list the skipped items in the PR. Phase 4 moves it.
5. Characters: in this phase, **one** base character sheet with no palette swap, tinted by skin color. Portals, sitting, emotes and walking must all work.
6. `main.ts`: `const renderer: WorldView = VIEW === 'pixel' ? new PixelView(canvas) : new WorldRenderer(canvas);`. Everything else uses the interface.
7. The keyboard: in `main.ts`, WASD/arrow keys (ignored while an input is focused or a modal is open) send `walkTo` to the adjacent tile in that direction while held, repeating when the avatar arrives (so the steps chain smoothly). Update `ui/joystick.ts` with a `mode: 'iso' | 'topdown'` option: top-down maps screen right to `+x` and screen down to `+y`.

**Done when:** with `?view=pixel`, the full play path works by hand and e2e passes with `BASE_URL=http://localhost:8787/?view=pixel`, **and** the default (`iso`) still passes. Two browser windows see each other walk.
**Tests:** unit tests for `hitTest` ordering (pure function over a hit-box list), for `tileToClient ∘ tileAt` round trip, and for the keyboard step direction.
**Screenshots:** p2 set (placeholders are expected).
**Don't:** delete anything from `render/`. Don't make pixel the default.

---

### Phase 3: Characters

**Goal:** every player, CPU and NPC is a proper layered pixel character.

**Steps**
1. Implement `render/pixel/characters.ts` (section 5.5): layer compose, palette swap, cache, animations (`anims.create` per sheet key, named `<sheetKey>:<anim>:<facing>`).
2. Map each `HairStyle`, `TopStyle`, `BottomStyle`, `BodyType`, `FaceStyle`, `ExtraStyle` and hat id to a layer key in one table, `CHAR_LAYERS`, in `characters.ts`. A missing mapping falls back to the closest style and logs once. Add a test that every enum value has an entry.
3. Idle variety: `IdlePose` (`celular`, `cafe`, `bolsa`…) picks a different idle row if the pack has one; otherwise it offsets the idle animation start frame by `seed` so a crowd never breathes in sync.
4. NPC looks: Carlos, Júlia and Nanda keep their silhouette locks (section 5.5).
5. The avatar creator (`ui/onboarding.ts`, which today calls `renderAvatarPreview` from `render/avatar`) previews the composed pixel character at 8× (front, S facing), with a turn button that cycles S → E → N → W.
6. Hats (all 12 in `catalog.ts` `HATS`) as layers. `ui/panels.ts` hat shop icons use the S-facing frame of each hat at 4×.

**Done when:** all creator options produce distinct, good-looking characters; the 12 hats work; the NPCs are recognizable.
**Screenshots:** a contact sheet `docs/lifesim/shots/p3/lineup.png` showing 8 skin tones × 4 hair styles, all 12 hats, the 3 NPCs, and all 5 emotes. Model the script on `scripts/character-contact.mjs`.
**Don't:** change `Appearance` or `sanitizeAppearance` on the server.

---

### Phase 4: Props, furniture, interiors and labels, then pixel becomes the default

**Goal:** full visual parity in the four existing rooms, then the switch.

**Steps**
1. Map every `PropKind` (`rooms.ts`) and every furniture item (`catalog.ts FURNITURE`, both rotations) to a manifest key in `render/pixel/props.ts`. Add a test that every `PropKind` and furniture id resolves (it may resolve to a placeholder key, but it must resolve).
2. Move the wall decor that was invisible on west walls (Phase 2 list) to the north wall or to floor props, by editing `rooms.ts`. Keep interact tiles valid. The existing room tests in `packages/shared` and `apps/server` must stay green.
3. Kitnet decorating (`buildDecorPanel`, `game.placing`, `canPlaceFurniture`): a ghost sprite on the hovered tile, green/red tint for valid/invalid; R rotates.
4. `render/pixel/labels.ts` (section 5.9): nameplates, bubbles, guides.
5. Padaria interior: the counter uses the balcão slices, and the `trilho_pedidos` ticket rail animates when Me vê um is open. Warm window patches on the floor.
6. Academia interior: tatame, arquibancada seating and bleachers. The roll modal (`ui/roll.ts`) stays as it is.
7. Restyle the DOM chrome **lightly**: 9-slice pixel panel borders on `.modal`, the HUD pills and the chat bar. Pixel font for headings and pills only (D9). Pick a free pixel font from Google Fonts that includes Portuguese accents, and verify with "Pão de queijo, açaí, você, não, avó, Nº 42" at 1× and 2×.
8. Make `pixel` the default: `VIEW` defaults to `'pixel'`, and `?view=iso` still works.

**Done when:** every room passes the Beauty checklist (section 4.6) apart from the "3 moving things" item; e2e passes in both views; 🧑 **JONNY plays it and approves the switch.**
**Screenshots:** full p4 set, both sizes, every room, plus the kitnet in decorate mode.
**Don't:** delete the isometric renderer yet.

---

### Phase 5: Vila Ipê, the neighborhood map

**Goal:** the Praça grows into a walkable neighborhood. Buildings on the street have doors into the existing interiors.

**Steps**
1. 🧑 **JONNY confirms** it's OK to delete the isometric renderer now (the new map can't render in isometric). Then delete `render/room.ts`, `render/props.ts`, `render/world.ts`, `render/iso.ts`, `render/draw.ts`, `render/avatar.ts`, `render/avatar/*` and `render/icons.ts`, together with their imports and the `?view` switch. Keep `render/bjjPoses.ts`. These UI files import from the old renderer and must be switched to pixel sprites first (drawn at an integer zoom with `image-rendering: pixelated`): `ui/onboarding.ts` (`renderAvatarPreview` from `render/avatar`; Phase 3 replaces it), `ui/panels.ts` (`hatIcon` from `render/icons`, `furnitureIcon` from `render/props`), and `ui/meveum-ui.ts` (`foodIcon` from `render/icons`; the food icons need pixel art too, so add them to the custom set-piece list if the pack lacks them). Run `grep -rn "render/" apps/client/src` to catch anything else. Do the deletion as its own commit.
2. Keep the room id **`praca`** (saves, tests and `tb_last_room` depend on it). Change its display name to **"Vila Ipê"**, gloss "Ipê Village". The Praça Central becomes a zone inside it.
3. Build the map at **56 × 40 tiles**. The zone plan is below; exact coordinates are yours to choose, as long as every rule holds:

   ```
   y 0–5    North building row (facades face south; doors on row 5):
            [casas x0–9][PADARIA x10–17][BANCA x18–20][EDIFÍCIO IPÊ Nº42 x21–30][ACADEMIA DO BAIRRO x31–40][casas x41–55]
   y 6–7    North sidewalk (calçada), lamp posts every 6 tiles, lixeiras, orelhão, street sign "R. DOS IPÊS"
   y 8–11   Rua dos Ipês (asfalto), crosswalks (f) at x14–16 and x34–36, bus stop on the south sidewalk
   y 12–13  South sidewalk
   y 14–31  PRAÇA CENTRAL x10–40: fountain in the center (4×4), hero ipê + 5 more ipês, 8 benches, canteiros,
            Missão do dia kiosk, Nanda's hat stall, parrot perch, a paved path cross (tijolo) into the fountain
            West x0–9: small houses with gardens (decorative, blocked), a corner where the vira-lata sleeps
            East x41–55: empty lot fenced for the future feira (Phase 9): grass + dirt, "EM BREVE" banner
   y 32–39  South edge: Rua Jacarandá (asfalto, traffic only) + a decorative building row (blocked, drawn overhead)
   ```

4. Rules:
   - Map edges are never an open void: they're buildings, trees or fences.
   - Doors: the door tile is a `PortalDef` at the facade's bottom row. `wall` becomes optional on `PortalDef`; outdoor portals leave it out. The arrive tile is the sidewalk tile in front of the door.
   - Interiors keep their room ids (`padaria`, `kitnet`, `academia`). Update their exit portals' `arrive` tiles to the new sidewalk tiles.
   - **Clear lanes:** a 2-tile-wide walkable path from spawn to every door, NPC and interact tile. Add a unit test that runs `findPath` from spawn to each of them on `buildGrid(ROOMS.praca)`.
   - Raise the `findPath` `maxNodes` default only if the test above needs it.
5. Move the praça NPCs (Júlia near the kiosk, Nanda at her stall) and the ambiance data (`PRACA_AMBIANCE` spots, door spots and entries in `packages/shared/src/ambiance.ts`) to the new map. Update `cpuTarget` only if 🧑 JONNY agrees (a bigger map may want more CPUs).
6. Update the guide arrows in `main.ts updateGuides()` to the new coordinates (better: look them up by prop/portal id, not raw x/y).
7. Update e2e for the new map. Phase 0 made most steps id-based; fix the rest.
8. The Mapa panel (`openMap` in `ui/panels.ts`) shows a pixel minimap: render the terrain at 2 px per tile into a canvas once, then mark doors, NPCs and yourself.

**Done when:** you can walk the whole neighborhood, enter and leave all three interiors, the tutorial and daily mission still complete, e2e passes, and the Beauty checklist passes.
**Screenshots:** p5 set, plus 4 extra: the street, the fountain, the building row, and the full map at 1× (a debug `?shot=map` mode that zooms out to fit).

---

### Phase 6: The living world (clock, light, weather, life, sound)

**Goal:** the neighborhood feels alive and changes over the day.

**Steps**
1. `packages/shared/src/clock.ts` (section 5.7), with unit tests. Add `serverNow` to the protocol and store `skew` on the client.
2. A HUD clock pill (top-left): `Seg · 17:40 · ☀️` (the weekday comes from `gameDay % 7`: Dom, Seg, Ter, Qua, Qui, Sex, Sáb).
3. `render/pixel/lighting.ts` (section 5.8): grade, darkness and glows. Lamps and windows light up at 18:00 and switch off at 06:00, each with a random 0–40 game-minute delay so they don't all flip at once. Lit-window sprite variants on facades.
4. **Weather.** `packages/shared/src/weather.ts`: `weatherFor(gameDay)` is a deterministic roll from a seed. Probabilities: sol 55%, nublado 25%, garoa 15%, chuva 5%. The weather changes only at 06:00. Client effects:
   - garoa: fine rain particles and a slight blue-grey grade;
   - chuva: heavier rain, puddle decals on calçada/asfalto, splash particles, darker grade, and CPUs carry umbrellas if the pack has them.
   NPC idle lines get a weather set (for example "Que garoa, hein?" / "What a drizzle, huh?"). Mark every new PT line `needs_br: true` (section 8).
5. `render/pixel/ambient.ts`, all client-side and **deterministic from the game clock** so every player sees roughly the same thing:
   - the bus every 6 game-hours, stopping 8 real seconds at the stop;
   - cars, a Kombi and a motoboy crossing Rua dos Ipês and Rua Jacarandá at random intervals (seeded by game minute), none at night between 01:00 and 05:00;
   - the vira-lata (sleeps 12:00–15:00 and 22:00–06:00, otherwise wanders slowly within 6 tiles of its corner); pigeon flocks that fly off when a player walks within 2 tiles; butterflies near ipês (day only); fireflies in the gardens (night only);
   - falling ipê petals (steady rate, more in wind), cloud shadows (day, 3–5 soft blobs drifting at about 6 px/s), fountain water.
6. **Audio zones.** Extend `apps/client/src/ambience.ts`: in outdoor maps, mix loops by distance: street traffic (north), fountain (center), birds (day) / crickets (night), rain (weather), distant radio (near houses). Footsteps per terrain (`floorAt`) for the local player, quiet, with a random pitch of ±5%. Keep the existing interior beds. Each loop must be CC0 and listed in `CREDITS.md`. Honor the existing sound and music toggles.
7. The intro/title screen: rebuild `ui/introHeroScene.ts` so it shows the real Vila Ipê map at 17:30 with a slow camera pan behind the sign-in card. Keep all intro logic, tests and ids (`#intro-enter`, `#intro-skip`, etc.).

**Done when:** a 48-minute soak (you may run the clock 20× faster with `?clock=20` in dev only) looks right at every hour; the performance budget (section 5.11) holds; `?lowfx=1` works.
**Screenshots:** the same street spot at 07:00, 12:00, 17:30, 19:30 and 23:00, plus garoa and chuva.

---

### Phase 7: In-world dialogue, readable world and the Caderno

**Goal:** conversations happen *in* the world, and the world itself teaches.

**Steps**
1. **Dialogue box** (`ui/dialogue.ts`). It presents the existing server messages (`scene` for the Carlos scene graph and `conversa` for Conversa) and does **not** change their protocol.
   - Bottom-anchored box, max width 880 px (full width on phones). A 64×64 pixel portrait at 2× (at 1× on phones), shown with the expression the line calls for (default `neutro`; `feliz` on praise; `surpreso` on a miss; `pensativo` while waiting for an AI turn).
   - Name tag in the NPC color. The PT line types out at 45 chars/s; Space or a click finishes it. The EN gloss sits underneath in a muted italic, behind a "Mostrar inglês / Show English" toggle stored in `localStorage` (default **on** for Verde).
   - 🔊 Ouvir (Listen) button (existing `speak`). Chips are numbered 1–4 (the keys work), and there's a text input "Responda em português…" (Enter sends). Keep every existing feedback element (Perfeito! chips, meters, tips, the Gate A warn toast) and restyle it.
   - The world stays visible and keeps moving. The camera eases its zoom +1 integer step, centered between the player and the NPC, and returns on close. The player can't walk while the box is open; Esc/✕ closes it.
   - Keep the old modal code behind `?dialogue=modal` for one release, then delete it (Phase 10).
2. **Readable world** (`packages/shared/src/hotspots.ts`): a list of `{ id, room, x, y, w?, h?, pt, en, cards?: string[] }` for signs, menus (the padaria cardápio with prices in R$), posters, the banca headlines and street signs. Clicking one opens a small DOM card: the full PT text large, 🔊, the EN gloss, and "Guardar no caderno" (save to notebook). Hotspots take part in `hitTest` (a new `Hit` kind `hotspot`) and show a small 👁 cue above them when you're within 3 tiles.
3. **Caderno de palavras** (word notebook): `PrivateProfile.caderno?: Record<cardId, { seen: number; heard: number; used: number; firstAt: number }>`. Server events: `seen` (hotspot read, dialogue line containing the card), `heard` (🔊 played), `used` (the player typed an accepted form, via `accept.ts`). A panel grouped by place (Padaria, Rua, Praça…) lists the words with audio and a progress count. Completing a group pays RV once (amount: 🧑 JONNY; default +15 RV).

**Done when:** Carlos's scene and Conversa run fully in the dialogue box; ≥ 20 hotspots exist across the map and interiors; the Caderno fills up while playing; e2e is updated (the dialogue selectors change; keep the same stable ids where you can).
**Screenshots:** the dialogue box on desktop and phone, a hotspot card, and the Caderno panel.

---

### Phase 8: Recados, friendships and NPC schedules (the life-sim loop)

**Goal:** a reason to walk around every day.

**Data (shared, pure, unit-tested):**

```ts
// packages/shared/src/recados.ts
export type RecadoStep =
  | { kind: 'falar'; npc: NpcId }                                  // talk to someone
  | { kind: 'pedir'; npc: NpcId; itemId: string; qty: number }      // order it (scene/Conversa/Me vê um result must contain it)
  | { kind: 'entregar'; npc: NpcId; itemId: string; qty: number }   // hand it over (from the bag)
  | { kind: 'ir'; room: RoomId; area?: { x: number; y: number; w: number; h: number } }
  | { kind: 'ler'; hotspotId: string }                              // read a sign
  | { kind: 'cumprimentar'; npc?: NpcId; timeCorrect?: boolean };   // greet (optionally with the right bom dia/boa tarde/boa noite)
export interface RecadoDef {
  id: string;
  giver: NpcId;
  minBond: number;          // friendship needed to be offered
  title: Bilingual;
  ask: Bilingual;           // what the giver says
  thanks: Bilingual;
  steps: RecadoStep[];
  reward: { rv: number; bond: number; itemId?: string };
  cards: string[];          // curriculum card ids this recado practices
  needs_br: true;
}
```

**Profile additions** (all optional; default them in the store loader so old saves load): `bag?: Record<string, number>`, `recados?: { day: number; offered: string[]; active: { id: string; step: number }[]; done: string[] }`, `bond?: Partial<Record<NpcId, number>>` (0–100, where 10 points = 1 heart), `npcMemory?: Partial<Record<NpcId, string>>` (max 200 chars each).

**Steps**
1. `apps/server/src/recados.ts`: a class with `onEvent(session, ev)`. The events are emitted from small hooks in `world.ts` wherever things already happen: tutorial `completeStep`, the scene end, the Conversa end (the items ordered come from the conversa order), a correct Me vê um order, the `join` room, hotspot reads (a new `ClientMsg` `{ t: 'read'; hotspotId }`, validated for distance ≤ 3 tiles), greetings in chat (reuse the Cumprimenta detection from the daily mission). Add a new `ClientMsg` `{ t: 'give'; npc: NpcId; itemId: string }` (validated for adjacency and that the item is in the bag).
2. Offer 3 recados per game day, from givers the player has unlocked (`minBond`). The Missão do dia becomes the **first recado of the day** from the kiosk: keep its copy, its once-per-real-day RV rule, and `MISSION_*` exports so existing tests stay green.
3. The tutorial (*Primeiros passos*) is presented as Júlia's welcome recado chain. **Keep the `tutorial` flags and the rewards logic as they are.** Only the UI changes, into a "Recados" tracker (right side, max 3 lines, one tap opens the journal panel).
4. **Friendships:** talking (once per NPC per game day) +2, a finished recado from them +`reward.bond`, a good Conversa grade +3. Hearts show in the NPC hover label and the journal. Milestones:
   - 2 hearts: the NPC uses your name and remembers one thing about you;
   - 4 hearts: a new Conversa subject unlocks (add subjects to `CONVERSA_SUBJECTS`);
   - 6 hearts: they give you a furniture item for the kitnet.
5. **NPC memory:** after a Conversa ends, the server stores a ≤ 200-char PT summary in `npcMemory[npc]`. With AI on, ask the model in `services/xai.ts` for the summary; otherwise use a template ("Pediu um café com leite.") built from the conversa order. Pass the memory into the system prompt of the next Conversa with that NPC (`buildCarlosSystemPrompt` and friends: add an optional `memory` argument). Run the summary through `filterNpcLine` / safety before storing it. **Never** store the player's raw chat.
6. **NPC schedules** (`packages/shared/src/schedules.ts`): `{ npc, from: minute, to: minute, room, tile, dir, activity: 'trabalhando' | 'passeando' | 'sentado' | 'em_casa' }[]`. Server NPC positions come from `schedule(npc, gameMinutes(now))`, and the server walks NPCs between slots, reusing the CPU walking code in `apps/server/src/ambiance.ts`. **D12 applies:** Carlos is at the padaria counter 06:00–22:00. A new colleague NPC, **Dona Graça** (night shift, same authored scene graph and Me vê um), covers 22:00–06:00. Nanda's stall is staffed 08:00–20:00; after that the stall is closed, and the hat shop moves to a "Chapéus" panel reachable from her closed stall sign. Júlia is always somewhere in the praça.
   This means `NpcDef` gets an optional `schedule` and the static `x, y` becomes the fallback. `buildGrid` blocks NPC tiles; with moving NPCs, blocking uses their **current** tile (server-side) and **no** static block. Update the grid code and its tests carefully. This is the riskiest server change in the plan, so do it in its own PR (`p8b`).
7. Write the first **15 recados** across Carlos, Nanda, Júlia and Dona Graça (A1 level, informal Brazilian Portuguese, one clear task each). Put them in `content/curriculum/phase0/recados.md` and generate JSON with `pnpm content` (extend `scripts/build-curriculum.mjs` in the same style as the other packs). Every one is `needs_br: true`.

**Done when:** a new player plays tutorial → first recados → daily recados for three game days without dead ends; the bond hearts rise; Carlos mentions yesterday's order. New unit tests cover step validation, give/bag, daily rollover, bond milestones and schedule resolution at the boundaries (05:59, 06:00, 21:59, 22:00). e2e gains one recado from offer to reward.

---

### Phase 9: Feira livre (the first new place, to prove the pipeline)

**Goal:** a new location built only from data, art and the Phase 7–8 systems.

**Steps**
1. The fenced east lot becomes the **Feira** (open 06:00–13:00 game time; outside those hours the stalls are folded tarps, per D12, and the feira's learning content moves to the banca's "Hortifrúti" corner).
2. 4 stalls: frutas (Dona Graça's sister, **Tia Lu**), verduras, pastel + caldo de cana, flores. Each has price-tag hotspots in R$ (reuse `numbers.ts` for spoken prices).
3. A **"Quanto custa?"** interaction: a short Conversa subject per stall (ask the price, choose quantity, pay the exact amount from a coin/note tray, which is a small Me vê um-style panel reusing the tray UI patterns in `ui/meveum-ui.ts`).
4. 5 recados that use the feira (for example, buy fruit for Nanda, flowers for Júlia's birthday).
5. Ambient: the vendors call out in PT ("Olha a banana! Três por cinco!"), shown as bubbles with gloss, plus crowd CPUs that browse the stalls.

**Done when:** it plays well; no new engine code was needed apart from small data-driven hooks (if it was, write down why in `DECISIONS.md`).

---

### Phase 10: Polish, cleanup and docs

1. Delete the isometric bake pipeline: `scripts/bake-art.mjs`, `scripts/art-stamp.mjs`, `apps/client/src/art/studio.ts`, `studio.css`, the old contact-sheet scripts, `public/art/{props,furniture,hats,food}`. Also remove the `?dialogue=modal` fallback. First `grep` for every import and reference.
2. Mobile pass at 390×844 and 844×390: HUD layout, dialogue box, joystick, tap targets ≥ 44 px, and the performance budget.
3. Accessibility: `prefers-reduced-motion`, a text-size setting (100/125/150%) for the dialogue box and bubbles, and keyboard-only play (Tab through the HUD; E to interact with the facing tile: add this).
4. Update `README.md` (new screenshots, new play path), `PHASE0_STATUS.md` (a new section), and `docs/art/README.md` (point to the pixel pipeline and `assets-src/README.md`).
5. Out of scope, listed for later: pixel poses for the Academia roll (`bjjPoses.ts`), more bairros reachable by bus, player-run jobs, seasons and festas (Festa Junina!).

---

## 7. Working rules for the agent

### 7.1 Before you code (every phase)
1. `git pull` and read the files the phase touches, in full.
2. Run `pnpm install && pnpm verify` and write down anything already failing.
3. Write a short plan in the PR description draft: the files you'll create or change, and the tests you'll add.

### 7.2 While coding
- Small commits, each of which typechecks.
- New server systems go in new files; `world.ts` gets hooks of 1–5 lines. Don't grow `world.ts` by hundreds of lines.
- Pure logic goes in `packages/shared` with vitest tests next to it (`*.test.ts`), following the existing test style.
- No `any` in new code. No non-null `!` on data that comes from the network.
- New `PrivateProfile` fields are **optional**, with defaults applied on load. Never break an existing save.
- New protocol messages are added to the `ClientMsg` / `ServerMsg` unions in `protocol.ts` and handled in the `World` switch. Validate every client field on the server (types, ranges, distance to the target).
- Keep the solo build working: `VITE_LOCAL_WORLD=1 pnpm --filter @tudobem/client build`, then open it with `?solo`.

### 7.3 Verify
```bash
pnpm verify
```
```bash
pnpm build && pnpm start
```
Then, in a second terminal (Chrome needed; on Windows set `CHROME_PATH` to chrome.exe):
```bash
pnpm e2e
```
```bash
pnpm e2e:meveum
```

### 7.4 Screenshots
Run `node scripts/lifesim-shots.mjs` against the running build. Open the images and go through the Beauty checklist (section 4.6) item by item. Fix what fails before you open the PR. Put the images in `docs/lifesim/shots/p<N>/` and link them in the PR.

### 7.5 Stop and ask 🧑 JONNY when…
- anything needs buying, signing up, a license, or an API key;
- the style frame or any art direction needs approval;
- you want to delete a folder or more than ~300 lines of code not listed in this plan;
- a locked decision (section 3) seems impossible;
- a change would reset or migrate player data;
- you're adding a new NPC, a new place, or a new currency or reward amount.

### 7.6 Common pitfalls (read before Phase 2)

| Symptom | Cause | Fix |
|---|---|---|
| Blurry sprites | Non-integer zoom, or `pixelArt` not set | Section 5.3; zoom must be an integer in device pixels |
| Thin lines between tiles | Texture bleeding | Extrude tiles by 1 px in the import script; set `margin`/`spacing` in `addTilesetImage` |
| Characters shimmer while walking | Sub-pixel camera scroll | `roundPixels: true`, `camera.setRoundPixels(true)` |
| Can't type W/A/S/D or spaces in chat | Phaser keyboard capture | Phaser input must be fully disabled (D3); the WASD handler ignores focused inputs |
| Custom canvas shows nothing | `type: AUTO` with a supplied canvas | Use `type: Phaser.WEBGL` |
| Characters pop in front of or behind wrongly | Wrong depth | `depth = bottom-edge world y`; overhead parts on their own sprite at depth 50000 |
| Memory grows as players come and go | Composed textures never removed | LRU cache + `textures.remove` (section 5.5) |
| Accents missing in a font | Pixel font lacks Latin-1 | Test string in Phase 4; D9 keeps learning text in Nunito |
| Everything lags on a phone | Too many textures, particles or full-res RT | Atlases, the section 5.11 caps, half-res darkness RT, `lowfx` |
| e2e can't click things | Pixel coordinates changed | Use the `__tb.interact` / `__tb.walkTo` hooks from Phase 0 |
| Avatars glide after a tab switch | Time-based position | That's expected with `positionAlong`; don't add frame-based movement |

---

## 8. Portuguese content rules

- Informal Brazilian Portuguese, the way people talk in São Paulo: *você, a gente, tá, pra, beleza, tudo bem?* A1 level for Verde players: short sentences, present tense, high-frequency words.
- Every line the player sees is `Bilingual` (`{ pt, en }`). The EN is natural, not a word-for-word gloss.
- Every **new** PT string (NPC lines, recados, hotspots, weather lines, vendor calls) is marked `needs_br: true` (in content markdown/JSON) and listed in the PR under "Needs BR review". Don't invent new curriculum *cards*: reference existing card ids from `cards.ts` / the content packs, and if a word has no card, list it under "Proposed cards" in the PR instead of adding it.
- Use the curriculum phrasing locks already in the repo (for example "I'll take…", not "Give me…", for *Me vê um…*; see the tests in `packages/shared` that enforce them).
- Every AI-generated NPC line goes through the existing safety path (`filterNpcLine`, `safety.ts`). The age policy (`docs/AGE_POLICY.md`) still applies.

---

## 9. Glossary

| PT | Meaning in this project |
|---|---|
| Vila Ipê | The neighborhood (the outdoor map, room id `praca`) |
| bairro | neighborhood |
| recado | errand / small task for a neighbor |
| amizade / corações | friendship / hearts |
| caderno (de palavras) | the word notebook collection |
| feira livre | open-air street market |
| garoa | fine São Paulo drizzle |
| calçada / petit-pavé | patterned sidewalk paving |
| orelhão | the orange public phone booth |
| banca (de jornal) | newsstand |
| toldo | awning |
| vira-lata caramelo | the iconic caramel-colored stray dog |
| RV | the in-game currency (existing) |
| Verde | the beginner nameplate / fluency band (existing) |
