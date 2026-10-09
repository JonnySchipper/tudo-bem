/**
 * Player-facing moderation helpers the World uses: report limits, the server-side chat snapshot a report carries,
 * block lookups, and the rows the admin review list shows. Browser-safe (solo mode imports world.ts).
 */
import { REPORT_LIMITS, REPORT_SNAPSHOT_LINES, REPORT_SNAPSHOT_MS, type ModerationRow } from '@tudobem/shared';
import type { ModerationEvent } from './services/interfaces.js';

export type ReportVerdict = 'ok' | 'rate' | 'daily' | 'dupe';

const DAY_MS = 24 * 60 * 60_000;

/** Per-reporter report limits, keyed by profile id so a reconnect does not reset them. */
export class ReportLimiter {
  private byReporter = new Map<string, { at: number; targetId: string }[]>();

  check(reporterId: string, targetId: string, now: number): ReportVerdict {
    const list = (this.byReporter.get(reporterId) ?? []).filter((r) => now - r.at < DAY_MS);
    this.byReporter.set(reporterId, list);
    if (list.some((r) => r.targetId === targetId && now - r.at < REPORT_LIMITS.dedupeMs)) return 'dupe';
    if (list.filter((r) => now - r.at < 60_000).length >= REPORT_LIMITS.perMinute) return 'rate';
    if (list.length >= REPORT_LIMITS.perDay) return 'daily';
    return 'ok';
  }

  record(reporterId: string, targetId: string, now: number) {
    const list = this.byReporter.get(reporterId) ?? [];
    list.push({ at: now, targetId });
    this.byReporter.set(reporterId, list);
  }
}

/** One delivered chat line in a room's report log. */
export interface ChatLogLine {
  playerId: string;
  text: string;
  at: number;
}

/** How many delivered lines each room keeps for report snapshots. */
export const CHAT_LOG_LINES = 60;

/** The target's own recent lines from a room's log (oldest first), as the server delivered them. */
export function snapshotLines(log: readonly ChatLogLine[], targetId: string, now: number): string[] {
  return log
    .filter((l) => l.playerId === targetId && now - l.at <= REPORT_SNAPSHOT_MS)
    .slice(-REPORT_SNAPSHOT_LINES)
    .map((l) => l.text);
}

/** Has `viewer` blocked `otherId`? */
export function hasBlocked(viewer: { blocked?: string[] } | undefined, otherId: string): boolean {
  return !!viewer?.blocked?.includes(otherId);
}

/** Newest first, without the model trace (the review list does not need it). */
export function moderationRows(events: readonly ModerationEvent[], limit: number, since = 0): ModerationRow[] {
  const rows: ModerationRow[] = [];
  for (let i = events.length - 1; i >= 0 && rows.length < limit; i--) {
    const e = events[i]!;
    if (e.at < since) continue;
    rows.push({
      kind: e.kind,
      surface: e.surface,
      playerId: e.playerId,
      playerName: e.playerName,
      room: e.room,
      text: e.text,
      labels: e.labels,
      ...(e.targetId ? { targetId: e.targetId } : {}),
      ...(e.targetName ? { targetName: e.targetName } : {}),
      ...(e.reason ? { reason: e.reason } : {}),
      ...(e.lines ? { lines: e.lines } : {}),
      ...(e.status ? { status: e.status } : {}),
      at: e.at,
    });
  }
  return rows;
}
