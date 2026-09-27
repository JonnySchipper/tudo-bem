import { describe, expect, it } from 'vitest';
import { ARARA_SCHEMES, PAPAGAIO_SCHEMES, arcY, spawnCinematicFlock, type FlockBird } from './introParrots';
import { sceneCamera } from './introHeroScene';

describe('intro parrot flock locks', () => {
  it('spawns 6–12 mixed-species birds in one pass across 3 depth layers', () => {
    for (const target of [4, 8, 11, 20]) {
      const birds: FlockBird[] = [];
      spawnCinematicFlock(birds, target);
      expect(birds.length).toBeGreaterThanOrEqual(6);
      expect(birds.length).toBeLessThanOrEqual(12);
      const species = new Set(birds.map((b) => b.species));
      expect(species.has('arara')).toBe(true);
      expect(species.has('papagaio')).toBe(true);
      expect(new Set(birds.map((b) => b.layer)).size).toBe(3);
    }
  });

  it('uses SP palette without neon cyan/magenta accents', () => {
    const hex = [...ARARA_SCHEMES, ...PAPAGAIO_SCHEMES].flatMap((s) =>
      [s.body, s.wing, s.tail, s.beak, s.cheek, s.belly, s.flash, s.flashDeep].filter((c): c is string => Boolean(c)),
    );
    const banned = ['00ffff', 'ff00ff', '7a4fb0', '00ff'];
    for (const h of hex) {
      expect(banned.some((b) => h.toLowerCase().replace('#', '').includes(b))).toBe(false);
    }
  });

  it('keeps every flight arc inside the sky band (above wordmark / card)', () => {
    const birds: FlockBird[] = [];
    spawnCinematicFlock(birds, 12);
    for (const b of birds) {
      for (let u = 0; u <= 1; u += 0.05) {
        const y = arcY(b.arc, u);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('near layer crosses faster than far layer (parallax)', () => {
    const birds: FlockBird[] = [];
    spawnCinematicFlock(birds, 11);
    const dur = (layer: string) => Math.max(...birds.filter((b) => b.layer === layer).map((b) => b.duration));
    expect(dur('near')).toBeLessThan(dur('mid'));
    expect(dur('mid')).toBeLessThan(dur('far'));
  });
});

describe('intro hero camera', () => {
  it('frames the Padaria for a 390 phone and tilts down when the card arrives', () => {
    const cam = sceneCamera(390, 844);
    const [x, , w] = cam.viewBox;
    expect(x).toBeLessThanOrEqual(640);
    expect(x + w).toBeGreaterThanOrEqual(1000);
    expect(w / cam.viewBox[3]).toBeCloseTo(390 / 844, 3);
    expect(cam.authTiltPx).toBeGreaterThan(0);
  });

  it('shows the wide Praça on desktop without tilting', () => {
    const cam = sceneCamera(1440, 900);
    expect(cam.viewBox[2]).toBe(1600);
    expect(cam.viewBox[2] / cam.viewBox[3]).toBeCloseTo(1440 / 900, 3);
    expect(cam.authTiltPx).toBe(0);
  });
});
