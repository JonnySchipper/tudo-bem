import { describe, expect, it } from 'vitest';
import { INTRO_TITLE_BEAT_MS } from './introTitleBeat';

describe('intro title beat', () => {
  it('stays within TB Art brief window (2–4s)', () => {
    expect(INTRO_TITLE_BEAT_MS).toBeGreaterThanOrEqual(2000);
    expect(INTRO_TITLE_BEAT_MS).toBeLessThanOrEqual(4000);
  });
});
