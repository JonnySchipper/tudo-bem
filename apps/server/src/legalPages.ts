/**
 * Public legal pages. They must be real HTML, not the game shell.
 * `/privacy` and `/terms` (with or without a trailing slash, or as `.html`)
 * map to files Vite copies from `apps/client/public`.
 */

const FILES = {
  privacy: 'privacy.html',
  terms: 'terms.html',
} as const;

export type LegalPageFile = (typeof FILES)[keyof typeof FILES];

export function legalPageFile(pathname: string): LegalPageFile | null {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  path = path.replace(/\/+$/, '') || '/';
  const base = path.toLowerCase();
  if (base === '/privacy' || base === '/privacy.html') return FILES.privacy;
  if (base === '/terms' || base === '/terms.html') return FILES.terms;
  return null;
}

/** Vite dev/preview: turn `/privacy` and `/privacy/` into the static file before the SPA fallback. */
export function rewriteLegalRequestUrl(url: string): string {
  const q = url.indexOf('?');
  const pathOnly = q === -1 ? url : url.slice(0, q);
  const search = q === -1 ? '' : url.slice(q);
  const file = legalPageFile(pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`);
  if (!file) return url;
  if (pathOnly.toLowerCase().replace(/\/+$/, '').endsWith('.html')) return url;
  return `/${file}${search}`;
}
