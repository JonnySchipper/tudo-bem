/**
 * PropKind -> manifest sprite key, placement anchors and hit boxes (HOWTO §5.1 props.ts, §5.4). Pure: no Phaser.
 *
 * Phase 2 only maps the kinds that have real art in the manifest; everything else resolves to a placeholder key
 * (`props/<kind>`, HOWTO §5.10) that the scene draws as a flat magenta box. Phase 4 completes this table.
 */
import type { PropDef, PropKind } from '@tudobem/shared';
import { T, type Rect } from './coords';

/** Manifest key for a prop, or null when the manifest has nothing sensible (the caller then draws a placeholder). */
const ART: Partial<Record<PropKind, string>> = {
  banco: 'props/bench_small',
  poste: 'props/poste_fios',
  banca: 'props/banca',
  barraca_chapeus: 'props/barraca_chapeus',
  quiosque: 'props/quiosque',
  poleiro: 'props/poleiro',
  canteiro: 'props/planter_grass',
  lixeira: 'props/lixeira',
  orelhao: 'props/orelhao',
  placa_rua: 'props/placa_rua',
  vaso: 'props/pot_teal',
  floreira: 'props/pot_red',
  saco_lixo: 'props/trash',
  // art track 3: padaria
  vitrine: 'props/vitrine',
  estufa: 'props/estufa',
  trilho_pedidos: 'props/trilho_pedidos',
  caixa: 'props/caixa',
  banqueta: 'props/banqueta',
  mesa: 'props/mesa',
  // art track 3: kitnet, academia, praça
  cama: 'props/cama',
  cozinha: 'props/cozinha',
  tatame: 'props/tatame',
  quadro_fila: 'props/quadro_fila',
  parede_faixas: 'props/parede_faixas',
  vestiario: 'props/vestiario',
  quadro_foto: 'props/quadro_foto',
  bicicletario: 'props/bicicletario',
  mesa_cafe: 'props/mesa_cafe',
  jornais: 'props/jornais',
};

/** Seat direction (wire Dir) -> the chair sprite suffix (SE faces E, SW faces S, NE faces N, NW faces W, HOWTO §5.2). */
const CHAIR_SUFFIX: Record<string, string> = { SE: 'e', SW: 's', NE: 'n', NW: 'w' };

/** Long props drawn as one 1-tile slice per tile of their footprint (`<base>_<i>_of_<w>`, like the balcão counter and the bleachers). */
const SLICED: Partial<Record<PropKind, string>> = { balcao: 'props/balcao', banco_espectador: 'props/banco_espectador' };

/** The slice sprites of a sliced prop, left to right (a 1-tile-tall footprint), or null for a normal prop. */
export function propSlices(p: PropDef): { key: string; x: number; y: number }[] | null {
  const base = SLICED[p.kind];
  if (!base) return null;
  const { w, h } = propSize(p);
  const out: { key: string; x: number; y: number }[] = [];
  for (let i = 0; i < w; i++) out.push({ key: `${base}_${i}_of_${w}`, x: p.x + i, y: p.y + h - 1 });
  return out;
}

export function propArtKey(p: PropDef): string | null {
  if (p.kind === 'ipe') return p.hero ? 'props/ipe_large' : 'props/ipe_medium';
  if (p.kind === 'cadeira_padaria') return `props/cadeira_padaria_${CHAIR_SUFFIX[p.seat ?? 'SE']}`;
  return ART[p.kind] ?? null;
}

/** The key reported in `window.__tb.artMissing` for a prop with no art. */
export const propPlaceholderKey = (p: PropDef): string => `props/${p.kind}`;

/** Footprint in tiles. */
export const propSize = (p: PropDef): { w: number; h: number } => ({ w: p.w ?? 1, h: p.h ?? 1 });

/** Where a prop's anchor lands: the bottom-centre of its footprint (manifest `ax`/`ay` is placed here). */
export function propAnchor(p: PropDef): { wx: number; wy: number } {
  const { w, h } = propSize(p);
  return { wx: (p.x + w / 2) * T, wy: (p.y + h) * T };
}

/** Small deterministic tiebreak so two objects on the same bottom edge always sort the same way (HOWTO §5.4). */
export function idTiebreak(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100) / 1000;
}

/** Depth of anything that stands: its bottom-edge world y plus the tiebreak. */
export const standingDepth = (bottomY: number, id: string): number => bottomY + idTiebreak(id);

export const DEPTH = {
  terrain: -10000,
  wall: -9000,
  wallDecor: -8990,
  groundDecal: -5000,
  shadowCast: -4600,
  shadowContact: -4500,
  overhead: 50000,
  lighting: 90000,
} as const;

/** Synthetic light for props whose manifest entry carries none (the lamp on the utility pole). */
export const PROP_LIGHT: Partial<Record<PropKind, { x: number; y: number; r: number; color: string }>> = {
  poste: { x: 0, y: -50, r: 46, color: '#ffb45a' },
};

/** World rect a sprite covers when its anchor is at (wx, wy). */
export function spriteRect(wx: number, wy: number, d: { w: number; h: number; ax: number; ay: number }): Rect {
  return { x0: wx - d.ax, y0: wy - d.ay, x1: wx - d.ax + d.w, y1: wy - d.ay + d.h };
}

export const unionRect = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

export const inflate = (r: Rect, by: number): Rect => ({ x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by });

/** The footprint of a prop as a world rect. */
export function footprintRect(p: PropDef): Rect {
  const { w, h } = propSize(p);
  return { x0: p.x * T, y0: p.y * T, x1: (p.x + w) * T, y1: (p.y + h) * T };
}
