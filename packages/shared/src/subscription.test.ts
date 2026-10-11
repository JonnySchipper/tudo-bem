import { describe, expect, it } from 'vitest';
import { progressForWins } from './academia.js';
import { NAMEPLATE_TIERS } from './escola.js';
import {
  BUBBLE_STYLES,
  FOUNDER_BANNER_ID,
  PREVIEW_FLAGS,
  applyBillingTransition,
  bubbleAppearance,
  grantTestSubscription,
  hasPerkAccess,
  isPreviewUnlocked,
  learningLeaderboard,
  learningRankOf,
  revokeTestSubscription,
  type EntitlementSlice,
} from './subscription.js';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const MONTH = 30 * 24 * 60 * 60 * 1000;

function profile(over: Partial<EntitlementSlice> = {}): EntitlementSlice & {
  id: string;
  coins: number;
  nameplate: 'verde';
  diary: string[];
  escola: { streak: number };
  feira: { n: number };
  bjj: { belt: 'branca'; stripes: number };
} {
  return {
    id: 'ana',
    coins: 40,
    nameplate: 'verde',
    diary: ['pao', 'cafe'],
    escola: { streak: 6 },
    feira: { n: 3 },
    bjj: { belt: 'branca', stripes: 1 },
    furniture: { cadeira_madeira: 1 },
    apartment: [],
    founderBadge: false,
    founderBanner: false,
    pet: null,
    bubbleStyle: 'classic',
    subscription: null,
    billingEventIds: [],
    ...over,
  };
}

describe('subscription entitlements', () => {
  it('activates on created without granting the permanent founder marks', () => {
    const p = profile();
    expect(
      applyBillingTransition(p, {
        eventId: 'evt-created',
        kind: 'created',
        currentPeriodEnd: NOW + MONTH,
        subscriptionId: 'sub_1',
        portalUrl: 'https://portal.example/ana',
        provider: 'lemonsqueezy',
        now: NOW,
      }),
    ).toBe(true);
    expect(p.subscription).toMatchObject({ status: 'active', providerSubscriptionId: 'sub_1', portalUrl: 'https://portal.example/ana' });
    expect(p.founderBadge).toBe(false);
    expect(p.founderBanner).toBe(false);
    expect(p.furniture?.[FOUNDER_BANNER_ID]).toBeUndefined();
    expect(hasPerkAccess(p.subscription, NOW)).toBe(true);
  });

  it('grants the badge and banner once on the first successful payment, and ignores a replay', () => {
    const p = profile({ pet: 'dog', bubbleStyle: 'festa' });
    const pay = {
      eventId: 'evt-pay-1',
      kind: 'payment_success' as const,
      currentPeriodEnd: NOW + MONTH,
      provider: 'lemonsqueezy' as const,
      now: NOW,
    };
    applyBillingTransition(p, pay);
    expect(p.founderBadge).toBe(true);
    expect(p.founderBanner).toBe(true);
    expect(p.furniture?.[FOUNDER_BANNER_ID]).toBe(1);
    applyBillingTransition(p, pay);
    expect(p.furniture?.[FOUNDER_BANNER_ID]).toBe(1);
    applyBillingTransition(p, { ...pay, eventId: 'evt-pay-2' });
    expect(p.furniture?.[FOUNDER_BANNER_ID]).toBe(1);
    expect(p.founderBadge).toBe(true);
  });

  it('keeps the badge and banner after cancel, and the perks until the period ends', () => {
    const p = profile({ pet: 'cat', bubbleStyle: 'mar' });
    applyBillingTransition(p, { eventId: 'pay', kind: 'payment_success', currentPeriodEnd: NOW + MONTH, now: NOW });
    applyBillingTransition(p, { eventId: 'cancel', kind: 'cancelled', currentPeriodEnd: NOW + MONTH, now: NOW });
    expect(p.subscription?.status).toBe('cancelled');
    expect(p.founderBadge).toBe(true);
    expect(p.founderBanner).toBe(true);
    expect(p.furniture?.[FOUNDER_BANNER_ID]).toBe(1);
    expect(hasPerkAccess(p.subscription, NOW)).toBe(true);
    expect(p.pet).toBe('cat');
    expect(p.bubbleStyle).toBe('mar');
    expect(isPreviewUnlocked(p, 'praia', NOW)).toBe(true);
  });

  it('reverts pets, bubbles and previews on expire, and never revokes the founder marks', () => {
    const p = profile({ pet: 'dog', bubbleStyle: 'festa' });
    applyBillingTransition(p, { eventId: 'pay', kind: 'payment_success', currentPeriodEnd: NOW + MONTH, now: NOW });
    applyBillingTransition(p, { eventId: 'exp', kind: 'expired', currentPeriodEnd: NOW, now: NOW + MONTH });
    expect(p.subscription?.status).toBe('expired');
    expect(p.founderBadge).toBe(true);
    expect(p.founderBanner).toBe(true);
    expect(p.pet).toBeNull();
    expect(p.bubbleStyle).toBe('classic');
    expect(hasPerkAccess(p.subscription, NOW + MONTH)).toBe(false);
    expect(isPreviewUnlocked(p, 'praia', NOW + MONTH)).toBe(false);
    expect(bubbleAppearance('Oi, tudo bem?', 'festa', false)).toEqual({ text: 'Oi, tudo bem?', style: 'classic' });
  });

  it('resumes access without a second banner', () => {
    const p = profile();
    applyBillingTransition(p, { eventId: 'pay', kind: 'payment_success', currentPeriodEnd: NOW + MONTH, now: NOW });
    applyBillingTransition(p, { eventId: 'exp', kind: 'expired', now: NOW + MONTH });
    applyBillingTransition(p, { eventId: 'back', kind: 'resumed', currentPeriodEnd: NOW + MONTH * 2, now: NOW + MONTH });
    expect(p.subscription?.status).toBe('active');
    expect(p.furniture?.[FOUNDER_BANNER_ID]).toBe(1);
    expect(isPreviewUnlocked(p, 'praia', NOW + MONTH)).toBe(true);
  });

  it('syncs an updated provider status', () => {
    const p = profile();
    applyBillingTransition(p, { eventId: 'c', kind: 'created', currentPeriodEnd: NOW + MONTH, now: NOW });
    applyBillingTransition(p, { eventId: 'u', kind: 'updated', providerStatus: 'cancelled', currentPeriodEnd: NOW - 1, now: NOW });
    expect(p.subscription?.status).toBe('cancelled');
    expect(hasPerkAccess(p.subscription, NOW)).toBe(false);
    expect(p.bubbleStyle).toBe('classic');
  });
});

describe('subscription perks do not touch learning, money, plates, stripes or belts', () => {
  it('leaves coins, streak, words, nameplate, stripes and belt alone', () => {
    const p = profile({ pet: 'dog', bubbleStyle: 'sol' });
    const before = learningRankOf(p);
    const coins = p.coins;
    applyBillingTransition(p, { eventId: 'pay', kind: 'payment_success', currentPeriodEnd: NOW + MONTH, now: NOW });
    applyBillingTransition(p, { eventId: 'exp', kind: 'expired', now: NOW + MONTH });
    expect(learningRankOf(p)).toEqual(before);
    expect(p.coins).toBe(coins);
    expect(p.nameplate).toBe('verde');
    expect(p.bjj).toEqual({ belt: 'branca', stripes: 1 });
    expect(progressForWins(5)).toEqual({ belt: 'branca', stripes: 1 });
    expect(NAMEPLATE_TIERS.map((t) => t.tier)).toEqual(['verde', 'amarelo', 'azul', 'roxo', 'dourado']);
  });

  it('ranks two learners the same when only the subscription differs', () => {
    const ana = learningRankOf(profile());
    const beto = learningRankOf(profile({ id: 'beto' }));
    const withSub = learningLeaderboard([beto, ana], 'wordsLearned');
    const anaPaid = profile();
    applyBillingTransition(anaPaid, { eventId: 'pay', kind: 'payment_success', now: NOW });
    expect(learningRankOf(anaPaid)).toEqual(ana);
    expect(learningLeaderboard([learningRankOf(anaPaid), beto], 'streak').map((r) => r.id)).toEqual(withSub.map((r) => r.id));
    expect(Object.keys(ana)).not.toContain('feiraScore');
  });

  it('does not gate lessons, the caderno, the feira or streaks — only the preview flag', () => {
    const p = profile();
    applyBillingTransition(p, { eventId: 'pay', kind: 'payment_success', currentPeriodEnd: NOW + MONTH, now: NOW });
    expect(Object.keys(PREVIEW_FLAGS)).toEqual(['praia']);
    expect(PREVIEW_FLAGS.praia.preview).toBe(true);
    for (const flag of ['escola', 'caderno', 'feira', 'recados', 'streak', 'belts']) {
      expect(isPreviewUnlocked(p, flag, NOW)).toBe(false);
    }
    expect(isPreviewUnlocked(profile(), 'praia', NOW)).toBe(false);
  });

  it('never rewrites chat text, for every bubble style', () => {
    const line = '  Olá, tudo bem?  ';
    for (const style of BUBBLE_STYLES) {
      const shown = bubbleAppearance(line, style, true);
      expect(shown.text).toBe(line);
      expect(shown.style).toBe(style);
    }
    expect(bubbleAppearance(line, 'festa', false).style).toBe('classic');
  });
});

describe('dev test subscription', () => {
  it('grants a subscriber and the keepsakes, and revoke ends perks only', () => {
    const p = profile({ pet: 'dog', bubbleStyle: 'mata' });
    grantTestSubscription(p, NOW);
    expect(p.subscription?.status).toBe('active');
    expect(p.subscription?.provider).toBe('dev');
    expect(p.founderBadge).toBe(true);
    expect(p.founderBanner).toBe(true);
    expect(hasPerkAccess(p.subscription, NOW)).toBe(true);
    revokeTestSubscription(p, NOW + 1000);
    expect(p.subscription?.status).toBe('expired');
    expect(p.founderBadge).toBe(true);
    expect(p.founderBanner).toBe(true);
    expect(p.pet).toBeNull();
    expect(p.bubbleStyle).toBe('classic');
    expect(p.coins).toBe(40);
  });
});
