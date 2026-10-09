/**
 * The move clips of "Treino no tatame": every move the rules allow from each position has two baked clips (it lands / it misses) of
 * {@link CLIP_FRAMES} frames, drawn by assets-src/custom/bjj-moves.mjs and played by boutStage.ts instead of tilting the idle sprite.
 * No imports here: the asset script loads this file directly.
 *
 * In every clip frame the fighter who moves is the art slot A (white gi keys) and the other is B, so the runtime paints A as the actor.
 * A clip starts on the `from` pose and a landed clip ends on the `to` pose; `actorBottom` says the actor starts underneath (a sweep, an
 * escape), `endBottom` that they end underneath (pulling guard, recovering guard). From standing the actor stands on the left: when the
 * partner moves, the stage mirrors the clip so the partner stays on the right. `mirror` clips land in the mirrored ground pose (the
 * fighter taken down falls backwards, away from the actor); the stage keeps the ground poses mirrored from then on.
 */

export interface ClipDef {
  move: string;
  from: string;
  /** where a landed clip ends; unset: back on `from` (a grip, a brace, a submission attempt) */
  to?: string;
  family: ClipFamily;
  actorBottom?: boolean;
  endBottom?: boolean;
  mirror?: boolean;
  /** where a missed clip ends when the miss moves the fighters (a failed submission: closed guard, the attacker underneath, mirrored) */
  missTo?: string;
}

/** A missed submission drops the attacker onto their back in closed guard: the miss clip ends there, mirrored. */
const SUB_MISS = { missTo: 'guarda_fechada' } as const;

export type ClipFamily = 'grip' | 'posture' | 'sprawl' | 'shoot' | 'drag' | 'pull' | 'throw' | 'base' | 'pass' | 'take' | 'sweep' | 'frame' | 'escape' | 'sub';

export const CLIPS: readonly ClipDef[] = [
  // standing
  { move: 'collar_tie', from: 'de_pe', family: 'grip' },
  { move: 'sleeve_grip', from: 'de_pe', family: 'grip' },
  { move: 'posture', from: 'de_pe', family: 'posture' },
  { move: 'sprawl', from: 'de_pe', family: 'sprawl' },
  { move: 'double_leg', from: 'de_pe', to: 'cem_quilos', family: 'shoot', mirror: true },
  { move: 'single_leg', from: 'de_pe', to: 'joelho', family: 'shoot', mirror: true },
  { move: 'body_lock', from: 'de_pe', to: 'guarda_fechada', family: 'shoot', mirror: true },
  { move: 'collar_drag', from: 'de_pe', to: 'costas', family: 'drag' },
  { move: 'sleeve_pull', from: 'de_pe', to: 'guarda_fechada', family: 'pull', endBottom: true },
  { move: 'hip_throw', from: 'de_pe', to: 'joelho', family: 'throw' },
  // closed guard, on top
  { move: 'sprawl', from: 'guarda_fechada', family: 'base' },
  { move: 'passar', from: 'guarda_fechada', to: 'cem_quilos', family: 'pass' },
  { move: 'americana', from: 'guarda_fechada', family: 'sub', ...SUB_MISS },
  // closed guard, underneath
  { move: 'hook_sweep', from: 'guarda_fechada', to: 'cem_quilos', family: 'sweep', actorBottom: true, mirror: true },
  { move: 'scissor_sweep', from: 'guarda_fechada', to: 'montada', family: 'sweep', actorBottom: true, mirror: true },
  { move: 'hip_bump', from: 'guarda_fechada', to: 'cem_quilos', family: 'sweep', actorBottom: true, mirror: true },
  { move: 'frame', from: 'guarda_fechada', family: 'frame', actorBottom: true, endBottom: true },
  // side control
  { move: 'passar', from: 'cem_quilos', to: 'montada', family: 'pass' },
  { move: 'knee_on_belly', from: 'cem_quilos', to: 'joelho', family: 'pass' },
  { move: 'back_take', from: 'cem_quilos', to: 'costas', family: 'take' },
  { move: 'frame', from: 'cem_quilos', to: 'guarda_fechada', family: 'frame', actorBottom: true, endBottom: true },
  // knee on belly
  { move: 'passar', from: 'joelho', to: 'montada', family: 'pass' },
  { move: 'back_take', from: 'joelho', to: 'costas', family: 'take' },
  { move: 'frame', from: 'joelho', to: 'guarda_fechada', family: 'frame', actorBottom: true, endBottom: true },
  // mount
  { move: 'back_take', from: 'montada', to: 'costas', family: 'take' },
  { move: 'armbar', from: 'montada', family: 'sub', ...SUB_MISS },
  { move: 'americana', from: 'montada', family: 'sub', ...SUB_MISS },
  { move: 'frame', from: 'montada', to: 'guarda_fechada', family: 'frame', actorBottom: true, endBottom: true },
  // back
  { move: 'armbar', from: 'costas', family: 'sub', ...SUB_MISS },
  { move: 'rnc', from: 'costas', family: 'sub', ...SUB_MISS },
  { move: 'escape_back', from: 'costas', to: 'guarda_fechada', family: 'escape', actorBottom: true, endBottom: true, mirror: true },
];

export const CLIP_FRAMES = 8;

/**
 * When each frame starts, as a fraction of the cartoon: a wind-up, the action, the big frame (mid-throw, the grip snap) at {@link IMPACT},
 * the landing at {@link LAND}, then the settle. `slow` is the finishing move: the big frame and the landing hang in slow motion.
 */
export const BEATS = {
  normal: [0, 0.08, 0.17, 0.27, 0.38, 0.5, 0.64, 0.78],
  slow: [0, 0.05, 0.1, 0.16, 0.23, 0.55, 0.74, 0.86],
} as const;
export const IMPACT = 4;
export const LAND = 5;

/** Clips whose landing throws a whole body onto the mat (the big dust). */
export const SLAM_FAMILIES: readonly ClipFamily[] = ['shoot', 'throw', 'drag', 'pull', 'sweep'];

const tag = (s: string) => s.replace(/[^a-z_]/g, '');
export const clipKey = (move: string, from: string, hit: boolean, i: number): string => `bjj/mv_${tag(move)}__${tag(from)}_${hit ? 'h' : 'm'}_${i}`;

/**
 * Virar (everyone's escape, no art of its own) plays the stripe escapes' frames: Recuperar's from the side, the knee and the top, Sair's
 * from the back.
 */
const clipMove = (move: string, from: string): string => (move === 'virar' ? (from === 'costas' ? 'escape_back' : 'frame') : move);

export function clipDef(move: string, from: string): ClipDef | null {
  const m = clipMove(move, from);
  return CLIPS.find((c) => c.move === m && c.from === from) ?? null;
}

/** Which frame of a clip shows at `u` (0..1 of the cartoon). */
export function clipFrameAt(u: number, slow = false): number {
  const b = slow ? BEATS.slow : BEATS.normal;
  let i = 0;
  while (i < b.length - 1 && u >= b[i + 1]!) i++;
  return i;
}

// ---------------------------------------------------------------- standing grips

/** Grip state of one fighter on its feet: none, collar, sleeve, both. */
export type StandGrip = 'n' | 'c' | 's' | 'b';
export const STAND_GRIPS: readonly StandGrip[] = ['n', 'c', 's', 'b'];
export const STAND_FRAMES = 4;
export const standGrip = (g: { collar: boolean; sleeve: boolean } | undefined): StandGrip => (!g ? 'n' : g.collar && g.sleeve ? 'b' : g.collar ? 'c' : g.sleeve ? 's' : 'n');
/** The standing idle loop with each fighter's grips held in the art (`you` is the left fighter, art slot A). */
export const standKey = (you: StandGrip, partner: StandGrip, i: number): string => `bjj/stand_${you}${partner}_${i}`;
