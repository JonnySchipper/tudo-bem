/**
 * Ambient occlusion (V5): soft darkening where things meet the ground, under tree canopies and awnings, under benches and stalls, and along the
 * foot of a curb. It is STATIC (it does not depend on the sun), so a room paints it once into one canvas that the scene draws as a single
 * multiply layer under the shadows. This file is the pure plan (shapes and strips from sprite defs and the floor chars) plus the canvas painter;
 * `aoLayer.ts` is the Phaser side.
 *
 * Shapes are soft because they are painted with the canvas Gaussian shadow blur, not because anything is filtered at run time.
 */
import type { SpriteDef } from './manifest';

export interface AoShape {
  kind: 'ellipse' | 'rect';
  /** world px, centre for an ellipse, top-left for a rect */
  x: number;
  y: number;
  /** radii for an ellipse, size for a rect */
  w: number;
  h: number;
  /** peak alpha 0..1 of the stamp */
  a: number;
  /** Gaussian blur in px */
  blur: number;
}

/** A gradient strip on the low side of an edge (grass or asphalt beside a raised curb / paving). Rect in world px; `side` is the edge it hugs. */
export interface AoStrip {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  side: 'n' | 's' | 'e' | 'w';
  a: number;
}

const BUILDING: readonly string[] = ['facades/', 'buildings/', 'casas/', 'fundos/', 'props/edicula', 'props/feira_livre'];
const NONE: readonly string[] = ['decals/', 'fx/', 'backdrop/', 'ui/', 'walls/', 'doors/', 'telhados/', 'furniture/', 'props/fios', 'props/doormat', 'props/tatame', 'critters/', 'vehicles/', 'chars/', 'fence/', 'feira/preco'];

/** Footprint of a sprite in px and its sprite box: where AO goes under a standing thing. */
export function aoForSprite(key: string, d: Pick<SpriteDef, 'w' | 'h' | 'ax' | 'ay' | 'footprint' | 'decal'>, wx: number, wy: number): AoShape[] {
  if (d.decal || NONE.some((p) => key.startsWith(p))) return [];
  const left = wx - d.ax;
  if (BUILDING.some((p) => key.startsWith(p))) {
    // the wall meets the ground: a soft band on the ground in front of the base. The facade's own soleira (V3) already darkens its last three
    // rows, so the band starts at the foot line and goes south only (no double darkening on the wall).
    return [{ kind: 'rect', x: left + 2, y: wy + 1, w: d.w - 4, h: 5, a: 0.5, blur: 3 }];
  }
  const fw = d.footprint[0] * 16;
  const rx = Math.max(6, fw * 0.5 + 3);
  const low = d.ay - 0; // sprite height above the foot
  const small = low < 24;
  return [{ kind: 'ellipse', x: wx, y: wy - 2, w: rx, h: Math.max(3, rx * 0.42), a: small ? 0.42 : 0.5, blur: 3.2 }];
}

/**
 * Shade under an overhead part (a tree canopy, a stall's tarp): the canopy's footprint on the ground, centred on the foot, a little larger and
 * softer than the shape of the sun's shadow, so the ground under a tree reads as shade even at noon.
 */
export function aoForOverhead(key: string, od: Pick<SpriteDef, 'w' | 'h' | 'ax' | 'ay'>, wx: number, wy: number, footprint: [number, number]): AoShape[] {
  const fw = footprint[0] * 16;
  const fh = footprint[1] * 16;
  if (key.includes('canopy')) {
    const rx = od.w * 0.5;
    return [{ kind: 'ellipse', x: wx, y: wy - 1, w: rx, h: rx * 0.52, a: 0.46, blur: 6 }];
  }
  // a tarp: the stall's own footprint
  return [{ kind: 'rect', x: wx - fw / 2 - 2, y: wy - fh - 2, w: fw + 4, h: fh + 4, a: 0.38, blur: 5 }];
}

/** Floor chars that are raised paving (they shade what is beside them) and the lower surfaces that take the shade. */
const RAISED = new Set(['c', 't', 'k']);
const LOWER = new Set(['g', 'a', 'd']);

/**
 * Edge strips: for every grass or asphalt tile with calçada or brick next to it, a strip `width` px wide along that side of the lower tile. The
 * side facing away from the sun is the same as the side facing it (AO is not directional), but a curb's own cast shadow is already baked on its
 * south-east side, so the north and west strips are a little stronger.
 */
export function aoForTerrain(floor: readonly string[], width = 5): AoStrip[] {
  const out: AoStrip[] = [];
  const at = (x: number, y: number) => floor[y]?.[x];
  floor.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (!LOWER.has(ch)) continue;
      const x0 = x * 16;
      const y0 = y * 16;
      const asphalt = ch === 'a';
      // the V1 curbs have their own lit lip and contact shadow baked in, so the strips are a light touch
      const base = asphalt ? 0.22 : 0.3;
      if (RAISED.has(at(x, y - 1) ?? '')) out.push({ x0, y0, x1: x0 + 16, y1: y0 + width, side: 'n', a: base * 1.15 });
      if (RAISED.has(at(x, y + 1) ?? '')) out.push({ x0, y0: y0 + 16 - width, x1: x0 + 16, y1: y0 + 16, side: 's', a: base * 0.8 });
      if (RAISED.has(at(x - 1, y) ?? '')) out.push({ x0, y0, x1: x0 + width, y1: y0 + 16, side: 'w', a: base * 1.15 });
      if (RAISED.has(at(x + 1, y) ?? '')) out.push({ x0: x0 + 16 - width, y0, x1: x0 + 16, y1: y0 + 16, side: 'e', a: base * 0.8 });
    }
  });
  return out;
}

/** Multiply colour of the AO stamp (a deep blue-violet: shade is cool, never grey). */
export const AO_RGB = '48,52,104';

/** Paint shapes and strips into a 2D context (cleared first). Pure canvas calls, so a headless canvas can run it in tests. */
export function paintAo(ctx: CanvasRenderingContext2D, w: number, h: number, shapes: readonly AoShape[], strips: readonly AoStrip[]): void {
  ctx.clearRect(0, 0, w, h);
  // Gaussian-blurred shapes: draw them far off-canvas and let the shadow land on it
  const OFF = 4096;
  ctx.save();
  ctx.shadowOffsetX = OFF;
  ctx.shadowOffsetY = 0;
  for (const s of shapes) {
    ctx.shadowColor = `rgba(${AO_RGB},${s.a})`;
    ctx.shadowBlur = s.blur * 2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    if (s.kind === 'ellipse') ctx.ellipse(s.x - OFF, s.y, s.w, s.h, 0, 0, Math.PI * 2);
    else ctx.rect(s.x - OFF, s.y, s.w, s.h);
    ctx.fill();
  }
  ctx.restore();
  for (const s of strips) {
    const g =
      s.side === 'n' ? ctx.createLinearGradient(0, s.y0, 0, s.y1) : s.side === 's' ? ctx.createLinearGradient(0, s.y1, 0, s.y0) : s.side === 'w' ? ctx.createLinearGradient(s.x0, 0, s.x1, 0) : ctx.createLinearGradient(s.x1, 0, s.x0, 0);
    g.addColorStop(0, `rgba(${AO_RGB},${s.a})`);
    g.addColorStop(1, `rgba(${AO_RGB},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
  }
}
