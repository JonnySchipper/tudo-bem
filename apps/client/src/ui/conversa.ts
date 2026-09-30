import {
  CONVERSA_AXES,
  CONVERSA_COPY,
  authoredFallbackTurn,
  gradeFromScores,
  gradeCopy,
  contaRvLine,
  metersFromHistory,
  gateConversaPlayerLine,
  offlineConversaOpen,
  presentConversaTurn,
  ROOMS,
  type ConversaSafetyNotice,
  type Bilingual,
  type ConversaGrade,
  type ConversaLine,
  type ConversaMeter,
  type ConversaScores,
  type RvNote,
  type NpcDef,
  type NpcId,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { expressionForGrade, npcPortrait, type Expression } from './pixelArt';
import { speak } from '../audio';
import { toast } from './hud';
import {
  startConversa,
  sendConversaTurn,
  endConversa,
  type ConversaApiResponse,
  type ConversaDaily,
} from '../conversaRemote';

interface ConversaState {
  npcId: NpcId;
  npcName: string;
  npc: NpcDef | null;
  subjectId: string;
  subjectTitle: Bilingual;
  subjectGoal: Bilingual;
  mode: 'ai' | 'authored';
  offline: boolean;
  history: (ConversaLine & { scores?: ConversaScores })[];
  chips: Bilingual[];
  turn: number;
  maxTurns: number;
  ended: boolean;
  grade: ConversaGrade | null;
  payout: number;
  rvNote: RvNote | null;
  meter: ConversaMeter;
  daily: ConversaDaily;
}

let state: ConversaState | null = null;
let containerEl: HTMLElement | null = null;
let closeCallback: (() => void) | null = null;
let onKey: ((e: KeyboardEvent) => void) | null = null;
/** Carlos only: leave the mesa and open the authored chip order. */
let quickOrder: (() => void) | null = null;
/** One safety toast per send. The server notice is a backstop when the client has not already shown it. */
let safetyToastShown = false;

function showSafetyToast(notice: ConversaSafetyNotice | null | undefined) {
  if (!notice || safetyToastShown) return;
  safetyToastShown = true;
  toast(notice.level, notice.pt, notice.en);
}

function findNpc(npcId: NpcId): NpcDef | null {
  for (const room of Object.values(ROOMS)) {
    const npc = room.npcs.find((n) => n.id === npcId);
    if (npc) return npc;
  }
  return null;
}

function portrait(npc: NpcDef | null, expr: Expression) {
  return npcPortrait(npc?.id ?? null, expr, 'conversa-portrait');
}

/** Placemat strips laid on the mesa: Carlos's side on the left, yours on the right. */
function buildTranscript(history: ConversaState['history']): HTMLElement {
  const strips: HTMLElement[] = [];
  for (const line of history.slice(-5)) {
    const isNpc = line.who === 'npc';
    strips.push(
      h(
        'div',
        { class: `conversa-strip ${isNpc ? 'npc' : 'player'}` },
        h('span', { class: 'text' }, line.pt),
        line.en ? en(line.en, true) : null,
      ),
    );
  }
  return h('div', { class: 'conversa-transcript' }, ...strips);
}

/** Speak the Portuguese rubber stamp only. `speak()` plays the prebaked clip when the text matches. */
function speakContaStamp(grade: ConversaGrade) {
  speak(gradeCopy(grade).label.pt);
}

/** The conta: a paper bill with a PT-primary rubber stamp (Mandou bem! / Quase! / Tenta de novo). */
function buildScoreCard(grade: ConversaGrade, payout: number, meter: ConversaMeter, rvNote: RvNote | null): HTMLElement {
  const copy = gradeCopy(grade);
  const gradeClass = grade === 'pass' ? 'pass' : grade === 'almost' ? 'almost' : 'try-again';
  const rvLine = contaRvLine(payout, rvNote);

  const axes = CONVERSA_AXES.map((axis) => {
    const pct = meter[axis.id];
    return h(
      'div',
      { class: 'score-axis' },
      h('span', { class: 'axis-label' }, axis.pt, h('small', { class: 'axis-en' }, axis.en)),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${pct}%` })),
      h('small', { class: 'tip' }, axis.tip.pt),
    );
  });

  return h(
    'div',
    { class: 'conversa-score-card' },
    h('div', { class: 'conta-head' }, 'A conta', h('small', {}, 'The bill')),
    h('div', { class: `grade ${gradeClass}`, lang: 'pt-BR' }, copy.label.pt, h('small', { class: 'grade-en', lang: 'en' }, copy.label.en)),
    h('div', { class: 'grade-line' }, copy.line.pt, en(copy.line.en, true)),
    rvLine && payout > 0 ? h('div', { class: 'payout' }, rvLine.pt) : null,
    rvLine && payout <= 0 ? h('div', { class: 'payout withheld', lang: 'pt-BR' }, rvLine.pt, en(rvLine.en, true)) : null,
    h('div', { class: 'axes' }, ...axes),
  );
}

function render() {
  if (!state || !containerEl) return;

  const header = h(
    'div',
    { class: 'conversa-header' },
    portrait(state.npc, expressionForGrade(state.ended ? state.grade : null)),
    h(
      'div',
      { class: 'info' },
      h('div', { class: 'npc-name' }, state.npcName),
      h('div', { class: 'subject' }, state.subjectTitle.pt, en(state.subjectTitle.en, true)),
      state.offline ? h('small', { class: 'offline-note' }, CONVERSA_COPY.offline.pt, en(CONVERSA_COPY.offline.en, true)) : null,
      h('small', { class: 'private-note' }, CONVERSA_COPY.private.pt),
    ),
    h('div', { class: 'turn-counter' }, `${state.turn}/${state.maxTurns}`),
    h('button', { class: 'close-btn ghost', onclick: handleClose, 'aria-label': 'Fechar' }, '✕'),
  );

  const transcript = buildTranscript(state.history);

  let body: HTMLElement;
  if (state.ended && state.grade) {
    body = h(
      'div',
      { class: 'conversa-body ended' },
      buildScoreCard(state.grade, state.payout, state.meter, state.rvNote),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'primary', onclick: handleClose }, bi(CONVERSA_COPY.continuar.pt, CONVERSA_COPY.continuar.en)),
      ),
    );
  } else {
    const chips = state.chips.map((chip, i) =>
      h(
        'button',
        { class: 'conversa-chip', onclick: () => handleChip(i), 'data-chip': String(i) },
        h('span', { class: 'num' }, String(i + 1)),
        chip.pt,
        chip.en ? en(chip.en, true) : null,
      ),
    );

    const input = h('input', {
      type: 'text',
      maxLength: 140,
      placeholder: 'Digite em português… (or type your reply)',
      'aria-label': 'Sua resposta',
      id: 'conversa-input',
    }) as HTMLInputElement;
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') handleSend(input);
    });

    body = h(
      'div',
      { class: 'conversa-body' },
      transcript,
      h('div', { class: 'conversa-chips' }, ...chips),
      h(
        'div',
        { class: 'conversa-input-row' },
        input,
        h('button', { class: 'primary', onclick: () => handleSend(input) }, CONVERSA_COPY.enviar.pt),
      ),
      h(
        'div',
        { class: 'conversa-footer' },
        quickOrder
          ? h(
              'button',
              { class: 'ghost', onclick: handleQuickOrder, 'data-action': 'pedido-rapido' },
              bi('Pedido rápido', 'Quick order'),
            )
          : null,
        h('button', { class: 'ghost', onclick: handleClose }, CONVERSA_COPY.sair.pt),
      ),
    );
  }

  containerEl.replaceChildren(header, body);
}

async function handleSend(input: HTMLInputElement) {
  if (!state || state.ended) return;
  const text = input.value.trim();
  if (!text) return;

  safetyToastShown = false;
  const gate = gateConversaPlayerLine(text);
  if (!gate.deliver) {
    showSafetyToast(gate.notice);
    return;
  }
  showSafetyToast(gate.notice);

  input.value = '';
  input.disabled = true;

  state.turn++;
  state.history.push({ who: 'player', pt: gate.text });
  const priorChips = state.chips.map((c) => c.pt);
  render();

  try {
    if (state.offline) {
      applyOfflineTurn(gate.text, priorChips);
      return;
    }
    const response = await sendConversaTurn(
      state.npcId,
      state.subjectId,
      game.profile?.name ?? 'Jogador',
      game.profile?.pronoun ?? 'nome',
      game.profile?.nameplate ?? 'verde',
      game.profile?.id ?? '',
      gate.text,
      state.history,
      state.turn,
      state.daily,
      priorChips,
    );

    handleApiResponse(response);
  } catch (e) {
    console.warn('[conversa] Turn failed, using authored Carlos:', e);
    applyOfflineTurn(gate.text, priorChips);
  } finally {
    const next = document.getElementById('conversa-input') as HTMLInputElement | null;
    if (next && state && !state.ended) {
      next.disabled = false;
      next.focus();
    }
  }
}

/** Scripted Carlos when the API is down (GitHub Pages answers POST /api/conversa with 405). */
function applyOfflineTurn(text: string, priorChips: string[]) {
  if (!state) return;
  state.mode = 'authored';
  state.offline = true;
  const fb = authoredFallbackTurn(text, state.history);
  const presented = presentConversaTurn(
    {
      line: fb.response,
      chips: fb.chips,
      scores: { portuguese: 2, grammar: 2, conversation: 2 },
      tip: null,
      end: fb.end,
      order: {},
    },
    priorChips,
  );
  state.chips = presented.chips;
  state.history.push({
    who: 'npc',
    pt: presented.line.pt,
    en: presented.line.en || undefined,
    scores: presented.scores,
  });
  speak(presented.line.pt);
  if (presented.end || state.turn >= state.maxTurns) finishConversa('natural');
  else render();
}

function handleChip(index: number) {
  if (!state || state.ended || !state.chips[index]) return;
  const chip = state.chips[index];

  const input = document.getElementById('conversa-input') as HTMLInputElement | null;
  if (input) {
    input.value = chip.pt;
    handleSend(input);
  }
}

function handleApiResponse(response: ConversaApiResponse) {
  if (!state) return;

  if (response.phase === 'blocked') {
    if (response.reason === 'safety') {
      toast('block', response.pt, response.en);
      safetyToastShown = true;
      const input = document.getElementById('conversa-input') as HTMLInputElement | null;
      if (input) input.disabled = false;
      state.history.pop();
      state.turn--;
    }
    render();
    return;
  }

  if (response.phase === 'turn') {
    if (response.notice) showSafetyToast(response.notice);
    state.mode = response.mode;
    state.offline = response.offline;
    state.chips = response.chips;
    state.meter = response.meter;

    const npcLine: ConversaLine & { scores?: ConversaScores } = {
      who: 'npc',
      pt: response.line.pt,
      en: response.line.en || undefined,
      scores: response.scores,
    };
    state.history.push(npcLine);

    speak(response.line.pt);

    if (response.end || state.turn >= state.maxTurns) {
      finishConversa('natural');
    } else {
      render();
    }
    return;
  }

  if (response.phase === 'end') {
    state.ended = true;
    state.grade = response.grade;
    state.payout = response.payout;
    state.rvNote = response.rvNote ?? null;

    if (response.updateDaily) {
      state.daily = { ...state.daily, ...response.updateDaily };
    }

    if (game.profile) {
      if (typeof response.coins === 'number') game.profile.coins = response.coins;
      else if (response.payout > 0) game.profile.coins += response.payout;
      game.emit('profile');
    }

    speakContaStamp(response.grade);
    render();
  }
}

async function finishConversa(reason: 'natural' | 'cap' | 'early') {
  if (!state) return;

  const historyWithScores = state.history.filter((h) => h.scores).map((h) => ({ scores: h.scores! }));
  const finalScores: ConversaScores = historyWithScores.length > 0
    ? {
        portuguese: Math.round(historyWithScores.reduce((a, h) => a + h.scores.portuguese, 0) / historyWithScores.length) as 0 | 1 | 2 | 3,
        grammar: Math.round(historyWithScores.reduce((a, h) => a + h.scores.grammar, 0) / historyWithScores.length) as 0 | 1 | 2 | 3,
        conversation: Math.round(historyWithScores.reduce((a, h) => a + h.scores.conversation, 0) / historyWithScores.length) as 0 | 1 | 2 | 3,
      }
    : { portuguese: 2, grammar: 2, conversation: 2 };

  if (state.offline) {
    state.ended = true;
    state.grade = gradeFromScores(finalScores, state.turn);
    state.payout = 0;
    state.meter = metersFromHistory(state.history);
    speakContaStamp(state.grade);
    render();
    return;
  }

  try {
    const response = await endConversa(
      state.npcId,
      game.profile?.id ?? '',
      state.turn,
      finalScores,
      state.daily,
    );
    handleApiResponse(response);
  } catch (e) {
    console.error('[conversa] End failed:', e);
    state.ended = true;
    state.grade = gradeFromScores(finalScores, state.turn);
    state.payout = 0;
    state.meter = metersFromHistory(state.history);
    speakContaStamp(state.grade);
    render();
  }
}

function handleClose() {
  if (state && !state.ended && state.turn > 0) {
    finishConversa('early');
    return;
  }
  closeConversa();
}

function handleQuickOrder() {
  const go = quickOrder;
  closeConversa();
  go?.();
}

export function closeConversa() {
  if (onKey) {
    document.removeEventListener('keydown', onKey);
    onKey = null;
  }
  containerEl?.parentElement?.remove();
  containerEl = null;
  state = null;
  quickOrder = null;
  game.modalOpen = false;
  closeCallback?.();
  closeCallback = null;
}

export function isConversaOpen(): boolean {
  return state !== null;
}

export async function openConversa(
  npcId: NpcId,
  onClose?: () => void,
  opts?: { onQuickOrder?: () => void },
): Promise<void> {
  if (state) return;

  const p = game.profile;
  if (!p) return;

  closeCallback = onClose ?? null;
  quickOrder = npcId === 'carlos' || npcId === 'graca' ? opts?.onQuickOrder ?? null : null;

  const daily: ConversaDaily = {};

  try {
    const response = await startConversa(
      npcId,
      p.name,
      p.pronoun,
      p.nameplate,
      p.id,
      daily,
    );

    if (response.phase === 'blocked') {
      console.log('[conversa] Blocked:', response.reason);
      quickOrder = null;
      closeCallback = null;
      return;
    }

    if (response.phase !== 'open') {
      console.warn('[conversa] Unexpected response, opening authored Carlos:', response);
      openOfflineConversa(npcId);
      return;
    }

    const npc = findNpc(npcId);

    state = {
      npcId,
      npcName: response.npcName,
      npc,
      subjectId: response.subject.id,
      subjectTitle: response.subject.title,
      subjectGoal: response.subject.goal,
      mode: response.mode,
      offline: response.offline,
      history: [{ who: 'npc', pt: response.line.pt, en: response.line.en || undefined }],
      chips: response.chips,
      turn: 0,
      maxTurns: response.maxTurns,
      ended: false,
      grade: null,
      payout: 0,
      rvNote: null,
      meter: { portuguese: 0, grammar: 0, conversation: 0 },
      daily,
    };

    speak(response.line.pt);
    showConversaPanel();
  } catch (e) {
    console.warn('[conversa] Start failed, opening authored Carlos:', e);
    openOfflineConversa(npcId);
  }
}

function openOfflineConversa(npcId: NpcId) {
  const opened = offlineConversaOpen(npcId);
  if (!opened) {
    state = null;
    quickOrder = null;
    closeCallback = null;
    return;
  }
  state = {
    npcId,
    npcName: opened.npcName,
    npc: findNpc(npcId),
    subjectId: opened.subject.id,
    subjectTitle: opened.subject.title,
    subjectGoal: opened.subject.goal,
    mode: 'authored',
    offline: true,
    history: [{ who: 'npc', pt: opened.line.pt, en: opened.line.en || undefined }],
    chips: opened.chips,
    turn: 0,
    maxTurns: opened.maxTurns,
    ended: false,
    grade: null,
    payout: 0,
    rvNote: null,
    meter: { portuguese: 0, grammar: 0, conversation: 0 },
    daily: {},
  };
  speak(opened.line.pt);
  showConversaPanel();
}

function showConversaPanel() {
  if (!state) return;
  const backdrop = h('div', { class: 'conversa-backdrop', 'data-modal': 'conversa' });
  containerEl = h('div', { class: 'conversa-panel' });
  backdrop.append(containerEl);

  onKey = (e: KeyboardEvent) => {
    if (!state) return;
    if (e.key === 'Escape') {
      handleClose();
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= state.chips.length) handleChip(n - 1);
  };
  document.addEventListener('keydown', onKey);

  ui().append(backdrop);
  game.modalOpen = true;
  render();

  const input = document.getElementById('conversa-input') as HTMLInputElement | null;
  input?.focus();
}
