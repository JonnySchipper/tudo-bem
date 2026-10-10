/**
 * The Pet Shop do Seu Dito breed catalog (#234). A breed is one body shape and one marking pattern; its coats are pairs of base colours
 * (`coat`, `coat2`) that the client swaps into the key-coloured strip `chars/pet_<species>_<shape>_<pattern>` at runtime. A coat that
 * needs another pattern (fila tigrado, buldogue tigrado, lhasa manchado, dachshund arlequim, boxer tigrado) is its own `BreedDef` with
 * the same `pt` and an id suffix, so the look stays a pure function of `(breed, coat)`. The UI groups breeds by `pt`.
 * needs_br: true (every `pt`, and every coat name)
 */

export type PetSpecies = 'dog' | 'cat';
export type DogShape = 'medio' | 'grande' | 'pequeno' | 'peludo' | 'salsicha';
export type CatShape = 'comum' | 'peludo' | 'esguio';
export type PetShape = DogShape | CatShape;
/** Marking masks drawn in the `coat2` key ramp over the `coat` base. */
export type PetPattern = 'solido' | 'peito' | 'manchado' | 'pintado' | 'tigrado' | 'sela' | 'pontas';

export const PET_PATTERNS: readonly PetPattern[] = ['solido', 'peito', 'manchado', 'pintado', 'tigrado', 'sela', 'pontas'];
export const DOG_SHAPES: readonly DogShape[] = ['medio', 'grande', 'pequeno', 'peludo', 'salsicha'];
export const CAT_SHAPES: readonly CatShape[] = ['comum', 'peludo', 'esguio'];

export interface CoatOption {
  id: string;
  pt: string;
  en: string;
  /** Base colour (`#rrggbb`): the coat ramp is built from it. */
  coat: string;
  /** Marking colour: the pattern mask is drawn in this ramp. */
  coat2: string;
}

export interface BreedDef {
  id: string;
  species: PetSpecies;
  pt: string;
  en: string;
  shape: PetShape;
  pattern: PetPattern;
  /** First entry is the default coat. */
  coats: CoatOption[];
  size: 'pequeno' | 'medio' | 'grande';
  /** Brazilian breed or type: shown first in the pens and the catalog. */
  br?: boolean;
}

/** The collar a pet wears when no collar item is equipped (mustard, like the subscriber dog's). */
export const DEFAULT_COLLAR = '#d4a017';

// colours used by more than one coat
const C = {
  branco: '#eeeae2',
  creme: '#ead6ad',
  preto: '#3d383c',
  marrom: '#7a4a2a',
  cinza: '#8c8c94',
  caramelo: '#daa463',
  fulvo: '#c99a5b',
  chocolate: '#64402a',
  dourado: '#d69b45',
  castanho: '#a8642e',
  laranja: '#e0913f',
  laranjaEscuro: '#a85a22',
  ruivo: '#b8562a',
  tigradoEscuro: '#4a362a',
} as const;

const coat = (id: string, pt: string, en: string, base: string, marks: string = base): CoatOption => ({ id, pt, en, coat: base, coat2: marks });

export const BREEDS: BreedDef[] = [
  // ---------------------------------------------------------------- dogs
  {
    id: 'vira_lata_caramelo',
    species: 'dog',
    pt: 'Vira-lata caramelo',
    en: 'Caramel mutt',
    shape: 'medio',
    pattern: 'peito',
    size: 'medio',
    br: true,
    coats: [coat('caramelo', 'Caramelo', 'Caramel', C.caramelo, '#f2dfb8')],
  },
  {
    id: 'vira_lata',
    species: 'dog',
    pt: 'Vira-lata',
    en: 'Mutt (SRD)',
    shape: 'medio',
    pattern: 'manchado',
    size: 'medio',
    br: true,
    coats: [
      coat('preto_branco', 'Preto e branco', 'Black and white', C.branco, C.preto),
      coat('marrom_branco', 'Marrom e branco', 'Brown and white', C.branco, C.marrom),
      coat('cinza', 'Cinza', 'Grey', C.cinza, '#6a6a72'),
      coat('tricolor', 'Tricolor', 'Tricolour', C.castanho, C.preto),
    ],
  },
  {
    id: 'fila_brasileiro',
    species: 'dog',
    pt: 'Fila brasileiro',
    en: 'Fila Brasileiro',
    shape: 'grande',
    pattern: 'pontas',
    size: 'grande',
    br: true,
    coats: [coat('fulvo', 'Fulvo', 'Fawn', C.fulvo, '#4a3428'), coat('preto', 'Preto', 'Black', C.preto, '#2c282c')],
  },
  {
    id: 'fila_brasileiro_tigrado',
    species: 'dog',
    pt: 'Fila brasileiro',
    en: 'Fila Brasileiro',
    shape: 'grande',
    pattern: 'tigrado',
    size: 'grande',
    br: true,
    coats: [coat('tigrado', 'Tigrado', 'Brindle', '#9a7048', C.tigradoEscuro)],
  },
  {
    id: 'terrier_brasileiro',
    species: 'dog',
    pt: 'Terrier brasileiro (Fox Paulistinha)',
    en: 'Brazilian Terrier',
    shape: 'pequeno',
    pattern: 'manchado',
    size: 'pequeno',
    br: true,
    coats: [coat('tricolor', 'Tricolor', 'Tricolour', C.branco, C.preto), coat('branco_marrom', 'Branco e marrom', 'White and brown', C.branco, C.castanho)],
  },
  {
    id: 'labrador',
    species: 'dog',
    pt: 'Labrador',
    en: 'Labrador',
    shape: 'grande',
    pattern: 'solido',
    size: 'grande',
    coats: [coat('amarelo', 'Amarelo', 'Yellow', '#e3c27a'), coat('chocolate', 'Chocolate', 'Chocolate', C.chocolate), coat('preto', 'Preto', 'Black', C.preto)],
  },
  {
    id: 'golden',
    species: 'dog',
    pt: 'Golden retriever',
    en: 'Golden retriever',
    shape: 'grande',
    pattern: 'solido',
    size: 'grande',
    coats: [coat('dourado', 'Dourado', 'Golden', C.dourado), coat('creme', 'Creme', 'Cream', C.creme)],
  },
  {
    id: 'pastor_alemao',
    species: 'dog',
    pt: 'Pastor-alemão',
    en: 'German shepherd',
    shape: 'grande',
    pattern: 'sela',
    size: 'grande',
    coats: [coat('preto_castanho', 'Preto e castanho', 'Black and tan', C.castanho, C.preto), coat('preto', 'Preto', 'Black', C.preto, '#2c282c')],
  },
  {
    id: 'rottweiler',
    species: 'dog',
    pt: 'Rottweiler',
    en: 'Rottweiler',
    shape: 'grande',
    pattern: 'sela',
    size: 'grande',
    coats: [coat('preto_ferrugem', 'Preto e ferrugem', 'Black and rust', '#9a5228', C.preto)],
  },
  {
    id: 'boxer',
    species: 'dog',
    pt: 'Boxer',
    en: 'Boxer',
    shape: 'grande',
    pattern: 'pontas',
    size: 'grande',
    coats: [coat('fulvo', 'Fulvo', 'Fawn', C.fulvo, '#3a2c28')],
  },
  {
    id: 'boxer_tigrado',
    species: 'dog',
    pt: 'Boxer',
    en: 'Boxer',
    shape: 'grande',
    pattern: 'tigrado',
    size: 'grande',
    coats: [coat('tigrado', 'Tigrado', 'Brindle', '#a87a4c', C.tigradoEscuro)],
  },
  {
    id: 'husky',
    species: 'dog',
    pt: 'Husky siberiano',
    en: 'Siberian husky',
    shape: 'grande',
    pattern: 'peito',
    size: 'grande',
    coats: [
      coat('cinza_branco', 'Cinza e branco', 'Grey and white', '#7c7e88', C.branco),
      coat('preto_branco', 'Preto e branco', 'Black and white', C.preto, C.branco),
      coat('ruivo_branco', 'Ruivo e branco', 'Red and white', C.ruivo, C.branco),
    ],
  },
  {
    id: 'border_collie',
    species: 'dog',
    pt: 'Border collie',
    en: 'Border collie',
    shape: 'medio',
    pattern: 'peito',
    size: 'medio',
    coats: [
      coat('preto_branco', 'Preto e branco', 'Black and white', C.preto, C.branco),
      coat('marrom_branco', 'Marrom e branco', 'Brown and white', C.marrom, C.branco),
      coat('merle', 'Merle (cinza mesclado)', 'Merle (mottled grey)', '#8e96a2', C.branco),
    ],
  },
  {
    id: 'beagle',
    species: 'dog',
    pt: 'Beagle',
    en: 'Beagle',
    shape: 'medio',
    pattern: 'sela',
    size: 'medio',
    coats: [coat('tricolor', 'Tricolor', 'Tricolour', C.castanho, C.preto), coat('limao_branco', 'Limão e branco', 'Lemon and white', C.branco, '#e8cf86')],
  },
  {
    id: 'cocker',
    species: 'dog',
    pt: 'Cocker spaniel',
    en: 'Cocker spaniel',
    shape: 'medio',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('dourado', 'Dourado', 'Golden', C.dourado), coat('preto', 'Preto', 'Black', C.preto), coat('chocolate', 'Chocolate', 'Chocolate', C.chocolate)],
  },
  {
    id: 'dalmata',
    species: 'dog',
    pt: 'Dálmata',
    en: 'Dalmatian',
    shape: 'grande',
    pattern: 'pintado',
    size: 'grande',
    coats: [coat('branco_preto', 'Branco e preto', 'White and black', C.branco, C.preto), coat('branco_figado', 'Branco e fígado', 'White and liver', C.branco, '#7b3f2a')],
  },
  {
    id: 'poodle',
    species: 'dog',
    pt: 'Poodle',
    en: 'Poodle',
    shape: 'peludo',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('branco', 'Branco', 'White', C.branco), coat('preto', 'Preto', 'Black', C.preto), coat('damasco', 'Damasco', 'Apricot', '#e3a96e'), coat('cinza', 'Cinza', 'Grey', C.cinza)],
  },
  {
    id: 'shih_tzu',
    species: 'dog',
    pt: 'Shih-tzu',
    en: 'Shih Tzu',
    shape: 'peludo',
    pattern: 'manchado',
    size: 'pequeno',
    coats: [
      coat('dourado_branco', 'Dourado e branco', 'Gold and white', C.branco, C.dourado),
      coat('preto_branco', 'Preto e branco', 'Black and white', C.branco, C.preto),
      coat('cinza_branco', 'Cinza e branco', 'Grey and white', C.branco, C.cinza),
    ],
  },
  {
    id: 'lhasa_apso',
    species: 'dog',
    pt: 'Lhasa apso',
    en: 'Lhasa Apso',
    shape: 'peludo',
    pattern: 'solido',
    size: 'pequeno',
    coats: [coat('dourado', 'Dourado', 'Golden', C.dourado), coat('creme', 'Creme', 'Cream', C.creme)],
  },
  {
    id: 'lhasa_apso_manchado',
    species: 'dog',
    pt: 'Lhasa apso',
    en: 'Lhasa Apso',
    shape: 'peludo',
    pattern: 'manchado',
    size: 'pequeno',
    coats: [coat('preto_branco', 'Preto e branco', 'Black and white', C.branco, C.preto)],
  },
  {
    id: 'maltes',
    species: 'dog',
    pt: 'Maltês',
    en: 'Maltese',
    shape: 'peludo',
    pattern: 'solido',
    size: 'pequeno',
    coats: [coat('branco', 'Branco', 'White', '#f4f1ea')],
  },
  {
    id: 'yorkshire',
    species: 'dog',
    pt: 'Yorkshire',
    en: 'Yorkshire terrier',
    shape: 'peludo',
    pattern: 'sela',
    size: 'pequeno',
    coats: [coat('aco_dourado', 'Aço e dourado', 'Steel and gold', C.dourado, '#5e6878')],
  },
  {
    id: 'spitz_alemao',
    species: 'dog',
    pt: 'Spitz alemão (lulu-da-pomerânia)',
    en: 'Pomeranian',
    shape: 'peludo',
    pattern: 'solido',
    size: 'pequeno',
    coats: [coat('laranja', 'Laranja', 'Orange', C.laranja), coat('creme', 'Creme', 'Cream', C.creme), coat('preto', 'Preto', 'Black', C.preto)],
  },
  {
    id: 'pinscher',
    species: 'dog',
    pt: 'Pinscher',
    en: 'Miniature pinscher',
    shape: 'pequeno',
    pattern: 'sela',
    size: 'pequeno',
    coats: [coat('preto_castanho', 'Preto e castanho', 'Black and tan', C.castanho, C.preto), coat('vermelho', 'Vermelho', 'Red', '#9a4628', '#7a3420')],
  },
  {
    id: 'chihuahua',
    species: 'dog',
    pt: 'Chihuahua',
    en: 'Chihuahua',
    shape: 'pequeno',
    pattern: 'solido',
    size: 'pequeno',
    coats: [coat('caramelo', 'Caramelo', 'Caramel', C.caramelo), coat('preto', 'Preto', 'Black', C.preto), coat('branco', 'Branco', 'White', C.branco), coat('chocolate', 'Chocolate', 'Chocolate', C.chocolate)],
  },
  {
    id: 'buldogue_frances',
    species: 'dog',
    pt: 'Buldogue francês',
    en: 'French bulldog',
    shape: 'pequeno',
    pattern: 'manchado',
    size: 'pequeno',
    coats: [
      coat('fulvo', 'Fulvo', 'Fawn', C.fulvo, '#b0844c'),
      coat('preto_branco', 'Preto e branco', 'Black and white', C.branco, C.preto),
      coat('creme', 'Creme', 'Cream', C.creme, '#d8c094'),
    ],
  },
  {
    id: 'buldogue_frances_tigrado',
    species: 'dog',
    pt: 'Buldogue francês',
    en: 'French bulldog',
    shape: 'pequeno',
    pattern: 'tigrado',
    size: 'pequeno',
    coats: [coat('tigrado', 'Tigrado', 'Brindle', '#6e5240', '#33261e')],
  },
  {
    id: 'pug',
    species: 'dog',
    pt: 'Pug',
    en: 'Pug',
    shape: 'pequeno',
    pattern: 'pontas',
    size: 'pequeno',
    coats: [coat('fulvo', 'Fulvo (máscara preta)', 'Fawn (black mask)', '#d4b07a', '#3a3034'), coat('preto', 'Preto', 'Black', C.preto, '#2c282c')],
  },
  {
    id: 'dachshund',
    species: 'dog',
    pt: 'Dachshund (salsicha)',
    en: 'Dachshund',
    shape: 'salsicha',
    pattern: 'sela',
    size: 'pequeno',
    coats: [
      coat('preto_castanho', 'Preto e castanho', 'Black and tan', C.castanho, C.preto),
      coat('vermelho', 'Vermelho', 'Red', '#a8522a', '#8a4022'),
      coat('chocolate', 'Chocolate', 'Chocolate', '#9a6a44', C.chocolate),
    ],
  },
  {
    id: 'dachshund_arlequim',
    species: 'dog',
    pt: 'Dachshund (salsicha)',
    en: 'Dachshund',
    shape: 'salsicha',
    pattern: 'manchado',
    size: 'pequeno',
    coats: [coat('arlequim', 'Arlequim', 'Dapple', '#9aa0a8', C.preto)],
  },
  // ---------------------------------------------------------------- cats
  {
    id: 'gato_srd',
    species: 'cat',
    pt: 'Gato vira-lata (SRD)',
    en: 'Mixed-breed cat',
    shape: 'comum',
    pattern: 'solido',
    size: 'medio',
    br: true,
    coats: [coat('preto', 'Preto', 'Black', C.preto), coat('branco', 'Branco', 'White', C.branco), coat('cinza', 'Cinza', 'Grey', C.cinza), coat('laranja', 'Laranja', 'Orange', C.laranja)],
  },
  {
    id: 'gato_laranja',
    species: 'cat',
    pt: 'Gato laranja',
    en: 'Orange cat',
    shape: 'comum',
    pattern: 'tigrado',
    size: 'medio',
    br: true,
    coats: [coat('laranja', 'Laranja', 'Orange', C.laranja, C.laranjaEscuro)],
  },
  {
    id: 'frajola',
    species: 'cat',
    pt: 'Frajola (preto e branco)',
    en: 'Tuxedo cat',
    shape: 'comum',
    pattern: 'peito',
    size: 'medio',
    br: true,
    coats: [coat('preto_branco', 'Preto e branco', 'Black and white', C.preto, C.branco)],
  },
  {
    id: 'escaminha',
    species: 'cat',
    pt: 'Gata escaminha (casco de tartaruga)',
    en: 'Tortoiseshell',
    shape: 'comum',
    pattern: 'manchado',
    size: 'medio',
    br: true,
    coats: [coat('preto_laranja', 'Preto e laranja', 'Black and orange', C.preto, C.laranja), coat('tricolor', 'Tricolor', 'Tricolour', C.branco, C.laranja)],
  },
  {
    id: 'tigrado',
    species: 'cat',
    pt: 'Gato tigrado',
    en: 'Tabby cat',
    shape: 'comum',
    pattern: 'tigrado',
    size: 'medio',
    coats: [coat('cinza', 'Cinza', 'Grey', '#9a9aa0', '#4e4e56'), coat('marrom', 'Marrom', 'Brown', '#9a7452', C.tigradoEscuro)],
  },
  {
    id: 'siames',
    species: 'cat',
    pt: 'Siamês',
    en: 'Siamese',
    shape: 'esguio',
    pattern: 'pontas',
    size: 'medio',
    coats: [
      coat('seal', 'Seal', 'Seal point', '#eadcc4', '#4a3528'),
      coat('blue', 'Azul', 'Blue point', '#e6e2dc', '#7c8494'),
      coat('chocolate', 'Chocolate', 'Chocolate point', '#efe2cc', '#7a5236'),
      coat('lilas', 'Lilás', 'Lilac point', '#eee8e4', '#b8a9b4'),
    ],
  },
  {
    id: 'persa',
    species: 'cat',
    pt: 'Persa',
    en: 'Persian',
    shape: 'peludo',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('branco', 'Branco', 'White', C.branco), coat('creme', 'Creme', 'Cream', C.creme), coat('cinza', 'Cinza', 'Grey', C.cinza), coat('preto', 'Preto', 'Black', C.preto)],
  },
  {
    id: 'maine_coon',
    species: 'cat',
    pt: 'Maine coon',
    en: 'Maine Coon',
    shape: 'peludo',
    pattern: 'tigrado',
    size: 'grande',
    coats: [coat('marrom', 'Marrom', 'Brown', '#8a6a48', '#4a3424'), coat('cinza', 'Cinza', 'Grey', '#8e9098', '#4e5058'), coat('ruivo', 'Ruivo', 'Red', C.ruivo, '#7a3618')],
  },
  {
    id: 'ragdoll',
    species: 'cat',
    pt: 'Ragdoll',
    en: 'Ragdoll',
    shape: 'peludo',
    pattern: 'pontas',
    size: 'grande',
    coats: [coat('seal_branco', 'Seal e branco', 'Seal and white', '#eee6d8', '#5a4232'), coat('blue_branco', 'Azul e branco', 'Blue and white', '#eceae6', '#7c8494')],
  },
  {
    id: 'angora',
    species: 'cat',
    pt: 'Angorá',
    en: 'Angora',
    shape: 'peludo',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('branco', 'Branco', 'White', '#f4f1ea')],
  },
  {
    id: 'british',
    species: 'cat',
    pt: 'British shorthair',
    en: 'British Shorthair',
    shape: 'comum',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('azul', 'Azul (cinza-azulado)', 'Blue (blue-grey)', '#8a96a8'), coat('lilas', 'Lilás', 'Lilac', '#b8a9b4'), coat('creme', 'Creme', 'Cream', C.creme)],
  },
  {
    id: 'bengal',
    species: 'cat',
    pt: 'Bengal',
    en: 'Bengal',
    shape: 'esguio',
    pattern: 'pintado',
    size: 'medio',
    coats: [coat('dourado_preto', 'Dourado e preto', 'Gold and black', '#d8a656', '#3d3028'), coat('prata_preto', 'Prata e preto', 'Silver and black', '#c4c6cc', '#3d383c')],
  },
  {
    id: 'sphynx',
    species: 'cat',
    pt: 'Sphynx',
    en: 'Sphynx',
    shape: 'esguio',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('rosa', 'Rosa', 'Pink', '#e9b4a6'), coat('cinza', 'Cinza', 'Grey', '#a8a4a8')],
  },
  {
    id: 'oriental',
    species: 'cat',
    pt: 'Oriental',
    en: 'Oriental shorthair',
    shape: 'esguio',
    pattern: 'solido',
    size: 'medio',
    coats: [coat('preto', 'Preto', 'Black', C.preto), coat('branco', 'Branco', 'White', C.branco), coat('chocolate', 'Chocolate', 'Chocolate', C.chocolate)],
  },
];

const BY_ID = new Map(BREEDS.map((b) => [b.id, b]));

export const breedById = (id: unknown): BreedDef | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined);
export const coatOf = (breed: BreedDef, coatId: string | null | undefined): CoatOption => breed.coats.find((c) => c.id === coatId) ?? breed.coats[0];
/** True when the coat id belongs to the breed (the server refuses anything else). */
export const isBreedCoat = (breed: BreedDef, coatId: unknown): boolean => typeof coatId === 'string' && breed.coats.some((c) => c.id === coatId);

/** Breeds grouped by `pt` (a breed and its pattern variants are one entry in the catalog), Brazilian first, then alphabetical. */
export function breedGroups(species?: PetSpecies): { pt: string; en: string; species: PetSpecies; br: boolean; breeds: BreedDef[] }[] {
  const groups = new Map<string, { pt: string; en: string; species: PetSpecies; br: boolean; breeds: BreedDef[] }>();
  for (const b of BREEDS) {
    if (species && b.species !== species) continue;
    const k = `${b.species}:${b.pt}`;
    const g = groups.get(k) ?? { pt: b.pt, en: b.en, species: b.species, br: !!b.br, breeds: [] };
    g.breeds.push(b);
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => Number(b.br) - Number(a.br) || a.pt.localeCompare(b.pt, 'pt-BR'));
}

export interface PetLook {
  species: PetSpecies;
  shape: PetShape;
  pattern: PetPattern;
  coat: string;
  coat2: string;
  collar: string;
}

const FALLBACK: Record<PetSpecies, string> = { dog: 'vira_lata_caramelo', cat: 'gato_laranja' };

/** The look of one pet. Unknown breeds fall back to the caramelo (or the orange cat when the id says `cat`); never throws. */
export function petLook(breedId: string | null | undefined, coatId: string | null | undefined, collar: string | null | undefined, species?: PetSpecies): PetLook {
  const breed = breedById(breedId) ?? breedById(FALLBACK[species ?? 'dog'])!;
  const c = coatOf(breed, coatId);
  return { species: breed.species, shape: breed.shape, pattern: breed.pattern, coat: c.coat, coat2: c.coat2, collar: collar && /^#[0-9a-f]{6}$/i.test(collar) ? collar.toLowerCase() : DEFAULT_COLLAR };
}

/** The manifest key of the key-coloured strip for one look. */
export const petStripKey = (l: { species: PetSpecies; shape: PetShape; pattern: PetPattern }): string => `chars/pet_${l.species}_${l.shape}_${l.pattern}`;

/** Every (species, shape, pattern) strip the art pipeline must bake: derived from BREEDS, tested against the manifest. */
export function petStripKeys(): string[] {
  return [...new Set(BREEDS.map((b) => petStripKey(b)))];
}

/** The same, as triples (the art pipeline bakes exactly these). */
export function petStripCombos(): { species: PetSpecies; shape: PetShape; pattern: PetPattern }[] {
  const seen = new Set<string>();
  const out: { species: PetSpecies; shape: PetShape; pattern: PetPattern }[] = [];
  for (const b of BREEDS) {
    const k = petStripKey(b);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ species: b.species, shape: b.shape, pattern: b.pattern });
  }
  return out;
}

/** The legacy subscriber dog and cat (before #234) as breeds: what an old profile's `pet: 'dog' | 'cat'` becomes. */
export const LEGACY_BREED: Record<PetSpecies, { breed: string; coat: string }> = {
  dog: { breed: 'vira_lata_caramelo', coat: 'caramelo' },
  cat: { breed: 'gato_laranja', coat: 'laranja' },
};
