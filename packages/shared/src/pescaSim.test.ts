import { describe, expect, it } from 'vitest';
import {
  PESCA_FIGHT,
  biteWindow,
  parsePescaEvents,
  pescaJudge,
  pescaRoll,
  pescaWeights,
  pinnedRoll,
  playFight,
  runAt,
  type PescaCast,
  type PescaEvent,
  type PescaRoll,
} from './pescaSim.js';
import { FISH, FISH_IDS, POOLS, isFishId, sizeWord, isTrophy, type FishId } from './fish.js';

const cast = (o: Partial<PescaCast> = {}): PescaCast => ({ seed: 7, water: 'praia', weather: 'sol', minute: 600, power: 0.5, firstCatches: 5, ...o });

/** The three players of the plan (2.3): the holds they make after the hook, given the roll they face. */
const PLAYERS = {
  // reacts 400 ms late and never lets go
  weak: (_r: PescaRoll) => (t: number) => t >= 400,
  // lets go 250 ms into each run, takes the line again 250 ms after it
  average: (r: PescaRoll) => (t: number) => t >= 250 && !r.runs.some((x) => t >= x.at + 250 && t < x.at + x.len + 250),
  // reads the rod's dip (the telegraph) and lets go as the run starts
  strong: (r: PescaRoll) => (t: number) => !runAt(r, t) && !r.runs.some((x) => t >= x.at - 50 && t < x.at),
};

function rates(player: keyof typeof PLAYERS, water: PescaCast['water'], fish: FishId, n = 400) {
  let seen = 0, caught = 0, snapped = 0;
  for (let seed = 1; seen < n && seed < 200_000; seed++) {
    const roll = pescaRoll(cast({ seed, water }));
    if (roll.catch !== fish) continue;
    seen++;
    const end = playFight(roll, PLAYERS[player](roll));
    if (end.done === 'caught') caught++;
    if (end.done === 'snapped') snapped++;
  }
  return { land: caught / seen, snap: snapped / seen };
}

describe('pescaRoll (PRAIA-PLAN.md 2.3)', () => {
  it('is deterministic per seed and stays inside the species', () => {
    expect(pescaRoll(cast({ seed: 42 }))).toEqual(pescaRoll(cast({ seed: 42 })));
    for (let seed = 1; seed < 300; seed++) {
      const r = pescaRoll(cast({ seed, water: 'alto_mar' }));
      expect(POOLS.alto_mar.some((p) => p.c === r.catch)).toBe(true);
      expect(r.biteAtMs).toBeGreaterThanOrEqual(2000);
      expect(r.biteAtMs).toBeLessThanOrEqual(9000);
      for (const nb of r.nibblesAtMs) expect(nb).toBeLessThan(r.biteAtMs);
      if (isFishId(r.catch) && r.catch !== 'baiacu') {
        const d = FISH[r.catch];
        expect(r.cm).toBeGreaterThanOrEqual(d.cm[0]);
        expect(r.cm).toBeLessThanOrEqual(d.cm[1]);
        expect(r.runs.length).toBeGreaterThan(0);
      }
    }
  });

  it('weights answer to the rain, the hour and the cast distance', () => {
    const w = (o: Partial<PescaCast>, c: string) => pescaWeights(cast(o)).find((p) => p.c === c)!.w;
    expect(w({ weather: 'chuva' }, 'bagre')).toBeGreaterThan(w({ weather: 'sol' }, 'bagre'));
    expect(w({ minute: 23 * 60 }, 'sardinha')).toBeGreaterThan(w({ minute: 12 * 60 }, 'sardinha'));
    expect(w({ water: 'remo', minute: 6 * 60 }, 'robalo')).toBeGreaterThan(w({ water: 'remo', minute: 12 * 60 }, 'robalo'));
    expect(w({ water: 'pesca', power: 1 }, 'garoupa')).toBeGreaterThan(w({ water: 'pesca', power: 0 }, 'garoupa'));
  });

  it('pins a short, sure roll for the e2e (TB_TEST_PESCA)', () => {
    expect(pinnedRoll('praia')).toMatchObject({ catch: 'bagre', biteAtMs: 1500, runs: [] });
    expect(pinnedRoll('remo')).toMatchObject({ catch: 'robalo', biteAtMs: 1500 });
  });
});

describe('the fight: weak, average and strong holders (PRAIA-PLAN.md 2.3)', () => {
  it('a weak holder (late, never lets go) snaps most snooks and lands nearly every catfish', () => {
    const robalo = rates('weak', 'remo', 'robalo');
    expect(robalo.snap).toBeGreaterThan(0.45);
    expect(robalo.snap).toBeLessThan(0.85);
    expect(rates('weak', 'praia', 'bagre').land).toBeGreaterThanOrEqual(0.9);
  });

  it('an average holder lands three in four of everything but the trophies', () => {
    for (const [water, fish] of [['praia', 'sardinha'], ['remo', 'robalo'], ['pesca', 'garoupa'], ['alto_mar', 'atum'], ['lagoa', 'tambaqui']] as const)
      expect(rates('average', water, fish, 200).land, fish).toBeGreaterThanOrEqual(0.75);
  });

  it('a strong holder lands more than half the marlins; an average one hardly ever does', () => {
    const strong = rates('strong', 'alto_mar', 'marlim', 200).land;
    expect(strong).toBeGreaterThan(0.45);
    expect(strong).toBeLessThan(0.8);
    expect(rates('average', 'alto_mar', 'marlim', 200).land).toBeLessThan(strong);
  });

  it('fights last from about 3 to 14 seconds', () => {
    for (let seed = 1; seed < 400; seed++) {
      const r = pescaRoll(cast({ seed, water: 'alto_mar' }));
      if (r.runs.length) expect(r.fightMaxMs).toBeLessThanOrEqual(14_000);
    }
  });
});

describe('pescaJudge: the server replays the taps and holds', () => {
  const roll: PescaRoll = { catch: 'robalo', cm: 60, biteAtMs: 3000, nibblesAtMs: [1500], runs: [{ at: 500, len: 600, pull: 1 }], fightMaxMs: 9000 };
  const hookAt = 3200;
  /** hold from the hook, let go through the run */
  const good: PescaEvent[] = [
    { k: 'hook', ms: hookAt },
    { k: 'hold', down: true, ms: hookAt },
    { k: 'hold', down: false, ms: hookAt + 480 },
    { k: 'hold', down: true, ms: hookAt + 1150 },
  ];

  it('a well-played fight is caught, with its size as a word', () => {
    const o = pescaJudge(cast(), good, 20_000, roll);
    expect(o).toMatchObject({ kind: 'caught', fish: 'robalo', cm: 60, sizeWord: sizeWord(FISH.robalo, 60) });
  });

  it('early, late, snapped, escaped and quit', () => {
    expect(pescaJudge(cast(), [{ k: 'hook', ms: 1500 }], 20_000, roll).kind).toBe('early');
    expect(pescaJudge(cast(), [{ k: 'hook', ms: 3000 + biteWindow(cast()) + 50 }], 20_000, roll).kind).toBe('late');
    expect(pescaJudge(cast(), [], 20_000, roll).kind).toBe('late');
    const hard: PescaRoll = { ...roll, runs: [{ at: 100, len: 3000, pull: 1.6 }] };
    expect(pescaJudge(cast(), [{ k: 'hook', ms: hookAt }, { k: 'hold', down: true, ms: hookAt }], 20_000, hard).kind).toBe('snapped');
    expect(pescaJudge(cast(), [{ k: 'hook', ms: hookAt }], 20_000, roll).kind).toBe('escaped');
    expect(pescaJudge(cast(), [{ k: 'hook', ms: hookAt }, { k: 'quit', ms: hookAt + 100 }], 20_000, roll).kind).toBe('quit');
  });

  it('junk comes up at once; the puffer is let go', () => {
    expect(pescaJudge(cast(), [{ k: 'hook', ms: 3100 }], 5000, { ...roll, catch: 'chinelo', runs: [] })).toEqual({ kind: 'junk', junk: 'chinelo' });
    expect(pescaJudge(cast(), [{ k: 'hook', ms: 3100 }], 5000, { ...roll, catch: 'baiacu', runs: [] })).toEqual({ kind: 'released', fish: 'baiacu' });
  });

  it('refuses what a person could not have sent: too fast, out of order, too long, malformed', () => {
    expect(pescaJudge(cast(), good, 3500, roll)).toMatchObject({ kind: 'rejected', reason: 'too_fast' });
    expect(pescaJudge(cast(), [{ k: 'hook', ms: 3200 }, { k: 'hold', down: true, ms: 3100 }], 20_000, roll).kind).toBe('rejected');
    expect(parsePescaEvents(Array.from({ length: PESCA_FIGHT.maxEvents + 1 }, (_, i) => ({ k: 'hold', down: i % 2 === 0, ms: i })))).toBeNull();
    expect(parsePescaEvents([{ k: 'hold', down: 'yes', ms: 1 }])).toBeNull();
    expect(parsePescaEvents([{ k: 'hook', ms: 5 }, { k: 'hook', ms: 2 }])).toBeNull();
    expect(parsePescaEvents([{ k: 'hook', ms: 5 }, { k: 'fish', ms: 6, fish: 'marlim' }])).toBeNull();
    expect(pescaJudge(cast(), null, 20_000, roll).kind).toBe('rejected');
    expect(parsePescaEvents(good)).toEqual(good);
  });

  it('the first three catches get a wider bite window', () => {
    expect(biteWindow({ firstCatches: 0 })).toBe(PESCA_FIGHT.biteWindowFirstMs);
    expect(biteWindow({ firstCatches: 3 })).toBe(PESCA_FIGHT.biteWindowMs);
  });
});

describe('fish.ts (PRAIA-PLAN.md 4.1)', () => {
  it('14 species with Portuguese names and glosses; freshwater only in the lagoa; every sea fish on the deep-sea boat', () => {
    expect(FISH_IDS).toHaveLength(14);
    for (const id of FISH_IDS) {
      const d = FISH[id];
      expect(d.pt && d.en, id).toBeTruthy();
      if (d.water.includes('lagoa')) expect(d.water).toEqual(['lagoa']);
      else expect(d.water, id).toContain('alto_mar');
      for (const w of d.water) expect(POOLS[w].some((p) => p.c === id), `${id} in ${w}`).toBe(true);
      expect(d.sell === 0).toBe(id === 'baiacu');
    }
    expect(['tilapia', 'tambaqui', 'tucunare'].every((id) => FISH[id as FishId].water.join() === 'lagoa')).toBe(true);
  });

  it('size words and trophies follow the range, never a number', () => {
    const d = FISH.robalo;
    expect(sizeWord(d, d.cm[0])).toBe('pequeno');
    expect(sizeWord(d, (d.cm[0] + d.cm[1]) / 2)).toBe('medio');
    expect(sizeWord(d, d.cm[1])).toBe('enorme');
    expect(isTrophy(d, d.cm[1])).toBe(true);
    expect(isTrophy(d, d.cm[0])).toBe(false);
  });

  it('the beach is about half junk and puffers (free, simple, a bit funny)', () => {
    const total = POOLS.praia.reduce((a, p) => a + p.w, 0);
    const silly = POOLS.praia.filter((p) => !isFishId(p.c) || p.c === 'baiacu').reduce((a, p) => a + p.w, 0);
    expect(silly / total).toBeGreaterThan(0.45);
    expect(silly / total).toBeLessThan(0.65);
  });
});
