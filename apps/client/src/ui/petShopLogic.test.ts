import { describe, expect, it } from 'vitest';
import { BREEDS, PET_ITEMS, type OwnedPet } from '@tudobem/shared';
import { catalogGroups, equipOptions, litterCards, petShopTabs, petShopView, type PetShopInput } from './petShopLogic';

const pet = (id: string, breed: string, coat: string, extra: Partial<OwnedPet> = {}): OwnedPet => ({ id, species: breed.startsWith('gato') || breed === 'persa' ? 'cat' : 'dog', breed, coat, name: null, collar: null, toy: null, adoptedAt: 0, ...extra });
const base: PetShopInput = { tab: 'adotar', pets: [], activePetId: null, petItems: [], coins: 0, access: false, day: 12 };

describe('pet shop panel view model (#234)', () => {
  it('the litter shows three dogs and two cats, the same for everyone on a day', () => {
    const l = litterCards(12);
    expect(l.filter((c) => c.species === 'dog')).toHaveLength(3);
    expect(l.filter((c) => c.species === 'cat')).toHaveLength(2);
    expect(litterCards(12)).toEqual(l);
  });

  it('the catalog lists every coat of every breed, Brazilian types first per species', () => {
    const coats = catalogGroups().reduce((n, g) => n + g.coats.length, 0);
    expect(coats).toBe(BREEDS.reduce((n, b) => n + b.coats.length, 0));
    const dogs = catalogGroups().filter((g) => g.species === 'dog');
    expect(dogs[0]!.br).toBe(true);
  });

  it('without access the meet view gets the one gate line (no card, no checkout state); a supporter gets none', () => {
    expect(petShopView(base).gate).toBe(true);
    expect(petShopView({ ...base, access: true }).gate).toBe(false);
    expect(Object.keys(petShopView(base))).not.toContain('lapsed');
  });

  it('the Lojinha tab appears only once a pet is owned; asking for it before falls back to Adotar', () => {
    expect(petShopTabs(0)).toEqual(['adotar', 'meus']);
    expect(petShopTabs(1)).toEqual(['adotar', 'meus', 'lojinha']);
    const none = petShopView({ ...base, tab: 'lojinha' });
    expect(none.tabs).toEqual(['adotar', 'meus']);
    expect(none.tab).toBe('adotar');
    const one = petShopView({ ...base, tab: 'lojinha', pets: [pet('a', 'labrador', 'preto')] });
    expect(one.tab).toBe('lojinha');
  });

  it('Meus pets: a row per pet, the active one marked, Levar only for subscribers', () => {
    const pets = [pet('a', 'labrador', 'preto', { name: 'Paçoca' }), pet('b', 'persa', 'branco')];
    const v = petShopView({ ...base, tab: 'meus', pets, activePetId: 'a', access: true });
    expect(v.pets.map((r) => [r.id, r.active, r.canTake])).toEqual([['a', true, false], ['b', false, true]]);
    expect(v.pets[0]!.breedPt).toBe('Labrador');
    const lapsed = petShopView({ ...base, tab: 'meus', pets, access: false });
    expect(lapsed.pets.every((r) => !r.canTake)).toBe(true);
  });

  it('Lojinha: 13 items, owned collars marked, what is short in RV', () => {
    const v = petShopView({ ...base, tab: 'lojinha', pets: [pet('a', 'labrador', 'preto')], coins: 10, petItems: ['coleira_azul'] });
    expect(v.items).toHaveLength(PET_ITEMS.length);
    expect(v.items.find((i) => i.id === 'coleira_azul')).toMatchObject({ owned: true, short: 0 });
    expect(v.items.find((i) => i.id === 'caminha_cesta')).toMatchObject({ owned: false, short: 15 });
  });

  it('equip options fit the species', () => {
    const v = petShopView({ ...base, tab: 'meus', pets: [pet('c', 'persa', 'branco')], access: true });
    expect(equipOptions(v.pets[0]!, ['ratinho', 'bolinha', 'coleira_rosa'], 'toy').map((o) => o.id)).toEqual(['ratinho']);
    expect(equipOptions(v.pets[0]!, ['ratinho', 'bolinha', 'coleira_rosa'], 'collar').map((o) => o.id)).toEqual(['coleira_rosa']);
  });
});
