import {
  CONVERSA_AXES,
  CONVERSA_COPY,
  CONVERSA_MAX_PLAYER_MSGS,
  CONVERSA_MIN_MSGS_TO_SCORE,
  gradeFromScores,
  gradeCopy,
  gradeRV,
  metersFromHistory,
  ROOMS,
  type Bilingual,
  type ConversaGrade,
  type ConversaLine,
  type ConversaMeter,
  type ConversaScores,
  type NpcDef,
  type NpcId,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { renderAvatarPreview } from '../render/avatar';
import { speak } from '../audio';
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
  meter: ConversaMeter;
  daily: ConversaDaily;
}

let state: ConversaState | null = null;
let containerEl: HTMLElement | null = null;
let closeCallback: (() => void) | null = null;

function findNpc(npcId: NpcId): NpcDef | null {
  for (const room of Object.values(ROOMS)) {
    const npc = room.npcs.find((n) => n.id === npcId);
    if (npc) return npc;
  }
  return null;
}

function portrait(npc: NpcDef | null) {
  const c = h('canvas', { width: 96, height: 110, style: 'width:96px;height:110px' });
  let raf = 0;
  const loop = (ts: number) => {
    if (!c.isConnected && ts > 1000) return cancelAnimationFrame(raf);
    if (npc) renderAvatarPreview(c, npc.appearance, npc.hat, false, ts / 1000, { scale: 2.35, footY: 236, npc: npc.id });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return h('div', { class: 'conversa-portrait' }, c);
}

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

function buildMeter(meter: ConversaMeter): HTMLElement {
  const bars = CONVERSA_AXES.map((axis) =>
    h(
      'div',
      { class: 'conversa-meter-row' },
      h('span', { class: 'label' }, axis.en),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${meter[axis.id]}%` })),
      h('span', { class: 'pct' }, `${meter[axis.id]}%`),
    ),
  );
  return h('div', { class: 'conversa-meters' }, ...bars);
}

function buildScoreCard(grade: ConversaGrade, payout: number, meter: ConversaMeter): HTMLElement {
  const copy = gradeCopy(grade);
  const gradeClass = grade === 'pass' ? 'pass' : grade === 'almost' ? 'almost' : 'try-again';

  const axes = CONVERSA_AXES.map((axis) => {
    const pct = meter[axis.id];
    return h(
      'div',
      { class: 'score-axis' },
      h('span', { class: 'axis-label' }, axis.en),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: `width:${pct}%` })),
      h('small', { class: 'tip' }, axis.tip.en),
    );
  });

  return h(
    'div',
    { class: 'conversa-score-card' },
    h('div', { class: `grade ${gradeClass}` }, copy.label.en),
    h('div', { class: 'grade-line' }, copy.line.pt, en(copy.line.en, true)),
    payout > 0 ? h('div', { class: 'payout' }, `+${payout} RV`) : null,
    h('div', { class: 'axes' }, ...axes),
  );
}

function render() {
  if (!state || !containerEl) return;

  const header = h(
    'div',
    { class: 'conversa-header' },
    portrait(state.npc),
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
  const meter = buildMeter(state.meter);

  let body: HTMLElement;
  if (state.ended && state.grade) {
    body = h(
      'div',
      { class: 'conversa-body ended' },
      buildScoreCard(state.grade, state.payout, state.meter),
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
      meter,
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

  input.value = '';
  input.disabled = true;

  state.turn++;
  state.history.push({ who: 'player', pt: text });
  render();

  try {
    const response = await sendConversaTurn(
      state.npcId,
      state.subjectId,
      game.profile?.name ?? 'Jogador',
      game.profile?.pronoun ?? 'nome',
      game.profile?.nameplate ?? 'verde',
      game.profile?.id ?? '',
      text,
      state.history,
      state.turn,
      state.daily,
    );

    handleApiResponse(response);
  } catch (e) {
    console.error('[conversa] Turn failed:', e);
    state.history.push({
      who: 'npc',
      pt: 'Hmm. Repete, por favor?',
      en: 'Hmm. Could you repeat that?',
    });
    render();
  } finally {
    input.disabled = false;
    input.focus();
  }
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
      const input = document.getElementById('conversa-input') as HTMLInputElement | null;
      if (input) input.disabled = false;
      state.history.pop();
      state.turn--;
    }
    render();
    return;
  }

  if (response.phase === 'turn') {
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

    if (response.updateDaily) {
      state.daily = { ...state.daily, ...response.updateDaily };
    }

    if (response.payout > 0 && game.profile) {
      game.profile.coins += response.payout;
      game.emit('profile');
    }

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

export function closeConversa() {
  if (containerEl) {
    containerEl.remove();
    containerEl = null;
  }
  state = null;
  game.modalOpen = false;
  closeCallback?.();
  closeCallback = null;
}

export function isConversaOpen(): boolean {
  return state !== null;
}

export async function openConversa(npcId: NpcId, onClose?: () => void): Promise<void> {
  if (state) return;

  const p = game.profile;
  if (!p) return;

  closeCallback = onClose ?? null;

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
      return;
    }

    if (response.phase !== 'open') {
      console.error('[conversa] Unexpected response:', response);
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
      meter: { portuguese: 0, grammar: 0, conversation: 0 },
      daily,
    };

    speak(response.line.pt);

    const backdrop = h('div', { class: 'conversa-backdrop', 'data-modal': 'conversa' });
    containerEl = h('div', { class: 'conversa-panel' });
    backdrop.append(containerEl);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        document.removeEventListener('keydown', onKey);
      }
      const n = Number(e.key);
      if (n >= 1 && n <= (state?.chips.length ?? 0)) {
        handleChip(n - 1);
      }
    };
    document.addEventListener('keydown', onKey);

    ui().append(backdrop);
    game.modalOpen = true;
    render();

    const input = document.getElementById('conversa-input') as HTMLInputElement | null;
    input?.focus();
  } catch (e) {
    console.error('[conversa] Start failed:', e);
    state = null;
  }
}
