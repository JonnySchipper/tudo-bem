/**
 * The airport hall behind the arrival card: a postcard the player can photograph and read, the Chegada area of the language diary.
 * It is not a room. The camera is open, every shot is free and keeps no picture, and the only things that can be photographed are
 * the fourteen objects in it (the server checks, and refuses anything else). The signs are read with a click.
 * Anybody can come back to it from the Chegada area of the diary.
 */
import { ARRIVAL_CARD, ARRIVAL_SIGNS, type ClientMsg } from '@tudobem/shared';
import { game } from '../state';
import { h, en, ui } from './dom';
import { cameraFrameAt, shutter, syncCameraBanner, syncCameraFrame } from './diaryPanel';
import { HALL_ART, HALL_PAL } from './arrivalHallArt';
import { HALL_H, HALL_OBJECTS, HALL_SIGN_PLACES, HALL_W, outlined } from './arrivalHallLayout';
import { pixelSvg } from './pixelSvg';

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

let open = false;
let lastAim = { x: 0, y: 0 };

const overlap = (a: { x: number; y: number; w: number; h: number }, b: DOMRect) => a.x < b.right && a.x + a.w > b.left && a.y < b.bottom && a.y + a.h > b.top;

export const isArrivalHallOpen = (): boolean => open;

let afterClose: (() => void) | null = null;

export function closeArrivalHall(): void {
  if (!open) return;
  open = false;
  document.getElementById('arrival-hall')?.remove();
  game.cameraOn = false;
  syncCameraBanner();
  if (!document.querySelector('[data-modal]')) game.modalOpen = false;
  game.emit('hud');
  const then = afterClose;
  afterClose = null;
  then?.();
}

/** Open the hall with the camera ready. `send` is the page's way to the server; `onClose` runs once when the player leaves. */
export function openArrivalHall(send: (m: ClientMsg) => void, onClose?: () => void): void {
  if (open || !game.profile?.hasCamera) return;
  open = true;
  afterClose = onClose ?? null;
  game.modalOpen = true;
  game.cameraOn = true;

  const scene = h(
    'div',
    { class: 'hall-scene' },
    h('i', { class: 'hall-sky', 'aria-hidden': 'true' }),
    h('i', { class: 'hall-ground', 'aria-hidden': 'true' }),
    h('i', { class: 'hall-wall', 'aria-hidden': 'true' }),
    h('i', { class: 'hall-floor', 'aria-hidden': 'true' }),
    h('i', { class: 'hall-booth', 'aria-hidden': 'true' }),
    ...HALL_OBJECTS.map((o) => {
      const rows = outlined(HALL_ART[o.id.slice(5)]!);
      const w = rows[0]!.length;
      return h(
        'div',
        { class: 'hall-obj', 'data-hall': o.id, style: `left:${pct(o.x, HALL_W)};top:${pct(o.y, HALL_H)};width:${pct(w * o.k, HALL_W)};height:${pct(rows.length * o.k, HALL_H)}` },
        pixelSvg(rows, HALL_PAL, 'hall-art'),
      );
    }),
    ...HALL_SIGN_PLACES.map((p) => {
      const sign = ARRIVAL_SIGNS.find((x) => x.id === p.id)!;
      return h(
        'button',
        {
          type: 'button',
          class: `hall-sign tone-${p.tone}`,
          'data-sign': p.id,
          style: `left:${pct(p.x, HALL_W)};top:${pct(p.y, HALL_H)}`,
          onclick: (e: Event) => {
            // reading is not a shot
            e.stopPropagation();
            send({ t: 'diary', action: 'sign', anchor: p.id });
          },
        },
        h('span', { lang: 'pt-BR' }, sign.pt),
      );
    }),
  );

  const shoot = (x: number, y: number) => {
    const frame = cameraFrameAt(x, y);
    const aim = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
    const seen = [...scene.querySelectorAll<HTMLElement>('[data-hall]')]
      .map((el) => ({ id: el.dataset.hall!, r: el.getBoundingClientRect() }))
      .filter((e) => overlap(frame, e.r))
      .map((e) => ({ id: e.id, d: Math.hypot(e.r.left + e.r.width / 2 - aim.x, e.r.top + e.r.height / 2 - aim.y) }))
      .sort((a, b) => a.d - b.d);
    // an empty frame is not a shot
    if (!seen.length) return;
    syncCameraFrame(x, y);
    shutter(frame, undefined);
    send({ t: 'diary', action: 'photo', anchors: seen.map((e) => e.id), hall: true });
  };

  const root = h(
    'div',
    { id: 'arrival-hall', role: 'dialog', 'aria-label': ARRIVAL_CARD.kicker.pt, 'data-modal': 'arrival-hall' },
    h(
      'div',
      { class: 'hall-card' },
      h('p', { class: 'hall-kicker' }, ARRIVAL_CARD.kicker.pt, en(ARRIVAL_CARD.kicker.en)),
      scene,
      h('p', { class: 'hall-hint' }, ARRIVAL_CARD.diary.pt, en(ARRIVAL_CARD.diary.en)),
      h(
        'div',
        { class: 'hall-actions' },
        // needs_br: true (button label)
        h('button', { type: 'button', class: 'primary', id: 'hall-done', onclick: (e: Event) => { e.stopPropagation(); closeArrivalHall(); } }, 'Ir para a praça', en('Go to the square')),
      ),
    ),
  );
  root.addEventListener('pointermove', (e) => {
    lastAim = { x: e.clientX, y: e.clientY };
    syncCameraFrame(e.clientX, e.clientY);
  });
  root.addEventListener('click', (e) => shoot(e.clientX, e.clientY));
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === root) shoot(lastAim.x, lastAim.y);
  });
  ui().append(root);
  lastAim = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  syncCameraFrame(lastAim.x, lastAim.y);
}
