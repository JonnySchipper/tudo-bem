export interface HatDef {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Render recipe key + palette, interpreted by the client renderer. */
  shape: 'bone' | 'palha' | 'gorro' | 'viseira' | 'boina' | 'sol' | 'bucket' | 'capacete' | 'panama' | 'flores' | 'chef' | 'cartola';
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
  { id: 'chapeu_chef', pt: 'Chapéu de padeiro', en: 'Baker’s hat', price: 40, shape: 'chef', color: '#ffffff', accent: '#e0dcd2' },
  { id: 'cartola', pt: 'Cartola de Carnaval', en: 'Carnival top hat', price: 60, shape: 'cartola', color: '#6a45a0', accent: '#e8b634' },
];

export interface FurnitureDef {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Seat furniture can be sat on. */
  seat: boolean;
  kind: 'cadeira' | 'poltrona' | 'pufe' | 'mesinha' | 'planta' | 'tapete' | 'radio' | 'ventilador' | 'gato' | 'luminaria' | 'estante' | 'quadro' | 'rede' | 'filtro';
  color: string;
  /** Walk-through items (rugs) do not block tiles. */
  walkable?: boolean;
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
];

/** Every new kitnet comes with one free chair so the first placement is instant. */
export const STARTER_FURNITURE: Record<string, number> = { cadeira_madeira: 1 };
export const STARTER_HATS: string[] = [];

/**
 * Hats that are earned, never sold at Nanda’s stall. The founder toque comes only from Fundar (player padaria);
 * the mustard band matches the founder “f” mark. needs_br: true
 */
export const EARNED_HATS: HatDef[] = [
  { id: 'chapeu_padeiro_casa', pt: 'Chapéu de dono da padaria', en: 'Bakery owner’s hat', price: 0, shape: 'chef', color: '#ffffff', accent: '#e0ae3c' },
];

/** Every hat a profile can wear (the stall plus the earned ones). */
export const ALL_HATS: HatDef[] = [...HATS, ...EARNED_HATS];

export const hatById = (id: string | null | undefined): HatDef | undefined => ALL_HATS.find((h) => h.id === id);
/** Only the stall sells hats; earned hats come from their own feature. */
export const isStallHat = (id: string): boolean => HATS.some((h) => h.id === id);
export const furnitureById = (id: string): FurnitureDef | undefined => FURNITURE.find((f) => f.id === id);
