import { describe, expect, it } from 'vitest';
import { JUICE, practiceShift, shiftAct, shiftAdvance, shiftSnapshot, POUR, type CAct, type CEvent } from '@tudobem/shared';
import { PRACTICE_STEPS, practiceAfter, practiceAllows, practiceNeeded, practicePaid, practiceRetry, practiceTargets, type PracticeStepId } from './correriaPracticeLogic';

describe('the first-time practice order', () => {
  it('six steps in teaching order: read, coffee, pão francês, juicer, serve, paid', () => {
    expect(PRACTICE_STEPS.map((s) => s.id)).toEqual(['read', 'cafe', 'pao', 'suco', 'serve', 'paid']);
    for (const s of PRACTICE_STEPS.filter((x) => x.id !== 'paid')) expect(s.body.pt && s.body.en).toBeTruthy();
  });

  it('each step lets only its own taps through', () => {
    const acts: CAct[] = [{ a: 'grab', item: 'pao' }, { a: 'pour_start', item: 'cafe' }, { a: 'pour_end' }, { a: 'juice_drop' }, { a: 'juice_take' }, { a: 'serve' }, { a: 'clear' }];
    const ok = (step: PracticeStepId) => acts.filter((a) => practiceAllows(step, a)).map((a) => a.a);
    expect(ok('read')).toEqual([]);
    expect(ok('cafe')).toEqual(['pour_start', 'pour_end']);
    expect(ok('pao')).toEqual(['grab']);
    expect(ok('suco')).toEqual(['juice_drop', 'juice_take']);
    expect(ok('serve')).toEqual(['serve']);
    expect(ok('paid')).toEqual([]);
    expect(practiceAllows('pao', { a: 'grab', item: 'agua' })).toBe(false);
  });

  it('walks the whole practice shift through the real rules and never loses the customer', () => {
    const sh = practiceShift(150);
    let step: PracticeStepId = 'cafe';
    const run = (a: CAct): CEvent[] => {
      expect(practiceAllows(step, a)).toBe(true);
      const ev = shiftAct(sh, a);
      step = practiceAfter(step, ev);
      return ev;
    };
    // a pour stopped too early is a retry, not a step forward
    run({ a: 'pour_start', item: 'cafe' });
    shiftAdvance(sh, 300);
    expect(practiceRetry(run({ a: 'pour_end' }))?.en).toMatch(/early/);
    expect(step).toBe('cafe');
    run({ a: 'pour_start', item: 'cafe' });
    shiftAdvance(sh, POUR.fullMs * 0.85);
    run({ a: 'pour_end' });
    expect(step).toBe('pao');
    run({ a: 'grab', item: 'pao' });
    expect(step).toBe('suco');
    expect(practiceTargets(step, shiftSnapshot(sh))).toEqual(['cr-juicer']);
    while ((sh.juice?.fill ?? 0) < JUICE.goodMin) {
      run({ a: 'juice_drop' });
      shiftAdvance(sh, JUICE.cycleMs);
    }
    expect(practiceTargets(step, shiftSnapshot(sh))).toEqual(['cr-juice-glass']);
    run({ a: 'juice_take' });
    expect(step).toBe('serve');
    const ev = run({ a: 'serve' });
    expect(step).toBe('paid');
    const served = ev.find((e) => e.k === 'serve');
    expect(served && served.k === 'serve' && served.outcome).toBe('perfeito');
    expect(sh.stats.left).toBe(0);
  });

  it('the pay line names the order total and says practice pays no RV', () => {
    const line = practicePaid(2, 17);
    expect(line.pt).toContain('R$');
    expect(line.en).toMatch(/\+17 points/);
    expect(line.en).toMatch(/no RV/);
  });

  it('shows once: not after it was done or skipped, nor for a player who already played a shift', () => {
    expect(practiceNeeded(null, false)).toBe(true);
    expect(practiceNeeded('1', false)).toBe(false);
    expect(practiceNeeded(null, true)).toBe(false);
  });
});
