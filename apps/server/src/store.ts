import { applyPets, completeHallSteps, isBubbleStyle, isPetId,isSubscriptionStatus, normalizeFounderFlag, normalizePetNames, ownedParrotColorIds, parrotColorById, type PlayerSubscription } from '@tudobem/shared';
import {
  freshMission,
  profileDay,
  normalizeCartela,
  normalizeBag,
  normalizeBjj,
  normalizeBond,
  normalizeBondGifts,
  normalizeCaderno,
  normalizeCadernoPaid,
  normalizeArrival,
  normalizeDiary,
  normalizePesca,
  normalizeEscola,
  earnedTier,
  normalizeFilm,
  normalizePhotos,
  normalizePapos,
  normalizeRecados,
  type PrivateProfile,
} from '@tudobem/shared';

export interface StoredProfile extends PrivateProfile {
  token: string;
  /** Created under the Phase 0 adult (18+) policy; older 13+ profiles lack it and sign up again. No birth date is ever collected. */
  ageGate18: true;
  /** Email/password account that owns this profile. Absent for solo guests and not-yet-claimed legacy profiles. */
  accountId?: string;
  daily: {
    date: string;
    sceneClears: Record<string, number>;
    /** Pedido rápido RV already paid: npcId -> player day (playerDay.ts). Once per day. */
    pedidoRvGranted?: Record<string, string>;
  };
  lastSeen: number;
  /** Lemon Squeezy webhook ids already applied. Not sent to the client. */
  billingEventIds?: string[];
  /** Admin chat mute: chat is refused until this time (ms). Not sent to the client. */
  mutedUntil?: number;
  /** Admin ban: the account cannot enter the world until an admin lifts it. Not sent to the client. */
  banned?: { at: number };
  /** Pending friend requests to this player (requester ids, oldest first, capped). Not sent to the client. */
  friendRequestsIn?: string[];
}

/** The real UTC day. Not a cap's day: caps key on the player's own day (`profileDay`, playerDay.ts). */
export const today = () => new Date().toISOString().slice(0, 10);

/** Where profiles persist. Node: SQLite. Browser solo mode: localStorage. Tests: none. */
export interface PersistenceAdapter {
  load(): StoredProfile[];
  /** The whole set. Used when the adapter has no `upsert` (localStorage writes one document). */
  save(rows: StoredProfile[]): void;
  /** Write only these rows; every other stored row is left alone. */
  upsert?(rows: StoredProfile[]): void;
  /** Delete these ids. The only way a stored profile goes away. */
  remove?(ids: string[]): void;
  describe(): string;
}

/** What the last write did, for health checks. Times are epoch ms; null means it has not happened. */
export interface StoreFlushHealth {
  lastFlushOk: number | null;
  lastFlushError: string | null;
  lastFlushErrorAt: number | null;
  /** Writes in a row that failed (0 after a good one). */
  failures: number;
  /** Profiles waiting to be written. */
  pending: number;
}

/** Debounce for `save`. */
export const STORE_SAVE_DEBOUNCE_MS = 800;
/** Retry after a failed timer flush: doubles from this, capped at STORE_RETRY_MAX_MS. */
export const STORE_RETRY_BASE_MS = 1_000;
export const STORE_RETRY_MAX_MS = 30_000;

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes: number) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Profile store (isomorphic). Swap the adapter for Postgres in Phase 1 (same method surface).
 *
 * Writes are per profile: `save(id)` marks that profile dirty and a debounced flush upserts only the dirty
 * ones. `save()` with no id still works (older call sites): the next flush offers every profile and the
 * adapter skips rows whose JSON did not change. Nothing is ever deleted except through `remove(id)`.
 */
export class ProfileStore {
  private byId = new Map<string, StoredProfile>();
  private byToken = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private dirty = new Set<string>();
  private removed = new Set<string>();
  /** A `save()` without ids: offer every profile on the next flush. */
  private sweep = false;
  private flushHealth: StoreFlushHealth = { lastFlushOk: null, lastFlushError: null, lastFlushErrorAt: null, failures: 0, pending: 0 };

  constructor(private adapter: PersistenceAdapter | null) {
    if (!adapter) return;
    // A failed read is fatal: starting empty would let the next save treat every stored player as gone.
    let rows: StoredProfile[];
    try {
      rows = adapter.load();
    } catch (e) {
      console.error('[store] could not read profiles', e);
      throw e;
    }
    for (const p of rows) this.index(p);
    if (rows.length) console.log(`[store] ${rows.length} perfis carregados (${adapter.describe()})`);
  }

  private index(p: StoredProfile) {
    normalizeProfile(p);
    const before = this.byId.get(p.id);
    if (before && before.token !== p.token) this.byToken.delete(before.token);
    this.byId.set(p.id, p);
    this.byToken.set(p.token, p.id);
    this.removed.delete(p.id);
  }

  newId() {
    return randomHex(6);
  }

  newToken() {
    return randomToken(24);
  }

  byTokenGet(token: string | undefined): StoredProfile | undefined {
    if (!token) return undefined;
    const id = this.byToken.get(token);
    return id ? this.byId.get(id) : undefined;
  }

  get(id: string) {
    return this.byId.get(id);
  }

  add(p: StoredProfile) {
    this.index(p);
    this.save(p.id);
  }

  /**
   * Debounced write. Pass the ids of the profiles that changed; with none, the next flush checks them all.
   * After `shutdown`, further saves are ignored.
   */
  save(...ids: string[]) {
    if (this.closed || !this.adapter) return;
    if (ids.length) for (const id of ids) this.dirty.add(id);
    else this.sweep = true;
    this.arm(STORE_SAVE_DEBOUNCE_MS);
  }

  /** Delete a profile from memory and from the adapter (account deletion). Returns false when there was none. */
  remove(id: string): boolean {
    const p = this.byId.get(id);
    if (!p) return false;
    this.byId.delete(id);
    if (this.byToken.get(p.token) === id) this.byToken.delete(p.token);
    this.dirty.delete(id);
    if (this.closed || !this.adapter) return true;
    this.removed.add(id);
    // write at once, so no later debounced save can bring it back
    try {
      this.flush();
    } catch {
      this.arm(STORE_SAVE_DEBOUNCE_MS);
    }
    return true;
  }

  private arm(ms: number) {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.closed) return;
      try {
        this.flush();
      } catch {
        // flush() logged it and kept the dirty set; try again later, slower each time
        const wait = Math.min(STORE_RETRY_MAX_MS, STORE_RETRY_BASE_MS * 2 ** Math.max(0, this.flushHealth.failures - 1));
        this.arm(wait);
      }
    }, ms);
  }

  /** Write pending changes now. Throws when the adapter does; the pending set is kept for the next try. */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.closed) return;
    this.write();
  }

  private write() {
    const adapter = this.adapter;
    if (!adapter) return;
    const sweep = this.sweep;
    const dirty = this.dirty;
    const removed = this.removed;
    if (!sweep && !dirty.size && !removed.size) return;
    this.sweep = false;
    this.dirty = new Set();
    this.removed = new Set();
    try {
      if (adapter.upsert) {
        if (removed.size) adapter.remove?.([...removed]);
        const rows = sweep ? [...this.byId.values()] : [...dirty].map((id) => this.byId.get(id)).filter((p): p is StoredProfile => !!p);
        adapter.upsert(rows);
      } else {
        adapter.save([...this.byId.values()]);
      }
      this.flushHealth = { ...this.flushHealth, lastFlushOk: Date.now(), failures: 0, pending: 0 };
    } catch (e) {
      // keep what did not get written; anything marked meanwhile is already in the new sets
      if (sweep) this.sweep = true;
      for (const id of dirty) if (this.byId.has(id)) this.dirty.add(id);
      for (const id of removed) if (!this.byId.has(id)) this.removed.add(id);
      const message = e instanceof Error ? e.message : String(e);
      this.flushHealth = { ...this.flushHealth, lastFlushError: message, lastFlushErrorAt: Date.now(), failures: this.flushHealth.failures + 1, pending: this.pendingCount() };
      console.error(`[store] profile write failed (${this.flushHealth.failures} in a row)`, e);
      throw e;
    }
  }

  private pendingCount() {
    return this.sweep ? this.byId.size : this.dirty.size + this.removed.size;
  }

  /** Last write result: `lastFlushOk` / `lastFlushError` (for /healthz). */
  health(): StoreFlushHealth {
    return { ...this.flushHealth, pending: this.pendingCount() };
  }

  /**
   * Final write (process shutdown): every profile is offered, so a change that was never marked still lands.
   * Later saves are ignored. Throws when the write fails.
   */
  shutdown() {
    if (this.closed) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.sweep = true;
    this.closed = true;
    this.write();
  }

  count() {
    return this.byId.size;
  }

  /** Every stored profile (leaderboards, admin, and the Feira crown broadcast). */
  all(): StoredProfile[] {
    return [...this.byId.values()];
  }
}

/** A Testes day offset: whole calendar days, or absent when it is zero. */
function optDayOffset(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const n = Math.trunc(raw);
  if (n === 0) return undefined;
  return Math.max(-3660, Math.min(3660, n));
}

/** A Testes sky offset in milliseconds, or absent when it is zero. */
function optClockOffset(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const n = Math.trunc(raw);
  if (n === 0) return undefined;
  const cap = 3660 * 86_400_000;
  return Math.max(-cap, Math.min(cap, n));
}

function normalizeFeiraPaid(raw: unknown): StoredProfile['feiraPaid'] {
  const r = raw as { day?: unknown; n?: unknown } | undefined;
  if (!r || typeof r.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return undefined;
  const n = typeof r.n === 'number' && Number.isFinite(r.n) ? Math.max(0, Math.min(99, Math.floor(r.n))) : 0;
  return { day: r.day.slice(0, 10), n };
}

/** The feira's daily RV counter: a date string and a small count, or nothing. */
function normalizeFeira(raw: unknown): StoredProfile['feira'] {
  const r = raw as { date?: unknown; n?: unknown } | undefined;
  return r && typeof r.date === 'string' && typeof r.n === 'number' && Number.isFinite(r.n) && r.n >= 0 ? { date: r.date.slice(0, 10), n: Math.min(99, Math.floor(r.n)) } : undefined;
}

/** Default the optional Phase 8 fields so saves from before them load unchanged. Idempotent. */
export function normalizeProfile(p: StoredProfile): StoredProfile {
  p.bag = normalizeBag(p.bag);
  p.bond = normalizeBond(p.bond);
  p.bondGifts = normalizeBondGifts(p.bondGifts);
  p.recados = normalizeRecados(p.recados);
  // the lifetime recado count arrived after the recados: an old save starts from today's list
  const total = typeof p.recadosDoneTotal === 'number' && Number.isFinite(p.recadosDoneTotal) ? Math.floor(p.recadosDoneTotal) : 0;
  p.recadosDoneTotal = Math.max(0, total, p.recados.done.length);
  p.caderno = normalizeCaderno(p.caderno);
  p.cadernoPaid = normalizeCadernoPaid(p.cadernoPaid);
  p.papos = normalizePapos(p.papos);
  // the Conversa feature (and the NPC memory of it) was removed (#229): old saves drop the field
  delete (p as { npcMemory?: unknown }).npcMemory;
  p.feira = normalizeFeira(p.feira);
  // the Praia's fishing (PRAIA-PLAN.md 8.1): missing stays missing ("never fished")
  const pesca = normalizePesca(p.pesca);
  if (pesca) p.pesca = pesca;
  else delete p.pesca;
  const arrival = normalizeArrival(p);
  p.arrivalIntroDone = arrival.arrivalIntroDone;
  p.hasCamera = arrival.hasCamera;
  // the welcome chain lost the hall-taught steps: a save that is past the hall has them done
  if (!p.tutorial || typeof p.tutorial !== 'object') p.tutorial = {} as StoredProfile['tutorial'];
  completeHallSteps(p);
  p.diary = normalizeDiary(p.diary);
  // saves from before the escola lessons: every diary word is learned (new), nothing mastered, the plate Verde
  p.escola = normalizeEscola(p.escola, p.diary);
  p.testUser = p.testUser === true;
  p.testDayOffset = optDayOffset(p.testDayOffset);
  p.testClockOffsetMs = optClockOffset(p.testClockOffsetMs);
  // test profiles counted cart paid runs here before every profile did (`testFeiraPaid`); the key moves once
  const legacyPaid = p as StoredProfile & { testFeiraPaid?: unknown };
  p.feiraPaid = normalizeFeiraPaid(p.feiraPaid ?? legacyPaid.testFeiraPaid);
  delete legacyPaid.testFeiraPaid;
  p.verdeMode = p.verdeMode === true;
  p.nameplate = p.verdeMode ? 'verde' : earnedTier(p.escola, p.diary);
  p.film = normalizeFilm(p.film);
  p.photos = normalizePhotos(p.photos);
  p.cartela = normalizeCartela(p.cartela);
  const parrotColors = ownedParrotColorIds(p);
  p.parrotColors = parrotColors;
  if (p.parrotOwned || parrotColors.length > 0) {
    p.parrotOwned = true;
    const wearing = parrotColorById(p.parrotColor)?.id;
    p.parrotColor = wearing && parrotColors.includes(wearing) ? wearing : parrotColors[0] ?? 'verde';
  } else {
    p.parrotColor = null;
  }
  if (p.giOwned == null) p.giOwned = !!p.bjj;
  if (p.founder === undefined) p.founder = normalizeFounderFlag(undefined);
  p.founderBadge = p.founderBadge === true;
  p.founderBanner = p.founderBanner === true;
  p.subscription = normalizeSubscription(p.subscription);
  p.pet = isPetId(p.pet) ? p.pet : null;
  p.petNames = normalizePetNames(p.petNames);
  // the pet shop (#234): a save from before it becomes `pets` (its dog and cat, with their names); `pet` / `petNames` stay as mirrors
  applyPets(p);
  p.bubbleStyle = isBubbleStyle(p.bubbleStyle) ? p.bubbleStyle : 'classic';
  if (!Array.isArray(p.billingEventIds)) p.billingEventIds = [];
  else p.billingEventIds = p.billingEventIds.filter((id) => typeof id === 'string').slice(-200);
  if (Array.isArray(p.friendRequestsIn)) p.friendRequestsIn = [...new Set(p.friendRequestsIn.filter((id) => typeof id === 'string' && id !== p.id))].slice(-50);
  else delete p.friendRequestsIn;
  return p;
}

function normalizeSubscription(raw: unknown): PlayerSubscription | undefined {
  const r = raw as { status?: unknown; currentPeriodEnd?: unknown; portalUrl?: unknown; providerSubscriptionId?: unknown; provider?: unknown } | null | undefined;
  if (!r || !isSubscriptionStatus(r.status)) return undefined;
  const end = typeof r.currentPeriodEnd === 'number' && Number.isFinite(r.currentPeriodEnd) ? r.currentPeriodEnd : null;
  const portal = typeof r.portalUrl === 'string' ? r.portalUrl : null;
  const subId = typeof r.providerSubscriptionId === 'string' ? r.providerSubscriptionId : null;
  const provider = r.provider === 'dev' || r.provider === 'lemonsqueezy' || r.provider === 'comp' ? r.provider : undefined;
  return { status: r.status, currentPeriodEnd: end, portalUrl: portal, providerSubscriptionId: subId, provider };
}

export function toPrivate(p: StoredProfile, day = profileDay(p, Date.now())): PrivateProfile {
  // photos travel in their own `photos` message (World.pushPhotos), only when they change
  const { token: _t, ageGate18: _a, accountId: _acc, daily: _d, lastSeen: _l, photos: _ph, billingEventIds: _ev, mutedUntil: _m, banned: _b, friendRequestsIn: _fr, ...rest } = p;
  const mission = p.mission?.date === day ? p.mission : freshMission(day);
  return structuredClone({ ...rest, mission, bjj: normalizeBjj(p.bjj) });
}
