/**
 * The ceiling lights of a roofed open-air map (the airport terminal, issue #168): the hall under `RoomDef.roof` is lit at dusk and at
 * night, warm and nearly as bright as by day, while the apron and the sidewalk outside follow the sky.
 *
 * Cheap on phones: lamp pools are render-texture stamps, and pools over a whole hall cost a phone about three extra full-screen passes
 * (some 40 ms a frame in the headless perf probe). So the hall is not a light at all: the lighting rig already fills the grade and the
 * darkness over the whole screen every frame, and it fills the hall's bands with a lighter value in that same fill (`LightingRig.roof`).
 * The bands are the rows of ceiling panels, front (north) to back; they switch on with the lamps (`dayNight.lightState`, 18:00 to
 * 06:00) a few game minutes apart, so the hall lights up bank by bank instead of all at once. Pure, so the layout is unit tested.
 */
import { T } from './coords';

export interface RoofBand {
  /** world px */
  y0: number;
  y1: number;
  /** game minutes this bank lags the 18:00 / 06:00 switch */
  delay: number;
}

export interface RoofHall {
  /** world px across the hall */
  x0: number;
  x1: number;
  /** the banks of panels, top to bottom, edge to edge */
  bands: RoofBand[];
  /** multiply colour of the lit hall: a warm off-white (fluorescent panels, a touch cooler than the lamps' sodium amber) */
  tint: number;
  /** 0..1 how far a lit bank lifts the night toward `tint` (1 = all the way): a terminal at night is lit, not noon */
  gain: number;
}

/** Game minutes between two banks switching on. */
const BANK_LAG = 4;
/** At most this many banks: three cover the airport's 12-row hall. */
const MAX_BANKS = 3;

/** The lit hall under the roof of `def`, or null for a map without a roof. */
export function roofHall(def: { cols: number; roof?: { y0: number; y1: number } }): RoofHall | null {
  const roof = def.roof;
  if (!roof) return null;
  // the north glass front stands on the roof's first row: the hall starts at its foot. The low south glass (the last row) is inside.
  const top = (roof.y0 + 1) * T;
  const bottom = (roof.y1 + 1) * T;
  if (bottom <= top) return null;
  const banks = Math.max(1, Math.min(MAX_BANKS, Math.round((bottom - top) / (4 * T))));
  const h = (bottom - top) / banks;
  const bands: RoofBand[] = [];
  for (let b = 0; b < banks; b++) bands.push({ y0: Math.round(top + h * b), y1: Math.round(top + h * (b + 1)), delay: b * BANK_LAG });
  return { x0: 0, x1: def.cols * T, bands, tint: 0xffe9c4, gain: 0.7 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The grade colour of a band lit to `k` (0..1): the outdoor grade pulled toward the hall's tint. At k = 0 it is the grade itself. */
export function litGrade(grade: number, tint: number, k: number): number {
  const ch = (s: number) => Math.round(lerp((grade >> s) & 255, (tint >> s) & 255, k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
