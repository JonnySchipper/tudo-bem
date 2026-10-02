import {
  BOUT_PROTOCOL_VERSION,
  ESCAPE_KINDS,
  INTENTS,
  INTRO_MS,
  PARTNERS,
  REF_LINES,
  THANKS_LINE,
  bjjLevel,
  boutBond,
  boutRv,
  canFinish,
  challengeBank,
  challengeLimitMs,
  checkAnswer,
  decide,
  endLine,
  escapeLimitMs,
  escapeWorked,
  finishBank,
  finishFailed,
  finishPlan,
  instantiate,
  intentPickMs,
  mulberry32,
  newBoutState,
  nextStep,
  normalizeBjj,
  boutOffer,
  partnerById,
  partnerUnlocked,
  pickChallenge,
  positionOf,
  recordWin,
  resolveExchange,
  spendClock,
  type Bilingual,
  type BoutAnswer,
  type BoutPartnerCard,
  type BoutReason,
  type BoutRole,
  type BoutServerMsg,
  type BoutSnapshot,
  type BoutState,
  type ChallengeInstance,
  type ChallengeItem,
  type ChallengeKind,
  type ClientMsg,
  type ExchangeEvent,
  type IntentId,
  type Offer,
  type PartnerProfile,
  type RefSignal,
  type Rng,
  viewOf,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import { today } from './store.js';
import type { Session } from './world.js';

/** An answer this soon after the prompt was issued cannot be a person reading it: the server ignores it (a bot or a replayed message). */
export const MIN_REACTION_MS = 150;
/** Extra time past the limit the server still accepts an answer (network latency); beyond it the answer counts as a timeout. */
export const ANSWER_GRACE_MS = 900;
/** The pick timer runs a little past the shown time for the same reason. */
export const PICK_GRACE_MS = 600;
/** A bout that ends before the player answered this many challenges pays nothing (an idle bout is not practice). */
export const MIN_ANSWERED_FOR_REWARD = 3;

type Phase = 'intro' | 'intent' | 'challenge' | 'resolve' | 'over';

interface Active {
  inst: ChallengeInstance;
  role: BoutRole;
  issuedAt: number;
  limitMs: number;
  intent: IntentId | null;
  step: number;
  steps: number;
}

export interface BoutSession {
  token: number;
  partner: PartnerProfile;
  level: number;
  rng: Rng;
  st: BoutState;
  phase: Phase;
  seq: number;
  listen: boolean;
  offer?: Offer;
  offerAt: number;
  pickMs: number;
  /** real ms spent choosing the intent of the exchange in progress */
  pickSpent: number;
  intent?: IntentId;
  active?: Active;
  /** finalização in progress: the plan, and the clock time it started */
  finish?: { limits: number[]; items: ChallengeInstance[]; startedAt: number };
  used: Set<string>;
  answered: number;
}

export interface BoutDeps {
  now: () => number;
  schedule: (fn: () => void, ms: number) => void;
  rng: () => number;
  store: ProfileStore;
  /** Test hook (TB_TEST_ROLL): challenge views carry `debugCorrect`, short pauses, no reaction floor. */
  testHints: boolean;
  /** pause scale (1 normal) */
  pace: number;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  bond: (s: Session, delta: number) => void;
  caderno: { seen: (s: Session, text: string, ids?: readonly string[]) => void; used: (s: Session, text: string) => void; heard: (s: Session, ids: unknown) => void };
  err: (s: Session, code: string, pt: string, en: string) => void;
}

/** `v: 1` bout messages. Pure session logic lives in `@tudobem/shared`; this class owns the clock, the sockets and the profile. */
export class BoutEngine {
  private seq = 0;
  constructor(private readonly d: BoutDeps) {}

  /** the session's bout, or undefined */
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
        return this.start(s, m.partner, m.listen !== false);
      case 'intent':
        return this.intent(s, m.seq, m.intent);
      case 'answer':
        return this.answer(s, m.seq, m.answer);
      case 'quit':
        return this.quit(s);
    }
  }

  // ---------------------------------------------------------------- lobby and start

  private open(s: Session) {
    if (s.instance?.def.id !== 'academia') return this.d.err(s, 'bout', 'O tatame fica na academia.', 'The mat is in the academy.');
    if (this.of(s)) return;
    const prog = normalizeBjj(s.profile!.bjj);
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
    // suggest the strongest partner the player has unlocked
    const suggested = [...PARTNERS].reverse().find((p) => partnerUnlocked(p, prog))?.id ?? PARTNERS[0]!.id;
    s.send({ t: 'bout', v: 1, phase: 'lobby', partners, bjj: prog, level, suggested });
  }

  private start(s: Session, partnerId: unknown, listen: boolean) {
    if (s.instance?.def.id !== 'academia') return this.d.err(s, 'bout', 'O tatame fica na academia.', 'The mat is in the academy.');
    if (this.of(s)) return;
    const partner = partnerById(partnerId);
    if (!partner) return this.d.err(s, 'bout', 'Esse parceiro não existe.', 'There is no such partner.');
    const prog = normalizeBjj(s.profile!.bjj);
    if (!partnerUnlocked(partner, prog)) return this.d.err(s, 'bout', 'Esse parceiro ainda está bloqueado. Ganhe mais listras!', 'That partner is still locked. Earn more stripes!');
    s.scene = undefined;
    s.mg = undefined;
    const seed = (this.d.now() ^ Math.floor(this.d.rng() * 1e9)) >>> 0;
    const b: BoutSession = {
      token: ++this.seq,
      partner,
      level: bjjLevel(prog),
      rng: mulberry32(seed),
      st: newBoutState(),
      phase: 'intro',
      seq: 0,
      listen,
      offerAt: 0,
      pickMs: 0,
      pickSpent: 0,
      used: new Set(),
      answered: 0,
    };
    s.bout = b;
    const introMs = this.d.testHints ? 500 : INTRO_MS;
    s.send({ t: 'bout', v: 1, phase: 'intro', partner: { id: partner.id, name: partner.name, style: partner.style }, st: snap(b.st), introMs, level: b.level, line: REF_LINES.combate, signal: 'combate' });
    this.d.schedule(() => this.step(s, b.token), introMs);
  }

  // ---------------------------------------------------------------- the loop

  private live(s: Session, token: number): BoutSession | undefined {
    const b = this.of(s);
    return b && b.token === token && b.phase !== 'over' ? b : undefined;
  }

  /** The next beat after the intro or a resolve: an intent offer, an escape, or the end. */
  private step(s: Session, token: number) {
    const b = this.live(s, token);
    if (!b) return;
    const next = nextStep(b.st, b.partner, b.rng);
    if (next === 'end') return this.finish(s, b, decide(b.st));
    if (next === 'escape') return this.startEscape(s, b);
    b.phase = 'intent';
    b.seq = ++this.seq;
    b.offer = boutOffer(b.st);
    b.offerAt = this.d.now();
    b.pickMs = intentPickMs(b.level);
    b.intent = undefined;
    b.active = undefined;
    s.send({
      t: 'bout',
      v: 1,
      phase: 'intent',
      seq: b.seq,
      st: snap(b.st),
      intents: b.offer.intents.map((i) => ({ id: i.id, pt: i.pt, en: i.en, risk: i.risk })),
      finish: b.offer.finish,
      pickMs: b.pickMs,
    });
    const seq = b.seq;
    // nobody chose: the safe intent is picked for them
    this.d.schedule(() => {
      const c = this.live(s, token);
      if (c && c.phase === 'intent' && c.seq === seq) this.intent(s, seq, c.offer!.intents[0]!.id, true);
    }, b.pickMs + PICK_GRACE_MS);
  }

  private intent(s: Session, seq: number, id: unknown, auto = false) {
    const b = this.of(s);
    if (!b || b.phase !== 'intent' || b.seq !== seq || !b.offer) return;
    if (id === 'finalizar') {
      if (!b.offer.finish || !canFinish(b.st)) return;
      b.pickSpent = this.d.now() - b.offerAt;
      return this.startFinish(s, b);
    }
    const picked = b.offer.intents.find((i) => i.id === id);
    if (!picked) return;
    b.pickSpent = auto ? b.pickMs : Math.max(0, this.d.now() - b.offerAt);
    b.intent = picked.id;
    const kinds: Partial<Record<ChallengeKind, number>> = { ...INTENTS[picked.id].kinds };
    this.issue(s, b, { kinds, role: 'exchange', intent: picked.id, limitOf: (k) => challengeLimitMs(k, b.level), step: 1, steps: 1 });
  }

  private issue(
    s: Session,
    b: BoutSession,
    o: { kinds: Partial<Record<ChallengeKind, number>>; role: BoutRole; intent: IntentId | null; limitOf: (k: ChallengeKind) => number; step: number; steps: number; pool?: readonly ChallengeItem[]; limit?: number },
  ) {
    const item = pickChallenge(b.rng, { kinds: o.kinds, used: b.used, caderno: s.profile!.caderno, canListen: b.listen, pool: o.pool });
    b.used.add(item.id);
    const inst = instantiate(item, b.rng);
    const limitMs = o.limit ?? o.limitOf(item.kind);
    b.phase = 'challenge';
    b.seq = ++this.seq;
    b.active = { inst, role: o.role, issuedAt: this.d.now(), limitMs, intent: o.intent, step: o.step, steps: o.steps };
    s.send({
      t: 'bout',
      v: 1,
      phase: 'challenge',
      seq: b.seq,
      st: snap(b.st),
      role: o.role,
      intent: o.intent,
      step: o.step,
      steps: o.steps,
      challenge: this.view(inst),
      limitMs,
    });
    // the server owns the clock: past the limit (plus a little for latency) the answer is a miss
    const seq = b.seq;
    this.d.schedule(() => {
      const c = this.of(s);
      if (c && c.token === b.token && c.phase === 'challenge' && c.seq === seq) this.settle(s, c, false, limitMs);
    }, limitMs + ANSWER_GRACE_MS);
  }

  private view(inst: ChallengeInstance) {
    // listening: the client speaks `listenPt`; the options carry the answer, the speech is the only way to tell them apart
    return viewOf(inst, this.d.testHints);
  }

  private answer(s: Session, seq: number, answer: BoutAnswer) {
    const b = this.of(s);
    if (!b || b.phase !== 'challenge' || b.seq !== seq || !b.active) return;
    const elapsed = this.d.now() - b.active.issuedAt;
    // too fast to be a person: ignored (the prompt stays open, the timer keeps running)
    if (elapsed < MIN_REACTION_MS && !this.d.testHints) return;
    if (!answer || typeof answer !== 'object') return;
    if (elapsed > b.active.limitMs + ANSWER_GRACE_MS) return this.settle(s, b, false, b.active.limitMs);
    const ok = checkAnswer(b.active.inst, sanitize(answer));
    this.settle(s, b, ok, Math.min(elapsed, b.active.limitMs), answer);
  }

  /** The challenge in play got its verdict (right, wrong or out of time). */
  private settle(s: Session, b: BoutSession, ok: boolean, elapsedMs: number, raw?: BoutAnswer) {
    const a = b.active;
    if (!a || b.phase !== 'challenge') return;
    b.phase = 'resolve';
    if (raw) b.answered++;
    this.learn(s, a.inst, ok, raw);
    if (a.role === 'finish') return this.afterFinishStep(s, b, ok);
    if (a.role === 'escape') return this.afterEscape(s, b, ok, elapsedMs);
    const intent = a.intent!;
    const res = resolveExchange(b.st, { intent, correct: ok, elapsedMs, limitMs: a.limitMs, spentMs: b.pickSpent + elapsedMs }, b.partner, b.rng);
    b.st = res.state;
    b.active = undefined;
    const holdMs = this.hold(res.events);
    s.send({
      t: 'bout',
      v: 1,
      phase: 'resolve',
      seq: b.seq,
      st: snap(b.st),
      intent,
      yours: { correct: res.yours.correct, speed: round2(res.yours.speed), fast: res.yours.fast, timeout: !raw },
      partner: { intent: res.partner.intent, correct: res.partner.correct },
      delta: round1(res.delta),
      events: res.events,
      holdMs,
    });
    this.d.schedule(() => this.step(s, b.token), holdMs);
  }

  private hold(events: ExchangeEvent[]): number {
    let ms = 1_300;
    if (events.some((e) => e.type === 'transition')) ms += 1_300;
    if (events.some((e) => e.type === 'points')) ms += 500;
    return this.pause(ms);
  }

  private pause(ms: number): number {
    return Math.round(ms * this.d.pace);
  }

  /** What the Caderno learns from a challenge: the words seen, a listened phrase heard, a typed word used. */
  private learn(s: Session, inst: ChallengeInstance, ok: boolean, raw?: BoutAnswer) {
    const { item } = inst;
    try {
      this.d.caderno.seen(s, item.prompt.pt, item.cards ?? []);
      if (item.kind === 'listening' && (item.cards?.length ?? 0) > 0) this.d.caderno.heard(s, (item.cards ?? []).slice(0, 10));
      if (ok && item.kind === 'typed' && raw?.kind === 'text') this.d.caderno.used(s, `${raw.text}`.slice(0, 40));
    } catch {
      /* a Caderno hiccup must never stall a bout */
    }
  }

  // ---------------------------------------------------------------- finalização and escape

  private startFinish(s: Session, b: BoutSession) {
    const plan = finishPlan(b.partner, b.level, b.rng);
    const items: ChallengeInstance[] = [];
    if (plan.mode === 'reorder') {
      const item = pickChallenge(b.rng, { kinds: { reorder: 1 }, used: b.used, caderno: s.profile!.caderno, pool: finishBank() });
      items.push(instantiate(item, b.rng));
    } else {
      const bank = challengeBank().filter((c) => c.tier === 1 && c.kind !== 'listening');
      const used = new Set(b.used);
      for (let i = 0; i < plan.limitMs.length; i++) {
        const item = pickChallenge(b.rng, { kinds: { cloze: 2, choice: 2 }, used, caderno: s.profile!.caderno, pool: bank, canListen: false });
        used.add(item.id);
        items.push(instantiate(item, b.rng));
      }
    }
    b.finish = { limits: plan.limitMs, items, startedAt: this.d.now() };
    this.issueFinishStep(s, b, 0);
  }

  private issueFinishStep(s: Session, b: BoutSession, i: number) {
    const f = b.finish!;
    const inst = f.items[i]!;
    b.used.add(inst.item.id);
    const limitMs = f.limits[i]!;
    b.phase = 'challenge';
    b.seq = ++this.seq;
    b.active = { inst, role: 'finish', issuedAt: this.d.now(), limitMs, intent: null, step: i + 1, steps: f.items.length };
    s.send({ t: 'bout', v: 1, phase: 'challenge', seq: b.seq, st: snap(b.st), role: 'finish', intent: null, step: i + 1, steps: f.items.length, challenge: this.view(inst), limitMs });
    const seq = b.seq;
    this.d.schedule(() => {
      const c = this.of(s);
      if (c && c.token === b.token && c.phase === 'challenge' && c.seq === seq) this.settle(s, c, false, limitMs);
    }, limitMs + ANSWER_GRACE_MS);
  }

  private afterFinishStep(s: Session, b: BoutSession, ok: boolean) {
    const f = b.finish!;
    const a = b.active!;
    if (ok && a.step < f.items.length) {
      b.phase = 'resolve';
      // a short beat, then the next quick prompt
      this.d.schedule(() => {
        const c = this.live(s, b.token);
        if (c && c.finish === f) this.issueFinishStep(s, c, a.step);
      }, this.pause(500));
      return;
    }
    b.active = undefined;
    b.finish = undefined;
    const spent = this.d.now() - f.startedAt + b.pickSpent;
    b.st = spendClock(b.st, spent);
    if (ok) {
      s.send({ t: 'bout', v: 1, phase: 'finish_end', kind: 'finalizacao', success: true, st: snap(b.st), line: REF_LINES.parar, signal: 'parar', holdMs: this.pause(1_800) });
      this.d.schedule(() => {
        const c = this.live(s, b.token);
        if (c) this.finish(s, c, { winner: 'you', reason: 'finalizacao' });
      }, this.pause(1_800));
      return;
    }
    b.st = finishFailed(b.st);
    const holdMs = this.pause(1_900);
    s.send({ t: 'bout', v: 1, phase: 'finish_end', kind: 'finalizacao', success: false, st: snap(b.st), line: { pt: 'Escapou! De volta pra guarda.', en: 'He got out! Back to guard.' }, signal: null, holdMs });
    this.d.schedule(() => this.step(s, b.token), holdMs);
  }

  private startEscape(s: Session, b: BoutSession) {
    b.phase = 'challenge';
    this.issue(s, b, { kinds: ESCAPE_KINDS, role: 'escape', intent: null, limitOf: () => escapeLimitMs(b.level), step: 1, steps: 1 });
  }

  private afterEscape(s: Session, b: BoutSession, ok: boolean, elapsedMs: number) {
    b.active = undefined;
    b.st = spendClock(b.st, elapsedMs);
    if (ok) {
      b.st = escapeWorked(b.st);
      const holdMs = this.pause(1_900);
      s.send({ t: 'bout', v: 1, phase: 'finish_end', kind: 'escape', success: true, st: snap(b.st), line: { pt: 'Boa defesa! Você saiu!', en: 'Great defence! You escaped!' }, signal: null, holdMs });
      this.d.schedule(() => this.step(s, b.token), holdMs);
      return;
    }
    s.send({ t: 'bout', v: 1, phase: 'finish_end', kind: 'escape', success: false, st: snap(b.st), line: REF_LINES.parar, signal: 'parar', holdMs: this.pause(1_800) });
    this.d.schedule(() => {
      const c = this.live(s, b.token);
      if (c) this.finish(s, c, { winner: 'partner', reason: 'finalizacao' });
    }, this.pause(1_800));
  }

  // ---------------------------------------------------------------- the end

  private quit(s: Session) {
    const b = this.of(s);
    if (!b) return;
    const prog = normalizeBjj(s.profile!.bjj);
    const st = b.st;
    this.clear(s);
    s.send({
      t: 'bout',
      v: 1,
      phase: 'end',
      winner: 'none',
      reason: 'quit',
      st: snap(st),
      rv: 0,
      bjj: prog,
      belt: prog.belt,
      stripeUp: false,
      beltUp: false,
      bond: 0,
      line: endLine('draw', 'quit'),
      thanks: THANKS_LINE,
      signal: null,
    });
  }

  private finish(s: Session, b: BoutSession, res: { winner: 'you' | 'partner' | 'draw'; reason: Exclude<BoutReason, 'quit'> }) {
    const p = s.profile!;
    const played = b.answered >= MIN_ANSWERED_FOR_REWARD;
    let prog = normalizeBjj(p.bjj);
    let stripeUp = false;
    let beltUp = false;
    if (played && res.winner === 'you') {
      const w = recordWin(prog);
      prog = w.progress;
      stripeUp = w.stripeUp;
      beltUp = w.beltUp;
    }
    let bond = 0;
    if (played) {
      const b2 = boutBond(res.winner, prog, today());
      prog = b2.next;
      bond = b2.gain;
    }
    p.bjj = prog;
    this.d.store.save();
    if (bond > 0) this.d.bond(s, bond);
    const rv = played ? boutRv(res.winner, res.reason) : 0;
    const st = b.st;
    this.clear(s);
    const signal: RefSignal | null = res.winner === 'you' ? 'vitoria' : res.reason === 'pontos' || res.reason === 'vantagens' ? 'parar' : null;
    s.send({
      t: 'bout',
      v: 1,
      phase: 'end',
      winner: res.winner,
      reason: res.reason,
      st: snap(st),
      rv,
      bjj: prog,
      belt: prog.belt,
      stripeUp,
      beltUp,
      bond,
      line: endLine(res.winner, res.reason),
      thanks: THANKS_LINE,
      signal,
    });
    if (rv > 0) {
      this.d.reward(s, rv, {
        pt: res.winner === 'you' ? 'Treino no tatame: vitória!' : 'Treino no tatame na academia',
        en: res.winner === 'you' ? 'Mat practice: a win!' : 'Mat practice at the academy',
      });
    }
    this.d.pushProfile(s);
  }
}

// ---------------------------------------------------------------- helpers

export function snap(st: BoutState): BoutSnapshot {
  const pos = positionOf(st);
  return {
    rung: st.rung,
    momentum: Math.round(st.momentum * 10) / 10,
    points: { ...st.points },
    adv: { ...st.adv },
    pegada: st.pegada,
    pegadaB: st.pegadaB,
    clockMs: st.clockMs,
    exchange: st.exchange,
    position: pos.id,
    ahead: pos.ahead,
    streak: st.streak,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The wire is untrusted: coerce an answer into the shapes `checkAnswer` expects. */
function sanitize(a: BoutAnswer): BoutAnswer {
  if (a.kind === 'choice') return { kind: 'choice', index: Math.floor(Number((a as { index: number }).index)) };
  if (a.kind === 'order') return { kind: 'order', order: Array.isArray(a.order) ? a.order.slice(0, 12).map((n) => Math.floor(Number(n))) : [] };
  if (a.kind === 'text') return { kind: 'text', text: typeof a.text === 'string' ? a.text.slice(0, 40) : '' };
  return { kind: 'choice', index: -1 };
}
