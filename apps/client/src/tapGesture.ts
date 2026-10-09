/**
 * One press on the world canvas, told apart as a tap or a steer (issue #154). Pure state, no DOM, so it is unit tested; main.ts feeds it the
 * pointer events.
 *
 * - A mouse press is a click on release, wherever it is released (unchanged from #127).
 * - A finger lifted within `TAP_SLOP_PX` of where it went down is a tap: walk there, or act on what is under it.
 * - A finger that drags past the slop, or is held still for `HOLD_MS` on the floor, steers: the avatar walks toward the finger and follows it
 *   while it moves. Lifting it then is not a tap.
 */
export const TAP_SLOP_PX = 10;
export const HOLD_MS = 320;
/** Least time between two steering moves sent to the server. */
export const STEER_MS = 150;

export type GestureEvent = 'tap' | 'steer' | null;

export class TapGesture {
  private down: { id: number; x: number; y: number; t: number; touch: boolean } | null = null;
  /** the press steers (the finger moved, or was held on the floor) */
  steering = false;

  /** A primary press started. `touch`: a finger or a pen (anything but a mouse). */
  start(id: number, x: number, y: number, t: number, touch: boolean): void {
    this.down = { id, x, y, t, touch };
    this.steering = false;
  }

  /** Where the current press went down, if there is one. */
  get origin(): { x: number; y: number } | null {
    return this.down ? { x: this.down.x, y: this.down.y } : null;
  }

  /** The pointer moved: 'steer' while a finger steers (the caller walks toward it), else null. */
  move(id: number, x: number, y: number): GestureEvent {
    const d = this.down;
    if (!d || d.id !== id || !d.touch) return null;
    if (!this.steering && Math.hypot(x - d.x, y - d.y) > TAP_SLOP_PX) this.steering = true;
    return this.steering ? 'steer' : null;
  }

  /** True once a finger has been held still for HOLD_MS (the caller then decides whether the spot is floor, and calls `steer`). */
  holdDue(t: number): boolean {
    const d = this.down;
    return !!d && d.touch && !this.steering && t - d.t >= HOLD_MS;
  }

  steer(): void {
    if (this.down?.touch) this.steering = true;
  }

  /** The press ended: 'tap' to act on the release point, 'steer' when it was steering (one last move to where the finger left), else null. */
  end(id: number, x: number, y: number): GestureEvent {
    const d = this.down;
    if (!d || d.id !== id) return null;
    this.down = null;
    if (this.steering) {
      this.steering = false;
      return 'steer';
    }
    if (d.touch && Math.hypot(x - d.x, y - d.y) > TAP_SLOP_PX) return null;
    return 'tap';
  }

  cancel(id: number): void {
    if (this.down?.id !== id) return;
    this.down = null;
    this.steering = false;
  }
}
