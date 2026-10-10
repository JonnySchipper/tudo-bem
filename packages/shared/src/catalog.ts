export interface HatDef {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Render recipe key + palette, interpreted by the client renderer. */
  shape: 'bone' | 'palha' | 'gorro' | 'viseira' | 'boina' | 'sol' | 'bucket' | 'capacete' | 'panama' | 'flores' | 'chef' | 'cartola' | 'capitao';
  color: string;
  accent: string;
}

/** Nanda’s stall. Cheap joy items; cosmetic only. */
export const HATS: HatDef[] = [
  { id: 'bone_verde', pt: 'Boné verde', en: 'Green cap', price: 0, shape: 'bone', color: '#2e8f58', accent: '#e8b634' },
  { id: 'chapeu_palha', pt: 'Chapéu de palha', en: 'Straw hat', price: 0, shape: 'palha', color: '#dcbc7a', accent: '#b5452e' },
  { id: 'gorro_listrado', pt: 'Gorro listrado', en: 'Striped beanie', price: 8, shape: 'gorro', color: '#b8374a', accent: '#f1e9dc' },
  { id: 'viseira_azul', pt: 'Viseira azul', en: 'Blue visor', price: 10, shape: 'viseira', color: '#2f5e9e', accent: '#f1e9dc' },
  { id: 'boina_vermelha', pt: 'Boina vermelha', en: 'Red beret', price: 12, shape: 'boina', color: '#a82b3c', accent: '#6e1a26' },
  { id: 'chapeu_sol', pt: 'Chapéu de sol', en: 'Sun hat', price: 15, shape: 'sol', color: '#e9a3b4', accent: '#f4ede2' },
  { id: 'bucket_amarelo', pt: 'Chapéu bucket amarelo', en: 'Yellow bucket hat', price: 18, shape: 'bucket', color: '#e8b634', accent: '#c9921c' },
  { id: 'capacete_bike', pt: 'Capacete de bike', en: 'Bike helmet', price: 20, shape: 'capacete', color: '#2f9a94', accent: '#1d4f4c' },
  { id: 'panama', pt: 'Chapéu panamá', en: 'Panama hat', price: 25, shape: 'panama', color: '#efe3c4', accent: '#2a2a33' },
  { id: 'coroa_flores', pt: 'Coroa de flores', en: 'Flower crown', price: 30, shape: 'flores', color: '#f2c230', accent: '#e5572f' },
  { id: 'cartola', pt: 'Cartola de Carnaval', en: 'Carnival top hat', price: 60, shape: 'cartola', color: '#6a45a0', accent: '#e8b634' },
];

/** Jô's beach rack at the Praia (PRAIA-PLAN.md 7.3): sold only there. needs_br: true */
export const HATS_PRAIA: HatDef[] = [
  { id: 'chapeu_pescador', pt: 'Chapéu de pescador', en: 'Fisherman’s bucket hat', price: 20, shape: 'bucket', color: '#c9b98a', accent: '#5a7a8a' },
  { id: 'viseira', pt: 'Viseira de praia', en: 'Beach visor', price: 12, shape: 'viseira', color: '#f4ede2', accent: '#3fa9a0' },
  { id: 'bone_surf', pt: 'Boné de surfe', en: 'Surf cap', price: 15, shape: 'bone', color: '#3fa9a0', accent: '#e5572f' },
];

export interface FurnitureDef {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Seat furniture can be sat on. */
  seat: boolean;
  kind: 'cadeira' | 'poltrona' | 'pufe' | 'mesinha' | 'planta' | 'tapete' | 'radio' | 'ventilador' | 'gato' | 'luminaria' | 'estante' | 'quadro' | 'rede' | 'filtro' | 'banner' | 'caminha' | 'racao' | 'praia';
  color: string;
  /** Walk-through items (rugs, the founders banner) do not block tiles. */
  walkable?: boolean;
  /** Earned, never sold at the atelier. Price stays 0 and no RV changes hands. */
  earned?: boolean;
  /** Sold only at that shop (the pet shop's lojinha, #234): the atelier hides it and refuses to sell it. */
  shop?: 'petshop';
}

/** Atelier catalog for the kitnet. */
export const FURNITURE: FurnitureDef[] = [
  { id: 'cadeira_madeira', pt: 'Cadeira de madeira', en: 'Wooden chair', price: 10, seat: true, kind: 'cadeira', color: '#a8662f' },
  { id: 'poltrona_verde', pt: 'Poltrona verde', en: 'Green armchair', price: 35, seat: true, kind: 'poltrona', color: '#2e9e5b' },
  { id: 'pufe_amarelo', pt: 'Pufe amarelo', en: 'Yellow pouf', price: 15, seat: true, kind: 'pufe', color: '#f2c230' },
  { id: 'mesinha', pt: 'Mesinha de centro', en: 'Coffee table', price: 20, seat: false, kind: 'mesinha', color: '#8a5433' },
  { id: 'planta', pt: 'Vaso de costela-de-adão', en: 'Monstera plant pot', price: 12, seat: false, kind: 'planta', color: '#2e7d4a' },
  { id: 'tapete', pt: 'Tapete colorido', en: 'Colorful rug', price: 18, seat: false, kind: 'tapete', color: '#e5572f', walkable: true },
  { id: 'radio', pt: 'Rádio antigo', en: 'Vintage radio', price: 30, seat: false, kind: 'radio', color: '#b5452e' },
  { id: 'ventilador', pt: 'Ventilador', en: 'Electric fan', price: 25, seat: false, kind: 'ventilador', color: '#dfe7ea' },
  { id: 'gato', pt: 'Gato (não fala)', en: 'Cat (does not talk)', price: 40, seat: false, kind: 'gato', color: '#e0913f' },
  { id: 'luminaria', pt: 'Luminária', en: 'Floor lamp', price: 15, seat: false, kind: 'luminaria', color: '#f7d774' },
  { id: 'estante', pt: 'Estante de livros', en: 'Bookshelf', price: 30, seat: false, kind: 'estante', color: '#6a3f22' },
  { id: 'quadro', pt: 'Quadro de ipê', en: 'Ipê painting (floor easel)', price: 20, seat: false, kind: 'quadro', color: '#f2c230' },
  { id: 'rede', pt: 'Rede de descanso', en: 'Hammock', price: 45, seat: false, kind: 'rede', color: '#e5572f' },
  { id: 'filtro', pt: 'Filtro de barro', en: 'Clay water filter', price: 25, seat: false, kind: 'filtro', color: '#b8573a' },
  {
    id: 'banner_fundadores',
    pt: 'Banner dos fundadores',
    en: 'Founders banner',
    price: 0,
    seat: false,
    kind: 'banner',
    color: '#f2c230',
    walkable: true,
    earned: true,
  },
  // the pet shop's lojinha (#234; prices equal PET_ITEMS): a home pet lies on a bed; they gather at the bowl when you come in
  { id: 'caminha_xadrez', pt: 'Caminha xadrez', en: 'Plaid pet bed', price: 20, seat: false, kind: 'caminha', color: '#d93232', walkable: true, shop: 'petshop' },
  { id: 'caminha_azul', pt: 'Caminha azul', en: 'Blue pet bed', price: 20, seat: false, kind: 'caminha', color: '#4280dd', walkable: true, shop: 'petshop' },
  { id: 'caminha_cesta', pt: 'Cesta de vime', en: 'Wicker basket', price: 25, seat: false, kind: 'caminha', color: '#c78c59', walkable: true, shop: 'petshop' },
  { id: 'saco_racao', pt: 'Saco de ração + pote', en: 'Food bag + bowl', price: 15, seat: false, kind: 'racao', color: '#cb2a2a', shop: 'petshop' },
  // the Praia (PRAIA-PLAN.md 7.3): two beach things sold at the atelier, five earned at sea and never priced. needs_br: true
  { id: 'cadeira_praia', pt: 'Cadeira de praia', en: 'Beach chair', price: 12, seat: true, kind: 'praia', color: '#3d56d2' },
  { id: 'concha_pequena', pt: 'Conchinha', en: 'Little seashell', price: 8, seat: false, kind: 'praia', color: '#e6cdb0' },
  { id: 'concha_grande', pt: 'Concha gigante', en: 'Giant seashell', price: 0, seat: false, kind: 'praia', color: '#eab6a8', earned: true },
  { id: 'rede_pesca_parede', pt: 'Rede de pesca', en: 'Fishing net', price: 0, seat: false, kind: 'praia', color: '#4f8a63', earned: true },
  { id: 'garrafa_mensagem', pt: 'Garrafa com mensagem', en: 'Message in a bottle', price: 0, seat: false, kind: 'praia', color: '#3f8a5c', earned: true },
  { id: 'boia_parede', pt: 'Boia salva-vidas', en: 'Life ring', price: 0, seat: false, kind: 'praia', color: '#d93232', earned: true },
  { id: 'prancha', pt: 'Prancha de surfe', en: 'Surfboard', price: 0, seat: false, kind: 'praia', color: '#4280dd', earned: true },
];

/** Every new kitnet comes with one free chair so the first placement is instant. */
/** Nothing for free: the 10 RV kitnet gift buys the first chair (a wooden chair costs 10). */
export const STARTER_FURNITURE: Record<string, number> = {};
export const STARTER_HATS: string[] = [];

/**
 * Hats that are earned, never sold at Nanda’s stall. The founder toque comes only from Fundar (player padaria);
 * the mustard band matches the founder “f” mark. needs_br: true
 */
export const EARNED_HATS: HatDef[] = [
  { id: 'chapeu_padeiro_casa', pt: 'Chapéu de dono da padaria', en: 'Bakery owner’s hat', price: 0, shape: 'chef', color: '#ffffff', accent: '#e0ae3c' },
  // the party boat (PRAIA-PLAN.md 5.5): everyone who sails a trip with company earns it once; never sold, not on any rack
  { id: 'chapeu_capitao', pt: 'Chapéu de capitão', en: 'Captain’s cap', price: 0, shape: 'capitao', color: '#f6f6f2', accent: '#2a3a60' },
];

/**
 * Taken off Nanda’s stall. Still a real hat: Seu Carlos wears it, and a profile that already bought it can keep wearing it from the wardrobe.
 * The padaria founder toque is a different id (`chapeu_padeiro_casa`).
 */
export const RETIRED_HATS: HatDef[] = [
  { id: 'chapeu_chef', pt: 'Chapéu de padeiro', en: 'Baker’s hat', price: 40, shape: 'chef', color: '#ffffff', accent: '#e0dcd2' },
];

/** Every hat a profile can wear (the stall, the earned ones, and retired stall hats someone may already own). */
export const ALL_HATS: HatDef[] = [...HATS, ...HATS_PRAIA, ...EARNED_HATS, ...RETIRED_HATS];

export const hatById = (id: string | null | undefined): HatDef | undefined => ALL_HATS.find((h) => h.id === id);
/** Only the stall sells hats; earned and retired hats are not in the shop. */
export const isStallHat = (id: string): boolean => HATS.some((h) => h.id === id);
/** Jô's beach rack sells these, at the Praia only. */
export const isPraiaHat = (id: string): boolean => HATS_PRAIA.some((h) => h.id === id);
export const furnitureById = (id: string): FurnitureDef | undefined => FURNITURE.find((f) => f.id === id);
