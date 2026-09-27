import { classifyChat, ECONOMY, MAX_CHAT_LEN, MISSION_COPY, MISSION_STEPS, TUTORIAL_STEPS, type EmoteKind, type NoticeLevel } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon } from '../art/ui';

export interface HudActions {
  chat: (text: string) => void;
  emote: (k: EmoteKind) => void;
  stand: () => void;
  openMap: () => void;
  openFriends: () => void;
  openWardrobe: () => void;
  toggleDecor: () => void;
  parrotHint: () => void;
  toggleParrot: () => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  /** Multiplayer only (solo has no account). */
  logout?: () => void;
}

let toastsEl: HTMLElement;

export function toast(level: NoticeLevel, pt: string, enText?: string, amount?: number) {
  const el = h(
    'div',
    { class: `toast ${level}`, role: 'status' },
    amount ? h('span', { class: 'amount' }, `+${amount} RV `) : null,
    pt,
    enText ? en(enText) : null,
  );
  toastsEl.append(el);
  while (toastsEl.children.length > 4) toastsEl.firstElementChild?.remove();
  setTimeout(() => el.remove(), level === 'reward' ? 5200 : 4500);
}

/** Celebration card when the daily kiosk mission pays out. */
export function missionBanner() {
  document.querySelector('.mission-banner')?.remove();
  const el = h(
    'div',
    { class: 'mission-banner', role: 'status', id: 'mission-banner' },
    h('span', { class: 'mini-steps' }, ...MISSION_STEPS.map((s) => h('span', { class: 'mini done', title: s.pt }, icon(s.id, 26)))),
    h('div', null, h('b', null, MISSION_COPY.done.pt), en(MISSION_COPY.done.en)),
  );
  ui().append(el);
  setTimeout(() => el.remove(), 5200);
}

export function buildHud(actions: HudActions) {
  const root = ui();

  // ---- top bar
  const roomName = h('div', { class: 'room' });
  const coins = h('span', { id: 'coins' });
  const missionPill = h('span', { class: 'pill', id: 'mission-pill', title: `${MISSION_COPY.header.en} — quest kiosk in the Praça` });
  const plate = h('span', { class: 'plate', title: 'Verde: you see English under Portuguese' }, h('span', { class: 'seed' }), 'Verde');
  const soundBtn = h('button', { onclick: actions.toggleSound, title: 'Voz / Voice', id: 'btn-sound' });
  const musicBtn = h('button', { onclick: actions.toggleMusic, title: 'Música / Music', id: 'btn-music' });
  const decorBtn = h('button', { class: 'yellow', onclick: actions.toggleDecor, id: 'btn-decor' }, icon('decor'), bi('Decorar', 'Decorate'));
  const topbar = h(
    'div',
    { class: 'topbar' },
    h('div', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }), h('div', { class: 'logo' }, 'Tudo ', h('span', null, 'Bem')), roomName),
    h(
      'div',
      { class: 'top-right' },
      decorBtn,
      h('button', { onclick: actions.openMap, id: 'btn-map' }, icon('map'), bi('Mapa', 'Map')),
      h('button', { onclick: actions.openWardrobe, id: 'btn-wardrobe' }, icon('hat'), bi('Chapéus', 'My hats')),
      h('button', { onclick: actions.openFriends, id: 'btn-friends' }, icon('friends'), bi('Amigos', 'Friends')),
      musicBtn,
      soundBtn,
      actions.logout ? h('button', { onclick: actions.logout, id: 'btn-logout', title: 'Sair da conta / Log out', 'aria-label': 'Sair da conta' }, icon('logout'), bi('Sair', 'Log out')) : null,
      game.solo ? h('span', { class: 'pill', title: 'Prévia estática: o mundo roda no seu navegador. Multiplayer precisa do servidor. / Static preview — the world runs in your browser; multiplayer needs the server build.', id: 'solo-pill' }, 'Modo solo') : null,
      missionPill,
      h('span', { class: 'pill' }, plate),
      h('span', { class: 'pill', title: 'Reais Virtuais (RV) — soft currency' }, h('span', { class: 'coin' }), coins),
    ),
  );

  // ---- checklist
  const list = h('ol');
  const checklist = h(
    'div',
    { class: 'checklist', id: 'checklist' },
    h('h3', { onclick: () => checklist.classList.toggle('collapsed') }, 'Primeiros passos', h('small', { style: 'font-family:var(--font-body);font-size:.7em;color:var(--ink-soft)' }, 'First steps ▾')),
    list,
    h('div', { class: 'reward-note' }, `Complete tudo: +${ECONOMY.tutorialBonus} RV bônus!`, en('Finish all steps for a bonus.')),
  );

  // ---- bottom bar
  const input = h('input', { type: 'text', maxLength: MAX_CHAT_LEN, placeholder: 'Diga oi! (Say hi — Portuguese or English)', 'aria-label': 'Chat', id: 'chat-input' });
  const hint = h('span', { class: 'hint' }, 'Enter ↵');
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    const v = classifyChat(text);
    if (v.action === 'block' || v.action === 'escalate') {
      toast('block', v.note?.pt ?? 'Mensagem bloqueada.', v.note?.en);
      if (v.action === 'escalate') actions.chat(text);
      return;
    }
    actions.chat(text);
    input.value = '';
    hint.textContent = 'Enter ↵';
    hint.className = 'hint';
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') send();
    if (e.key === 'Escape') input.blur();
  });
  input.addEventListener('input', () => {
    const v = input.value.trim() ? classifyChat(input.value) : null;
    if (!v || v.action === 'allow') {
      hint.textContent = `${input.value.length}/${MAX_CHAT_LEN}`;
      hint.className = 'hint';
    } else {
      hint.textContent = v.action === 'warn' ? 'Vai com aviso' : v.action === 'escalate' ? 'Vai pra revisão' : 'Não pode';
      hint.className = 'hint warn';
      hint.title = v.note?.en ?? '';
    }
  });
  const emoteBtn = (k: EmoteKind, pt: string, e: string) => h('button', { onclick: () => actions.emote(k), 'data-emote': k }, bi(pt, e));
  const standBtn = h('button', { onclick: actions.stand, id: 'btn-stand', style: 'display:none' }, bi('Levantar', 'Stand up'));
  const parrotBtn = h('button', { class: 'green', onclick: actions.parrotHint, id: 'btn-parrot', style: 'display:none' }, bi('Dica do papagaio', 'Parrot hint'));
  parrotBtn.prepend(icon('parrot', 18));
  const parrotToggle = h('button', { onclick: actions.toggleParrot, id: 'btn-parrot-toggle', style: 'display:none' });
  const bottombar = h(
    'div',
    { class: 'bottombar' },
    h(
      'div',
      { class: 'emotes' },
      emoteBtn('oi', 'Oi!', 'Wave'),
      emoteBtn('valeu', 'Valeu!', 'Thanks'),
      emoteBtn('rir', 'Kkkk', 'Laugh'),
      emoteBtn('dancar', 'Dançar', 'Dance'),
      emoteBtn('desculpa', 'Desculpa', 'Sorry'),
      standBtn,
      parrotBtn,
      parrotToggle,
    ),
    h('div', { class: 'chatbar' }, input, hint, h('button', { class: 'primary', onclick: send, id: 'chat-send', style: 'display:inline-flex;gap:6px;align-items:center' }, icon('send', 16), 'Enviar')),
  );

  toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
  root.append(topbar, checklist, bottombar, toastsEl);

  const refresh = () => {
    const p = game.profile;
    const r = game.room;
    if (r) {
      const all = [...game.avatars.values()];
      const count = all.filter((a) => !a.pub.cpu).length;
      const neighbors = all.length - count;
      roomName.replaceChildren(r.instanceName, h('small', null, `${game.roomDef?.gloss ?? ''} · ${count}/${r.cap} aqui${neighbors ? ` · ${neighbors} vizinhos` : ''}`));
      document.title = `Tudo Bem · ${r.instanceName}`;
    }
    if (p) {
      coins.textContent = `${p.coins} RV`;
      const m = p.mission;
      const done = m ? MISSION_STEPS.filter((s) => m.steps[s.id]).length : 0;
      missionPill.style.display = m?.taken && !m.rewarded ? '' : 'none';
      missionPill.replaceChildren(
        `${MISSION_COPY.header.pt} ${done}/${MISSION_STEPS.length}`,
        h('span', { class: 'mini-steps', 'aria-hidden': 'true' }, ...MISSION_STEPS.map((s) => h('span', { class: `mini ${m?.steps[s.id] ? 'done' : ''}`, title: s.pt }, icon(s.id, 16)))),
      );
      list.replaceChildren(
        ...TUTORIAL_STEPS.map((s) =>
          h('li', { class: p.tutorial[s.id] ? 'done' : '', 'data-step': s.id }, h('span', { class: 'box' }), h('div', null, s.pt, en(s.en, true))),
        ),
      );
      checklist.style.display = p.tutorialRewarded && Object.values(p.tutorial).every(Boolean) ? 'none' : '';
      parrotBtn.style.display = p.parrotOwned && p.parrotEquipped ? '' : 'none';
      parrotToggle.style.display = p.parrotOwned ? '' : 'none';
      parrotToggle.replaceChildren(bi(p.parrotEquipped ? 'Guardar papagaio' : 'Chamar papagaio', p.parrotEquipped ? 'Hide parrot' : 'Show parrot'));
    }
    decorBtn.style.display = game.isOwnKitnet ? '' : 'none';
    decorBtn.classList.toggle('primary', game.editMode);
    soundBtn.replaceChildren(icon(game.sound ? 'soundOn' : 'soundOff'), bi(game.sound ? 'Voz: sim' : 'Voz: não', game.sound ? 'Voice on' : 'Voice off'));
    musicBtn.replaceChildren(icon(game.music ? 'musicOn' : 'musicOff'), bi(game.music ? 'Música: sim' : 'Música: não', game.music ? 'Music on' : 'Music off'));
    const self = game.self;
    standBtn.style.display = self && (self.pub.sitting || self.sitOnArrive) ? '' : 'none';
  };
  game.on('profile', refresh);
  game.on('room', refresh);
  game.on('avatars', refresh);
  game.on('hud', refresh);
  refresh();
  return { refresh, focusChat: () => input.focus() };
}

export function parrotWhisper(pt: string, enText: string) {
  document.querySelector('.parrot-whisper')?.remove();
  const el = h('div', { class: 'parrot-whisper', role: 'status' }, 'Psiu… “', h('b', null, pt), '”', en(enText));
  ui().append(el);
  setTimeout(() => el.remove(), 6000);
}

let hoverEl: HTMLElement | null = null;
export function hoverLabel(x: number, y: number, pt: string | null, enText?: string) {
  if (!pt) {
    hoverEl?.remove();
    hoverEl = null;
    return;
  }
  if (!hoverEl) {
    hoverEl = h('div', { class: 'hover-label' });
    ui().append(hoverEl);
  }
  hoverEl.replaceChildren(pt, enText ? h('small', null, enText) : '');
  hoverEl.style.left = `${x}px`;
  hoverEl.style.top = `${y}px`;
}

export function overlayMessage(text: string | null, onRetry?: () => void) {
  document.querySelector('.overlay-msg')?.remove();
  if (!text) return;
  ui().append(
    h(
      'div',
      { class: 'overlay-msg', role: 'status' },
      h(
        'div',
        { class: 'overlay-card' },
        h('p', null, text),
        onRetry ? h('button', { class: 'primary', type: 'button', onclick: onRetry }, bi('Tentar de novo', 'Try again')) : null,
      ),
    ),
  );
}

/**
 * Soft idle-kick interstitial (art brief §3: same cream-card / soft-veil family as the intro).
 * The seat is already freed server-side; the session cookie stays, so one tap rejoins.
 * Mounts into `#tb-idle-kick-slot` when the entry shell provides one, else into #ui.
 * Hooks for the visual track: `.idle-kicked` (veil) › `.idle-card` › `#idle-title`, `#idle-back`.
 */
export function idleKickedCard(copy: { pt: string; en: string } | null, onBack?: () => void) {
  document.querySelector('.idle-kicked')?.remove();
  if (!copy) return;
  const back = h('button', { class: 'primary', type: 'button', id: 'idle-back' }, bi('Voltar pra Praça', 'Back to the Praça'));
  back.addEventListener('click', () => {
    document.querySelector('.idle-kicked')?.remove();
    onBack?.();
  });
  (document.getElementById('tb-idle-kick-slot') ?? ui()).append(
    h(
      'div',
      { class: 'idle-kicked', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'idle-title', 'aria-describedby': 'idle-body' },
      h(
        'div',
        { class: 'idle-card' },
        h('h2', { id: 'idle-title' }, 'Volte quando quiser'),
        h('p', { id: 'idle-body' }, copy.pt),
        en(copy.en, true),
        back,
      ),
    ),
  );
  back.focus();
}

/** Non-blocking recovery after reconnect gives up or this tab is replaced. Clears any previous banner. */
export function reconnectBanner(opts: { kind: 'failed' | 'replaced'; midOrder: boolean; onRetry: () => void } | null) {
  document.querySelector('.reconnect-banner')?.remove();
  if (!opts) return;
  const pt =
    opts.kind === 'replaced'
      ? 'Você entrou em outra aba.'
      : opts.midOrder
        ? 'A conexão caiu no meio do pedido.'
        : 'A conexão caiu.';
  const enText =
    opts.kind === 'replaced'
      ? 'You signed in from another tab.'
      : opts.midOrder
        ? 'The connection dropped mid-order. You can play again.'
        : 'Couldn’t reconnect.';
  const button =
    opts.kind === 'replaced' ? bi('Entrar de novo', 'Join again') : bi('Tentar de novo', 'Try again');
  ui().append(
    h(
      'div',
      { class: 'reconnect-banner', role: 'status' },
      h('p', null, pt, en(enText)),
      h('button', { class: 'primary', type: 'button', onclick: opts.onRetry }, button),
    ),
  );
}
