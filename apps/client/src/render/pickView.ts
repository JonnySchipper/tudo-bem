export type ViewName = 'pixel' | 'iso';

/**
 * Which world view draws the scene. `pixel` (top-down, Phaser) is the default since Phase 4b; `?view=iso` (or a build-time
 * `VITE_VIEW=iso`) still selects the isometric renderer, which stays until Phase 5. Anything unknown falls back to `pixel`.
 */
export function pickView(requested: string | null | undefined): ViewName {
  const v = (requested ?? '').trim().toLowerCase();
  return v === 'iso' ? 'iso' : 'pixel';
}
