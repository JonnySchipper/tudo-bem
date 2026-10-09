/**
 * The end card of the Feira cart games (Tapioca, Pastel, Caldo de cana): a market receipt with a stamp for ground
 * gained or lost, the server's score and RV, today's best and the board place.
 *
 * Display only: the server scores the run, and every number here comes from it.
 *
 * needs_br: true (labels, stamps).
 */
import { FEIRA_CROWD_LABEL, FEIRA_END_STAMP, feiraCrowd, feiraEndTier, type FeiraGameId } from '@tudobem/shared';
import { h, en } from './dom';

export interface StallEnd {
  score: number;
  coins: number;
  dailyBlocked: boolean;
  served: number;
  perfect: number;
  left: number;
  bestToday: number;
  place: number;
  crown: boolean;
  linePt: string;
  lineEn: string;
}

/**
 * The end card. Ids keep `<prefix>-end / -stamp / -score / -meta / -place / -crown / -again / -close`, which the
 * e2e and shot scripts click.
 */
export function stallEndCard(o: {
  game: FeiraGameId;
  prefix: string;
  cls: string;
  title: string;
  end: StallEnd;
  again: () => void;
  quit: () => void;
}): HTMLElement {
  const { end, prefix, cls } = o;
  const tier = feiraEndTier(end);
  const stamp = FEIRA_END_STAMP[tier];
  const pos = Math.round(feiraCrowd(end.served, end.left) * 100);
  const crowd = h('div', { class: `fs-crowd ${pos > 50 ? 'fs-up' : pos < 50 ? 'fs-down' : ''}`, 'data-pos': String(pos) },
    h('span', { class: 'fs-crowd-label' }, FEIRA_CROWD_LABEL.pt, en(FEIRA_CROWD_LABEL.en)),
    h('span', { class: 'fs-crowd-bar' },
      h('i', { class: 'fs-crowd-fill', style: `left:${Math.min(50, pos)}%;width:${Math.abs(pos - 50)}%` }),
      h('i', { class: 'fs-crowd-mark', style: `left:${pos}%` }),
    ),
  );
  const crown = end.crown
    ? h('p', { class: `${cls}-crown-line fs-crown`, id: `${prefix}-crown` }, 'Fada da Feira', en('You lead today’s board.'))
    : null;
  return h('div', { class: `fs-end ${cls}-end fs-game-${o.game} fs-tier-${tier}`, id: `${prefix}-end`, 'data-tier': tier },
    h('div', { class: 'fs-end-awning', 'aria-hidden': 'true' }),
    h('div', { class: 'fs-end-body' },
      h('p', { class: 'fs-end-kicker' }, 'Feira de Vila Ipê', en('Market cart')),
      h('h2', null, o.title),
      h('p', { class: `fs-stamp fs-stamp-${tier}`, id: `${prefix}-stamp` }, stamp.stamp.pt, en(stamp.stamp.en)),
      h('p', { class: `${cls}-score fs-end-score`, id: `${prefix}-score` }, h('b', null, String(end.score)), h('span', null, 'pontos'), en('points')),
      h('ul', { class: 'fs-tally' },
        h('li', { class: 'fs-tally-served' }, h('b', null, String(end.served)), h('span', null, 'atendidos'), en('served')),
        h('li', { class: 'fs-tally-perfect' }, h('b', null, String(end.perfect)), h('span', null, 'perfeitos'), en('perfect')),
        h('li', { class: 'fs-tally-left' }, h('b', null, String(end.left)), h('span', null, 'foram embora'), en('left')),
      ),
      crowd,
      h('p', { class: 'fs-end-line' }, stamp.line.pt, en(stamp.line.en)),
      h('p', { class: `${cls}-line fs-end-line` }, end.linePt, en(end.lineEn)),
      h('div', { class: 'fs-receipt' },
        h('p', { class: `${cls}-meta fs-receipt-row fs-receipt-rv`, id: `${prefix}-meta` },
          h('span', null, 'Ganhou', en('Earned')),
          h('b', null, `${end.coins} RV`),
          end.dailyBlocked ? en('Board only — today’s paid runs are used.') : end.coins ? null : en('No RV this round'),
        ),
        h('p', { class: `${cls}-meta fs-receipt-row` }, h('span', null, 'Melhor hoje', en('Best today')), h('b', null, String(end.bestToday))),
        h('p', { class: `${cls}-meta fs-receipt-row`, id: `${prefix}-place` },
          h('span', null, 'Placar', en('Board')),
          h('b', null, end.place ? `${end.place}º` : '—'),
          end.place ? null : en('Not on the board'),
        ),
      ),
      crown,
      h('div', { class: `${cls}-end-actions fs-end-actions` },
        h('button', { type: 'button', class: 'primary', id: `${prefix}-again`, onclick: () => o.again() }, 'Jogar de novo', en('Play again')),
        h('button', { type: 'button', class: 'ghost', id: `${prefix}-close`, onclick: () => o.quit() }, 'Fechar', en('Close')),
      ),
    ),
  );
}
