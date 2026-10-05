import { describe, expect, it } from 'vitest';
import { completeDrill, normalizeBjj, progressForWins, recordWin } from './academia.js';
import { diaryWord } from './diary.js';
import {
  MAT_TURNS,
  MAT_WORD_IDS,
  UNLOCK_ORDER,
  botMoves,
  chooseBot,
  drillPosition,
  fightMoves,
  matLegalMoves,
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

describe('position machine', () => {
  it('starts standing, and only standing moves plus hold are legal', () => {
    const st = newMat();
    expect(st.position).toEqual({ kind: 'standing' });
    expect(st.actor).toBe('you');
    const legal = matLegalMoves(st, 'you', ALL);
    expect(legal.sort()).toEqual(['body_lock', 'collar_tie', 'double_leg', 'hold', 'posture', 'single_leg', 'sleeve_grip', 'sprawl'].sort());
    expect(moveLegal(st.position, 'you', 'armbar')).toBe(false);
    expect(moveLegal(st.position, 'you', 'scissor_sweep')).toBe(false);
  });

  it('a takedown that lands moves to the named position and scores once', () => {
    const leg = resolveMat(newMat(), 'you', 'double_leg', 0, 'branca');
    expect(leg.success).toBe(true);
    expect(leg.points).toBe(2);
    expect(leg.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(leg.state.points.you).toBe(2);
    expect(leg.sound).toBe('whoosh');
    const trip = resolveMat(newMat(), 'you', 'body_lock', 0, 'branca');
    expect(trip.state.position).toEqual({ kind: 'closed_guard', top: 'you' });
    expect(trip.points).toBe(2);
  });

  it('a miss leaves the position and scores nothing', () => {
    const r = resolveMat(newMat(), 'you', 'double_leg', 0.99, 'branca');
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
    let st = resolveMat(newMat(), 'you', 'double_leg', 0, 'branca').state;
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

  it('grip bonuses stack once each and cap the next takedown at 95', () => {
    let st = resolveMat(newMat(), 'you', 'collar_tie', 0, 'branca').state;
    st = { ...st, actor: 'you' };
    st = resolveMat(st, 'you', 'sleeve_grip', 0, 'branca').state;
    expect(st.grips.you).toEqual({ collar: true, sleeve: true });
    expect(movePercent('double_leg', 'branca', 20)).toBe(65);
    expect(movePercent('double_leg', 'preta', 20)).toBe(95);
    expect(movePercent('body_lock', 'preta', 20)).toBe(95);
    expect(movePercent('single_leg', 'roxa', 20)).toBe(60);
    expect(movePercent('single_leg', 'branca', 20)).toBe(0);
    st = { ...st, actor: 'you' };
    const shot = resolveMat(st, 'you', 'double_leg', 0, 'branca');
    expect(shot.success).toBe(true);
    expect(shot.state.grips.you).toEqual({ collar: false, sleeve: false });
  });

  it('Gancho scores a sweep from closed guard, and Postura only breaks the grip', () => {
    const swept = resolveMat({ ...newMat(), position: { kind: 'closed_guard', top: 'them' } }, 'you', 'hook_sweep', 0, 'branca');
    expect(swept.success).toBe(true);
    expect(swept.points).toBe(2);
    expect(swept.state.position).toEqual({ kind: 'side_control', top: 'you' });
    expect(moveLegal(newMat().position, 'you', 'hook_sweep')).toBe(false);
    let st = resolveMat(newMat(), 'you', 'collar_tie', 0, 'branca').state;
    st = { ...st, actor: 'you' };
    const up = resolveMat(st, 'you', 'posture', 0, 'branca');
    expect(up.points).toBe(0);
    expect(up.state.position).toEqual({ kind: 'standing' });
    expect(up.state.grips.you).toEqual({ collar: false, sleeve: false });
    expect(up.state.scored).toEqual(st.scored);
  });

  it('sprawl clears grips and stands both fighters up', () => {
    let st = resolveMat(newMat(), 'you', 'collar_tie', 0, 'branca').state;
    st = { ...st, actor: 'you' };
    const r = resolveMat(st, 'you', 'sprawl', 0, 'branca');
    expect(r.state.position).toEqual({ kind: 'standing' });
    expect(r.state.grips.you).toEqual({ collar: false, sleeve: false });
    expect(r.points).toBe(0);
  });

  it('Passar leaves the Queda position for mount, and the top of guard for side control', () => {
    const afterQueda = resolveMat(newMat(), 'you', 'double_leg', 0, 'branca').state;
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
    const afterQueda = resolveMat(newMat(), 'you', 'double_leg', 0, 'branca').state;
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
    const ankle = resolveMat(newMat(), 'you', 'single_leg', 0, 'roxa');
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
    expect(lower).toEqual(['collar_tie']);
  });

  it('same belt: each fighter is limited to the moves they personally have', () => {
    expect(fightMoves({ belt: 'azul', unlocked: ['collar_tie', 'sleeve_grip'], opponentBelt: 'azul' })).toEqual(['collar_tie', 'sleeve_grip']);
    expect(botMoves('branca', 'branca')).toEqual(rankPool('branca'));
    expect(botMoves('marrom', 'branca')).toEqual(rankPool('branca'));
  });
});

describe('bot policy', () => {
  it('a white belt grips, then shoots the higher-percent takedown', () => {
    const belt = 'branca' as const;
    const allowed = botMoves(belt, belt);
    expect(chooseBot(newMat(), belt, allowed)).toBe('collar_tie');
    const gripped: MatState = { ...newMat(), grips: { you: { collar: false, sleeve: false }, them: { collar: true, sleeve: true } }, actor: 'them' };
    expect(chooseBot(gripped, belt, allowed)).toBe('body_lock');
    const side: MatState = { ...newMat(), position: { kind: 'side_control', top: 'you' } };
    expect(chooseBot(side, belt, allowed)).toBe('passar');
  });

  it('a blue belt sweeps, and armbars only when that finish is the best answer to a losing match', () => {
    const bottom: MatState = { ...newMat(), position: { kind: 'closed_guard', top: 'you' }, actor: 'them' };
    expect(chooseBot(bottom, 'azul', botMoves('azul', 'azul'))).toBe('hip_bump');
    const losing: MatState = { ...newMat(), position: { kind: 'mount', top: 'them' }, actor: 'them', points: { you: 4, them: 0 } };
    expect(chooseBot(losing, 'azul', botMoves('azul', 'azul'))).toBe('armbar');
    const ahead: MatState = { ...losing, points: { you: 0, them: 4 } };
    expect(chooseBot(ahead, 'azul', botMoves('azul', 'azul'))).toBe('hold');
  });

  it('from purple up, Americana and the choke wait until the bot is behind with two turns left', () => {
    const guard: MatState = { ...newMat(), position: { kind: 'closed_guard', top: 'them' }, actor: 'them', points: { you: 4, them: 0 }, turnsUsed: 8 };
    expect(chooseBot(guard, 'roxa', botMoves('roxa', 'roxa'))).toBe('americana');
    const early: MatState = { ...newMat(), position: { kind: 'mount', top: 'them' }, actor: 'them', points: { you: 4, them: 0 }, turnsUsed: 0 };
    expect(chooseBot(early, 'roxa', botMoves('roxa', 'roxa'))).toBe('armbar');
    const back: MatState = { ...newMat(), position: { kind: 'back_control', top: 'them' }, actor: 'them', points: { you: 2, them: 0 }, turnsUsed: 9 };
    expect(chooseBot(back, 'marrom', botMoves('marrom', 'marrom'))).toBe('rnc');
    // with turns to spare the armbar is the higher-percent finish, so the choke waits
    expect(chooseBot({ ...back, turnsUsed: 0 }, 'marrom', botMoves('marrom', 'marrom'))).toBe('armbar');
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
