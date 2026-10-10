/**
 * The pet shop panel's view model (#234): what the Adotar and Meus pets tabs (and the Lojinha once a pet is owned) show, from the profile, the clock and the shop's litter.
 * Pure (no DOM): tested in petShopLogic.test.ts. needs_br: every Portuguese string.
 */
import {
  PET_ITEMS,
  PET_PENS,
  breedById,
  breedGroups,
  coatOf,
  isPetFurniture,
  ownedPetLook,
  penLitter,
  petLook,
  type OwnedPet,
  type PetItemKind,
  type PetLook,
  type PetSpecies,
} from '@tudobem/shared';

export type PetShopTab = 'adotar' | 'meus' | 'lojinha';

/** The tabs a profile sees: Adotar and Meus pets always, the Lojinha only once it owns a pet (collars, toys and beds are for a pet). */
export function petShopTabs(petCount: number): PetShopTab[] {
  return petCount > 0 ? ['adotar', 'meus', 'lojinha'] : ['adotar', 'meus'];
}

export interface LitterCard {
  penId: string;
  slot: number;
  breed: string;
  coat: string;
  pt: string;
  en: string;
  coatPt: string;
  coatEn: string;
  species: PetSpecies;
  br: boolean;
  look: PetLook;
}

export interface CatalogCoat {
  breed: string;
  coat: string;
  pt: string;
  en: string;
  color: string;
  look: PetLook;
}

export interface CatalogGroup {
  pt: string;
  en: string;
  species: PetSpecies;
  br: boolean;
  coats: CatalogCoat[];
}

export interface MyPetRow {
  id: string;
  name: string | null;
  breedPt: string;
  breedEn: string;
  look: PetLook;
  active: boolean;
  /** Levar is offered (a subscriber, and the pet is at home). */
  canTake: boolean;
  collar: string | null;
  toy: string | null;
  species: PetSpecies;
}

export interface ShopItemCard {
  id: string;
  kind: PetItemKind;
  pt: string;
  en: string;
  price: number;
  /** A collar or toy you already have (beds and food can be bought again). */
  owned: boolean;
  short: number;
}

export interface PetShopView {
  /** The tab shown: the one asked for, or Adotar when it is not offered yet (the counter before a first pet). */
  tab: PetShopTab;
  tabs: PetShopTab[];
  coins: number;
  access: boolean;
  litter: LitterCard[];
  catalog: CatalogGroup[];
  /** Without access the meet view carries Seu Dito's one gate line instead of an Adotar button (no card, no button, no checkout). */
  gate: boolean;
  pets: MyPetRow[];
  full: boolean;
  items: ShopItemCard[];
}

export interface PetShopInput {
  tab: PetShopTab;
  pets: OwnedPet[];
  activePetId: string | null;
  petItems: string[];
  coins: number;
  access: boolean;
  /** Any integer that changes once a game day (gameDay of the shared clock). */
  day: number;
}

export function litterCards(day: number): LitterCard[] {
  const out: LitterCard[] = [];
  for (const pen of PET_PENS) {
    for (const a of penLitter(pen.id, day)) {
      const b = breedById(a.breed)!;
      const c = coatOf(b, a.coat);
      out.push({ penId: pen.id, slot: a.slot, breed: b.id, coat: c.id, pt: b.pt, en: b.en, coatPt: c.pt, coatEn: c.en, species: b.species, br: !!b.br, look: petLook(b.id, c.id, null) });
    }
  }
  return out;
}

export function catalogGroups(): CatalogGroup[] {
  return [...breedGroups('dog'), ...breedGroups('cat')].map((g) => ({
    pt: g.pt,
    en: g.en,
    species: g.species,
    br: g.br,
    coats: g.breeds.flatMap((b) => b.coats.map((c) => ({ breed: b.id, coat: c.id, pt: c.pt, en: c.en, color: c.coat, look: petLook(b.id, c.id, null) }))),
  }));
}

export function petShopView(i: PetShopInput): PetShopView {
  const pets: MyPetRow[] = i.pets.map((p) => {
    const b = breedById(p.breed);
    return {
      id: p.id,
      name: p.name,
      breedPt: b?.pt ?? p.breed,
      breedEn: b?.en ?? p.breed,
      look: ownedPetLook(p),
      active: p.id === i.activePetId,
      canTake: i.access && p.id !== i.activePetId,
      collar: p.collar,
      toy: p.toy,
      species: p.species,
    };
  });
  const items: ShopItemCard[] = PET_ITEMS.map((it) => {
    const owned = !isPetFurniture(it) && i.petItems.includes(it.id);
    return { id: it.id, kind: it.kind, pt: it.pt, en: it.en, price: it.price, owned, short: owned ? 0 : Math.max(0, it.price - i.coins) };
  });
  const tabs = petShopTabs(i.pets.length);
  return {
    tab: tabs.includes(i.tab) ? i.tab : 'adotar',
    tabs,
    coins: i.coins,
    access: i.access,
    litter: litterCards(i.day),
    catalog: catalogGroups(),
    gate: !i.access,
    pets,
    full: i.pets.length >= 6,
    items,
  };
}

/** The collars and toys a pet can wear (owned items of the slot's kind that fit its species). */
export function equipOptions(row: MyPetRow, petItems: string[], slot: 'collar' | 'toy'): { id: string; pt: string; en: string }[] {
  return PET_ITEMS.filter((it) => petItems.includes(it.id) && it.kind === (slot === 'collar' ? 'coleira' : 'brinquedo') && (!it.for || it.for.includes(row.species))).map((it) => ({ id: it.id, pt: it.pt, en: it.en }));
}
