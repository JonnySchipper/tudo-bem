/**
 * Admin dashboard tables (SQLite, same file as everything else):
 * - `admin_audit`: one row per admin write. Append-only: triggers in the schema refuse UPDATE and DELETE.
 * - `billing_events`: what each Lemon Squeezy webhook did (the profile only keeps event ids).
 * - `kv.feedbackTriage`: new / seen / done and a note per feedback row.
 */
import { loadKv, saveKv, type SqliteDatabase } from './sqliteDb.js';

/** Keys never sent to the dashboard, wherever they sit in a snapshot. Restores read the raw row. */
const SECRET_KEYS = new Set(['passwordHash', 'token', 'billingEventIds', 'hash']);

export function redact<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null, (k, v) => (SECRET_KEYS.has(k) ? undefined : v))) as T;
}

export interface AuditInput {
  actor: string;
  action: string;
  target?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  /** Full rows taken before a destructive action, so it can be restored. */
  snapshot?: unknown;
}

export interface AuditEntry {
  id: number;
  at: number;
  actor: string;
  action: string;
  target: string | null;
  summary: string;
  before: unknown;
  after: unknown;
  hasSnapshot: boolean;
}

interface AuditRow {
  id: number;
  at: number;
  actor: string;
  action: string;
  target: string | null;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  has_snapshot: number;
}

const parse = (raw: string | null): unknown => {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v));

export class AdminAudit {
  constructor(
    private db: SqliteDatabase,
    private now: () => number = Date.now,
  ) {}

  append(e: AuditInput): number {
    const r = this.db
      .prepare('INSERT INTO admin_audit (at, actor, action, target, summary, before_json, after_json, snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(this.now(), e.actor.slice(0, 80), e.action, e.target ?? null, e.summary.slice(0, 500), json(e.before), json(e.after), json(e.snapshot));
    return Number(r.lastInsertRowid);
  }

  list(opts: { limit?: number; beforeId?: number; action?: string; target?: string } = {}): AuditEntry[] {
    const where: string[] = [];
    const args: unknown[] = [];
    if (opts.beforeId) (where.push('id < ?'), args.push(opts.beforeId));
    if (opts.action) (where.push('action = ?'), args.push(opts.action));
    if (opts.target) (where.push('target = ?'), args.push(opts.target));
    const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
    const sql = `SELECT id, at, actor, action, target, summary, before_json, after_json, snapshot_json IS NOT NULL AS has_snapshot FROM admin_audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${limit}`;
    return (this.db.prepare(sql).all(...args) as AuditRow[]).map((r) => this.entry(r));
  }

  /** One entry, its snapshot redacted (no password or session hashes). */
  get(id: number): (AuditEntry & { snapshot: unknown }) | null {
    const row = this.db
      .prepare('SELECT id, at, actor, action, target, summary, before_json, after_json, snapshot_json IS NOT NULL AS has_snapshot, snapshot_json FROM admin_audit WHERE id = ?')
      .get(id) as (AuditRow & { snapshot_json: string | null }) | undefined;
    if (!row) return null;
    return { ...this.entry(row), snapshot: redact(parse(row.snapshot_json)) };
  }

  /** The snapshot as written, for a restore. Never sent to the client. */
  rawSnapshot(id: number): { action: string; target: string | null; snapshot: unknown } | null {
    const row = this.db.prepare('SELECT action, target, snapshot_json FROM admin_audit WHERE id = ?').get(id) as { action: string; target: string | null; snapshot_json: string | null } | undefined;
    if (!row?.snapshot_json) return null;
    return { action: row.action, target: row.target, snapshot: parse(row.snapshot_json) };
  }

  actions(): string[] {
    return (this.db.prepare('SELECT DISTINCT action FROM admin_audit ORDER BY action').all() as { action: string }[]).map((r) => r.action);
  }

  private entry(r: AuditRow): AuditEntry {
    return {
      id: r.id,
      at: r.at,
      actor: r.actor,
      action: r.action,
      target: r.target,
      summary: r.summary,
      before: redact(parse(r.before_json)),
      after: redact(parse(r.after_json)),
      hasSnapshot: !!r.has_snapshot,
    };
  }
}

export interface BillingEventRow {
  id: number;
  at: number;
  eventId: string;
  kind: string;
  profileId: string | null;
  status: string | null;
  /** applied | duplicate | ignored_user | rejected */
  outcome: string;
}

/** The newest rows are kept; older ones are trimmed so the table stays small. */
export const BILLING_EVENTS_KEEP = 5000;

export class BillingEventLog {
  constructor(
    private db: SqliteDatabase,
    private now: () => number = Date.now,
  ) {}

  add(e: Omit<BillingEventRow, 'id' | 'at'>) {
    this.db
      .prepare('INSERT INTO billing_events (at, event_id, kind, profile_id, status, outcome) VALUES (?, ?, ?, ?, ?, ?)')
      .run(this.now(), e.eventId.slice(0, 120), e.kind.slice(0, 40), e.profileId, e.status?.slice(0, 40) ?? null, e.outcome);
    this.db.prepare('DELETE FROM billing_events WHERE id <= (SELECT MAX(id) FROM billing_events) - ?').run(BILLING_EVENTS_KEEP);
  }

  list(opts: { limit?: number; profileId?: string } = {}): BillingEventRow[] {
    const limit = Math.max(1, Math.min(1000, opts.limit ?? 200));
    const rows = opts.profileId
      ? this.db.prepare(`SELECT * FROM billing_events WHERE profile_id = ? ORDER BY id DESC LIMIT ${limit}`).all(opts.profileId)
      : this.db.prepare(`SELECT * FROM billing_events ORDER BY id DESC LIMIT ${limit}`).all();
    return (rows as { id: number; at: number; event_id: string; kind: string; profile_id: string | null; status: string | null; outcome: string }[]).map((r) => ({
      id: r.id,
      at: r.at,
      eventId: r.event_id,
      kind: r.kind,
      profileId: r.profile_id,
      status: r.status,
      outcome: r.outcome,
    }));
  }
}

export const FEEDBACK_STATUSES = ['new', 'seen', 'done'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackTriageRow {
  status: FeedbackStatus;
  note: string;
  at: number;
}

export function isFeedbackStatus(v: unknown): v is FeedbackStatus {
  return typeof v === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(v);
}

export class FeedbackTriage {
  private rows = new Map<string, FeedbackTriageRow>();

  constructor(
    private db: SqliteDatabase,
    private now: () => number = Date.now,
  ) {
    const raw = loadKv(db, 'feedbackTriage') as { items?: Record<string, FeedbackTriageRow> } | null;
    for (const [id, r] of Object.entries(raw?.items ?? {})) {
      if (r && isFeedbackStatus(r.status)) this.rows.set(id, { status: r.status, note: typeof r.note === 'string' ? r.note.slice(0, 1000) : '', at: Number(r.at) || 0 });
    }
  }

  get(id: string): FeedbackTriageRow {
    return this.rows.get(id) ?? { status: 'new', note: '', at: 0 };
  }

  set(id: string, status: FeedbackStatus, note: string): FeedbackTriageRow {
    const row = { status, note: note.slice(0, 1000), at: this.now() };
    this.rows.set(id, row);
    saveKv(this.db, 'feedbackTriage', { version: 1, items: Object.fromEntries(this.rows) });
    return row;
  }
}
