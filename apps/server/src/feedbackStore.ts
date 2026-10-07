/**
 * Player feedback notes. Same shape as the other JSON stores: an adapter loads and saves the file.
 * Node writes `feedback.json` (mode 0600 — a guest may have typed a contact). Tests pass null.
 */
import type { FeedbackCategory } from '@tudobem/shared';
import type { RoomId } from '@tudobem/shared';

export const FEEDBACK_FILE_MAX = 2000;

export interface FeedbackRow {
  id: string;
  createdAt: number;
  text: string;
  category: FeedbackCategory | null;
  contact: string | null;
  accountId: string | null;
  profileId: string | null;
  room: RoomId | null;
}

export interface FeedbackFile {
  version: 1;
  items: FeedbackRow[];
}

export interface FeedbackPersistence {
  load(): unknown;
  save(data: FeedbackFile): void;
  describe(): string;
}

const CATEGORIES = new Set(['bug', 'idea', 'love']);
const ROOMS = new Set(['praca', 'rua', 'rua_leste', 'feira', 'padaria', 'kitnet', 'academia', 'escola', 'andar']);

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeFeedbackRow(raw: unknown): FeedbackRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || !/^[a-f0-9]{8,32}$/.test(row.id)) return null;
  if (typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt) || row.createdAt < 0) return null;
  if (typeof row.text !== 'string' || !row.text.trim() || row.text.length > 500) return null;
  const category = row.category == null ? null : CATEGORIES.has(String(row.category)) ? (row.category as FeedbackCategory) : null;
  if (row.category != null && category == null) return null;
  const contact = row.contact == null ? null : typeof row.contact === 'string' && row.contact.length <= 80 ? row.contact : null;
  if (row.contact != null && contact == null) return null;
  const accountId = row.accountId == null ? null : typeof row.accountId === 'string' && row.accountId.length <= 64 ? row.accountId : null;
  if (row.accountId != null && accountId == null) return null;
  const profileId = row.profileId == null ? null : typeof row.profileId === 'string' && row.profileId.length <= 64 ? row.profileId : null;
  if (row.profileId != null && profileId == null) return null;
  const room = row.room == null ? null : ROOMS.has(String(row.room)) ? (row.room as RoomId) : null;
  if (row.room != null && room == null) return null;
  return { id: row.id, createdAt: row.createdAt, text: row.text.trim(), category, contact, accountId, profileId, room };
}

export class FeedbackStore {
  private items: FeedbackRow[] = [];

  constructor(
    private adapter: FeedbackPersistence | null,
    private now: () => number = Date.now,
  ) {
    if (!adapter) return;
    try {
      const raw = adapter.load();
      const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as FeedbackFile).items) ? (raw as FeedbackFile).items : [];
      for (const row of rows) {
        const clean = normalizeFeedbackRow(row);
        if (clean && !this.items.some((r) => r.id === clean.id)) this.items.push(clean);
      }
      this.items.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
      if (this.items.length > FEEDBACK_FILE_MAX) this.items = this.items.slice(-FEEDBACK_FILE_MAX);
    } catch (e) {
      console.error('[feedback] could not read feedback, starting fresh', e);
    }
  }

  add(input: Omit<FeedbackRow, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): FeedbackRow {
    const row: FeedbackRow = {
      text: input.text,
      category: input.category,
      contact: input.contact,
      accountId: input.accountId,
      profileId: input.profileId,
      room: input.room,
      id: input.id && /^[a-f0-9]{8,32}$/.test(input.id) ? input.id : randomHex(8),
      createdAt: input.createdAt ?? this.now(),
    };
    this.items.push(row);
    this.items.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
    if (this.items.length > FEEDBACK_FILE_MAX) this.items.splice(0, this.items.length - FEEDBACK_FILE_MAX);
    this.save();
    return row;
  }

  /** Newest first. `since` is an inclusive createdAt floor (ms). */
  list(opts: { limit: number; since?: number } = { limit: 50 }): FeedbackRow[] {
    const since = opts.since ?? 0;
    const matched = this.items.filter((row) => row.createdAt >= since);
    return matched.slice().sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1)).slice(0, opts.limit);
  }

  count(since = 0) {
    return this.items.filter((row) => row.createdAt >= since).length;
  }

  stored() {
    return this.items.length;
  }

  save() {
    this.adapter?.save({ version: 1, items: this.items });
  }
}
