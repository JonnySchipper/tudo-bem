/**
 * Ambient-life data, keyed by room id (Phase 6b). Coordinates come from the Phase 5 map (docs/lifesim/DECISIONS.md): Rua dos Ipês is rows
 * 8-11, Rua Jacarandá rows 32-35, the bus stop sits at (30,12), the vira-lata corner at (5,26), the fountain at (23,20). Pure data, no Phaser.
 *
 * World px unless a name says `tile`. Traffic keeps to the right (Brazil): eastbound (screen right) uses the lower lane of a street,
 * westbound the upper lane. A vehicle's `y` is where its wheels touch the asphalt (its sprite anchor).
 */
import { T } from './coords';

export type Heading = 'e' | 'w';

export interface Lane {
  /** feet y of a vehicle in this lane, world px */
  y: number;
  dir: Heading;
}

export interface Street {
  id: string;
  /** two-way street: upper lane first (westbound), then the lower lane (eastbound); a one-way street has the single eastbound lane */
  lanes: Lane[];
  /** vehicles enter and leave beyond these x, world px (behind the barricades at the map edge) */
  x0: number;
  x1: number;
  /** relative traffic density (1 = Rua dos Ipês) */
  density: number;
}

export interface BusRoute {
  street: string;
  /** centre x of the bus while it stands at the stop */
  stopX: number;
  /** the stop's sidewalk tile (guides, tests) */
  stopTile: { x: number; y: number };
}

export interface DogHome {
  /** the static prop that stands for the sleeping dog in the room data: the ambient dog replaces its art */
  propId: string;
  home: { x: number; y: number };
  /** wander radius, tiles */
  radius: number;
}

export interface FlockDef {
  id: string;
  /** centre tile */
  x: number;
  y: number;
  n: number;
}

export interface AudioZones {
  /** street centre lines (world px y) with their x extent: traffic hum grows as the listener nears one */
  streets: { y: number; x0: number; x1: number }[];
  /** water jet centre, world px */
  fountain: { x: number; y: number };
  /** where a radio plays behind a window, world px (the houses) */
  radios: { x: number; y: number }[];
}

export interface AmbientRoom {
  streets: Street[];
  bus: BusRoute;
  dog: DogHome;
  flocks: FlockDef[];
  /** where the fountain spray rises (world px) and how wide the basin is */
  fountain: { x: number; y: number; w: number };
  audio: AudioZones;
}

/**
 * One street, rows y0..y1 (tiles). W3: the lanes sit as high as the 64 px of asphalt allow. A parked car's sprite is 37-46 px tall and stands on the
 * bottom of its bay, so the eastbound lane's sprites (feet + 4 px) must end above the tallest parked sprite (see streets.test.ts).
 * - Rua dos Ipês is two-way with its parking in bays recessed into the south sidewalk (rooms.ts `PARKING_BAYS_IPES`): lanes at +17 / +36.
 * - Rua Jacarandá has no sidewalk on its south side, so it is one-way (eastbound) with the parking along its south edge: one lane at +16.
 */
const street = (id: string, y0: number, y1: number, cols: number, density: number, oneWay = false): Street => ({
  id,
  lanes: oneWay
    ? [{ y: y0 * T + 16, dir: 'e' }]
    : [
        { y: y0 * T + 17, dir: 'w' },
        { y: y0 * T + 36, dir: 'e' },
      ],
  x0: -84,
  x1: cols * T + 84,
  density,
});

const COLS = 56;

export const AMBIENT: Record<string, AmbientRoom> = {
  praca: {
    streets: [street('ipes', 8, 11, COLS, 1), street('jacaranda', 32, 35, COLS, 1, true)],
    bus: { street: 'ipes', stopX: 36.5 * T, stopTile: { x: 37, y: 13 } },
    dog: { propId: 'vira_lata', home: { x: 5, y: 26 }, radius: 6 },
    flocks: [
      { id: 'fonte_sul', x: 22, y: 23, n: 4 },
      { id: 'fonte_leste', x: 28, y: 19, n: 3 },
      { id: 'calcada_sul', x: 15, y: 13, n: 3 },
    ],
    fountain: { x: 25 * T, y: 21.6 * T, w: 4 * T },
    audio: {
      streets: [
        { y: 10 * T, x0: 0, x1: COLS * T },
        { y: 34 * T, x0: 0, x1: COLS * T },
      ],
      fountain: { x: 25 * T, y: 21.2 * T },
      radios: [
        { x: 5 * T, y: 17 * T },
        { x: 6 * T, y: 24 * T },
      ],
    },
  },
};

export const ambientFor = (roomId: string): AmbientRoom | null => AMBIENT[roomId] ?? null;
