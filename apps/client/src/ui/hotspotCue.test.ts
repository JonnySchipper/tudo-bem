import { describe, expect, it } from 'vitest';
import { HOTSPOTS, type HotspotDef } from '@tudobem/shared';
import { MAX_CUES, cueTargets } from './hotspotCue';

const sign = (id: string, x: number, y: number, room: HotspotDef['room'] = 'praca'): HotspotDef => ({ id, room, x, y, pt: id, en: id });

describe('👁 cue logic', () => {
  it('shows within 3 tiles of the sign and not at 4', () => {
    const list = [sign('a', 10, 10)];
    expect(cueTargets('praca', { x: 10, y: 13 }, false, list).map((h) => h.id)).toEqual(['a']);
    expect(cueTargets('praca', { x: 13, y: 13 }, false, list).map((h) => h.id)).toEqual(['a']);
    expect(cueTargets('praca', { x: 10, y: 14 }, false, list)).toEqual([]);
    expect(cueTargets('praca', { x: 14, y: 10 }, false, list)).toEqual([]);
  });

  it('measures to the nearest tile of a big sign', () => {
    const list: HotspotDef[] = [{ ...sign('wide', 10, 10), w: 4, h: 2 }];
    expect(cueTargets('praca', { x: 13, y: 12 }, false, list)).toHaveLength(1); // inside the width, 1 below
    expect(cueTargets('praca', { x: 16, y: 11 }, false, list)).toHaveLength(1); // 3 to the right of the last column
    expect(cueTargets('praca', { x: 17, y: 11 }, false, list)).toHaveLength(0);
  });

  it('hides while a dialogue or panel is open, in another room, or with no player yet', () => {
    const list = [sign('a', 10, 10)];
    expect(cueTargets('praca', { x: 10, y: 10 }, true, list)).toEqual([]);
    expect(cueTargets('padaria', { x: 10, y: 10 }, false, list)).toEqual([]);
    expect(cueTargets(null, { x: 10, y: 10 }, false, list)).toEqual([]);
    expect(cueTargets('praca', null, false, list)).toEqual([]);
  });

  it('keeps the nearest few when a corner is crowded', () => {
    const list = Array.from({ length: 8 }, (_, i) => sign(`s${i}`, 10 + i % 4, 10 + Math.floor(i / 4)));
    const t = cueTargets('praca', { x: 10, y: 10 }, false, list);
    expect(t).toHaveLength(MAX_CUES);
    expect(t[0]!.id).toBe('s0');
  });

  it('works with the real map: the padaria menu has a cue next to the counter, none at the door', () => {
    expect(cueTargets('padaria', { x: 8, y: 3 }, false).map((h) => h.id)).toContain('padaria_cardapio');
    expect(cueTargets('padaria', { x: 1, y: 6 }, false).map((h) => h.id)).not.toContain('padaria_cardapio');
    expect(HOTSPOTS.length).toBeGreaterThan(20);
  });
});
