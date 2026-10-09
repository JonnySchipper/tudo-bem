/**
 * "Fala pra gente" — a short note from the live HUD. Posts to /api/feedback.
 * Signed-in players are not asked for a contact (the session cookie is enough, and the server
 * does not store the account email). Guests may leave an optional email or nickname.
 */
import { FEEDBACK_CATEGORIES, FEEDBACK_COPY, FEEDBACK_TEXT_MAX, prepareFeedback, type FeedbackCategory } from '@tudobem/shared';
import { readAuthSession } from '../auth/session';
import { game } from '../state';
import { h, en } from './dom';
import { closeModal, openModal } from './modal.js';

const KIND: Record<FeedbackCategory, { pt: string; en: string }> = {
  bug: FEEDBACK_COPY.bug,
  idea: FEEDBACK_COPY.idea,
  love: FEEDBACK_COPY.love,
};

function signedIn(): boolean {
  return !game.solo && !!readAuthSession();
}

async function postFeedback(body: { text: string; category: FeedbackCategory | null; contact?: string; room?: string }): Promise<{ ok: true } | { ok: false; pt: string; en: string }> {
  let res: Response;
  try {
    res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, ...FEEDBACK_COPY.offline };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (data && typeof data === 'object' && 'ok' in data && (data as { ok: boolean }).ok === true) return { ok: true };
  if (data && typeof data === 'object' && 'pt' in data && typeof (data as { pt: unknown }).pt === 'string') {
    const row = data as { pt: string; en?: string };
    return { ok: false, pt: row.pt, en: row.en ?? FEEDBACK_COPY.offline.en };
  }
  return { ok: false, ...FEEDBACK_COPY.offline };
}

/** A small glyph per kind, drawn in CSS blocks (styles/panels.css) so the buttons read at a glance. */
function kindGlyph(id: FeedbackCategory): HTMLElement {
  return h('i', { class: `feedback-glyph glyph-${id}`, 'aria-hidden': 'true' });
}

function thanks(category: FeedbackCategory | null) {
  const done = h('button', { class: 'primary feedback-send', id: 'feedback-thanks-close', type: 'button', onclick: () => close() }, 'Fechar', en('Close', true));
  const close = openModal(
    'feedback-thanks',
    h(
      'div',
      { class: 'panel feedback-panel feedback-thanks', role: 'dialog', 'aria-labelledby': 'feedback-thanks-title' },
      h('button', { class: 'close ghost', type: 'button', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      // the note goes into the envelope and gets the kind as its seal
      h('div', { class: 'feedback-letter', 'aria-hidden': 'true' }, h('i', { class: 'letter-note' }), h('i', { class: 'letter-env' }), h('i', { class: 'letter-flap' }), h('span', { class: 'letter-seal' }, kindGlyph(category ?? 'love'))),
      h('h2', { id: 'feedback-thanks-title' }, FEEDBACK_COPY.thanksTitle.pt),
      en(FEEDBACK_COPY.thanksTitle.en),
      h('p', { class: 'feedback-lead' }, FEEDBACK_COPY.thanks.pt, en(FEEDBACK_COPY.thanks.en)),
      done,
    ),
  );
  queueMicrotask(() => done.focus());
}

/** Open the feedback form. Safe to call from the HUD button. */
export function openFeedback(): void {
  const known = signedIn();
  let category: FeedbackCategory | null = null;
  const err = h('p', { class: 'feedback-err', id: 'feedback-err', hidden: true, role: 'alert' });
  const text = h('textarea', {
    id: 'feedback-text',
    class: 'feedback-field',
    maxlength: String(FEEDBACK_TEXT_MAX),
    rows: '4',
    required: true,
    placeholder: FEEDBACK_COPY.textPlaceholder.pt,
    'aria-label': `${FEEDBACK_COPY.textLabel.pt} (${FEEDBACK_COPY.textLabel.en})`,
  }) as HTMLTextAreaElement;
  const contact = known
    ? null
    : (h('input', {
        id: 'feedback-contact',
        class: 'feedback-field',
        type: 'text',
        maxlength: '80',
        autocomplete: 'email',
        placeholder: FEEDBACK_COPY.contactPlaceholder.pt,
        'aria-label': `${FEEDBACK_COPY.contactLabel.pt} (${FEEDBACK_COPY.contactLabel.en})`,
      }) as HTMLInputElement);

  const cats = FEEDBACK_CATEGORIES.map((id) => {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'feedback-cat',
        'data-feedback-cat': id,
        'aria-pressed': 'false',
        onclick: () => {
          category = category === id ? null : id;
          for (const other of cats) other.setAttribute('aria-pressed', other === btn && category === id ? 'true' : 'false');
        },
      },
      kindGlyph(id),
      h('b', null, KIND[id].pt),
      h('i', null, KIND[id].en),
    );
    return btn;
  });

  const count = h('span', { class: 'feedback-count', id: 'feedback-count', 'aria-hidden': 'true' }, `0/${FEEDBACK_TEXT_MAX}`);
  text.addEventListener('input', () => {
    count.textContent = `${text.value.length}/${FEEDBACK_TEXT_MAX}`;
    count.classList.toggle('near', text.value.length > FEEDBACK_TEXT_MAX - 50);
  });

  const send = h('button', { class: 'primary feedback-send', id: 'feedback-send', type: 'button' }, FEEDBACK_COPY.send.pt, en(FEEDBACK_COPY.send.en, true));

  const showErr = (pt: string, enText: string) => {
    err.hidden = false;
    err.replaceChildren(document.createTextNode(pt), en(enText));
  };

  let busy = false;
  const submit = async () => {
    if (busy) return;
    err.hidden = true;
    const draft = {
      text: text.value,
      category,
      contact: contact?.value ?? null,
      room: game.room?.room ?? null,
    };
    const prepared = prepareFeedback(known ? { ...draft, contact: null } : draft);
    if (!prepared.ok) {
      showErr(prepared.pt, prepared.en);
      text.focus();
      return;
    }
    busy = true;
    send.setAttribute('disabled', '');
    const result = await postFeedback({
      text: prepared.value.text,
      category: prepared.value.category,
      ...(known ? {} : prepared.value.contact ? { contact: prepared.value.contact } : {}),
      ...(prepared.value.room ? { room: prepared.value.room } : {}),
    });
    busy = false;
    send.removeAttribute('disabled');
    if (!result.ok) {
      showErr(result.pt, result.en);
      return;
    }
    thanks(prepared.value.category);
  };
  send.addEventListener('click', () => void submit());
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  });

  const panel = h(
    'div',
    { class: 'panel feedback-panel', role: 'dialog', 'aria-labelledby': 'feedback-title' },
    h('button', { class: 'close ghost', type: 'button', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
    h('h2', { id: 'feedback-title', class: 'feedback-title' }, h('i', { class: 'fala-bubble', 'aria-hidden': 'true' }), FEEDBACK_COPY.title.pt),
    en(FEEDBACK_COPY.title.en),
    h('p', { class: 'feedback-lead' }, FEEDBACK_COPY.lead.pt, en(FEEDBACK_COPY.lead.en)),
    h('label', { class: 'feedback-label', for: 'feedback-text' }, FEEDBACK_COPY.textLabel.pt, en(FEEDBACK_COPY.textLabel.en, true)),
    h('div', { class: 'feedback-note' }, text, count),
    h('p', { class: 'feedback-label', id: 'feedback-kind-label' }, FEEDBACK_COPY.kindLabel.pt, en(FEEDBACK_COPY.kindLabel.en, true)),
    h('div', { class: 'feedback-cats', role: 'group', 'aria-labelledby': 'feedback-kind-label' }, ...cats),
    known
      ? h('p', { class: 'feedback-signed', id: 'feedback-signed' }, FEEDBACK_COPY.signedIn.pt, en(FEEDBACK_COPY.signedIn.en, true))
      : h('label', { class: 'feedback-label', for: 'feedback-contact' }, FEEDBACK_COPY.contactLabel.pt, en(FEEDBACK_COPY.contactLabel.en, true)),
    contact,
    err,
    send,
  );
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') e.stopPropagation();
  });
  const close = openModal('feedback', panel);
  queueMicrotask(() => text.focus());
}
