/**
 * The Caderno de palavras panel (HOWTO Phase 7 step 3): the words grouped by place (Padaria, Cumprimentos, Números) with their PT, EN, a 🔊
 * that plays the word (and tells the server it was `heard`), what the player did with it (seen / heard / used), and the progress of the group.
 * Words not met yet show as "???". The group reward (+15 RV, once) arrives as the server's normal reward toast.
 */
import { diaryBoard, diaryWord, FEIRA_GAME_LABEL, normalizeEscola, progressLine, wordCounts } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { openModal } from './modal';
import { speak } from '../audio';
import { ambience } from '../ambience';
import { noteHeard } from './heard';
import { cadernoView, spokenForm, type GroupView, type WordView } from './cadernoView';

/** The tab the panel was on last time (kept for the session). */
let lastTab: string | null = null;

const MEDAL_PT = { gold: 'Ouro', silver: 'Prata', bronze: 'Bronze' } as const;
const MEDAL_EN = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

/** Permanent Feira medals (written by the server when an ET day finalizes). needs_br: true */
function medalSection(): HTMLElement {
  const list = game.profile?.feiraMedals ?? [];
  return h(
    'section',
    { class: 'cad-found fg-diary', id: 'feira-medals' },
    h('h3', null, 'Medalhas da Feira', en('Market medals')),
    list.length
      ? h(
          'ul',
          null,
          ...[...list].reverse().map((a) => {
            const gameLabel = a.game in FEIRA_GAME_LABEL ? FEIRA_GAME_LABEL[a.game as keyof typeof FEIRA_GAME_LABEL] : { pt: a.game, en: a.game };
            const medal = a.medal === 'gold' || a.medal === 'silver' || a.medal === 'bronze' ? a.medal : 'bronze';
            return h(
              'li',
              { 'data-medal': a.day },
              h('i', { class: `fg-medal ${medal}`, 'aria-hidden': 'true' }, medal === 'gold' ? '1' : medal === 'silver' ? '2' : '3'),
              h('span', null, `${MEDAL_PT[medal]} · ${a.day} · ${gameLabel.pt}`, en(`${MEDAL_EN[medal]} · ${gameLabel.en}`)),
            );
          }),
        )
      : h('p', { class: 'cad-empty' }, 'Nenhuma medalha ainda.', en('No medals yet.')),
  );
}

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

/** Where "back to the airport" goes (the bus to the airport, the arrival tutorial). The page registers it. */
let replayArrival: (() => void) | null = null;
export function setArrivalReplay(fn: (() => void) | null): void {
  replayArrival = fn;
}

/** Open the panel; `groupId` picks the tab, `highlight` marks words (the ones a sign just taught). */
export function openCaderno(groupId?: string, highlight: readonly string[] = []): void {
  const marks = new Set(highlight);
  const body = h('div', { class: 'cad-body diary-spread' });
  let shownTab: string | null = null;
  const render = () => {
    const v = cadernoView(game.profile?.caderno, game.profile?.cadernoPaid);
    const tab = v.groups.find((g) => g.id === (groupId ?? lastTab))?.id ?? v.groups[0]?.id;
    const g = v.groups.find((x) => x.id === tab);
    lastTab = tab ?? null;
    const turned = shownTab !== null && shownTab !== tab;
    shownTab = tab ?? null;
    const scroll = turned ? 0 : (body.querySelector('.cad-list')?.scrollTop ?? 0);
    const found = diaryBoard(game.profile?.diary);
    const escola = normalizeEscola(game.profile?.escola, game.profile?.diary);
    const counts = wordCounts(escola, game.profile?.diary, Date.now());
    const photos = game.photos;
    const left = h(
      'div',
      { class: 'diary-page page-left' },
      h(
        'section',
        { class: 'cad-found' },
        h('h3', null, 'Palavras encontradas'),
        en('How many words you found in each place, by camera, reading, conversation, and game.'),
        h(
          'p',
          { class: 'cad-mastery', id: 'cad-mastery' },
          `${counts.mastered} dominadas · ${counts.learned} aprendidas · ${counts.toFind} pra descobrir`,
          en(`${counts.mastered} mastered in the Escola · ${counts.learned} learned · ${counts.toFind} still to find`),
        ),
        ...found.map((area) =>
          h(
            'div',
            { class: 'cad-area', 'data-area': area.id },
            h('p', { class: 'cad-area-name' }, area.pt, en(area.en)),
            h('p', { class: 'cad-area-progress', 'data-progress': area.id }, progressLine(area)),
            h('p', { class: 'cad-area-mastery' }, `${wordCounts(escola, game.profile?.diary, Date.now(), area.id).mastered} dominadas`),
            area.id === 'chegada' && replayArrival
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'ghost cad-replay',
                    'data-replay': 'arrival',
                    onclick: () => {
                      close();
                      replayArrival?.();
                    },
                  },
                  // needs_br: true (button label)
                  bi('Voltar ao aeroporto', 'Back to the airport'),
                )
              : null,
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
              ...photos.map((photo, i) =>
                h(
                  'figure',
                  { class: 'cad-print', style: `--r:${((i * 53) % 9) - 4}deg` },
                  h('i', { class: 'tape', 'aria-hidden': 'true' }),
                  h('img', { class: 'cad-photo', src: photo.image, alt: photo.wordId ?? 'foto' }),
                  photo.wordId ? h('figcaption', { lang: 'pt-BR' }, diaryWord(photo.wordId)?.pt ?? '') : null,
                ),
              ),
            )
          : h('p', { class: 'cad-empty' }, 'Nenhuma foto ainda.', en('No photos yet.')),
      ),
      medalSection(),
    );
    const right = h(
      'div',
      { class: 'diary-page page-right' },
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
                if (x.id === tab) return;
                groupId = x.id;
                ambience.sfx('page');
                render();
              },
            },
            h('span', { class: 'cad-tab-name' }, x.complete ? '✓ ' : '', x.label.pt),
            h('span', { class: 'cad-tab-n' }, `${x.learned}/${x.total}`),
            h('span', { class: 'cad-bar' }, h('i', { style: `width:${x.percent}%` })),
          ),
        ),
      ),
      ...(g ? [h('div', { class: `cad-group${turned ? ' turn' : ''}` }, rewardLine(g), h('div', { class: 'cad-list' }, ...g.words.map((w) => wordRow(w, marks))))] : []),
      h('div', { class: 'cad-legend' }, 'Aprendida = vista e ouvida, ou usada', en('Learned = seen and heard, or used', true)),
    );
    body.replaceChildren(left, h('i', { class: 'diary-gutter', 'aria-hidden': 'true' }), right);
    const list = body.querySelector('.cad-list');
    if (list) list.scrollTop = scroll;
  };
  render();
  const off = game.on('profile', render);
  const panel = h(
    'div',
    { class: 'panel caderno diary-book' },
    h('i', { class: 'diary-cover', 'aria-hidden': 'true' }, h('span', null, 'Diário')),
    h('i', { class: 'diary-ribbon', 'aria-hidden': 'true' }),
    h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
    h('h2', null, 'Diário'),
    en('Your diary · words you meet, and how you found them'),
    body,
    h('div', { class: 'cad-foot' }, h('button', { class: 'ghost', onclick: () => close() }, bi('Fechar', 'Close'))),
  );
  const close = openModal('caderno', panel, { onClose: off });
  ambience.sfx('page');
}
