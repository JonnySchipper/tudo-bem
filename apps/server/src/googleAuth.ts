import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readEnv } from './env.js';

export interface GoogleOAuthConfig {
  /** Web client ID from Google Cloud Console (public; also sent to the browser). */
  clientId: string;
  /** Optional; not used for Sign in with Google (ID token) today — set on Fly if you add server-side OAuth later. */
  clientSecret?: string;
  ready: boolean;
}

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export function readGoogleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig {
  const clientId = readEnv('TB_GOOGLE_CLIENT_ID')?.trim() ?? '';
  const clientSecret = readEnv('TB_GOOGLE_CLIENT_SECRET')?.trim();
  if (!clientId) return { clientId: '', clientSecret, ready: false };
  return { clientId, clientSecret, ready: true };
}

export type GoogleTokenPayload = { sub: string; email: string; emailVerified: boolean };

/** Verify a Google Identity Services credential (OpenID Connect ID token). */
export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleTokenPayload | null> {
  if (!idToken || !clientId) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      audience: clientId,
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!sub || !email || !emailVerified) return null;
    return { sub, email, emailVerified };
  } catch {
    return null;
  }
}
