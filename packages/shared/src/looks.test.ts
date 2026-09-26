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
      expect(a.hat).not.toBe('chapeu_chef');
    }
  });

  it('keeps the named neighbors TB Art called out on their authored looks', () => {
    expect(cpuArchetype('Helena')).toBe('tia_do_bairro');
    expect(cpuArchetype('Daniel')).toBe('executivo');
    expect(cpuArchetype('Mateus')).toBe('skatista');
    expect(cpuArchetype('Felipe')).toBe('ciclista');
    expect(cpuArchetype('Rafael')).toBe('barista');
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
