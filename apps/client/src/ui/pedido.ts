/**
 * Pedido rápido — dedicated breakfast order UI for Seu Carlos.
 * A+ overhaul: ticket/receipt chrome, visual order journey, soft score feedback.
 * Distinct from Conversa mesa and Me vê um… tray game.
 */
import type { Bilingual, SceneView } from '@tudobem/shared';
import { SCORE_FEEDBACK } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { renderAvatarPreview } from '../render/avatar';
import { speak } from '../audio';

interface PedidoState {
  view: SceneView;
  ticket: TicketLine[];
  lastScore?: 0 | 1 | 2 | 3;
  feedback?: Bilingual;
  said?: Bilingual;
  payout?: number;
  dailyBlocked?: boolean;
}

interface TicketLine {
  kind: 'food' | 'drink' | 'where' | 'pay';
  pt: string;
  en: string;
}

let state: PedidoState | null = null;
let containerEl: HTMLElement | null = null;
let backdropEl: HTMLElement | null = null;
let closeCallback: (() => void) | null = null;
let playCallback: (() => void) | null = null;
let onChoose: ((i: number) => void) | null = null;
let onType: ((text: string) => void) | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;

function inferTicketFromCtx(view: SceneView): TicketLine[] {
  const lines: TicketLine[] = [];
  const pt = view.line.pt.toLowerCase();

  if (pt.includes('pão na chapa') || pt.includes('coxinha') || pt.includes('pastel')) {
    const food = pt.includes('pão na chapa') ? { pt: 'Pão na chapa', en: 'Grilled bread' }
      : pt.includes('coxinha') ? { pt: 'Coxinha', en: 'Coxinha' }
      : { pt: 'Pastel', en: 'Pastel' };
    lines.push({ kind: 'food', ...food });
  }
  if (pt.includes('café com leite') || pt.includes('suco') || pt.includes('água') || pt.includes('café puro')) {
    const drink = pt.includes('café com leite') ? { pt: 'Café com leite', en: 'Coffee w/ milk' }
      : pt.includes('suco') ? { pt: 'Suco de laranja', en: 'Orange juice' }
      : pt.includes('água') ? { pt: 'Água', en: 'Water' }
      : { pt: 'Café', en: 'Coffee' };
    lines.push({ kind: 'drink', ...drink });
  }
  if (pt.includes('aqui') || pt.includes('viagem')) {
    lines.push({ kind: 'where', pt: pt.includes('viagem') ? 'Pra viagem' : 'Pra comer aqui', en: pt.includes('viagem') ? 'To go' : 'For here' });
  }
  return lines;
}

function buildTicketFromSceneProgress(nodeId: string, said?: Bilingual): TicketLine[] {
  const lines: TicketLine[] = [];
  const saidPt = said?.pt?.toLowerCase() ?? '';

  if (saidPt.includes('pão na chapa')) lines.push({ kind: 'food', pt: 'Pão na chapa', en: 'Grilled bread' });
  else if (saidPt.includes('coxinha')) lines.push({ kind: 'food', pt: 'Coxinha', en: 'Coxinha' });
  else if (saidPt.includes('pastel')) lines.push({ kind: 'food', pt: 'Pastel', en: 'Pastel' });

  if (saidPt.includes('café com leite')) lines.push({ kind: 'drink', pt: 'Café com leite', en: 'Coffee w/ milk' });
  else if (saidPt.includes('suco')) lines.push({ kind: 'drink', pt: 'Suco de laranja', en: 'Orange juice' });
  else if (saidPt.includes('água')) lines.push({ kind: 'drink', pt: 'Água', en: 'Water' });
  else if (saidPt.includes('café')) lines.push({ kind: 'drink', pt: 'Café', en: 'Coffee' });

  if (saidPt.includes('viagem')) lines.push({ kind: 'where', pt: 'Pra viagem', en: 'To go' });
  else if (saidPt.includes('aqui')) lines.push({ kind: 'where', pt: 'Pra comer aqui', en: 'For here' });

  return lines;
}

function portrait() {
  const carlos = { id: 'carlos', appearance: { body: 'medio', skin: 4, hair: 'curto', hairColor: 6, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 2, shoes: 1, face: 'maduro', extra: 'bigode', idle: 'bracos' } };
  const c = h('canvas', { width: 96, height: 110, style: 'width:96px;height:110px' });
  let raf = 0;
  const loop = (ts: number) => {
    if (!c.isConnected && ts > 1000) return cancelAnimationFrame(raf);
    renderAvatarPreview(c, carlos.appearance as any, null, false, ts / 1000, { scale: 2.35, footY: 236, npc: 'carlos' });
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

function buildScoreIndicator(score: 0 | 1 | 2 | 3): HTMLElement {
  const stars = '★'.repeat(score) + '☆'.repeat(3 - score);
  const cls = score === 3 ? 'perfect' : score === 2 ? 'good' : score === 1 ? 'ok' : 'miss';
  return h('div', { class: `pedido-score ${cls}` },
    h('span', { class: 'score-stars' }, stars),
    h('span', { class: 'score-text' }, SCORE_FEEDBACK[score].pt),
    en(SCORE_FEEDBACK[score].en, true)
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
      h('span', { class: 'pt' }, state.view.line.pt),
      en(state.view.line.en, true),
      h('button', { class: 'speak-btn', onclick: () => speak(state!.view.line.pt, { force: true }), title: 'Ouvir / Listen' }, '🔊')
    )
  );

  let body: HTMLElement;
  if (state.view.end) {
    const dailyCopy = state.dailyBlocked
      ? h('div', { class: 'daily-blocked' },
          h('span', { class: 'blocked-icon' }, '📅'),
          h('b', null, 'Já pediu hoje!'),
          en('Come back tomorrow for more RV', true)
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

  state.ticket = [
    ...state.ticket,
    ...buildTicketFromSceneProgress(state.view.nodeId, chip)
  ];

  onChoose(index);
}

function handleSend(input: HTMLInputElement) {
  if (!state || state.view.end || !onType) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  state.ticket = [
    ...state.ticket,
    ...buildTicketFromSceneProgress(state.view.nodeId, { pt: text, en: '' })
  ];

  onType(text);
}

function handleClose() {
  closePedido();
  closeCallback?.();
}

function handlePlay() {
  closePedido();
  playCallback?.();
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
      ...state.ticket.filter(l => !buildTicketFromSceneProgress(view.nodeId, extra.said).some(nl => nl.kind === l.kind)),
      ...buildTicketFromSceneProgress(view.nodeId, extra.said)
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
