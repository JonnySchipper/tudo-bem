import './styles.css';
import './styles/intro.css';
import './styles/pixel-ui.css';
import './styles/dialogue.css';
import './styles/recados.css';
import './styles/feira.css';
import './styles/hud.css';
import { runIntroGate } from './ui/intro';
import { hasServerSession, signOut } from './auth/client';
import { INTRO_PASSED_KEY } from './auth/session';
import {
  MISSION_COPY,
  ROOMS,
  TUTORIAL_STEPS,
  buildGrid,
  furnitureById,
  greetingFor,
  localizeGreeting,
  hatById,
  HOTSPOT_READ_RANGE,
  HOTSPOTS,
  hotspotById,
  hotspotDistance,
  hotspotTitle,
  isCpuId,
  isWalkable,
  readSpot,
  subjectChoices,
  npcDefById,
  VENDORS,
  type EmoteKind,
  type HotspotDef,
  type NpcDef,
  type NpcId,
  type PropDef,
  type RoomId,
  type ServerMsg,
  type Tile,
} from '@tudobem/shared';
import { game, type ClientAvatar, type PendingAction } from './state';
import { Net, wsUrl, type NetLike } from './net';
import { clock, parseTimeOfDay } from './gameClock';
import { IdleTalk } from './idleTalk';
import { LocalNet } from './localNet';
import { initPixelArt } from './ui/pixelArt';
import type { Guide, Hit, WorldView } from './render/view';
import { runOnboarding, closeOnboarding } from './ui/onboarding';
import { buildHud, hoverLabel, idleKickedCard, missionBanner, overlayMessage, parrotWhisper, reconnectBanner, toast } from './ui/hud';
import {
  buildDecorPanel,
  closeDialogue,
  closeModal,
  MinigameUI,
  openKiosk,
  modalId,
  openFriends,
  openHatShop,
  openMap,
  openProfileCard,
  showJulia,
  showParrotPerch,
  showScene,
} from './ui/panels';
import { openPedido, updatePedido, closePedido, isPedidoOpen } from './ui/pedido';
import { openCredits } from './ui/credits';
import { isDialogueBoxOpen, setDialogueHost, showDialogueBox } from './ui/dialogue';
import { mountTracker, openJournal, runPrelude } from './ui/recados';
import { heartsWith } from './ui/recadoView';
import { openNpcTalk } from './ui/npcTalk';
import { onFeiraError, onFeiraMsg, openFeira, openFeiraClosed } from './ui/feira';
import { openCaderno } from './ui/caderno';
import { openHotspotCard } from './ui/hotspotCard';
import { HotspotCues } from './ui/hotspotCue';
import { setHeardSink } from './ui/heard';
import { closeConversa, isConversaOpen, openConversa } from './ui/conversa';
import { RollUI, closeRoll } from './ui/roll';
import { speak, stopSpeaking, unlockSpeech } from './audio';
import { ambience } from './ambience';
import { installViewport } from './ui/viewport';
import { mountJoystick } from './ui/joystick';
import { arrowForKey, stepForHeld, stepTarget, type Arrow } from './ui/keys';
import { installUiArt } from './art/ui';

installUiArt();
/** The pixel manifest feeds the DOM art (icons, portraits, ui kit) in both views. A failed load leaves the old chrome and no icons. */
const pixelArtReady = initPixelArt();
installViewport();
const armAudio = () => {
  unlockSpeech();
  ambience.unlock();
};
window.addEventListener('pointerdown', armAudio, { once: true });
window.addEventListener('keydown', armAudio, { once: true });

const TOKEN_KEY = 'tb_token';
const LAST_ROOM_KEY = 'tb_last_room';

await pixelArtReady;
const canvas = document.getElementById('world') as HTMLCanvasElement;
// The pixel view (top-down, Phaser) is the only world view. The isometric renderer was deleted in Phase 5; `?view=iso` is ignored.
if (new URLSearchParams(location.search).get('view') === 'iso') console.info('[view] the isometric view was removed; drawing the pixel view');
document.body.classList.add('view-pixel');
const renderer: WorldView = new (await import('./render/pixel/PixelView')).PixelView(canvas);
/** Static deploys (no WebSocket server) run the World in-page. `?solo` forces it anywhere. */
const SOLO = import.meta.env.VITE_LOCAL_WORLD === '1' || new URLSearchParams(location.search).has('solo');
const net: NetLike = SOLO ? new LocalNet() : new Net(wsUrl());
game.solo = SOLO;

let hud: ReturnType<typeof buildHud> | null = null;
let decor: ReturnType<typeof buildDecorPanel> | null = null;
let onboarding: ReturnType<typeof runOnboarding> | null = null;
let minigame: MinigameUI | null = null;
let rollUi: RollUI | null = null;
/** True between mg start and end/quit — used to recover if the panel disappears mid-shift. */
let mgShiftActive = false;
/** X was pressed; a goodbye notice (nothing served yet) should close the panel. An end card clears this itself. */
let mgQuitPending = false;
let started = false;
/** If a reconnect doesn't bring the open ticket back, don't leave Me vê um locked. */
let mgResumeWatch = 0;

function newMinigameUI() {
  return new MinigameUI({
    submit: (tray, mods, built) => net.send({ t: 'mg', action: 'submit', tray, mods, built }),
    timeout: () => net.send({ t: 'mg', action: 'timeout' }),
    quit: () => {
      mgQuitPending = true;
      mgShiftActive = false;
      net.send({ t: 'mg', action: 'quit' });
    },
    again: startMinigame,
    sync: () => net.send({ t: 'mg', action: 'sync' }),
  });
}

/** Server still has a shift but the modal is gone — ask for the open ticket again. */
function resurrectMinigamePanel() {
  if (!mgShiftActive || modalId() === 'minigame') return;
  net.send({ t: 'mg', action: 'sync' });
  toast('info', 'Reabrindo o balcão…', 'Re-opening the counter…');
}

function clearMgResumeWatch() {
  window.clearTimeout(mgResumeWatch);
  mgResumeWatch = 0;
}

function armMgResumeWatch() {
  clearMgResumeWatch();
  mgResumeWatch = window.setTimeout(() => {
    mgResumeWatch = 0;
    if (modalId() === 'minigame') return;
    if (mgShiftActive) {
      resurrectMinigamePanel();
      armMgResumeWatch();
      return;
    }
    closeModal();
    minigame = null;
    toast('info', 'A conexão caiu no meio do pedido. Pode jogar de novo.', 'The connection dropped mid-order. You can play again.');
  }, 2500);
}

function failClearMinigame() {
  clearMgResumeWatch();
  mgShiftActive = false;
  if (modalId() === 'minigame') closeModal();
  minigame = null;
}

// ---------------------------------------------------------------- helpers

const now = () => performance.now();

function toClientAvatar(pub: ClientAvatar['pub']): ClientAvatar {
  return { pub, from: { x: pub.x, y: pub.y }, path: [], start: now(), sitOnArrive: false, emote: null, bubbles: [], seed: Math.random() * 10 };
}

function selfTile(): { tile: Tile; moving: boolean } | null {
  const s = game.self;
  if (!s) return null;
  const p = renderer.avatarPos(s, now());
  return { tile: p.tile, moving: p.moving };
}

function walkTo(tile: Tile, pending: PendingAction | null, sit = false) {
  game.pending = pending;
  const cur = selfTile();
  if (cur && !cur.moving && cur.tile.x === tile.x && cur.tile.y === tile.y) {
    if (pending) runPending();
    return;
  }
  net.send({ t: 'move', x: tile.x, y: tile.y, sit });
}

function runPending() {
  const p = game.pending;
  game.pending = null;
  if (!p) return;
  if (p.kind === 'portal') net.send({ t: 'portal', portalId: p.portalId });
  else if (p.kind === 'npc') talkTo(p.npc);
  else if (p.kind === 'hotspot') {
    const hs = hotspotById(p.hotspotId);
    if (hs) readHotspot(hs);
  } else propAction(p.action, p.kind === 'prop' ? p.propId : undefined);
}

/** The feira (Phase 9): a stall, or the Hortifrúti corner. A stall whose vendor is away shows the closed note (D12: the corner at the banca sells at every hour). */
function openStall(propId?: string) {
  const prop = game.roomDef?.props.find((x) => x.id === propId);
  const vendor = prop?.vendor;
  if (!vendor) return;
  closeDialogue();
  const there = vendor === 'banca' || game.liveNpcs(now()).some((n) => n.id === VENDORS[vendor].npc && game.avatars.get(`npc-${n.id}`)?.pub.activity === 'trabalhando');
  if (!there) return openFeiraClosed(vendor);
  openFeira(vendor, { send: (m) => net.send(m) }, { talked: (id) => net.send({ t: 'talk', npc: id }) });
}

function talkTo(npc: NpcDef['id']) {
  closeDialogue();
  const vendor = npc === 'tia_lu' || npc === 'ze' || npc === 'chico' || npc === 'rosa';
  // the server counts the talk for NPCs without a Conversa (bond +2 once a day, `falar` steps); the bakers count it through the scene / Conversa,
  // the vendors through their stall panel (it sends `talk` itself)
  if (!vendor && npc !== 'carlos' && npc !== 'graca') net.send({ t: 'talk', npc });
  // an NPC first hands you what they came with: a thank-you hand-over ("Entregar …") or today's errand ("Pode deixar!" / "Agora não")
  runPrelude(npc, {
    accept: (id) => net.send({ t: 'recados', action: 'accept', id }),
    give: (to, itemId) => net.send({ t: 'give', npc: to, itemId }),
    proceed: () => talkFlow(npc),
  });
}

function talkFlow(npc: NpcDef['id']) {
  closeDialogue();
  if (npc === 'tia_lu' || npc === 'ze' || npc === 'chico' || npc === 'rosa') {
    // a vendor resting on a bench (Tia Lu in the afternoon) is not serving: the closed note
    if (game.avatars.get(`npc-${npc}`)?.pub.activity !== 'trabalhando') return openFeiraClosed(npc);
    return openFeira(npc, { send: (m) => net.send(m) }, { talked: (id) => net.send({ t: 'talk', npc: id }) });
  }
  if (npc === 'carlos' || npc === 'graca') {
    // Always the private AI mesa (Seu Carlos by day, Dona Graça on the night shift: same subjects, D12). Pedido rápido is a ghost button
    // inside that overlay, only at the counter (the server runs the breakfast scene with whoever is on duty there).
    const start = (subjectId?: string) =>
      void openConversa(npc, undefined, {
        subjectId,
        onQuickOrder: game.room?.room === 'padaria' ? () => net.send({ t: 'scene', action: 'start', npc }) : undefined,
      });
    // from 4 hearts there is a second subject to pick (O bairro)
    const choices = subjectChoices(npc, heartsWith(game.profile?.bond, npc));
    if (choices.length > 1) {
      showDialogueBox({
        key: `subject-${npc}`,
        npcId: npc,
        speaker: npc === 'graca' ? 'Dona Graça' : 'Seu Carlos',
        expression: 'feliz',
        line: { pt: 'Sobre o que a gente conversa hoje?', en: 'What shall we chat about today?' },
        chips: choices.map((s) => ({ pt: s.title.pt, en: s.minHearts ? `${s.title.en} (new!)` : s.title.en })),
        onChip: (i) => {
          closeDialogue();
          start(choices[i]?.id);
        },
        onClose: closeDialogue,
      });
    } else start();
  } else {
    // Nanda, Júlia and Professora Bia (the live NPC you clicked): a short greeting in the dialogue box (Nanda offers "Ver chapéus", Júlia her help)
    openNpcTalk(npc, { openShop });
  }
}

/** Open the sign's card and tell the server (`read`: the words count as seen, a recado's `ler` step advances). */
function readHotspot(hs: HotspotDef) {
  closeDialogue();
  openHotspotCard(hs, { onSave: (cards) => openCaderno(cards[0]?.split('.')[1], cards) });
  net.send({ t: 'read', hotspotId: hs.id });
}

/** A click on a sign: read it from here when it is within 3 tiles, else walk to the nearest spot that is. */
function clickHotspot(hs: HotspotDef) {
  const cur = selfTile();
  const room = game.roomDef;
  if (!cur || !room) return;
  if (!cur.moving && hotspotDistance(hs, cur.tile) <= HOTSPOT_READ_RANGE) return readHotspot(hs);
  const grid = buildGrid(room, game.furniture);
  const spot = readSpot(hs, cur.tile, (x, y) => isWalkable(grid, x, y));
  if (!spot) return toast('info', 'Não consigo chegar perto disso.', 'I can’t get close to that.');
  walkTo(spot, { kind: 'hotspot', hotspotId: hs.id, tile: spot });
}

function propAction(action: string, propId?: string) {
  if (action === 'feira_stall') openStall(propId);
  else if (action === 'shop_hats') openShop();
  else if (action === 'minigame') startMinigame();
  else if (action === 'kiosk') openKiosk(() => net.send({ t: 'mission', action: 'take' }));
  else if (action === 'parrot_perch') showParrotPerch(() => net.send({ t: 'parrot', action: 'adopt' }));
  else if (action === 'bjj_roll') startRoll();
}

function startRoll() {
  closeDialogue();
  net.send({ t: 'roll', action: 'queue' });
}

function openShop() {
  closeDialogue();
  // D12: outside her hours Nanda is away, but the hat shop opens from the closed stall with a note
  const closed = !game.liveNpcs(now()).some((n) => n.id === 'nanda');
  openHatShop(
    'shop',
    { buy: (id) => net.send({ t: 'buy', kind: 'hat', itemId: id }), equip: (id) => net.send({ t: 'equipHat', hatId: id }) },
    closed ? { closedNote: { pt: 'Nanda volta às 8h', en: 'Nanda is back at 8 am' } } : {},
  );
}

function startMinigame() {
  closeDialogue();
  net.send({ t: 'mg', action: 'start' });
}

const GREETING_EN = { 'bom dia': 'Good morning', 'boa tarde': 'Good afternoon', 'boa noite': 'Good evening' } as const;

function joinRoom(room: RoomId, instanceId?: string, ownerId?: string) {
  net.send({ t: 'join', room, instanceId, ownerId });
}

/** Guide arrows look their target up by portal / prop / NPC id in the current room's data, never by raw coordinates (Vila Ipê moved them all). */
function guideAt(kind: 'portal' | 'prop' | 'npc', id: string, lift: number, label: string): Guide | null {
  const room = game.roomDef;
  if (!room) return null;
  if (kind === 'portal') {
    const p = room.portals.find((q) => q.id === id);
    return p ? { x: p.doorAt?.x ?? p.x, y: p.doorAt?.y ?? p.y, lift, label } : null;
  }
  if (kind === 'prop') {
    const p = room.props.find((q) => q.id === id);
    return p ? { x: p.x + ((p.w ?? 1) - 1) / 2, y: p.y + (p.h ?? 1) - 1, lift, label } : null;
  }
  const n = game.liveNpcs(now()).find((q) => q.id === id);
  return n ? { x: n.x, y: n.y, lift, label } : null;
}

function updateGuides() {
  const p = game.profile;
  const r = game.room;
  renderer.guides = [];
  if (!p || !r) return;
  const t = p.tutorial;
  const add = (g: Guide | null) => g && renderer.guides.push(g);
  if (r.room === 'praca') {
    if (!t.carlos) add(guideAt('portal', 'praca_padaria', 110, 'Padaria →'));
    else if (!t.chapeu) add(guideAt('prop', 'barraca', 138, 'Chapéus'));
    else if (!t.cadeira) add(guideAt('portal', 'praca_kitnet', 110, 'Minha kitnet'));
    if (t.meveum) add(guideAt('portal', 'praca_academia', 110, 'Academia do Bairro →'));
  } else if (r.room === 'padaria') {
    // Click opens AI Conversa. Don't label the tile "Conversar" — that word was the chip-scene trap.
    // the baker at the counter: Seu Carlos by day, Dona Graça at night
    const baker = game.liveNpcs(now()).find((q) => q.id === 'carlos' || q.id === 'graca');
    if (baker?.id === 'graca') add(guideAt('npc', 'graca', 130, t.carlos ? 'Falar com Dona Graça' : 'Fale com a Dona Graça'));
    else add(guideAt('npc', 'carlos', 130, t.carlos ? 'Falar com Carlos' : 'Fale com o Seu Carlos'));
    if (t.carlos && !t.meveum) add(guideAt('prop', 'trilho', 128, 'Me vê um…'));
    else if (t.carlos && t.meveum && !t.chapeu) add(guideAt('portal', 'padaria_praca', 110, '← Praça'));
  } else if (r.room === 'academia') {
    add(guideAt('prop', 'fila', 190, 'Fila do tatame'));
    add(guideAt('portal', 'academia_praca', 110, '← Praça'));
  }
}

// ---------------------------------------------------------------- server messages

net.onOpen = () => net.send({ t: 'hello', token: localStorage.getItem(TOKEN_KEY) ?? undefined });
/** Kick copy from the server's last message before it closed the socket. */
let kickedCopy: { pt: string; en: string } | null = null;
let leaving = false;
/** Set at boot: a live account session (multiplayer only). */
let signedIn = false;

/** Back to the title screen's sign-in card on the next load (logout, or a session that expired). */
function reloadToSignIn() {
  leaving = true;
  sessionStorage.removeItem(INTRO_PASSED_KEY);
  location.reload();
}

function showIdleKick() {
  failClearMinigame();
  closeModal();
  closeDialogue();
  overlayMessage(null);
  reconnectBanner(null);
  // The room stays drawn as a still behind the soft veil; nobody is in it for this tab anymore.
  game.avatars = new Map();
  game.npcBubbles.clear();
  game.pending = null;
  game.emit('avatars');
  idleKickedCard(kickedCopy ?? { pt: 'Você saiu da Praça por inatividade.', en: 'You left the Praça for being idle.' }, () => {
    kickedCopy = null;
    net.retry();
  });
}

net.onStatus = (s) => {
  if (s === 'loggedOut') {
    // This account signed out in another tab.
    if (!leaving) void signOut().then(reloadToSignIn);
    return;
  }
  if (!started) return;
  if (s === 'idle') return showIdleKick();
  if (s === 'open') {
    overlayMessage(null);
    reconnectBanner(null);
    return;
  }
  if (s === 'failed' || s === 'replaced') {
    const midOrder = modalId() === 'minigame';
    failClearMinigame();
    overlayMessage(null);
    reconnectBanner({ kind: s, midOrder, onRetry: () => net.retry() });
    return;
  }
  reconnectBanner(null);
  overlayMessage('Reconectando… · Reconnecting…', () => net.retry());
};

net.on((m: ServerMsg) => {
  switch (m.t) {
    case 'authRequired':
      // No valid session on this socket (expired or revoked): sign in again.
      if (!leaving) void signOut().then(reloadToSignIn);
      break;
    case 'needProfile':
      localStorage.removeItem(TOKEN_KEY);
      if (!onboarding) onboarding = runOnboarding((p) => net.send({ t: 'createProfile', ...p }));
      break;
    case 'idleWarning':
      toast('warn', m.pt, m.en);
      break;
    case 'kicked':
      kickedCopy = { pt: m.pt, en: m.en };
      break;
    case 'welcome': {
      clock.syncServer(m.serverNow);
      localStorage.setItem(TOKEN_KEY, m.token);
      game.profile = m.profile;
      closeOnboarding();
      onboarding = null;
      if (!started) startGame();
      const last = sessionStorage.getItem(LAST_ROOM_KEY);
      joinRoom(last === 'padaria' || last === 'kitnet' || last === 'academia' ? last : 'praca');
      game.emit('profile');
      break;
    }
    case 'error':
      if (onboarding && m.code === 'name') onboarding.setError(m.pt, m.en);
      else toast('error', m.pt, m.en);
      onFeiraError();
      break;
    case 'feira':
      onFeiraMsg(m);
      break;
    case 'profile':
      game.profile = m.profile;
      game.emit('profile');
      updateGuides();
      break;
    case 'roomState': {
      clock.syncServer(m.serverNow);
      const keepMg = !!minigame && modalId() === 'minigame' && game.room?.room === m.room;
      const keepRoll = !!rollUi && modalId() === 'roll' && m.room === 'academia';
      if (!keepMg && !keepRoll) {
        closeModal();
        minigame = null;
        rollUi = null;
      }
      closeDialogue();
      game.room = m;
      game.avatars = new Map(m.avatars.map((a) => [a.id, toClientAvatar(a)]));
      game.furniture = m.furniture;
      game.pending = null;
      game.editMode = false;
      game.placing = null;
      game.selectedFurniture = null;
      game.npcBubbles.clear();
      if (m.room !== 'kitnet' || m.ownerId === game.profile?.id) sessionStorage.setItem(LAST_ROOM_KEY, m.room);
      ambience.setRoom(m.room);
      updateGuides();
      game.emit('room');
      game.emit('decor');
      if (m.room === 'kitnet' && m.ownerId === game.profile?.id && !game.profile?.tutorial.cadeira)
        toast('info', 'Sua kitnet! Clique em “Decorar” e coloque sua cadeira.', 'Your apartment! Click “Decorar” (top right) and place your free chair.');
      if (m.room === 'padaria' && !game.profile?.tutorial.carlos)
        setTimeout(() => {
          // whoever is at the counter greets you the way the hour asks (bom dia / boa tarde / boa noite)
          const baker = game.liveNpcs(now()).find((q) => q.id === 'carlos' || q.id === 'graca')?.id ?? 'carlos';
          const g = greetingFor(clock.minutes());
          npcSay(baker, { pt: `${g[0]!.toUpperCase()}${g.slice(1)}! Chega mais, pode pedir!`, en: `${GREETING_EN[g]}! Come on over, go ahead and order!` });
        }, 600);
      if (m.room === 'academia' && !sessionStorage.getItem('tb_academia_hi')) {
        sessionStorage.setItem('tb_academia_hi', '1');
        setTimeout(
          () =>
            toast(
              'info',
              'Bem-vindo à Academia do Bairro! Jogo de palavras no tatame — não é treino de luta.',
              'Welcome to Academia do Bairro! Word-game rolls on the mat — not martial-arts training.',
            ),
          700,
        );
      }
      if (keepMg) {
        // A restart can drop the shift with the socket back before the bar runs out. Ask now.
        minigame?.requestSync();
        armMgResumeWatch();
      }
      break;
    }
    case 'avatarJoined':
      game.avatars.set(m.avatar.id, toClientAvatar(m.avatar));
      game.emit('avatars');
      if (m.avatar.npc) updateGuides();
      break;
    case 'avatarLeft': {
      const leaving = game.avatars.get(m.id);
      game.avatars.delete(m.id);
      game.emit('avatars');
      if (leaving?.pub.npc) updateGuides();
      break;
    }
    case 'avatarMoved': {
      const a = game.avatars.get(m.id);
      if (!a) break;
      a.from = m.from;
      a.path = m.path;
      a.start = now();
      a.sitOnArrive = m.sit;
      a.pub.sitting = false;
      game.emit('avatars');
      break;
    }
    case 'avatarUpdated': {
      const a = game.avatars.get(m.avatar.id);
      if (!a) break;
      const moving = renderer.avatarPos(a, now()).moving;
      a.pub = m.avatar;
      if (!moving) {
        a.from = { x: m.avatar.x, y: m.avatar.y };
        a.path = [];
        a.sitOnArrive = m.avatar.sitting;
      }
      game.emit('avatars');
      break;
    }
    case 'emote': {
      const a = game.avatars.get(m.id);
      if (a) a.emote = { kind: m.kind, t0: now() / 1000 };
      break;
    }
    case 'chat': {
      const a = game.avatars.get(m.id);
      // Live Ops lock: CPUs never chat — guard against server bugs/injection
      if (a && !a.pub.cpu) a.bubbles.push({ text: m.text, gloss: game.profile?.nameplate === 'verde' ? m.gloss : null, at: now() });
      break;
    }
    case 'notice':
      // a recado step and the giver's thanks have their own presentation (the tracker's ✓, the thanks card)
      if (m.tag !== 'recado_step' && m.tag !== 'recado_thanks') toast(m.level, m.pt, m.en);
      if (mgQuitPending) {
        mgQuitPending = false;
        failClearMinigame();
      }
      break;
    case 'reward':
      if (m.reason.pt === MISSION_COPY.done.pt) missionBanner();
      else if (m.reason.pt.startsWith('Recado: ')) break; // the thanks card shows the RV
      else toast('reward', m.reason.pt, m.reason.en, m.amount);
      break;
    case 'scene':
      if (isConversaOpen()) closeConversa();
      if (isPedidoOpen()) {
        updatePedido(m.view, {
          said: m.said,
          feedback: m.feedback,
          score: m.lastScore,
          payout: m.payout,
          dailyBlocked: m.dailyBlocked,
          fillTicket: m.fillTicket,
          notice: m.notice,
        });
      } else {
        openPedido(m.view, {
          onChoose: (i) => net.send({ t: 'scene', action: 'choose', chip: i }),
          onClose: () => {
            net.send({ t: 'scene', action: 'close' });
            closePedido();
          },
          onPlay: startMinigame,
          onType: (text) => net.send({ t: 'scene', action: 'type', text }),
        });
      }
      break;
    case 'mg':
      // A lost-shift reply to a resync sent just before this shift ended or was quit.
      if (m.phase === 'end' && m.lost && !mgShiftActive) break;
      clearMgResumeWatch();
      if (m.phase === 'order') mgShiftActive = true;
      if ((m.phase === 'order' || (m.phase === 'end' && m.lost)) && (!minigame || modalId() !== 'minigame')) {
        minigame = newMinigameUI();
      }
      try {
        minigame?.handle(m);
      } catch (err) {
        console.error('Me vê um… handler', err);
        resurrectMinigamePanel();
      }
      if (m.phase === 'end') {
        mgQuitPending = false;
        mgShiftActive = false;
        minigame = null;
      }
      break;
    case 'roll':
      if (m.phase === 'queue' && (!rollUi || modalId() !== 'roll')) {
        rollUi = new RollUI({
          answerChoice: (i) => net.send({ t: 'roll', action: 'answer', choice: i }),
          answerOrder: (order) => net.send({ t: 'roll', action: 'answer', order }),
          timeout: () => net.send({ t: 'roll', action: 'timeout' }),
          quit: () => net.send({ t: 'roll', action: 'quit' }),
          rematch: startRoll,
        });
      }
      rollUi?.handle(m);
      if (m.phase === 'end') rollUi = null;
      break;
    case 'furnitureState':
      game.furniture = m.furniture;
      if (game.selectedFurniture && !m.furniture.some((f) => f.uid === game.selectedFurniture)) game.selectedFurniture = null;
      game.emit('decor');
      break;
    case 'friends':
      game.friends = m.friends;
      game.incoming = m.incoming;
      game.emit('friends');
      break;
    case 'friendRequest':
      toast('info', `${m.fromName} quer ser seu amigo!`, `${m.fromName} sent a friend request — open “Amigos” to accept.`);
      break;
    case 'parrotHint':
      parrotWhisper(m.word.pt, m.word.en);
      speak(m.word.pt);
      break;
    case 'recados':
      game.board = { day: m.day, offered: m.offered, active: m.active, done: m.done };
      game.emit('recados');
      break;
    case 'tutorial': {
      const s = TUTORIAL_STEPS.find((x) => x.id === m.step);
      if (s) toast('reward', `✓ ${s.pt}`, s.en);
      updateGuides();
      break;
    }
  }
});

function npcSay(id: string, line: { pt: string; en: string }) {
  game.npcBubbles.set(id, { text: line.pt, gloss: line.en, at: now() });
}

// ---------------------------------------------------------------- game start + input

function startGame() {
  started = true;
  window.dispatchEvent(new Event('tb:game-start'));
  window.addEventListener('error', () => {
    if (mgShiftActive && modalId() !== 'minigame') resurrectMinigamePanel();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resurrectMinigamePanel();
  });
  hud = buildHud({
    chat: (text) => net.send({ t: 'chat', text }),
    emote: (kind: EmoteKind) => net.send({ t: 'emote', kind }),
    stand: () => net.send({ t: 'stand' }),
    openMap: () => openMap((room) => joinRoom(room)),
    openCredits,
    openCaderno: () => openCaderno(),
    openRecados: () => openJournal(),
    openFriends: () =>
      openFriends({
        request: (id) => net.send({ t: 'friend', action: 'request', targetId: id }),
        accept: (id) => net.send({ t: 'friend', action: 'accept', targetId: id }),
        decline: (id) => net.send({ t: 'friend', action: 'decline', targetId: id }),
        remove: (id) => net.send({ t: 'friend', action: 'remove', targetId: id }),
        hop: (room, instanceId, ownerId) => joinRoom(room, instanceId ?? undefined, ownerId),
        refresh: () => net.send({ t: 'friends' }),
      }),
    openWardrobe: () => openHatShop('wardrobe', { buy: () => {}, equip: (id) => net.send({ t: 'equipHat', hatId: id }) }),
    toggleDecor: () => {
      game.editMode = !game.editMode;
      game.placing = null;
      game.selectedFurniture = null;
      game.emit('decor');
      game.emit('hud');
    },
    parrotHint: () => net.send({ t: 'parrot', action: 'hint' }),
    toggleParrot: () => net.send({ t: 'parrot', action: 'toggle' }),
    toggleSound: () => {
      game.sound = !game.sound;
      localStorage.setItem('tb_sound', game.sound ? 'on' : 'off');
      if (!game.sound) stopSpeaking();
      game.emit('hud');
    },
    toggleMusic: () => {
      game.music = !game.music;
      ambience.setEnabled(game.music);
      game.emit('hud');
    },
    logout:
      SOLO || !signedIn
        ? undefined
        : async () => {
            leaving = true;
            await signOut();
            localStorage.removeItem(TOKEN_KEY);
            reloadToSignIn();
          },
  });
  mountTracker(openJournal);
  mountJoystick((dx, dy) => {
    if (game.modalOpen || game.editMode || game.placing) return;
    const room = game.roomDef;
    const cur = selfTile();
    if (!room || !cur) return;
    const x = Math.max(0, Math.min(room.cols - 1, cur.tile.x + dx));
    const y = Math.max(0, Math.min(room.rows - 1, cur.tile.y + dy));
    if (x === cur.tile.x && y === cur.tile.y) return;
    walkTo({ x, y }, null);
  }, { mode: 'topdown' });
  decor = buildDecorPanel({
    buy: (id) => net.send({ t: 'buy', kind: 'furniture', itemId: id }),
    rotate: (uid) => {
      const f = game.furniture.find((x) => x.uid === uid);
      if (f) net.send({ t: 'furniture', action: 'move', uid, x: f.x, y: f.y, rot: f.rot === 0 ? 1 : 0 });
    },
    pickup: (uid) => {
      net.send({ t: 'furniture', action: 'pickup', uid });
      game.selectedFurniture = null;
    },
    exit: () => {
      game.editMode = false;
      game.placing = null;
      game.selectedFurniture = null;
      game.emit('decor');
      game.emit('hud');
    },
  });
  const idleTalk = new IdleTalk();
  setInterval(() => {
    const npcs = game.liveNpcs(now());
    if (!npcs.length || document.hidden) return;
    const n = npcs[Math.floor(Math.random() * npcs.length)];
    npcSay(n.id, localizeGreeting(idleTalk.next(n.idleLines, clock.weather(), clock.minutes()), clock.minutes()));
  }, 11_000);
  // the feira: a vendor calls out their goods now and then (PT with the gloss); never two calls at once, and not while a dialogue box is open
  setInterval(() => {
    if (document.hidden || game.modalOpen) return;
    const vendors = game.liveNpcs(now()).filter((n) => n.id === 'tia_lu' || n.id === 'ze' || n.id === 'chico' || n.id === 'rosa');
    if (!vendors.length) return;
    const n = vendors[Math.floor(Math.random() * vendors.length)]!;
    const calls = VENDORS[n.id as 'tia_lu'].calls;
    npcSay(n.id, localizeGreeting(calls[Math.floor(Math.random() * calls.length)]!, clock.minutes()));
  }, 7_000);
}

function hitLabel(hit: Hit | null): [string, string] | null {
  if (!hit) return null;
  switch (hit.kind) {
    case 'npc':
      return [`${hit.npc.name}  ♥ ${heartsWith(game.profile?.bond, hit.npc.id)}`, `${hit.npc.role.en} — click to talk`];
    case 'prop':
      return hit.prop.label ? [hit.prop.label.pt, hit.prop.label.en] : null;
    case 'hotspot': {
      const t = hotspotTitle(hit.hotspot);
      return [t.pt, `${t.en} — click to read`];
    }
    case 'portal':
      return [hit.portal.label.pt, hit.portal.label.en];
    case 'avatar': {
      const a = game.avatars.get(hit.id);
      if (a && isCpuId(a.pub.id)) return [a.pub.name, 'Praça regular (scripted neighbor — waves back, doesn’t chat)'];
      return a ? [a.pub.name, 'Click for profile / add friend'] : null;
    }
    case 'seat':
      return ['Sentar', 'Sit here'];
    case 'furniture': {
      const d = furnitureById(hit.f.itemId);
      return d ? [d.pt, game.editMode ? `${d.en} — click to select` : d.en] : null;
    }
    default:
      return null;
  }
}

function handleClick(hit: Hit | null) {
  try {
    handleClickInner(hit);
  } catch (e) {
    console.error('[TB] click error:', e);
  }
}

function handleClickInner(hit: Hit | null) {
  if (!hit || !game.room) return;
  if (game.placing) {
    const tile = hit.kind === 'tile' ? hit.tile : renderer.tileAt(lastPointer.x, lastPointer.y);
    if (!tile) return;
    net.send({ t: 'furniture', action: 'place', itemId: game.placing.itemId, x: tile.x, y: tile.y, rot: game.placing.rot });
    const left = (game.profile?.furniture[game.placing.itemId] ?? 0) - 1;
    if (left <= 0) game.placing = null;
    game.emit('decor');
    return;
  }
  if (game.editMode) {
    if (hit.kind === 'furniture') {
      game.selectedFurniture = game.selectedFurniture === hit.f.uid ? null : hit.f.uid;
      game.emit('decor');
      return;
    }
    if (hit.kind === 'tile' && game.selectedFurniture) {
      const f = game.furniture.find((x) => x.uid === game.selectedFurniture);
      if (f) net.send({ t: 'furniture', action: 'move', uid: f.uid, x: hit.tile.x, y: hit.tile.y, rot: f.rot });
      return;
    }
  }
  switch (hit.kind) {
    case 'avatar': {
      if (isCpuId(hit.id)) {
        const t = renderer.tileAt(lastPointer.x, lastPointer.y);
        if (t) walkTo(t, null);
        break;
      }
      const a = game.avatars.get(hit.id);
      if (a && a.pub.id !== game.room.selfId)
        openProfileCard(a.pub, {
          request: (id) => net.send({ t: 'friend', action: 'request', targetId: id }),
          report: (id) => net.send({ t: 'report', targetId: id, text: a.bubbles.at(-1)?.text }),
          wave: () => net.send({ t: 'emote', kind: 'oi' }),
        });
      break;
    }
    case 'npc':
      walkTo(hit.npc.interact, { kind: 'npc', npc: hit.npc.id, tile: hit.npc.interact });
      break;
    case 'prop': {
      const p: PropDef = hit.prop;
      if (p.action && p.interact) walkTo(p.interact, { kind: 'prop', action: p.action, tile: p.interact, propId: p.id });
      break;
    }
    case 'hotspot':
      clickHotspot(hit.hotspot);
      break;
    case 'portal':
      walkTo({ x: hit.portal.x, y: hit.portal.y }, { kind: 'portal', portalId: hit.portal.id, tile: { x: hit.portal.x, y: hit.portal.y } });
      break;
    case 'seat':
      walkTo(hit.tile, null, true);
      break;
    case 'furniture':
      break;
    case 'tile':
      walkTo(hit.tile, null);
      break;
  }
}

/** Target of the `window.__tb.interact` test hook: something in the current room, by id. */
type InteractTarget = { npc: NpcId } | { prop: string } | { portal: string } | { hotspot: string };

/** Resolve a target in `ROOMS[game.room.room]` and feed the matching Hit through `handleClick`. Returns false if not found. */
function interact(target: InteractTarget): boolean {
  const room = game.room ? ROOMS[game.room.room] : null;
  if (!room) return false;
  let hit: Hit | null = null;
  if ('npc' in target) {
    const npc = game.liveNpcs(now()).find((n) => n.id === target.npc);
    if (npc) hit = { kind: 'npc', npc };
  } else if ('prop' in target) {
    const prop = room.props.find((p) => p.id === target.prop);
    if (prop) hit = { kind: 'prop', prop };
  } else if ('hotspot' in target) {
    const hotspot = HOTSPOTS.find((x) => x.id === target.hotspot && x.room === room.id);
    if (hotspot) hit = { kind: 'hotspot', hotspot };
  } else {
    const portal = room.portals.find((p) => p.id === target.portal);
    if (portal) hit = { kind: 'portal', portal };
  }
  if (!hit) return false;
  handleClick(hit);
  return true;
}

const lastPointer = { x: 0, y: 0 };
canvas.addEventListener('pointermove', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  if (!game.room || game.modalOpen) {
    hoverLabel(0, 0, null);
    return;
  }
  const hit = renderer.hitTest(e.clientX, e.clientY);
  game.hoverTile = hit?.kind === 'tile' ? hit.tile : game.placing ? renderer.tileAt(e.clientX, e.clientY) : null;
  game.hoverKey = hit?.kind === 'avatar' ? `av:${hit.id}` : hit?.kind === 'npc' ? `npc:${hit.npc.id}` : null;
  const lbl = hitLabel(hit);
  hoverLabel(e.clientX, e.clientY, lbl?.[0] ?? null, lbl?.[1]);
  canvas.style.cursor = hit && hit.kind !== 'tile' ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => {
  game.hoverKey = null;
  game.hoverTile = null;
  hoverLabel(0, 0, null);
});
canvas.addEventListener('click', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  if (game.modalOpen && (modalId() || isDialogueBoxOpen())) return;
  hoverLabel(0, 0, null);
  handleClick(renderer.hitTest(e.clientX, e.clientY));
});
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || modalId() || document.querySelector('.idle-kicked')) return;
  if (e.key === 'Enter' && started && !game.modalOpen) {
    e.preventDefault();
    hud?.focusChat();
  }
  if ((e.key === 'r' || e.key === 'R') && game.placing) {
    game.placing.rot = game.placing.rot === 0 ? 1 : 0;
  }
  if (e.key === 'Escape') {
    game.placing = null;
    game.selectedFurniture = null;
    game.emit('decor');
  }
});

// ---------------------------------------------------------------- keyboard walking (pixel view)

/** WASD / arrows step to the adjacent tile while held, chaining when the avatar arrives (D4: still `move` messages over tiles). */
const heldArrows: Arrow[] = [];
const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
};
/** Keys are ignored while typing, while any modal is open, and after the idle kick. */
const keysBlocked = (t: EventTarget | null) => !started || isTyping(t) || !!modalId() || game.modalOpen || !!document.querySelector('.idle-kicked');

let lastKeyStep = 0;
function keyWalk() {
  if (!heldArrows.length || !game.room || game.editMode || game.placing) return;
  const cur = selfTile();
  const room = game.roomDef;
  // wait for the server's answer to the previous step before asking for the next one
  if (!cur || cur.moving || !room || now() - lastKeyStep < 140) return;
  const step = stepForHeld(heldArrows);
  if (!step) return;
  const grid = buildGrid(room, game.furniture);
  const to = stepTarget(cur.tile, step, (x, y) => isWalkable(grid, x, y));
  if (to) {
    lastKeyStep = now();
    walkTo(to, null);
  }
}

{
  document.addEventListener('keydown', (e) => {
    const a = arrowForKey(e.key);
    if (!a || e.ctrlKey || e.metaKey || e.altKey || keysBlocked(e.target)) return;
    e.preventDefault();
    if (!heldArrows.includes(a)) heldArrows.push(a);
    keyWalk();
  });
  document.addEventListener('keyup', (e) => {
    const a = arrowForKey(e.key);
    if (!a) return;
    const i = heldArrows.indexOf(a);
    if (i >= 0) heldArrows.splice(i, 1);
  });
  // never leave a key stuck when the window loses focus or a modal steals the keyup
  window.addEventListener('blur', () => (heldArrows.length = 0));
}

// ---------------------------------------------------------------- loop

/** The 👁 cues over readable signs within 3 tiles (Phase 7). */
const cues = new HotspotCues((hs) => clickHotspot(hs));

// the dialogue box tells the world view to ease the camera in on the speakers; the box's height keeps them above it
setDialogueHost({
  open: (npcId) => {
    const npc = npcId ? game.liveNpcs(now()).find((n) => n.id === npcId) : undefined;
    renderer.setDialogueFocus?.({ npc: npc ? { x: npc.x, y: npc.y } : null });
  },
  close: () => renderer.setDialogueFocus?.(null),
  inset: (px) => renderer.setDialogueBox?.(px),
});
// every 🔊 (dialogue, sign, Caderno) reports the words to the Caderno
setHeardSink((cardIds) => net.send({ t: 'heard', cardIds }));

function frame(ts: number) {
  try {
    renderer.frame(ts);
    if (started) {
      cues.update({
        room: game.room?.room ?? null,
        tile: selfTile()?.tile ?? null,
        hidden: game.modalOpen || game.editMode || !!game.placing,
        toClient: (x, y) => renderer.tileToClient(x, y),
        scale: renderer.cam.scale,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      });
    }
    if (heldArrows.length) {
      if (keysBlocked(document.activeElement)) heldArrows.length = 0;
      else keyWalk();
    }
    if (game.pending) {
      const cur = selfTile();
      if (cur && !cur.moving) {
        const t = game.pending.tile;
        const d = Math.max(Math.abs(cur.tile.x - t.x), Math.abs(cur.tile.y - t.y));
        if (d === 0 || (game.pending.kind === 'portal' && d <= 1 && game.self?.path.length === 0)) runPending();
      }
    }
  } catch (e) {
    console.error('[TB] frame error:', e);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- idle: report real input

/** The server kicks after 15 min without real input. Pings don't count, so tell it when a human did something. */
const ACTIVE_EVERY_MS = 15_000;
let lastActiveSent = 0;
let activePending = false;
function noteInput() {
  if (!started || SOLO) return;
  if (Date.now() - lastActiveSent >= ACTIVE_EVERY_MS) {
    lastActiveSent = Date.now();
    activePending = false;
    net.send({ t: 'active' });
  } else activePending = true;
}
for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) window.addEventListener(ev, noteInput, { capture: true, passive: true });
setInterval(() => {
  if (!activePending) return;
  activePending = false;
  lastActiveSent = Date.now();
  net.send({ t: 'active' });
}, ACTIVE_EVERY_MS);

// ---------------------------------------------------------------- boot

async function boot() {
  // A live session skips the title screen, so a refresh drops straight back into the world.
  if (!SOLO) signedIn = await hasServerSession();
  if (!signedIn) {
    // Multiplayer is account-only, so a tab without a session always gets the sign-in card.
    if (!SOLO) sessionStorage.removeItem(INTRO_PASSED_KEY);
    const entry = await runIntroGate({ guestEntersWorld: SOLO });
    signedIn = !SOLO && entry.mode === 'auth';
  }
  game.music = ambience.enabled;
  // Phaser starts only now (intro closed, or skipped by a live session); it crashed some GPUs when booted under the title blur.
  if ('start' in renderer) (renderer as { start: () => void }).start();
  net.connect();
}
void boot();

// ---------------------------------------------------------------- test / debug hooks

declare global {
  interface Window {
    __tb: unknown;
  }
}
window.__tb = {
  game,
  renderer,
  net,
  rooms: ROOMS,
  /** Sprite keys the pixel view drew as placeholders. */
  get artMissing(): string[] {
    return 'artMissing' in renderer ? (renderer as { artMissing: string[] }).artMissing : [];
  },
  hatById,
  /** The shared game clock (skew from the server's `serverNow`). */
  clock,
  /** Frame-time probe, low-fx state and particle counts of the pixel view (null in the iso view). */
  get perf(): unknown {
    return 'perf' in renderer ? (renderer as { perf: () => unknown }).perf() : null;
  },
  /** The audio ambience (zones, footsteps): for the smoke checks. */
  ambience,
  /** Ambient life (Phase 6b): live counts and `bus()` to bring the bus to the stop. */
  get ambient(): unknown {
    return 'ambientHook' in renderer ? (renderer as { ambientHook: () => unknown }).ambientHook() : null;
  },
  /** Test/shots hook: pin the time of day ("19:30"), the weather ("garoa"), and/or the clock speed. `null` clears a pin. */
  setClock: (o: { time?: string | null; weather?: 'sol' | 'nublado' | 'garoa' | 'chuva' | null; speed?: number }) => {
    if (o.time !== undefined) clock.setTime(o.time === null ? null : parseTimeOfDay(o.time));
    if (o.weather !== undefined) clock.setWeather(o.weather);
    if (o.speed !== undefined) clock.setSpeed(o.speed);
  },
  tileToClient: (x: number, y: number) => renderer.tileToClient(x, y),
  selfTile: () => selfTile(),
  clickHit: (hit: Hit) => handleClick(hit),
  /** Renderer-independent walk: the same function the click handler uses. */
  walkTo: (x: number, y: number, sit = false) => walkTo({ x, y }, null, sit),
  /** Renderer-independent interaction by id, resolved against the current room's data. */
  interact: (target: InteractTarget) => interact(target),
  get decor() {
    return decor;
  },
};
