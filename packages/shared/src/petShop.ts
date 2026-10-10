/**
 * Pet Shop do Seu Dito (#234, docs/PET-STORE-PLAN.md): adopted pets, the lojinha, the pens and the kitnet residents. Pure rules shared by the
 * server (authority) and the client (the panel's view model). needs_br: every Portuguese string here.
 *
 * Locks: adoption is a subscriber perk and costs no RV; the lojinha sells for earned RV only; petting, reading and talking (every diary word
 * of the shop) are free for everyone; no hunger, no stats, no counters.
 */
import { BREEDS, LEGACY_BREED, breedById, isBreedCoat, petLook, DEFAULT_COLLAR, type BreedDef, type PetLook, type PetSpecies } from './petBreeds.js';
import type { OwnedPet, PlacedFurniture } from './types.js';

export type { OwnedPet };

/** A player owns up to this many pets. */
export const PET_MAX_OWNED = 6;

// ---------------------------------------------------------------- the lojinha
export type PetItemKind = 'coleira' | 'brinquedo' | 'caminha' | 'racao';
export interface PetItemDef {
  id: string;
  kind: PetItemKind;
  pt: string;
  en: string;
  /** Earned RV (reais virtuais). Nothing here is sold for real money. */
  price: number;
  /** Collars: the colour of the collar ramp. */
  color?: string;
  /** Toys: which species can play with it (`busca` for dogs, `brinca` for cats). */
  for?: PetSpecies[];
}

export const PET_ITEMS: PetItemDef[] = [
  { id: 'coleira_vermelha', kind: 'coleira', pt: 'Coleira vermelha', en: 'Red collar', price: 8, color: '#d93232' },
  { id: 'coleira_azul', kind: 'coleira', pt: 'Coleira azul', en: 'Blue collar', price: 8, color: '#3d56d2' },
  { id: 'coleira_verde', kind: 'coleira', pt: 'Coleira verde', en: 'Green collar', price: 8, color: '#2e8a55' },
  { id: 'coleira_rosa', kind: 'coleira', pt: 'Coleira rosa', en: 'Pink collar', price: 8, color: '#e07090' },
  { id: 'bandana_brasil', kind: 'coleira', pt: 'Bandana do Brasil', en: 'Brazil bandana', price: 15, color: '#2e9e5b' },
  { id: 'bolinha', kind: 'brinquedo', pt: 'Bolinha', en: 'Little ball', price: 10, for: ['dog'] },
  { id: 'ratinho', kind: 'brinquedo', pt: 'Ratinho de pano', en: 'Toy mouse', price: 10, for: ['cat'] },
  { id: 'ossinho', kind: 'brinquedo', pt: 'Ossinho', en: 'Little bone', price: 12, for: ['dog'] },
  { id: 'pelucia', kind: 'brinquedo', pt: 'Pelúcia', en: 'Plush toy', price: 12, for: ['dog', 'cat'] },
  { id: 'caminha_xadrez', kind: 'caminha', pt: 'Caminha xadrez', en: 'Plaid pet bed', price: 20 },
  { id: 'caminha_azul', kind: 'caminha', pt: 'Caminha azul', en: 'Blue pet bed', price: 20 },
  { id: 'caminha_cesta', kind: 'caminha', pt: 'Cesta de vime', en: 'Wicker basket', price: 25 },
  { id: 'saco_racao', kind: 'racao', pt: 'Saco de ração + pote', en: 'Food bag + bowl', price: 15 },
];

export const petItemById = (id: unknown): PetItemDef | undefined => (typeof id === 'string' ? PET_ITEMS.find((i) => i.id === id) : undefined);
/** Beds and the food bag are kitnet furniture (`FURNITURE` with `shop: 'petshop'`); collars and toys live in `petItems`. */
export const isPetFurniture = (item: PetItemDef): boolean => item.kind === 'caminha' || item.kind === 'racao';
/** The collar colour of an item id (the default mustard for none or anything else). */
export const collarColor = (itemId: string | null | undefined): string => petItemById(itemId)?.color ?? DEFAULT_COLLAR;

// ---------------------------------------------------------------- ownership
export interface PetOwner {
  pets?: OwnedPet[];
  activePetId?: string | null;
  petItems?: string[];
  pet?: 'dog' | 'cat' | null;
  petNames?: { dog?: string; cat?: string };
}

const isSpecies = (v: unknown): v is PetSpecies => v === 'dog' || v === 'cat';
const str = (v: unknown, max = 64): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/** One stored pet, cleaned (garbage in an old or edited save is dropped, not thrown on). */
function cleanPet(raw: unknown): OwnedPet | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 40);
  const breed = breedById(r.breed);
  if (!id || !breed) return null;
  const coat = isBreedCoat(breed, r.coat) ? (r.coat as string) : breed.coats[0]!.id;
  const collar = petItemById(r.collar)?.kind === 'coleira' ? (r.collar as string) : null;
  const toy = petItemById(r.toy)?.kind === 'brinquedo' ? (r.toy as string) : null;
  const out: OwnedPet = { id, species: breed.species, breed: breed.id, coat, name: str(r.name, 16), collar, toy, adoptedAt: typeof r.adoptedAt === 'number' && Number.isFinite(r.adoptedAt) ? r.adoptedAt : 0 };
  if (r.legacy === true) out.legacy = true;
  return out;
}

/**
 * The pets of a profile, migrated and cleaned (idempotent). A save from before the pet shop has `pet` / `petNames` and no `pets`: its dog
 * becomes a caramelo `legacy_dog`, its cat an orange `legacy_cat`, with their names, and the one that was out stays out.
 */
export function normalizePets(p: PetOwner): { pets: OwnedPet[]; activePetId: string | null; petItems: string[] } {
  let pets: OwnedPet[];
  let activePetId: string | null;
  if (!Array.isArray(p.pets)) {
    pets = [];
    const names = p.petNames && typeof p.petNames === 'object' ? p.petNames : {};
    for (const species of ['dog', 'cat'] as const) {
      const named = str(names[species], 16);
      if (p.pet !== species && !named) continue;
      const legacy = LEGACY_BREED[species];
      pets.push({ id: `legacy_${species}`, species, breed: legacy.breed, coat: legacy.coat, name: named, collar: null, toy: null, adoptedAt: 0, legacy: true });
    }
    activePetId = isSpecies(p.pet) ? `legacy_${p.pet}` : null;
  } else {
    const seen = new Set<string>();
    pets = [];
    for (const raw of p.pets) {
      const pet = cleanPet(raw);
      if (!pet || seen.has(pet.id)) continue;
      seen.add(pet.id);
      pets.push(pet);
    }
    activePetId = typeof p.activePetId === 'string' ? p.activePetId : null;
  }
  if (activePetId && !pets.some((q) => q.id === activePetId)) activePetId = null;
  const items = Array.isArray(p.petItems) ? [...new Set(p.petItems.filter((i): i is string => !!petItemById(i) && !isPetFurniture(petItemById(i)!)))] : [];
  return { pets, activePetId, petItems: items };
}

/** Normalizes in place and writes the one-release mirrors (`pet`, `petNames`). Run from the server's `normalizeProfile`. */
export function applyPets(p: PetOwner): void {
  const n = normalizePets(p);
  p.pets = n.pets;
  p.activePetId = n.activePetId;
  p.petItems = n.petItems;
  writePetMirrors(p);
}

/** The old fields, derived: the active pet's species, and the first named dog and cat. */
export function writePetMirrors(p: PetOwner): void {
  p.pet = activePet(p)?.species ?? null;
  const names: { dog?: string; cat?: string } = {};
  for (const pet of p.pets ?? []) if (pet.name && !names[pet.species]) names[pet.species] = pet.name;
  if (names.dog || names.cat) p.petNames = names;
  else delete p.petNames;
}

/**
 * The subscriber dog and cat from before the pet shop stay a perk: the Apoiar panel's Cachorro / Gato (the `perk pet` message) and naming a
 * species give you your caramelo or your orange cat (`legacy_<species>`) when you have no pet of that species yet. Null when the six are taken.
 */
export function ensureLegacyPet(p: PetOwner, species: PetSpecies, now: number): OwnedPet | null {
  const mine = p.pets?.find((q) => q.species === species);
  if (mine) return mine;
  const legacy = LEGACY_BREED[species];
  const id = p.pets?.some((q) => q.id === `legacy_${species}`) ? newPetId(now) : `legacy_${species}`;
  if (adoptPet(p, legacy.breed, legacy.coat, now, id) !== 'ok') return null;
  const pet = p.pets!.find((q) => q.id === id)!;
  pet.legacy = true;
  return pet;
}

export function activePet(p: PetOwner): OwnedPet | null {
  return (p.activePetId && p.pets?.find((q) => q.id === p.activePetId)) || null;
}

export const ownedPet = (p: PetOwner, petId: unknown): OwnedPet | null => (typeof petId === 'string' && p.pets?.find((q) => q.id === petId)) || null;

/** A fresh pet id: `p` + base-36 time + two random characters. */
export function newPetId(now: number, rand: () => number = Math.random): string {
  const r = () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(rand() * 36)]!;
  return `p${Math.floor(now).toString(36)}${r()}${r()}`;
}

/** Adopts a pet (the caller checked the subscription and the name). The new pet does not become active here. */
export function adoptPet(p: PetOwner, breedId: string, coatId: string, now: number, id: string, name: string | null = null): 'ok' | 'unknown' | 'full' {
  const breed = breedById(breedId);
  if (!breed || !isBreedCoat(breed, coatId)) return 'unknown';
  p.pets ??= [];
  if (p.pets.length >= PET_MAX_OWNED) return 'full';
  if (p.pets.some((q) => q.id === id)) return 'unknown';
  p.pets.push({ id, species: breed.species, breed: breed.id, coat: coatId, name, collar: null, toy: null, adoptedAt: now });
  return 'ok';
}

/** Takes a pet out (null: everyone home). Mirrors follow. */
export function setActivePet(p: PetOwner, petId: string | null): 'ok' | 'unknown' {
  if (petId !== null && !ownedPet(p, petId)) return 'unknown';
  p.activePetId = petId;
  writePetMirrors(p);
  return 'ok';
}

export function renameOwnedPet(p: PetOwner, petId: string, name: string | null): boolean {
  const pet = ownedPet(p, petId);
  if (!pet) return false;
  pet.name = name;
  writePetMirrors(p);
  return true;
}

/** Admin only, never from the game: the pet leaves the profile (and is put away first if it was out). */
export function releasePet(p: PetOwner, petId: string): boolean {
  const i = p.pets?.findIndex((q) => q.id === petId) ?? -1;
  if (i < 0) return false;
  p.pets!.splice(i, 1);
  if (p.activePetId === petId) p.activePetId = null;
  writePetMirrors(p);
  return true;
}

/** Equips (or clears, `itemId` null) a collar or a toy the player owns on one of their pets. */
export function equipPetItem(p: PetOwner, petId: string, slot: 'collar' | 'toy', itemId: string | null): boolean {
  const pet = ownedPet(p, petId);
  if (!pet) return false;
  if (itemId !== null) {
    const item = petItemById(itemId);
    if (!item || item.kind !== (slot === 'collar' ? 'coleira' : 'brinquedo')) return false;
    if (!(p.petItems ?? []).includes(itemId)) return false;
    if (item.for && !item.for.includes(pet.species)) return false;
  }
  pet[slot] = itemId;
  return true;
}

/** Can this player buy that lojinha item? (The server also checks the room and the distance to the counter.) */
export function canBuyPetItem(p: PetOwner & { coins: number; furniture?: Record<string, number> }, itemId: unknown): 'ok' | 'unknown' | 'owned' | 'coins' {
  const item = petItemById(itemId);
  if (!item) return 'unknown';
  if (!isPetFurniture(item) && (p.petItems ?? []).includes(item.id)) return 'owned';
  if (p.coins < item.price) return 'coins';
  return 'ok';
}

/** Pays and stores the item: furniture goes to the kitnet inventory, collars and toys to `petItems`. */
export function buyPetItem(p: PetOwner & { coins: number; furniture: Record<string, number> }, itemId: string): 'ok' | 'unknown' | 'owned' | 'coins' {
  const r = canBuyPetItem(p, itemId);
  if (r !== 'ok') return r;
  const item = petItemById(itemId)!;
  p.coins -= item.price;
  if (isPetFurniture(item)) p.furniture[item.id] = (p.furniture[item.id] ?? 0) + 1;
  else (p.petItems ??= []).push(item.id);
  return 'ok';
}

// ---------------------------------------------------------------- looks
/** The look of an owned pet (its breed, coat and collar). */
export const ownedPetLook = (pet: OwnedPet): PetLook => petLook(pet.breed, pet.coat, collarColor(pet.collar), pet.species);

/** The look of the pet an avatar has out (`pub.pet` + the breed fields; an old server sends only `pet`). */
export function publicPetLook(pub: { pet?: 'dog' | 'cat' | null; petBreed?: string; petCoat?: string; petCollar?: string | null }): PetLook | null {
  if (pub.pet !== 'dog' && pub.pet !== 'cat') return null;
  const legacy = LEGACY_BREED[pub.pet];
  return petLook(pub.petBreed ?? legacy.breed, pub.petCoat ?? legacy.coat, collarColor(pub.petCollar), pub.pet);
}

/** The toy commands the active pet answers (`busca` needs a fetching toy, `brinca` a cat toy). */
export function petToyCommands(pub: { pet?: 'dog' | 'cat' | null; petToy?: string | null }): { fetch: boolean; play: boolean } {
  const item = petItemById(pub.petToy);
  if (!item || item.kind !== 'brinquedo' || !pub.pet || (item.for && !item.for.includes(pub.pet))) return { fetch: false, play: false };
  return { fetch: pub.pet === 'dog' && (item.id === 'bolinha' || item.id === 'ossinho' || item.id === 'pelucia'), play: pub.pet === 'cat' };
}

// ---------------------------------------------------------------- the pens
export interface PetPen {
  id: 'cercadinho' | 'gatil';
  species: PetSpecies;
  /** Tiles inside the pen (the animals stand on these). */
  tiles: [number, number][];
  /** Animals shown at once. */
  shows: number;
}

export const PET_PENS: PetPen[] = [
  { id: 'cercadinho', species: 'dog', tiles: [[6, 0], [7, 0], [8, 0], [6, 1], [7, 1], [8, 1]], shows: 3 },
  { id: 'gatil', species: 'cat', tiles: [[9, 0], [10, 0], [9, 1], [10, 1]], shows: 2 },
];
export const penById = (id: unknown): PetPen | undefined => PET_PENS.find((p) => p.id === id);

/** A small deterministic hash (FNV-1a) of the parts. */
function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export interface PenAnimal {
  slot: number;
  breed: string;
  coat: string;
}

/**
 * The animals in a pen on one game day: deterministic (every player sees the same litter), Brazilian types weighted x2, never the same
 * breed name twice in a pen. `gameDay` is any integer that changes once a day.
 */
export function penLitter(penId: string, gameDay: number): PenAnimal[] {
  const pen = penById(penId);
  if (!pen) return [];
  const pool: BreedDef[] = [];
  for (const b of BREEDS) if (b.species === pen.species) for (let i = 0; i < (b.br ? 2 : 1); i++) pool.push(b);
  const out: PenAnimal[] = [];
  const used = new Set<string>();
  for (let slot = 0; slot < pen.shows; slot++) {
    for (let k = 0; k < 40; k++) {
      const b = pool[hash(gameDay, pen.id, slot, k) % pool.length]!;
      if (used.has(b.pt)) continue;
      used.add(b.pt);
      out.push({ slot, breed: b.id, coat: b.coats[hash(gameDay, pen.id, slot, 'coat') % b.coats.length]!.id });
      break;
    }
  }
  return out;
}

/**
 * The tile an animal of the pen stands on at `step` (seconds of the shared clock): each slot has its own band of tiles and drifts between
 * them every 6-14 steps, so every player sees the same pen and two animals never share a tile.
 */
export function penAnimalTile(pen: PetPen, slot: number, step: number): [number, number] {
  const band = Math.max(1, Math.floor(pen.tiles.length / pen.shows));
  const period = 6 + (hash(pen.id, slot) % 9);
  const k = Math.floor(step / period + hash(pen.id, 'phase', slot)) % band;
  return pen.tiles[slot * band + k]!;
}

// ---------------------------------------------------------------- the kitnet residents
export type HomePetPose = 'lie' | 'sit' | 'idle';
export interface HomePet {
  id: string;
  look: PetLook;
  name: string | null;
  pose: HomePetPose;
  tile: { x: number; y: number };
  toy: string | null;
}

/** Kitnet floor tiles a pet may rest on when there is no bed (checked against the furniture). */
export const HOME_SPOTS: [number, number][] = [[6, 5], [4, 6], [2, 2], [6, 3], [3, 4], [5, 2]];

/**
 * Where the pets at home rest: one per placed caminha (lying), then the rug (lying), then the free spots (sitting or standing).
 * `blocked(x, y)` says a tile is taken by furniture that is not a bed or a rug. Never two pets on one tile; a pet with no free tile is left out.
 */
export function homePetSpots(apartment: PlacedFurniture[], pets: OwnedPet[], blocked: (x: number, y: number) => boolean = () => false): HomePet[] {
  const taken = new Set<string>();
  const beds = apartment.filter((f) => petItemById(f.itemId)?.kind === 'caminha');
  const rugs = apartment.filter((f) => f.itemId === 'tapete');
  const out: HomePet[] = [];
  for (const pet of pets) {
    let tile: { x: number; y: number } | null = null;
    let pose: HomePetPose = 'lie';
    const bed = beds.find((b) => !taken.has(`${b.x},${b.y}`));
    if (bed) tile = { x: bed.x, y: bed.y };
    else {
      const rug = rugs.find((r) => !taken.has(`${r.x},${r.y}`));
      if (rug) tile = { x: rug.x, y: rug.y };
      else {
        const spot = HOME_SPOTS.find(([x, y]) => !taken.has(`${x},${y}`) && !blocked(x, y));
        if (spot) {
          tile = { x: spot[0], y: spot[1] };
          pose = hash(pet.id) % 2 ? 'sit' : 'idle';
        }
      }
    }
    if (!tile) continue;
    taken.add(`${tile.x},${tile.y}`);
    out.push({ id: pet.id, look: ownedPetLook(pet), name: pet.name, pose, tile, toy: pet.toy });
  }
  return out;
}

// ---------------------------------------------------------------- Seu Dito's lines
/** What Seu Dito says from the panel (spoken by `dito`; listed in content/tts/extra-lines.json). */
export const PETSHOP_LINES = {
  adopt_pick: { pt: 'Esse aqui? Boa escolha. Agora é só dar um nome.', en: 'This one? Good choice. Now just give a name.' },
  adopt_done: { pt: 'Parabéns! Agora faz parte da família.', en: 'Congratulations! Now it’s part of the family.' },
  adopt_full: { pt: 'Seis já é uma matilha! Deixa um em casa primeiro.', en: 'Six is already a pack! Leave one at home first.' },
  gate: { pt: 'Adoção é pra quem apoia a Vila. Mas carinho é de graça, viu?', en: 'Adoption is for those who support the Vila. But petting is free, okay?' },
  buy_done: { pt: 'Prontinho. Seu bichinho vai adorar.', en: 'All set. Your pet will love it.' },
  buy_short: { pt: 'Faltam uns reais virtuais ainda. Volta depois, sem pressa.', en: 'You’re a few virtual reais short. Come back later, no rush.' },
  switch_out: { pt: 'Vai passear? Leva a guia!', en: 'Going for a walk? Take the leash!' },
  switch_home: { pt: 'Deixa em casa que eu sei que ele fica bem.', en: 'Leave it at home, I know it’ll be fine.' },
} as const;
export type PetshopLineId = keyof typeof PETSHOP_LINES;

/** What Seu Dito says when you pet an animal (diary line anchors `dito.pen_<key>`: each teaches a word of the chapter). */
export const PEN_LINES: Record<string, { pt: string; en: string }> = {
  pen_dog_1: { pt: 'Olha o rabo abanando! Ele gostou de você.', en: 'Look at the tail wagging! He liked you.' },
  pen_dog_2: { pt: 'Essa aqui adora carinho na barriga.', en: 'This one loves a belly rub.' },
  pen_dog_3: { pt: 'Cuidado, ele lambe o nariz de todo mundo!', en: 'Careful, he licks everyone’s nose!' },
  pen_cat_1: { pt: 'Tá ouvindo? Ele tá ronronando.', en: 'Hear that? He’s purring.' },
  pen_cat_2: { pt: 'Olha o bigode dela, todo arrepiado.', en: 'Look at her whiskers, all bristled.' },
  pen_cat_3: { pt: 'Esse gato brinca com tudo. Até com o rabo!', en: 'This cat plays with everything. Even its tail!' },
};

/** Which pen line a carinho earns: the species, rotating by day and slot. */
export function penLineKey(species: PetSpecies, gameDay: number, slot: number): string {
  return `pen_${species}_${1 + (((gameDay + slot) % 3) + 3) % 3}`;
}

/** The commands a pet obeys, for the Meus pets cheat sheet (spoken by `ui`). */
export const PET_COMMANDS = [
  { pt: 'senta', en: 'sit' },
  { pt: 'deita', en: 'lie down' },
  { pt: 'vem', en: 'come' },
  { pt: 'busca', en: 'fetch' },
  { pt: 'brinca', en: 'play' },
] as const;
