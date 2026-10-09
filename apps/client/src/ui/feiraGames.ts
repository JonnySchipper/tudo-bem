/**
 * Feira cart games: the cart offer, the sign board, and the hand-off into today's featured game.
 *
 * The server owns the run (`feiraGame` messages). This file only opens the right view — Tapioca, Pastel
 * or Caldo — and the placar panel. Adding another game is one branch in `openGame`.
 *
 * needs_br: true
 */
import {
  FEIRA_GAME_INTRO,
  FEIRA_GAME_LABEL,
  feiraCartGreet,
  type FeiraGameId,
  type ServerMsg,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { closeModal, modalId, openModal } from './modal';
import { TapiocaView, type TapiocaEnd } from './feiraTapioca';
import { PastelView } from './feiraPastel';
import { CaldoView } from './feiraCaldo';

type FeiraGameMsg = Extract<ServerMsg, { t: 'feiraGame' }>;

export interface FeiraGameHooks {
  sendStart: () => void;
  sendFinish: (outcomes: import('@tudobem/shared').FeiraOrderOutcome[]) => void;
  sendQuit: () => void;
  sendBoard: () => void;
}

type PlayView = { destroy(): void; showEnd(end: TapiocaEnd): void };

let hooks: FeiraGameHooks | null = null;
let view: PlayView | null = null;
let closeOffer: (() => void) | null = null;

export function bindFeiraGames(hks: FeiraGameHooks) {
  hooks = hks;
}

export function feiraGameOpen(): boolean {
  return !!view;
}

/** Cart hotspot: today's game and a Jogar button. A game that is off has no cart, so there is no closed panel. */
export function openFeiraCart(gameId: FeiraGameId) {
  const intro = FEIRA_GAME_INTRO[gameId];
  const label = FEIRA_GAME_LABEL[gameId];
  const greet = feiraCartGreet(gameId);
  const close = openModal(
    'feira-cart',
    h('div', { class: 'panel feira-game-panel', id: 'feira-cart-panel' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('p', { class: 'fg-kicker' }, 'Carrinho da feira', en('Market cart')),
      h('h2', { id: 'feira-cart-game' }, label.pt, en(label.en)),
      h('p', { class: 'fg-intro', lang: 'pt-BR' }, intro.pt),
      h('p', { class: 'en' }, intro.en),
      h('p', { class: 'fg-greet' }, greet.pt, en(greet.en)),
      h('button', {
        type: 'button',
        class: 'primary',
        id: 'feira-cart-play',
        onclick: () => {
          close();
          hooks?.sendStart();
        },
      }, 'Jogar', en('Play')),
    ),
  );
  closeOffer = close;
}

/** Sign hotspot: ask the server for the live board, then paint it. */
export function openFeiraSign() {
  hooks?.sendBoard();
}

function medalMark(kind: 'gold' | 'silver' | 'bronze'): string {
  return kind === 'gold' ? '1' : kind === 'silver' ? '2' : '3';
}

function dismissCartUi() {
  if (view) {
    view.destroy();
    view = null;
    hooks?.sendQuit();
  }
  closeOffer?.();
  closeOffer = null;
  if (modalId() === 'feira-cart' || modalId() === 'feira-sign') closeModal();
}

function paintBoard(m: Extract<FeiraGameMsg, { phase: 'board' }>, alsoCart: boolean) {
  game.feiraCart = { closed: m.closed, game: m.game };
  game.emit('room');
  if (m.closed || !m.game) {
    dismissCartUi();
    return;
  }
  if (alsoCart) {
    openFeiraCart(m.game);
    return;
  }
  const label = FEIRA_GAME_LABEL[m.game];
  const top = m.top.length
    ? h('ol', { class: 'fg-top', id: 'feira-sign-top' },
      ...m.top.map((row) => h('li', { class: row.you ? 'you' : '' },
        h('b', null, `${row.rank}`),
        h('span', null, row.name),
        h('span', { class: 'fg-score' }, String(row.best)),
      )))
    : h('p', { class: 'fg-empty', id: 'feira-sign-top' }, 'Ninguém jogou hoje ainda.', en('Nobody has played today yet.'));
  const medals = m.medals.length
    ? h('ol', { class: 'fg-medals', id: 'feira-sign-medals' },
      ...m.medals.map((row) => h('li', null,
        h('span', { class: 'fg-name' }, row.name),
        h('span', { class: 'fg-counts' },
          h('i', { class: 'fg-medal gold', title: 'Ouro' }, medalMark('gold')), ` ${row.gold} `,
          h('i', { class: 'fg-medal silver', title: 'Prata' }, medalMark('silver')), ` ${row.silver} `,
          h('i', { class: 'fg-medal bronze', title: 'Bronze' }, medalMark('bronze')), ` ${row.bronze}`,
        ),
      )))
    : h('p', { class: 'fg-empty' }, 'Nenhuma medalha ainda.', en('No medals yet.'));
  const close = openModal(
    'feira-sign',
    h('div', { class: 'panel feira-game-panel', id: 'feira-sign-panel' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('p', { class: 'fg-kicker' }, 'Placar da Feira', en('Market board')),
      h('h2', null, 'Hoje', en('Today')),
      h('p', { class: 'fg-featured', id: 'feira-sign-game' }, label.pt, en(label.en)),
      h('h3', null, 'Top 3', en('Live')),
      top,
      h('h3', null, 'Medalhas', en('All-time medals')),
      medals,
    ),
  );
  void m.crownId;
}

function openGame(m: Extract<FeiraGameMsg, { phase: 'start' }>) {
  view?.destroy();
  closeOffer?.();
  closeOffer = null;
  const hooksFor = {
    finish: (outcomes: import('@tudobem/shared').FeiraOrderOutcome[]) => hooks?.sendFinish(outcomes),
    quit: () => {
      view?.destroy();
      view = null;
      hooks?.sendQuit();
    },
    again: () => {
      view?.destroy();
      view = null;
      hooks?.sendStart();
    },
  };
  if (m.game === 'tapioca') {
    view = new TapiocaView(m.seed, hooksFor);
    return;
  }
  if (m.game === 'pastel') {
    view = new PastelView(m.seed, hooksFor);
    return;
  }
  if (m.game === 'caldo') {
    view = new CaldoView(m.seed, hooksFor);
    return;
  }
  // Unimplemented games never start: the server only deals a registered module.
}

export function onFeiraGameMsg(m: FeiraGameMsg) {
  if (m.phase === 'cart') {
    game.feiraCart = { closed: m.closed, game: m.game };
    game.emit('room');
    if (m.closed || !m.game) dismissCartUi();
    else if (modalId() === 'feira-cart') openFeiraCart(m.game);
    return;
  }
  if (m.phase === 'start') return openGame(m);
  if (m.phase === 'board') {
    const want = game.pendingFeiraOpen;
    game.pendingFeiraOpen = null;
    if (want === 'cart') return paintBoard(m, true);
    return paintBoard(m, false);
  }
  if (m.phase === 'crown') {
    game.feiraCrownId = m.id;
    game.emit('room');
    return;
  }
  if (m.phase === 'end' && view) {
    const end: TapiocaEnd = {
      score: m.score,
      coins: m.coins,
      dailyBlocked: m.dailyBlocked,
      served: m.served,
      perfect: m.perfect,
      left: m.left,
      bestToday: m.bestToday,
      place: m.place,
      crown: m.crown,
      linePt: m.line.pt,
      lineEn: m.line.en,
    };
    view.showEnd(end);
    if (m.crown && game.profile) {
      game.feiraCrownId = game.profile.id;
      game.emit('room');
    }
  }
}

export function closeFeiraGame() {
  view?.destroy();
  view = null;
}
