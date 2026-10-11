import { describe, expect, it } from 'vitest';
import { greetingKind, classifyChat } from '@tudobem/shared';
import { chatChips, chatChipsShown } from './chatChips';

describe('chat quick replies', () => {
  it('are Oi!, the greeting for the hour, and Valeu!', () => {
    expect(chatChips(8 * 60).map((c) => c.pt)).toEqual(['Oi!', 'Bom dia', 'Valeu!']);
    expect(chatChips(12 * 60).map((c) => c.pt)).toEqual(['Oi!', 'Boa tarde', 'Valeu!']);
    expect(chatChips(21 * 60).map((c) => c.pt)).toEqual(['Oi!', 'Boa noite', 'Valeu!']);
    expect(chatChips(2 * 60)[1]!.pt).toBe('Boa noite');
  });

  it('send lines the greeting check reads and the safety filter lets through', () => {
    for (const m of [8 * 60, 14 * 60, 22 * 60]) {
      const [oi, hora, valeu] = chatChips(m);
      expect(greetingKind(oi!.pt)).toBe('oi');
      expect(greetingKind(hora!.pt)).not.toBeNull();
      expect(greetingKind(valeu!.pt)).toBeNull();
      for (const c of [oi!, hora!, valeu!]) expect(classifyChat(c.pt).action, c.pt).toBe('allow');
    }
  });

  it('show from S1 (the Vila) on, never in the arrivals hall or without a profile', () => {
    expect(chatChipsShown(null)).toBe(false);
    expect(chatChipsShown({ desembarqueDone: false })).toBe(false);
    expect(chatChipsShown({ arrivalIntroDone: false })).toBe(false);
    expect(chatChipsShown({ desembarqueDone: true, arrivalIntroDone: true })).toBe(true);
    expect(chatChipsShown({ desembarqueDone: true, arrivalIntroDone: true, tutorial: { carlos: true }, recadosDoneTotal: 1 })).toBe(true);
  });
});
