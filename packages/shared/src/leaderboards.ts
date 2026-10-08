/**
 * Dual leaderboards: Most Words Learned (diary length) and Highest Current Streak
 * (Escola `currentStreak`). Pure ranking; the server supplies scores.
 */

export interface BoardEntry {
  id: string;
  name: string;
  score: number;
}

export interface BoardRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  /** The viewing player. */
  you?: true;
}

const TOP_N = 10;

function byScoreThenName(a: BoardEntry, b: BoardEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  const n = a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' });
  if (n !== 0) return n;
  return a.id.localeCompare(b.id);
}

/** Competition ranking with ties (1, 2, 2, 4). Returns top `topN` plus the viewer if outside. */
export function rankBoard(entries: readonly BoardEntry[], viewerId: string | undefined, topN = TOP_N): BoardRow[] {
  const ordered = [...entries].filter((e) => e.score > 0).sort(byScoreThenName);

  const rankOf = new Map<string, number>();
  let i = 0;
  while (i < ordered.length) {
    const score = ordered[i]!.score;
    const rank = i + 1;
    let j = i;
    while (j < ordered.length && ordered[j]!.score === score) {
      rankOf.set(ordered[j]!.id, rank);
      j++;
    }
    i = j;
  }

  const rows: BoardRow[] = [];
  const seen = new Set<string>();
  for (const e of ordered) {
    if (rows.length >= topN) break;
    rows.push({
      rank: rankOf.get(e.id)!,
      id: e.id,
      name: e.name,
      score: e.score,
      ...(e.id === viewerId ? { you: true as const } : {}),
    });
    seen.add(e.id);
  }

  if (viewerId && !seen.has(viewerId)) {
    const me = entries.find((e) => e.id === viewerId);
    if (me) {
      const rank =
        me.score > 0 ? (rankOf.get(me.id) ?? ordered.length + 1) : ordered.length + 1;
      rows.push({ rank, id: me.id, name: me.name, score: me.score, you: true });
    }
  }

  return rows;
}
