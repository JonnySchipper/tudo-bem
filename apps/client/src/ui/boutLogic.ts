/**
 * Pure bits of the bout UI (no DOM, no Phaser): how the server's messages turn into stage cues, what the pads show, and the copy
 * the overlay prints. Unit tested (boutLogic.test.ts). Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md).
 */
import {
  COMMANDS,
  COMMAND_LABEL,
  DEFENSES,
  DEFENSE_LABEL,
  GRADE_LABEL,
  MAT_CALLS,
  REF_LINES,
  boutStepLabel,
  endLine,
  gradeTap,
  isHitGrade,
  type Bilingual,
  type BoutReason,
  type BoutSnapshot,
  type BoutWinner,
  type BoutServerMsg,
  type CrowdCue,
  type MatAttack,
  type MatCommand,
  type MatDefense,
  type Nameplate,
  type TapGrade,
} from '@tudobem/shared';
import type { StageCue } from '../render/pixel/boutFeed';
import { glossOn } from './correriaLogic';

type Msg<P extends BoutServerMsg['phase']> = Extract<BoutServerMsg, { phase: P }>;

/**
 * Verde (the beginner plate; Phase 0's only plate) locks English glosses on, the same rule as Correria's Verde level
 * (`glossOn` at level 0). Later plates keep the mat overlay's switch: glosses stay behind `bout-noen` until EN is on.
 */
export function matGlossLocked(nameplate: Nameplate | null | undefined): boolean {
  if (nameplate && nameplate !== 'verde') return false;
  return glossOn(0, false);
}

/** Root classes for the overlay. `bout-noen` hides every `.en` line. */
export function matRootClass(nameplate: Nameplate | null | undefined): string {
  return `bout-root bout-v3${matGlossLocked(nameplate) ? '' : ' bout-noen'}`;
}

// ---------------------------------------------------------------- the pads

/** The defense that stops an attack kind (what the telegraph means: queda → Base!). */
export const DEFENSE_FOR: Record<MatAttack, MatDefense> = { pegada: 'postura', queda: 'base', raspagem: 'base', passagem: 'trava', final: 'sai' };

/** The right answer to a defense beat: Bia's call at white belt, else what the attack kind needs. */
export const defenseAnswer = (m: Pick<Msg<'defend'>, 'call' | 'attack'>): MatDefense => m.call ?? DEFENSE_FOR[m.attack];

/** The chain length as chevrons on a card: › ›› ›››. */
export const chevrons = (n: number): string => '›'.repeat(Math.max(1, Math.min(6, Math.round(n))));

export type DotState = 'done' | 'here' | 'todo' | 'broke';

/** The step dots under the command word (● ○ ○): what is done, the one on screen, and where a chain broke. */
export function stepDots(total: number, step: number, broke = false): DotState[] {
  return Array.from({ length: Math.max(0, total) }, (_, i) => (i < step ? 'done' : i === step ? (broke ? 'broke' : 'here') : 'todo'));
}

/**
 * Which wind-up frame (0–3 of the baked 8-frame clip) the fighter shows after `done` of `total` commands: the move builds with each
 * tap, and the last one plays the impact and the landing (frames 4–7).
 */
export const windupFrame = (done: number, total: number): number => (total <= 0 ? 0 : Math.max(0, Math.min(3, Math.ceil((done * 3) / total))));

/** 1 → 0 across a window: what the timer ring (or the bar, under reduced motion) shows. */
export const ringFrac = (elapsedMs: number, windowMs: number): number => (windowMs > 0 ? Math.max(0, Math.min(1, 1 - elapsedMs / windowMs)) : 1);

/** needs_br: true — the word Bia calls for a pad button (the PT word, the EN gloss). */
export const padLabel = (w: MatCommand | MatDefense): Bilingual => (w in COMMAND_LABEL ? COMMAND_LABEL[w as MatCommand] : { pt: DEFENSE_LABEL[w as MatDefense].pt, en: DEFENSE_LABEL[w as MatDefense].en });

/** The grade pop over the pad. */
export const gradeLine = (g: TapGrade): Bilingual => GRADE_LABEL[g];

/** The chain's own call when it lands with nothing else to say (all Perfeito, or Boa!). */
export const chainGrade = (grades: readonly TapGrade[]): TapGrade => (grades.length && grades.every((g) => g === 'perfeito') ? 'perfeito' : 'boa');

/**
 * The beat on the pad, as the client runs it: the words to tap, each one's window, the step on screen, the grades so far. The server
 * judges every tap again on its own clock; this is what the overlay shows the instant a button is pressed.
 */
export interface PadBeat {
  kind: 'chain' | 'defend' | 'drill';
  want: readonly (MatCommand | MatDefense)[];
  /** each step's window (ms); the drill's are 0: no timer */
  windows: readonly number[];
  step: number;
  grades: TapGrade[];
  /** the beat is decided on this side (every step hit, or a miss); the server's resolve follows */
  over: boolean;
}

export function padBeat(kind: PadBeat['kind'], want: readonly (MatCommand | MatDefense)[], windows: readonly number[]): PadBeat {
  return { kind, want: [...want], windows: [...windows], step: 0, grades: [], over: want.length === 0 };
}

/**
 * One press on the pad, `ms` after the current word appeared. A hit moves on to the next word; a miss (the wrong button, or past the
 * window) ends the beat there. The drill has no clock and no miss: the wrong button is simply not the next step (grade null).
 */
export function padTap(b: PadBeat, got: string, ms: number): { beat: PadBeat; grade: TapGrade | null } {
  if (b.over || b.step >= b.want.length) return { beat: b, grade: null };
  const want = b.want[b.step]!;
  if (b.kind === 'drill') {
    if (got !== want) return { beat: b, grade: null };
    const step = b.step + 1;
    return { beat: { ...b, step, grades: [...b.grades, 'boa'], over: step >= b.want.length }, grade: 'boa' };
  }
  const grade = gradeTap(want, got, ms, b.windows[b.step] ?? 0);
  if (!isHitGrade(grade)) return { beat: { ...b, grades: [...b.grades, grade], over: true }, grade };
  const step = b.step + 1;
  return { beat: { ...b, step, grades: [...b.grades, grade], over: step >= b.want.length }, grade };
}

/** The current word's window ran out with no press (Tarde!). The drill never runs out. */
export function padExpired(b: PadBeat, ms: number): boolean {
  return b.kind !== 'drill' && !b.over && b.step < b.want.length && ms > (b.windows[b.step] ?? 0);
}

export const padTimeout = (b: PadBeat): PadBeat => ({ ...b, grades: [...b.grades, 'tarde'], over: true });

/** The beat's step dots: done, the one on screen, still to come, and where it broke. */
export const padDots = (b: PadBeat): DotState[] => stepDots(b.want.length, b.step, b.over && b.step < b.want.length);

/** Every command of the chain was Perfeito (one step of Ritmo). */
export const padPerfect = (b: PadBeat): boolean => b.over && b.step >= b.want.length && b.grades.every((g) => g === 'perfeito');

/** Desktop keys: `1`–`6` press the pad button at that place (the command pad's six, the defense pad's four). Null: not a pad key. */
export function padKey(key: string, size: number): number | null {
  const n = Number(key);
  return Number.isInteger(n) && n >= 1 && n <= size ? n - 1 : null;
}

/** The pad buttons in their fixed order. */
export const COMMAND_PAD: readonly MatCommand[] = COMMANDS;
export const DEFENSE_PAD: readonly MatDefense[] = DEFENSES;

/**
 * needs_br: true — who is on top, then how big the lead is (Em pé / Você por cima · Pressão). The #49 lock: never a position name.
 */
export function posLine(s: Pick<BoutSnapshot, 'position' | 'ahead' | 'rung'>): Bilingual {
  if (s.position === 'de_pe' || !s.ahead) return { pt: 'Em pé', en: 'Standing' };
  const step = boutStepLabel(s.rung);
  return s.ahead === 'you' ? { pt: `Você por cima · ${step.pt}`, en: `You on top · ${step.en}` } : { pt: `Você por baixo · ${step.pt}`, en: `You underneath · ${step.en}` };
}

/** needs_br: true — the drill's first line (Bia hands the move over). Spoken. */
export const DRILL_LINE: Bilingual = { pt: 'Agora você.', en: 'Your turn.' };

// ---------------------------------------------------------------- resolve

/** Bia's calls a resolve may speak (they are baked; anything else on the overlay is read, not spoken). */
export const SPOKEN_CALLS: readonly string[] = [
  ...Object.values(MAT_CALLS).map((c) => c.pt),
  ...Object.values(REF_LINES).map((c) => c.pt),
  ...Object.values(GRADE_LABEL).map((c) => c.pt),
];

const END_WINNERS: BoutWinner[] = ['you', 'partner', 'draw'];
const END_REASONS: Exclude<BoutReason, 'quit'>[] = ['finalizacao', 'pontos', 'vantagens', 'empate'];

/**
 * Every line Professora Bia (speaker `prof`) says on the mat, exactly as the overlay speaks it: the ten pad words, the grades, her
 * calls, "Combate!", the drill's "Agora você." and the end lines. Each one is in content/tts/extra-lines.json (boutLogic.test.ts).
 */
export const BIA_LINES: readonly string[] = [
  ...new Set([
    ...COMMANDS.map((c) => COMMAND_LABEL[c].pt),
    ...DEFENSES.map((d) => DEFENSE_LABEL[d].pt),
    ...Object.values(GRADE_LABEL).map((c) => c.pt),
    ...Object.values(MAT_CALLS).map((c) => c.pt),
    REF_LINES.combate.pt,
    DRILL_LINE.pt,
    ...END_WINNERS.flatMap((w) => END_REASONS.map((r) => endLine(w, r).pt)),
  ]),
];

/**
 * needs_br: true — the resolve line: Bia's call when she has one (points, Vantagem!, Defendeu!, Escapou!, Final!, Que ritmo!),
 * else what happened (a grip, a brace, a hold, a botch, a late or wrong tap).
 */
export function resolveLine(m: Pick<Msg<'resolve'>, 'say' | 'how' | 'landed' | 'actor' | 'move'>, partner: string): Bilingual {
  const say = m.say;
  if (say && SPOKEN_CALLS.includes(say.pt) && say.pt !== MAT_CALLS.errou.pt) return say;
  if (m.how === 'hold') return m.actor === 'partner' ? { pt: `${partner} segura.`, en: `${partner} holds.` } : { pt: 'Você segura.', en: 'You hold.' };
  if (m.how === 'late') return GRADE_LABEL.tarde;
  if (m.how === 'wrong' || m.how === 'botched' || !m.landed) return MAT_CALLS.errou;
  return say ?? GRADE_LABEL.boa;
}

/** What Bia says aloud for a resolve: her call, or the chain's grade when a move of yours lands with no call. Null: silence. */
export function resolveSpeech(m: Pick<Msg<'resolve'>, 'say' | 'how' | 'landed' | 'actor' | 'grades'>): string | null {
  if (m.say && SPOKEN_CALLS.includes(m.say.pt) && m.say.pt !== MAT_CALLS.errou.pt) return m.say.pt;
  if (m.how === 'late') return GRADE_LABEL.tarde.pt;
  if (m.how === 'hold') return null;
  if (m.actor === 'you' && m.landed) return GRADE_LABEL[chainGrade(m.grades ?? [])].pt;
  if (!m.landed) return MAT_CALLS.errou.pt;
  return null;
}

/** Everything the stage should do for a resolved exchange besides the clip: Bia's signal and the crowd. */
export function cuesForResolve(m: Msg<'resolve'>): StageCue[] {
  const out: StageCue[] = [];
  for (const e of m.events) if (e.type === 'points' || e.type === 'advantage') out.push({ t: 'ref', signal: e.signal });
  const crowd = crowdForResolve(m);
  if (crowd) out.push({ t: 'crowd', cue: crowd });
  if (m.st.exchange >= 12) out.push({ t: 'long' });
  return out;
}

export function crowdForResolve(m: Pick<Msg<'resolve'>, 'events' | 'landed' | 'how' | 'move' | 'actor'>): CrowdCue | null {
  const pts = m.events.find((e) => e.type === 'points');
  if (pts && pts.type === 'points') return pts.side === 'you' ? 'points_you' : 'points_partner';
  if (m.events.some((e) => e.type === 'advantage')) return 'advantage';
  if (m.how === 'defended') return m.actor === 'partner' ? 'escape' : null;
  if (!m.landed && m.how !== 'hold') return 'miss';
  return null;
}

/** The line Bia calls for the most important event of a resolve (points beat advantages). */
export function callOf(m: Pick<Msg<'resolve'>, 'events'>): Bilingual | null {
  const pts = m.events.filter((e) => e.type === 'points');
  if (pts.length) {
    const best = pts.reduce((a, b) => (a.type === 'points' && b.type === 'points' && b.pts > a.pts ? b : a));
    return best.type === 'points' ? best.line : null;
  }
  const adv = m.events.find((e) => e.type === 'advantage');
  return adv && adv.type === 'advantage' ? adv.line : null;
}

export function cuesForEnd(m: Msg<'end'>): StageCue[] {
  if (m.winner === 'none') return [];
  const out: StageCue[] = [{ t: 'end', winner: m.winner, reason: m.reason }];
  if (m.signal) out.push({ t: 'ref', signal: m.signal });
  out.push({ t: 'crowd', cue: m.reason === 'finalizacao' ? 'tap' : 'end' });
  return out;
}

// ---------------------------------------------------------------- coach copy (needs_br: true; the #49 lock: no position names)

export type CoachMoment = 'pick' | 'chain' | 'defend';

/** needs_br: true — the three one-line notes of a first-ever match (wins 0), one at the first pick, chain and defense. */
export const COACH_NOTES: Record<CoachMoment, Bilingual> = {
  pick: { pt: 'Escolha um golpe. As setas dizem quantos comandos ele tem.', en: 'Pick a move. The arrows say how many commands it takes.' },
  chain: { pt: 'Escute a Bia e toque a palavra que ela falar.', en: 'Listen to Bia and tap the word she says.' },
  defend: { pt: 'Ele vai atacar! Toque a defesa que a Bia falar.', en: 'They are attacking! Tap the defense Bia calls.' },
};

/**
 * Professora Bia's one tip on the end card: the next thing to try, from how the match went and the moves the player has. needs_br: true.
 * Never names a position (the #49 lock); it talks about moves, commands and who is on top.
 */
export function coachTip(o: { winner: 'you' | 'partner' | 'draw' | 'none'; reason: string; you: number; them: number; unlocked: readonly string[]; perfect?: number }): Bilingual | null {
  const has = (id: string) => o.unlocked.includes(id);
  if (o.winner === 'none') return null;
  if (o.winner === 'you' && o.reason === 'finalizacao') return { pt: 'Que final! O último Aperta! é rápido: toque sem esperar.', en: 'What a finish! The last Aperta! is quick: tap without waiting.' };
  if (o.winner === 'partner' && o.reason === 'finalizacao')
    return { pt: 'Contra o final, toque Sai! três vezes, rápido.', en: 'Against a finish, tap Sai! three times, fast.' };
  if (o.you === 0 && o.them === 0)
    return has('double_leg')
      ? { pt: 'Pegue a gola primeiro: a Queda fica com um comando só.', en: 'Take the collar first: the takedown is then one command.' }
      : { pt: 'Arrisque um golpe que vale pontos. Segurar não pontua.', en: 'Try a move that scores. Holding never does.' };
  if (o.winner === 'partner') return { pt: 'Leia o aviso: se ele vai tentar a queda, Base! segura.', en: 'Read the warning: if a takedown is coming, Base! stops it.' };
  if (o.winner === 'draw') return { pt: 'Empate! Na frente no fim, Segurar mantém a vitória.', en: 'A draw! Ahead near the end, Hold keeps the win.' };
  if ((o.perfect ?? 0) >= 6) return { pt: 'Que ritmo! Três correntes perfeitas seguidas valem uma vantagem.', en: 'What rhythm! Three perfect chains in a row are an advantage.' };
  return has('armbar')
    ? { pt: 'Boa! Por cima e na frente, o Braço pode acabar a luta.', en: 'Nice! On top and ahead, Braço can end the match.' }
    : { pt: 'Boa! Continue somando pontos por cima.', en: 'Nice! Keep scoring from on top.' };
}

// ---------------------------------------------------------------- the meter, the grips, the ground

export type GroundDir = 'gain' | 'loss' | 'even';

/** 0..1 across the meter bar: 0 the partner owns the match, 0.5 even, 1 you do. */
export const meterFrac = (m: number | undefined): number => Math.max(0, Math.min(1, ((m ?? 0) + 100) / 200));

/** needs_br: true — every move reads as ground gained or lost: the control meter before and after, from the player's seat. */
export function groundRead(from: number | undefined, to: number | undefined): { dir: GroundDir; delta: number; pt: string; en: string } {
  const d = Math.round((to ?? 0) - (from ?? 0));
  if (d > 0) return { dir: 'gain', delta: d, pt: 'Você ganhou terreno', en: 'You gained ground' };
  if (d < 0) return { dir: 'loss', delta: d, pt: 'Você perdeu terreno', en: 'You lost ground' };
  return { dir: 'even', delta: 0, pt: 'Ninguém saiu do lugar', en: 'Nobody moved' };
}

type GripEvent = NonNullable<Msg<'resolve'>['grip']>[number];

const GRIP_PT = { collar: 'a gola', sleeve: 'a manga' } as const;
const GRIP_EN = { collar: 'the collar', sleeve: 'the sleeve' } as const;
const BRACE_LINE: Record<'postura' | 'base' | 'recuperar', Bilingual> = {
  postura: { pt: 'Postura firme!', en: 'Posture up!' },
  base: { pt: 'Base firme!', en: 'Base set!' },
  recuperar: { pt: 'Travou!', en: 'Locked it down!' },
};

/** needs_br: true — one short line for a moment of a move (the grip snap, a strip, a slip, a brace, a block, a defense, a Ritmo). */
export function gripEventLine(e: GripEvent, partner: string): Bilingual {
  const you = e.side === 'you';
  switch (e.kind) {
    case 'grip':
      return you ? { pt: `Pegou ${GRIP_PT[e.grip]}!`, en: `Got ${GRIP_EN[e.grip]}!` } : { pt: `${partner} pegou ${GRIP_PT[e.grip]}!`, en: `${partner} got ${GRIP_EN[e.grip]}!` };
    case 'strip':
      return you ? { pt: 'Soltou a pegada dele!', en: 'Stripped their grip!' } : { pt: `${partner} soltou a sua pegada!`, en: `${partner} stripped your grip!` };
    case 'slip':
      return you ? { pt: 'Sua pegada escorregou!', en: 'Your grip slipped!' } : { pt: `A pegada de ${partner} escorregou!`, en: `${partner}'s grip slipped!` };
    case 'brace':
      return BRACE_LINE[e.brace];
    case 'defended':
      return MAT_CALLS.defendeu;
    case 'ritmo':
      return MAT_CALLS.ritmo;
    default:
      return you ? { pt: 'Vantagem pra você!', en: 'Advantage to you!' } : { pt: `Vantagem: ${partner}`, en: `Advantage: ${partner}` };
  }
}

/** The stage juice of a resolved move: a white flash on a throw or points, word pops for its moments, and the ground read. */
export function cuesForGrip(m: Msg<'resolve'>, partner: string): StageCue[] {
  const out: StageCue[] = [];
  const big = m.events.some((e) => e.type === 'transition' || (e.type === 'points' && e.pts > 0));
  if (m.landed && big) out.push({ t: 'flash', strength: 2 });
  for (const e of m.grip ?? []) {
    const line = gripEventLine(e, partner);
    if (e.kind === 'blocked' || (e.kind === 'defended' && e.adv) || e.kind === 'ritmo') {
      out.push({ t: 'flash', strength: 1 });
      out.push({ t: 'pop', kind: 'vantagem', side: e.side, text: e.kind === 'ritmo' ? MAT_CALLS.ritmo.pt : 'Vantagem!' });
    } else if (e.kind === 'defended') out.push({ t: 'pop', kind: 'brace', side: e.side, text: line.pt });
    else out.push({ t: 'pop', kind: e.kind, side: e.side, text: line.pt });
  }
  if (m.meterFrom != null && m.meterTo != null) {
    const g = groundRead(m.meterFrom, m.meterTo);
    if (g.dir !== 'even') out.push({ t: 'ground', dir: g.dir, delta: g.delta });
  }
  return out;
}

/** needs_br: true — the grip chips' tooltip: how many more of your turns a grip lasts before it slips. */
export function gripLife(age: number, slipAt = 3): { left: number; pt: string; en: string } {
  const left = Math.max(0, slipAt - age);
  if (left <= 1) return { left, pt: 'Vai escorregar!', en: 'About to slip!' };
  return { left, pt: `${left} turnos`, en: `${left} turns` };
}
