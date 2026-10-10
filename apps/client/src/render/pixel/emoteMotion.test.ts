import { describe, expect, it } from 'vitest';
import { danceSway, emoteNod, emotePlaysSheet, LIMB_EMOTES, NOD_S, nodDip } from './emoteMotion';

describe('emote sheet playback', () => {
  it('does not play the sheet frames that paint an extra arm', () => {
    expect([...LIMB_EMOTES]).toEqual(['oi', 'valeu', 'dancar']);
    for (const kind of LIMB_EMOTES) expect(emotePlaysSheet(kind), kind).toBe(false);
    // rir and desculpa stay on the sheet (see EMOTE_ANIMS in charsheet.ts)
    expect(emotePlaysSheet('rir')).toBe(true);
    expect(emotePlaysSheet('desculpa')).toBe(true);
  });

  it('sways Dançar gently from side to side and holds every other emote still', () => {
    const dur = 2.25;
    expect(danceSway('dancar', 0, dur)).toBe(0);
    expect(danceSway('dancar', 0.35, dur)).toBe(2);
    expect(danceSway('dancar', 1.05, dur)).toBe(-2);
    expect(danceSway('dancar', dur, dur)).toBe(0);
    expect(danceSway('dancar', -0.1, dur)).toBe(0);
    expect(danceSway('oi', 0.35, dur)).toBe(0);
    expect(danceSway('valeu', 0.35, dur)).toBe(0);
    expect(danceSway('rir', 0.35, dur)).toBe(0);
    expect(danceSway('dancar', 0.35, dur, true)).toBe(0);
    expect(Math.abs(danceSway('dancar', 0.1, dur))).toBeLessThanOrEqual(2);
  });
});

describe('the nod that replaced the wave', () => {
  it('dips one pixel twice, then stands still', () => {
    expect(nodDip(0)).toBe(1);
    expect(nodDip(0.2)).toBe(0);
    expect(nodDip(0.35)).toBe(1);
    expect(nodDip(0.5)).toBe(0);
    expect(nodDip(NOD_S)).toBe(0);
    expect(nodDip(-0.1)).toBe(0);
    expect(nodDip(0, true)).toBe(0);
  });

  it('nods for Oi and for nothing else', () => {
    expect(emoteNod('oi', 0)).toBe(1);
    for (const k of ['valeu', 'dancar', 'rir', 'desculpa']) expect(emoteNod(k, 0), k).toBe(0);
  });
});
