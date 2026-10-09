import fs from 'node:fs';
import path from 'node:path';
import {
  buildCarlosSystemPrompt,
  CONVERSA_CAST,
  CONVERSA_SUBJECTS,
  CONVERSA_WORD_CAP,
  parseAiResponse,
  sanitizeConversaTurn,
  filterNpcLine,
  authoredFallbackTurn,
  pickConversaOpener,
  presentConversaTurn,
  type ConversaLine,
  type ConversaTurnRequest,
  type ConversaTurnResponse,
  type ConversaScores,
  type Score03,
  type ConversaSubject,
} from '@tudobem/shared';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const SECRETS_PATH = '/home/box/agent-data/box-secrets.json';

let cachedApiKey: string | null = null;

function getApiKey(): string | null {
  if (cachedApiKey !== null) return cachedApiKey || null;

  const envKey = process.env.XAI_API_KEY;
  if (envKey) {
    cachedApiKey = envKey;
    return envKey;
  }

  try {
    if (fs.existsSync(SECRETS_PATH)) {
      const secrets = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf-8'));
      const key = secrets?.card?.XAI_API_KEY;
      if (key && typeof key === 'string') {
        cachedApiKey = key;
        return key;
      }
    }
  } catch {
    // Ignore errors reading secrets
  }

  cachedApiKey = '';
  return null;
}

/** Current xAI cheap-quality default (CEO: grok-4-1-fast or equivalent; list has no 4-1-fast). */
export const DEFAULT_CONVERSA_MODEL = 'grok-4.3';
const MODEL = process.env.CONVERSA_MODEL || DEFAULT_CONVERSA_MODEL;
const REASONING_EFFORT = process.env.CONVERSA_REASONING_EFFORT || 'none';

/** Prompt bounds for a Conversa turn: lines of history and characters per line. */
const MAX_PROMPT_LINES = 12;
const MAX_PROMPT_LINE_CHARS = 300;

export async function isXaiReady(): Promise<boolean> {
  return !!getApiKey();
}

interface XaiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callXai(messages: XaiMessage[], timeoutMs = 15000): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      max_tokens: 512,
      temperature: 0.85,
    };

    if (REASONING_EFFORT !== 'none') {
      body.reasoning_effort = REASONING_EFFORT;
    }

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[xai] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      console.error('[xai] Request timed out');
    } else {
      console.error('[xai] Request failed:', e);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function conversaTurn(req: ConversaTurnRequest): Promise<ConversaTurnResponse | null> {
  const cast = CONVERSA_CAST[req.npcId];
  if (!cast || !cast.enabled) return null;

  const subject = CONVERSA_SUBJECTS[req.subjectId] ?? cast.subjects[0];
  if (!subject) return null;

  const systemPrompt = buildCarlosSystemPrompt(
    subject,
    {
      playerName: req.playerName,
      pronoun: req.pronoun,
      nameplate: req.nameplate,
      minute: req.minute,
    },
    req.memory,
    cast.persona,
  );

  const messages: XaiMessage[] = [{ role: 'system', content: systemPrompt }];

  const last = req.history[req.history.length - 1];
  const history = last?.who === 'player' && last.pt === req.text ? req.history.slice(0, -1) : req.history;
  // Bounded prompt: the last few lines only, each clipped (the caller passes the server's own transcript).
  for (const line of history.slice(-MAX_PROMPT_LINES)) {
    messages.push({
      role: line.who === 'player' ? 'user' : 'assistant',
      content: line.pt.slice(0, MAX_PROMPT_LINE_CHARS),
    });
  }

  messages.push({ role: 'user', content: req.text.slice(0, MAX_PROMPT_LINE_CHARS) });

  const prior = (req.priorChips ?? []).filter((c) => c.trim()).slice(0, 4);
  if (prior.length) {
    messages.push({
      role: 'system',
      content: `The player already saw these suggested replies. Do not offer the same set again: ${prior.join(' | ')}`,
    });
  }
  messages.push({
    role: 'system',
    content: `Reply to exactly what the player just said (${JSON.stringify(req.text.slice(0, 180))}). Do not answer with a stock "Pois não. Pra cá ou viagem?" unless that is the real missing detail. JSON only.`,
  });

  const isLastTurn = req.turn >= req.maxTurns;

  if (isLastTurn) {
    messages.push({
      role: 'system',
      content: 'This is the last turn. The player has reached the message limit. End the conversation warmly with "Volte sempre!" and set "end": true.',
    });
  }

  const rawResponse = await callXai(messages);
  if (!rawResponse) return null;

  const parsed = parseAiResponse(rawResponse);
  if (!parsed) {
    console.error('[xai] Failed to parse response:', rawResponse.slice(0, 200));
    return null;
  }

  const wordCap = CONVERSA_WORD_CAP[req.nameplate];
  parsed.line.pt = sanitizeConversaTurn(parsed.line.pt, wordCap);
  if (!parsed.line.pt || !filterNpcLine(parsed.line.pt)) {
    return authoredConversaTurn(req);
  }

  if (isLastTurn) {
    parsed.end = true;
  }

  return presentConversaTurn(parsed, req.priorChips ?? [], req.minute, req.npcId);
}

/** System prompt for the one-sentence NPC memory summary (never stored raw; the caller vets the answer). */
export const MEMORY_SUMMARY_SYSTEM_PROMPT = `You write a short memory note for an NPC in a Portuguese-learning game. The NPC is a padaria owner in São Paulo.
Read the short conversation and write exactly ONE sentence in Brazilian Portuguese, in the third person about the customer, saying only what they ordered or what the chat was about. Example: "Pediu um café com leite e uma coxinha pra viagem."
Rules:
- At most 120 characters. One sentence. Plain text only: no quotes, no markdown, no emoji.
- Do not copy the customer's words. Do not quote them.
- No names, contact details, or personal data. Nothing about alcohol, dating, politics, or religion.
- If nothing was ordered, say what the chat was about, for example "Conversou sobre café da manhã."`;

/**
 * One-sentence PT summary of a finished Conversa, or null (no key, error, or over `timeoutMs`).
 * Small, non-streaming, and the caller never waits on it to end the Conversa.
 */
export async function summarizeConversa(input: { npcName: string; subjectTitle: string; lines: ConversaLine[] }, timeoutMs = 4000): Promise<string | null> {
  const transcript = input.lines
    .slice(-14)
    .map((l) => `${l.who === 'player' ? 'Cliente' : input.npcName}: ${l.pt.slice(0, 240)}`)
    .join('\n');
  const raw = await callXai(
    [
      { role: 'system', content: MEMORY_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: `Assunto: ${input.subjectTitle}\n\nConversa:\n${transcript}\n\nUma frase:` },
    ],
    timeoutMs,
  );
  const first = raw?.trim().split(/\r?\n/)[0]?.trim();
  return first || null;
}

export function authoredConversaTurn(req: ConversaTurnRequest): ConversaTurnResponse {
  const { response, chips, end } = authoredFallbackTurn(req.text, req.history, req.npcId);

  const scores: ConversaScores = {
    portuguese: 2 as Score03,
    grammar: 2 as Score03,
    conversation: 2 as Score03,
  };

  const isLastTurn = req.turn >= req.maxTurns;

  return presentConversaTurn(
    {
      line: response,
      chips,
      scores,
      tip: null,
      end: end || isLastTurn,
      order: {},
    },
    req.priorChips ?? [],
    req.minute,
    req.npcId,
  );
}

/** Authored start: rotate seed openers and chip sets instead of one fixed line. */
export function getAuthoredOpener(subject: ConversaSubject = CONVERSA_SUBJECTS.cafe_da_manha): { line: string; chips: string[] } {
  return pickConversaOpener(subject);
}
