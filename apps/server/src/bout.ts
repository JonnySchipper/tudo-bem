import {
  BOUT_PROTOCOL_VERSION,
  INTRO_MS,
  PARTNERS,
  REF_LINES,
  THANKS_LINE,
  BEAT_PICK_MS,
  bjjLevel,
  boutBond,
  boutRv,
  botMove,
  gripCanFinish,
  endLine,
  gripMoveLabel,
  gripToSnapshot,
  mulberry32,
  newGripState,
  normalizeBjj,
  noteWeakSpot,
  offerMoves,
  partnerById,
  partnerUnlocked,
  recordWin,
  roundWinner,
  applyGripMove,
  type Bilingual,
  type BoutPartnerCard,
  type BoutReason,
  type BoutServerMsg,
  type BoutSnapshot,
  type ClientMsg,
  type ExchangeEvent,
  type GripMoveId,
  type PartnerProfile,
  type RefSignal,
  type Rng,
  type GripFightState,
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
/** A bout that did not play at least one beat pays nothing. */
export const MIN_ANSWERED_FOR_REWARD = 1;

type Phase = 'intro' | 'intent' | 'resolve' | 'over';

export interface BoutSession {
  token: number;
  partner: PartnerProfile;
  level: number;
  rng: Rng;
  grip: GripFightState;
  phase: Phase;
  seq: number;
  offerAt: number;
  pickMs: number;
  /** beats played (player chose a move) */
  beats: number;
  /** after a loss, rematch the same position */
  rematchPosition: GripFightState['position'];
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
  /** intro length override (ms); the CI hint mode uses a short one, shots ask for the full walk-in */
  introMs?: number;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  bond: (s: Session, delta: number) => void;
  caderno: { seen: (s: Session, text: string, ids?: readonly string[]) => void; used: (s: Session, text: string) => void; heard: (s: Session, ids: unknown) => void };
  err: (s: Session, code: string, pt: string, en: string) => void;
  /** the public look changed (a new belt): tell the room */
  avatarChanged: (s: Session) => void;
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
        return this.start(s, m.partner, m.listen !== false, m.rematch === true);
      case 'intent':
        return this.intent(s, m.seq, m.intent as GripMoveId);
      case 'answer':
        return;
      case 'quit':
        return this.quit(s);
    }
  }

  // ---------------------------------------------------------------- lobby and start

  private open(s: Session) {
    if (s.instance?.def.id !== 'academia') return this.d.err(s, 'bout', 'O tatame fica na academia.', 'The mat is in the academy.');
    if (!s.profile!.giOwned) {
      return this.d.err(
        s,
        'bout',
        'Compre o kimono no vestiário antes de entrar na fila.',
        'Buy your gi at the changing area before joining the mat queue.',
      );
    }
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

  private start(s: Session, partnerId: unknown, listen: boolean, rematch = false) {
    if (s.instance?.def.id !== 'academia') return this.d.err(s, 'bout', 'O tatame fica na academia.', 'The mat is in the academy.');
    if (this.of(s)) return;
    const partner = partnerById(partnerId);
    if (!partner) return this.d.err(s, 'bout', 'Esse parceiro não existe.', 'There is no such partner.');
    const prog = normalizeBjj(s.profile!.bjj);
    if (!partnerUnlocked(partner, prog)) return this.d.err(s, 'bout', 'Esse parceiro ainda está bloqueado. Ganhe mais listras!', 'That partner is still locked. Earn more stripes!');
    s.scene = undefined;
    s.mg = undefined;
    const seed = (this.d.now() ^ Math.floor(this.d.rng() * 1e9)) >>> 0;
    const hint = rematch && s.boutRematch?.partner === partner.id ? s.boutRematch : undefined;
    let grip = newGripState(hint?.position ?? 'guarda_fechada');
    if (hint?.weakSpot) grip = { ...grip, weakSpot: hint.weakSpot };
    const b: BoutSession = {
      token: ++this.seq,
      partner,
      level: bjjLevel(prog),
      rng: mulberry32(seed),
      grip,
      phase: 'intro',
      seq: 0,
      offerAt: 0,
      pickMs: 0,
      beats: 0,
      rematchPosition: hint?.position ?? 'guarda_fechada',
    };
    s.bout = b;
    const introMs = this.d.introMs ?? (this.d.testHints ? 500 : INTRO_MS);
    s.send({ t: 'bout', v: 1, phase: 'intro', partner: { id: partner.id, name: partner.name, style: partner.style }, st: snap(b.grip), introMs, level: b.level, line: REF_LINES.combate, signal: 'combate' });
    this.d.schedule(() => this.step(s, b.token), introMs);
  }

  // ---------------------------------------------------------------- the loop

  private live(s: Session, token: number): BoutSession | undefined {
    const b = this.of(s);
    return b && b.token === token && b.phase !== 'over' ? b : undefined;
  }

  /** The next beat after the intro or a resolve: grip actions or the end of the round. */
  private step(s: Session, token: number) {
    const b = this.live(s, token);
    if (!b) return;
    const win = roundWinner(b.grip);
    if (win) {
      const reason: BoutReason = win === 'draw' ? 'empate' : 'pontos';
      return this.finish(s, b, { winner: win === 'draw' ? 'draw' : win, reason });
    }
    b.phase = 'intent';
    b.seq = ++this.seq;
    b.offerAt = this.d.now();
    b.pickMs = BEAT_PICK_MS;
    const moves = offerMoves(b.grip, 'you');
    s.send({
      t: 'bout',
      v: 1,
      phase: 'intent',
      seq: b.seq,
      st: snap(b.grip),
      intents: moves.map((m) => ({ id: m.id as never, pt: m.pt, en: m.en, risk: 1 as const })),
      finish: gripCanFinish(b.grip),
      pickMs: b.pickMs,
    });
    const seq = b.seq;
    this.d.schedule(() => {
      const c = this.live(s, token);
      if (c && c.phase === 'intent' && c.seq === seq) this.intent(s, seq, offerMoves(c.grip, 'you')[0]!.id, true);
    }, b.pickMs + PICK_GRACE_MS);
  }

  private intent(s: Session, seq: number, id: GripMoveId, auto = false) {
    const b = this.of(s);
    if (!b || b.phase !== 'intent' || b.seq !== seq) return;
    const legal = offerMoves(b.grip, 'you');
    if (id === 'finalizar') {
      if (!gripCanFinish(b.grip)) return;
    } else if (!legal.some((m) => m.id === id)) {
      if (auto) id = legal[0]!.id;
      else return;
    }
    if (!auto) b.beats++;
    b.phase = 'resolve';
    let events: ExchangeEvent[] = [];
    let player = applyGripMove(b.grip, 'you', id);
    const rungBefore = gripToSnapshot(b.grip).rung;
    b.grip = player.state;
    b.grip.weakSpot = noteWeakSpot(b.grip, player.events) ?? b.grip.weakSpot;
    events = player.events.map(gripEventToExchange);
    const stepGain = player.events.find((e) => e.type === 'step');
    if (stepGain) {
      const rungAfter = gripToSnapshot(b.grip).rung;
      if (rungAfter !== rungBefore) {
        events.push({
          type: 'transition',
          from: b.grip.position,
          to: b.grip.position,
          rungFrom: rungBefore,
          rungTo: rungAfter,
          gain: stepGain.who,
        });
      }
    }
    let partnerIntent: GripMoveId = id;
    const win = roundWinner(b.grip);
    if (!win && b.grip.turn === 'partner') {
      partnerIntent = botMove(b.grip, b.partner, b.rng);
      const bot = applyGripMove(b.grip, 'partner', partnerIntent);
      b.grip = bot.state;
      events = events.concat(bot.events.map(gripEventToExchange));
    }
    const holdMs = this.pause(events.some((e) => e.type === 'transition') ? 1_600 : 1_200);
    s.send({
      t: 'bout',
      v: 1,
      phase: 'resolve',
      seq: b.seq,
      st: snap(b.grip),
      intent: id as never,
      yours: { correct: !player.events.some((e) => e.type === 'bounce'), speed: 1, fast: false, timeout: auto },
      partner: { intent: partnerIntent as never, correct: true },
      delta: player.events.some((e) => e.type === 'step' && e.who === 'you') ? 12 : player.events.some((e) => e.type === 'bounce') ? -8 : 0,
      events,
      holdMs,
    });
    this.d.schedule(() => this.step(s, b.token), holdMs);
  }

  private pause(ms: number): number {
    return Math.round(ms * this.d.pace);
  }

  // ---------------------------------------------------------------- the end

  private quit(s: Session) {
    const b = this.of(s);
    if (!b) return;
    const prog = normalizeBjj(s.profile!.bjj);
    const grip = b.grip;
    this.clear(s);
    s.send({
      t: 'bout',
      v: 1,
      phase: 'end',
      winner: 'none',
      reason: 'quit',
      st: snap(grip),
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
    const played = b.beats >= MIN_ANSWERED_FOR_REWARD;
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
    if (beltUp) this.d.avatarChanged(s);
    const rv = played ? boutRv(res.winner, res.reason) : 0;
    const grip = b.grip;
    const rematchSamePosition = res.winner === 'partner' || res.winner === 'draw';
    if (rematchSamePosition) {
      s.boutRematch = { partner: b.partner.id, position: b.rematchPosition, weakSpot: b.grip.weakSpot };
    } else {
      s.boutRematch = undefined;
    }
    this.clear(s);
    const signal: RefSignal | null = res.winner === 'you' ? 'vitoria' : res.reason === 'pontos' || res.reason === 'vantagens' ? 'parar' : null;
    s.send({
      t: 'bout',
      v: 1,
      phase: 'end',
      winner: res.winner,
      reason: res.reason,
      st: snap(grip),
      rv,
      bjj: prog,
      belt: prog.belt,
      stripeUp,
      beltUp,
      bond,
      line: endLine(res.winner, res.reason),
      thanks: THANKS_LINE,
      signal,
      rematchSamePosition: rematchSamePosition || undefined,
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

function gripEventToExchange(e: import('@tudobem/shared').GripBeatEvent): ExchangeEvent {
  if (e.type === 'step') {
    const move = e.force && e.spot ? (`${e.force}_${e.spot}` as GripMoveId) : 'puxar_gola';
    return { type: 'points', side: e.who, pts: 1, signal: 'pontos2', line: e.line ?? gripMoveLabel(move) };
  }
  if (e.type === 'finish') {
    return { type: 'points', side: 'you', pts: 4, signal: 'parar', line: e.line ?? { pt: 'Final!', en: 'Finish!' } };
  }
  if (e.type === 'bounce') {
    return { type: 'advantage', side: e.who === 'you' ? 'partner' : 'you', signal: 'vantagem', line: e.line ?? { pt: 'Força errada!', en: 'Wrong force!' } };
  }
  return { type: 'transition', from: 'guarda_fechada', to: 'guarda_fechada', rungFrom: 0, rungTo: 0, gain: null };
}

export function snap(st: GripFightState): BoutSnapshot {
  const g = gripToSnapshot(st);
  return { ...g, momentum: Math.round(g.momentum * 10) / 10 };
}
