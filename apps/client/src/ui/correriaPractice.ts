/**
 * The first-time "Correria no Balcão" tutorial: a practice order (a coffee, a pão francês, an orange juice) played on the real counter and the
 * real overlay, but run here in the client with the shared rules (`practiceShift`), so it never reaches the server, pays no RV and cannot be
 * lost: Ana's patience is topped up every tick and only the taps the current step teaches go through. A coach card on top of the order strip
 * walks the six steps and lights up what to tap. The "?" in the HUD starts it again.
 */
import { practiceShift, shiftAct, shiftAdvance, shiftSnapshot, type Bilingual, type CEvent, type ClientMsg, type Shift } from '@tudobem/shared';
import { CorreriaUI } from './correria';
import { h } from './dom';
import { PRACTICE_BLOCKED, PRACTICE_STEPS, practiceAfter, practiceAllows, practiceIndex, practicePaid, practiceRetry, practiceStep, practiceTargets, type PracticeStepId } from './correriaPracticeLogic';

export interface PracticeHooks {
  /** "Começar o turno" (or Pular): the practice is done, open a real shift */
  start: () => void;
  /** the overlay went away */
  closed: () => void;
}

const TICK_MS = 250;
const HEARTBEAT_MS = 1000;
const LIT = 'cr-coach-lit';

export class CorreriaPractice {
  readonly ui: CorreriaUI;
  private sh: Shift;
  private step: PracticeStepId = 'read';
  private hint: Bilingual | null = null;
  private paid = { tip: 0, points: 0 };
  private last = 0;
  private lastSent = 0;
  private timer = 0;
  private raf = 0;
  private lit: HTMLElement[] = [];
  private done = false;
  private readonly card = h('div', { class: 'cr-coach', id: 'cr-coach', role: 'status', 'aria-live': 'polite' });

  constructor(
    private readonly baker: 'carlos' | 'graca',
    private readonly hooks: PracticeHooks,
  ) {
    this.sh = practiceShift(1, baker);
    this.ui = new CorreriaUI({ send: (m) => this.onSend(m), closed: () => this.onClosed(), again: () => this.restart(), practice: { restart: () => this.restart() } });
    this.ui.setCoach(this.card);
    this.restart();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.light();
  }

  /** From the top: a fresh practice order and step 1. */
  restart(): void {
    if (this.done) return;
    this.ui.fresh();
    this.sh = practiceShift((Date.now() >>> 0) || 1, this.baker);
    this.step = 'read';
    this.hint = null;
    this.paid = { tip: 0, points: 0 };
    this.last = performance.now();
    const ana = this.sh.customers[0];
    this.push(ana ? [{ k: 'front', id: ana.id }] : []);
    this.drawCard();
  }

  private onSend(m: ClientMsg): void {
    if (m.t !== 'mg' || this.done) return;
    if (m.action === 'sync') return this.push([]);
    if (m.action === 'quit') return this.ui.destroy();
    if (m.action !== 'act') return;
    this.advance();
    if (!practiceAllows(this.step, m.act)) {
      this.hint = PRACTICE_BLOCKED;
      this.drawCard();
      // a "no" lets the counter drop a pour it started on its own
      return this.push([{ k: 'no', why: 'practice', line: PRACTICE_BLOCKED }]);
    }
    const ev = shiftAct(this.sh, m.act);
    this.onEvents(ev);
    this.push(ev);
  }

  /** Let the real time pass in the practice shift (Ana never loses patience). */
  private advance(): CEvent[] {
    const now = performance.now();
    const dt = Math.min(5000, Math.max(0, now - this.last));
    this.last = now;
    const ev = dt > 0 ? shiftAdvance(this.sh, dt) : [];
    for (const c of this.sh.customers) c.patience = c.patienceMax;
    return ev;
  }

  private tick(): void {
    if (this.done) return;
    const ev = this.advance();
    this.onEvents(ev);
    if (ev.length || performance.now() - this.lastSent > HEARTBEAT_MS) this.push(ev);
  }

  private onEvents(ev: CEvent[]): void {
    if (!ev.length) return;
    const retry = practiceRetry(ev);
    const served = ev.find((e) => e.k === 'serve');
    if (served && served.k === 'serve') this.paid = { tip: served.tip, points: served.points };
    const next = practiceAfter(this.step, ev);
    if (next !== this.step) {
      this.step = next;
      this.hint = null;
    } else if (retry) this.hint = retry;
    else return;
    this.drawCard();
  }

  /** Hand the overlay a state, like the server would (the meter stands still: Ana is never in a hurry). */
  private push(ev: CEvent[]): void {
    const snap = shiftSnapshot(this.sh);
    for (const c of snap.customers) c.rate = 0;
    this.lastSent = performance.now();
    this.ui.handle({ t: 'mg', phase: 'state', snap, ev });
  }

  private go(step: PracticeStepId): void {
    this.step = step;
    this.hint = null;
    this.drawCard();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.ui.destroy();
    this.hooks.start();
  }

  private drawCard(): void {
    const s = practiceStep(this.step);
    const n = practiceIndex(this.step) + 1;
    const body = this.step === 'paid' ? practicePaid(this.paid.tip, this.paid.points) : s.body;
    const btn = (cls: string, pt: string, en: string, onclick: () => void, id?: string) => h('button', { type: 'button', class: `cr-coach-btn ${cls}`, ...(id ? { id } : {}), onclick }, h('span', { class: 'pt' }, pt), h('span', { class: 'gloss' }, en));
    this.card.dataset.step = this.step;
    const nodes: (HTMLElement | null)[] = [
      h(
        'div',
        { class: 'cr-coach-head' },
        h('b', { class: 'cr-coach-n', 'aria-label': `Passo ${n} de ${PRACTICE_STEPS.length}` }, `${n}/${PRACTICE_STEPS.length}`),
        h('span', { class: 'cr-coach-kick' }, 'Treino', h('span', { class: 'gloss' }, 'Practice')),
        this.step === 'paid' ? null : btn('skip', 'Pular', 'Skip', () => this.finish(), 'cr-coach-skip'),
      ),
      h('h3', { class: 'cr-coach-title' }, h('span', { class: 'pt' }, s.title.pt), h('span', { class: 'gloss' }, s.title.en)),
      h('p', { class: 'cr-coach-body' }, h('span', { class: 'pt' }, body.pt), h('span', { class: 'gloss' }, body.en)),
      this.hint ? h('p', { class: 'cr-coach-hint' }, h('span', { class: 'pt' }, this.hint.pt), h('span', { class: 'gloss' }, this.hint.en)) : null,
      this.step === 'read' ? h('div', { class: 'cr-coach-row' }, btn('next', 'Próximo', 'Next', () => this.go('cafe'), 'cr-coach-next')) : null,
      this.step === 'paid'
        ? h('div', { class: 'cr-coach-row' }, btn('next', 'Começar o turno', 'Start the shift', () => this.finish(), 'cr-coach-start'), btn('again', 'Treinar de novo', 'Practice again', () => this.restart(), 'cr-coach-again'))
        : null,
      h('ol', { class: 'cr-coach-dots', 'aria-hidden': 'true' }, ...PRACTICE_STEPS.map((x, i) => h('li', { class: i < n - 1 ? 'done' : i === n - 1 ? 'on' : '' }))),
    ];
    this.card.replaceChildren(...nodes.filter((node): node is HTMLElement => node != null));
  }

  /** Every frame: the glow on what to tap (the HUD and the shelf buttons are redrawn, so it is put back each time). */
  private light = (): void => {
    if (this.done) return;
    this.raf = requestAnimationFrame(this.light);
    const want = practiceTargets(this.step, this.ui.snapshot)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    for (const el of this.lit) if (!want.includes(el)) el.classList.remove(LIT);
    for (const el of want) if (!el.classList.contains(LIT)) el.classList.add(LIT);
    this.lit = want;
  };

  private onClosed(): void {
    this.done = true;
    window.clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    for (const el of this.lit) el.classList.remove(LIT);
    this.lit = [];
    this.hooks.closed();
  }
}
