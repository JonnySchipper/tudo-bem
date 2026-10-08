import crypto from 'node:crypto';

/** Hex HMAC-SHA256 of the raw body, the value Lemon Squeezy puts in `X-Signature`. */
export function signWebhookBody(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Constant-time compare of two strings. A length mismatch is a failure, not an exception. */
export function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}
