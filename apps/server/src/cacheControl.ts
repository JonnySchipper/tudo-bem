/**
 * Cache policy for the static client. Vite assets are content-hashed, so they can be immutable. Baked art
 * (public/art) keeps fixed file names and is versioned by the manifest's `?v=` hash instead: the manifest
 * and any unversioned art request must revalidate, or a browser that saw an older bake keeps showing it
 * for a year (how Padaria deltas v2/v3 stayed invisible to a returning reviewer on Fly).
 */
export function staticCacheControl(url: URL, ext: string): string {
  if (ext === '.html') return 'no-cache';
  if (url.pathname.includes('/art/') && (url.pathname.endsWith('/manifest.json') || !url.searchParams.has('v'))) return 'no-cache';
  return 'public, max-age=31536000, immutable';
}
