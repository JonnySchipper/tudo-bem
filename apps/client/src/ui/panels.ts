import {
  FURNITURE,
  HATS,
  MISSION_COPY,
  MISSION_REWARD,
  MISSION_STEPS,
  MG_ITEMS,
  MG_MAX_TRAY,
  MG_MODS,
  mgModById,
  ROOMS,
  furnitureById,
  hatById,
  type Bilingual,
  type MgServerMsg,
  type NpcDef,
  type PublicAvatar,
  type RoomId,
  type SceneView,
  type Tray,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en, bi, ui, clear } from './dom';
import { drawParrot, renderAvatarPreview } from '../render/avatar';
import { foodIcon, hatIcon } from '../render/icons';
import { furnitureIcon } from '../render/props';
import { speak } from '../audio';
import { icon } from '../art/ui';

// ---------------------------------------------------------------- modal base

let current: { el: HTMLElement; close: () => void; id: string } | null = null;

export function closeModal() {
  current?.close();
}

export function modalId() {
  return current?.id ?? null;
}

export function openModal(id: string, content: HTMLElement, opts: { onClose?: () => void; clear?: boolean; dismissable?: boolean } = {}) {
  closeModal();
  const backdrop = h('div', { class: `backdrop ${opts.clear ? 'clear' : ''}`, 'data-modal': id });
  backdrop.append(content);
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (current?.el === backdrop) current = null;
    game.modalOpen = !!current;
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && opts.dismissable !== false) close();
  };
  document.addEventListener('keydown', onKey);
  if (opts.dismissable !== false && !opts.clear) backdrop.addEventListener('mousedown', (e) => e.target === backdrop && close());
  ui().append(backdrop);
  current = { el: backdrop, close, id };
  game.modalOpen = true;
  return close;
}

const closeBtn = (close: () => void) => h('button', { class: 'close ghost', onclick: close, 'aria-label': 'Fechar' }, '✕');

function portrait(npc: NpcDef | null) {
  const c = h('canvas', { width: 96, height: 110, style: 'width:96px;height:110px' });
  let raf = 0;
  const loop = (ts: number) => {
    if (!c.isConnected && ts > 1000) return cancelAnimationFrame(raf);
    if (npc) renderAvatarPreview(c, npc.appearance, npc.hat, false, ts / 1000, { scale: 2.35, footY: 236, npc: npc.id });
    else {
      const ctx = c.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      c.width = 96 * dpr;
      c.height = 110 * dpr;
      ctx.setTransform(dpr * 3.2, 0, 0, dpr * 3.2, 48 * dpr, 88 * dpr);
      drawParrot(ctx, -2, 0, ts / 1000, true);
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return h('div', { class: 'portrait' }, c);
}

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
  /** Free-typed reply (scored with accept-list rules). */
  onType?: (text: string) => void;
}

let dialogueEl: HTMLElement | null = null;
let dialogueKey: ((e: KeyboardEvent) => void) | null = null;

export function closeDialogue() {
  dialogueEl?.remove();
  dialogueEl = null;
  if (dialogueKey) document.removeEventListener('keydown', dialogueKey);
  dialogueKey = null;
  game.modalOpen = !!current;
}

export function showDialogue(o: DialogueOpts) {
  const continued = !!dialogueEl;
  closeDialogue();
  const listen = h('button', { class: 'speak-btn', onclick: () => speak(o.line.pt, { force: true }), title: 'Ouvir / Listen' }, '🔊 Ouvir');
  const chips = o.chips.map((c, i) =>
    h(
      'button',
      { onclick: () => o.onChoose(i), 'data-chip': String(i) },
      h('span', { class: 'num' }, String(i + 1)),
      h('span', null, h('span', { class: 'pt' }, c.pt), en(c.en, true)),
    ),
  );
  dialogueEl = h(
    'div',
    { class: `dialogue ${continued ? 'continued' : ''}`, role: 'dialog', 'aria-label': o.speaker, id: 'dialogue' },
    portrait(o.npc),
    h(
      'div',
      null,
      h('div', { class: 'row' }, h('div', { class: 'speaker' }, o.speaker, o.role ? h('small', null, o.role) : null), listen, h('span', { class: 'spacer' }), h('button', { class: 'ghost', onclick: o.onClose }, '✕')),
      o.said ? h('div', { class: 'you-said' }, `Você: “${o.said.pt}”`) : null,
      o.feedback ? h('span', { class: `feedback s${o.feedback.score}` }, `${o.feedback.text.pt} · ${o.feedback.text.en}`) : null,
      h('div', { class: 'line' }, o.line.pt),
      en(o.line.en),
      chips.length ? h('div', { class: 'reply-chips' }, ...chips) : null,
      chips.length && o.onType ? typedReply(o.onType) : null,
      o.footer ?? null,
    ),
  );
  dialogueKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const n = Number(e.key);
    if (n >= 1 && n <= o.chips.length) o.onChoose(n - 1);
    if (e.key === 'Escape') o.onClose();
  };
  document.addEventListener('keydown', dialogueKey);
  ui().append(dialogueEl);
  game.modalOpen = true;
}

function typedReply(onType: (text: string) => void) {
  const input = h('input', { type: 'text', maxLength: 140, placeholder: 'Ou escreva sua resposta… (or type your reply)', 'aria-label': 'Resposta', id: 'scene-type' });
  const send = () => {
    const t = input.value.trim();
    if (t) onType(t);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') send();
  });
  return h('div', { class: 'typed-reply' }, input, h('button', { class: 'primary', onclick: send, id: 'scene-type-send' }, 'Responder'));
}

export function showScene(view: SceneView, extra: { said?: Bilingual; feedback?: Bilingual; score?: number; payout?: number }, onChoose: (i: number) => void, onClose: () => void, onPlay: () => void, onType?: (text: string) => void) {
  const carlos = ROOMS.padaria.npcs.find((n) => n.id === 'carlos')!;
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
    speaker: 'Seu Carlos',
    role: 'Padeiro',
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

export function showJulia() {
  const julia = ROOMS.praca.npcs.find((n) => n.id === 'julia')!;
  const name = game.profile?.name ?? '';
  const root = (line: Bilingual) => {
    speak(line.pt);
    showDialogue({
      npc: julia,
      speaker: 'Júlia',
      role: 'Guia da praça',
      line,
      chips: [...JULIA_TREE.map((j) => j.q), { pt: 'Tchau, Júlia!', en: 'Bye, Júlia!' }],
      onChoose: (i) => (i < JULIA_TREE.length ? root(JULIA_TREE[i].a) : closeDialogue()),
      onClose: closeDialogue,
    });
  };
  root({ pt: `Oi, ${name}! Eu sou a Júlia, guia da praça. Posso te ajudar?`, en: 'Hi! I’m Júlia, the square’s guide. Can I help you?' });
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
  const owned = game.profile?.parrotOwned;
  const line: Bilingual = owned
    ? { pt: 'Seu papagaio já está com você. Ele adora sussurrar palavras!', en: 'Your parrot is already with you. It loves whispering words!' }
    : {
        pt: 'Um papagaio verde pousou aqui. Ele quer te acompanhar! Ele não traduz, mas sussurra palavras que você está estudando.',
        en: 'A green parrot landed here. It wants to come along! It doesn’t translate, but it whispers words you’re studying.',
      };
  showDialogue({
    npc: null,
    speaker: 'Poleiro do papagaio',
    line,
    chips: owned ? [{ pt: 'Valeu, papagaio!', en: 'Thanks, parrot!' }] : [{ pt: 'Quero adotar! (grátis)', en: 'I want to adopt it! (free)' }, { pt: 'Agora não.', en: 'Not now.' }],
    onChoose: (i) => {
      if (!owned && i === 0) adopt();
      closeDialogue();
    },
    onClose: closeDialogue,
  });
}

// ---------------------------------------------------------------- hat shop / wardrobe

export function openHatShop(mode: 'shop' | 'wardrobe', actions: { buy: (id: string) => void; equip: (id: string | null) => void }) {
  const p = game.profile!;
  let sel = p.hat ?? (mode === 'shop' ? HATS[0].id : null);
  const canvas = h('canvas', { width: 180, height: 230, style: 'width:180px;height:230px' });
  const nandaSays = h('div', { class: 'nanda-says' });
  const grid = h('div', { class: 'grid-items' });
  let raf = 0;
  const loop = (ts: number) => {
    renderAvatarPreview(canvas, p.appearance, sel, p.parrotOwned && p.parrotEquipped, ts / 1000, { scale: 2.05 });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const render = () => {
    const prof = game.profile!;
    const hat = hatById(sel);
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
          h('img', { src: hatIcon(hatDef.id), alt: hatDef.pt }),
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
        cancelAnimationFrame(raf);
        off();
      },
    },
  );
  game.on('profile', () => {
    const el = document.getElementById('shop-coins');
    if (el && game.profile) el.textContent = `${game.profile.coins} RV`;
  });
}

// ---------------------------------------------------------------- Me vê um…

export class MinigameUI {
  private tray: Tray = {};
  private mods = new Set<string>();
  private modsEl = h('div', { class: 'mods', id: 'mg-mods' });
  private order: Extract<MgServerMsg, { phase: 'order' }> | null = null;
  private orderAt = 0;
  private raf = 0;
  private locked = false;
  private close: () => void;
  private ticket = h('div', { class: 'ticket', id: 'mg-ticket' });
  private timer = h('div', { class: 'timer' }, h('div'));
  private trayEl = h('div', { class: 'tray', id: 'mg-tray' });
  private carlos = h('div', { class: 'carlos-says' });
  private score = h('div', { class: 'score' });
  private body: HTMLElement;
  private panel: HTMLElement;
  private timedOut = false;
  /** Don't re-send a timeout the server just rejected as early — it would tight-loop. */
  private timeoutNotBefore = 0;

  constructor(private actions: { submit: (t: Tray, mods: string[]) => void; timeout: () => void; quit: () => void; again: () => void }) {
    const shelves = h('div', { class: 'shelves', id: 'mg-shelves' });
    MG_ITEMS.forEach((item, i) => {
      const keyLabel = i < 9 ? String(i + 1) : ['0', '-', '='][i - 9] ?? '';
      shelves.append(
        h(
          'button',
          { onclick: () => this.add(item.id), 'data-item': item.id, title: item.card.gloss_en },
          h('kbd', null, keyLabel),
          h('img', { src: foodIcon(item.id), alt: '' }),
          h('span', { class: 'pt' }, item.card.form),
          en(item.card.gloss_en),
        ),
      );
    });
    this.body = h(
      'div',
      { class: 'mg-body' },
      shelves,
      h(
        'div',
        { class: 'side' },
        this.carlos,
        h('div', null, h('b', null, 'Bandeja'), en('Tray — click an item to remove it', true)),
        this.trayEl,
        this.modsEl,
        h('div', { class: 'row' }, h('button', { onclick: () => this.clearTray() }, bi('Limpar', 'Clear')), h('span', { class: 'spacer' }), h('button', { class: 'green', onclick: () => this.submit(), id: 'mg-submit' }, bi('Entregar ✓', 'Serve (Enter)'))),
        this.score,
      ),
    );
    this.panel = h(
      'div',
      { class: 'panel mg', id: 'minigame' },
      h(
        'div',
        { class: 'mg-head' },
        h('h2', null, 'Me vê um…'),
        en('Read the order, fill the tray, serve it! Carlos repeats once if you miss.', true),
        h('span', { class: 'spacer' }),
        h('button', { class: 'ghost', onclick: () => this.quit() }, '✕'),
      ),
      h('div', { class: 'rail' }, this.ticket, this.timer),
      this.body,
    );
    this.close = openModal('minigame', this.panel, { dismissable: false, onClose: () => this.cleanup() });
    document.addEventListener('keydown', this.onKey);
    this.renderTray();
    this.carlos.replaceChildren(h('b', null, 'Seu Carlos: '), '“Chegou cliente! Presta atenção no pedido.”', en('A customer is here! Pay attention to the order.'));
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const idx = e.key === '0' ? 9 : e.key === '-' ? 10 : e.key === '=' ? 11 : Number(e.key) - 1;
    if (idx >= 0 && idx < MG_ITEMS.length && /^[0-9=-]$/.test(e.key)) this.add(MG_ITEMS[idx].id);
    if (e.key === 'Enter' && !e.repeat) this.submit();
    if (e.key === 'Backspace') this.clearTray();
  };

  private cleanup() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.onKey);
  }

  private add(id: string) {
    if (this.locked || !this.order) return;
    const total = Object.values(this.tray).reduce((a, b) => a + b, 0);
    if (total >= MG_MAX_TRAY) return;
    this.tray[id] = (this.tray[id] ?? 0) + 1;
    this.renderTray();
  }

  private clearTray() {
    if (this.locked) return;
    this.tray = {};
    this.mods.clear();
    this.renderTray();
  }

  private toggleMod(id: string) {
    if (this.locked || !this.order) return;
    const mod = mgModById(id)!;
    if (this.mods.has(id)) this.mods.delete(id);
    else {
      if (mod.group === 'where') for (const m of MG_MODS) if (m.group === 'where') this.mods.delete(m.id);
      this.mods.add(id);
    }
    this.renderMods();
  }

  private renderMods() {
    this.modsEl.replaceChildren(
      ...MG_MODS.map((m) =>
        h('button', { class: this.mods.has(m.id) ? 'on' : '', onclick: () => this.toggleMod(m.id), 'data-mod': m.id, 'aria-pressed': String(this.mods.has(m.id)) }, h('span', { class: 'pt' }, m.pt), en(m.en, true)),
      ),
    );
  }

  private renderTray() {
    const entries = Object.entries(this.tray).filter(([, n]) => n > 0);
    if (!entries.length) {
      this.trayEl.replaceChildren(h('div', { class: 'empty' }, 'Bandeja vazia', en('Empty tray', true)));
      return;
    }
    this.trayEl.replaceChildren(
      ...entries.map(([id, n]) =>
        h(
          'button',
          {
            onclick: () => {
              if (this.locked || !this.order) return;
              this.tray[id]--;
              if (this.tray[id] <= 0) delete this.tray[id];
              this.renderTray();
            },
            title: 'Tirar / remove',
          },
          h('img', { src: foodIcon(id, 48), alt: id }),
          h('span', null, `×${n}`),
        ),
      ),
    );
  }

  private submit() {
    if (this.locked || !this.order) return;
    this.locked = true;
    this.actions.submit({ ...this.tray }, [...this.mods]);
  }

  private quit() {
    this.actions.quit();
    this.close();
  }

  private tick = () => {
    if (!this.order) return;
    const left = Math.max(0, this.order.timeMs - (performance.now() - this.orderAt));
    const f = left / this.order.timeMs;
    const bar = this.timer.firstElementChild as HTMLElement;
    bar.style.transform = `scaleX(${f})`;
    this.timer.classList.toggle('low', f < 0.25);
    if (left <= 0 && !this.locked && !this.timedOut && performance.now() >= this.timeoutNotBefore) {
      this.timedOut = true;
      this.locked = true;
      this.actions.timeout();
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  handle(m: MgServerMsg) {
    if (m.phase === 'order') {
      // Server echo of the ticket already on the rail (early timeout, or an accidental second submit).
      // Unlock without wiping a partial tray or restarting the clock.
      if (m.resync && this.order && this.order.round === m.round && this.order.pt === m.pt) {
        this.order = m;
        this.locked = false;
        this.timedOut = false;
        this.timeoutNotBefore = performance.now() + 1000;
        return;
      }
      const keepTray = !!m.repeat && this.order?.round === m.round && this.order.pt === m.pt;
      this.order = m;
      this.orderAt = performance.now();
      this.locked = false;
      this.timedOut = false;
      this.timeoutNotBefore = 0;
      if (!keepTray) {
        this.tray = {};
        this.mods.clear();
      }
      this.renderTray();
      this.renderMods();
      this.ticket.className = `ticket ${m.repeat ? 'repeat' : ''}`;
      this.ticket.dataset.round = String(m.round);
      this.ticket.dataset.repeat = m.repeat ? '1' : '0';
      this.ticket.replaceChildren(
        h('div', { class: 'row' }, h('span', { class: 'customer' }, `Pedido ${m.round + 1}/${m.rounds} · ${m.customer}${m.repeat ? ' · de novo, devagar' : ''}`), h('span', { class: 'spacer' }), h('button', { class: 'speak-btn', onclick: () => speak(m.pt, { force: true, rate: 0.8 }) }, '🔊 Ouvir')),
        h('div', { class: 'order', id: 'mg-order' }, m.pt),
        en(m.en),
      );
      speak(m.pt, { rate: m.repeat ? 0.75 : 0.92 });
      this.score.replaceChildren(h('span', null, `Pontos: ${m.points}`), m.streak >= 2 ? h('span', { class: 'combo' }, `Combo ×${m.streak}!`) : h('span'));
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.tick);
    } else if (m.phase === 'result') {
      this.carlos.replaceChildren(h('b', null, 'Seu Carlos: '), `“${m.carlos.pt}”`, en(m.carlos.en));
      if (m.outcome !== 'repita') this.locked = true;
      this.score.replaceChildren(h('span', null, `Pontos: ${m.points}`), m.streak >= 2 ? h('span', { class: 'combo' }, `Combo ×${m.streak}!`) : h('span'));
      if (m.expected) {
        this.carlos.append(
          h(
            'div',
            { style: 'margin-top:6px;font-size:.85em' },
            'Era: ',
            ...m.expected.map((l) => h('span', { style: 'margin-right:6px' }, `${l.qty}× `, h('img', { src: foodIcon(l.itemId, 22), style: 'width:22px;height:22px;vertical-align:middle' }))),
            ...(m.expectedMods ?? []).map((id) => h('span', { class: 'feedback', style: 'margin-left:4px' }, mgModById(id)?.pt ?? id)),
          ),
        );
      }
    } else {
      cancelAnimationFrame(this.raf);
      this.order = null;
      this.ticket.replaceChildren(h('div', { class: 'order' }, 'Fim do turno!'), en('Shift over!'));
      this.body.replaceChildren(
        h(
          'div',
          { class: 'mg-end', style: 'grid-column:1/-1', id: 'mg-end' },
          h('div', { class: 'big' }, `+${m.coins} RV`),
          h('p', null, h('b', null, `${m.perfect}/${m.rounds} pedidos perfeitos · ${m.points} pontos`), en(`${m.perfect} of ${m.rounds} perfect orders`)),
          h('p', null, h('b', null, 'Seu Carlos: '), `“${m.carlos.pt}”`, en(m.carlos.en)),
          h('div', { class: 'row', style: 'justify-content:center' }, h('button', { onclick: () => this.close() }, bi('Sair', 'Leave')), h('button', { class: 'primary', onclick: () => (this.close(), this.actions.again()) }, bi('Jogar de novo', 'Play again'))),
        ),
      );
      speak(m.carlos.pt);
    }
  }
}

// ---------------------------------------------------------------- map

export function openMap(go: (room: RoomId) => void) {
  const card = (room: RoomId | null, pt: string, enText: string, bg: string, locked = false, light = false) =>
    h(
      'button',
      { class: `map-card ${locked ? 'locked' : ''} ${light ? 'light' : ''}`, style: `background:${bg}`, disabled: locked, onclick: () => room && (go(room), close()), 'data-room': room ?? '' },
      h('div', null, h('b', null, pt), en(enText)),
      h('div', null, h('span', { class: 'linecolor' }), locked ? h('span', { style: 'margin-left:8px;font-weight:800' }, 'Em breve') : null),
    );
  const close = openModal(
    'map',
    h(
      'div',
      { class: 'panel' },
      closeBtn(() => close()),
      h('h2', null, 'São Paulo · Bairro Ipê'),
      en('Fast travel is free between rooms you know.'),
      h(
        'div',
        { class: 'map-grid' },
        card('praca', 'Praça Central', 'Central Square — hang out, hats, parrot', 'linear-gradient(135deg,#e5572f,#f2c230)'),
        card('padaria', 'Padaria do Seu Carlos', 'Bakery — breakfast + “Me vê um…”', 'linear-gradient(135deg,#b5452e,#e8a94f)'),
        card('kitnet', 'Minha kitnet', 'My studio apartment — decorate', 'linear-gradient(135deg,#F5E6D3 45%,#A8C5D4)', false, true),
        card(null, 'Feira', 'Street market (Phase 1)', '', true),
        card(null, 'Estação de Metrô', 'Subway (Phase 1)', '', true),
        card(null, 'Praia', 'Beach day trip (Phase 2)', '', true),
      ),
    ),
  );
}

// ---------------------------------------------------------------- friends

export function openFriends(actions: { request: (id: string) => void; accept: (id: string) => void; decline: (id: string) => void; remove: (id: string) => void; hop: (roomId: RoomId, instanceId: string | null, ownerId?: string) => void; refresh: () => void }) {
  const body = h('div');
  const render = () => {
    const others = [...game.avatars.values()].filter((a) => a.pub.id !== game.room?.selfId && !a.pub.cpu);
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
  const canvas = h('canvas', { width: 160, height: 200, style: 'width:160px;height:200px' });
  let raf = 0;
  const loop = (ts: number) => {
    renderAvatarPreview(canvas, a.appearance, a.hat, a.parrot, ts / 1000, { scale: 1.8 });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
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
      en('Verde plate: tourist level — sees English glosses. Plates come from learning, never from money.'),
      h(
        'div',
        { class: 'row', style: 'justify-content:center;margin-top:12px' },
        h('button', { onclick: () => (actions.wave(), close()) }, bi('Acenar', 'Wave')),
        isFriend ? h('span', { class: 'feedback' }, 'Amigo') : h('button', { class: 'green', onclick: () => (actions.request(a.id), close()), id: 'btn-add-friend' }, bi('Adicionar amigo', 'Add friend')),
        h('button', { class: 'ghost', onclick: () => (actions.report(a.id), close()) }, bi('Denunciar', 'Report')),
      ),
    ),
    { onClose: () => cancelAnimationFrame(raf) },
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
                h('img', { src: furnitureIcon(id, 40), alt: '' }),
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
                h('img', { src: furnitureIcon(d.id, 40), alt: '' }),
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
