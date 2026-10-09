import { describe, expect, it } from 'vitest';
import { FLIGHT_CABIN, collectSpokenLines, flightSpokenLines, letterGreeting } from '@tudobem/shared';
import { flightScale, irisRadius } from './flightIntroLogic';

describe('the flight-in cutscene', () => {
  it('scales the pixel canvas by whole numbers that fit the art', () => {
    expect(flightScale(1920, 1080, 150, 130)).toBe(7);
    expect(flightScale(390, 844, 150, 130)).toBe(3);
    expect(flightScale(320, 200, 150, 150)).toBe(1);
    expect(flightScale(100, 100, 150, 150)).toBe(1);
  });

  it('opens the iris past the farthest corner and closes it to nothing', () => {
    expect(irisRadius(0, 200, 100, 0.5, 0.5)).toBe(0);
    expect(irisRadius(1, 200, 100, 0, 0)).toBeGreaterThan(Math.hypot(200, 100));
    expect(irisRadius(2, 200, 100, 0.5, 0.5)).toBe(irisRadius(1, 200, 100, 0.5, 0.5));
  });

  it('asks questions the player can answer, and Lia answers every reply', () => {
    const asks = FLIGHT_CABIN.filter((b) => b.kind === 'ask');
    expect(asks.length).toBeGreaterThanOrEqual(3);
    for (const b of asks) {
      expect(b.replies.length).toBeGreaterThanOrEqual(2);
      for (const r of b.replies) expect(r.react.pt && r.react.en && r.pt && r.en).toBeTruthy();
    }
    // the captain calls the descent at the end
    expect(FLIGHT_CABIN.at(-1)!.kind).toBe('captain');
  });

  it('voices every Portuguese line, and the spoken list feeds pnpm tts', () => {
    const spoken = collectSpokenLines();
    for (const l of flightSpokenLines()) expect(spoken.some((s) => s.speaker === l.speaker && s.text === l.text)).toBe(true);
    expect(flightSpokenLines().some((l) => l.speaker === 'comandante')).toBe(true);
  });

  it('greets the player by name in Júlia’s letter', () => {
    expect(letterGreeting('Bia')).toBe('Oi, Bia!');
    expect(letterGreeting('  ')).toBe('Oi!');
  });
});
