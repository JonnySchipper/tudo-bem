import {
  CARTELA_COPY,
  CRESTS,
  PADARIA_SIZE_NAMES,
  CARTELA_GOAL,
  CHAT_HINTS,
  classifyChat,
  MAX_CHAT_LEN,
  MISSION_COPY,
  MISSION_STEPS,
  stampsOnDay,
  todayEastern,
  currentStreak,
  localDay,
  normalizeBjj,
  normalizeEscola,
  BELT_LABELS,
  STRIPES_PER_BELT,
  tierRule,
  todayXp,
  type PrivateProfile,
  type EmoteKind,
  type NoticeLevel,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui } from './dom';
import { icon, type IconName } from '../art/ui';
import { mountIdleKickBirds } from './introParrots';
import { mountClockPill } from './clockPill';
import { COMPACT_QUERY, placeHud } from './hudLayout';
import { FEEDBACK_COPY, carryAction } from '@tudobem/shared';
import { openFeedback } from './feedback';
import { openAccount } from './account';
import { tierIcon, tierName } from './plate';
import { wireHudNote } from './hudNotes';
import { CARTELA_RULE, hudShows } from './hudNotesData';
import { showSupportButton } from './supportGate';
import { fetchPublicConfig } from '../auth/config';

/** The HUD's escola reminder: today's XP against the goal (until it is met) and the streak flame. Null before the diary has a word. */
export function escolaGoalChip(p: PrivateProfile): { xp: number; goal: number; streak: number; met: boolean; title: string } | null {
  if (!p.diary?.length) return null;
  const st = normalizeEscola(p.escola, p.diary);
  const today = localDay(Date.now(), -new Date().getTimezoneOffset());
  const xp = todayXp(st, today);
  const streak = currentStreak(st, today);
  const met = xp >= st.goal;
  if (met && !streak) return null;
  // needs_br: true
  const title = met ? `Meta de hoje cumprida! ${streak} dias seguidos. · Today’s goal done!` : `Sua meta de hoje: ${xp}/${st.goal} XP — aulas com a Dona Lúcia, na Escola. · Today’s goal, lessons at the Escola.`;
  return { xp, goal: st.goal, streak, met, title };
}

export interface HudActions {
  chat: (text: string) => void;
  emote: (k: EmoteKind) => void;
  stand: () => void;
  openMap: () => void;
  openCredits: () => void;
  openSupport: () => void;
  openCaderno: () => void;
  toggleCamera: () => void;
  openRecados: () => void;
  openCartela: () => void;
  openFriends: () => void;
  openWardrobe: () => void;
  /** The look editor (body, skin, face, hair, starter outfit): what the new-account creator used to be. */
  openLook: () => void;
  toggleDecor: () => void;
  parrotHint: () => void;
  toggleParrot: () => void;
  /** Eat, drink, or throw away the snack in hand. */
  carry: (action: 'consume' | 'toss') => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  /** English glosses under Portuguese chat: a player setting, separate from the nameplate colour. */
  toggleEnglish: () => void;
  /** Back to the arrivals hall to play the guided tutorial again (settings). */
  replayTutorial: () => void;
  /** Ajustes → Guia: the Vila Ipê guide card (what there is to do). */
  openGuide: () => void;
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
  const missionPill = h('span', { class: 'hud-chip', id: 'mission-pill', title: `${MISSION_COPY.header.en} — quest kiosk in the Praça (the square)` });
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
  const plate = h('span', { class: 'hud-verde', id: 'hud-plate' }, icon('verde', 16), 'Verde');
  // a gentle reminder, never a notification: today's escola goal until it is met, and the streak flame
  const goalChip = h('span', { class: 'hud-goal', id: 'escola-goal-pill', style: 'display:none' });
  const beltEl = h('span', { class: 'hud-belt', id: 'hud-belt', style: 'display:none', title: 'Faixa · Your jiu-jitsu belt — click to see how it grows' });
  // each stat explains itself on a click (hudNotes.ts): what it is and how it grows
  wireHudNote(beltEl, 'belt', 'Faixa: what your belt means');
  wireHudNote(plate, 'plate', 'Placa: what your nameplate colour means');
  wireHudNote(goalChip, 'goal', 'Meta: today’s Escola goal');

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
  const englishBtn = toggleBtn('btn-english', actions.toggleEnglish);
  soundBtn.title = 'Voz / Voice';
  musicBtn.title = 'Música / Music';
  englishBtn.title = 'Inglês embaixo do português / English under the Portuguese (your choice; the nameplate colour never changes it)';
  const creditsBtn = btn('btn-credits', 'info', 'Créditos', 'Credits', actions.openCredits);
  const tutorialBtn = btn('btn-tutorial', 'mark', 'Tutorial', 'Replay the tutorial', actions.replayTutorial);
  const guideBtn = btn('btn-guide', 'map', 'Guia', 'How the Vila works', actions.openGuide);
  const supportBtn = btn('btn-support', 'coracao', 'Apoiar', 'Support', actions.openSupport);
  // hidden until /api/config says checkout is switched on (or the player already has perks): no price ads in the free beta
  let billingReady = false;
  supportBtn.style.display = 'none';
  void fetchPublicConfig().then((c) => {
    billingReady = c.billingReady;
    refresh();
  });
  const logoutBtn = actions.logout ? btn('btn-logout', 'logout', 'Sair', 'Log out', actions.logout) : null;
  // Account settings sit next to Sair: only a signed-in multiplayer session has an account to manage.
  const accountBtn = actions.logout ? btn('btn-account', 'gear', 'Conta', 'Account', openAccount) : null;
  const gear = h('button', { class: 'hud-btn hud-gear', id: 'btn-menu', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'hud-menu', 'aria-label': 'Ajustes (Settings)' }, icon('gear', 32), h('span', { class: 'hud-label' }, h('b', { class: 'pt' }, 'Ajustes'), h('i', { class: 'hud-gloss' }, 'Music, voice, credits')));
  const menu = h(
    'div',
    { class: 'hud-menu', id: 'hud-menu', role: 'group', 'aria-label': 'Ajustes' },
    musicBtn,
    soundBtn,
    englishBtn,
    supportBtn,
    guideBtn,
    tutorialBtn,
    creditsBtn,
    accountBtn,
    logoutBtn,
  );
  const gearWrap = h('div', { class: 'hud-gear-wrap' }, gear, menu);
  const drawerPlateChip = h('span', { class: 'hud-verde' }, icon('verde', 16), 'Verde');
  const drawerPlate = h('span', { class: 'hud-drawer-head' }, drawerPlateChip, h('span', { class: 'hud-drawer-hint' }, 'Menu'));
  wireHudNote(drawerPlateChip, 'plate', 'Placa: what your nameplate colour means');
  const cameraBtn = btn('btn-camera', 'camera', 'Câmera', 'Camera', actions.toggleCamera);
  // the Vila's own buttons wait for the Vila: the arrivals hall and the airport teach only what is on screen there
  const recadosBtn = btn('btn-recados', 'recados', 'Favores', 'Favors', actions.openRecados);
  const wardrobeBtn = btn('btn-wardrobe', 'hat', 'Chapéus', 'My hats', actions.openWardrobe);
  const lookBtn = btn('btn-look', 'look', 'Visual', 'My look', actions.openLook);
  const friendsBtn = btn('btn-friends', 'friends', 'Amigos', 'Friends', actions.openFriends);
  cameraBtn.style.display = 'none';
  const actionsNav = h(
    'nav',
    { class: 'hud-actions hud-slab', id: 'hud-actions', 'aria-label': 'Menu do jogo (Game menu)' },
    drawerPlate,
    decorBtn,
    btn('btn-map', 'map', 'Mapa', 'Map', actions.openMap),
    recadosBtn,
    btn('btn-caderno', 'caderno', 'Diário', 'Diary', actions.openCaderno),
    cameraBtn,
    lookBtn,
    wardrobeBtn,
    friendsBtn,
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
    h('i', { class: 'fala-bubble', 'aria-hidden': 'true' }),
    h('span', { class: 'hud-feedback-words' }, h('b', { class: 'pt' }, FEEDBACK_COPY.button.pt), h('i', { class: 'hud-gloss' }, FEEDBACK_COPY.button.en)),
  );
  const burger = h('button', { class: 'hud-btn hud-burger hud-slab', id: 'btn-burger', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'hud-actions', 'aria-label': 'Menu (Menu)' }, icon('burger', 32));
  const scrim = h('div', { class: 'hud-scrim', 'aria-hidden': 'true' });

  const topbar = h(
    'div',
    { class: 'topbar', id: 'hud-top' },
    h(
      'div',
      { class: 'hud-left hud-slab' },
      h(
        'div',
        { class: 'brand' },
        // the parrot logo: the whole banner where the plate has room, the parrot alone where it gives up the wordmark
        h('span', { class: 'mark', 'aria-hidden': 'true' }, h('img', { class: 'tb-logo', src: `${import.meta.env.BASE_URL}brand/tb-parrot.png`, alt: '', width: '32', height: '32' })),
        h('div', { class: 'logo' }, h('img', { class: 'tb-logo', src: `${import.meta.env.BASE_URL}brand/tb-logo-banner.png`, alt: 'Tudo Bem', height: '34' })),
        roomName,
      ),
      mountClockPill(),
      game.solo ? h('span', { class: 'hud-solo', id: 'solo-pill', title: 'Prévia estática: o mundo roda no seu navegador. Multiplayer precisa do servidor. / Static preview — the world runs in your browser; multiplayer needs the server build.' }, 'Modo solo', h('i', null, 'Solo mode')) : null,
    ),
    h(
      'div',
      { class: 'hud-right' },
      h('div', { class: 'hud-stats hud-slab' }, beltEl, plate, goalChip, h('span', { class: 'hud-rv', id: 'hud-rv', title: 'Reais virtuais (RV): the game’s play money, earned by playing' }, icon('rv', 16), coins)),
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
  const input = h('input', { type: 'text', maxLength: MAX_CHAT_LEN, placeholder: 'Diga oi! (Say hi — Portuguese or English)', 'aria-label': 'Conversa (Chat)', id: 'chat-input' });
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
      const line = v.action === 'warn' ? CHAT_HINTS.warn : CHAT_HINTS.block;
      hint.textContent = `${line.pt} · ${line.en}`;
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
  const carryBtn = h('button', {
    type: 'button',
    id: 'btn-carry',
    style: 'display:none',
    onclick: () => {
      const act = carryAction(game.self?.pub.carry);
      if (act) actions.carry(act.action);
    },
  });
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
    h('div', { class: 'chatbar' }, emoteToggle, carryBtn, input, hint, sendBtn),
  );

  toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
  root.append(topbar, scrim, bottombar, toastsEl);

  const setToggle = (b: HTMLElement, ico: IconName, on: boolean, pt: string, enOn: string, enOff: string) => {
    b.dataset.on = on ? '1' : '0';
    b.replaceChildren(
      icon(ico, 32),
      h('span', { class: 'hud-label' }, h('b', { class: 'pt' }, pt), h('i', { class: 'hud-gloss' }, on ? enOn : enOff)),
      h('span', { class: 'hud-state' }, on ? 'sim' : 'não', en(on ? ' yes' : ' no')),
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
      paintHudBelt(p.bjj);
      const shows = hudShows(p);
      beltEl.style.display = shows.belt ? '' : 'none';
      plate.style.display = shows.plate ? '' : 'none';
      drawerPlateChip.style.display = shows.plate ? '' : 'none';
      cartelaPill.style.display = shows.cartela ? '' : 'none';
      cartelaPill.title = `${CARTELA_COPY.title.en}: ${CARTELA_RULE}`;
      for (const b of [recadosBtn, lookBtn, wardrobeBtn, friendsBtn]) b.style.display = shows.vila ? '' : 'none';
      // the first time the Vila's menu opens up: the look picked on the plane can be changed now (once per profile)
      if (shows.vila) {
        const key = `tb_look_hint_${p.id}`;
        try {
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            toast('info', 'Quer mudar o seu visual? Menu → Visual.', 'Want to change your look? Menu → Visual (body, skin, face, hair, outfit).');
          }
        } catch {
          /* no storage: no hint */
        }
      }
      coins.textContent = String(p.coins);
      coins.title = `${p.coins} RV · reais virtuais (RV), the game’s play money`;
      const tier = p.nameplate ?? 'verde';
      const plateTitle = `Placa ${tierName(tier)}: ${tierRule(tier).en} nameplate, earned in the Escola by words mastered. Click to see how it grows.`;
      for (const el of [plate, drawerPlateChip]) {
        el.className = `hud-verde hud-tier-${tier}`;
        el.title = plateTitle;
        el.replaceChildren(tier === 'verde' ? icon('verde', 16) : tierIcon(tier), tierName(tier));
      }
      const goal = escolaGoalChip(p);
      goalChip.style.display = goal && shows.goal ? '' : 'none';
      if (goal) {
        goalChip.title = goal.title;
        goalChip.classList.toggle('met', goal.met);
        goalChip.replaceChildren(
          goal.streak ? h('span', { class: 'hud-flame', 'aria-label': `${goal.streak} dias seguidos` }, h('i', { class: 'flame-ico', 'aria-hidden': 'true' }), String(goal.streak)) : '',
          goal.met ? '' : h('span', { class: 'hud-goal-text' }, h('b', { class: 'hud-goal-label' }, 'Meta '), `${goal.xp}/${goal.goal} XP`),
        );
      }
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
      supportBtn.style.display = showSupportButton(billingReady, p.subscription, Date.now()) ? '' : 'none';
      cameraBtn.classList.toggle('on', game.cameraOn && !!p.hasCamera);
    }
    decorBtn.style.display = game.isOwnKitnet ? '' : 'none';
    decorBtn.classList.toggle('on', game.editMode);
    setToggle(soundBtn, game.sound ? 'soundOn' : 'soundOff', game.sound, 'Voz', 'Voice on', 'Voice off');
    setToggle(musicBtn, game.music ? 'musicOn' : 'musicOff', game.music, 'Música', 'Music on', 'Music off');
    setToggle(englishBtn, 'info', game.englishHelp, 'Inglês', 'English help on', 'English help off');
    const self = game.self;
    standBtn.style.display = self && (self.pub.sitting || self.sitOnArrive) ? '' : 'none';
    const act = carryAction(self?.pub.carry);
    carryBtn.style.display = act ? '' : 'none';
    if (act && carryBtn.dataset.label !== act.pt) {
      carryBtn.dataset.label = act.pt;
      carryBtn.className = act.action === 'toss' ? '' : 'green';
      carryBtn.replaceChildren(bi(act.pt, act.en));
      carryBtn.setAttribute('aria-label', `${act.pt} (${act.en})`);
    }
    if (!act) delete carryBtn.dataset.label;
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

/** Belt chip on the HUD. Reads the private profile, so a white belt with no stripes still updates. */
function paintHudBelt(bjj: PrivateProfile['bjj']): void {
  const el = document.getElementById('hud-belt');
  if (!el) return;
  const b = normalizeBjj(bjj);
  const label = BELT_LABELS[b.belt];
  el.className = `hud-belt belt-${b.belt}`;
  el.setAttribute('aria-label', `${label.pt}, ${b.stripes} ${b.stripes === 1 ? 'grau' : 'graus'}`);
  const shown = Math.min(STRIPES_PER_BELT, b.stripes);
  el.replaceChildren(h('i', { class: 'band' }), ...Array.from({ length: STRIPES_PER_BELT }, (_, i) => h('i', { class: i < shown ? 'pip on' : 'pip' })));
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
  const back = h('button', { class: 'primary', type: 'button', id: 'idle-back' }, bi('Voltar pra Praça', 'Back to the square'));
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
