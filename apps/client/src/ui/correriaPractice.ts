/**
 * The first-time "Correria no Balcão" practice: Ana orders what a new counter has (a coffee and a pão francês), played on the real counter
 * and the real overlay, but run here in the client with the shared rules (`practiceShift`), so it never reaches the server, pays no RV and
 * cannot be lost: Ana's patience is topped up and she never walks out. Nothing to read first: the overlay's coach marks point at each new
 * thing to tap, once. When Ana is served, one line and "Começar o turno". "Pular" in the HUD goes straight on; "?" starts it again.
 */
import { practiceShift, shiftAct, shiftAdvance, shiftSnapshot, type CEvent, type ClientMsg, type Shift } from '@tudobem/shared';
import { CorreriaUI } from './correria';
import { PRACTICE_DONE } from './correriaPracticeLogic';

export interface PracticeHooks {
  /** "Começar o turno" (or Pular): the practice is done, open a real shift */
  start: () => void;
  /** the overlay went away */
  closed: () => void;
}

const TICK_MS = 250;
const HEARTBEAT_MS = 1000;

export class CorreriaPractice {
  readonly ui: CorreriaUI;
  private sh: Shift;
  private last = 0;
  private lastSent = 0;
  private timer = 0;
  private done = false;
  private served = false;

  constructor(
    private readonly baker: 'carlos' | 'graca',
    private readonly hooks: PracticeHooks,
  ) {
    this.sh = practiceShift(1, baker);
    this.ui = new CorreriaUI({ send: (m) => this.onSend(m), closed: () => this.onClosed(), again: () => this.restart(), practice: { restart: () => this.restart(), skip: () => this.finish() } });
    this.restart();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  /** From the top: a fresh practice order. */
  restart(): void {
    if (this.done) return;
    this.ui.fresh();
    this.sh = practiceShift((Date.now() >>> 0) || 1, this.baker);
    this.served = false;
    this.last = performance.now();
    const ana = this.sh.customers[0];
    this.push(ana ? [{ k: 'front', id: ana.id }] : []);
  }

  private onSend(m: ClientMsg): void {
    if (m.t !== 'mg' || this.done) return;
    if (m.action === 'sync') return this.push([]);
    if (m.action === 'quit') return this.ui.destroy();
    if (m.action !== 'act' || this.served) return;
    this.advance();
    const ev = shiftAct(this.sh, m.act);
    this.onEvents(ev);
    this.push(ev);
  }

  /** Let the real time pass in the practice shift: Ana never loses patience, and a wrong tray only gets a correction (she never walks out). */
  private advance(): CEvent[] {
    const now = performance.now();
    const dt = Math.min(5000, Math.max(0, now - this.last));
    this.last = now;
    const ev = dt > 0 ? shiftAdvance(this.sh, dt) : [];
    for (const c of this.sh.customers) {
      c.patience = c.patienceMax;
      c.mistakes = 0;
    }
    return ev;
  }

  private tick(): void {
    if (this.done) return;
    const ev = this.advance();
    if (ev.length || performance.now() - this.lastSent > HEARTBEAT_MS) this.push(ev);
  }

  private onEvents(ev: CEvent[]): void {
    if (this.served || !ev.some((e) => e.k === 'serve')) return;
    this.served = true;
    this.ui.setDone(PRACTICE_DONE, () => this.finish(), () => this.restart());
  }

  /** Hand the overlay a state, like the server would (the meter stands still: Ana is never in a hurry). */
  private push(ev: CEvent[]): void {
    const snap = shiftSnapshot(this.sh);
    for (const c of snap.customers) c.rate = 0;
    this.lastSent = performance.now();
    this.ui.handle({ t: 'mg', phase: 'state', snap, ev });
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.ui.destroy();
    this.hooks.start();
  }

  private onClosed(): void {
    this.done = true;
    window.clearInterval(this.timer);
    this.hooks.closed();
  }
}
