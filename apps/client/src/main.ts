import './styles.css';
import './styles/intro.css';
import './styles/pixel-ui.css';
import './styles/dialogue.css';
import './styles/recados.css';
import './styles/feira.css';
import './styles/hud.css';
import './styles/creator.css';
import './styles/intro-pixel.css';
import './styles/panels.css';
import './styles/bout.css';
import './styles/correria.css';
import './styles/diary.css';
import { runIntroGate } from './ui/intro';
import { hasServerSession, signOut } from './auth/client';
import { INTRO_PASSED_KEY } from './auth/session';
import {
  MISSION_COPY,
  ROOMS,
  TUTORIAL_STEPS,
  buildGrid,
  cameraObjectIds,
  diaryVisible,
  PHOTO_SPOTS,
  normalizeDiary,
  unheardIdleLine,
  wordForLine,
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
import { buildHud, holdCartelaChip, hoverLabel, idleKickedCard, missionBanner, overlayMessage, parrotWhisper, reconnectBanner, toast } from './ui/hud';
import { CARTELA_BANNER_MS, cartelaBanner, openCartela } from './ui/cartela';
import { CARTELA_COPY, stampNotice } from '@tudobem/shared';
import {
  buildDecorPanel,
  closeDialogue,
  closeModal,
  openKiosk,
  modalId,
  openFriends,
  openHatShop,
  openMap,
  openProfileCard,
  showJulia,
  showParrotPerch,
  wireParrotShop,
  showScene,
} from './ui/panels';
import { openPedido, updatePedido, closePedido, isPedidoOpen } from './ui/pedido';
import { openCredits } from './ui/credits';
import { bindAdmin, onAdminMsg } from './ui/admin';
import { isDialogueBoxOpen, setDialogueHost, showDialogueBox } from './ui/dialogue';
import { mountTracker, openJournal, runPrelude } from './ui/recados';
import { heartsWith } from './ui/recadoView';
import { openNpcTalk } from './ui/npcTalk';
import { onFeiraError, onFeiraMsg, openFeira, openFeiraClosed } from './ui/feira';
import { openCaderno, setArrivalReplay } from './ui/caderno';
import { syncArrival } from './ui/arrival';
import { syncGrants } from './ui/grants';
import { askElevator, bindAcademy, onAcademyDirectory, openAcademyBoard, syncAcademyFloor } from './ui/academy';
import { askPadariaDoor, bindPadariaOwn, chooseBakery, onPadariaDoor, openHouseCounter, openPadariaBook, syncPadariaFloor, welcomeOwner } from './ui/padariaOwn';
import { isArrivalHallOpen, openArrivalHall } from './ui/arrivalHall';
import type { WordMoment } from './ui/diaryWordQueue';
import { cameraFrameAt, captureFrame, celebrateWord, celebrateWords, dropPendingPrint, setWordGate, showPhoto, shutter, shutterJam, syncCameraBanner, syncCameraFrame } from './ui/diaryPanel';
import { escolaPracticeOpen, openEscolaPractice, showEscolaResult } from './ui/escola';
import { openHotspotCard } from './ui/hotspotCard';
import { openStreetSnack } from './ui/streetSnack';
import { openCheckers } from './ui/checkers';
import { openGiShop } from './ui/giShop';
import { setHeardSink } from './ui/heard';
import { closeConversa, isConversaOpen, openConversa, setConversaLineSink } from './ui/conversa';
import { openCounter } from './ui/padariaCounter';
import { BoutUI } from './ui/bout';
import { CorreriaUI } from './ui/correria';
import { correriaFeed } from './render/pixel/correriaFeed';
import { boutFeed } from './render/pixel/boutFeed';
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
let correriaUi: CorreriaUI | null = null;
let boutUi: BoutUI | null = null;
// a word found during a game is celebrated when that game's screen closes
setWordGate(() => !!boutUi?.open || !!correriaUi?.open || escolaPracticeOpen() || modalId() === 'checkers');
let started = false;

/** Correria no Balcão: the overlay and the world's counter open when the first shift state arrives. */
function newCorreriaUI() {
  return new CorreriaUI({
    send: (m) => net.send(m),
    closed: () => {
      correriaUi = null;
    },
    again: startMinigame,
  });
}

function failClearMinigame() {
  correriaUi?.destroy();
  correriaUi = null;
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

/** Prop whose interact tile the avatar is standing on (keyboard / proximity prompts). */
function propOnInteractTile(): PropDef | undefined {
  const room = game.roomDef;
  const cur = selfTile();
  if (!room || !cur || cur.moving) return undefined;
  return room.props.find((p) => p.action && p.interact && p.interact.x === cur.tile.x && p.interact.y === cur.tile.y);
}

function runPending() {
  const p = game.pending;
  game.pending = null;
  if (!p) return;
  if (p.kind === 'portal') {
    const to = game.roomDef?.portals.find((q) => q.id === p.portalId)?.to;
    // an owner at Seu Carlos's door picks: their own padaria or his (the facade is shared; the owned shop has no door of its own)
    if (to === 'padaria' && game.profile?.padaria) chooseBakery(game.profile.padaria, () => net.send({ t: 'portal', portalId: p.portalId }));
    else net.send({ t: 'portal', portalId: p.portalId });
  } else if (p.kind === 'npc') talkTo(p.npc);
  else if (p.kind === 'hotspot') {
    const hs = hotspotById(p.hotspotId);
    if (hs) readHotspot(hs);
  } else if (p.kind === 'photo') net.send({ t: 'diary', action: 'photo', anchor: p.anchor });
  else propAction(p.action, p.kind === 'prop' ? p.propId : undefined);
}

/**
 * The arrival card's words are held while the airport hall is open (its cards would cover the postcard) and shown, one after another,
 * when the player leaves it.
 */
let heldCardWords: WordMoment[][] | null = null;
function flushCardWords() {
  const held = heldCardWords;
  heldCardWords = null;
  for (const words of held ?? []) celebrateWords(words);
}
function arrivalFinish() {
  heldCardWords = [];
  net.send({ t: 'arrival', action: 'finish' });
  // if the hall never opens, the words come anyway
  window.setTimeout(() => {
    if (!isArrivalHallOpen()) flushCardWords();
  }, 4000);
}
const arrivalHall = () => openArrivalHall((m) => net.send(m), flushCardWords);

/** Tell the server a line was heard when it can still teach a conversation word the diary does not have. */
function sendLine(anchor: string) {
  const word = wordForLine(anchor);
  if (word && !normalizeDiary(game.profile?.diary).includes(word.id)) net.send({ t: 'diary', action: 'line', anchor });
}

/** The feira (Phase 9): a stall, or the Hortifrúti corner. A stall whose vendor is away shows the closed note (D12: the corner at the banca sells at every hour). */
function openStall(propId?: string) {
  const prop = game.roomDef?.props.find((x) => x.id === propId);
  const vendor = prop?.vendor;
  if (!vendor) return;
  closeDialogue();
  const there = vendor === 'banca' || game.liveNpcs(now()).some((n) => n.id === VENDORS[vendor].npc && game.avatars.get(`npc-${n.id}`)?.pub.activity === 'trabalhando');
  // the vendor's own lines carry diary words: the greeting at an open stall, the closing note at a shut one
  if (vendor !== 'banca') sendLine(`${VENDORS[vendor].npc}.${there ? 'greet' : 'closed'}`);
  if (!there) return openFeiraClosed(vendor);
  openFeira(vendor, { send: (m) => net.send(m) }, { talked: (id) => net.send({ t: 'talk', npc: id }) });
}

function talkTo(npc: NpcDef['id']) {
  closeDialogue();
  // the player chose to talk to them: the NPC says a line with a word the diary does not have yet (passing chatter teaches nothing)
  const speaker = game.liveNpcs(now()).find((n) => n.id === npc);
  const next = speaker ? unheardIdleLine(npc, speaker.idleLines.length, game.profile?.diary) : null;
  if (speaker && next !== null) {
    npcSay(npc, localizeGreeting(speaker.idleLines[next]!, clock.minutes()));
    sendLine(`${npc}.idle${next}`);
  }
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
    // The counter: order (pay, carry it out, it goes in the bag) or open a Conversa with the baker. The old "Pedido rápido" chip scene
    // is gone: it was a second, unexplained way to order from the same person.
    const conversa = () => {
      const start = (subjectId?: string) => void openConversa(npc, undefined, { subjectId });
      // from 4 hearts there is a second subject to pick (O bairro)
      const choices = subjectChoices(npc, heartsWith(game.profile?.bond, npc));
      if (choices.length <= 1) return start();
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
    };
    if (game.room?.room !== 'padaria') return conversa();
    openCounter(npc, { buy: (itemId) => net.send({ t: 'padaria', action: 'buy', itemId }), conversa });
  } else if (npc === 'lucia') {
    net.send({ t: 'diary', action: 'practice' });
  } else {
    // Nanda, Júlia and Professora Bia (the live NPC you clicked): a short greeting in the dialogue box (Nanda offers "Ver chapéus", Júlia her help)
    openNpcTalk(npc, {
      openShop,
      onLine: (anchor) => sendLine(anchor),
      buyFilm: () => net.send({ t: 'diary', action: 'buyFilm' }),
      openMat: () => openBout(),
    });
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

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let lastShutterAt = -1e9;

/** A shutter click: spend film, keep the photo, and teach any camera word inside the frame. The player does not walk. */
function takePhoto(clientX: number, clientY: number) {
  if (!game.profile?.hasCamera) return;
  if ((game.profile.film ?? 0) < 1) {
    shutterJam();
    toast('info', 'Sem filme. Fala com a Júlia.', 'Out of film. Ask Júlia.');
    return;
  }
  // the blades are still moving: one shot per beat
  const t = performance.now();
  if (t - lastShutterAt < 380) return;
  lastShutterAt = t;
  // a tap on a phone has no hover before it: the viewfinder jumps to the tap so the blades close where the photo is taken
  syncCameraFrame(clientX, clientY);
  const frame = cameraFrameAt(clientX, clientY);
  const anchors: string[] = [];
  const room = game.roomDef;
  const view = renderer as { propClientRect?: (p: { x: number; y: number; w?: number; h?: number }) => { x: number; y: number; w: number; h: number } | null };
  if (room && view.propClientRect) {
    // everything the frame touches that the diary teaches a word for: props, wall decor on the north wall, and furniture placed in the kitnet.
    // The ones nearest the reticle go first, so the cards come in the order the player aimed.
    const touched: { id: string; d: number }[] = [];
    const aim = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
    const taught = cameraObjectIds();
    const tag = (id: string, box: { x: number; y: number; w?: number; h?: number }) => {
      const rect = view.propClientRect!(box);
      if (!rect || !rectsOverlap(frame, rect) || touched.some((t) => t.id === id)) return;
      touched.push({ id, d: Math.hypot(rect.x + rect.w / 2 - aim.x, rect.y + rect.h / 2 - aim.y) });
    };
    const day = clock.day();
    for (const prop of room.props) if (taught.has(prop.id) && diaryVisible(room.id, prop.id, day)) tag(prop.id, prop);
    for (const spot of PHOTO_SPOTS) if (spot.room === room.id && taught.has(spot.id)) tag(spot.id, spot);
    for (const f of game.furniture) if (taught.has(f.itemId)) tag(f.itemId, { x: f.x, y: f.y });
    anchors.push(...touched.sort((a, b) => a.d - b.d).map((t) => t.id).slice(0, 24));
  }
  const image = captureFrame(frame);
  shutter(frame, image);
  net.send({ t: 'diary', action: 'photo', anchors, image });
  // one photo per opening: the camera closes once the blades have opened again (the print carries on to the Diário)
  window.setTimeout(() => {
    if (!game.cameraOn) return;
    game.cameraOn = false;
    syncCameraBanner();
    game.emit('hud');
  }, 320);
}

function propAction(action: string, propId?: string) {
  if (action === 'feira_stall') openStall(propId);
  else if (action === 'shop_hats') openShop();
  else if (action === 'minigame') startMinigame();
  else if (action === 'kiosk') openKiosk(() => net.send({ t: 'mission', action: 'take' }));
  else if (action === 'parrot_perch') showParrotPerch(() => net.send({ t: 'parrot', action: 'adopt' }));
  else if (action === 'street_snack' && propId) openStreetSnack(propId, (id) => net.send({ t: 'snack', action: 'buy', itemId: id }));
  else if (action === 'checkers') openCheckers();
  else if (action === 'buy_gi') openGiShop(!!game.profile?.giOwned, () => net.send({ t: 'buy', kind: 'gi', itemId: 'kimono' }));
  else if (action === 'bjj_roll') openBout();
  else if (action === 'escola') net.send({ t: 'diary', action: 'practice' });
  else if (action === 'academy_elevator') {
    askElevator();
    net.send({ t: 'academy', action: 'directory' });
  } else if (action === 'academy_board') {
    const card = game.room?.room === 'andar' ? game.room.academy : undefined;
    if (card) openAcademyBoard(card);
  } else if (action === 'padaria_door') {
    // inside an owned padaria the vaso is its book (Melhorias for the owner, the shop's card for a visitor)
    const own = game.room?.padaria;
    if (own) openPadariaBook(own);
    else askPadariaDoor();
  } else if (action === 'padaria_counter') {
    const own = game.room?.padaria;
    if (own) openHouseCounter(own);
    else {
      // Seu Carlos's register: whoever is on duty takes the order
      const baker = game.liveNpcs(now()).find((n) => n.id === 'carlos' || n.id === 'graca');
      if (baker) talkTo(baker.id);
      else toast('info', 'Ninguém no caixa agora.', 'Nobody at the register right now.');
    }
  }
}

bindAcademy({
  found: (name, look) => net.send({ t: 'academy', action: 'found', name, crest: look.crest, giColor: look.giColor, giStamp: look.giStamp }),
  visit: (id) => net.send({ t: 'academy', action: 'visit', id }),
  join: (id) => net.send({ t: 'academy', action: 'join', id }),
  leave: (id) => net.send({ t: 'academy', action: 'leave', id }),
  look: (id, look) => net.send({ t: 'academy', action: 'look', id, crest: look.crest, giColor: look.giColor, giStamp: look.giStamp }),
});

bindPadariaOwn({
  door: () => net.send({ t: 'padariaOwn', action: 'door' }),
  found: (name) => net.send({ t: 'padariaOwn', action: 'found', name }),
  visit: (id) => net.send({ t: 'padariaOwn', action: 'visit', id }),
  visitMine: () => {
    const id = game.profile && game.room?.padaria?.owner ? game.room.padaria.id : null;
    if (id) net.send({ t: 'padariaOwn', action: 'visit', id });
    else net.send({ t: 'padariaOwn', action: 'visit' });
  },
  upgrade: (kind) => net.send({ t: 'padariaOwn', action: 'upgrade', kind }),
  buy: (itemId) => net.send({ t: 'padaria', action: 'buy', itemId }),
});

wireParrotShop({
  buy: (id) => net.send({ t: 'buy', kind: 'parrot', itemId: id }),
  equip: (id) => net.send({ t: 'parrot', action: 'color', colorId: id }),
});

/** The mat queue: ask the server for the partner list; the lobby (and the mat camera) opens when it answers. */
function openBout() {
  closeDialogue();
  if (boutUi?.open) return;
  if (!game.profile?.giOwned) {
    openGiShop(false, () => net.send({ t: 'buy', kind: 'gi', itemId: 'kimono' }));
    return;
  }
  net.send({ t: 'bout', v: 1, action: 'open' });
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
    if (!p) return null;
    if (p.interact) return { x: p.interact.x, y: p.interact.y, lift, label };
    return { x: p.x + ((p.w ?? 1) - 1) / 2, y: p.y + (p.h ?? 1) - 1, lift, label };
  }
  const n = game.liveNpcs(now()).find((q) => q.id === id);
  return n ? { x: n.x, y: n.y, lift, label } : null;
}

function updateGuides() {
  const p = game.profile;
  const r = game.room;
  renderer.guides = [];
  // a bout has the whole screen: no tutorial arrows over the mat
  if (!p || !r || isDialogueBoxOpen() || boutUi?.open) return;
  const t = p.tutorial;
  const add = (g: Guide | null) => g && renderer.guides.push(g);
  if (r.room === 'rua') {
    if (!t.carlos) add(guideAt('portal', 'praca_padaria', 110, 'Padaria →'));
    else if (!t.chapeu) add(guideAt('portal', 'rua_praca_1', 60, 'Chapéus: Praça ↓'));
    else if (!t.cadeira) add(guideAt('portal', 'praca_kitnet', 110, 'Minha kitnet'));
    if (t.meveum) add(guideAt('portal', 'rua_leste_1', 60, 'Academia: leste →'));
    // an owner's shop is behind the same door: their name over it, every visit
    if (t.carlos && p.padaria) add(guideAt('portal', 'praca_padaria', 110, `${p.padaria.name} ↑`));
  } else if (r.room === 'rua_leste') {
    if (t.meveum) add(guideAt('portal', 'praca_academia', 110, 'Academia do Bairro →'));
    else if (!t.carlos) add(guideAt('portal', 'leste_rua_1', 60, '← Padaria: pela Rua'));
    else if (!t.chapeu) add(guideAt('portal', 'leste_rua_1', 60, '← Chapéus: pela Rua'));
    else if (!t.cadeira) add(guideAt('portal', 'leste_rua_1', 60, '← Minha kitnet: pela Rua'));
  } else if (r.room === 'praca') {
    if (!t.carlos) add(guideAt('portal', 'praca_rua_1', 60, 'Padaria: pela Rua ↑'));
    else if (!t.chapeu) add(guideAt('prop', 'barraca', 138, 'Chapéus'));
    else if (!t.cadeira || t.meveum) add(guideAt('portal', 'praca_rua_1', 60, t.cadeira ? 'Academia: pela Rua ↑' : 'Minha kitnet: pela Rua ↑'));
  } else if (r.room === 'feira') {
    add(guideAt('portal', 'feira_praca_1', 60, '← Praça'));
  } else if (r.room === 'andar' && r.academy) {
    // a player academy's floor: its own mat, and the crest board (the owner's look editor, a guest's join card)
    add(guideAt('prop', 'andar_tatame', 60, 'Treinar'));
    if (r.academy.owner) add(guideAt('prop', 'andar_brasao', 30, 'Brasão e kimono'));
    else if (!r.academy.member) add(guideAt('prop', 'andar_brasao', 30, 'Entrar na equipe'));
  } else if (r.room === 'padaria' && r.padaria) {
    // a player-owned padaria: no baker on duty, the owner works the counter
    if (r.padaria.owner) {
      add(guideAt('prop', 'trilho', 128, 'Seu balcão: Correria'));
      // on the vaso itself (its interact tile is where you stand, so an arrow there points at your own head)
      const vaso = game.roomDef?.props.find((q) => q.id === 'padaria_porta_fundar');
      if (vaso) add({ x: vaso.x, y: vaso.y, lift: 60, label: 'Melhorias' });
    } else {
      add(guideAt('prop', 'balcao', 60, 'Balcão da casa'));
      add(guideAt('portal', 'padaria_praca', 110, '← Rua'));
    }
  } else if (r.room === 'padaria') {
    // Click opens AI Conversa. Don't label the tile "Conversar" — that word was the chip-scene trap.
    // the baker at the counter: Seu Carlos by day, Dona Graça at night
    const baker = game.liveNpcs(now()).find((q) => q.id === 'carlos' || q.id === 'graca');
    if (baker?.id === 'graca') add(guideAt('npc', 'graca', 130, t.carlos ? 'Falar com Dona Graça' : 'Fale com a Dona Graça'));
    else add(guideAt('npc', 'carlos', 130, t.carlos ? 'Falar com Carlos' : 'Fale com o Seu Carlos'));
    if (t.carlos && !t.meveum) add(guideAt('prop', 'trilho', 128, 'Me vê um…'));
    else if (t.carlos && t.meveum && !t.chapeu) add(guideAt('portal', 'padaria_praca', 110, '← Rua'));
  } else if (r.room === 'academia') {
    // one step at a time; the exit arrow only once the gi is bought (the kimono arrow and "← Rua" sat on top of each other by the lockers)
    if (!p.giOwned) add(guideAt('prop', 'vestiario', 160, '1 · Kimono aqui'));
    else {
      // step 2 points at Professora Bia ("Quer treinar?" → the mat), not the board up on the back wall
      add(guideAt('npc', 'prof', 120, '2 · Treino no tatame'));
      add(guideAt('portal', 'academia_praca', 110, '← Rua'));
      add(guideAt('prop', 'elevador', 120, 'Elevador'));
    }
  }
}

// ---------------------------------------------------------------- server messages

net.onOpen = () => net.send({ t: 'hello', token: localStorage.getItem(TOKEN_KEY) ?? undefined });
bindAdmin((m) => net.send(m));
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
    const midOrder = !!correriaUi?.live;
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
    case 'sky':
    case 'admin':
      onAdminMsg(m);
      break;
    case 'welcome': {
      clock.syncServer(m.serverNow);
      if (m.weather !== undefined) clock.setWeather(m.weather);
      localStorage.setItem(TOKEN_KEY, m.token);
      game.profile = m.profile;
      closeOnboarding();
      onboarding = null;
      if (!started) startGame();
      const last = sessionStorage.getItem(LAST_ROOM_KEY);
      const remembered = last === 'padaria' || last === 'kitnet' || last === 'academia' || last === 'rua' || last === 'rua_leste' || last === 'feira' || last === 'escola';
      joinRoom(remembered ? last : 'praca');
      syncArrival(arrivalFinish, arrivalHall);
      syncGrants((id) => net.send({ t: 'grant', id }));
      game.emit('profile');
      break;
    }
    case 'error':
      if (m.code === 'far' || m.code === 'photo' || m.code === 'film' || m.code === 'camera') dropPendingPrint();
      if (onboarding && m.code === 'name') onboarding.setError(m.pt, m.en);
      else toast('error', m.pt, m.en);
      onFeiraError();
      break;
    case 'feira':
      onFeiraMsg(m);
      break;
    case 'photos':
      game.photos = m.photos;
      game.emit('profile');
      break;
    case 'profile':
      game.profile = m.profile;
      if (!m.profile.hasCamera) game.cameraOn = false;
      syncCameraBanner();
      syncArrival(arrivalFinish, arrivalHall);
      syncGrants((id) => net.send({ t: 'grant', id }));
      game.emit('profile');
      updateGuides();
      break;
    case 'roomState': {
      clock.syncServer(m.serverNow);
      const keepMg = !!correriaUi?.open && game.room?.room === m.room;
      // a new room state (a join, a reconnect) ends any bout: the server dropped it too
      boutUi?.destroy();
      boutUi = null;
      if (!keepMg) {
        correriaUi?.destroy();
        correriaUi = null;
        closeModal();
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
      if (m.room !== 'andar' && (m.room !== 'kitnet' || m.ownerId === game.profile?.id)) sessionStorage.setItem(LAST_ROOM_KEY, m.room);
      ambience.setRoom(m.room);
      updateGuides();
      game.emit('room');
      game.emit('decor');
      if (m.room === 'kitnet' && m.ownerId === game.profile?.id && !game.profile?.tutorial.cadeira)
        toast('info', 'Sua kitnet! Clique em “Decorar” e coloque sua cadeira.', 'Your apartment! Click “Decorar” (top right) and place your free chair.');
      // your own padaria: what is where, the first time you stand in it
      if (m.padaria?.owner) setTimeout(welcomeOwner, 900);
      if (m.room === 'padaria' && !m.padaria && !game.profile?.tutorial.carlos)
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
              'Bem-vindo à Academia do Bairro! No tatame é brincadeira: escolha os golpes, faça pontos e respeito sempre.',
              'Welcome to Academia do Bairro! The mat is a game: pick your moves, score points, respect always.',
            ),
          700,
        );
      }
      if (keepMg) correriaUi?.requestSync();
      syncArrival(arrivalFinish, arrivalHall);
      syncAcademyFloor();
      syncPadariaFloor();
      break;
    }
    case 'academy':
      if (m.phase === 'directory') onAcademyDirectory(m.rows, m.canFound, m.ownedId);
      else if (game.room?.room === 'andar' && game.room.academy?.id === m.academy.id) {
        game.room = { ...game.room, academy: m.academy };
        syncAcademyFloor();
        updateGuides();
        game.emit('hud');
        game.emit('room');
      }
      break;
    case 'padariaOwn':
      if (m.phase === 'door') onPadariaDoor(m.enabled, m.door, m.rows);
      else if (m.phase === 'floor' && game.room?.padaria?.id === m.padaria.id) {
        game.room = { ...game.room, padaria: m.padaria };
        syncPadariaFloor();
        game.emit('hud');
        game.emit('room');
      }
      break;
    case 'diary':
      if (m.phase === 'photo') showPhoto(m);
      else if (m.phase === 'word') celebrateWord(m);
      else if (m.phase === 'words') (heldCardWords ? heldCardWords.push(m.words) : celebrateWords(m.words));
      else if (m.phase === 'practice') {
        if (m.ok)
          openEscolaPractice(
            m,
            (choice) => net.send({ t: 'diary', action: 'answer', choice }),
            () => net.send({ t: 'diary', action: 'practice' }),
          );
        else toast('info', m.pt, m.en);
      } else showEscolaResult(m);
      break;
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
      break;
    case 'cartela': {
      const line = stampNotice(m.activity, m.stamps, m.paid);
      if (m.paid) {
        // the profile that follows already holds the fresh card: keep the chip full while the banner plays (the reward toast follows)
        holdCartelaChip(m.stamps, CARTELA_BANNER_MS);
        cartelaBanner(m.stamps);
        ambience.sting('mission');
      } else {
        toast('info', line.pt, line.en);
        ambience.sfx('stamp');
      }
      game.emit('hud');
      break;
    }
    case 'reward':
      if (m.reason.pt === MISSION_COPY.done.pt) {
        missionBanner();
        ambience.sting('mission');
      } else if (m.reason.pt === CARTELA_COPY.paid.pt) {
        // the payout banner already shows the card and the RV; the coin counter ticks when it leaves
        window.setTimeout(() => document.getElementById('coins')?.classList.add('tick'), CARTELA_BANNER_MS - 300);
        window.setTimeout(() => document.getElementById('coins')?.classList.remove('tick'), CARTELA_BANNER_MS + 400);
      } else if (m.reason.pt.startsWith('Recado: ')) break; // the thanks card shows the RV
      else {
        toast('reward', m.reason.pt, m.reason.en, m.amount);
        ambience.sting(m.reason.pt.startsWith('Caderno completo') ? 'caderno' : 'coin');
      }
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
      // A lost-shift reply to a resync that arrives with no counter open has nothing to show.
      if (!correriaUi?.open) {
        if (m.phase !== 'state') break;
        correriaUi = newCorreriaUI();
      }
      try {
        correriaUi.handle(m);
      } catch (err) {
        console.error('Correria no Balcão handler', err);
      }
      break;
    case 'bout':
      // a pending stripe lesson opens straight into the drill (no lobby): that message must open the overlay too
      if ((m.phase === 'lobby' || m.phase === 'drill') && (!boutUi || !boutUi.open)) {
        boutUi = new BoutUI({
          send: (msg) => net.send(msg),
          closed: () => {
            boutUi = null;
            updateGuides();
          },
        });
        updateGuides();
      }
      boutUi?.handle(m);
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

/** Over-stimulation cap (split into areas): never more than two ambient NPC speech bubbles on screen at once (a bubble lives 7 s). */
const MAX_AMBIENT_BUBBLES = 2;
function ambientBubblesFull(): boolean {
  let live = 0;
  for (const b of game.npcBubbles.values()) if (now() - b.at < 7000) live++;
  return live >= MAX_AMBIENT_BUBBLES;
}

// ---------------------------------------------------------------- game start + input

function startGame() {
  started = true;
  window.dispatchEvent(new Event('tb:game-start'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && correriaUi?.live) correriaUi.requestSync();
  });
  hud = buildHud({
    chat: (text) => net.send({ t: 'chat', text }),
    emote: (kind: EmoteKind) => net.send({ t: 'emote', kind }),
    stand: () => net.send({ t: 'stand' }),
    openMap: () => openMap((room) => joinRoom(room)),
    openCredits,
    openCaderno: () => openCaderno(),
    toggleCamera: () => {
      if (!game.profile?.hasCamera) return;
      game.cameraOn = !game.cameraOn;
      syncCameraBanner();
      syncCameraFrame(lastPointer.x, lastPointer.y);
      game.emit('hud');
    },
    openRecados: () => openJournal(),
    openCartela: () => openCartela(),
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
    if (!npcs.length || document.hidden || ambientBubblesFull()) return;
    const n = npcs[Math.floor(Math.random() * npcs.length)];
    npcSay(n.id, localizeGreeting(idleTalk.next(n.idleLines, clock.weather(), clock.minutes()), clock.minutes()));
  }, 11_000);
  // the feira: a vendor calls out their goods now and then (PT with the gloss); never two calls at once, and not while a dialogue box is open
  setInterval(() => {
    if (document.hidden || game.modalOpen || ambientBubblesFull()) return;
    const vendors = game.liveNpcs(now()).filter((n) => n.id === 'tia_lu' || n.id === 'ze' || n.id === 'chico' || n.id === 'rosa');
    if (!vendors.length) return;
    const n = vendors[Math.floor(Math.random() * vendors.length)]!;
    const calls = VENDORS[n.id as 'tia_lu'].calls;
    const call = calls[Math.floor(Math.random() * calls.length)]!;
    npcSay(n.id, localizeGreeting(call, clock.minutes()));
  }, 7_000);
}

function hitLabel(hit: Hit | null): [string, string] | null {
  if (!hit) return null;
  switch (hit.kind) {
    case 'npc':
      return [`${hit.npc.name}  ♥ ${heartsWith(game.profile?.bond, hit.npc.id)}`, `${hit.npc.role.en} — click to talk`];
    case 'prop': {
      const here = game.room?.padaria;
      const own = game.profile?.padaria;
      const team = game.room?.room === 'andar' ? game.room.academy : undefined;
      if (hit.prop.action === 'academy_board' && team) return team.owner ? ['Brasão e kimono', 'Crest and gi — edit your team look'] : [team.name, team.member ? 'Your team — leave or look' : 'Join this team (free)'];
      if (hit.prop.action === 'padaria_door' && here) return here.owner ? ['Melhorias da padaria', 'Upgrades — size and sweets'] : [here.name, `${here.ownerName}’s bakery — about this shop`];
      if (hit.prop.action === 'padaria_counter' && here) return [`Balcão da ${here.name}`, 'House counter — buy here'];
      if (hit.prop.action === 'padaria_door' && own) return [`Sua padaria: ${own.name}`, `Your bakery: ${own.name} — click to go in`];
      return hit.prop.label ? [hit.prop.label.pt, hit.prop.label.en] : null;
    }
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
      if (game.cameraOn) break;
      if (p.action && p.interact) walkTo(p.interact, { kind: 'prop', action: p.action, tile: p.interact, propId: p.id });
      else if (cameraObjectIds().has(p.id)) toast('info', 'Abra a câmera pra fotografar.', 'Open the camera to take a photo.');
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
window.addEventListener('pointermove', (e) => {
  if (!game.cameraOn || !game.profile?.hasCamera) return;
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  syncCameraFrame(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  if (!game.room || game.modalOpen) {
    hoverLabel(0, 0, null);
    return;
  }
  if (game.cameraOn) {
    // through the viewfinder nothing is clickable but the shutter: no hover labels or outlines
    syncCameraFrame(e.clientX, e.clientY);
    hoverLabel(0, 0, null);
    game.hoverKey = null;
    game.hoverTile = null;
    canvas.style.cursor = 'crosshair';
    return;
  }
  const hit = renderer.hitTest(e.clientX, e.clientY);
  game.hoverTile = hit?.kind === 'tile' ? hit.tile : game.placing ? renderer.tileAt(e.clientX, e.clientY) : null;
  game.hoverKey = hit?.kind === 'avatar' ? `av:${hit.id}` : hit?.kind === 'npc' ? `npc:${hit.npc.id}` : null;
  const lbl = hitLabel(hit);
  hoverLabel(e.clientX, e.clientY, lbl?.[0] ?? null, lbl?.[1]);
  canvas.style.cursor = game.cameraOn ? 'crosshair' : hit && hit.kind !== 'tile' ? 'pointer' : 'default';
});
canvas.addEventListener('pointerleave', () => {
  game.hoverKey = null;
  game.hoverTile = null;
  hoverLabel(0, 0, null);
});
canvas.addEventListener('click', (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
  if (boutUi?.open) return; // the mat is busy: the overlay is the only input
  if (game.modalOpen && (modalId() || isDialogueBoxOpen())) return;
  hoverLabel(0, 0, null);
  if (game.cameraOn && game.profile?.hasCamera) {
    takePhoto(e.clientX, e.clientY);
    return;
  }
  handleClick(renderer.hitTest(e.clientX, e.clientY));
});
document.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || modalId() || document.querySelector('.idle-kicked')) return;
  if (e.key === 'Enter' && started && !game.modalOpen) {
    e.preventDefault();
    const near = propOnInteractTile();
    if (near?.action === 'padaria_door') propAction(near.action, near.id);
    else hud?.focusChat();
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
/** When the first key of the current press landed, and how long a lone first key waits for a partner (W+D never lands in the same millisecond). */
let firstKeyAt = 0;
const KEY_CHORD_MS = 60;
function keyWalk() {
  if (!heldArrows.length || !game.room || game.editMode || game.placing) return;
  const cur = selfTile();
  const room = game.roomDef;
  // wait for the server's answer to the previous step before asking for the next one
  if (!cur || cur.moving || !room || now() - lastKeyStep < 140) return;
  // two keys for a diagonal land a few ms apart: a lone first key waits a beat for its partner instead of stepping straight and then turning
  if (heldArrows.length === 1 && now() - firstKeyAt < KEY_CHORD_MS) return;
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
    if (!heldArrows.length) firstKeyAt = now();
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

// the dialogue box tells the world view to ease the camera in on the speakers; the box's height keeps them above it
setDialogueHost({
  open: (npcId) => {
    const npc = npcId ? game.liveNpcs(now()).find((n) => n.id === npcId) : undefined;
    renderer.setDialogueFocus?.({ npc: npc ? { x: npc.x, y: npc.y } : null });
    // the "Fale com…" arrow would sit on the hat of the person you are already talking to
    renderer.guides = [];
  },
  close: () => {
    renderer.setDialogueFocus?.(null);
    updateGuides();
  },
  inset: (px) => renderer.setDialogueBox?.(px),
});
// every 🔊 (dialogue, sign, Caderno) reports the words to the Caderno
setHeardSink((cardIds) => net.send({ t: 'heard', cardIds }));
setConversaLineSink((anchor) => sendLine(anchor));
setArrivalReplay(() => {
  heldCardWords = [];
  net.send({ t: 'arrival', action: 'replay' });
  openArrivalHall((m) => net.send(m), flushCardWords);
});

function frame(ts: number) {
  try {
    renderer.frame(ts);
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
    if (!game.modalOpen && !modalId() && !game.cameraOn && !isTyping(document.activeElement)) {
      const near = propOnInteractTile();
      if (near?.label) {
        const { px, py } = renderer.tileToClient(near.interact!.x, near.interact!.y);
        hoverLabel(px, py, near.label.pt, near.label.en);
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
  /** Per-avatar facing/animation as drawn this frame (pixel view), for the facing e2e and repros. */
  facings: () => ('facingsHook' in renderer ? (renderer as { facingsHook: () => unknown }).facingsHook() : null),
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
  /** Treino no tatame: the live overlay and the feed the world scene reads (e2e and shots). */
  bout: {
    get ui() {
      return boutUi;
    },
    feed: boutFeed,
  },
  /** Correria no Balcão: the live overlay and the feed the world scene reads (e2e and shots). */
  correria: {
    get ui() {
      return correriaUi;
    },
    feed: correriaFeed,
  },
  openCartela: () => openCartela(),
  cartelaBanner: (stamps: number) => cartelaBanner(stamps),
};
