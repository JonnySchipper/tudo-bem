/**
 * Camera maths of the title screen's slow pan over the Vila Ipê snapshot (Phase 6b). Pure, so it is unit tested: an integer zoom for the
 * viewport, a ping-pong route with eased ends, and a canvas offset that never shows the void beyond the map and lands on whole device pixels.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface PanRoute {
  from: Pt;
  to: Pt;
  /** seconds for one way */
  legSec: number;
}

/** Map px (art pixels): from the Padaria's awning and the Banca, east along the facades toward the Edifício and the street. */
export const PAN_ROUTE: PanRoute = { from: { x: 230, y: 96 }, to: { x: 620, y: 130 }, legSec: 110 };

/** Whole CSS px per art pixel: about 420 art px across on a wide screen (1280 wide -> 3), never below 2 (a phone shows ~190). */
export function introZoom(vw: number, vh: number): number {
  const byWidth = Math.floor(vw / 420);
  const byHeight = Math.floor(vh / 200);
  return Math.max(2, Math.min(5, byWidth, Math.max(2, byHeight)));
}

/** Centre of the view (map px) at `tSec`: there and back again, slowing to a stop at each end. */
export function panCenter(tSec: number, route: PanRoute = PAN_ROUTE): Pt {
  const phase = ((tSec / route.legSec) % 2 + 2) % 2; // 0..2
  const leg = phase <= 1 ? phase : 2 - phase;
  const e = 0.5 - 0.5 * Math.cos(Math.PI * leg);
  return { x: route.from.x + (route.to.x - route.from.x) * e, y: route.from.y + (route.to.y - route.from.y) * e };
}

export interface MapOffset {
  tx: number;
  ty: number;
}

/**
 * CSS translation of the zoomed canvas so `center` sits at (vw/2, vh * focusY). Clamped so the map always covers the viewport (a map
 * smaller than the viewport is centred), rounded to device pixels so the art never shimmers.
 */
export function mapOffset(center: Pt, zoom: number, vw: number, vh: number, mapW: number, mapH: number, dpr = 1, focusY = 0.5): MapOffset {
  const fit = (want: number, view: number, size: number) => {
    const scaled = size * zoom;
    if (scaled <= view) return (view - scaled) / 2;
    return Math.min(0, Math.max(view - scaled, want));
  };
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  return { tx: snap(fit(vw / 2 - center.x * zoom, vw, mapW)), ty: snap(fit(vh * focusY - center.y * zoom, vh, mapH)) };
}
