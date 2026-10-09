/**
 * The Caderno de palavras spread of the Diário (HOWTO Phase 7 step 3): the words grouped by place (Padaria, Cumprimentos, Números) with
 * their PT, EN, a 🔊 that plays the word (and tells the server it was `heard`), what the player did with it (seen / heard / used), and the
 * progress of the group. Words not met yet show as "???". The group reward (+15 RV, once) arrives as the server's normal reward toast.
 * The book around it is journal.ts.
 */
import { game } from '../state';
import { h, en } from './dom';
import { speak } from '../audio';
import { noteHeard } from './heard';
import { cadernoView, spokenForm, type GroupView, type WordView } from './cadernoView';

const STATE_TITLE: Record<WordView['state'], string> = {
  unseen: 'Ainda não vista · Not met yet',
  seen: 'Vista · Seen: press 🔊 to hear it',
  heard: 'Ouvida · Heard',
  used: 'Usada · Used',
};

function wordRow(w: WordView, highlight: ReadonlySet<string>, i: number): HTMLElement {
  const listen = h(
    'button',
    {
      class: 'cad-listen speak-btn',
      'data-cad-listen': w.id,
      disabled: !w.known,
      title: w.known ? 'Ouvir / Listen' : 'Encontre esta palavra primeiro · Meet this word first',
      'aria-label': w.known ? `Ouvir ${w.form}` : 'Palavra ainda não encontrada',
      onclick: () => {
        speak(spokenForm(w.form), { force: true });
        noteHeard('', [w.id]);
      },
    },
    '🔊',
  );
  return h(
    'div',
    {
      class: `cad-word state-${w.state}${w.learned ? ' learned' : ''}${highlight.has(w.id) ? ' hl' : ''}`,
      'data-card': w.id,
      title: STATE_TITLE[w.state],
      style: `--i:${Math.min(i, 24)}`,
    },
    h('span', { class: 'cad-mark' }, w.learned ? '✓' : w.known ? '·' : ''),
    h('span', { class: 'cad-text' }, h('span', { class: `cad-pt${w.known ? '' : ' unknown'}`, lang: 'pt-BR' }, w.form), w.gloss ? h('span', { class: 'cad-en en plain' }, w.gloss) : null),
    h(
      'span',
      { class: 'cad-counts', 'aria-label': `visto ${w.seen}, ouvido ${w.heard}, usado ${w.used}` },
      h('span', { class: w.seen ? 'on' : '', title: 'Vista · Seen' }, `👁 ${w.seen}`),
      h('span', { class: w.heard ? 'on' : '', title: 'Ouvida · Heard' }, `🔊 ${w.heard}`),
      h('span', { class: w.used ? 'on' : '', title: 'Usada · Used' }, `✎ ${w.used}`),
    ),
    listen,
  );
}

function rewardLine(g: GroupView): HTMLElement {
  if (g.complete)
    return h('div', { class: 'cad-reward done' }, h('b', null, g.paid ? '✓ Completo! ' : 'Completo! '), `+${g.reward} RV`, en(g.paid ? 'Notebook group complete' : 'Group complete', true));
  return h('div', { class: 'cad-reward' }, `Aprenda todas: +${g.reward} RV`, en(`Learn them all for +${g.reward} RV, once`, true));
}

export interface CadernoSpread {
  left: HTMLElement[];
  right: HTMLElement[];
  /** The group shown (the first one when `groupId` is unknown). */
  group: string | null;
}

/**
 * The two pages of the Caderno: the groups on the left (each a bookmark with its progress), the words of `groupId` on the right.
 * `highlight` marks words (the ones a sign just taught); `onGroup` is called when a group is picked.
 */
export function cadernoSpread(groupId: string | null, highlight: ReadonlySet<string>, onGroup: (id: string) => void): CadernoSpread {
  const v = cadernoView(game.profile?.caderno, game.profile?.cadernoPaid);
  const tab = v.groups.find((g) => g.id === groupId)?.id ?? v.groups[0]?.id ?? null;
  const g = v.groups.find((x) => x.id === tab);
  const left = [
    h('div', { class: 'jb-head' }, h('p', { class: 'jb-kicker' }, 'Caderno de palavras'), h('h3', null, 'Caderno'), en('Words from signs and menus: see them, hear them, use them')),
    h('div', { class: 'cad-summary' }, `${v.learned}/${v.total} aprendidas`, en(`${v.learned} of ${v.total} words learned · ${v.met} met`, true)),
    h(
      'div',
      { class: 'cad-tabs', role: 'tablist' },
      ...v.groups.map((x) =>
        h(
          'button',
          {
            class: `cad-tab${x.id === tab ? ' on' : ''}${x.complete ? ' complete' : ''}`,
            role: 'tab',
            'aria-selected': String(x.id === tab),
            'data-cad-tab': x.id,
            onclick: () => x.id !== tab && onGroup(x.id),
          },
          h('span', { class: 'cad-tab-name' }, x.complete ? '✓ ' : '', x.label.pt),
          h('span', { class: 'cad-tab-n' }, `${x.learned}/${x.total}`),
          h('span', { class: 'cad-bar' }, h('i', { style: `width:${x.percent}%` })),
        ),
      ),
    ),
    h('div', { class: 'cad-legend' }, 'Aprendida = vista e ouvida, ou usada', en('Learned = seen and heard, or used', true)),
  ];
  const right = g
    ? [h('div', { class: 'jb-head' }, h('p', { class: 'jb-kicker' }, `${g.learned}/${g.total}`), h('h3', null, g.label.pt), en(g.label.en)), rewardLine(g), h('div', { class: 'cad-list' }, ...g.words.map((w, i) => wordRow(w, highlight, i)))]
    : [];
  return { left, right, group: tab };
}
