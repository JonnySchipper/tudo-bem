/**
 * Glue between the pixel scene and the audio: every frame the scene hands over the local player's feet, and this decides what the
 * ambience should hear (the zone mix at that spot, a footstep on the terrain under them). The scene calls `update` once per frame.
 */
import { floorAt, type RoomDef } from '@tudobem/shared';
import { ambience } from '../ambience';
import { AMBIENT } from '../render/pixel/ambientData';
import { T } from '../render/pixel/coords';
import { FootstepClock, SILENT_MIX, zoneMix } from './zones';

export interface ListenerFrame {
  /** feet, world px */
  x: number;
  y: number;
  moving: boolean;
}

export class ZoneFeed {
  private readonly steps = new FootstepClock();
  private lastListen = 0;
  private roomKey = '';

  /** `minute` is the game minute, `rain` the live rain density 0..1. `now` is a performance.now()-style ms clock. */
  update(def: RoomDef, me: ListenerFrame | null, minute: number, rain: number, now: number): void {
    const key = def.id;
    if (key !== this.roomKey) {
      this.roomKey = key;
      this.steps.reset();
      this.lastListen = 0;
    }
    const zones = def.outdoor ? AMBIENT[def.id]?.audio : undefined;
    if (now - this.lastListen > 120) {
      this.lastListen = now;
      ambience.listen(zones && me ? zoneMix(zones, { x: me.x, y: me.y, minute, rain }) : SILENT_MIX);
    }
    if (!me) {
      this.steps.reset();
      return;
    }
    const n = this.steps.update(me.x, me.y, me.moving);
    if (n > 0) ambience.step(floorAt(def, Math.floor(me.x / T), Math.floor((me.y + 2) / T)));
  }
}
