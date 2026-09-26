import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  classifyChat,
  CONVERSA_CAST,
  CONVERSA_COPY,
  CONVERSA_MAX_PLAYER_MSGS,
  CONVERSA_SUBJECTS,
  CONVERSA_WORD_CAP,
  canStartConversa,
  gradeFromScores,
  gradeRV,
  gradeCopy,
  metersFromHistory,
  shouldGrantRV,
  type ConversaLine,
  type ConversaMeter,
  type ConversaScores,
  type NpcId,
  type Pronoun,
  type Nameplate,
  type ConversaGrade,
  type Bilingual,
} from '@tudobem/shared';
import { conversaTurn, authoredConversaTurn, isXaiReady, getAuthoredOpener } from './services/xai.js';

const DAILY_CAP_ON = (process.env.CONVERSA_DAILY_CAP ?? 'off').toLowerCase() === 'on';
const RV_ONCE_PER_DAY = (process.env.CONVERSA_RV_ONCE_PER_DAY ?? 'on').toLowerCase() !== 'off';

interface ConversaStartRequest {
  action: 'start';
  npcId: NpcId;
  subjectId?: string;
  playerName: string;
  pronoun: Pronoun;
  nameplate: Nameplate;
  playerId: string;
  daily: {
    conversaClears?: Record<string, string>;
    conversaRvGranted?: Record<string, string>;
  };
}

interface ConversaTurnRequestBody {
  action: 'turn';
  npcId: NpcId;
  subjectId: string;
  playerName: string;
  pronoun: Pronoun;
  nameplate: Nameplate;
  playerId: string;
  text: string;
  history: ConversaLine[];
  turn: number;
  daily: {
    conversaClears?: Record<string, string>;
    conversaRvGranted?: Record<string, string>;
  };
}

interface ConversaEndRequest {
  action: 'end';
  npcId: NpcId;
  playerId: string;
  turnCount: number;
  scores: ConversaScores;
  daily: {
    conversaClears?: Record<string, string>;
    conversaRvGranted?: Record<string, string>;
  };
}

type ConversaRequest = ConversaStartRequest | ConversaTurnRequestBody | ConversaEndRequest;

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
}

interface ConversaEndResponse {
  phase: 'end';
  grade: ConversaGrade;
  gradeLabel: Bilingual;
  payout: number;
  grantRv: boolean;
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

type ConversaResponse = ConversaStartResponse | ConversaTurnResponse | ConversaEndResponse | ConversaBlockedResponse;

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseDailyCap(req: IncomingMessage): boolean {
  const url = new URL(req.url ?? '/', 'http://x');
  const param = url.searchParams.get('conversaDaily');
  if (param === 'off') return false;
  return DAILY_CAP_ON;
}

export async function handleConversaApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  let body: ConversaRequest;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw);
  } catch {
    json(res, 400, { error: 'Invalid JSON' });
    return;
  }

  const dailyCapOn = parseDailyCap(req);

  if (body.action === 'start') {
    return handleStart(body, dailyCapOn, res);
  }

  if (body.action === 'turn') {
    return handleTurn(body, res);
  }

  if (body.action === 'end') {
    return handleEnd(body, res);
  }

  json(res, 400, { error: 'Unknown action' });
}

async function handleStart(req: ConversaStartRequest, dailyCapOn: boolean, res: ServerResponse): Promise<void> {
  const check = canStartConversa(req.npcId, req.daily, dailyCapOn);
  if (!check.allowed) {
    const cast = CONVERSA_CAST[req.npcId];
    const npcName = cast?.name ?? req.npcId;
    const response: ConversaBlockedResponse = {
      phase: 'blocked',
      reason: check.reason === 'daily_cap' ? 'daily' : 'unavailable',
      pt: check.reason === 'daily_cap' ? CONVERSA_COPY.daily(npcName).pt : 'Conversa indisponível.',
      en: check.reason === 'daily_cap' ? CONVERSA_COPY.daily(npcName).en : 'Conversa unavailable.',
    };
    json(res, 200, response);
    return;
  }

  const cast = CONVERSA_CAST[req.npcId]!;
  const subject = CONVERSA_SUBJECTS[req.subjectId ?? ''] ?? cast.subjects[0];
  const aiReady = await isXaiReady();
  const mode = aiReady ? 'ai' : 'authored';

  let opener: Bilingual;
  let chips: Bilingual[];

  if (aiReady && subject) {
    const randomOpener = subject.seedOpeners[Math.floor(Math.random() * subject.seedOpeners.length)];
    opener = { pt: randomOpener, en: '' };
    chips = [
      { pt: 'Me vê um pão na chapa, por favor.', en: "I'll take grilled bread, please." },
      { pt: 'Um café com leite, por favor.', en: 'A coffee with milk, please.' },
      { pt: 'Ainda tô olhando.', en: "I'm still looking." },
    ];
  } else {
    const authored = getAuthoredOpener();
    opener = { pt: authored.line, en: "Yes? What'll it be today?" };
    chips = authored.chips.map((pt) => ({ pt, en: '' }));
  }

  const response: ConversaStartResponse = {
    phase: 'open',
    npc: req.npcId,
    npcName: cast.name,
    subject: { id: subject.id, title: subject.title, goal: subject.goal },
    mode,
    offline: !aiReady,
    line: opener,
    chips,
    turn: 0,
    maxTurns: CONVERSA_MAX_PLAYER_MSGS,
  };

  json(res, 200, response);
}

async function handleTurn(req: ConversaTurnRequestBody, res: ServerResponse): Promise<void> {
  const verdict = classifyChat(req.text);
  if (verdict.action === 'block' || verdict.action === 'escalate') {
    const response: ConversaBlockedResponse = {
      phase: 'blocked',
      reason: 'safety',
      pt: verdict.note?.pt ?? CONVERSA_COPY.blocked.pt,
      en: verdict.note?.en ?? CONVERSA_COPY.blocked.en,
    };
    json(res, 200, response);
    return;
  }

  const cast = CONVERSA_CAST[req.npcId];
  if (!cast || !cast.enabled) {
    json(res, 400, { error: 'NPC not available' });
    return;
  }

  const aiReady = await isXaiReady();
  let turnResponse;

  if (aiReady) {
    turnResponse = await conversaTurn({
      npcId: req.npcId,
      subjectId: req.subjectId,
      playerName: req.playerName,
      pronoun: req.pronoun,
      nameplate: req.nameplate,
      history: req.history,
      text: req.text,
      turn: req.turn,
      maxTurns: CONVERSA_MAX_PLAYER_MSGS,
    });
  }

  if (!turnResponse) {
    turnResponse = authoredConversaTurn({
      npcId: req.npcId,
      subjectId: req.subjectId,
      playerName: req.playerName,
      pronoun: req.pronoun,
      nameplate: req.nameplate,
      history: req.history,
      text: req.text,
      turn: req.turn,
      maxTurns: CONVERSA_MAX_PLAYER_MSGS,
    });
  }

  const historyWithScores: { scores?: ConversaScores }[] = req.history.map(() => ({ scores: undefined }));
  historyWithScores.push({ scores: turnResponse.scores });
  const meter = metersFromHistory(historyWithScores);

  const response: ConversaTurnResponse = {
    phase: 'turn',
    mode: aiReady ? 'ai' : 'authored',
    offline: !aiReady,
    line: turnResponse.line,
    chips: turnResponse.chips,
    scores: turnResponse.scores,
    meter,
    tip: turnResponse.tip,
    turn: req.turn,
    maxTurns: CONVERSA_MAX_PLAYER_MSGS,
    end: turnResponse.end,
  };

  json(res, 200, response);
}

async function handleEnd(req: ConversaEndRequest, res: ServerResponse): Promise<void> {
  const grade = gradeFromScores(req.scores, req.turnCount);
  const rv = gradeRV(grade);
  const copy = gradeCopy(grade);

  const grantRv = rv > 0 && shouldGrantRV(req.npcId, req.daily, RV_ONCE_PER_DAY);

  const todayKey = new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).split(',')[0];
  const updateDaily: ConversaEndResponse['updateDaily'] = {};

  updateDaily.conversaClears = { ...req.daily.conversaClears, [req.npcId]: todayKey };

  if (grantRv) {
    updateDaily.conversaRvGranted = { ...req.daily.conversaRvGranted, [req.npcId]: todayKey };
  }

  const response: ConversaEndResponse = {
    phase: 'end',
    grade,
    gradeLabel: copy.label,
    payout: grantRv ? rv : 0,
    grantRv,
    updateDaily,
  };

  json(res, 200, response);
}
