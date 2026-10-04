import { describe, expect, it } from 'vitest';
import { ARRIVAL_SIGNS, DIARY_WORDS } from '@tudobem/shared';
import { HALL_H, HALL_OBJECTS, HALL_SIGN_PLACES, HALL_W, outlined } from './arrivalHallLayout';
import { HALL_ART, HALL_PAL } from './arrivalHallArt';

const hallCamera = DIARY_WORDS.filter((w) => w.source === 'camera' && w.area === 'chegada');
const hallReading = DIARY_WORDS.filter((w) => w.source === 'reading' && w.area === 'chegada' && w.anchor.id.startsWith('hall_s_'));

describe('the airport hall of the arrival', () => {
  it('has a place and a picture for each of the fourteen camera words, and nothing else', () => {
    expect(hallCamera).toHaveLength(14);
    expect(HALL_OBJECTS.map((o) => o.id).sort()).toEqual(hallCamera.map((w) => w.anchor.id).sort());
    for (const o of HALL_OBJECTS) {
      const art = HALL_ART[o.id.slice('hall_'.length)];
      expect(art, o.id).toBeTruthy();
      const w = Math.max(...art!.map((r) => r.length)) + 2;
      expect(o.x, o.id).toBeGreaterThanOrEqual(0);
      expect(o.y, o.id).toBeGreaterThanOrEqual(0);
      expect(o.x + w * o.k, `${o.id} inside the postcard`).toBeLessThanOrEqual(HALL_W);
      expect(o.y + (art!.length + 2) * o.k, `${o.id} inside the postcard`).toBeLessThanOrEqual(HALL_H);
    }
  });

  it('puts the five signs in the hall, each the one the catalog reads off it', () => {
    expect(hallReading).toHaveLength(5);
    expect(HALL_SIGN_PLACES.map((s) => s.id).sort()).toEqual(hallReading.map((w) => w.anchor.id).sort());
    for (const s of HALL_SIGN_PLACES) expect(ARRIVAL_SIGNS.some((x) => x.id === s.id), s.id).toBe(true);
    for (const w of hallReading) expect(ARRIVAL_SIGNS.find((s) => s.id === w.anchor.id)?.pt.toLowerCase(), w.pt).toBe(w.pt);
  });

  it('draws every picture from the hall palette, and outlines it with a navy pixel all round', () => {
    for (const [name, rows] of Object.entries(HALL_ART)) for (const row of rows) for (const ch of row) expect(ch === '.' || ch in HALL_PAL, `${name}: ${ch}`).toBe(true);
    const out = outlined(['bb', 'bb']);
    expect(out).toEqual(['.kk.', 'kbbk', 'kbbk', '.kk.']);
  });
});
