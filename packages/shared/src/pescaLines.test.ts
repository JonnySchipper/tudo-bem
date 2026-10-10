import { describe, expect, it } from 'vitest';
import { classifyChat } from './safety.js';
import { BOTTLE_MESSAGES, PARTY_LINES, partyTimeWords, pescaSpokenLines } from './pescaLines.js';
import { PESCA_WORDS } from './pescaWords.js';

describe('the Praia’s runtime lines (PRAIA-PLAN.md 5.5, 5.6, 6.4)', () => {
  it('ten bottle messages, each kind: allowed by the chat filter, no names, no contact details, no digits', () => {
    expect(BOTTLE_MESSAGES).toHaveLength(10);
    for (const m of BOTTLE_MESSAGES) {
      expect(classifyChat(m.pt).action, m.pt).toBe('allow');
      expect(m.pt).not.toMatch(/\d|@|https?:|www\./);
      expect(m.en.length).toBeGreaterThan(0);
    }
  });

  it('every spoken Praia line passes the chat filter, and none mentions alcohol', () => {
    for (const l of pescaSpokenLines()) {
      expect(classifyChat(l.text).action, l.text).toBe('allow');
      expect(l.text.toLowerCase()).not.toMatch(/cerveja|caipirinha|cacha[çc]a|vinho|chopp|bebida alco/);
    }
    for (const l of Object.values(PARTY_LINES)) expect(pescaSpokenLines().some((s) => s.text === l.pt)).toBe(true);
  });

  it('the party pill says the time left as words, only near the end, never a number', () => {
    const end = 1_000_000;
    expect(partyTimeWords(end, end - 10 * 60_000)).toBeNull();
    expect(partyTimeWords(end, end - 2 * 60_000)?.pt).toBe('quase acabando');
    expect(partyTimeWords(end, end - 30_000)!.pt).not.toMatch(/\d/);
  });

  it('the party boat has its own word list: captain, crew, guest, party, sunset, bottle', () => {
    expect(PESCA_WORDS.festa.map((r) => r.earn).sort()).toEqual(['accept_invite', 'guest_board', 'host_board', 'message_bottle', 'music', 'sunset_aboard']);
  });
});
