/**
 * Pedido rápido — dedicated breakfast order UI for Seu Carlos.
 * A+ overhaul: ticket/receipt chrome, visual order journey, soft score feedback.
 * Distinct from Conversa mesa and Me vê um… tray game.
 */
import type { Bilingual, ConversaSafetyNotice, SceneView } from '@tudobem/shared';
import { ROOMS, SCORE_FEEDBACK, gateConversaPlayerLine } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { toast } from './hud';
import { expressionForScore } from './pixelArt';
import { speak } from '../audio';
import { ticketLinesFromSaid, type TicketLine } from './pedido-ticket';
import { closeDialogueBox, showDialogueBox, type BoxSpec } from './dialogue';

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
let closeCallback: (() => void) | null = null;
let playCallback: (() => void) | null = null;
let onChoose: ((i: number) => void) | null = null;
let onType: ((text: string) => void) | null = null;
/** The dialogue box (not the old modal) is showing this scene. */
let boxOwned = false;
/** One safety toast per send; server notice is a backstop when the client has not already shown it. */
let safetyToastShown = false;

function showSafetyToast(notice: ConversaSafetyNotice | null | undefined) {
  if (!notice || safetyToastShown) return;
  safetyToastShown = true;
  toast(notice.level, notice.pt, notice.en);
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

/** This beat of Pedido rápido as the dialogue box shows it: Carlos' line, the ticket, the score, the replies (or the payout and the way out). */
function boxSpec(s: PedidoState): BoxSpec {
  const ended = s.view.end;
  const expr = ended ? (s.payout && s.payout > 0 ? 'feliz' : 'neutro') : expressionForScore(s.lastScore);
  const dailyCopy = s.dailyBlocked
    ? h('div', { class: 'daily-blocked', 'data-needs-br': 'true' }, h('span', { class: 'blocked-icon' }, '📅'), h('b', { lang: 'pt-BR' }, 'Já pediu hoje!'), h('small', { lang: 'pt-BR' }, 'Volte amanhã.'))
    : null;
  const extras = h(
    'div',
    { class: 'pedido-extras' },
    buildTicketVisual(s.ticket),
    ended ? (s.payout && s.payout > 0 ? h('div', { class: 'pedido-payout' }, `+${s.payout} RV`, en('Breakfast complete!', true)) : dailyCopy) : null,
  );
  return {
    key: 'pedido',
    npcId: 'carlos',
    speaker: 'Seu Carlos',
    role: 'Padeiro · Pedido rápido',
    expression: expr,
    line: { pt: s.view.line.pt, en: s.view.line.en },
    said: !ended && s.said ? s.said.pt : null,
    feedback: !ended && s.lastScore !== undefined ? buildScoreIndicator(s.lastScore) : null,
    extras,
    chips: ended ? [] : s.view.chips.map((c) => ({ pt: c.pt, en: c.en })),
    input: ended ? null : { id: 'pedido-input', placeholder: 'Responda em português…', send: 'Enviar', onSend: (_t, el) => handleSend(el) },
    footer: ended
      ? h(
          'div',
          { class: 'dbx-footer-row' },
          h('button', { class: 'ghost', onclick: handleClose }, bi('Tchau!', 'Bye!')),
          h('button', { class: 'primary', onclick: handlePlay, id: 'btn-pedido-play-mg' }, bi('Jogar "Me vê um…"', 'Play tray game')),
        )
      : undefined,
    onChip: handleChip,
    onClose: handleClose,
    onDismiss: () => {
      if (state) closePedido();
    },
  };
}

function render() {
  if (!state) return;
  boxOwned = true;
  showDialogueBox(boxSpec(state));
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

  safetyToastShown = false;
  const gate = gateConversaPlayerLine(text);
  if (!gate.deliver) {
    showSafetyToast(gate.notice);
    return;
  }
  showSafetyToast(gate.notice);
  input.value = '';

  if (gate.action !== 'warn') {
    state.ticket = [...state.ticket, ...ticketLinesFromSaid({ pt: gate.text, en: '' })];
  } else {
    state.said = { pt: gate.text, en: '' };
  }

  onType(gate.text);
  if (gate.action === 'warn') render();
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
  state = null;
  onChoose = null;
  onType = null;
  closeCallback = null;
  playCallback = null;
  if (boxOwned) {
    boxOwned = false;
    closeDialogueBox();
  }
  game.modalOpen = false;
}

export function isPedidoOpen(): boolean {
  return state !== null;
}

export function updatePedido(
  view: SceneView,
  extra: {
    said?: Bilingual;
    feedback?: Bilingual;
    score?: number;
    payout?: number;
    dailyBlocked?: boolean;
    fillTicket?: boolean;
    notice?: ConversaSafetyNotice;
  }
) {
  if (!state) return;

  showSafetyToast(extra.notice);

  if (extra.said) {
    if (extra.fillTicket !== false) {
      state.ticket = [
        ...state.ticket.filter((l) => !ticketLinesFromSaid(extra.said).some((nl) => nl.kind === l.kind)),
        ...ticketLinesFromSaid(extra.said),
      ];
    }
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

  speak(view.line.pt);
  render();
}
