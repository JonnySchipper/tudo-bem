import {
  CARTELA_COPY,
  CRESTS,
  PADARIA_SIZE_NAMES,
  CARTELA_GOAL,
  classifyChat,
  MAX_CHAT_LEN,
  MISSION_COPY,
  MISSION_STEPS,
  stampsOnDay,
  todayEastern,
  type EmoteKind,
  type NoticeLevel,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon, type IconName } from '../art/ui';
import { mountIdleKickBirds } from './introParrots';
import { mountClockPill } from './clockPill';
import { COMPACT_QUERY, placeHud } from './hudLayout';
import { FEEDBACK_COPY } from '@tudobem/shared';
import { openFeedback } from './feedback';

export interface HudActions {
  chat: (text: string) => void;
  emote: (k: EmoteKind) => void;
  stand: () => void;
  openMap: () => void;
  openCredits: () => void;
  openCaderno: () => void;
  toggleCamera: () => void;
  openRecados: () => void;
  openCartela: () => void;
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

/** The stamp count the cartela chip shows instead of the profile's while a payout plays (null: follow the profile). */
let cartelaHeld: number | null = null;
let lastStamps: number | null = null;
let releaseTimer = 0;

/** Keep the chip on `stamps` for `ms` (the full card while its payout banner plays), then let it follow the profile again. */
export function holdCartelaChip(stamps: number, ms: number) {
  cartelaHeld = stamps;
  window.clearTimeout(releaseTimer);
  game.emit('hud');
  releaseTimer = window.setTimeout(() => {
    cartelaHeld = null;
    game.emit('hud');
  }, ms);
}

export function toast(level: NoticeLevel, pt: string, enText?: string, amount?: number) {
  const el = h(
    'div',
    { class: `toast ${level}`, role: 'status' },
    amount ? h('span', { class: 'amount' }, icon('rv', 16), `+${amount} RV `) : null,
    pt,
    enText ? en(enText) : null,
  );
  toastsEl.append(el);
  while (toastsEl.children.length > 3) toastsEl.firstElementChild?.remove();
  placeHud();
  setTimeout(() => {
    el.remove();
    placeHud();
  }, level === 'reward' ? 5200 : 4500);
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

/**
 * One slim HUD (V4). Top left: the brand, where you are and the clock, in one plate. Top right: the RV coin, the Verde plate and a bar of pixel
 * icons (Mapa, Recados, Diário, Chapéus, Amigos) plus a gear for Música / Voz / Créditos / Sair, and a Fala chip for feedback; the labels (Portuguese with the English gloss)
 * show on hover and focus. On a phone (<= 640 px wide, or a landscape phone under 520 px tall) the same buttons become a drawer behind one ☰,
 * and the emote row hides behind a smiley next to the chat field. Ids are the old ones (`btn-map`, `btn-music`, ...).
 */
export function buildHud(actions: HudActions) {
  const root = ui();

  // ---- the plate: brand + place + clock
  const roomName = h('div', { class: 'room' });
  const coins = h('span', { id: 'coins' });
  const missionPill = h('span', { class: 'hud-chip', id: 'mission-pill', title: `${MISSION_COPY.header.en} — quest kiosk in the Praça` });
  const cartelaPill = h(
    'button',
    {
      type: 'button',
      class: 'hud-chip cartela-chip',
      id: 'cartela-pill',
      title: `${CARTELA_COPY.title.en} — ${CARTELA_COPY.hud.pt}`,
      onclick: () => {
        closeMenus();
        actions.openCartela();
      },
    },
    h('span', { class: 'hud-chip-text' }, `${CARTELA_COPY.hud.pt} 0/${CARTELA_GOAL}`),
  );
  const plate = h('span', { class: 'hud-verde', title: 'Verde: you see English under Portuguese' }, icon('verde', 16), 'Verde');

  // ---- the actions: one set of buttons, an icon bar on desktop and a drawer on a phone
  const btn = (id: string, ico: IconName, pt: string, enText: string, onclick: () => void, cls = '') =>
    h(
      'button',
      {
        class: `hud-btn ${cls}`.trim(),
        id,
        type: 'button',
        'aria-label': `${pt} (${enText})`,
        onclick: () => {
          closeMenus();
          onclick();
        },
      },
      icon(ico, 32),
      h('span', { class: 'hud-label' }, h('b', { class: 'pt' }, pt), h('i', { class: 'hud-gloss' }, enText)),
    );
  const toggleBtn = (id: string, onclick: () => void) =>
    h(
      'button',
      { class: 'hud-btn hud-toggle', id, type: 'button', onclick },
    );
  const decorBtn = btn('btn-decor', 'decor', 'Decorar', 'Decorate', actions.toggleDecor, 'hud-decor');
  const soundBtn = toggleBtn('btn-sound', actions.toggleSound);
  const musicBtn = toggleBtn('btn-music', actions.toggleMusic);
  soundBtn.title = 'Voz / Voice';
  musicBtn.title = 'Música / Music';
  const creditsBtn = btn('btn-credits', 'info', 'Créditos', 'Credits', actions.openCredits);
  const logoutBtn = actions.logout ? btn('btn-logout', 'logout', 'Sair', 'Log out', actions.logout) : null;
  const gear = h('button', { class: 'hud-btn hud-gear', id: 'btn-menu', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'hud-menu', 'aria-label': 'Ajustes (Settings)' }, icon('gear', 32), h('span', { class: 'hud-label' }, h('b', { class: 'pt' }, 'Ajustes'), h('i', { class: 'hud-gloss' }, 'Music, voice, credits')));
  const menu = h(
    'div',
    { class: 'hud-menu', id: 'hud-menu', role: 'group', 'aria-label': 'Ajustes' },
    musicBtn,
    soundBtn,
    creditsBtn,
    logoutBtn,
  );
  const gearWrap = h('div', { class: 'hud-gear-wrap' }, gear, menu);
  const drawerPlate = h('span', { class: 'hud-drawer-head' }, h('span', { class: 'hud-verde', title: 'Verde: you see English under Portuguese' }, icon('verde', 16), 'Verde'), h('span', { class: 'hud-drawer-hint' }, 'Menu'));
  const cameraBtn = btn('btn-camera', 'camera', 'Câmera', 'Camera', actions.toggleCamera);
  cameraBtn.style.display = 'none';
  const actionsNav = h(
    'nav',
    { class: 'hud-actions hud-slab', id: 'hud-actions', 'aria-label': 'Menu do jogo' },
    drawerPlate,
    decorBtn,
    btn('btn-map', 'map', 'Mapa', 'Map', actions.openMap),
    btn('btn-recados', 'recados', 'Recados', 'Errands', actions.openRecados),
    btn('btn-caderno', 'caderno', 'Diário', 'Diary', actions.openCaderno),
    cameraBtn,
    btn('btn-wardrobe', 'hat', 'Chapéus', 'My hats', actions.openWardrobe),
    btn('btn-friends', 'friends', 'Amigos', 'Friends', actions.openFriends),
    gearWrap,
  );
  const feedbackBtn = h(
    'button',
    {
      class: 'hud-feedback hud-slab',
      id: 'btn-feedback',
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-label': `${FEEDBACK_COPY.title.pt} (${FEEDBACK_COPY.button.en})`,
      onclick: () => {
        closeMenus();
        openFeedback();
      },
    },
    h('b', { class: 'pt' }, FEEDBACK_COPY.button.pt),
    h('i', { class: 'hud-gloss' }, FEEDBACK_COPY.button.en),
  );
  const burger = h('button', { class: 'hud-btn hud-burger hud-slab', id: 'btn-burger', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'hud-actions', 'aria-label': 'Menu (Menu)' }, icon('burger', 32));
  const scrim = h('div', { class: 'hud-scrim', 'aria-hidden': 'true' });

  const topbar = h(
    'div',
    { class: 'topbar', id: 'hud-top' },
    h(
      'div',
      { class: 'hud-left hud-slab' },
      h('div', { class: 'brand' }, h('span', { class: 'mark', 'aria-hidden': 'true' }, icon('mark', 32)), h('div', { class: 'logo' }, 'Tudo ', h('span', null, 'Bem')), roomName),
      mountClockPill(),
      game.solo ? h('span', { class: 'hud-solo', id: 'solo-pill', title: 'Prévia estática: o mundo roda no seu navegador. Multiplayer precisa do servidor. / Static preview — the world runs in your browser; multiplayer needs the server build.' }, 'Modo solo', h('i', null, 'Solo mode')) : null,
    ),
    h(
      'div',
      { class: 'hud-right' },
      h('div', { class: 'hud-stats hud-slab' }, plate, h('span', { class: 'hud-rv', title: 'Reais Virtuais (RV) — soft currency' }, icon('rv', 16), coins)),
      feedbackBtn,
      burger,
      actionsNav,
    ),
    missionPill,
    cartelaPill,
  );

  // ---- open / close the drawer (phone) and the gear menu (desktop)
  function closeMenus() {
    actionsNav.classList.remove('open');
    scrim.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    gearWrap.classList.remove('open');
    gear.setAttribute('aria-expanded', 'false');
  }
  const toggleDrawer = () => {
    const open = !actionsNav.classList.contains('open');
    closeMenus();
    if (!open) return;
    actionsNav.classList.add('open');
    scrim.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    placeHud();
  };
  const toggleGear = () => {
    const open = !gearWrap.classList.contains('open');
    closeMenus();
    if (!open) return;
    gearWrap.classList.add('open');
    gear.setAttribute('aria-expanded', 'true');
  };
  burger.addEventListener('click', toggleDrawer);
  gear.addEventListener('click', toggleGear);
  scrim.addEventListener('pointerdown', closeMenus);
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Element | null;
    if (!t?.closest('.hud-gear-wrap, .hud-burger, .hud-actions')) closeMenus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (actionsNav.classList.contains('open') || gearWrap.classList.contains('open'))) closeMenus();
  });
  window.matchMedia(COMPACT_QUERY).addEventListener('change', closeMenus);

  // ---- bottom bar
  const input = h('input', { type: 'text', maxLength: MAX_CHAT_LEN, placeholder: 'Diga oi! (Say hi — Portuguese or English)', 'aria-label': 'Chat', id: 'chat-input' });
const phMq = window.matchMedia(COMPACT_QUERY);  const setPh = () => (input.placeholder = phMq.matches ? 'Diga oi! (Say hi)' : 'Diga oi! (Say hi — Portuguese or English)');  setPh();  phMq.addEventListener('change', setPh);
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
  const bottombar = h('div', { class: 'bottombar' });
  const setTray = (open: boolean) => {
    bottombar.classList.toggle('emotes-open', open);
    emoteToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const emoteBtn = (k: EmoteKind, pt: string, e: string) =>
    h(
      'button',
      {
        type: 'button',
        'data-emote': k,
        onclick: () => {
          actions.emote(k);
          setTray(false);
        },
      },
      bi(pt, e),
    );
  const standBtn = h('button', { onclick: actions.stand, id: 'btn-stand', style: 'display:none' }, bi('Levantar', 'Stand up'));
  const parrotBtn = h('button', { class: 'green', onclick: actions.parrotHint, id: 'btn-parrot', style: 'display:none' }, bi('Dica do papagaio', 'Parrot hint'));
  parrotBtn.prepend(icon('parrot', 16));
  const parrotToggle = h('button', { onclick: actions.toggleParrot, id: 'btn-parrot-toggle', style: 'display:none' });
  const emoteToggle = h('button', { class: 'hud-emote-toggle', id: 'btn-emotes', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Emoções (Emotes)', title: 'Emoções / Emotes', onclick: () => setTray(!bottombar.classList.contains('emotes-open')) }, icon('emote', 32));
  const sendBtn = h('button', { class: 'primary', onclick: send, id: 'chat-send', type: 'button', 'aria-label': 'Enviar (Send)' }, icon('send', 16), h('span', { class: 'send-label' }, 'Enviar'));
  bottombar.append(
    h(
      'div',
      { class: 'emotes', id: 'hud-emotes' },
      emoteBtn('oi', 'Oi!', 'Wave'),
      emoteBtn('valeu', 'Valeu!', 'Thanks'),
      emoteBtn('rir', 'Kkkk', 'Laugh'),
      emoteBtn('dancar', 'Dançar', 'Dance'),
      emoteBtn('desculpa', 'Desculpa', 'Sorry'),
      standBtn,
      parrotBtn,
      parrotToggle,
    ),
    h('div', { class: 'chatbar' }, emoteToggle, input, hint, sendBtn),
  );

  toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
  root.append(topbar, scrim, bottombar, toastsEl);

  const setToggle = (b: HTMLElement, ico: IconName, on: boolean, pt: string, enOn: string, enOff: string) => {
    b.dataset.on = on ? '1' : '0';
    b.replaceChildren(
      icon(ico, 32),
      h('span', { class: 'hud-label' }, h('b', { class: 'pt' }, pt), h('i', { class: 'hud-gloss' }, on ? enOn : enOff)),
      h('span', { class: 'hud-state' }, on ? 'sim' : 'não'),
    );
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  };

  /** A player-owned padaria is not Seu Carlos's: say whose it is and its size instead of the room's gloss. */
  const roomGloss = (r: NonNullable<typeof game.room>) => {
    const team = r.room === 'andar' ? r.academy : undefined;
    if (team) return `${team.owner ? 'Sua academia' : `De ${team.ownerName}`} · ${CRESTS[team.crest].glyph} ${team.size} ${team.size === 1 ? 'membro' : 'membros'}`;
    const own = r.padaria;
    if (!own) return game.roomDef?.gloss ?? '';
    return `${own.owner ? 'Sua padaria' : `De ${own.ownerName}`} · ${PADARIA_SIZE_NAMES[own.size].pt}`;
  };

  const refresh = () => {
    const p = game.profile;
    const r = game.room;
    if (r) {
      const all = [...game.avatars.values()].filter((a) => !a.pub.npc); // the neighbours are not people in the room (the seat count is players)
      const count = all.filter((a) => !a.pub.cpu).length;
      const neighbors = all.length - count;
      roomName.replaceChildren(h('span', { class: 'room-name' }, ...(r.instanceName.includes(' · ') ? [r.instanceName.split(' · ')[0]!, h('span', { class: 'room-inst' }, ` · ${r.instanceName.split(' · ').slice(1).join(' · ')}`)] : [r.instanceName])), h('small', null, `${roomGloss(r)} · ${count}/${r.cap} aqui${neighbors ? ` · ${neighbors} vizinhos` : ''}`));
      document.title = `Tudo Bem · ${r.instanceName}`;
    }
    if (p) {
      coins.textContent = String(p.coins);
      coins.title = `${p.coins} RV`;
      const m = p.mission;
      const done = m ? MISSION_STEPS.filter((s) => m.steps[s.id]).length : 0;
      missionPill.style.display = m?.taken && !m.rewarded ? '' : 'none';
      missionPill.replaceChildren(
        h('span', { class: 'hud-chip-text' }, `${MISSION_COPY.header.pt} ${done}/${MISSION_STEPS.length}`),
        h('span', { class: 'mini-steps', 'aria-hidden': 'true' }, ...MISSION_STEPS.map((s) => h('span', { class: `mini ${m?.steps[s.id] ? 'done' : ''}`, title: s.pt }, icon(s.id, 16)))),
      );
      const day = todayEastern();
      const cst = p.cartela;
      // a full card stays full on the chip while the payout banner plays; then the chip turns over to the fresh card
      const cStamps = cartelaHeld ?? cst?.stamps ?? 0;
      const cToday = cst ? stampsOnDay(cst, day) : 0;
      if (lastStamps !== null && cStamps !== lastStamps && cartelaHeld === null) {
        cartelaPill.classList.remove('stamped', 'fresh');
        void cartelaPill.offsetWidth;
        cartelaPill.classList.add(cStamps > lastStamps ? 'stamped' : 'fresh');
      }
      lastStamps = cStamps;
      cartelaPill.classList.toggle('full', cartelaHeld !== null);
      cartelaPill.replaceChildren(
        h('span', { class: 'hud-chip-text' }, `${CARTELA_COPY.hud.pt} `, h('b', { class: 'cartela-n' }, `${cStamps}/${CARTELA_GOAL}`)),
        h('span', { class: 'cartela-dots', 'aria-hidden': 'true' }, ...Array.from({ length: CARTELA_GOAL }, (_, i) => h('i', { class: i < cStamps ? 'on' : '' }))),
        h('span', { class: 'cartela-mini', 'aria-hidden': 'true' }, bi(`Hoje ${cToday}/4`, `Today ${cToday}/4`)),
      );
      parrotBtn.style.display = p.parrotOwned && p.parrotEquipped ? '' : 'none';
      parrotToggle.style.display = p.parrotOwned ? '' : 'none';
      parrotToggle.replaceChildren(bi(p.parrotEquipped ? 'Guardar papagaio' : 'Chamar papagaio', p.parrotEquipped ? 'Hide parrot' : 'Show parrot'));
      cameraBtn.style.display = p.hasCamera ? '' : 'none';
      cameraBtn.classList.toggle('on', game.cameraOn && !!p.hasCamera);
    }
    decorBtn.style.display = game.isOwnKitnet ? '' : 'none';
    decorBtn.classList.toggle('on', game.editMode);
    setToggle(soundBtn, game.sound ? 'soundOn' : 'soundOff', game.sound, 'Voz', 'Voice on', 'Voice off');
    setToggle(musicBtn, game.music ? 'musicOn' : 'musicOff', game.music, 'Música', 'Music on', 'Music off');
    const self = game.self;
    standBtn.style.display = self && (self.pub.sitting || self.sitOnArrive) ? '' : 'none';
    placeHud();
  };
  game.on('profile', refresh);
  game.on('room', refresh);
  game.on('avatars', refresh);
  game.on('hud', refresh);
  refresh();
  placeHud();
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
 * Soft idle-kick interstitial (art brief §3): the intro's cream `tb-world-card` + awning over a warm veil.
 * The seat is already freed server-side; the session cookie stays, so one tap rejoins.
 * Mounts into `#tb-idle-kick-slot` when a visible entry shell provides one, else into #ui.
 * Hooks for the visual track: `.idle-kicked` (veil) › `.idle-card` › `#idle-title`, `#idle-back`.
 * Art lock: birds here are capped at 1–2 distant parrots (`mountIdleKickBirds`); the full flock is intro-only.
 */
let stopIdleBirds: (() => void) | null = null;
export function idleKickedCard(copy: { pt: string; en: string } | null, onBack?: () => void) {
  stopIdleBirds?.();
  stopIdleBirds = null;
  document.querySelector('.idle-kicked')?.remove();
  if (!copy) return;
  const back = h('button', { class: 'primary', type: 'button', id: 'idle-back' }, bi('Voltar pra Praça', 'Back to the Praça'));
  back.addEventListener('click', () => {
    idleKickedCard(null);
    onBack?.();
  });
  const birds = h('div', { class: 'idle-birds', 'aria-hidden': 'true' });
  (document.querySelector<HTMLElement>('#tb-idle-kick-slot:not([hidden])') ?? ui()).append(
    h(
      'div',
      { class: 'idle-kicked', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'idle-title', 'aria-describedby': 'idle-body' },
      h(
        'div',
        { class: 'idle-card tb-world-card' },
        h('div', { class: 'intro-card-awning', 'aria-hidden': 'true' }),
        birds,
        h('h2', { id: 'idle-title' }, 'Volte quando quiser'),
        h('p', { id: 'idle-body' }, copy.pt),
        en(copy.en, true),
        back,
      ),
    ),
  );
  stopIdleBirds = mountIdleKickBirds(birds);
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
