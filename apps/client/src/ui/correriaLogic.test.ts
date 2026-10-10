import { describe, expect, it } from 'vitest';
import { menuLadder, newShift, shiftAct, shiftAdvance, shiftSnapshot, type CEvent, type CorreriaEnd, type CorreriaSnap } from '@tudobem/shared';
import { cueFor, endModel, frontOf, glossOn, endNext, hud, ladderEnd, ladderNext, modChips, orderMirror, patienceFrac, trayChips } from './correriaLogic';

const shiftAt = (seed: number, level = 0): CorreriaSnap => {
  const sh = newShift({ seed, level, unlocked: [], saturday: false, minute: 540, baker: 'carlos', regulars: [] });
  for (let i = 0; i < 80 && !sh.customers.some((c) => c.state === 'front'); i++) shiftAdvance(sh, 250);
  return shiftSnapshot(sh);
};

describe('the Correria overlay view-model', () => {
  it('glosses are locked on at Verde and follow the preference above it', () => {
    expect(glossOn(0, false)).toBe(true);
    expect(glossOn(1, false)).toBe(false);
    expect(glossOn(1, true)).toBe(true);
    expect(glossOn(3, false)).toBe(false);
  });

  it('the tray reads as counted chips, in the order the items were put on', () => {
    expect(trayChips([])).toEqual([]);
    const chips = trayChips(['pao_na_chapa', 'cafe', 'pao_na_chapa']);
    expect(chips.map((c) => [c.id, c.qty])).toEqual([['pao_na_chapa', 2], ['cafe', 1]]);
    expect(chips[0]!.pt).toBe('pão na chapa');
    expect(chips[0]!.en.length).toBeGreaterThan(2);
  });

  it('the mod chips are an extra-hot pour (🔥 extra quente) plus the bag or plate', () => {
    expect(modChips({ mods: [], pack: null })).toEqual([]);
    expect(modChips({ mods: ['bem_quente'], pack: 'bag' }).map((m) => m.pt)).toEqual(['🔥 extra quente', 'pra viagem']);
    expect(modChips({ mods: [], pack: 'plate' }).map((m) => m.pt)).toEqual(['pra comer aqui']);
  });

  it('a written order that wants extra quente carries the 🔥 tag on the ticket; a listening one keeps it in the voice', () => {
    const f = frontOf(shiftAt(4))!;
    expect(orderMirror(f, 0)!.hot).toBeNull();
    expect(orderMirror({ ...f, hot: true }, 0)!.hot).toEqual({ pt: '🔥 extra quente', en: 'extra hot' });
    expect(orderMirror({ ...f, hot: true, mode: 'listening' }, 3)!.hot).toBeNull();
  });

  it('the order mirror shows a written order, hides a listening one and offers the replay at its price', () => {
    const snap = shiftAt(4);
    const f = frontOf(snap)!;
    const m = orderMirror(f, 0)!;
    expect(m.who).toBe(f.who.name);
    expect(m.hidden).toBe(false);
    expect(m.pt).toBe(f.pt);
    const listening = orderMirror({ ...f, mode: 'listening' }, 3)!;
    expect(listening.hidden).toBe(true);
    expect(listening.pt).not.toBe(f.pt);
    expect(listening.canReplay).toBe(true);
    expect(listening.replayPips).toBe(1);
    expect(orderMirror({ ...f, mode: 'listening', replays: 1 }, 3)!.hidden).toBe(false);
    expect(orderMirror({ ...f, mode: 'listening', replays: 1 }, 3)!.replayPips).toBe(2);
    expect(orderMirror({ ...f, mode: 'listening', replays: 2 }, 3)!.replayPips).toBe(0);
    expect(orderMirror({ ...f, state: 'queue' }, 0)).toBeNull();
    expect(orderMirror(undefined, 0)).toBeNull();
  });

  it('patience runs down between snapshots and never leaves 0..1', () => {
    const c = { patience: 10_000, patienceMax: 20_000, rate: 1 };
    expect(patienceFrac(c, 0)).toBe(0.5);
    expect(patienceFrac(c, 5000)).toBe(0.25);
    expect(patienceFrac(c, 50_000)).toBe(0);
    expect(patienceFrac({ ...c, rate: 0 }, 50_000)).toBe(0.5);
    expect(patienceFrac({ patience: 1, patienceMax: 0, rate: 1 }, 0)).toBe(0);
  });

  it('the HUD labels the wave, the customers done, the combo and the tips in reais', () => {
    const snap = { ...shiftAt(2), wave: 1 };
    snap.stats = { served: 3, perfect: 2, left: 1, points: 55, tips: 7, combo: 2, bestCombo: 2 };
    // a profile's first shift is two waves of nine customers
    expect(hud(snap)).toMatchObject({ wave: 'Onda 2/2', left: '4/9', points: 55, combo: 2, tips: 'R$ 7', level: 'Verde' });
    const later = shiftSnapshot(newShift({ seed: 2, level: 0, unlocked: [], shifts: 1, saturday: false, minute: 540, baker: 'carlos', regulars: [] }));
    expect(hud({ ...later, wave: 1 })).toMatchObject({ wave: 'Onda 2/3', left: '0/15' });
  });

  it('events make the right sound and toast: ding on a serve, a nope on a correction, burnt in red, a flame on an extra-hot pour', () => {
    expect(cueFor({ k: 'pour_ok', item: 'cafe', fill: 0.9, hot: false })).toEqual({ sfx: 'ready' });
    expect(cueFor({ k: 'pour_ok', item: 'cafe', fill: 1.3, hot: true })).toMatchObject({ sfx: 'ready', toast: { pt: '🔥 Café extra quente!', tone: 'good' } });
    expect(cueFor({ k: 'grab', item: 'pao' }).sfx).toBe('grab');
    expect(cueFor({ k: 'serve', id: 1, outcome: 'perfeito', line: { pt: 'Perfeito!', en: 'Perfect!' }, emote: '😋', points: 14, tip: 2, combo: 1, speed: 0.8 })).toMatchObject({ sfx: 'ding', toast: { pt: 'Perfeito!', tone: 'good' } });
    expect(cueFor({ k: 'serve', id: 1, outcome: 'perfeito', line: { pt: 'x', en: 'y' }, emote: '❤️', points: 20, tip: 3, combo: 3, speed: 1 }).sfx).toBe('chain');
    expect(cueFor({ k: 'serve', id: 1, outcome: 'perfeito', line: { pt: 'x', en: 'y' }, emote: '❤️', points: 20, tip: 3, combo: 4, speed: 1 }).sfx).toBe('combo');
    expect(cueFor({ k: 'correct', id: 1, line: { pt: 'Era extra quente!', en: 'It was extra hot!' } })).toMatchObject({ sfx: 'nope', toast: { tone: 'bad' } });
    expect(cueFor({ k: 'chapa_burnt', slot: 0 })).toMatchObject({ sfx: 'pop', toast: { pt: 'Queimou!', tone: 'bad' } });
    expect(cueFor({ k: 'front', id: 1 }).sfx).toBe('slap');
    expect(cueFor({ k: 'chapa_raw', slot: 0 }).toast?.pt).toBe('Ainda está cru!');
    expect(cueFor({ k: 'pour_bad', why: 'spill', fill: 1.4 }).toast?.pt).toBe('Derramou!');
    expect(cueFor({ k: 'pour_bad', why: 'short', fill: 0.3 }).toast?.pt).toBe('Faltou café!');
    const ev: CEvent = { k: 'wave', wave: 1, size: 5, line: { pt: 'Mais uma rodada. Bora!', en: 'Another round. Let’s go!' } };
    expect(cueFor(ev).sfx).toBe('chime');
    expect(cueFor({ k: 'over' })).toEqual({});
  });

  it('the end card model: RV, stars, the new words and one next line (no stat rows, no ladder strip)', () => {
    const end: CorreriaEnd = {
      served: 13, perfect: 9, second: 4, left: 2, points: 210, tips: 21, bestCombo: 5, stars: 2, coins: 17, dailyBlocked: false,
      words: [{ pt: 'coxinha', en: 'coxinha' }], newUnlocks: [{ id: 'chapa2', pt: 'Segunda chapa', en: 'A second grill spot' }], totalStars: 5, level: 1, regulars: ['Nanda'],
      ladder: menuLadder(3),
    };
    const m = endModel(end, { pt: 'Valeu pela ajuda!', en: 'Thanks for the help!' });
    expect(m.big).toBe('+17 RV');
    expect(m.stars).toBe('★★☆');
    expect(m.words).toEqual([{ pt: 'coxinha', en: 'coxinha' }]);
    expect(m.note).toEqual({ pt: 'Valeu pela ajuda!', en: 'Thanks for the help!' });
    // the card is RV, stars, words and one line: the old rows and the separate unlock notice are gone
    expect(Object.keys(m).sort()).toEqual(['big', 'next', 'note', 'stars', 'words']);
    expect(m.next).toEqual({ pt: 'A chapa agora tem dois lugares.', en: 'The grill has two spots now.', tone: 'new' });
    expect(endModel({ ...end, coins: 0, stars: 0 }, { pt: '', en: '' })).toMatchObject({ big: '0 RV', stars: '☆☆☆' });
  });

  it('shiftAct events are all covered: no event kind throws', () => {
    const sh = newShift({ seed: 1, level: 0, unlocked: [], saturday: false, minute: 540, baker: 'carlos', regulars: [] });
    const ev = [...shiftAdvance(sh, 5000), ...shiftAct(sh, { a: 'grab', item: 'agua' }), ...shiftAct(sh, { a: 'clear' }), ...shiftAct(sh, { a: 'pack', kind: 'bag' })];
    for (const e of ev) expect(() => cueFor(e)).not.toThrow();
  });
});

describe('the menu ladder on the counter', () => {
  it('the next line counts shifts in Portuguese, singular and plural', () => {
    expect(ladderNext(menuLadder(0))?.pt).toBe('Próximo: água em 2 turnos');
    expect(ladderNext(menuLadder(1))?.pt).toBe('Próximo: água em 1 turno');
    expect(ladderNext(menuLadder(1))?.en).toMatch(/in 1 shift$/);
    expect(ladderNext(menuLadder(99))?.pt).toMatch(/^Cardápio completo: 12 de 12/);
    expect(ladderNext(undefined)).toBeNull();
  });

  it('the end card leads with what the next shift opens', () => {
    expect(ladderEnd(menuLadder(2)).fresh?.pt).toBe('Próximo turno: água no cardápio!');
    expect(ladderEnd(menuLadder(3)).fresh).toBeNull();
    expect(ladderEnd(menuLadder(3)).next?.pt).toMatch(/em 1 turno$/);
  });

  it('the one next line: a new unlock first, then the item the next shift opens, then the countdown, then the full-menu line', () => {
    const unlock = [{ id: 'cafe_rapido' as const, pt: 'Cafeteira mais rápida', en: 'A faster coffee machine' }];
    expect(endNext({ newUnlocks: unlock, ladder: menuLadder(2) })).toEqual({ pt: 'A cafeteira novinha enche mais rápido.', en: 'The new machine fills faster.', tone: 'new' });
    expect(endNext({ newUnlocks: [], ladder: menuLadder(2) })).toMatchObject({ pt: 'Próximo turno: água no cardápio!', tone: 'new' });
    expect(endNext({ newUnlocks: [], ladder: menuLadder(3) })).toMatchObject({ pt: 'Próximo: pão de queijo em 1 turno', tone: 'plain' });
    expect(endNext({ newUnlocks: [], ladder: menuLadder(99) })).toMatchObject({ pt: expect.stringMatching(/^Cardápio completo/), tone: 'plain' });
    expect(endNext({ newUnlocks: [], ladder: undefined })).toBeNull();
  });
});
