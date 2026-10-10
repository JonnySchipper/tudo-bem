/**
 * Admin design mode, the lazy chunk's entry (the editor lives in ./design/). Opened from the dashboard's `/?design=<room>` link or the in-game
 * admin panel. The editor signs in with the dashboard's admin session; the server checks it on every design call.
 */
import { game } from '../state';
import { closeDesign, designActive, openDesign } from './design/editor';

/** Open the editor on the room the player is standing in, or close it. */
export function toggleDesignMode(): void {
  if (designActive()) return closeDesign();
  const room = game.room?.room;
  if (room) void openDesign(room);
}

export function designModeActive(): boolean {
  return designActive();
}

export { openDesign, closeDesign };
