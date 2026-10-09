import { isBubbleStyle, isPetId, isSubscriptionStatus, normalizeFounderFlag, normalizePetNames, ownedParrotColorIds, parrotColorById, type PlayerSubscription } from '@tudobem/shared';
import {
  freshMission,
  normalizeCartela,
  normalizeBag,
  normalizeBjj,
  normalizeBond,
  normalizeBondGifts,
  normalizeCaderno,
  normalizeCadernoPaid,
  normalizeArrival,
  normalizeDiary,
  normalizeEscola,
  earnedTier,
  normalizeFilm,
  normalizePhotos,
  normalizeNpcMemory,
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
    /** Conversa daily cap: npcId -> America/Sao_Paulo date (YYYY-MM-DD). */
    conversaClears?: Record<string, string>;
    /** Conversa RV already paid: npcId -> America/Sao_Paulo date. */
    conversaRvGranted?: Record<string, string>;
    /** Pedido rápido RV already paid: npcId -> America/Sao_Paulo date. Once per calendar day. */
    pedidoRvGranted?: Record<string, string>;
  };
  lastSeen: number;
  /** Lemon Squeezy webhook ids already applied. Not sent to the client. */
  billingEventIds?: string[];
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Get today's date in America/São_Paulo timezone (YYYY-MM-DD). */
export function todaySaoPaulo(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

/** Where profiles persist. Node: SQLite. Browser solo mode: localStorage. Tests: none. */
export interface PersistenceAdapter {
  load(): StoredProfile[];
  save(rows: StoredProfile[]): void;
  describe(): string;
}

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

/** Profile store (isomorphic). Swap the adapter for Postgres in Phase 1 (same method surface). */
export class ProfileStore {
  private byId = new Map<string, StoredProfile>();
  private byToken = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(private adapter: PersistenceAdapter | null) {
    if (!adapter) return;
    try {
      const rows = adapter.load();
      for (const p of rows) this.index(p);
      if (rows.length) console.log(`[store] ${rows.length} perfis carregados (${adapter.describe()})`);
    } catch (e) {
      console.error('[store] could not read profiles, starting fresh', e);
    }
  }

  private index(p: StoredProfile) {
    normalizeProfile(p);
    this.byId.set(p.id, p);
    this.byToken.set(p.token, p.id);
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
    this.save();
  }

  /** Debounced write. After `shutdown`, further saves are ignored. */
  save() {
    if (this.closed || !this.adapter || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.closed) this.flush();
    }, 800);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.closed) return;
    this.adapter?.save([...this.byId.values()]);
  }

  /** Flush once and ignore later debounced saves (process shutdown). */
  shutdown() {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.adapter?.save([...this.byId.values()]);
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

function normalizeTestFeiraPaid(raw: unknown): StoredProfile['testFeiraPaid'] {
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
  p.caderno = normalizeCaderno(p.caderno);
  p.cadernoPaid = normalizeCadernoPaid(p.cadernoPaid);
  p.npcMemory = normalizeNpcMemory(p.npcMemory);
  p.feira = normalizeFeira(p.feira);
  const arrival = normalizeArrival(p);
  p.arrivalIntroDone = arrival.arrivalIntroDone;
  p.hasCamera = arrival.hasCamera;
  p.diary = normalizeDiary(p.diary);
  // saves from before the escola lessons: every diary word is learned (new), nothing mastered, the plate Verde
  p.escola = normalizeEscola(p.escola, p.diary);
  p.testUser = p.testUser === true;
  p.testDayOffset = optDayOffset(p.testDayOffset);
  p.testClockOffsetMs = optClockOffset(p.testClockOffsetMs);
  p.testFeiraPaid = normalizeTestFeiraPaid(p.testFeiraPaid);
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
  p.bubbleStyle = isBubbleStyle(p.bubbleStyle) ? p.bubbleStyle : 'classic';
  if (!Array.isArray(p.billingEventIds)) p.billingEventIds = [];
  else p.billingEventIds = p.billingEventIds.filter((id) => typeof id === 'string').slice(-200);
  return p;
}

function normalizeSubscription(raw: unknown): PlayerSubscription | undefined {
  const r = raw as { status?: unknown; currentPeriodEnd?: unknown; portalUrl?: unknown; providerSubscriptionId?: unknown; provider?: unknown } | null | undefined;
  if (!r || !isSubscriptionStatus(r.status)) return undefined;
  const end = typeof r.currentPeriodEnd === 'number' && Number.isFinite(r.currentPeriodEnd) ? r.currentPeriodEnd : null;
  const portal = typeof r.portalUrl === 'string' ? r.portalUrl : null;
  const subId = typeof r.providerSubscriptionId === 'string' ? r.providerSubscriptionId : null;
  const provider = r.provider === 'dev' || r.provider === 'lemonsqueezy' ? r.provider : undefined;
  return { status: r.status, currentPeriodEnd: end, portalUrl: portal, providerSubscriptionId: subId, provider };
}

export function toPrivate(p: StoredProfile, day = today()): PrivateProfile {
  // photos travel in their own `photos` message (World.pushPhotos), only when they change
  const { token: _t, ageGate18: _a, accountId: _acc, daily: _d, lastSeen: _l, photos: _ph, billingEventIds: _ev, ...rest } = p;
  const mission = p.mission?.date === day ? p.mission : freshMission(day);
  return structuredClone({ ...rest, mission, bjj: normalizeBjj(p.bjj) });
}
