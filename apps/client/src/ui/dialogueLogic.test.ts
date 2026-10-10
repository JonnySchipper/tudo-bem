import { describe, expect, it } from 'vitest';
import {
  LeadSlot,
  MAX_CHIPS,
  MAX_CHIP_KEYS,
  SHOW_EN_KEY,
  TYPE_CPS,
  Typewriter,
  counterChoices,
  dialogueKeyAction,
  firstChoices,
  joinLead,
  midpoint,
  npcTagColor,
  offersPapo,
  readShowEnglish,
  showsHearts,
  typedCount,
  writeShowEnglish,
} from './dialogueLogic';

describe('typewriter timing (45 chars/s)', () => {
  it('shows nothing at t=0 and floor(45 * seconds) characters later', () => {
    expect(TYPE_CPS).toBe(45);
    expect(typedCount(100, 0)).toBe(0);
    expect(typedCount(100, 1000)).toBe(45);
    expect(typedCount(100, 500)).toBe(22);
    expect(typedCount(100, 22)).toBe(0);
    expect(typedCount(100, 23)).toBe(1);
    expect(typedCount(100, 10_000)).toBe(100);
    expect(typedCount(0, 1000)).toBe(0);
    expect(typedCount(10, -5)).toBe(0);
  });

  it('types a line, is done on time, and Space (finish) shows the rest at once', () => {
    const tw = new Typewriter();
    tw.start('Bom dia! Tudo bem?', 1000);
    expect(tw.visible(1000)).toBe('');
    expect(tw.visible(1200)).toBe('Bom dia! '); // 9 chars at 200 ms
    expect(tw.isDone(1200)).toBe(false);
    expect(tw.durationMs()).toBe(400); // 18 chars / 45 per second
    expect(tw.isDone(1400)).toBe(true);
    expect(tw.visible(1400)).toBe('Bom dia! Tudo bem?');
    tw.start('Um pão na chapa, por favor.', 5000);
    expect(tw.isDone(5010)).toBe(false);
    tw.finish();
    expect(tw.visible(5010)).toBe('Um pão na chapa, por favor.');
    expect(tw.isDone(5010)).toBe(true);
  });

  it('starting a new line resets the typing, and instant mode (reduced motion) shows it whole', () => {
    const tw = new Typewriter();
    tw.start('a'.repeat(90), 0);
    tw.finish();
    tw.start('Oi!', 100);
    expect(tw.visible(100)).toBe('');
    const now = new Typewriter();
    now.start('Pão de queijo, açaí, você, não', 0, true);
    expect(now.visible(0)).toBe('Pão de queijo, açaí, você, não');
    expect(now.durationMs()).toBe(0);
  });

  it('never cuts an emoji in half', () => {
    const tw = new Typewriter();
    tw.start('🔊 Ouvir', 0);
    expect(tw.visible(23)).toBe('🔊');
    expect(Array.from(tw.visible(45)).length).toBe(2);
  });
});

describe('dialogue keys', () => {
  const ctx = { chips: 3, typing: false, inInput: false };

  it('1-4 pick the chip with that number, and only chips that exist', () => {
    expect(dialogueKeyAction('1', ctx)).toEqual({ kind: 'chip', index: 0 });
    expect(dialogueKeyAction('3', ctx)).toEqual({ kind: 'chip', index: 2 });
    expect(dialogueKeyAction('4', ctx)).toBeNull();
    expect(dialogueKeyAction('5', { ...ctx, chips: 9 })).toBeNull();
    expect(dialogueKeyAction('0', ctx)).toBeNull();
    expect(dialogueKeyAction('4', { ...ctx, chips: 6 })).toEqual({ kind: 'chip', index: 3 });
    expect(dialogueKeyAction('1', { ...ctx, chips: 0 })).toBeNull();
  });

  it('Space finishes the line only while it is typing, and never inside the text field', () => {
    expect(dialogueKeyAction(' ', { ...ctx, typing: true })).toEqual({ kind: 'skip' });
    expect(dialogueKeyAction(' ', ctx)).toBeNull();
    expect(dialogueKeyAction(' ', { ...ctx, typing: true, inInput: true })).toBeNull();
  });

  it('Escape always closes; digits typed in the field are text, not chips', () => {
    expect(dialogueKeyAction('Escape', ctx)).toEqual({ kind: 'close' });
    expect(dialogueKeyAction('Escape', { ...ctx, inInput: true })).toEqual({ kind: 'close' });
    expect(dialogueKeyAction('2', { ...ctx, inInput: true })).toBeNull();
    expect(dialogueKeyAction('a', ctx)).toBeNull();
    expect(dialogueKeyAction('Enter', ctx)).toBeNull();
  });
});

describe('one click, one box: the idle line leads the first box', () => {
  const idle = { pt: 'Oi! Precisa de ajuda? Fala comigo!', en: 'Hi! Need help? Talk to me!' };
  const greet = { key: 'talk-julia', npcId: 'julia', line: { pt: 'Bom dia! Eu sou a Júlia. Tudo bem?' } };

  it('the first box that NPC opens says the idle line first, and keeps it while that beat re-renders', () => {
    const slot = new LeadSlot();
    const taken = slot.set('julia', idle);
    expect(slot.apply(greet)).toBe(idle);
    expect(taken()).toBe(true);
    expect(slot.apply(greet)).toBe(idle);
    expect(joinLead(idle.pt, greet.line.pt)).toBe('Oi! Precisa de ajuda? Fala comigo! Bom dia! Eu sou a Júlia. Tudo bem?');
    expect(joinLead(undefined, greet.line.pt)).toBe(greet.line.pt);
  });

  it('the next line, another key or a closed box drops it: it is said once', () => {
    const slot = new LeadSlot();
    slot.set('julia', idle);
    expect(slot.apply({ key: 'offer-julia', npcId: 'julia', line: { pt: 'Pode levar isso pra Nanda?' } })).toBe(idle);
    // "Agora não": the greeting takes the same box, without the lead
    expect(slot.apply(greet)).toBeNull();
    expect(slot.apply({ key: 'offer-julia', npcId: 'julia', line: { pt: 'Pode levar isso pra Nanda?' } })).toBeNull();
    slot.set('julia', idle);
    expect(slot.apply({ ...greet, line: { pt: 'Que bom!' } })).toBe(idle);
    slot.closed();
    expect(slot.apply({ ...greet, line: { pt: 'Que bom!' } })).toBeNull();
  });

  it('waits for that NPC and a real line; a click that opened no box drops it (no stale lead on the next click)', () => {
    const slot = new LeadSlot();
    const taken = slot.set('julia', idle);
    expect(slot.apply({ key: 'talk-nanda', npcId: 'nanda', line: { pt: 'Oi!' } })).toBeNull();
    expect(slot.apply({ ...greet, line: null })).toBeNull();
    expect(slot.apply({ ...greet, thinking: true })).toBeNull();
    expect(taken()).toBe(false);
    expect(slot.apply(greet)).toBeNull();
  });
});

describe('chips: 3 content chips and one way out', () => {
  it('a box holds 4 chips, and keys 1-4 reach every one', () => {
    expect(MAX_CHIPS).toBe(4);
    expect(MAX_CHIP_KEYS).toBe(MAX_CHIPS);
    for (let i = 0; i < MAX_CHIPS; i++) expect(dialogueKeyAction(String(i + 1), { chips: MAX_CHIPS, typing: false, inInput: false })).toEqual({ kind: 'chip', index: i });
  });

  it('firstChoices keeps the wanted ones first, then the rest, 3 at most', () => {
    expect(firstChoices(['banana', 'laranja', 'maca', 'flores'], (x) => x === 'flores')).toEqual(['flores', 'banana', 'laranja']);
    expect(firstChoices(['a', 'b'], () => false)).toEqual(['a', 'b']);
    expect(firstChoices(['a', 'b', 'c'], () => true, 0)).toEqual([]);
  });

  const price = (id: string) => ({ coxinha: 7, cafe: 4, cafe_com_leite: 5, pao_na_chapa: 6, agua: 3 })[id] ?? 0;
  const always = ['coxinha', 'cafe'];

  it('the counter: the cheapest first until the first order, the errand item always kept', () => {
    expect(counterChoices(['coxinha', 'cafe'], { price, always, carlosDone: false, papo: false })).toEqual({ items: ['cafe', 'coxinha'], papo: false });
    expect(counterChoices(['coxinha', 'cafe', 'cafe_com_leite', 'pao_na_chapa'], { price, always, carlosDone: false, papo: false }).items).toEqual(['cafe', 'cafe_com_leite', 'pao_na_chapa']);
    expect(counterChoices(['coxinha', 'cafe', 'cafe_com_leite'], { price, always, carlosDone: true, papo: false }).items).toEqual(['coxinha', 'cafe', 'cafe_com_leite']);
  });

  it('the counter: "Bater papo" joins only when the whole menu fits beside it', () => {
    expect(counterChoices(['coxinha', 'cafe'], { price, always, carlosDone: true, papo: true })).toEqual({ items: ['coxinha', 'cafe'], papo: true });
    expect(counterChoices(['coxinha', 'cafe', 'agua'], { price, always, carlosDone: true, papo: true })).toEqual({ items: ['coxinha', 'cafe', 'agua'], papo: false });
  });
});

describe('earned, then shown', () => {
  it('hearts in the header from the first bond point', () => {
    expect(showsHearts(undefined)).toBe(false);
    expect(showsHearts(0)).toBe(false);
    expect(showsHearts(1)).toBe(true);
    expect(showsHearts(30)).toBe(true);
  });

  it('"Vamos bater um papo?" after the first order at the padaria, with a bond point, when the NPC has a bate-papo', () => {
    expect(offersPapo({ bondPoints: 2, carlosDone: true, hasPapo: true })).toBe(true);
    expect(offersPapo({ bondPoints: 2, carlosDone: false, hasPapo: true })).toBe(false);
    expect(offersPapo({ bondPoints: 2, carlosDone: undefined, hasPapo: true })).toBe(false);
    expect(offersPapo({ bondPoints: 0, carlosDone: true, hasPapo: true })).toBe(false);
    expect(offersPapo({ bondPoints: 5, carlosDone: true, hasPapo: false })).toBe(false);
  });
});

describe('Mostrar inglês preference', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('is the same setting as the gear’s Inglês (one key, tb_english)', () => {
    expect(SHOW_EN_KEY).toBe('tb_english');
  });

  it('is on by default and remembers off', () => {
    const s = mem();
    expect(readShowEnglish(s)).toBe(true);
    writeShowEnglish(false, s);
    expect(s.getItem(SHOW_EN_KEY)).toBe('off');
    expect(readShowEnglish(s)).toBe(false);
    writeShowEnglish(true, s);
    expect(readShowEnglish(s)).toBe(true);
  });

  it('survives storage that throws (private windows) and no storage at all', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readShowEnglish(bad)).toBe(true);
    expect(() => writeShowEnglish(false, bad)).not.toThrow();
    expect(readShowEnglish(null)).toBe(true);
  });
});

describe('name tag colour and camera focus', () => {
  it('each NPC has its own colour, unknown ones a wood brown', () => {
    expect(npcTagColor('carlos')).not.toBe(npcTagColor('nanda'));
    expect(npcTagColor('julia')).toMatch(/^#[0-9a-f]{6}$/);
    expect(npcTagColor(null)).toBe('#8b5e3c');
  });

  it('the camera centres between the player and the NPC', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 4 })).toEqual({ x: 5, y: 2 });
  });

});
