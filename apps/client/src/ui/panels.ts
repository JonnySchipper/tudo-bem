import {
  FURNITURE,
  HATS,
  PARROT_COLORS,
  MISSION_COPY,
  MISSION_REWARD,
  MISSION_STEPS,
  ROOMS,
  furnitureById,
  hatById,
  npcDefById,
  npcPosesIn,
  poseWalk,
  type Bilingual,
  type NpcDef,
  type PublicAvatar,
  type RoomId,
  type SceneView,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui, clear } from './dom';
import { mountCharPreview, setHatIcon } from '../render/pixel/charPreview';
export { MinigameUI } from './meveum-ui.js';
import { furnitureIcon, expressionForScore } from './pixelArt';
import { speak } from '../audio';
import { closeDialogueBox, showDialogueBox, type BoxSpec } from './dialogue';
import { icon } from '../art/ui';
import { drawMinimap } from './minimap';
import { beltChip } from './beltChip';
import { clock } from '../gameClock';

// ---------------------------------------------------------------- modal base

export { closeModal, modalId, openModal } from './modal.js';
import { closeModal, modalId, openModal } from './modal.js';

const closeBtn = (close: () => void) => h('button', { class: 'close ghost', onclick: close, 'aria-label': 'Fechar' }, '✕');

// ---------------------------------------------------------------- NPC dialogue

export interface DialogueOpts {
  npc: NpcDef | null;
  speaker: string;
  role?: string;
  line: Bilingual;
  chips: Bilingual[];
  said?: Bilingual;
  feedback?: { text: Bilingual; score: number };
  onChoose: (i: number) => void;
  onClose: () => void;
  footer?: HTMLElement;
  /** Box key (the typewriter restarts when it changes); default `talk-<npc>`. */
  key?: string;
  /** Free-typed reply (scored with accept-list rules). */
  onType?: (text: string) => void;
}

/** Closes whatever NPC dialogue is up (the in-world box). */
export function closeDialogue() {
  closeDialogueBox();
  game.modalOpen = !!modalId();
}

/** The generic NPC dialogue (Júlia's help, the parrot perch, the Carlos scene) as a beat of the dialogue box. */
function boxSpecFor(o: DialogueOpts): BoxSpec {
  const score = o.feedback?.score;
  return {
    key: o.key ?? (o.npc ? `talk-${o.npc.id}` : 'perch'),
    npcId: o.npc?.id ?? null,
    speaker: o.speaker,
    role: o.role,
    expression: expressionForScore(score),
    line: o.line,
    said: o.said?.pt ?? null,
    feedback: o.feedback ? h('span', { class: `feedback dbx-feedback s${score}` }, `${o.feedback.text.pt} · ${o.feedback.text.en}`) : null,
    chips: o.chips,
    input: o.chips.length && o.onType ? { id: 'scene-type', placeholder: 'Responda em português…', send: 'Responder', onSend: (text) => o.onType?.(text) } : null,
    footer: o.footer,
    onChip: o.onChoose,
    onClose: o.onClose,
  };
}

export function showDialogue(o: DialogueOpts) {
  return showDialogueBox(boxSpecFor(o));
}

export function showScene(view: SceneView, extra: { said?: Bilingual; feedback?: Bilingual; score?: number; payout?: number }, onChoose: (i: number) => void, onClose: () => void, onPlay: () => void, onType?: (text: string) => void) {
  // the baker at the counter: Seu Carlos by day, Dona Graça at night (D12), the same authored scene
  const onDuty = [...game.avatars.values()].find((a) => (a.pub.npc === 'carlos' || a.pub.npc === 'graca') && a.pub.activity === 'trabalhando');
  const carlos = npcDefById(onDuty?.pub.npc ?? 'carlos') ?? ROOMS.padaria.npcs.find((n) => n.id === 'carlos')!;
  speak(view.line.pt);
  const footer = view.end
    ? h(
        'div',
        { class: 'row', style: 'margin-top:12px' },
        extra.payout ? h('span', { class: 'feedback' }, `+${extra.payout} RV · Café da manhã completo!`) : null,
        h('span', { class: 'spacer' }),
        h('button', { onclick: onClose }, bi('Tchau!', 'Bye')),
        h('button', { class: 'primary', onclick: onPlay, id: 'btn-play-mg' }, bi('Jogar “Me vê um…”', 'Play the tray game')),
      )
    : undefined;
  showDialogue({
    npc: carlos,
    speaker: carlos.name,
    role: carlos.role.pt,
    line: view.line,
    chips: view.chips,
    said: extra.said,
    feedback: extra.feedback && extra.score !== undefined ? { text: extra.feedback, score: extra.score } : undefined,
    onChoose,
    onClose,
    footer,
    onType,
  });
}

// Authored guide NPC (client-only chips; no rewards, so no server authority needed).
const JULIA_TREE: { q: Bilingual; a: Bilingual }[] = [
  { q: { pt: 'Como eu ando?', en: 'How do I walk?' }, a: { pt: 'É só clicar no chão! Pra sentar, clique num banco.', en: 'Just click the floor! To sit, click a bench.' } },
  {
    q: { pt: 'Como eu falo com as pessoas?', en: 'How do I talk to people?' },
    a: { pt: 'Escreva no chat lá embaixo e aperte Enter. O botão “Oi!” faz você acenar.', en: 'Type in the chat at the bottom and press Enter. The “Oi!” button makes you wave.' },
  },
  {
    q: { pt: 'Onde fica a padaria?', en: 'Where is the bakery?' },
    a: { pt: 'Ali, na porta com o toldo vermelho! O Seu Carlos adora conversar.', en: 'Right there — the door with the red awning! Seu Carlos loves to chat.' },
  },
  {
    q: { pt: 'Como ganho reais virtuais?', en: 'How do I earn RV coins?' },
    a: {
      pt: 'Tome café com o Seu Carlos e jogue “Me vê um…” no balcão. Depois compre um chapéu com a Nanda!',
      en: 'Have breakfast with Seu Carlos and play “Me vê um…” at the counter. Then buy a hat from Nanda!',
    },
  },
];

/** Júlia's tutorial Q&A. `fromGreeting`: the box already met her, so the first line goes straight to the questions. */
export function showJulia(fromGreeting = false) {
  const julia = ROOMS.praca.npcs.find((n) => n.id === 'julia')!;
  const name = game.profile?.name ?? '';
  const root = (line: Bilingual) => {
    speak(line.pt);
    showDialogue({
      npc: julia,
      speaker: 'Júlia',
      role: 'Guia da praça',
      line,
      key: 'talk-julia',
      chips: JULIA_TREE.map((j) => j.q),
      // four questions on keys 1-4; leaving is the button (or Esc)
      footer: h('button', { class: 'ghost', onclick: closeDialogue }, bi('Tchau, Júlia!', 'Bye, Júlia!')),
      onChoose: (i) => (i < JULIA_TREE.length ? root(JULIA_TREE[i].a) : closeDialogue()),
      onClose: closeDialogue,
    });
  };
  if (fromGreeting) root({ pt: 'Claro! O que você quer saber?', en: 'Of course! What do you want to know?' });
  else root({ pt: `Oi, ${name}! Eu sou a Júlia, guia da praça. Posso te ajudar?`, en: 'Hi! I’m Júlia, the square’s guide. Can I help you?' });
}

// ---------------------------------------------------------------- daily kiosk

/** “+25 RV” coin badge used on the kiosk panel and its completion banner. */
export const rvBadge = (amount = MISSION_REWARD) => h('span', { class: 'rv-badge' }, h('span', { class: 'coin' }), `+${amount} RV`);

export function openKiosk(take: () => void) {
  const body = h('div');
  const render = () => {
    const m = game.profile?.mission;
    const steps: HTMLElement[] = [];
    MISSION_STEPS.forEach((s, i) => {
      const [verb, ...rest] = s.pt.split(' ');
      const done = !!m?.steps[s.id];
      if (i) steps.push(h('span', { class: 'mission-sep', 'aria-hidden': 'true' }, '·'));
      steps.push(
        h(
          'li',
          { class: `mission-step ${done ? 'done' : ''}`, 'data-mission-step': s.id },
          h('span', { class: 'mission-ico' }, icon(s.id, 34)),
          h('b', null, verb),
          h('span', { class: 'detail' }, ` ${rest.join(' ')}`),
          en(s.en, true),
          done ? h('span', { class: 'tick', 'aria-label': 'feito' }, '✓') : null,
        ),
      );
    });
    body.replaceChildren(
      h('ol', { class: 'mission-row', 'aria-label': MISSION_STEPS.map((s) => s.pt.split(' ')[0]).join(' · ') }, ...steps),
      m?.rewarded
        ? h('div', { class: 'mission-complete', id: 'mission-done' }, h('span', { class: 'big' }, MISSION_COPY.done.pt), en(MISSION_COPY.done.en))
        : h(
            'div',
            { class: 'mission-footer' },
            m?.taken
              ? h('span', { class: 'feedback', id: 'mission-active' }, `${MISSION_STEPS.filter((s) => m.steps[s.id]).length}/${MISSION_STEPS.length} · Missão em andamento`, en('In progress — steps tick off as you play', true))
              : h('button', { class: 'primary big-cta', id: 'mission-take', onclick: take }, bi(MISSION_COPY.cta.pt, MISSION_COPY.cta.en)),
          ),
    );
  };
  render();
  const off = game.on('profile', render);
  const close = openModal(
    'kiosk',
    h(
      'div',
      { class: 'panel kiosk' },
      closeBtn(() => close()),
      h('div', { class: 'kiosk-head' }, h('h2', null, MISSION_COPY.header.pt), rvBadge()),
      en(`${MISSION_COPY.header.en} · once a day`),
      body,
    ),
    { onClose: off },
  );
}

export function showParrotPerch(adopt: () => void) {
  openParrotShop({
    adoptFree: () => {
      if (!game.profile?.parrotOwned) adopt();
    },
    buy: (id) => netSendParrotBuy(id),
    equip: (id) => netSendParrotColor(id),
  });
}

/** Wired from main.ts so this module does not import the net layer. */
let netSendParrotBuy = (_id: string) => {};
let netSendParrotColor = (_id: string) => {};
export function wireParrotShop(send: { buy: (id: string) => void; equip: (id: string) => void }) {
  netSendParrotBuy = send.buy;
  netSendParrotColor = send.equip;
}

export function openParrotShop(actions: { buy: (id: string) => void; equip: (id: string) => void; adoptFree: () => void }) {
  const p = game.profile!;
  const grid = h('div', { class: 'grid-items parrot-grid' });
  const canvas = h('canvas', { id: 'parrot-preview', style: 'width:96px;height:60px;image-rendering:pixelated' });
  let sel = p.parrotColor ?? 'verde';
  const preview = mountCharPreview(canvas, () => {
    const cur = game.profile ?? p;
    return { appearance: cur.appearance, hat: cur.hat, parrot: cur.parrotOwned && cur.parrotEquipped, parrotColor: sel };
  });

  const render = () => {
    const prof = game.profile!;
    clear(grid);
    for (const c of PARROT_COLORS) {
      const owned = prof.parrotColors?.includes(c.id) ?? (c.id === 'verde' && prof.parrotOwned);
      const wearing = (prof.parrotColor ?? 'verde') === c.id && prof.parrotEquipped;
      const btn = owned
        ? h(
            'button',
            { class: wearing ? '' : 'green', onclick: (e: Event) => (e.stopPropagation(), actions.equip(c.id), (sel = c.id), render()) },
            wearing ? bi('No ombro', 'On shoulder') : bi('Chamar', 'Call'),
          )
        : h(
            'button',
            { class: 'primary', disabled: prof.coins < c.price, onclick: (e: Event) => (e.stopPropagation(), c.price === 0 && !prof.parrotOwned ? actions.adoptFree() : actions.buy(c.id)) },
            c.price === 0 ? bi('Adotar grátis', 'Adopt free') : bi('Comprar', 'Buy'),
          );
      grid.append(
        h(
          'div',
          { class: `item-card ${sel === c.id ? 'sel' : ''}`, onclick: () => ((sel = c.id), render()), 'data-parrot': c.id },
          h('div', { class: 'name' }, c.pt),
          en(c.en),
          h('span', { class: `price ${c.price === 0 ? 'free' : ''}` }, c.price === 0 ? 'Grátis' : `${c.price} RV`),
          btn,
        ),
      );
    }
  };
  render();
  const off = game.on('profile', render);
  const close = openModal(
    'parrot-shop',
    h(
      'div',
      { class: 'panel parrot-shop' },
      closeBtn(() => close()),
      h('h2', null, bi('Poleiro do papagaio', 'Parrot perch')),
      en('Pick a colour. Your parrot whispers study words — it does not translate.'),
      canvas,
      grid,
    ),
    { onClose: off },
  );
}

// ---------------------------------------------------------------- hat shop / wardrobe

/** The S-facing hat layer at 4x, in a fixed box so the integer scale is never stretched. */
function hatIconBox(id: string, alt: string): HTMLElement {
  const img = h('img', { alt, 'data-hat-icon': id }) as HTMLImageElement;
  setHatIcon(img, id, 4);
  return h('div', { class: 'hat-icon-box' }, img);
}

/** `closedNote`: Nanda is not at her stall (outside 08:00-20:00): the shop still opens from the closed stall (D12), with this note. */
export function openHatShop(mode: 'shop' | 'wardrobe', actions: { buy: (id: string) => void; equip: (id: string | null) => void }, opts: { closedNote?: Bilingual } = {}) {
  const p = game.profile!;
  let sel = p.hat ?? (mode === 'shop' ? HATS[0].id : null);
  // the composed pixel character wearing the selected hat (6x, integer scale, both views)
  const canvas = h('canvas', { id: 'hat-preview', style: 'width:168px;height:216px;image-rendering:pixelated' });
  const nandaSays = h('div', { class: 'nanda-says' });
  const grid = h('div', { class: 'grid-items' });
  const preview = mountCharPreview(canvas, () => {
    const cur = game.profile ?? p;
    return { appearance: cur.appearance, hat: sel, parrot: cur.parrotOwned && cur.parrotEquipped };
  });

  const render = () => {
    const prof = game.profile!;
    const hat = hatById(sel);
    if (mode === 'shop' && opts.closedNote) nandaSays.replaceChildren(opts.closedNote.pt, en(opts.closedNote.en));
    else
      nandaSays.replaceChildren(
        mode === 'shop' ? 'Nanda: ' : '',
        hat ? `“${hat.pt}? Fica bem em você!”` : '“Sem chapéu também fica ótimo!”',
        en(hat ? `${hat.en}? Looks good on you!` : 'No hat looks great too!'),
      );
    const list = mode === 'shop' ? HATS : HATS.filter((x) => prof.hats.includes(x.id));
    clear(grid);
    if (!list.length) grid.append(h('div', null, 'Você ainda não tem chapéus.', en('No hats yet — visit Nanda’s stall in the Praça.')));
    for (const hatDef of list) {
      const owned = prof.hats.includes(hatDef.id);
      const wearing = prof.hat === hatDef.id;
      const btn = owned
        ? h(
            'button',
            { class: wearing ? '' : 'green', onclick: (e: Event) => (e.stopPropagation(), actions.equip(wearing ? null : hatDef.id)), 'data-hat-action': hatDef.id },
            wearing ? bi('Tirar', 'Take off') : bi('Usar', 'Wear'),
          )
        : h(
            'button',
            { class: 'primary', disabled: prof.coins < hatDef.price, onclick: (e: Event) => (e.stopPropagation(), actions.buy(hatDef.id)), 'data-hat-action': hatDef.id },
            hatDef.price === 0 ? bi('Pegar grátis', 'Get free') : bi('Comprar', 'Buy'),
          );
      grid.append(
        h(
          'div',
          { class: `item-card ${sel === hatDef.id ? 'sel' : ''}`, onclick: () => ((sel = hatDef.id), render()), 'data-hat': hatDef.id },
          hatIconBox(hatDef.id, hatDef.pt),
          h('div', { class: 'name' }, hatDef.pt),
          en(hatDef.en),
          owned
            ? h('span', { class: 'price free' }, wearing ? 'Usando' : 'Seu')
            : h('span', { class: `price ${hatDef.price === 0 ? 'free' : ''}` }, hatDef.price === 0 ? 'Grátis' : [h('span', { class: 'coin' }), ` ${hatDef.price}`]),
          btn,
        ),
      );
    }
  };
  render();
  const off = game.on('profile', () => {
    sel = game.profile?.hat ?? sel;
    render();
  });
  const close = openModal(
    'hats',
    h(
      'div',
      { class: 'panel', style: 'width:min(860px, calc(100vw - 24px))' },
      closeBtn(() => close()),
      h('h2', null, mode === 'shop' ? 'Chapéus da Nanda' : 'Meus chapéus'),
      en(mode === 'shop' ? 'Nanda’s hat stall — try one on! Cosmetic only; some are free.' : 'Your hats — wear one anywhere.'),
      h('div', { class: 'shop' }, h('div', null, h('div', { class: 'preview' }, canvas), nandaSays, h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'coin' }), h('b', { id: 'shop-coins' }, `${p.coins} RV`))), grid),
    ),
    {
      onClose: () => {
        preview.stop();
        off();
      },
    },
  );
  game.on('profile', () => {
    const el = document.getElementById('shop-coins');
    if (el && game.profile) el.textContent = `${game.profile.coins} RV`;
  });
}

// ---------------------------------------------------------------- map

/** The three open-air areas of Vila Ipê, in walking order (split into areas), each with its minimap in the Mapa panel. */
const AREAS: { id: RoomId; pt: string; en: string }[] = [
  { id: 'rua', pt: 'Rua dos Ipês', en: 'Ipê Street' },
  { id: 'praca', pt: 'Praça Central', en: 'Central Square' },
  { id: 'feira', pt: 'Feira Livre', en: 'Street Market' },
];
const isArea = (r: RoomId | undefined | null): r is RoomId => AREAS.some((a) => a.id === r);

/** The pixel minimap of one area with its doors, the neighbours and "você" (you only show in the area you are in). */
function mapView(areaId: RoomId): HTMLElement {
  const self = game.self;
  const inArea = game.room?.room === areaId;
  const here = inArea && self ? (self.path.at(-1) ?? self.from) : null;
  // the neighbours where they are now: live avatars when you are in the area, otherwise the schedule at the game clock
  const npcs = inArea
    ? game.liveNpcs(performance.now())
    : npcPosesIn(areaId, clock.now()).map((p) => ({ name: npcDefById(p.npc)?.name ?? p.npc, ...poseWalk(p, clock.now()).tile }));
  const canvas = drawMinimap(ROOMS[areaId], here, npcs);
  canvas.setAttribute('aria-label', `Mapa: ${ROOMS[areaId].name}`);
  return h('div', { class: 'minimap-wrap' }, canvas, h('div', { class: 'minimap-key' }, h('span', { class: 'k door' }), ' portas e saídas ', h('span', { class: 'k npc' }), ' vizinhos ', h('span', { class: 'k me' }), ' você'));
}

export function openMap(go: (room: RoomId) => void) {
  const card = (room: RoomId | null, pt: string, enText: string, colors: [string, string] | null, locked = false, light = false) =>
    h(
      'button',
      { class: `map-card ${locked ? 'locked' : ''} ${light ? 'light' : ''}`, style: colors ? `--card:${colors[0]};--card2:${colors[1]}` : '', disabled: locked, onclick: () => room && (go(room), close()), 'data-room': room ?? '' },
      h('div', null, h('b', null, pt), en(enText)),
      h('div', null, h('span', { class: 'linecolor' }), locked ? h('span', { style: 'margin-left:8px;font-weight:800' }, 'Em breve') : null),
    );
  // the minimap shows one area at a time: tabs for the three areas, the one you are in first
  let shown: RoomId = isArea(game.room?.room) ? game.room!.room! : 'praca';
  const mapBox = h('div', { class: 'map-areas' });
  const tabs = h('div', { class: 'map-tabs', role: 'tablist' });
  const renderMap = () => {
    tabs.replaceChildren(
      ...AREAS.map((a) =>
        h('button', { class: `map-tab ${a.id === shown ? 'on' : ''}`, role: 'tab', 'aria-selected': String(a.id === shown), 'data-area': a.id, onclick: () => ((shown = a.id), renderMap()) }, a.pt),
      ),
    );
    mapBox.replaceChildren(mapView(shown));
  };
  renderMap();
  const close = openModal(
    'map',
    h(
      'div',
      { class: 'panel' },
      closeBtn(() => close()),
      h('h2', null, 'São Paulo · Vila Ipê'),
      en('Three areas side by side: walk off an edge to go next door. Fast travel is free between places you know.'),
      tabs,
      mapBox,
      h(
        'div',
        { class: 'map-grid' },
        card('rua', 'Rua dos Ipês', 'Ipê Street — padaria, newsstand, apartments, academy, bus stop', ['#7a6a5a', '#d8cbb6']),
        card('praca', 'Praça Central', 'Central Square — fountain, hats, parrot, missions', ['#d9532b', '#f2c230']),
        card('feira', 'Feira Livre', 'Street market — fruit, vegetables, pastel, flowers (6 am–1 pm)', ['#4f8a3c', '#e8a94f']),
        card('padaria', 'Padaria do Seu Carlos', 'Bakery — breakfast + “Me vê um…”', ['#a8452c', '#e8a94f']),
        card('academia', 'Academia do Bairro', 'Word-game roll — academy Portuguese (not real MA training)', ['#2f5f7a', '#8ab4c8']),
        card('kitnet', 'Minha kitnet', 'My studio apartment — decorate', ['#f5e6d3', '#a8c5d4'], false, true),
        card(null, 'Estação de Metrô', 'Subway (Phase 1)', null, true),
        card(null, 'Praia', 'Beach day trip (Phase 2)', null, true),
      ),
    ),
  );
}

// ---------------------------------------------------------------- friends

export function openFriends(actions: { request: (id: string) => void; accept: (id: string) => void; decline: (id: string) => void; remove: (id: string) => void; hop: (roomId: RoomId, instanceId: string | null, ownerId?: string) => void; refresh: () => void }) {
  const body = h('div');
  const render = () => {
    const others = [...game.avatars.values()].filter((a) => a.pub.id !== game.room?.selfId && !a.pub.cpu && !a.pub.npc);
    body.replaceChildren(
      game.incoming.length ? h('div', { class: 'section-title' }, 'Pedidos de amizade', en(' Friend requests', true)) : '',
      h(
        'div',
        { class: 'list-rows' },
        ...game.incoming.map((r) =>
          h('div', { class: 'r' }, h('b', null, r.name), h('span', { class: 'spacer' }), h('button', { class: 'green', onclick: () => actions.accept(r.id) }, bi('Aceitar', 'Accept')), h('button', { onclick: () => actions.decline(r.id) }, bi('Recusar', 'Decline'))),
        ),
      ),
      h('div', { class: 'section-title' }, 'Meus amigos', en(' My friends', true)),
      h(
        'div',
        { class: 'list-rows' },
        game.friends.length ? '' : h('div', { class: 'r' }, 'Nenhum amigo ainda.', en('No friends yet — click someone in a room to add them.')),
        ...game.friends.map((f) =>
          h(
            'div',
            { class: 'r' },
            h('span', { class: `dot ${f.online ? 'on' : ''}` }),
            h('b', null, f.name),
            h('span', { style: 'color:var(--ink-soft);font-weight:700;font-size:.85em' }, f.online ? (f.roomName ?? 'online') : 'offline'),
            h('span', { class: 'spacer' }),
            f.online && f.room && f.room !== 'kitnet' ? h('button', { class: 'green', onclick: () => (actions.hop(f.room!, f.instanceId), close()) }, bi('Ir até', 'Join')) : '',
            h('button', { onclick: () => (actions.hop('kitnet', null, f.id), close()) }, bi('Visitar kitnet', 'Visit apt')),
            h('button', { class: 'ghost', onclick: () => actions.remove(f.id) }, 'Remover'),
          ),
        ),
      ),
      h('div', { class: 'section-title' }, 'Nesta sala', en(' In this room', true)),
      h(
        'div',
        { class: 'list-rows' },
        others.length ? '' : h('div', { class: 'r' }, 'Só você por aqui agora.', en(game.solo ? 'Solo preview: other players appear on the multiplayer server build.' : 'Just you here right now — open a second tab to test with a friend!')),
        ...others.map((a) =>
          h(
            'div',
            { class: 'r' },
            h('span', { class: 'plate' }, h('span', { class: 'seed' }), a.pub.name),
            h('span', { class: 'spacer' }),
            game.profile?.friends.includes(a.pub.id) ? h('span', { class: 'feedback' }, 'Amigo') : h('button', { class: 'green', onclick: () => actions.request(a.pub.id) }, bi('Adicionar', 'Add friend')),
          ),
        ),
      ),
    );
  };
  render();
  actions.refresh();
  const off = game.on('friends', render);
  const close = openModal('friends', h('div', { class: 'panel' }, closeBtn(() => close()), h('h2', null, 'Amigos'), en('Friends — see who’s online and hop over.'), body), { onClose: off });
}

export function openProfileCard(a: PublicAvatar, actions: { request: (id: string) => void; report: (id: string) => void; wave: () => void }) {
  const canvas = h('canvas', { style: 'width:168px;height:216px;image-rendering:pixelated' });
  const preview = mountCharPreview(canvas, () => ({ appearance: a.appearance, hat: a.hat, parrot: a.parrot }));
  const isFriend = game.profile?.friends.includes(a.id);
  const pronoun = { ele: 'ele', ela: 'ela', nome: 'só o nome' }[a.pronoun];
  const close = openModal(
    'profile',
    h(
      'div',
      { class: 'panel card-profile' },
      closeBtn(() => close()),
      canvas,
      h('h2', null, a.name),
      h('div', { class: 'row', style: 'justify-content:center' }, h('span', { class: 'plate' }, h('span', { class: 'seed' }), 'Verde'), h('span', { style: 'font-weight:700;color:var(--ink-soft)' }, `trate por: ${pronoun}`)),
      a.belt ? h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' }, beltChip(a.belt)) : null,
      en('Verde plate: tourist level — sees English glosses. Plates come from learning, never from money.'),
      h(
        'div',
        { class: 'row', style: 'justify-content:center;margin-top:12px' },
        h('button', { onclick: () => (actions.wave(), close()) }, bi('Acenar', 'Wave')),
        isFriend ? h('span', { class: 'feedback' }, 'Amigo') : h('button', { class: 'green', onclick: () => (actions.request(a.id), close()), id: 'btn-add-friend' }, bi('Adicionar amigo', 'Add friend')),
        h('button', { class: 'ghost', onclick: () => (actions.report(a.id), close()) }, bi('Denunciar', 'Report')),
      ),
    ),
    { onClose: () => preview.stop() },
  );
}

// ---------------------------------------------------------------- kitnet decorator

export function buildDecorPanel(actions: { buy: (id: string) => void; rotate: (uid: string) => void; pickup: (uid: string) => void; exit: () => void }) {
  let tab: 'meus' | 'loja' = 'meus';
  const el = h('div', { class: 'decor', id: 'decor-panel', style: 'display:none' });
  const render = () => {
    if (!game.editMode) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const p = game.profile!;
    const inv = Object.entries(p.furniture).filter(([, n]) => n > 0);
    const selF = game.furniture.find((f) => f.uid === game.selectedFurniture);
    const selDef = selF ? furnitureById(selF.itemId) : null;
    el.replaceChildren(
      h('div', { class: 'row' }, h('h3', null, 'Decorar a kitnet'), h('span', { class: 'spacer' }), h('button', { class: 'ghost', onclick: actions.exit }, '✕')),
      en('Decorate: pick an item, then click a floor tile. R rotates.'),
      h('div', { class: 'tabs', style: 'margin-top:8px' }, h('button', { class: tab === 'meus' ? 'on' : '', onclick: () => ((tab = 'meus'), render()) }, bi('Meus móveis', 'My items')), h('button', { class: tab === 'loja' ? 'on' : '', onclick: () => ((tab = 'loja'), render()), id: 'tab-loja' }, bi('Atelier', 'Shop'))),
      selF && selDef
        ? h(
            'div',
            { class: 'hintbox', style: 'margin-top:8px' },
            h('b', null, selDef.pt),
            en(selDef.en),
            h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { onclick: () => actions.rotate(selF.uid) }, bi('Girar', 'Rotate')), h('button', { onclick: () => actions.pickup(selF.uid) }, bi('Guardar', 'Pick up'))),
          )
        : game.placing
          ? h('div', { class: 'hintbox', style: 'margin-top:8px' }, `Colocando: ${furnitureById(game.placing.itemId)?.pt}`, en('Click a free floor tile. Press R to rotate, Esc to cancel.'))
          : '',
      tab === 'meus'
        ? h(
            'div',
            { class: 'list' },
            inv.length ? '' : h('div', { class: 'hintbox' }, 'Nada guardado.', en('Nothing in storage — buy something in the Atelier tab.')),
            ...inv.map(([id, n]) => {
              const d = furnitureById(id)!;
              return h(
                'button',
                {
                  class: game.placing?.itemId === id ? 'sel' : '',
                  onclick: () => {
                    game.selectedFurniture = null;
                    game.placing = game.placing?.itemId === id ? null : { itemId: id, rot: 0 };
                    render();
                  },
                  'data-furniture': id,
                },
                furnitureIcon(id),
                h('span', null, h('b', null, d.pt), en(d.en, true)),
                h('span', { class: 'pill', style: 'box-shadow:none;padding:2px 8px' }, `×${n}`),
              );
            }),
          )
        : h(
            'div',
            { class: 'list' },
            ...FURNITURE.map((d) =>
              h(
                'button',
                { onclick: () => actions.buy(d.id), disabled: p.coins < d.price, 'data-buy-furniture': d.id },
                furnitureIcon(d.id),
                h('span', null, h('b', null, d.pt), en(d.en, true)),
                h('span', { class: 'price', style: 'display:inline-flex;gap:4px;align-items:center;font-weight:800' }, h('span', { class: 'coin' }), String(d.price)),
              ),
            ),
          ),
    );
  };
  ui().append(el);
  game.on('profile', render);
  game.on('decor', render);
  game.on('room', render);
  return { render };
}
