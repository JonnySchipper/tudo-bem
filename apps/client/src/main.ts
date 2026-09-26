import './styles.css';
import {
  MISSION_COPY,
  ROOMS,
  TUTORIAL_STEPS,
  furnitureById,
  hatById,
  isCpuId,
  type EmoteKind,
  type NpcDef,
  type PropDef,
  type RoomId,
  type ServerMsg,
  type Tile,
} from '@tudobem/shared';
import { game, type ClientAvatar, type PendingAction } from './state';
import { Net, wsUrl, type NetLike } from './net';
import { LocalNet } from './localNet';
import { WorldRenderer, type Hit } from './render/world';
import { runOnboarding, closeOnboarding } from './ui/onboarding';
import { buildHud, hoverLabel, missionBanner, overlayMessage, parrotWhisper, toast } from './ui/hud';
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
import { closeConversa, isConversaOpen, openConversa } from './ui/conversa';
import { speak, stopSpeaking, unlockSpeech } from './audio';
import { ambience } from './ambience';
import { installViewport } from './ui/viewport';
import { mountJoystick } from './ui/joystick';
import { installUiArt } from './art/ui';
import { artStats, loadArt } from './art/sprites';

installUiArt();
installViewport();
void loadArt();
const armAudio = () => {
  unlockSpeech();
  ambience.unlock();
};
window.addEventListener('pointerdown', armAudio, { once: true });
window.addEventListener('keydown', armAudio, { once: true });

const TOKEN_KEY = 'tb_token';
const LAST_ROOM_KEY = 'tb_last_room';

const canvas = document.getElementById('world') as HTMLCanvasElement;
const renderer = new WorldRenderer(canvas);
/** Static deploys (no WebSocket server) run the World in-page. `?solo` forces it anywhere. */
const SOLO = import.meta.env.VITE_LOCAL_WORLD === '1' || new URLSearchParams(location.search).has('solo');
const net: NetLike = SOLO ? new LocalNet() : new Net(wsUrl());
game.solo = SOLO;

let hud: ReturnType<typeof buildHud> | null = null;
let decor: ReturnType<typeof buildDecorPanel> | null = null;
let onboarding: ReturnType<typeof runOnboarding> | null = null;
let minigame: MinigameUI | null = null;
let started = false;

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
  else propAction(p.action);
}

function talkTo(npc: NpcDef['id']) {
  if (npc === 'carlos') {
    closeDialogue();
    // Always the private AI mesa. Pedido rápido is a ghost button inside that overlay.
    void openConversa('carlos', undefined, {
      onQuickOrder: () => net.send({ t: 'scene', action: 'start', npc: 'carlos' }),
    });
  } else if (npc === 'nanda') openShop();
  else showJulia();
}

function propAction(action: string) {
  if (action === 'shop_hats') openShop();
  else if (action === 'minigame') startMinigame();
  else if (action === 'kiosk') openKiosk(() => net.send({ t: 'mission', action: 'take' }));
  else if (action === 'parrot_perch') showParrotPerch(() => net.send({ t: 'parrot', action: 'adopt' }));
}

function openShop() {
  closeDialogue();
  openHatShop('shop', { buy: (id) => net.send({ t: 'buy', kind: 'hat', itemId: id }), equip: (id) => net.send({ t: 'equipHat', hatId: id }) });
}

function startMinigame() {
  closeDialogue();
  net.send({ t: 'mg', action: 'start' });
}

function joinRoom(room: RoomId, instanceId?: string, ownerId?: string) {
  net.send({ t: 'join', room, instanceId, ownerId });
}

function updateGuides() {
  const p = game.profile;
  const r = game.room;
  renderer.guides = [];
  if (!p || !r) return;
  const t = p.tutorial;
  if (r.room === 'praca') {
    if (!t.carlos) renderer.guides.push({ x: 5, y: 0, lift: 110, label: 'Padaria →' });
    else if (!t.chapeu) renderer.guides.push({ x: 11, y: 6, lift: 138, label: 'Chapéus' });
    else if (!t.cadeira) renderer.guides.push({ x: 0, y: 4, lift: 110, label: 'Minha kitnet' });
  } else if (r.room === 'padaria') {
    // Click opens AI Conversa. Don't label the tile "Conversar" — that word was the chip-scene trap.
    renderer.guides.push({ x: 3, y: 1, lift: 130, label: t.carlos ? 'Falar com Carlos' : 'Fale com o Seu Carlos' });
    if (t.carlos && !t.meveum) renderer.guides.push({ x: 8, y: 2, lift: 128, label: 'Me vê um…' });
    else if (t.carlos && t.meveum && !t.chapeu) renderer.guides.push({ x: 0, y: 6, lift: 110, label: '← Praça' });
  }
}

// ---------------------------------------------------------------- server messages

net.onOpen = () => net.send({ t: 'hello', token: localStorage.getItem(TOKEN_KEY) ?? undefined });
net.onStatus = (s) => {
  if (!started) return;
  overlayMessage(s === 'open' ? null : 'Reconectando… · Reconnecting…');
};

net.on((m: ServerMsg) => {
  switch (m.t) {
    case 'needProfile':
      localStorage.removeItem(TOKEN_KEY);
      if (!onboarding) onboarding = runOnboarding((p) => net.send({ t: 'createProfile', ...p }));
      break;
    case 'welcome': {
      localStorage.setItem(TOKEN_KEY, m.token);
      game.profile = m.profile;
      closeOnboarding();
      onboarding = null;
      if (!started) startGame();
      const last = sessionStorage.getItem(LAST_ROOM_KEY);
      joinRoom(last === 'padaria' || last === 'kitnet' ? last : 'praca');
      game.emit('profile');
      break;
    }
    case 'error':
      if (onboarding && (m.code === 'name' || m.code === 'age' || m.code === 'age_gate' || m.code === 'age_confirm')) onboarding.setError(m.pt, m.en);
      else toast('error', m.pt, m.en);
      break;
    case 'profile':
      game.profile = m.profile;
      game.emit('profile');
      updateGuides();
      break;
    case 'roomState': {
      closeModal();
      closeDialogue();
      minigame = null;
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
      if (m.room === 'padaria' && !game.profile?.tutorial.carlos) setTimeout(() => npcSay('carlos', { pt: 'Bom dia! Chega mais, pode pedir!', en: 'Good morning! Come on over, go ahead and order!' }), 600);
      break;
    }
    case 'avatarJoined':
      game.avatars.set(m.avatar.id, toClientAvatar(m.avatar));
      game.emit('avatars');
      break;
    case 'avatarLeft':
      game.avatars.delete(m.id);
      game.emit('avatars');
      break;
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
      toast(m.level, m.pt, m.en);
      break;
    case 'reward':
      if (m.reason.pt === MISSION_COPY.done.pt) missionBanner();
      else toast('reward', m.reason.pt, m.reason.en, m.amount);
      break;
    case 'scene':
      if (isConversaOpen()) closeConversa();
      showScene(
        m.view,
        { said: m.said, feedback: m.feedback, score: m.lastScore, payout: m.payout },
        (i) => net.send({ t: 'scene', action: 'choose', chip: i }),
        () => {
          net.send({ t: 'scene', action: 'close' });
          closeDialogue();
        },
        startMinigame,
        (text) => net.send({ t: 'scene', action: 'type', text }),
      );
      break;
    case 'mg':
      if (m.phase === 'order' && (!minigame || modalId() !== 'minigame')) {
        minigame = new MinigameUI({
          submit: (tray, mods) => net.send({ t: 'mg', action: 'submit', tray, mods }),
          timeout: () => net.send({ t: 'mg', action: 'timeout' }),
          quit: () => net.send({ t: 'mg', action: 'quit' }),
          again: startMinigame,
        });
      }
      minigame?.handle(m);
      if (m.phase === 'end') minigame = null;
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
  hud = buildHud({
    chat: (text) => net.send({ t: 'chat', text }),
    emote: (kind: EmoteKind) => net.send({ t: 'emote', kind }),
    stand: () => net.send({ t: 'stand' }),
    openMap: () => openMap((room) => joinRoom(room)),
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
  });
  mountJoystick((dx, dy) => {
    if (game.modalOpen || game.editMode || game.placing) return;
    const room = game.roomDef;
    const cur = selfTile();
    if (!room || !cur) return;
    const x = Math.max(0, Math.min(room.cols - 1, cur.tile.x + dx));
    const y = Math.max(0, Math.min(room.rows - 1, cur.tile.y + dy));
    if (x === cur.tile.x && y === cur.tile.y) return;
    walkTo({ x, y }, null);
  });
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
  setInterval(() => {
    const room = game.roomDef;
    if (!room?.npcs.length || document.hidden) return;
    const n = room.npcs[Math.floor(Math.random() * room.npcs.length)];
    const line = n.idleLines[Math.floor(Math.random() * n.idleLines.length)];
    npcSay(n.id, line);
  }, 11_000);
}

function hitLabel(hit: Hit | null): [string, string] | null {
  if (!hit) return null;
  switch (hit.kind) {
    case 'npc':
      return [hit.npc.name, `${hit.npc.role.en} — click to talk`];
    case 'prop':
      return hit.prop.label ? [hit.prop.label.pt, hit.prop.label.en] : null;
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
      if (p.action && p.interact) walkTo(p.interact, { kind: 'prop', action: p.action, tile: p.interact });
      break;
    }
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
  const lbl = hitLabel(hit);
  hoverLabel(e.clientX, e.clientY, lbl?.[0] ?? null, lbl?.[1]);
  canvas.style.cursor = hit && hit.kind !== 'tile' ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => {
  game.hoverTile = null;
  hoverLabel(0, 0, null);
});
canvas.addEventListener('click', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  if (game.modalOpen && modalId()) return;
  hoverLabel(0, 0, null);
  handleClick(renderer.hitTest(e.clientX, e.clientY));
});
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || modalId()) return;
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

// ---------------------------------------------------------------- loop

function frame(ts: number) {
  try {
    renderer.frame(ts);
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
net.connect();

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
  artStats,
  hatById,
  tileToClient: (x: number, y: number) => renderer.tileToClient(x, y),
  selfTile: () => selfTile(),
  clickHit: (hit: Hit) => handleClick(hit),
  get decor() {
    return decor;
  },
};
