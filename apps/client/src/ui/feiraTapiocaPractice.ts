/**
 * The first-time Tapioca practice, Correria's pattern (`correriaPractice.ts`): one regular orders a cheese tapioca, played
 * on the real stage with one pan, but run here in the client, so it never reaches the server, pays no RV, scores nothing
 * and cannot be lost: she never runs out of patience, there is no clock, and a wrong filling only gets a "not that one".
 * Nothing to read first: the coach marks point at each new thing to do, once. When she is served, one line and
 * "Começar" (the real run). "Pular" in the HUD goes straight on; "Sair" leaves (the practice comes back next time).
 */
import { h, en } from './dom';
import { TapiocaView } from './feiraTapioca';
import { TAPIOCA_PRACTICE_DONE, TAPIOCA_PRACTICE_KEY } from './feiraTapiocaPracticeLogic';

export interface TapiocaPracticeHooks {
  /** "Começar" (or Pular): the practice is done, ask the server for a real run */
  start: () => void;
  /** Sair: the practice went away without a run */
  closed: () => void;
}

export class TapiocaPractice {
  private view: TapiocaView;
  private done = false;

  constructor(private readonly hooks: TapiocaPracticeHooks) {
    this.view = this.open();
  }

  private open(): TapiocaView {
    return new TapiocaView(0, {
      // Sair (the stage ends the "run" with what it has): nothing to report, the practice just closes
      finish: () => this.close(),
      quit: () => this.close(),
      again: () => this.restart(),
    }, { skip: () => this.finish(), served: () => this.served() });
  }

  /** From the top: a fresh customer and a clean pan. */
  restart(): void {
    if (this.done) return;
    this.view.destroy();
    this.view = this.open();
  }

  /** The right tapioca reached her: one line, then Começar (or De novo). */
  private served(): void {
    if (this.done) return;
    const strip = h('div', { class: 'fst-practice-done', id: 'tapioca-practice-done', role: 'status' },
      h('p', null, h('b', { lang: 'pt-BR' }, TAPIOCA_PRACTICE_DONE.pt), en(TAPIOCA_PRACTICE_DONE.en)),
      h('div', { class: 'fst-practice-actions' },
        h('button', { type: 'button', class: 'primary', id: 'tapioca-practice-start', onclick: () => this.finish() }, 'Começar ▶', en('Start')),
        h('button', { type: 'button', class: 'ghost', id: 'tapioca-practice-again', onclick: () => this.restart() }, 'De novo', en('Again')),
      ),
    );
    // a beat for her reaction first
    window.setTimeout(() => {
      if (!this.done && this.view.root.isConnected) this.view.root.append(strip);
    }, 900);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    try {
      localStorage.setItem(TAPIOCA_PRACTICE_KEY, '1');
    } catch {
      /* private mode: the practice comes back next time */
    }
    this.view.destroy();
    this.hooks.start();
  }

  private close(): void {
    if (this.done) return;
    this.done = true;
    this.view.destroy();
    this.hooks.closed();
  }

  destroy(): void {
    this.close();
  }
}
