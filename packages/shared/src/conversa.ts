import type { Bilingual, Nameplate, Pronoun } from './types.js';
import type { NpcId } from './rooms.js';
import { PRICES, type SceneCtx } from './carlos.js';
import { numberPt } from './numbers.js';

/**
 * Conversa (GDD §5.6): a short, private, scored conversation with an NPC.
 * CEO lock 2026-09-26: max 6 player messages, one Conversa per NPC per day (gate ships off),
 * live Portuguese / Grammar / Conversation meter, RV payout (Pass +20, Almost +5, Try again 0).
 * NPC lines may come from an LLM; everything it says passes `sanitizeConversaTurn` first.
 */

export const CONVERSA_MAX_PLAYER_MSGS = 6;
export const CONVERSA_MIN_MSGS_TO_SCORE = 3;

export const CONVERSA_RV = { pass: 20, almost: 5, tryAgain: 0 } as const;

export const CONVERSA_WORD_CAP: Record<Nameplate, number> = { verde: 18, amarelo: 24, azul: 32, roxo: 40, dourado: 48 };

export type ConversaAxis = 'portuguese' | 'grammar' | 'conversation';
export type Score03 = 0 | 1 | 2 | 3;
export type ConversaScores = Record<ConversaAxis, Score03>;
export type ConversaMeter = Record<ConversaAxis, number>;

export type ConversaGrade = 'pass' | 'almost' | 'tryAgain';

export const CONVERSA_AXES: { id: ConversaAxis; pt: string; en: string; tip: Bilingual }[] = [
  { id: 'portuguese', pt: 'Português', en: 'Portuguese', tip: { pt: 'Naturalidade — soa como português do Brasil?', en: 'Does it sound like natural Brazilian Portuguese?' } },
  { id: 'grammar', pt: 'Gramática', en: 'Grammar', tip: { pt: 'Gramática — combinações e formas ok pro A1', en: 'A1-level forms and agreement' } },
  { id: 'conversation', pt: 'Conversa', en: 'Conversation', tip: { pt: 'No assunto + qualidade — ficou no tema e a conversa fluiu?', en: 'On topic + did the chat feel like a real exchange?' } },
];

export interface ConversaSubject {
  id: string;
  title: Bilingual;
  goal: Bilingual;
  lexemes: string[];
  seedOpeners: string[];
}

export interface ConversaCastEntry {
  npc: NpcId;
  name: string;
  room: 'padaria' | 'praca';
  enabled: boolean;
  subjects: ConversaSubject[];
}

export const CONVERSA_SUBJECTS: Record<string, ConversaSubject> = {
  cafe_da_manha: {
    id: 'cafe_da_manha',
    title: { pt: 'Café da manhã', en: 'Breakfast' },
    goal: { pt: 'Peça comida, bebida e diga se é pra comer aqui ou pra viagem.', en: 'Order food and a drink, then say for here or to go.' },
    lexemes: ['bom dia', 'pois não', 'me vê um', 'por favor', 'pão na chapa', 'coxinha', 'pastel', 'café com leite', 'suco', 'água', 'pra comer aqui', 'pra viagem', 'isso aí', 'obrigado', 'volte sempre'],
    seedOpeners: ['Pois não. O que vai ser hoje?', 'E aí, tudo bem? Vai querer o quê?', 'Bom dia! O que posso servir?'],
  },
  cumprimentos: {
    id: 'cumprimentos',
    title: { pt: 'Cumprimentos', en: 'Greetings' },
    goal: { pt: 'Cumprimente o Carlos e responda "tudo bem?".', en: 'Greet Carlos and respond to "tudo bem?"' },
    lexemes: ['bom dia', 'boa tarde', 'olá', 'oi', 'tudo bem', 'beleza', 'até logo', 'tchau', 'obrigado'],
    seedOpeners: ['Bom dia! Tudo bem?', 'Oi, beleza?'],
  },
};

export const CONVERSA_CAST: Record<NpcId, ConversaCastEntry> = {
  carlos: {
    npc: 'carlos',
    name: 'Seu Carlos',
    room: 'padaria',
    enabled: true,
    subjects: [CONVERSA_SUBJECTS.cafe_da_manha, CONVERSA_SUBJECTS.cumprimentos],
  },
  nanda: {
    npc: 'nanda',
    name: 'Nanda',
    room: 'praca',
    enabled: false,
    subjects: [],
  },
  julia: {
    npc: 'julia',
    name: 'Júlia',
    room: 'praca',
    enabled: false,
    subjects: [],
  },
};

export interface ConversaLine {
  who: 'npc' | 'player';
  pt: string;
  en?: string;
}

export interface ConversaOrder {
  food?: string;
  drink?: string;
  where?: 'aqui' | 'viagem';
}

export interface ConversaTurnRequest {
  npcId: NpcId;
  subjectId: string;
  playerName: string;
  pronoun: Pronoun;
  nameplate: Nameplate;
  history: ConversaLine[];
  text: string;
  turn: number;
  maxTurns: number;
}

export interface ConversaTurnResponse {
  line: Bilingual;
  chips: Bilingual[];
  scores: ConversaScores;
  tip: Bilingual | null;
  end: boolean;
  order: ConversaOrder;
}

export const CONVERSA_COPY = {
  daily: (npcName: string): Bilingual => ({
    pt: `Volta amanhã falar com o ${npcName}!`,
    en: `Come back tomorrow to chat with ${npcName} again — one Conversa per day.`,
  }),
  offline: { pt: 'modo offline', en: 'offline mode — scripted Carlos' } as Bilingual,
  private: { pt: 'Só você vê esta conversa', en: 'Private — only you see this' } as Bilingual,
  capEnd: { pt: 'Fim da conversa', en: "That's the 6-message limit" } as Bilingual,
  blocked: { pt: 'Essa mensagem não pode ser enviada.', en: "That message can't be sent." } as Bilingual,
  pass: { pt: 'Mandou bem!', en: 'Nice work!' } as Bilingual,
  almost: { pt: 'Quase!', en: 'Almost!' } as Bilingual,
  tryAgain: { pt: 'Tenta de novo', en: 'Try again' } as Bilingual,
  passLine: { pt: 'Isso aí. Volte sempre.', en: 'Nice work. Come back anytime.' } as Bilingual,
  almostLine: { pt: 'Quase! Na próxima, tenta mais português.', en: 'Almost — try more Portuguese next time.' } as Bilingual,
  tryAgainLine: { pt: 'Sem pressa. Quer tentar de novo depois?', en: 'No rush. Try again later?' } as Bilingual,
  sair: { pt: 'Sair', en: 'Leave' } as Bilingual,
  enviar: { pt: 'Enviar', en: 'Send' } as Bilingual,
  continuar: { pt: 'Continuar', en: 'Continue' } as Bilingual,
};

export function gradeFromScores(scores: ConversaScores, turnCount: number): ConversaGrade {
  if (turnCount < CONVERSA_MIN_MSGS_TO_SCORE) return 'tryAgain';
  const values = Object.values(scores) as Score03[];
  if (values.some((v) => v === 0)) return 'tryAgain';
  const avg = values.reduce<number>((a, b) => a + b, 0) / values.length;
  if (avg >= 2.3) return 'pass';
  if (avg >= 1.5) return 'almost';
  return 'tryAgain';
}

export function gradeRV(grade: ConversaGrade): number {
  return CONVERSA_RV[grade];
}

export function gradeCopy(grade: ConversaGrade): { label: Bilingual; line: Bilingual } {
  switch (grade) {
    case 'pass':
      return { label: CONVERSA_COPY.pass, line: CONVERSA_COPY.passLine };
    case 'almost':
      return { label: CONVERSA_COPY.almost, line: CONVERSA_COPY.almostLine };
    case 'tryAgain':
      return { label: CONVERSA_COPY.tryAgain, line: CONVERSA_COPY.tryAgainLine };
  }
}

export function metersFromHistory(history: { scores?: ConversaScores }[]): ConversaMeter {
  const sums: ConversaMeter = { portuguese: 0, grammar: 0, conversation: 0 };
  let count = 0;
  for (const h of history) {
    if (!h.scores) continue;
    count++;
    for (const axis of CONVERSA_AXES) {
      sums[axis.id] += h.scores[axis.id];
    }
  }
  if (count === 0) return { portuguese: 0, grammar: 0, conversation: 0 };
  return {
    portuguese: Math.round((sums.portuguese / count / 3) * 100),
    grammar: Math.round((sums.grammar / count / 3) * 100),
    conversation: Math.round((sums.conversation / count / 3) * 100),
  };
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const NUMBER_WORDS: [string, number][] = [];
for (let n = 0; n <= 40; n++) {
  NUMBER_WORDS.push([strip(numberPt(n)), n]);
}
NUMBER_WORDS.sort((a, b) => b[0].length - a[0].length);

const NUMBER_WORD_RE = NUMBER_WORDS.map(([w]) => w.replace(/ /g, '\\s+')).join('|');
const PRICE_RE = new RegExp(`r\\$\\s*(\\d+)|(?<![a-z0-9])(\\d+|${NUMBER_WORD_RE})\\s+(?:reais|real)(?![a-z])`, 'gi');

export function mentionedPrices(text: string): number[] {
  const norm = strip(text);
  const results: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = PRICE_RE.exec(norm))) {
    if (m[1]) {
      results.push(Number(m[1]));
    } else if (m[2]) {
      const n = Number(m[2]);
      if (!isNaN(n)) {
        results.push(n);
      } else {
        const found = NUMBER_WORDS.find(([w]) => strip(m![2]).includes(w));
        if (found) results.push(found[1]);
      }
    }
  }
  return results;
}

export function sanitizeConversaTurn(text: string, wordCap: number): string {
  const words = text.split(/\s+/);
  if (words.length > wordCap) {
    return words.slice(0, wordCap).join(' ') + '…';
  }
  const invalidPrices = mentionedPrices(text).filter((p) => !Object.values(PRICES).includes(p));
  let result = text;
  for (const p of invalidPrices) {
    result = result.replace(new RegExp(`\\b${p}\\s*(?:reais|real)?\\b`, 'gi'), '—');
  }
  return result;
}

export const CARLOS_AUTHORED_FALLBACK: { opener: Bilingual; beats: { trigger: RegExp; response: Bilingual; chips: Bilingual[] }[] } = {
  opener: { pt: 'Pois não. O que vai ser hoje?', en: "Yes? What'll it be today?" },
  beats: [
    {
      trigger: /pao|chapa|pãozinho/i,
      response: { pt: 'Pão na chapa saindo! E pra beber?', en: 'Grilled bread coming up! And to drink?' },
      chips: [
        { pt: 'Um café com leite, por favor.', en: 'A coffee with milk, please.' },
        { pt: 'Um suco de laranja, por favor.', en: 'An orange juice, please.' },
      ],
    },
    {
      trigger: /coxinha/i,
      response: { pt: 'Uma coxinha quentinha! E pra beber?', en: 'A warm coxinha! And to drink?' },
      chips: [
        { pt: 'Um café com leite, por favor.', en: 'A coffee with milk, please.' },
        { pt: 'Uma água, por favor.', en: 'A water, please.' },
      ],
    },
    {
      trigger: /pastel/i,
      response: { pt: 'Pastel de carne ou queijo? E pra beber?', en: 'Meat or cheese pastel? And to drink?' },
      chips: [
        { pt: 'De carne! E um café, por favor.', en: 'Meat! And a coffee, please.' },
        { pt: 'De queijo! E um suco, por favor.', en: 'Cheese! And a juice, please.' },
      ],
    },
    {
      trigger: /cafe|café|leite/i,
      response: { pt: 'Café com leite saindo! Pra comer aqui ou pra viagem?', en: 'Coffee with milk coming up! For here or to go?' },
      chips: [
        { pt: 'Pra comer aqui, por favor.', en: 'For here, please.' },
        { pt: 'Pra viagem, por favor.', en: 'To go, please.' },
      ],
    },
    {
      trigger: /suco|laranja/i,
      response: { pt: 'Suco de laranja fresquinho! Pra comer aqui ou pra viagem?', en: 'Fresh orange juice! For here or to go?' },
      chips: [
        { pt: 'Pra comer aqui, por favor.', en: 'For here, please.' },
        { pt: 'Pra viagem, por favor.', en: 'To go, please.' },
      ],
    },
    {
      trigger: /agua|água/i,
      response: { pt: 'Uma água geladinha! Pra comer aqui ou pra viagem?', en: 'Nice cold water! For here or to go?' },
      chips: [
        { pt: 'Pra comer aqui, por favor.', en: 'For here, please.' },
        { pt: 'Pra viagem, por favor.', en: 'To go, please.' },
      ],
    },
    {
      trigger: /aqui|comer aqui/i,
      response: { pt: 'Pronto! Tá na mão. Volte sempre!', en: 'Ready! Here you go. Come back anytime!' },
      chips: [
        { pt: 'Obrigado, Seu Carlos!', en: 'Thanks, Seu Carlos!' },
        { pt: 'Valeu!', en: 'Thanks!' },
      ],
    },
    {
      trigger: /viagem/i,
      response: { pt: 'Pronto! Tá na mão. Volte sempre!', en: 'Ready! Here you go. Come back anytime!' },
      chips: [
        { pt: 'Obrigado, Seu Carlos!', en: 'Thanks, Seu Carlos!' },
        { pt: 'Valeu!', en: 'Thanks!' },
      ],
    },
    {
      trigger: /obrigad|valeu|tchau|brigad/i,
      response: { pt: 'Volte sempre!', en: 'Come back anytime!' },
      chips: [],
    },
    {
      trigger: /bom dia|oi|ola|olá|tudo bem/i,
      response: { pt: 'Bom dia! Tudo bem? O que vai ser hoje?', en: "Good morning! All good? What'll it be today?" },
      chips: [
        { pt: 'Me vê um pão na chapa, por favor.', en: "I'll take grilled bread, please." },
        { pt: 'Um café com leite, por favor.', en: 'A coffee with milk, please.' },
      ],
    },
  ],
};

export function authoredFallbackTurn(text: string, history: ConversaLine[]): { response: Bilingual; chips: Bilingual[]; end: boolean } {
  const norm = strip(text);
  for (const beat of CARLOS_AUTHORED_FALLBACK.beats) {
    if (beat.trigger.test(norm)) {
      const isEnd = beat.chips.length === 0 || /volte sempre/i.test(beat.response.pt);
      return { response: beat.response, chips: beat.chips, end: isEnd };
    }
  }
  if (history.length === 0) {
    return {
      response: { pt: 'Não entendi bem. O que você quer pedir?', en: "I didn't quite get that. What would you like to order?" },
      chips: [
        { pt: 'Me vê um pão na chapa, por favor.', en: "I'll take grilled bread, please." },
        { pt: 'Um café com leite, por favor.', en: 'A coffee with milk, please.' },
      ],
      end: false,
    };
  }
  return {
    response: { pt: 'Hmm. Mais alguma coisa?', en: 'Hmm. Anything else?' },
    chips: [
      { pt: 'Só isso, obrigado.', en: "That's all, thanks." },
      { pt: 'Tchau!', en: 'Bye!' },
    ],
    end: false,
  };
}

export function buildCarlosSystemPrompt(subject: ConversaSubject, ctx: { playerName: string; pronoun: Pronoun; nameplate: Nameplate }): string {
  const kinship = ctx.pronoun === 'ela' ? 'minha filha' : ctx.pronoun === 'ele' ? 'meu filho' : null;
  const kinNote = kinship ? `You may say "${kinship}" once max, warmly, not every line.` : "Do not use kinship terms since the player's pronoun is unknown.";

  return `You are Seu Carlos, owner of Padaria do Seu Carlos in a São Paulo neighborhood. You are having a private Portuguese practice conversation with ${ctx.playerName}.

VOICE:
- Educated informal Paulista warmth: você / a gente / legal / tá / pra
- Primary acknowledgment: "Pois não" (never "Pode falar" as default)
- Short lines: max ${CONVERSA_WORD_CAP[ctx.nameplate]} words per response
- Patient teacher-by-doing; never mock accents or grammar
- Praise briefly: Isso aí / Pronto / Tá na mão
- ${kinNote}
- Exit warmth: Volte sempre

SUBJECT: ${subject.title.pt} — ${subject.goal.pt}
KEY PHRASES: ${subject.lexemes.join(', ')}

RULES:
- Respond ONLY in Brazilian Portuguese (no English in your responses)
- Stay on subject (${subject.title.pt}); gently redirect if player drifts: "Hmm. Mas e o café da manhã — o que vai ser?"
- Never discuss: alcohol, dating, politics, religion
- Never invent prices not in the padaria menu: pão na chapa R$6, coxinha R$7, pastel R$8, café R$4, café com leite R$5, suco de laranja R$8, água R$3
- If player uses English, don't translate back — model the Portuguese answer instead
- Keep conversation natural, 4-8 turns total

OUTPUT FORMAT (JSON):
{
  "response": "Your Portuguese response here",
  "chips": ["Suggested reply 1 in Portuguese", "Suggested reply 2 in Portuguese"],
  "scores": {
    "portuguese": 0-3,
    "grammar": 0-3,
    "conversation": 0-3
  },
  "tip": "One short tip in Portuguese if any score is 1 or below, else null",
  "end": false
}

SCORING (for the player's message):
- portuguese: 3=natural BR informal, 2=understandable but stiff, 1=heavy English/Spanglish, 0=gibberish/blocked
- grammar: 3=A1 forms solid, 2=small slips, 1=broken but on topic, 0=unusable
- conversation: 3=advances goal, 2=soft side path, 1=drift, 0=off-topic/unsafe

Set "end": true when the conversation reaches a natural closing (e.g., after payment/thanks exchange) or if player says goodbye.`;
}

export function parseAiResponse(raw: string): ConversaTurnResponse | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    const response = typeof parsed.response === 'string' ? parsed.response : '';
    const chips = Array.isArray(parsed.chips)
      ? parsed.chips.filter((c: unknown) => typeof c === 'string').map((c: string) => ({ pt: c, en: '' }))
      : [];
    const scores: ConversaScores = {
      portuguese: Math.max(0, Math.min(3, Number(parsed.scores?.portuguese) || 2)) as Score03,
      grammar: Math.max(0, Math.min(3, Number(parsed.scores?.grammar) || 2)) as Score03,
      conversation: Math.max(0, Math.min(3, Number(parsed.scores?.conversation) || 2)) as Score03,
    };
    const tip = typeof parsed.tip === 'string' && parsed.tip ? { pt: parsed.tip, en: '' } : null;
    const end = parsed.end === true;

    return {
      line: { pt: response, en: '' },
      chips,
      scores,
      tip,
      end,
      order: {},
    };
  } catch {
    return null;
  }
}

export function conversaDateKey(): string {
  const spTime = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return spTime.split(',')[0];
}

export function canStartConversa(
  npcId: NpcId,
  daily: { conversaClears?: Record<string, string>; conversaRvGranted?: Record<string, string> },
  dailyCapOn: boolean,
): { allowed: boolean; reason?: 'daily_cap' | 'unavailable' } {
  const cast = CONVERSA_CAST[npcId];
  if (!cast || !cast.enabled) {
    return { allowed: false, reason: 'unavailable' };
  }
  if (dailyCapOn) {
    const todayKey = conversaDateKey();
    const lastClear = daily.conversaClears?.[npcId];
    if (lastClear === todayKey) {
      return { allowed: false, reason: 'daily_cap' };
    }
  }
  return { allowed: true };
}

export function shouldGrantRV(
  npcId: NpcId,
  daily: { conversaRvGranted?: Record<string, string> },
  rvOncePerDay: boolean,
): boolean {
  if (!rvOncePerDay) return true;
  const todayKey = conversaDateKey();
  const lastGrant = daily.conversaRvGranted?.[npcId];
  return lastGrant !== todayKey;
}
