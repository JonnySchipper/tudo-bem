/**
 * The top bar's stats explain themselves: a click (or Enter) on the belt, the nameplate or today's goal opens a small note saying what it
 * is and how it grows (the same note as the RV balance's, ui/desembarqueTutorial.ts). The words are in ui/hudNotesData.ts.
 */
import { h, ui } from './dom';
import { HUD_NOTES, type HudNoteId } from './hudNotesData';

export function openHudNote(id: HudNoteId): void {
  const n = HUD_NOTES[id];
  document.querySelectorAll('.tb-note').forEach((el) => el.remove());
  const close = () => note.remove();
  const ok = h('button', { type: 'button', class: 'primary', id: 'hud-note-ok', onclick: close }, 'Entendi!', h('span', { class: 'en' }, ' · Got it'));
  const note = h(
    'div',
    { class: 'tb-note', id: `hud-note-${id}`, role: 'dialog', 'aria-label': n.title.en },
    h('h3', null, `${n.title.en} · `, h('span', { lang: 'pt-BR' }, n.title.pt)),
    h('ul', null, ...n.lines.map((l) => h('li', null, l.en, l.pt ? h('span', { lang: 'pt-BR' }, l.pt) : null))),
    n.note ? h('p', { class: 'tb-note-small' }, n.note) : null,
    h('div', { class: 'tb-note-foot' }, ok),
  );
  note.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  ui().append(note);
  ok.focus({ preventScroll: true });
}

/** Make a top-bar stat a button that opens its note (once per element). */
export function wireHudNote(el: HTMLElement, id: HudNoteId, label: string): void {
  if (el.dataset.note) return;
  el.dataset.note = id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', label);
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => openHudNote(id));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openHudNote(id);
    }
  });
}
