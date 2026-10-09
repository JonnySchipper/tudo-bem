import { describe, expect, it } from 'vitest';
import { showSupportButton } from './supportGate';

describe('Apoiar button gate', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  it('stays hidden while billing is off and the player has nothing to manage', () => {
    expect(showSupportButton(false, null, now)).toBe(false);
    expect(showSupportButton(false, { status: 'expired', currentPeriodEnd: now - 1000 } as never, now)).toBe(false);
  });
  it('shows when the server says checkout is ready', () => {
    expect(showSupportButton(true, null, now)).toBe(true);
  });
  it('shows for a player with live perks (pets, bubbles) even while billing is off', () => {
    expect(showSupportButton(false, { status: 'active', currentPeriodEnd: now + 86_400_000 } as never, now)).toBe(true);
  });
});
