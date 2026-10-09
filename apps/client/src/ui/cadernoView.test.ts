import { describe, expect, it } from 'vitest';
import { CADERNO_GROUP_RV, cadernoGroups } from '@tudobem/shared';
import { UNKNOWN_WORD, cadernoView, spokenForm, wordState, wordView } from './cadernoView';

const e = (seen: number, heard: number, used: number) => ({ seen, heard, used, firstAt: 1 });

describe('caderno view-model', () => {
  it('an empty caderno shows every group with every word as ??? and nothing learned', () => {
    const v = cadernoView(undefined, undefined);
    expect(v.groups.map((g) => g.id)).toEqual(cadernoGroups().map((g) => g.id));
    expect(v.groups.map((g) => g.label.pt)).toEqual(['Padaria', 'Cumprimentos', 'Números', 'Tatame']);
    expect(v.total).toBe(77);
    expect(v.learned).toBe(0);
    expect(v.met).toBe(0);
    for (const g of v.groups) {
      expect(g.percent).toBe(0);
      expect(g.complete).toBe(false);
      expect(g.paid).toBe(false);
      expect(g.reward).toBe(CADERNO_GROUP_RV);
      for (const w of g.words) {
        expect(w.form).toBe(UNKNOWN_WORD);
        expect(w.gloss).toBe('');
        expect(w.known).toBe(false);
        expect(w.state).toBe('unseen');
      }
    }
  });

  it('a met word shows its Portuguese and English; the state follows seen, heard, used', () => {
    expect(wordState(undefined)).toBe('unseen');
    expect(wordState(e(0, 0, 0))).toBe('unseen');
    expect(wordState(e(1, 0, 0))).toBe('seen');
    expect(wordState(e(1, 2, 0))).toBe('heard');
    expect(wordState(e(0, 0, 1))).toBe('used');
    expect(wordState(e(3, 3, 3))).toBe('used');
    const w = wordView('lex.padaria.coxinha', e(1, 0, 0));
    expect(w).toMatchObject({ form: 'coxinha', gloss: 'chicken croquette', known: true, state: 'seen', learned: false });
    const tray = wordView('lex.padaria.pao_de_queijo', e(1, 1, 0));
    expect(tray.gloss).toBe('cheese bread');
    expect(tray.learned).toBe(true);
  });

  it('learned = used, or seen and heard (the group reward rule)', () => {
    expect(wordView('lex.social.oi', e(1, 0, 0)).learned).toBe(false);
    expect(wordView('lex.social.oi', e(0, 1, 0)).learned).toBe(false);
    expect(wordView('lex.social.oi', e(1, 1, 0)).learned).toBe(true);
    expect(wordView('lex.social.oi', e(0, 0, 1)).learned).toBe(true);
  });

  it('group progress counts learned cards; a finished group is complete and shows whether the reward was paid', () => {
    const social = cadernoGroups().find((g) => g.id === 'social')!;
    const half = Object.fromEntries(social.cardIds.slice(0, 5).map((id) => [id, e(1, 1, 0)]));
    let v = cadernoView(half, []);
    const g = v.groups.find((x) => x.id === 'social')!;
    expect(g.learned).toBe(5);
    expect(g.total).toBe(10);
    expect(g.percent).toBe(50);
    expect(g.complete).toBe(false);
    expect(v.groups.find((x) => x.id === 'padaria')!.learned).toBe(0);
    expect(v.met).toBe(5);

    const all = Object.fromEntries(social.cardIds.map((id) => [id, e(0, 0, 1)]));
    v = cadernoView(all, []);
    expect(v.groups.find((x) => x.id === 'social')).toMatchObject({ complete: true, percent: 100, paid: false });
    v = cadernoView(all, ['social']);
    expect(v.groups.find((x) => x.id === 'social')).toMatchObject({ complete: true, paid: true });
    expect(v.learned).toBe(10);
  });

  it('words met but not learned still show their text (seen only) and keep the counters', () => {
    const v = cadernoView({ 'lex.num.3': e(4, 2, 0) }, []);
    const w = v.groups.find((x) => x.id === 'num')!.words.find((x) => x.id === 'lex.num.3')!;
    expect(w).toMatchObject({ form: 'três', seen: 4, heard: 2, used: 0, state: 'heard', learned: true });
  });

  it('the 🔊 plays the first form of a card', () => {
    expect(spokenForm('Obrigado / Obrigada')).toBe('Obrigado');
    expect(spokenForm('um / uma')).toBe('um');
    expect(spokenForm('café com leite')).toBe('café com leite');
  });
});
