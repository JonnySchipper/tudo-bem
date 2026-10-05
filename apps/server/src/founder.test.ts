import { describe, expect, it } from 'vitest';
import { founderGrantNewEnabled } from './founder.js';

describe('founder grant env', () => {
  it('grants by default', () => {
    expect(founderGrantNewEnabled({})).toBe(true);
    expect(founderGrantNewEnabled({ TB_FOUNDER_GRANT_NEW: '1' })).toBe(true);
  });
  it('stops new grants when TB_FOUNDER_GRANT_NEW is off', () => {
    expect(founderGrantNewEnabled({ TB_FOUNDER_GRANT_NEW: '0' })).toBe(false);
    expect(founderGrantNewEnabled({ TB_FOUNDER_GRANT_NEW: 'false' })).toBe(false);
    expect(founderGrantNewEnabled({ TB_FOUNDER_GRANT_NEW: 'off' })).toBe(false);
  });
});
