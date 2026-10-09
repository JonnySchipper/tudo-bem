# Art licenses

Third-party art used by Tudo Bem / Vila Ipê. **Credits are required** by both licenses below.

## Credit line (use everywhere the art is shown)

> Art: LimeZu — https://limezu.itch.io/

The style-frame page (`apps/client/lifesim-frame.html`) shows a short version in its footer
("Art: LimeZu — limezu.itch.io"). The in-game credits panel (Ajustes → Créditos, `apps/client/src/ui/credits.ts`) carries the full
line, and the title screen footer carries the short one.

## LimeZu — Modern Interiors (full version)

- Source: https://limezu.itch.io/moderninteriors
- Local copy: `limezu-modern-interiors/` (license text: `limezu-modern-interiors/LICENSE.txt`)

Summary of the license text shipped with the pack:

| You can | You can't |
|---|---|
| Edit and use the asset in any commercial or non-commercial project | Resell or distribute the asset to others |
| Use the asset in any commercial or non-commercial project | Edit and resell the asset to others |

Credits required: limezu.itch.io

## LimeZu — Modern Exteriors

- Source: https://limezu.itch.io/modernexteriors
- Local copy: `limezu-modern-exteriors/` (license: `limezu-modern-exteriors/Modern_Exteriors_License.pdf`)

Summary of the license PDF shipped with the pack:

| You can | You can't |
|---|---|
| Edit and use the asset in any commercial or non-commercial project | Resell or distribute the asset to others |
| Use the asset in any commercial or non-commercial project | Edit and resell the asset to others (including NFT minting) |
| Use the asset in open source projects (for example GitHub) | |

Credits required: https://limezu.itch.io/

## What this means for the repo

- **No redistribution of the raw files.** `apps/client/assets-src/limezu-*` stays in this private repository as the
  import source. It is never copied into `public/`, never published as a package and never uploaded as a release asset.
- What ships to players is the small, **game-ready subset** that `scripts/pixel-import.mjs` writes to
  `apps/client/public/pixel/` (packed atlases of the sprites listed in `import-map.json`, plus recolored or edited
  derivatives). These are edits of the licensed art for use inside this one game, which the licenses allow; do not
  publish `public/pixel/` as a standalone asset pack.
- If this repository ever becomes public, remove `assets-src/limezu-*` (and any raw sheets) from it first, and
  re-check `public/pixel/` against the licenses. Jonny decides.
- The Character Generator desktop tool (`THIRD-PARTY TOOLS.txt` in the interiors pack, by 0a3r) is not used and not
  redistributed.

## Original pieces

Files under `apps/client/assets-src/custom/` are original work for this project (hand-authored pixel grids and
scripted patterns that use only colors from the LimeZu palettes). They carry no third-party license, but they are
drawn to match the LimeZu style and are only intended to be used together with it.
