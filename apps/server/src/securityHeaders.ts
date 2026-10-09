import type { IncomingMessage, ServerResponse } from 'node:http';

/** True when the browser reached us over HTTPS: a TLS socket, or Fly's proxy saying so in X-Forwarded-Proto. */
export function requestIsHttps(req: IncomingMessage): boolean {
  if ((req.socket as { encrypted?: boolean }).encrypted) return true;
  return String(req.headers['x-forwarded-proto'] ?? '').split(',')[0]?.trim().toLowerCase() === 'https';
}

/**
 * Report-only CSP: the browser logs what it would block, nothing breaks. Google Identity Services loads its script, button
 * iframe and stylesheet from accounts.google.com; the page fonts come from Google Fonts; the game socket is same-origin.
 */
export function contentSecurityPolicy(host: string | undefined): string {
  // The Host header lands in a response header. Anything outside host syntax would make setHeader throw.
  const h = host && /^[A-Za-z0-9.\-:[\]]+$/.test(host) ? host : '';
  const sockets = h ? ` ws://${h} wss://${h}` : '';
  return [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com/gsi/client",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "media-src 'self' data: blob:",
    `connect-src 'self'${sockets} https://accounts.google.com/gsi/`,
    'frame-src https://accounts.google.com/gsi/',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Headers every response carries. Nothing frames the game (lifesim-frame.html is a page of its own, not an iframe), so framing is denied.
 * Set with setHeader so a later writeHead adds to them.
 */
export function applySecurityHeaders(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('content-security-policy-report-only', contentSecurityPolicy(req.headers.host));
  if (requestIsHttps(req)) res.setHeader('strict-transport-security', 'max-age=31536000');
}
