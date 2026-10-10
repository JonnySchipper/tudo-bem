import { describe, expect, it } from 'vitest';
import { POUR, practiceShift, shiftAct, shiftAdvance, shiftSnapshot, type CEvent } from '@tudobem/shared';
import { COACH_KEY, coachDone, coachMark, practiceNeeded, readCoach } from './correriaPracticeLogic';

/** Play the practice order (a coffee and a pão francês) with the coach marks, the way a brand-new player would: tap what the mark points at. */
function playThrough() {
  const sh = practiceShift(7);
  const seen = new Set<string>();
  const marks: string[] = [];
  const learn = (ev: CEvent[]) => ev.forEach((e) => coachDone(e).forEach((k) => seen.add(k)));
  const now = () => coachMark(shiftSnapshot(sh), seen, false);
  for (let step = 0; step < 10; step++) {
    const m = now();
    if (!m) break;
    marks.push(`${m.key}@${m.target}`);
    if (m.target === 'cr-machine') {
      learn(shiftAct(sh, { a: 'pour_start', item: 'cafe' }));
      // during the pour: the green hint
      const during = coachMark(shiftSnapshot(sh), seen, true);
      marks.push(`${during?.key}@${during?.target}`);
      shiftAdvance(sh, POUR.fullMs * 0.85);
      learn(shiftAct(sh, { a: 'pour_end' }));
    } else if (m.target.startsWith('cr-item-')) learn(shiftAct(sh, { a: 'grab', item: m.target.slice(8) }));
    else if (m.target === 'cr-serve') learn(shiftAct(sh, { a: 'serve' }));
  }
  return { sh, seen, marks };
}

describe('the coach marks (teach by doing)', () => {
  it('a brand-new player gets one short hint per new action, in order, and the practice ends served', () => {
    const { sh, seen, marks } = playThrough();
    expect(marks).toEqual(['cafe@cr-machine', 'agora@cr-machine', 'item:pao@cr-item-pao', 'serve@cr-serve']);
    expect(sh.stats.served).toBe(1);
    expect(sh.stats.perfect).toBe(1);
    expect([...seen].sort()).toEqual(['agora', 'cafe', 'item:pao', 'serve']);
  });

  it('every hint is short (one line on a phone)', () => {
    const { marks } = playThrough();
    expect(marks.length).toBeGreaterThan(0);
    const sh = practiceShift(3);
    const m = coachMark(shiftSnapshot(sh), new Set(), false)!;
    expect(m.pt.split(/\s+/).length).toBeLessThanOrEqual(8);
  });

  it('once learnt, a hint never comes back (the next customer gets none for the same actions)', () => {
    const sh = practiceShift(9);
    const seen = new Set(['cafe', 'agora', 'item:pao', 'serve']);
    expect(coachMark(shiftSnapshot(sh), seen, false)).toBeNull();
    expect(coachMark(shiftSnapshot(sh), seen, true)).toBeNull();
  });

  it('an extra-quente order points at the red, at the machine, until a hot pour lands', () => {
    const snap = shiftSnapshot(practiceShift(5));
    const f = snap.customers[0]!;
    f.hot = true;
    f.want = { items: ['cafe'], mods: ['bem_quente'] };
    const seen = new Set(['cafe', 'agora']);
    expect(coachMark(snap, seen, false)).toMatchObject({ key: 'hot', target: 'cr-machine' });
    expect(coachMark(snap, seen, true)?.pt).toMatch(/vermelho/);
    expect(coachDone({ k: 'pour_ok', item: 'cafe', fill: 1.2, hot: true })).toContain('hot');
    expect(coachDone({ k: 'pour_ok', item: 'cafe', fill: 0.9, hot: false })).not.toContain('hot');
  });

  it('a listening order first points at the replay button', () => {
    const snap = shiftSnapshot(practiceShift(5));
    snap.customers[0]!.mode = 'listening';
    snap.customers[0]!.want = null;
    expect(coachMark(snap, new Set(), false)).toMatchObject({ key: 'listen', target: 'cr-replay' });
  });

  it('the learnt list survives a bad save', () => {
    expect(COACH_KEY).toMatch(/^tb_cr_coach/);
    expect([...readCoach('["cafe","serve"]')]).toEqual(['cafe', 'serve']);
    expect(readCoach('nope').size).toBe(0);
    expect(readCoach(null).size).toBe(0);
    expect(readCoach('{"a":1}').size).toBe(0);
  });

  it('the practice opens once: before the first shift, never after one', () => {
    expect(practiceNeeded(null, false)).toBe(true);
    expect(practiceNeeded('1', false)).toBe(false);
    expect(practiceNeeded(null, true)).toBe(false);
  });
});
