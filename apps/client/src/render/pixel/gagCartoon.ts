/**
 * Toontown-style gag bar and the short cartoon each move plays.
 * The cartoon uses the existing pair poses only. The position does not change until the cartoon finishes:
 * a hit then slides into the gained pose, a miss stumbles back to the pose it started from.
 *
 * needs_br: true — Pegada, Quedas, Raspagem. Defesa and Final are already on the bout chrome.
 */
import { isMatMove, type BjjPositionId, type MatMoveId } from '@tudobem/shared';

/** How long the move's cartoon plays before the pose is allowed to change. */
export const CARTOON_MS = 2000;
/** After your cartoon, the opponent sits with the decision before their attempt is shown. */
export const THINK_MS = 3200;

export type GagTrackId = 'grips' | 'takedowns' | 'sweeps' | 'defense' | 'subs';

export interface GagTrack {
  id: GagTrackId;
  pt: string;
  en: string;
  moves: readonly Exclude<MatMoveId, 'hold'>[];
}

export const GAG_TRACKS: readonly GagTrack[] = [
  { id: 'grips', pt: 'Pegada', en: 'Grips', moves: ['collar_tie', 'sleeve_grip'] },
  { id: 'takedowns', pt: 'Quedas', en: 'Takedowns', moves: ['double_leg', 'body_lock'] },
  { id: 'sweeps', pt: 'Raspagem', en: 'Sweeps', moves: ['scissor_sweep', 'hip_bump'] },
  { id: 'defense', pt: 'Defesa', en: 'Defense', moves: ['sprawl', 'frame', 'escape_back'] },
  { id: 'subs', pt: 'Final', en: 'Submissions', moves: ['armbar', 'americana', 'rnc'] },
];

export type CartoonRead = 'gain' | 'stumble' | 'stick';

export interface CartoonSample {
  /** 0..1 along the cartoon. */
  at: number;
  /** Existing pair pose. Stays on the pose the move started from until the cartoon ends. */
  pose: BjjPositionId;
  x: number;
  y: number;
  /** Degrees. */
  rot: number;
}

export interface Cartoon {
  move: MatMoveId;
  path: CartoonSample[];
  /** Pose to show once the cartoon has finished. */
  then: BjjPositionId;
  read: CartoonRead;
}

/** A committed lean that is different for every move, so the cartoons do not look alike with the sound off. */
const SIGNATURE: Record<MatMoveId, { x: number; y: number; rot: number }> = {
  collar_tie: { x: 28, y: 2, rot: -16 },
  sleeve_grip: { x: -28, y: 2, rot: 18 },
  double_leg: { x: 6, y: 32, rot: -28 },
  body_lock: { x: 22, y: 8, rot: 10 },
  scissor_sweep: { x: -12, y: 4, rot: -42 },
  hip_bump: { x: 4, y: -26, rot: 24 },
  sprawl: { x: -22, y: 18, rot: 14 },
  frame: { x: 32, y: -6, rot: -12 },
  escape_back: { x: -8, y: -14, rot: 40 },
  armbar: { x: 16, y: -22, rot: -36 },
  americana: { x: -18, y: -16, rot: 32 },
  rnc: { x: -30, y: 6, rot: -20 },
  hold: { x: 0, y: 10, rot: 0 },
};

export function trackOf(id: MatMoveId): GagTrack | null {
  return GAG_TRACKS.find((t) => (t.moves as readonly MatMoveId[]).includes(id)) ?? null;
}

export function cartoonFor(move: string, hit: boolean, from: BjjPositionId, to: BjjPositionId): Cartoon {
  const id: MatMoveId = isMatMove(move) ? move : 'hold';
  const sig = SIGNATURE[id];
  const pose = from;
  const path: CartoonSample[] = hit
    ? [
        { at: 0, pose, x: 0, y: 0, rot: 0 },
        { at: 0.42, pose, x: sig.x, y: sig.y, rot: sig.rot },
        { at: 0.74, pose, x: sig.x * 0.45, y: sig.y * 0.35, rot: sig.rot * 0.35 },
        { at: 1, pose, x: 0, y: 0, rot: 0 },
      ]
    : [
        { at: 0, pose, x: 0, y: 0, rot: 0 },
        { at: 0.36, pose, x: sig.x, y: sig.y, rot: sig.rot },
        { at: 0.68, pose, x: -sig.x * 0.9, y: Math.abs(sig.y) + 8, rot: -sig.rot * 0.75 },
        { at: 1, pose, x: 0, y: 0, rot: 0 },
      ];
  const read: CartoonRead = !hit ? 'stumble' : from !== to ? 'gain' : 'stick';
  return { move: id, path, then: to, read };
}

export function sampleCartoon(path: readonly CartoonSample[], u: number): CartoonSample {
  const t = Math.max(0, Math.min(1, u));
  let i = 0;
  while (i < path.length - 2 && path[i + 1]!.at < t) i++;
  const a = path[i] ?? path[0]!;
  const b = path[Math.min(path.length - 1, i + 1)] ?? a;
  const span = Math.max(0.0001, b.at - a.at);
  const k = Math.max(0, Math.min(1, (t - a.at) / span));
  return {
    at: t,
    pose: k < 1 ? a.pose : b.pose,
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    rot: a.rot + (b.rot - a.rot) * k,
  };
}
