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
  // the airliner at the gate (prop `aviao`, 12 x 3 tiles at (0, 5); sprite `aero/aviao`, 206 x 100 px anchored at (103, 73)): every part
  // of it is something to photograph, so a shot anywhere on the plane teaches a word. A sprite pixel (sx, sy) is at tile
  // ((sx - 7) / 16, (sy + 55) / 16); the boxes below follow the parts in apps/client/assets-src/custom/aeroporto.mjs `aviao()`.
  { id: 'hall_cauda', room: 'aeroporto', x: 0.25, y: 3.5, w: 2.5, h: 4 },
  { id: 'hall_asa_longe', room: 'aeroporto', x: 3.75, y: 4.1, w: 4.6, h: 1.5 },
  { id: 'hall_janela', room: 'aeroporto', x: 2, y: 5.6, w: 7.5, h: 0.75 },
  { id: 'hall_porta', room: 'aeroporto', x: 9.5, y: 5.75, w: 0.75, h: 1.35 },
  { id: 'hall_nariz', room: 'aeroporto', x: 10.6, y: 5.5, w: 1.8, h: 2.1 },
  { id: 'hall_fuselagem', room: 'aeroporto', x: 2.75, y: 5.5, w: 7.85, h: 1.95 },
  { id: 'hall_asa', room: 'aeroporto', x: 2.4, y: 7, w: 6.1, h: 2.5 },
  { id: 'hall_turbina', room: 'aeroporto', x: 5.75, y: 7.4, w: 2.15, h: 1.05 },
  { id: 'hall_roda', room: 'aeroporto', x: 4.5, y: 7.4, w: 1.15, h: 0.7 },
  { id: 'hall_roda_frente', room: 'aeroporto', x: 10.35, y: 7.4, w: 0.6, h: 0.7 },
  { id: 'hall_passaporte', room: 'aeroporto', x: 11, y: 15, w: 1, h: 1 },
  { id: 'hall_visto', room: 'aeroporto', x: 13, y: 15, w: 1, h: 1 },
];

export const photoSpotById = (id: string): PhotoSpot | undefined => PHOTO_SPOTS.find((s) => s.id === id);
