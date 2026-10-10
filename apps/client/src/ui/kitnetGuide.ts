/**
 * The kitnet first-visit guide: the first time you walk into your own kitnet, a short, skippable checklist card walks you through Decorar
 * (open it, the Atelier, buy a piece with RV, Meus móveis, pick it up, put it down, rotate it, leave). The control each step needs pulses
 * and gets the game's bouncing pixel arrow; floor steps get the same arrow in the world (main.ts reads `kitnetWorldGuide`).
 *
 * Shown once per profile (localStorage, like the airport tutorial) and only while the free chair is not down yet, so returning players never
 * see it again; the Decorar panel's "?" replays it. Prices and RV are untouched: it only watches what the player does.
 * Needs_br: every Portuguese line here (and in kitnetGuideLogic.ts).
 */
import { furnitureById } from '@tudobem/shared';
import { game } from '../state';
import { h, en, ui } from './dom';
import { toast } from './hud';
import { COMPACT_QUERY, placeHud } from './hudLayout';
import type { Guide } from '../render/view';
import {
  KITNET_GUIDE_STEPS,
  NO_PROGRESS,
  boughtBetween,
  cheapestFurniture,
  kitnetGuideDone,
  kitnetGuideKey,
  kitnetGuideStep,
  pointerFor,
  shouldAutoStart,
  suggestPurchase,
  suggestTile,
  type KitnetGuideProgress,
  type KitnetGuideStepId,
  type KitnetGuideView,
} from './kitnetGuideLogic';

const GUIDE_ROTATION = { down: 0, up: 180, right: 270 } as const;

function seen(): boolean {
  const id = game.profile?.id;
  if (!id) return true;
  try {
    return localStorage.getItem(kitnetGuideKey(id)) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  const id = game.profile?.id;
  if (!id) return;
  try {
    localStorage.setItem(kitnetGuideKey(id), '1');
  } catch {
    /* private mode: it shows again next visit */
  }
}

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getBoundingClientRect().width > 0;

let api: { start: () => void; worldGuide: () => Guide | null; running: () => boolean } | null = null;

/** Whether the guide is on screen (main.ts skips its one-line "place your chair" toast then). */
export const kitnetGuideRunning = (): boolean => api?.running() ?? false;

/** Replay the guide (the Decorar panel's "?"). */
export const startKitnetGuide = (): void => api?.start();

/** The arrow in the room while a floor step is current (a free tile for the piece in hand, or the piece to rotate), else null. */
export const kitnetWorldGuide = (): Guide | null => api?.worldGuide() ?? null;

/** `tab` reads the Decorar panel's open tab; `onStep` runs when the step changes (main.ts moves the world arrow). */
export function mountKitnetGuide(opts: { tab: () => 'meus' | 'loja'; onStep: () => void }): void {
  let running = false;
  let progress: KitnetGuideProgress = { ...NO_PROGRESS };
  let step: KitnetGuideStepId | null = null;
  let worldKey = '';
  let lastBought: string | null = null;
  let placedUid: string | null = null;
  let prevProfile: { coins: number; furniture: Record<string, number> } | null = null;
  let prevRots = new Map<string, 0 | 1>();
  let pulsing: HTMLElement | null = null;
  let scrolledFor: KitnetGuideStepId | null = null;
  let timer = 0;

  const now = h('div', { class: 'aero-tut-now' });
  const extra = h('div', { class: 'kg-extra' });
  const list = h('ol', { class: 'aero-tut-list' });
  const skip = h('button', { type: 'button', class: 'ghost kg-skip', id: 'kitnet-guide-skip', onclick: () => finish(false) }, 'Pular', en(' skip', true));
  const head = h('div', { class: 'rtrack-head aero-tut-head kg-head' });
  const card = h('section', { class: 'rtrack aero-tut kg-card', id: 'kitnet-guide', role: 'region', 'aria-label': 'Como decorar a kitnet · How to decorate the kitnet', hidden: true }, head, now, extra, list);
  const arrow = h('div', { class: 'wl-guide-arrow' });
  const pointer = h('div', { class: 'kg-pointer', 'aria-hidden': 'true', hidden: true }, arrow);
  ui().append(card, pointer);

  const view = (): KitnetGuideView => ({ editMode: game.editMode, tab: opts.tab(), placing: !!game.placing });

  const snapshot = () => {
    const p = game.profile;
    prevProfile = p ? { coins: p.coins, furniture: { ...p.furniture } } : null;
    prevRots = new Map(game.furniture.map((f) => [f.uid, f.rot]));
  };

  function start(): void {
    if (!game.isOwnKitnet) return;
    running = true;
    progress = { ...NO_PROGRESS };
    step = null;
    worldKey = '';
    lastBought = null;
    placedUid = null;
    scrolledFor = null;
    snapshot();
    window.clearInterval(timer);
    // the arrow follows its button (the drawer opening, the panel scrolling, a resize): a cheap check a few times a second
    timer = window.setInterval(place, 250);
    render();
  }

  function stop(): void {
    running = false;
    window.clearInterval(timer);
    timer = 0;
    card.hidden = true;
    pointer.hidden = true;
    pulse(null);
    document.body.classList.remove('kitnet-guide-on');
    placeHud();
    opts.onStep();
  }

  function finish(completed: boolean): void {
    markSeen();
    stop();
    if (completed) toast('reward', 'Pronto! A kitnet é sua: decore quando quiser.', 'Done! The kitnet is yours: decorate whenever you like.');
  }

  function pulse(el: HTMLElement | null): void {
    if (pulsing === el) return;
    pulsing?.classList.remove('tut-pulse');
    pulsing = el;
    el?.classList.add('tut-pulse');
  }

  /** The control the current step needs, or null for the floor steps (the world arrow does those). */
  function target(): HTMLElement | null {
    const q = (sel: string) => document.querySelector<HTMLElement>(sel);
    switch (step) {
      case 'abrir': {
        const btn = q('#btn-decor');
        return visible(btn) ? btn : q('#btn-burger');
      }
      case 'loja':
        return q('#tab-loja');
      case 'comprar': {
        const id = suggestPurchase(game.profile?.coins ?? 0);
        return id ? q(`[data-buy-furniture="${id}"]`) : null;
      }
      case 'meus':
        return q('#tab-meus');
      case 'escolher':
        return (lastBought && q(`[data-furniture="${lastBought}"]`)) || q('[data-furniture]');
      case 'girar':
        // the panel's Girar: for the selected piece, or the one still in hand
        return q('#decor-rotate');
      case 'sair':
        return q('#decor-exit');
      default:
        return null;
    }
  }

  /** Put the arrow on the current control (or hide it); on a phone the card hangs under the pills (the cartela, the mission). */
  function place(): void {
    if (!running) return;
    if (window.matchMedia(COMPACT_QUERY).matches) {
      const under = ['hud-top', 'cartela-pill', 'mission-pill'].map((id) => document.getElementById(id)?.getBoundingClientRect()).filter((r) => r && r.height > 0);
      const top = Math.round(Math.max(0, ...under.map((r) => r!.bottom)) + 8);
      if (card.style.top !== `${top}px`) card.style.top = `${top}px`;
    } else if (card.style.top) card.style.top = '';
    const el = target();
    pulse(el);
    if (!visible(el)) {
      pointer.hidden = true;
      return;
    }
    if (scrolledFor !== step) {
      scrolledFor = step;
      if (el.closest('.decor')) el.scrollIntoView({ block: 'nearest' });
    }
    const cs = getComputedStyle(document.documentElement);
    const aw = parseFloat(cs.getPropertyValue('--wl-arrow-w')) || 48;
    const ah = parseFloat(cs.getPropertyValue('--wl-arrow-h')) || 60;
    const r = el.getBoundingClientRect();
    const p = pointerFor(r, { w: window.innerWidth, h: window.innerHeight }, ah);
    pointer.hidden = false;
    pointer.style.transform = `translate(${p.x}px, ${p.y}px)`;
    arrow.style.left = `${-aw / 2}px`;
    arrow.style.top = `${-ah}px`;
    arrow.style.transform = `rotate(${GUIDE_ROTATION[p.dir]}deg)`;
  }

  function render(): void {
    if (!running) return;
    if (!game.isOwnKitnet) return stop();
    const v = view();
    const next = kitnetGuideStep(v, progress);
    if (next === null) return finish(true);
    // the world arrow moves on a new step, and on "girar" when the panel's Girar comes or goes (a piece selected or in hand)
    const key = `${next}:${!!document.getElementById('decor-rotate')}`;
    const changed = key !== worldKey;
    worldKey = key;
    step = next;
    const done = kitnetGuideDone(v, progress);
    const s = KITNET_GUIDE_STEPS.find((x) => x.id === next)!;
    const n = KITNET_GUIDE_STEPS.indexOf(s) + 1;
    document.body.classList.add('kitnet-guide-on');
    card.hidden = false;
    head.replaceChildren(
      h('span', { class: 'aero-tut-plane kg-icon', 'aria-hidden': 'true' }, '✦'),
      h('b', null, 'Como decorar', en(' · How to decorate', true)),
      h('small', null, `${done.size}/${KITNET_GUIDE_STEPS.length}`),
      h('span', { class: 'spacer' }),
      skip,
    );
    now.replaceChildren(
      h('span', { class: 'aero-tut-n' }, String(n)),
      h('span', { class: 'aero-tut-text' }, h('b', { lang: 'pt-BR' }, s.pt), h('span', { class: 'aero-tut-how', lang: 'pt-BR' }, s.how.pt), en(s.how.en)),
    );
    extra.replaceChildren(...extras(next));
    list.replaceChildren(
      ...KITNET_GUIDE_STEPS.map((x, i) =>
        h('li', { class: done.has(x.id) ? 'done' : x.id === next ? 'current' : '', 'data-step': x.id }, h('span', { class: 'aero-tut-tick', 'aria-hidden': 'true' }, done.has(x.id) ? '✓' : String(i + 1)), h('span', { class: 'kg-step', title: x.en }, h('span', { lang: 'pt-BR' }, x.pt), en(x.en))),
      ),
    );
    placeHud();
    place();
    if (changed) opts.onStep();
  }

  /** The buy step when nothing in the Atelier is affordable yet: say so (the first-visit gift normally covers the chair). */
  function extras(id: KitnetGuideStepId): HTMLElement[] {
    const p = game.profile;
    if (id !== 'comprar' || !p || suggestPurchase(p.coins)) return [];
    const c = cheapestFurniture();
    return [
      h(
        'div',
        { class: 'kg-broke' },
        h('span', { lang: 'pt-BR' }, `Você tem ${p.coins} RV e o mais barato custa ${c.price}. Ganhe RV com os favores!`),
        en(`You have ${p.coins} RV and the cheapest piece costs ${c.price}. Earn RV doing favors (Favores)!`),
      ),
    ];
  }

  function worldGuide(): Guide | null {
    if (!running || !game.roomDef) return null;
    if (step === 'colocar') {
      const me = game.self;
      const t = suggestTile(game.roomDef, game.furniture, me ? [me.path.at(-1) ?? me.from] : []);
      return t ? { x: t.x, y: t.y, lift: 20, label: 'Coloque aqui', en: 'Place it here' } : null;
    }
    if (step === 'girar' && !document.getElementById('decor-rotate')) {
      const f = game.furniture.find((x) => x.uid === placedUid) ?? game.furniture.at(-1);
      const def = f ? furnitureById(f.itemId) : undefined;
      return f ? { x: f.x, y: f.y, lift: 36, label: `Clique: ${def?.pt ?? 'móvel'}`, en: `Click: ${def?.en ?? 'piece'}` } : null;
    }
    return null;
  }

  const onRoom = () => {
    if (running && !game.isOwnKitnet) return stop();
    if (!running && shouldAutoStart({ ownKitnet: game.isOwnKitnet, seen: seen(), placedChair: !!game.profile?.tutorial.cadeira })) start();
  };
  game.on('room', onRoom);
  game.on('profile', () => {
    const p = game.profile;
    if (running && p && prevProfile && boughtBetween(prevProfile, p)) {
      progress.bought = true;
      lastBought = Object.keys(p.furniture).find((k) => (p.furniture[k] ?? 0) > (prevProfile!.furniture[k] ?? 0)) ?? lastBought;
    }
    if (p) prevProfile = { coins: p.coins, furniture: { ...p.furniture } };
    render();
  });
  game.on('decor', () => {
    if (running) {
      for (const f of game.furniture) {
        const was = prevRots.get(f.uid);
        if (was === undefined) {
          progress.placed = true;
          placedUid = f.uid;
        } else if (was !== f.rot) progress.rotated = true;
      }
      // turning the piece in hand (R) before putting it down counts as rotating it
      if (game.placing?.rot === 1) progress.rotated = true;
      prevRots = new Map(game.furniture.map((f) => [f.uid, f.rot]));
    }
    render();
  });
  game.on('hud', render);

  api = { start, worldGuide, running: () => running };
  // the game can start in the kitnet (a reload there): the first room message came before this mounted
  onRoom();
}
