import type { RoomId } from './types.js';

/**
 * Things the camera can take that are not props: wall decor painted on the north wall band. The box is in tile units; the band sits
 * above row 0, so `y` is negative (3 rows, `NORTH_ROWS` in the pixel view). The server measures distance to this box like a prop's.
 */
export interface PhotoSpot {
  id: string;
  room: RoomId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PHOTO_SPOTS: PhotoSpot[] = [
  { id: 'janela_rua', room: 'kitnet', x: 3, y: -3, w: 3, h: 3 },
  { id: 'cobogo', room: 'kitnet', x: 0, y: -3, w: 1, h: 3 },
  { id: 'kitnet_parede', room: 'kitnet', x: 1, y: -3, w: 2, h: 3 },
  { id: 'kitnet_teto', room: 'kitnet', x: 2, y: -3, w: 3, h: 1 },
  { id: 'kitnet_rodape', room: 'kitnet', x: 1, y: -1, w: 3, h: 1 },
  { id: 'padaria_azulejos', room: 'padaria', x: 3, y: -2, w: 2, h: 2 },
  { id: 'lousa_parede', room: 'escola', x: 1, y: -3, w: 2, h: 3 },
];

export const photoSpotById = (id: string): PhotoSpot | undefined => PHOTO_SPOTS.find((s) => s.id === id);
