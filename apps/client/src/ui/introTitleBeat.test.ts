import { describe, expect, it } from 'vitest';
import { INTRO_TITLE_BEAT_MS } from './introTitleBeat';

describe('intro title beat', () => {
  it('holds ~4.4s (brief 2–4s + Art golden-hour delta +1s), still skippable', () => {
    expect(INTRO_TITLE_BEAT_MS).toBeGreaterThanOrEqual(4000);
    expect(INTRO_TITLE_BEAT_MS).toBeLessThanOrEqual(5000);
  });
});
