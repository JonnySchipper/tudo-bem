/**
 * Toontown-style gag bar and the short cartoon each move plays.
 * The cartoon uses the existing pair poses only. The position does not change until the cartoon finishes:
 * a hit then slides into the gained pose, a miss stumbles back to the pose it started from.
 *
 * needs_br: true — Pegada, Quedas, Raspagem, Passagem. Defesa and Final are already on the bout chrome.
 */
import { isMatMove, type BjjPositionId, type MatMoveId } from '@tudobem/shared';

/**
 * Tatame v3: a move the taps did not drive (Hold, a botch, a brace block, the partner's move with no defense beat, or no baked clip)
 * plays whole over this long. A driven move only plays its landing (`LAND_MS`): the wind-up already played with the taps.
 */
export const CARTOON_MS = 900;
export const LAND_MS = 650;

export type GagTrackId = 'grips' | 'takedowns' | 'sweeps' | 'defense' | 'passes' | 'subs';

export interface GagTrack {
  id: GagTrackId;
  pt: string;
  en: string;
  moves: readonly Exclude<MatMoveId, 'hold'>[];
}

export const GAG_TRACKS: readonly GagTrack[] = [
  { id: 'grips', pt: 'Pegada', en: 'Grips', moves: ['collar_tie', 'sleeve_grip'] },
  { id: 'takedowns', pt: 'Quedas', en: 'Takedowns', moves: ['hip_throw', 'collar_drag', 'double_leg', 'body_lock', 'single_leg', 'sleeve_pull'] },
  { id: 'sweeps', pt: 'Raspagem', en: 'Sweeps', moves: ['hook_sweep', 'scissor_sweep', 'hip_bump'] },
  { id: 'defense', pt: 'Defesa', en: 'Defense', moves: ['posture', 'sprawl', 'frame', 'escape_back'] },
  { id: 'passes', pt: 'Passagem', en: 'Passes', moves: ['passar', 'knee_on_belly', 'back_take'] },
  { id: 'subs', pt: 'Final', en: 'Submissions', moves: ['armbar', 'americana', 'rnc'] },
];

export type CartoonRead = 'gain' | 'stumble' | 'stick' | 'brace';

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
  collar_drag: { x: 30, y: 18, rot: -34 },
  sleeve_pull: { x: -20, y: 26, rot: 30 },
  hip_throw: { x: 12, y: -18, rot: -60 },
  hook_sweep: { x: 14, y: 24, rot: -50 },
  scissor_sweep: { x: -12, y: 4, rot: -42 },
  hip_bump: { x: 4, y: -26, rot: 24 },
  posture: { x: -34, y: 14, rot: 8 },
  passar: { x: 40, y: 16, rot: -8 },
  knee_on_belly: { x: 18, y: -10, rot: -22 },
  back_take: { x: -16, y: 20, rot: 46 },
  single_leg: { x: 10, y: 36, rot: 26 },
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

type Beat = [at: number, x: number, y: number, rot: number];

/**
 * The grip game's big moves get a whole little routine instead of one lean (`y` is up):
 * Queda loads, shoots low and slams; Arrastar pulls, then whips round behind; Puxar sits down and takes them along;
 * Arremesso loads the hip and turns them all the way over; Postura stands tall and shoves the grips off; Base sprawls flat.
 * A miss keeps the shared stumble, so a miss always looks like a miss. Every routine ends where it started (Arremesso a full turn on).
 */
const ROUTINE: Partial<Record<MatMoveId, readonly Beat[]>> = {
  double_leg: [
    [0, 0, 0, 0],
    [0.18, -8, -5, 8],
    [0.42, 30, 4, -28],
    [0.6, 22, 12, -42],
    [0.8, 8, -3, -10],
    [1, 0, 0, 0],
  ],
  collar_drag: [
    [0, 0, 0, 0],
    [0.2, -18, 2, 14],
    [0.42, 30, 18, -34],
    [0.62, 38, 6, -54],
    [0.82, 10, 0, -12],
    [1, 0, 0, 0],
  ],
  sleeve_pull: [
    [0, 0, 0, 0],
    [0.2, -8, 6, 8],
    [0.42, -20, 26, 30],
    [0.7, -10, -16, 22],
    [1, 0, 0, 0],
  ],
  hip_throw: [
    [0, 0, 0, 0],
    [0.15, -8, 0, 10],
    [0.42, 12, -18, -60],
    [0.55, 16, 26, -170],
    [0.72, 10, 14, -290],
    [0.86, 4, -2, -350],
    [1, 0, 0, -360],
  ],
  posture: [
    [0, 0, 0, 0],
    [0.2, 0, 10, 0],
    [0.42, -34, 14, 8],
    [0.7, -12, -2, 0],
    [1, 0, 0, 0],
  ],
  sprawl: [
    [0, 0, 0, 0],
    [0.22, -10, 6, 10],
    [0.42, -22, 18, 14],
    [0.68, -14, -8, 10],
    [1, 0, 0, 0],
  ],
};

/** The defenses that set a brace: when they land, the pair settles and braces rather than moving. */
const BRACES = new Set<MatMoveId>(['posture', 'sprawl']);

export function cartoonFor(move: string, hit: boolean, from: BjjPositionId, to: BjjPositionId): Cartoon {
  const id: MatMoveId = isMatMove(move) ? move : 'hold';
  const sig = SIGNATURE[id];
  const pose = from;
  const routine = hit ? ROUTINE[id] : undefined;
  const path: CartoonSample[] = routine
    ? routine.map(([at, x, y, rot]) => ({ at, pose, x, y, rot }))
    : hit
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
  const read: CartoonRead = !hit ? 'stumble' : from !== to ? 'gain' : BRACES.has(id) ? 'brace' : 'stick';
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
