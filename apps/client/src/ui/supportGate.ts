import { hasPerkAccess, type PlayerSubscription } from '@tudobem/shared';

/**
 * The Apoiar button in the HUD menu. The beta is free: it shows only once the server says checkout is switched on (`billingReady`,
 * which needs `TB_BILLING_ENABLED=1` and the provider secrets), or for a player who already has perks to manage (a test grant).
 */
export function showSupportButton(billingReady: boolean, sub: PlayerSubscription | null | undefined, now: number): boolean {
  return billingReady || hasPerkAccess(sub, now);
}
