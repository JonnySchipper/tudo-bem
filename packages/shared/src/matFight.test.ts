import { describe, expect, it } from 'vitest';
import { completeDrill, normalizeBjj, partnerById, progressForWins, recordWin } from './academia.js';
import { diaryWord } from './diary.js';
import {
  CLEAN_LIFT,
  COMBOS,
  COMMANDS,
  COMMAND_LABEL,
  DEFENSES,
  DEFENSE_LABEL,
  EXCHANGE_CLOCK_MS,
  MAT_TURNS,
  MAT_WORD_IDS,
  MAX_CARDS,
  MOVE_LABEL,
  RITMO_RUN,
  START_RATES,
  UNLOCK_ORDER,
  baseChain,
  botCommit,
  botMoves,
  braceBlocks,
  chainFor,
  chainWindows,
  chooseBot,
  cmdWindowMs,
  defWindowMs,
  defenseOf,
  drillPosition,
  feintMove,
  fightMoves,
  gradeTap,
  isEscape,
  isSubmission,
  isTakedown,
  matEffect,
  matLegalMoves,
  matMeter,
  matStyle,
  moveDoes,
  moveLegal,
  moveTaughtAt,
  newMat,
  nextMatWord,
  offerCards,
  partnerClean,
  planAnswers,
  planBot,
  planLine,
  planStands,
  planValues,
  rankPool,
  resolveMat,
  saiCount,
  shouldFeint,
  withCombos,
  type GripFlags,
  type MatMoveId,
  type MatState,
} from './matFight.js';

/** You hold the collar, your turn. */
const GRIPPED: MatState = { ...newMat(), grips: { you: { collar: true, sleeve: false }, them: { collar: false, sleeve: false } } };
const grips = (you: Partial<GripFlags>, them: Partial<GripFlags> = {}): MatState['grips'] => ({
  you: { collar: false, sleeve: false, ...you },
  them: { collar: false, sleeve: false, ...them },
});
const at = (kind: Exclude<MatState['position']['kind'], 'standing'>, top: 'you' | 'them', over: Partial<MatState> = {}): MatState => ({ ...newMat(), position: { kind, top }, ...over });

describe('the pads', () => {
  it('six commands and four defenses in a fixed order, each with an English gloss', () => {
    expect(COMMANDS).toEqual(['pega', 'puxa', 'empurra', 'gira', 'levanta', 'aperta']);
    expect(COMMANDS.map((c) => COMMAND_LABEL[c].pt)).toEqual(['Pega!', 'Puxa!', 'Empurra!', 'Gira!', 'Levanta!', 'Aperta!']);
    expect(COMMANDS.map((c) => COMMAND_LABEL[c].en)).toEqual(['Grab!', 'Pull!', 'Push!', 'Turn!', 'Lift!', 'Squeeze!']);
    expect(DEFENSES).toEqual(['postura', 'base', 'trava', 'sai']);
    expect(DEFENSES.map((d) => DEFENSE_LABEL[d].pt)).toEqual(['Postura!', 'Base!', 'Trava!', 'Sai!']);
    for (const d of DEFENSES) expect(DEFENSE_LABEL[d].stops.en.length).toBeGreaterThan(4);
  });
});

describe('chains', () => {
  it('every move is its fixed chain (the brief table)', () => {
    const s = newMat();
    expect(baseChain(s, 'you', 'collar_tie')).toEqual(['pega']);
    expect(baseChain(s, 'you', 'sleeve_grip')).toEqual(['pega']);
    expect(baseChain(s, 'you', 'posture')).toEqual(['levanta']);
    expect(baseChain(s, 'you', 'sprawl')).toEqual(['empurra']);
    expect(baseChain(s, 'you', 'sleeve_pull')).toEqual(['puxa']);
    expect(baseChain(s, 'you', 'double_leg')).toEqual(['puxa', 'levanta']);
    expect(baseChain(s, 'you', 'body_lock')).toEqual(['pega', 'gira']);
    expect(baseChain(s, 'you', 'collar_drag')).toEqual(['puxa', 'gira']);
    expect(baseChain(s, 'you', 'hip_throw')).toEqual(['puxa', 'gira', 'levanta']);
    expect(baseChain(s, 'you', 'single_leg')).toEqual(['puxa', 'levanta', 'gira']);
    const guardBottom = at('closed_guard', 'them');
    expect(baseChain(guardBottom, 'you', 'hook_sweep')).toEqual(['puxa', 'gira']);
    expect(baseChain(guardBottom, 'you', 'hip_bump')).toEqual(['levanta', 'empurra']);
    expect(baseChain(guardBottom, 'you', 'scissor_sweep')).toEqual(['puxa', 'empurra', 'gira']);
    expect(baseChain(guardBottom, 'you', 'frame')).toEqual(['empurra']);
    expect(baseChain(at('closed_guard', 'you'), 'you', 'passar')).toEqual(['empurra', 'levanta', 'gira']);
    expect(baseChain(at('side_control', 'you'), 'you', 'passar')).toEqual(['empurra', 'gira']);
    expect(baseChain(at('knee_on_belly', 'you'), 'you', 'passar')).toEqual(['empurra', 'gira']);
    expect(baseChain(at('side_control', 'you'), 'you', 'knee_on_belly')).toEqual(['levanta', 'empurra']);
    expect(baseChain(at('mount', 'you'), 'you', 'back_take')).toEqual(['puxa', 'gira', 'pega']);
    // the stripe escapes are shorter than everyone's Virar: Recuperar one command, Sair two
    expect(baseChain(at('side_control', 'them'), 'you', 'frame')).toEqual(['empurra']);
    expect(baseChain(at('back_control', 'them'), 'you', 'escape_back')).toEqual(['empurra', 'gira']);
    expect(baseChain(at('side_control', 'them'), 'you', 'virar')).toEqual(['empurra', 'gira']);
    expect(baseChain(at('mount', 'them'), 'you', 'virar')).toEqual(['empurra', 'gira']);
    expect(baseChain(at('back_control', 'them'), 'you', 'virar')).toEqual(['empurra', 'gira', 'levanta']);
    expect(baseChain(at('mount', 'you'), 'you', 'americana')).toEqual(['pega', 'empurra', 'aperta']);
    expect(baseChain(at('mount', 'you'), 'you', 'armbar')).toEqual(['pega', 'gira', 'levanta', 'aperta']);
    expect(baseChain(at('back_control', 'you'), 'you', 'rnc')).toEqual(['pega', 'gira', 'aperta']);
    expect(baseChain(s, 'you', 'hold')).toEqual([]);
  });

  it('the collar makes every throw one command shorter (never under one); a tough defender adds one to finishes and big attacks', () => {
    expect(chainFor(GRIPPED, 'you', 'double_leg')).toEqual(['levanta']);
    expect(chainFor(GRIPPED, 'you', 'collar_drag')).toEqual(['gira']);
    expect(chainFor({ ...newMat(), grips: grips({ collar: true, sleeve: true }) }, 'you', 'hip_throw')).toEqual(['gira', 'levanta']);
    expect(chainFor(newMat(), 'you', 'double_leg')).toEqual(['puxa', 'levanta']);
    // the sleeve alone does not shorten anything
    expect(chainFor({ ...newMat(), grips: grips({ sleeve: true }) }, 'you', 'double_leg')).toHaveLength(2);
    const daniel = partnerById('daniel')!.defense;
    expect(daniel).toBeGreaterThanOrEqual(0.75);
    expect(chainFor(at('mount', 'you'), 'you', 'armbar', daniel)).toEqual(['pega', 'gira', 'levanta', 'puxa', 'aperta']);
    expect(chainFor(at('closed_guard', 'you'), 'you', 'passar', daniel)).toHaveLength(4);
    expect(chainFor(at('side_control', 'you'), 'you', 'passar', daniel)).toHaveLength(3);
    // a 2-point takedown is not "big"
    expect(chainFor(newMat(), 'you', 'double_leg', daniel)).toHaveLength(2);
    expect(chainFor(at('mount', 'you'), 'you', 'armbar', partnerById('mateus')!.defense)).toHaveLength(4);
  });

  it('windows shrink 5% a level to half; a first match is ×1.4; the last Aperta! of a finish is ×0.8', () => {
    expect(cmdWindowMs(0)).toBe(2200);
    expect(cmdWindowMs(4)).toBe(1760);
    expect(cmdWindowMs(10)).toBe(1100);
    expect(cmdWindowMs(40)).toBe(1100);
    expect(cmdWindowMs(0, true)).toBe(3080);
    expect(chainWindows(['pega', 'gira', 'levanta', 'aperta'], 'armbar', 0)).toEqual([2200, 2200, 2200, 1760]);
    expect(chainWindows(['puxa', 'levanta'], 'double_leg', 4)).toEqual([1760, 1760]);
  });

  it('the defense window follows the partner speed and widens with your sleeve', () => {
    const felipe = defWindowMs(0, partnerById('felipe')!.speed, false);
    const helena = defWindowMs(0, partnerById('helena')!.speed, false);
    expect(felipe).toBeLessThan(helena);
    expect(felipe / cmdWindowMs(0)).toBeCloseTo(0.44, 2);
    expect(helena / cmdWindowMs(0)).toBeCloseTo(0.672, 2);
    expect(defWindowMs(0, 0.5, true)).toBe(Math.round(defWindowMs(0, 0.5, false) * 1.35));
  });

  it('grades a tap: Perfeito inside 45% of the window, Boa inside it, Tarde after it or never, Errou on the wrong button', () => {
    expect(gradeTap('pega', 'pega', 900, 2200)).toBe('perfeito');
    expect(gradeTap('pega', 'pega', 990, 2200)).toBe('perfeito');
    expect(gradeTap('pega', 'pega', 1000, 2200)).toBe('boa');
    expect(gradeTap('pega', 'pega', 2200, 2200)).toBe('boa');
    expect(gradeTap('pega', 'pega', 2201, 2200)).toBe('tarde');
    expect(gradeTap('pega', null, 0, 2200)).toBe('tarde');
    expect(gradeTap('pega', 'puxa', 100, 2200)).toBe('errou');
  });

  it('the partner is clean at its accuracy (lifted) minus 0.04 a command; Daniel needs four Sai!', () => {
    expect(partnerClean(0.6, 1)).toBeCloseTo(0.6 + CLEAN_LIFT, 5);
    expect(partnerClean(0.6, 3)).toBeCloseTo(0.6 + CLEAN_LIFT - 0.08, 5);
    expect(partnerClean(0.86, 1)).toBeLessThanOrEqual(0.97);
    expect(partnerClean(partnerById('felipe')!.accuracy, 2)).toBeLessThan(partnerClean(partnerById('helena')!.accuracy, 2));
    expect(saiCount(partnerById('mateus')!.defense)).toBe(3);
    expect(saiCount(partnerById('daniel')!.defense)).toBe(4);
  });
});

describe('position machine', () => {
  it('starts standing: grips, defenses and the plain throws are open; the grip follow-ups wait for their grips', () => {
    const st = newMat();
    expect(st.position).toEqual({ kind: 'standing' });
    expect(st.actor).toBe('you');
    const all = withCombos(rankPool('preta'));
    const legal = matLegalMoves(st, 'you', all);
    expect(legal.sort()).toEqual(['body_lock', 'collar_tie', 'double_leg', 'hold', 'posture', 'single_leg', 'sleeve_grip', 'sprawl'].sort());
    expect(resolveMat(st, 'you', 'hip_throw', true).ok).toBe(false);
    expect(resolveMat(st, 'you', 'armbar', true).ok).toBe(false);
  });

  it('a takedown that lands moves to its position and scores once; one that does not land scores nothing and spends the grips', () => {
    const leg = resolveMat(GRIPPED, 'you', 'double_leg', true);
    expect(leg.landed).toBe(true);
    expect(leg.points).toBe(2);
    expect(leg.line.pt).toBe('Dois pontos!');
    expect(leg.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(leg.sound).toBe('whoosh');
    const miss = resolveMat(GRIPPED, 'you', 'double_leg', false);
    expect(miss.landed).toBe(false);
    expect(miss.line.pt).toBe('Errou!');
    expect(miss.state.grips.you).toEqual({ collar: false, sleeve: false });
    expect(miss.state.position).toEqual({ kind: 'standing' });
    expect(miss.state.actor).toBe('them');
    expect(resolveMat(newMat(), 'you', 'body_lock', true).state.position).toEqual({ kind: 'closed_guard', top: 'you' });
  });

  it('a finish that does not land drops the attacker to the bottom of the guard (Escapou!); one that lands ends the match', () => {
    const mount = at('mount', 'you');
    const r = resolveMat(mount, 'you', 'armbar', false);
    expect(r.state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    expect(r.line.pt).toBe('Escapou!');
    expect(r.sound).toBe('sub');
    const win = resolveMat({ ...mount, points: { you: 0, them: 6 } }, 'you', 'armbar', true);
    expect(win.submission).toBe(true);
    expect(win.line.pt).toBe('Final!');
    expect(win.state).toMatchObject({ over: true, winner: 'you', reason: 'submission', turnsUsed: 1 });
  });

  it('passes: three points from the guard to the side, four from the side or the knee to the top', () => {
    const fromGuard = resolveMat(at('closed_guard', 'you'), 'you', 'passar', true);
    expect(fromGuard.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(fromGuard.points).toBe(3);
    const fromSide = resolveMat(at('side_control', 'you'), 'you', 'passar', true);
    expect(fromSide.state.position).toEqual({ kind: 'mount', top: 'you' });
    expect(fromSide.points).toBe(4);
    expect(fromSide.line.pt).toBe('Quatro pontos!');
    const knee = resolveMat(at('side_control', 'you'), 'you', 'knee_on_belly', true);
    expect(knee.points).toBe(2);
    const back = resolveMat(at('mount', 'you'), 'you', 'back_take', true);
    expect(back.points).toBe(4);
    expect(back.state.position).toEqual({ kind: 'back_control', top: 'you' });
  });

  it('pays a position once per exchange, Gancho sweeps, and the escapes go back to the guard', () => {
    let st = resolveMat(newMat(), 'you', 'double_leg', true).state;
    st = { ...st, actor: 'you', position: { kind: 'closed_guard', top: 'them' } };
    expect(resolveMat(st, 'you', 'hip_bump', true).points).toBe(0);
    const swept = resolveMat(at('closed_guard', 'them'), 'you', 'hook_sweep', true);
    expect(swept.points).toBe(2);
    expect(swept.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(resolveMat(at('side_control', 'them'), 'you', 'frame', true).state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    expect(resolveMat(at('back_control', 'them'), 'you', 'escape_back', true).state.position).toEqual({ kind: 'closed_guard', top: 'them' });
  });

  it('Hold always lands, scores nothing and keeps the position', () => {
    const r = resolveMat(at('mount', 'you', { points: { you: 4, them: 0 } }), 'you', 'hold', false);
    expect(r.landed).toBe(true);
    expect(r.points).toBe(0);
    expect(r.state.position).toEqual({ kind: 'mount', top: 'you' });
  });
});

describe('grips, braces and defenses', () => {
  it('Postura strips one grip (collar first) and braces; Base braces against takedowns', () => {
    const st: MatState = { ...newMat(), grips: grips({ collar: true }, { collar: true, sleeve: true }) };
    const up = resolveMat(st, 'you', 'posture', true);
    expect(up.state.grips.them).toEqual({ collar: false, sleeve: true });
    expect(up.events).toEqual([
      { kind: 'strip', side: 'you', grips: ['collar'] },
      { kind: 'brace', side: 'you', brace: 'postura' },
    ]);
    expect(up.state.brace.you).toBe('postura');
    expect(resolveMat(GRIPPED, 'you', 'sprawl', true).state.brace.you).toBe('base');
  });

  it('a brace stops the matching attack with no tap and is the Vantagem of whoever braced, either side', () => {
    const based: MatState = { ...newMat(), actor: 'them', brace: { you: 'base', them: null } };
    expect(braceBlocks(based, 'them', 'double_leg')).toBe(true);
    expect(braceBlocks(based, 'them', 'collar_tie')).toBe(false);
    const r = resolveMat(based, 'them', 'double_leg', false);
    expect(r.events).toContainEqual({ kind: 'blocked', side: 'you' });
    expect(r.state.adv.you).toBe(1);
    expect(r.line.pt).toBe('Vantagem!');
    expect(r.state.brace.you).toBeNull();
    const theirs: MatState = { ...newMat(), brace: { you: null, them: 'postura' } };
    expect(braceBlocks(theirs, 'you', 'sleeve_grip')).toBe(true);
    expect(resolveMat(theirs, 'you', 'sleeve_grip', false).state.adv.them).toBe(1);
  });

  it('nobody braces twice in a row', () => {
    const st = resolveMat(newMat(), 'you', 'sprawl', true).state;
    const back = resolveMat(st, 'them', 'hold', true).state;
    expect(back.braced.you).toBe(true);
    const legal = matLegalMoves(back, 'you', ['collar_tie', 'posture', 'sprawl', 'double_leg']);
    expect(legal).not.toContain('sprawl');
    expect(legal).not.toContain('posture');
    expect(legal).toContain('double_leg');
    const after = resolveMat(back, 'you', 'collar_tie', true).state;
    expect(after.braced.you).toBe(false);
  });

  it('the defense that stops each attack kind', () => {
    const s = newMat();
    expect(defenseOf(s, 'them', 'collar_tie')).toBe('postura');
    expect(defenseOf(s, 'them', 'double_leg')).toBe('base');
    expect(defenseOf(s, 'them', 'sleeve_pull')).toBe('base');
    expect(defenseOf(at('closed_guard', 'you'), 'them', 'hook_sweep')).toBe('base');
    expect(defenseOf(at('side_control', 'them'), 'them', 'passar')).toBe('trava');
    expect(defenseOf(at('side_control', 'you'), 'them', 'frame')).toBe('trava');
    expect(defenseOf(at('closed_guard', 'you'), 'them', 'frame')).toBeNull();
    expect(defenseOf(at('mount', 'them'), 'them', 'armbar')).toBe('sai');
    expect(defenseOf(s, 'them', 'posture')).toBeNull();
    expect(defenseOf(s, 'them', 'hold')).toBeNull();
  });

  it('Defendeu!: a defended scoring attack is a Vantagem; a defended grip or escape is not', () => {
    const shot = resolveMat({ ...newMat(), actor: 'them' }, 'them', 'double_leg', false, { defended: true });
    expect(shot.events).toContainEqual({ kind: 'defended', side: 'you', adv: true });
    expect(shot.state.adv.you).toBe(1);
    expect(shot.line.pt).toBe('Vantagem!');
    const grip = resolveMat({ ...newMat(), actor: 'them' }, 'them', 'collar_tie', false, { defended: true });
    expect(grip.state.adv.you).toBe(0);
    expect(grip.line.pt).toBe('Defendeu!');
    const sub = resolveMat(at('mount', 'them', { actor: 'them' }), 'them', 'armbar', false, { defended: true });
    expect(sub.state.adv.you).toBe(1);
    expect(sub.state.position).toEqual({ kind: 'closed_guard', top: 'you' });
  });

  it('a grip held through three of your turns slips', () => {
    let st = resolveMat(newMat(), 'you', 'collar_tie', true).state;
    for (let i = 0; i < 2; i++) {
      st = resolveMat(st, 'them', 'hold', true).state;
      st = resolveMat(st, 'you', 'hold', true).state;
    }
    expect(st.grips.you.collar).toBe(false);
  });

  it('advantages break a points tie at the bell; the meter reads grips, position and the last exchange', () => {
    const r = resolveMat({ ...newMat(), points: { you: 2, them: 2 }, adv: { you: 1, them: 0 }, turnsUsed: MAT_TURNS - 1 }, 'you', 'hold', true);
    expect(r.state).toMatchObject({ over: true, winner: 'you', reason: 'advantages' });
    expect(matMeter(GRIPPED)).toBeGreaterThan(matMeter(newMat()));
    expect(matMeter(at('mount', 'you'))).toBeGreaterThan(50);
    expect(matMeter(at('mount', 'them'))).toBeLessThan(-50);
  });
});

describe('Ritmo', () => {
  it('three all-Perfeito chains in a row are a Vantagem (Que ritmo!), then the count starts again', () => {
    let st = newMat();
    const mine = (id: MatMoveId, perfect: boolean, landed = true) => {
      const r = resolveMat({ ...st, actor: 'you' }, 'you', id, landed, { perfect });
      st = { ...r.state, actor: 'you', brace: { you: null, them: null }, braced: { you: false, them: false } };
      return r;
    };
    mine('collar_tie', true);
    mine('sleeve_grip', true);
    expect(st.ritmo).toBe(2);
    const third = mine('posture', true);
    expect(third.events).toContainEqual({ kind: 'ritmo', side: 'you' });
    expect(third.line.pt).toBe('Que ritmo!');
    expect(st.adv.you).toBe(1);
    expect(st.ritmo).toBe(0);
    expect(RITMO_RUN).toBe(3);
  });

  it('a miss or a chain with one Boa! resets it; Hold leaves it', () => {
    let st: MatState = { ...newMat(), ritmo: 2 };
    st = resolveMat(st, 'you', 'hold', true).state;
    expect(st.ritmo).toBe(2);
    st = resolveMat({ ...st, actor: 'you' }, 'you', 'collar_tie', true, { perfect: false }).state;
    expect(st.ritmo).toBe(0);
    st = resolveMat({ ...newMat(), ritmo: 2 }, 'you', 'double_leg', false, { perfect: true }).state;
    expect(st.ritmo).toBe(0);
  });
});

describe('16 exchanges', () => {
  it('sixteen holds from 0-0 are a draw; the clock is 2:00 of 7.5 s exchanges', () => {
    let st = newMat();
    for (let i = 0; i < MAT_TURNS; i++) st = resolveMat(st, st.actor, 'hold', true).state;
    expect(MAT_TURNS).toBe(16);
    expect(st.over).toBe(true);
    expect(st.winner).toBe('draw');
    expect(resolveMat(st, 'you', 'hold', true).ok).toBe(false);
    expect(MAT_TURNS * EXCHANGE_CLOCK_MS).toBe(120_000);
  });

  it('a finish on the last exchange still wins from behind', () => {
    const r = resolveMat(at('mount', 'you', { points: { you: 0, them: 8 }, turnsUsed: MAT_TURNS - 1 }), 'you', 'armbar', true);
    expect(r.state.winner).toBe('you');
    expect(r.state.reason).toBe('submission');
  });
});

describe('the pick: at most four cards, no percentages', () => {
  const all = withCombos(rankPool('azul'));

  it('ranks the answer to the telegraph first, then the best attack, a finish, a setup', () => {
    const plan = { move: 'double_leg' as const, kind: 'queda' as const };
    const cards = offerCards(newMat(), all, plan);
    expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
    expect(cards[0]).toMatchObject({ move: 'sprawl', answers: true });
    expect(cards.some((c) => c.kind === 'attack')).toBe(true);
    const mount = offerCards(at('mount', 'you'), all, null);
    expect(mount.map((c) => c.move)).toContain('armbar');
    expect(mount.find((c) => c.move === 'armbar')).toMatchObject({ kind: 'finish', chain: 4 });
    expect(mount.find((c) => c.move === 'armbar')?.risk?.pt).toBe('Se errar: você por baixo');
  });

  it('a grip follow-up leads the attacks, and the card says what the move does in plain words', () => {
    const both: MatState = { ...newMat(), grips: grips({ collar: true, sleeve: true }) };
    const cards = offerCards(both, all, null);
    expect(cards.find((c) => c.kind === 'attack')?.move).toBe('collar_drag');
    expect(cards.find((c) => c.move === 'collar_drag')).toMatchObject({ chain: 1, points: 2 });
    expect(moveDoes(newMat(), 'you', 'double_leg')).toEqual({ pt: '+2 · você por cima', en: '+2 · you on top' });
    expect(moveDoes(newMat(), 'you', 'sleeve_grip').pt).toBe('Protege você');
    expect(moveDoes(at('mount', 'you'), 'you', 'armbar').pt).toBe('Vale a vitória!');
    for (const c of cards) expect(`${c.does.pt} ${c.does.en}`).not.toMatch(/%/);
  });

  it('a held grip is not offered again, and nothing is offered twice', () => {
    const cards = offerCards(GRIPPED, all, null);
    expect(cards.map((c) => c.move)).not.toContain('collar_tie');
    expect(new Set(cards.map((c) => c.move)).size).toBe(cards.length);
  });
});

describe('the partner AI', () => {
  const all = botMoves('branca', 'branca');
  const ctx = { allowed: all, foeAllowed: all };

  it('on top it passes; behind on its last move from the top it goes for the finish', () => {
    expect(['passar', 'knee_on_belly']).toContain(chooseBot(at('side_control', 'them', { actor: 'them' }), ctx));
    const losing = at('mount', 'them', { actor: 'them', points: { you: 4, them: 0 }, turnsUsed: MAT_TURNS - 1 });
    expect(isSubmission(chooseBot(losing, ctx))).toBe(true);
  });

  it('with a grip in hand it throws (the collar made the throw one command)', () => {
    const st: MatState = { ...newMat(), actor: 'them', grips: grips({}, { collar: true, sleeve: true }) };
    expect(isTakedown(planBot(st, ctx).move)).toBe(true);
  });

  it('reads the player: the more you block, the less its attacks are worth', () => {
    const st: MatState = { ...newMat(), actor: 'them' };
    const value = (block: number) => planValues(st, { ...ctx, rates: { block, chain: START_RATES.chain } }).find(([id]) => id === 'double_leg')![1];
    expect(value(0.95)).toBeLessThan(value(0.1));
    // and the better your chains land, the more it fears your next attack (its standing value drops)
    const best = (chain: number) => Math.max(...planValues(st, { ...ctx, rates: { block: 0.5, chain } }).map(([, v]) => v));
    expect(best(0.95)).toBeLessThan(best(0.2));
  });

  it('keeps the telegraphed move unless your move broke it', () => {
    const st: MatState = { ...newMat(), actor: 'them' };
    const plan = planBot(st, ctx);
    expect(botCommit(st, plan, ctx)).toEqual({ move: plan.move, replanned: false });
    const broke = resolveMat({ ...newMat(), actor: 'you' }, 'you', 'double_leg', true).state;
    expect(planStands(broke, { move: 'double_leg', kind: 'queda' }, all)).toBe(false);
    expect(botCommit(broke, { move: 'double_leg', kind: 'queda' }, ctx).replanned).toBe(true);
  });

  it('feints from blue belt only, by aggression; a feint is an attack of another kind', () => {
    expect(shouldFeint(3, 0.92, 0)).toBe(false);
    expect(shouldFeint(4, 0.45, 0)).toBe(false);
    expect(shouldFeint(4, 0.92, 0.1)).toBe(true);
    expect(shouldFeint(4, 0.92, 0.2)).toBe(false);
    const st: MatState = { ...newMat(), actor: 'them' };
    const blue = botMoves('azul', 'azul');
    const f = feintMove(st, { move: 'double_leg', kind: 'queda' }, { allowed: blue, foeAllowed: blue, style: matStyle(partnerById('rafael')!) });
    expect(f).not.toBeNull();
    expect(defenseOf(st, 'them', f!)).not.toBe('base');
  });

  it('every telegraph line names the partner and avoids position and technique names', () => {
    const LOCK = /\b(oss|rola|guarda|montada|costas|armlock|kimura|triângulo|mata-leão)\b/i;
    for (const k of ['gola', 'manga', 'queda', 'soltar', 'base', 'puxar', 'raspar', 'passar', 'subir', 'finalizar', 'sair', 'travar', 'segurar'] as const) {
      const l = planLine(k, 'Helena');
      expect(l.pt.startsWith('Helena ')).toBe(true);
      expect(l.pt).not.toMatch(LOCK);
    }
    const legal = matLegalMoves(newMat(), 'you', withCombos(rankPool('azul')));
    expect(planAnswers(newMat(), { move: 'double_leg', kind: 'queda' }, legal)).toEqual(['sprawl', 'sleeve_grip']);
  });
});

describe('move effects', () => {
  it('matEffect says what a move does if it lands', () => {
    expect(matEffect(newMat(), 'you', 'double_leg')).toMatchObject({ points: 2, to: 'cem_quilos', toAhead: 'you', submission: false });
    expect(matEffect(at('mount', 'you'), 'you', 'armbar')).toMatchObject({ submission: true, riskBottom: true });
    expect(matEffect(newMat(), 'you', 'collar_tie')).toMatchObject({ points: 0, to: 'de_pe' });
  });
});

describe('stripe unlock order', () => {
  it('teaches one move per award, in order, and then stops', () => {
    expect(UNLOCK_ORDER.map((u) => u.move)).toEqual([
      'collar_tie',
      'double_leg',
      'hook_sweep',
      'posture',
      'passar',
      'armbar',
      'sleeve_grip',
      'knee_on_belly',
      'body_lock',
      'sprawl',
      'scissor_sweep',
      'hip_bump',
      'frame',
      'escape_back',
      'americana',
      'rnc',
      'back_take',
      'single_leg',
    ]);
    expect(moveTaughtAt('branca', 0)).toBe('collar_tie');
    expect(moveTaughtAt('branca', 1)).toBe('sleeve_grip');
    expect(moveTaughtAt('branca', 2)).toBe('knee_on_belly');
    expect(moveTaughtAt('branca', 3)).toBe('body_lock');
    expect(moveTaughtAt('branca', 4)).toBe('sprawl');
    expect(moveTaughtAt('roxa', 0)).toBe('rnc');
    expect(moveTaughtAt('roxa', 1)).toBe('back_take');
    expect(moveTaughtAt('roxa', 2)).toBe('single_leg');
    expect(moveTaughtAt('roxa', 3)).toBeNull();
    expect(moveTaughtAt('marrom', 0)).toBeNull();
    expect(moveTaughtAt('preta', 0)).toBeNull();
  });

  it('a win stores the stripe on the account and holds the new move for the drill', () => {
    let p = normalizeBjj();
    expect(p.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar']);
    for (let i = 0; i < 4; i++) p = recordWin(p).progress;
    const fifth = recordWin(p);
    expect(fifth.stripeUp).toBe(true);
    expect(fifth.move).toBe('sleeve_grip');
    expect(fifth.progress.pendingDrill).toBe('sleeve_grip');
    expect(fifth.progress.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar']);
    expect(fifth.progress).toMatchObject({ belt: 'branca', stripes: 1, wins: 5 });
    const drilled = completeDrill(fifth.progress, 'sleeve_grip');
    expect(drilled.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip']);
    expect(drilled.pendingDrill).toBeUndefined();
    const again = completeDrill(drilled, 'sleeve_grip');
    expect(again.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip']);
  });

  it('walks the belts: two takedowns by white, a second submission at blue, the choke at purple', () => {
    const at = (wins: number) => {
      let p = normalizeBjj();
      let move: string | null = null;
      for (let i = 0; i < wins; i++) {
        const w = recordWin(p);
        p = w.move ? completeDrill(w.progress, w.move) : w.progress;
        move = w.move;
      }
      return { belt: p.belt, stripes: p.stripes, move, unlocked: p.unlocked };
    };
    expect(at(0).unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar']);
    expect(at(10)).toMatchObject({ belt: 'branca', stripes: 2, move: 'knee_on_belly' });
    expect(at(15)).toMatchObject({ belt: 'branca', stripes: 3, move: 'body_lock' });
    expect(at(20)).toMatchObject({ belt: 'azul', stripes: 0, move: 'scissor_sweep' });
    expect(at(20).unlocked).toEqual(expect.arrayContaining(['sprawl', 'scissor_sweep']));
    expect(at(50)).toMatchObject({ belt: 'azul', stripes: 3, move: 'escape_back' });
    expect(at(60)).toMatchObject({ belt: 'roxa', stripes: 0, move: 'rnc' });
    expect(at(60).unlocked).toEqual(expect.arrayContaining(['armbar', 'americana', 'rnc']));
    expect(at(80)).toMatchObject({ belt: 'roxa', stripes: 1, move: 'back_take' });
    expect(at(100)).toMatchObject({ belt: 'roxa', stripes: 2, move: 'single_leg' });
    expect(at(125).move).toBeNull();
    expect(at(140)).toMatchObject({ belt: 'marrom', stripes: 0, move: null });
    expect(at(150).move).toBeNull();
    expect(progressForWins(300)).toEqual({ belt: 'preta', stripes: 0 });
  });
});

describe('cross-rank cap', () => {
  it('a brown belt against a white belt only gets the white pool', () => {
    const moves = fightMoves({ belt: 'marrom', unlocked: rankPool('marrom'), opponentBelt: 'branca' });
    expect(moves).toEqual([
      'collar_tie',
      'double_leg',
      'hook_sweep',
      'posture',
      'passar',
      'armbar',
      'sleeve_grip',
      'knee_on_belly',
      'body_lock',
      'sprawl',
      'collar_drag',
      'sleeve_pull',
      'hip_throw',
    ]);
    expect(moves).not.toContain('americana');
    expect(moves).not.toContain('rnc');
    expect(moves).not.toContain('back_take');
    expect(moves).not.toContain('single_leg');
  });

  it('the higher belt has the whole lower pool even when the lower fighter is still on the first move', () => {
    const higher = fightMoves({ belt: 'marrom', unlocked: ['collar_tie'], opponentBelt: 'branca' });
    expect(higher).toContain('sprawl');
    const lower = fightMoves({ belt: 'branca', unlocked: ['collar_tie'], opponentBelt: 'marrom' });
    // the collar brings the follow-up it opens, nothing else
    expect(lower).toEqual(['collar_tie', 'collar_drag']);
  });

  it('same belt: each fighter is limited to the moves they personally have (and what their grips open)', () => {
    expect(fightMoves({ belt: 'azul', unlocked: ['collar_tie', 'sleeve_grip'], opponentBelt: 'azul' })).toEqual(['collar_tie', 'sleeve_grip', 'collar_drag', 'sleeve_pull', 'hip_throw']);
    expect(fightMoves({ belt: 'branca', unlocked: ['sleeve_grip'], opponentBelt: 'branca' })).toEqual(['sleeve_grip', 'sleeve_pull']);
    // the bot's pool is its belt's, plus Virar (everyone has it, like Segurar)
    expect(botMoves('branca', 'branca')).toEqual([...withCombos(rankPool('branca')), 'virar']);
    expect(botMoves('marrom', 'branca')).toEqual([...withCombos(rankPool('branca')), 'virar']);
    // the combos are never stripe awards
    for (const c of COMBOS) expect(UNLOCK_ORDER.some((u) => u.move === c.move)).toBe(false);
  });
});

describe('Virar: everyone’s way out from under', () => {
  it('is legal only underneath (side, knee, top, back), for a white belt with no escape lessons, and is never a stripe award', () => {
    for (const kind of ['side_control', 'knee_on_belly', 'mount', 'back_control'] as const) {
      expect(matLegalMoves(at(kind, 'them'), 'you', ['collar_tie'])).toContain('virar');
      expect(matLegalMoves(at(kind, 'you'), 'you', ['collar_tie'])).not.toContain('virar');
    }
    expect(matLegalMoves(newMat(), 'you', ['collar_tie'])).not.toContain('virar');
    expect(matLegalMoves(at('closed_guard', 'them'), 'you', ['collar_tie'])).not.toContain('virar');
    expect(UNLOCK_ORDER.some((u) => u.move === 'virar')).toBe(false);
  });

  it('lands in the guard with the escaper underneath, scores nothing and keeps the exchange (no farming the pass)', () => {
    const st: MatState = { ...at('mount', 'them'), actor: 'you', scored: ['them:mount'] };
    const r = resolveMat(st, 'you', 'virar', true);
    expect(r.state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    expect(r.points).toBe(0);
    expect(r.state.scored).toEqual(['them:mount']);
    // the stripe escape is the full recovery: it starts the exchange again
    expect(resolveMat(st, 'you', 'frame', true).state.scored).toEqual([]);
  });

  it('is stopped by Trava!, not by the guard brace, and the card says what it does without a position name', () => {
    const st = at('side_control', 'them');
    expect(defenseOf(st, 'you', 'virar')).toBe('trava');
    expect(braceBlocks({ ...st, brace: { you: null, them: 'recuperar' } }, 'you', 'virar')).toBe(false);
    expect(isEscape(st, 'you', 'virar')).toBe(true);
    expect(isEscape(at('closed_guard', 'them'), 'you', 'frame')).toBe(false);
    const card = offerCards({ ...st, actor: 'you' }, ['collar_tie', 'double_leg', 'passar', 'armbar'], null).find((c) => c.move === 'virar');
    expect(card).toMatchObject({ kind: 'defense', chain: 2, does: { pt: 'Sai de baixo', en: 'Gets out from under' } });
    expect(MOVE_LABEL.virar).toEqual({ pt: 'Virar', en: 'Turn over' });
  });

  it('the partner escapes when it is under, and still prefers a sweep once it is in the guard', () => {
    const ctx = { allowed: botMoves('branca', 'branca') };
    for (const kind of ['side_control', 'mount'] as const) {
      const st: MatState = { ...at(kind, 'you'), actor: 'them' };
      expect(planBot(st, ctx).move).toBe('virar');
    }
    const guard: MatState = { ...at('closed_guard', 'you'), actor: 'them' };
    expect(planBot(guard, ctx).move).toBe('hook_sweep');
  });
});

describe('mat diary words', () => {
  const HEADS = [
    'academia',
    'treino',
    'respeito',
    'água',
    'faixa',
    'kimono',
    'tatame',
    'treinar',
    'parceiro',
    'vestiário',
    'bebedouro',
    'toalha',
    'sapato',
    'meia',
    'tênis',
    'chinelo',
    'mochila',
    'chuveiro',
    'squeeze',
    'isotônico',
    'corda',
    'cronômetro',
    'apito',
    'placar',
    'medalha',
    'troféu',
    'pódio',
    'arquibancada',
    'bandeira',
    'presença',
    'sábado',
    'horário',
    'professora',
    'disciplina',
    'sorriso',
    'ajuda',
    'recepção',
    'armário',
    'entrada',
    'banheiro',
    'espelho',
    'cuidado',
    'emergência',
    'extintor',
    'prancheta',
    'boné',
  ];

  it('is the curriculum list, each id already a diary entry, with no second copy', () => {
    expect(MAT_WORD_IDS).toHaveLength(HEADS.length);
    expect(new Set(MAT_WORD_IDS).size).toBe(MAT_WORD_IDS.length);
    MAT_WORD_IDS.forEach((id, i) => {
      const w = diaryWord(id);
      expect(w, id).toBeTruthy();
      expect(w!.pt).toBe(HEADS[i]);
      expect(w!.needsBr).toBe(true);
      expect(w!.source).not.toBe('game');
    });
  });

  it('gives the first missing word on a win and nothing once the list is known', () => {
    expect(nextMatWord([])?.pt).toBe('academia');
    expect(nextMatWord(['diary.rua.academia'])?.pt).toBe('treino');
    const owned = MAT_WORD_IDS.map((id) => diaryWord(id)!.id);
    expect(nextMatWord(owned)).toBeNull();
    expect(nextMatWord(['diary.rua.academia', 'diary.academia.treino'])?.id).toBe('diary.academia.respeito');
  });
});

describe('drill placement', () => {
  it('puts the new move somewhere it is legal', () => {
    for (const u of UNLOCK_ORDER) {
      const pos = drillPosition(u.move);
      expect(moveLegal(pos, 'you', u.move), u.move).toBe(true);
    }
  });
});
