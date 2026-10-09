import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  CONVERSA_CAST,
  CONVERSA_COPY,
  CONVERSA_MAX_PLAYER_MSGS,
  CONVERSA_SUBJECTS,
  addCalendarDays,
  canStartConversa,
  conversaDateKey,
  gateConversaPlayerLine,
  gradeFromScores,
  gradeRV,
  gradeCopy,
  hearts,
  metersFromHistory,
  subjectOpen,
  type RvNote,
  pickConversaOpener,
  presentConversaTurn,
  shouldGrantRV,
  type ConversaMeter,
  type ConversaScores,
  type NpcId,
  type Pronoun,
  type Nameplate,
  type ConversaGrade,
  type ConversaOrder,
  type Bilingual,
} from '@tudobem/shared';
import { conversaTurn, authoredConversaTurn, isXaiReady, getAuthoredOpener } from './services/xai.js';
import type { ConversaMemory } from './conversaMemory.js';
import { ConversaSessions, finalScores } from './conversaSessions.js';
import { originAllowed } from './auth.js';
import type { ProfileStore } from './store.js';

/** Daily cap stays off unless CONVERSA_DAILY_CAP=on. Read per request so tests can flip it. */
function dailyCapFromEnv(): boolean {
  return (process.env.CONVERSA_DAILY_CAP ?? 'off').toLowerCase() === 'on';
}

/** Hearts with an NPC at which it remembers the player (BOND_MILESTONES: 'uses_name'). */
export const MEMORY_MIN_HEARTS = 2;

/** Largest request body read (bytes). A turn is a short line; anything bigger is refused before parsing. */
export const CONVERSA_MAX_BODY = 16 * 1024;
/** Longest player line a turn accepts (characters). */
export const CONVERSA_MAX_TEXT = 280;
/** Longest client `history` accepted (it is validated but no longer used: the server keeps its own transcript). */
const MAX_HISTORY = CONVERSA_MAX_PLAYER_MSGS * 2 + 4;

/** True once the player's bond with this NPC reaches 2 hearts (the "uses your name and remembers you" milestone). */
function memoryIfBonded(store: ProfileStore | undefined, playerId: string | undefined, npc: NpcId): boolean {
  if (!store || !playerId) return false;
  return hearts(store.get(playerId)?.bond?.[npc] ?? 0) >= MEMORY_MIN_HEARTS;
}

/** The asked-for subject when it exists and the player's hearts with this NPC open it (a locked one falls back to the default). */
function openSubject(store: ProfileStore | undefined, playerId: string | undefined, npc: NpcId, subjectId: string | undefined) {
  const subject = subjectId && Object.hasOwn(CONVERSA_SUBJECTS, subjectId) ? CONVERSA_SUBJECTS[subjectId] : undefined;
  if (!subject) return undefined;
  const h = store && playerId ? hearts(store.get(playerId)?.bond?.[npc] ?? 0) : 0;
  return subjectOpen(subject, h) ? subject : undefined;
}

/** One RV grant per NPC per São Paulo day, unless CONVERSA_RV_ONCE_PER_DAY=off. */
function rvOnceFromEnv(): boolean {
  return (process.env.CONVERSA_RV_ONCE_PER_DAY ?? 'on').toLowerCase() !== 'off';
}

/** Running Conversas when the caller wires none (the app's single instance). */
const defaultSessions = new ConversaSessions();

export interface ConversaApiDeps {
  /** Player profiles (file store). Grant flags and RV coins live here, not only in the request body. */
  store?: ProfileStore;
  /** Tell the live session its profile changed (coins / daily). */
  onProfileChanged?: (playerId: string) => void;
  /** A Conversa ended for this player (recados: counts as a talk, may carry an order, a 'pass' earns bond). */
  onConversaEnd?: (playerId: string, npc: NpcId, grade: ConversaGrade, order?: ConversaOrder) => void;
  /** A line moved through the Conversa: the NPC's reply is `seen`, a player line that passed the gate is `used` (Caderno). */
  onConversaLine?: (playerId: string, who: 'npc' | 'player', pt: string) => void;
  /** NPC memory: keeps a vetted PT summary per NPC and feeds it to the next Conversa's prompt. */
  memory?: ConversaMemory;
  /**
   * When set, the player is whoever the session cookie says (the body's playerId is ignored), and
   * requests without a signed-in profile get 401. Unset in solo-style/test setups.
   */
  playerIdFor?: (req: IncomingMessage) => string | undefined;
  /** The game minute (0..1439): the NPC greets with the hour that fits it (bom dia / boa tarde / boa noite). */
  clockMinutes?: () => number;
  /** São Paulo day the Conversa payout cap uses. Defaults to the real date. */
  dateKey?: () => string;
  /** Running Conversas (turns, server-computed scores) and the per-player turn budget. Defaults to one shared instance. */
  sessions?: ConversaSessions;
  /** Extra origins allowed to POST (same as the auth and feedback APIs). Same-host requests are always allowed. */
  allowedOrigins?: readonly string[];
}

type DailyFlags = { conversaClears?: Record<string, string>; conversaRvGranted?: Record<string, string> };

/** A request body after validation. Only these fields are ever read. */
interface ConversaInput {
  action: 'start' | 'turn' | 'end';
  npcId: NpcId;
  playerId: string;
  subjectId?: string;
  playerName?: string;
  pronoun?: Pronoun;
  nameplate?: Nameplate;
  text?: string;
  daily?: DailyFlags;
}

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
  updateDaily: DailyFlags;
}

interface ConversaBlockedResponse {
  phase: 'blocked';
  reason: 'daily' | 'unavailable' | 'safety';
  pt: string;
  en: string;
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

/** The raw body, or null when it is larger than CONVERSA_MAX_BODY (the rest is not read) or the stream fails. */
function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > CONVERSA_MAX_BODY) {
        resolve(null);
        req.removeAllListeners('data');
        req.pause();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

/** `?conversaDaily=on|off` overrides CONVERSA_DAILY_CAP only on test servers (TB_TEST_CLOCK_CONTROL=1, never set on prod). */
function parseDailyCap(req: IncomingMessage): boolean {
  if (process.env.TB_TEST_CLOCK_CONTROL === '1') {
    const param = new URL(req.url ?? '/', 'http://x').searchParams.get('conversaDaily');
    if (param === 'off') return false;
    if (param === 'on') return true;
  }
  return dailyCapFromEnv();
}

const PRONOUNS: readonly Pronoun[] = ['ele', 'ela', 'nome'];
const NAMEPLATES: readonly Nameplate[] = ['verde', 'amarelo', 'azul', 'roxo', 'dourado'];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const optStr = (v: unknown, max: number) => v === undefined || v === null || (typeof v === 'string' && v.length <= max);

function dateMap(v: unknown): Record<string, string> | undefined | false {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v)) return false;
  const entries = Object.entries(v);
  if (entries.length > 32 || entries.some(([k, d]) => k.length > 32 || typeof d !== 'string' || d.length > 16)) return false;
  return Object.fromEntries(entries) as Record<string, string>;
}

/** Type- and size-check every field the API reads. A string error is the 400 message. */
function validate(raw: unknown): ConversaInput | string {
  if (!isObj(raw)) return 'Invalid JSON';
  const { action, npcId } = raw;
  if (action !== 'start' && action !== 'turn' && action !== 'end') return 'Unknown action';
  if (typeof npcId !== 'string' || !Object.hasOwn(CONVERSA_CAST, npcId)) return 'Unknown npc';
  if (!optStr(raw.playerId, 128)) return 'Invalid playerId';
  if (!optStr(raw.subjectId, 64)) return 'Invalid subjectId';
  if (!optStr(raw.playerName, 64)) return 'Invalid playerName';
  if (raw.pronoun != null && !PRONOUNS.includes(raw.pronoun as Pronoun)) return 'Invalid pronoun';
  if (raw.nameplate != null && !NAMEPLATES.includes(raw.nameplate as Nameplate)) return 'Invalid nameplate';
  if (raw.turn != null && (typeof raw.turn !== 'number' || !Number.isFinite(raw.turn))) return 'Invalid turn';
  if (raw.turnCount != null && (typeof raw.turnCount !== 'number' || !Number.isFinite(raw.turnCount))) return 'Invalid turnCount';
  if (raw.scores != null && !isObj(raw.scores)) return 'Invalid scores';
  if (raw.history != null) {
    const h = raw.history;
    if (!Array.isArray(h) || h.length > MAX_HISTORY) return 'Invalid history';
    if (h.some((l) => !isObj(l) || (l.who !== 'npc' && l.who !== 'player') || typeof l.pt !== 'string' || l.pt.length > 1000)) return 'Invalid history';
  }
  if (raw.priorChips != null) {
    const c = raw.priorChips;
    if (!Array.isArray(c) || c.length > 8 || c.some((x) => typeof x !== 'string' || x.length > 300)) return 'Invalid priorChips';
  }
  let daily: DailyFlags | undefined;
  if (raw.daily != null) {
    if (!isObj(raw.daily)) return 'Invalid daily';
    const clears = dateMap(raw.daily.conversaClears);
    const granted = dateMap(raw.daily.conversaRvGranted);
    if (clears === false || granted === false) return 'Invalid daily';
    daily = { ...(clears ? { conversaClears: clears } : {}), ...(granted ? { conversaRvGranted: granted } : {}) };
  }
  let text: string | undefined;
  if (action === 'turn') {
    if (typeof raw.text !== 'string') return 'Missing text';
    text = raw.text.trim();
    if (!text) return 'Missing text';
    if (text.length > CONVERSA_MAX_TEXT) return 'Text too long';
  }
  return {
    action,
    npcId: npcId as NpcId,
    playerId: typeof raw.playerId === 'string' ? raw.playerId : '',
    subjectId: typeof raw.subjectId === 'string' ? raw.subjectId : undefined,
    playerName: typeof raw.playerName === 'string' ? raw.playerName : undefined,
    pronoun: (raw.pronoun as Pronoun | undefined) ?? undefined,
    nameplate: (raw.nameplate as Nameplate | undefined) ?? undefined,
    text,
    daily,
  };
}

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

/** Who the NPC is talking to: the profile's name and pronoun; the body only fills in when there is no profile. */
function speaker(deps: ConversaApiDeps, body: ConversaInput): { playerName: string; pronoun: Pronoun; nameplate: Nameplate } {
  const p = deps.store && body.playerId ? deps.store.get(body.playerId) : undefined;
  if (!p) return { playerName: (body.playerName ?? '').slice(0, 24) || 'Jogador', pronoun: body.pronoun ?? 'nome', nameplate: body.nameplate ?? 'verde' };
  // English help asks for the Verde word cap; any other level is the profile's own nameplate.
  return { playerName: p.name, pronoun: p.pronoun, nameplate: body.nameplate === 'verde' ? 'verde' : (p.nameplate ?? 'verde') };
}

export async function handleConversaApi(req: IncomingMessage, res: ServerResponse, deps: ConversaApiDeps = {}): Promise<void> {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }
  if (!originAllowed(req, deps.allowedOrigins) || !String(req.headers['content-type'] ?? '').includes('application/json')) {
    json(res, 403, { error: 'Forbidden' });
    return;
  }

  // Authenticate before reading the body: an anonymous request costs nothing.
  let authedPlayer: string | undefined;
  if (deps.playerIdFor) {
    authedPlayer = deps.playerIdFor(req);
    if (!authedPlayer) {
      json(res, 401, { error: 'unauthenticated' });
      return;
    }
  }

  const raw = await readBody(req);
  if (raw === null) {
    res.on('finish', () => req.destroy());
    res.setHeader('Connection', 'close');
    json(res, 413, { error: 'Body too large' });
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    json(res, 400, { error: 'Invalid JSON' });
    return;
  }
  const body = validate(parsed);
  if (typeof body === 'string') {
    json(res, 400, { error: body });
    return;
  }
  if (authedPlayer) body.playerId = authedPlayer;

  const sessions = deps.sessions ?? defaultSessions;
  if (body.action === 'start') return handleStart(body, parseDailyCap(req), res, deps, sessions);
  if (body.action === 'turn') return handleTurn(body, res, deps, sessions);
  return handleEnd(body, res, deps, sessions);
}

async function handleStart(req: ConversaInput, dailyCapOn: boolean, res: ServerResponse, deps: ConversaApiDeps, sessions: ConversaSessions): Promise<void> {
  const daily = resolveDaily(deps.store, req.playerId, req.daily);
  const check = canStartConversa(req.npcId, daily, dailyCapOn);
  if (!check.allowed) {
    const npcName = CONVERSA_CAST[req.npcId].name;
    const response: ConversaBlockedResponse = {
      phase: 'blocked',
      reason: check.reason === 'daily_cap' ? 'daily' : 'unavailable',
      pt: check.reason === 'daily_cap' ? CONVERSA_COPY.daily(npcName).pt : 'Conversa indisponível.',
      en: check.reason === 'daily_cap' ? CONVERSA_COPY.daily(npcName).en : 'Conversa unavailable.',
    };
    json(res, 200, response);
    return;
  }

  const cast = CONVERSA_CAST[req.npcId];
  const subject = openSubject(deps.store, req.playerId, req.npcId, req.subjectId) ?? cast.subjects[0];
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
  }, [], deps.clockMinutes?.(), req.npcId);
  const opener: Bilingual = presented.line;
  const chips: Bilingual[] = presented.chips;
  sessions.start(req.playerId, req.npcId, subject.id, opener.pt, chips.map((c) => c.pt));
  deps.memory?.record(req.playerId, req.npcId, subject.id, 'npc', opener.pt);
  if (req.playerId) deps.onConversaLine?.(req.playerId, 'npc', opener.pt);

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

async function handleTurn(req: ConversaInput, res: ServerResponse, deps: ConversaApiDeps, sessions: ConversaSessions): Promise<void> {
  const cast = CONVERSA_CAST[req.npcId];
  if (!cast.enabled) {
    json(res, 400, { error: 'NPC not available' });
    return;
  }
  // A turn belongs to a Conversa the server opened; its turn count, subject and transcript come from there.
  const session = sessions.get(req.playerId, req.npcId);
  if (!session) {
    json(res, 409, { error: 'No Conversa in progress' });
    return;
  }
  if (session.turns + session.pending >= CONVERSA_MAX_PLAYER_MSGS) {
    json(res, 409, { error: 'Turn limit reached' });
    return;
  }
  if (!sessions.allowTurn(req.playerId)) {
    json(res, 429, { error: 'Too many messages. Try again in a minute.' });
    return;
  }

  const gate = gateConversaPlayerLine(req.text ?? '');
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

  const aiReady = await isXaiReady();
  if (session.turns + session.pending >= CONVERSA_MAX_PLAYER_MSGS) {
    json(res, 409, { error: 'Turn limit reached' });
    return;
  }
  const priorChips = session.lastChips;
  const turnNumber = session.turns + session.pending + 1;
  const who = speaker(deps, req);
  const turnReq = {
    npcId: req.npcId,
    subjectId: session.subjectId,
    ...who,
    // the server's own transcript (capped in the session), plus this line
    history: [...session.lines, { who: 'player' as const, pt: gate.text }],
    text: gate.text,
    turn: turnNumber,
    maxTurns: CONVERSA_MAX_PLAYER_MSGS,
    priorChips,
    minute: deps.clockMinutes?.(),
    // The NPC remembers you from 2 hearts up (HOWTO Phase 8 step 4 milestone); before that the memory stays unused
    memory: memoryIfBonded(deps.store, req.playerId, req.npcId) ? deps.memory?.get(req.playerId, req.npcId) : undefined,
  };
  let turnResponse;

  // Holds this turn's slot while the model answers, so parallel requests cannot go past maxTurns.
  session.pending++;
  try {
    if (aiReady) {
      turnResponse = await conversaTurn(turnReq);
    }
  } finally {
    session.pending--;
  }

  if (!turnResponse) {
    turnResponse = authoredConversaTurn(turnReq);
  }

  turnResponse = presentConversaTurn(turnResponse, priorChips, turnReq.minute, req.npcId);
  // The grade at `end` is built from these scores only (authored turns included, so offline-on-the-server still grades).
  sessions.turn(session, gate.text, turnResponse.line.pt, turnResponse.scores, turnResponse.chips.map((c) => c.pt));
  deps.memory?.record(req.playerId, req.npcId, session.subjectId, 'player', gate.text);
  deps.memory?.record(req.playerId, req.npcId, session.subjectId, 'npc', turnResponse.line.pt);
  if (req.playerId) {
    deps.onConversaLine?.(req.playerId, 'player', gate.text);
    deps.onConversaLine?.(req.playerId, 'npc', turnResponse.line.pt);
  }

  const meter = metersFromHistory(session.scores.map((scores) => ({ scores })));

  const response: ConversaTurnResponse = {
    phase: 'turn',
    mode: aiReady ? 'ai' : 'authored',
    offline: !aiReady,
    line: turnResponse.line,
    chips: turnResponse.chips,
    scores: turnResponse.scores,
    meter,
    tip: turnResponse.tip,
    turn: turnNumber,
    maxTurns: CONVERSA_MAX_PLAYER_MSGS,
    end: turnResponse.end || turnNumber >= CONVERSA_MAX_PLAYER_MSGS,
    ...(gate.notice?.level === 'warn' ? { notice: { level: 'warn' as const, pt: gate.notice.pt, en: gate.notice.en } } : {}),
  };

  json(res, 200, response);
}

async function handleEnd(req: ConversaInput, res: ServerResponse, deps: ConversaApiDeps, sessions: ConversaSessions): Promise<void> {
  const daily = resolveDaily(deps.store, req.playerId, req.daily);
  // Graded only from what the server saw: the client's scores, turnCount and daily are never read.
  const session = sessions.take(req.playerId, req.npcId);
  if (!session || session.turns === 0) {
    // No Conversa the server opened and answered: nothing is granted, cleared, remembered or reported.
    const response: ConversaEndResponse = { phase: 'end', grade: 'tryAgain', gradeLabel: gradeCopy('tryAgain').label, payout: 0, grantRv: false, updateDaily: daily };
    json(res, 200, response);
    return;
  }
  const grade = gradeFromScores(finalScores(session.scores), session.turns);
  const rv = gradeRV(grade);
  const copy = gradeCopy(grade);

  const grantRv = rv > 0 && shouldGrantRV(req.npcId, daily, rvOnceFromEnv());
  const rvNote: RvNote | undefined = !grantRv && rv > 0 ? 'already_today' : undefined;

  let todayKey = deps.dateKey?.() ?? conversaDateKey();
  let coins: number | undefined;
  const profile = deps.store && req.playerId ? deps.store.get(req.playerId) : undefined;
  if (profile) todayKey = addCalendarDays(todayKey, profile.testDayOffset ?? 0);
  const updateDaily: ConversaEndResponse['updateDaily'] = {
    conversaClears: { ...daily.conversaClears, [req.npcId]: todayKey },
  };

  if (grantRv) {
    updateDaily.conversaRvGranted = { ...daily.conversaRvGranted, [req.npcId]: todayKey };
  }

  // Store a short vetted summary for the NPC's next Conversa. The template line lands now; an AI one may replace it later.
  // Runs once per real Conversa: the session was just taken, so a repeated end finds none.
  if (req.playerId) void deps.memory?.end(req.playerId, req.npcId);
  if (profile && deps.store) {
    if (grantRv) profile.coins += rv;
    profile.daily = {
      ...profile.daily,
      conversaClears: updateDaily.conversaClears,
      conversaRvGranted: grantRv ? updateDaily.conversaRvGranted : profile.daily.conversaRvGranted,
    };
    deps.store.save(profile.id);
    deps.store.flush();
    coins = profile.coins;
    deps.onProfileChanged?.(req.playerId);
  }
  // The turn responses carry no order yet (`order` is always {}), so none is passed on.
  if (req.playerId) deps.onConversaEnd?.(req.playerId, req.npcId, grade);

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
