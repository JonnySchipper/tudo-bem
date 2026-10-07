/**
 * Praça street snacks: bought at the carts, carried until the session ends (not saved on the profile).
 * Prices are virtual reais (RV). The beta stays free — nothing here takes real money.
 */
export type StreetSnackId = 'pipoca_salgada' | 'pipoca_doce' | 'pipoca_doce_leite' | 'agua_de_coco' | 'pao_de_queijo' | 'cafezinho';

/** Optional condensed milk on sweet popcorn only. */
export const LEITE_CONDENSADO_RV = 3;

export interface StreetSnackDef {
  id: StreetSnackId;
  pt: string;
  en: string;
  price: number;
  /** Prop id that sells this snack (the praça carts, the airport café). */
  propId: string;
  /** Icon under `icons/` in the pixel manifest. Sweet popcorn reuses the red `pipoca` art. */
  icon: string;
  /** Set when this row is only an add-on of another snack, not a line on the first menu. */
  addonOf?: StreetSnackId;
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
    icon: 'pipoca',
    addonOf: 'pipoca_doce',
  },
  { id: 'agua_de_coco', pt: 'Água de coco', en: 'Coconut water', price: 7, propId: 'carrinho_coco', icon: 'agua_de_coco' },
  // the airport café (the arrival tutorial's first purchase: the starting coins cover it). needs_br: true
  { id: 'pao_de_queijo', pt: 'Pão de queijo', en: 'Cheese bread', price: 4, propId: 'lanchonete_aero', icon: 'pao_de_queijo' },
  { id: 'cafezinho', pt: 'Cafezinho', en: 'A little coffee', price: 3, propId: 'lanchonete_aero', icon: 'cafe' },
];

/** The old single popcorn id is the salty bag. */
const SNACK_ALIAS: Record<string, StreetSnackId> = { pipoca: 'pipoca_salgada' };

export const snackById = (id: string): StreetSnackDef | undefined => {
  const key = SNACK_ALIAS[id] ?? id;
  return STREET_SNACKS.find((s) => s.id === key);
};

/** First-menu snacks at this cart. Condensed milk is not listed here — it is only an add-on of sweet popcorn. */
export const snacksAt = (propId: string): StreetSnackDef[] => STREET_SNACKS.filter((s) => s.propId === propId && !s.addonOf);

/** The add-on sold with `id`, if that snack has one. Salty popcorn has none. */
export const snackAddon = (id: string): StreetSnackDef | undefined => STREET_SNACKS.find((s) => s.addonOf === id);
