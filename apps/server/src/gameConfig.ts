/**
 * Tunable game variables (the admin dashboard's "Game variables" page). The one place the server reads these values from.
 * Overrides are stored in SQLite (`kv` key `gameConfig`) and apply live; a value without an override is the shipped default.
 *
 * Only values the server actually reads are listed, and each one is wired here (world.ts, caderno.ts). Player-facing copy
 * (the how-to-play page, the kiosk badge) still shows the shipped default, so `playerCopy` warns the admin.
 * Browser-safe: solo mode runs World in the page.
 */
import { BELT_LADDER, CADERNO_GROUP_RV, DEFAULT_ROOM_CAP, ECONOMY, IDLE_KICK_MS, MISSION_REWARD, PRAIA_PRICES } from '@tudobem/shared';
import { ADMIN_MONEY_MAX } from './adminAuth.js';

export interface TunableDef {
  key: string;
  group: 'Economy' | 'Timers' | 'World' | 'Admin' | 'Praia';
  label: string;
  help: string;
  default: number;
  min: number;
  max: number;
  unit: string;
  /** Player-facing copy names the shipped number, so it reads stale while overridden. */
  playerCopy?: boolean;
}

export const TUNABLES = [
  { key: 'startingCoins', group: 'Economy', label: 'Starting RV', help: 'RV a brand-new profile starts with.', default: ECONOMY.startingCoins, min: 0, max: 200, unit: 'RV' },
  { key: 'tutorialBonus', group: 'Economy', label: 'Tutorial bonus', help: 'Paid once when every first-steps item is done.', default: ECONOMY.tutorialBonus, min: 0, max: 200, unit: 'RV', playerCopy: true },
  { key: 'kitnetGift', group: 'Economy', label: 'Kitnet welcome gift', help: 'Paid the first time a player walks into their own kitnet. Keep it at or above the cheapest chair (10).', default: ECONOMY.kitnetGift, min: 0, max: 100, unit: 'RV' },
  { key: 'missionReward', group: 'Economy', label: 'Daily mission reward', help: 'Paid when the three kiosk mission steps are done.', default: MISSION_REWARD, min: 0, max: 200, unit: 'RV', playerCopy: true },
  { key: 'cadernoGroupRv', group: 'Economy', label: 'Caderno group bonus', help: 'Paid once per completed caderno group.', default: CADERNO_GROUP_RV, min: 0, max: 100, unit: 'RV', playerCopy: true },
  { key: 'parrotHintCooldownSec', group: 'Timers', label: 'Parrot hint cooldown', help: 'Wait between two parrot hints.', default: ECONOMY.parrotHintCooldownMs / 1000, min: 5, max: 600, unit: 's' },
  { key: 'idleKickMinutes', group: 'Timers', label: 'Idle kick', help: 'No real input for this long and the seat is freed. The warning comes a minute before.', default: IDLE_KICK_MS / 60_000, min: 2, max: 120, unit: 'min' },
  { key: 'roomCap', group: 'World', label: 'Room cap', help: 'Players per room instance before a new instance opens. 16 is the most the client draws.', default: DEFAULT_ROOM_CAP, min: 1, max: DEFAULT_ROOM_CAP, unit: 'players' },
  { key: 'adminGrantMax', group: 'Admin', label: 'Largest single RV grant', help: 'Cap on one admin give/take, in the dashboard and the in-game admin panel.', default: ADMIN_MONEY_MAX, min: 1, max: 5000, unit: 'RV' },
  // the Praia (PRAIA-PLAN.md 8.5). The rental menu reads the prices from the server, so an override is safe.
  { key: 'boatRemoRv', group: 'Praia', label: 'Rowboat rental', help: 'One trip on the barquinho a remo.', default: PRAIA_PRICES.remo, min: 1, max: 500, unit: 'RV' },
  { key: 'boatPescaRv', group: 'Praia', label: 'Fishing boat rental', help: 'One trip on the barco de pesca.', default: PRAIA_PRICES.pesca, min: 1, max: 500, unit: 'RV' },
  { key: 'boatAltoMarRv', group: 'Praia', label: 'Deep-sea boat rental', help: 'One trip on the barco de alto-mar.', default: PRAIA_PRICES.alto_mar, min: 1, max: 500, unit: 'RV' },
  { key: 'boatFestaRv', group: 'Praia', label: 'Party boat', help: 'Paid once by the host of a party boat trip; guests pay nothing.', default: PRAIA_PRICES.festa, min: 1, max: 500, unit: 'RV' },
  { key: 'pescaSaleCapRv', group: 'Praia', label: 'Fish sales cap', help: 'Most RV a player gets selling fish to Jô in one day (São Paulo day).', default: PRAIA_PRICES.saleCap, min: 0, max: 500, unit: 'RV' },
  { key: 'tripMinutes', group: 'Praia', label: 'Boat trip length', help: 'Real minutes a rented boat stays yours (it also ends when you leave the beach).', default: PRAIA_PRICES.tripMinutes, min: 2, max: 60, unit: 'min' },
  { key: 'partyTripMinutes', group: 'Praia', label: 'Party boat trip length', help: 'Real minutes a party boat trip lasts.', default: PRAIA_PRICES.partyMinutes, min: 5, max: 60, unit: 'min' },
  { key: 'partyBoatCap', group: 'Praia', label: 'Party boat cap', help: 'People aboard a party boat, the host included.', default: PRAIA_PRICES.partyCap, min: 2, max: 16, unit: 'players' },
] as const satisfies readonly TunableDef[];

export type TunableKey = (typeof TUNABLES)[number]['key'];

/**
 * Shown on the page but not editable. Wins are the source of truth for belts, so a new pace would re-rank every player at
 * once (and could take a stripe away), and the client draws the stripe bar from its own copy.
 */
export const LOCKED_TUNABLES = [
  {
    key: 'stripePace',
    group: 'Academia',
    label: 'Stripe pace (wins per stripe, per belt)',
    value: BELT_LADDER.map((s) => s.per).join(' / '),
    why: 'Locked (Jonny, 2026-10-05). Belts are derived from total wins, so changing the pace re-ranks every player at once and the client stripe bar would disagree. Change it in packages/shared/src/academia.ts.',
  },
] as const;

const BY_KEY = new Map<string, TunableDef>(TUNABLES.map((t) => [t.key, t]));

export function isTunableKey(k: unknown): k is TunableKey {
  return typeof k === 'string' && BY_KEY.has(k);
}

export interface GameConfigIo {
  load: () => unknown;
  save: (state: unknown) => void;
}

export type SetResult = { ok: true; value: number; before: number } | { ok: false; error: string };

export class GameConfig {
  private overrides = new Map<TunableKey, number>();

  constructor(private io?: GameConfigIo) {
    const raw = io?.load() as { values?: Record<string, unknown> } | null | undefined;
    for (const [k, v] of Object.entries(raw?.values ?? {})) {
      if (!isTunableKey(k)) continue;
      const def = BY_KEY.get(k)!;
      if (typeof v === 'number' && Number.isInteger(v) && v >= def.min && v <= def.max) this.overrides.set(k, v);
      else console.error(`[config] ignoring saved ${k}: out of range`);
    }
  }

  get(key: TunableKey): number {
    return this.overrides.get(key) ?? BY_KEY.get(key)!.default;
  }

  isOverridden(key: TunableKey): boolean {
    return this.overrides.has(key);
  }

  set(key: unknown, raw: unknown): SetResult {
    if (!isTunableKey(key)) return { ok: false, error: 'Unknown variable.' };
    const def = BY_KEY.get(key)!;
    const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof value !== 'number' || !Number.isInteger(value)) return { ok: false, error: 'Whole numbers only.' };
    if (value < def.min || value > def.max) return { ok: false, error: `${def.label} must be ${def.min} to ${def.max}.` };
    const before = this.get(key);
    if (value === def.default) this.overrides.delete(key);
    else this.overrides.set(key, value);
    this.persist();
    return { ok: true, value, before };
  }

  reset(key: unknown): SetResult {
    if (!isTunableKey(key)) return { ok: false, error: 'Unknown variable.' };
    const before = this.get(key);
    this.overrides.delete(key);
    this.persist();
    return { ok: true, value: this.get(key), before };
  }

  list() {
    return TUNABLES.map((t) => ({ ...t, value: this.get(t.key), overridden: this.overrides.has(t.key) }));
  }

  private persist() {
    this.io?.save({ version: 1, values: Object.fromEntries(this.overrides) });
  }
}
