import { describe, expect, it } from 'vitest';
import { menuLadder, newShift, shiftAct, shiftAdvance, shiftSnapshot, type CEvent, type CorreriaEnd, type CorreriaSnap } from '@tudobem/shared';
import { askCard, cueFor, endModel, frontOf, glossOn, hud, ladderEnd, ladderNext, ladderStrip, modChips, orderMirror, patienceFrac, trayChips } from './correriaLogic';

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

  it('the mod chips are the tapped coffee mods plus the bag or plate', () => {
    expect(modChips({ mods: [], pack: null })).toEqual([]);
    expect(modChips({ mods: ['sem_acucar'], pack: 'bag' }).map((m) => m.pt)).toEqual(['sem açúcar', 'pra viagem']);
    expect(modChips({ mods: [], pack: 'plate' }).map((m) => m.pt)).toEqual(['pra comer aqui']);
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
    expect(hud(snap)).toMatchObject({ wave: 'Onda 2/3', left: '4/15', points: 55, combo: 2, tips: 'R$ 7', level: 'Verde' });
  });

  it('"Quanto é?" lists the items with prices, three options with the number said in words, and the seconds left', () => {
    const sh = newShift({ seed: 3, level: 3, unlocked: [], saturday: false, minute: 540, baker: 'carlos', regulars: [] });
    let card = null as ReturnType<typeof askCard>;
    for (let seed = 1; seed < 60 && !card; seed++) {
      const s = newShift({ seed, level: 1, unlocked: [], saturday: false, minute: 540, baker: 'carlos', regulars: [] });
      // fast-forward to wave 3 where asks are likeliest, then serve what is asked with the test bot below
      s.spawned = 9;
      s.nextSpawnAt = 0;
      for (let i = 0; i < 80 && !s.customers.some((c) => c.state === 'front'); i++) shiftAdvance(s, 250);
      const f = s.customers.find((c) => c.state === 'front');
      if (!f) continue;
      f.state = 'asking';
      f.ask = { total: 12, options: [12, 21, 13], type: 'choice', deadline: s.t + 9000, pay: 20 };
      card = askCard(shiftSnapshot(s).customers.find((c) => c.id === f.id)!, 1000);
    }
    void sh;
    expect(card).not.toBeNull();
    expect(card!.title.pt).toBe('Quanto é?');
    expect(card!.options.map((o) => o.pt)).toEqual(['doze reais', 'vinte e um reais', 'treze reais']);
    expect(card!.options[0]!.label).toBe('R$ 12');
    expect(card!.secs).toBe(8);
    expect(card!.items.length).toBeGreaterThan(0);
  });

  it('events make the right sound and toast: ding on a serve, a nope on a correction, burnt in red', () => {
    expect(cueFor({ k: 'grab', item: 'pao' }).sfx).toBe('grab');
    expect(cueFor({ k: 'serve', id: 1, outcome: 'perfeito', line: { pt: 'Perfeito!', en: 'Perfect!' }, emote: '😋', points: 14, tip: 2, combo: 1, speed: 0.8 })).toMatchObject({ sfx: 'ding', toast: { pt: 'Perfeito!', tone: 'good' } });
    expect(cueFor({ k: 'serve', id: 1, outcome: 'perfeito', line: { pt: 'x', en: 'y' }, emote: '❤️', points: 20, tip: 3, combo: 3, speed: 1 }).sfx).toBe('chain');
    expect(cueFor({ k: 'serve', id: 1, outcome: 'perfeito', line: { pt: 'x', en: 'y' }, emote: '❤️', points: 20, tip: 3, combo: 4, speed: 1 }).sfx).toBe('combo');
    expect(cueFor({ k: 'correct', id: 1, line: { pt: 'Não, eu pedi DOIS pães…', en: 'No, I ordered TWO…' } })).toMatchObject({ sfx: 'nope', toast: { tone: 'bad' } });
    expect(cueFor({ k: 'chapa_burnt', slot: 0 })).toMatchObject({ sfx: 'pop', toast: { pt: 'Queimou!', tone: 'bad' } });
    expect(cueFor({ k: 'front', id: 1 }).sfx).toBe('slap');
    expect(cueFor({ k: 'chapa_raw', slot: 0 }).toast?.pt).toBe('Ainda está cru!');
    expect(cueFor({ k: 'pour_bad', why: 'spill', fill: 1.4 }).toast?.pt).toBe('Derramou!');
    expect(cueFor({ k: 'pour_bad', why: 'short', fill: 0.3 }).toast?.pt).toBe('Faltou café!');
    const ev: CEvent = { k: 'wave', wave: 1, size: 5, line: { pt: 'Mais uma rodada. Bora!', en: 'Another round. Let’s go!' } };
    expect(cueFor(ev).sfx).toBe('chime');
    expect(cueFor({ k: 'over' })).toEqual({});
  });

  it('the end card model: RV headline, stars, rows, new words and unlocks (glossed)', () => {
    const end: CorreriaEnd = {
      served: 13, perfect: 9, second: 4, left: 2, points: 210, tips: 21, bestCombo: 5, stars: 2, coins: 17, dailyBlocked: false,
      askRight: 3, askTotal: 4, words: [{ pt: 'coxinha', en: 'coxinha' }], newUnlocks: [{ id: 'chapa2', pt: 'Segunda chapa', en: 'A second grill spot' }], totalStars: 5, level: 1, regulars: ['Nanda'],
    };
    const m = endModel(end, { pt: 'Valeu pela ajuda!', en: 'Thanks for the help!' });
    expect(m.big).toBe('+17 RV');
    expect(m.stars).toBe('★★☆');
    expect(m.rows.map((r) => r.value)).toEqual(['13/15', '9', 'x5', 'R$ 21', '3/4']);
    expect(m.unlocks[0]).toEqual({ pt: 'A chapa agora tem dois lugares.', en: 'The grill has two spots now.' });
    expect(endModel({ ...end, coins: 0, askTotal: 0, stars: 0 }, { pt: '', en: '' })).toMatchObject({ big: '0 RV', stars: '☆☆☆' });
    expect(endModel({ ...end, askTotal: 0 }, { pt: '', en: '' }).rows).toHaveLength(4);
  });

  it('shiftAct events are all covered: no event kind throws', () => {
    const sh = newShift({ seed: 1, level: 0, unlocked: [], saturday: false, minute: 540, baker: 'carlos', regulars: [] });
    const ev = [...shiftAdvance(sh, 5000), ...shiftAct(sh, { a: 'grab', item: 'agua' }), ...shiftAct(sh, { a: 'clear' }), ...shiftAct(sh, { a: 'pack', kind: 'bag' })];
    for (const e of ev) expect(() => cueFor(e)).not.toThrow();
  });
});

describe('the menu ladder on the counter', () => {
  it('the strip lists what is open, marks what just opened, and ends on the next item', () => {
    expect(ladderStrip(undefined)).toEqual([]);
    const strip = ladderStrip(menuLadder(2));
    expect(strip.map((c) => [c.id, c.state])).toEqual([
      ['cafe', 'open'],
      ['pao', 'open'],
      ['agua', 'new'],
      ['pao_de_queijo', 'next'],
    ]);
    expect(strip[1]).toMatchObject({ pt: 'pão', en: expect.any(String) });
    // a long menu folds its oldest items into one "+N" chip and stays six chips long
    const full = ladderStrip(menuLadder(99));
    expect(full).toHaveLength(6);
    expect(full[0]).toMatchObject({ id: 'more', pt: '+7', state: 'more' });
    expect(full.slice(1).every((c) => c.state === 'open')).toBe(true);
    expect(full[5]!.id).toBe('misto_quente');
    const mid = ladderStrip(menuLadder(10));
    expect(mid.map((c) => c.state)).toEqual(['more', 'open', 'open', 'open', 'new', 'next']);
  });

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
});
