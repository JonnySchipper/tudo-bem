/**
 * The arrivals hall's guided tutorial (`ROOMS.desembarque`, the first room of a new account). One step at a time, in English with the
 * Portuguese beside it: a card in the tracker's corner says what to do and how (on a computer or a phone), an arrow in the world or a
 * pulse on the HUD button shows where, and the step waits until the player has done it. Skip from the card; replay from Ajustes → Tutorial.
 *
 * The steps live in `desembarqueLogic.ts` (pure). The page reports what happened through `markDesembStep` (main.ts: a walk, a talk, a
 * sign, a chat line or a wave, the door). The door is never locked. Progress is per profile in localStorage; the server only keeps
 * `desembarqueDone`, set when the player walks out of the door (so the next login goes on to the airport).
 */
import { game } from '../state';
import { ambience } from '../ambience';
import { h, ui } from './dom';
import { toast } from './hud';
import { COMPACT_QUERY, placeHud } from './hudLayout';
import { DESEMB_STEPS, desembDone, nextDesembStep, type DesembFlags, type DesembGuide, type DesembStepId } from './desembarqueLogic';

export { DESEMB_STEPS } from './desembarqueLogic';

const flagKey = () => `tb_desemb:${game.profile?.id ?? 'guest'}`;
let flags: DesembFlags = {};
let flagsFor = '';

function currentFlags(): DesembFlags {
  if (flagsFor !== flagKey()) {
    try {
      flags = JSON.parse(localStorage.getItem(flagKey()) ?? '{}') as DesembFlags;
    } catch {
      flags = {};
    }
    flagsFor = flagKey();
  }
  return flags;
}

function save() {
  try {
    localStorage.setItem(flagKey(), JSON.stringify(flags));
  } catch {
    /* private mode: the steps still count for this visit */
  }
}

export const inDesembarque = (): boolean => game.room?.room === 'desembarque';

let refreshCard: (() => void) | null = null;
let stepped: (() => void) | null = null;

/** Something the tutorial asks for happened. Steps count only in the arrivals hall (the door counts on the way out of it). */
export function markDesembStep(id: DesembStepId): void {
  if (!inDesembarque() && id !== 'porta') return;
  const f = currentFlags();
  if (f[id]) return;
  f[id] = true;
  save();
  refreshCard?.();
  stepped?.();
}

/** Start over (Ajustes → Tutorial): every step undone. */
export function resetDesembTutorial(): void {
  flags = {};
  flagsFor = flagKey();
  save();
  refreshCard?.();
}

/** The arrow for the current step, or null outside the hall and on a HUD step. */
export function desembGuide(): DesembGuide | null {
  if (!inDesembarque()) return null;
  return nextDesembStep(desembDone(currentFlags()))?.guide ?? null;
}

const phone = () => window.matchMedia(COMPACT_QUERY).matches || window.matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------- skip

function confirmSkip(skip: () => void) {
  document.getElementById('desemb-skip-note')?.remove();
  const note = h(
    'div',
    { class: 'tb-note', id: 'desemb-skip-note', role: 'dialog', 'aria-label': 'Skip the tutorial?' },
    h('h3', null, 'Skip the tutorial?'),
    h('p', null, 'You can play it again any time from Ajustes (the gear) → Tutorial.'),
    h(
      'div',
      { class: 'tb-note-foot' },
      h('button', { type: 'button', onclick: () => note.remove() }, 'Keep going'),
      h(
        'button',
        {
          type: 'button',
          class: 'primary',
          id: 'desemb-skip-yes',
          onclick: () => {
            note.remove();
            for (const s of DESEMB_STEPS) currentFlags()[s.id] = true;
            save();
            skip();
          },
        },
        'Skip',
      ),
    ),
  );
  ui().append(note);
}

// ---------------------------------------------------------------- the card

export interface DesembHooks {
  /** A step ticked (main.ts moves the guide arrow on). */
  onStep: () => void;
  /** Skip: the server's flag, and on to the airport. */
  skip: () => void;
}

export function mountDesembTutorial(hooks: DesembHooks): { refresh: () => void } {
  stepped = hooks.onStep;
  const head = h('button', { class: 'rtrack-head aero-tut-head', type: 'button', 'aria-expanded': 'true', title: 'Tutorial — show or hide' });
  const bar = h('div', { class: 'desemb-bar', 'aria-hidden': 'true' }, h('i'));
  const now = h('div', { class: 'aero-tut-now desemb-now', 'aria-live': 'polite' });
  const skipBtn = h('button', { type: 'button', class: 'desemb-skip', id: 'desemb-skip' }, 'Skip tutorial');
  const foot = h('div', { class: 'desemb-foot' }, h('span', { class: 'en' }, 'Replay: Ajustes → Tutorial'), skipBtn);
  const el = h('section', { class: 'rtrack aero-tut desemb-tut', id: 'desemb-tut', role: 'region', 'aria-label': 'Tutorial' }, head, bar, now, foot);
  ui().append(el);
  skipBtn.addEventListener('click', () => confirmSkip(hooks.skip));
  let folded = false;
  let prev: Set<DesembStepId> | null = null;
  let pulsing: string | null = null;
  head.addEventListener('click', () => {
    folded = !folded;
    render();
  });
  const pulse = (sel: string | null) => {
    if (pulsing === sel) return;
    if (pulsing) for (const b of document.querySelectorAll(pulsing)) b.classList.remove('tut-pulse');
    pulsing = sel;
    if (sel) for (const b of document.querySelectorAll(sel)) b.classList.add('tut-pulse');
  };

  const render = () => {
    const here = inDesembarque() && !!game.profile;
    document.body.classList.toggle('in-desembarque', here);
    const done = desembDone(currentFlags());
    const next = nextDesembStep(done);
    if (!here || !next) {
      el.hidden = true;
      pulse(null);
      prev = here ? done : null;
      placeHud();
      return;
    }
    if (prev) {
      for (const s of DESEMB_STEPS) {
        if (!done.has(s.id) || prev.has(s.id)) continue;
        toast('reward', `✓ ${s.en}`, s.pt);
        ambience.sting('recado');
      }
    }
    prev = done;
    el.hidden = false;
    el.classList.toggle('collapsed', folded);
    head.setAttribute('aria-expanded', String(!folded));
    const n = DESEMB_STEPS.indexOf(next) + 1;
    head.replaceChildren(
      h('span', { class: 'aero-tut-plane', 'aria-hidden': 'true' }, '✈'),
      h('b', null, 'Welcome!'),
      h('small', null, `Step ${n} of ${DESEMB_STEPS.length}`),
      h('span', { class: 'rtrack-caret', 'aria-hidden': 'true' }),
    );
    (bar.firstElementChild as HTMLElement).style.width = `${Math.round((done.size / DESEMB_STEPS.length) * 100)}%`;
    now.replaceChildren(
      h('span', { class: 'aero-tut-n' }, String(n)),
      h(
        'span',
        { class: 'aero-tut-text' },
        h('b', null, next.en),
        h('span', { class: 'desemb-pt', lang: 'pt-BR' }, next.pt),
        h('span', { class: 'desemb-how' }, phone() && next.phone ? next.phone : next.how),
      ),
    );
    now.setAttribute('data-step', next.id);
    pulse(next.hud ?? null);
    placeHud();
  };
  refreshCard = render;
  game.on('profile', render);
  game.on('room', render);
  game.on('hud', render);
  window.matchMedia(COMPACT_QUERY).addEventListener('change', render);
  render();
  return { refresh: render };
}
