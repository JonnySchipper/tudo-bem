/**
 * Seu Bento's boats (PRAIA-PLAN.md 3.3): rent a solo boat for one trip. The price is a server tunable (the menu sends the live number);
 * the RV is debited once, inline, like every shop; nothing is unlocked by level. A trip ends when it is handed back, when its time is up
 * (server clock, a scheduled check), or when the player leaves the beach; its `trip_end` word is taught when it ends.
 */
import {
  BENTO_LINES,
  BOATS,
  FISH,
  SOLO_TIERS,
  emptyPesca,
  isBoatTier,
  isFishId,
  momentWord,
  type BarcoTierRow,
  type BoatTier,
  type DiaryWord,
  type ServerMsg,
  type Tile,
} from '@tudobem/shared';
import type { StoredProfile } from './store.js';
import type { PescaSession } from './pesca.js';

export interface BarcoDeps {
  now(): number;
  save(p: StoredProfile): void;
  pushProfile(s: PescaSession): void;
  err(s: PescaSession, code: string, pt: string, en: string): void;
  tileOf(s: PescaSession): Tile;
  schedule(fn: () => void, ms: number): void;
  teach(s: PescaSession, words: readonly (DiaryWord | undefined)[]): DiaryWord[];
  price(tier: BoatTier): number;
  tripMs(): number;
  partyBoat(): boolean;
  /** a cast out from the boat is gone with it */
  dropCast(s: PescaSession): void;
  /** the live session of a profile (the scheduled end may fire after a reconnect) */
  sessionOf(profileId: string): PescaSession | undefined;
}

const SHACK_RANGE = 2;
const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const TIER_WATER: Record<BoatTier, 'remo' | 'pesca' | 'alto_mar' | 'festa'> = { remo: 'remo', pesca: 'pesca', alto_mar: 'alto_mar', festa: 'festa' };

export class BarcoEngine {
  constructor(private readonly d: BarcoDeps) {}

  handle(s: PescaSession, msg: { action: string; tier?: unknown }): void {
    if (!s.profile) return;
    if (msg.action === 'menu') return this.menu(s);
    if (msg.action === 'rent') return this.rent(s, msg.tier);
    if (msg.action === 'return') return this.end(s, 'returned');
  }

  /** Near Bento's shack (its door, or Bento himself), or on the pier by the party boat's gangway (his boats are moored there). */
  nearShack(s: PescaSession): boolean {
    const def = s.instance?.def;
    if (def?.id !== 'praia') return false;
    const here = this.d.tileOf(s);
    const marks: Tile[] = [];
    const shack = def.props.find((p) => p.id === 'galpao_barcos');
    if (shack) marks.push(shack.interact ?? { x: shack.x, y: shack.y + (shack.h ?? 1) });
    const festa = def.props.find((p) => p.action === 'party_boat');
    if (festa?.interact) marks.push(festa.interact);
    const bento = def.npcs.find((n) => n.id === 'bento');
    if (bento) marks.push(bento.interact);
    return marks.some((t) => cheb(here, t) <= SHACK_RANGE);
  }

  /** The trip under way, if it has not run out. */
  trip(p: StoredProfile) {
    const t = p.pesca?.trip;
    return t && t.until > this.d.now() ? t : null;
  }

  menuMsg(p: StoredProfile): Extract<ServerMsg, { t: 'barco'; phase: 'menu' }> {
    const tiers: BarcoTierRow[] = (['remo', 'pesca', 'alto_mar', 'festa'] as BoatTier[]).map((tier) => {
      const price = this.d.price(tier);
      return {
        tier,
        pt: BOATS[tier].pt,
        en: BOATS[tier].en,
        price,
        canAfford: p.coins >= price,
        newFish: BOATS[tier].newFish.filter(isFishId).map((f) => ({ pt: FISH[f].pt, en: FISH[f].en })),
      };
    });
    const t = this.trip(p);
    return { t: 'barco', phase: 'menu', tiers, trip: t ? { tier: t.tier, until: t.until } : null, partyBoat: this.d.partyBoat() };
  }

  private menu(s: PescaSession) {
    if (!this.nearShack(s)) return this.d.err(s, 'far', 'Os barcos do Bento ficam no galpão.', 'Bento’s boats are at the shack.');
    s.send(this.menuMsg(s.profile!));
  }

  private rent(s: PescaSession, rawTier: unknown) {
    const p = s.profile!;
    if (!isBoatTier(rawTier) || !(SOLO_TIERS as readonly string[]).includes(rawTier)) return;
    const tier = rawTier;
    if (!this.nearShack(s)) return this.d.err(s, 'far', 'Os barcos do Bento ficam no galpão.', 'Bento’s boats are at the shack.');
    if (this.trip(p)) return this.d.err(s, 'barco_trip', 'Você já está com um barco. Devolva antes.', 'You already have a boat. Return it first.');
    const price = this.d.price(tier);
    if (p.coins < price) return this.d.err(s, 'coins', BENTO_LINES.broke.pt, BENTO_LINES.broke.en);
    p.coins -= price;
    const pr = (p.pesca ??= emptyPesca());
    const now = this.d.now();
    const until = now + this.d.tripMs();
    pr.trip = { tier, startedAt: now, until };
    pr.rentals[tier] = (pr.rentals[tier] ?? 0) + 1;
    this.d.save(p);
    this.d.pushProfile(s);
    s.send({ t: 'notice', level: 'reward', pt: `Seu Bento: “${BENTO_LINES.rented.pt}”`, en: `Mr. Bento: “${BENTO_LINES.rented.en}”` });
    s.send({ t: 'barco', phase: 'trip', tier, until });
    // the server clock ends it; a later trip of the same player is not ended by this one's timer
    const id = p.id;
    this.d.schedule(() => {
      const sess = this.d.sessionOf(id);
      const live = sess?.profile?.pesca?.trip;
      if (sess && live && live.startedAt === now) this.end(sess, 'time');
      else if (!sess) {
        // offline: the trip simply runs out (trip() checks `until`)
      }
    }, until - now + 50);
  }

  /** End the trip under way (handed back, the time ran out, the player left the beach). */
  end(s: PescaSession, why: 'returned' | 'time' | 'left') {
    const p = s.profile;
    const t = p?.pesca?.trip;
    if (!p || !t) return;
    p.pesca!.trip = null;
    this.d.dropCast(s);
    this.d.save(p);
    if (why !== 'left') s.send({ t: 'notice', level: 'info', pt: `Seu Bento: “${BENTO_LINES.back.pt}”`, en: `Mr. Bento: “${BENTO_LINES.back.en}”` });
    s.send({ t: 'barco', phase: 'ended', tier: t.tier, why });
    this.d.teach(s, [momentWord(TIER_WATER[t.tier], 'trip_end')]);
    this.d.pushProfile(s);
  }
}
