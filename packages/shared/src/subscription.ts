/**
 * Optional $10/month support subscription (founders' offer during the beta).
 * Learning, nameplates, belts, stripes, Feira scores and RV are never touched here.
 * needs_br: true on the player-facing copy.
 */
import type { PlacedFurniture } from './types.js';

/** USD per month. Not RV, not R$. */
export const SUBSCRIPTION_PRICE_USD = 10;

/** needs_br: true */
export const SUBSCRIPTION_PRICE: { pt: string; en: string } = {
  pt: 'US$ 10 por mês',
  en: '$10 per month',
};

/** Where Lemon Squeezy sends the player after checkout. */
export const SUBSCRIPTION_REDIRECT_URL = 'https://playtudobem.com';

/** Kitnet wall banner granted once, on the first successful payment. Never sold for RV. */
export const FOUNDER_BANNER_ID = 'banner_fundadores';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';

export interface PlayerSubscription {
  status: SubscriptionStatus;
  /** Unix ms. Perks last until this moment when status is active, or cancelled and still inside the period. */
  currentPeriodEnd: number | null;
  portalUrl?: string | null;
  providerSubscriptionId?: string | null;
  /** `comp`: an admin granted the supporter perks by hand from the dashboard. No payment, never Lemon Squeezy. */
  provider?: SubscriptionProvider;
}

export type SubscriptionProvider = 'lemonsqueezy' | 'dev' | 'comp';

export type PetId = 'dog' | 'cat';

export const BUBBLE_STYLES = ['classic', 'sol', 'mar', 'mata', 'festa'] as const;
export type BubbleStyle = (typeof BUBBLE_STYLES)[number];

/** needs_br: true */
export const BUBBLE_STYLE_COPY: Record<BubbleStyle, { pt: string; en: string }> = {
  classic: { pt: 'Clássico', en: 'Classic' },
  sol: { pt: 'Sol', en: 'Sun' },
  mar: { pt: 'Mar', en: 'Sea' },
  mata: { pt: 'Mata', en: 'Forest' },
  festa: { pt: 'Festa', en: 'Party' },
};

/** needs_br: true */
export const PET_COPY: Record<PetId, { pt: string; en: string }> = {
  dog: { pt: 'Cachorro', en: 'Dog' },
  cat: { pt: 'Gato', en: 'Cat' },
};

/**
 * Flags marked `preview` are visible to an active subscriber.
 * Nothing in the world reads this yet — the Praia is the wired example only.
 */
export const PREVIEW_FLAGS = {
  praia: { preview: true, pt: 'Praia', en: 'Beach' },
} as const;

export type PreviewFlagId = keyof typeof PREVIEW_FLAGS;

export type BillingKind = 'created' | 'renewed' | 'updated' | 'cancelled' | 'expired' | 'resumed' | 'payment_success';

export interface BillingTransition {
  eventId: string;
  kind: BillingKind;
  /** Provider status string, used by `updated`. */
  providerStatus?: string | null;
  currentPeriodEnd?: number | null;
  portalUrl?: string | null;
  subscriptionId?: string | null;
  provider?: SubscriptionProvider;
  now: number;
}

/** The slice of a profile the entitlement rules may read or write. Learning fields are absent on purpose. */
export interface EntitlementSlice {
  subscription?: PlayerSubscription | null;
  founderBadge?: boolean;
  founderBanner?: boolean;
  pet?: PetId | null;
  bubbleStyle?: BubbleStyle | null;
  furniture?: Record<string, number>;
  apartment?: PlacedFurniture[];
  billingEventIds?: string[];
}

const EVENT_CAP = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Dev/test grants last 30 days so the perks can be walked through before a provider is configured. */
export const DEV_GRANT_MS = 30 * DAY_MS;

export function isBubbleStyle(v: unknown): v is BubbleStyle {
  return typeof v === 'string' && (BUBBLE_STYLES as readonly string[]).includes(v);
}

export function isPetId(v: unknown): v is PetId {
  return v === 'dog' || v === 'cat';
}

export function isSubscriptionStatus(v: unknown): v is SubscriptionStatus {
  return v === 'active' || v === 'cancelled' || v === 'expired';
}

/** Active subscribers, and cancelled ones who still have time left in the period they paid for. */
export function hasPerkAccess(sub: PlayerSubscription | null | undefined, now: number): boolean {
  if (!sub || !isSubscriptionStatus(sub.status)) return false;
  if (sub.status === 'expired') return false;
  const end = sub.currentPeriodEnd;
  if (end == null) return sub.status === 'active';
  if (end <= now) return false;
  return sub.status === 'active' || sub.status === 'cancelled';
}

export function isPreviewUnlocked(user: { subscription?: PlayerSubscription | null }, flag: string, now = Date.now()): boolean {
  const def = (PREVIEW_FLAGS as Record<string, { preview: boolean } | undefined>)[flag];
  if (!def?.preview) return false;
  return hasPerkAccess(user.subscription, now);
}

/**
 * Chat appearance only. The text string is returned unchanged — never trimmed, translated, or restyled into different words.
 * A speaker without perk access always wears the classic bubble, whatever they had picked.
 */
export function bubbleAppearance(text: string, style: BubbleStyle | null | undefined, active: boolean): { text: string; style: BubbleStyle } {
  const picked = active && isBubbleStyle(style) ? style : 'classic';
  return { text, style: picked };
}

export function visiblePet(pet: PetId | null | undefined, active: boolean): PetId | null {
  return active && isPetId(pet) ? pet : null;
}

/** Map a Lemon Squeezy subscription status onto ours. Unknown values do not invent access. */
export function mapProviderStatus(status: string | null | undefined): SubscriptionStatus | null {
  if (status === 'active' || status === 'on_trial') return 'active';
  if (status === 'cancelled' || status === 'paused' || status === 'past_due' || status === 'unpaid') return 'cancelled';
  if (status === 'expired') return 'expired';
  return null;
}

function ensureSub(p: EntitlementSlice, provider: SubscriptionProvider | undefined): PlayerSubscription {
  if (!p.subscription || !isSubscriptionStatus(p.subscription.status)) {
    p.subscription = { status: 'active', currentPeriodEnd: null, provider: provider ?? 'lemonsqueezy' };
  }
  return p.subscription;
}

function rememberEvent(p: EntitlementSlice, eventId: string): boolean {
  const ids = p.billingEventIds ?? [];
  if (ids.includes(eventId)) return false;
  ids.push(eventId);
  p.billingEventIds = ids.length > EVENT_CAP ? ids.slice(ids.length - EVENT_CAP) : ids;
  return true;
}

function touchPeriod(sub: PlayerSubscription, event: BillingTransition) {
  if (event.currentPeriodEnd !== undefined) sub.currentPeriodEnd = event.currentPeriodEnd;
  if (event.portalUrl) sub.portalUrl = event.portalUrl;
  if (event.subscriptionId) sub.providerSubscriptionId = event.subscriptionId;
  if (event.provider) sub.provider = event.provider;
}

/** Permanent founder marks, plus one banner in the kitnet inventory if they do not already have it. */
function grantFounderKeepsakes(p: EntitlementSlice) {
  p.founderBadge = true;
  p.founderBanner = true;
  const placed = (p.apartment ?? []).some((a) => a.itemId === FOUNDER_BANNER_ID);
  if (!p.furniture) p.furniture = {};
  if (!placed && (p.furniture[FOUNDER_BANNER_ID] ?? 0) < 1) p.furniture[FOUNDER_BANNER_ID] = 1;
}

function revertPerks(p: EntitlementSlice) {
  p.pet = null;
  p.bubbleStyle = 'classic';
}

/**
 * Apply one provider event. Returns false when `eventId` was already applied.
 * Founder badge and banner are set on the first `payment_success` and are never cleared.
 * Pets, bubble style and preview access end when the subscription expires.
 */
export function applyBillingTransition(p: EntitlementSlice, event: BillingTransition): boolean {
  if (!event.eventId) return false;
  if (!rememberEvent(p, event.eventId)) return false;
  const provider = event.provider;
  if (event.kind === 'created' || event.kind === 'renewed' || event.kind === 'resumed') {
    const sub = ensureSub(p, provider);
    sub.status = 'active';
    touchPeriod(sub, event);
    return true;
  }
  if (event.kind === 'payment_success') {
    const sub = ensureSub(p, provider);
    sub.status = 'active';
    touchPeriod(sub, event);
    grantFounderKeepsakes(p);
    return true;
  }
  if (event.kind === 'cancelled') {
    const sub = ensureSub(p, provider);
    sub.status = 'cancelled';
    touchPeriod(sub, event);
    if (!hasPerkAccess(sub, event.now)) revertPerks(p);
    return true;
  }
  if (event.kind === 'expired') {
    const sub = ensureSub(p, provider);
    sub.status = 'expired';
    touchPeriod(sub, event);
    revertPerks(p);
    return true;
  }
  if (event.kind === 'updated') {
    const mapped = mapProviderStatus(event.providerStatus);
    const sub = ensureSub(p, provider);
    if (mapped) sub.status = mapped;
    touchPeriod(sub, event);
    if (!hasPerkAccess(sub, event.now)) revertPerks(p);
    return true;
  }
  return true;
}

/** Admin-only test subscription: stands in for a first successful payment so the perks can be seen with no provider. */
export function grantTestSubscription(p: EntitlementSlice, now: number): void {
  applyBillingTransition(p, {
    eventId: `dev-grant-${now}-${p.billingEventIds?.length ?? 0}`,
    kind: 'payment_success',
    currentPeriodEnd: now + DEV_GRANT_MS,
    provider: 'dev',
    now,
  });
}

/** Ends the test subscription immediately. The badge and the banner stay. */
export function revokeTestSubscription(p: EntitlementSlice, now: number): void {
  applyBillingTransition(p, {
    eventId: `dev-revoke-${now}-${p.billingEventIds?.length ?? 0}`,
    kind: 'expired',
    currentPeriodEnd: now,
    provider: 'dev',
    now,
  });
}

/** Longest comp an admin can grant in one go (days). */
export const COMP_MAX_DAYS = 366;

/**
 * Admin comp (dashboard): supporter perks with no payment. The same perks as a paid month (pets, bubbles), but not the founder
 * badge or banner, which only a real first payment grants. A live Lemon Squeezy subscription is never touched.
 */
export function grantCompSubscription(p: EntitlementSlice, now: number, days: number): boolean {
  if (p.subscription?.provider === 'lemonsqueezy' && hasPerkAccess(p.subscription, now)) return false;
  const d = Math.max(1, Math.min(COMP_MAX_DAYS, Math.floor(days)));
  return applyBillingTransition(p, {
    eventId: `comp-grant-${now}-${p.billingEventIds?.length ?? 0}`,
    kind: 'created',
    currentPeriodEnd: now + d * DAY_MS,
    provider: 'comp',
    now,
  });
}

/** Ends a comp at once. A Lemon Squeezy subscription is left alone. */
export function revokeCompSubscription(p: EntitlementSlice, now: number): boolean {
  if (p.subscription?.provider !== 'comp') return false;
  return applyBillingTransition(p, {
    eventId: `comp-revoke-${now}-${p.billingEventIds?.length ?? 0}`,
    kind: 'expired',
    currentPeriodEnd: now,
    provider: 'comp',
    now,
  });
}

export interface LearningRankRow {
  id: string;
  wordsLearned: number;
  streak: number;
  feiraScore: number;
  stripes: number;
  belt: string;
  nameplate: string;
}

/**
 * Words learned, streak, Feira score, stripes and belt. Subscription fields are not arguments and cannot change the order.
 */
export function learningLeaderboard(rows: readonly LearningRankRow[], by: 'wordsLearned' | 'streak' | 'feiraScore'): LearningRankRow[] {
  return [...rows].sort((a, b) => b[by] - a[by] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function learningRankOf(p: {
  id: string;
  nameplate?: string;
  diary?: readonly string[];
  escola?: { streak?: number };
  feira?: { n?: number };
  bjj?: { belt?: string; stripes?: number };
}): LearningRankRow {
  return {
    id: p.id,
    wordsLearned: p.diary?.length ?? 0,
    streak: p.escola?.streak ?? 0,
    feiraScore: p.feira?.n ?? 0,
    stripes: p.bjj?.stripes ?? 0,
    belt: p.bjj?.belt ?? 'branca',
    nameplate: p.nameplate ?? 'verde',
  };
}
