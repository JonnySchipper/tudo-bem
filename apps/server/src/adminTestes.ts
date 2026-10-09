/**
 * Admin Testes actions (credits panel). Every caller has already passed the admin password check.
 * Profile writes mark `testUser` so the public words, streak, and Feira boards skip that profile.
 * A teleport does not write the profile and does not set the flag.
 * The Testes clock and a day roll write only that profile's own offsets.
 */
import {
  ECONOMY,
  ITEM_EVERY_SHIFTS,
  PADARIA_FOUNDER_HAT,
  RECADOS,
  TUTORIAL_STEPS,
  WHERE_LESSON_ID,
  WHERE_MENU_AT,
  addCalendarDays,
  addXp,
  applyAdminBelt,
  canFoundAcademy,
  clampTz,
  earnedTier,
  freshEscola,
  freshMission,
  freshRecadoState,
  grantTestSubscription,
  hasPerkAccess,
  isAdminTestRoom,
  isBubbleStyle,
  isPetId,
  localDay,
  menuCountForShifts,
  menuIdsForShifts,
  normalizeBjj,
  normalizeDiary,
  normalizeEscola,
  revokeTestSubscription,
  todayXp,
  validatePadariaName,
  CARTELA_ACTIVITIES,
  DIARY_WORDS,
  freshCartela,
  type AdminTestRoom,
  type AdminTestSnapshot,
  type BubbleStyle,
  type ClientMsg,
  type PlayerPadaria,
  type RoomId,
  type TutorialStep,
} from '@tudobem/shared';
import type { PadariaStore } from './padariaStore.js';
import type { ProfileStore, StoredProfile } from './store.js';

export const ADMIN_TEST_ACTIONS = [
  'testes',
  'testBelt',
  'testCoins',
  'testProgress',
  'testEscola',
  'testTeleport',
  'testClock',
  'testCaps',
  'testTutorial',
  'testPadaria',
  'testPerk',
  'testReset',
] as const;

export type AdminTestAction = (typeof ADMIN_TEST_ACTIONS)[number];

const ACTION_SET = new Set<string>(ADMIN_TEST_ACTIONS);

export function isAdminTestAction(action: string): action is AdminTestAction {
  return ACTION_SET.has(action);
}

/** The socket the admin is on. Online targets are the same shape (a world Session). */
export interface AdminTestSession {
  profile?: StoredProfile;
  send: (m: import('@tudobem/shared').ServerMsg) => void;
  instance?: { def: { id: RoomId } };
}

export interface AdminTestHost {
  now(): number;
  /** Shared neighborhood clock. Errands add the target profile's own offset on top of this. */
  clockNow(): number;
  /** Real UTC day. Daily keys add the target profile's `testDayOffset`. */
  utcDay(): string;
  /** Real America/São Paulo day. */
  spDay(): string;
  /** Eastern day of the world clock (Feira cart and cartela). */
  easternDay(): string;
  minuteOf(p: StoredProfile): number;
  gameDayOf(p: StoredProfile): number;
  store: ProfileStore;
  padarias: PadariaStore;
  padariaOwnership: boolean;
  findOnline(profileId: string): AdminTestSession | undefined;
  /** Move only this profile's sky so it reads `minute`. The neighborhood clock stays put. */
  setPersonalMinute(p: StoredProfile, minute: number): number;
  /** One calendar day and one game day on this profile only. Does not roll the public board. */
  rollPersonalDay(p: StoredProfile): void;
  join(session: AdminTestSession, room: AdminTestRoom): void;
  clearFeiraPaid(playerId: string): void;
  pushLive(session: AdminTestSession): void;
  /** Sky and errand board for this session, using that profile's clock offset. */
  pushPersonalClock(session: AdminTestSession): void;
  err(session: AdminTestSession, pt: string, en: string): void;
  notice(session: AdminTestSession, pt: string, en: string): void;
}

type AdminMsg = Extract<ClientMsg, { t: 'admin' }>;

export function handleAdminTest(host: AdminTestHost, admin: AdminTestSession, msg: AdminMsg): void {
  if (!isAdminTestAction(msg.action)) return;
  const who = resolve(host, admin, 'username' in msg ? msg.username : undefined);
  if ('error' in who) return host.err(admin, who.error.pt, who.error.en);

  if (msg.action === 'testes') {
    admin.send({ t: 'admin', phase: 'testes', state: snapshot(host, who.p, who.online) });
    return;
  }

  if (msg.action === 'testClock') {
    if (msg.minute !== undefined && (!Number.isFinite(msg.minute) || msg.minute < 0 || msg.minute > 1439)) {
      return host.err(admin, 'Minuto inválido.', 'Invalid minute.');
    }
    if (msg.minute === undefined && !msg.rollDay) return host.err(admin, 'Nada para mudar.', 'Nothing to change.');
    who.p.testUser = true;
    if (msg.minute !== undefined) host.setPersonalMinute(who.p, msg.minute);
    if (msg.rollDay) host.rollPersonalDay(who.p);
    host.store.save();
    if (who.online) {
      host.pushPersonalClock(who.online);
      host.pushLive(who.online);
    }
    const minute = host.minuteOf(who.p);
    log(admin, msg.action, who.p, `minute ${minute}${msg.rollDay ? ' day+1' : ''} (profile only)`);
    host.notice(
      admin,
      msg.rollDay ? 'O dia deste perfil avançou. O relógio do bairro não mudou.' : 'O horário deste perfil foi atualizado. O relógio do bairro não mudou.',
      msg.rollDay ? 'This profile’s day rolled. The neighborhood clock did not change.' : 'This profile’s clock was updated. The neighborhood clock did not change.',
    );
    admin.send({ t: 'admin', phase: 'testes', state: snapshot(host, who.p, who.online) });
    return;
  }

  if (msg.action === 'testTeleport') {
    if (!who.online) return host.err(admin, 'Essa pessoa não está no bairro.', 'That player is not in the neighborhood.');
    if (!isAdminTestRoom(msg.room)) return host.err(admin, 'Essa sala não entra no teleporte.', 'That room is not on the teleporter.');
    host.join(who.online, msg.room);
    log(admin, msg.action, who.p, msg.room);
    host.notice(admin, `Foi para ${msg.room}.`, `Moved to ${msg.room}.`);
    admin.send({ t: 'admin', phase: 'testes', state: snapshot(host, who.p, who.online) });
    return;
  }

  const wrote = applyWrite(host, who.p, msg);
  if (!wrote.ok) return host.err(admin, wrote.pt, wrote.en);
  who.p.testUser = true;
  refreshPlate(who.p);
  host.store.save();
  if (who.online) host.pushLive(who.online);
  if (who.online && msg.action === 'testReset') host.pushPersonalClock(who.online);
  log(admin, msg.action, who.p, wrote.detail);
  const extra = msg.action === 'testPadaria' && !host.padariaOwnership ? ' A porta de fundar está desligada neste servidor.' : '';
  host.notice(admin, `${wrote.pt}${extra}`, wrote.en);
  admin.send({ t: 'admin', phase: 'testes', state: snapshot(host, who.p, who.online) });
}

function resolve(host: AdminTestHost, admin: AdminTestSession, username?: string): { p: StoredProfile; online?: AdminTestSession } | { error: { pt: string; en: string } } {
  const self = admin.profile;
  if (!self) return { error: { pt: 'Entre no bairro primeiro.', en: 'Enter the neighborhood first.' } };
  const name = username?.trim();
  if (!name) return { p: self, online: admin };
  const want = name.normalize('NFC').toLocaleLowerCase('pt-BR');
  const hits = host.store.all().filter((p) => p.name.normalize('NFC').toLocaleLowerCase('pt-BR') === want);
  if (hits.length !== 1) {
    return {
      error: hits.length
        ? { pt: 'Mais de um perfil com esse nome.', en: 'More than one profile has that name.' }
        : { pt: 'Não achei esse nome.', en: 'No profile with that name.' },
    };
  }
  const online = host.findOnline(hits[0]!.id);
  return { p: online?.profile ?? hits[0]!, online };
}

function refreshPlate(p: StoredProfile) {
  const diary = normalizeDiary(p.diary);
  p.diary = diary;
  p.escola = normalizeEscola(p.escola, diary);
  p.nameplate = p.verdeMode ? 'verde' : earnedTier(p.escola, diary);
}

function log(admin: AdminTestSession, action: string, target: StoredProfile, detail: string) {
  const from = admin.profile?.name ?? admin.profile?.id ?? '?';
  console.log(`[admin-testes] ${from} ${action} ${target.name}${detail ? ` ${detail}` : ''}`);
}

type Write = { ok: true; pt: string; en: string; detail: string } | { ok: false; pt: string; en: string };

function applyWrite(host: AdminTestHost, p: StoredProfile, msg: AdminMsg): Write {
  switch (msg.action) {
    case 'testBelt':
      return writeBelt(p, msg);
    case 'testCoins':
      return writeCoins(p, msg.coins);
    case 'testProgress':
      return writeProgress(host, p, msg);
    case 'testEscola':
      return writeEscola(host, p, msg);
    case 'testCaps':
      clearCaps(host, p);
      return { ok: true, pt: 'Limites de hoje zerados.', en: 'Today’s caps cleared.', detail: 'caps' };
    case 'testTutorial':
      return writeTutorial(host, p, msg.mode);
    case 'testPadaria':
      return writePadaria(host, p, msg);
    case 'testPerk':
      return writePerk(host, p, msg);
    case 'testReset':
      return writeReset(host, p, msg.confirm);
    default:
      return { ok: false, pt: 'Ação desconhecida.', en: 'Unknown action.' };
  }
}

function writeBelt(p: StoredProfile, msg: Extract<ClientMsg, { t: 'admin'; action: 'testBelt' }>): Write {
  const next = applyAdminBelt(p.bjj, { belt: msg.belt, stripes: msg.stripes, wins: msg.wins, deltaWins: msg.deltaWins });
  if (!next.ok) return { ok: false, pt: 'Faixa inválida.', en: 'Invalid belt.' };
  p.bjj = next.bjj;
  const b = next.bjj;
  return { ok: true, pt: `Faixa ${b.belt}, ${b.stripes} graus, ${b.wins} vitórias.`, en: `Belt ${b.belt}, ${b.stripes} stripes, ${b.wins} wins.`, detail: `${b.belt} ${b.stripes} ${b.wins}` };
}

function writeCoins(p: StoredProfile, coins: number): Write {
  if (!Number.isFinite(coins)) return { ok: false, pt: 'Valor inválido.', en: 'Invalid amount.' };
  const n = Math.floor(coins);
  if (n < 0 || n > 1_000_000) return { ok: false, pt: 'RV entre 0 e 1000000.', en: 'RV from 0 to 1000000.' };
  p.coins = n;
  return { ok: true, pt: `RV: ${n}.`, en: `RV: ${n}.`, detail: `coins ${n}` };
}

function writeProgress(host: AdminTestHost, p: StoredProfile, msg: Extract<ClientMsg, { t: 'admin'; action: 'testProgress' }>): Write {
  const st = normalizeEscola(p.escola, p.diary);
  const bits: string[] = [];
  if (msg.xp !== undefined) {
    if (!Number.isFinite(msg.xp)) return { ok: false, pt: 'XP inválido.', en: 'Invalid XP.' };
    const xp = Math.floor(msg.xp);
    if (xp < 1 || xp > 100_000) return { ok: false, pt: 'XP de 1 a 100000.', en: 'XP from 1 to 100000.' };
    const tz = clampTz(msg.tz);
    st.tz = tz;
    addXp(st, localDay(host.now(), tz), xp);
    bits.push(`xp +${xp}`);
  }
  if (msg.goal !== undefined) {
    const goal = msg.goal;
    if (goal !== 10 && goal !== 20 && goal !== 30) return { ok: false, pt: 'Meta é 10, 20 ou 30.', en: 'Goal is 10, 20, or 30.' };
    st.goal = goal;
    bits.push(`goal ${goal}`);
  }
  if (msg.verde !== undefined) {
    p.verdeMode = msg.verde === true;
    bits.push(p.verdeMode ? 'verde on' : 'verde off');
  }
  if (!bits.length) return { ok: false, pt: 'Nada para mudar.', en: 'Nothing to change.' };
  p.escola = st;
  return { ok: true, pt: 'Progresso atualizado.', en: 'Progress updated.', detail: bits.join(' ') };
}

function writeEscola(host: AdminTestHost, p: StoredProfile, msg: Extract<ClientMsg, { t: 'admin'; action: 'testEscola' }>): Write {
  const st = normalizeEscola(p.escola, p.diary);
  const bits: string[] = [];
  if (msg.words !== undefined) {
    if (!Number.isFinite(msg.words)) return { ok: false, pt: 'Contagem inválida.', en: 'Invalid count.' };
    const n = Math.floor(msg.words);
    if (n < 0 || n > DIARY_WORDS.length) return { ok: false, pt: `Palavras de 0 a ${DIARY_WORDS.length}.`, en: `Words from 0 to ${DIARY_WORDS.length}.` };
    p.diary = DIARY_WORDS.slice(0, n).map((w) => w.id);
    bits.push(`words ${n}`);
  }
  if (msg.streak !== undefined) {
    if (!Number.isFinite(msg.streak)) return { ok: false, pt: 'Sequência inválida.', en: 'Invalid streak.' };
    const n = Math.floor(msg.streak);
    if (n < 0 || n > 9999) return { ok: false, pt: 'Sequência de 0 a 9999.', en: 'Streak from 0 to 9999.' };
    const tz = clampTz(msg.tz);
    st.tz = tz;
    st.streak = n;
    st.best = Math.max(st.best, n);
    st.lastDay = n > 0 ? localDay(host.now(), tz) : undefined;
    bits.push(`streak ${n}`);
  }
  if (!bits.length) return { ok: false, pt: 'Nada para mudar.', en: 'Nothing to change.' };
  p.escola = normalizeEscola(st, p.diary);
  if (msg.streak !== undefined) {
    p.escola.streak = Math.floor(msg.streak);
    p.escola.best = Math.max(p.escola.best, p.escola.streak);
    p.escola.lastDay = p.escola.streak > 0 ? localDay(host.now(), clampTz(msg.tz)) : undefined;
  }
  return { ok: true, pt: 'Escola atualizada.', en: 'Escola updated.', detail: bits.join(' ') };
}

function clearCaps(host: AdminTestHost, p: StoredProfile) {
  host.clearFeiraPaid(p.id);
  const off = p.testDayOffset ?? 0;
  const utc = addCalendarDays(host.utcDay(), off);
  const sp = addCalendarDays(host.spDay(), off);
  const eastern = addCalendarDays(host.easternDay(), off);
  const st = normalizeEscola(p.escola, p.diary);
  if (st.rv) st.rv = { day: st.rv.day, n: 0 };
  p.escola = st;
  if (p.correria && p.correria.date === utc) p.correria.paid = 0;
  if (p.feira) p.feira = { date: p.feira.date, n: 0 };
  p.daily.sceneClears = {};
  const days = new Set([sp, utc]);
  for (const key of ['conversaClears', 'conversaRvGranted', 'pedidoRvGranted'] as const) {
    const map = p.daily[key];
    if (!map) continue;
    for (const [id, day] of Object.entries(map)) if (days.has(day)) delete map[id];
  }
  const bjj = normalizeBjj(p.bjj);
  if (bjj.bondDay === utc) bjj.bondToday = 0;
  p.bjj = bjj;
  const cart = p.cartela ?? freshCartela();
  for (const id of CARTELA_ACTIVITIES) if (cart.activityDay[id] === eastern) delete cart.activityDay[id];
  p.cartela = cart;
}

function writeTutorial(host: AdminTestHost, p: StoredProfile, mode: 'reset' | 'skip'): Write {
  if (mode !== 'reset' && mode !== 'skip') return { ok: false, pt: 'Modo inválido.', en: 'Invalid mode.' };
  if (mode === 'skip') {
    p.tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, true])) as Record<TutorialStep, boolean>;
    p.tutorialRewarded = true;
    p.arrivalIntroDone = true;
    p.desembarqueDone = true;
    p.recados = { day: host.gameDayOf(p), offered: [], active: [], done: RECADOS.map((r) => r.id), talked: [], graded: [] };
    return { ok: true, pt: 'Tutorial e recados de hoje pulados.', en: 'Tutorial and today’s errands skipped.', detail: 'skip' };
  }
  p.tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, false])) as Record<TutorialStep, boolean>;
  p.tutorialRewarded = false;
  p.arrivalIntroDone = false;
  p.desembarqueDone = false;
  p.recados = freshRecadoState();
  return { ok: true, pt: 'Tutorial e recados zerados.', en: 'Tutorial and errands reset.', detail: 'reset' };
}

function writePadaria(host: AdminTestHost, p: StoredProfile, msg: Extract<ClientMsg, { t: 'admin'; action: 'testPadaria' }>): Write {
  const bits: string[] = [];
  if (msg.menu !== undefined) {
    if (!Number.isFinite(msg.menu)) return { ok: false, pt: 'Cardápio inválido.', en: 'Invalid menu.' };
    const count = Math.floor(msg.menu);
    if (count < 2 || count > 12) return { ok: false, pt: 'Cardápio de 2 a 12 itens.', en: 'Menu from 2 to 12 items.' };
    const shifts = (count - 2) * ITEM_EVERY_SHIFTS;
    const ids = menuIdsForShifts(shifts);
    const taught = count >= WHERE_MENU_AT ? [...ids, WHERE_LESSON_ID] : [...ids];
    p.correria = { stars: p.correria?.stars ?? 0, shifts, best: p.correria?.best ?? 0, date: p.correria?.date, paid: p.correria?.paid, taught };
    bits.push(`menu ${menuCountForShifts(shifts)}`);
  }
  if (msg.stage !== undefined) {
    if (msg.stage !== 0 && msg.stage !== 1 && msg.stage !== 2 && msg.stage !== 3) return { ok: false, pt: 'Estágio inválido.', en: 'Invalid stage.' };
    const existing = host.padarias.ownedBy(p.id);
    if (msg.stage === 0) {
      if (existing) host.padarias.remove(existing.id);
      if (p.hat === PADARIA_FOUNDER_HAT) p.hat = null;
      p.hats = p.hats.filter((h) => h !== PADARIA_FOUNDER_HAT);
    } else if (existing) {
      existing.size = msg.stage;
      host.padarias.save();
    } else {
      const row = foundTestPadaria(host, p, msg.stage);
      if (!row) return { ok: false, pt: 'Não consegui abrir a padaria.', en: 'Could not open the bakery.' };
      host.padarias.add(row);
      if (!p.hats.includes(PADARIA_FOUNDER_HAT)) p.hats.push(PADARIA_FOUNDER_HAT);
    }
    bits.push(`stage ${msg.stage}`);
  }
  if (!bits.length) return { ok: false, pt: 'Nada para mudar.', en: 'Nothing to change.' };
  return { ok: true, pt: 'Padaria atualizada.', en: 'Bakery updated.', detail: bits.join(' ') };
}

function foundTestPadaria(host: AdminTestHost, p: StoredProfile, size: 1 | 2 | 3): PlayerPadaria | null {
  const candidates = [`Casa ${p.name}`.slice(0, 24), `Casa ${p.id.slice(0, 6)}`, `Casa ${p.id}`];
  for (const raw of candidates) {
    const named = validatePadariaName(raw);
    if (!named.ok) continue;
    if (host.padarias.byNameKey(named.key)) continue;
    return { id: host.padarias.newId(), name: named.name, nameKey: named.key, ownerId: p.id, size, sweets: {}, createdAt: host.now() };
  }
  return null;
}

function writePerk(host: AdminTestHost, p: StoredProfile, msg: Extract<ClientMsg, { t: 'admin'; action: 'testPerk' }>): Write {
  if (msg.revoke) {
    revokeTestSubscription(p, host.now());
    return { ok: true, pt: 'Assinatura de teste encerrada.', en: 'Test subscription ended.', detail: 'revoke' };
  }
  if (msg.pet !== undefined && msg.pet !== null && !isPetId(msg.pet)) return { ok: false, pt: 'Pet inválido.', en: 'Invalid pet.' };
  if (msg.bubble !== undefined && !isBubbleStyle(msg.bubble)) return { ok: false, pt: 'Balão inválido.', en: 'Invalid bubble.' };
  if (msg.grant) grantTestSubscription(p, host.now());
  const active = hasPerkAccess(p.subscription, host.now());
  if ((msg.pet !== undefined || msg.bubble !== undefined) && !active) {
    return { ok: false, pt: 'Conceda a assinatura de teste antes do pet ou do balão.', en: 'Grant the test subscription before a pet or bubble.' };
  }
  if (msg.pet !== undefined) p.pet = msg.pet;
  if (msg.bubble !== undefined) p.bubbleStyle = msg.bubble as BubbleStyle;
  if (!msg.grant && msg.pet === undefined && msg.bubble === undefined) return { ok: false, pt: 'Nada para mudar.', en: 'Nothing to change.' };
  const bits = [msg.grant ? 'grant' : '', msg.pet !== undefined ? `pet ${msg.pet ?? 'none'}` : '', msg.bubble ? `bubble ${msg.bubble}` : ''].filter(Boolean);
  return { ok: true, pt: 'Perk de teste atualizado.', en: 'Test perk updated.', detail: bits.join(' ') };
}

function writeReset(host: AdminTestHost, p: StoredProfile, confirm: boolean | undefined): Write {
  if (confirm !== true) return { ok: false, pt: 'Confirme o reset.', en: 'Confirm the reset.' };
  p.coins = ECONOMY.startingCoins;
  p.bjj = normalizeBjj(null);
  p.diary = [];
  p.escola = freshEscola();
  p.verdeMode = false;
  p.nameplate = 'verde';
  p.giOwned = false;
  p.correria = undefined;
  p.feira = undefined;
  p.recados = freshRecadoState();
  p.bag = {};
  p.bond = {};
  p.bondGifts = [];
  p.caderno = {};
  p.cadernoPaid = [];
  p.mission = freshMission(host.utcDay());
  p.tutorial = Object.fromEntries(TUTORIAL_STEPS.map((t) => [t.id, false])) as Record<TutorialStep, boolean>;
  p.tutorialRewarded = false;
  p.arrivalIntroDone = false;
  p.pet = null;
  p.bubbleStyle = 'classic';
  p.daily = { date: host.utcDay(), sceneClears: {} };
  p.cartela = freshCartela();
  p.testDayOffset = undefined;
  p.testClockOffsetMs = undefined;
  p.testFeiraPaid = undefined;
  if (p.subscription?.provider === 'dev') revokeTestSubscription(p, host.now());
  const owned = host.padarias.ownedBy(p.id);
  if (owned) host.padarias.remove(owned.id);
  if (p.hat === PADARIA_FOUNDER_HAT) p.hat = null;
  p.hats = p.hats.filter((h) => h !== PADARIA_FOUNDER_HAT);
  return { ok: true, pt: 'Perfil de teste zerado.', en: 'Test profile reset.', detail: 'reset' };
}

function snapshot(host: AdminTestHost, p: StoredProfile, online?: AdminTestSession): AdminTestSnapshot {
  const bjj = normalizeBjj(p.bjj);
  const diary = normalizeDiary(p.diary);
  const st = normalizeEscola(p.escola, diary);
  const row = host.padarias.ownedBy(p.id);
  const stage = !row ? 0 : row.size === 2 || row.size === 3 ? row.size : 1;
  return {
    id: p.id,
    name: p.name,
    testUser: p.testUser === true,
    belt: bjj.belt,
    stripes: bjj.stripes,
    wins: bjj.wins,
    canFound: canFoundAcademy(bjj),
    coins: p.coins,
    xp: st.xp,
    goal: st.goal,
    dayXp: todayXp(st, localDay(host.now(), st.tz ?? 0)),
    verdeMode: p.verdeMode === true,
    nameplate: p.nameplate,
    streak: st.streak,
    words: diary.length,
    room: online?.instance?.def.id ?? null,
    menuCount: menuCountForShifts(p.correria?.shifts ?? 0),
    shifts: p.correria?.shifts ?? 0,
    padariaStage: stage,
    pet: p.pet === 'dog' || p.pet === 'cat' ? p.pet : null,
    bubble: isBubbleStyle(p.bubbleStyle) ? p.bubbleStyle : 'classic',
    subActive: hasPerkAccess(p.subscription, host.now()),
    tutorialDone: TUTORIAL_STEPS.every((t) => p.tutorial[t.id]),
    arrivalIntroDone: p.arrivalIntroDone === true,
    recadoActive: p.recados?.active.length ?? 0,
    minute: host.minuteOf(p),
    gameDay: host.gameDayOf(p),
  };
}
