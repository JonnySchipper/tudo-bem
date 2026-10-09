import { describe, expect, it } from 'vitest';
import { HUD_NOTES, hudShows } from './hudNotesData';

describe('the top bar explains itself', () => {
  it('has a note for every stat, in English with a short title in both languages', () => {
    for (const n of Object.values(HUD_NOTES)) {
      expect(n.title.pt.length, n.id).toBeGreaterThan(2);
      expect(n.title.en.length, n.id).toBeGreaterThan(2);
      expect(n.lines.length, n.id).toBeGreaterThanOrEqual(2);
      for (const l of n.lines) expect(l.en.length, n.id).toBeGreaterThan(10);
    }
  });

  it('names every nameplate colour after green in the plate note', () => {
    const text = HUD_NOTES.plate.lines.map((l) => l.en).join(' ');
    for (const c of ['Yellow', 'Blue', 'Purple', 'Gold']) expect(text).toContain(c);
  });
});

describe('what the top bar shows', () => {
  it('keeps the arrivals hall and the airport to what their steps teach', () => {
    const hall = hudShows({ desembarqueDone: false, arrivalIntroDone: false });
    expect(hall).toEqual({ belt: false, plate: false, goal: false, cartela: false, vila: false });
    const airport = hudShows({ desembarqueDone: true, arrivalIntroDone: false });
    expect(airport.cartela).toBe(false);
    expect(airport.vila).toBe(false);
  });

  it('shows the Cartela once Célia hands it over, and the Vila buttons in the Vila', () => {
    const vila = hudShows({ desembarqueDone: true, arrivalIntroDone: true });
    expect(vila).toMatchObject({ plate: true, goal: true, cartela: true, vila: true });
    // accounts from before the arrival tutorial have neither flag: they are residents
    expect(hudShows({})).toMatchObject({ cartela: true, vila: true });
  });

  it('shows the belt only once there is a gi (test profiles always see theirs)', () => {
    expect(hudShows({ giOwned: false }).belt).toBe(false);
    expect(hudShows({ giOwned: true }).belt).toBe(true);
    expect(hudShows({ testUser: true }).belt).toBe(true);
  });
});
