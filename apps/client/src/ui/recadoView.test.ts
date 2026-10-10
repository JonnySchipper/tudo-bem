import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, TUTORIAL_STEPS, recadoById, type PrivateProfile, type RecadoActiveView } from '@tudobem/shared';
import {
  TRACKER_MAX,
  advancedKeys,
  bagView,
  dayProgress,
  finishedRecados,
  giveOptions,
  heartUps,
  heartsView,
  journalView,
  npcMarkers,
  offerFrom,
  recadoFocus,
  trackerEntries,
  tutorialAdvanced,
  tutorialPending,
  type RecadoBoard,
} from './recadoView';

const tut = (n: number): PrivateProfile['tutorial'] => Object.fromEntries(TUTORIAL_STEPS.map((s, i) => [s.id, i < n])) as PrivateProfile['tutorial'];
const profile = (over: Partial<PrivateProfile> = {}): PrivateProfile =>
  ({ id: 'p', name: 'Ana', pronoun: 'ela', appearance: DEFAULT_APPEARANCE, nameplate: 'verde', coins: 0, hats: [], hat: null, furniture: {}, apartment: [], parrotOwned: false, parrotEquipped: false, friends: [], tutorial: tut(0), tutorialRewarded: false, createdAt: 0, ...over }) as PrivateProfile;

const active = (id: string, step = 0): RecadoActiveView => {
  const d = recadoById(id)!;
  return { id, giver: d.giver, title: d.title, step, steps: d.steps.length, hint: { pt: `passo ${step}`, en: `step ${step}` } };
};
const board = (over: Partial<RecadoBoard> = {}): RecadoBoard => ({ day: 1, offered: [], active: [], done: [], ...over });

describe('tracker view-model', () => {
  it('starts with Júlia’s welcome chain and its next step, then the active recados, max 3 lines', () => {
    const e = trackerEntries(board({ active: [active('carlos_cafe_pra_nanda'), active('nanda_coxinha'), active('julia_cumprimento_certo')] }), profile({ tutorial: tut(2) }));
    expect(e).toHaveLength(TRACKER_MAX);
    expect(e[0]).toMatchObject({ kind: 'tutorial', giver: 'julia', progress: '2/8' });
    expect(e[0]!.title.pt).toBe('Bem-vindo à Vila Ipê');
    expect(e[0]!.step.pt).toBe(TUTORIAL_STEPS[2]!.pt);
    expect(e.slice(1).map((x) => x.key)).toEqual(['carlos_cafe_pra_nanda', 'nanda_coxinha']);
  });

  it('shows only recados once the welcome chain is finished and paid', () => {
    const done = profile({ tutorial: tut(8), tutorialRewarded: true });
    expect(tutorialPending(done)).toBe(false);
    const e = trackerEntries(board({ active: [active('carlos_manha_de_entregas', 2)] }), done);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ kind: 'recado', progress: '3/4', step: { pt: 'passo 2' } });
    expect(trackerEntries(board(), done)).toEqual([]);
    // all steps done but the bonus not paid yet: the chain stays (one last line)
    expect(tutorialPending(profile({ tutorial: tut(8), tutorialRewarded: false }))).toBe(true);
  });

  it('is empty without a profile or board', () => {
    expect(trackerEntries(null, null)).toEqual([]);
  });
});

describe('what just happened', () => {
  it('detects a step done and a recado finished from two boards', () => {
    const a = board({ active: [active('carlos_cafe_pra_nanda', 0), active('nanda_coxinha', 1)] });
    const b = board({ active: [active('carlos_cafe_pra_nanda', 1)], done: ['nanda_coxinha'] });
    expect(advancedKeys(a, b).sort()).toEqual(['carlos_cafe_pra_nanda', 'nanda_coxinha']);
    expect(finishedRecados(a, b).map((d) => d.id)).toEqual(['nanda_coxinha']);
    expect(advancedKeys(null, b)).toEqual([]);
    expect(finishedRecados(b, b)).toEqual([]);
  });

  it('detects tutorial progress', () => {
    expect(tutorialAdvanced(tut(1), tut(2))).toBe(true);
    expect(tutorialAdvanced(tut(2), tut(2))).toBe(false);
    expect(tutorialAdvanced(null, tut(2))).toBe(false);
  });
});

describe('hearts rendering data', () => {
  it('10 points per heart, with progress toward the next', () => {
    expect(heartsView(undefined)).toMatchObject({ hearts: 0, next: 0, short: '♥ 0' });
    expect(heartsView(34)).toMatchObject({ hearts: 3, short: '♥ 3' });
    expect(heartsView(34).next).toBeCloseTo(0.4);
    expect(heartsView(34).row).toBe('♥♥♥♡♡♡♡♡♡♡');
    expect(heartsView(100)).toMatchObject({ hearts: 10, next: 1 });
    expect(heartsView(250).hearts).toBe(10);
  });

  it('a heart-up is a whole-heart increase between two pushes (never on the first push)', () => {
    expect(heartUps({ nanda: 18 }, { nanda: 21 })).toEqual([{ npc: 'nanda', hearts: 2 }]);
    expect(heartUps({ nanda: 11 }, { nanda: 19 })).toEqual([]);
    expect(heartUps({ carlos: 5 }, { carlos: 5, julia: 12 })).toEqual([{ npc: 'julia', hearts: 1 }]);
    expect(heartUps(null, { nanda: 50 })).toEqual([]);
  });
});

describe('talking to an NPC', () => {
  const offer = (id: string) => {
    const d = recadoById(id)!;
    return { id, giver: d.giver, title: d.title, ask: d.ask, reward: d.reward };
  };

  it('a giver offers one of their own recados, skips declined ones and offers nothing when three are active', () => {
    const b = board({ offered: [offer('nanda_coxinha'), offer('carlos_cafe_pra_nanda'), offer('nanda_um_oi_pro_carlos')] });
    expect(offerFrom(b, 'nanda')?.id).toBe('nanda_coxinha');
    expect(offerFrom(b, 'nanda', new Set(['nanda_coxinha']))?.id).toBe('nanda_um_oi_pro_carlos');
    expect(offerFrom(b, 'carlos')?.ask.pt).toBe(recadoById('carlos_cafe_pra_nanda')!.ask.pt);
    expect(offerFrom(b, 'julia')).toBeNull();
    expect(offerFrom({ ...b, active: [active('julia_cumprimento_certo'), active('graca_pao_pra_julia'), active('carlos_agua_pra_julia')] }, 'nanda')).toBeNull();
    expect(offerFrom(null, 'nanda')).toBeNull();
  });

  it('the give chip appears only for an active entregar step, for that NPC, with the item in the bag', () => {
    const b = board({ active: [active('carlos_cafe_pra_nanda', 1)] });
    expect(giveOptions(b, { cafe_com_leite: 1 }, 'nanda')).toEqual([{ itemId: 'cafe_com_leite', qty: 1, name: { pt: 'café com leite', en: 'coffee with milk' }, recadoId: 'carlos_cafe_pra_nanda' }]);
    expect(giveOptions(b, {}, 'nanda')).toEqual([]); // not in the bag
    expect(giveOptions(b, { cafe_com_leite: 1 }, 'julia')).toEqual([]); // wrong NPC
    expect(giveOptions(board({ active: [active('carlos_cafe_pra_nanda', 0)] }), { cafe_com_leite: 1 }, 'nanda')).toEqual([]); // still on the pedir step
    // Dona Graça stands in for Seu Carlos at the counter (D12)
    const g = board({ active: [active('carlos_manha_de_entregas', 1)] });
    expect(giveOptions(g, { pao_na_chapa: 1 }, 'julia')[0]?.itemId).toBe('pao_na_chapa');
  });
});

describe('journal view-model', () => {
  it('lists active, offered, done, the bag with names and the five friends with hearts', () => {
    const p = profile({ tutorial: tut(3), bag: { cafe_com_leite: 2, nope: 4 }, bond: { carlos: 25, nanda: 61 } });
    const j = journalView(board({ active: [active('nanda_coxinha')], done: ['carlos_cafe_pra_nanda'] }), p);
    expect(j.tutorial?.steps.filter((s) => s.done)).toHaveLength(3);
    expect(j.active[0]).toMatchObject({ id: 'nanda_coxinha', reward: { rv: 12, bond: 4 } });
    expect(j.done.map((d) => d.id)).toEqual(['carlos_cafe_pra_nanda']);
    expect(j.bag).toEqual([{ itemId: 'cafe_com_leite', name: { pt: 'café com leite', en: 'coffee with milk' }, qty: 2 }]);
    expect(bagView({})).toEqual([]);
    expect(j.friends.map((f) => [f.npc, f.hearts.hearts]).slice(0, 5)).toEqual([['carlos', 2], ['graca', 0], ['nanda', 6], ['julia', 0], ['prof', 0]]);
    // the feira vendors are friends too (Tia Lu gives recados)
    expect(j.friends.map((f) => f.npc)).toEqual(expect.arrayContaining(['tia_lu', 'ze', 'chico', 'rosa']));
  });
});

describe('errands you can see before talking to anyone', () => {
  const offerOf = (id: string) => {
    const d = recadoById(id)!;
    return { id, giver: d.giver, title: d.title, ask: d.ask, reward: d.reward };
  };
  const done = profile({ tutorial: tut(8), tutorialRewarded: true });

  it('lists today’s offers in the tracker after the active ones, with where the giver is', () => {
    const b = board({ active: [active('carlos_cafe_pra_nanda', 1)], offered: [offerOf('nanda_coxinha'), offerOf('julia_cumprimento_certo'), offerOf('graca_pao_pra_julia')] });
    const e = trackerEntries(b, done, 10 * 60);
    expect(e.map((x) => x.kind)).toEqual(['recado', 'offer', 'offer']);
    expect(e[0]!.where?.pt).toBe('Praça Central');
    expect(e[1]).toMatchObject({ key: 'offer:nanda_coxinha', giver: 'nanda', progress: '!' });
    expect(e[1]!.step.pt).toBe('Nanda quer te pedir um favor!');
    expect(e[1]!.where?.pt).toBe('Praça Central');
    // no minute: no where-line
    expect(trackerEntries(b, done)[1]!.where).toBeNull();
  });

  it('shows no offers once three errands are active (nothing could be accepted)', () => {
    const b = board({ active: [active('carlos_cafe_pra_nanda'), active('nanda_coxinha'), active('julia_cumprimento_certo')], offered: [offerOf('nanda_um_oi_pro_carlos')] });
    expect(trackerEntries(b, done).every((x) => x.kind === 'recado')).toBe(true);
    expect(npcMarkers(b).get('nanda')).toBeUndefined();
  });

  it('marks givers with "!" and the current step’s NPC with "?" (the step wins; Dona Graça stands in at the counter)', () => {
    const b = board({ active: [active('nanda_coxinha', 0)], offered: [offerOf('carlos_cafe_pra_nanda'), offerOf('julia_cumprimento_certo')] });
    const m = npcMarkers(b);
    expect(m.get('julia')).toBe('offer');
    expect(m.get('carlos')).toBe('step');
    expect(m.get('graca')).toBe('step');
    expect(npcMarkers(board({ active: [active('nanda_coxinha', 1)] })).get('nanda')).toBe('step');
    // turned down this session: no "!"
    expect(npcMarkers(b, new Set(['julia_cumprimento_certo'])).has('julia')).toBe(false);
    expect(npcMarkers(null).size).toBe(0);
  });

  it('focuses the arrows on the first active errand’s current step', () => {
    expect(recadoFocus(board(), 600)).toBeNull();
    const f = recadoFocus(board({ active: [active('carlos_cafe_pra_nanda', 1), active('nanda_coxinha')] }), 10 * 60)!;
    expect(f).toMatchObject({ id: 'carlos_cafe_pra_nanda', room: 'praca', npc: 'nanda', away: false });
    expect(recadoFocus(board({ active: [active('carlos_cafe_pra_nanda', 1)] }), 22 * 60)!.away).toBe(true);
  });

  it('counts the day toward the Vizinho do dia bonus', () => {
    expect(dayProgress(board({ done: ['a'] }))).toMatchObject({ done: 1, goal: 3, paid: false });
    expect(dayProgress(board({ done: ['a', 'b', 'c', 'd'], bonus: true }))).toMatchObject({ done: 3, paid: true });
  });
});
