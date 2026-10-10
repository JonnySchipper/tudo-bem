import { describe, expect, it } from 'vitest';
import {
  TAPIOCA_COACH_KEYS,
  readTapiocaCoach,
  tapiocaCoachMark,
  tapiocaPracticeNeeded,
  type TapiocaCoachState,
  type TapiocaPanPhase,
} from './feiraTapiocaPracticeLogic';
import type { TapiocaFilling } from '@tudobem/shared';

type Pan = TapiocaCoachState['pans'][number];
const pan = (phase: TapiocaPanPhase, o: Partial<Pan> = {}): Pan => ({ phase, open: true, botched: false, filling: null, ...o });
const locked = (): Pan => pan('empty', { open: false });
const st = (pans: Pan[], wants: TapiocaFilling[] = ['queijo']): TapiocaCoachState => ({ pans, wants });

describe('Tapioca coach marks', () => {
  it('walks a new player through one tapioca, one mark per action, each pointing at the piece to use', () => {
    const none = new Set<string>();
    const seen = new Set<string>();
    const step = (pans: Pan[], key: string, target: string) => {
      const m = tapiocaCoachMark(st(pans), seen);
      expect(m?.key).toBe(key);
      expect(m?.target).toBe(target);
      seen.add(key);
    };
    step([pan('empty'), locked(), locked()], 'sift', 'tapioca-pan-0');
    step([pan('cooking'), locked(), locked()], 'flip', 'tapioca-pan-0');
    step([pan('flipped'), locked(), locked()], 'fill', 'tapioca-bowl-queijo');
    step([pan('filled', { filling: 'queijo' }), locked(), locked()], 'fold', 'tapioca-pan-0');
    step([pan('folded', { filling: 'queijo' }), locked(), locked()], 'serve', 'tapioca-pan-0');
    step([pan('folded', { filling: 'queijo', botched: true }), locked(), locked()], 'bin', 'tapioca-bin');
    // once learnt, never again
    for (const phase of ['empty', 'cooking', 'flipped', 'filled', 'folded'] as const) {
      expect(tapiocaCoachMark(st([pan(phase, { filling: phase === 'filled' || phase === 'folded' ? 'queijo' : null, botched: true })]), seen)).toBeNull();
    }
    expect([...seen].sort()).toEqual([...TAPIOCA_COACH_KEYS].sort());
    expect(tapiocaCoachMark(st([pan('empty')]), none)?.key).toBe('sift');
  });

  it('is a short English line with the Portuguese word from the stage beside it (the filling the customer asked for)', () => {
    const m = tapiocaCoachMark(st([pan('flipped')], ['goiabada']), new Set())!;
    expect(m.pt).toBe('goiabada');
    expect(m.en).toMatch(/guava paste/);
    for (const phase of ['empty', 'cooking', 'filled', 'folded'] as const) {
      const k = tapiocaCoachMark(st([pan(phase, { filling: 'queijo' })]), new Set())!;
      expect(k.pt.split(' ').length, k.key).toBe(1);
      expect(k.en.length, k.key).toBeLessThanOrEqual(60);
      expect(`${k.pt} ${k.en}`, k.key).not.toMatch(/\d/);
    }
  });

  it('puts a flip first (it cannot wait) and points at the bin for a filling nobody asked for', () => {
    const seen = new Set<string>(['sift']);
    expect(tapiocaCoachMark(st([pan('folded', { filling: 'coco' }), pan('cooking'), locked()]), seen)?.key).toBe('flip');
    seen.add('flip');
    expect(tapiocaCoachMark(st([pan('folded', { filling: 'coco' }), pan('empty'), locked()]), seen)).toMatchObject({ key: 'bin', target: 'tapioca-bin' });
    // a filling someone else at the counter wants is not wrong
    expect(tapiocaCoachMark(st([pan('folded', { filling: 'coco' })], ['queijo', 'coco']), seen)?.key).toBe('serve');
  });

  it('a torn or stuck tapioca waits for the bin mark until the steps it still needs are learnt', () => {
    const seen = new Set<string>(['sift', 'flip']);
    expect(tapiocaCoachMark(st([pan('flipped', { botched: true })]), seen)?.key).toBe('fill');
    seen.add('fill');
    expect(tapiocaCoachMark(st([pan('flipped', { botched: true })]), seen)?.key).toBe('bin');
  });

  it('says nothing about locked pans or an empty counter it cannot use', () => {
    expect(tapiocaCoachMark(st([locked(), locked(), locked()]), new Set())).toBeNull();
    // sift only while every open pan is empty (a pan already going needs its own step)
    expect(tapiocaCoachMark(st([pan('cooking'), pan('empty'), locked()]), new Set(['flip']))).toBeNull();
    // nothing to serve to: no serve mark
    expect(tapiocaCoachMark(st([pan('folded', { filling: 'queijo' })], []), new Set(['sift', 'flip', 'fill', 'fold']))).toBeNull();
  });

  it('reads the learnt list back safely', () => {
    expect([...readTapiocaCoach('["sift","flip","nope",3]')]).toEqual(['sift', 'flip']);
    expect(readTapiocaCoach('{bad').size).toBe(0);
    expect(readTapiocaCoach(null).size).toBe(0);
  });

  it('opens the practice once: not after it was done or skipped, and not for a profile with a Tapioca run', () => {
    expect(tapiocaPracticeNeeded(null, 0)).toBe(true);
    expect(tapiocaPracticeNeeded('1', 0)).toBe(false);
    expect(tapiocaPracticeNeeded(null, 1)).toBe(false);
  });
});
