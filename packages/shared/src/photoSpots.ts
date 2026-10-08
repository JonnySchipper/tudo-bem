import type { RoomId } from './types.js';

/**
 * Things the camera can take that are not props: wall decor painted on the north wall band, and parts of a bigger sprite (the airport). The box is in tile units; the band sits
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
  // the airport: parts of bigger things, seen through the glass or lying on the passport booth's counter
  { id: 'hall_pista', room: 'aeroporto', x: 0, y: 2, w: 30, h: 2 },
  { id: 'hall_asa', room: 'aeroporto', x: 3, y: 7, w: 4, h: 2 },
  { id: 'hall_turbina', room: 'aeroporto', x: 4, y: 8, w: 2, h: 1 },
  { id: 'hall_passaporte', room: 'aeroporto', x: 11, y: 15, w: 1, h: 1 },
  { id: 'hall_visto', room: 'aeroporto', x: 13, y: 15, w: 1, h: 1 },
];

export const photoSpotById = (id: string): PhotoSpot | undefined => PHOTO_SPOTS.find((s) => s.id === id);
