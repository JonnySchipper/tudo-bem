/**
 * The party boat (PRAIA-PLAN.md 5): a host pays Bento for a trip, invites online friends, and everyone sails one `barco_festa` instance
 * together. Trips live in server memory only (a trip never outlives a process). The deck is an ordinary instance, so chat goes through
 * `World.chat()` unchanged; only the roster decides who may join it (`World.instanceFor`).
 *
 * Shared moments: a catch by anyone aboard teaches that fish's word to everyone aboard; the music starts when a second person boards; the
 * sunset with company teaches "pôr do sol". At the end every member is moved to the pier with the trip card, and the earned items are
 * granted: the captain's cap (once per player, after five minutes aboard with company), the giant shell (three catches or more), the wall
 * net (the host, when everyone aboard caught something).
 */
import {
  ALL_HATS,
  PARTY_LINES,
  emptyPesca,
  fishWord,
  momentWord,
  type Bilingual,
  type DiaryWord,
  type EarnMoment,
  type FishId,
  type PartyEndWhy,
  type PartySummary,
  type ServerMsg,
} from '@tudobem/shared';
import type { StoredProfile } from './store.js';
import { hasBlocked } from './playerModeration.js';

export interface PartySession {
  id: string;
  profile?: StoredProfile;
  instance?: { id: string; def: { id: string } } | null;
  send(m: ServerMsg): void;
}

export interface PartyDeps {
  now(): number;
  schedule(fn: () => void, ms: number): void;
  profile(id: string): StoredProfile | undefined;
  save(...ids: string[]): void;
  sessionOf(profileId: string): PartySession | undefined;
  pushProfile(s: PartySession): void;
  err(s: PartySession, code: string, pt: string, en: string): void;
  /** DiaryTracker.teachPesca: the words newly learned */
  teach(s: PartySession, words: readonly (DiaryWord | undefined)[]): DiaryWord[];
  /** board the trip's deck (World.join into the trip's instance); false when the join was refused */
  board(s: PartySession, tripId: string): boolean;
  /** back to the pier next to the boat (or the Vila's bus stop when the beach has closed) */
  ashore(s: PartySession): void;
  /** within reach of Bento's shack or the party boat's gangway on the pier */
  nearBoat(s: PartySession): boolean;
  /** in a Correria shift, a bout or a cart game */
  busy(s: PartySession): boolean;
  enabled(): boolean;
  price(): number;
  cap(): number;
  tripMs(): number;
  /** how long a member must sail with company to earn the captain's cap (5 minutes; seconds under TB_TEST_PESCA) */
  companyMs(): number;
  /** the game clock, minutes since midnight */
  minute(): number;
  /** a hat was put on: tell the room */
  avatarChanged(s: PartySession): void;
  /** a trip set sail (the dashboard counts them) */
  onTrip?(): void;
}

interface Member {
  name: string;
  joinedAt: number;
  /** time aboard with at least one other person */
  companyMs: number;
}

export interface PartyTrip {
  id: string;
  hostId: string;
  members: Map<string, Member>;
  /** pending invites: profile id → expiry */
  invited: Map<string, number>;
  startedAt: number;
  endsAt: number;
  catches: { fish: FishId; by: string; byId: string }[];
  /** the words shared aboard (catches, the music, the sunset), by Portuguese text */
  words: Map<string, Bilingual>;
  /** everyone who has sailed on it (display names) */
  sailed: Map<string, string>;
  music: boolean;
  sunsetSeen: boolean;
  /** last time `companyMs` was brought up to date */
  accruedAt: number;
  over: boolean;
}

export const INVITE_MS = 90_000;
export const CAPTAIN_HAT = 'chapeu_capitao';
const SUNSET_FROM = 17 * 60 + 30;
const SUNSET_TO = 18 * 60 + 30;

const NOT_YOURS: Bilingual = { pt: 'Esse barco é de outra turma.', en: 'That boat belongs to another group.' };
const FULL: Bilingual = { pt: 'O barco está lotado!', en: 'The boat is full!' };

/** The live trips for the dashboard's Praia card. */
export interface PartyStats {
  active: number;
  aboard: number;
}

export class PartyBoats {
  readonly byHost = new Map<string, PartyTrip>();
  readonly byMember = new Map<string, PartyTrip>();
  readonly byId = new Map<string, PartyTrip>();

  constructor(private readonly d: PartyDeps) {}

  handle(s: PartySession, msg: { action: string; targetId?: unknown; tripId?: unknown }): void {
    if (!s.profile) return;
    switch (msg.action) {
      case 'create':
        return this.create(s);
      case 'invite':
        return this.invite(s, String(msg.targetId ?? '').slice(0, 64));
      case 'accept':
        return this.accept(s, String(msg.tripId ?? '').slice(0, 96));
      case 'decline':
        return this.decline(s, String(msg.tripId ?? '').slice(0, 96));
      case 'leave':
        return this.leave(s);
      case 'remove':
        return this.remove(s, String(msg.targetId ?? '').slice(0, 64));
      case 'end': {
        const trip = this.byHost.get(s.profile.id);
        if (trip) this.end(trip, 'host');
        return;
      }
    }
  }

  tripOf(profileId: string): PartyTrip | undefined {
    return this.byMember.get(profileId);
  }

  /** Is this session on its trip's deck right now (the `festa` water)? */
  aboard(s: PartySession): boolean {
    const trip = s.profile ? this.byMember.get(s.profile.id) : undefined;
    return !!trip && !trip.over && s.instance?.id === trip.id;
  }

  /** `World.instanceFor`: may this player join this deck? A reason when not. */
  admit(profileId: string, instanceId: string | undefined, aboardNow: number): { trip: PartyTrip } | { error: Bilingual } {
    const trip = this.byMember.get(profileId);
    if (!trip || trip.over || (instanceId && instanceId !== trip.id)) return { error: NOT_YOURS };
    if (aboardNow >= this.d.cap()) return { error: FULL };
    return { trip };
  }

  stats(): PartyStats {
    let aboard = 0;
    for (const t of this.byId.values()) aboard += t.members.size;
    return { active: this.byId.size, aboard };
  }

  // ---------------------------------------------------------------- create, invite, accept

  private create(s: PartySession) {
    const p = s.profile!;
    if (!this.d.enabled()) return this.d.err(s, 'party', 'O barco de festa ainda não está saindo.', 'The party boat is not sailing yet.');
    if (!this.d.nearBoat(s)) return this.d.err(s, 'far', 'O barco de festa sai do píer do Bento.', 'The party boat leaves from Bento’s pier.');
    if (this.byMember.has(p.id)) return this.d.err(s, 'party', 'Você já está num barco de festa.', 'You are already on a party boat.');
    if (p.pesca?.trip && p.pesca.trip.until > this.d.now()) return this.d.err(s, 'barco_trip', 'Você já está com um barco. Devolva antes.', 'You already have a boat. Return it first.');
    const price = this.d.price();
    if (p.coins < price) return this.d.err(s, 'coins', 'RV insuficiente, viu? Pesca na praia e vende pra Jô.', 'Not enough RV. Fish from the beach and sell to Jô.');
    const now = this.d.now();
    const trip: PartyTrip = {
      id: `festa@${p.id}-${now}`,
      hostId: p.id,
      members: new Map([[p.id, { name: p.name, joinedAt: now, companyMs: 0 }]]),
      invited: new Map(),
      startedAt: now,
      endsAt: now + this.d.tripMs(),
      catches: [],
      words: new Map(),
      sailed: new Map([[p.id, p.name]]),
      music: false,
      sunsetSeen: false,
      accruedAt: now,
      over: false,
    };
    this.byHost.set(p.id, trip);
    this.byMember.set(p.id, trip);
    this.byId.set(trip.id, trip);
    if (!this.d.board(s, trip.id)) {
      this.forget(trip);
      return;
    }
    // paid only once the deck is really yours
    p.coins -= price;
    const pr = (p.pesca ??= emptyPesca());
    pr.rentals.festa = (pr.rentals.festa ?? 0) + 1;
    pr.party.hosted++;
    this.d.save(p.id);
    this.d.pushProfile(s);
    this.d.onTrip?.();
    s.send({ t: 'notice', level: 'reward', pt: 'Seu Bento: “Tá alugado. Volta antes da maré virar!”', en: 'Mr. Bento: “It’s rented. Be back before the tide turns!”' });
    this.share(trip, [p.id], ['host_board']);
    this.pushState(trip);
    const id = trip.id;
    this.d.schedule(() => {
      const live = this.byId.get(id);
      if (live) this.end(live, 'time');
    }, trip.endsAt - now + 50);
  }

  private liveInvites(trip: PartyTrip): number {
    const now = this.d.now();
    for (const [id, exp] of trip.invited) if (exp <= now) trip.invited.delete(id);
    return trip.invited.size;
  }

  private invite(s: PartySession, targetId: string) {
    const p = s.profile!;
    const trip = this.byHost.get(p.id);
    if (!trip) return this.d.err(s, 'party', 'Alugue o barco de festa primeiro.', 'Rent the party boat first.');
    const target = this.d.profile(targetId);
    if (!target || target.id === p.id) return;
    if (!p.friends.includes(target.id)) return this.d.err(s, 'party', 'Só dá pra chamar amigos.', 'You can only invite friends.');
    // blocked either way: it looks sent, nothing reaches them (the friend-request rule)
    if (hasBlocked(p, target.id)) return this.d.err(s, 'party', 'Desbloqueie essa pessoa primeiro.', 'Unblock this player first.');
    const ts = this.d.sessionOf(target.id);
    if (!ts) return this.d.err(s, 'party', `${target.name} não está online.`, `${target.name} is not online.`);
    if (trip.members.has(target.id)) return this.d.err(s, 'party', `${target.name} já está a bordo.`, `${target.name} is already aboard.`);
    if (this.byMember.has(target.id)) return this.d.err(s, 'party', `${target.name} já está em outro barco.`, `${target.name} is already on another boat.`);
    if (this.d.busy(ts)) return this.d.err(s, 'busy', `${target.name} está ocupado agora.`, `${target.name} is busy right now.`);
    const pending = this.liveInvites(trip) - (trip.invited.has(target.id) ? 1 : 0);
    if (trip.members.size + pending >= this.d.cap()) return this.d.err(s, 'party', FULL.pt, FULL.en);
    s.send({ t: 'notice', level: 'info', pt: `Convite enviado para ${target.name}.`, en: `Invite sent to ${target.name}.` });
    if (hasBlocked(target, p.id)) return;
    const expiresAt = this.d.now() + INVITE_MS;
    trip.invited.set(target.id, expiresAt);
    ts.send({ t: 'party', phase: 'invite', tripId: trip.id, fromId: p.id, fromName: p.name, expiresAt });
    const tripId = trip.id;
    this.d.schedule(() => {
      const live = this.byId.get(tripId);
      if (!live || live.invited.get(target.id) !== expiresAt) return;
      live.invited.delete(target.id);
      const hs = this.d.sessionOf(live.hostId);
      hs?.send({ t: 'notice', level: 'info', pt: `${target.name} não respondeu.`, en: `${target.name} didn’t answer.` });
    }, INVITE_MS + 50);
  }

  private accept(s: PartySession, tripId: string) {
    const p = s.profile!;
    const trip = this.byId.get(tripId);
    const exp = trip?.invited.get(p.id);
    if (!trip || trip.over || !exp || exp <= this.d.now()) return this.d.err(s, 'party', 'Esse convite já passou.', 'That invite has expired.');
    if (this.byMember.has(p.id)) return this.d.err(s, 'party', 'Você já está num barco de festa.', 'You are already on a party boat.');
    if (this.d.busy(s)) return this.d.err(s, 'busy', 'Termine o que está fazendo primeiro.', 'Finish what you are doing first.');
    if (trip.members.size >= this.d.cap()) return this.d.err(s, 'party', FULL.pt, FULL.en);
    trip.invited.delete(p.id);
    this.accrue(trip);
    trip.members.set(p.id, { name: p.name, joinedAt: this.d.now(), companyMs: 0 });
    this.byMember.set(p.id, trip);
    if (!this.d.board(s, trip.id)) {
      trip.members.delete(p.id);
      this.byMember.delete(p.id);
      return;
    }
    trip.sailed.set(p.id, p.name);
    (p.pesca ??= emptyPesca()).party.guested++;
    this.d.save(p.id);
    this.share(trip, [p.id], ['accept_invite', 'guest_board']);
    this.onCompany(trip);
    this.pushState(trip);
  }

  private decline(s: PartySession, tripId: string) {
    const p = s.profile!;
    const trip = this.byId.get(tripId);
    if (!trip?.invited.delete(p.id)) return;
    this.d.sessionOf(trip.hostId)?.send({ t: 'notice', level: 'info', pt: `${p.name} não respondeu.`, en: `${p.name} didn’t answer.` });
  }

  // ---------------------------------------------------------------- leaving

  /** "Desembarcar": the host's ends the trip for everyone (the client confirms first); a guest goes ashore alone. */
  private leave(s: PartySession) {
    const p = s.profile!;
    const trip = this.byMember.get(p.id);
    if (!trip) return;
    if (trip.hostId === p.id) return this.end(trip, 'host');
    this.dropMember(trip, p.id, 'left');
    this.d.ashore(s);
  }

  /** The host sends one guest ashore: a neutral notice to them, nothing to the others. */
  private remove(s: PartySession, targetId: string) {
    const trip = this.byHost.get(s.profile!.id);
    if (!trip || targetId === trip.hostId || !trip.members.has(targetId)) return;
    this.kick(trip, targetId);
  }

  private kick(trip: PartyTrip, targetId: string) {
    this.dropMember(trip, targetId, 'removed');
    const ts = this.d.sessionOf(targetId);
    if (ts) {
      ts.send({ t: 'notice', level: 'info', pt: PARTY_LINES.desembarcou.pt, en: PARTY_LINES.desembarcou.en });
      if (ts.instance?.id === trip.id) this.d.ashore(ts);
    }
  }

  /**
   * `World.leaveInstance`: a member left the deck by the gangway, another room or a disconnect. The host leaving ends the trip for
   * everyone. (Moves made by this class drop the member first, so this is a no-op for them.)
   */
  onLeftDeck(profileId: string, instanceId: string) {
    const trip = this.byMember.get(profileId);
    if (!trip || trip.id !== instanceId || trip.over) return;
    if (trip.hostId === profileId) return this.end(trip, 'host');
    this.dropMember(trip, profileId, 'left');
  }

  /** A block during a trip: no more invites to the blocked player, and a host who blocks a guest sends them ashore. */
  onBlock(blockerId: string, blockedId: string) {
    const hosted = this.byHost.get(blockerId);
    if (hosted) {
      hosted.invited.delete(blockedId);
      if (hosted.members.has(blockedId)) this.kick(hosted, blockedId);
    }
    const theirs = this.byHost.get(blockedId);
    theirs?.invited.delete(blockerId);
  }

  /** The admin switched the party boat off: every trip comes back to the pier now. */
  endAll(why: PartyEndWhy) {
    for (const trip of [...this.byId.values()]) this.end(trip, why);
  }

  private dropMember(trip: PartyTrip, profileId: string, why: PartyEndWhy) {
    this.accrue(trip);
    const m = trip.members.get(profileId);
    trip.members.delete(profileId);
    this.byMember.delete(profileId);
    if (!m) return;
    const s = this.d.sessionOf(profileId);
    const p = this.d.profile(profileId);
    const earned = p && why !== 'removed' ? this.grantCaptain(p, m, s) : [];
    if (p && earned.length) this.d.save(p.id);
    s?.send({ t: 'party', phase: 'ended', why, ...(why === 'removed' ? {} : { summary: this.summary(trip, earned) }) });
    if (s && earned.length) this.d.pushProfile(s);
    this.pushState(trip);
  }

  /** The trip is over (time, the host, the admin): grants, the card, and everyone back to the pier. */
  end(trip: PartyTrip, why: PartyEndWhy) {
    if (trip.over) return;
    this.accrue(trip);
    trip.over = true;
    const members = [...trip.members.entries()];
    this.forget(trip);
    const everyoneCaught = members.every(([id]) => trip.catches.some((c) => c.byId === id));
    for (const [id, m] of members) {
      const p = this.d.profile(id);
      const s = this.d.sessionOf(id);
      const earned: string[] = [];
      if (p) {
        earned.push(...this.grantCaptain(p, m, s));
        if (trip.catches.length >= 3 && this.giveFurniture(p, 'concha_grande')) earned.push('concha_grande');
        if (id === trip.hostId && trip.catches.length > 0 && everyoneCaught && this.giveFurniture(p, 'rede_pesca_parede')) earned.push('rede_pesca_parede');
        this.d.save(p.id);
      }
      if (!s) continue;
      s.send({ t: 'party', phase: 'ended', why, summary: this.summary(trip, earned) });
      s.send({ t: 'notice', level: 'info', pt: PARTY_LINES.voltou.pt, en: PARTY_LINES.voltou.en });
      if (s.instance?.id === trip.id) this.d.ashore(s);
      this.d.pushProfile(s);
    }
    for (const id of trip.invited.keys()) this.d.sessionOf(id)?.send({ t: 'party', phase: 'ended', why });
  }

  private forget(trip: PartyTrip) {
    this.byId.delete(trip.id);
    if (this.byHost.get(trip.hostId) === trip) this.byHost.delete(trip.hostId);
    for (const id of trip.members.keys()) if (this.byMember.get(id) === trip) this.byMember.delete(id);
  }

  // ---------------------------------------------------------------- shared moments

  /** A catch on the deck: everyone aboard hears it and learns the fish's word. */
  onCatch(s: PartySession, fish: FishId) {
    const p = s.profile;
    const trip = p ? this.byMember.get(p.id) : undefined;
    if (!p || !trip || !this.aboard(s)) return;
    trip.catches.push({ fish, by: p.name, byId: p.id });
    const word = fishWord(fish);
    if (word) trip.words.set(word.pt, { pt: word.pt, en: word.en });
    for (const id of trip.members.keys()) {
      const ms = this.d.sessionOf(id);
      if (!ms || ms.instance?.id !== trip.id) continue;
      if (id !== p.id) {
        ms.send({ t: 'pesca', phase: 'aboard', by: p.name, fish, pt: word?.pt ?? fish, en: word?.en ?? fish });
        this.d.teach(ms, [word]);
      }
    }
  }

  /** Teach these moment words of the festa water to these members (and keep them for the trip card). */
  private share(trip: PartyTrip, ids: readonly string[], moments: EarnMoment[]) {
    const words = moments.map((m) => momentWord('festa', m));
    for (const w of words) if (w) trip.words.set(w.pt, { pt: w.pt, en: w.en });
    for (const id of ids) {
      const ms = this.d.sessionOf(id);
      if (ms) this.d.teach(ms, words);
    }
  }

  /** Two or more aboard: the music starts (everyone learns "festa"), and maybe the sunset. */
  private onCompany(trip: PartyTrip) {
    if (trip.members.size < 2) return;
    // whoever boards a party already playing hears the music too
    this.share(trip, [...trip.members.keys()], ['music']);
    trip.music = true;
    this.checkSunset(trip);
  }

  private checkSunset(trip: PartyTrip) {
    if (trip.sunsetSeen || trip.members.size < 2) return;
    const m = this.d.minute();
    if (m < SUNSET_FROM || m >= SUNSET_TO) return;
    trip.sunsetSeen = true;
    this.share(trip, [...trip.members.keys()], ['sunset_aboard']);
  }

  /** The periodic sweep: trips that ran out (a backstop to the scheduled end) and the sunset. */
  sweep() {
    const now = this.d.now();
    for (const trip of [...this.byId.values()]) {
      if (trip.endsAt <= now) this.end(trip, 'time');
      else this.checkSunset(trip);
    }
  }

  // ---------------------------------------------------------------- grants and messages

  private accrue(trip: PartyTrip) {
    const now = this.d.now();
    if (trip.members.size >= 2) for (const m of trip.members.values()) m.companyMs += now - trip.accruedAt;
    trip.accruedAt = now;
  }

  /** The captain's cap, once per player: five minutes aboard with company. The founder-hat pattern: owned, worn, saved, pushed. */
  private grantCaptain(p: StoredProfile, m: Member, s: PartySession | undefined): string[] {
    if (m.companyMs < this.d.companyMs() || p.hats.includes(CAPTAIN_HAT)) return [];
    if (!ALL_HATS.some((h) => h.id === CAPTAIN_HAT)) return [];
    p.hats.push(CAPTAIN_HAT);
    p.hat = CAPTAIN_HAT;
    if (s) this.d.avatarChanged(s);
    return [CAPTAIN_HAT];
  }

  private giveFurniture(p: StoredProfile, id: string): boolean {
    if ((p.furniture[id] ?? 0) > 0) return false;
    p.furniture[id] = 1;
    return true;
  }

  private summary(trip: PartyTrip, earned: string[]): PartySummary {
    return {
      fish: trip.catches.map((c) => ({ fish: c.fish, by: c.by })),
      words: [...trip.words.values()],
      members: [...trip.sailed.values()],
      earned,
    };
  }

  stateMsg(trip: PartyTrip): Extract<ServerMsg, { t: 'party'; phase: 'state' }> {
    return {
      t: 'party',
      phase: 'state',
      tripId: trip.id,
      hostId: trip.hostId,
      members: [...trip.members.entries()].map(([id, m]) => ({ id, name: m.name })),
      endsAt: trip.endsAt,
      cap: this.d.cap(),
      music: trip.music,
    };
  }

  private pushState(trip: PartyTrip) {
    if (trip.over) return;
    const msg = this.stateMsg(trip);
    for (const id of trip.members.keys()) this.d.sessionOf(id)?.send(msg);
  }
}
