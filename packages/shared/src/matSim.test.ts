/**
 * Tatame v2 balance: whole matches against the partner AI, on fixed seeds.
 * A player who reads the telegraph and grip-fights must beat one who always takes the biggest percent,
 * and the partner itself must grip-fight (grips, then the throw they open), not just shoot.
 */
import { describe, expect, it } from 'vitest';
import { PARTNERS, type Belt } from './academia.js';
import { mulberry32 } from './meveum.js';
import {
  botCommit,
  botMoves,
  isSubmission,
  matEffect,
  matLegalMoves,
  matMeter,
  matOdds,
  matStyle,
  newMat,
  planBot,
  resolveMat,
  type MatMoveId,
  type MatState,
  type MatStyle,
} from './matFight.js';

type Policy = (st: MatState, belt: Belt, allowed: readonly MatMoveId[], foe: readonly MatMoveId[]) => MatMoveId;
type Partner = (typeof PARTNERS)[number];

/** "Always the biggest percent": the scoring move (or finish) with the best odds, else the best odds of anything but Hold. */
const greedy: Policy = (st, belt, allowed) => {
  const legal = matLegalMoves(st, 'you', allowed).filter((id) => id !== 'hold');
  if (!legal.length) return 'hold';
  const pct = (id: MatMoveId) => matOdds(st, 'you', id, belt).percent;
  const scoring = legal.filter((id) => isSubmission(id) || (matEffect(st, 'you', id)?.points ?? 0) > 0);
  const pool = scoring.length ? scoring : legal;
  return pool.reduce((a, b) => (pct(b) > pct(a) ? b : a));
};

/** The board from your seat: points, advantages, the meter, and a win or a loss. */
const seat = (st: MatState): number => {
  if (st.over) return st.winner === 'you' ? 12 : st.winner === 'them' ? -12 : 0;
  return (st.points.you - st.points.them) * 1.2 + (st.adv.you - st.adv.them) * 0.45 + matMeter(st) / 22;
};

/** A player who reads the telegraph: every move is weighed against the partner's shown plan (which it keeps unless broken). */
const reader =
  (style: MatStyle): Policy =>
  (st, belt, allowed, foe) => {
    const plan = planBot(st, belt, foe, style, allowed);
    let best: MatMoveId = 'hold';
    let bestV = -Infinity;
    for (const id of matLegalMoves(st, 'you', allowed)) {
      const hit = resolveMat(st, 'you', id, 0, belt);
      const p = hit.percent / 100;
      const outs: [number, MatState][] = [[p, hit.state]];
      if (id !== 'hold' && p < 1) outs.push([1 - p, resolveMat(st, 'you', id, 0.99999, belt).state]);
      let v = 0;
      for (const [w, s] of outs) {
        if (s.over || s.actor !== 'them') {
          v += w * seat(s);
          continue;
        }
        const reply = botCommit(s, plan, belt, foe, style, allowed).move;
        const rh = resolveMat(s, 'them', reply, 0, belt, false, style.edge);
        const rp = rh.percent / 100;
        const rm = reply === 'hold' || rp >= 1 ? null : resolveMat(s, 'them', reply, 0.99999, belt, false, style.edge);
        v += w * (rp * seat(rh.state) + (rm ? (1 - rp) * seat(rm.state) : 0));
      }
      if (v > bestV + 1e-9) {
        bestV = v;
        best = id;
      }
    }
    return best;
  };

/** One match on the server's loop: the partner telegraphs during your turn, then commits unless your move broke the plan. */
function play(seed: number, policy: Policy, partner: Partner, belt: Belt = 'branca', log?: string[]): MatState {
  const rng = mulberry32(seed);
  const style = matStyle(partner);
  const theirs = botMoves(belt, belt);
  const yours = botMoves(belt, belt);
  let st = newMat();
  let plan: ReturnType<typeof planBot> | null = null;
  for (let guard = 0; guard < 40 && !st.over; guard++) {
    if (st.actor === 'you') {
      plan = planBot(st, belt, theirs, style, yours);
      const id = policy(st, belt, yours, theirs);
      st = resolveMat(st, 'you', id, rng(), belt).state;
      log?.push(`you:${id}`);
    } else {
      const id = botCommit(st, plan, belt, theirs, style, yours).move;
      st = resolveMat(st, 'them', id, rng(), belt, false, style.edge).state;
      log?.push(`them:${id}`);
    }
  }
  return st;
}

const winRate = (n: number, policy: Policy, partner: Partner, log?: string[]) => {
  let wins = 0;
  for (let i = 0; i < n; i++) if (play(1000 + i, policy, partner, 'branca', log).winner === 'you') wins++;
  return wins / n;
};

const mateus = PARTNERS.find((p) => p.id === 'mateus')!;
const felipe = PARTNERS.find((p) => p.id === 'felipe')!;
const helena = PARTNERS.find((p) => p.id === 'helena')!;

describe('tatame v2 simulation', () => {
  it('reading the telegraph and grip-fighting beats always taking the biggest percent', () => {
    // the starting partners by a clear margin; the precise one (Helena) at least not worse
    for (const p of [mateus, felipe]) {
      const read = winRate(100, reader(matStyle(p)), p);
      const big = winRate(100, greedy, p);
      expect(read, p.id).toBeGreaterThan(big + 0.08);
    }
    expect(winRate(100, reader(matStyle(helena)), helena)).toBeGreaterThan(winRate(100, greedy, helena));
  }, 120_000);

  it('the partner grip-fights: grips, the throws they open, and the answers all show up', () => {
    const log: string[] = [];
    winRate(60, reader(matStyle(mateus)), mateus, log);
    winRate(60, greedy, mateus, log);
    const count = (...ks: string[]) => log.filter((x) => ks.includes(x)).length;
    expect(count('them:collar_tie', 'them:sleeve_grip')).toBeGreaterThan(40);
    expect(count('them:hip_throw', 'them:collar_drag', 'them:body_lock', 'them:double_leg')).toBeGreaterThan(20);
    expect(count('them:posture', 'them:sprawl')).toBeGreaterThan(5);
    expect(count('you:posture', 'you:sprawl')).toBeGreaterThan(5);
  }, 120_000);

  it('a match stays short: at most ten moves', () => {
    const st = play(7, greedy, mateus);
    expect(st.over).toBe(true);
    expect(st.turnsUsed).toBeLessThanOrEqual(10);
  });
});
