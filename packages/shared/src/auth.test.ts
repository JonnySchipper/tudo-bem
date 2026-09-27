import { describe, expect, it } from 'vitest';
import { normalizeEmail, validateEmail } from './auth.js';

describe('email validation (shared by register, login and the intro form)', () => {
  it('accepts plus-addressing and other common valid shapes', () => {
    for (const e of ['name+tag@domain.com', 'Ana+Teste@Exemplo.com', 'first.last@sub.example.com.br', 'a_b-c@x.io']) {
      expect(validateEmail(e), e).toMatchObject({ ok: true, value: normalizeEmail(e) });
    }
  });

  it('keeps the +tag when normalizing (only trims and lowercases)', () => {
    expect(normalizeEmail('  Name+Tag@Domain.COM ')).toBe('name+tag@domain.com');
  });

  it('rejects malformed addresses', () => {
    for (const e of ['', 'plain', 'no@tld', 'a@b.c', 'two@@at.com', 'sp ace@x.com']) expect(validateEmail(e).ok, e).toBe(false);
  });
});
