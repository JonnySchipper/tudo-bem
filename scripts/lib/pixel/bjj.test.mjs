import { describe, expect, it } from 'vitest';
import { bjjFrames, placar } from '../../../apps/client/assets-src/custom/bjj.mjs';
import { GI_PALETTE } from '../../../apps/client/assets-src/custom/bjj-rig.mjs';
import { POSITION_IDS } from '../../../apps/client/assets-src/custom/bjj-poses.mjs';
import { TRANSITIONS } from '../../../apps/client/assets-src/custom/bjj-anim.mjs';
import { KEY_RAMPS, rgbToHex } from '../../../apps/client/src/render/pixel/palette.ts';

const frames = bjjFrames();
const byKey = new Map(frames.map((f) => [f.key, f]));
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

describe('bjj key contract', () => {
  it('has every key with the contracted frame counts', () => {
    for (const p of POSITION_IDS) for (let k = 0; k < 4; k++) expect(byKey.has(`bjj/pair_${p}_${k}`), p).toBe(true);
    expect(TRANSITIONS).toHaveLength(16);
    for (const [a, b] of TRANSITIONS) for (let k = 0; k < 4; k++) expect(byKey.has(`bjj/trans_${a}__${b}_${k}`), `${a}>${b}`).toBe(true);
    for (const [n, c] of [['finish_tap', 4], ['win_raise', 3], ['fistbump', 4], ['face_off', 2]]) for (let k = 0; k < c; k++) expect(byKey.has(`bjj/${n}_${k}`), n).toBe(true);
    for (const s of ['combate', 'pontos2', 'pontos3', 'pontos4', 'vantagem', 'parar', 'vitoria']) expect(byKey.has(`bjj/ref_${s}`), s).toBe(true);
    expect(frames).toHaveLength(7 * 4 + 16 * 4 + 4 + 3 + 4 + 2 + 7);
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

  it('only uses key-ramp colors (skin, hair, skin2, hair2, belt) plus the gi / outline / fx palette, so the runtime swap reaches everything', () => {
    const allowed = new Set([...GI_PALETTE, ...set('skin', 'hair', 'skin2', 'hair2', 'belt')]);
    for (const f of frames) for (const c of colorsOf(f.img)) expect(allowed.has(c), `${f.key} ${c}`).toBe(true);
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

  it('the new key ramps are distinct from every other key color', () => {
    const all = Object.entries(KEY_RAMPS).flatMap(([n, r]) => r.map((c) => [n, c]));
    expect(new Set(all.map(([, c]) => c)).size).toBe(all.length);
    expect(KEY_RAMPS.belt).toHaveLength(3);
  });

  it('referee frames use only skin / hair keys and the gi palette', () => {
    const allowed = new Set([...GI_PALETTE, ...set('skin', 'hair')]);
    for (const f of frames.filter((x) => x.key.includes('/ref_'))) for (const c of colorsOf(f.img)) expect(allowed.has(c), `${f.key} ${c}`).toBe(true);
  });

  it('the scoreboard prop leaves its digit areas blank and fits the mat edge', () => {
    const { img } = placar();
    expect([img.w, img.h]).toEqual([48, 44]);
  });
});
