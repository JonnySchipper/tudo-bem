/**
 * Escola da Praça: Dona Lúcia's desk. The home shows the streak, today's goal, the plate and the bar to the next colour, and the path of units
 * (one per area of the diary, five nodes each: four lessons and the checkpoint) with where to find the words still missing. A lesson is a run of
 * short exercises the server deals one at a time and checks (pick the Portuguese, pick the meaning, listen, type it, build a real line, match
 * pairs); the client never holds an answer before it has answered. The end card counts the XP, the streak, the words made stronger and the RV.
 *
 * Chalkboard and paper cards, DOM text (HOWTO D8). Every reveal plays the word's neural clip; Dona Lúcia's lines are voiced. Motion respects
 * prefers-reduced-motion (escola.css).
 */
import {
  EXERCISE_TITLE,
  ESCOLA_GOALS,
  ESCOLA_LESSON,
  ESCOLA_MAX_BOX,
  LUCIA_LINES,
  LUCIA_TIER_UP,
  NAMEPLATE_TIERS,
  currentStreak,
  escolaPath,
  localDay,
  luciaGreeting,
  normalizeEscola,
  tierProgress,
  todayXp,
  wordCounts,
  type Bilingual,
  type EscolaAnswer,
  type EscolaSummary,
  type Hunt,
  type Nameplate,
  type ServerMsg,
  type UnitView,
} from '@tudobem/shared';
import { game } from '../state';
import { speak } from '../audio';
import { ambience } from '../ambience';
import { h, en, bi } from './dom';
import { openModal } from './modal';
import { npcPortrait } from './pixelArt';
import { toast } from './hud';
import { tierChip, tierIcon, tierName } from './plate';
import { escolaHomeShows } from './escolaDisclosure';

export interface EscolaActions {
  start: (area?: string) => void;
  answer: (a: EscolaAnswer) => void;
  pair: (pt: number, en: number) => void;
  next: () => void;
  quit: () => void;
  goal: (goal: number) => void;
}

type EscolaMsg = Extract<ServerMsg, { t: 'escola' }>;
type ExerciseMsg = Extract<EscolaMsg, { phase: 'exercise' }>;
type CheckedMsg = Extract<EscolaMsg, { phase: 'checked' }>;
type PairMsg = Extract<EscolaMsg, { phase: 'pair' }>;
type Face = 'neutro' | 'feliz' | 'pensativo' | 'surpreso';

let actions: EscolaActions | null = null;
let closeFn: (() => void) | null = null;
let offProfile: (() => void) | null = null;
let view: 'home' | 'lesson' | 'done' = 'home';
let current: ExerciseMsg | null = null;
let answered = false;
let waiting = false;
let matchTimer = 0;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const tz = () => -new Date().getTimezoneOffset();
const today = () => localDay(Date.now(), tz());
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** Dona Lúcia speaks (her own voice; the line on screen with its English). */
const lucia = (line: Bilingual) => speak(line.pt, { speaker: 'lucia' });
/** A diary word, in the voice the Caderno uses. */
const sayWord = (pt: string, slow = false) => speak(pt, { speaker: 'ui', ...(slow ? { rate: 0.62 } : {}) });

function setFace(expr: Face) {
  for (const slot of document.querySelectorAll('.escola-face')) slot.replaceChildren(npcPortrait('lucia', expr, 'escola-portrait'));
}

function line(l: Bilingual, id?: string) {
  return h('p', { class: 'escola-line', ...(id ? { id } : {}) }, h('span', { lang: 'pt-BR' }, l.pt), en(l.en));
}

/** Is the escola panel up (diary word cards wait for it to close, like any game)? */
export function escolaPracticeOpen() {
  return !!document.querySelector('[data-modal="escola"]');
}

// ---------------------------------------------------------------- the panel

export function openEscola(a: EscolaActions) {
  actions = a;
  if (escolaPracticeOpen() && view !== 'lesson') return renderHome(true);
  closeFn?.();
  const body = h('div', { id: 'escola-body' });
  closeFn = openModal(
    'escola',
    h(
      'div',
      { class: 'panel escola-panel escola-v2', id: 'escola-practice', role: 'dialog', 'aria-label': 'Escola da Praça (Plaza School)' },
      h('button', { class: 'close ghost', type: 'button', id: 'escola-close', onclick: () => closeFn?.(), 'aria-label': 'Fechar (Close)' }, '✕'),
      body,
    ),
    {
      onClose: () => {
        if (view === 'lesson') actions?.quit();
        closeFn = null;
        view = 'home';
        current = null;
        window.clearInterval(matchTimer);
        offProfile?.();
        offProfile = null;
        document.removeEventListener('keydown', onKey, true);
      },
    },
  );
  offProfile = game.on('profile', () => view === 'home' && renderHome(false));
  document.addEventListener('keydown', onKey, true);
  renderHome(true);
}

/** Every escola message from the server. */
export function onEscolaMsg(m: EscolaMsg) {
  if (m.phase === 'closed') {
    if (escolaPracticeOpen() && view !== 'done') {
      view = 'home';
      renderHome(false);
      const note = $('escola-note');
      note?.replaceChildren(line(m.line));
      lucia(m.line);
    } else toast('info', m.line.pt, m.line.en);
    return;
  }
  if (!escolaPracticeOpen()) {
    // the panel was closed while a message was on its way: nothing to draw
    return;
  }
  if (m.phase === 'exercise') return renderExercise(m);
  if (m.phase === 'checked') return renderChecked(m);
  if (m.phase === 'pair') return renderPair(m);
  if (m.phase === 'done') return renderDone(m.summary);
}

// ---------------------------------------------------------------- home: streak, goal, plate, path

function head(greet: Bilingual, face: Face = 'neutro') {
  return h(
    'div',
    { class: 'escola-head' },
    h('div', { class: 'escola-face', id: 'escola-face' }, npcPortrait('lucia', face, 'escola-portrait')),
    h(
      'div',
      null,
      h('h2', { id: 'escola-host' }, 'Dona Lúcia'),
      line(greet, 'escola-greet'),
      h('button', { type: 'button', class: 'escola-say ghost', 'aria-label': 'Ouvir (Listen)', onclick: () => lucia(greet) }, '🔊'),
    ),
  );
}

function flame(n: number, big = false) {
  return h('span', { class: `escola-flame ${n > 0 ? 'lit' : ''} ${big ? 'big' : ''}`.trim(), title: `${n} dias seguidos · ${n}-day streak` }, h('i', { class: 'flame-ico', 'aria-hidden': 'true' }), h('b', null, String(n)));
}

function bar(frac: number, cls = '') {
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  return h('span', { class: `escola-bar ${cls}`.trim(), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, h('i', { style: `width:${pct}%` }));
}

function tierBar(p: ReturnType<typeof tierProgress>) {
  if (!p.next) return h('div', { class: 'escola-tierbar top' }, tierChip(p.tier), h('span', null, 'Placa mais alta!', en('Top nameplate!')));
  // needs_br: true
  const streakNote = p.streakNeed ? ` + ${p.streakNeed} dias seguidos (melhor: ${p.best})` : '';
  return h(
    'div',
    { class: 'escola-tierbar', id: 'escola-tierbar' },
    tierChip(p.tier),
    h('span', { class: 'escola-tierbar-mid' }, bar(p.frac, `to-${p.next.tier}`), h('small', null, `${p.mastered}/${p.next.mastered} palavras dominadas${streakNote}`, en(`${p.mastered}/${p.next.mastered} words mastered for ${p.next.en}`))),
    tierChip(p.next.tier),
  );
}

function renderHome(greet: boolean) {
  view = 'home';
  current = null;
  window.clearInterval(matchTimer);
  const body = $('escola-body');
  const p = game.profile;
  if (!body || !p) return;
  const st = normalizeEscola(p.escola, p.diary);
  const day = today();
  const counts = wordCounts(st, p.diary, Date.now());
  const streak = currentStreak(st, day);
  const xp = todayXp(st, day);
  const goalMet = xp >= st.goal;
  const greeting = luciaGreeting({ words: counts.learned, streak, best: st.best, goalMet });
  const units = escolaPath(st, p.diary);
  const shows = escolaHomeShows(p);
  const mission = shows.deep && st.mission?.day === day && !st.mission.done ? units.find((u) => u.id === st.mission!.area)?.hunt : null;

  const goalPick = h(
    'span',
    { class: 'escola-goals', role: 'radiogroup', 'aria-label': 'Meta diária (Daily goal)' },
    ...ESCOLA_GOALS.map((g) =>
      h(
        'button',
        {
          type: 'button',
          class: `escola-goal-btn ${g === st.goal ? 'on' : ''}`,
          role: 'radio',
          'aria-checked': g === st.goal ? 'true' : 'false',
          'data-goal': String(g),
          onclick: () => actions?.goal(g),
        },
        `${g}`,
      ),
    ),
  );

  const start = h(
    'button',
    { type: 'button', class: 'primary escola-start', id: 'escola-start', disabled: counts.learned === 0, onclick: () => begin() },
    bi('Começar lição', 'Start a lesson'),
    counts.learned ? h('small', null, `${counts.due} pra revisar · ${Math.min(counts.fresh, ESCOLA_LESSON.newWords)} novas`, en(` ${counts.due} to review · ${Math.min(counts.fresh, ESCOLA_LESSON.newWords)} new`)) : null,
  );

  body.replaceChildren(
    head(greeting, streak > 0 || goalMet ? 'feliz' : 'neutro'),
    h('div', { id: 'escola-note', 'aria-live': 'polite' }),
    ...(shows.flame
      ? [h(
      'div',
      { class: 'escola-stats' },
      h(
        'div',
        { class: 'escola-stat', id: 'escola-streak' },
        flame(streak),
        h('span', null, h('b', null, 'Sequência'), en('Streak')),
        shows.deep && st.freezes ? h('span', { class: 'escola-freeze', title: `${st.freezes} proteção de sequência (earned by play: one every 7 days)` }, h('i', { class: 'freeze-ico', 'aria-hidden': 'true' }), `×${st.freezes}`) : null,
      ),
      h(
        'div',
        { class: 'escola-stat', id: 'escola-goal' },
        h('span', { class: 'escola-goal-head' }, h('b', null, 'Meta de hoje', en(' · Daily goal', true)), h('span', { class: 'escola-goal-n' }, `${Math.min(xp, 999)}/${st.goal} XP`)),
        bar(xp / st.goal, goalMet ? 'met' : ''),
        shows.goalPick ? goalPick : null,
      ),
    )]
      : []),
    ...(shows.deep ? [tierBar(tierProgress(st, p.diary))] : []),
    h(
      'p',
      { class: 'escola-counts', id: 'escola-counts' },
      h('span', null, h('b', null, String(counts.mastered)), ' dominadas'),
      h('span', null, h('b', null, String(counts.learned)), ' aprendidas'),
      h('span', null, h('b', null, String(counts.toFind)), ' pra descobrir'),
      en(`${counts.mastered} mastered · ${counts.learned} learned · ${counts.toFind} still to find`),
    ),
    start,
    ...(mission ? [missionCard(mission)] : []),
    ...(shows.path ? [h('h3', { class: 'escola-path-title' }, 'Seu caminho', en(' Your path', true)), h('ol', { class: 'escola-path', id: 'escola-path' }, ...units.map(unitRow))] : []),
    en('Free beta: lessons pay a little virtual RV (capped per day). Plates are earned by words mastered — never bought.'),
  );
  if (greet) lucia(greeting);
}

function begin(area?: string) {
  if (waiting) return;
  waiting = true;
  window.setTimeout(() => (waiting = false), 1500);
  actions?.start(area);
}

function missionCard(m: Hunt) {
  return h(
    'div',
    { class: 'escola-mission', id: 'escola-mission' },
    h('b', null, 'Missão de palavras', en(' Word mission', true)),
    line(m.line),
    h('p', { class: 'escola-hint' }, h('span', { lang: 'pt-BR' }, m.hint.pt), en(m.hint.en)),
    h('small', null, 'Ache uma palavra nova lá hoje: +5 XP', en(' Find a new word there today: +5 XP')),
  );
}

function unitRow(u: UnitView, i: number) {
  const canStudy = u.found > 0;
  const nodes = u.nodes.map((state, k) => {
    const checkpoint = k === u.nodes.length - 1;
    const label = checkpoint ? `Checkpoint ${u.pt} · Checkpoint` : `Lição ${k + 1} · ${u.pt} · Lesson ${k + 1}`;
    return h(
      'button',
      {
        type: 'button',
        class: `escola-node ${state} ${checkpoint ? 'checkpoint' : ''}`.trim(),
        style: `--zig:${[0, 1, 2, 1, 0][k]}`,
        'aria-label': `${label}: ${state === 'done' ? 'feita (done)' : state === 'current' ? 'agora (current)' : 'trancada (locked)'}`,
        title: label,
        disabled: !canStudy || state === 'locked',
        onclick: () => begin(u.id),
      },
      h('i', { class: checkpoint ? 'trophy-ico' : state === 'done' ? 'check-ico' : 'star-ico', 'aria-hidden': 'true' }),
    );
  });
  return h(
    'li',
    { class: `escola-unit ${canStudy ? '' : 'empty'}`, 'data-area': u.id, style: `--i:${i}` },
    h(
      'div',
      { class: 'escola-unit-head' },
      h('b', null, u.pt, en(` ${u.en}`, true)),
      h('span', { class: 'escola-crowns', 'aria-label': `${u.crowns} de 5 coroas (${u.crowns} of 5 crowns)` }, ...Array.from({ length: 5 }, (_, k) => h('i', { class: `crown-ico ${k < u.crowns ? 'on' : ''}`, 'aria-hidden': 'true' }))),
      h('small', null, `${u.found}/${u.total} achadas · ${u.mastered} dominadas`),
    ),
    h('div', { class: 'escola-nodes' }, ...nodes),
    u.hunt ? h('p', { class: 'escola-hunt' }, h('span', { lang: 'pt-BR' }, `${u.hunt.line.pt}. ${u.hunt.hint.pt}`), en(`${u.hunt.line.en}. ${u.hunt.hint.en}`)) : h('p', { class: 'escola-hunt done' }, 'Todas achadas!', en(' All found!')),
  );
}

// ---------------------------------------------------------------- a lesson

function lessonShell(m: ExerciseMsg) {
  const body = $('escola-body')!;
  const pct = Math.round((m.index / Math.max(1, m.total)) * 100);
  body.replaceChildren(
    h(
      'div',
      { class: 'escola-lesson', id: 'escola-lesson', 'data-kind': m.ex.kind },
      h(
        'div',
        { class: 'escola-top' },
        h('button', { type: 'button', class: 'ghost escola-quit', id: 'escola-quit', 'aria-label': 'Sair da lição (Leave the lesson)', onclick: quitLesson }, '←'),
        h('span', { class: 'escola-bar lesson', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pct}%` })),
        h('span', { class: `escola-combo ${m.combo >= 2 ? 'on' : ''}`, id: 'escola-combo', 'aria-live': 'polite' }, h('i', { class: 'flame-ico', 'aria-hidden': 'true' }), `×${m.combo}`),
        h('span', { class: 'escola-xp', id: 'escola-xp' }, `${m.lessonXp} XP`),
      ),
      h(
        'div',
        { class: 'escola-ask' },
        h('div', { class: 'escola-face small', id: 'escola-face' }, npcPortrait('lucia', 'neutro', 'escola-portrait')),
        h('p', { class: 'escola-title' }, EXERCISE_TITLE[m.ex.kind].pt, en(EXERCISE_TITLE[m.ex.kind].en)),
        m.retry ? h('p', { class: 'escola-retry' }, LUCIA_LINES.retry.pt, en(LUCIA_LINES.retry.en)) : null,
      ),
      h('div', { class: 'escola-ex', id: 'escola-ex' }),
      h('div', { class: 'escola-foot', id: 'escola-foot' }),
    ),
  );
  return { ex: $('escola-ex')!, foot: $('escola-foot')! };
}

function quitLesson() {
  actions?.quit();
  view = 'home';
  renderHome(false);
}

function renderExercise(m: ExerciseMsg) {
  view = 'lesson';
  current = m;
  answered = false;
  waiting = false;
  window.clearInterval(matchTimer);
  const { ex, foot } = lessonShell(m);
  const e = m.ex;
  if (m.retry) lucia(LUCIA_LINES.retry);
  switch (e.kind) {
    case 'pick':
      ex.append(board(h('p', { class: 'escola-gloss chalk', id: 'escola-gloss' }, e.en)), options(e.options, 'pt-BR'));
      break;
    case 'pick_en':
      ex.append(board(h('p', { class: 'escola-gloss chalk', lang: 'pt-BR', id: 'escola-gloss' }, e.pt), hearBtn(e.pt)), options(e.options, 'en'));
      window.setTimeout(() => sayWord(e.pt), 250);
      break;
    case 'listen':
      ex.append(board(h('div', { class: 'escola-listen' }, hearBtn(e.audio, 'big'), hearBtn(e.audio, 'slow'))), options(e.options, 'en'));
      window.setTimeout(() => sayWord(e.audio), 250);
      break;
    case 'type':
      ex.append(board(h('p', { class: 'escola-gloss chalk', id: 'escola-gloss' }, e.en)), typeBox(e.letters));
      foot.append(checkBtn(() => submitTyped()));
      window.setTimeout(() => $('escola-type')?.focus(), 60);
      break;
    case 'build':
      ex.append(board(h('p', { class: 'escola-gloss chalk small', id: 'escola-gloss' }, e.en), h('small', { class: 'escola-where chalk' }, e.where.pt, en(` ${e.where.en}`, true))), buildBox(e.tiles));
      foot.append(checkBtn(() => submitBuild()));
      break;
    case 'match':
      ex.append(matchBox(e.pt, e.en));
      break;
  }
}

function board(...kids: (Node | null)[]) {
  return h('div', { class: 'escola-board' }, ...kids, h('i', { class: 'escola-tray', 'aria-hidden': 'true' }));
}

function hearBtn(pt: string, kind: 'small' | 'big' | 'slow' = 'small') {
  const slow = kind === 'slow';
  return h(
    'button',
    { type: 'button', class: `escola-hear ${kind}`, id: kind === 'big' ? 'escola-hear' : undefined, 'aria-label': slow ? 'Ouvir devagar (Listen slowly)' : 'Ouvir (Listen)', onclick: () => sayWord(pt, slow) },
    slow ? h('i', { class: 'turtle-ico', 'aria-hidden': 'true' }) : h('i', { class: 'speaker-ico', 'aria-hidden': 'true' }),
    kind === 'big' ? bi('Ouvir', 'Listen') : null,
  );
}

function options(list: string[], lang: 'pt-BR' | 'en') {
  return h(
    'div',
    { class: 'escola-options', id: 'escola-options' },
    ...list.map((choice, i) =>
      h(
        'button',
        {
          type: 'button',
          class: 'escola-choice',
          'data-choice': choice,
          lang,
          style: `--r:${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg;--d:${80 + i * 70}ms`,
          onclick: (ev: Event) => pick(ev.currentTarget as HTMLButtonElement, choice),
        },
        h('kbd', { 'aria-hidden': 'true' }, String(i + 1)),
        choice,
      ),
    ),
  );
}

function pick(btn: HTMLButtonElement, choice: string) {
  if (answered || waiting) return;
  waiting = true;
  for (const b of document.querySelectorAll<HTMLButtonElement>('#escola-options button')) b.disabled = true;
  btn.classList.add('picked');
  actions?.answer({ choice });
}

function checkBtn(onclick: () => void) {
  return h('button', { type: 'button', class: 'primary escola-check', id: 'escola-check', onclick }, bi('Verificar', 'Check'));
}

const ACCENTS = ['á', 'à', 'â', 'ã', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú', 'ç'];

function typeBox(letters: number) {
  const input = h('input', {
    type: 'text',
    id: 'escola-type',
    class: 'escola-type',
    lang: 'pt-BR',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
    maxLength: 60,
    placeholder: '_ '.repeat(Math.min(letters, 14)).trim(),
    'aria-label': 'Sua resposta em português (Your answer in Portuguese)',
  }) as HTMLInputElement;
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (answered) next();
      else submitTyped();
    }
  });
  const insert = (ch: string) => {
    const s = input.selectionStart ?? input.value.length;
    const t = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + ch + input.value.slice(t);
    input.focus();
    input.setSelectionRange(s + ch.length, s + ch.length);
  };
  const keys = h('div', { class: 'escola-accents', 'aria-label': 'Acentos (Accents)' }, ...ACCENTS.map((ch) => h('button', { type: 'button', tabindex: '-1', onmousedown: (e: Event) => e.preventDefault(), onclick: () => insert(ch) }, ch)));
  return h('div', { class: 'escola-typebox' }, h('div', { class: 'escola-typerow' }, input, speakBtn(input)), keys, h('small', { class: 'escola-letters' }, `${letters} letras`, en(` ${letters} letters`, true)));
}

/** Speak it (optional, never required): the browser's speech recognition fills the box when there is one. */
function speakBtn(input: HTMLInputElement) {
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Rec) return null;
  const btn = h('button', { type: 'button', class: 'escola-mic', id: 'escola-mic', 'aria-label': 'Falar (Speak it)', title: 'Falar (opcional) · Speak it (optional)' }, h('i', { class: 'mic-ico', 'aria-hidden': 'true' }));
  btn.addEventListener('click', () => {
    try {
      const rec = new Rec();
      rec.lang = 'pt-BR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      btn.classList.add('on');
      rec.onresult = (ev) => {
        const said = ev.results?.[0]?.[0]?.transcript ?? '';
        if (said) input.value = said.trim().replace(/[.!?]$/, '');
      };
      rec.onend = () => btn.classList.remove('on');
      rec.onerror = () => btn.classList.remove('on');
      rec.start();
    } catch {
      btn.classList.remove('on');
    }
  });
  return btn;
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
}

function submitTyped() {
  const input = $<HTMLInputElement>('escola-type');
  if (!input || answered || waiting || !input.value.trim()) return;
  waiting = true;
  input.readOnly = true;
  actions?.answer({ text: input.value });
}

let built: number[] = [];

function buildBox(tiles: string[]) {
  built = [];
  const row = h('div', { class: 'escola-built', id: 'escola-built', 'aria-label': 'Sua frase (Your sentence)' });
  const bank = h('div', { class: 'escola-bank', id: 'escola-bank' });
  const paint = () => {
    row.replaceChildren(...built.map((i) => h('button', { type: 'button', class: 'escola-tile in', lang: 'pt-BR', onclick: () => ((built = built.filter((x) => x !== i)), paint()) }, tiles[i]!)));
    bank.replaceChildren(
      ...tiles.map((t, i) =>
        h('button', { type: 'button', class: `escola-tile ${built.includes(i) ? 'used' : ''}`, lang: 'pt-BR', 'data-tile': String(i), disabled: built.includes(i), onclick: () => (built.includes(i) || answered ? null : (built.push(i), paint())) }, t),
      ),
    );
  };
  paint();
  return h('div', { class: 'escola-buildbox' }, row, bank);
}

function submitBuild() {
  const e = current?.ex;
  if (!e || e.kind !== 'build' || answered || waiting || built.length !== e.tiles.length) return;
  waiting = true;
  actions?.answer({ order: [...built] });
}

let matchPick: { side: 'pt' | 'en'; i: number } | null = null;

function matchBox(pt: string[], enList: string[]) {
  matchPick = null;
  const t0 = performance.now();
  const clock = h('span', { class: 'escola-race', id: 'escola-race' }, '0,0 s');
  matchTimer = window.setInterval(() => (clock.textContent = `${((performance.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`), 100);
  const col = (side: 'pt' | 'en', list: string[]) =>
    h(
      'div',
      { class: `escola-col col-${side}` },
      ...list.map((text, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'escola-tile match',
            lang: side === 'pt' ? 'pt-BR' : 'en',
            'data-side': side,
            'data-i': String(i),
            onclick: (ev: Event) => tapMatch(ev.currentTarget as HTMLButtonElement, side, i, text),
          },
          text,
        ),
      ),
    );
  return h('div', { class: 'escola-matchbox' }, h('div', { class: 'escola-race-row' }, h('i', { class: 'clock-ico', 'aria-hidden': 'true' }), clock), h('div', { class: 'escola-match', id: 'escola-match' }, col('pt', pt), col('en', enList)));
}

function tapMatch(btn: HTMLButtonElement, side: 'pt' | 'en', i: number, text: string) {
  if (answered || btn.classList.contains('done')) return;
  if (side === 'pt') sayWord(text);
  if (!matchPick || matchPick.side === side) {
    document.querySelectorAll('#escola-match .sel').forEach((b) => b.classList.remove('sel'));
    btn.classList.add('sel');
    matchPick = { side, i };
    return;
  }
  const ptI = side === 'pt' ? i : matchPick.i;
  const enI = side === 'en' ? i : matchPick.i;
  matchPick = null;
  btn.classList.add('sel');
  actions?.pair(ptI, enI);
}

function renderPair(m: PairMsg) {
  const a = document.querySelector<HTMLButtonElement>(`#escola-match [data-side="pt"][data-i="${m.pt}"]`);
  const b = document.querySelector<HTMLButtonElement>(`#escola-match [data-side="en"][data-i="${m.en}"]`);
  for (const el of [a, b]) {
    if (!el) continue;
    el.classList.remove('sel', 'miss');
    if (m.ok) {
      el.classList.add('done');
      el.disabled = true;
    } else {
      void el.offsetWidth;
      el.classList.add('miss');
    }
  }
  ambience.sfx(m.ok ? 'pop' : 'nope');
}

// ---------------------------------------------------------------- the verdict

function renderChecked(m: CheckedMsg) {
  answered = true;
  waiting = false;
  window.clearInterval(matchTimer);
  const e = current?.ex;
  // the cards: the one picked is marked, and on a miss the right one lights up
  const want = e?.kind === 'pick' ? m.reveal.pt : m.reveal.en;
  for (const b of document.querySelectorAll<HTMLButtonElement>('#escola-options button')) {
    b.disabled = true;
    const isRight = b.dataset.choice?.toLowerCase() === want.toLowerCase();
    if (b.classList.contains('picked')) b.classList.add(m.correct ? 'right' : 'wrong');
    else if (isRight && !m.correct) b.classList.add('right', 'shown');
    b.classList.remove('picked');
  }
  const input = $<HTMLInputElement>('escola-type');
  if (input) input.classList.add(m.correct ? 'right' : 'wrong');
  $('escola-built')?.classList.add(m.correct ? 'right' : 'wrong');
  setFace(m.correct ? (m.almost ? 'surpreso' : 'feliz') : 'pensativo');
  ambience.sfx(m.correct ? 'stamp' : 'nope');
  if (m.correct && m.combo >= 5 && m.combo % 5 === 0) window.setTimeout(() => ambience.sfx('combo'), 160);
  // every reveal: the word in its own neural clip (a built line: the whole line)
  window.setTimeout(() => (m.reveal.line ? speak(m.reveal.line) : e?.kind === 'match' ? undefined : sayWord(m.reveal.pt)), m.correct ? 220 : 380);

  const combo = $('escola-combo');
  if (combo) {
    combo.classList.toggle('on', m.combo >= 2);
    combo.replaceChildren(h('i', { class: 'flame-ico', 'aria-hidden': 'true' }), `×${m.combo}`);
    if (m.correct && m.combo >= 2 && !reduceMotion()) {
      combo.classList.remove('bump');
      void combo.offsetWidth;
      combo.classList.add('bump');
    }
  }
  const xpEl = $('escola-xp');
  if (xpEl) xpEl.textContent = `${m.lessonXp} XP`;
  if (m.xp > 0) {
    const pop = h('span', { class: 'escola-xp-pop', 'aria-hidden': 'true' }, `+${m.xp} XP`);
    $('escola-lesson')?.append(pop);
    window.setTimeout(() => pop.remove(), 1100);
  }

  const foot = $('escola-foot');
  if (!foot) return;
  const reveal =
    e?.kind === 'match'
      ? null
      : h(
          'p',
          { class: 'escola-reveal' },
          h('button', { type: 'button', class: 'escola-hear small', 'aria-label': 'Ouvir (Listen)', onclick: () => (m.reveal.line ? speak(m.reveal.line) : sayWord(m.reveal.pt)) }, h('i', { class: 'speaker-ico', 'aria-hidden': 'true' })),
          h('b', { lang: 'pt-BR' }, m.reveal.line ?? m.reveal.pt),
          en(m.reveal.line ? `${m.reveal.pt} = ${m.reveal.en}` : m.reveal.en),
        );
  foot.replaceChildren(
    h(
      'div',
      { class: `escola-verdict ${m.correct ? 'ok' : 'no'} ${m.almost ? 'almost' : ''}`.trim(), id: 'escola-verdict', role: 'status' },
      h('div', { class: 'escola-verdict-text' }, h('strong', null, m.line.pt), en(m.line.en), reveal, m.retry ? h('small', { class: 'escola-retry-note' }, 'Ela volta no fim da lição.', en(' It comes back at the end.')) : null),
      h('button', { type: 'button', class: `primary escola-next ${m.correct ? '' : 'red'}`.trim(), id: 'escola-next', onclick: next }, bi('Continuar', 'Continue')),
    ),
  );
  $('escola-next')?.focus({ preventScroll: true });
}

function next() {
  if (!answered || waiting) return;
  waiting = true;
  actions?.next();
}

function onKey(e: KeyboardEvent) {
  if (!escolaPracticeOpen() || view !== 'lesson') return;
  const t = e.target as HTMLElement | null;
  if (t?.id === 'escola-type') return;
  if (e.key === 'Enter') {
    if (answered) next();
    else if (current?.ex.kind === 'build') submitBuild();
    else return;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  const n = Number(e.key);
  if (!answered && n >= 1 && n <= 4) {
    const btn = document.querySelectorAll<HTMLButtonElement>('#escola-options button')[n - 1];
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
}

// ---------------------------------------------------------------- the end of a lesson

function renderDone(s: EscolaSummary) {
  view = 'done';
  current = null;
  waiting = false;
  const body = $('escola-body');
  const p = game.profile;
  if (!body) return;
  const name = p?.name ?? '';
  const deep = p ? escolaHomeShows(p).deep : false;
  const title: Bilingual = s.perfect ? { pt: 'Lição perfeita!', en: 'Perfect lesson!' } : { pt: 'Aula concluída!', en: 'Lesson complete!' };
  const tile = (id: string, big: string, pt: string, enText: string, cls = '') => h('div', { class: `escola-tile-stat ${cls}`.trim(), id }, h('b', null, big), h('span', null, pt), en(enText));
  const words = s.strengthened.slice(0, 8).map((w) =>
    h(
      'li',
      { class: `escola-word ${w.to >= ESCOLA_MAX_BOX ? 'mastered' : ''}` },
      h('button', { type: 'button', class: 'escola-hear small', 'aria-label': `Ouvir ${w.pt} (Listen)`, onclick: () => sayWord(w.pt) }, h('i', { class: 'speaker-ico', 'aria-hidden': 'true' })),
      h('b', { lang: 'pt-BR' }, w.pt),
      en(w.en),
      h('span', { class: 'escola-pips', 'aria-label': `força ${w.to} de ${ESCOLA_MAX_BOX} (strength ${w.to} of ${ESCOLA_MAX_BOX})` }, ...Array.from({ length: ESCOLA_MAX_BOX }, (_, k) => h('i', { class: k < w.to ? (k >= w.from ? 'on new' : 'on') : '' }))),
    ),
  );
  body.replaceChildren(
    h(
      'div',
      { class: `escola-done ${s.perfect ? 'perfect' : ''}`.trim(), id: 'escola-done' },
      h('div', { class: 'escola-confetti', 'aria-hidden': 'true' }, ...Array.from({ length: 18 }, (_, i) => h('i', { style: `--k:${i}` }))),
      head(s.line, 'feliz'),
      h('h2', { class: 'escola-done-title' }, title.pt, en(` ${title.en}`, true)),
      h(
        'div',
        { class: 'escola-tiles' },
        tile('escola-sum-xp', `+${s.xp}`, 'XP', 'XP earned', 'xp'),
        tile('escola-sum-acc', `${s.accuracy}%`, 'Acertos', 'Accuracy', 'acc'),
        tile('escola-sum-rv', `R$ ${s.rv}`, 'RV', 'virtual RV', 'rv'),
      ),
      h(
        'div',
        { class: 'escola-done-row' },
        h(
          'div',
          { class: 'escola-stat', id: 'escola-sum-streak' },
          flame(s.streak, true),
          h('span', null, h('b', null, s.streakExtended ? 'Sequência +1!' : 'Sequência'), en(`${s.streak}-day streak`)),
          s.freezeEarned ? h('span', { class: 'escola-freeze new' }, h('i', { class: 'freeze-ico', 'aria-hidden': 'true' }), '+1', en(' streak freeze', true)) : null,
        ),
        h(
          'div',
          { class: 'escola-stat', id: 'escola-sum-goal' },
          h('span', { class: 'escola-goal-head' }, h('b', null, s.goalMet || s.dayXp >= s.goal ? 'Meta cumprida!' : 'Meta de hoje', en(s.goalMet || s.dayXp >= s.goal ? ' · Goal met!' : ' · Daily goal', true)), h('span', { class: 'escola-goal-n' }, `${s.dayXp}/${s.goal} XP`)),
          bar(s.dayXp / s.goal, s.dayXp >= s.goal ? 'met' : ''),
        ),
      ),
      deep ? tierBar(s.progress) : null,
      words.length
        ? h('div', { class: 'escola-strong' }, h('b', null, `${s.strengthened.length} palavras mais fortes`, en(` words strengthened${s.newlyMastered ? ` · ${s.newlyMastered} mastered` : ''}`, true)), h('ul', null, ...words))
        : null,
      s.granted ? h('p', { class: 'escola-granted', id: 'escola-granted' }, `Nova palavra: ${s.granted.pt}`, en(s.granted.en)) : null,
      deep && s.mission ? missionCard(s.mission) : null,
      h(
        'div',
        { class: 'escola-done-acts' },
        h('button', { type: 'button', class: 'ghost', id: 'escola-home', onclick: () => renderHome(false) }, bi('Ver o caminho', 'See the path')),
        h('button', { type: 'button', class: 'primary', id: 'escola-again', onclick: () => begin() }, bi('Mais uma lição', 'One more lesson')),
      ),
    ),
  );
  setFace('feliz');
  if (s.tierUp && s.tierUp !== 'verde') showTierUp(s.tierUp, name);
  else {
    ambience.sting(s.goalMet ? 'mission' : 'caderno');
    window.setTimeout(() => lucia(s.line), 500);
  }
}

/** The new plate: a big reveal over the end card, with Dona Lúcia's line. */
function showTierUp(t: Exclude<Nameplate, 'verde'>, name: string) {
  const panel = $('escola-practice');
  if (!panel) return;
  const rule = NAMEPLATE_TIERS.find((x) => x.tier === t)!;
  const said = LUCIA_TIER_UP[t];
  const overlay = h(
    'div',
    { class: `escola-tierup tier-${t}`, id: 'escola-tierup', role: 'dialog', 'aria-label': `Nova placa: ${tierName(t)}` },
    h('div', { class: 'escola-rays', 'aria-hidden': 'true' }),
    h('p', { class: 'escola-tierup-kicker' }, 'Nova placa!', en(' New nameplate!', true)),
    h('div', { class: 'escola-tierup-plate' }, h('div', { class: `wl-plate wl-plate-me wl-tier wl-tier-${t}` }, tierIcon(t, 'wl-tier-ico'), name)),
    h('h2', null, `Placa ${rule.pt}`, en(` ${rule.en} nameplate`, true)),
    h('p', { class: 'escola-tierup-why' }, `${rule.mastered} palavras dominadas. Todo mundo vê a sua cor.`, en(`${rule.mastered} words mastered. Everyone sees your colour. English help stays on.`)),
    line(said),
    h('button', { type: 'button', class: 'primary', id: 'escola-tierup-ok', onclick: () => overlay.remove() }, bi('Que demais!', 'Awesome!')),
  );
  panel.append(overlay);
  ambience.sting('win');
  window.setTimeout(() => lucia(said), 700);
}
