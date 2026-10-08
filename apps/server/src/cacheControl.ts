/**
 * Cache policy for the static client. Vite assets are content-hashed, so they can be immutable. The pixel art (`public/pixel`: manifest, atlases,
 * tiles, portraits, UI kit) keeps fixed file names and is written together by `pnpm pixel`, so every file under it must revalidate: a browser that
 * kept an old atlas next to a new manifest (or the other way round) would draw the wrong frames for up to a year. It is about 150 KB, so the cost is small.
 */
export function staticCacheControl(url: URL, ext: string): string {
  if (ext === '.html') return 'no-cache';
  // Fixed name, edited with the legal pages. A year-long immutable cache would keep an old stylesheet.
  if (url.pathname === '/legal.css' || url.pathname.endsWith('/legal.css')) return 'no-cache';
  if (url.pathname.includes('/pixel/')) return 'no-cache';
  return 'public, max-age=31536000, immutable';
}
