import { describe, expect, it } from 'vitest';
import { danceSway, emotePlaysSheet, LIMB_EMOTES } from './emoteMotion';

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
