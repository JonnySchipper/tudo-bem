/**
 * Tatame v3 balance: whole matches against the partner AI, on fixed seeds (TATAME-V3.md §I).
 *
 * A simulated player has two numbers:
 *  - `tapAccuracy`: the chance to press the button Bia called (or the right defense);
 *  - `reactionShare`: how long the player takes to press it, as a share of a new white belt's command window (2.2 s). Each tap takes
 *    reactionShare × 2.2 s × a jitter of 0.5–1.5, so a tap is late when the window is shorter than that, and Perfeito when it is
 *    inside 45% of the window. The windows shrink with the belt and the partner's speed; the player does not get faster.
 * The player picks from the four cards the server offers (and Segurar) with the same two-ply read the partner uses, from its own
 * seat. From blue belt Bia no longer calls the defense: the player taps the defense the telegraph implies, so a feint beats them.
 * Weak, average and strong players are 0.6 / 0.8 / 0.95 on both numbers' scales (`player(skill)`).
 */
import { describe, expect, it } from 'vitest';
import { PARTNERS, type Belt, type PartnerProfile } from './academia.js';
import { mulberry32 } from './meveum.js';
import {
  CMD_WINDOW_MS,
  PERFECT_SHARE,
  START_RATES,
  botAi,
  botCommit,
  botMoves,
  braceBlocks,
  chainFor,
  chainWindows,
  defWindowMs,
  defenseOf,
  feintMove,
  fightMoves,
  movesThrough,
  matStyle,
  matValues,
  newMat,
  offerCards,
  partnerClean,
  planBot,
  resolveMat,
  saiCount,
  SAI_SHARE,
  shouldFeint,
  withCombos,
  type BotCtx,
  type MatAi,
  type MatMoveId,
  type MatRates,
  type MatState,
} from './matFight.js';

export interface SimPlayer {
  tapAccuracy: number;
  reactionShare: number;
}

/**
 * A player of this skill: 0.6 weak, 0.8 average, 0.95 strong. The skill is mostly knowing the words (accuracy); reaction speed only
 * improves a little with it: 0.80, 0.75, 0.71 of a white-belt window on average (about 1.6–1.8 s, jittered ×0.5–1.5).
 */
export const player = (skill: number): SimPlayer => ({ tapAccuracy: skill, reactionShare: 0.95 - 0.25 * skill });

const LEVEL: Record<Belt, number> = { branca: 0, azul: 4, roxa: 8, marrom: 12, preta: 16 };

/** A chain is a learned sequence (the player knows what comes next): its taps take half a reaction. A defense is a full reaction. */
/** From blue belt (level 4) the chains are drilled: a chain tap takes this share of a reaction. A new white belt reacts to every call. */
export const ANTICIPATION = 0.6;

/** One tap: the right button, then in time, then inside the Perfeito share. */
function tap(p: SimPlayer, windowMs: number, rng: () => number, chain = false, level = 0): 'perfeito' | 'boa' | 'miss' {
  if (rng() >= p.tapAccuracy) return 'miss';
  const rt = p.reactionShare * CMD_WINDOW_MS * (chain && level >= 4 ? ANTICIPATION : 1) * (0.5 + rng());
  if (rt > windowMs) return 'miss';
  return rt <= windowMs * PERFECT_SHARE ? 'perfeito' : 'boa';
}

/** The chance a tap of this window lands, for the player's own two-ply read (it knows itself). */
function tapP(p: SimPlayer, windowMs: number, chain = false, level = 0): number {
  const j = windowMs / (p.reactionShare * CMD_WINDOW_MS * (chain && level >= 4 ? ANTICIPATION : 1));
  return p.tapAccuracy * Math.max(0, Math.min(1, j - 0.5));
}

/** Running rate with a prior of two observations at the starting value. */
const rate = (start: number, hits: number, n: number) => (start * 2 + hits) / (2 + n);

export interface SimOut {
  st: MatState;
  log: string[];
  perfect: number;
  feints: number;
}

/** One match on the server's loop: pick from the cards, run the chain, the partner's turn with a defense beat. */
export function simMatch(seed: number, p: SimPlayer, partner: PartnerProfile, belt: Belt = 'branca', first = false): SimOut {
  const rng = mulberry32(seed);
  const style = matStyle(partner);
  const level = LEVEL[belt];
  const theirs = botMoves(belt, belt);
  // a player fresh on this belt: the belt's award and everything before it
  const yours = fightMoves({ belt, unlocked: movesThrough(belt, 0), opponentBelt: belt });
  const seen = { chains: 0, landed: 0, attacks: 0, blocked: 0 };
  const rates = (): MatRates => ({ chain: rate(START_RATES.chain, seen.landed, seen.chains), block: rate(START_RATES.block, seen.blocked, seen.attacks) });
  const ctx = (): BotCtx => ({ allowed: theirs, foeAllowed: yours, style, rates: rates() });
  // the player's own read: its chains land at its tap chance per command, the partner's at clean × (1 − its defense)
  const me: MatAi = {
    allowed: { you: withCombos(yours), them: withCombos(theirs) },
    style: { accuracy: p.tapAccuracy, speed: 0.5, aggression: 0.5, defense: 0.5 },
    odds: (st, actor, id) => {
      if (id === 'hold') return { land: 1, stopped: 0 };
      if (braceBlocks(st, actor, id)) return { land: 0, stopped: 1 };
      if (actor === 'you') {
        const cmds = chainFor(st, 'you', id, partner.defense);
        return { land: chainWindows(cmds, id, level, first).reduce((a, w) => a * tapP(p, w, true, level), 1), stopped: 0 };
      }
      const clean = partnerClean(style.accuracy, chainFor(st, 'them', id).length);
      const d = defenseOf(st, 'them', id);
      if (!d) return { land: clean, stopped: 0 };
      const w = defWindowMs(level, style.speed, st.grips.you.sleeve, first) * (d === 'sai' ? SAI_SHARE : 1);
      const def = Math.pow(tapP(p, w), d === 'sai' ? saiCount(style.defense) : 1);
      return { land: clean * (1 - def), stopped: clean * def };
    },
  };
  const log: string[] = [];
  let st: MatState = newMat();
  let plan: ReturnType<typeof planBot> | null = null;
  let feint: MatMoveId | null = null;
  let perfect = 0;
  let feints = 0;
  for (let guard = 0; guard < 40 && !st.over; guard++) {
    if (st.actor === 'you') {
      plan = planBot(st, ctx());
      feint = shouldFeint(level, style.aggression, rng()) ? feintMove(st, plan, ctx()) : null;
      const offered = new Set<MatMoveId>(['hold', ...offerCards(st, yours, plan, partner.defense).map((c) => c.move)]);
      const values = matValues(st, 'you', me).filter(([id]) => offered.has(id));
      const id = values.reduce((a, b) => (b[1] > a[1] + 1e-9 ? b : a), ['hold', -Infinity] as [MatMoveId, number])[0];
      if (id === 'hold') {
        st = resolveMat(st, 'you', 'hold', true).state;
        log.push('you:hold');
        continue;
      }
      if (braceBlocks(st, 'you', id)) {
        st = resolveMat(st, 'you', id, false).state;
        log.push(`you:${id}:braced`);
        continue;
      }
      const cmds = chainFor(st, 'you', id, partner.defense);
      const windows = chainWindows(cmds, id, level, first);
      let landed = true;
      let allPerfect = true;
      for (const w of windows) {
        const g = tap(p, w, rng, true, level);
        if (g === 'miss') {
          landed = false;
          break;
        }
        if (g === 'perfeito') perfect++;
        else allPerfect = false;
      }
      seen.chains++;
      if (landed) seen.landed++;
      st = resolveMat(st, 'you', id, landed, { perfect: landed && allPerfect }).state;
      log.push(`you:${id}:${landed ? 'hit' : 'miss'}`);
    } else {
      const committed = feint && st.actor === 'them' && matValues(st, 'them', botAi(ctx())).some(([m]) => m === feint) ? feint : botCommit(st, plan, ctx()).move;
      const feinted = committed === feint && feint !== null;
      if (feinted) feints++;
      const id = committed;
      feint = null;
      if (id === 'hold') {
        st = resolveMat(st, 'them', 'hold', true).state;
        log.push('them:hold');
        continue;
      }
      if (braceBlocks(st, 'them', id)) {
        st = resolveMat(st, 'them', id, false).state;
        log.push(`them:${id}:braced`);
        continue;
      }
      const clean = partnerClean(style.accuracy, chainFor(st, 'them', id).length);
      if (rng() >= clean) {
        st = resolveMat(st, 'them', id, false).state;
        log.push(`them:${id}:botch`);
        continue;
      }
      const d = defenseOf(st, 'them', id);
      if (!d) {
        st = resolveMat(st, 'them', id, true).state;
        log.push(`them:${id}:hit`);
        continue;
      }
      // white belt: Bia calls it. From blue: the player taps what the telegraph implied, so a feint is answered wrong.
      const shown = plan ? defenseOf({ ...st }, 'them', plan.move) : d;
      const wrong = level >= 4 && feinted && shown !== d;
      const w = defWindowMs(level, style.speed, st.grips.you.sleeve, first) * (d === 'sai' ? SAI_SHARE : 1);
      let ok = !wrong;
      for (let i = 0; ok && i < (d === 'sai' ? saiCount(style.defense) : 1); i++) ok = tap(p, w, rng) !== 'miss';
      seen.attacks++;
      if (ok) seen.blocked++;
      st = resolveMat(st, 'them', id, !ok, { defended: ok }).state;
      log.push(`them:${id}:${ok ? 'defended' : 'hit'}`);
    }
  }
  return { st, log, perfect, feints };
}

const partner = (id: string) => PARTNERS.find((x) => x.id === id)!;

export function winRate(n: number, p: SimPlayer, who: PartnerProfile, belt: Belt = 'branca', first = false, seed0 = 1000) {
  let wins = 0;
  let subs = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const r = simMatch(seed0 + i, p, who, belt, first);
    if (r.st.winner === 'you') wins++;
    if (r.st.winner === 'draw') draws++;
    if (r.st.reason === 'submission') subs++;
  }
  return { wins: wins / n, subs: subs / n, draws: draws / n };
}

const mateus = partner('mateus');
const rafael = partner('rafael');

describe('tatame v3 simulation (TATAME-V3 §I targets)', () => {
  it('a new white belt at 0.8 beats Mateus 45–60% of the time; a 0.6 player still wins 25–35%', () => {
    const avg = winRate(300, player(0.8), mateus);
    const weak = winRate(300, player(0.6), mateus);
    expect(avg.wins).toBeGreaterThanOrEqual(0.45);
    expect(avg.wins).toBeLessThanOrEqual(0.6);
    expect(weak.wins).toBeGreaterThanOrEqual(0.25);
    expect(weak.wins).toBeLessThanOrEqual(0.35);
  }, 120_000);

  it('a 0.95 player beats Rafael (blue belt, feints) under 70% of the time, and a strong player beats Mateus most of the time', () => {
    expect(winRate(300, player(0.95), rafael, 'azul').wins).toBeLessThan(0.7);
    expect(winRate(200, player(0.95), mateus).wins).toBeGreaterThan(0.75);
  }, 120_000);

  it('the finish is reachable: a good player finishes some matches, and the partner finishes some too', () => {
    const r = winRate(200, player(0.8), mateus);
    expect(r.subs).toBeGreaterThan(0.1);
    let theirs = 0;
    for (let i = 0; i < 200; i++) {
      const m = simMatch(5000 + i, player(0.6), mateus);
      if (m.st.winner === 'them' && m.st.reason === 'submission') theirs++;
    }
    expect(theirs).toBeGreaterThan(5);
  }, 120_000);

  it('a match is sixteen moves at most, and the arc shows up: grips, throws, passes and finishes are all played', () => {
    const log: string[] = [];
    for (let i = 0; i < 80; i++) {
      const m = simMatch(7000 + i, player(0.8), mateus, 'branca');
      expect(m.st.turnsUsed).toBeLessThanOrEqual(16);
      log.push(...m.log);
    }
    const count = (re: RegExp) => log.filter((x) => re.test(x)).length;
    expect(count(/^(you|them):(collar_tie|sleeve_grip)/)).toBeGreaterThan(0);
    expect(count(/^(you|them):(double_leg|body_lock|hip_throw|collar_drag)/)).toBeGreaterThan(40);
    expect(count(/^(you|them):passar/)).toBeGreaterThan(30);
    expect(count(/^(you|them):armbar/)).toBeGreaterThan(10);
    expect(count(/:defended$/)).toBeGreaterThan(10);
    expect(count(/:botch$/)).toBeGreaterThan(5);
  }, 120_000);

  it('reports the win rates per partner (weak / average / strong)', () => {
    const rows: string[] = [];
    for (const [id, belt] of [
      ['mateus', 'branca'],
      ['felipe', 'branca'],
      ['helena', 'branca'],
      ['daniel', 'branca'],
      ['rafael', 'azul'],
    ] as const) {
      const cells = [0.6, 0.8, 0.95].map((s) => {
        const r = winRate(120, player(s), partner(id), belt);
        return `${s}: ${(r.wins * 100).toFixed(0)}% (finish ${(r.subs * 100).toFixed(0)}%)`;
      });
      rows.push(`${id}@${belt}  ${cells.join('  ')}`);
    }
    if (process.env.TB_SIM_REPORT) console.log(rows.join('\n'));
    expect(rows).toHaveLength(5);
  }, 120_000);
});
