import {
  goodById,
  isVendorId,
  judgePayment,
  ownerOf,
  parsePaid,
  priceFor,
  priceLine,
  priceOptions,
  addCalendarDays,
  resultLine,
  ROOMS,
  sumCoins,
  tileDistance,
  VENDORS,
  FEIRA_CLOSED_NOTE,
  type Bilingual,
  type NpcId,
  type RoomId,
  type Tile,
  type VendorId,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import type { Session } from './world.js';

/** Paid purchases per real day that earn RV (the goods are always handed over). */
export const FEIRA_RV_PER_DAY = 4;
/** RV for paying the exact amount, and for paying too much and taking change. */
export const FEIRA_RV_EXACT = 5;
export const FEIRA_RV_CHANGE = 3;
/** How close you stand to a vendor (to the NPC, or within one tile less of the spot you talk from) and to the Hortifrúti crates. */
export const FEIRA_RANGE = 3;

export interface FeiraDeps {
  now: () => number;
  store: ProfileStore;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  tileOf: (s: Session) => Tile;
  /** The NPCs standing or walking in a room right now (the vendors work 06:00-13:00 by the schedules). */
  npcsIn: (room: RoomId) => { id: NpcId; tile: Tile; interact: Tile; activity: string }[];
  /** The goods go into the bag and finish a matching `pedir` step of a recado (the recados engine's `ordered` event). */
  ordered: (s: Session, npc: NpcId, items: { itemId: string; qty: number }[]) => void;
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The feira counter (HOWTO Phase 9): "Quanto custa?" and the payment. Server-authoritative: prices live in `feira.ts` (shared), a payment is a
 * list of tray pieces that is summed and judged here, and only an exact or an over-payment (change given) hands over the goods. The money is the
 * tray's (nothing is taken from the player's RV); paying earns a little RV, a few times a day.
 */
export class FeiraCounter {
  constructor(private readonly d: FeiraDeps) {}

  private err(s: Session, code: string, pt: string, en: string) {
    s.send({ t: 'error', code, pt, en });
  }

  /** Can this session buy from `vendor` right now? Sends the error itself when not. */
  private serving(s: Session, vendor: unknown, itemId: unknown): VendorId | null {
    if (!s.profile || !s.instance) return null;
    if (!isVendorId(vendor) || !goodById(itemId) || !VENDORS[vendor].goods.includes(itemId as string)) {
      this.err(s, 'feira', 'Essa barraca não vende isso.', 'That stall doesn’t sell that.');
      return null;
    }
    const room = s.instance.def.id;
    // the stalls are in the Feira Livre; the Hortifrúti corner is at the banca on the Rua dos Ipês
    if (room !== (vendor === 'banca' ? 'rua' : 'feira')) {
      this.err(s, 'far', vendor === 'banca' ? 'O hortifrúti fica na banca.' : 'A feira fica na Feira Livre.', vendor === 'banca' ? 'The greengrocer is at the newsstand.' : 'The market is in the Feira Livre.');
      return null;
    }
    const tile = this.d.tileOf(s);
    if (vendor === 'banca') {
      // the Hortifrúti corner sells at every hour (D12)
      const crate = ROOMS.rua.props.find((p) => p.vendor === 'banca');
      const spots = crate ? [{ x: crate.x, y: crate.y }, ...(crate.interact ? [crate.interact] : [])] : [];
      if (!spots.some((t) => tileDistance(tile, t) <= FEIRA_RANGE)) {
        this.err(s, 'far', 'Chegue mais perto do hortifrúti.', 'Walk closer to the greengrocer.');
        return null;
      }
      return vendor;
    }
    const npc = VENDORS[vendor].npc;
    const v = this.d.npcsIn('feira').find((n) => n.id === npc && n.activity === 'trabalhando');
    if (!v) {
      this.err(s, 'feira_closed', FEIRA_CLOSED_NOTE.pt, FEIRA_CLOSED_NOTE.en);
      return null;
    }
    if (tileDistance(tile, v.tile) > FEIRA_RANGE && tileDistance(tile, v.interact) > FEIRA_RANGE - 1) {
      this.err(s, 'far', `Chegue mais perto de ${VENDORS[vendor].name}.`, `Walk closer to ${VENDORS[vendor].name}.`);
      return null;
    }
    return vendor;
  }

  /** `price`: the vendor says what one costs and what each quantity comes to. */
  price(s: Session, vendor: unknown, itemId: unknown) {
    const v = this.serving(s, vendor, itemId);
    if (!v) return;
    s.send({ t: 'feira', phase: 'price', vendor: v, itemId: itemId as string, options: priceOptions(itemId as string), line: priceLine(itemId as string) });
  }

  /** `pay`: judge the tray. Short pays nothing; exact and too-much hand over the goods (with change in the second case). */
  pay(s: Session, vendor: unknown, itemId: unknown, qty: unknown, paidRaw: unknown) {
    const v = this.serving(s, vendor, itemId);
    if (!v) return;
    const p = s.profile!;
    const cents = priceFor(itemId, qty);
    const paid = parsePaid(paidRaw);
    if (cents === null || !paid) return this.err(s, 'feira', 'Não entendi esse pedido.', 'I didn’t understand that order.');
    const id = itemId as string;
    const n = qty as number;
    const total = sumCoins(paid);
    const verdict = judgePayment(cents, paid);
    const line = resultLine(verdict, total, VENDORS[v].fem);
    if (verdict.kind === 'short') {
      s.send({ t: 'feira', phase: 'pay', vendor: v, itemId: id, qty: n, price: cents, paid: total, result: 'short', missing: verdict.missing, line, rv: 0 });
      return;
    }
    // goods: a purchase at the Hortifrúti corner, or Dona Rosa's flowers, counts as Tia Lu's for a recado (`pedir tia_lu ...`)
    const from: NpcId = v === 'banca' || v === 'rosa' ? ownerOf(id) : VENDORS[v].npc;
    this.d.ordered(s, from, [{ itemId: id, qty: n }]);
    let rv = 0;
    const today = addCalendarDays(dayOf(this.d.now()), p.testDayOffset ?? 0);
    const st = p.feira?.date === today ? p.feira : { date: today, n: 0 };
    if (st.n < FEIRA_RV_PER_DAY) {
      st.n += 1;
      rv = verdict.kind === 'exact' ? FEIRA_RV_EXACT : FEIRA_RV_CHANGE;
    }
    p.feira = st;
    this.d.store.save();
    s.send({
      t: 'feira',
      phase: 'pay',
      vendor: v,
      itemId: id,
      qty: n,
      price: cents,
      paid: total,
      result: verdict.kind,
      ...(verdict.kind === 'change' ? { change: verdict.change } : {}),
      line,
      rv,
    });
    if (rv > 0) this.d.reward(s, rv, { pt: 'Compra na feira', en: 'Shopping at the feira' });
    else this.d.pushProfile(s);
  }
}
