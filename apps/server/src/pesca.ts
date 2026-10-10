/**
 * Fishing at the Praia (PRAIA-PLAN.md 2.4, 4.2, 7.1): the server side of a cast. The client asks to open a spot and to cast; the server
 * makes the seed, the client rolls the same fish from it and plays the fight, then sends only its taps and holds. The server replays them
 * (`pescaJudge`) against the time that really passed, fills the bucket and the log, teaches the words of the moment, and that is all: a
 * fish pays nothing until Jô buys it (`sell`, under the day's cap, through the one credit path). Injected deps, the FeiraGamesEngine shape.
 */
import {
  BOTTLE_MESSAGES,
  FISH,
  JO_SELL,
  NEIDE_COACH,
  biteWindow,
  emptyPesca,
  fishWord,
  isFishId,
  isFreeWater,
  isTideHour,
  momentWord,
  parsePescaEvents,
  pescaJudge,
  pescaRoll,
  pinnedRoll,
  type Bilingual,
  type BoatTier,
  type DiaryWord,
  type EarnMoment,
  type FishId,
  type NpcId,
  type PescaCast,
  type PescaOutcome,
  type PescaProgress,
  type PescaTrayRow,
  type PropDef,
  type RoomDef,
  type ServerMsg,
  type Tile,
  type WaterId,
  type Weather,
} from '@tudobem/shared';
import type { StoredProfile } from './store.js';

/** A cast out on the water (on the Session). */
export interface PescaCastRun {
  seq: number;
  spotId: string;
  cast: PescaCast;
  startedAt: number;
}

export interface PescaSession {
  profile?: StoredProfile;
  instance?: { def: RoomDef } | null;
  pesca?: PescaCastRun;
  pescaSpot?: { spotId: string; lastCastAt: number };
  send(m: ServerMsg): void;
}

export interface PescaDeps {
  now(): number;
  rng(): number;
  save(p: StoredProfile): void;
  pushProfile(s: PescaSession): void;
  err(s: PescaSession, code: string, pt: string, en: string): void;
  tileOf(s: PescaSession): Tile;
  /** the one credit path (World.reward) */
  reward(s: PescaSession, rv: number, reason: Bilingual): void;
  /** DiaryTracker.teachPesca */
  teach(s: PescaSession, words: readonly (DiaryWord | undefined)[]): DiaryWord[];
  weather(): Weather;
  minute(): number;
  /** today: the player day (playerDay.ts `profileDay`), with the Testes day offset */
  day(p: StoredProfile): string;
  saleCap(): number;
  /** TB_TEST_PESCA / ?pescatest: rolls are pinned short */
  pinned: boolean;
  /** Is this session aboard a party boat trip right now (the `festa` water)? */
  aboardParty(s: PescaSession): boolean;
  /** A catch aboard the party boat: share it (`partyBoat.ts`). */
  onPartyCatch?(s: PescaSession, fish: FishId): void;
  /** A message in a bottle came up (the dashboard counts them). */
  onBottle?(): void;
  /** A fish landed / Jô paid: the dashboard's day counts. */
  onCaught?(fish: FishId): void;
  onSold?(rv: number): void;
}

/** Earned kitnet furniture: a first garoupa, a first dourado, the party boat's bottle (PRAIA-PLAN.md 7.3, 5.5). */
const FIRST_CATCH_FURNITURE: Partial<Record<FishId, string>> = { garoupa: 'boia_parede', dourado: 'prancha' };

const MIN_CAST_GAP_MS = 2000;
const SPOT_RANGE = 1;
const SELL_RANGE = 3;

const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const tierOf = (w: WaterId): BoatTier | null => (w === 'remo' || w === 'pesca' || w === 'alto_mar' || w === 'festa' ? w : null);

export class PescaEngine {
  private seq = 0;

  constructor(private readonly d: PescaDeps) {}

  handle(s: PescaSession, msg: { action: string; spotId?: unknown; power?: unknown; seq?: unknown; events?: unknown; fish?: unknown }): void {
    if (!s.profile) return;
    if (msg.action === 'open' && typeof msg.spotId === 'string') return this.open(s, msg.spotId);
    if (msg.action === 'cast' && typeof msg.spotId === 'string') return this.cast(s, msg.spotId, msg.power);
    if (msg.action === 'result') return this.result(s, msg.seq, msg.events);
    if (msg.action === 'quit') return this.quit(s);
    if (msg.action === 'tray') return this.tray(s);
    if (msg.action === 'sell') return this.sell(s, msg.fish);
  }

  /** The player's progress, created on first use. */
  progress(p: StoredProfile): PescaProgress {
    return (p.pesca ??= emptyPesca());
  }

  /** A rented boat's trip still runs. */
  tripActive(p: StoredProfile, tier: BoatTier): boolean {
    const t = p.pesca?.trip;
    return !!t && t.tier === tier && t.until > this.d.now();
  }

  private spot(s: PescaSession, spotId: string): PropDef | undefined {
    return s.instance?.def.props.find((p) => p.id === spotId && p.kind === 'pesca_spot' && !!p.water);
  }

  /** May this session fish this water now? A reason when not. */
  private access(s: PescaSession, water: WaterId): Bilingual | null {
    if (isFreeWater(water)) return null;
    if (water === 'festa') return this.d.aboardParty(s) ? null : { pt: 'Só quem está no barco de festa pesca daqui.', en: 'Only people on the party boat fish from here.' };
    const tier = tierOf(water)!;
    if (this.tripActive(s.profile!, tier)) return null;
    return { pt: 'Esse barco é de aluguel. Fale com o Seu Bento.', en: 'This boat is for rent. Talk to Mr. Bento.' };
  }

  private near(s: PescaSession, spot: PropDef): boolean {
    const at = spot.interact ?? { x: spot.x, y: spot.y };
    const here = this.d.tileOf(s);
    return cheb(here, at) <= SPOT_RANGE || cheb(here, { x: spot.x, y: spot.y }) <= SPOT_RANGE;
  }

  private open(s: PescaSession, spotId: string) {
    const spot = this.spot(s, spotId);
    if (!spot) return this.d.err(s, 'pesca', 'Não dá pra pescar daqui.', 'You can’t fish from here.');
    if (!this.near(s, spot)) return this.d.err(s, 'far', 'Chegue mais perto da água.', 'Walk closer to the water.');
    const water = spot.water!;
    const reason = this.access(s, water);
    s.pescaSpot = { spotId, lastCastAt: s.pescaSpot?.lastCastAt ?? 0 };
    s.send({ t: 'pesca', phase: 'spot', spotId, water, canCast: !reason, ...(reason ? { reason } : {}) });
    // stepping onto the lagoa's bank or a rented boat's deck: its "board" word
    if (!reason && water !== 'praia') this.moments(s, water, ['board']);
  }

  private cast(s: PescaSession, spotId: string, rawPower: unknown) {
    const p = s.profile!;
    const spot = this.spot(s, spotId);
    if (!spot || !this.near(s, spot)) return this.d.err(s, 'far', 'Chegue mais perto da água.', 'Walk closer to the water.');
    const water = spot.water!;
    const reason = this.access(s, water);
    if (reason) return this.d.err(s, 'pesca', reason.pt, reason.en);
    if (s.pesca) return this.d.err(s, 'pesca_busy', 'A linha ainda está na água.', 'Your line is still in the water.');
    const now = this.d.now();
    if (s.pescaSpot && now - s.pescaSpot.lastCastAt < MIN_CAST_GAP_MS) return this.d.err(s, 'pesca_busy', 'Calma, um lance de cada vez.', 'Easy, one cast at a time.');
    const power = typeof rawPower === 'number' && Number.isFinite(rawPower) ? Math.max(0, Math.min(1, rawPower)) : 0.5;
    const pr = this.progress(p);
    const cast: PescaCast = { seed: Math.floor(this.d.rng() * 2 ** 31), water, weather: this.d.weather(), minute: this.d.minute(), power, firstCatches: pr.catches };
    const seq = ++this.seq;
    s.pesca = { seq, spotId, cast, startedAt: now };
    s.pescaSpot = { spotId, lastCastAt: now };
    pr.casts++;
    this.d.save(p);
    s.send({ t: 'pesca', phase: 'cast', seq, ...cast, ...(this.d.pinned ? { pinned: pinnedRoll(water) } : {}) });
    const sunset = cast.minute >= 17 * 60 + 30 && cast.minute < 18 * 60 + 30;
    this.moments(s, water, [
      'first_cast',
      ...(water === 'praia' && isTideHour(cast.minute) ? (['tide_cast'] as EarnMoment[]) : []),
      // out on the deep-sea boat as the sun goes down: the horizon
      ...(water === 'alto_mar' && sunset ? (['sunset_aboard'] as EarnMoment[]) : []),
    ]);
  }

  private result(s: PescaSession, rawSeq: unknown, rawEvents: unknown) {
    const run = s.pesca;
    if (!run || rawSeq !== run.seq) return; // a stale or unknown cast: dropped
    s.pesca = undefined;
    const p = s.profile!;
    const pr = this.progress(p);
    const elapsed = this.d.now() - run.startedAt;
    const roll = this.d.pinned ? pinnedRoll(run.cast.water) : pescaRoll(run.cast);
    // a boat whose trip ended mid-cast: the fish is gone with the boat
    const reason = this.access(s, run.cast.water);
    const outcome: PescaOutcome = reason ? { kind: 'escaped' } : pescaJudge(run.cast, parsePescaEvents(rawEvents), elapsed, roll);
    const water = run.cast.water;
    const moments: EarnMoment[] = [];
    const words: (DiaryWord | undefined)[] = [];
    let newSpecies = false;
    let record = false;
    let line: (Bilingual & { speaker: NpcId }) | undefined;
    let bottle: Bilingual | undefined;
    const coach = (key: keyof typeof NEIDE_COACH) => {
      if (pr.coached.includes(key)) return;
      pr.coached.push(key);
      line = { ...NEIDE_COACH[key], speaker: 'neide' };
    };
    const hooked = outcome.kind === 'caught' || outcome.kind === 'junk' || outcome.kind === 'released' || outcome.kind === 'snapped' || outcome.kind === 'escaped';
    if (hooked && roll.nibblesAtMs.length) moments.push('first_nibble');
    if (hooked) moments.push('first_bite');
    if (outcome.kind === 'snapped') {
      moments.push('first_snap');
      coach('snap');
    }
    if (outcome.kind === 'released') {
      words.push(fishWord('baiacu'));
      coach('baiacu');
    }
    if (outcome.kind === 'junk' && outcome.junk === 'garrafa') {
      moments.push('message_bottle');
      this.giveFurniture(p, 'garrafa_mensagem');
      // the message is the server's pick (from the seed), never the client's
      bottle = BOTTLE_MESSAGES[run.cast.seed % BOTTLE_MESSAGES.length];
      this.d.onBottle?.();
    }
    if (outcome.kind === 'caught') {
      const f = outcome.fish;
      pr.catches++;
      pr.balde[f] = (pr.balde[f] ?? 0) + 1;
      const row = pr.log[f];
      newSpecies = !row;
      record = !!row && outcome.cm > row.bestCm;
      pr.log[f] = row ? { ...row, n: row.n + 1, bestCm: Math.max(row.bestCm, outcome.cm) } : { n: 1, bestCm: outcome.cm, firstAt: this.d.now(), firstWater: water };
      moments.push('first_catch');
      if (outcome.trophy || (water === 'lagoa' && f === 'tucunare')) moments.push('first_trophy');
      if (outcome.trophy) coach('trophy');
      words.push(fishWord(f));
      const furniture = FIRST_CATCH_FURNITURE[f];
      if (newSpecies && furniture) this.giveFurniture(p, furniture);
      if (water === 'festa') this.d.onPartyCatch?.(s, f);
      this.d.onCaught?.(f);
    }
    if (outcome.kind === 'rejected') console.warn(`[pesca] rejected result from ${p.id}: ${outcome.reason ?? '?'}`);
    this.d.save(p);
    const taught = this.d.teach(s, [...words, ...moments.map((m) => momentWord(water, m))]);
    s.send({ t: 'pesca', phase: 'result', seq: run.seq, outcome, newSpecies, record, words: taught.map((w) => ({ pt: w.pt, en: w.en })), ...(line ? { line } : {}), ...(bottle ? { bottle } : {}) });
    this.d.pushProfile(s);
  }

  /** Words of moments on a water (deduped by the diary itself). */
  private moments(s: PescaSession, water: WaterId, list: EarnMoment[]) {
    this.d.teach(
      s,
      list.map((m) => momentWord(water, m)),
    );
  }

  private giveFurniture(p: StoredProfile, id: string) {
    if ((p.furniture[id] ?? 0) > 0) return;
    p.furniture[id] = 1;
  }

  quit(s: PescaSession) {
    s.pesca = undefined;
  }

  /** A boat trip ended or the player left: any cast out from that boat is gone. */
  dropCast(s: PescaSession) {
    s.pesca = undefined;
    s.pescaSpot = undefined;
  }

  // ---------------------------------------------------------------- Jô buys fish (PRAIA-PLAN.md 7.1)

  private nearJo(s: PescaSession): boolean {
    const def = s.instance?.def;
    if (def?.id !== 'praia') return false;
    const here = this.d.tileOf(s);
    const marks: Tile[] = [];
    for (const id of ['barraca_jo', 'compro_peixe']) {
      const pr = def.props.find((q) => q.id === id);
      if (pr) marks.push(pr.interact ?? { x: pr.x, y: pr.y });
    }
    const jo = def.npcs.find((n) => n.id === 'jo');
    if (jo) marks.push(jo.interact);
    return marks.some((t) => cheb(here, t) <= SELL_RANGE);
  }

  private capLeft(p: StoredProfile): number {
    const pr = this.progress(p);
    const day = this.d.day(p);
    if (pr.sales.date !== day) pr.sales = { date: day, rv: 0 };
    return Math.max(0, this.d.saleCap() - pr.sales.rv);
  }

  trayRows(p: StoredProfile): PescaTrayRow[] {
    const pr = this.progress(p);
    return (Object.entries(pr.balde) as [FishId, number][])
      .filter(([id, n]) => isFishId(id) && n > 0)
      .map(([id, n]) => ({ id, pt: FISH[id].pt, en: FISH[id].en, n, price: FISH[id].sell }));
  }

  private tray(s: PescaSession) {
    const p = s.profile!;
    if (!this.nearJo(s)) return this.d.err(s, 'far', 'A Jô fica na barraca da praia.', 'Jô is at the beach kiosk.');
    s.send({ t: 'pesca', phase: 'tray', fish: this.trayRows(p), capLeft: this.capLeft(p) });
  }

  private sell(s: PescaSession, rawFish: unknown) {
    const p = s.profile!;
    if (!this.nearJo(s)) return this.d.err(s, 'far', 'A Jô fica na barraca da praia.', 'Jô is at the beach kiosk.');
    if (rawFish !== undefined && !isFishId(rawFish)) return;
    const pr = this.progress(p);
    let capLeft = this.capLeft(p);
    const kinds = (rawFish ? [rawFish] : (Object.keys(pr.balde) as FishId[])).filter((f) => (pr.balde[f] ?? 0) > 0 && FISH[f].sell > 0);
    if (!kinds.length) return this.d.err(s, 'pesca', JO_SELL.empty.pt, JO_SELL.empty.en);
    if (capLeft <= 0) return this.d.err(s, 'pesca_cap', JO_SELL.cap.pt, JO_SELL.cap.en);
    let rv = 0;
    for (const f of kinds) {
      const price = FISH[f].sell;
      while ((pr.balde[f] ?? 0) > 0 && capLeft >= price) {
        pr.balde[f] = (pr.balde[f] ?? 0) - 1;
        rv += price;
        capLeft -= price;
      }
      if (!pr.balde[f]) delete pr.balde[f];
    }
    if (rv <= 0) return this.d.err(s, 'pesca_cap', JO_SELL.cap.pt, JO_SELL.cap.en);
    pr.sales.rv += rv;
    this.d.onSold?.(rv);
    this.d.save(p);
    this.d.reward(s, rv, { pt: 'Peixe vendido pra Jô', en: 'Fish sold to Jô' });
    s.send({ t: 'pesca', phase: 'sold', rv, coins: p.coins, fish: this.trayRows(p), capLeft: this.capLeft(p) });
  }
}

/** For tests and the e2e: the bite window a client has for this cast. */
export const castWindow = (c: PescaCast) => biteWindow(c);
