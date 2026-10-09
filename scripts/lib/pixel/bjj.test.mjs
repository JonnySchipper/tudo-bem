import { describe, expect, it } from 'vitest';
import { bjjFrames, bjjMatchFrames, placar, CLIP_CANVAS } from '../../../apps/client/assets-src/custom/bjj.mjs';
import { GI_PALETTE } from '../../../apps/client/assets-src/custom/bjj-rig.mjs';
import { POSITION_IDS } from '../../../apps/client/assets-src/custom/bjj-poses.mjs';
import { TRANSITIONS } from '../../../apps/client/assets-src/custom/bjj-anim.mjs';
import { KEY_RAMPS, rgbToHex } from '../../../apps/client/src/render/pixel/palette.ts';
import { allHairKeys } from '../../../apps/client/src/render/pixel/bjjKeys.ts';
import { CLIPS, CLIP_FRAMES, clipKey, standKey } from '../../../apps/client/src/render/pixel/bjjClips.ts';

const frames = bjjFrames();
const byKey = new Map(frames.map((f) => [f.key, f]));
const match = bjjMatchFrames();
const matchByKey = new Map(match.map((f) => [f.key, f]));
const colorsOf = (img) => {
  const s = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    expect(img.data[i + 3]).toBe(255); // pixel art: no half-transparent pixels
    s.add(rgbToHex(img.data[i], img.data[i + 1], img.data[i + 2]));
  }
  return s;
};
const set = (...ramps) => new Set(ramps.flatMap((r) => KEY_RAMPS[r]));
const PAIR_KEYS = new Set([...GI_PALETTE, ...set('skin', 'hair', 'skin2', 'hair2', 'belt'), ...allHairKeys()]);

/** Opaque pixels relative to the anchor (mirrored: as the stage flips a frame about its anchor). */
function maskOf(f, mirrored = false) {
  const m = new Set();
  for (let y = 0; y < f.img.h; y++) for (let x = 0; x < f.img.w; x++) {
    if (!f.img.data[(y * f.img.w + x) * 4 + 3]) continue;
    const dx = x - f.anchor[0];
    m.add(`${mirrored ? -dx - 1 : dx},${y - f.anchor[1]}`);
  }
  return m;
}
const overlap = (a, b) => {
  let same = 0;
  for (const k of a) if (b.has(k)) same++;
  return same / Math.max(a.size, b.size);
};

describe('bjj key contract', () => {
  it('has every key with the contracted frame counts', () => {
    for (const p of POSITION_IDS) for (let k = 0; k < 4; k++) expect(byKey.has(`bjj/pair_${p}_${k}`), p).toBe(true);
    expect(TRANSITIONS).toHaveLength(16);
    for (const [a, b] of TRANSITIONS) for (let k = 0; k < 4; k++) expect(byKey.has(`bjj/trans_${a}__${b}_${k}`), `${a}>${b}`).toBe(true);
    for (const [n, c] of [['finish_tap', 4], ['win_raise', 3], ['fistbump', 4], ['face_off', 2]]) for (let k = 0; k < c; k++) expect(byKey.has(`bjj/${n}_${k}`), n).toBe(true);
    for (const s of ['combate', 'pontos2', 'pontos3', 'pontos4', 'vantagem', 'parar', 'vitoria', 'espera']) expect(byKey.has(`bjj/ref_${s}`), s).toBe(true);
    expect(frames).toHaveLength(7 * 4 + 16 * 4 + 4 + 3 + 4 + 2 + 8);
  });

  it('pair frames fit 64x48 and anchor at the bottom centre; refs are 16x32', () => {
    for (const f of frames) {
      if (f.key.includes('/ref_')) {
        expect([f.img.w, f.img.h]).toEqual([16, 32]);
      } else {
        expect(f.img.w).toBeLessThanOrEqual(64);
        expect(f.img.h).toBeLessThanOrEqual(48);
        expect(f.anchor).toEqual([f.img.w / 2, f.img.h]);
      }
    }
  });

  it('only uses key-ramp colors (skin, hair, skin2, hair2, belt, the optional hair pieces) plus the gi / outline / fx palette, so the runtime swap reaches everything', () => {
    for (const f of [...frames, ...match]) for (const c of colorsOf(f.img)) expect(PAIR_KEYS.has(c), `${f.key} ${c}`).toBe(true);
  });

  it('fighter A uses skin / hair / belt keys and fighter B the skin2 / hair2 keys in every pair frame', () => {
    for (const f of frames) {
      if (f.key.includes('/ref_') || f.key.includes('/win_') ) continue;
      const cols = colorsOf(f.img);
      const has = (ramp) => KEY_RAMPS[ramp].some((c) => cols.has(c));
      expect(has('skin'), `${f.key} skin`).toBe(true);
      expect(has('skin2'), `${f.key} skin2`).toBe(true);
      if (f.key.startsWith('bjj/pair_')) expect(has('hair2'), `${f.key} hair2`).toBe(true);
    }
  });

  it('the key ramps and the hair piece keys are distinct from every other colour', () => {
    const all = [...Object.values(KEY_RAMPS).flat(), ...allHairKeys(), ...GI_PALETTE];
    expect(new Set(all).size).toBe(all.length);
    expect(KEY_RAMPS.belt).toHaveLength(3);
  });

  it('referee frames use only skin / hair keys and the gi palette', () => {
    const allowed = new Set([...GI_PALETTE, ...set('skin', 'hair')]);
    for (const f of frames.filter((x) => x.key.includes('/ref_'))) for (const c of colorsOf(f.img)) expect(allowed.has(c), `${f.key} ${c}`).toBe(true);
  });

  it('the scoreboard prop is narrow enough to stand between the mat and the wall', () => {
    const { img, anchor } = placar();
    expect([img.w, img.h]).toEqual([30, 34]);
    expect(anchor).toEqual([15, 33]);
  });
});

describe('bjj match frames (the standing grip loops and the move clips)', () => {
  it('every standing grip pair and every clip, hit and miss, has all its frames', () => {
    for (const a of ['n', 'c', 's', 'b']) for (const b of ['n', 'c', 's', 'b']) for (let i = 0; i < 4; i++) expect(matchByKey.has(standKey(a, b, i)), `${a}${b}${i}`).toBe(true);
    for (const c of CLIPS) for (const hit of [true, false]) for (let i = 0; i < CLIP_FRAMES; i++) expect(matchByKey.has(clipKey(c.move, c.from, hit, i)), `${c.move}@${c.from}`).toBe(true);
    expect(match).toHaveLength(16 * 4 + CLIPS.length * 2 * CLIP_FRAMES);
  });

  it('clip frames are trimmed inside the clip canvas, anchored on the pair anchor; both fighters are on screen', () => {
    for (const f of match) {
      expect(f.img.w).toBeLessThanOrEqual(CLIP_CANVAS.w);
      expect(f.img.h).toBeLessThanOrEqual(CLIP_CANVAS.h);
      const cols = colorsOf(f.img);
      expect(KEY_RAMPS.skin.some((c) => cols.has(c)), `${f.key} A`).toBe(true);
      expect(KEY_RAMPS.skin2.some((c) => cols.has(c)), `${f.key} B`).toBe(true);
    }
  });

  it('seamless: a clip starts on the idle frame it leaves and a landed clip ends on the idle frame it lands in', () => {
    const idle = (pos) => (pos === 'de_pe' ? null : byKey.get(`bjj/pair_${pos}_0`));
    for (const c of CLIPS) {
      for (const hit of [true, false]) {
        const first = matchByKey.get(clipKey(c.move, c.from, hit, 0));
        const last = matchByKey.get(clipKey(c.move, c.from, hit, CLIP_FRAMES - 1));
        const from = idle(c.from);
        if (from) expect(overlap(maskOf(first), maskOf(from)), `${c.move}@${c.from} start`).toBeGreaterThan(0.95);
        if (hit && c.family === 'sub') continue; // a finish ends on the tap
        const to = hit ? (c.to ?? c.from) : (c.missTo ?? c.from);
        const end = idle(to);
        const mirrored = hit ? !!c.mirror : !!c.missTo;
        if (end) expect(overlap(maskOf(last), maskOf(end, mirrored)), `${c.move}@${c.from} ${hit ? 'hit' : 'miss'} end`).toBeGreaterThan(0.95);
      }
    }
  });
});
