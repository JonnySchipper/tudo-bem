/** Where everything stands on the airport-hall postcard (ui/arrivalHall.ts draws it). Pure data, so it can be checked without a page. */

/** The postcard is drawn on a grid this many art pixels wide and tall; everything is placed and sized in these units. */
export const HALL_W = 160;
export const HALL_H = 112;

export interface HallPlace {
  id: string;
  x: number;
  y: number;
  /** Art pixels are drawn this many scene units wide. */
  k: number;
}

/** The fourteen camera objects: outside the window (the tower, the runway, a wing and its engine), the belt, the passport booth, the gate. */
export const HALL_OBJECTS: readonly HallPlace[] = [
  { id: 'hall_torre', x: 8, y: 4, k: 3 },
  { id: 'hall_pista', x: 44, y: 24, k: 4 },
  { id: 'hall_asa', x: 104, y: 6, k: 3 },
  { id: 'hall_turbina', x: 114, y: 30, k: 3 },
  { id: 'hall_mala', x: 6, y: 66, k: 3 },
  { id: 'hall_etiqueta', x: 40, y: 56, k: 2 },
  { id: 'hall_mochila', x: 38, y: 74, k: 3 },
  { id: 'hall_esteira', x: 4, y: 94, k: 3 },
  { id: 'hall_passaporte', x: 74, y: 74, k: 3 },
  { id: 'hall_visto', x: 90, y: 82, k: 2 },
  { id: 'hall_bilhete', x: 76, y: 98, k: 2 },
  { id: 'hall_ponte', x: 104, y: 74, k: 2 },
  { id: 'hall_cinto', x: 118, y: 94, k: 3 },
  { id: 'hall_fone', x: 136, y: 70, k: 2 },
];

/** The five signs of the hall (the card's kicker is the sixth word, read off the card itself). */
export const HALL_SIGN_PLACES: readonly { id: string; x: number; y: number; tone: 'blue' | 'red' | 'white' | 'yellow' }[] = [
  { id: 'hall_s_terminal', x: 62, y: 48, tone: 'blue' },
  { id: 'hall_s_desembarque', x: 4, y: 48, tone: 'blue' },
  { id: 'hall_s_bagagem', x: 4, y: 58, tone: 'yellow' },
  { id: 'hall_s_alfandega', x: 74, y: 60, tone: 'red' },
  { id: 'hall_s_embarque', x: 100, y: 64, tone: 'blue' },
];

/** The art of an object with a 1 px navy outline round every shape. */
export function outlined(rows: readonly string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const grid = [new Array(w).fill('.'), ...rows.map((r) => ['.', ...r.padEnd(w - 2, '.'), '.']), new Array(w).fill('.')];
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y]![x] !== '.') continue;
      const near = [grid[y - 1]?.[x], grid[y + 1]?.[x], grid[y]?.[x - 1], grid[y]?.[x + 1]];
      if (near.some((c) => c !== undefined && c !== '.')) out[y]![x] = 'k';
    }
  }
  return out.map((r) => r.join(''));
}
