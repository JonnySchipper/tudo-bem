import { CADERNO_HEARD_MAX_IDS, cardById, cardsInText, recordHeard, recordSeen, recordUsed } from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import type { Session } from './world.js';

export interface CadernoDeps {
  now: () => number;
  store: ProfileStore;
  pushProfile: (s: Session) => void;
}

/** `heard` is fire-and-forget from a 🔊 button: at most this many messages per window per session. */
const HEARD_RATE = { max: 4, windowMs: 1000 };

/**
 * Caderno de palavras events (HOWTO Phase 7). `world.ts` and the Conversa API report what the player saw,
 * heard and used; this class records it on the profile (the tatame bank weighs its cards by it, challenges.ts).
 * A finished group pays nothing any more: the Diário is the one word home, and `cadernoPaid` only survives on
 * old saves (docs/SIMPLIFICATION-REVIEW.md B2).
 */
export class CadernoTracker {
  private readonly heardTimes = new WeakMap<Session, number[]>();

  constructor(private readonly d: CadernoDeps) {}

  /** The player received PT text (an NPC line, a sign). Cards found in it, plus any listed ids, count as seen. */
  seen(s: Session, text: string, extraIds: readonly string[] = []) {
    this.apply(s, 'seen', [...cardsInText(text), ...extraIds]);
  }

  /** The player typed or said PT text that was accepted (or chatted a line). Cards found in it count as used. */
  used(s: Session, text: string) {
    this.apply(s, 'used', cardsInText(text));
  }

  /** `heard` from the client: validate, rate-limit, record. */
  heard(s: Session, cardIds: unknown) {
    if (!s.profile) return;
    const ids = Array.isArray(cardIds) ? cardIds : null;
    if (!ids || ids.length === 0 || ids.length > CADERNO_HEARD_MAX_IDS || ids.some((id) => typeof id !== 'string' || !cardById(id)))
      return s.send({ t: 'error', code: 'heard', pt: 'Não achei essas palavras.', en: 'I couldn’t find those words.' });
    const now = this.d.now();
    const recent = (this.heardTimes.get(s) ?? []).filter((t) => now - t < HEARD_RATE.windowMs);
    if (recent.length >= HEARD_RATE.max) return; // over the limit: dropped silently, a button mashed too fast
    recent.push(now);
    this.heardTimes.set(s, recent);
    this.apply(s, 'heard', ids as string[]);
  }

  private apply(s: Session, kind: 'seen' | 'heard' | 'used', ids: readonly string[]) {
    const p = s.profile;
    if (!p || !ids.length) return;
    const now = this.d.now();
    p.caderno = (kind === 'seen' ? recordSeen : kind === 'heard' ? recordHeard : recordUsed)(p.caderno, ids, now);
    this.d.store.save(p.id);
    this.d.pushProfile(s);
  }
}
