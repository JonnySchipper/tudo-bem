/**
 * American checkers on 8×8 (dark squares only). You play the dark pieces at the bottom (rows 5–7);
 * the opponent starts on rows 0–2. Mandatory jumps; kings on the back row.
 */
export type Piece = 0 | 1 | 2 | -1 | -2;
export type Cell = Piece;
export type Board = Cell[];

export const BOARD_SIZE = 8;

export type Side = 'you' | 'cpu';

export interface Move {
  from: number;
  to: number;
  /** Captured square indices (jumps). */
  caps: number[];
}

const DARK = (i: number) => ((i >> 3) + (i & 7)) % 2 === 1;

export function idx(x: number, y: number): number {
  return y * BOARD_SIZE + x;
}
export function xy(i: number): { x: number; y: number } {
  return { x: i % BOARD_SIZE, y: Math.floor(i / BOARD_SIZE) };
}

export function initialBoard(): Board {
  const b: Board = Array(64).fill(0);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < BOARD_SIZE; x++) if (DARK(idx(x, y))) b[idx(x, y)] = -1;
  for (let y = 5; y < 8; y++)
    for (let x = 0; x < BOARD_SIZE; x++) if (DARK(idx(x, y))) b[idx(x, y)] = 1;
  return b;
}

function isYou(p: Piece): boolean {
  return p > 0;
}
function isCpu(p: Piece): boolean {
  return p < 0;
}
function sideOf(p: Piece, side: Side): boolean {
  return side === 'you' ? isYou(p) : isCpu(p);
}
function king(p: Piece): boolean {
  return p === 2 || p === -2;
}

function manDy(side: Side): number {
  return side === 'you' ? -1 : 1;
}

function slideMoves(b: Board, from: number, side: Side): Move[] {
  const p = b[from];
  if (!p || !sideOf(p, side)) return [];
  const { x, y } = xy(from);
  const dirs: [number, number][] = king(p) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[manDy(side), -1], [manDy(side), 1]];
  const out: Move[] = [];
  for (const [ddy, ddx] of dirs) {
    const nx = x + ddx;
    const ny = y + ddy;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
    const to = idx(nx, ny);
    if (!DARK(to) || b[to] !== 0) continue;
    out.push({ from, to, caps: [] });
  }
  return out;
}

function jumpMoves(b: Board, from: number, side: Side, caps: number[] = []): Move[] {
  const p = b[from];
  if (!p || !sideOf(p, side)) return [];
  const { x, y } = xy(from);
  const dirs: [number, number][] = king(p) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[manDy(side), -1], [manDy(side), 1]];
  const out: Move[] = [];
  for (const [ddy, ddx] of dirs) {
    const mx = x + ddx;
    const my = y + ddy;
    const jx = x + ddx * 2;
    const jy = y + ddy * 2;
    if (jx < 0 || jx >= BOARD_SIZE || jy < 0 || jy >= BOARD_SIZE) continue;
    const mid = idx(mx, my);
    const to = idx(jx, jy);
    if (!DARK(to) || b[to] !== 0) continue;
    const victim = b[mid];
    if (!victim || !sideOf(victim, side === 'you' ? 'cpu' : 'you')) continue;
    if (caps.includes(mid)) continue;
    const nextCaps = [...caps, mid];
    const landed = applyMoveOn(b, { from, to, caps: nextCaps });
    const more = jumpMoves(landed, to, side, nextCaps);
    if (more.length) out.push(...more);
    else out.push({ from, to, caps: nextCaps });
  }
  return out;
}

function applyMoveOn(b: Board, m: Move): Board {
  const next = [...b] as Board;
  const p = next[m.from]!;
  next[m.from] = 0;
  for (const c of m.caps) next[c] = 0;
  const { y: ty } = xy(m.to);
  let placed: Piece = p;
  if (isYou(p) && ty === 0) placed = 2;
  if (isCpu(p) && ty === BOARD_SIZE - 1) placed = -2;
  next[m.to] = placed;
  return next;
}

export function applyMove(b: Board, m: Move): Board {
  return applyMoveOn(b, m);
}

export function legalMoves(b: Board, side: Side): Move[] {
  const jumps: Move[] = [];
  const slides: Move[] = [];
  for (let i = 0; i < 64; i++) {
    if (!b[i] || !sideOf(b[i]!, side)) continue;
    jumps.push(...jumpMoves(b, i, side));
    slides.push(...slideMoves(b, i, side));
  }
  return jumps.length ? jumps : slides;
}

/** No legal move loses (no pieces left, or every piece blocked); null while the side to move can play. */
export function winner(b: Board, sideToMove: Side): Side | 'draw' | null {
  const moves = legalMoves(b, sideToMove);
  if (moves.length) return null;
  const you = b.some((p) => isYou(p));
  const cpu = b.some((p) => isCpu(p));
  if (!you && !cpu) return 'draw';
  return sideToMove === 'you' ? 'cpu' : 'you';
}

/** Material from the CPU's side: a man is 1 (a little more as it advances), a king 1.7; the back row is worth keeping early. */
function evaluate(b: Board): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const { x, y } = xy(i);
    const centre = x >= 2 && x <= 5 ? 0.05 : 0;
    if (p === -1) s += 1 + y * 0.05 + centre + (y === 0 ? 0.1 : 0);
    else if (p === -2) s += 1.7 + centre;
    else if (p === 1) s -= 1 + (7 - y) * 0.05 + centre + (y === 7 ? 0.1 : 0);
    else s -= 1.7 + centre;
  }
  return s;
}

function search(b: Board, side: Side, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(b, side);
  if (!moves.length) return side === 'cpu' ? -100 - depth : 100 + depth;
  if (depth === 0) return evaluate(b);
  if (side === 'cpu') {
    let best = -Infinity;
    for (const m of moves) {
      best = Math.max(best, search(applyMoveOn(b, m), 'you', depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of moves) {
    best = Math.min(best, search(applyMoveOn(b, m), 'cpu', depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * The CPU at the praça table: looks `depth` plies ahead (material, kings, advancement) and picks among the moves within `slack`
 * of the best, so it plays sensibly without always playing the same game. Captures are mandatory (legalMoves).
 */
export function cpuPickMove(b: Board, opts: { depth?: number; slack?: number; rng?: () => number } = {}): Move | null {
  const moves = legalMoves(b, 'cpu');
  if (!moves.length) return null;
  const depth = opts.depth ?? 4;
  const slack = opts.slack ?? 0.12;
  const rng = opts.rng ?? Math.random;
  const scored = moves.map((m) => ({ m, v: search(applyMoveOn(b, m), 'you', depth - 1, -Infinity, Infinity) }));
  const best = Math.max(...scored.map((x) => x.v));
  const top = scored.filter((x) => x.v >= best - slack);
  return top[Math.floor(rng() * top.length)]!.m;
}
