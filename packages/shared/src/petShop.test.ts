import { describe, expect, it } from 'vitest';
import {
  PET_ITEMS,
  PET_MAX_OWNED,
  PET_PENS,
  PEN_LINES,
  activePet,
  adoptPet,
  applyPets,
  buyPetItem,
  canBuyPetItem,
  collarColor,
  ensureLegacyPet,
  equipPetItem,
  homePetSpots,
  newPetId,
  normalizePets,
  penAnimalTile,
  penLineKey,
  penLitter,
  petToyCommands,
  publicPetLook,
  releasePet,
  renameOwnedPet,
  setActivePet,
  type PetOwner,
} from './petShop.js';
import { BREEDS, DEFAULT_COLLAR, breedById } from './petBreeds.js';
import { FURNITURE } from './catalog.js';

describe('pet ownership and the migration from the subscriber dog and cat (#234)', () => {
  it('migrates a dog-only save, keeps its name and keeps it out', () => {
    const p: PetOwner = { pet: 'dog', petNames: { dog: 'Caramelo' } };
    const n = normalizePets(p);
    expect(n.pets).toEqual([{ id: 'legacy_dog', species: 'dog', breed: 'vira_lata_caramelo', coat: 'caramelo', name: 'Caramelo', collar: null, toy: null, adoptedAt: 0, legacy: true }]);
    expect(n.activePetId).toBe('legacy_dog');
  });

  it('migrates a named cat that is at home, and both together', () => {
    expect(normalizePets({ pet: null, petNames: { cat: 'Mel' } })).toMatchObject({ pets: [{ id: 'legacy_cat', breed: 'gato_laranja', name: 'Mel' }], activePetId: null });
    const both = normalizePets({ pet: 'cat', petNames: { dog: 'Rex', cat: 'Mel' } });
    expect(both.pets.map((q) => q.id)).toEqual(['legacy_dog', 'legacy_cat']);
    expect(both.activePetId).toBe('legacy_cat');
    expect(normalizePets({}).pets).toEqual([]);
  });

  it('is idempotent and writes the mirrors', () => {
    const p: PetOwner = { pet: 'dog', petNames: { dog: 'Rex' } };
    applyPets(p);
    const once = JSON.stringify(p);
    applyPets(p);
    expect(JSON.stringify(p)).toBe(once);
    expect(p.pet).toBe('dog');
    expect(p.petNames).toEqual({ dog: 'Rex' });
  });

  it('cleans garbage in a stored list', () => {
    const p = { pets: [null, 7, { id: 'a', breed: 'nope' }, { id: 'b', breed: 'labrador', coat: 'roxo', collar: 'bolinha', toy: 'coleira_azul', name: 42 }, { id: 'b', breed: 'labrador' }], activePetId: 'zzz', petItems: ['coleira_azul', 'coleira_azul', 'caminha_azul', 'x'] } as unknown as PetOwner;
    const n = normalizePets(p);
    expect(n.pets).toHaveLength(1);
    expect(n.pets[0]).toMatchObject({ id: 'b', coat: 'amarelo', collar: null, toy: null, name: null });
    expect(n.activePetId).toBeNull();
    expect(n.petItems).toEqual(['coleira_azul']);
  });

  it('adopts up to six, refuses unknown breeds and coats; the active pet switches; release puts it away', () => {
    const p: PetOwner = {};
    expect(adoptPet(p, 'nope', 'x', 1, 'a')).toBe('unknown');
    expect(adoptPet(p, 'labrador', 'caramelo', 1, 'a')).toBe('unknown');
    for (let i = 0; i < PET_MAX_OWNED; i++) expect(adoptPet(p, 'labrador', 'preto', i, `p${i}`)).toBe('ok');
    expect(adoptPet(p, 'labrador', 'preto', 9, 'p9')).toBe('full');
    expect(setActivePet(p, 'p2')).toBe('ok');
    expect(activePet(p)?.id).toBe('p2');
    expect(p.pet).toBe('dog');
    expect(setActivePet(p, 'nope')).toBe('unknown');
    expect(renameOwnedPet(p, 'p2', 'Paçoca')).toBe(true);
    expect(p.petNames).toEqual({ dog: 'Paçoca' });
    expect(releasePet(p, 'p2')).toBe(true);
    expect(p.activePetId).toBeNull();
    expect(p.pet).toBeNull();
    expect(p.pets).toHaveLength(PET_MAX_OWNED - 1);
  });

  it('the old Cachorro / Gato button gives the legacy pet once, then the first of that species', () => {
    const p: PetOwner = {};
    expect(ensureLegacyPet(p, 'cat', 5)?.id).toBe('legacy_cat');
    expect(ensureLegacyPet(p, 'cat', 6)?.id).toBe('legacy_cat');
    adoptPet(p, 'labrador', 'preto', 7, 'lab');
    expect(ensureLegacyPet(p, 'dog', 8)?.id).toBe('lab');
  });

  it('pet ids are stable strings', () => {
    expect(newPetId(1700000000000, () => 0)).toMatch(/^p[0-9a-z]+00$/);
  });
});

describe('the lojinha', () => {
  it('has 13 items, prices within 1..60, RV only; beds and food are shop-only furniture', () => {
    expect(PET_ITEMS).toHaveLength(13);
    for (const i of PET_ITEMS) expect(i.price >= 1 && i.price <= 60, i.id).toBe(true);
    for (const i of PET_ITEMS.filter((q) => q.kind === 'caminha' || q.kind === 'racao')) {
      const f = FURNITURE.find((q) => q.id === i.id);
      expect(f?.shop, i.id).toBe('petshop');
      expect(f?.price).toBe(i.price);
    }
    for (const i of PET_ITEMS.filter((q) => q.kind === 'coleira')) expect(collarColor(i.id)).toMatch(/^#[0-9a-f]{6}$/);
    expect(collarColor(null)).toBe(DEFAULT_COLLAR);
  });

  it('buys with RV: collars and toys once, furniture into the kitnet inventory', () => {
    const p = { coins: 30, furniture: {} as Record<string, number> } as PetOwner & { coins: number; furniture: Record<string, number> };
    expect(canBuyPetItem(p, 'nope')).toBe('unknown');
    expect(buyPetItem(p, 'coleira_vermelha')).toBe('ok');
    expect(p.coins).toBe(22);
    expect(buyPetItem(p, 'coleira_vermelha')).toBe('owned');
    expect(buyPetItem(p, 'caminha_xadrez')).toBe('ok');
    expect(p.furniture.caminha_xadrez).toBe(1);
    expect(buyPetItem(p, 'caminha_cesta')).toBe('coins');
    expect(p.coins).toBe(2);
  });

  it('equips only an owned item of the right kind and species', () => {
    const p: PetOwner = { petItems: ['coleira_azul', 'ratinho', 'bolinha'] };
    adoptPet(p, 'labrador', 'preto', 1, 'dog1');
    expect(equipPetItem(p, 'dog1', 'collar', 'coleira_azul')).toBe(true);
    expect(equipPetItem(p, 'dog1', 'collar', 'coleira_rosa')).toBe(false);
    expect(equipPetItem(p, 'dog1', 'toy', 'coleira_azul')).toBe(false);
    expect(equipPetItem(p, 'dog1', 'toy', 'ratinho')).toBe(false);
    expect(equipPetItem(p, 'dog1', 'toy', 'bolinha')).toBe(true);
    expect(equipPetItem(p, 'dog1', 'toy', null)).toBe(true);
  });

  it('the public look carries the breed and collar; the toy commands follow the toy', () => {
    expect(publicPetLook({ pet: null })).toBeNull();
    expect(publicPetLook({ pet: 'dog' })!.shape).toBe('medio');
    const l = publicPetLook({ pet: 'dog', petBreed: 'dalmata', petCoat: 'branco_figado', petCollar: 'coleira_azul' })!;
    expect([l.pattern, l.collar]).toEqual(['pintado', '#3d56d2']);
    expect(petToyCommands({ pet: 'dog', petToy: 'bolinha' })).toEqual({ fetch: true, play: false });
    expect(petToyCommands({ pet: 'cat', petToy: 'ratinho' })).toEqual({ fetch: false, play: true });
    expect(petToyCommands({ pet: 'cat', petToy: 'bolinha' })).toEqual({ fetch: false, play: false });
    expect(petToyCommands({ pet: 'dog', petToy: null })).toEqual({ fetch: false, play: false });
  });
});

describe('the pens and the kitnet residents', () => {
  it('the litter is deterministic, of the pen species, never the same breed twice', () => {
    for (const pen of PET_PENS) {
      for (let day = 0; day < 30; day++) {
        const a = penLitter(pen.id, day);
        expect(a).toEqual(penLitter(pen.id, day));
        expect(a).toHaveLength(pen.shows);
        expect(new Set(a.map((x) => breedById(x.breed)!.pt)).size).toBe(a.length);
        for (const x of a) expect(breedById(x.breed)!.species).toBe(pen.species);
      }
    }
  });

  it('weights the Brazilian types', () => {
    let br = 0, all = 0;
    for (let day = 0; day < 400; day++) for (const x of penLitter('cercadinho', day)) { all++; if (breedById(x.breed)!.br) br++; }
    const share = BREEDS.filter((b) => b.species === 'dog' && b.br).length / BREEDS.filter((b) => b.species === 'dog').length;
    expect(br / all).toBeGreaterThan(share);
  });

  it('two animals never share a tile, and they stay inside the pen', () => {
    for (const pen of PET_PENS) {
      for (let step = 0; step < 200; step += 3) {
        const tiles = Array.from({ length: pen.shows }, (_, s) => penAnimalTile(pen, s, step));
        expect(new Set(tiles.map((t) => t.join(','))).size).toBe(pen.shows);
        for (const t of tiles) expect(pen.tiles).toContainEqual(t);
      }
    }
  });

  it('pen lines rotate per species and all exist', () => {
    for (const s of ['dog', 'cat'] as const) for (let d = 0; d < 6; d++) for (let slot = 0; slot < 3; slot++) expect(PEN_LINES[penLineKey(s, d, slot)]).toBeDefined();
  });

  it('home pets lie on beds first, then the rug, then free spots; never two on a tile, never a blocked one', () => {
    const p: PetOwner = {};
    for (let i = 0; i < 5; i++) adoptPet(p, 'gato_srd', 'preto', i, `c${i}`);
    const apt = [
      { uid: 'b', itemId: 'caminha_azul', x: 5, y: 5, rot: 0 as const },
      { uid: 'r', itemId: 'tapete', x: 3, y: 3, rot: 0 as const },
      { uid: 'm', itemId: 'mesinha', x: 6, y: 5, rot: 0 as const },
    ];
    const home = homePetSpots(apt, p.pets!, (x, y) => x === 6 && y === 5);
    expect(home[0]).toMatchObject({ tile: { x: 5, y: 5 }, pose: 'lie' });
    expect(home[1]).toMatchObject({ tile: { x: 3, y: 3 }, pose: 'lie' });
    expect(new Set(home.map((h) => `${h.tile.x},${h.tile.y}`)).size).toBe(home.length);
    expect(home.some((h) => h.tile.x === 6 && h.tile.y === 5)).toBe(false);
    expect(home).toHaveLength(5);
  });
});
