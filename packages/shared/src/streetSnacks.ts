/** Praça street snacks: bought at the carts, carried until the session ends (not saved on the profile). */
export type StreetSnackId = 'pipoca' | 'agua_de_coco';

export interface StreetSnackDef {
  id: StreetSnackId;
  pt: string;
  en: string;
  price: number;
  /** Prop id in `ROOMS.praca` that sells this snack. */
  propId: string;
}

export const STREET_SNACKS: StreetSnackDef[] = [
  { id: 'pipoca', pt: 'Pipoca', en: 'Popcorn', price: 5, propId: 'pipoqueiro' },
  { id: 'agua_de_coco', pt: 'Água de coco', en: 'Coconut water', price: 7, propId: 'carrinho_coco' },
];

export const snackById = (id: string): StreetSnackDef | undefined => STREET_SNACKS.find((s) => s.id === id);
export const snackForProp = (propId: string): StreetSnackDef | undefined => STREET_SNACKS.find((s) => s.propId === propId);
