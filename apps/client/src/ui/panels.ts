import {
  FURNITURE,
  HATS,
  HATS_PRAIA,
  JULIA_INTRO,
  JULIA_INTRO_FROM_GREETING,
  JULIA_TREE,
  juliaHelpOpener,
  fillTalk,
  spokenNameless,
  ALL_HATS,
  PARROT_COLORS,
  ownedParrotColorIds,
  MISSION_COPY,
  MISSION_REWARD,
  MISSION_STEPS,
  ROOMS,
  furnitureById,
  hatById,
  npcDefById,
  tierRule,
  FOUNDER_BADGE,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type Bilingual,
  type NpcDef,
  type PublicAvatar,
  type RoomId,
  type SceneView,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui, clear, rvPriceNote } from './dom';
import { TIER_HEX, tierChip } from './plate';
import { mountCharPreview, setHatIcon, setParrotIcon } from '../render/pixel/charPreview';
import { newlyOwned, shortBy, splitStall } from './stallLogic';
import { furnitureIcon, expressionForScore } from './pixelArt';
import { speak } from '../audio';
import { closeDialogueBox, showDialogueBox, type BoxSpec } from './dialogue';
import { openVilaGuide } from './vilaGuide';
import { icon } from '../art/ui';
import { beltChip } from './beltChip';
import { clock } from '../gameClock';
import { profileMetJulia, rememberJuliaMet } from './juliaMet';

// ---------------------------------------------------------------- modal base

export { closeModal, modalId, openModal } from './modal.js';
import { closeModal, modalId, openModal } from './modal.js';

const closeBtn = (close: () => void) => h('button', { class: 'close ghost', onclick: close, 'aria-label': 'Fechar (Close)' }, '✕');

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
  /** Between the line and the chips (a cart's menu board). */
  extras?: HTMLElement;
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
    extras: o.extras,
    chips: o.chips,
    input: o.chips.length && o.onType ? { id: 'scene-type', placeholder: 'Responda em português… (Answer in Portuguese)', send: 'Responder', onSend: (text) => o.onType?.(text) } : null,
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
  speak(view.line.pt, { speaker: carlos.id });
  const footer = view.end
    ? h(
        'div',
        { class: 'row', style: 'margin-top:12px' },
        extra.payout ? h('span', { class: 'feedback' }, `+${extra.payout} RV · Café da manhã completo!`) : null,
        h('span', { class: 'spacer' }),
        h('button', { onclick: onClose }, bi('Tchau!', 'Bye')),
        h('button', { class: 'primary', onclick: onPlay, id: 'btn-play-mg' }, bi('Jogar “Correria no Balcão”', 'Play Counter Rush')),
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

/** Júlia's tutorial Q&A. `fromGreeting`: the box already met her, so the first line goes straight to the questions. */
export function showJulia(fromGreeting = false) {
  const julia = ROOMS.praca.npcs.find((n) => n.id === 'julia')!;
  const name = game.profile?.name ?? '';
  const root = (line: Bilingual, spoken: string = line.pt) => {
    speak(spoken, { speaker: 'julia' });
    showDialogue({
      npc: julia,
      speaker: 'Júlia',
      role: 'Guia da praça · Plaza guide',
      line,
      key: 'talk-julia',
      chips: JULIA_TREE.map((j) => j.q),
      // the questions on keys 1-5; leaving is the button (or Esc)
      footer: h('button', { class: 'ghost', onclick: closeDialogue }, bi('Tchau, Júlia!', 'Bye, Júlia!')),
      onChoose: (i) => {
        const j = JULIA_TREE[i];
        if (!j) return closeDialogue();
        root(j.a);
        // "O que tem pra fazer aqui?": she points at the guide card, which opens over her answer
        if (j.guide) openVilaGuide();
      },
      onClose: closeDialogue,
    });
  };
  const met = fromGreeting || profileMetJulia();
  if (!met) rememberJuliaMet();
  const opener = juliaHelpOpener(met);
  if (opener === JULIA_INTRO_FROM_GREETING) root(opener);
  else root({ pt: fillTalk(JULIA_INTRO.pt, { name }), en: JULIA_INTRO.en }, spokenNameless(JULIA_INTRO.pt, { minute: clock.minutes() }));
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
          done ? h('span', { class: 'tick', 'aria-label': 'feito (done)' }, '✓') : null,
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

// ---------------------------------------------------------------- market stalls (the Puleiro, Nanda's hats)

/** The RV wallet in a stall's header; it flashes when a buy takes coins out. */
function stallWallet(): { el: HTMLElement; set: (coins: number) => void } {
  const amount = h('b', { id: 'shop-coins' });
  const el = h('span', { class: 'stall-wallet', title: 'Seus reais virtuais (RV) · Your reais virtuais (RV), the game’s play money' }, h('span', { class: 'coin' }), amount);
  let last: number | null = null;
  return {
    el,
    set: (coins) => {
      amount.textContent = `${coins} RV`;
      if (last !== null && coins < last) {
        el.classList.remove('spent');
        void el.offsetWidth;
        el.classList.add('spent');
      }
      last = coins;
    },
  };
}

interface StallCard {
  data: Record<string, string>;
  icon: HTMLElement;
  pt: string;
  en: string;
  price: number;
  coins: number;
  owned: boolean;
  /** worn / on the shoulder right now */
  using: boolean;
  usingLabel: string;
  selected: boolean;
  /** bought (or adopted) since the panel opened: the card plays its stamp once */
  fresh: string | null;
  button: HTMLElement;
  onSelect: () => void;
}

/** One good on the stall: a hanging price tag (or a "yours" tag), its pixel icon, the name and the one action. */
function stallCard(s: StallCard): HTMLElement {
  const short = s.owned ? 0 : shortBy(s.coins, s.price);
  const tag = s.owned
    ? h('span', { class: `stall-tag ${s.using ? 'using' : 'mine'}` }, s.using ? s.usingLabel : '✓ Seu · Yours')
    : h('span', { class: `price price-tag ${s.price === 0 ? 'free' : ''}` }, s.price === 0 ? 'Grátis · Free' : [h('span', { class: 'coin' }), ` ${s.price}`]);
  const cls = ['item-card', 'stall-card', s.owned ? 'owned' : 'sale', s.using ? 'using' : '', s.selected ? 'sel' : '', short ? 'cant' : '', s.fresh ? 'just-bought' : ''];
  return h(
    'div',
    { class: cls.filter(Boolean).join(' '), onclick: s.onSelect, ...s.data },
    tag,
    h('div', { class: 'item-icon-box hat-icon-box' }, s.icon),
    h('div', { class: 'name' }, s.pt),
    en(s.en),
    short ? h('span', { class: 'short' }, `Faltam ${short} RV`, en(` · ${short} RV short`, true)) : null,
    s.button,
    s.fresh ? h('span', { class: 'stall-stamp', 'aria-hidden': 'true' }, s.fresh) : null,
  );
}

/** Goods bought since the panel opened keep their stamp for a moment, across the re-renders the profile update brings. */
function freshMarks(ms = 1800): { mark: (id: string) => void; has: (id: string) => boolean } {
  const until = new Map<string, number>();
  return {
    mark: (id) => void until.set(id, performance.now() + ms),
    has: (id) => (until.get(id) ?? 0) > performance.now(),
  };
}

/** A labelled shelf of the stall ("Seus" / "À venda"); nothing when it is empty. */
function stallShelf(kind: 'owned' | 'sale', pt: string, enText: string, cards: HTMLElement[]): HTMLElement | null {
  if (!cards.length) return null;
  return h(
    'section',
    { class: `stall-shelf ${kind}`, 'data-shelf': kind },
    h('div', { class: 'stall-shelf-title' }, h('b', null, pt), en(enText, true), h('span', { class: 'count' }, String(cards.length))),
    h('div', { class: 'grid-items' }, ...cards),
  );
}

/** The vitrine: the player on the pedestal, wearing what is selected. */
function stallVitrine(canvas: HTMLCanvasElement, says: HTMLElement): HTMLElement {
  return h('div', { class: 'stall-side' }, h('div', { class: 'preview' }, canvas), says);
}

export function openParrotShop(actions: { buy: (id: string) => void; equip: (id: string) => void; adoptFree: () => void }) {
  const p = game.profile!;
  const goods = h('div', { class: 'stall-goods' });
  // the composed player at 6x with the selected bird on the shoulder: try one on before buying it
  const canvas = h('canvas', { id: 'parrot-preview', class: 'stall-canvas' });
  const says = h('div', { class: 'nanda-says stall-says' });
  const wallet = stallWallet();
  let sel = p.parrotColor ?? 'verde';
  let seen: Set<string> | null = null;
  const fresh = freshMarks();
  const preview = mountCharPreview(canvas, () => {
    const cur = game.profile ?? p;
    return { appearance: cur.appearance, hat: cur.hat, parrot: true, parrotColor: sel };
  });

  const render = () => {
    const prof = game.profile!;
    const ownedIds = ownedParrotColorIds(prof);
    for (const id of newlyOwned(seen, ownedIds)) {
      fresh.mark(id);
      sel = id;
      preview.wave();
    }
    seen = new Set(ownedIds);
    wallet.set(prof.coins);
    const onShoulder = prof.parrotEquipped ? (prof.parrotColor ?? 'verde') : null;
    const selDef = PARROT_COLORS.find((c) => c.id === sel) ?? PARROT_COLORS[0];
    // needs_br: true (the stall's notes)
    const note: [string, string] = !ownedIds.includes(selDef.id)
      ? [`${selDef.pt}: experimente no ombro.`, `${selDef.en}: try it on your shoulder.`]
      : onShoulder === selDef.id
        ? [`${selDef.pt}: no seu ombro agora.`, `${selDef.en}: on your shoulder now.`]
        : [`${selDef.pt}: já é seu. Chame quando quiser.`, `${selDef.en}: already yours. Call it any time.`];
    says.replaceChildren(note[0], en(note[1]));
    const card = (c: (typeof PARROT_COLORS)[number]) => {
      const owned = ownedIds.includes(c.id);
      const wearing = onShoulder === c.id;
      const icon = h('img', { alt: c.pt }) as HTMLImageElement;
      setParrotIcon(icon, c.id, 4);
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
      return stallCard({
        data: { 'data-parrot': c.id },
        icon,
        pt: c.pt,
        en: c.en,
        price: c.price,
        coins: prof.coins,
        owned,
        using: wearing,
        usingLabel: 'No ombro',
        selected: sel === c.id,
        fresh: fresh.has(c.id) ? (c.price === 0 ? 'Adotado!' : 'Comprado!') : null,
        button: btn,
        onSelect: () => ((sel = c.id), render()),
      });
    };
    const split = splitStall(PARROT_COLORS, ownedIds);
    goods.replaceChildren(
      ...[stallShelf('owned', 'Seus pássaros', 'Yours', split.owned.map(card)), stallShelf('sale', 'À venda', 'For sale', split.sale.map(card))].filter((x): x is HTMLElement => !!x),
    );
  };
  render();
  const off = game.on('profile', render);
  const close = openModal(
    'parrot-shop',
    h(
      'div',
      { class: 'panel stall-panel parrot-shop' },
      closeBtn(() => close()),
      h('div', { class: 'stall-head' }, h('h2', null, 'Puleiro dos Pássaros'), wallet.el),
      en('Bird perch · pick a bird. It whispers study words — it does not translate. Cosmetic only.'),
      rvPriceNote(),
      h('div', { class: 'shop' }, stallVitrine(canvas, says), goods),
    ),
    {
      onClose: () => {
        preview.stop();
        off();
      },
    },
  );
}

// ---------------------------------------------------------------- hat shop / wardrobe

/** The S-facing hat layer at 4x, in a fixed box so the integer scale is never stretched. */
function hatIcon(id: string, alt: string): HTMLElement {
  const img = h('img', { alt, 'data-hat-icon': id }) as HTMLImageElement;
  setHatIcon(img, id, 4);
  return img;
}

/** `closedNote`: Nanda is not at her stall (outside 08:00-20:00): the shop still opens from the closed stall (D12), with this note. */
export function openHatShop(mode: 'shop' | 'wardrobe', actions: { buy: (id: string) => void; equip: (id: string | null) => void }, opts: { closedNote?: Bilingual; stall?: 'nanda' | 'jo' } = {}) {
  const p = game.profile!;
  // Nanda's stall in the praça, or Jô's beach rack at the Praia (its own three hats)
  const jo = opts.stall === 'jo';
  const stock = jo ? HATS_PRAIA : HATS;
  const seller = jo ? 'Jô' : 'Nanda';
  let sel = p.hat ?? (mode === 'shop' ? stock[0].id : null);
  // the composed pixel character wearing the selected hat (6x, integer scale, both views)
  const canvas = h('canvas', { id: 'hat-preview', class: 'stall-canvas' });
  const nandaSays = h('div', { class: 'nanda-says stall-says' });
  const goods = h('div', { class: 'stall-goods' });
  const wallet = stallWallet();
  let seen: Set<string> | null = null;
  const fresh = freshMarks();
  const preview = mountCharPreview(canvas, () => {
    const cur = game.profile ?? p;
    return { appearance: cur.appearance, hat: sel, parrot: cur.parrotOwned && cur.parrotEquipped, parrotColor: cur.parrotColor };
  });

  const render = () => {
    const prof = game.profile!;
    for (const id of newlyOwned(seen, prof.hats)) {
      fresh.mark(id);
      sel = id;
      preview.wave();
    }
    seen = new Set(prof.hats);
    wallet.set(prof.coins);
    const hat = hatById(sel);
    if (mode === 'shop' && opts.closedNote) nandaSays.replaceChildren(opts.closedNote.pt, en(opts.closedNote.en));
    else
      nandaSays.replaceChildren(
        mode === 'shop' ? `${seller}: ` : '',
        hat ? `“${hat.pt}? Fica bem em você!”` : '“Sem chapéu também fica ótimo!”',
        en(hat ? `${hat.en}? Looks good on you!` : 'No hat looks great too!'),
      );
    const card = (hatDef: (typeof ALL_HATS)[number]) => {
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
      return stallCard({
        data: { 'data-hat': hatDef.id },
        icon: hatIcon(hatDef.id, hatDef.pt),
        pt: hatDef.pt,
        en: hatDef.en,
        price: hatDef.price,
        coins: prof.coins,
        owned,
        using: wearing,
        usingLabel: 'Usando',
        selected: sel === hatDef.id,
        fresh: fresh.has(hatDef.id) ? (hatDef.price === 0 ? 'É seu!' : 'Comprado!') : null,
        button: btn,
        onSelect: () => ((sel = hatDef.id), render()),
      });
    };
    if (mode === 'shop') {
      const split = splitStall(stock, prof.hats);
      goods.replaceChildren(
        ...[stallShelf('owned', 'Seus chapéus', 'Yours', split.owned.map(card)), stallShelf('sale', 'À venda', 'For sale', split.sale.map(card))].filter((x): x is HTMLElement => !!x),
      );
    } else {
      const list = ALL_HATS.filter((x) => prof.hats.includes(x.id));
      goods.replaceChildren(list.length ? h('div', { class: 'grid-items' }, ...list.map(card)) : h('div', { class: 'stall-empty' }, 'Você ainda não tem chapéus.', en('No hats yet — visit Nanda’s stall in the Praça (the square).')));
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
      { class: `panel stall-panel ${mode === 'shop' ? 'hat-stall' : 'wardrobe'}` },
      closeBtn(() => close()),
      h('div', { class: 'stall-head' }, h('h2', null, mode === 'shop' ? `Chapéus da ${seller}` : 'Meus chapéus'), wallet.el),
      en(mode === 'shop' ? (jo ? 'Jô’s beach rack: hats for the sun. Cosmetic only.' : 'Nanda’s hat stall — try one on! Cosmetic only; some are free.') : 'Your hats — wear one anywhere.'),
      mode === 'shop' ? rvPriceNote() : null,
      h('div', { class: 'shop' }, stallVitrine(canvas, nandaSays), goods),
    ),
    {
      onClose: () => {
        preview.stop();
        off();
      },
    },
  );
}

// ---------------------------------------------------------------- friends

export function openFriends(actions: { request: (id: string) => void; accept: (id: string) => void; decline: (id: string) => void; remove: (id: string) => void; hop: (roomId: RoomId, instanceId: string | null, ownerId?: string) => void; refresh: () => void; unblock: (id: string) => void }) {
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
            tierChip(f.nameplate ?? 'verde'),
            h('span', { style: 'color:var(--ink-soft);font-weight:700;font-size:.85em' }, f.online ? (f.roomName ?? 'online') : 'offline'),
            h('span', { class: 'spacer' }),
            f.online && f.room && f.room !== 'kitnet' ? h('button', { class: 'green', onclick: () => (actions.hop(f.room!, f.instanceId), close()) }, bi('Ir até', 'Join')) : '',
            h('button', { onclick: () => (actions.hop('kitnet', null, f.id), close()) }, bi('Visitar kitnet', 'Visit apt')),
            h('button', { class: 'ghost', onclick: () => actions.remove(f.id) }, bi('Remover', 'Remove')),
          ),
        ),
      ),
      game.blockedPeople.length ? h('div', { class: 'section-title' }, 'Bloqueados', en(' Blocked', true)) : '',
      h(
        'div',
        { class: 'list-rows', id: 'blocked-list' },
        ...game.blockedPeople.map((b) => h('div', { class: 'r' }, h('b', null, b.name), h('span', { class: 'spacer' }), h('button', { class: 'ghost', onclick: () => actions.unblock(b.id) }, bi('Desbloquear', 'Unblock')))),
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
            h('b', null, a.pub.name),
            tierChip(a.pub.nameplate ?? 'verde'),
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

export function openProfileCard(
  a: PublicAvatar,
  actions: { request: (id: string) => void; report: (id: string, reason: ReportReason) => void; block: (id: string, on: boolean) => void; wave: () => void },
) {
  const canvas = h('canvas', { style: 'width:168px;height:216px;image-rendering:pixelated' });
  const preview = mountCharPreview(canvas, () => ({ appearance: a.appearance, hat: a.hat, parrot: a.parrot }));
  const isFriend = game.profile?.friends.includes(a.id);
  const isBlocked = !!game.profile?.blocked?.includes(a.id);
  // Report asks why first (one tap per reason); the server attaches what this player actually said.
  const reasons = h(
    'div',
    { class: 'row report-reasons', id: 'report-reasons', style: 'display:none;justify-content:center;flex-wrap:wrap;margin-top:8px' },
    h('div', { style: 'width:100%;text-align:center;font-weight:700' }, 'Por quê?', en(' Why are you reporting?', true)),
    ...REPORT_REASONS.map((r) =>
      h('button', { class: 'ghost', 'data-reason': r, onclick: () => (actions.report(a.id, r), close()) }, bi(REPORT_REASON_LABELS[r].pt, REPORT_REASON_LABELS[r].en)),
    ),
  );
  const pronoun = { ele: 'ele', ela: 'ela', nome: 'só o nome' }[a.pronoun];
  const close = openModal(
    'profile',
    h(
      'div',
      { class: 'panel card-profile' },
      closeBtn(() => close()),
      canvas,
      h('h2', null, a.name),
      h('div', { class: 'row', style: 'justify-content:center' }, tierChip(a.nameplate ?? 'verde', { id: 'profile-plate' }), a.founder ? h('span', { class: 'wl-founder founder-chip', role: 'img', 'aria-label': `${FOUNDER_BADGE.pt} · ${FOUNDER_BADGE.en}`, title: `${FOUNDER_BADGE.pt} · ${FOUNDER_BADGE.en}` }) : null, h('span', { style: 'font-weight:700;color:var(--ink-soft)' }, `trate por: ${pronoun}`, en(` · call them: ${({ ele: 'he', ela: 'she', nome: 'name only' } as const)[a.pronoun]}`, true))),
      a.belt ? h('div', { class: 'row', style: 'justify-content:center;margin-top:8px' }, beltChip(a.belt)) : null,
      en(`${tierRule(a.nameplate ?? 'verde').en} nameplate: earned in the Escola by words mastered. Plates come from learning, never from money.`),
      h(
        'div',
        { class: 'row', style: 'justify-content:center;margin-top:12px' },
        h('button', { onclick: () => (actions.wave(), close()) }, bi('Acenar', 'Wave')),
        isFriend ? h('span', { class: 'feedback' }, 'Amigo') : h('button', { class: 'green', onclick: () => (actions.request(a.id), close()), id: 'btn-add-friend' }, bi('Adicionar amigo', 'Add friend')),
        h('button', { class: 'ghost', id: 'btn-report', onclick: () => (reasons.style.display = reasons.style.display === 'none' ? 'flex' : 'none') }, bi('Denunciar', 'Report')),
        h('button', { class: 'ghost', id: 'btn-block', onclick: () => (actions.block(a.id, !isBlocked), close()) }, isBlocked ? bi('Desbloquear', 'Unblock') : bi('Bloquear', 'Block')),
      ),
      reasons,
    ),
    { onClose: () => preview.stop() },
  );
}

// ---------------------------------------------------------------- kitnet decorator

export function buildDecorPanel(actions: { buy: (id: string) => void; rotate: (uid: string) => void; pickup: (uid: string) => void; exit: () => void; help: () => void }) {
  let tab: 'meus' | 'loja' = 'meus';
  // a tab switch is a 'decor' event too (the kitnet guide follows it)
  const setTab = (t: 'meus' | 'loja') => {
    tab = t;
    game.emit('decor');
  };
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
      h(
        'div',
        { class: 'row' },
        h('h3', null, 'Decorar a kitnet'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'decor-help', id: 'decor-help', onclick: actions.help, title: 'Como decorar? (How to decorate: show the guide again)', 'aria-label': 'Como decorar? (How to decorate)' }, '?'),
        h('button', { class: 'ghost', id: 'decor-exit', onclick: actions.exit, 'aria-label': 'Fechar (Close)' }, '✕'),
      ),
      en('Decorate: pick an item, then click a floor tile. R rotates.'),
      h('div', { class: 'tabs', style: 'margin-top:8px' }, h('button', { class: tab === 'meus' ? 'on' : '', onclick: () => setTab('meus'), id: 'tab-meus' }, bi('Meus móveis', 'My items')), h('button', { class: tab === 'loja' ? 'on' : '', onclick: () => setTab('loja'), id: 'tab-loja' }, bi('Atelier', 'Shop'))),
      selF && selDef
        ? h(
            'div',
            { class: 'hintbox', style: 'margin-top:8px' },
            h('b', null, selDef.pt),
            en(selDef.en),
            h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { onclick: () => actions.rotate(selF.uid), id: 'decor-rotate' }, bi('Girar', 'Rotate')), h('button', { onclick: () => actions.pickup(selF.uid) }, bi('Guardar', 'Pick up'))),
          )
        : game.placing
          ? h(
              'div',
              { class: 'hintbox', style: 'margin-top:8px' },
              `Colocando: ${furnitureById(game.placing.itemId)?.pt}`,
              en('Click a free floor tile. Press R to rotate, Esc to cancel.'),
              // the same turn as R, for a phone (no keyboard)
              h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { onclick: () => game.placing && ((game.placing.rot = game.placing.rot === 0 ? 1 : 0), game.emit('decor')), id: 'decor-rotate' }, bi('Girar', 'Rotate'))),
            )
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
                    game.emit('decor');
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
            rvPriceNote(),
            ...FURNITURE.filter((d) => !d.earned).map((d) =>
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
  return { render, tab: () => tab };
}
