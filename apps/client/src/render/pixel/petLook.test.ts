import { describe, expect, it } from 'vitest';
import { petLook } from '@tudobem/shared';
import { PetTextureCache, petAnimKey, petSourceKey, petSwapTable, petTextureKey } from './petLook';
import { PET_KEY_RAMPS, hexToRgb, pack } from './palette';

describe('pet looks at runtime (#234)', () => {
  it('the caramelo and the orange cat with the default collar keep the legacy strips', () => {
    expect(petTextureKey(petLook('vira_lata_caramelo', 'caramelo', null))).toBe('pet:dog');
    expect(petTextureKey(petLook('gato_laranja', 'laranja', null))).toBe('pet:cat');
    expect(petAnimKey('pet:dog', 'walkE')).toBe('anim:pet:dog:walkE');
    // a red collar is a look of its own
    expect(petTextureKey(petLook('vira_lata_caramelo', 'caramelo', '#d93232'))).not.toBe('pet:dog');
  });

  it('texture keys are stable and differ by coat and collar', () => {
    const a = petLook('labrador', 'preto', null);
    expect(petTextureKey(a)).toBe(petTextureKey(petLook('labrador', 'preto', null)));
    expect(petTextureKey(a)).not.toBe(petTextureKey(petLook('labrador', 'chocolate', null)));
    expect(petSourceKey(a)).toBe('petsrc:chars/pet_dog_grande_solido');
  });

  it('the swap table maps every key colour', () => {
    const t = petSwapTable(petLook('dalmata', 'branco_preto', '#3d56d2'));
    for (const k of [...PET_KEY_RAMPS.coat, ...PET_KEY_RAMPS.coat2, ...PET_KEY_RAMPS.collar]) expect(t.has(pack(...hexToRgb(k))), k).toBe(true);
    // markings darker than the white coat
    const base = t.get(pack(...hexToRgb(PET_KEY_RAMPS.coat[2])))!, marks = t.get(pack(...hexToRgb(PET_KEY_RAMPS.coat2[2])))!;
    const lum = (v: number) => ((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255);
    expect(lum(marks)).toBeLessThan(lum(base));
  });

  it('the cache evicts the least recently used texture past its size', () => {
    const c = new PetTextureCache(2);
    expect(c.touch('a')).toEqual([]);
    expect(c.touch('b')).toEqual([]);
    expect(c.touch('a')).toEqual([]);
    expect(c.touch('c')).toEqual(['b']);
    expect(c.has('a') && c.has('c') && !c.has('b')).toBe(true);
    expect(c.size).toBe(2);
  });
});
