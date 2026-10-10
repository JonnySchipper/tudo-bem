/**
 * The Diário: the player's words as an álbum de figurinhas in a leather book. The cover swings open on the Início (how many words, how
 * well they are known, the new stickers since the last visit, every chapter's progress); an index tab per place opens its chapter, where
 * every catalog word has a numbered slot: a sticker once earned (tap it for its card: the word spoken, how it was found, the line it was
 * heard in, its photo, its Escola box), an empty slot that says how to find it until then (the next few per chapter). Fotos has its own
 * tab. Moving between tabs turns a real page (the old page lifts off and lands on the other side); the new stickers since the last visit
 * are slapped in. Reduced motion keeps every page and card, without the travel. A chapter's tab waits for its first word, and the parts
 * of a big diary (the Início stats, the chapter sorts and filters) wait until there is enough to sort (journalView.ts says when).
 *
 * The view-model is journalView.ts (pure, tested); the art is journalArt.ts.
 */
import { FEIRA_GAME_LABEL, ESCOLA_MAX_BOX, diaryWord, normalizeDiary, photoWordIds } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi } from './dom';
import { openModal } from './modal';
import { speak } from '../audio';
import { ambience } from '../ambience';
import { npcPortrait } from './pixelArt';
import { emblemIcon, sourceIcon, tabIcon } from './journalArt';
import {
  DEFAULT_FILTER,
  MASTERY_LABEL,
  SOURCE_LABEL,
  chapterFilter,
  chapterTools,
  filterWords,
  journalModel,
  journalShows,
  markWord,
  searchAll,
  seenOnFirstVisit,
  shownChapters,
  type JournalChapter,
  type JournalFilter,
  type JournalModel,
  type JournalSort,
  type JournalWord,
  type SourceFilter,
} from './journalView';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const narrow = () => window.matchMedia?.('(max-width: 760px)').matches ?? false;
const pad = (n: number) => String(n).padStart(3, '0');

// ---------------------------------------------------------------- what the player has already seen (per browser)

const SEEN_KEY = () => `tb_diario_visto:${game.profile?.id ?? 'guest'}`;

function storedSeen(): number | null {
  try {
    const v = localStorage.getItem(SEEN_KEY());
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function storeSeen(n: number) {
  try {
    localStorage.setItem(SEEN_KEY(), String(n));
  } catch {
    /* private mode: every visit starts from what the page remembers */
  }
}

const earnedCount = () => normalizeDiary(game.profile?.diary).length;

/** Diary words seen when the Diário was last opened; the first look on this browser anchors it (a big diary is not all "new"). */
function seenCount(): number {
  const n = earnedCount();
  const s = storedSeen();
  if (s != null) return Math.min(s, n);
  const first = seenOnFirstVisit(n);
  if (game.profile) storeSeen(first);
  return first;
}

/** The count of new words on the Diário button (words earned since it was last opened). The page calls it on every profile. */
export function syncJournalBadge(): void {
  if (!game.profile) return;
  const n = Math.max(0, earnedCount() - seenCount());
  const text = n > 99 ? '99+' : String(n);
  // the Diário button, and on a phone the menu button it sits behind (a dot there, the number on the Diário)
  for (const id of ['btn-caderno', 'btn-burger']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    let dot = btn.querySelector<HTMLElement>('.jb-badge');
    if (!n) {
      dot?.remove();
      continue;
    }
    if (!dot) {
      dot = h('span', { class: `jb-badge${id === 'btn-burger' ? ' dot' : ''}`, 'aria-hidden': 'true' });
      btn.append(dot);
    }
    const label = id === 'btn-burger' ? '' : text;
    if (dot.dataset.n !== text) {
      dot.dataset.n = text;
      dot.textContent = label;
      dot.classList.remove('pop');
      void dot.offsetWidth;
      dot.classList.add('pop');
    }
  }
}

// ---------------------------------------------------------------- session memory

/** Where "back to the airport" goes (the bus to the airport, the arrival tutorial). The page registers it. */
let replayArrival: (() => void) | null = null;
export function setArrivalReplay(fn: (() => void) | null): void {
  replayArrival = fn;
}

/** The chapter filters, kept for the session. */
const filters = new Map<string, JournalFilter>();

// ---------------------------------------------------------------- small animated pieces

/** A number that counts up to `to`. */
function countUp(el: HTMLElement, to: number, ms = 900, delay = 0) {
  el.dataset.to = String(to);
  if (reduceMotion() || to <= 0) {
    el.textContent = String(to);
    return;
  }
  el.textContent = '0';
  const start = performance.now() + delay;
  const step = (t: number) => {
    if (!el.isConnected && t - start > 50) return;
    const k = Math.min(1, Math.max(0, (t - start) / ms));
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** A progress ring (SVG) filled to `pct` (0..100); CSS draws it in. */
function ring(pct: number, cls: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const C = 2 * Math.PI * 52;
  const track = document.createElementNS(ns, 'circle');
  const fill = document.createElementNS(ns, 'circle');
  for (const c of [track, fill]) {
    c.setAttribute('cx', '60');
    c.setAttribute('cy', '60');
    c.setAttribute('r', '52');
  }
  track.setAttribute('class', 'ring-track');
  fill.setAttribute('class', 'ring-fill');
  fill.style.setProperty('--C', String(C));
  fill.style.setProperty('--off', String(C * (1 - Math.min(100, Math.max(0, pct)) / 100)));
  svg.append(track, fill);
  return svg;
}

const pips = (box: number, cls = 'stk-pips') =>
  h('span', { class: cls, 'aria-hidden': 'true' }, ...Array.from({ length: ESCOLA_MAX_BOX }, (_, i) => h('i', { class: i < box ? 'on' : '' })));

const lenClass = (pt: string) => (pt.length <= 7 ? 'l1' : pt.length <= 11 ? 'l2' : pt.length <= 15 ? 'l3' : 'l4');

const chapterVars = (c: { color: string; ink: string }) => `--c:${c.color};--ci:${c.ink}`;

/** Medals the Feira gave (written by the server when an ET day finalizes). needs_br: true */
const MEDAL_PT = { gold: 'Ouro', silver: 'Prata', bronze: 'Bronze' } as const;
const MEDAL_EN = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

function medalSection(): HTMLElement {
  const list = game.profile?.feiraMedals ?? [];
  return h(
    'section',
    { class: 'jb-medals fg-diary', id: 'feira-medals' },
    h('h4', null, 'Medalhas da Feira', en('Market medals')),
    list.length
      ? h(
          'ul',
          null,
          ...[...list].reverse().map((a, i) => {
            const label = a.game in FEIRA_GAME_LABEL ? FEIRA_GAME_LABEL[a.game as keyof typeof FEIRA_GAME_LABEL] : { pt: a.game, en: a.game };
            const medal = a.medal === 'gold' || a.medal === 'silver' || a.medal === 'bronze' ? a.medal : 'bronze';
            return h(
              'li',
              { 'data-medal': a.day, style: `--i:${i}` },
              h('i', { class: `fg-medal ${medal}`, 'aria-hidden': 'true' }, medal === 'gold' ? '1' : medal === 'silver' ? '2' : '3'),
              h('span', null, `${MEDAL_PT[medal]} · ${label.pt}`, en(`${MEDAL_EN[medal]} · ${label.en} · ${a.day}`)),
            );
          }),
        )
      : h('p', { class: 'jb-empty' }, 'Nenhuma medalha ainda.', en('No medals yet.')),
  );
}

// ---------------------------------------------------------------- the book

export interface DiarioOpen {
  /** 'inicio', an area id (a chapter with at least one word) or 'fotos'. */
  section?: string;
}

type Snapshot = { left: HTMLElement; right: HTMLElement; lt: number; rt: number };

/** Open the Diário. */
export function openDiario(opts: DiarioOpen = {}): void {
  const seenAtOpen = seenCount();
  storeSeen(earnedCount());
  syncJournalBadge();
  /** Fresh stickers already slapped in during this visit, per page (`<section>:<word>`): a re-render does not slap them again. */
  const slapped = new Set<string>();
  const build = (): JournalModel =>
    journalModel({ diary: game.profile?.diary, escola: game.profile?.escola, photos: game.photos, seen: seenAtOpen, now: Date.now(), tz: -new Date().getTimezoneOffset() });
  let model = build();
  const order = () => ['inicio', ...shownChapters(model).map((c) => c.id), 'fotos'];
  let section = opts.section && order().includes(opts.section) ? opts.section : 'inicio';
  let homeQuery = '';

  const left = h('div', { class: 'jb-page jb-left' });
  const right = h('div', { class: 'jb-page jb-right' });
  const spread = h('div', { class: 'jb-spread' }, left, h('i', { class: 'jb-spine', 'aria-hidden': 'true' }), right);
  const tabs = h('nav', { class: 'jb-tabs', role: 'tablist', 'aria-label': 'Capítulos · Chapters' });
  const detailHost = h('div', { class: 'jb-detail-host' });

  // ---------------------------------------------------------------- stickers

  const chapterOf = (w: JournalWord) => model.chapters.find((c) => c.id === w.area) ?? model.chapters[0]!;

  function sticker(w: JournalWord, i: number, list: () => JournalWord[], mini = false): HTMLElement {
    const c = chapterOf(w);
    const slap = w.fresh && !slapped.has(`${section}:${w.id}`);
    const cls = ['jb-stk', w.earned ? 'got' : 'gap', `src-${w.source}`, `m-${w.mastery}`, slap ? 'slap' : '', w.fresh ? 'fresh' : '', w.due ? 'due' : '', w.photo ? 'has-pic' : '', mini ? 'mini' : '']
      .filter(Boolean)
      .join(' ');
    const el = h(
      'button',
      {
        type: 'button',
        class: cls,
        'data-word': w.id,
        style: `${chapterVars(c)};--i:${Math.min(i, 40)}`,
        'aria-label': w.earned ? `${w.pt}: ${w.en}` : `Nº ${w.no}: ainda não encontrada · not found yet`,
        title: w.earned ? `${w.pt} · ${w.en}` : `${w.how.pt} · ${w.how.en}`,
        onclick: () => {
          const l = list();
          openDetail(l, Math.max(0, l.findIndex((x) => x.id === w.id)), el);
        },
      },
      ...(w.earned
        ? [
            h('span', { class: 'stk-no' }, pad(w.no)),
            h('span', { class: 'stk-src' }, sourceIcon(w.source)),
            w.photo ? h('span', { class: 'stk-pic' }, h('img', { src: w.photo, alt: '', draggable: false })) : null,
            h('b', { class: `stk-pt ${lenClass(w.pt)}`, lang: 'pt-BR' }, w.pt),
            h('span', { class: 'stk-en' }, w.en),
            pips(w.box),
            w.mastery === 'dominada' ? h('i', { class: 'stk-foil', 'aria-hidden': 'true' }) : null,
            w.fresh ? h('span', { class: 'stk-new' }, 'Nova!') : null,
          ]
        : [h('span', { class: 'stk-no' }, pad(w.no)), h('span', { class: 'stk-src' }, sourceIcon(w.source)), h('span', { class: 'stk-hint' }, SOURCE_LABEL[w.source].pt)]),
    );
    return el;
  }

  /** After the stickers are on the page: the fresh ones count as slapped, with a thump for the first few. */
  function slapSounds(host: HTMLElement) {
    const els = [...host.querySelectorAll<HTMLElement>('.jb-stk.slap')];
    els.forEach((el) => slapped.add(`${section}:${el.dataset.word ?? ''}`));
    if (!els.length || reduceMotion()) return;
    els.slice(0, 4).forEach((el, k) => {
      const i = Number(el.style.getPropertyValue('--i')) || 0;
      window.setTimeout(() => el.isConnected && ambience.sfx('stamp'), 260 + Math.min(i, 40) * 22 + k * 40);
    });
  }

  // ---------------------------------------------------------------- the spreads

  function homeSpread(): [HTMLElement[], HTMLElement[]] {
    const m = model;
    const pct = m.total ? Math.round((m.earned / m.total) * 100) : 0;
    const total = h('b', { class: 'jb-big', id: 'jb-earned' }, String(m.earned));
    countUp(total, m.earned, 1100, 350);
    const regular = journalShows(game.profile);
    const tiers = (['dominada', 'quase', 'aprendendo', 'nova'] as const).map((k) => ({ k, n: m.chapters.reduce((s, c) => s + c.words.filter((w) => w.earned && w.mastery === k).length, 0) }));
    const leftPage = [
      h('div', { class: 'jb-owner' }, h('p', { class: 'jb-kicker' }, 'Diário de'), h('p', { class: 'jb-name' }, game.profile?.name ?? '—'), h('p', { class: 'jb-stamp', 'aria-hidden': 'true' }, 'VILA IPÊ · SP')),
      h(
        'div',
        { class: 'jb-hero' },
        h('div', { class: 'jb-ring-wrap' }, ring(pct, 'jb-ring'), h('div', { class: 'jb-ring-n' }, total, h('span', null, `de ${m.total}`))),
        h('div', { class: 'jb-hero-cap' }, h('p', null, h('b', null, 'palavras'), ' no seu diário'), en(`${m.earned} of ${m.total} words found · ${pct}%`)),
      ),
      ...(regular
        ? [
            h(
              'div',
              { class: 'jb-mastery', id: 'cad-mastery' },
              h('div', { class: 'jb-mbar', role: 'img', 'aria-label': tiers.map((t) => `${MASTERY_LABEL[t.k].pt} ${t.n}`).join(', ') }, ...tiers.map((t) => h('i', { class: `mb-${t.k}`, style: `--w:${m.earned ? (t.n / m.earned) * 100 : 0}%` }))),
              h(
                'ul',
                { class: 'jb-mlegend' },
                ...tiers.map((t) => h('li', { class: `ml-${t.k}` }, h('i', { 'aria-hidden': 'true' }), h('b', null, String(t.n)), ` ${MASTERY_LABEL[t.k].pt}`, en(MASTERY_LABEL[t.k].en))),
              ),
            ),
            h(
              'div',
              { class: 'jb-stats' },
              h('div', { class: 'jb-stat streak' }, h('b', null, String(m.streak)), h('span', null, m.streak === 1 ? 'dia seguido' : 'dias seguidos'), en(`day streak · best ${m.best}`)),
              h('div', { class: `jb-stat due${m.due ? ' on' : ''}` }, h('b', null, String(m.due)), h('span', null, 'pra revisar'), en('due in the Escola')),
              h('div', { class: 'jb-stat xp' }, h('b', null, String(m.xp)), h('span', null, 'XP'), en('Escola points')),
            ),
            medalSection(),
          ]
        : []),
    ];
    const results = h('div', { class: 'jb-results' });
    const search = h('input', {
      type: 'search',
      class: 'jb-search',
      id: 'jb-search-all',
      placeholder: 'Procurar no diário…',
      'aria-label': 'Procurar palavra · Search your words',
      value: homeQuery,
      autocomplete: 'off',
      spellcheck: false,
      oninput: () => {
        homeQuery = search.value;
        fillResults();
      },
    });
    const chapters = shownChapters(m);
    const chaptersList = h(
      'ol',
      { class: 'jb-chapters' },
      ...chapters.map((c, i) =>
        h(
          'li',
          { style: `--i:${i}` },
          h(
            'button',
            { type: 'button', class: `jb-chap${c.complete ? ' complete' : ''}`, 'data-jb-chapter': c.id, style: chapterVars(c), onclick: () => go(c.id) },
            h('span', { class: 'jb-chap-emb' }, emblemIcon(c.emblem)),
            h('span', { class: 'jb-chap-name' }, h('b', null, c.pt), en(c.en)),
            h('span', { class: 'jb-chap-bar' }, h('i', { style: `--w:${c.percent}%` })),
            h('span', { class: 'jb-chap-n' }, `${c.earned}/${c.total}`),
            c.mastered ? h('span', { class: 'jb-chap-star', title: `${c.mastered} dominadas` }, `★${c.mastered}`) : null,
            c.fresh ? h('span', { class: 'jb-chap-new' }, `+${c.fresh}`) : null,
            c.complete ? h('span', { class: 'jb-seal', 'aria-label': 'Completo' }, '✓') : null,
          ),
        ),
      ),
    );
    const fresh = m.fresh;
    const shelf = fresh.length ? fresh.slice(-10).reverse() : m.recent;
    const shelfList = () => shelf;
    const shelfSection = shelf.length
      ? h(
          'section',
          { class: `jb-shelf${fresh.length ? ' is-new' : ''}` },
          h('h4', null, fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'figurinha nova' : 'figurinhas novas'}!` : 'Últimas palavras', en(fresh.length ? 'New since your last visit' : 'Your latest words')),
          h('div', { class: 'jb-shelf-row' }, ...shelf.map((w, i) => sticker(w, i, shelfList, true))),
        )
      : h('section', { class: 'jb-shelf empty' }, h('p', { class: 'jb-empty' }, 'Seu diário está esperando a primeira palavra.', en('Your diary is waiting for its first word: take a photo, read a sign, talk to someone.')));
    const browse = h('div', { class: 'jb-browse' }, shelfSection, ...(chapters.length ? [h('h4', { class: 'jb-chapters-h' }, 'Capítulos', en('Chapters')), chaptersList] : []));
    const fillResults = () => {
      const q = homeQuery.trim();
      browse.hidden = !!q;
      results.hidden = !q;
      if (!q) return results.replaceChildren();
      const found = searchAll(model, q);
      results.replaceChildren(
        h('p', { class: 'jb-count-line' }, found.length ? `${found.length} ${found.length === 1 ? 'palavra' : 'palavras'}` : 'Nenhuma palavra encontrada', en(found.length ? 'found in your diary' : 'Nothing in your diary matches')),
        h('div', { class: 'jb-grid' }, ...found.slice(0, 120).map((w, i) => sticker(w, i, () => found, true))),
      );
    };
    fillResults();
    const rightPage = [h('div', { class: 'jb-searchbar' }, search), results, browse];
    return [leftPage, rightPage];
  }

  function chapterSpread(c: JournalChapter, grid: HTMLElement, counter: HTMLElement): [(HTMLElement | null)[], HTMLElement[]] {
    const f = chapterFilter(c, filters.get(c.id) ?? DEFAULT_FILTER);
    const tools = chapterTools(c);
    const set = (patch: Partial<JournalFilter>) => {
      filters.set(c.id, { ...(filters.get(c.id) ?? DEFAULT_FILTER), ...patch });
      refresh();
    };
    const pct = c.percent;
    const n = h('b', { class: 'jb-big' }, String(c.earned));
    countUp(n, c.earned, 800, 300);
    const srcBtn = (source: SourceFilter, label: string, gloss: string, earned: number, total: number) =>
      h(
        'button',
        {
          type: 'button',
          class: `jb-src${f.source === source ? ' on' : ''}`,
          'data-jb-source': source,
          'aria-pressed': String(f.source === source),
          onclick: () => set({ source: f.source === source && source !== 'all' ? 'all' : source }),
        },
        source === 'all' ? h('span', { class: 'jb-src-all', 'aria-hidden': 'true' }, '∗') : sourceIcon(source),
        h('span', { class: 'jb-src-name' }, label, en(gloss)),
        h('span', { class: 'jb-src-bar' }, h('i', { style: `--w:${total ? (earned / total) * 100 : 0}%` })),
        h('span', { class: 'jb-src-n' }, `${earned}/${total}`),
      );
    const sorts: [JournalSort, string, string][] = [
      ['album', 'Álbum', 'Album order'],
      ['recent', 'Recentes', 'Newest'],
      ['az', 'A–Z', 'A to Z'],
      ['mastery', 'Domínio', 'Best known'],
    ];
    const q = h('input', {
      type: 'search',
      class: 'jb-search',
      placeholder: `Procurar em ${c.pt}…`,
      'aria-label': `Procurar em ${c.pt} · Search ${c.en}`,
      value: f.query,
      autocomplete: 'off',
      spellcheck: false,
      oninput: () => {
        filters.set(c.id, { ...(filters.get(c.id) ?? DEFAULT_FILTER), query: q.value });
        fillGrid(false);
      },
    });
    const leftPage = [
      h(
        'div',
        { class: 'jb-chap-head', style: chapterVars(c) },
        h('span', { class: 'jb-chap-badge' }, emblemIcon(c.emblem)),
        h('div', null, h('p', { class: 'jb-kicker' }, `Capítulo ${model.chapters.indexOf(c) + 1}`), h('h3', null, c.pt), en(c.en)),
        c.complete ? h('span', { class: 'jb-complete', 'aria-label': 'Completo' }, 'COMPLETO!') : null,
      ),
      h(
        'div',
        { class: 'jb-chap-progress', style: chapterVars(c) },
        h('div', { class: 'jb-chap-count' }, n, h('span', null, `/${c.total}`)),
        h('div', { class: 'jb-chap-meter' }, h('span', { class: 'jb-meter' }, h('i', { style: `--w:${pct}%` })), h('p', null, `${pct}% · ★ ${c.mastered} dominadas`, en(`${pct}% found · ${c.mastered} mastered`))),
      ),
      tools
        ? h(
            'div',
            { class: 'jb-sources', role: 'group', 'aria-label': 'Como encontrar · How words are found' },
            srcBtn('all', 'Todas', 'All', c.earned, c.total),
            ...c.sources.map((s) => srcBtn(s.source, SOURCE_LABEL[s.source].pt, SOURCE_LABEL[s.source].en, s.earned, s.total)),
          )
        : null,
      tools
        ? h(
            'div',
            { class: 'jb-sorts', role: 'group', 'aria-label': 'Ordem · Order' },
            ...sorts.map(([k, pt, g]) => h('button', { type: 'button', class: `jb-sort${f.sort === k ? ' on' : ''}`, 'data-jb-sort': k, 'aria-pressed': String(f.sort === k), title: g, onclick: () => set({ sort: k }) }, pt)),
          )
        : null,
      tools
        ? h(
            'label',
            { class: `jb-toggle${f.sort !== 'album' ? ' off' : ''}` },
            h('input', { type: 'checkbox', checked: f.missing, 'data-jb-missing': '1', onchange: (e: Event) => set({ missing: (e.target as HTMLInputElement).checked }) }),
            h('span', null, 'Mostrar o que falta'),
            en('Show the empty slots'),
          )
        : null,
      c.id === 'chegada' && replayArrival
        ? h(
            'button',
            {
              type: 'button',
              class: 'ghost cad-replay jb-replay',
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
    ];
    const rightPage = [h('div', { class: 'jb-searchbar' }, q, counter), grid];
    return [leftPage, rightPage];
  }

  function photosSpread(): [HTMLElement[], HTMLElement[]] {
    const photos = game.photos;
    const film = game.profile?.film ?? 0;
    const print = (p: (typeof photos)[number], i: number) => {
      // every word the shot taught, under the one print
      const words = photoWordIds(p)
        .map((id) => diaryWord(id)?.pt)
        .filter((pt): pt is string => !!pt);
      return h(
        'button',
        {
          type: 'button',
          class: 'jb-print',
          style: `--r:${((i * 53) % 9) - 4}deg;--i:${i}`,
          'data-photo': p.id,
          'aria-label': words.length ? `Foto: ${words.join(', ')}` : 'Foto',
          onclick: (e: Event) => openPhoto(p, e.currentTarget as HTMLElement),
        },
        h('i', { class: 'tape', 'aria-hidden': 'true' }),
        h('img', { class: 'jb-photo', src: p.image, alt: '', draggable: false }),
        h('span', { class: 'jb-print-cap', lang: 'pt-BR' }, words.length ? words.join(' · ') : ' '),
      );
    };
    const half = Math.ceil(photos.length / 2);
    const head = h(
      'div',
      { class: 'jb-head' },
      h('p', { class: 'jb-kicker' }, `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`),
      h('h3', null, 'Fotos'),
      en('Your photos of Vila Ipê, newest first'),
      h('p', { class: 'jb-film' }, h('b', null, String(film)), film === 1 ? ' filme' : ' filmes', en('shots left · Júlia sells film')),
    );
    if (!photos.length)
      return [
        [head, h('div', { class: 'jb-nophoto' }, sourceIcon('camera', 'jb-nophoto-ico'), h('p', null, 'Nenhuma foto ainda.'), en('No photos yet: open the camera and click something in the world. A new object is a new word.'))],
        [h('div', { class: 'jb-wall empty', 'aria-hidden': 'true' }, ...Array.from({ length: 4 }, (_, i) => h('i', { class: 'jb-print ghost', style: `--r:${((i * 53) % 9) - 4}deg` })))],
      ];
    return [
      [head, h('div', { class: 'jb-wall' }, ...photos.slice(0, half).map(print))],
      [h('div', { class: 'jb-wall' }, ...photos.slice(half).map((p, i) => print(p, i + half)))],
    ];
  }

  // ---------------------------------------------------------------- the chapter grid (refilled on filter changes, without a page turn)

  let grid: HTMLElement | null = null;
  let counter: HTMLElement | null = null;
  let gridList: JournalWord[] = [];

  function fillGrid(enter: boolean) {
    const c = model.chapters.find((x) => x.id === section);
    if (!c || !grid || !counter) return;
    const f = chapterFilter(c, filters.get(c.id) ?? DEFAULT_FILTER);
    gridList = filterWords(c.words, f);
    const shown = gridList;
    const earnedShown = shown.filter((w) => w.earned).length;
    const src = f.source === 'all' ? null : c.sources.find((s) => s.source === f.source);
    counter.replaceChildren(
      ...(f.query.trim()
        ? [`${earnedShown} ${earnedShown === 1 ? 'palavra' : 'palavras'}`, en('match your search')]
        : src
          ? [`${src.earned} de ${src.total}`, en(`${SOURCE_LABEL[src.source].en} words found`)]
          : [`${c.earned} de ${c.total}`, en('words found')]),
    );
    grid.classList.toggle('enter', enter && !reduceMotion());
    grid.replaceChildren(
      ...(shown.length
        ? shown.map((w, i) => sticker(w, i, () => gridList))
        : [h('p', { class: 'jb-empty jb-grid-empty' }, f.query.trim() ? 'Nenhuma palavra com isso.' : 'Nada aqui ainda.', en(f.query.trim() ? 'No word in this chapter matches.' : 'Nothing here yet: go and find some!'))]),
    );
    slapSounds(grid);
  }

  // ---------------------------------------------------------------- drawing a spread

  function draw(enter: boolean) {
    const lt = left.scrollTop;
    const rt = right.scrollTop;
    let pages: [(HTMLElement | null)[], HTMLElement[]];
    grid = counter = null;
    const chapter = model.chapters.find((c) => c.id === section);
    spread.dataset.section = chapter ? 'chapter' : section;
    spread.setAttribute('style', chapter ? chapterVars(chapter) : '');
    if (section === 'inicio') pages = homeSpread();
    else if (section === 'fotos') pages = photosSpread();
    else if (chapter) {
      grid = h('div', { class: 'jb-grid' });
      counter = h('p', { class: 'jb-count-line' });
      pages = chapterSpread(chapter, grid, counter);
    } else {
      section = 'inicio';
      pages = homeSpread();
    }
    left.replaceChildren(...pages[0].filter((x): x is HTMLElement => !!x));
    right.replaceChildren(...pages[1]);
    if (grid) fillGrid(enter);
    else slapSounds(right);
    spread.classList.toggle('enter', enter && !reduceMotion());
    if (enter) {
      left.scrollTop = 0;
      right.scrollTop = 0;
    } else {
      left.scrollTop = lt;
      right.scrollTop = rt;
    }
  }

  function drawTabs() {
    const tab = (id: string, label: string, gloss: string, art: SVGSVGElement, extra: { style?: string; fresh?: number; complete?: boolean; pct?: number } = {}) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: `jb-tab${id === section ? ' on' : ''}${extra.complete ? ' complete' : ''}`,
          'data-journal-tab': id,
          'aria-selected': String(id === section),
          title: `${label} · ${gloss}`,
          style: extra.style ?? '',
          onclick: () => go(id),
        },
        h('span', { class: 'jb-tab-ico' }, art),
        h('span', { class: 'jb-tab-label' }, label),
        extra.pct != null ? h('span', { class: 'jb-tab-bar', 'aria-hidden': 'true' }, h('i', { style: `--w:${extra.pct}%` })) : null,
        extra.fresh ? h('span', { class: 'jb-tab-new', 'aria-label': `${extra.fresh} novas` }, String(extra.fresh)) : null,
      );
    tabs.replaceChildren(
      tab('inicio', 'Início', 'Overview', tabIcon('inicio'), { fresh: model.fresh.length }),
      ...shownChapters(model).map((c) => tab(c.id, c.pt, c.en, emblemIcon(c.emblem), { style: chapterVars(c), fresh: c.fresh, complete: c.complete, pct: c.percent })),
      tab('fotos', 'Fotos', 'Photos', tabIcon('fotos'), { style: '--c:#5b6b7f;--ci:#2a3442' }),
    );
    tabs.querySelector<HTMLElement>('.jb-tab.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  // ---------------------------------------------------------------- turning a page

  function snapshot(): Snapshot {
    const strip = (el: HTMLElement) => {
      const c = el.cloneNode(true) as HTMLElement;
      c.removeAttribute('id');
      c.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
      c.querySelectorAll('.slap, .enter').forEach((x) => x.classList.remove('slap', 'enter'));
      // a number still counting up shows where it ends
      c.querySelectorAll<HTMLElement>('[data-to]').forEach((x) => (x.textContent = x.dataset.to ?? x.textContent));
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('inert', '');
      return c;
    };
    return { left: strip(left), right: strip(right), lt: left.scrollTop, rt: right.scrollTop };
  }

  /** The old page lifts off and turns over the spine onto the other side, showing the new page on its back. */
  function pageTurn(dir: 1 | -1, snap: Snapshot) {
    spread.querySelectorAll('.jb-leaf, .jb-under').forEach((x) => x.remove());
    if (reduceMotion() || narrow() || typeof spread.animate !== 'function') {
      spread.classList.remove('fade');
      void spread.offsetWidth;
      spread.classList.add('fade');
      return;
    }
    const fresh = snapshot();
    const fwd = dir > 0;
    const front = h('div', { class: 'jb-face front' }, fwd ? snap.right : snap.left);
    const back = h('div', { class: 'jb-face back' }, fwd ? fresh.left : fresh.right);
    const leaf = h('div', { class: `jb-leaf ${fwd ? 'fwd' : 'back'}`, 'aria-hidden': 'true' }, front, back, h('i', { class: 'jb-leaf-shade' }));
    const under = h('div', { class: `jb-under ${fwd ? 'at-left' : 'at-right'}`, 'aria-hidden': 'true' }, fwd ? snap.left : snap.right);
    spread.append(under, leaf);
    // the clones open at the top; put them where the pages were
    (front.firstElementChild as HTMLElement).scrollTop = fwd ? snap.rt : snap.lt;
    (under.firstElementChild as HTMLElement).scrollTop = fwd ? snap.lt : snap.rt;
    const done = () => {
      leaf.remove();
      under.remove();
    };
    leaf.addEventListener('animationend', (e) => e.target === leaf && done());
    window.setTimeout(done, 1400);
  }

  function go(next: string) {
    if (next === section) return;
    const o = order();
    const dir: 1 | -1 = o.indexOf(next) > o.indexOf(section) ? 1 : -1;
    closeDetail(true);
    const snap = snapshot();
    section = next;
    model = build();
    drawTabs();
    draw(true);
    pageTurn(dir, snap);
    ambience.sfx('page');
  }

  /** The book redrawn in place (a profile update, a filter): same page, no turn. */
  function refresh() {
    model = build();
    drawTabs();
    if (grid && model.chapters.some((c) => c.id === section)) {
      // a filter change: the left page keeps its controls' scroll; only the stickers are dealt again
      const lt = left.scrollTop;
      draw(false);
      left.scrollTop = lt;
      return;
    }
    draw(false);
  }

  // ---------------------------------------------------------------- the word's card

  let detail: { list: JournalWord[]; index: number; el: HTMLElement } | null = null;

  function wordCard(w: JournalWord, index: number, total: number): HTMLElement {
    const c = chapterOf(w);
    const band = h(
      'div',
      { class: 'jbc-band' },
      h('span', { class: 'jbc-emb' }, emblemIcon(c.emblem)),
      h('span', { class: 'jbc-no' }, h('i', null, 'Nº'), pad(w.no), h('small', null, c.pt)),
      h('span', { class: 'jbc-src' }, sourceIcon(w.source), SOURCE_LABEL[w.source].pt),
    );
    const nav = h(
      'div',
      { class: 'jbc-nav' },
      h('button', { type: 'button', class: 'jbc-prev', 'aria-label': 'Anterior · Previous', disabled: index <= 0, onclick: () => step(-1) }, '‹'),
      h('span', null, `${index + 1} / ${total}`),
      h('button', { type: 'button', class: 'jbc-next', 'aria-label': 'Próxima · Next', disabled: index >= total - 1, onclick: () => step(1) }, '›'),
    );
    const x = h('button', { type: 'button', class: 'jbc-close', 'aria-label': 'Fechar · Close', onclick: () => closeDetail() }, '✕');
    if (!w.earned) {
      return h(
        'div',
        { class: 'jb-card gap', style: chapterVars(c), role: 'dialog', 'aria-label': `Nº ${w.no}: ainda não encontrada` },
        x,
        band,
        h('div', { class: 'jbc-mystery', 'aria-hidden': 'true' }, '?'),
        h('p', { class: 'jbc-missing' }, 'Ainda não encontrada', en('Not found yet')),
        h('div', { class: 'jbc-how hint' }, sourceIcon(w.source), h('p', null, w.how.pt, en(w.how.en))),
        nav,
      );
    }
    const listen = h(
      'button',
      {
        type: 'button',
        class: 'jbc-listen',
        id: 'jb-listen',
        'aria-label': `Ouvir ${w.pt} · Listen`,
        onclick: () => say(w, listen, true),
      },
      h('span', { class: 'jbc-bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
      h('span', null, 'Ouvir'),
    );
    const pic = w.photo
      ? h('figure', { class: 'jbc-pic photo' }, h('img', { src: w.photo, alt: '' }), h('i', { class: 'tape', 'aria-hidden': 'true' }))
      : w.speakerId
        ? h('figure', { class: 'jbc-pic face' }, npcPortrait(w.speakerId, 'feliz', 'jbc-portrait'), h('figcaption', null, w.speaker ?? ''))
        : h('figure', { class: 'jbc-pic art' }, sourceIcon(w.source, 'jbc-art'));
    const ctx = w.context
      ? h(
          'blockquote',
          { class: 'jbc-context', lang: 'pt-BR' },
          ...markWord(w.context, w.mark).map((s) => (s.hit ? h('mark', null, s.text) : s.text)),
        )
      : null;
    const mastery = MASTERY_LABEL[w.mastery];
    const note =
      w.mastery === 'dominada'
        ? ['Você domina esta palavra!', 'You have mastered this word']
        : w.due
          ? ['A Escola quer revisar esta hoje.', 'The Escola wants to review it today']
          : w.box === 0
            ? ['Estude na Escola da Praça para fixar.', 'Study it at the Escola to make it stick']
            : ['Continue estudando na Escola.', 'Keep studying it at the Escola'];
    return h(
      'div',
      { class: `jb-card got m-${w.mastery}`, style: chapterVars(c), role: 'dialog', 'aria-label': `${w.pt}: ${w.en}` },
      x,
      band,
      pic,
      h('div', { class: 'jbc-word' }, h('b', { class: `jbc-pt ${lenClass(w.pt)}`, lang: 'pt-BR', id: 'jb-word' }, w.pt), listen),
      h('p', { class: 'jbc-en' }, w.en),
      h('div', { class: 'jbc-how' }, sourceIcon(w.source), h('div', null, h('p', null, w.how.pt, en(w.how.en)), ctx)),
      h('div', { class: `jbc-mastery m-${w.mastery}` }, h('span', { class: 'jbc-mlabel' }, mastery.pt, en(mastery.en)), pips(w.box, 'jbc-pips'), h('p', null, note[0], en(note[1]!))),
      w.mastery === 'dominada' ? h('i', { class: 'stk-foil', 'aria-hidden': 'true' }) : null,
      nav,
    );
  }

  function say(w: JournalWord, btn: HTMLElement, force: boolean) {
    speak(w.pt, { force, speaker: 'ui' });
    if (!force && !game.sound) return;
    btn.classList.remove('playing');
    void btn.offsetWidth;
    btn.classList.add('playing');
    window.setTimeout(() => btn.classList.remove('playing'), 1400);
  }

  function showCard(from: HTMLElement | null, dir = 0) {
    if (!detail) return;
    const w = detail.list[detail.index];
    if (!w) return closeDetail();
    const card = wordCard(w, detail.index, detail.list.length);
    detail.el.querySelector('.jb-card')?.remove();
    detail.el.append(card);
    const still = reduceMotion() || typeof card.animate !== 'function';
    if (!still && from?.isConnected) {
      // the card comes out of its sticker, turning as it grows
      const a = from.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2);
      const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const s = Math.max(0.15, a.width / b.width);
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotateY(-70deg) rotate(-6deg)`, opacity: 0.4 },
          { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(${(1 + s) / 1.6}) rotateY(-20deg) rotate(-2deg)`, opacity: 1, offset: 0.55 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.15)' },
      );
    } else if (!still && dir) {
      card.animate(
        [
          { transform: `translateX(${dir * 60}px) rotateY(${dir * -25}deg)`, opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      );
    }
    ambience.sfx('page');
    const btn = card.querySelector<HTMLElement>('.jbc-listen');
    if (btn) {
      window.setTimeout(() => btn.isConnected && say(w, btn, false), still ? 0 : 420);
      btn.focus({ preventScroll: true });
    } else card.querySelector<HTMLElement>('.jbc-close')?.focus({ preventScroll: true });
  }

  function openDetail(list: JournalWord[], index: number, from: HTMLElement | null) {
    closeDetail(true);
    const shade = h('div', { class: 'jb-shade', onclick: () => closeDetail() });
    const el = h('div', { class: 'jb-detail' }, shade);
    detailHost.append(el);
    detail = { list, index, el };
    showCard(from);
  }

  function step(d: number) {
    if (!detail) return;
    const next = detail.index + d;
    if (next < 0 || next >= detail.list.length) return;
    detail.index = next;
    showCard(null, d);
  }

  function closeDetail(now = false) {
    if (!detail) return;
    const { el, list, index } = detail;
    detail = null;
    if (now || reduceMotion()) return el.remove();
    el.classList.add('leaving');
    window.setTimeout(() => el.remove(), 220);
    // focus goes back to the sticker the card came from, when it is on the page
    const id = list[index]?.id;
    if (id) panel.querySelector<HTMLElement>(`.jb-spread [data-word="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }

  function openPhoto(p: { image: string; wordId?: string; wordIds?: string[]; at: number }, from: HTMLElement) {
    closeDetail(true);
    // the stickers of every word this shot taught (one picture, several words)
    const all = model.chapters.flatMap((c) => c.words);
    const words = photoWordIds(p)
      .map((id) => all.find((w) => w.id === id))
      .filter((w): w is (typeof all)[number] => !!w);
    const word = words[0];
    const when = new Date(p.at);
    const card = h(
      'div',
      { class: 'jb-card photo-card', role: 'dialog', 'aria-label': 'Foto' },
      h('button', { type: 'button', class: 'jbc-close', 'aria-label': 'Fechar · Close', onclick: () => closeDetail() }, '✕'),
      h('figure', { class: 'jbc-big-photo' }, h('img', { src: p.image, alt: words.map((w) => w.pt).join(', ') }), h('i', { class: 'tape', 'aria-hidden': 'true' })),
      words.length
        ? h('p', { class: 'jbc-photo-word' }, h('b', { lang: 'pt-BR' }, words.map((w) => w.pt).join(' · ')), en(words.map((w) => w.en).join(' · ')))
        : h('p', { class: 'jbc-photo-word' }, en('A photo of Vila Ipê')),
      h('p', { class: 'jbc-photo-date' }, when.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })),
      word ? h('button', { type: 'button', class: 'primary jbc-see', onclick: () => openDetail(words, 0, null) }, words.length > 1 ? bi('Ver figurinhas', 'See the stickers') : bi('Ver figurinha', 'See the sticker')) : null,
    );
    const el = h('div', { class: 'jb-detail' }, h('div', { class: 'jb-shade', onclick: () => closeDetail() }), card);
    detailHost.append(el);
    detail = { list: [], index: 0, el };
    if (!reduceMotion() && typeof card.animate === 'function') {
      const a = from.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      card.animate(
        [
          { transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${a.width / b.width}) rotate(-4deg)` },
          { transform: 'none' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)' },
      );
    }
    card.querySelector<HTMLElement>('.jbc-close')?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------- the sticker under the pointer tilts and catches the light

  spread.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduceMotion()) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.jb-stk.got');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
  });
  spread.addEventListener('pointerout', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.jb-stk.got');
    if (el && !el.contains(e.relatedTarget as Node)) {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    }
  });

  // ---------------------------------------------------------------- keys: Escape closes the card first; the arrows turn pages or cards

  const onKey = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (detail) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeDetail();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        step(e.key === 'ArrowRight' ? 1 : -1);
      }
      return;
    }
    if (typing) {
      if (e.key === 'Escape' && (e.target as HTMLInputElement).value) {
        e.preventDefault();
        e.stopImmediatePropagation();
        (e.target as HTMLInputElement).value = '';
        e.target.dispatchEvent(new Event('input'));
      }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === 'PageUp') {
      const o = order();
      const next = o[o.indexOf(section) + (e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1)];
      if (next) {
        e.preventDefault();
        e.stopPropagation();
        go(next);
      }
    }
  };
  document.addEventListener('keydown', onKey, true);

  // ---------------------------------------------------------------- the panel

  const name = game.profile?.name ?? '';
  const cover = h(
    'div',
    { class: 'jb-cover', 'aria-hidden': 'true' },
    h('i', { class: 'jr-corner tl' }),
    h('i', { class: 'jr-corner tr' }),
    h('i', { class: 'jr-corner bl' }),
    h('i', { class: 'jr-corner br' }),
    h('span', { class: 'jb-cover-title' }, 'Diário'),
    name ? h('span', { class: 'jb-cover-name' }, name) : null,
    h('i', { class: 'jb-clasp' }),
  );
  const panel = h(
    'div',
    { class: 'panel caderno jb', 'aria-label': 'Diário' },
    cover,
    h('i', { class: 'jb-ribbon', 'aria-hidden': 'true' }),
    h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
    h('header', { class: 'jb-top' }, h('h2', null, 'Diário'), en('Your words, place by place: tap a sticker to hear it')),
    tabs,
    h('div', { class: 'jb-bookwrap' }, spread),
    detailHost,
  );
  /** What the book draws from the profile: a profile update that changes none of it (coins, a recado) leaves the pages (and a search being typed) alone. */
  const drawnFrom = () => {
    const p = game.profile;
    return JSON.stringify([
      p?.diary?.length,
      p?.diary?.[p.diary.length - 1],
      p?.escola?.xp,
      p?.escola?.lessons,
      p?.escola?.streak,
      p?.film,
      p?.feiraMedals?.length,
      p?.giOwned,
      game.photos.length,
      game.photos[0]?.id,
    ]);
  };
  let drawn = drawnFrom();
  drawTabs();
  draw(true);
  const off = game.on('profile', () => {
    const now = drawnFrom();
    if (now !== drawn) {
      drawn = now;
      refresh();
    }
    storeSeen(earnedCount());
    syncJournalBadge();
  });
  const close = openModal('caderno', panel, {
    onClose: () => {
      off();
      document.removeEventListener('keydown', onKey, true);
      storeSeen(earnedCount());
      syncJournalBadge();
    },
  });
  ambience.sfx('page');
}
