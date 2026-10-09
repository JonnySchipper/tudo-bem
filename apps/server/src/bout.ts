/**
 * Treino no tatame, Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md), protocol v2. The server owns the match and its clock:
 *  - `pick`: up to four cards (`offerCards`) and Segurar; the partner's telegraph (`planBot`, sometimes a feint from blue belt).
 *  - `chain`: the move's commands and windows. Each `tap` is checked against the step, the command and the server's own clock
 *    (the time since the last tap arrived, less {@link NET_GRACE_MS}); a deadline with no tap is a miss at that step.
 *  - `defend`: the partner's attack after its wind-up; one tap (or the Sai! mash against a finish) inside the window.
 *  - `resolve`: the verdict, the points and the calls; then the next beat.
 * Rewards, the stripe drill (a chain with no timer) and the end card are unchanged in kind.
 */
import {
  BOUT_PROTOCOL_VERSION,
  COMMAND_LABEL,
  DEFENSE_LABEL,
  ESCAPE_DEF,
  EXCHANGE_CLOCK_MS,
  INTRO_MS,
  MAT_TURNS,
  MOVE_LABEL,
  NET_GRACE_MS,
  PARTNERS,
  REF_LINES,
  SAI_SHARE,
  START_RATES,
  THANKS_LINE,
  WINDUP_MS,
  addCalendarDays,
  artOf,
  baseChain,
  bjjLevel,
  botCommit,
  botMoves,
  boutBond,
  boutRv,
  braceBlocks,
  cardsInText,
  chainFor,
  chainWindows,
  comfortScale,
  completeDrill,
  defWindowMs,
  defenseOf,
  drillPosition,
  endLine,
  feintMove,
  fightMoves,
  grantDiaryWord,
  gradeTap,
  isEscape,
  isHitGrade,
  isMatMove,
  matLegalMoves,
  matMeter,
  matStyle,
  attackOf,
  mulberry32,
  newMat,
  nextMatWord,
  normalizeBjj,
  offerCards,
  partnerById,
  partnerClean,
  partnerUnlocked,
  planBot,
  planKindOf,
  planLine,
  recordWin,
  resolveMat,
  saiCount,
  shouldFeint,
  signalForPoints,
  type Bilingual,
  type BotCtx,
  type BoutGripEvent,
  type BoutHow,
  type BoutPartnerCard,
  type BoutReason,
  type BoutServerMsg,
  type BoutSnapshot,
  type ClientMsg,
  type ExchangeEvent,
  type MatCommand,
  type MatDefense,
  type MatMoveId,
  type MatPlan,
  type MatResult,
  type MatSide,
  type MatState,
  type PartnerProfile,
  type RefSignal,
  type Rng,
  type TapGrade,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import { today } from './store.js';
import type { Session } from './world.js';

/** A pick this late is a timeout: the server plays Hold so the match cannot stall. */
const PICK_MS = 12_000;
const PICK_GRACE_MS = 600;

type Phase = 'intro' | 'pick' | 'chain' | 'defend' | 'resolve' | 'drill' | 'over';

/** The skill beat in progress: the player's chain, or the player's answer to the partner's attack. */
interface Beat {
  kind: 'chain' | 'defend' | 'drill';
  seq: number;
  move: MatMoveId;
  /** what each step wants */
  want: (MatCommand | MatDefense)[];
  windows: number[];
  step: number;
  /** server time the current step's window opened (the first: when the beat was sent, plus the partner's wind-up) */
  openAt: number;
  grades: TapGrade[];
  /** the partner feinted this attack (it is not what the telegraph said) */
  feint?: boolean;
  replanned?: boolean;
}

export interface BoutSession {
  token: number;
  partner: PartnerProfile;
  level: number;
  /** a first-ever match (wins 0): every window ×1.4, and the coach notes */
  first: boolean;
  /** Comfort windows: every window of this match ×`comfortScale(lossStreak)` while the belt is white (1 from blue). Not shown. */
  comfort: number;
  rng: Rng;
  mat: MatState;
  phase: Phase;
  seq: number;
  offerAt: number;
  pickMs: number;
  /** The moves on offer this pick (cards and Hold). */
  offered: MatMoveId[];
  /** Moves the player chose themselves. A timed-out match pays nothing. */
  beats: number;
  drillMove: MatMoveId | null;
  /** The partner's telegraphed next move, shown with your pick. */
  plan: MatPlan | null;
  /** From blue belt: the move the partner will actually do instead of the telegraphed one (re-checked on its turn). */
  feint: MatMoveId | null;
  /** Tests only: the partner's next move, played whenever it is legal (`feint` marks it as a feint). Never set in play. */
  forced?: { move: MatMoveId; feint?: boolean } | null;
  beat: Beat | null;
  /** What the partner has seen of you this match (its read for the AI). */
  seen: { chains: number; landed: number; attacks: number; blocked: number };
  /** Commands tapped Perfeito this match. */
  perfect: number;
  /** Words Bia called (heard) and words you tapped right (used), for the Caderno and the end card. */
  heard: Set<MatCommand | MatDefense>;
  used: Set<MatCommand | MatDefense>;
  /** Shown on the end card after the drill, already saved on the account. */
  card: { stripeUp: boolean; beltUp: boolean; bond: number; rv: number; reason: Exclude<BoutReason, 'quit'>; word: Bilingual | null; words: Bilingual[]; perfect: number } | null;
}

export interface BoutDeps {
  now: () => number;
  schedule: (fn: () => void, ms: number) => void;
  rng: () => number;
  store: ProfileStore;
  testHints: boolean;
  pace: number;
  introMs?: number;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  bond: (s: Session, delta: number) => void;
  caderno: { seen: (s: Session, text: string, ids?: readonly string[]) => void; used: (s: Session, text: string) => void; heard: (s: Session, ids: unknown) => void };
  err: (s: Session, code: string, pt: string, en: string) => void;
  avatarChanged: (s: Session) => void;
  onBoutComplete?: (s: Session, played: boolean) => void;
  /** UTC day the bond cap uses. Defaults to the real UTC date. */
  today?: () => string;
}

/** The flagship academia, or a player academy's own floor (`andar@<id>`): both have a mat to train on. */
const onMat = (s: Session): boolean => s.instance?.def.id === 'academia' || s.instance?.def.id === 'andar';

const labelOf = (w: MatCommand | MatDefense): Bilingual => {
  const l = w in COMMAND_LABEL ? COMMAND_LABEL[w as MatCommand] : DEFENSE_LABEL[w as MatDefense];
  return { pt: l.pt, en: l.en };
};

/** A running rate with a prior of two observations at the starting value. */
const rate = (start: number, hits: number, n: number): number => (start * 2 + hits) / (2 + n);

export class BoutEngine {
  private seq = 0;
  constructor(private readonly d: BoutDeps) {}

  of(s: Session): BoutSession | undefined {
    return s.bout as BoutSession | undefined;
  }

  clear(s: Session) {
    const b = this.of(s);
    if (b) b.phase = 'over';
    s.bout = undefined;
  }

  handle(s: Session, m: Extract<ClientMsg, { t: 'bout' }>): void {
    if ((m as { v?: unknown }).v !== BOUT_PROTOCOL_VERSION) return this.d.err(s, 'bout', 'Versão do jogo desatualizada. Recarregue a página.', 'The game is out of date. Reload the page.');
    switch (m.action) {
      case 'open':
        return this.open(s);
      case 'start':
        return this.start(s, m.partner);
      case 'pick':
        return this.pick(s, m.seq, m.move);
      case 'tap':
        return this.tap(s, m.seq, m.step, m.cmd, m.ms);
      case 'defend':
        return this.defend(s, m.seq, m.step ?? 0, m.cmd, m.ms);
      case 'quit':
        return this.quit(s);
    }
  }

  private open(s: Session) {
    if (!onMat(s)) return this.d.err(s, 'bout', 'O tatame fica na academia.', 'The mat is in the academy.');
    if (!s.profile!.giOwned) {
      return this.d.err(s, 'bout', 'Compre o kimono no vestiário antes de entrar na fila.', 'Buy your gi at the changing area before joining the mat queue.');
    }
    if (this.of(s)) return;
    const prog = normalizeBjj(s.profile!.bjj);
    s.profile!.bjj = prog;
    if (prog.pendingDrill) return this.beginDrill(s, prog.pendingDrill, null);
    const level = bjjLevel(prog);
    const partners: BoutPartnerCard[] = PARTNERS.map((p) => ({
      id: p.id,
      name: p.name,
      style: p.style,
      bio: p.bio,
      unlocked: partnerUnlocked(p, prog),
      unlockLevel: p.unlockLevel,
      stars: Math.max(1, Math.min(5, Math.round(1 + p.accuracy * 2 + p.speed + p.aggression * 0.5 + p.defense * 0.5))),
    }));
    const suggested = [...PARTNERS].reverse().find((p) => partnerUnlocked(p, prog))?.id ?? PARTNERS[0]!.id;
    s.send({ t: 'bout', v: 2, phase: 'lobby', partners, bjj: prog, level, suggested });
  }

  private start(s: Session, partnerId: unknown) {
    if (!onMat(s)) return this.d.err(s, 'bout', 'O tatame fica na academia.', 'The mat is in the academy.');
    if (this.of(s)) return;
    const prog = normalizeBjj(s.profile!.bjj);
    s.profile!.bjj = prog;
    if (prog.pendingDrill) return this.beginDrill(s, prog.pendingDrill, null);
    const partner = partnerById(partnerId);
    if (!partner) return this.d.err(s, 'bout', 'Esse parceiro não existe.', 'There is no such partner.');
    if (!partnerUnlocked(partner, prog)) return this.d.err(s, 'bout', 'Esse parceiro ainda está bloqueado. Ganhe mais listras!', 'That partner is still locked. Earn more stripes!');
    s.scene = undefined;
    s.mg = undefined;
    const seed = (this.d.now() ^ Math.floor(this.d.rng() * 1e9)) >>> 0;
    const b: BoutSession = {
      token: ++this.seq,
      partner,
      level: bjjLevel(prog),
      first: prog.wins === 0,
      comfort: prog.belt === 'branca' ? comfortScale(prog.lossStreak ?? 0) : 1,
      rng: mulberry32(seed),
      mat: newMat(),
      phase: 'intro',
      seq: 0,
      offerAt: 0,
      pickMs: 0,
      offered: [],
      beats: 0,
      drillMove: null,
      plan: null,
      feint: null,
      beat: null,
      seen: { chains: 0, landed: 0, attacks: 0, blocked: 0 },
      perfect: 0,
      heard: new Set(),
      used: new Set(),
      card: null,
    };
    s.bout = b;
    const introMs = this.d.introMs ?? (this.d.testHints ? 400 : INTRO_MS);
    s.send({
      t: 'bout',
      v: 2,
      phase: 'intro',
      partner: { id: partner.id, name: partner.name, style: partner.style },
      st: snap(b.mat),
      introMs,
      level: b.level,
      line: REF_LINES.combate,
      signal: 'combate',
      first: b.first,
      turns: MAT_TURNS,
    });
    this.d.schedule(() => this.offer(s, b.token), introMs);
  }

  private live(s: Session, token: number): BoutSession | undefined {
    const b = this.of(s);
    return b && b.token === token && b.phase !== 'over' ? b : undefined;
  }

  private pools(s: Session): { yours: MatMoveId[]; theirs: MatMoveId[] } {
    const prog = normalizeBjj(s.profile!.bjj);
    return { yours: fightMoves({ belt: prog.belt, unlocked: prog.unlocked, opponentBelt: prog.belt }), theirs: botMoves(prog.belt, prog.belt) };
  }

  /** The partner's AI, with what it has seen of you so far (`pools` computed once per beat by the caller). */
  private ctx(b: BoutSession, { yours, theirs }: { yours: MatMoveId[]; theirs: MatMoveId[] }): BotCtx {
    return {
      allowed: theirs,
      foeAllowed: yours,
      style: matStyle(b.partner),
      rates: { chain: rate(START_RATES.chain, b.seen.landed, b.seen.chains), block: rate(START_RATES.block, b.seen.blocked, b.seen.attacks) },
    };
  }

  // ---------------------------------------------------------------- the pick

  private offer(s: Session, token: number) {
    const b = this.live(s, token);
    if (!b || b.mat.over) return;
    if (b.mat.actor === 'them') return this.botTurn(s, b);
    const pools = this.pools(s);
    b.phase = 'pick';
    b.beat = null;
    b.seq = ++this.seq;
    b.offerAt = this.d.now();
    b.pickMs = this.d.testHints ? 8_000 : PICK_MS;
    const ctx = this.ctx(b, pools);
    b.plan = planBot(b.mat, ctx);
    // from blue belt an aggressive partner may show one attack and do another
    b.feint = shouldFeint(b.level, b.partner.aggression, b.rng()) ? feintMove(b.mat, b.plan, ctx) : null;
    // offerCards leaves out what the partner's brace would stop before it keeps four, so the pick never shrinks
    const cards = offerCards(b.mat, pools.yours, b.plan, b.partner.defense);
    b.offered = [...cards.map((c) => c.move), 'hold'];
    s.send({
      t: 'bout',
      v: 2,
      phase: 'pick',
      seq: b.seq,
      st: snap(b.mat),
      cards: cards.map((c) => ({
        id: c.move,
        pt: MOVE_LABEL[c.move].pt,
        en: MOVE_LABEL[c.move].en,
        kind: c.kind,
        chain: c.chain,
        points: c.points,
        does: c.does,
        ...(c.risk ? { risk: c.risk } : {}),
        ...(c.answers ? { answers: true } : {}),
      })),
      pickMs: b.pickMs,
      plan: { kind: b.plan.kind, move: b.plan.move, line: planLine(b.plan.kind, b.partner.name), answers: cards.filter((c) => c.answers).map((c) => c.move) },
    });
    const seq = b.seq;
    this.d.schedule(() => {
      const c = this.live(s, token);
      if (c && c.phase === 'pick' && c.seq === seq) this.pick(s, seq, 'hold', true);
    }, b.pickMs + PICK_GRACE_MS);
  }

  private pick(s: Session, seq: number, raw: unknown, auto = false) {
    const b = this.of(s);
    if (!b || b.phase !== 'pick' || b.seq !== seq) return;
    const id: MatMoveId | null = isMatMove(raw) && b.offered.includes(raw) && matLegalMoves(b.mat, 'you', this.pools(s).yours).includes(raw) ? raw : auto ? 'hold' : null;
    if (!id) return;
    if (!auto) b.beats++;
    if (id === 'hold') return this.resolve(s, b, 'you', id, true, 'hold', []);
    const want = chainFor(b.mat, 'you', id, b.partner.defense);
    const windows = chainWindows(want, id, b.level, b.first, b.comfort);
    b.phase = 'chain';
    b.seq = ++this.seq;
    b.beat = { kind: 'chain', seq: b.seq, move: id, want, windows, step: 0, openAt: this.d.now(), grades: [] };
    for (const c of want) b.heard.add(c);
    const from = artOf(b.mat.position);
    s.send({
      t: 'bout',
      v: 2,
      phase: 'chain',
      seq: b.seq,
      st: snap(b.mat),
      move: { id, pt: MOVE_LABEL[id].pt, en: MOVE_LABEL[id].en },
      cmds: want,
      windowMs: windows,
      from: from.position,
      aheadFrom: from.ahead,
      sub: attackOf(id) === 'final',
    });
    this.armDeadline(s, b);
  }

  // ---------------------------------------------------------------- the skill beats

  /** The current step's window ran out with no tap: a miss at that step. */
  private armDeadline(s: Session, b: BoutSession) {
    const beat = b.beat;
    if (!beat || beat.kind === 'drill') return;
    const { seq, step } = beat;
    const at = beat.openAt + beat.windows[step]! + NET_GRACE_MS;
    this.d.schedule(
      () => {
        const c = this.of(s);
        if (!c || c.token !== b.token || c.beat !== beat || beat.seq !== seq || beat.step !== step || (c.phase !== 'chain' && c.phase !== 'defend')) return;
        beat.grades.push('tarde');
        this.endBeat(s, c, false, 'late');
      },
      Math.max(0, at - this.d.now()),
    );
  }

  /** Grade one tap against the server clock: the gap since the step opened (less the grace) is the floor of the client's `ms`. */
  private grade(beat: Beat, got: unknown, ms: unknown): TapGrade | null {
    const now = this.d.now();
    const gap = now - beat.openAt;
    if (gap < -NET_GRACE_MS) return null; // before the pad was even up: ignored
    const w = beat.windows[beat.step]!;
    if (gap > w + NET_GRACE_MS) return 'tarde';
    // only a real number is a claim (null, true or '' would read as 0 ms): anything else falls back to the server's own gap
    const claimed = typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, ms) : gap;
    const eff = Math.max(claimed, gap - NET_GRACE_MS);
    return gradeTap(beat.want[beat.step]!, typeof got === 'string' ? got : '', eff, w);
  }

  private tap(s: Session, seq: number, step: unknown, cmd: unknown, ms: unknown) {
    const b = this.of(s);
    const beat = b?.beat;
    if (!b || !beat || beat.seq !== seq || (beat.kind !== 'chain' && beat.kind !== 'drill') || step !== beat.step) return;
    if (beat.kind === 'drill') {
      // the professor's drill: no timer, and a wrong button is simply not the next step
      if (cmd !== beat.want[beat.step]) return;
      b.used.add(beat.want[beat.step]!);
      beat.grades.push('boa');
      beat.step++;
      if (beat.step >= beat.want.length) this.landDrill(s, b);
      return;
    }
    if (b.phase !== 'chain') return;
    const g = this.grade(beat, cmd, ms);
    if (!g) return;
    beat.grades.push(g);
    if (!isHitGrade(g)) return this.endBeat(s, b, false, g === 'errou' ? 'wrong' : 'late');
    b.used.add(beat.want[beat.step]!);
    if (g === 'perfeito') b.perfect++;
    beat.step++;
    if (beat.step >= beat.want.length) return this.endBeat(s, b, true, 'landed');
    beat.openAt = this.d.now();
    this.armDeadline(s, b);
  }

  private defend(s: Session, seq: number, step: unknown, cmd: unknown, ms: unknown) {
    const b = this.of(s);
    const beat = b?.beat;
    if (!b || !beat || b.phase !== 'defend' || beat.kind !== 'defend' || beat.seq !== seq || step !== beat.step) return;
    const g = this.grade(beat, cmd, ms);
    if (!g) return;
    beat.grades.push(g);
    if (!isHitGrade(g)) return this.endBeat(s, b, false, g === 'errou' ? 'wrong' : 'late');
    b.used.add(beat.want[beat.step]!);
    if (g === 'perfeito') b.perfect++;
    beat.step++;
    if (beat.step >= beat.want.length) return this.endBeat(s, b, true, 'defended');
    beat.openAt = this.d.now();
    this.armDeadline(s, b);
  }

  /** A chain or a defense is over: `ok` means every tap hit. */
  private endBeat(s: Session, b: BoutSession, ok: boolean, how: BoutHow) {
    const beat = b.beat;
    if (!beat) return;
    b.beat = null;
    if (beat.kind === 'chain') {
      b.seen.chains++;
      if (ok) b.seen.landed++;
      const perfect = ok && beat.grades.every((g) => g === 'perfeito');
      return this.resolve(s, b, 'you', beat.move, ok, how, beat.grades, { perfect, step: ok ? undefined : beat.step, cmds: beat.want as MatCommand[] });
    }
    b.seen.attacks++;
    if (ok) b.seen.blocked++;
    // you stopped it: it does not land (Defendeu!); you did not: it lands in full
    return this.resolve(s, b, 'them', beat.move, !ok, ok ? 'defended' : how, beat.grades, { defended: ok, feint: beat.feint, replanned: beat.replanned, step: ok ? undefined : beat.step });
  }

  // ---------------------------------------------------------------- the partner's turn

  private botTurn(s: Session, b: BoutSession) {
    const pools = this.pools(s);
    const ctx = this.ctx(b, pools);
    const legal = matLegalMoves(b.mat, 'them', pools.theirs);
    let move: MatMoveId;
    let feint = false;
    let replanned = false;
    const forced = b.forced;
    b.forced = null;
    if (forced && legal.includes(forced.move)) {
      move = forced.move;
      feint = !!forced.feint;
    } else {
      const pick = botCommit(b.mat, b.plan, ctx);
      move = pick.move;
      replanned = pick.replanned;
      // a feint chosen at the pick is played only if it still stands: not into a brace you just raised, and kept by the same re-read
      // (inertia) as a telegraphed move; otherwise the partner does what botCommit says
      const f = b.feint;
      if (f && legal.includes(f) && !braceBlocks(b.mat, 'them', f)) {
        const keep = botCommit(b.mat, { move: f, kind: planKindOf(b.mat, 'them', f) }, ctx);
        if (keep.move === f && !keep.replanned) {
          move = f;
          feint = true;
          replanned = false;
        }
      }
    }
    const shownPlan = b.plan;
    b.plan = null;
    b.feint = null;
    if (move === 'hold') return this.resolve(s, b, 'them', move, true, 'hold', []);
    if (braceBlocks(b.mat, 'them', move)) return this.resolve(s, b, 'them', move, false, 'blocked', [], { feint, replanned });
    // a partner that is not clean botches on its own: no defense beat
    const clean = partnerClean(b.partner.accuracy, chainFor(b.mat, 'them', move).length);
    if (b.rng() >= clean) return this.resolve(s, b, 'them', move, false, 'botched', [], { feint, replanned });
    const d = defenseOf(b.mat, 'them', move);
    if (!d) return this.resolve(s, b, 'them', move, true, 'landed', [], { feint, replanned });
    const count = d === 'sai' ? saiCount(b.partner.defense) : 1;
    // an escape from under is slower than a throw (ESCAPE_DEF); each Sai! of the mash is a share of a window
    const w = Math.round(defWindowMs(b.level, b.partner.speed, b.mat.grips.you.sleeve, b.first, b.comfort) * (d === 'sai' ? SAI_SHARE : 1) * (isEscape(b.mat, 'them', move) ? ESCAPE_DEF : 1));
    const lead = WINDUP_MS;
    // white belt: Bia calls the right defense (listening); from blue the telegraph alone says what is coming (reading)
    const call = b.level < 4 ? d : undefined;
    if (call) b.heard.add(call);
    b.phase = 'defend';
    b.seq = ++this.seq;
    b.beat = { kind: 'defend', seq: b.seq, move, want: Array.from({ length: count }, () => d), windows: Array.from({ length: count }, () => w), step: 0, openAt: this.d.now() + lead, grades: [], feint, replanned };
    const from = artOf(b.mat.position);
    // the attack line says what the move is; only a deliberate feint (from blue belt) keeps the telegraph you were shown, so it does not
    // give itself away in words. A partner that simply changed plans is described as it is.
    const shown = b.level >= 4 && feint && shownPlan ? shownPlan.kind : planKindOf(b.mat, 'them', move);
    s.send({
      t: 'bout',
      v: 2,
      phase: 'defend',
      seq: b.seq,
      st: snap(b.mat),
      move: { id: move, pt: MOVE_LABEL[move].pt, en: MOVE_LABEL[move].en },
      attack: attackOf(move) ?? (d === 'trava' ? 'passagem' : 'queda'),
      ...(call ? { call } : {}),
      line: planLine(shown, b.partner.name),
      leadMs: lead,
      windowMs: w,
      count,
      from: from.position,
      aheadFrom: from.ahead,
    });
    this.armDeadline(s, b);
  }

  // ---------------------------------------------------------------- resolve

  private resolve(
    s: Session,
    b: BoutSession,
    actor: MatSide,
    id: MatMoveId,
    landed: boolean,
    how: BoutHow,
    grades: TapGrade[],
    o: { perfect?: boolean; defended?: boolean; feint?: boolean; replanned?: boolean; step?: number; cmds?: MatCommand[] } = {},
  ) {
    b.phase = 'resolve';
    b.beat = null;
    let res = resolveMat(b.mat, actor, id, landed, { perfect: o.perfect, defended: o.defended });
    if (!res.ok) {
      // the move is no longer legal (the mat moved under it): play it as a hold, so the match goes on instead of stalling
      id = 'hold';
      how = 'hold';
      grades = [];
      o = {};
      res = resolveMat({ ...b.mat, actor }, actor, 'hold', true);
      if (!res.ok) return this.d.schedule(() => this.offer(s, b.token), 0);
    }
    b.mat = res.state;
    const holdMs = this.pause(id === 'hold' ? 500 : res.from !== res.to || res.submission || res.points > 0 ? 900 : 700);
    s.send({
      ...resolveMsg(b, res, actor, id, how, holdMs),
      ...(grades.length ? { grades } : {}),
      ...(o.step != null ? { step: o.step } : {}),
      ...(o.cmds ? { cmds: o.cmds } : {}),
      ...(o.feint ? { feint: true } : {}),
      ...(o.replanned ? { replanned: true } : {}),
    });
    if (b.mat.over) {
      this.d.schedule(() => this.finish(s, b), holdMs);
      return;
    }
    this.d.schedule(() => this.offer(s, b.token), holdMs);
  }

  // ---------------------------------------------------------------- the drill

  private beginDrill(s: Session, move: MatMoveId, card: BoutSession['card']) {
    const partner = partnerById('mateus') ?? PARTNERS[0]!;
    const mat: MatState = { ...newMat(), position: drillPosition(move) };
    const want = baseChain(mat, 'you', move);
    const b: BoutSession = {
      token: ++this.seq,
      partner,
      level: bjjLevel(s.profile!.bjj),
      first: false,
      comfort: 1,
      rng: mulberry32(1),
      mat,
      phase: 'drill',
      seq: ++this.seq,
      offerAt: this.d.now(),
      pickMs: 0,
      offered: [],
      beats: 1,
      drillMove: move,
      plan: null,
      feint: null,
      beat: null,
      seen: { chains: 0, landed: 0, attacks: 0, blocked: 0 },
      perfect: 0,
      heard: new Set(want),
      used: new Set(),
      card,
    };
    b.beat = { kind: 'drill', seq: b.seq, move, want, windows: want.map(() => 0), step: 0, openAt: this.d.now(), grades: [] };
    s.bout = b;
    const from = artOf(mat.position);
    s.send({
      t: 'bout',
      v: 2,
      phase: 'chain',
      seq: b.seq,
      st: snap(mat),
      move: { id: move, pt: MOVE_LABEL[move].pt, en: MOVE_LABEL[move].en },
      cmds: want,
      windowMs: want.map(() => 0),
      from: from.position,
      aheadFrom: from.ahead,
      sub: attackOf(move) === 'final',
      drill: true,
      // needs_br: true
      line: { pt: 'Agora você.', en: 'Your turn.' },
    });
  }

  private landDrill(s: Session, b: BoutSession) {
    const move = b.drillMove;
    if (!move || !s.profile) return;
    const prog = completeDrill(normalizeBjj(s.profile.bjj), move);
    s.profile.bjj = prog;
    this.d.store.save(s.profile.id);
    b.drillMove = null;
    b.beat = null;
    b.phase = 'over';
    const landing = resolveMat(b.mat, 'you', move, true, { force: true });
    const card = b.card;
    const holdMs = 700;
    s.send({ ...resolveMsg(b, landing, 'you', move, 'drill', holdMs), cmds: baseChain(b.mat, 'you', move) });
    this.teach(s, b);
    this.d.schedule(() => {
      this.clear(s);
      this.sendEnd(s, {
        winner: 'you',
        reason: card?.reason ?? 'pontos',
        mat: landing.state,
        prog,
        stripeUp: card?.stripeUp ?? false,
        beltUp: card?.beltUp ?? false,
        word: card?.word ?? null,
        bond: card?.bond ?? 0,
        rv: card?.rv ?? 0,
        words: card?.words ?? [...b.used].map(labelOf),
        perfect: card?.perfect ?? 0,
      });
    }, holdMs);
  }

  // ---------------------------------------------------------------- the end

  /** The mat feeds the Caderno: every word Bia called is heard, every word tapped right is used (one save for the match). */
  private teach(s: Session, b: BoutSession) {
    const heard = cardsInText([...b.heard].map((w) => labelOf(w).pt).join(' '));
    if (heard.length) this.d.caderno.heard(s, heard.slice(0, 10));
    if (b.used.size) this.d.caderno.used(s, [...b.used].map((w) => labelOf(w).pt).join(' '));
  }

  private quit(s: Session) {
    const b = this.of(s);
    if (!b) return;
    const prog = normalizeBjj(s.profile!.bjj);
    const mat = b.mat;
    this.clear(s);
    s.send({
      t: 'bout',
      v: 2,
      phase: 'end',
      winner: 'none',
      reason: 'quit',
      st: snap(mat),
      rv: 0,
      bjj: prog,
      belt: prog.belt,
      stripeUp: false,
      beltUp: false,
      bond: 0,
      line: endLine('draw', 'quit'),
      thanks: THANKS_LINE,
      signal: null,
      word: null,
    });
  }

  private finish(s: Session, b: BoutSession) {
    if (this.of(s) !== b || !b.mat.over || !b.mat.winner) return;
    const winner = b.mat.winner === 'them' ? 'partner' : b.mat.winner === 'you' ? 'you' : 'draw';
    const reason: Exclude<BoutReason, 'quit'> = b.mat.reason === 'submission' ? 'finalizacao' : winner === 'draw' ? 'empate' : b.mat.reason === 'advantages' ? 'vantagens' : 'pontos';
    const played = b.beats >= 1;
    let prog = normalizeBjj(s.profile!.bjj);
    let stripeUp = false;
    let beltUp = false;
    let move: MatMoveId | null = null;
    if (played && winner === 'you') {
      const w = recordWin(prog);
      prog = w.progress;
      stripeUp = w.stripeUp;
      beltUp = w.beltUp;
      move = w.move;
    }
    let bond = 0;
    if (played) {
      // losses in a row (a win or a draw sets it back): the next white-belt match gets a little more time (comfortScale)
      prog = { ...prog, lossStreak: winner === 'partner' ? (prog.lossStreak ?? 0) + 1 : 0 };
      const b2 = boutBond(winner, prog, addCalendarDays(this.d.today?.() ?? today(), s.profile?.testDayOffset ?? 0));
      prog = b2.next;
      bond = b2.gain;
    }
    let word: Bilingual | null = null;
    if (played && winner === 'you') {
      const next = nextMatWord(s.profile!.diary);
      if (next) {
        const got = grantDiaryWord(s.profile!.diary, next.id, next.source);
        if (got.ok) {
          s.profile!.diary = got.earned;
          word = { pt: got.word.pt, en: got.word.en };
        }
      }
    }
    s.profile!.bjj = prog;
    this.d.store.save(s.profile!.id);
    if (played) this.teach(s, b);
    if (bond > 0) this.d.bond(s, bond);
    if (beltUp) this.d.avatarChanged(s);
    const rv = played ? boutRv(winner, reason) : 0;
    const words = [...b.used].map(labelOf);
    if (move) {
      this.clear(s);
      if (rv > 0) this.pay(s, rv, winner);
      this.d.onBoutComplete?.(s, played);
      this.d.pushProfile(s);
      return this.beginDrill(s, move, { stripeUp, beltUp, bond, rv, reason, word, words, perfect: b.perfect });
    }
    this.clear(s);
    this.sendEnd(s, { winner, reason, mat: b.mat, prog, stripeUp, beltUp, word, bond, rv, words, perfect: b.perfect });
    if (rv > 0) this.pay(s, rv, winner);
    this.d.onBoutComplete?.(s, played);
    this.d.pushProfile(s);
  }

  private sendEnd(
    s: Session,
    o: {
      winner: 'you' | 'partner' | 'draw';
      reason: Exclude<BoutReason, 'quit'>;
      mat: MatState;
      prog: ReturnType<typeof normalizeBjj>;
      stripeUp: boolean;
      beltUp: boolean;
      word: Bilingual | null;
      bond: number;
      rv: number;
      words: Bilingual[];
      perfect: number;
    },
  ) {
    const signal: RefSignal | null = o.winner === 'you' ? 'vitoria' : 'parar';
    s.send({
      t: 'bout',
      v: 2,
      phase: 'end',
      winner: o.winner,
      reason: o.reason,
      st: snap(o.mat),
      rv: o.rv,
      bjj: o.prog,
      belt: o.prog.belt,
      stripeUp: o.stripeUp,
      beltUp: o.beltUp,
      bond: o.bond,
      line: endLine(o.winner, o.reason),
      thanks: THANKS_LINE,
      signal,
      rematchSamePosition: true,
      word: o.word,
      words: o.words,
      perfect: o.perfect,
    });
  }

  private pay(s: Session, rv: number, winner: 'you' | 'partner' | 'draw') {
    this.d.reward(s, rv, {
      pt: winner === 'you' ? 'Treino no tatame: vitória!' : 'Treino no tatame na academia',
      en: winner === 'you' ? 'Mat practice: a win!' : 'Mat practice at the academy',
    });
  }

  private pause(ms: number): number {
    return Math.round(ms * this.d.pace * (this.d.testHints ? 0.05 : 1));
  }
}

function resolveMsg(b: BoutSession, res: MatResult, actor: MatSide, move: MatMoveId, how: BoutHow, holdMs: number): Extract<BoutServerMsg, { phase: 'resolve' }> {
  const side = (x: MatSide): 'you' | 'partner' => (x === 'you' ? 'you' : 'partner');
  const events: ExchangeEvent[] = [];
  if (res.points > 0) {
    const signal = signalForPoints(res.points);
    events.push({ type: 'points', side: side(actor), pts: res.points, signal, line: REF_LINES[signal] });
  }
  for (const e of res.events) {
    if (e.kind === 'blocked' || e.kind === 'ritmo' || (e.kind === 'defended' && e.adv)) events.push({ type: 'advantage', side: side(e.side), signal: 'vantagem', line: REF_LINES.vantagem });
  }
  if (res.from !== res.to || res.fromAhead !== res.toAhead) {
    events.push({ type: 'transition', from: res.from, to: res.to, rungFrom: res.fromRung, rungTo: res.toRung, gain: res.toAhead });
  }
  const grip: BoutGripEvent[] = res.events.map((e): BoutGripEvent => {
    switch (e.kind) {
      case 'grip':
        return { kind: 'grip', side: side(e.side), grip: e.grip };
      case 'strip':
        return { kind: 'strip', side: side(e.side), grips: e.grips };
      case 'slip':
        return { kind: 'slip', side: side(e.side), grips: e.grips };
      case 'brace':
        return { kind: 'brace', side: side(e.side), brace: e.brace };
      case 'defended':
        return { kind: 'defended', side: side(e.side), adv: e.adv };
      case 'ritmo':
        return { kind: 'ritmo', side: side(e.side) };
      default:
        return { kind: 'blocked', side: side(e.side) };
    }
  });
  return {
    t: 'bout',
    v: 2,
    phase: 'resolve',
    seq: b.seq,
    st: snap(res.state),
    actor: side(actor),
    move,
    landed: res.landed,
    how,
    points: res.points,
    sound: res.sound,
    say: res.line,
    events,
    holdMs,
    grip,
    meterFrom: res.meterFrom,
    meterTo: res.meterTo,
    from: res.from,
    aheadFrom: res.fromAhead,
  };
}

export function snap(st: MatState): BoutSnapshot {
  const art = artOf(st.position);
  const grips = (g: MatState['grips']['you'], age: MatState['gripAge']['you'] | undefined) => ({ collar: g.collar, sleeve: g.sleeve, age: { collar: age?.collar ?? 0, sleeve: age?.sleeve ?? 0 } });
  return {
    rung: art.rung,
    points: { you: st.points.you, partner: st.points.them },
    adv: { you: st.adv?.you ?? 0, partner: st.adv?.them ?? 0 },
    meter: matMeter(st),
    grips: { you: grips(st.grips.you, st.gripAge?.you), partner: grips(st.grips.them, st.gripAge?.them) },
    brace: { you: st.brace?.you ?? null, partner: st.brace?.them ?? null },
    clockMs: Math.max(0, MAT_TURNS - st.turnsUsed) * EXCHANGE_CLOCK_MS,
    exchange: st.turnsUsed,
    turns: MAT_TURNS,
    position: art.position,
    ahead: art.ahead,
    ritmo: st.ritmo ?? 0,
  };
}
