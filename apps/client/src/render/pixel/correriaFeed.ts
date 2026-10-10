/**
 * What the world scene needs from the counter game in progress: a tiny store the DOM side (ui/correria.ts) writes and the Phaser side
 * (correriaStage.ts) reads every frame. No DOM, no Phaser: the two sides never import each other. The stage also calls back through
 * `on` (the taps on the shelves, the grill, the machine, the bag, the bell), which the DOM side fills in.
 */
import type { CEvent, CorreriaSnap } from '@tudobem/shared';

export type StageCue = { t: 'ev'; e: CEvent } | { t: 'shake' } | { t: 'cheer'; pt: string; en: string; baker: 'carlos' | 'graca' };

export interface CounterHandlers {
  grab: (itemId: string) => void;
  chapaPut: (itemId: string) => void;
  chapaTake: (slot: number) => void;
  pourStart: (itemId: string) => void;
  pourEnd: () => void;
  /** One orange into the espremedor. */
  juiceDrop: () => void;
  /** Take the glass off the juicer (the server judges the line). */
  juiceTake: () => void;
  pack: (kind: 'bag' | 'plate') => void;
  serve: () => void;
  clear: () => void;
  replay: () => void;
}

const noop = () => {};
export const NO_HANDLERS: CounterHandlers = { grab: noop, chapaPut: noop, chapaTake: noop, pourStart: noop, pourEnd: noop, juiceDrop: noop, juiceTake: noop, pack: noop, serve: noop, clear: noop, replay: noop };

class CorreriaFeed {
  /** the camera is zoomed onto the counter */
  camera = false;
  /** a shift is on: the board and the queue are drawn, the player's own avatar is hidden */
  active = false;
  snap: CorreriaSnap | null = null;
  /** performance.now() when `snap` arrived (the stage and the overlay run the meters from it) */
  snapAt = 0;
  /** the bottom overlay's height in CSS px (the camera keeps the counter above it) */
  boxPx = 0;
  topPx = 0;
  /** What the camera frames this shift (room px): set by the stage from its layout, a small board for a small menu. */
  frame: { focus: { x: number; y: number }; need: { w: number; h: number } } | null = null;
  /** the cup chosen for the machine (client-only) */
  cup = 'cafe';
  /** items to show by name (the learner's gloss preference), set by the overlay */
  showEn = true;
  on: CounterHandlers = NO_HANDLERS;
  private cues: StageCue[] = [];
  /** bumped on a new shift so the stage starts clean */
  epoch = 0;

  begin(snap: CorreriaSnap): void {
    this.active = true;
    this.snap = snap;
    this.snapAt = performance.now();
    this.cues = [];
    this.epoch++;
  }

  update(snap: CorreriaSnap): void {
    this.snap = snap;
    this.snapAt = performance.now();
  }

  setCamera(on: boolean): void {
    this.camera = on;
    if (on) this.boxPx = 0;
    if (!on) this.end();
  }

  end(): void {
    this.active = false;
    this.snap = null;
    this.frame = null;
    this.cues = [];
    this.on = NO_HANDLERS;
    this.epoch++;
  }

  push(c: StageCue): void {
    if (this.active) this.cues.push(c);
  }

  drain(): StageCue[] {
    const out = this.cues;
    this.cues = [];
    return out;
  }

  setBoxes(bottom: number, top: number): void {
    // the tallest the strip has been this shift: items landing on the tray resize it, and refitting the camera each time zoomed out and back in
    this.boxPx = Math.max(this.camera ? this.boxPx : 0, Math.round(bottom));
    this.topPx = Math.max(0, Math.round(top));
  }
}

export const correriaFeed = new CorreriaFeed();
