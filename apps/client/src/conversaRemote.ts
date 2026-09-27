import type {
  Bilingual,
  ConversaGrade,
  ConversaLine,
  ConversaMeter,
  ConversaScores,
  Nameplate,
  NpcId,
  Pronoun,
} from '@tudobem/shared';

const API_BASE = import.meta.env.VITE_CONVERSA_API ?? '/api/conversa';

interface ConversaStartResponse {
  phase: 'open';
  npc: NpcId;
  npcName: string;
  subject: { id: string; title: Bilingual; goal: Bilingual };
  mode: 'ai' | 'authored';
  offline: boolean;
  line: Bilingual;
  chips: Bilingual[];
  turn: number;
  maxTurns: number;
}

interface ConversaTurnResponse {
  phase: 'turn';
  mode: 'ai' | 'authored';
  offline: boolean;
  line: Bilingual;
  chips: Bilingual[];
  scores: ConversaScores;
  meter: ConversaMeter;
  tip: Bilingual | null;
  turn: number;
  maxTurns: number;
  end: boolean;
  /** Gate A warn. The player line was kept verbatim. */
  notice?: { level: 'warn'; pt: string; en: string };
}

interface ConversaEndResponse {
  phase: 'end';
  grade: ConversaGrade;
  gradeLabel: Bilingual;
  payout: number;
  grantRv: boolean;
  /** Absolute RV balance when the server persisted the grant. */
  coins?: number;
  updateDaily: {
    conversaClears?: Record<string, string>;
    conversaRvGranted?: Record<string, string>;
  };
}

interface ConversaBlockedResponse {
  phase: 'blocked';
  reason: 'daily' | 'unavailable' | 'safety';
  pt: string;
  en: string;
}

export type ConversaApiResponse = ConversaStartResponse | ConversaTurnResponse | ConversaEndResponse | ConversaBlockedResponse;

export interface ConversaDaily {
  conversaClears?: Record<string, string>;
  conversaRvGranted?: Record<string, string>;
}

async function callApi(body: unknown): Promise<ConversaApiResponse> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function startConversa(
  npcId: NpcId,
  playerName: string,
  pronoun: Pronoun,
  nameplate: Nameplate,
  playerId: string,
  daily: ConversaDaily,
  subjectId?: string,
): Promise<ConversaApiResponse> {
  return callApi({
    action: 'start',
    npcId,
    subjectId,
    playerName,
    pronoun,
    nameplate,
    playerId,
    daily,
  });
}

export async function sendConversaTurn(
  npcId: NpcId,
  subjectId: string,
  playerName: string,
  pronoun: Pronoun,
  nameplate: Nameplate,
  playerId: string,
  text: string,
  history: ConversaLine[],
  turn: number,
  daily: ConversaDaily,
  priorChips: string[] = [],
): Promise<ConversaApiResponse> {
  return callApi({
    action: 'turn',
    npcId,
    subjectId,
    playerName,
    pronoun,
    nameplate,
    playerId,
    text,
    history,
    turn,
    daily,
    priorChips,
  });
}

export async function endConversa(
  npcId: NpcId,
  playerId: string,
  turnCount: number,
  scores: ConversaScores,
  daily: ConversaDaily,
): Promise<ConversaApiResponse> {
  return callApi({
    action: 'end',
    npcId,
    playerId,
    turnCount,
    scores,
    daily,
  });
}
