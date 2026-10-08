import { describe, expect, it } from 'vitest';
import { classifyChat } from './safety.js';
import {
  PET_NAME_SUGGESTIONS,
  normalizePetNames,
  petNameDecision,
  suggestPetName,
  validatePetName,
  visiblePetName,
} from './petName.js';

describe('pet name shape', () => {
  it('trims, keeps accents, spaces, hyphen and apostrophe, and allows a single letter', () => {
    expect(validatePetName('  Paçoca  ')).toEqual({ ok: true, name: 'Paçoca' });
    expect(validatePetName('João-Pedro')).toEqual({ ok: true, name: 'João-Pedro' });
    expect(validatePetName("D'água")).toEqual({ ok: true, name: "D'água" });
    expect(validatePetName('Ana  Maria')).toEqual({ ok: true, name: 'Ana Maria' });
    expect(validatePetName('’Mel’')).toEqual({ ok: true, name: "'Mel'" });
    expect(validatePetName('É')).toEqual({ ok: true, name: 'É' });
    expect(validatePetName('A'.repeat(16)).ok).toBe(true);
  });

  it('rejects empty, too long, digits, and symbols', () => {
    expect(validatePetName('   ').ok).toBe(false);
    expect(validatePetName('').ok).toBe(false);
    expect(validatePetName('-').ok).toBe(false);
    expect(validatePetName("''").ok).toBe(false);
    expect(validatePetName('A'.repeat(17)).ok).toBe(false);
    expect(validatePetName('Rex2').ok).toBe(false);
    expect(validatePetName('Oi!').ok).toBe(false);
    expect(validatePetName('cão_1').ok).toBe(false);
    expect(validatePetName('<b>').ok).toBe(false);
  });

  it('suggests only names that fit the shape, and skips the one already in the box', () => {
    for (const name of PET_NAME_SUGGESTIONS) expect(validatePetName(name), name).toEqual({ ok: true, name });
    const seq = [0, 0.99, 0.5];
    let i = 0;
    expect(suggestPetName(() => seq[i++] ?? 0)).toBe(PET_NAME_SUGGESTIONS[0]);
    expect(suggestPetName(() => 0, 'Caramelo')).toBe('Paçoca');
  });

  it('keeps a well-shaped stored name and drops junk, without inventing a replacement', () => {
    expect(normalizePetNames({ dog: '  Mel  ', cat: 'Rex2', bird: 'Loro' })).toEqual({ dog: 'Mel' });
    expect(normalizePetNames({ cat: 'Pipoca' })).toEqual({ cat: 'Pipoca' });
    expect(normalizePetNames(null)).toBeUndefined();
    expect(normalizePetNames({ dog: '!!!' })).toBeUndefined();
  });

  it('shows a name only for the pet that is out while the subscription is active', () => {
    const names = { dog: 'Caramelo', cat: 'Pipoca' };
    expect(visiblePetName('dog', names, true)).toBe('Caramelo');
    expect(visiblePetName('cat', names, true)).toBe('Pipoca');
    expect(visiblePetName('dog', names, false)).toBeNull();
    expect(visiblePetName(null, names, true)).toBeNull();
    expect(visiblePetName('cat', { dog: 'Caramelo' }, true)).toBeNull();
  });
});

describe('pet name moderation decision', () => {
  it('saves the trimmed name only when the verdict is allow, and never a rewritten string', () => {
    expect(petNameDecision('  Caramelo  ', { action: 'allow' })).toEqual({ ok: true, name: 'Caramelo' });
    const blocked = petNameDecision('  Merda  ', {
      action: 'block',
      note: { pt: 'Sem palavrão, por favor!', en: 'No swearing, please!' },
    });
    expect(blocked).toEqual({ ok: false, name: 'Merda', reason: { pt: 'Sem palavrão, por favor!', en: 'No swearing, please!' } });
    if (!blocked.ok) expect(blocked.name).toBe('Merda');
  });

  it('rejects warn and escalate too, and does not invent a cleaner name', () => {
    const warn = petNameDecision('Pelada', { action: 'warn', note: { pt: 'Esse não.', en: 'Not that one.' } });
    expect(warn.ok).toBe(false);
    if (!warn.ok) expect(warn.name).toBe('Pelada');
    const held = petNameDecision('Pelada', { action: 'escalate', note: { pt: 'Revisão.', en: 'Review.' } });
    expect(held.ok).toBe(false);
    if (!held.ok) expect(held.name).toBe('Pelada');
    expect(petNameDecision('Rex2', { action: 'allow' }).ok).toBe(false);
    const shape = petNameDecision('Rex2', { action: 'allow' });
    if (!shape.ok) expect(shape.name).toBe('');
  });

  it('the suggested names are clean under the chat word filter', () => {
    for (const name of PET_NAME_SUGGESTIONS) expect(classifyChat(name).action, name).toBe('allow');
  });
});
