import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS, COMMAND_LABEL, DEFENSES, DEFENSE_LABEL, MAT_CALLS, MOVE_LABEL, REF_LINES, type BoutServerMsg, type BoutSnapshot } from '@tudobem/shared';
import {
  BIA_LINES,
  COACH_NOTES,
  COMMAND_PAD,
  PAD_COACH_NOTES,
  DEFENSE_FOR,
  DEFENSE_PAD,
  DRILL_LINE,
  callOf,
  boutStageView,
  chainGrade,
  chevrons,
  coachNote,
  coachTip,
  crowdForResolve,
  cuesForEnd,
  cuesForGrip,
  cuesForResolve,
  defenseAnswer,
  gripEventLine,
  gripLife,
  groundRead,
  matGlossLocked,
  matRootClass,
  meterFrac,
  padBeat,
  padDots,
  padExpired,
  padKey,
  padLabel,
  padPerfect,
  padTap,
  padTimeout,
  posLine,
  resolveLine,
  resolveSpeech,
  ringFrac,
  stepDots,
  windupFrame,
} from './boutLogic';

type Resolve = Extract<BoutServerMsg, { phase: 'resolve' }>;
type End = Extract<BoutServerMsg, { phase: 'end' }>;

const snap = (over: Partial<BoutSnapshot> = {}): BoutSnapshot => ({ rung: 0, points: { you: 0, partner: 0 }, adv: { you: 0, partner: 0 }, clockMs: 120_000, exchange: 1, turns: 16, position: 'de_pe', ahead: null, ...over });
const resolve = (over: Partial<Resolve> = {}): Resolve => ({
  t: 'bout',
  v: 2,
  phase: 'resolve',
  seq: 1,
  st: snap(),
  actor: 'you',
  move: 'double_leg',
  landed: true,
  how: 'landed',
  points: 0,
  events: [],
  holdMs: 900,
  from: 'de_pe',
  aheadFrom: null,
  ...over,
});

/** Position and submission names the #49 lock keeps out of the overlay. */
const NAMES = /guarda|montada|costas|cem quilos|joelho na|kimura|triângulo|mata-leão|finaliza|submission|closed guard|half guard|side control|knee on belly|back control|\bmount\b|\boss\b|\brola\b|gracie/i;

describe('Verde glosses on the mat', () => {
  it('locks English on for Verde, and leaves every later plate behind bout-noen', () => {
    expect(matGlossLocked('verde')).toBe(true);
    expect(matGlossLocked(undefined)).toBe(true);
    expect(matRootClass('verde')).toBe('bout-root bout-v3');
    for (const plate of ['amarelo', 'azul', 'roxo', 'dourado'] as const) {
      expect(matGlossLocked(plate)).toBe(false);
      expect(matRootClass(plate)).toBe('bout-root bout-v3 bout-noen');
    }
  });

  it('every pad word, move name, coach note and tip carries an English gloss', () => {
    for (const w of [...COMMANDS, ...DEFENSES]) {
      const l = padLabel(w);
      expect(l.pt, w).toMatch(/!$/);
      expect(l.en.trim().length, w).toBeGreaterThan(0);
    }
    for (const [id, label] of Object.entries(MOVE_LABEL)) expect(label.en, id).not.toBe('');
    for (const note of [...Object.values(COACH_NOTES), ...Object.values(PAD_COACH_NOTES)]) {
      expect(note.en).not.toBe(note.pt);
      expect(`${note.pt} ${note.en}`).not.toMatch(NAMES);
    }
    const tips = [
      coachTip({ winner: 'you', reason: 'finalizacao', you: 2, them: 0, unlocked: [] }),
      coachTip({ winner: 'partner', reason: 'finalizacao', you: 0, them: 2, unlocked: [] }),
      coachTip({ winner: 'partner', reason: 'pontos', you: 0, them: 2, unlocked: [] }),
      coachTip({ winner: 'draw', reason: 'empate', you: 1, them: 1, unlocked: [] }),
      coachTip({ winner: 'you', reason: 'pontos', you: 4, them: 1, unlocked: ['armbar'] }),
      coachTip({ winner: 'you', reason: 'pontos', you: 4, them: 1, unlocked: [], perfect: 9 }),
      coachTip({ winner: 'you', reason: 'pontos', you: 0, them: 0, unlocked: ['double_leg'] }),
    ];
    for (const tip of tips) {
      expect(tip?.en.trim().length).toBeGreaterThan(0);
      expect(`${tip?.pt} ${tip?.en}`).not.toMatch(NAMES);
    }
    expect(coachTip({ winner: 'none', reason: 'quit', you: 0, them: 0, unlocked: [] })).toBeNull();
  });
});

describe('staging: the first matches show less', () => {
  it('cards are name and chevrons until the first win; the meters row waits for the first stripe; the pad for the third win', () => {
    const at = (wins: number, belt: 'branca' | 'azul' = 'branca', stripes = Math.floor(wins / 5)) => boutStageView({ belt, stripes, wins });
    expect(at(0)).toEqual({ meters: false, cardDetail: false, pad: false, coach: 'first' });
    expect(at(1)).toEqual({ meters: false, cardDetail: true, pad: false, coach: null });
    expect(at(2)).toEqual({ meters: false, cardDetail: true, pad: false, coach: null });
    expect(at(3)).toEqual({ meters: false, cardDetail: true, pad: true, coach: 'pad' });
    expect(at(4)).toEqual({ meters: false, cardDetail: true, pad: true, coach: null });
    expect(at(5)).toEqual({ meters: true, cardDetail: true, pad: true, coach: null });
    expect(at(20, 'azul', 0).meters).toBe(true);
    // no profile yet reads as the empty white belt
    expect(boutStageView(null)).toEqual(at(0));
  });

  it('the first match has two notes (no defense pad); the pad brings its own three; other matches none', () => {
    expect(coachNote('first', 'pick')).toEqual(COACH_NOTES.pick);
    expect(coachNote('first', 'chain')).toEqual(COACH_NOTES.chain);
    expect(coachNote('first', 'defend')).toBeNull();
    expect(Object.keys(PAD_COACH_NOTES).sort()).toEqual(['defend', 'pick', 'sai']);
    expect(coachNote('pad', 'pick')).toEqual(PAD_COACH_NOTES.pick);
    expect(coachNote('pad', 'defend')).toEqual(PAD_COACH_NOTES.defend);
    expect(coachNote('pad', 'sai')).toEqual(PAD_COACH_NOTES.sai);
    expect(coachNote('pad', 'chain')).toBeNull();
    expect(coachNote(null, 'pick')).toBeNull();
    // the Sai! note is the end card's tip after losing to a finish, word for word
    expect(PAD_COACH_NOTES.sai).toEqual(coachTip({ winner: 'partner', reason: 'finalizacao', you: 0, them: 2, unlocked: [] }));
  });
});

describe('the pads', () => {
  it('six commands and four defenses in the fixed order of the keys', () => {
    expect(COMMAND_PAD.map((c) => COMMAND_LABEL[c].pt)).toEqual(['Pega!', 'Puxa!', 'Empurra!', 'Gira!', 'Levanta!', 'Aperta!']);
    expect(DEFENSE_PAD.map((d) => DEFENSE_LABEL[d].pt)).toEqual(['Postura!', 'Base!', 'Trava!', 'Sai!']);
    expect(padKey('1', 6)).toBe(0);
    expect(padKey('6', 6)).toBe(5);
    expect(padKey('5', 4)).toBeNull();
    expect(padKey('h', 4)).toBeNull();
    expect(padKey('0', 6)).toBeNull();
  });

  it('a chain beat: hits move on, Perfeito inside 45% of the window, a wrong button ends it there', () => {
    let b = padBeat('chain', ['puxa', 'gira', 'levanta'], [2000, 2000, 2000]);
    expect(padDots(b)).toEqual(['here', 'todo', 'todo']);
    let r = padTap(b, 'puxa', 500);
    expect(r.grade).toBe('perfeito');
    b = r.beat;
    expect(b.step).toBe(1);
    expect(padDots(b)).toEqual(['done', 'here', 'todo']);
    r = padTap(b, 'gira', 1500);
    expect(r.grade).toBe('boa');
    b = r.beat;
    r = padTap(b, 'pega', 100);
    expect(r.grade).toBe('errou');
    expect(r.beat.over).toBe(true);
    expect(padDots(r.beat)).toEqual(['done', 'done', 'broke']);
    // nothing after the beat is over
    expect(padTap(r.beat, 'levanta', 100).grade).toBeNull();
  });

  it('the window running out is Tarde!; a late press is Tarde! too; all Perfeito is one step of Ritmo', () => {
    const b = padBeat('chain', ['pega'], [1000]);
    expect(padExpired(b, 900)).toBe(false);
    expect(padExpired(b, 1001)).toBe(true);
    const late = padTimeout(b);
    expect(late.over).toBe(true);
    expect(late.grades).toEqual(['tarde']);
    expect(padTap(b, 'pega', 1200).grade).toBe('tarde');
    const done = padTap(b, 'pega', 300).beat;
    expect(done.over).toBe(true);
    expect(padPerfect(done)).toBe(true);
    expect(padPerfect(padTap(b, 'pega', 800).beat)).toBe(false);
    expect(chainGrade(['perfeito', 'perfeito'])).toBe('perfeito');
    expect(chainGrade(['perfeito', 'boa'])).toBe('boa');
  });

  it('the drill has no clock: the wrong button is just not the next step, and it never runs out', () => {
    const b = padBeat('drill', ['pega', 'gira'], [0, 0]);
    expect(padExpired(b, 60_000)).toBe(false);
    const wrong = padTap(b, 'aperta', 10_000);
    expect(wrong.grade).toBeNull();
    expect(wrong.beat).toBe(b);
    const right = padTap(b, 'pega', 10_000);
    expect(right.grade).toBe('boa');
    expect(right.beat.step).toBe(1);
  });

  it('a defense beat: the Sai! mash is one press per window; the answer is Bia’s call, else what the attack needs', () => {
    let b = padBeat('defend', ['sai', 'sai', 'sai'], [900, 900, 900]);
    for (let i = 0; i < 3; i++) b = padTap(b, 'sai', 300).beat;
    expect(b.over).toBe(true);
    expect(b.grades).toHaveLength(3);
    expect(defenseAnswer({ call: 'base', attack: 'queda' })).toBe('base');
    expect(defenseAnswer({ attack: 'passagem' })).toBe('trava');
    expect(DEFENSE_FOR).toEqual({ pegada: 'postura', queda: 'base', raspagem: 'base', passagem: 'trava', final: 'sai' });
  });

  it('the wind-up builds a frame per command (0–3) and the chevrons are the chain length', () => {
    expect([0, 1, 2, 3].map((d) => windupFrame(d, 3))).toEqual([0, 1, 2, 3]);
    expect(windupFrame(1, 1)).toBe(3);
    expect(windupFrame(1, 4)).toBe(1);
    expect(windupFrame(4, 4)).toBe(3);
    expect(chevrons(1)).toBe('›');
    expect(chevrons(3)).toBe('›››');
    expect(stepDots(2, 0)).toEqual(['here', 'todo']);
    expect(ringFrac(0, 2000)).toBe(1);
    expect(ringFrac(1000, 2000)).toBe(0.5);
    expect(ringFrac(5000, 2000)).toBe(0);
    expect(ringFrac(100, 0)).toBe(1);
  });
});

describe('resolve and end cues', () => {
  it('points: Bia signals them, the crowd cheers the scorer, and her call is the line she speaks', () => {
    const m = resolve({ points: 2, say: REF_LINES.pontos2, events: [{ type: 'points', side: 'you', pts: 2, signal: 'pontos2', line: REF_LINES.pontos2 }] });
    expect(cuesForResolve(m)).toEqual([{ t: 'ref', signal: 'pontos2' }, { t: 'crowd', cue: 'points_you' }]);
    expect(resolveLine(m, 'Mateus').pt).toBe('Dois pontos!');
    expect(resolveSpeech(m)).toBe('Dois pontos!');
    expect(callOf(m)?.pt).toBe('Dois pontos!');
  });

  it('a defended attack is Defendeu! (and a Vantagem when it was worth points); a botch is Errou!; a hold is silent', () => {
    const def = resolve({ actor: 'partner', landed: false, how: 'defended', say: MAT_CALLS.vantagem, grip: [{ kind: 'defended', side: 'you', adv: true }], events: [{ type: 'advantage', side: 'you', signal: 'vantagem', line: REF_LINES.vantagem }] });
    expect(resolveSpeech(def)).toBe('Vantagem!');
    expect(crowdForResolve(def)).toBe('advantage');
    const plain = resolve({ actor: 'partner', landed: false, how: 'defended', say: MAT_CALLS.defendeu });
    expect(resolveLine(plain, 'Mateus').pt).toBe('Defendeu!');
    expect(crowdForResolve(plain)).toBe('escape');
    const botch = resolve({ actor: 'partner', landed: false, how: 'botched', say: MAT_CALLS.errou });
    expect(resolveLine(botch, 'Mateus').pt).toBe('Errou!');
    expect(resolveSpeech(botch)).toBe('Errou!');
    const hold = resolve({ actor: 'partner', move: 'hold', how: 'hold', say: MOVE_LABEL.hold });
    expect(resolveLine(hold, 'Mateus').pt).toBe('Mateus segura.');
    expect(resolveSpeech(hold)).toBeNull();
    const late = resolve({ landed: false, how: 'late', say: MAT_CALLS.errou, grades: ['perfeito', 'tarde'] });
    expect(resolveLine(late, 'Mateus').pt).toBe('Tarde!');
    expect(resolveSpeech(late)).toBe('Tarde!');
  });

  it('your landed chain with no call is graded aloud: Perfeito! when every tap was', () => {
    expect(resolveSpeech(resolve({ move: 'collar_tie', say: MOVE_LABEL.collar_tie, grades: ['perfeito'] }))).toBe('Perfeito!');
    expect(resolveSpeech(resolve({ move: 'collar_tie', say: MOVE_LABEL.collar_tie, grades: ['boa'] }))).toBe('Boa!');
    expect(resolveLine(resolve({ move: 'collar_tie', say: MOVE_LABEL.collar_tie }), 'Mateus').pt).toBe('Pegar a gola');
  });

  it('a Ritmo pops a Que ritmo! word and flashes; a throw that lands flashes harder; the ground reads gained or lost', () => {
    const m = resolve({ grip: [{ kind: 'ritmo', side: 'you' }], meterFrom: 0, meterTo: 20, events: [{ type: 'transition', from: 'de_pe', to: 'cem_quilos', rungFrom: 0, rungTo: 2, gain: 'you' }] });
    const cues = cuesForGrip(m, 'Mateus');
    expect(cues).toContainEqual({ t: 'flash', strength: 2 });
    expect(cues).toContainEqual({ t: 'pop', kind: 'vantagem', side: 'you', text: 'Que ritmo!' });
    expect(cues).toContainEqual({ t: 'ground', dir: 'gain', delta: 20 });
    expect(groundRead(10, 4).dir).toBe('loss');
    expect(groundRead(3, 3).dir).toBe('even');
    expect(meterFrac(0)).toBe(0.5);
    expect(meterFrac(-100)).toBe(0);
  });

  it('grip moments name the side that made them; a grip counts down to its slip', () => {
    expect(gripEventLine({ kind: 'grip', side: 'you', grip: 'collar' }, 'Mateus').pt).toBe('Pegou a gola!');
    expect(gripEventLine({ kind: 'strip', side: 'partner', grips: ['sleeve'] }, 'Mateus').pt).toBe('Mateus soltou a sua pegada!');
    expect(gripEventLine({ kind: 'defended', side: 'you', adv: false }, 'Mateus').pt).toBe('Defendeu!');
    expect(gripLife(0).left).toBe(3);
    expect(gripLife(2).pt).toBe('Vai escorregar!');
  });

  it('the end: a win raises a hand and Bia calls the victory; a quit shows nothing', () => {
    const end = (over: Partial<End>): End => ({
      t: 'bout',
      v: 2,
      phase: 'end',
      winner: 'you',
      reason: 'finalizacao',
      st: snap(),
      rv: 18,
      bjj: { belt: 'branca', stripes: 0, wins: 1, unlocked: [] },
      belt: 'branca',
      stripeUp: false,
      beltUp: false,
      bond: 3,
      line: { pt: 'Final! Vitória sua!', en: 'Finish! You win!' },
      thanks: { pt: 'Obrigado pela partida.', en: 'Thanks for the match.' },
      signal: 'vitoria',
      ...over,
    });
    expect(cuesForEnd(end({}))).toEqual([{ t: 'end', winner: 'you', reason: 'finalizacao' }, { t: 'ref', signal: 'vitoria' }, { t: 'crowd', cue: 'tap' }]);
    expect(cuesForEnd(end({ winner: 'none', reason: 'quit' }))).toEqual([]);
  });

  it('the position line says who is on top and how big the lead is, never a position name', () => {
    expect(posLine({ position: 'de_pe', ahead: null, rung: 0 }).pt).toBe('Em pé');
    expect(posLine({ position: 'cem_quilos', ahead: 'you', rung: 2 }).pt).toBe('Você por cima · Pressão');
    expect(posLine({ position: 'montada', ahead: 'partner', rung: -4 }).pt).toBe('Você por baixo · Final');
    for (const [position, rung] of [['guarda_fechada', 1], ['joelho', 3], ['costas', 4]] as const) {
      const l = posLine({ position, ahead: 'you', rung });
      expect(`${l.pt} ${l.en}`).not.toMatch(NAMES);
    }
  });
});

describe("Bia's voice on the mat", () => {
  it('speaks only her baked lines: the ten pad words, the grades, her calls, Combate!, Agora você. and the end lines', () => {
    for (const w of [...COMMANDS.map((c) => COMMAND_LABEL[c].pt), ...DEFENSES.map((d) => DEFENSE_LABEL[d].pt)]) expect(BIA_LINES).toContain(w);
    for (const l of ['Perfeito!', 'Boa!', 'Errou!', 'Tarde!', 'Defendeu!', 'Escapou!', 'Que ritmo!', 'Combate!', 'Dois pontos!', 'Vantagem!', 'Final!', DRILL_LINE.pt, 'Final! Vitória sua!', 'Vitória nos pontos!', 'Empate!']) {
      expect(BIA_LINES).toContain(l);
    }
    expect(new Set(BIA_LINES).size).toBe(BIA_LINES.length);
    expect(BIA_LINES.join(' | ')).not.toMatch(NAMES);
    // every line a resolve can speak is one of hers
    const samples: Partial<Resolve>[] = [
      { say: MAT_CALLS.final },
      { say: MAT_CALLS.four },
      { say: MAT_CALLS.three },
      { say: MAT_CALLS.escapou, landed: false, how: 'missed' },
      { say: MAT_CALLS.ritmo },
      { say: MOVE_LABEL.double_leg, grades: ['perfeito', 'perfeito'] },
      { say: MAT_CALLS.errou, landed: false, how: 'wrong' },
      { say: MAT_CALLS.errou, landed: false, how: 'late' },
      { actor: 'partner', say: MOVE_LABEL.passar, landed: true, how: 'landed' },
    ];
    for (const s of samples) {
      const said = resolveSpeech(resolve(s));
      if (said) expect(BIA_LINES, said).toContain(said);
    }
  });

  it('every one of her lines is listed for baking in content/tts/extra-lines.json as speaker prof', () => {
    const file = path.resolve(import.meta.dirname, '../../../../content/tts/extra-lines.json');
    const lines = (JSON.parse(fs.readFileSync(file, 'utf8')) as { lines: { speaker: string; text: string }[] }).lines;
    const prof = new Set(lines.filter((l) => l.speaker === 'prof').map((l) => l.text));
    expect(BIA_LINES.filter((l) => !prof.has(l))).toEqual([]);
  });
});
