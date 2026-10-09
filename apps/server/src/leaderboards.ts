/**
 * Dual Praça leaderboards: Most Words Learned (diary length) and Highest Current
 * Streak (Escola `currentStreak`). Server-authoritative; rebuilt when dirty.
 */
import {
  currentStreak,
  normalizeDiary,
  normalizeEscola,
  rankBoard,
  type BoardEntry,
  type BoardRow,
  type ServerMsg,
} from '@tudobem/shared';
import type { ProfileStore, StoredProfile } from './store.js';
import { todaySaoPaulo } from './store.js';
import type { Session } from './world.js';

export interface LeaderboardSnapshot {
  words: BoardEntry[];
  streak: BoardEntry[];
  at: number;
}

export class Leaderboards {
  private cache: LeaderboardSnapshot | null = null;
  private dirty = true;
  /** playerId -> São Paulo YYYY-MM-DD of last streak mention in the padaria. */
  private mentioned = new Map<string, string>();

  constructor(
    private readonly store: ProfileStore,
    private readonly rng: () => number = Math.random,
    private readonly today: () => string = todaySaoPaulo,
  ) {}

  markDirty() {
    this.dirty = true;
  }

  private rebuild(): LeaderboardSnapshot {
    const today = this.today();
    const words: BoardEntry[] = [];
    const streak: BoardEntry[] = [];
    for (const p of this.store.all()) {
      if (!p.name || p.testUser) continue;
      const diary = normalizeDiary(p.diary);
      const escola = normalizeEscola(p.escola, diary);
      words.push({ id: p.id, name: p.name, score: diary.length });
      streak.push({ id: p.id, name: p.name, score: currentStreak(escola, today) });
    }
    this.cache = { words, streak, at: Date.now() };
    this.dirty = false;
    return this.cache;
  }

  snapshot(): LeaderboardSnapshot {
    if (this.dirty || !this.cache) return this.rebuild();
    return this.cache;
  }

  /** Message for one viewer (top 10 + own rank). */
  msgFor(viewerId: string | undefined): Extract<ServerMsg, { t: 'leaderboards' }> {
    const snap = this.snapshot();
    return {
      t: 'leaderboards',
      words: rankBoard(snap.words, viewerId),
      streak: rankBoard(snap.streak, viewerId),
      at: snap.at,
    };
  }

  sendTo(s: Session) {
    s.send(this.msgFor(s.profile?.id));
  }

  /** #1 streak holder with streak ≥ 1, or null. */
  topStreak(): BoardEntry | null {
    const snap = this.snapshot();
    const rows = rankBoard(snap.streak, undefined, 1);
    const top = rows[0];
    return top && top.score >= 1 ? { id: top.id, name: top.name, score: top.score } : null;
  }

  /**
   * Occasional Padaria counter mention of the streak leader. At most once per player
   * per São Paulo day; ~1 in 4 enters when a leader exists. Unvoiced (dynamic name).
   */
  maybeMentionStreak(s: Session, baker: 'carlos' | 'graca'): { pt: string; en: string } | null {
    const p = s.profile;
    if (!p) return null;
    const today = this.today();
    if (this.mentioned.get(p.id) === today) return null;
    if (this.rng() > 0.25) return null;
    const top = this.topStreak();
    if (!top) return null;
    this.mentioned.set(p.id, today);
    const who = baker === 'graca' ? 'Dona Graça' : 'Seu Carlos';
    const n = top.score;
    const dias = n === 1 ? 'dia' : 'dias';
    const dayEn = n === 1 ? 'day' : 'days';
    return {
      pt: `${who}: "${top.name} tá com ${n} ${dias} de sequência na escola!"`,
      en: `${who}: "${top.name} is on a ${n}-${dayEn} streak at school!"`,
    };
  }
}

/** Test helper: build entries from raw profiles. */
export function entriesFromProfiles(
  profiles: (Pick<StoredProfile, 'id' | 'name' | 'diary' | 'escola'> & { testUser?: boolean })[],
  today: string,
): { words: BoardEntry[]; streak: BoardEntry[] } {
  const words: BoardEntry[] = [];
  const streak: BoardEntry[] = [];
  for (const p of profiles) {
    if (p.testUser) continue;
    const diary = normalizeDiary(p.diary);
    const escola = normalizeEscola(p.escola, diary);
    words.push({ id: p.id, name: p.name, score: diary.length });
    streak.push({ id: p.id, name: p.name, score: currentStreak(escola, today) });
  }
  return { words, streak };
}
