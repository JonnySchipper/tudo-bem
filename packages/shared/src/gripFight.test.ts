import { describe, expect, it } from 'vitest';
import {
  STEPS_TO_WIN,
  applyGripMove,
  botMove,
  feintChance,
  forceForPosture,
  gripCanFinish,
  gripToSnapshot,
  idleMove,
  newGripState,
  noteWeakSpot,
  offerMoves,
  pictureForLead,
  resolveBeat,
  rollPosture,
  roundWinner,
  type BeatCommit,
  type GripFightState,
} from './gripFight.js';
import { partnerById } from './academia.js';
import { mulberry32 } from './meveum.js';

const beat = (st: GripFightState, over: Partial<BeatCommit> = {}) =>
  resolveBeat(st, { you: 'pegar_gola', them: 'pegar_manga', posture: 'longe', shown: 'longe', feint: false, spentMs: 1_000, ...over });

describe('grip fight rules', () => {
  it('starts on the mat with empty grips and time on the clock', () => {
    const st = newGripState();
    expect(st.position).toBe('guarda_fechada');
    expect(st.home).toBe('guarda_fechada');
    expect(st.holdYou).toEqual([]);
    expect(st.stepsYou).toBe(0);
    expect(st.clockMs).toBeGreaterThan(60_000);
  });

  it('the posture picks the force: close is a push, far is a pull, on every grip', () => {
    expect(forceForPosture('perto')).toBe('empurrar');
    expect(forceForPosture('longe')).toBe('puxar');
    const held = { ...newGripState(), holdYou: ['gola' as const, 'manga' as const] };
    expect(beat(held, { you: 'puxar_gola', posture: 'longe' }).state.stepsYou).toBe(1);
    expect(beat(held, { you: 'empurrar_gola', posture: 'longe' }).state.stepsYou).toBe(0);
    expect(beat(held, { you: 'empurrar_manga', posture: 'perto' }).state.stepsYou).toBe(1);
    expect(beat(held, { you: 'puxar_manga', posture: 'perto' }).state.stepsYou).toBe(0);
  });

  it('a wrong force bounces and does not score', () => {
    const st = { ...newGripState(), holdYou: ['gola' as const] };
    const r = applyGripMove(st, 'you', 'empurrar_gola');
    expect(r.state.stepsYou).toBe(0);
    expect(r.events.some((e) => e.type === 'bounce' && e.line?.pt === 'Força errada!')).toBe(true);
    expect(noteWeakSpot(st, r.events)).toBe('gola');
  });

  it('both of you move on the same beat: different grips both land, the same grip goes to neither', () => {
    const both = beat(newGripState()).state;
    expect(both.holdYou).toEqual(['gola']);
    expect(both.holdThem).toEqual(['manga']);
    const clash = beat(newGripState(), { them: 'pegar_gola' });
    expect(clash.state.holdYou).toEqual([]);
    expect(clash.state.holdThem).toEqual([]);
    expect(clash.events.some((e) => e.line?.pt === 'Os dois!')).toBe(true);
  });

  it('a clear races the force: the right force keeps the grip and scores, the wrong one loses it', () => {
    const st = { ...newGripState(), holdYou: ['gola' as const] };
    const scored = beat(st, { you: 'puxar_gola', them: 'soltar_gola', posture: 'longe' });
    expect(scored.state.stepsYou).toBe(1);
    expect(scored.state.holdYou).toEqual(['gola']);
    const stripped = beat(st, { you: 'empurrar_gola', them: 'soltar_gola', posture: 'longe' });
    expect(stripped.state.stepsYou).toBe(0);
    expect(stripped.state.holdYou).toEqual([]);
    expect(stripped.events.some((e) => e.who === 'partner' && e.line?.pt === 'Tirou a gola!')).toBe(true);
  });

  it('a clean step walks the picture, and four steps end the round', () => {
    let st = { ...newGripState(), holdYou: ['calca' as const] };
    st = beat(st, { you: 'puxar_calca', posture: 'longe' }).state;
    expect(st.stepsYou).toBe(1);
    expect(st.position).toBe('cem_quilos');
    expect(pictureForLead(2)).toBe('joelho');
    expect(pictureForLead(3)).toBe('montada');
    expect(pictureForLead(-1)).toBe('de_pe');
    expect(pictureForLead(0, 'guarda_fechada')).toBe('guarda_fechada');
    st = { ...st, stepsYou: STEPS_TO_WIN - 1 };
    st = beat(st, { you: 'puxar_calca', posture: 'longe' }).state;
    expect(roundWinner(st)).toBe('you');
  });

  it('finish is offered with two grips and one step, from whatever picture you are in', () => {
    const st = { ...newGripState(), stepsYou: 1, holdYou: ['gola' as const, 'manga' as const], position: 'cem_quilos' as const };
    expect(gripCanFinish(st)).toBe(true);
    expect(applyGripMove(st, 'you', 'finalizar').state.stepsYou).toBe(STEPS_TO_WIN);
    expect(roundWinner(applyGripMove(st, 'you', 'finalizar').state)).toBe('you');
  });

  it('maps into the legacy bout snapshot for the mat renderer', () => {
    const snap = gripToSnapshot({ ...newGripState(), stepsYou: 1, holdYou: ['gola'], holdThem: ['manga'], position: 'cem_quilos' });
    expect(snap.points).toEqual({ you: 1, partner: 0 });
    expect(snap.pegada).toBe(1);
    expect(snap.pegadaB).toBe(1);
    expect(snap.position).toBe('cem_quilos');
    expect(snap.rung).toBe(1);
    expect(snap.ahead).toBe('you');
  });

  it('standing still reaches or clears and never spends the force that scores', () => {
    expect(idleMove(newGripState(), 'longe')).toBe('pegar_gola');
    const full = { ...newGripState(), holdYou: ['gola' as const, 'manga' as const, 'calca' as const] };
    expect(idleMove(full, 'longe')).toBe('empurrar_gola');
    expect(idleMove(full, 'perto')).toBe('puxar_gola');
    const mixed = { ...newGripState(), holdYou: ['gola' as const], holdThem: ['manga' as const] };
    expect(idleMove(mixed, 'longe')).toBe('pegar_calca');
    const scored = beat(full, { you: idleMove(full, 'longe'), posture: 'longe' });
    expect(scored.state.stepsYou).toBe(0);
  });

  it('the offer is one choice per open grip and both forces when you hold it', () => {
    const open = offerMoves(newGripState(), 'you').map((m) => m.id);
    expect(open).toEqual(['pegar_gola', 'pegar_manga', 'pegar_calca']);
    const held = offerMoves({ ...newGripState(), holdYou: ['gola'], holdThem: ['manga'] }, 'you').map((m) => m.id);
    expect(held).toContain('puxar_gola');
    expect(held).toContain('empurrar_gola');
    expect(held).toContain('soltar_manga');
    expect(held).not.toContain('pegar_gola');
  });

  it('a trick shows the other posture; a calm partner almost never does, an aggressive one does', () => {
    expect(feintChance(partnerById('helena')!, 4)).toBe(0);
    expect(feintChance(partnerById('rafael')!, 4)).toBeGreaterThan(0.3);
    expect(feintChance(partnerById('rafael')!, 0)).toBeLessThan(feintChance(partnerById('rafael')!, 4));
    const rng = mulberry32(3);
    const roll = rollPosture(partnerById('rafael')!, rng, 6);
    expect(roll.posture === 'perto' || roll.posture === 'longe').toBe(true);
    if (roll.feint) expect(roll.shown).not.toBe(roll.posture);
    else expect(roll.shown).toBe(roll.posture);
    expect(roll.tellMs).toBeGreaterThan(800);
    expect(rollPosture(partnerById('felipe')!, () => 0.99, 4).tellMs).toBeLessThan(rollPosture(partnerById('helena')!, () => 0.99, 4).tellMs);
  });

  it('the bot picks a legal move and a defender would rather clear your grip', () => {
    const rafael = partnerById('rafael')!;
    const daniel = partnerById('daniel')!;
    let st = newGripState();
    expect(offerMoves(st, 'partner').some((x) => x.id === botMove(st, rafael, () => 0.2, 'longe'))).toBe(true);
    st = { ...st, holdYou: ['gola'] };
    const clears = Array.from({ length: 40 }, (_, i) => botMove(st, daniel, mulberry32(i), 'perto')).filter((id) => id === 'soltar_gola').length;
    expect(clears).toBeGreaterThan(15);
  });
});
