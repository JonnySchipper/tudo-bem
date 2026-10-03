/** Companion parrots at the poleiro: several colours, cosmetic only (like hats). */
export interface ParrotColorDef {
  id: string;
  pt: string;
  en: string;
  price: number;
  /** Phaser tint on the green base sprite (0xffffff = unchanged). */
  tint: number;
}

export const PARROT_COLORS: ParrotColorDef[] = [
  { id: 'verde', pt: 'Verde', en: 'Green', price: 0, tint: 0xffffff },
  { id: 'azul', pt: 'Azul', en: 'Blue', price: 12, tint: 0x7eb8ff },
  { id: 'amarelo', pt: 'Amarelo', en: 'Yellow', price: 15, tint: 0xffe566 },
  { id: 'vermelho', pt: 'Vermelho', en: 'Red', price: 18, tint: 0xff7070 },
  { id: 'laranja', pt: 'Laranja', en: 'Orange', price: 20, tint: 0xffa64d },
];

export const parrotColorById = (id: string | null | undefined): ParrotColorDef | undefined =>
  PARROT_COLORS.find((p) => p.id === id) ?? PARROT_COLORS[0];
