import { describe, expect, it } from 'vitest';
import { completeDrill, normalizeBjj, partnerById, progressForWins, recordWin } from './academia.js';
import { diaryWord } from './diary.js';
import {
  BRACE_CUT,
  COLLAR_QUEDA,
  COMBOS,
  LONE_COLLAR_PUNISH,
  MAT_TURNS,
  MAT_WORD_IDS,
  SLEEVE_SHIELD,
  SLEEVE_SWEEP,
  TIRED_MALUS,
  UNLOCK_ORDER,
  botCommit,
  botMoves,
  chooseBot,
  drillPosition,
  fightMoves,
  gripNeed,
  isSubmission,
  isTakedown,
  matEffect,
  matLegalMoves,
  matMeter,
  matOdds,
  matStyle,
  moveSetsUp,
  planAnswers,
  planBot,
  planLine,
  planStands,
  withCombos,
  type GripFlags,
  type MatStyle,
  thinkMsFor,
  moveLegal,
  movePercent,
  moveTaughtAt,
  newMat,
  nextMatWord,
  rankPool,
  resolveMat,
  type MatMoveId,
  type MatState,
} from './matFight.js';

const ALL: MatMoveId[] = [
  'collar_tie',
  'sleeve_grip',
  'double_leg',
  'body_lock',
  'single_leg',
  'collar_drag',
  'sleeve_pull',
  'hip_throw',
  'hook_sweep',
  'scissor_sweep',
  'hip_bump',
  'posture',
  'passar',
  'knee_on_belly',
  'back_take',
  'sprawl',
  'frame',
  'escape_back',
  'armbar',
  'americana',
  'rnc',
  'hold',
];

/** You hold the collar, your turn. */
const GRIPPED: MatState = { ...newMat(), grips: { you: { collar: true, sleeve: false }, them: { collar: false, sleeve: false } } };
const grips = (you: Partial<GripFlags>, them: Partial<GripFlags> = {}): MatState['grips'] => ({
  you: { collar: false, sleeve: false, ...you },
  them: { collar: false, sleeve: false, ...them },
});

describe('position machine', () => {
  it('starts standing: grips and defenses are open, every throw waits for a grip', () => {
    const st = newMat();
    expect(st.position).toEqual({ kind: 'standing' });
    expect(st.actor).toBe('you');
    const legal = matLegalMoves(st, 'you', ALL);
    expect(legal.sort()).toEqual(['collar_tie', 'hold', 'posture', 'sleeve_grip', 'sprawl'].sort());
    expect(moveLegal(st.position, 'you', 'armbar')).toBe(false);
    expect(moveLegal(st.position, 'you', 'scissor_sweep')).toBe(false);
    expect(gripNeed(st, 'you', 'double_leg')).toEqual({ pt: 'Precisa de uma pegada', en: 'Needs a grip' });
    expect(gripNeed(st, 'you', 'hip_throw')?.pt).toBe('Precisa da gola e da manga');
    expect(resolveMat(st, 'you', 'double_leg', 0, 'branca').ok).toBe(false);
  });

  it('a takedown that lands moves to the named position and scores once', () => {
    const leg = resolveMat(GRIPPED, 'you', 'double_leg', 0, 'branca');
    expect(leg.success).toBe(true);
    expect(leg.points).toBe(2);
    expect(leg.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(leg.state.points.you).toBe(2);
    expect(leg.sound).toBe('whoosh');
    const trip = resolveMat(GRIPPED, 'you', 'body_lock', 0, 'branca');
    expect(trip.state.position).toEqual({ kind: 'closed_guard', top: 'you' });
    expect(trip.points).toBe(2);
  });

  it('a miss leaves the position and scores nothing, and the throw spends its grips', () => {
    const r = resolveMat(GRIPPED, 'you', 'double_leg', 0.99, 'branca');
    expect(r.state.grips.you).toEqual({ collar: false, sleeve: false });
    expect(r.success).toBe(false);
    expect(r.points).toBe(0);
    expect(r.state.position).toEqual({ kind: 'standing' });
    expect(r.state.actor).toBe('them');
    expect(r.state.points).toEqual({ you: 0, them: 0 });
  });

  it('a missed submission dumps the attacker to closed guard on the bottom', () => {
    const mount: MatState = { ...newMat(), position: { kind: 'mount', top: 'you' } };
    const r = resolveMat(mount, 'you', 'armbar', 0.99, 'azul');
    expect(r.success).toBe(false);
    expect(r.sound).toBe('sub');
    expect(r.state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    expect(r.state.points.you).toBe(0);
    expect(r.submission).toBe(false);
  });

  it('a landed submission ends the match at once', () => {
    const mount: MatState = { ...newMat(), position: { kind: 'mount', top: 'you' }, points: { you: 0, them: 6 } };
    const r = resolveMat(mount, 'you', 'armbar', 0, 'azul');
    expect(r.submission).toBe(true);
    expect(r.state.over).toBe(true);
    expect(r.state.winner).toBe('you');
    expect(r.state.reason).toBe('submission');
    expect(r.state.turnsUsed).toBe(1);
  });

  it('hold is certain, scores nothing, and keeps the position', () => {
    const st: MatState = { ...newMat(), position: { kind: 'mount', top: 'you' }, points: { you: 4, them: 0 } };
    const r = resolveMat(st, 'you', 'hold', 0.99, 'branca');
    expect(r.success).toBe(true);
    expect(r.points).toBe(0);
    expect(r.sound).toBe('none');
    expect(r.state.position).toEqual({ kind: 'mount', top: 'you' });
  });

  it('pays a new position once per exchange, then again after a reset', () => {
    let st = resolveMat(GRIPPED, 'you', 'double_leg', 0, 'branca').state;
    expect(st.points.you).toBe(2);
    st = { ...st, actor: 'you', position: { kind: 'closed_guard', top: 'them' } };
    const again = resolveMat(st, 'you', 'hip_bump', 0, 'azul');
    expect(again.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(again.points).toBe(0);
    const swept = resolveMat({ ...newMat(), position: { kind: 'closed_guard', top: 'them' } }, 'you', 'scissor_sweep', 0, 'azul');
    expect(swept.state.position).toEqual({ kind: 'mount', top: 'you' });
    expect(swept.points).toBe(2);
    expect(swept.sound).toBe('mount');
  });

  it('Gancho scores a sweep from closed guard; Postura breaks one of their grips and keeps the position', () => {
    const swept = resolveMat({ ...newMat(), position: { kind: 'closed_guard', top: 'them' } }, 'you', 'hook_sweep', 0, 'branca');
    expect(swept.success).toBe(true);
    expect(swept.points).toBe(2);
    expect(swept.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(moveLegal(newMat().position, 'you', 'hook_sweep')).toBe(false);
    const st: MatState = { ...newMat(), grips: grips({ collar: true }, { collar: true, sleeve: true }) };
    const up = resolveMat(st, 'you', 'posture', 0, 'branca');
    expect(up.points).toBe(0);
    expect(up.state.position).toEqual({ kind: 'standing' });
    // the collar goes first; your own grip stays
    expect(up.state.grips.them).toEqual({ collar: false, sleeve: true });
    expect(up.state.grips.you.collar).toBe(true);
    expect(up.events).toEqual([
      { kind: 'strip', side: 'you', grips: ['collar'] },
      { kind: 'brace', side: 'you', brace: 'postura' },
    ]);
    expect(up.state.brace.you).toBe('postura');
    expect(up.state.scored).toEqual(st.scored);
  });

  it('Base braces against the next takedown (or sweep, on top of guard) and keeps the grips', () => {
    const r = resolveMat(GRIPPED, 'you', 'sprawl', 0, 'branca');
    expect(r.state.position).toEqual({ kind: 'standing' });
    expect(r.state.grips.you).toEqual({ collar: true, sleeve: false });
    expect(r.state.brace.you).toBe('base');
    expect(r.points).toBe(0);
    expect(moveLegal({ kind: 'closed_guard', top: 'you' }, 'you', 'sprawl')).toBe(true);
    expect(moveLegal({ kind: 'side_control', top: 'you' }, 'you', 'sprawl')).toBe(false);
  });

  it('Passar leaves the Queda position for mount, and the top of guard for side control', () => {
    const afterQueda = resolveMat(GRIPPED, 'you', 'double_leg', 0, 'branca').state;
    expect(afterQueda.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(moveLegal(afterQueda.position, 'you', 'passar')).toBe(true);
    expect(moveLegal(afterQueda.position, 'you', 'armbar')).toBe(false);
    const passed = resolveMat({ ...afterQueda, actor: 'you' }, 'you', 'passar', 0, 'branca');
    expect(passed.points).toBe(3);
    expect(passed.line.pt).toBe('Três pontos!');
    expect(passed.state.position).toEqual({ kind: 'mount', top: 'you' });
    expect(moveLegal(passed.state.position, 'you', 'armbar')).toBe(true);
    const fromGuard = resolveMat({ ...newMat(), position: { kind: 'closed_guard', top: 'you' } }, 'you', 'passar', 0, 'branca');
    expect(fromGuard.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(fromGuard.points).toBe(3);
    const knee = resolveMat({ ...newMat(), position: { kind: 'knee_on_belly', top: 'you' } }, 'you', 'passar', 0, 'branca');
    expect(knee.state.position).toEqual({ kind: 'mount', top: 'you' });
    expect(moveLegal(newMat().position, 'you', 'passar')).toBe(false);
  });

  it('Joelho, Encaixe, and Tornozelo only fire from positions the match can reach', () => {
    const afterQueda = resolveMat(GRIPPED, 'you', 'double_leg', 0, 'branca').state;
    expect(moveLegal(afterQueda.position, 'you', 'knee_on_belly')).toBe(true);
    expect(moveLegal(afterQueda.position, 'you', 'back_take')).toBe(true);
    expect(moveLegal(newMat().position, 'you', 'knee_on_belly')).toBe(false);
    expect(moveLegal(newMat().position, 'you', 'back_take')).toBe(false);
    const knee = resolveMat({ ...afterQueda, actor: 'you' }, 'you', 'knee_on_belly', 0, 'branca');
    expect(knee.points).toBe(2);
    expect(knee.state.position).toEqual({ kind: 'knee_on_belly', top: 'you' });
    const mount = resolveMat({ ...knee.state, actor: 'you' }, 'you', 'passar', 0, 'branca');
    expect(mount.state.position).toEqual({ kind: 'mount', top: 'you' });
    expect(moveLegal(mount.state.position, 'you', 'armbar')).toBe(true);
    const back = resolveMat({ ...mount.state, actor: 'you' }, 'you', 'back_take', 0, 'roxa');
    expect(back.points).toBe(4);
    expect(back.line.pt).toBe('Quatro pontos!');
    expect(back.state.position).toEqual({ kind: 'back_control', top: 'you' });
    expect(moveLegal(back.state.position, 'you', 'rnc')).toBe(true);
    expect(moveLegal(back.state.position, 'them', 'escape_back')).toBe(true);
    const ankle = resolveMat(GRIPPED, 'you', 'single_leg', 0, 'roxa');
    expect(ankle.points).toBe(2);
    expect(ankle.state.position).toEqual({ kind: 'knee_on_belly', top: 'you' });
    expect(ankle.state.grips.you).toEqual({ collar: false, sleeve: false });
    expect(movePercent('back_take', 'azul')).toBe(0);
    expect(movePercent('knee_on_belly', 'branca')).toBe(44);
  });

  it('frame and escape return the bottom player to closed guard', () => {
    const side = resolveMat({ ...newMat(), position: { kind: 'side_control', top: 'them' } }, 'you', 'frame', 0, 'azul');
    expect(side.state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    const back = resolveMat({ ...newMat(), position: { kind: 'back_control', top: 'them' } }, 'you', 'escape_back', 0, 'azul');
    expect(back.state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    expect(moveLegal({ kind: 'knee_on_belly', top: 'them' }, 'you', 'frame')).toBe(true);
    expect(moveLegal({ kind: 'mount', top: 'them' }, 'you', 'frame')).toBe(true);
    expect(moveLegal({ kind: 'back_control', top: 'you' }, 'you', 'rnc')).toBe(true);
    expect(moveLegal({ kind: 'closed_guard', top: 'you' }, 'you', 'americana')).toBe(true);
  });
});

describe('percent table', () => {
  const table: Record<Exclude<MatMoveId, 'hold'>, number[]> = {
    collar_tie: [70, 78, 84, 90, 94],
    sleeve_grip: [65, 74, 82, 88, 93],
    double_leg: [45, 55, 65, 74, 82],
    body_lock: [50, 60, 70, 78, 85],
    single_leg: [0, 0, 40, 52, 64],
    collar_drag: [55, 64, 72, 80, 86],
    sleeve_pull: [80, 85, 89, 92, 94],
    hip_throw: [75, 80, 85, 90, 93],
    hook_sweep: [38, 50, 62, 72, 80],
    scissor_sweep: [40, 52, 64, 74, 82],
    hip_bump: [48, 58, 68, 76, 84],
    posture: [55, 66, 76, 84, 90],
    passar: [50, 62, 72, 80, 88],
    knee_on_belly: [44, 56, 66, 76, 84],
    back_take: [0, 0, 36, 50, 64],
    sprawl: [60, 70, 78, 85, 90],
    frame: [35, 48, 60, 72, 82],
    escape_back: [25, 38, 52, 66, 78],
    armbar: [18, 30, 42, 55, 68],
    americana: [0, 22, 28, 44, 60],
    rnc: [0, 0, 24, 36, 55],
  };
  const belts = ['branca', 'azul', 'roxa', 'marrom', 'preta'] as const;

  it('matches the belt table, with zeros where a submission is still locked', () => {
    for (const [id, row] of Object.entries(table) as [Exclude<MatMoveId, 'hold'>, number[]][]) {
      belts.forEach((belt, i) => expect(movePercent(id, belt), `${id} ${belt}`).toBe(row[i]));
    }
    expect(movePercent('hold', 'branca')).toBe(100);
  });
});

describe('10-turn winner', () => {
  it('the higher score wins when the tenth turn is not a submission, and a tie is a draw', () => {
    const ahead = resolveMat({ ...newMat(), points: { you: 4, them: 2 }, turnsUsed: 9 }, 'you', 'hold', 0, 'branca');
    expect(ahead.state.turnsUsed).toBe(MAT_TURNS);
    expect(ahead.state.over).toBe(true);
    expect(ahead.state.winner).toBe('you');
    expect(ahead.state.reason).toBe('points');
    const tied = resolveMat({ ...newMat(), points: { you: 2, them: 2 }, turnsUsed: 9 }, 'you', 'hold', 0.2, 'branca');
    expect(tied.state.winner).toBe('draw');
    expect(tied.state.reason).toBe('draw');
    const behind = resolveMat({ ...newMat(), points: { you: 0, them: 2 }, turnsUsed: 9, actor: 'them' }, 'them', 'hold', 0, 'branca');
    expect(behind.state.winner).toBe('them');
  });

  it('a submission on the last turn still wins, even from behind', () => {
    const st: MatState = { ...newMat(), position: { kind: 'mount', top: 'you' }, points: { you: 0, them: 8 }, turnsUsed: 9 };
    const r = resolveMat(st, 'you', 'armbar', 0, 'azul');
    expect(r.state.winner).toBe('you');
    expect(r.state.reason).toBe('submission');
    expect(r.state.turnsUsed).toBe(10);
  });

  it('ten holds from 0-0 are a draw and do not run an eleventh turn', () => {
    let st = newMat();
    for (let i = 0; i < MAT_TURNS; i++) {
      const r = resolveMat(st, st.actor, 'hold', 0.5, 'branca');
      st = r.state;
    }
    expect(st.over).toBe(true);
    expect(st.winner).toBe('draw');
    const extra = resolveMat(st, 'you', 'hold', 0, 'branca');
    expect(extra.ok).toBe(false);
    expect(extra.state.turnsUsed).toBe(10);
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
  it('a brown belt against a white belt only gets the white pool, at brown percents', () => {
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
    expect(movePercent('double_leg', 'marrom')).toBe(74);
    expect(movePercent('double_leg', 'branca')).toBe(45);
    expect(movePercent('armbar', 'marrom')).toBe(55);
    expect(movePercent('armbar', 'branca')).toBe(18);
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
    expect(botMoves('branca', 'branca')).toEqual(withCombos(rankPool('branca')));
    expect(botMoves('marrom', 'branca')).toEqual(withCombos(rankPool('branca')));
    // the combos are never stripe awards
    for (const c of COMBOS) expect(UNLOCK_ORDER.some((u) => u.move === c.move)).toBe(false);
  });
});

describe('grips are strategy', () => {
  it('Gola: Queda +25 and opens Arrastar, which lands behind them for two', () => {
    expect(matOdds(GRIPPED, 'you', 'double_leg', 'branca')).toEqual({ percent: 70, base: 45, parts: [{ pt: 'Gola', en: 'Collar', delta: COLLAR_QUEDA }] });
    expect(matLegalMoves(GRIPPED, 'you', ['collar_tie', 'double_leg'])).toContain('collar_drag');
    const drag = resolveMat(GRIPPED, 'you', 'collar_drag', 0, 'branca');
    expect(drag.points).toBe(2);
    expect(drag.state.position).toEqual({ kind: 'back_control', top: 'you' });
    expect(drag.state.grips.you).toEqual({ collar: false, sleeve: false });
  });

  it('a lone collar is punished: their Abraço gets +15, even with no grip of their own', () => {
    const theirTurn: MatState = { ...GRIPPED, actor: 'them' };
    expect(matLegalMoves(theirTurn, 'them', ['body_lock', 'double_leg'])).toEqual(['body_lock', 'hold']);
    expect(matOdds(theirTurn, 'them', 'body_lock', 'branca').percent).toBe(50 + LONE_COLLAR_PUNISH);
    // add the sleeve: the collar is no longer alone, and the sleeve shields you
    const both: MatState = { ...theirTurn, grips: grips({ collar: true, sleeve: true }) };
    expect(matOdds(both, 'them', 'body_lock', 'branca').percent).toBe(50 - SLEEVE_SHIELD);
  });

  it('Manga shields you (−20 on their throws), opens Puxar, and Puxar keeps the sleeve for a +20 sweep', () => {
    const st: MatState = { ...newMat(), actor: 'them', grips: grips({ sleeve: true }, { collar: true }) };
    expect(matOdds(st, 'them', 'double_leg', 'branca').parts).toEqual([
      { pt: 'Gola', en: 'Collar', delta: COLLAR_QUEDA },
      { pt: 'Manga dele', en: 'Their sleeve', delta: -SLEEVE_SHIELD },
    ]);
    expect(matOdds(st, 'them', 'double_leg', 'branca').percent).toBe(50);
    const mine: MatState = { ...newMat(), grips: grips({ sleeve: true }) };
    const pull = resolveMat(mine, 'you', 'sleeve_pull', 0, 'branca');
    expect(pull.points).toBe(0);
    expect(pull.state.position).toEqual({ kind: 'closed_guard', top: 'them' });
    expect(pull.state.grips.you.sleeve).toBe(true);
    const back: MatState = { ...pull.state, actor: 'you' };
    expect(matOdds(back, 'you', 'hook_sweep', 'branca').percent).toBe(38 + SLEEVE_SWEEP);
    // the sleeve still shields you on the bottom
    expect(matOdds(pull.state, 'them', 'passar', 'branca').percent).toBe(50 - SLEEVE_SHIELD);
  });

  it('both grips open Arremesso, the strongest throw, which lands on top with the knee', () => {
    const both: MatState = { ...newMat(), grips: grips({ collar: true, sleeve: true }) };
    const legal = matLegalMoves(both, 'you', ['collar_tie', 'sleeve_grip', 'double_leg']);
    expect(legal).toEqual(expect.arrayContaining(['hip_throw', 'collar_drag', 'sleeve_pull', 'double_leg']));
    const pct = (id: MatMoveId) => matOdds(both, 'you', id, 'branca').percent;
    expect(pct('hip_throw')).toBeGreaterThan(pct('double_leg'));
    expect(pct('hip_throw')).toBeGreaterThan(pct('collar_drag'));
    const t = resolveMat(both, 'you', 'hip_throw', 0, 'branca');
    expect(t.points).toBe(2);
    expect(t.state.position).toEqual({ kind: 'knee_on_belly', top: 'you' });
  });

  it('an attack into a brace is cut, and a miss into it is an advantage for the defender', () => {
    const braced: MatState = { ...newMat(), actor: 'them', grips: grips({}, { collar: true }), brace: { you: 'base', them: null } };
    expect(matOdds(braced, 'them', 'double_leg', 'branca').percent).toBe(45 + COLLAR_QUEDA - BRACE_CUT.base.queda!);
    const miss = resolveMat(braced, 'them', 'double_leg', 0.99, 'branca');
    expect(miss.state.adv).toEqual({ you: 1, them: 0 });
    expect(miss.events).toContainEqual({ kind: 'blocked', side: 'you' });
    expect(miss.line.pt).toBe('Vantagem!');
    // the brace waited for this move only
    expect(miss.state.brace.you).toBeNull();
    // a grip into Postura is cut by 30
    const posture: MatState = { ...newMat(), actor: 'them', brace: { you: 'postura', them: null } };
    expect(matOdds(posture, 'them', 'collar_tie', 'branca').percent).toBe(70 - 30);
  });

  it('a grip held through three of your turns slips, and you are tired (−10) for one move', () => {
    let st = resolveMat(newMat(), 'you', 'collar_tie', 0, 'branca').state;
    expect(st.gripAge.you.collar).toBe(1);
    st = resolveMat(st, 'them', 'hold', 0, 'branca').state;
    st = resolveMat(st, 'you', 'hold', 0, 'branca').state;
    expect(st.grips.you.collar).toBe(true);
    st = resolveMat(st, 'them', 'hold', 0, 'branca').state;
    const slip = resolveMat(st, 'you', 'hold', 0, 'branca');
    expect(slip.state.grips.you.collar).toBe(false);
    expect(slip.events).toContainEqual({ kind: 'slip', side: 'you', grips: ['collar'] });
    expect(slip.state.tired.you).toBe(true);
    const next = { ...slip.state, actor: 'you' as const };
    expect(matOdds(next, 'you', 'collar_tie', 'branca').parts).toContainEqual({ pt: 'Cansaço', en: 'Tired', delta: -TIRED_MALUS });
    expect(resolveMat(next, 'you', 'collar_tie', 0, 'branca').state.tired.you).toBe(false);
  });

  it('advantages break a points tie at the bell', () => {
    const r = resolveMat({ ...newMat(), points: { you: 2, them: 2 }, adv: { you: 0, them: 1 }, turnsUsed: 9 }, 'you', 'hold', 0, 'branca');
    expect(r.state.winner).toBe('them');
    expect(r.state.reason).toBe('advantages');
  });

  it('the meter swings with every answer: a grip, a strip, a throw, a miss', () => {
    const start = matMeter(newMat());
    expect(start).toBe(0);
    const grip = resolveMat(newMat(), 'you', 'collar_tie', 0, 'branca');
    expect(grip.meterTo).toBeGreaterThan(grip.meterFrom);
    const miss = resolveMat(newMat(), 'you', 'collar_tie', 0.99, 'branca');
    expect(miss.meterTo).toBeLessThan(miss.meterFrom);
    const throwIt = resolveMat(GRIPPED, 'you', 'double_leg', 0, 'branca');
    expect(throwIt.meterTo).toBeGreaterThan(30);
    const strip = resolveMat({ ...newMat(), actor: 'them', grips: grips({ collar: true }) }, 'them', 'posture', 0, 'branca');
    expect(strip.meterTo).toBeLessThan(strip.meterFrom);
    expect(matMeter({ ...newMat(), position: { kind: 'back_control', top: 'them' } })).toBeLessThan(-60);
  });

  it('every setup says what it opens; a throw does not (its card shows points)', () => {
    expect(moveSetsUp(newMat(), 'you', 'collar_tie')?.pt).toBe('Queda +25% · abre Arrastar');
    expect(moveSetsUp(GRIPPED, 'you', 'sleeve_grip')?.pt).toBe('Abre o Arremesso · protege você');
    expect(moveSetsUp(newMat(), 'you', 'sleeve_grip')?.pt).toBe('Protege você · abre Puxar');
    expect(moveSetsUp({ ...newMat(), grips: grips({}, { collar: true }) }, 'you', 'posture')?.pt).toBe('Solta as pegadas dele');
    expect(moveSetsUp(newMat(), 'you', 'sprawl')?.pt).toBe('Trava a queda dele');
    expect(moveSetsUp(GRIPPED, 'you', 'double_leg')).toBeNull();
  });
});

describe('the partner telegraphs', () => {
  const all = botMoves('branca', 'branca');

  it('opens with a grip, never a throw it cannot make', () => {
    const plan = planBot(newMat(), 'branca', all, undefined, all);
    expect(['collar_tie', 'sleeve_grip', 'posture', 'sprawl']).toContain(plan.move);
    expect(['gola', 'manga', 'soltar', 'base']).toContain(plan.kind);
  });

  it('punishes a lone collar, and the answers to that are flagged', () => {
    const st: MatState = { ...GRIPPED, actor: 'them' };
    const plan = planBot(st, 'branca', all, undefined, all);
    expect(plan).toEqual({ move: 'body_lock', kind: 'contra' });
    expect(planLine(plan.kind, 'Mateus')).toEqual({ pt: 'Mateus vai castigar a sua gola sozinha.', en: 'Mateus will punish your lone collar grip.' });
    const legal = matLegalMoves(GRIPPED, 'you', all);
    expect(planAnswers(GRIPPED, plan, legal)).toEqual(['sleeve_grip', 'sprawl', 'posture']);
  });

  it('with its grips in hand it throws the strongest throw they open', () => {
    const st: MatState = { ...newMat(), actor: 'them', grips: grips({}, { collar: true, sleeve: true }) };
    expect(planBot(st, 'branca', all, undefined, all)).toEqual({ move: 'hip_throw', kind: 'queda' });
  });

  it('keeps the telegraphed move unless your answer broke it', () => {
    const plan = { move: 'body_lock' as const, kind: 'contra' as const };
    const st: MatState = { ...GRIPPED, actor: 'them' };
    expect(botCommit(st, plan, 'branca', all, undefined, all)).toEqual({ move: 'body_lock', replanned: false });
    // your throw landed first: the plan is gone with the position
    const broke = resolveMat(GRIPPED, 'you', 'double_leg', 0, 'branca').state;
    const r = botCommit(broke, plan, 'branca', all, undefined, all);
    expect(r.replanned).toBe(true);
    expect(r.move).not.toBe('body_lock');
    expect(planStands(broke, plan, all)).toBe(false);
  });

  it('every telegraph line names the partner and avoids position and technique names', () => {
    const LOCK = /\b(oss|rola|guarda|montada|costas|armlock|kimura|triângulo|mata-leão)\b/i;
    for (const k of ['gola', 'manga', 'queda', 'contra', 'soltar', 'base', 'puxar', 'raspar', 'passar', 'subir', 'finalizar', 'sair', 'travar', 'segurar'] as const) {
      const l = planLine(k, 'Helena');
      expect(l.pt.startsWith('Helena ')).toBe(true);
      expect(l.en.startsWith('Helena ')).toBe(true);
      expect(l.pt).not.toMatch(LOCK);
    }
  });
});

describe('bot policy', () => {
  it('on top it passes; on the bottom of guard a blue belt sweeps', () => {
    const side: MatState = { ...newMat(), position: { kind: 'side_control', top: 'them' }, actor: 'them' };
    expect(['passar', 'knee_on_belly']).toContain(chooseBot(side, 'branca', botMoves('branca', 'branca')));
    const bottom: MatState = { ...newMat(), position: { kind: 'closed_guard', top: 'you' }, actor: 'them' };
    expect(['hook_sweep', 'scissor_sweep', 'hip_bump']).toContain(chooseBot(bottom, 'azul', botMoves('azul', 'azul')));
  });

  it('behind on its last move it goes for the finish', () => {
    const losing: MatState = { ...newMat(), position: { kind: 'mount', top: 'them' }, actor: 'them', points: { you: 4, them: 0 }, turnsUsed: 9 };
    expect(chooseBot(losing, 'azul', botMoves('azul', 'azul'))).toBe('armbar');
    const back: MatState = { ...newMat(), position: { kind: 'back_control', top: 'them' }, actor: 'them', points: { you: 2, them: 0 }, turnsUsed: 9 };
    expect(isSubmission(chooseBot(back, 'marrom', botMoves('marrom', 'marrom')))).toBe(true);
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

describe('polish: grips, partner styles, move effects', () => {
  it('a grip you already hold is not offered again, and cannot be played', () => {
    const st = resolveMat(newMat(), 'you', 'collar_tie', 0, 'branca').state;
    const back: MatState = { ...st, actor: 'you' };
    expect(matLegalMoves(back, 'you', ['collar_tie', 'sleeve_grip', 'double_leg'])).not.toContain('collar_tie');
    expect(matLegalMoves(back, 'you', ['collar_tie', 'sleeve_grip', 'double_leg'])).toContain('sleeve_grip');
    expect(resolveMat(back, 'you', 'collar_tie', 0, 'branca').ok).toBe(false);
  });

  it('the bot does not burn turns re-gripping', () => {
    const both: MatState = { ...newMat(), actor: 'them', grips: { you: { collar: false, sleeve: false }, them: { collar: true, sleeve: false } } };
    const pick = chooseBot(both, 'branca', botMoves('branca', 'branca'));
    expect(pick).not.toBe('collar_tie');
  });

  it('partners fight like their cards: pinned, Daniel gets out; with one grip, Felipe shoots sooner than Helena', () => {
    const daniel = matStyle(partnerById('daniel')!);
    const pinned: MatState = { ...newMat(), position: { kind: 'side_control', top: 'you' }, actor: 'them' };
    expect(chooseBot(pinned, 'azul', botMoves('azul', 'azul'), daniel)).toBe('frame');
    const felipe = matStyle(partnerById('felipe')!);
    const helena = matStyle(partnerById('helena')!);
    const pool = botMoves('branca', 'branca');
    // count how often each throws in the first moves of the same matches: the fast one throws at least as often
    const throwsOf = (s: MatStyle) => {
      let n = 0;
      for (const g of [grips({}, { collar: true }), grips({}, { sleeve: true }), grips({ sleeve: true }, { collar: true }), grips({ collar: true }, { sleeve: true })]) {
        if (isTakedown(chooseBot({ ...newMat(), actor: 'them', grips: g }, 'branca', pool, s))) n++;
      }
      return n;
    };
    expect(throwsOf(felipe)).toBeGreaterThanOrEqual(throwsOf(helena));
  });

  it('accuracy is an edge on the odds; speed sets a think time inside 2-5 s', () => {
    expect(matStyle(partnerById('mateus')!).edge).toBe(0);
    expect(matStyle(partnerById('helena')!).edge).toBeGreaterThan(5);
    // a 70% takedown at roll 0.75 misses plain, lands with Helena's edge
    expect(resolveMat(GRIPPED, 'you', 'double_leg', 0.75, 'branca').success).toBe(false);
    expect(resolveMat(GRIPPED, 'you', 'double_leg', 0.75, 'branca', false, matStyle(partnerById('helena')!).edge).success).toBe(true);
    const felipe = thinkMsFor(matStyle(partnerById('felipe')!));
    const helena = thinkMsFor(matStyle(partnerById('helena')!));
    expect(felipe).toBeLessThan(helena);
    for (const t of [felipe, helena, thinkMsFor(null)]) expect(t >= 2000 && t <= 5000).toBe(true);
  });

  it('matEffect says what a move does if it lands', () => {
    expect(matEffect(newMat(), 'you', 'double_leg')).toMatchObject({ points: 2, to: 'cem_quilos', toAhead: 'you', submission: false });
    const mount: MatState = { ...newMat(), position: { kind: 'mount', top: 'you' } };
    expect(matEffect(mount, 'you', 'armbar')).toMatchObject({ submission: true, riskBottom: true });
    expect(matEffect(newMat(), 'you', 'collar_tie')).toMatchObject({ points: 0, to: 'de_pe' });
  });
});
