import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADJACENT_POSITIONS, BELT_COLORS, HAIR_COLORS, SKIN_TONES } from '@tudobem/shared';
import { BELT_BLACK, FRAMES, GI_BLUE, GI_WHITE, PAIR_POSITIONS, PAIR_SIZE, PLACAR_CELLS, REF_SIGNALS, REF_SIZE, allArtKeys, directedSteps, pairFrames, pairTable, presentFrames, refTable, topSide, transFrames, colorsSig, type PairColors } from './bjjArt';
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

  it('counts: 7 positions x 4, 14 directed steps x 4, the extras and seven referee signals', () => {
    expect(allArtKeys()).toHaveLength(7 * 4 + 14 * 4 + 4 + 3 + 4 + 2 + 7 + 1);
    expect(PAIR_POSITIONS).toHaveLength(7);
    expect(REF_SIGNALS).toHaveLength(7);
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

  it('the scoreboard cells sit inside the 48x44 prop', () => {
    for (const [x, y, w, h] of Object.values(PLACAR_CELLS)) {
      expect(x + w).toBeLessThanOrEqual(48);
      expect(y + h).toBeLessThanOrEqual(44);
    }
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

  it('Bia swaps on the standard skin and hair ramps; texture signatures differ per palette', () => {
    const t = refTable({ skin: SKIN_TONES[4]!, hair: HAIR_COLORS[0]! });
    expect(t.size).toBe(8);
    expect(colorsSig(colors('you'))).not.toBe(colorsSig(colors('partner')));
    expect(colorsSig(colors('you', 'azul'))).not.toBe(colorsSig(colors('you', 'branca')));
  });
});
