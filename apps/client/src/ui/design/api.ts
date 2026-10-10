/**
 * Design mode's calls to `/api/admin/design/*` (apps/server/src/designOps.ts). The admin cookie is httpOnly and scoped to `/api/admin`, so
 * the browser sends it on these same-origin requests; the editor never sees it.
 */
import type { PropDef, RoomId } from '@tudobem/shared';

export interface DesignState {
  room: RoomId;
  name: string;
  cols: number;
  rows: number;
  rev: number;
  source: 'override' | 'code';
  live: PropDef[];
  code: PropDef[];
  draft: { objects: PropDef[]; at: number; by: string; baseRev: number } | null;
  history: { at: number; by: string; objects: number | null }[];
  github: boolean;
  rooms: { id: RoomId; name: string; override: boolean; draft: boolean }[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = {};
  }
  if (!res.ok || json.ok === false) throw new ApiError(res.status, String(json.error ?? json.code ?? `HTTP ${res.status}`));
  return json as T;
}

export const designApi = {
  /** Who is signed in, or an ApiError 401. */
  session: () => call<{ name: string }>('/session'),
  login: (password: string, name: string) => call<{ name: string }>('/login', { password, name }),
  state: (room: RoomId) => call<DesignState>(`/design/state?room=${encodeURIComponent(room)}`),
  saveDraft: (room: RoomId, objects: PropDef[], baseRev: number) => call<{ at: number }>('/design/draft', { room, objects, baseRev }),
  discardDraft: (room: RoomId) => call('/design/draft/discard', { room }),
  publish: (room: RoomId, objects: PropDef[], baseRev: number, force = false) =>
    call<{ rev: number; auditId: number; diff: { added: string[]; removed: string[]; changed: unknown[] } }>('/design/publish', { room, objects, baseRev, force }),
  revert: (room: RoomId) => call<{ rev: number }>('/design/revert', { room }),
  reset: (room: RoomId) => call<{ rev: number }>('/design/reset', { room }),
  pullRequest: (room: RoomId, objects: PropDef[]) => call<{ url?: string; fallback?: boolean; file?: string; name?: string }>('/design/pr', { room, objects }),
};
