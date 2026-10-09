/**
 * Cache policy for the static client. Vite assets (`/assets/`) are content-hashed and TTS clips (`/audio/tts/`) are named by a hash of their
 * text, so both can be immutable. Everything else in `public/` keeps a fixed name and must revalidate (ETag / Last-Modified make that a cheap
 * 304): the pixel art (`public/pixel`: manifest, atlases, tiles, portraits, UI kit) is written together by `pnpm pixel`, so a browser that kept
 * an old atlas next to a new manifest would draw the wrong frames; icons, brand images and the web manifest would otherwise stick for a year.
 */
export function staticCacheControl(url: URL, ext: string): string {
  if (ext === '.html') return 'no-cache';
  // Fixed name, edited with the legal pages. A year-long immutable cache would keep an old stylesheet.
  if (url.pathname === '/legal.css' || url.pathname.endsWith('/legal.css')) return 'no-cache';
  if (url.pathname.includes('/pixel/')) return 'no-cache';
  if (/\/(icons|brand)\//.test(url.pathname) || url.pathname.endsWith('/site.webmanifest')) return 'no-cache';
  return 'public, max-age=31536000, immutable';
}
