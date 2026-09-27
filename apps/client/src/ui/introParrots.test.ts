import { describe, expect, it } from 'vitest';
import { ARARA_SCHEMES, PAPAGAIO_SCHEMES, arcY, spawnCinematicFlock, type FlockBird } from './introParrots';
import { portraitAuthFraming, sceneCamera } from './introHeroScene';

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
    spawnCinematicFlock(birds, 12);
    const dur = (layer: string) => Math.max(...birds.filter((b) => b.layer === layer && !b.hero).map((b) => b.duration));
    expect(dur('near')).toBeLessThan(dur('mid'));
    expect(dur('mid')).toBeLessThan(dur('far'));
  });

  it('adds exactly one slow, large near glider for depth', () => {
    for (const target of [9, 12]) {
      const birds: FlockBird[] = [];
      spawnCinematicFlock(birds, target);
      expect(birds.length).toBe(target);
      const heroes = birds.filter((b) => b.hero);
      expect(heroes).toHaveLength(1);
      const hero = heroes[0]!;
      expect(hero.layer).toBe('near');
      const others = birds.filter((b) => !b.hero);
      expect(hero.scale).toBeGreaterThan(Math.max(...others.filter((b) => b.layer !== 'near').map((b) => b.scale)));
      expect(hero.duration).toBeGreaterThan(Math.max(...others.filter((b) => b.layer === 'near').map((b) => b.duration)));
      expect(hero.wingHz).toBeLessThan(Math.min(...others.map((b) => b.wingHz)));
    }
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
    expect(portraitAuthFraming(cam, 1440, 900, 120, 320)).toEqual({ zoom: 1, shiftPx: 0 });
  });

  it('pulls back at 390 so the sign and fountain sit between wordmark and card', () => {
    const w = 390;
    const hgt = 844;
    const cardTop = 372;
    const heroBottom = 200;
    const cam = sceneCamera(w, hgt);
    const { zoom, shiftPx } = portraitAuthFraming(cam, w, hgt, cardTop, heroBottom);
    expect(zoom).toBeLessThan(1);
    const [vx, vy, vw, vh] = cam.viewBox;
    const s = (hgt / vh) * zoom;
    const screenY = (worldY: number) => shiftPx + zoom * (worldY - vy) * (hgt / vh);
    expect(screenY(588)).toBeGreaterThanOrEqual(heroBottom);
    expect(screenY(1004)).toBeLessThanOrEqual(cardTop + 4);
    // Portrait ipês at x≈452 and x≈1196 fall inside the widened window.
    const cx = vx + vw / 2;
    const half = w / 2 / s;
    expect(cx - half).toBeLessThan(452);
    expect(cx + half).toBeGreaterThan(1196);
  });

  it('keeps the Padaria legible on short phones instead of shrinking the Praça to a stamp', () => {
    const cam = sceneCamera(360, 640);
    const { zoom, shiftPx } = portraitAuthFraming(cam, 360, 640, 185, 110);
    expect(zoom).toBeGreaterThanOrEqual(0.46);
    const [, vy, , vh] = cam.viewBox;
    expect(shiftPx + zoom * (588 - vy) * (640 / vh)).toBeCloseTo(114, 0);
  });
});
