#!/usr/bin/env node
/**
 * assets-src -> public/pixel (HOWTO Phase 1).
 *
 *   pnpm pixel
 *
 * Reads apps/client/assets-src/import-map.json (hand-written), slices/derives sprites from the licensed LimeZu sheets and
 * the original custom pieces, packs them into atlases with 1px extrusion, builds the extruded terrain tileset (16 dual-grid
 * mask tiles per terrain), converts character layers to canonical keyed sheets and writes manifest.json.
 * Nothing is copied wholesale: only what import-map.json lists is emitted (keeps public/pixel small).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrudeTilesetToImage } from 'tile-extruder';
import { blank, crop, paste, loadPng, savePng, remapExact, flipH, distinctColors, isolate, trim } from './lib/pixel/img.mjs';
import { loadImportMap } from './lib/pixel/importmap.mjs';
import { recolorRamp } from '../apps/client/assets-src/custom/kit.mjs';
import { FLOORS } from '../apps/client/assets-src/custom/floors.mjs';
import { packAtlas } from './lib/pixel/pack.mjs';
import { buildSlabTiles, buildFlatTiles, buildFlushTiles } from './lib/pixel/terrain-gen.mjs';
import { splitTree, swayFrames } from './lib/pixel/tree.mjs';
import { castShadow } from './lib/pixel/shadow.mjs';
import { CANON_ANIMS, CANON_COLS, CANON_ROWS, FRAME_W, FRAME_H } from './lib/pixel/chars.mjs';
import { buildChars } from '../apps/client/assets-src/custom/chars.mjs';
import { KEY_RAMPS } from '../apps/client/src/render/pixel/palette.ts';
import { calcadaFills, spMosaic } from '../apps/client/assets-src/custom/calcada.mjs';
import { banca, BANCA } from '../apps/client/assets-src/custom/banca.mjs';
import { patchSign, findGlass } from '../apps/client/assets-src/custom/shop.mjs';
import { crosswalk, laneDash, flowerScatter, tuft } from '../apps/client/assets-src/custom/street.mjs';
import { asfalto, busBay, grassPatch, dirtPatch, clover, gtuft } from '../apps/client/assets-src/custom/ground.mjs';
import { shadowEllipse, petal, petalScatter, glow, cloudShadow, grime, lightPatch } from '../apps/client/assets-src/custom/fx.mjs';
import { DERIVE, IMAGES } from '../apps/client/assets-src/custom/derive.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'apps/client/assets-src');
const OUT = path.join(ROOT, 'apps/client/public/pixel');
const CUSTOM_PNG = path.join(SRC, 'custom/png');

// import-map.json + every import-map.d/*.json fragment (merged after it, file-name order)
const map = loadImportMap(SRC);
const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');

const CUSTOM = {
  banca: () => ({ img: banca(), anchor: [BANCA.ax, BANCA.ay] }),
  spMosaic: (a) => ({ img: spMosaic(a.w ?? 64, a.h ?? 48), anchor: [(a.w ?? 64) / 2, a.h ?? 48] }),
  crosswalk: (a) => ({ img: crosswalk(a.w, a.h), anchor: [0, 0] }),
  laneDash: (a) => ({ img: laneDash(a.len), anchor: [0, 0] }),
  flowerScatter: (a) => ({ img: flowerScatter(a.w, a.h, a.count, a.seed), anchor: [0, 0] }),
  tuft: (a) => ({ img: tuft(a.kind), anchor: [2, 3] }),
  busBay: (a) => ({ img: busBay(a.w, a.h), anchor: [0, 0] }),
  grassPatch: (a) => ({ img: grassPatch(a.w, a.h, a.seed, a.tone), anchor: [Math.floor(a.w / 2), Math.floor(a.h / 2)] }),
  dirtPatch: (a) => ({ img: dirtPatch(a.w, a.h, a.seed), anchor: [Math.floor(a.w / 2), Math.floor(a.h / 2)] }),
  clover: (a) => ({ img: clover(a.kind), anchor: [3, 5] }),
  gtuft: (a) => ({ img: gtuft(a.kind), anchor: [2, 3] }),
  grime: (a) => ({ img: grime(a.w, a.h, a.seed), anchor: [Math.floor(a.w / 2), Math.floor(a.h / 2)] }),
};

const resolveSrc = (spec) => {
  const [rootKey, rest] = spec.includes(':') ? spec.split(':') : [null, spec];
  return path.join(SRC, rootKey ? map.roots[rootKey] : '', rest);
};

const sheetCache = new Map();
async function sheet(name) {
  if (!sheetCache.has(name)) {
    const spec = map.sheets[name];
    if (!spec) throw new Error(`import-map: unknown sheet '${name}'`);
    sheetCache.set(name, await loadPng(resolveSrc(spec)));
  }
  return sheetCache.get(name);
}

fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ['atlas', 'tiles', 'chars', 'fx', 'portraits', 'icons', 'ui']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
fs.mkdirSync(CUSTOM_PNG, { recursive: true });

const manifest = { version: 1, tile: 16, atlases: {}, terrain: {}, sprites: {}, images: {}, chars: {}, sheet: {}, keyRamps: {}, fx: {}, lights: {} };
const atlasItems = { outdoor: [] };
const sprites = manifest.sprites;

function addFrame(atlas, name, img) {
  atlasItems[atlas].push({ name, img });
}

function baseEntry(def, img, anchor) {
  return {
    atlas: 'outdoor',
    frame: def.key,
    w: img.w,
    h: img.h,
    ax: anchor[0],
    ay: anchor[1],
    footprint: def.footprint ?? [1, 1],
    anim: null,
    overhead: null,
    shadow: def.shadow ?? null,
    ...(def.decal ? { decal: true } : {}),
    ...(def.light ? { light: def.light } : {}),
  };
}

/** Flat cast shadow (down-right) derived from the sprite silhouette, stored as `<key>#cast` and linked from the sprite entry. */
function addCast(def, img, anchor) {
  if (!def.cast) return;
  const { img: sh, ax, ay } = castShadow(img, anchor[1], anchor[0], def.cast.kx, def.cast.ky, def.cast.rgba);
  const name = `${def.key}#cast`;
  addFrame('outdoor', name, sh);
  sprites[def.key].cast = { frame: name, w: sh.w, h: sh.h, ax, ay };
}

/**
 * A `derive` generator returns "parts": { key?, img | frames[], fps?, anchor, meta? }. The first part (key = def.key) inherits the
 * import-map entry (footprint, shadow, cast, light...); extra parts (lit-window overlays, companions) carry their own `meta`.
 */
async function emitParts(def, parts) {
  for (const part of parts) {
    const key = part.key ?? def.key;
    const m = { ...(key === def.key ? def : {}), ...(part.meta ?? {}), key };
    const frames = part.frames ?? [part.img];
    const first = frames[0];
    await savePng(first, path.join(CUSTOM_PNG, key.replaceAll('/', '_') + '.png'));
    if (part.frames) {
      const names = frames.map((f, i) => { const n = `${key}/${i}`; addFrame('outdoor', n, f); return n; });
      sprites[key] = { ...baseEntry(m, first, part.anchor), frame: names[0], anim: { frames: names, fps: part.fps ?? 6 } };
    } else {
      addFrame('outdoor', key, first);
      sprites[key] = baseEntry(m, first, part.anchor);
    }
    for (const k of ['overhead', 'windows', 'lit', 'attach']) if (m[k] !== undefined) sprites[key][k] = m[k];
    addCast(m, first, part.anchor);
  }
}

// ------------------------------------------------------------------ sprites
const deriveCtx = { load: async (spec) => loadPng(resolveSrc(spec)), sheet, map };
for (const def of map.sprites) {
  const kind = def.kind ?? 'sprite';
  if (kind === 'sprite') {
    const src = await sheet(def.sheet);
    let img = crop(src, ...def.rect);
    if (def.recolor) img = remapExact(img, new Map(Object.entries(map.recolors[def.recolor]).filter(([k]) => k[0] === '#')));
    if (def.isolate) img = isolate(img, def.isolate[0] - def.rect[0], def.isolate[1] - def.rect[1]);
    if (def.swap) img = remapExact(img, new Map(Object.entries(def.swap)));
    if (def.ramp) img = recolorRamp(img, def.ramp, def.rampKeep ?? ['#3a3a50', '#46465e']);
    if (def.flip) img = flipH(img);
    // `trim`: drop the transparent margins of the crop (the pack's theme sorters put every piece on 16 px cells). The anchor then defaults to
    // the bottom centre, lifted by `foot` px (the soft shadow strip the pack bakes under most furniture).
    if (def.trim) img = trim(img).img;
    const anchor = def.anchor ?? [Math.floor(img.w / 2), img.h - (def.foot ?? 0)];
    addFrame('outdoor', def.key, img);
    sprites[def.key] = baseEntry(def, img, anchor);
    addCast(def, img, anchor);
  } else if (kind === 'shop') {
    const src = await sheet(def.sheet);
    const img = crop(src, ...def.rect);
    const glass = findGlass(img);
    patchSign(img, def.sign);
    addFrame('outdoor', def.key, img);
    sprites[def.key] = { ...baseEntry(def, img, def.anchor), windows: glass };
    addCast(def, img, def.anchor);
  } else if (kind === 'custom') {
    const { img, anchor } = CUSTOM[def.custom](def.args ?? {});
    await savePng(img, path.join(CUSTOM_PNG, path.basename(def.key) + '.png'));
    addFrame('outdoor', def.key, img);
    sprites[def.key] = baseEntry(def, img, def.anchor ?? anchor);
    addCast(def, img, def.anchor ?? anchor);
  } else if (kind === 'derive') {
    if (!DERIVE[def.fn]) throw new Error(`import-map: unknown derive fn '${def.fn}'`);
    await emitParts(def, await DERIVE[def.fn](deriveCtx, def.args ?? {}));
  } else if (kind === 'strip') {
    const src = await sheet(def.sheet);
    const names = [];
    for (let i = 0; i < def.frames; i++) {
      const img = crop(src, i * def.frameW, 0, def.frameW, def.frameH);
      const name = `${def.key}/${i}`;
      addFrame('outdoor', name, img);
      names.push(name);
    }
    sprites[def.key] = { ...baseEntry(def, crop(src, 0, 0, def.frameW, def.frameH), def.anchor), frame: names[0], anim: { frames: names, fps: def.fps } };
  } else if (kind === 'tree') {
    const src = await sheet(def.sheet);
    let img = crop(src, ...def.rect);
    if (def.recolor) img = remapExact(img, new Map(Object.entries(map.recolors[def.recolor]).filter(([k]) => k[0] === '#')));
    const { trunk, canopy } = splitTree(img, def.cutY);
    const frames = swayFrames(canopy, 1);
    const trunkKey = def.key, canopyKey = `${def.key}_canopy`;
    addFrame('outdoor', trunkKey, trunk);
    sprites[trunkKey] = { ...baseEntry({ ...def, key: trunkKey }, trunk, [Math.floor(img.w / 2), def.baseY - def.cutY]), overhead: canopyKey };
    addCast(def, img, [Math.floor(img.w / 2), def.baseY]);
    const names = frames.map((f, i) => { const n = `${canopyKey}/${i}`; addFrame('outdoor', n, f); return n; });
    sprites[canopyKey] = {
      ...baseEntry({ ...def, key: canopyKey, shadow: null, footprint: def.footprint }, frames[0], [Math.floor(img.w / 2) + 1, def.baseY]),
      frame: names[0],
      overhead: true,
      anim: { frames: [names[0], names[1], names[0], names[2]], fps: 3 },
    };
  } else {
    throw new Error('unknown sprite kind ' + kind);
  }
}

// ------------------------------------------------------------------ standalone images (portraits, icons, UI kit)
// These are meant for the DOM (<img>, CSS border-image, background) and are shown at 2-4x, so each is its own PNG under
// public/pixel/<group>/ and gets a manifest.images[key] = { file, w, h, ...meta } entry (meta: slice insets, frame counts...).
for (const def of map.images ?? []) {
  if (!IMAGES[def.fn]) throw new Error(`import-map: unknown images fn '${def.fn}'`);
  for (const part of await IMAGES[def.fn](deriveCtx, def.args ?? {})) {
    const file = `${part.key}.png`;
    fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    await savePng(part.img, path.join(OUT, file));
    manifest.images[part.key] = { file, w: part.img.w, h: part.img.h, ...(part.meta ?? {}) };
  }
}

// ------------------------------------------------------------------ fx (generated light/particle pieces)
const fxSprite = (key, img, anchor, extra = {}) => {
  addFrame('outdoor', key, img);
  sprites[key] = { atlas: 'outdoor', frame: key, w: img.w, h: img.h, ax: anchor[0], ay: anchor[1], footprint: [1, 1], anim: null, overhead: null, shadow: null, ...extra };
};
fxSprite('fx/shadow_10', shadowEllipse(9, 4), [4, 2]);
fxSprite('fx/shadow_16', shadowEllipse(14, 6), [7, 3]);
fxSprite('fx/shadow_32', shadowEllipse(30, 10), [15, 5]);
fxSprite('fx/shadow_48', shadowEllipse(46, 12), [23, 6]);
fxSprite('fx/petal_a', petal(0), [1, 1]);
fxSprite('fx/petal_b', petal(1), [1, 1]);
fxSprite('decals/petals_large', petalScatter(44, 22, 26, 3), [22, 11], { decal: true });
fxSprite('decals/petals_medium', petalScatter(30, 16, 15, 9), [15, 8], { decal: true });
// window light on the floor (interiors): a slanted patch with the window's mullion shadows, drawn ADD; anchor = top-left corner under the window's left edge
fxSprite('fx/light_patch_32', lightPatch(32, 2), [0, 0]);
fxSprite('fx/light_patch_48', lightPatch(48, 3), [0, 0]);
{
  const g = glow(128);
  await savePng(g, path.join(OUT, 'fx/glow_128.png'));
  manifest.fx.glow = { file: 'fx/glow_128.png', w: 128, h: 128 };
  const c = cloudShadow(512, 256, 11, 64);
  await savePng(c, path.join(OUT, 'fx/cloud_shadow.png'));
  manifest.fx.cloudShadow = { file: "fx/cloud_shadow.png", w: 512, h: 256 };
}

// ------------------------------------------------------------------ atlas
for (const [name, items] of Object.entries(atlasItems)) {
  const { atlas, json } = packAtlas(items, { maxWidth: map.atlas[name]?.maxWidth ?? 512 });
  json.meta.image = `${name}.png`;
  await savePng(atlas, path.join(OUT, `atlas/${name}.png`));
  fs.writeFileSync(path.join(OUT, `atlas/${name}.json`), JSON.stringify(json));
  manifest.atlases[name] = { image: `atlas/${name}.png`, data: `atlas/${name}.json`, w: atlas.w, h: atlas.h, frames: items.length };
}

// ------------------------------------------------------------------ terrain tileset
{
  const tiles = [];
  const layers = {};
  const CUSTOM_FILL = { calcada: () => calcadaFills() };
  for (const [ch, def] of Object.entries(map.terrain)) {
    const first = tiles.length;
    if (def.kind === 'slab') {
      // a custom generator returns the fills row-major over a (phasesX x phasesY) grid: a wave repeats every few tiles, a band every one or two
      const { fills, phasesX, phasesY } = CUSTOM_FILL[def.custom]();
      tiles.push(...buildSlabTiles(fills));
      layers[ch] = { name: def.name, edge: 'slab', first, phases: phasesX, phasesY, variants: 1, tiles: 16 * fills.length };
      const s = blank(16 * phasesX, 16 * phasesY);
      fills.forEach((f, p) => paste(s, f, (p % phasesX) * 16, Math.floor(p / phasesX) * 16));
      await savePng(s, path.join(CUSTOM_PNG, def.custom + '_fill.png'));
    } else if (def.kind === 'flush') {
      // interior floors and pavers: exact quadrant cuts of a fill (custom generator in custom/floors.mjs, phases x,y)
      const gen = FLOORS[def.custom];
      if (!gen) throw new Error(`import-map: unknown flush floor '${def.custom}'`);
      const fills = gen.fn(gen.needsPack ? await sheet(def.sheet) : undefined);
      tiles.push(...buildFlushTiles(fills, { rim: def.rim ?? null }));
      layers[ch] = { name: def.name, edge: 'flush', first, phases: gen.phasesX, phasesY: gen.phasesY, variants: 1, tiles: 16 * fills.length };
      const s = blank(16 * gen.phasesX, 16 * gen.phasesY);
      fills.forEach((f, p) => paste(s, f, (p % gen.phasesX) * 16, Math.floor(p / gen.phasesX) * 16));
      await savePng(s, path.join(CUSTOM_PNG, `floor_${def.custom}_fill.png`));
    } else {
      // flat underlay: a custom generator (asphalt) or tiles cropped from a pack sheet (grass)
      const FLAT_CUSTOM = { asfalto };
      const src = def.custom ? null : await sheet(def.sheet);
      const fills = def.custom ? FLAT_CUSTOM[def.custom]() : def.tiles.map(([x, y]) => crop(src, x, y, 16, 16));
      const seen = new Map();
      const uniq = [];
      for (const f of fills) { const k = Buffer.from(f.data).toString('base64'); if (!seen.has(k)) { seen.set(k, uniq.length); } }
      // keep duplicates as extra variants: they act as weights in tileIndex()'s hash pick
      const flat = buildFlatTiles([fills[0]], fills.slice(1));
      tiles.push(...flat);
      layers[ch] = { name: def.name, edge: 'flat', first, phases: 1, variants: fills.length, tiles: flat.length };
    }
  }
  const cols = 16;
  const rows = Math.ceil(tiles.length / cols);
  const ts = blank(cols * 16, rows * 16);
  tiles.forEach((t, i) => paste(ts, t, (i % cols) * 16, Math.floor(i / cols) * 16));
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-terrain-')), 'terrain_raw.png');
  await savePng(ts, tmp);
  await extrudeTilesetToImage(16, 16, tmp, path.join(OUT, 'tiles/terrain.png'), { extrusion: 1, margin: 0, spacing: 0 });
  manifest.terrain = { tileset: 'tiles/terrain.png', tile: 16, margin: 1, spacing: 2, columns: cols, count: tiles.length, layers };
}

// ------------------------------------------------------------------ characters
{
  const { layers } = await buildChars({ base: resolveSrc(map.chars.base) });
  for (const key of Object.keys(layers).sort()) {
    await savePng(layers[key], path.join(OUT, `chars/${key}.png`));
    manifest.chars[key] = `chars/${key}.png`;
  }
  manifest.sheet = { frame: [FRAME_W, FRAME_H], cols: CANON_COLS, rows: CANON_ROWS, anims: CANON_ANIMS, facingRow: { S: 0, W: 1, E: 2, N: 3 } };
  manifest.keyRamps = Object.fromEntries(Object.entries(KEY_RAMPS).map(([k, v]) => [k, [...v]]));
}

// ------------------------------------------------------------------ manifest
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
const size = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).reduce((n, e) => n + fs.statSync(path.join(e.parentPath, e.name)).size, 0);
console.log(`[pixel] wrote ${rel(OUT)}: ${Object.keys(sprites).length} sprites, ${manifest.terrain.count} terrain tiles, ${Object.keys(manifest.chars).length} char layers, ${(size(OUT) / 1024).toFixed(0)} KB total`);
