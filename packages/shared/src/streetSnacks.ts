/**
 * Praça street snacks: bought at the carts, carried until the session ends (not saved on the profile).
 * Prices are virtual reais (RV). The beta stays free — nothing here takes real money.
 */
export type StreetSnackId = 'pipoca_salgada' | 'pipoca_doce' | 'pipoca_doce_leite' | 'agua_de_coco' | 'pao_de_queijo' | 'cafezinho' | 'agua' | 'queijo_coalho' | 'picole' | 'milho_verde';

/** Optional condensed milk on sweet popcorn only. */
export const LEITE_CONDENSADO_RV = 3;

export interface StreetSnackDef {
  id: StreetSnackId;
  pt: string;
  en: string;
  price: number;
  /** Prop id that sells this snack (the praça carts, the airport café). */
  propId: string;
  /** Icon under `icons/` in the pixel manifest: sweet popcorn is the red `pipoca` art, with the leite condensado drizzle on `pipoca_leite`. */
  icon: string;
  /** Set when this row is only an add-on of another snack, not a line on the first menu. */
  addonOf?: StreetSnackId;
  /** Other props that sell the same thing (coconut water at the praça cart and at the Barraca da Jô). */
  alsoAt?: string[];
}

const pipocaDoce: StreetSnackDef = {
  id: 'pipoca_doce',
  pt: 'Pipoca doce',
  en: 'Sweet popcorn',
  price: 7,
  propId: 'pipoqueiro',
  icon: 'pipoca',
};

export const STREET_SNACKS: StreetSnackDef[] = [
  { id: 'pipoca_salgada', pt: 'Pipoca salgada', en: 'Salty popcorn', price: 5, propId: 'pipoqueiro', icon: 'pipoca_salgada' },
  pipocaDoce,
  {
    id: 'pipoca_doce_leite',
    pt: 'Pipoca doce com leite condensado',
    en: 'Sweet popcorn with condensed milk',
    price: pipocaDoce.price + LEITE_CONDENSADO_RV,
    propId: 'pipoqueiro',
    icon: 'pipoca_leite',
    addonOf: 'pipoca_doce',
  },
  { id: 'agua_de_coco', pt: 'Água de coco', en: 'Coconut water', price: 7, propId: 'carrinho_coco', icon: 'agua_de_coco', alsoAt: ['barraca_jo'] },
  // the Barraca da Jô at the Praia (PRAIA-PLAN.md 7.2): the same prices as her board (hotspot praia_cardapio_jo). needs_br: true
  { id: 'queijo_coalho', pt: 'Queijo coalho', en: 'Grilled cheese on a stick', price: 6, propId: 'barraca_jo', icon: 'queijo_coalho' },
  { id: 'milho_verde', pt: 'Milho verde', en: 'Corn on the cob', price: 5, propId: 'barraca_jo', icon: 'milho_verde' },
  { id: 'picole', pt: 'Picolé', en: 'Ice pop', price: 4, propId: 'barraca_jo', icon: 'picole' },
  // the airport café (the arrival tutorial's first purchase: the starting coins cover it). needs_br: true
  { id: 'pao_de_queijo', pt: 'Pão de queijo', en: 'Cheese bread', price: 4, propId: 'lanchonete_aero', icon: 'pao_de_queijo' },
  { id: 'cafezinho', pt: 'Cafezinho', en: 'A little coffee', price: 3, propId: 'lanchonete_aero', icon: 'cafe' },
  // the arrivals hall's water cooler: the tutorial's first thing to pick up and use, free (price 0 takes no RV). needs_br: true
  { id: 'agua', pt: 'Copo d’água', en: 'A cup of water', price: 0, propId: 'desemb_bebedouro', icon: 'agua' },
];

/** The old single popcorn id is the salty bag. */
const SNACK_ALIAS: Record<string, StreetSnackId> = { pipoca: 'pipoca_salgada' };

export const snackById = (id: string): StreetSnackDef | undefined => {
  const key = SNACK_ALIAS[id] ?? id;
  return STREET_SNACKS.find((s) => s.id === key);
};

/** First-menu snacks at this cart. Condensed milk is not listed here — it is only an add-on of sweet popcorn. */
export const snacksAt = (propId: string): StreetSnackDef[] => STREET_SNACKS.filter((s) => snackPropIds(s).includes(propId) && !s.addonOf);

/** Every prop that sells this snack. */
export const snackPropIds = (s: StreetSnackDef): string[] => [s.propId, ...(s.alsoAt ?? [])];

/** The add-on sold with `id`, if that snack has one. Salty popcorn has none. */
export const snackAddon = (id: string): StreetSnackDef | undefined => STREET_SNACKS.find((s) => s.addonOf === id);
