import {
  BOUT_PROTOCOL_VERSION,
  INTRO_MS,
  MAT_CARTOON_MS,
  matEffect,
  matStyle,
  thinkMsFor,
  MAT_TURNS,
  MOVE_LABEL,
  PARTNERS,
  REF_LINES,
  THANKS_LINE,
  artOf,
  bjjLevel,
  botMoves,
  boutBond,
  boutRv,
  completeDrill,
  drillPosition,
  endLine,
  fightMoves,
  grantDiaryWord,
  isMatMove,
  matLegalMoves,
  matMeter,
  matOdds,
  movePercent,
  moveSetsUp,
  mulberry32,
  planAnswers,
  planBot,
  planLine,
  botCommit,
  gripNeed,
  COMBOS,
  newMat,
  nextMatWord,
  normalizeBjj,
  partnerById,
  partnerUnlocked,
  recordWin,
  resolveMat,
  signalForPoints,
  type Bilingual,
  type BoutPartnerCard,
  type BoutReason,
  type BoutServerMsg,
  type BoutSnapshot,
  type ClientMsg,
  type BoutGripEvent,
  type ExchangeEvent,
  type MatMoveId,
  type MatPlan,
  type MatResult,
  type MatSide,
  type MatState,
  type PartnerProfile,
  type RefSignal,
  type Rng,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import { today } from './store.js';
import type { Session } from './world.js';

/** A pick this late is a timeout: the server plays Hold so the match cannot stall. */
const PICK_MS = 12_000;
const PICK_GRACE_MS = 600;

type Phase = 'intro' | 'intent' | 'drill' | 'resolve' | 'over';

export interface BoutSession {
  token: number;
  partner: PartnerProfile;
  level: number;
  rng: Rng;
  mat: MatState;
  phase: Phase;
  seq: number;
  offerAt: number;
  pickMs: number;
  /** Wall time when the next player intent is actually on screen. 0 until the player has just moved. */
  intentRevealAt: number;
  /** Moves the player chose themselves. A timed-out match pays nothing. */
  beats: number;
  drillMove: MatMoveId | null;
  /** The partner's telegraphed next move, shown with your pick. It commits to it if it is still legal after your move. */
  plan: MatPlan | null;
  /** Shown on the end card after the drill, already saved on the account. */
  card: { stripeUp: boolean; beltUp: boolean; bond: number; rv: number; reason: Exclude<BoutReason, 'quit'>; word: Bilingual | null } | null;
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
}

/** `v: 1` bout messages. The account (`profile.bjj`) holds the belt and the unlocked moves, the same way Correria holds stars. */
/** The flagship academia, or a player academy's own floor (`andar@<id>`): both have a mat to train on. */
const onMat = (s: Session): boolean => s.instance?.def.id === 'academia' || s.instance?.def.id === 'andar';

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
    if (m.v !== BOUT_PROTOCOL_VERSION) return this.d.err(s, 'bout', 'Versão do jogo desatualizada. Recarregue a página.', 'The game is out of date. Reload the page.');
    switch (m.action) {
      case 'open':
        return this.open(s);
      case 'start':
        return this.start(s, m.partner, m.rematch === true);
      case 'intent':
        return this.intent(s, m.seq, m.intent);
      case 'answer':
        return;
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
    s.send({ t: 'bout', v: 1, phase: 'lobby', partners, bjj: prog, level, suggested });
  }

  private start(s: Session, partnerId: unknown, _rematch: boolean) {
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
      rng: mulberry32(seed),
      mat: newMat(),
      phase: 'intro',
      seq: 0,
      offerAt: 0,
      pickMs: 0,
      intentRevealAt: 0,
      beats: 0,
      drillMove: null,
      plan: null,
      card: null,
    };
    s.bout = b;
    const introMs = this.d.introMs ?? (this.d.testHints ? 400 : INTRO_MS);
    s.send({
      t: 'bout',
      v: 1,
      phase: 'intro',
      partner: { id: partner.id, name: partner.name, style: partner.style },
      st: snap(b.mat),
      introMs,
      thinkMs: thinkMsFor(matStyle(partner)),
      level: b.level,
      line: REF_LINES.combate,
      signal: 'combate',
    });
    this.d.schedule(() => this.offer(s, b.token), introMs);
  }

  private live(s: Session, token: number): BoutSession | undefined {
    const b = this.of(s);
    return b && b.token === token && b.phase !== 'over' ? b : undefined;
  }

  private offer(s: Session, token: number) {
    const b = this.live(s, token);
    if (!b || b.mat.over) return;
    if (b.mat.actor === 'them') return this.botTurn(s, b);
    const prog = normalizeBjj(s.profile!.bjj);
    const allowed = fightMoves({ belt: prog.belt, unlocked: prog.unlocked, opponentBelt: prog.belt });
    const moves = matLegalMoves(b.mat, 'you', allowed);
    b.phase = 'intent';
    b.seq = ++this.seq;
    b.offerAt = this.d.now();
    b.pickMs = this.d.testHints ? 8_000 : PICK_MS;
    // the partner reads your setup now and shows what it will do; it commits after your move unless your move made it illegal
    b.plan = planBot(b.mat, prog.belt, botMoves(prog.belt, prog.belt), matStyle(b.partner), allowed);
    const answers = new Set(planAnswers(b.mat, b.plan, moves));
    const combos = new Set(COMBOS.map((c) => c.move));
    s.send({
      t: 'bout',
      v: 1,
      phase: 'intent',
      seq: b.seq,
      st: snap(b.mat),
      intents: moves.map((id) => {
        const odds = matOdds(b.mat, 'you', id, prog.belt);
        const effect = matEffect(b.mat, 'you', id);
        const sets = moveSetsUp(b.mat, 'you', id);
        return {
          id,
          pt: MOVE_LABEL[id].pt,
          en: MOVE_LABEL[id].en,
          risk: 1 as const,
          ...(id === 'hold' ? {} : { percent: odds.percent }),
          ...(odds.parts.length ? { odds: odds.parts } : {}),
          ...(effect ? { effect } : {}),
          ...(sets ? { sets } : {}),
          ...(answers.has(id) ? { answers: true } : {}),
          ...(combos.has(id) ? { combo: true } : {}),
        };
      }),
      owned: allowed
        .filter((id) => id !== 'hold')
        .map((id) => {
          const needs = gripNeed(b.mat, 'you', id);
          return {
            id,
            pt: MOVE_LABEL[id].pt,
            en: MOVE_LABEL[id].en,
            risk: 1 as const,
            percent: movePercent(id, prog.belt),
            ...(needs ? { needs } : {}),
          };
        }),
      finish: false,
      pickMs: b.pickMs,
      plan: { kind: b.plan.kind, move: b.plan.move, line: planLine(b.plan.kind, b.partner.name), answers: [...answers] },
    });
    const seq = b.seq;
    // The intent message can sit in the client queue through the cartoons. Hold waits until the pick is visible.
    const revealWait = Math.max(0, b.intentRevealAt - this.d.now());
    b.intentRevealAt = 0;
    this.d.schedule(() => {
      const c = this.live(s, token);
      if (c && c.phase === 'intent' && c.seq === seq) this.intent(s, seq, 'hold', true);
    }, revealWait + b.pickMs + PICK_GRACE_MS);
  }

  private intent(s: Session, seq: number, raw: string, auto = false) {
    const b = this.of(s);
    if (!b || b.seq !== seq) return;
    if (b.phase === 'drill' && b.drillMove) {
      if (raw !== b.drillMove) return;
      return this.landDrill(s, b);
    }
    if (b.phase !== 'intent') return;
    const prog = normalizeBjj(s.profile!.bjj);
    const allowed = fightMoves({ belt: prog.belt, unlocked: prog.unlocked, opponentBelt: prog.belt });
    const moves = matLegalMoves(b.mat, 'you', allowed);
    const id: MatMoveId = isMatMove(raw) && moves.includes(raw) ? raw : auto ? (moves.includes('hold') ? 'hold' : moves[0]!) : (null as never);
    if (!id) return;
    if (!auto) b.beats++;
    this.play(s, b, 'you', id, auto);
  }

  private botTurn(s: Session, b: BoutSession) {
    const prog = normalizeBjj(s.profile!.bjj);
    const allowed = botMoves(prog.belt, prog.belt);
    const yours = fightMoves({ belt: prog.belt, unlocked: prog.unlocked, opponentBelt: prog.belt });
    // the telegraphed plan, unless your answer broke it
    const pick = botCommit(b.mat, b.plan, prog.belt, allowed, matStyle(b.partner), yours);
    b.plan = null;
    this.play(s, b, 'them', pick.move, false, pick.replanned);
  }

  private play(s: Session, b: BoutSession, actor: MatSide, id: MatMoveId, timeout: boolean, replanned = false) {
    const prog = normalizeBjj(s.profile!.bjj);
    const belt = prog.belt;
    b.phase = 'resolve';
    // the partner's accuracy is their edge; the player always rolls the plain belt odds shown on the button
    const res = resolveMat(b.mat, actor, id, b.rng(), belt, false, actor === 'them' ? matStyle(b.partner).edge : 0);
    if (!res.ok) return;
    b.mat = res.state;
    if (actor === 'you' && !b.mat.over) b.intentRevealAt = this.d.now() + MAT_CARTOON_MS + thinkMsFor(matStyle(b.partner)) + MAT_CARTOON_MS;
    const holdMs = this.pause(res.from !== res.to || res.submission ? 900 : 700);
    s.send({ ...resolveMsg(b, res, actor, timeout, holdMs, id), ...(replanned ? { replanned: true } : {}) });
    if (b.mat.over) {
      this.d.schedule(() => this.finish(s, b), holdMs);
      return;
    }
    this.d.schedule(() => this.offer(s, b.token), holdMs);
  }

  private beginDrill(s: Session, move: MatMoveId, card: BoutSession['card']) {
    const partner = partnerById('mateus') ?? PARTNERS[0]!;
    const mat: MatState = { ...newMat(), position: drillPosition(move) };
    const landing = resolveMat(mat, 'you', move, 0, 'preta', true);
    const b: BoutSession = {
      token: ++this.seq,
      partner,
      level: bjjLevel(s.profile!.bjj),
      rng: mulberry32(1),
      mat,
      phase: 'drill',
      seq: ++this.seq,
      offerAt: this.d.now(),
      pickMs: 0,
      intentRevealAt: 0,
      beats: 1,
      drillMove: move,
      plan: null,
      card,
    };
    s.bout = b;
    const from = artOf(mat.position);
    s.send({
      t: 'bout',
      v: 1,
      phase: 'drill',
      seq: b.seq,
      st: snap(landing.state),
      move: { id: move, pt: MOVE_LABEL[move].pt, en: MOVE_LABEL[move].en },
      // needs_br: true
      line: { pt: 'Agora você.', en: 'Your turn.' },
      from: from.position,
      aheadFrom: from.ahead,
    });
  }

  private landDrill(s: Session, b: BoutSession) {
    const move = b.drillMove;
    if (!move || !s.profile) return;
    const prog = completeDrill(normalizeBjj(s.profile.bjj), move);
    s.profile.bjj = prog;
    this.d.store.save();
    b.drillMove = null;
    b.phase = 'over';
    const landing = resolveMat(b.mat, 'you', move, 0, prog.belt, true);
    const card = b.card;
    s.send(resolveMsg(b, landing, 'you', false, 700, move));
    this.d.schedule(() => {
      this.clear(s);
      this.sendEnd(s, {
        winner: 'you',
        reason: card?.reason ?? 'pontos',
        played: true,
        mat: landing.state,
        prog,
        stripeUp: card?.stripeUp ?? false,
        beltUp: card?.beltUp ?? false,
        word: card?.word ?? null,
        bond: card?.bond ?? 0,
        rv: card?.rv ?? 0,
      });
    }, 700);
  }

  private quit(s: Session) {
    const b = this.of(s);
    if (!b) return;
    const prog = normalizeBjj(s.profile!.bjj);
    const mat = b.mat;
    this.clear(s);
    s.send({
      t: 'bout',
      v: 1,
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
      const b2 = boutBond(winner, prog, today());
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
    this.d.store.save();
    if (bond > 0) this.d.bond(s, bond);
    if (beltUp) this.d.avatarChanged(s);
    const rv = played ? boutRv(winner, reason) : 0;
    if (move) {
      this.clear(s);
      if (rv > 0) this.pay(s, rv, winner);
      this.d.onBoutComplete?.(s, played);
      this.d.pushProfile(s);
      return this.beginDrill(s, move, { stripeUp, beltUp, bond, rv, reason, word });
    }
    this.clear(s);
    this.sendEnd(s, { winner, reason, played, mat: b.mat, prog, stripeUp, beltUp, word, bond, rv });
    if (rv > 0) this.pay(s, rv, winner);
    this.d.onBoutComplete?.(s, played);
    this.d.pushProfile(s);
  }

  private sendEnd(
    s: Session,
    o: {
      winner: 'you' | 'partner' | 'draw';
      reason: Exclude<BoutReason, 'quit'>;
      played: boolean;
      mat: MatState;
      prog: ReturnType<typeof normalizeBjj>;
      stripeUp: boolean;
      beltUp: boolean;
      word: Bilingual | null;
      bond: number;
      rv?: number;
    },
  ) {
    const rv = o.rv ?? (o.played ? boutRv(o.winner, o.reason) : 0);
    const signal: RefSignal | null = o.winner === 'you' ? 'vitoria' : 'parar';
    s.send({
      t: 'bout',
      v: 1,
      phase: 'end',
      winner: o.winner,
      reason: o.reason,
      st: snap(o.mat),
      rv,
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

function resolveMsg(b: BoutSession, res: MatResult, actor: MatSide, timeout: boolean, holdMs: number, move: MatMoveId): Extract<BoutServerMsg, { phase: 'resolve' }> {
  const events: ExchangeEvent[] = [];
  if (res.points > 0) {
    const signal = signalForPoints(res.points);
    events.push({ type: 'points', side: actor === 'you' ? 'you' : 'partner', pts: res.points, signal, line: res.line });
  }
  const side = (x: MatSide): 'you' | 'partner' => (x === 'you' ? 'you' : 'partner');
  for (const e of res.events) {
    if (e.kind === 'blocked') events.push({ type: 'advantage', side: side(e.side), signal: 'vantagem', line: REF_LINES.vantagem });
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
      default:
        return { kind: 'blocked', side: side(e.side) };
    }
  });
  return {
    t: 'bout',
    v: 1,
    phase: 'resolve',
    seq: b.seq,
    st: snap(res.state),
    intent: res.line.en,
    actor: actor === 'you' ? 'you' : 'partner',
    move,
    sound: res.sound,
    say: res.line,
    yours: { correct: res.success, speed: 1, fast: false, timeout: actor === 'you' && timeout },
    partner: { intent: actor === 'them' ? res.line.pt : 'hold', correct: actor === 'them' ? res.success : true },
    delta: res.points,
    events,
    holdMs,
    grip,
    percent: res.percent,
    meterFrom: res.meterFrom,
    meterTo: res.meterTo,
  };
}

export function snap(st: MatState): BoutSnapshot {
  const art = artOf(st.position);
  const grips = (g: MatState['grips']['you'], age: MatState['gripAge']['you'] | undefined) => ({ collar: g.collar, sleeve: g.sleeve, age: { collar: age?.collar ?? 0, sleeve: age?.sleeve ?? 0 } });
  return {
    rung: art.rung,
    momentum: 0,
    points: { you: st.points.you, partner: st.points.them },
    adv: { you: st.adv?.you ?? 0, partner: st.adv?.them ?? 0 },
    meter: matMeter(st),
    grips: { you: grips(st.grips.you, st.gripAge?.you), partner: grips(st.grips.them, st.gripAge?.them) },
    brace: { you: st.brace?.you ?? null, partner: st.brace?.them ?? null },
    tired: { you: !!st.tired?.you, partner: !!st.tired?.them },
    pegada: 0,
    pegadaB: 0,
    clockMs: Math.max(0, MAT_TURNS - st.turnsUsed) * 1000,
    exchange: st.turnsUsed,
    position: art.position,
    ahead: art.ahead,
    streak: 0,
  };
}
