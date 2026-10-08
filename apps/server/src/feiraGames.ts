/**
 * Feira cart games: server-authoritative runs, RV, the daily board, medals and the Fada da Feira crown.
 *
 * The client asks to start today's featured game at the cart. This file checks the room, the distance
 * and the rotation, then keeps a run record (game, seed, start). A finish message carries compact
 * per-order outcomes; the score is recomputed here and hard-capped. Forged rows are clamped, never trusted.
 *
 * The live board and the medal tally persist as one top-level blob (`feiraGames` on the profile file's
 * sibling, see `FeiraGamesStore`). Midnight ET is lazy: any read or write, and a timer, finalizes the
 * previous day before serving today.
 */
import {
  FEIRA_CART_CLOSED_LINE,
  FEIRA_DAILY_BLOCKED,
  FEIRA_DAILY_PAID_RUNS,
  FEIRA_GAME_LABEL,
  crownHolder,
  enabledFeiraGameIds,
  featuredEnabled,
  feiraCartAdminView,
  feiraModule,
  feiraPayout,
  feiraTop,
  isFeiraGameId,
  judgeFeiraResult,
  medalTallies,
  medalsForDay,
  normalizeFeiraGames,
  parseFeiraOutcomes,
  placeOf,
  rankFeiraDay,
  todayEastern,
  type Bilingual,
  type FeiraCartMode,
  type FeiraCartSchedule,
  type FeiraGameId,
  type FeiraGamesState,
  type FeiraMedalAward,
  type FeiraOrderOutcome,
  type ServerMsg,
} from '@tudobem/shared';
import type { Session } from './world.js';
import type { ProfileStore, StoredProfile } from './store.js';
import { FeiraCartStore, memoryFeiraCart } from './feiraCart.js';

/** How close (Chebyshev tiles) the player must be to the cart or the sign. */
export const FEIRA_CART_REACH = 2;
export const FEIRA_CART_PROP = 'carrinho_jogos';
export const FEIRA_SIGN_PROP = 'placa_jogos';

export interface FeiraGameRun {
  game: FeiraGameId;
  seed: number;
  startedAt: number;
  day: string;
  /** Set once a result has been accepted, so a second finish cannot pay twice. */
  done?: boolean;
}

export interface FeiraGamesDeps {
  now: () => number;
  store: ProfileStore;
  /** The persisted board. Tests pass an in-memory one. */
  games: FeiraGamesStore;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  err: (s: Session, code: string, pt: string, en: string) => void;
  /** Current tile of the player, or null when they are not in a room. */
  tileOf: (s: Session) => { x: number; y: number; room: string } | null;
  /** Broadcast a message to every session currently in the world (crown changes). */
  broadcastAll: (m: ServerMsg) => void;
  /** Push the public avatar so the crown overlay updates for people in the same room. */
  broadcastAvatar: (s: Session) => void;
  rng?: () => number;
  /** Clock for the ET day key (paid runs, the board). Defaults to `now`. An admin day roll shifts only this. */
  dayNow?: () => number;
  /** On/off switch. Omitted in older tests: a memory store that starts off. */
  cart?: FeiraCartStore;
  /**
   * Solo/shots pin (`?feiraon=pastel`). Switches that one game on for this world.
   * Ignored unless the id is implemented. Production leaves it unset, so the admin flags stay off.
   */
  pin?: string;
}

const NEAR: Bilingual = { pt: 'Chegue mais perto do carrinho.', en: 'Walk closer to the cart.' };
const BUSY: Bilingual = { pt: 'Termine o jogo primeiro.', en: 'Finish the game first.' };
const CLOSED = FEIRA_CART_CLOSED_LINE;

export class FeiraGamesStore {
  state: FeiraGamesState;
  constructor(
    private readonly load: () => unknown,
    private readonly save: (state: FeiraGamesState) => void,
    private readonly now: () => number,
  ) {
    this.state = normalizeFeiraGames(load(), todayEastern(now()));
  }

  /** Current ET day, finalizing yesterday first when the key rolled. */
  ensure(day = todayEastern(this.now())): FeiraGamesState {
    if (this.state.day !== day) this.roll(day);
    return this.state;
  }

  /**
   * Midnight ET: medals for 1st/2nd/3rd go onto the tally (permanent), the board and the paid-run
   * counts clear, and the crown is gone because today's scores start empty.
   * A day nobody played (no positive score) mints nothing — the cart being off is that case.
   * Returns the awards so the caller can copy them onto profiles.
   */
  roll(day: string): { id: string; award: FeiraMedalAward }[] {
    const played = rankFeiraDay(this.state.scores).length > 0;
    const awards = played && this.state.day && this.state.day !== day ? medalsForDay(this.state.day, this.state.scores) : [];
    const medals = { ...this.state.medals };
    for (const { id, award } of awards) {
      const prev = medals[id] ?? [];
      if (prev.some((a) => a.day === award.day && a.medal === award.medal)) continue;
      medals[id] = [...prev, award];
    }
    this.state = { day, scores: {}, medals, paid: {} };
    this.save(this.state);
    return awards;
  }

  persist() {
    this.save(this.state);
  }
}

/** In-memory store for tests. */
export function memoryFeiraGames(now: () => number, raw?: unknown): FeiraGamesStore {
  let blob: unknown = raw;
  return new FeiraGamesStore(
    () => blob,
    (s) => {
      blob = s;
    },
    now,
  );
}

export class FeiraGamesEngine {
  private readonly cart: FeiraCartStore;
  constructor(private readonly d: FeiraGamesDeps) {
    this.cart = d.cart ?? memoryFeiraCart();
    // The test pin is the setup that turns one game on. It does not invent a second flag store.
    if (d.pin && isFeiraGameId(d.pin)) this.cart.setMode(d.pin, 'on');
  }

  private calendarDay(): string {
    return todayEastern((this.d.dayNow ?? this.d.now)());
  }

  /** Drop today's paid-run count for one player. Scores on the board stay. */
  clearPaid(playerId: string): void {
    const st = this.d.games.ensure(this.calendarDay());
    if (!st.paid[playerId]) return;
    delete st.paid[playerId];
    this.d.games.persist();
  }

  /** Close the ET day the board is on and open `day` (medals, then a fresh paid-run count). */
  rollBoard(day: string): void {
    this.d.games.roll(day);
  }

  /** Today's playable game, or null when every cart game is off (or not implemented yet). */
  featuredNow(day = this.calendarDay()): FeiraGameId | null {
    const id = featuredEnabled(day, enabledFeiraGameIds(this.cart.config(), day));
    return isFeiraGameId(id) ? id : null;
  }

  cartSnapshot(day = this.calendarDay()): { closed: boolean; game: FeiraGameId | null } {
    const game = this.featuredNow(day);
    return { closed: game === null, game };
  }

  cartView(day = this.calendarDay()) {
    return feiraCartAdminView(this.cart.config(), day);
  }

  /** Admin switch. False when the id is not in the rotation registry. */
  setCartMode(id: string, mode: FeiraCartMode, schedule?: FeiraCartSchedule | null): boolean {
    return this.cart.setMode(id, mode, schedule);
  }

  cartMsg(day = this.calendarDay()): Extract<ServerMsg, { t: 'feiraGame'; phase: 'cart' }> {
    const snap = this.cartSnapshot(day);
    return { t: 'feiraGame', phase: 'cart', closed: snap.closed, game: snap.game };
  }

  /** Test hook. */
  runOf(s: Session): FeiraGameRun | undefined {
    return s.feiraGame;
  }

  /** Live crown holder id, or null. Finalizes the day first. */
  crownId(): string | null {
    return crownHolder(this.d.games.ensure().scores);
  }

  /**
   * Lazy midnight check. Call from the world timer and before any read.
   * Copies new medals onto profiles and tells everyone the crown cleared.
   */
  tick(): { rolled: boolean; awards: { id: string; award: FeiraMedalAward }[] } {
    const day = this.calendarDay();
    if (this.d.games.state.day === day) return { rolled: false, awards: [] };
    const awards = this.d.games.roll(day);
    this.applyMedals(awards);
    this.d.broadcastAll({ t: 'feiraGame', phase: 'crown', id: null });
    return { rolled: true, awards };
  }

  handle(s: Session, m: Extract<import('@tudobem/shared').ClientMsg, { t: 'feiraGame' }>): void {
    this.tick();
    if (m.action === 'start') return this.start(s);
    if (m.action === 'board') return this.sendBoard(s);
    if (m.action === 'quit') return this.quit(s);
    if (m.action === 'finish') return this.finish(s, m.outcomes);
  }

  private near(s: Session, propId: string): boolean {
    const here = this.d.tileOf(s);
    if (!here || here.room !== 'feira') return false;
    // A game that is off, or outside its window, is not in the world: there is nothing to stand next to.
    if (!this.featuredNow() && (propId === FEIRA_CART_PROP || propId === FEIRA_SIGN_PROP)) return false;
    const prop = s.instance?.def.props.find((p) => p.id === propId);
    if (!prop) return false;
    const w = prop.w ?? 1;
    const h = prop.h ?? 1;
    // Chebyshev distance to the footprint, not just the origin tile
    const dx = here.x < prop.x ? prop.x - here.x : here.x >= prop.x + w ? here.x - (prop.x + w - 1) : 0;
    const dy = here.y < prop.y ? prop.y - here.y : here.y >= prop.y + h ? here.y - (prop.y + h - 1) : 0;
    return Math.max(dx, dy) <= FEIRA_CART_REACH;
  }

  private start(s: Session): void {
    if (!s.profile) return;
    if (s.mg) return this.d.err(s, 'busy', BUSY.pt, BUSY.en);
    if (s.feiraGame && !s.feiraGame.done) return this.d.err(s, 'busy', BUSY.pt, BUSY.en);
    if (!this.near(s, FEIRA_CART_PROP)) return this.d.err(s, 'far', NEAR.pt, NEAR.en);
    const day = this.calendarDay();
    const game = this.featuredNow(day);
    if (!game || !feiraModule(game) || !isFeiraGameId(game)) return this.d.err(s, 'feira_closed', CLOSED.pt, CLOSED.en);
    const seed = (Math.floor((this.d.rng ?? Math.random)() * 0x7fffffff) ^ (this.d.now() & 0xffff)) >>> 0;
    const run: FeiraGameRun = { game, seed, startedAt: this.d.now(), day };
    s.feiraGame = run;
    s.send({ t: 'feiraGame', phase: 'start', game, seed, startedAt: run.startedAt, day });
  }

  private quit(s: Session): void {
    if (s.feiraGame && !s.feiraGame.done) s.feiraGame = undefined;
  }

  private finish(s: Session, raw: unknown): void {
    const p = s.profile;
    const run = s.feiraGame;
    if (!p || !run || run.done) return this.d.err(s, 'no_run', 'Não há jogo aberto.', 'There is no open game.');
    const day = this.calendarDay();
    if (!enabledFeiraGameIds(this.cart.config(), day).includes(run.game)) {
      run.done = true;
      s.feiraGame = undefined;
      return this.d.err(s, 'feira_closed', CLOSED.pt, CLOSED.en);
    }
    const elapsed = this.d.now() - run.startedAt;
    const outcomes = parseFeiraOutcomes(raw);
    if (!outcomes) {
      run.done = true;
      s.feiraGame = undefined;
      return this.d.err(s, 'bad_result', 'Não entendi o resultado.', 'I could not read that result.');
    }
    const judged = judgeFeiraResult(run.game, run.seed, outcomes, elapsed);
    run.done = true;
    s.feiraGame = undefined;
    if (!judged.ok) {
      // too fast or nonsense: clamp to a zero result, never pay, never record
      return this.settle(s, run, { score: 0, served: 0, perfect: 0, left: 0 }, true);
    }
    this.settle(s, run, judged, false);
  }

  private settle(
    s: Session,
    run: FeiraGameRun,
    judged: { score: number; served: number; perfect: number; left: number },
    rejected: boolean,
  ): void {
    const p = s.profile!;
    const st = this.d.games.ensure(this.calendarDay());
    // a run started yesterday and finished after midnight still scores on the new day (the board it lands on)
    const score = judged.score;
    const wouldPay = rejected ? 0 : feiraPayout(score, judged.served);
    const paidSoFar = st.paid[p.id] ?? 0;
    let coins = 0;
    let dailyBlocked = false;
    if (wouldPay > 0) {
      if (paidSoFar < FEIRA_DAILY_PAID_RUNS) {
        coins = wouldPay;
        st.paid[p.id] = paidSoFar + 1;
      } else dailyBlocked = true;
    }
    const prev = st.scores[p.id];
    const at = this.d.now();
    if (!prev || score > prev.best) {
      st.scores[p.id] = { name: p.name, best: score, game: run.game, at };
    } else if (prev.name !== p.name) {
      prev.name = p.name;
    }
    this.d.games.persist();
    const bestToday = st.scores[p.id]?.best ?? score;
    const place = placeOf(st.scores, p.id);
    const crown = crownHolder(st.scores) === p.id && score > 0;
    if (coins > 0) {
      this.d.reward(s, coins, { pt: `Carrinho da feira: ${FEIRA_GAME_LABEL[run.game].pt}`, en: `Market cart: ${FEIRA_GAME_LABEL[run.game].en}` });
    }
    this.syncMedals(p);
    this.d.store.save();
    this.d.pushProfile(s);
    const line: Bilingual = rejected
      ? { pt: 'Essa rodada não contou.', en: 'That round did not count.' }
      : dailyBlocked
        ? FEIRA_DAILY_BLOCKED
        : coins > 0
          ? { pt: `Valeu! Aqui estão ${coins} reais virtuais.`, en: `Thanks! Here are ${coins} RV.` }
          : { pt: 'Rodada encerrada. Dessa vez não deu RV.', en: 'Round closed. No RV this time.' };
    s.send({
      t: 'feiraGame',
      phase: 'end',
      game: run.game,
      score,
      coins,
      dailyBlocked,
      served: judged.served,
      perfect: judged.perfect,
      left: judged.left,
      bestToday,
      place,
      crown,
      line,
    });
    this.d.broadcastAll({ t: 'feiraGame', phase: 'crown', id: crownHolder(st.scores) });
    this.d.broadcastAvatar(s);
  }

  sendBoard(s: Session): void {
    if (!this.near(s, FEIRA_SIGN_PROP) && !this.near(s, FEIRA_CART_PROP)) {
      return this.d.err(s, 'far', 'Chegue mais perto do carrinho ou da placa.', 'Walk closer to the cart or the sign.');
    }
    const st = this.d.games.ensure();
    const names: Record<string, string> = {};
    for (const [id, row] of Object.entries(st.scores)) names[id] = row.name;
    for (const id of Object.keys(st.medals)) {
      if (!names[id]) names[id] = this.d.store.get(id)?.name ?? id;
    }
    const day = this.calendarDay();
    const snap = this.cartSnapshot(day);
    s.send({
      t: 'feiraGame',
      phase: 'board',
      day,
      game: snap.game,
      closed: snap.closed,
      top: feiraTop(st.scores, 3, s.profile?.id),
      medals: medalTallies(st.medals, names, 10),
      crownId: this.crownId(),
    });
  }

  /** Copy this player's permanent medals onto the profile the diary reads. */
  private syncMedals(p: StoredProfile): void {
    const list = this.d.games.state.medals[p.id] ?? [];
    p.feiraMedals = list.map((a) => ({ ...a }));
  }

  private applyMedals(awards: { id: string; award: FeiraMedalAward }[]): void {
    const touched = new Set<string>();
    for (const { id } of awards) touched.add(id);
    for (const id of touched) {
      const p = this.d.store.get(id);
      if (!p) continue;
      this.syncMedals(p);
    }
    if (touched.size) this.d.store.save();
  }

  /** Push medal copies to every online session after a roll. The world calls this with its session list. */
  pushRolled(sessions: Session[], awards: { id: string; award: FeiraMedalAward }[]): void {
    const ids = new Set(awards.map((a) => a.id));
    for (const s of sessions) {
      if (!s.profile || !ids.has(s.profile.id)) continue;
      this.syncMedals(s.profile);
      this.d.pushProfile(s);
    }
  }
}

/** Names for the diary section. needs_br: true */
export const MEDAL_LABEL: Record<FeiraMedalAward['medal'], Bilingual> = {
  gold: { pt: 'Ouro', en: 'Gold' },
  silver: { pt: 'Prata', en: 'Silver' },
  bronze: { pt: 'Bronze', en: 'Bronze' },
};

export type { FeiraOrderOutcome };
