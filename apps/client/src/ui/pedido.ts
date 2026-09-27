/**
 * Pedido rápido — dedicated breakfast order UI for Seu Carlos.
 * A+ overhaul: ticket/receipt chrome, visual order journey, soft score feedback.
 * Distinct from Conversa mesa and Me vê um… tray game.
 */
import type { Bilingual, SceneView } from '@tudobem/shared';
import { ROOMS, SCORE_FEEDBACK } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { renderAvatarPreview } from '../render/avatar';
import { speak } from '../audio';
import { ticketLinesFromSaid, type TicketLine } from './pedido-ticket';

interface PedidoState {
  view: SceneView;
  ticket: TicketLine[];
  lastScore?: 0 | 1 | 2 | 3;
  feedback?: Bilingual;
  said?: Bilingual;
  payout?: number;
  dailyBlocked?: boolean;
}

let state: PedidoState | null = null;
let containerEl: HTMLElement | null = null;
let backdropEl: HTMLElement | null = null;
let closeCallback: (() => void) | null = null;
let playCallback: (() => void) | null = null;
let onChoose: ((i: number) => void) | null = null;
let onType: ((text: string) => void) | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;

function portrait() {
  const carlos = ROOMS.padaria.npcs.find((n) => n.id === 'carlos')!;
  const c = h('canvas', { width: 96, height: 110, style: 'width:96px;height:110px' });
  let raf = 0;
  const loop = (ts: number) => {
    if (!c.isConnected && ts > 1000) return cancelAnimationFrame(raf);
    renderAvatarPreview(c, carlos.appearance, carlos.hat, false, ts / 1000, { scale: 2.35, footY: 236, npc: 'carlos' });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return h('div', { class: 'pedido-portrait' }, c);
}

function buildTicketVisual(ticket: TicketLine[]): HTMLElement {
  const ticketEl = h('div', { class: 'pedido-ticket', id: 'pedido-ticket' });

  const header = h('div', { class: 'ticket-header' },
    h('span', { class: 'ticket-logo' }, '☕'),
    h('span', { class: 'ticket-title' }, 'PADARIA DO SEU CARLOS'),
    h('span', { class: 'ticket-subtitle' }, 'Pedido · Order')
  );

  const items = h('div', { class: 'ticket-items' });
  const slots = [
    { kind: 'food', label: 'Comida', labelEn: 'Food', icon: '🥐' },
    { kind: 'drink', label: 'Bebida', labelEn: 'Drink', icon: '☕' },
    { kind: 'where', label: 'Local', labelEn: 'Where', icon: '📍' },
  ];

  for (const slot of slots) {
    const line = ticket.find(l => l.kind === slot.kind);
    const filled = !!line;
    items.append(
      h('div', { class: `ticket-item ${filled ? 'filled' : 'empty'}`, 'data-slot': slot.kind },
        h('span', { class: 'item-icon' }, slot.icon),
        h('span', { class: 'item-label' }, slot.label),
        filled
          ? h('span', { class: 'item-value' }, line!.pt, en(line!.en, true))
          : h('span', { class: 'item-placeholder' }, '—')
      )
    );
  }

  const dashes = h('div', { class: 'ticket-dashes' }, '- - - - - - - - - - - - - - - -');

  ticketEl.append(header, items, dashes);
  return ticketEl;
}

const PEDIDO_MISS: Bilingual = {
  pt: 'Eita, não peguei — tenta de novo ou escolhe um botão.',
  en: 'Hmm, I missed that — try again or tap a button.',
};

function buildScoreIndicator(score: 0 | 1 | 2 | 3): HTMLElement {
  const stars = '★'.repeat(score) + '☆'.repeat(3 - score);
  const cls = score === 3 ? 'perfect' : score === 2 ? 'good' : score === 1 ? 'ok' : 'miss';
  const copy = score === 0 ? PEDIDO_MISS : SCORE_FEEDBACK[score];
  return h('div', { class: `pedido-score ${cls}` },
    h('span', { class: 'score-stars' }, stars),
    h('span', { class: 'score-text' }, copy.pt),
    en(copy.en, true)
  );
}

function render() {
  if (!state || !containerEl) return;

  const header = h('div', { class: 'pedido-header' },
    portrait(),
    h('div', { class: 'pedido-info' },
      h('div', { class: 'npc-name' }, 'Seu Carlos'),
      h('small', { class: 'npc-role' }, 'Padeiro · Baker'),
      h('div', { class: 'scene-title' }, 'Pedido rápido', en('Quick order', true))
    ),
    h('button', { class: 'close-btn ghost', onclick: handleClose, 'aria-label': 'Fechar' }, '✕')
  );

  const ticketVisual = buildTicketVisual(state.ticket);

  const carlosLine = h('div', { class: 'pedido-carlos-line' },
    h('div', { class: 'line-bubble' },
      h('div', { class: 'line-head' },
        h('span', { class: 'line-label' }, 'Seu Carlos'),
        h('button', {
          class: 'speak-btn',
          onclick: () => speak(state!.view.line.pt, { force: true }),
          title: 'Ouvir / Listen',
        }, '🔊'),
      ),
      h('span', { class: 'pt' }, state.view.line.pt),
      en(state.view.line.en, true),
    ),
  );

  let body: HTMLElement;
  if (state.view.end) {
    // Daily RV gate copy: eng-locked, PT-primary (Curriculum needs_br)
    // "Já pediu hoje! Volte amanhã." — No inline English; gloss shown only in Verde plate tooltip if needed.
    const dailyCopy = state.dailyBlocked
      ? h('div', { class: 'daily-blocked', 'data-needs-br': 'true' },
          h('span', { class: 'blocked-icon' }, '📅'),
          h('b', { lang: 'pt-BR' }, 'Já pediu hoje!'),
          h('small', { lang: 'pt-BR' }, 'Volte amanhã.')
        )
      : null;

    body = h('div', { class: 'pedido-body ended' },
      ticketVisual,
      carlosLine,
      state.payout && state.payout > 0
        ? h('div', { class: 'pedido-payout' }, `+${state.payout} RV`, en('Breakfast complete!', true))
        : dailyCopy,
      h('div', { class: 'pedido-actions' },
        h('button', { class: 'ghost', onclick: handleClose }, bi('Tchau!', 'Bye!')),
        h('button', { class: 'primary', onclick: handlePlay, id: 'btn-pedido-play-mg' }, bi('Jogar "Me vê um…"', 'Play tray game'))
      )
    );
  } else {
    const chips = state.view.chips.map((chip, i) =>
      h('button', { class: 'pedido-chip', onclick: () => handleChip(i), 'data-chip': String(i) },
        h('span', { class: 'chip-num' }, String(i + 1)),
        h('span', { class: 'chip-text' },
          h('span', { class: 'pt' }, chip.pt),
          chip.en ? en(chip.en, true) : null
        )
      )
    );

    const inputEl = h('input', {
      type: 'text',
      maxLength: 140,
      placeholder: 'Ou escreva sua resposta… (or type)',
      'aria-label': 'Sua resposta',
      id: 'pedido-input'
    }) as HTMLInputElement;
    inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') handleSend(inputEl);
    });

    body = h('div', { class: 'pedido-body' },
      ticketVisual,
      carlosLine,
      state.said ? h('div', { class: 'pedido-you-said' }, `Você: "${state.said.pt}"`) : null,
      state.lastScore !== undefined ? buildScoreIndicator(state.lastScore) : null,
      h('div', { class: 'pedido-chips' }, ...chips),
      h('div', { class: 'pedido-input-row' },
        inputEl,
        h('button', { class: 'primary', onclick: () => handleSend(inputEl) }, 'Enviar')
      )
    );
  }

  containerEl.replaceChildren(header, body);

  if (!state.view.end) {
    const input = document.getElementById('pedido-input') as HTMLInputElement | null;
    input?.focus();
  }
}

function handleChip(index: number) {
  if (!state || state.view.end || !onChoose) return;
  const chip = state.view.chips[index];
  if (!chip) return;

  state.ticket = [...state.ticket, ...ticketLinesFromSaid(chip)];

  onChoose(index);
}

function handleSend(input: HTMLInputElement) {
  if (!state || state.view.end || !onType) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  state.ticket = [...state.ticket, ...ticketLinesFromSaid({ pt: text, en: '' })];

  onType(text);
}

function handleClose() {
  closePedido();
  closeCallback?.();
}

function handlePlay() {
  const play = playCallback;
  closePedido();
  play?.();
}

export function closePedido() {
  if (onKey) {
    document.removeEventListener('keydown', onKey);
    onKey = null;
  }
  backdropEl?.remove();
  backdropEl = null;
  containerEl = null;
  state = null;
  onChoose = null;
  onType = null;
  closeCallback = null;
  playCallback = null;
  game.modalOpen = false;
}

export function isPedidoOpen(): boolean {
  return state !== null;
}

export function updatePedido(
  view: SceneView,
  extra: { said?: Bilingual; feedback?: Bilingual; score?: number; payout?: number; dailyBlocked?: boolean }
) {
  if (!state) return;

  if (extra.said) {
    state.ticket = [
      ...state.ticket.filter((l) => !ticketLinesFromSaid(extra.said).some((nl) => nl.kind === l.kind)),
      ...ticketLinesFromSaid(extra.said),
    ];
  }

  state.view = view;
  state.lastScore = extra.score as 0 | 1 | 2 | 3 | undefined;
  state.feedback = extra.feedback;
  state.said = extra.said;
  state.payout = extra.payout;
  state.dailyBlocked = extra.dailyBlocked;

  speak(view.line.pt);
  render();
}

export function openPedido(
  view: SceneView,
  callbacks: {
    onChoose: (i: number) => void;
    onClose: () => void;
    onPlay: () => void;
    onType?: (text: string) => void;
  }
) {
  if (state) return;

  onChoose = callbacks.onChoose;
  closeCallback = callbacks.onClose;
  playCallback = callbacks.onPlay;
  onType = callbacks.onType ?? null;

  state = {
    view,
    ticket: [],
    lastScore: undefined,
    feedback: undefined,
    said: undefined,
    payout: undefined,
    dailyBlocked: false
  };

  backdropEl = h('div', { class: 'pedido-backdrop', 'data-modal': 'pedido' });
  containerEl = h('div', { class: 'pedido-panel' });
  backdropEl.append(containerEl);

  onKey = (e: KeyboardEvent) => {
    if (!state) return;
    if (e.key === 'Escape') {
      handleClose();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= state.view.chips.length) handleChip(n - 1);
  };
  document.addEventListener('keydown', onKey);

  ui().append(backdropEl);
  game.modalOpen = true;
  speak(view.line.pt);
  render();
}
