import { describe, expect, it } from 'vitest';
import {
  STEPS_TO_WIN,
  VALID_STEP_FORCE,
  applyGripMove,
  botMove,
  gripCanFinish,
  gripToSnapshot,
  newGripState,
  noteWeakSpot,
  offerMoves,
  roundWinner,
} from './gripFight.js';
import { partnerById } from './academia.js';

describe('grip fight rules', () => {
  it('starts in closed guard with empty grips and a minute on the clock', () => {
    const st = newGripState();
    expect(st.position).toBe('guarda_fechada');
    expect(st.holdYou).toEqual([]);
    expect(st.stepsYou).toBe(0);
    expect(st.clockMs).toBeGreaterThan(50_000);
  });

  it('a clean step needs the right force on a held grip', () => {
    let st = newGripState();
    st = applyGripMove({ ...st, holdYou: ['gola'], turn: 'you' }, 'you', 'puxar_gola').state;
    expect(st.stepsYou).toBe(1);
    st = applyGripMove({ ...st, holdYou: ['manga'], turn: 'you' }, 'you', 'puxar_manga').state;
    expect(st.stepsYou).toBe(1);
    expect(applyGripMove({ ...st, holdYou: ['manga'], turn: 'you' }, 'you', 'empurrar_manga').state.stepsYou).toBe(2);
  });

  it('wrong force bounces and passes the turn without a step', () => {
    const st = { ...newGripState(), holdYou: ['gola' as const], turn: 'you' as const };
    const r = applyGripMove(st, 'you', 'empurrar_gola');
    expect(r.state.stepsYou).toBe(0);
    expect(r.state.turn).toBe('partner');
    expect(r.events.some((e) => e.type === 'bounce')).toBe(true);
  });

  it('two steps end the round', () => {
    let st = { ...newGripState(), stepsYou: 1, holdYou: ['calca' as const], turn: 'you' as const };
    st = applyGripMove(st, 'you', 'puxar_calca').state;
    expect(roundWinner(st)).toBe('you');
  });

  it('finish is offered with two grips and one step', () => {
    const st = { ...newGripState(), stepsYou: 1, holdYou: ['gola', 'manga'], turn: 'you' as const };
    expect(gripCanFinish(st)).toBe(true);
    expect(applyGripMove(st, 'you', 'finalizar').state.stepsYou).toBe(STEPS_TO_WIN);
  });

  it('maps into the legacy bout snapshot for the mat renderer', () => {
    const snap = gripToSnapshot({ ...newGripState(), stepsYou: 1, holdYou: ['gola'], holdThem: ['manga'] });
    expect(snap.points).toEqual({ you: 1, partner: 0 });
    expect(snap.pegada).toBe(1);
    expect(snap.pegadaB).toBe(1);
    expect(snap.position).toBe('guarda_fechada');
  });

  it('the bot picks legal moves and remembers a weak spot after a bounce', () => {
    const partner = partnerById('rafael')!;
    const rng = () => 0.2;
    let st = newGripState();
    const m = botMove(st, partner, rng);
    expect(offerMoves(st, 'partner').some((x) => x.id === m)).toBe(true);
    const bounced = applyGripMove({ ...st, holdYou: ['gola'], turn: 'you' }, 'you', 'empurrar_gola');
    expect(noteWeakSpot(st, bounced.events)).toBe('gola');
  });

  it('documents which force scores on each grip', () => {
    expect(VALID_STEP_FORCE.gola).toBe('puxar');
    expect(VALID_STEP_FORCE.manga).toBe('empurrar');
    expect(VALID_STEP_FORCE.calca).toBe('puxar');
  });
});
