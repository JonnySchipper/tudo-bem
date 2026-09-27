import { describe, it, expect } from 'vitest';
import {
  CONVERSA_MAX_PLAYER_MSGS,
  CONVERSA_MIN_MSGS_TO_SCORE,
  CONVERSA_CAST,
  CONVERSA_SUBJECTS,
  gradeFromScores,
  gradeRV,
  gradeCopy,
  contaRvLine,
  CONVERSA_COPY,
  metersFromHistory,
  mentionedPrices,
  sanitizeConversaTurn,
  filterNpcLine,
  authoredFallbackTurn,
  canStartConversa,
  shouldGrantRV,
  conversaDateKey,
  parseAiResponse,
  buildCarlosSystemPrompt,
  pickConversaOpener,
  applyConversaGateB,
  presentConversaTurn,
  diverseChips,
  offlineConversaOpen,
  gateConversaPlayerLine,
  CONVERSA_WORD_CAP,
  type ConversaScores,
  type Score03,
} from './conversa.js';
import { classifyChat } from './safety.js';

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

  it('varies the food beat instead of repeating one line', () => {
    const first = authoredFallbackTurn('pão na chapa', []);
    const later = authoredFallbackTurn('pão na chapa', [{ who: 'npc', pt: 'Bom dia!' }]);
    expect(first.response.pt.toLowerCase()).toContain('pão');
    expect(later.response.pt.toLowerCase()).toContain('pão');
    expect(later.response.pt).not.toBe(first.response.pt);
    expect(later.chips.map((c) => c.pt).join('|')).not.toBe(first.chips.map((c) => c.pt).join('|'));
  });
});

describe('Carlos variety', () => {
  it('prefers Pois não but does not require it on every line, and never defaults to Pode falar', () => {
    const prompt = buildCarlosSystemPrompt(CONVERSA_SUBJECTS.cafe_da_manha, {
      playerName: 'Ana',
      pronoun: 'ela',
      nameplate: 'verde',
    });
    expect(prompt).toContain('Pois não');
    expect(prompt).toContain('NOT required on every line');
    expect(prompt).toContain('Never use "Pode falar"');
    expect(prompt).not.toContain('Primary acknowledgment');
    for (const phrase of ['Bom dia', 'E aí', 'Pronto', 'Tá na mão', 'Deixa eu anotar', 'Quer mais alguma coisa']) {
      expect(prompt).toContain(phrase);
    }
    expect(prompt).toContain(`Max ${CONVERSA_WORD_CAP.verde} words`);
    expect(prompt).toContain('pão na chapa R$6');
    expect(prompt).toContain('"response"');
    expect(prompt).toContain('"chips"');
    expect(prompt).toContain('minha filha');
    expect(prompt).toMatch(/at most once/i);

    const unnamed = buildCarlosSystemPrompt(CONVERSA_SUBJECTS.cafe_da_manha, {
      playerName: 'Sam',
      pronoun: 'nome',
      nameplate: 'verde',
    });
    expect(unnamed).toContain('Do not use kinship');
  });

  it('rotates seed openers; Pois não is one option and Pode falar is never a default', () => {
    const subject = CONVERSA_SUBJECTS.cafe_da_manha;
    expect(subject.seedOpeners.some((l) => l.includes('Pois não'))).toBe(true);
    expect(subject.seedOpeners.every((l) => l.startsWith('Pois não'))).toBe(false);
    expect(subject.seedOpeners.join('\n')).not.toMatch(/Pode falar/i);

    const lines = new Set<string>();
    const chips = new Set<string>();
    for (let i = 0; i < subject.seedOpeners.length; i++) {
      const picked = pickConversaOpener(subject, () => i / subject.seedOpeners.length);
      lines.add(picked.line);
      chips.add(picked.chips.join('|'));
      expect(picked.chips.length).toBeGreaterThanOrEqual(2);
      expect(picked.chips.join('\n')).not.toMatch(/Pode falar/i);
    }
    expect(lines.size).toBe(subject.seedOpeners.length);
    expect(chips.size).toBeGreaterThan(1);
  });

  it('does not repeat an identical chip set when another set exists', () => {
    const prior = ['Um café, por favor.', 'Uma água, por favor.'];
    const next = diverseChips([...prior], prior);
    expect(next.map((s) => s.toLowerCase()).sort().join('|')).not.toBe(prior.map((s) => s.toLowerCase()).sort().join('|'));
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

describe('contaRvLine', () => {
  it('prints the payout when RV was granted', () => {
    expect(contaRvLine(20, null)).toEqual({ pt: '+20 RV', en: '+20 RV' });
    expect(contaRvLine(5)).toEqual({ pt: '+5 RV', en: '+5 RV' });
  });

  it('says the day was already earned when RV is withheld', () => {
    expect(contaRvLine(0, 'already_today')).toEqual(CONVERSA_COPY.rvAlready);
    expect(CONVERSA_COPY.rvAlready.pt.toLowerCase()).toContain('já ganhou hoje');
  });

  it('stays quiet when nothing was withheld', () => {
    expect(contaRvLine(0, null)).toBeNull();
    expect(contaRvLine(0)).toBeNull();
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


describe('Gate A player line on the mesa', () => {
  it('warns on the exact coxinha line, keeps it verbatim, and asks for a warn toast', () => {
    const line = 'Essa coxinha tá gostosa!';
    const gate = gateConversaPlayerLine(line);
    const verdict = classifyChat(line);
    expect(gate.action).toBe('warn');
    expect(gate.deliver).toBe(true);
    expect(gate.text).toBe(line);
    expect(verdict.text).toBe(line);
    expect(gate.notice).toEqual({ level: 'warn', pt: verdict.note?.pt, en: verdict.note?.en });
    expect(gate.notice?.pt.length).toBeGreaterThan(0);
    expect(gate.notice?.en.length).toBeGreaterThan(0);
  });

  it('blocks alcohol out of the transcript and asks for a block toast', () => {
    const line = 'bora tomar uma cerveja';
    const gate = gateConversaPlayerLine(line);
    expect(gate.action).toBe('block');
    expect(gate.deliver).toBe(false);
    expect(gate.text).toBe('');
    expect(gate.notice?.level).toBe('block');
    expect(gate.notice?.pt.length).toBeGreaterThan(0);
    expect(gate.notice?.en.length).toBeGreaterThan(0);
  });

  it('allows a padaria line with no toast', () => {
    const line = 'Pra comer aqui, por favor.';
    expect(gateConversaPlayerLine(line)).toEqual({ action: 'allow', deliver: true, text: line, notice: null });
  });

  it('still blocks a person-directed gostosa instead of warning', () => {
    const gate = gateConversaPlayerLine('você é gostosa');
    expect(gate.action).toBe('block');
    expect(gate.deliver).toBe(false);
    expect(gate.text).toBe('');
    expect(gate.notice?.level).toBe('block');
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

/** Fixed bad model payload: clean counter line, one banned chip, a banned tip. */
const GATE_B_TURN_FIXTURE = {
  line: 'Pão na chapa saindo. Quer mais alguma coisa?',
  chips: ['Um café com leite, por favor.', 'Quer uma cerveja gelada?', 'Pra comer aqui, por favor.'],
  tip: 'Me liga no 11 98765-4321.',
};

describe('Gate B fixture on chips and tips', () => {
  it('strips banned chips and tips and keeps a clean line', () => {
    const gated = applyConversaGateB(GATE_B_TURN_FIXTURE);
    expect(gated.line).toBe(GATE_B_TURN_FIXTURE.line);
    expect(gated.chips).toEqual(['Um café com leite, por favor.', 'Pra comer aqui, por favor.']);
    expect(gated.tip).toBeNull();
    expect(JSON.stringify(gated)).not.toMatch(/cerveja|98765/);
  });

  it('drops a banned NPC line', () => {
    const gated = applyConversaGateB({
      line: 'Quer uma cachaça?',
      chips: ['Um café, por favor.'],
      tip: 'Isso aí.',
    });
    expect(gated.line).toBeNull();
    expect(gated.chips).toEqual(['Um café, por favor.']);
    expect(gated.tip).toBe('Isso aí.');
  });

  it('presentConversaTurn does not return the banned chip or tip', () => {
    const presented = presentConversaTurn({
      line: { pt: GATE_B_TURN_FIXTURE.line, en: 'Grilled bread. Anything else?' },
      chips: GATE_B_TURN_FIXTURE.chips.map((pt) => ({ pt, en: '' })),
      scores: { portuguese: 3, grammar: 3, conversation: 3 },
      tip: { pt: GATE_B_TURN_FIXTURE.tip, en: 'call me' },
      end: false,
      order: {},
    });
    expect(presented.line.pt).toContain('Pão na chapa');
    expect(presented.chips.map((c) => c.pt)).toEqual(['Um café com leite, por favor.', 'Pra comer aqui, por favor.']);
    expect(presented.tip).toBeNull();
    expect(JSON.stringify(presented)).not.toMatch(/cerveja|98765/);
  });
});

describe('offline Conversa open', () => {
  it('opens Carlos with an authored line and chips, and refuses disabled NPCs', () => {
    const open = offlineConversaOpen('carlos');
    expect(open).not.toBeNull();
    expect(open!.npcName).toBe('Seu Carlos');
    expect(open!.line.pt.length).toBeGreaterThan(0);
    expect(open!.chips.length).toBeGreaterThanOrEqual(2);
    expect(open!.line.pt + open!.chips.map((c) => c.pt).join(' ')).not.toMatch(/Pode falar/i);
    expect(offlineConversaOpen('nanda')).toBeNull();
    expect(offlineConversaOpen('julia')).toBeNull();
  });
});
