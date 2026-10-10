import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BREEDS, CAT_SHAPES, DOG_SHAPES, LEGACY_BREED, PET_PATTERNS, breedById, breedGroups, coatOf, isBreedCoat, petLook, petStripKeys, DEFAULT_COLLAR } from './petBreeds.js';

const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../apps/client/public/pixel/manifest.json'), 'utf8')) as { images: Record<string, unknown> };
const HEX = /^#[0-9a-f]{6}$/i;

describe('pet shop breeds (#234)', () => {
  it('every breed has a unique id, a coat, valid colours and a shape of its species', () => {
    const ids = new Set<string>();
    for (const b of BREEDS) {
      expect(ids.has(b.id), b.id).toBe(false);
      ids.add(b.id);
      expect(b.coats.length, b.id).toBeGreaterThan(0);
      expect(new Set(b.coats.map((c) => c.id)).size, b.id).toBe(b.coats.length);
      for (const c of b.coats) {
        expect(c.coat, `${b.id}.${c.id}`).toMatch(HEX);
        expect(c.coat2, `${b.id}.${c.id}`).toMatch(HEX);
        expect(c.pt.length * c.en.length).toBeGreaterThan(0);
      }
      expect((b.species === 'dog' ? DOG_SHAPES : CAT_SHAPES) as readonly string[]).toContain(b.shape);
      expect(PET_PATTERNS).toContain(b.pattern);
    }
  });

  it('has the Brazilian types, shown first', () => {
    for (const id of ['vira_lata_caramelo', 'fila_brasileiro', 'terrier_brasileiro', 'gato_srd', 'gato_laranja', 'frajola', 'escaminha']) expect(breedById(id)?.br, id).toBe(true);
    const dogs = breedGroups('dog');
    expect(dogs[0]!.br).toBe(true);
    expect(dogs.findIndex((g) => !g.br)).toBeGreaterThan(dogs.findLastIndex((g) => g.br));
    // a breed and its pattern variants are one catalog entry
    expect(dogs.find((g) => g.pt === 'Fila brasileiro')!.breeds.map((b) => b.id)).toEqual(['fila_brasileiro', 'fila_brasileiro_tigrado']);
  });

  it('petLook is total: unknown breeds and coats fall back, collars are cleaned', () => {
    expect(petLook('nope', null, null).shape).toBe('medio');
    expect(petLook('nope', null, null, 'cat').species).toBe('cat');
    expect(petLook('labrador', 'nope', 'red').coat).toBe(coatOf(breedById('labrador')!, null).coat);
    expect(petLook('labrador', 'preto', '#AABBCC').collar).toBe('#aabbcc');
    expect(petLook('labrador', 'preto', null).collar).toBe(DEFAULT_COLLAR);
    expect(isBreedCoat(breedById('labrador')!, 'preto')).toBe(true);
    expect(isBreedCoat(breedById('labrador')!, 'caramelo')).toBe(false);
    for (const s of ['dog', 'cat'] as const) expect(breedById(LEGACY_BREED[s].breed)?.species).toBe(s);
  });

  it('every strip the catalog needs is baked (pnpm pixel)', () => {
    const keys = petStripKeys();
    expect(keys.length).toBeGreaterThanOrEqual(25);
    for (const k of keys) expect(manifest.images[k], k).toBeTruthy();
  });
});
