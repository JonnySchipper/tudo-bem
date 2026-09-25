import { classifyChat, ECONOMY, MAX_CHAT_LEN, TUTORIAL_STEPS, type EmoteKind, type NoticeLevel } from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';

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

export function buildHud(actions: HudActions) {
  const root = ui();

  // ---- top bar
  const roomName = h('div', { class: 'room' });
  const coins = h('span', { id: 'coins' });
  const plate = h('span', { class: 'plate', title: 'Verde: you see English under Portuguese' }, h('span', { class: 'seed' }), 'Verde');
  const soundBtn = h('button', { onclick: actions.toggleSound, title: 'Som / Sound' });
  const decorBtn = h('button', { class: 'yellow', onclick: actions.toggleDecor, id: 'btn-decor' }, bi('Decorar', 'Decorate'));
  const topbar = h(
    'div',
    { class: 'topbar' },
    h('div', { class: 'brand' }, h('div', { class: 'logo' }, 'Tudo ', h('span', null, 'Bem')), roomName),
    h(
      'div',
      { class: 'top-right' },
      decorBtn,
      h('button', { onclick: actions.openMap, id: 'btn-map' }, bi('Mapa', 'Map')),
      h('button', { onclick: actions.openWardrobe, id: 'btn-wardrobe' }, bi('Chapéus', 'My hats')),
      h('button', { onclick: actions.openFriends, id: 'btn-friends' }, bi('Amigos', 'Friends')),
      soundBtn,
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
      hint.textContent = v.action === 'warn' ? 'Vai ser mascarado' : 'Não pode';
      hint.className = 'hint warn';
      hint.title = v.note?.en ?? '';
    }
  });
  const emoteBtn = (k: EmoteKind, pt: string, e: string) => h('button', { onclick: () => actions.emote(k), 'data-emote': k }, bi(pt, e));
  const standBtn = h('button', { onclick: actions.stand, id: 'btn-stand', style: 'display:none' }, bi('Levantar', 'Stand up'));
  const parrotBtn = h('button', { class: 'green', onclick: actions.parrotHint, id: 'btn-parrot', style: 'display:none' }, bi('Dica do papagaio', 'Parrot hint'));
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
    h('div', { class: 'chatbar' }, input, hint, h('button', { class: 'primary', onclick: send, id: 'chat-send' }, 'Enviar')),
  );

  toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
  root.append(topbar, checklist, bottombar, toastsEl);

  const refresh = () => {
    const p = game.profile;
    const r = game.room;
    if (r) {
      const count = game.avatars.size;
      roomName.replaceChildren(r.instanceName, h('small', null, `${game.roomDef?.gloss ?? ''} · ${count}/${r.cap} aqui`));
      document.title = `Tudo Bem · ${r.instanceName}`;
    }
    if (p) {
      coins.textContent = `${p.coins} RV`;
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
    soundBtn.replaceChildren(bi(game.sound ? 'Som: sim' : 'Som: não', game.sound ? 'Voice on' : 'Voice off'));
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

export function overlayMessage(text: string | null) {
  document.querySelector('.overlay-msg')?.remove();
  if (text) ui().append(h('div', { class: 'overlay-msg' }, text));
}
