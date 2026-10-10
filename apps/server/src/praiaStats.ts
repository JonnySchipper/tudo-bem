/**
 * Today's numbers for the dashboard's Praia card (PRAIA-PLAN.md 8.5): rentals per tier, catches per species, RV Jô paid, bottles found,
 * party trips. Server memory only, reset at the UTC day roll (a dashboard count is everyone's, so no player's own day applies; playerDay.ts)
 * and with the process; nothing here ranks or pays.
 */
import type { BoatTier, FishId } from '@tudobem/shared';

export interface PraiaToday {
  day: string;
  rentals: Partial<Record<BoatTier, number>>;
  catches: Partial<Record<FishId, number>>;
  soldRv: number;
  bottles: number;
}

/** The dashboard's Praia card: the switch, who is there now, the boats out now, today's numbers. */
export interface PraiaAdminView {
  mode: 'open' | 'preview' | 'closed';
  partyBoat: boolean;
  onBeach: number;
  aboardParty: number;
  /** boats out right now, per tier (festa: party trips) */
  tripsNow: Partial<Record<BoatTier, number>>;
  today: PraiaToday;
}

export class PraiaStats {
  private t: PraiaToday = { day: '', rentals: {}, catches: {}, soldRv: 0, bottles: 0 };

  constructor(private readonly today: () => string) {}

  private roll(): PraiaToday {
    const day = this.today();
    if (this.t.day !== day) this.t = { day, rentals: {}, catches: {}, soldRv: 0, bottles: 0 };
    return this.t;
  }

  rented(tier: BoatTier) {
    const t = this.roll();
    t.rentals[tier] = (t.rentals[tier] ?? 0) + 1;
  }

  caught(fish: FishId) {
    const t = this.roll();
    t.catches[fish] = (t.catches[fish] ?? 0) + 1;
  }

  sold(rv: number) {
    this.roll().soldRv += rv;
  }

  bottle() {
    this.roll().bottles++;
  }

  view(): PraiaToday {
    return structuredClone(this.roll());
  }
}
