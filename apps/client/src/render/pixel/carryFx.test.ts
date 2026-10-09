import { describe, expect, it } from 'vitest';
import { CARRY_BEAT_MS, arcPoint, beatPose, binInReach, carryMove, groundSpot } from './carryFx';

describe('carryMove', () => {
  it('reads eating and drinking from the empty each item leaves', () => {
    expect(carryMove('pipoca_doce_leite', 'saquinho_vazio')).toBe('eat');
    expect(carryMove('agua_de_coco', 'coco_vazio')).toBe('drink');
    expect(carryMove('cafe', 'copinho_vazio')).toBe('drink');
    expect(carryMove('suco_de_laranja', 'copo_vazio')).toBe('drink');
  });

  it('tosses empties and full items that would have left something', () => {
    expect(carryMove('saquinho_vazio', null)).toBe('toss');
    expect(carryMove('coco_vazio', '')).toBe('toss');
    expect(carryMove('agua_de_coco', null)).toBe('toss');
    expect(carryMove('pipoca_salgada', null)).toBe('toss');
  });

  it('eats finger food unless this client asked to throw it away', () => {
    expect(carryMove('coxinha', null)).toBe('eat');
    expect(carryMove('pao_de_queijo', null, 'consume')).toBe('eat');
    expect(carryMove('pao_de_queijo', null, 'toss')).toBe('toss');
  });

  it('just swaps for a new purchase, a first sight, or cosmetics', () => {
    expect(carryMove(null, 'pipoca_doce')).toBe('swap');
    expect(carryMove('', 'agua_de_coco')).toBe('swap');
    expect(carryMove('saquinho_vazio', 'pipoca_salgada')).toBe('swap');
    expect(carryMove('bone_verde', null)).toBe('swap');
  });
});

describe('beatPose', () => {
  it('raises to the mouth, takes three bites, then comes back down', () => {
    expect(beatPose('eat', 0).lift).toBe(0);
    expect(beatPose('eat', 300).lift).toBe(1);
    const bites = [];
    let prev = 0;
    for (let ms = 0; ms <= CARRY_BEAT_MS; ms += 16) {
      const p = beatPose('eat', ms, prev);
      if (p.bite >= 0) bites.push(p.bite);
      prev = ms;
    }
    expect(bites).toEqual([0, 1, 2]);
    expect(beatPose('eat', 650).scale).toBeLessThan(beatPose('eat', 250).scale);
    expect(beatPose('eat', CARRY_BEAT_MS)).toMatchObject({ finished: true, lift: 0 });
  });

  it('tips a drink toward the face and nods on the sips', () => {
    expect(beatPose('drink', 400).angle).toBeLessThan(-29);
    expect(beatPose('drink', 400).scale).toBe(1);
    const nods = Array.from({ length: 40 }, (_, i) => beatPose('drink', 200 + i * 12.5).nod);
    expect(nods).toContain(1);
    expect(nods).toContain(0);
  });
});

describe('toss targets', () => {
  const bins = [
    { x: 13, y: 19 },
    { x: 19, y: 6 },
  ];
  it('finds the nearest lixeira within two tiles, like the server', () => {
    expect(binInReach({ x: 15, y: 19 }, bins)).toBe(0);
    expect(binInReach({ x: 14, y: 20 }, bins)).toBe(0);
    expect(binInReach({ x: 16, y: 19 }, bins)).toBe(-1);
    expect(binInReach({ x: 23, y: 12 }, bins)).toBe(-1);
    expect(binInReach({ x: 20, y: 7 }, bins)).toBe(1);
  });

  it('arcs above the line and lands on the target', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 20, y: 10 };
    expect(arcPoint(a, b, 12, 0)).toEqual(a);
    expect(arcPoint(a, b, 12, 1).x).toBeCloseTo(20);
    expect(arcPoint(a, b, 12, 1).y).toBeCloseTo(10);
    expect(arcPoint(a, b, 12, 0.5).y).toBeLessThan(5);
  });

  it('drops a ground toss a step ahead of the feet', () => {
    expect(groundSpot({ x: 100, y: 100 }, 'E', 16).x).toBe(116);
    expect(groundSpot({ x: 100, y: 100 }, 'W', 16).x).toBe(84);
    expect(groundSpot({ x: 100, y: 100 }, 'S', 16).y).toBeGreaterThan(100);
    expect(groundSpot({ x: 100, y: 100 }, 'N', 16).y).toBeLessThan(100);
  });
});
