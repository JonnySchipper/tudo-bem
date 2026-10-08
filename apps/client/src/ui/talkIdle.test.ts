import { describe, expect, it } from 'vitest';
import { npcDefById, wordForLine } from '@tudobem/shared';
import { talkIdleOpen } from './talkIdle';

describe('talkIdleOpen', () => {
  const julia = npcDefById('julia')!;

  it('opens with the first idle line whose word is not in the diary', () => {
    const open = talkIdleOpen('julia', julia.idleLines, [], 8 * 60);
    expect(open).toEqual({
      anchor: 'julia.idle0',
      line: { pt: 'Oi! Precisa de ajuda? Fala comigo!', en: 'Hi! Need help? Talk to me!' },
    });
    expect(open!.line.pt.toLocaleLowerCase('pt-BR')).toContain(wordForLine(open!.anchor)!.pt);
  });

  it('skips a line whose word is already learned', () => {
    const open = talkIdleOpen('julia', julia.idleLines, ['diary.praca.ajuda'], 8 * 60);
    expect(open?.anchor).toBe('julia.idle2');
    expect(open?.line.pt).toContain('vizinho');
  });

  it('is null once every idle word is learned', () => {
    expect(talkIdleOpen('julia', julia.idleLines, ['diary.praca.ajuda', 'diary.praca.vizinho', 'diary.praca.passeio'], 8 * 60)).toBeNull();
  });

  it('says the greeting that fits the hour, on the line the word is in', () => {
    const carlos = npcDefById('carlos')!;
    const open = talkIdleOpen('carlos', carlos.idleLines, ['diary.padaria.quentinho'], 15 * 60);
    expect(open?.anchor).toBe('carlos.idle1');
    expect(open?.line.pt.startsWith('Boa tarde')).toBe(true);
    expect(open?.line.en.startsWith('Good afternoon')).toBe(true);
    expect(open!.line.pt.toLocaleLowerCase('pt-BR')).toContain(wordForLine('carlos.idle1')!.pt);
  });
});
