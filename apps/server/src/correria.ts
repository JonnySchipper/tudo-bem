import {
  CORRERIA_TOTAL,
  DAILY_PAID_SHIFTS,
  REGULAR_NPCS,
  UNLOCKS,
  addCalendarDays,
  cardById,
  frontOf,
  hearts,
  levelForStars,
  mgItemByIdAny,
  newShift,
  newUnlocks,
  normalizeCorreria,
  noteLesson,
  npcDefById,
  menuLadder,
  payBump,
  pendingLesson,
  sanitizeAct,
  shiftAct,
  shiftAdvance,
  shiftItemPool,
  shiftSnapshot,
  summarizeShift,
  unlockedFor,
  whereRequired,
  type Bilingual,
  type CEvent,
  type ClientMsg,
  type CorreriaEnd,
  type NpcId,
  type Shift,
  type ShiftSummary,
} from '@tudobem/shared';
import type { Session } from './world.js';
import { today, type ProfileStore } from './store.js';

/** A shift in progress on a session. The pure rules are `@tudobem/shared` `correria.ts`; this owns the clock, the sockets and the profile. */
export interface CorreriaRun {
  token: number;
  shift: Shift;
  /** Wall clock (ms) the shift was last advanced to. */
  last: number;
  lastSent: number;
}

export interface CorreriaDeps {
  now: () => number;
  /** UTC day (YYYY-MM-DD) the paid-shift cap uses. Defaults to the real UTC date. */
  today?: () => string;
  schedule: (fn: () => void, ms: number) => void;
  store: ProfileStore;
  /** Game-clock minute and day-of-week flag, baker on duty. */
  clock: () => { minute: number; saturday: boolean; baker: 'carlos' | 'graca' };
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  completeStep: (s: Session) => void;
  missionStep: (s: Session) => void;
  cartelaShift?: (s: Session, served: number) => void;
  /** A shift that ended with at least one order served, not given up: the items it served. */
  shiftWon?: (s: Session, items: readonly string[]) => void;
  ordered: (s: Session, lines: { itemId: string; qty: number }[]) => void;
  bond: (s: Session, npc: NpcId, delta: number) => void;
  caderno: { seen: (s: Session, text: string, ids?: readonly string[]) => void; heard: (s: Session, ids: unknown) => void };
  record: (s: Session, itemIds: string[], listening: boolean, score: number, latencyMs: number) => void;
  err: (s: Session, code: string, pt: string, en: string) => void;
  /** Owned padaria menu cap (undefined = shared Seu Carlos shelf). */
  ownedMenu?: (s: Session) => readonly string[] | undefined;
  /** The player-owned padaria this shift runs in (its name), so the end line is about your own till, not Seu Carlos's thanks. */
  ownedName?: (s: Session) => string | undefined;
  /** When false, Correria stays on shared shards only (flag-off). */
  allowOwnedShift?: (s: Session) => boolean;
  testHints: boolean;
  /** How often the clock runs (ms). */
  tickMs?: number;
}

/** How long a dropped connection can reclaim the open shift. */
export const CORRERIA_RESUME_MS = 20_000;
/** Longest slice of real time one advance may add (a stalled server must not burn the player's patience meters). */
const MAX_SLICE_MS = 10_000;
/** A fresh snapshot goes out at least this often, so the client's interpolated meters never drift far. */
const HEARTBEAT_MS = 4_000;

const LOST: Bilingual = { pt: 'Ih, perdi a comanda! Bora começar um turno novo?', en: 'Oops, I lost the order slip! Shall we start a fresh shift?' };
const BYE: Bilingual = { pt: 'Até a próxima, ajudante!', en: 'See you next time, helper!' };
const EMPTY_END: CorreriaEnd = { served: 0, perfect: 0, second: 0, left: 0, points: 0, tips: 0, bestCombo: 0, stars: 0, coins: 0, dailyBlocked: false, askRight: 0, askTotal: 0, words: [], newUnlocks: [], totalStars: 0, level: 0, regulars: [] };

export class CorreriaEngine {
  private seq = 0;
  private parked = new Map<string, { run: CorreriaRun; room: string; at: number }>();
  constructor(private readonly d: CorreriaDeps) {}

  /** Test hook: the shift in progress. */
  shiftOf(s: Session): Shift | undefined {
    return (s.mg as CorreriaRun | undefined)?.shift;
  }

  private run(s: Session): CorreriaRun | undefined {
    return s.mg as CorreriaRun | undefined;
  }

  clear(s: Session) {
    s.mg = undefined;
  }

  handle(s: Session, m: Extract<ClientMsg, { t: 'mg' }>): void {
    if (m.action === 'start') return this.start(s);
    const run = this.run(s);
    if (!run) return this.noOpenShift(s, m.action);
    if (m.action === 'quit') return this.quit(s, run);
    this.catchUp(s, run);
    if (!this.run(s)) return;
    if (m.action === 'sync') return this.send(s, run, [], true);
    if (m.action === 'act') {
      const a = sanitizeAct(m.act);
      if (!a) return;
      const front = frontOf(run.shift);
      const before = front && front.state === 'front' ? { id: front.id, mode: front.mode, pt: front.said.pt, lines: front.order.lines.map((l) => ({ ...l })), wait: front.patienceMax - front.patience } : null;
      const ev = shiftAct(run.shift, a);
      this.after(s, run, ev, before);
      if (!this.run(s)) return;
      this.send(s, run, ev);
      if (run.shift.over) this.finish(s, run);
    }
  }

  // ------------------------------------------------------------------ start / clock

  private start(s: Session): void {
    const p = s.profile!;
    if (s.instance?.def.id !== 'padaria') return this.d.err(s, 'mg', 'O jogo fica no balcão da padaria.', 'The game is at the bakery counter.');
    if (this.d.allowOwnedShift && !this.d.allowOwnedShift(s)) {
      return this.d.err(s, 'mg', 'O jogo fica no balcão da padaria.', 'The game is at the bakery counter.');
    }
    s.scene = undefined;
    const rawTaught = !!(p.correria && Array.isArray((p.correria as { taught?: unknown }).taught));
    p.correria = normalizeCorreria(p.correria);
    const stars = p.correria.stars;
    const clk = this.d.clock();
    const regulars = REGULAR_NPCS.map((npc) => ({ npc, hearts: hearts(p.bond?.[npc] ?? 0) })).filter((r) => r.hearts >= 1 && npcDefById(r.npc));
    const menuIds = this.d.ownedMenu?.(s);
    const pool = shiftItemPool({ shifts: p.correria.shifts, menuIds });
    const taughtBefore = [...(p.correria.taught ?? [])];
    const lesson = pendingLesson(pool.map((i) => i.id), taughtBefore, whereRequired(pool.length));
    const nextTaught = noteLesson(taughtBefore, lesson);
    p.correria.taught = nextTaught;
    if (!rawTaught || nextTaught.join('\n') !== taughtBefore.join('\n')) this.d.store.save();
    const shift = newShift({
      seed: (this.d.now() ^ (Math.random() * 1e9)) >>> 0,
      level: levelForStars(stars),
      unlocked: unlockedFor(stars),
      shifts: p.correria.shifts,
      menuIds,
      lesson,
      bump: payBump(p.correria.shifts, menuIds),
      saturday: clk.saturday,
      minute: clk.minute,
      baker: clk.baker,
      regulars,
    });
    shift.debug = this.d.testHints;
    const run: CorreriaRun = { token: ++this.seq, shift, last: this.d.now(), lastSent: 0 };
    s.mg = run;
    this.send(s, run, []);
    this.armTick(s, run);
  }

  private armTick(s: Session, run: CorreriaRun): void {
    this.d.schedule(() => {
      if (this.run(s) !== run) return;
      this.catchUp(s, run);
      this.armTick(s, run);
    }, this.d.tickMs ?? 250);
  }

  /** Let the real time since the last look pass in the shift; send what happened. */
  private catchUp(s: Session, run: CorreriaRun): void {
    const now = this.d.now();
    const dt = Math.max(0, Math.min(MAX_SLICE_MS, now - run.last));
    run.last = now;
    if (dt <= 0) return;
    const front = frontOf(run.shift);
    const before = front && front.state === 'front' ? { id: front.id, mode: front.mode, pt: front.said.pt, lines: front.order.lines.map((l) => ({ ...l })), wait: front.patienceMax - front.patience } : null;
    const ev = shiftAdvance(run.shift, dt);
    this.after(s, run, ev, before);
    if (ev.length || now - run.lastSent > HEARTBEAT_MS) this.send(s, run, ev);
    if (run.shift.over) this.finish(s, run);
  }

  private send(s: Session, run: CorreriaRun, ev: CEvent[], resync = false): void {
    run.lastSent = this.d.now();
    s.send({ t: 'mg', phase: 'state', snap: shiftSnapshot(run.shift), ev, ...(resync ? { resync: true } : {}), ...(this.d.testHints ? { debug: true } : {}) });
  }

  /** Side effects of events: the student model, the Caderno, the kiosk mission and the recados. */
  private after(s: Session, run: CorreriaRun, ev: CEvent[], before: { id: number; mode: 'written' | 'listening'; pt: string; lines: { itemId: string; qty: number }[]; wait: number } | null): void {
    for (const e of ev) {
      if (e.k === 'serve' && before && e.id === before.id) {
        const cards = before.lines.map((l) => mgItemByIdAny(l.itemId)!.card.id);
        this.d.record(s, [...cards, 'lex.padaria.me_ve'], before.mode === 'listening', e.outcome === 'perfeito' ? 3 : 2, before.wait);
        if (before.mode === 'listening') this.d.caderno.heard(s, cards);
        else this.d.caderno.seen(s, before.pt);
        this.d.ordered(s, before.lines);
        if (run.shift.stats.served === 1) this.d.missionStep(s);
      } else if ((e.k === 'leave' && before && e.id === before.id) || (e.k === 'leave' && e.why === 'tempo')) {
        if (before && e.id === before.id) this.d.record(s, [...before.lines.map((l) => mgItemByIdAny(l.itemId)!.card.id), 'lex.padaria.me_ve'], before.mode === 'listening', 0, before.wait);
      }
    }
  }

  // ------------------------------------------------------------------ the end

  private summaryToEnd(s: Session, sum: ShiftSummary, coins: number, dailyBlocked: boolean, before: number, wordsNew: Bilingual[], menuNote: Bilingual | null, menuIds?: readonly string[]): CorreriaEnd {
    const p = s.profile!;
    const cp = normalizeCorreria(p.correria);
    return {
      served: sum.served,
      perfect: sum.perfect,
      second: sum.second,
      left: sum.left,
      points: sum.points,
      tips: sum.tips,
      bestCombo: sum.bestCombo,
      stars: sum.stars,
      coins,
      dailyBlocked,
      askRight: sum.askRight,
      askTotal: sum.askTotal,
      words: wordsNew,
      newUnlocks: newUnlocks(before, cp.stars).map((u) => ({ id: u.id, pt: u.pt, en: u.en })),
      totalStars: cp.stars,
      level: levelForStars(cp.stars),
      regulars: sum.regulars.map((k) => npcDefById(k.replace('npc:', '') as NpcId)?.name ?? k),
      menuNote,
      ladder: menuLadder(cp.shifts, menuIds),
    };
  }

  /** Settle the shift: stars and level on the profile, RV through the daily gate, bonds for regulars, the Caderno's new words. */
  private finish(s: Session, run: CorreriaRun, abandoned = false): void {
    if (this.run(s) !== run) return;
    s.mg = undefined;
    const p = s.profile!;
    const sum = summarizeShift(run.shift);
    const cp = (p.correria = normalizeCorreria(p.correria));
    const before = cp.stars;
    const day = addCalendarDays(this.d.today?.() ?? today(), p.testDayOffset ?? 0);
    if (cp.date !== day) {
      cp.date = day;
      cp.paid = 0;
    }
    const known = (id: string) => (p.caderno?.[id]?.seen ?? 0) > 0 || (p.caderno?.[id]?.heard ?? 0) > 0 || (p.caderno?.[id]?.used ?? 0) > 0;
    const wordsNew = sum.words.filter((id) => !known(id) && cardById(id)).map((id) => ({ pt: cardById(id)!.form, en: cardById(id)!.gloss_en }));
    let coins = 0;
    let dailyBlocked = false;
    if (sum.coins > 0) {
      if ((cp.paid ?? 0) < DAILY_PAID_SHIFTS) {
        coins = sum.coins;
        cp.paid = (cp.paid ?? 0) + 1;
      } else dailyBlocked = true;
    }
    cp.stars += sum.stars;
    cp.shifts += 1;
    cp.best = Math.max(cp.best, sum.points);
    this.d.store.save();
    if (coins > 0) {
      for (const k of [...new Set(sum.regulars)].slice(0, 3)) this.d.bond(s, k.replace('npc:', '') as NpcId, 1);
      this.d.reward(s, coins, { pt: 'Correria no Balcão', en: 'Counter Rush at the bakery' });
    }
    if (sum.served >= 1) {
      this.d.completeStep(s);
      this.d.cartelaShift?.(s, sum.served);
      if (!abandoned) this.d.shiftWon?.(s, sum.items);
    }
    this.d.pushProfile(s);
    const end = this.summaryToEnd(s, sum, coins, dailyBlocked, before, wordsNew, run.shift.ctx.bump ?? null, run.shift.ctx.menuIds);
    const carlos: Bilingual =
      sum.served === 0
        ? { pt: 'Turno encerrado. Dessa vez não deu RV — pode começar de novo quando quiser.', en: 'Shift closed. No RV this time — you can start again whenever you want.' }
        : dailyBlocked
          ? { pt: 'Que turno! Hoje já pagamos o que dava, mas as estrelas contam.', en: 'What a shift! We have paid what we could for today, but the stars count.' }
          : abandoned
            ? { pt: `Turno encerrado. Aqui estão ${coins} reais virtuais pelo que você já serviu.`, en: `Shift closed. Here are ${coins} RV for what you already served.` }
            : { pt: `Valeu pela ajuda! Aqui estão ${coins} reais virtuais.`, en: `Thanks for the help! Here are ${coins} RV coins.` };
    const house = this.d.ownedName?.(s);
    const line: Bilingual =
      house && sum.served > 0 && !dailyBlocked
        ? { pt: `Turno fechado na ${house}! O caixa fez ${coins} reais virtuais.`, en: `Shift closed at ${house}! The till made ${coins} RV.` }
        : carlos;
    s.send({ t: 'mg', phase: 'end', end, carlos: line });
  }

  private quit(s: Session, run: CorreriaRun): void {
    const progressed = run.shift.stats.served > 0 || run.shift.stats.left > 0;
    if (!progressed) {
      s.mg = undefined;
      return s.send({ t: 'notice', level: 'info', ...BYE });
    }
    this.catchUp(s, run);
    if (this.run(s) === run) this.finish(s, run, true);
  }

  // ------------------------------------------------------------------ park and resume

  /** Park before leaveInstance clears s.mg. A later disconnect of the old socket must not drop this. */
  park(s: Session): void {
    const run = this.run(s);
    if (!s.profile || !run || !s.instance) return;
    this.parked.set(s.profile.id, { run, room: s.instance.def.id, at: this.d.now() });
  }

  private fresh(s: Session) {
    const id = s.profile?.id;
    if (!id) return undefined;
    const park = this.parked.get(id);
    if (!park) return undefined;
    if (this.d.now() - park.at > CORRERIA_RESUME_MS) {
      this.parked.delete(id);
      return undefined;
    }
    return park;
  }

  /** The client still holds a shift this session has none for: resume a parked one, or end in the open with nothing paid (a restart lands here). */
  private noOpenShift(s: Session, action: string): void {
    const park = this.fresh(s);
    if (park) {
      if (action === 'quit') {
        this.parked.delete(s.profile!.id);
        s.mg = park.run;
        return this.quit(s, park.run);
      }
      if (s.instance?.def.id === park.room) this.resume(s);
      return;
    }
    if (action === 'quit') return s.send({ t: 'notice', level: 'info', ...BYE });
    s.send({ t: 'mg', phase: 'end', end: { ...EMPTY_END }, carlos: LOST, lost: true });
  }

  resume(s: Session): void {
    if (!s.instance) return;
    const park = this.fresh(s);
    if (!park || park.room !== s.instance.def.id) return;
    this.parked.delete(s.profile!.id);
    const run = park.run;
    run.token = ++this.seq;
    run.last = this.d.now(); // the time away does not burn patience
    s.mg = run;
    this.send(s, run, [], true);
    this.armTick(s, run);
  }
}

export { CORRERIA_TOTAL, UNLOCKS };
