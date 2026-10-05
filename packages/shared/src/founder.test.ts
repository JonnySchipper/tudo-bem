import { describe, expect, it } from 'vitest';
import { normalizeFounderFlag } from './founder.js';

describe('founder badge flag', () => {
  it('backfills legacy saves as founders', () => {
    expect(normalizeFounderFlag(undefined)).toBe(true);
  });
  it('keeps an explicit false for accounts created after grants were disabled', () => {
    expect(normalizeFounderFlag(false)).toBe(false);
  });
});
