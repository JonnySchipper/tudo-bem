/**
 * `/?design=<room>`: the admin dashboard's World page links here. The game opens in that room, asks for the admin password
 * (the in-game gate, checked by the server), and goes straight into design mode.
 */
import { isRoomId, type RoomId } from '@tudobem/shared';
import { game } from '../state';
import { openDesignFromLink } from './admin';

/** The room the link asks for. `andar` needs an academy id, so it cannot be linked. */
export function designLinkRoom(search = location.search): RoomId | null {
  const room = new URLSearchParams(search).get('design');
  return isRoomId(room) && room !== 'andar' ? room : null;
}

/** Once the player is standing in the linked room, open the admin login with design mode next. Runs once. */
export function watchDesignLink(): void {
  const room = designLinkRoom();
  if (!room) return;
  // used once: a reconnect later must not pull the player back to this room
  const url = new URL(location.href);
  url.searchParams.delete('design');
  history.replaceState(history.state, '', url);
  const off = game.on('room', () => {
    if (game.room?.room !== room) return;
    off();
    openDesignFromLink();
  });
}
