import type { Appearance, BodyType, BottomStyle, ExtraStyle, FaceStyle, HairStyle, IdlePose, TopStyle } from './types.js';

/**
 * Praça CPU wardrobe (character redesign v1). Each neighbor wears an authored São Paulo street look
 * that is stable per name, so Helena is always Helena. The crowd picks names whose looks are not
 * already on the square, so a crowd never reads as recolored clones.
 */
export interface CpuLook {
  archetype: string;
  appearance: Appearance;
  hat: string | null;
}

interface Archetype {
  body: BodyType[];
  hair: HairStyle[];
  /** Hair color indices (HAIR_COLORS). */
  hairColor: number[];
  top: TopStyle;
  topColor: number[];
  bottom: BottomStyle;
  bottomColor: number[];
  shoes: number[];
  face: FaceStyle[];
  extra: ExtraStyle[];
  idle: IdlePose;
  hats: (string | null)[];
  skin?: number[];
  /** Wave 2: neighbourhood pieces (GARB_IDS joined by '+'); one is picked per name */
  garb?: string[];
}

// Color indices: 0 verde · 1 mostarda · 2 jeans · 3 terracota · 4 off-white · 5 grafite · 6 tijolo · 7 ameixa · 8 petróleo · 9 rosa antigo · 10 cáqui · 11 oliva
const A = (x: Archetype) => x;

/** Looks worn by names that read feminine in Portuguese (presentation only; nothing else depends on it). */
export const CPU_LOOKS_A: Record<string, Archetype> = {
  tia_do_bairro: A({ body: ['medio', 'forte'], hair: ['coque'], hairColor: [5], top: 'camisa', topColor: [9], bottom: 'saia', bottomColor: [3, 10], shoes: [2], face: ['maduro'], extra: ['brincos'], idle: 'bolsa', hats: ['chapeu_sol'] }),
  estudante: A({ body: ['esguio', 'medio'], hair: ['ondulado', 'longo'], hairColor: [1, 2, 4], top: 'camiseta', topColor: [0], bottom: 'saia', bottomColor: [2], shoes: [0], face: ['doce', 'suave'], extra: ['brincos', 'sardas'], idle: 'solto', hats: [null, 'bucket_amarelo'], garb: ['mochila'] }),
  corredora: A({ body: ['esguio'], hair: ['coque'], hairColor: [0, 1, 3], top: 'regata', topColor: [8, 3], bottom: 'bermuda', bottomColor: [5], shoes: [4, 0], face: ['marcante'], extra: ['nenhum'], idle: 'cintura', hats: ['viseira_azul'] }),
  artista: A({ body: ['medio'], hair: ['black'], hairColor: [0, 1], top: 'camiseta', topColor: [7], bottom: 'calca', bottomColor: [10, 5], shoes: [1], face: ['suave'], extra: ['brincos'], idle: 'cafe', hats: ['gorro_listrado', null] }),
  universitaria: A({ body: ['medio', 'esguio'], hair: ['trancas'], hairColor: [0, 6], top: 'moletom', topColor: [6], bottom: 'calca', bottomColor: [2], shoes: [0], face: ['doce'], extra: ['oculos'], idle: 'celular', hats: [null], garb: ['mochila'] }),
  executiva: A({ body: ['esguio', 'medio'], hair: ['ondulado', 'curto'], hairColor: [0, 2], top: 'blusa', topColor: [10, 12], bottom: 'calca', bottomColor: [5], shoes: [1], face: ['marcante'], extra: ['brincos'], idle: 'solto', hats: [null], garb: ['sacola'] }),
  cacheada_feira: A({ body: ['forte', 'medio'], hair: ['cacheado'], hairColor: [0, 3], top: 'camiseta', topColor: [0, 3], bottom: 'saia', bottomColor: [7, 11], shoes: [2, 0], face: ['suave'], extra: ['brincos', 'nenhum'], idle: 'cafe', hats: ['chapeu_palha', 'coroa_flores'] }),
// wave 2 (bairro): the avó with her feira cart, the torcedora in a green striped jersey, the neighbour with a tote on the way home  avo_feira: A({ body: ['forte', 'medio'], hair: ['coque'], hairColor: [5], top: 'camisa', topColor: [7], bottom: 'saia', bottomColor: [3], shoes: [2], face: ['maduro'], extra: ['oculos'], idle: 'solto', hats: [null], garb: ['carrinho'], skin: [2, 3, 4, 5] }),  torcedora: A({ body: ['medio', 'esguio'], hair: ['curto', 'ondulado'], hairColor: [0, 1], top: 'camiseta', topColor: [0], bottom: 'bermuda', bottomColor: [5], shoes: [0, 1], face: ['marcante', 'doce'], extra: ['brincos', 'nenhum'], idle: 'cintura', hats: [null], garb: ['jersey_verde+chinelo', 'jersey_verde'] }),  comerciaria: A({ body: ['medio'], hair: ['longo', 'trancas'], hairColor: [0, 1], top: 'blusa', topColor: [6], bottom: 'calca', bottomColor: [10], shoes: [4, 2], face: ['suave'], extra: ['sardas', 'nenhum'], idle: 'solto', hats: ['viseira_azul', null], garb: ['sacola'] }),
};

/** Looks worn by names that read masculine. */
export const CPU_LOOKS_B: Record<string, Archetype> = {
  executivo: A({ body: ['medio', 'esguio'], hair: ['undercut'], hairColor: [0, 1], top: 'camisa', topColor: [4], bottom: 'calca', bottomColor: [5, 10], shoes: [1], face: ['marcante'], extra: ['oculos'], idle: 'celular', hats: [null] }),
  skatista: A({ body: ['esguio', 'medio'], hair: ['cacheado'], hairColor: [0, 1, 2], top: 'moletom', topColor: [11], bottom: 'bermuda', bottomColor: [10, 2], shoes: [0, 4], face: ['doce', 'suave'], extra: ['nenhum', 'sardas'], idle: 'bolsos', hats: ['bone_verde'], garb: ['mochila'] }),
  aposentado: A({ body: ['forte', 'medio'], hair: ['raspado'], hairColor: [5], top: 'camisa', topColor: [8], bottom: 'calca', bottomColor: [10], shoes: [1, 2], face: ['maduro'], extra: ['bigode'], idle: 'bracos', hats: ['panama'] }),
  ciclista: A({ body: ['esguio', 'medio'], hair: ['raspado', 'curto'], hairColor: [0, 2, 4], top: 'camiseta', topColor: [1], bottom: 'bermuda', bottomColor: [2, 5], shoes: [3, 0], face: ['suave'], extra: ['sardas', 'nenhum'], idle: 'solto', hats: ['capacete_bike'] }),
  cafe_da_esquina: A({ body: ['medio', 'forte'], hair: ['curto', 'coque'], hairColor: [0, 1], top: 'camisa', topColor: [2], bottom: 'calca', bottomColor: [5], shoes: [2, 1], face: ['marcante'], extra: ['barba'], idle: 'cafe', hats: ['boina_vermelha'] }),
  musico: A({ body: ['esguio'], hair: ['longo', 'trancas'], hairColor: [0, 1], top: 'camiseta', topColor: [5], bottom: 'calca', bottomColor: [10], shoes: [1, 0], face: ['suave'], extra: ['barba', 'brincos'], idle: 'bolsos', hats: ['bucket_amarelo', null] }),
  black_power: A({ body: ['medio', 'forte'], hair: ['black'], hairColor: [0], top: 'regata', topColor: [12, 1], bottom: 'bermuda', bottomColor: [11], shoes: [0, 1], face: ['doce', 'marcante'], extra: ['nenhum', 'barba'], idle: 'bracos', hats: [null, 'bucket_amarelo'] }),
  // wave 2 (bairro): the motoboy between deliveries, the corintiano in his striped jersey and chinelos, the jardineiro, the runner
  motoboy: A({ body: ['medio', 'esguio'], hair: ['curto', 'undercut'], hairColor: [0, 1], top: 'moletom', topColor: [5], bottom: 'calca', bottomColor: [2], shoes: [1], face: ['marcante'], extra: ['nenhum', 'barba'], idle: 'solto', hats: ['capacete_bike'], garb: ['jaqueta+caixa'] }),
  corintiano: A({ body: ['medio', 'forte'], hair: ['raspado', 'curto'], hairColor: [0, 2], top: 'camiseta', topColor: [5], bottom: 'bermuda', bottomColor: [11], shoes: [0], face: ['suave', 'maduro'], extra: ['bigode', 'nenhum'], idle: 'bracos', hats: [null], garb: ['jersey_alvinegro+chinelo', 'jersey_alvinegro'] }),
  jardineiro: A({ body: ['forte', 'medio'], hair: ['cacheado', 'curto'], hairColor: [0, 3], top: 'camiseta', topColor: [1], bottom: 'calca', bottomColor: [3], shoes: [2], face: ['doce'], extra: ['barba', 'nenhum'], idle: 'solto', hats: [null], garb: ['macacao+balde', 'macacao'] }),
  corredor: A({ body: ['esguio'], hair: ['undercut', 'raspado'], hairColor: [0, 1], top: 'regata', topColor: [8], bottom: 'bermuda', bottomColor: [2], shoes: [4, 0], face: ['marcante', 'suave'], extra: ['nenhum'], idle: 'cintura', hats: ['viseira_azul', null] }),
};

/**
 * The five neighbors TB Art called out are fully authored (no per-name variation), so each pair
 * differs on at least three of hair, top, bottoms, posture and accessory.
 */
const AUTHORED: Record<string, { appearance: Appearance; hat: string | null }> = {
  Helena: { appearance: { body: 'medio', skin: 1, hair: 'coque', hairColor: 5, top: 'camisa', topColor: 9, bottom: 'saia', bottomColor: 10, shoes: 2, face: 'maduro', extra: 'brincos', idle: 'bolsa' }, hat: 'chapeu_sol' },
  Daniel: { appearance: { body: 'esguio', skin: 6, hair: 'undercut', hairColor: 0, top: 'camisa', topColor: 4, bottom: 'calca', bottomColor: 5, shoes: 1, face: 'marcante', extra: 'oculos', idle: 'celular' }, hat: null },
  Mateus: { appearance: { body: 'medio', skin: 3, hair: 'cacheado', hairColor: 1, top: 'moletom', topColor: 11, bottom: 'bermuda', bottomColor: 10, shoes: 0, face: 'doce', extra: 'sardas', idle: 'bolsos' }, hat: 'bone_verde' },
  Felipe: { appearance: { body: 'esguio', skin: 0, hair: 'raspado', hairColor: 3, top: 'camiseta', topColor: 1, bottom: 'bermuda', bottomColor: 2, shoes: 3, face: 'suave', extra: 'nenhum', idle: 'solto' }, hat: 'capacete_bike' },
  Rafael: { appearance: { body: 'forte', skin: 5, hair: 'curto', hairColor: 0, top: 'camisa', topColor: 2, bottom: 'calca', bottomColor: 10, shoes: 2, face: 'marcante', extra: 'barba', idle: 'cafe' }, hat: 'boina_vermelha' },
};

/** Named neighbors map to their archetype (used to keep looks unique on the square). */
const NAMED: Record<string, string> = {
  Helena: 'tia_do_bairro',
  Daniel: 'executivo',
  Mateus: 'skatista',
  Felipe: 'ciclista',
  Rafael: 'cafe_da_esquina',
  Beatriz: 'estudante',
  Camila: 'corredora',
  Paulo: 'aposentado',
  Larissa: 'universitaria',
  André: 'black_power',
  Renata: 'executiva',
  Diego: 'musico',
  Natasha: 'artista',
  Fernanda: 'cacheada_feira',
  Patricia: 'avo_feira',
  Gabriela: 'torcedora',
  Carolina: 'comerciaria',
  Igor: 'motoboy',
  Gustavo: 'corintiano',
  Roberto: 'jardineiro',
  Thiago: 'corredor',
};

function hashName(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return (h ^ (h >>> 13)) >>> 0;
}

const pickBy = <T>(arr: readonly T[], name: string, salt: number): T => arr[hashName(name, salt) % arr.length];

export const readsFeminine = (name: string) => /a$/i.test(name) || name === 'Beatriz';

/** Stable archetype id for a CPU first name. */
export function cpuArchetype(name: string): string {
  const pool = readsFeminine(name) ? CPU_LOOKS_A : CPU_LOOKS_B;
  if (NAMED[name] && NAMED[name] in pool) return NAMED[name];
  return pickBy(Object.keys(pool), name, 1);
}

/** The authored look a CPU wears in the Praça. Deterministic per name. */
export function cpuLook(name: string): CpuLook {
  const id = cpuArchetype(name);
  const fixed = AUTHORED[name];
  if (fixed) return { archetype: id, appearance: { ...fixed.appearance }, hat: fixed.hat };
  const x = (CPU_LOOKS_A[id] ?? CPU_LOOKS_B[id])!;
  return {
    archetype: id,
    appearance: {
      body: pickBy(x.body, name, 2),
      skin: pickBy(x.skin ?? [0, 1, 2, 3, 4, 5, 6, 7], name, 3),
      hair: pickBy(x.hair, name, 4),
      hairColor: pickBy(x.hairColor, name, 5),
      top: x.top,
      topColor: pickBy(x.topColor, name, 6),
      bottom: x.bottom,
      bottomColor: pickBy(x.bottomColor, name, 7),
      shoes: pickBy(x.shoes, name, 8),
      face: pickBy(x.face, name, 9),
      extra: pickBy(x.extra, name, 10),
      idle: x.idle,
      ...(x.garb ? { garb: pickBy(x.garb, name, 12) } : {}),
    },
    hat: pickBy(x.hats, name, 11),
  };
}
