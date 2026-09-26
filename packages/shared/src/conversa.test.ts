import { describe, it, expect } from 'vitest';
import {
  CONVERSA_MAX_PLAYER_MSGS,
  CONVERSA_MIN_MSGS_TO_SCORE,
  CONVERSA_CAST,
  CONVERSA_SUBJECTS,
  gradeFromScores,
  gradeRV,
  gradeCopy,
  metersFromHistory,
  mentionedPrices,
  sanitizeConversaTurn,
  filterNpcLine,
  authoredFallbackTurn,
  canStartConversa,
  shouldGrantRV,
  conversaDateKey,
  parseAiResponse,
  type ConversaScores,
  type Score03,
} from './conversa.js';

describe('conversa constants', () => {
  it('has correct max player messages', () => {
    expect(CONVERSA_MAX_PLAYER_MSGS).toBe(6);
  });

  it('has correct min messages to score', () => {
    expect(CONVERSA_MIN_MSGS_TO_SCORE).toBe(3);
  });

  it('has Carlos enabled in cast', () => {
    expect(CONVERSA_CAST.carlos.enabled).toBe(true);
    expect(CONVERSA_CAST.carlos.npc).toBe('carlos');
    expect(CONVERSA_CAST.carlos.room).toBe('padaria');
  });

  it('has Nanda and Julia disabled for Phase 0', () => {
    expect(CONVERSA_CAST.nanda.enabled).toBe(false);
    expect(CONVERSA_CAST.julia.enabled).toBe(false);
  });
});

describe('gradeFromScores', () => {
  it('returns tryAgain when turn count is below minimum', () => {
    const scores: ConversaScores = { portuguese: 3, grammar: 3, conversation: 3 };
    expect(gradeFromScores(scores, 2)).toBe('tryAgain');
    expect(gradeFromScores(scores, 1)).toBe('tryAgain');
    expect(gradeFromScores(scores, 0)).toBe('tryAgain');
  });

  it('returns tryAgain when any score is 0', () => {
    expect(gradeFromScores({ portuguese: 0, grammar: 3, conversation: 3 }, 4)).toBe('tryAgain');
    expect(gradeFromScores({ portuguese: 3, grammar: 0, conversation: 3 }, 4)).toBe('tryAgain');
    expect(gradeFromScores({ portuguese: 3, grammar: 3, conversation: 0 }, 4)).toBe('tryAgain');
  });

  it('returns pass when average >= 2.3 and no zeros', () => {
    expect(gradeFromScores({ portuguese: 3, grammar: 3, conversation: 3 }, 4)).toBe('pass');
    expect(gradeFromScores({ portuguese: 3, grammar: 2, conversation: 2 }, 4)).toBe('pass');
    expect(gradeFromScores({ portuguese: 2, grammar: 3, conversation: 2 }, 4)).toBe('pass');
  });

  it('returns almost when average >= 1.5 but < 2.3', () => {
    expect(gradeFromScores({ portuguese: 2, grammar: 2, conversation: 1 }, 4)).toBe('almost');
    expect(gradeFromScores({ portuguese: 2, grammar: 1, conversation: 2 }, 4)).toBe('almost');
    expect(gradeFromScores({ portuguese: 1, grammar: 2, conversation: 2 }, 4)).toBe('almost');
  });

  it('returns tryAgain when average < 1.5', () => {
    expect(gradeFromScores({ portuguese: 1, grammar: 1, conversation: 1 }, 4)).toBe('tryAgain');
  });
});

describe('gradeRV', () => {
  it('returns correct RV amounts', () => {
    expect(gradeRV('pass')).toBe(20);
    expect(gradeRV('almost')).toBe(5);
    expect(gradeRV('tryAgain')).toBe(0);
  });
});

describe('gradeCopy', () => {
  it('returns bilingual labels and lines', () => {
    const pass = gradeCopy('pass');
    expect(pass.label.pt).toBe('Mandou bem!');
    expect(pass.label.en).toBe('Nice work!');
    expect(pass.line.pt).toContain('Volte sempre');

    const almost = gradeCopy('almost');
    expect(almost.label.pt).toBe('Quase!');

    const tryAgain = gradeCopy('tryAgain');
    expect(tryAgain.label.pt).toBe('Tenta de novo');
  });
});

describe('metersFromHistory', () => {
  it('returns zeros for empty history', () => {
    const meter = metersFromHistory([]);
    expect(meter.portuguese).toBe(0);
    expect(meter.grammar).toBe(0);
    expect(meter.conversation).toBe(0);
  });

  it('returns zeros for history without scores', () => {
    const meter = metersFromHistory([{}, {}, {}]);
    expect(meter.portuguese).toBe(0);
    expect(meter.grammar).toBe(0);
    expect(meter.conversation).toBe(0);
  });

  it('calculates percentages correctly', () => {
    const meter = metersFromHistory([
      { scores: { portuguese: 3, grammar: 3, conversation: 3 } },
    ]);
    expect(meter.portuguese).toBe(100);
    expect(meter.grammar).toBe(100);
    expect(meter.conversation).toBe(100);
  });

  it('averages multiple scores', () => {
    const meter = metersFromHistory([
      { scores: { portuguese: 3, grammar: 2, conversation: 1 } },
      { scores: { portuguese: 1, grammar: 2, conversation: 3 } },
    ]);
    expect(meter.portuguese).toBe(67);
    expect(meter.grammar).toBe(67);
    expect(meter.conversation).toBe(67);
  });
});

describe('mentionedPrices', () => {
  it('extracts R$ prices', () => {
    expect(mentionedPrices('Isso custa R$ 6')).toContain(6);
    expect(mentionedPrices('R$7')).toContain(7);
    expect(mentionedPrices('R$ 15 reais')).toContain(15);
  });

  it('extracts numeric reais', () => {
    expect(mentionedPrices('são 8 reais')).toContain(8);
    expect(mentionedPrices('5 reais')).toContain(5);
    expect(mentionedPrices('10 real')).toContain(10);
  });

  it('extracts spelled-out numbers', () => {
    expect(mentionedPrices('seis reais')).toContain(6);
    expect(mentionedPrices('oito reais')).toContain(8);
  });

  it('returns empty for text without prices', () => {
    expect(mentionedPrices('bom dia')).toEqual([]);
    expect(mentionedPrices('me vê um café')).toEqual([]);
  });
});

describe('sanitizeConversaTurn', () => {
  it('truncates long responses', () => {
    const long = Array(25).fill('palavra').join(' ');
    const result = sanitizeConversaTurn(long, 18);
    expect(result.split(' ').length).toBeLessThanOrEqual(19);
    expect(result).toContain('…');
  });

  it('keeps short responses intact', () => {
    const short = 'Pois não. O que vai ser?';
    expect(sanitizeConversaTurn(short, 18)).toBe(short);
  });
});

describe('authoredFallbackTurn', () => {
  it('responds to greetings', () => {
    const result = authoredFallbackTurn('bom dia', []);
    expect(result.response.pt.toLowerCase()).toContain('bom dia');
    expect(result.end).toBe(false);
  });

  it('responds to food orders', () => {
    const result = authoredFallbackTurn('pão na chapa', []);
    expect(result.response.pt.toLowerCase()).toContain('pão');
    expect(result.chips.length).toBeGreaterThan(0);
  });

  it('responds to drink orders', () => {
    const result = authoredFallbackTurn('café com leite', []);
    expect(result.response.pt.toLowerCase()).toContain('café');
  });

  it('ends on goodbye', () => {
    const result = authoredFallbackTurn('obrigado', []);
    expect(result.response.pt.toLowerCase()).toContain('volte sempre');
    expect(result.end).toBe(true);
  });

  it('handles unrecognized input', () => {
    const result = authoredFallbackTurn('asdfasdf', []);
    expect(result.chips.length).toBeGreaterThan(0);
    expect(result.end).toBe(false);
  });
});

describe('canStartConversa', () => {
  it('allows starting with Carlos when enabled', () => {
    const result = canStartConversa('carlos', {}, false);
    expect(result.allowed).toBe(true);
  });

  it('blocks Nanda (disabled)', () => {
    const result = canStartConversa('nanda', {}, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('unavailable');
  });

  it('blocks Julia (disabled)', () => {
    const result = canStartConversa('julia', {}, false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('unavailable');
  });

  it('respects daily cap when on', () => {
    const today = conversaDateKey();
    const daily = { conversaClears: { carlos: today } };
    const result = canStartConversa('carlos', daily, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('daily_cap');
  });

  it('allows when daily cap is off', () => {
    const today = conversaDateKey();
    const daily = { conversaClears: { carlos: today } };
    const result = canStartConversa('carlos', daily, false);
    expect(result.allowed).toBe(true);
  });
});

describe('shouldGrantRV', () => {
  it('grants RV when rvOncePerDay is off', () => {
    const today = conversaDateKey();
    const daily = { conversaRvGranted: { carlos: today } };
    expect(shouldGrantRV('carlos', daily, false)).toBe(true);
  });

  it('blocks RV when already granted today', () => {
    const today = conversaDateKey();
    const daily = { conversaRvGranted: { carlos: today } };
    expect(shouldGrantRV('carlos', daily, true)).toBe(false);
  });

  it('grants RV when not granted today', () => {
    const daily = { conversaRvGranted: { carlos: '2020-01-01' } };
    expect(shouldGrantRV('carlos', daily, true)).toBe(true);
  });

  it('grants RV when no previous grant', () => {
    expect(shouldGrantRV('carlos', {}, true)).toBe(true);
  });
});

describe('parseAiResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      response: 'Pois não.',
      chips: ['Café', 'Água'],
      scores: { portuguese: 3, grammar: 2, conversation: 3 },
      tip: 'Tenta mais português',
      end: false,
    });
    const result = parseAiResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.line.pt).toBe('Pois não.');
    expect(result!.chips).toHaveLength(2);
    expect(result!.scores.portuguese).toBe(3);
    expect(result!.tip?.pt).toBe('Tenta mais português');
    expect(result!.end).toBe(false);
  });

  it('handles response with extra text', () => {
    const raw = 'Here is the response: {"response": "Oi!", "chips": [], "scores": {"portuguese": 2, "grammar": 2, "conversation": 2}, "tip": null, "end": true}';
    const result = parseAiResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.line.pt).toBe('Oi!');
    expect(result!.end).toBe(true);
  });

  it('returns null for invalid JSON', () => {
    expect(parseAiResponse('not json')).toBeNull();
    expect(parseAiResponse('{incomplete')).toBeNull();
  });

  it('clamps scores to valid range', () => {
    const raw = JSON.stringify({
      response: 'Test',
      chips: [],
      scores: { portuguese: 5, grammar: -1, conversation: 10 },
      tip: null,
      end: false,
    });
    const result = parseAiResponse(raw);
    expect(result!.scores.portuguese).toBe(3);
    expect(result!.scores.grammar).toBe(0);
    expect(result!.scores.conversation).toBe(3);
  });
});

describe('conversaDateKey', () => {
  it('returns a date string', () => {
    const key = conversaDateKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});


describe('filterNpcLine Gate B', () => {
  it('allows padaria lines', () => {
    expect(filterNpcLine('Pois não. O que vai ser hoje?')).toContain('Pois não');
  });

  it('blocks alcohol', () => {
    expect(filterNpcLine('Quer uma cerveja gelada?')).toBeNull();
  });

  it('blocks flirt/body', () => {
    expect(filterNpcLine('Você tá gostosa hoje')).toBeNull();
  });

  it('blocks phone-looking PII', () => {
    expect(filterNpcLine('Me liga no 11 98765-4321')).toBeNull();
  });
});
