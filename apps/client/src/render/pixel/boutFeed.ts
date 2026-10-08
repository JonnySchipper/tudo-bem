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
  | { t: 'long' }
  /** A white hit flash on the pair (2: a throw or points, 1: a blocked attack). */
  | { t: 'flash'; strength: 1 | 2 }
  /** A word that pops off the fighter who earned it (Vantagem!, a grip snap, a strip, a slip, a brace). */
  | { t: 'pop'; kind: 'vantagem' | 'grip' | 'strip' | 'slip' | 'brace'; side: 'you' | 'partner'; text: string }
  /** The move's ground read: an arrow over the pair toward who gained the ground. */
  | { t: 'ground'; dir: 'gain' | 'loss'; delta: number }
  | {
      t: 'cartoon';
      move: string;
      hit: boolean;
      from: BjjPositionId;
      to: BjjPositionId;
      aheadFrom: 'you' | 'partner' | null;
      aheadTo: 'you' | 'partner' | null;
      ms: number;
    };

export interface FeedPartner {
  id: string;
  name: string;
  appearance: Appearance;
  /** The belt the partner wears on the mat. The bot fights at the player's own belt, so that is the default. */
  belt?: Belt;
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
  /** A gag cartoon is on screen. The snapshot may still be the pose the move started from. */
  holding = false;

  begin(partner: FeedPartner, belt: Belt, snap: BoutSnapshot): void {
    this.active = true;
    this.partner = partner;
    this.belt = belt;
    this.snap = snap;
    this.cues = [];
    this.holding = false;
    this.fightBoxPx = 0;
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
    this.holding = false;
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
    if (this.active) this.fightBoxPx = Math.max(this.fightBoxPx, this.boxPx);
  }

  /**
   * The tallest the overlay has been this match (CSS px), at least `floor` of the screen: the fight camera sizes the fighters by it,
   * so the zoom holds still while the panel changes between picking, resolving and thinking.
   */
  fightBox(viewCssH: number, floor = 0.38): number {
    return Math.max(this.fightBoxPx, Math.round(viewCssH * floor));
  }
  private fightBoxPx = 0;
}

export const boutFeed = new BoutFeed();
