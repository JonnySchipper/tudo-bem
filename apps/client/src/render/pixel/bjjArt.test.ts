import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADJACENT_POSITIONS, BELT_COLORS, HAIR_COLORS, SKIN_TONES } from '@tudobem/shared';
import { BELT_BLACK, FRAMES, GI_BLUE, GI_WHITE, MATCH_ATLAS, PAIR_POSITIONS, PAIR_SIZE, PARTNER_GI, PLACAR_CELLS, PLACAR_SIZE, REF_SIGNALS, REF_SIZE, allArtKeys, directedSteps, matchArtKeys, pairFrames, pairSwap, pairTable, partnerGi, presentFrames, refTable, topSide, transFrames, colorsSig, type PairColors } from './bjjArt';
import { CLIPS, CLIP_FRAMES } from './bjjClips';
import { HAIR_KEYS } from './bjjKeys';
import { applySwap } from './bjjSwap';
import { KEY_RAMPS, buildRamp, hexToRgb, pack, swapKeys } from './palette';
// the art side of the contract: the puppet renderer's exact colours, read from its source
const rig = fs.readFileSync(path.resolve(import.meta.dirname, '../../../assets-src/custom/bjj-rig.mjs'), 'utf8');
const rigRamp = (name: string): string[] => {
  const m = new RegExp(`export const ${name} = \\[([^\\]]+)\\]`).exec(rig);
  return m ? [...m[1]!.matchAll(/'(#[0-9a-fA-F]{6})'/g)].map((x) => x[1]!) : [];
};
const RIG_WHITE = rigRamp('GI_WHITE');
const RIG_BLUE = rigRamp('GI_BLUE');
const RIG_BELT = rigRamp('BELT_BLACK');

const manifest = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../public/pixel/manifest.json'), 'utf8'));

describe('the bjj art contract', () => {
  it('every key the game asks for is in the manifest, at the contracted size and anchor', () => {
    const missing = allArtKeys().filter((k) => !manifest.sprites[k]);
    expect(missing).toEqual([]);
    for (const k of allArtKeys()) {
      const d = manifest.sprites[k];
      if (k.startsWith('bjj/ref_')) expect([d.w, d.h, d.ax, d.ay], k).toEqual([REF_SIZE.w, REF_SIZE.h, REF_SIZE.ax, REF_SIZE.ay]);
      else if (k.startsWith('bjj/')) {
        expect([d.w, d.h], k).toEqual([PAIR_SIZE.w, PAIR_SIZE.h]);
        expect([d.ax, d.ay], k).toEqual([PAIR_SIZE.ax, PAIR_SIZE.ay]);
      }
    }
  });

  it('counts: 7 positions x 4, 14 directed steps x 4, the extras and eight referee frames', () => {
    expect(allArtKeys()).toHaveLength(7 * 4 + 14 * 4 + 4 + 3 + 4 + 2 + 8 + 1);
    expect(PAIR_POSITIONS).toHaveLength(7);
    expect(REF_SIGNALS).toHaveLength(8);
    expect(FRAMES).toEqual({ pair: 4, trans: 4, finishTap: 4, winRaise: 3, fistbump: 4, faceOff: 2 });
  });

  it('the ladder steps the rules can take all have transition art, both directions', () => {
    const have = (a: string, b: string) => directedSteps().some(([x, y]) => x === a && y === b);
    for (const [a, b] of ADJACENT_POSITIONS) {
      expect(have(a, b), `${a}>${b}`).toBe(true);
      expect(have(b, a), `${b}>${a}`).toBe(true);
      expect(transFrames(a, b)).toHaveLength(4);
    }
    expect(transFrames('de_pe', 'montada')).toBeNull();
    expect(pairFrames('costas')).toEqual(['bjj/pair_costas_0', 'bjj/pair_costas_1', 'bjj/pair_costas_2', 'bjj/pair_costas_3']);
  });

  it('a half-delivered family still plays: absent frames are skipped', () => {
    expect(presentFrames((k) => k !== 'b', ['a', 'b', 'c'])).toEqual(['a', 'c']);
    expect(presentFrames(() => false, ['a'])).toEqual([]);
  });

  it('the scoreboard cells sit inside the prop, and the prop is the size the manifest has', () => {
    for (const [x, y, w, h] of Object.values(PLACAR_CELLS)) {
      expect(x + w).toBeLessThanOrEqual(PLACAR_SIZE.w);
      expect(y + h).toBeLessThanOrEqual(PLACAR_SIZE.h);
    }
    const d = manifest.sprites['props/placar'];
    expect([d.w, d.h, d.ax, d.ay]).toEqual([PLACAR_SIZE.w, PLACAR_SIZE.h, PLACAR_SIZE.ax, PLACAR_SIZE.ay]);
  });

  it('the match frames are all in the lazy match atlas', () => {
    expect(manifest.atlases[MATCH_ATLAS]?.lazy).toBe(true);
    const keys = matchArtKeys();
    expect(keys).toHaveLength(16 * 4 + CLIPS.length * 2 * CLIP_FRAMES);
    expect(keys.filter((k) => manifest.sprites[k]?.atlas !== MATCH_ATLAS)).toEqual([]);
    // the idle and transition frames stay in the world atlas (the mat shows them before the match atlas is in)
    expect(allArtKeys().filter((k) => manifest.sprites[k]?.atlas !== 'outdoor')).toEqual([]);
  });

  it('who is on top follows the bigger rung', () => {
    expect(topSide(0, 1)).toBe('you');
    expect(topSide(1, 0)).toBe('you');
    expect(topSide(0, -1)).toBe('partner');
    expect(topSide(-2, -1)).toBe('partner');
    expect(topSide(0, 0)).toBeNull();
  });
});

describe('palette swaps: the player is always the white gi, the partner always the blue', () => {
  const colors = (top: PairColors['top'], belt: PairColors['belt'] = 'azul'): PairColors => ({
    you: { skin: SKIN_TONES[1]!, hair: HAIR_COLORS[3]! },
    partner: { skin: SKIN_TONES[6]!, hair: HAIR_COLORS[0]! },
    belt,
    top,
  });
  const run = (c: PairColors, from: readonly string[]) => {
    const t = pairTable(c);
    const buf = new Uint8ClampedArray(from.length * 4);
    from.forEach((hex, i) => {
      const [r, g, b] = hexToRgb(hex);
      buf.set([r, g, b, 255], i * 4);
    });
    swapKeys(buf, t);
    return Array.from({ length: from.length }, (_, i) => pack(buf[i * 4]!, buf[i * 4 + 1]!, buf[i * 4 + 2]!));
  };
  const packed = (hexes: readonly string[]) => hexes.map((h) => pack(...hexToRgb(h)));

  it('the art side of the contract: the same exact colours as the puppet renderer', () => {
    expect([...GI_WHITE]).toEqual(RIG_WHITE);
    expect([...GI_BLUE]).toEqual(RIG_BLUE);
    expect([...BELT_BLACK]).toEqual(RIG_BELT);
  });

  it('player on top: A keeps the white gi with your skin, hair and belt; B is the partner in blue with the black belt', () => {
    const c = colors('you');
    expect(run(c, KEY_RAMPS.skin)).toEqual(packed(buildRamp(c.you.skin, 4)));
    expect(run(c, KEY_RAMPS.hair)).toEqual(packed(buildRamp(c.you.hair, 4)));
    expect(run(c, KEY_RAMPS.skin2)).toEqual(packed(buildRamp(c.partner.skin, 4)));
    expect(run(c, KEY_RAMPS.hair2)).toEqual(packed(buildRamp(c.partner.hair, 4)));
    expect(run(c, KEY_RAMPS.belt)).toEqual(packed(buildRamp(BELT_COLORS.azul, 3)));
    // the fabric is left as drawn
    expect(run(c, GI_WHITE)).toEqual(packed(GI_WHITE));
    expect(run(c, GI_BLUE)).toEqual(packed(GI_BLUE));
    expect(run(c, BELT_BLACK)).toEqual(packed(BELT_BLACK));
  });

  it('partner on top: the slots are exchanged, so you still wear white and the partner still wears blue', () => {
    const c = colors('partner', 'branca');
    // art A (top) is the partner now: its skin and hair ramps get the partner's colours, its white gi turns blue, its belt black
    expect(run(c, KEY_RAMPS.skin)).toEqual(packed(buildRamp(c.partner.skin, 4)));
    expect(run(c, KEY_RAMPS.hair)).toEqual(packed(buildRamp(c.partner.hair, 4)));
    expect(run(c, GI_WHITE)).toEqual(packed(GI_BLUE));
    expect(run(c, KEY_RAMPS.belt)).toEqual(packed(BELT_BLACK));
    // art B (under) is you: your skin and hair, the blue gi turns white, the black belt becomes yours
    expect(run(c, KEY_RAMPS.skin2)).toEqual(packed(buildRamp(c.you.skin, 4)));
    expect(run(c, KEY_RAMPS.hair2)).toEqual(packed(buildRamp(c.you.hair, 4)));
    expect(run(c, GI_BLUE)).toEqual(packed(GI_WHITE));
    expect(run(c, BELT_BLACK)).toEqual(packed(buildRamp(BELT_COLORS.branca, 3)));
  });

  it('the partner wears their own belt on the blue gi, on top or under', () => {
    const under: PairColors = { ...colors('you'), partnerBelt: 'roxa' };
    expect(run(under, BELT_BLACK)).toEqual(packed(buildRamp(BELT_COLORS.roxa, 3)));
    expect(run(under, KEY_RAMPS.belt)).toEqual(packed(buildRamp(BELT_COLORS.azul, 3)));
    const over: PairColors = { ...colors('partner', 'branca'), partnerBelt: 'roxa' };
    expect(run(over, KEY_RAMPS.belt)).toEqual(packed(buildRamp(BELT_COLORS.roxa, 3)));
    expect(run(over, BELT_BLACK)).toEqual(packed(buildRamp(BELT_COLORS.branca, 3)));
    expect(colorsSig(under)).not.toBe(colorsSig(colors('you')));
    for (const c of [under, over]) {
      const sources = [...pairTable(c).keys()];
      expect(new Set(sources).size).toBe(sources.length);
    }
  });

  it('a neutral frame (nobody on top) is the player-on-top table', () => {
    expect(run(colors(null), KEY_RAMPS.skin)).toEqual(run(colors('you'), KEY_RAMPS.skin));
  });

  it('no source colour is claimed twice in a table', () => {
    for (const top of ['you', 'partner'] as const) {
      const t = pairTable(colors(top));
      const sources = [...t.keys()];
      expect(new Set(sources).size).toBe(sources.length);
    }
  });

  it('each sparring partner wears their own gi colour, on top or under; the player stays in white', () => {
    const ids = Object.keys(PARTNER_GI);
    expect(ids.sort()).toEqual(['daniel', 'felipe', 'helena', 'mateus', 'rafael']);
    expect(new Set(ids.map((id) => PARTNER_GI[id]![2])).size).toBe(ids.length);
    expect(partnerGi('nobody')).toEqual([...GI_BLUE]);
    const felipe = partnerGi('felipe');
    expect(run({ ...colors('you'), partnerGi: felipe }, GI_BLUE)).toEqual(packed(felipe));
    expect(run({ ...colors('you'), partnerGi: felipe }, GI_WHITE)).toEqual(packed(GI_WHITE));
    expect(run({ ...colors('partner'), partnerGi: felipe }, GI_WHITE)).toEqual(packed(felipe));
    expect(run({ ...colors('partner'), partnerGi: felipe }, GI_BLUE)).toEqual(packed(GI_WHITE));
    expect(colorsSig({ ...colors('you'), partnerGi: felipe })).not.toBe(colorsSig(colors('you')));
  });

  it('hair pieces follow each fighter: curly hair keeps its volume, a bun its knot, a beard shows; the rest turns transparent', () => {
    const c: PairColors = { ...colors('you'), you: { skin: SKIN_TONES[1]!, hair: HAIR_COLORS[3]!, style: 'coque' }, partner: { skin: SKIN_TONES[6]!, hair: HAIR_COLORS[0]!, style: 'cacheado', beard: true } };
    const pix = (s: ReturnType<typeof pairSwap>, hex: string) => {
      const buf = new Uint8ClampedArray([...hexToRgb(hex), 255]);
      applySwap(buf, s);
      return buf[3] === 0 ? null : pack(buf[0]!, buf[1]!, buf[2]!);
    };
    const s = pairSwap(c);
    // you (slot A): the bun shows, the volume is cleared, the seam goes back to the outline, no beard (the skin rank under it)
    expect(pix(s, HAIR_KEYS.A.bun[1])).toBe(pack(...hexToRgb(buildRamp(c.you.hair, 4)[2]!)));
    expect(pix(s, HAIR_KEYS.A.vol[1])).toBeNull();
    expect(pix(s, HAIR_KEYS.A.volSeam)).toBe(pack(...hexToRgb('#3a3a50')));
    expect(pix(s, HAIR_KEYS.A.beard[1])).toBe(pack(...hexToRgb(buildRamp(c.you.skin, 4)[2]!)));
    // the partner (slot B): the volume and the beard show, the bun is cleared
    expect(pix(s, HAIR_KEYS.B.vol[1])).toBe(pack(...hexToRgb(buildRamp(c.partner.hair, 4)[2]!)));
    expect(pix(s, HAIR_KEYS.B.beard[1])).toBe(pack(...hexToRgb(buildRamp(c.partner.hair, 4)[1]!)));
    expect(pix(s, HAIR_KEYS.B.bun[0])).toBeNull();
    // with the partner on top the pieces move with the person, not the slot
    const over = pairSwap({ ...c, top: 'partner' });
    expect(pix(over, HAIR_KEYS.A.vol[1])).toBe(pack(...hexToRgb(buildRamp(c.partner.hair, 4)[2]!)));
    expect(pix(over, HAIR_KEYS.B.bun[1])).toBe(pack(...hexToRgb(buildRamp(c.you.hair, 4)[2]!)));
  });

  it('Bia swaps on the standard skin and hair ramps; texture signatures differ per palette', () => {
    const t = refTable({ skin: SKIN_TONES[4]!, hair: HAIR_COLORS[0]! });
    expect(t.size).toBe(8);
    expect(colorsSig(colors('you'))).not.toBe(colorsSig(colors('partner')));
    expect(colorsSig(colors('you', 'azul'))).not.toBe(colorsSig(colors('you', 'branca')));
  });
});
