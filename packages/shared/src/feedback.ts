/**
 * In-game feedback notes ("Fala pra gente").
 *
 * A short required note, an optional kind (bug / idea / love), and — only when the player is not
 * signed in — an optional contact. The server drops contact for a live session and never stores
 * the account email. Blocked or escalated notes are not kept in the review file.
 *
 * New Portuguese below is needs_br.
 */
import { validateEmail } from './auth.js';
import { ROOMS } from './rooms.js';
import { classifyChat, type SafetyLabel, type SafetyVerdict } from './safety.js';
import type { Bilingual, RoomId } from './types.js';

export const FEEDBACK_TEXT_MIN = 8;
export const FEEDBACK_TEXT_MAX = 500;
export const FEEDBACK_CONTACT_MAX = 80;
export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'love'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export type FeedbackCode = 'empty' | 'short' | 'long' | 'category' | 'contact' | 'pii' | 'unsafe' | 'bad_request' | 'offline';

/** needs_br — player-facing copy for the Fala button and form. */
export const FEEDBACK_COPY: Record<
  | 'button'
  | 'title'
  | 'lead'
  | 'textLabel'
  | 'textPlaceholder'
  | 'kindLabel'
  | 'bug'
  | 'idea'
  | 'love'
  | 'contactLabel'
  | 'contactPlaceholder'
  | 'signedIn'
  | 'send'
  | 'thanks'
  | 'empty'
  | 'short'
  | 'long'
  | 'category'
  | 'contact'
  | 'pii'
  | 'bad_request'
  | 'offline',
  Bilingual
> = {
  button: { pt: 'Fala', en: 'Feedback' },
  title: { pt: 'Fala pra gente', en: 'A note for us' },
  lead: { pt: 'Um recado curto. A gente lê todo dia.', en: 'A short note. We read these every day.' },
  textLabel: { pt: 'O que você quer contar?', en: 'What do you want to tell us?' },
  textPlaceholder: { pt: 'A porta emperrou, uma ideia, ou só um oi.', en: 'The door stuck, an idea, or just a hello.' },
  kindLabel: { pt: 'Se quiser, marca um tipo', en: 'If you want, pick a type' },
  bug: { pt: 'Problema', en: "Something's off" },
  idea: { pt: 'Ideia', en: 'Idea' },
  love: { pt: 'Gostei', en: 'Something I love' },
  contactLabel: { pt: 'Como te achar (opcional)', en: 'How to reach you (optional)' },
  contactPlaceholder: { pt: 'E-mail ou um apelido. Só se você quiser.', en: 'An email or a nickname, only if you want.' },
  signedIn: { pt: 'Você está na sua conta. Não precisa deixar contato.', en: "You're signed in, so no need to leave a contact." },
  send: { pt: 'Mandar', en: 'Send' },
  thanks: { pt: 'Valeu! A gente lê isso todo dia.', en: 'Thanks! We read these every day.' },
  empty: { pt: 'Escreve um pouquinho, por favor.', en: 'Write a short note, please.' },
  short: { pt: 'Escreve um pouquinho, por favor.', en: 'Write a short note, please.' },
  long: { pt: 'Esse recado ficou longo demais. Encurta um pouco.', en: 'That note is too long. Shorten it a little.' },
  category: { pt: 'Escolhe problema, ideia ou gostei.', en: 'Pick a problem, an idea, or something you love.' },
  contact: { pt: 'Esse contato não parece certo.', en: "That contact doesn't look right." },
  pii: { pt: 'Deixa o contato no campo de contato, não dentro do recado.', en: 'Put a way to reach you in the contact field, not inside the note.' },
  bad_request: { pt: 'Não deu pra ler esse recado.', en: "We couldn't read that note." },
  offline: { pt: 'Não deu pra enviar agora. Tenta de novo daqui a pouco.', en: "Couldn't send just now. Try again in a moment." },
};

export interface FeedbackSubmission {
  text: string;
  category: FeedbackCategory | null;
  /** Set only for a guest. A signed-in session must store null here. */
  contact: string | null;
  room: RoomId | null;
}

export interface FeedbackFailure {
  ok: false;
  code: FeedbackCode;
  pt: string;
  en: string;
  /** Present when the note was refused for safety and should hit the moderation queue, not the review file. */
  queue?: { text: string; action: 'block' | 'escalate'; labels: string[]; rules: string[]; toxicity: number };
}

export type PreparedFeedback = { ok: true; value: FeedbackSubmission } | FeedbackFailure;

const CONTACT_SOFT: ReadonlySet<SafetyLabel> = new Set(['pii', 'off_platform_contact']);

function fail(code: FeedbackCode, queue?: FeedbackFailure['queue']): FeedbackFailure {
  const copy = FEEDBACK_COPY[code as keyof typeof FEEDBACK_COPY];
  const note = copy && 'pt' in copy ? copy : FEEDBACK_COPY.bad_request;
  return queue ? { ok: false, code, ...note, queue } : { ok: false, code, ...note };
}

function safetyQueue(text: string, verdict: SafetyVerdict): FeedbackFailure['queue'] {
  if (verdict.action !== 'block' && verdict.action !== 'escalate') return undefined;
  return { text, action: verdict.action, labels: verdict.labels, rules: verdict.rules, toxicity: verdict.toxicity };
}

/** Collapse control characters and extra blank lines. Does not rewrite words. */
export function cleanFeedbackText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function asCategory(v: unknown): FeedbackCategory | null | 'bad' {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return 'bad';
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(v) ? (v as FeedbackCategory) : 'bad';
}

function asRoom(v: unknown): RoomId | null {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return null;
  return v in ROOMS ? (v as RoomId) : null;
}

/** A guest contact: an email, or a short name. Empty means they skipped it. */
export function parseFeedbackContact(raw: unknown): { ok: true; contact: string | null } | FeedbackFailure {
  if (raw == null || raw === '') return { ok: true, contact: null };
  if (typeof raw !== 'string') return fail('contact');
  const contact = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!contact) return { ok: true, contact: null };
  if (contact.length > FEEDBACK_CONTACT_MAX) return fail('contact');
  if (/https?:|www\.|\/\//i.test(contact)) return fail('contact');
  if (contact.includes('@')) {
    const email = validateEmail(contact);
    if (!email.ok || email.value.length > FEEDBACK_CONTACT_MAX) return fail('contact');
    return { ok: true, contact: email.value };
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .'+_()-]{1,79}$/u.test(contact)) return fail('contact');
  return { ok: true, contact };
}

function softContactOnly(verdict: SafetyVerdict): boolean {
  return verdict.labels.length > 0 && verdict.labels.every((label) => CONTACT_SOFT.has(label));
}

/**
 * Structural checks plus the chat safety filter.
 * Personal data inside the note is refused (use the contact field). A contact that is only an
 * email or phone is allowed. Slurs, sexual content and other blocks are not stored.
 */
export function prepareFeedback(input: unknown): PreparedFeedback {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('bad_request');
  const body = input as Record<string, unknown>;
  if (typeof body.text !== 'string') return fail('bad_request');
  const text = cleanFeedbackText(body.text);
  if (!text) return fail('empty');
  if (text.length < FEEDBACK_TEXT_MIN) return fail('short');
  if (text.length > FEEDBACK_TEXT_MAX) return fail('long');

  const category = asCategory(body.category);
  if (category === 'bad') return fail('category');

  const contact = parseFeedbackContact(body.contact);
  if (!contact.ok) return contact;

  const textVerdict = classifyChat(text);
  if (textVerdict.action === 'block' || textVerdict.action === 'escalate') {
    if (softContactOnly(textVerdict)) return fail('pii');
    const note = textVerdict.note ?? FEEDBACK_COPY.bad_request;
    return { ok: false, code: 'unsafe', pt: note.pt, en: note.en, queue: safetyQueue(text, textVerdict) };
  }

  if (contact.contact) {
    const contactVerdict = classifyChat(contact.contact);
    if ((contactVerdict.action === 'block' || contactVerdict.action === 'escalate') && !softContactOnly(contactVerdict)) {
      const note = contactVerdict.note ?? FEEDBACK_COPY.contact;
      return { ok: false, code: 'unsafe', pt: note.pt, en: note.en, queue: safetyQueue(contact.contact, contactVerdict) };
    }
  }

  return { ok: true, value: { text, category, contact: contact.contact, room: asRoom(body.room) } };
}
