/**
 * Dev/test provider. Marks a user subscribed without taking payment.
 * `createCheckout` refuses anyone who is not an admin.
 */
import { grantTestSubscription, type EntitlementSlice } from '@tudobem/shared';
import type { BillingProvider, WebhookResult } from './provider.js';

export interface DevBillingDeps {
  isAdmin: () => boolean;
  now: () => number;
  getProfile: (userId: string) => EntitlementSlice | undefined;
  afterChange: (userId: string) => void;
}

export class DevBillingProvider implements BillingProvider {
  readonly id = 'dev' as const;

  constructor(private readonly deps: DevBillingDeps) {}

  async createCheckout(userId: string): Promise<string> {
    if (!this.deps.isAdmin()) throw Object.assign(new Error('admin_only'), { status: 403 });
    const profile = this.deps.getProfile(userId);
    if (!profile) throw Object.assign(new Error('unknown_user'), { status: 404 });
    grantTestSubscription(profile, this.deps.now());
    this.deps.afterChange(userId);
    return 'https://playtudobem.com/?assinatura=teste';
  }

  handleWebhook(_body: string, _headers: Readonly<Record<string, string | string[] | undefined>>): WebhookResult {
    return { ok: false, status: 403, error: 'dev_webhook' };
  }
}
