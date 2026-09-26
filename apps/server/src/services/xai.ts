import fs from 'node:fs';
import path from 'node:path';
import {
  buildCarlosSystemPrompt,
  CARLOS_AUTHORED_FALLBACK,
  CONVERSA_CAST,
  CONVERSA_SUBJECTS,
  CONVERSA_WORD_CAP,
  parseAiResponse,
  sanitizeConversaTurn,
  filterNpcLine,
  authoredFallbackTurn,
  type ConversaTurnRequest,
  type ConversaTurnResponse,
  type ConversaScores,
  type Score03,
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
      temperature: 0.7,
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

  const systemPrompt = buildCarlosSystemPrompt(subject, {
    playerName: req.playerName,
    pronoun: req.pronoun,
    nameplate: req.nameplate,
  });

  const messages: XaiMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const line of req.history) {
    messages.push({
      role: line.who === 'player' ? 'user' : 'assistant',
      content: line.pt,
    });
  }

  messages.push({ role: 'user', content: req.text });

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

  return parsed;
}

export function authoredConversaTurn(req: ConversaTurnRequest): ConversaTurnResponse {
  const { response, chips, end } = authoredFallbackTurn(req.text, req.history);

  const scores: ConversaScores = {
    portuguese: 2 as Score03,
    grammar: 2 as Score03,
    conversation: 2 as Score03,
  };

  const isLastTurn = req.turn >= req.maxTurns;

  return {
    line: response,
    chips,
    scores,
    tip: null,
    end: end || isLastTurn,
    order: {},
  };
}

export function getAuthoredOpener(): { line: string; chips: string[] } {
  const opener = CARLOS_AUTHORED_FALLBACK.opener.pt;
  const firstBeat = CARLOS_AUTHORED_FALLBACK.beats.find((b) => /bom dia|oi/i.test(b.trigger.source));
  return {
    line: opener,
    chips: firstBeat?.chips.map((c) => c.pt) ?? ['Me vê um pão na chapa, por favor.', 'Um café com leite, por favor.'],
  };
}
