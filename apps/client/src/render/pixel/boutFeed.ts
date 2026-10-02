/**
 * What the world scene needs to know about the bout in progress: a tiny store the DOM side (ui/bout.ts) writes and the Phaser side
 * (boutStage.ts) reads every frame. No DOM, no Phaser: the two sides never import each other.
 */
import type { Appearance, BjjPositionId, BoutReason, BoutSnapshot, BoutWinner, CrowdCue, Belt, RefSignal } from '@tudobem/shared';

export type StageCue =
  | { t: 'intro'; ms: number }
  | { t: 'fight' }
  | { t: 'transition'; from: BjjPositionId; to: BjjPositionId; rungFrom: number; rungTo: number; gain: 'you' | 'partner' | null }
  | { t: 'ref'; signal: RefSignal }
  | { t: 'crowd'; cue: CrowdCue }
  | { t: 'finish'; winner: 'you' | 'partner' }
  | { t: 'escaped' }
  | { t: 'end'; winner: BoutWinner | 'none'; reason: BoutReason }
  | { t: 'hit'; strength: 1 | 2 }
  | { t: 'miss' }
  | { t: 'long' };

export interface FeedPartner {
  id: string;
  name: string;
  appearance: Appearance;
}

class BoutFeed {
  /** the camera is zoomed onto the mat (the lobby, the bout, the end card) */
  camera = false;
  /** a bout is on the mat: the pair is drawn and the player's own avatar is hidden */
  active = false;
  partner: FeedPartner | null = null;
  belt: Belt = 'branca';
  snap: BoutSnapshot | null = null;
  /** CSS px the bottom overlay and the top scoreboard cover (the camera keeps the mat in the rest) */
  boxPx = 0;
  topPx = 0;
  /** ms of introduction left to play (the walk-in, the fist bump) */
  private cues: StageCue[] = [];
  /** performance.now() of the last change, so the stage can tell a fresh bout from an old one */
  epoch = 0;

  begin(partner: FeedPartner, belt: Belt, snap: BoutSnapshot): void {
    this.active = true;
    this.partner = partner;
    this.belt = belt;
    this.snap = snap;
    this.cues = [];
    this.epoch++;
  }

  /** the mat camera on or off (it eases in and out); turning it off also ends the bout view */
  setCamera(on: boolean): void {
    this.camera = on;
    if (!on) this.end();
  }

  end(): void {
    this.active = false;
    this.cues = [];
    this.snap = null;
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

  /** The two overlay sizes the camera works around (CSS px). */
  setBoxes(bottom: number, top: number): void {
    this.boxPx = Math.max(0, Math.round(bottom));
    this.topPx = Math.max(0, Math.round(top));
  }
}

export const boutFeed = new BoutFeed();
