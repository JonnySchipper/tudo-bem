/** Apply a design-mode layout on every client. The editor UI itself stays in a lazy chunk. */
import { installRoomProps, revertRoomProps, type PropDef, type RoomId } from '@tudobem/shared';
import { game } from '../state';

export function applyServerLayout(room: RoomId, objects: PropDef[] | null): void {
  if (objects) installRoomProps(room, objects);
  else revertRoomProps(room);
  game.layoutNotice = { room, objects };
  game.bumpLayout();
  game.emit('layout');
}
