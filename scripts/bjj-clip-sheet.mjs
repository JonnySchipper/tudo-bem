#!/usr/bin/env node
/**
 * Contact sheets of the jiu-jitsu fighter art (#166), straight from the generators, with the real runtime swap:
 *
 *   node scripts/bjj-clip-sheet.mjs [outDir] [scale]       # default docs/lifesim/shots/jiu-jitsu-art, 4
 *
 *  - partners.png: each sparring partner facing the player (white gi, blue belt), standing with grips held and in a ground pose, so
 *    their own gi colour, skin, hair style and beard can be checked side by side;
 *  - clips_standing.png, clips_ground.png: every move clip landed (8 frames a row, frame 4 the big one, 5 the landing), player in white
 *    moving against Mateus.
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

register('./lib/ts-resolve.mjs', import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { bjjFrames, bjjMatchFrames } = await import('../apps/client/assets-src/custom/bjj.mjs');
const { CLIPS, CLIP_FRAMES, clipKey, standKey } = await import('../apps/client/src/render/pixel/bjjClips.ts');
const { applySwap, mergeSwaps, slotSwap, GI_WHITE, GI_BLUE } = await import('../apps/client/src/render/pixel/bjjSwap.ts');
const { buildRamp } = await import('../apps/client/src/render/pixel/palette.ts');
const { cpuLook } = await import('../packages/shared/src/looks.ts');
const { SKIN_TONES, HAIR_COLORS } = await import('../packages/shared/src/constants.ts');
// academia.ts pulls in the curriculum JSON: the partner list and the blue belt are read from its source
const acad = fs.readFileSync(path.join(ROOT, 'packages/shared/src/academia.ts'), 'utf8');
const PARTNERS = [...acad.matchAll(/id: '(\w+)',\s*name: '(\w+)'/g)].map((m) => ({ id: m[1], name: m[2] }));
const BELT_COLORS = { azul: /azul: '(#[0-9a-f]{6})'/i.exec(acad)[1] };

const out = path.resolve(ROOT, process.argv[2] ?? 'docs/lifesim/shots/jiu-jitsu-art');
const S = Number(process.argv[3] ?? 4);
fs.mkdirSync(out, { recursive: true });

// the partner gi colours, from the runtime table (bjjArt.ts imports @tudobem/shared, so read the literal table from its source)
const artSrc = fs.readFileSync(path.join(ROOT, 'apps/client/src/render/pixel/bjjArt.ts'), 'utf8');
const giOf = (id) => {
  const m = new RegExp(`\\b${id}: (\\[[^\\]]+\\])`).exec(artSrc);
  return m ? JSON.parse(m[1].replaceAll("'", '"')) : null;
};
const belt = buildRamp(BELT_COLORS.azul, 3);
const PLAYER = { skin: SKIN_TONES[2], hair: HAIR_COLORS[1], style: 'curto', gi: GI_WHITE, belt };
const look = (name, id) => {
  const a = cpuLook(name).appearance;
  // Mateus wears the baked blue (GI_BLUE_RAMP in the table)
  return { skin: SKIN_TONES[a.skin], hair: HAIR_COLORS[a.hairColor], style: a.hair, beard: a.extra === 'barba', gi: giOf(id) ?? [...GI_BLUE], belt };
};

const all = new Map([...bjjFrames(), ...bjjMatchFrames()].map((f) => [f.key, f]));
const CW = 82, CH = 58;

async function sheet(file, rows) {
  const cols = Math.max(...rows.map((r) => r.frames.length));
  const W = cols * CW * S, H = rows.length * CH * S;
  const raw = Buffer.alloc(W * H * 4);
  for (let i = 0; i < raw.length; i += 4) raw.set([74, 132, 82, 255], i);
  rows.forEach((row, r) =>
    row.frames.forEach(({ key, flip, swap }, c) => {
      const f = all.get(key);
      if (!f) throw new Error(`missing ${key}`);
      const d = new Uint8Array(f.img.data);
      applySwap(d, swap);
      for (let y = 0; y < f.img.h; y++)
        for (let x = 0; x < f.img.w; x++) {
          const i = (y * f.img.w + x) * 4;
          if (!d[i + 3]) continue;
          const dx = flip ? f.anchor[0] - x - 1 : x - f.anchor[0];
          for (let yy = 0; yy < S; yy++)
            for (let xx = 0; xx < S; xx++) {
              const X = (c * CW + 41 + dx) * S + xx, Y = (r * CH + 56 - f.anchor[1] + y) * S + yy;
              if (X >= 0 && Y >= 0 && X < W && Y < H) raw.set([d[i], d[i + 1], d[i + 2], 255], (Y * W + X) * 4);
            }
        }
      for (let x = 0; x < CW * S; x += 3) raw.set([60, 110, 70, 255], ((r * CH * S) * W + c * CW * S + x) * 4);
    }),
  );
  await sharp(raw, { raw: { width: W, height: H, channels: 4 } }).png().toFile(path.join(out, file));
  console.log(path.relative(ROOT, path.join(out, file)), `${rows.length} rows`);
}

// partners: you (A, white) and the partner (B) standing with grips, then in side control both ways
const partnerRows = PARTNERS.map((p) => {
  const them = look(p.name, p.id);
  const youTop = mergeSwaps(slotSwap('A', PLAYER), slotSwap('B', them));
  const themTop = mergeSwaps(slotSwap('A', them), slotSwap('B', PLAYER));
  return {
    frames: [
      { key: standKey('n', 'n', 0), swap: youTop },
      { key: standKey('c', 's', 1), swap: youTop },
      { key: standKey('b', 'c', 2), swap: youTop },
      { key: 'bjj/pair_guarda_fechada_0', swap: themTop },
      { key: 'bjj/pair_cem_quilos_0', swap: youTop },
      { key: 'bjj/pair_montada_1', swap: themTop },
      { key: 'bjj/pair_costas_0', swap: youTop },
    ],
  };
});
await sheet('partners.png', partnerRows);

const mateus = look('Mateus', 'mateus');
const youMove = mergeSwaps(slotSwap('A', PLAYER), slotSwap('B', mateus));
const clipRows = (filter) => CLIPS.filter(filter).map((c) => ({ frames: Array.from({ length: CLIP_FRAMES }, (_, i) => ({ key: clipKey(c.move, c.from, true, i), swap: youMove })) }));
await sheet('clips_standing.png', clipRows((c) => c.from === 'de_pe'));
await sheet('clips_ground.png', clipRows((c) => c.from !== 'de_pe'));
