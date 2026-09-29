import {
  CADERNO_GROUP_RV,
  CADERNO_HEARD_MAX_IDS,
  cadernoGroups,
  cardById,
  cardsInText,
  completedGroups,
  recordHeard,
  recordSeen,
  recordUsed,
  type Bilingual,
} from '@tudobem/shared';
import type { ProfileStore } from './store.js';
import type { Session } from './world.js';

export interface CadernoDeps {
  now: () => number;
  store: ProfileStore;
  /** Pays RV through the world's normal reward path (coins, `reward` message, profile push). */
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
}

/** `heard` is fire-and-forget from a 🔊 button: at most this many messages per window per session. */
const HEARD_RATE = { max: 4, windowMs: 1000 };

/**
 * Caderno de palavras events (HOWTO Phase 7). `world.ts` and the Conversa API report what the player saw,
 * heard and used; this class records it on the profile and pays each finished group once.
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
    // A group pays once: mark it paid first, so a failure below can never pay twice.
    const paid = (p.cadernoPaid ??= []);
    const fresh = completedGroups(p.caderno).filter((g) => !paid.includes(g));
    paid.push(...fresh);
    this.d.store.save();
    this.d.pushProfile(s);
    for (const id of fresh) {
      const label = cadernoGroups().find((g) => g.id === id)?.label ?? { pt: id, en: id };
      // needs_br: true
      this.d.reward(s, CADERNO_GROUP_RV, { pt: `Caderno completo: ${label.pt}!`, en: `Notebook complete: ${label.en}!` });
    }
  }
}
