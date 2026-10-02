import { describe, expect, it } from 'vitest';
import { CPU_NAMES } from './ambiance.js';
import { hatById } from './catalog.js';
import { BODY_TYPES, BOTTOM_STYLES, CLOTH_COLORS, EXTRA_STYLES, FACE_STYLES, HAIR_COLORS, HAIR_STYLES, IDLE_POSES, SHOE_COLORS, SKIN_TONES, TOP_STYLES } from './constants.js';
import { CPU_LOOKS_A, CPU_LOOKS_B, cpuArchetype, cpuLook } from './looks.js';

describe('CPU wardrobe (character redesign v1)', () => {
  it('gives every allowlisted name a valid, stable look', () => {
    for (const name of CPU_NAMES) {
      const a = cpuLook(name);
      expect(cpuLook(name)).toEqual(a);
      const x = a.appearance;
      expect(BODY_TYPES).toContain(x.body);
      expect(HAIR_STYLES).toContain(x.hair);
      expect(TOP_STYLES).toContain(x.top);
      expect(BOTTOM_STYLES).toContain(x.bottom);
      expect(FACE_STYLES).toContain(x.face);
      expect(EXTRA_STYLES).toContain(x.extra);
      expect(IDLE_POSES).toContain(x.idle);
      expect(x.skin).toBeLessThan(SKIN_TONES.length);
      expect(x.hairColor).toBeLessThan(HAIR_COLORS.length);
      expect(x.topColor).toBeLessThan(CLOTH_COLORS.length);
      expect(x.bottomColor).toBeLessThan(CLOTH_COLORS.length);
      expect(x.shoes).toBeLessThan(SHOE_COLORS.length);
      if (a.hat) expect(hatById(a.hat), `${name}: ${a.hat}`).toBeTruthy();
      // Carlos's hat stays his; no carnival/nightlife read on the everyday Praça crowd
      expect(['chapeu_chef', 'cartola']).not.toContain(a.hat);
    }
  });

  it('keeps the named neighbors TB Art called out on their authored looks', () => {
    expect(cpuArchetype('Helena')).toBe('tia_do_bairro');
    expect(cpuArchetype('Daniel')).toBe('executivo');
    expect(cpuArchetype('Mateus')).toBe('skatista');
    expect(cpuArchetype('Felipe')).toBe('ciclista');
    expect(cpuArchetype('Rafael')).toBe('cafe_da_esquina');
  });

  // TB Art override 5: each pair differs on ≥3 of hair, top, bottoms, posture, accessory.
  const reads = (n: string) => {
    const l = cpuLook(n);
    const a = l.appearance;
    return [a.hair, `${a.top}/${a.topColor}`, `${a.bottom}/${a.bottomColor}`, a.idle, `${a.extra}/${l.hat}`, a.garb ?? '-'];
  };
  const differ = (x: string, y: string) => reads(x).filter((v, i) => v !== reads(y)[i]).length;

  it('the named five read as five different people (≥3 differences each pair)', () => {
    const named = ['Helena', 'Daniel', 'Mateus', 'Felipe', 'Rafael'];
    for (const x of named) for (const y of named) if (x < y) expect(differ(x, y), `${x} vs ${y}`).toBeGreaterThanOrEqual(3);
    expect(new Set(named.map((n) => cpuLook(n).appearance.face + cpuLook(n).appearance.skin)).size).toBe(5);
  });

  it('any two neighbors that can share the square differ on ≥3 reads (no shirt-recolor clones)', () => {
    const bad: string[] = [];
    for (const x of CPU_NAMES)
      for (const y of CPU_NAMES) if (x < y && cpuArchetype(x) !== cpuArchetype(y) && differ(x, y) < 3) bad.push(`${x}/${y}`);
    expect(bad).toEqual([]);
  });

  // Avatar enhance v2: at Praça distance color blocks read before garment shape, so two neighbors in
  // the same top + bottom colors look like one recolored clone even when the cut differs.
  const blocks = (id: string) => {
    const x = (CPU_LOOKS_A[id] ?? CPU_LOOKS_B[id])!;
    const out = new Set(x.topColor.flatMap((t) => x.bottomColor.map((b) => `${t}/${b}`)));
    for (const n of CPU_NAMES) if (cpuArchetype(n) === id) out.add(`${cpuLook(n).appearance.topColor}/${cpuLook(n).appearance.bottomColor}`);
    return out;
  };
  const ids = [...Object.keys(CPU_LOOKS_A), ...Object.keys(CPU_LOOKS_B)];

  it('no two archetypes can dress in the same top + bottom color block', () => {
    const bad: string[] = [];
    for (const x of ids) for (const y of ids) if (x < y) for (const b of blocks(x)) if (blocks(y).has(b)) bad.push(`${x}/${y}: ${b}`);
    expect(bad).toEqual([]);
  });

  it('off-white tops stay an accent, not the crowd uniform', () => {
    expect(ids.filter((id) => [...blocks(id)].some((b) => b.startsWith('4/')))).toHaveLength(1);
  });

  it('has enough distinct silhouettes for a full crowd (5+ reads, no clones)', () => {
    for (const pool of [CPU_LOOKS_A, CPU_LOOKS_B]) {
      const reads = new Set(Object.values(pool).map((x) => `${x.top}/${x.bottom}/${x.hair[0]}/${x.hats[0]}/${x.idle}`));
      expect(reads.size).toBeGreaterThanOrEqual(6);
    }
    const used = new Set(CPU_NAMES.map(cpuArchetype));
    expect(used.size).toBe(Object.keys(CPU_LOOKS_A).length + Object.keys(CPU_LOOKS_B).length);
  });
});
