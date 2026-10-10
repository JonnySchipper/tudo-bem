/**
 * One cast on the fishing stage, without the DOM (PRAIA-PLAN.md 2.1, 2.2): hold and let go to cast (a sine power swell, tangled when held
 * too long), wait through the nibbles, tap at the bite, then hold to reel and let go while it runs. It plays the same pure sim the server
 * judges with (`pescaStep` on the same roll, 50 ms ticks) and records only taps and holds. `cues` are what the stage turns into juice.
 */
import {
  PESCA_FIGHT,
  biteWindow,
  fightStart,
  pescaRoll,
  pescaStep,
  runAt,
  type FightState,
  type PescaCast,
  type PescaEvent,
  type PescaRoll,
  type ServerMsg,
} from '@tudobem/shared';

export type PescaCue = 'tangle' | 'nibble' | 'bite' | 'hooked' | 'early' | 'late' | 'run_soon' | 'run' | 'snapped' | 'escaped' | 'landed';
export type PlayPhase = 'aim' | 'casting' | 'wait' | 'fight' | 'sent';

/** The power swell while the cast is held: 0..1 and back every 1.6 s. */
export const swell = (heldMs: number): number => 0.5 - 0.5 * Math.cos((heldMs / 1600) * Math.PI * 2);

type CastMsg = Extract<ServerMsg, { t: 'pesca'; phase: 'cast' }>;

export class PescaPlay {
  phase: PlayPhase = 'aim';
  /** while aiming: when the press began (null: not held) */
  holdStart: number | null = null;
  power = 0;
  seq = 0;
  cast: PescaCast | null = null;
  roll: PescaRoll | null = null;
  /** local time the bobber landed (the cast's 0 ms) */
  t0 = 0;
  events: PescaEvent[] = [];
  fight: FightState = fightStart();
  holding = false;
  hookMs = 0;
  private seenNibbles = 0;
  private bit = false;
  private warned = new Set<number>();
  /** a press that must be let go before the next one counts (after a tangle) */
  private locked = false;

  /** The press on the stage (mouse, touch or Space). */
  press(now: number): PescaCue[] {
    if (this.phase === 'aim') {
      if (!this.locked) this.holdStart = now;
      return [];
    }
    if (this.phase === 'wait' && this.roll) {
      const t = now - this.t0;
      if (t < this.roll.biteAtMs) {
        this.events.push({ k: 'hook', ms: t });
        this.phase = 'sent';
        return ['early'];
      }
      this.events.push({ k: 'hook', ms: t }, { k: 'hold', down: true, ms: t });
      this.hookMs = t;
      this.holding = true;
      this.phase = 'fight';
      this.fight = fightStart();
      return ['hooked'];
    }
    if (this.phase === 'fight' && !this.holding) {
      this.holding = true;
      this.events.push({ k: 'hold', down: true, ms: now - this.t0 });
    }
    return [];
  }

  /** The release. While aiming, it returns the power to cast with (null: no cast). */
  release(now: number): { cues: PescaCue[]; castPower: number | null } {
    if (this.phase === 'aim') {
      this.locked = false;
      if (this.holdStart === null) return { cues: [], castPower: null };
      this.power = swell(now - this.holdStart);
      this.holdStart = null;
      this.phase = 'casting';
      return { cues: [], castPower: this.power };
    }
    if (this.phase === 'fight' && this.holding) {
      this.holding = false;
      this.events.push({ k: 'hold', down: false, ms: now - this.t0 });
    }
    return { cues: [], castPower: null };
  }

  /** The server's cast: roll the same fish (or the pinned one), start the clock. */
  onCast(m: CastMsg, now: number) {
    this.seq = m.seq;
    this.cast = { seed: m.seed, water: m.water, weather: m.weather, minute: m.minute, power: m.power, firstCatches: m.firstCatches };
    this.roll = m.pinned ?? pescaRoll(this.cast);
    this.t0 = now;
    this.events = [];
    this.seenNibbles = 0;
    this.bit = false;
    this.warned.clear();
    this.holding = false;
    this.phase = 'wait';
  }

  /** The cast was refused: back to aiming. */
  reset() {
    this.phase = 'aim';
    this.holdStart = null;
    this.holding = false;
    this.roll = null;
  }

  /** Advance to `now`. Returns the cues, and `done` once the cast is over (the result to send is `this.events`). */
  tick(now: number): { cues: PescaCue[]; done: boolean } {
    const cues: PescaCue[] = [];
    if (this.phase === 'aim' && this.holdStart !== null) {
      this.power = swell(now - this.holdStart);
      if (now - this.holdStart > PESCA_FIGHT.tangleMs) {
        this.holdStart = null;
        this.locked = true;
        cues.push('tangle');
      }
      return { cues, done: false };
    }
    if (!this.roll || !this.cast) return { cues, done: false };
    const t = now - this.t0;
    if (this.phase === 'wait') {
      while (this.seenNibbles < this.roll.nibblesAtMs.length && t >= this.roll.nibblesAtMs[this.seenNibbles]!) {
        this.seenNibbles++;
        cues.push('nibble');
      }
      if (!this.bit && t >= this.roll.biteAtMs) {
        this.bit = true;
        cues.push('bite');
      }
      if (t > this.roll.biteAtMs + biteWindow(this.cast)) {
        this.phase = 'sent';
        cues.push('late');
        return { cues, done: true };
      }
      return { cues, done: false };
    }
    if (this.phase === 'fight') {
      // junk and the puffer come straight up; a fish fights
      if (!this.roll.runs.length && this.roll.fightMaxMs === 0) {
        this.phase = 'sent';
        cues.push('landed');
        return { cues, done: true };
      }
      const target = t - this.hookMs;
      while (!this.fight.done && this.fight.t + PESCA_FIGHT.tick <= target) {
        this.fight = pescaStep(this.fight, this.roll, this.holding, PESCA_FIGHT.tick);
        const soon = this.roll.runs.findIndex((r) => this.fight.t >= r.at - PESCA_FIGHT.telegraphMs && this.fight.t < r.at);
        if (soon >= 0 && !this.warned.has(soon)) {
          this.warned.add(soon);
          cues.push('run_soon');
        }
      }
      if (this.fight.done) {
        this.phase = 'sent';
        cues.push(this.fight.done === 'caught' ? 'landed' : this.fight.done);
        return { cues, done: true };
      }
      if (runAt(this.roll, this.fight.t)) cues.push('run');
    }
    return { cues, done: false };
  }

  /** Let go of the rod: the quit is part of the record. */
  quit(now: number) {
    if (this.phase === 'wait' || this.phase === 'fight') this.events.push({ k: 'quit', ms: Math.max(0, now - this.t0) });
    this.phase = 'sent';
  }
}
