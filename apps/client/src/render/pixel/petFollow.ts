/**
 * Subscriber pets trail their owner instead of copying the owner's pose.
 *
 * The trail is a short breadcrumb of the owner's feet. The pet walks that path a couple of tiles
 * behind, at its own speed, and settles a little behind or beside them once they stop. A room
 * change, a teleport, or a gap the pet cannot cross snaps it back beside the owner.
 *
 * Sit, lie, and come are voice commands. They are read from chat the owner already sent — the
 * message itself is never rewritten. Every client derives the same pose from the owner's synced
 * position and the chat line, so remote pets trail and sit too.
 */
import { facingForStep, type Facing } from './facing';

export type PetPose = 'walk' | 'idle' | 'sit' | 'lie';
export type PetVoice = 'sit' | 'lie' | 'come';

/** Art px per tile. The follower works in world px, the same space as avatar feet. */
export const PET_TILE = 16;
/** Drop a breadcrumb once the owner has moved this far from the last one. */
export const CRUMB_PX = 4;
/** How far behind a walking owner the pet aims to stay (a little over two tiles). */
export const FOLLOW_LAG_PX = 2.5 * PET_TILE;
/**
 * Once the owner stops, the pet closes to this far behind, then steps aside. The pet frame is 24px wide, so a full tile
 * aside keeps an idle, sitting or lying pet clear of the owner's legs (and of the shoulder parrot above them) instead of
 * half over the owner's feet.
 */
export const REST_BEHIND_PX = 18;
export const REST_ASIDE_PX = PET_TILE;
/**
 * Own pace, in world px per second. A player tile step is 16px / 0.26s (~62 px/s). The pet is a
 * little quicker so it can hold the lag through a turn, and it never locks to the owner's feet.
 */
export const PET_WALK_PX_S = 70;
/** "Vem": close the gap at a run. */
export const PET_RUN_PX_S = 140;
/** Straight-line gap that means a teleport or a room the breadcrumbs cannot cross. */
export const SNAP_GAP_PX = 6 * PET_TILE;
const TRAIL_MAX_PX = 12 * PET_TILE;
const ARRIVE_PX = 1.25;

export interface PetCrumb {
  x: number;
  y: number;
}

export interface PetFollow {
  trail: PetCrumb[];
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  pose: PetPose;
  /** Latched by "senta" / "deita" until the owner starts walking again. */
  held: 'sit' | 'lie' | null;
  /** Latched by "vem" until the pet is back in its normal slot. */
  running: boolean;
  place: string;
  ownerWasMoving: boolean;
}

export interface PetFollowStep {
  ownerX: number;
  ownerY: number;
  ownerMoving: boolean;
  /** Room identity. A change snaps; two rooms can share similar coordinates. */
  place: string;
  /** Seconds since the previous step. */
  dt: number;
  /** A command heard this step. Null leaves the current pose alone. */
  command?: PetVoice | null;
}

export function createPetFollow(): PetFollow {
  return {
    trail: [],
    x: Number.NaN,
    y: Number.NaN,
    facing: 'S',
    moving: false,
    pose: 'idle',
    held: null,
    running: false,
    place: '',
    ownerWasMoving: false,
  };
}

const COMMANDS: Record<string, PetVoice> = { senta: 'sit', deita: 'lie', vem: 'come' };

/** Punctuation a player can wrap around a one-word command, including the optional "!". */
const PUNCT = /[!?.,…;:"“”'‘’()[\]«»¿¡\-—–~*]+/g;

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A chat line that is only a pet command.
 * Case, accents, and punctuation are ignored. The pet's name may sit on either side.
 * Any other word means it is ordinary chat and the pet does not react.
 */
export function parsePetCommand(text: string, names: readonly string[] = []): PetVoice | null {
  if (typeof text !== 'string') return null;
  let rest = fold(text);
  if (!rest) return null;
  const phrases = [...new Set(names.map(fold).filter((n) => n.length > 0))].sort((a, b) => b.length - a.length);
  for (const name of phrases) {
    const re = new RegExp(`(?:^| )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?= |$)`);
    if (!re.test(rest)) continue;
    rest = rest.replace(re, ' ').replace(/\s+/g, ' ').trim();
    break;
  }
  return COMMANDS[rest] ?? null;
}

export interface PetLine {
  text: string;
  at: number;
}

/**
 * The newest command among chat lines newer than `heardAt`.
 * Lines are chronological. Hearing a line that is not a command does not cancel a pose;
 * it only marks the line as already seen so it is not parsed again.
 */
export function petCommandFromLines(lines: readonly PetLine[], heardAt: number, names: readonly string[] = []): { command: PetVoice | null; heardAt: number } {
  let command: PetVoice | null = null;
  let heard = heardAt;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (line.at <= heardAt) break;
    if (line.at > heard) heard = line.at;
    if (!command) command = parsePetCommand(line.text, names);
  }
  return { command, heardAt: heard };
}

function rememberCrumb(trail: PetCrumb[], x: number, y: number): void {
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(last.x - x, last.y - y) >= CRUMB_PX) trail.push({ x, y });
  let len = 0;
  for (let i = trail.length - 1; i > 0; i--) {
    len += Math.hypot(trail[i]!.x - trail[i - 1]!.x, trail[i]!.y - trail[i - 1]!.y);
    if (len > TRAIL_MAX_PX) {
      trail.splice(0, i);
      break;
    }
  }
}

function samplesOf(trail: readonly PetCrumb[], x: number, y: number): PetCrumb[] {
  const last = trail[trail.length - 1];
  if (last && last.x === x && last.y === y) return trail.slice();
  return [...trail, { x, y }];
}

/** A point `backPx` behind the owner, walking the breadcrumbs in reverse. */
function pointBehind(samples: readonly PetCrumb[], backPx: number): PetCrumb {
  const head = samples[samples.length - 1] ?? { x: 0, y: 0 };
  let remain = backPx;
  for (let i = samples.length - 1; i > 0; i--) {
    const a = samples[i]!;
    const b = samples[i - 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    if (remain <= len) {
      const t = remain / len;
      return { x: a.x + dx * t, y: a.y + dy * t };
    }
    remain -= len;
  }
  return samples[0] ?? head;
}

function heading(samples: readonly PetCrumb[]): PetCrumb {
  if (samples.length < 2) return { x: 0, y: 0 };
  const a = samples[samples.length - 2]!;
  const b = samples[samples.length - 1]!;
  return { x: b.x - a.x, y: b.y - a.y };
}

/** Perpendicular to the last step, so a resting pet stands beside the path instead of on the owner's feet. */
function aside(samples: readonly PetCrumb[], px: number): PetCrumb {
  const h = heading(samples);
  const len = Math.hypot(h.x, h.y);
  if (len < 1e-3) return { x: px, y: 0 };
  return { x: (-h.y / len) * px, y: (h.x / len) * px };
}

function goal(samples: readonly PetCrumb[], ownerMoving: boolean, running: boolean): PetCrumb {
  const behind = !ownerMoving || running ? REST_BEHIND_PX : FOLLOW_LAG_PX;
  const p = pointBehind(samples, behind);
  if (ownerMoving && !running) return p;
  const a = aside(samples, REST_ASIDE_PX);
  return { x: p.x + a.x, y: p.y + a.y };
}

function snapNear(state: PetFollow, x: number, y: number, place: string): void {
  state.place = place;
  state.trail = [{ x, y }];
  state.x = x + REST_ASIDE_PX;
  state.y = y + 2;
  state.moving = false;
  state.running = false;
  state.facing = state.held ? state.facing : 'S';
  state.pose = state.held === 'lie' ? 'lie' : state.held === 'sit' ? 'sit' : 'idle';
}

function applyCommand(state: PetFollow, step: PetFollowStep): void {
  const started = step.ownerMoving && !state.ownerWasMoving;
  state.ownerWasMoving = step.ownerMoving;
  if (step.command === 'sit' || step.command === 'lie') {
    state.held = step.command;
    state.running = false;
  } else if (step.command === 'come') {
    state.held = null;
    state.running = true;
  } else if (started && state.held) state.held = null;
}

function holdPose(state: PetFollow): void {
  state.moving = false;
  state.pose = state.held === 'lie' ? 'lie' : 'sit';
}

/** Advance the pet one frame. Mutates `state` and returns it. */
export function stepPet(state: PetFollow, step: PetFollowStep): PetFollow {
  const dt = Math.min(0.1, Math.max(0, step.dt));
  const gap = Number.isFinite(state.x) ? Math.hypot(state.x - step.ownerX, state.y - step.ownerY) : Infinity;
  const snap = state.place !== step.place || !Number.isFinite(state.x) || gap > SNAP_GAP_PX;
  if (snap) {
    applyCommand(state, step);
    snapNear(state, step.ownerX, step.ownerY, step.place);
    if (state.held) holdPose(state);
    return state;
  }

  rememberCrumb(state.trail, step.ownerX, step.ownerY);
  applyCommand(state, step);
  if (state.held) {
    holdPose(state);
    return state;
  }

  const samples = samplesOf(state.trail, step.ownerX, step.ownerY);
  const target = goal(samples, step.ownerMoving, state.running);
  const dx = target.x - state.x;
  const dy = target.y - state.y;
  const dist = Math.hypot(dx, dy);
  const speed = state.running ? PET_RUN_PX_S : PET_WALK_PX_S;
  const stepPx = speed * dt;
  const arrived = dist <= ARRIVE_PX;

  if (!step.ownerMoving && (arrived || dist <= stepPx)) {
    state.x = target.x;
    state.y = target.y;
    state.moving = false;
    state.pose = 'idle';
    state.facing = 'S';
    state.running = false;
    return state;
  }

  if (step.ownerMoving && arrived) {
    state.x = target.x;
    state.y = target.y;
    state.moving = true;
    state.pose = 'walk';
    const h = heading(samples);
    state.facing = facingForStep(h.x, h.y, state.facing);
  } else if (dist > 1e-6) {
    const f = Math.min(1, stepPx / dist);
    const mx = dx * f;
    const my = dy * f;
    state.x += mx;
    state.y += my;
    state.moving = true;
    state.pose = 'walk';
    state.facing = facingForStep(mx, my, state.facing);
  }

  if (state.running && Math.hypot(state.x - step.ownerX, state.y - step.ownerY) <= FOLLOW_LAG_PX) state.running = false;
  return state;
}
