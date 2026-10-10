/**
 * The Praia's admin switch (PRAIA-PLAN.md 1.2): open to everyone, a supporters-first preview, or closed. One kv singleton on the server
 * (`praia`, id `state`), pushed to the client as `{ t: 'praia', phase: 'mode' }`. The preview is only an early-access window: when the
 * beach is open, nobody needs a subscription for any of it (learning is free).
 */
import { isPreviewUnlocked, type PlayerSubscription } from './subscription.js';

export type PraiaMode = 'open' | 'preview' | 'closed';
export const PRAIA_MODES: readonly PraiaMode[] = ['open', 'preview', 'closed'];

export interface PraiaConfig {
  mode: PraiaMode;
  /** The party boat can be started at Bento's shack. Off: the chip reads "Em breve". */
  partyBoat: boolean;
}

export const PRAIA_DEFAULT: PraiaConfig = { mode: 'open', partyBoat: true };

export const isPraiaMode = (v: unknown): v is PraiaMode => typeof v === 'string' && (PRAIA_MODES as readonly string[]).includes(v);

/** A stored blob back to a config: unknown fields are dropped, a bad mode falls back to the default. */
export function normalizePraiaConfig(raw: unknown): PraiaConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    mode: isPraiaMode(o.mode) ? o.mode : PRAIA_DEFAULT.mode,
    partyBoat: typeof o.partyBoat === 'boolean' ? o.partyBoat : PRAIA_DEFAULT.partyBoat,
  };
}

/** May this player be on the beach right now? */
export function praiaAllows(cfg: PraiaConfig, sub: PlayerSubscription | null | undefined, now: number): boolean {
  if (cfg.mode === 'open') return true;
  if (cfg.mode === 'preview') return isPreviewUnlocked({ subscription: sub }, 'praia', now);
  return false;
}

/** The refusal `join('praia')` and the bus sign give while the beach is closed to this player. needs_br: true */
export const PRAIA_CLOSED: { pt: string; en: string } = { pt: 'A praia ainda não abriu.', en: 'The beach is not open yet.' };
