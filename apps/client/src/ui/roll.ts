/**
 * Academia Gracie da Praça — flagship BJJ roll UI (language duels on positions).
 */
import type { RollServerMsg } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { openModal, closeModal, modalId } from './panels';
import { speak } from '../audio';

type RollMsg = Extract<RollServerMsg, { t: 'roll' }>;

export class RollUI {
  private close: () => void;
  private panel: HTMLElement;
  private body: HTMLElement;
  private timerBar: HTMLElement;
  private raf = 0;
  private locked = false;
  private duelEnd = 0;
  private duelMs = 0;
  private reorderPick: number[] = [];
  private puzzleId = '';

  constructor(
    private actions: {
      answerChoice: (i: number) => void;
      answerOrder: (order: number[]) => void;
      timeout: () => void;
      quit: () => void;
      rematch: () => void;
    },
  ) {
    this.body = h('div', { class: 'roll-body', id: 'roll-body' });
    this.timerBar = h('div', { class: 'timer' }, h('div'));
    this.panel = h(
      'div',
      { class: 'panel roll', id: 'roll' },
      h(
        'div',
        { class: 'roll-head' },
        h('h2', null, 'Rola no tatame'),
        en('Portuguese duels on real positions — first submission wins.', true),
        h('span', { class: 'spacer' }),
        h('button', { class: 'ghost', onclick: () => this.quit() }, '✕'),
      ),
      h('div', { class: 'roll-belt', id: 'roll-belt' }),
      h('div', { class: 'rail' }, h('div', { class: 'roll-position', id: 'roll-position' }), this.timerBar),
      this.body,
    );
    this.close = openModal('roll', this.panel, { dismissable: false, onClose: () => this.cleanup() });
    this.renderBelt();
  }

  private cleanup() {
    cancelAnimationFrame(this.raf);
  }

  private quit() {
    this.actions.quit();
    this.close();
  }

  private renderBelt() {
    const bjj = game.profile?.bjj;
    const el = this.panel.querySelector('#roll-belt');
    if (!el) return;
    const stripes = bjj?.stripes ?? 0;
    el.replaceChildren(
      h('span', { class: 'belt-chip' }, 'Faixa branca'),
      en('White belt — earned on the mat, never bought.', true),
      h('span', { class: 'stripe-row' }, ...Array.from({ length: 4 }, (_, i) => h('span', { class: `stripe ${i < stripes ? 'on' : ''}` }))),
      h('span', { class: 'wins' }, `${bjj?.wins ?? 0} vitórias`, en(` ${bjj?.wins ?? 0} wins`, true)),
    );
  }

  handle(m: RollMsg) {
    if (m.phase === 'queue') {
      this.locked = true;
      this.body.replaceChildren(
        h('div', { class: 'roll-queue' }, h('b', null, 'Fila do tatame aberto'), en('Open-mat queue', true), h('p', null, bi('Procurando parceiro…', 'Looking for a partner…')), h('p', { class: 'muted' }, `CPU em ~${Math.round(m.waitMs / 1000)}s se ninguém entrar.`)),
      );
      return;
    }
    if (m.phase === 'bow') {
      this.locked = true;
      this.body.replaceChildren(h('div', { class: 'roll-bow' }, h('b', null, m.line.pt), en(m.line.en), h('p', null, bi('Oss!', 'Oss!'))));
      speak(m.line.pt);
      return;
    }
    if (m.phase === 'duel') {
      this.locked = false;
      this.reorderPick = [];
      this.puzzleId = m.puzzle.id;
      const pos = this.panel.querySelector('#roll-position');
      pos?.replaceChildren(
        h('span', null, `Rodada ${m.round}/${m.maxRounds} · `, h('b', null, m.positionPt)),
        en(` Round ${m.round}/${m.maxRounds} · ${m.positionEn}`, true),
        m.submissionPt ? h('span', { class: 'sub-hint' }, ` · ${m.submissionPt}`) : '',
      );
      this.duelMs = m.timeMs;
      this.duelEnd = performance.now() + m.timeMs;
      this.tickTimer();
      if (m.puzzle.kind === 'reorder' && m.puzzle.tokens) {
        const row = h('div', { class: 'roll-reorder-pick', id: 'roll-reorder-pick' });
        const bank = h('div', { class: 'roll-chips', id: 'roll-chips' });
        m.puzzle.tokens.forEach((tok) => {
          bank.append(
            h(
              'button',
              {
                type: 'button',
                'data-roll-token': String(tok.i),
                onclick: () => this.pickReorder(tok.i, m.puzzle.tokens!, row, bank),
              },
              tok.pt,
            ),
          );
        });
        this.body.replaceChildren(
          h('div', { class: 'roll-duel', id: 'roll-duel', 'data-puzzle-id': m.puzzle.id, 'data-kind': m.puzzle.kind }),
          h('p', { class: 'prompt' }, h('b', null, m.puzzle.prompt.pt), en(m.puzzle.prompt.en)),
          row,
          bank,
          h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => this.resetReorder(row, bank) }, bi('Limpar', 'Clear')), h('span', { class: 'spacer' }), h('button', { class: 'green', onclick: () => this.submitReorder() }, bi('Confirmar', 'Confirm'))),
        );
      } else {
        const chips = h('div', { class: 'roll-chips' });
        m.puzzle.options?.forEach((opt, i) => {
          chips.append(
            h(
              'button',
              {
                type: 'button',
                'data-roll-chip': String(i),
                onclick: () => this.pickChoice(i),
              },
              h('b', null, opt.pt),
              en(opt.en),
            ),
          );
        });
        this.body.replaceChildren(
          h('div', { class: 'roll-duel', id: 'roll-duel', 'data-puzzle-id': m.puzzle.id, 'data-kind': m.puzzle.kind }),
          h('p', { class: 'prompt' }, h('b', null, m.puzzle.prompt.pt), en(m.puzzle.prompt.en)),
          chips,
        );
      }
      if (m.debugCorrect !== undefined) {
        const duel = this.body.querySelector('#roll-duel');
        duel?.setAttribute('data-debug', JSON.stringify(m.debugCorrect));
      }
      return;
    }
    if (m.phase === 'scramble') {
      this.locked = true;
      cancelAnimationFrame(this.raf);
      this.body.replaceChildren(h('div', { class: 'roll-scramble' }, h('b', null, m.line.pt), en(m.line.en), h('p', null, m.positionPt, en(` · ${m.positionEn}`, true))));
      return;
    }
    if (m.phase === 'end') {
      this.locked = true;
      cancelAnimationFrame(this.raf);
      if (game.profile) game.profile.bjj = m.bjj;
      this.renderBelt();
      const won = m.winner === 'player';
      this.body.replaceChildren(
        h('div', { class: 'roll-end', id: 'roll-end' },
          h('div', { class: 'big' }, `+${m.rv} RV`),
          h('p', null, h('b', null, m.line.pt), en(m.line.en)),
          h('p', null, m.fistBump.pt, en(m.fistBump.en)),
          h('p', { class: 'muted' }, won ? bi('Faixa branca — faixas só sobem!', 'White belt — stripes only go up!') : bi('Boa rola. O português treina também.', 'Good roll. Your Portuguese trained too.')),
          h('div', { class: 'row', style: 'justify-content:center;margin-top:12px' },
            h('button', { onclick: () => this.close() }, bi('Sair', 'Leave')),
            h('button', { class: 'primary', onclick: () => (this.close(), this.actions.rematch()) }, bi('De novo', 'Rematch')),
          ),
        ),
      );
      speak(m.fistBump.pt);
    }
  }

  private tickTimer() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      const left = Math.max(0, this.duelEnd - performance.now());
      const pct = this.duelMs ? left / this.duelMs : 0;
      const inner = this.timerBar.firstElementChild as HTMLElement;
      if (inner) inner.style.width = `${pct * 100}%`;
      if (left <= 0 && !this.locked) {
        this.locked = true;
        this.actions.timeout();
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private pickChoice(i: number) {
    if (this.locked) return;
    this.locked = true;
    this.actions.answerChoice(i);
  }

  private pickReorder(i: number, tokens: { i: number; pt: string }[], row: HTMLElement, bank: HTMLElement) {
    if (this.locked) return;
    if (this.reorderPick.includes(i)) return;
    this.reorderPick.push(i);
    const tok = tokens.find((t) => t.i === i);
    row.append(h('span', { class: 'picked' }, tok?.pt ?? ''));
    const btn = bank.querySelector(`[data-roll-token="${i}"]`) as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    const need = tokens.length;
    if (this.reorderPick.length >= need) {
      this.locked = true;
      this.actions.answerOrder([...this.reorderPick]);
    }
  }

  private resetReorder(row: HTMLElement, bank: HTMLElement) {
    if (this.locked) return;
    this.reorderPick = [];
    row.replaceChildren();
    bank.querySelectorAll('button').forEach((b) => (b.disabled = false));
  }

  private submitReorder() {
    if (this.locked || !this.reorderPick.length) return;
    this.locked = true;
    this.actions.answerOrder([...this.reorderPick]);
  }
}

export function closeRoll() {
  if (modalId() === 'roll') closeModal();
}
