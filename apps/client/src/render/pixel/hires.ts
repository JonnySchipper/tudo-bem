/**
 * The option-4 player avatar (characters.ts `HIRES`). On by default; `?hires=0` in the page URL shows the old
 * 16x32 players for comparison.
 */
export function hiresEnabled(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).get('hires') !== '0';
}
