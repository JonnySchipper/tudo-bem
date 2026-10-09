/**
 * Player moderation shared by server and client: report reasons, report limits, mute and ban copy.
 * Reports and bans are reviewed by a human (admin panel / `GET /api/moderation`); nothing here acts on its own.
 */

export const REPORT_REASONS = ['assedio', 'linguagem', 'spam', 'dados_pessoais', 'outro'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, { pt: string; en: string }> = {
  assedio: { pt: 'Assédio', en: 'Harassment' },
  linguagem: { pt: 'Linguagem ofensiva', en: 'Offensive language' },
  spam: { pt: 'Spam', en: 'Spam' },
  dados_pessoais: { pt: 'Dados pessoais', en: 'Personal info' },
  outro: { pt: 'Outro', en: 'Other' },
};

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === 'string' && (REPORT_REASONS as readonly string[]).includes(v);
}

/** Per reporter (profile): a short burst cap, a daily cap, and one report per target per `dedupeMs`. */
export const REPORT_LIMITS = { perMinute: 5, perDay: 30, dedupeMs: 5 * 60_000 } as const;
/** A target must be online or have left this recently to be reportable. */
export const REPORT_RECENT_MS = 30 * 60_000;
/** Lines of the target's own chat the server snapshots into a report (from the reporter's room). */
export const REPORT_SNAPSHOT_LINES = 5;
/** How far back the snapshot looks. */
export const REPORT_SNAPSHOT_MS = 10 * 60_000;

/** Admin mute length bounds, in minutes. */
export const MUTE_MAX_MINUTES = 7 * 24 * 60;

/** Most players a profile can block. */
export const BLOCK_MAX = 200;

export function mutedCopy(msLeft: number): { pt: string; en: string } {
  const min = Math.max(1, Math.ceil(msLeft / 60_000));
  return {
    pt: `Seu chat está pausado por ${min} min. Você ainda pode jogar normalmente.`,
    en: `Your chat is paused for ${min} min. You can still play as usual.`,
  };
}

export const BANNED_COPY = {
  pt: 'Esta conta foi suspensa por violar as regras da Vila. Se achar que foi um engano, fale com a equipe.',
  en: 'This account was suspended for breaking the neighborhood rules. If you think this is a mistake, contact the team.',
} as const;

/** One row of the admin moderation list (and `GET /api/moderation`). */
export interface ModerationRow {
  kind: 'escalate' | 'block' | 'warn' | 'report';
  surface: string;
  playerId: string;
  playerName: string;
  room: string;
  text: string;
  labels: string[];
  targetId?: string;
  targetName?: string;
  reason?: ReportReason;
  /** Reports: the target's own recent lines, snapshotted on the server. */
  lines?: string[];
  status?: 'pending';
  at: number;
}

/** One row of the admin banned list. */
export interface AdminBannedRow {
  id: string;
  name: string;
  at: number;
}
