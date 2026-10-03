/**
 * The Caderno de palavras panel (HOWTO Phase 7 step 3): the words grouped by place (Padaria, Cumprimentos, Números) with their PT, EN, a 🔊
 * that plays the word (and tells the server it was `heard`), what the player did with it (seen / heard / used), and the progress of the group.
 * Words not met yet show as "???". The group reward (+15 RV, once) arrives as the server's normal reward toast.
 */
import { diaryBoard, progressLine } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { openModal } from './modal';
import { speak } from '../audio';
import { noteHeard } from './heard';
import { cadernoView, spokenForm, type GroupView, type WordView } from './cadernoView';

/** The tab the panel was on last time (kept for the session). */
let lastTab: string | null = null;

const STATE_TITLE: Record<WordView['state'], string> = {
  unseen: 'Ainda não vista · Not met yet',
  seen: 'Vista · Seen: press 🔊 to hear it',
  heard: 'Ouvida · Heard',
  used: 'Usada · Used',
};

function wordRow(w: WordView, highlight: ReadonlySet<string>): HTMLElement {
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
    { class: `cad-word state-${w.state}${w.learned ? ' learned' : ''}${highlight.has(w.id) ? ' hl' : ''}`, 'data-card': w.id, title: STATE_TITLE[w.state] },
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

/** Open the panel; `groupId` picks the tab, `highlight` marks words (the ones a sign just taught). */
export function openCaderno(groupId?: string, highlight: readonly string[] = []): void {
  const marks = new Set(highlight);
  const body = h('div', { class: 'cad-body' });
  const render = () => {
    const v = cadernoView(game.profile?.caderno, game.profile?.cadernoPaid);
    const tab = v.groups.find((g) => g.id === (groupId ?? lastTab))?.id ?? v.groups[0]?.id;
    const g = v.groups.find((x) => x.id === tab);
    lastTab = tab ?? null;
    const scroll = body.querySelector('.cad-list')?.scrollTop ?? 0;
    const found = diaryBoard(game.profile?.diary);
    const photos = game.profile?.photos ?? [];
    body.replaceChildren(
      h(
        'section',
        { class: 'cad-found' },
        h('h3', null, 'Palavras encontradas'),
        en('How many words you found in each place, by camera, reading, conversation, and game.'),
        ...found.map((area) =>
          h(
            'div',
            { class: 'cad-area', 'data-area': area.id },
            h('p', { class: 'cad-area-name' }, area.pt, en(area.en)),
            h('p', { class: 'cad-area-progress', 'data-progress': area.id }, progressLine(area)),
            area.words.length
              ? h(
                  'ul',
                  null,
                  ...area.words.map((w) => h('li', { 'data-word': w.id }, h('b', null, w.pt), en(w.en), w.seed ? h('span', { class: 'diary-seed' }, 'amostra') : null)),
                )
              : null,
          ),
        ),
      ),
      h(
        'section',
        { class: 'cad-gallery' },
        h('h3', null, 'Fotos', en('Gallery')),
        h('p', { class: 'cad-film' }, `Filme: ${game.profile?.film ?? 0}`, en('Shots left')),
        photos.length
          ? h(
              'div',
              { class: 'cad-photos' },
              ...photos.map((photo) => h('img', { class: 'cad-photo', src: photo.image, alt: photo.wordId ?? 'foto' })),
            )
          : h('p', { class: 'cad-empty' }, 'Nenhuma foto ainda.', en('No photos yet.')),
      ),
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
              onclick: () => {
                groupId = x.id;
                render();
              },
            },
            h('span', { class: 'cad-tab-name' }, x.complete ? '✓ ' : '', x.label.pt),
            h('span', { class: 'cad-tab-n' }, `${x.learned}/${x.total}`),
            h('span', { class: 'cad-bar' }, h('i', { style: `width:${x.percent}%` })),
          ),
        ),
      ),
      ...(g ? [h('div', { class: 'cad-group' }, rewardLine(g), h('div', { class: 'cad-list' }, ...g.words.map((w) => wordRow(w, marks))))] : []),
      h('div', { class: 'cad-legend' }, 'Aprendida = vista e ouvida, ou usada', en('Learned = seen and heard, or used', true)),
    );
    const list = body.querySelector('.cad-list');
    if (list) list.scrollTop = scroll;
  };
  render();
  const off = game.on('profile', render);
  const close = openModal(
    'caderno',
    h(
      'div',
      { class: 'panel caderno' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, 'Diário'),
      en('Your diary · words you meet, and how you found them'),
      body,
      h('div', { class: 'cad-foot' }, h('button', { class: 'ghost', onclick: () => close() }, bi('Fechar', 'Close'))),
    ),
    { onClose: off },
  );
}
