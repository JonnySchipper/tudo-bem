import { describe, expect, it } from 'vitest';
import { FEEDBACK_COPY, FEEDBACK_TEXT_MAX, prepareFeedback } from './feedback.js';

const NOTE = 'A porta da padaria não abre direito.';

describe('prepareFeedback', () => {
  it('keeps a short note and an optional kind', () => {
    const got = prepareFeedback({ text: `  ${NOTE}  `, category: 'bug', room: 'padaria' });
    expect(got).toEqual({ ok: true, value: { text: NOTE, category: 'bug', contact: null, room: 'padaria' } });
  });

  it('accepts idea, love, or no kind, and drops an unknown room', () => {
    expect(prepareFeedback({ text: NOTE, category: 'love' })).toMatchObject({ ok: true, value: { category: 'love', room: null } });
    expect(prepareFeedback({ text: NOTE, category: 'idea', room: 'mars' })).toMatchObject({ ok: true, value: { category: 'idea', room: null } });
    expect(prepareFeedback({ text: NOTE })).toMatchObject({ ok: true, value: { category: null } });
  });

  it('requires a short note and refuses a novel', () => {
    expect(prepareFeedback({ text: '   ' })).toMatchObject({ ok: false, code: 'empty' });
    expect(prepareFeedback({ text: 'curto' })).toMatchObject({ ok: false, code: 'short' });
    expect(prepareFeedback({ text: 'a'.repeat(FEEDBACK_TEXT_MAX + 1) })).toMatchObject({ ok: false, code: 'long' });
    expect(prepareFeedback({})).toMatchObject({ ok: false, code: 'bad_request' });
    expect(prepareFeedback({ text: NOTE, category: 'rant' })).toMatchObject({ ok: false, code: 'category' });
  });

  it('lets a guest leave an email or a nickname, and refuses a link', () => {
    expect(prepareFeedback({ text: NOTE, contact: '  Ana.Souza@Exemplo.com ' })).toMatchObject({
      ok: true,
      value: { contact: 'ana.souza@exemplo.com' },
    });
    expect(prepareFeedback({ text: NOTE, contact: 'João' })).toMatchObject({ ok: true, value: { contact: 'João' } });
    expect(prepareFeedback({ text: NOTE, contact: '   ' })).toMatchObject({ ok: true, value: { contact: null } });
    expect(prepareFeedback({ text: NOTE, contact: 'https://exemplo.com/oi' })).toMatchObject({ ok: false, code: 'contact' });
    expect(prepareFeedback({ text: NOTE, contact: 'x' })).toMatchObject({ ok: false, code: 'contact' });
  });

  it('refuses personal data inside the note and points at the contact field', () => {
    const got = prepareFeedback({ text: 'Me escreve em foo@bar.com por favor.' });
    expect(got).toMatchObject({ ok: false, code: 'pii', pt: FEEDBACK_COPY.pii.pt });
    expect(got).not.toHaveProperty('queue');
  });

  it('does not keep an insult, and marks it for the moderation queue', () => {
    const got = prepareFeedback({ text: 'você é um idiota' });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.code).toBe('unsafe');
    expect(got.queue?.action).toBe('block');
    expect(got.queue?.text).toBe('você é um idiota');
  });

  it('allows a warm note about the neighborhood', () => {
    expect(prepareFeedback({ text: 'Gostei muito da praça e do Seu Carlos.', category: 'love' })).toMatchObject({
      ok: true,
      value: { category: 'love' },
    });
  });
});
