import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  CONVERSA_CAST,
  CONVERSA_COPY,
  CONVERSA_MAX_PLAYER_MSGS,
  CONVERSA_SUBJECTS,
  CONVERSA_WORD_CAP,
  canStartConversa,
  conversaDateKey,
  gateConversaPlayerLine,
  gradeFromScores,
  gradeRV,
  gradeCopy,
  metersFromHistory,
  type RvNote,
  pickConversaOpener,
  presentConversaTurn,
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
import type { ProfileStore } from './store.js';

/** Daily cap stays off unless CONVERSA_DAILY_CAP=on. Read per request so tests can flip it. */
function dailyCapFromEnv(): boolean {
  return (process.env.CONVERSA_DAILY_CAP ?? 'off').toLowerCase() === 'on';
}

/** One RV grant per NPC per São Paulo day, unless CONVERSA_RV_ONCE_PER_DAY=off. */
function rvOnceFromEnv(): boolean {
  return (process.env.CONVERSA_RV_ONCE_PER_DAY ?? 'on').toLowerCase() !== 'off';
}

export interface ConversaApiDeps {
  /** Player profiles (file store). Grant flags and RV coins live here, not only in the request body. */
  store?: ProfileStore;
  /** Tell the live session its profile changed (coins / daily). */
  onProfileChanged?: (playerId: string) => void;
  /**
   * When set, the player is whoever the session cookie says (the body's playerId is ignored), and
   * requests without a signed-in profile get 401. Unset in solo-style/test setups.
   */
  playerIdFor?: (req: IncomingMessage) => string | undefined;
}

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
  /** Omitted by a bad client. Never assume it is an array. */
  history?: ConversaLine[];
  turn: number;
  priorChips?: string[];
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
  /** Set when Gate A warns. The player line was delivered verbatim. */
  notice?: { level: 'warn'; pt: string; en: string };
}

interface ConversaEndResponse {
  phase: 'end';
  grade: ConversaGrade;
  gradeLabel: Bilingual;
  payout: number;
  grantRv: boolean;
  /** Set when the grade would have paid but today's RV for this NPC was already granted. */
  rvNote?: RvNote;
  /** Absolute coin balance after a persisted grant. Omitted when the player has no profile. */
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
  if (param === 'on') return true;
  return dailyCapFromEnv();
}

type DailyFlags = { conversaClears?: Record<string, string>; conversaRvGranted?: Record<string, string> };

/** Profile daily is the source of truth. The request body is only a fallback when there is no profile. */
function resolveDaily(store: ProfileStore | undefined, playerId: string | undefined, clientDaily: DailyFlags | undefined): DailyFlags {
  const fallback = clientDaily ?? {};
  if (!store || !playerId) return fallback;
  const p = store.get(playerId);
  if (!p) return fallback;
  return {
    conversaClears: { ...(p.daily.conversaClears ?? {}) },
    conversaRvGranted: { ...(p.daily.conversaRvGranted ?? {}) },
  };
}

export async function handleConversaApi(req: IncomingMessage, res: ServerResponse, deps: ConversaApiDeps = {}): Promise<void> {
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
  if (!body || typeof body !== 'object') {
    json(res, 400, { error: 'Invalid JSON' });
    return;
  }

  if (deps.playerIdFor) {
    const playerId = deps.playerIdFor(req);
    if (!playerId) {
      json(res, 401, { error: 'unauthenticated' });
      return;
    }
    body.playerId = playerId;
  }

  const dailyCapOn = parseDailyCap(req);

  if (body.action === 'start') {
    return handleStart(body, dailyCapOn, res, deps);
  }

  if (body.action === 'turn') {
    return handleTurn(body, res);
  }

  if (body.action === 'end') {
    return handleEnd(body, res, deps);
  }

  json(res, 400, { error: 'Unknown action' });
}

async function handleStart(req: ConversaStartRequest, dailyCapOn: boolean, res: ServerResponse, deps: ConversaApiDeps): Promise<void> {
  const daily = resolveDaily(deps.store, req.playerId, req.daily);
  const check = canStartConversa(req.npcId, daily, dailyCapOn);
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
  if (!subject) {
    json(res, 200, { phase: 'blocked', reason: 'unavailable', pt: 'Conversa indisponível.', en: 'Conversa unavailable.' });
    return;
  }
  const aiReady = await isXaiReady();
  const mode = aiReady ? 'ai' : 'authored';
  const picked = aiReady ? pickConversaOpener(subject) : getAuthoredOpener(subject);
  const presented = presentConversaTurn({
    line: { pt: picked.line, en: '' },
    chips: picked.chips.map((pt) => ({ pt, en: '' })),
    scores: { portuguese: 2, grammar: 2, conversation: 2 },
    tip: null,
    end: false,
    order: {},
  });
  const opener: Bilingual = presented.line;
  const chips: Bilingual[] = presented.chips;

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
  const gate = gateConversaPlayerLine(req.text);
  if (!gate.deliver) {
    const response: ConversaBlockedResponse = {
      phase: 'blocked',
      reason: 'safety',
      pt: gate.notice?.pt ?? CONVERSA_COPY.blocked.pt,
      en: gate.notice?.en ?? CONVERSA_COPY.blocked.en,
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
  const priorChips = Array.isArray(req.priorChips) ? req.priorChips.filter((c): c is string => typeof c === 'string') : [];
  const turnReq = {
    npcId: req.npcId,
    subjectId: req.subjectId,
    playerName: req.playerName,
    pronoun: req.pronoun,
    nameplate: req.nameplate,
    history: req.history ?? [],
    text: gate.text,
    turn: req.turn,
    maxTurns: CONVERSA_MAX_PLAYER_MSGS,
    priorChips,
  };
  let turnResponse;

  if (aiReady) {
    turnResponse = await conversaTurn(turnReq);
  }

  if (!turnResponse) {
    turnResponse = authoredConversaTurn(turnReq);
  }

  turnResponse = presentConversaTurn(turnResponse, priorChips);

  const historyWithScores: { scores?: ConversaScores }[] = (req.history ?? []).map(() => ({ scores: undefined }));
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
    ...(gate.notice?.level === 'warn' ? { notice: { level: 'warn' as const, pt: gate.notice.pt, en: gate.notice.en } } : {}),
  };

  json(res, 200, response);
}

async function handleEnd(req: ConversaEndRequest, res: ServerResponse, deps: ConversaApiDeps): Promise<void> {
  const daily = resolveDaily(deps.store, req.playerId, req.daily);
  const grade = gradeFromScores(req.scores, req.turnCount);
  const rv = gradeRV(grade);
  const copy = gradeCopy(grade);

  const grantRv = rv > 0 && shouldGrantRV(req.npcId, daily, rvOnceFromEnv());
  const rvNote: RvNote | undefined = !grantRv && rv > 0 ? 'already_today' : undefined;

  const todayKey = conversaDateKey();
  const updateDaily: ConversaEndResponse['updateDaily'] = {
    conversaClears: { ...daily.conversaClears, [req.npcId]: todayKey },
  };

  if (grantRv) {
    updateDaily.conversaRvGranted = { ...daily.conversaRvGranted, [req.npcId]: todayKey };
  }

  let coins: number | undefined;
  const profile = deps.store && req.playerId ? deps.store.get(req.playerId) : undefined;
  if (profile && deps.store) {
    if (grantRv) profile.coins += rv;
    profile.daily = {
      ...profile.daily,
      conversaClears: updateDaily.conversaClears,
      conversaRvGranted: grantRv ? updateDaily.conversaRvGranted : profile.daily.conversaRvGranted,
    };
    deps.store.flush();
    coins = profile.coins;
    deps.onProfileChanged?.(req.playerId);
  }

  const response: ConversaEndResponse = {
    phase: 'end',
    grade,
    gradeLabel: copy.label,
    payout: grantRv ? rv : 0,
    grantRv,
    ...(rvNote ? { rvNote } : {}),
    ...(coins !== undefined ? { coins } : {}),
    updateDaily,
  };

  json(res, 200, response);
}
