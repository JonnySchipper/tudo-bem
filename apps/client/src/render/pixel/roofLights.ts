/**
 * The ceiling lights of a roofed open-air map (the airport terminal, issue #168): a grid of warm panel pools on the floor under
 * `RoomDef.roof`, so the terminal reads as a lit building at dusk and at night while the apron and the sidewalk outside follow the sky.
 * They switch on with the lamps (`dayNight.lightState`, 18:00 to 06:00), one bank per row of panels a few game minutes apart, so the hall
 * lights up front to back instead of all at once. Pure, so the layout is unit tested; `WorldScene` turns each into a rig light.
 */
import { T } from './coords';
import { hashPos01 } from './dayNight';

export interface RoofLight {
  /** world px of the pool's centre */
  x: number;
  y: number;
  /** world px radius */
  r: number;
  color: number;
  squash: number;
  glow: number;
  /** game minutes this panel lags the 18:00 / 06:00 switch */
  delay: number;
}

/** Tiles between two ceiling panels across, and the pool radius (world px): neighbours overlap a little so the floor has no black gaps. */
const PANEL_STEP_X = 6;
const PANEL_R = 62;
/** Warm fluorescent: a touch cooler than the street lamps' sodium amber. */
const PANEL_COLOR = 0xffe2a8;
/** Game minutes between two banks (rows of panels) switching on. */
const BANK_LAG = 4;
/** At most this many rows of panels: three cover the airport's 13-row hall and keep the light count low for phones. */
const MAX_BANKS = 3;

/** The ceiling pools under the roof of `def`, or none for a map without a roof. */
export function roofLights(def: { cols: number; roof?: { y0: number; y1: number } }): RoofLight[] {
  const roof = def.roof;
  if (!roof) return [];
  // the glass front stands on the roof's first and last rows: the panels hang over the floor between them
  const top = roof.y0 + 1;
  const bottom = roof.y1;
  const rows = bottom - top;
  if (rows <= 0) return [];
  const banks = Math.max(1, Math.min(MAX_BANKS, Math.round(rows / 4)));
  const cols = Math.max(1, Math.round(def.cols / PANEL_STEP_X));
  const stepX = (def.cols * T) / cols;
  const stepY = (rows * T) / banks;
  const out: RoofLight[] = [];
  for (let b = 0; b < banks; b++) {
    const y = Math.round(top * T + stepY * (b + 0.5));
    for (let c = 0; c < cols; c++) {
      const x = Math.round(stepX * (c + 0.5));
      // a bank switches on together, give or take a tube that is slow to strike
      const delay = b * BANK_LAG + hashPos01(x, y) * 2;
      out.push({ x, y, r: PANEL_R, color: PANEL_COLOR, squash: 0.72, glow: 0.22, delay });
    }
  }
  return out;
}
