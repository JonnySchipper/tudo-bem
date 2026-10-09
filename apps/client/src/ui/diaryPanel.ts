/**
 * Camera viewfinder and the moment a photo teaches a new word.
 * The diary itself is the Caderno panel.
 *
 * A click is a shot the moment it happens: the blades close over the frame, a white flash, the shutter sound, and a print slides out
 * with the picture on it. The server answers with what the print says (a new word, a word already in the diary, or just "Foto guardada.").
 * Then the print flies into the Diário button. None of these layers takes the pointer, so the next click is the next shot.
 */
import { PHOTO_MAX_CHARS, pickPhotoUrl } from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { ambience } from '../ambience';
import { WordQueue, cardMs, momentsOfShot, type QueuedWord, type WordMoment } from './diaryWordQueue';
import { flyWord } from './wordFlight';
import { miniBook, revealJournal, wantsReveal } from './journalReveal';

export const FRAME_W = 220;
export const FRAME_H = 148;

export function cameraFrameAt(x: number, y: number) {
  return { x: x - FRAME_W / 2, y: y - FRAME_H / 2, w: FRAME_W, h: FRAME_H };
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** The rectangle that follows the pointer while the camera is open. */
export function syncCameraFrame(x?: number, y?: number) {
  let el = document.getElementById('camera-frame');
  let shade = document.getElementById('camera-shade');
  if (!game.cameraOn || !game.profile?.hasCamera) {
    el?.remove();
    shade?.remove();
    return;
  }
  if (!shade) {
    // the world outside the viewfinder dims; the frame is a hole in this sheet (one huge box-shadow does not paint in Chrome)
    shade = h('div', { id: 'camera-shade', 'aria-hidden': 'true' });
    document.getElementById('ui')?.append(shade);
  }
  if (!el) {
    el = h(
      'div',
      { id: 'camera-frame', 'aria-hidden': 'true' },
      h('i', { class: 'cf-corner tl' }),
      h('i', { class: 'cf-corner tr' }),
      h('i', { class: 'cf-corner bl' }),
      h('i', { class: 'cf-corner br' }),
      h('i', { class: 'cf-reticle' }),
      h('i', { class: 'cf-blade top' }),
      h('i', { class: 'cf-blade bottom' }),
      h('span', { id: 'camera-film' }),
    );
    document.getElementById('ui')?.append(el);
  }
  if (x != null && y != null) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const f = cameraFrameAt(x, y);
    const [l, t, r, b] = [f.x, f.y, f.x + f.w, f.y + f.h].map((v) => `${Math.round(v)}px`);
    shade.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l} ${t}, ${r} ${t}, ${r} ${b}, ${l} ${b}, ${l} ${t})`;
  }
  const n = game.profile.film ?? 0;
  const film = document.getElementById('camera-film');
  if (film) film.textContent = n === 1 ? '1 filme' : `${n} filmes`;
  el.classList.toggle('empty', n < 1);
}

/** The frame shakes red when there is no film left (the toast says why). */
export function shutterJam() {
  const el = document.getElementById('camera-frame');
  if (!el) return;
  el.classList.remove('jam');
  void el.offsetWidth;
  el.classList.add('jam');
}

let pending: { el: HTMLElement; timer: number } | null = null;

/** Throw a print away (the server refused the shot, or never answered). */
export function dropPendingPrint() {
  if (!pending) return;
  const { el, timer } = pending;
  pending = null;
  window.clearTimeout(timer);
  el.classList.add('dropped');
  window.setTimeout(() => el.remove(), 420);
}

/**
 * The shutter, before the server answers: blades, flash, sound, and a print of `image` sliding out of the frame.
 * `frame` is in client px (the viewfinder rectangle).
 */
export function shutter(frame: { x: number; y: number; w: number; h: number }, image: string | undefined) {
  ambience.sfx('shutter');
  window.setTimeout(() => ambience.sfx('wind'), 90);
  const cf = document.getElementById('camera-frame');
  if (cf) {
    cf.classList.remove('snap');
    void cf.offsetWidth;
    cf.classList.add('snap');
  }
  const ui = document.getElementById('ui');
  if (!ui) return;
  const flash = h('div', { class: 'shutter-flash', 'aria-hidden': 'true', style: `left:${frame.x}px;top:${frame.y}px;width:${frame.w}px;height:${frame.h}px` });
  ui.append(flash);
  window.setTimeout(() => flash.remove(), 520);

  dropPendingPrint();
  document.getElementById('photo-print')?.remove();
  const print = h(
    'figure',
    { id: 'photo-print', class: 'developing', role: 'status', 'aria-live': 'polite', style: `left:${frame.x + frame.w / 2}px;top:${frame.y + frame.h / 2}px` },
    h('div', { class: 'print-img' }, image ? h('img', { src: image, alt: '' }) : null),
    h('figcaption', { class: 'print-cap' }, h('span', { class: 'print-dots', 'aria-hidden': 'true' }, '• • •')),
  );
  ui.append(print);
  pending = { el: print, timer: window.setTimeout(dropPendingPrint, 4000) };
}

/** Fly an element into a HUD button (the Diário by default), then give the button a small bump. */
export function flyInto(el: HTMLElement, targetId = 'btn-caderno', after?: () => void) {
  const target = document.getElementById(targetId);
  const tr = target?.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!target || !tr || !tr.width || reduceMotion() || typeof el.animate !== 'function') {
    el.remove();
    after?.();
    return;
  }
  const dx = tr.left + tr.width / 2 - (r.left + r.width / 2);
  const dy = tr.top + tr.height / 2 - (r.top + r.height / 2);
  const base = getComputedStyle(el).transform;
  const from = base === 'none' ? '' : base;
  const anim = el.animate(
    [
      { transform: `${from}`, opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 40}px) ${from} scale(0.7) rotate(-8deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) ${from} scale(0.12) rotate(-14deg)`, opacity: 0.2 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.5, 0, 0.75, 0.4)', fill: 'forwards' },
  );
  anim.onfinish = () => {
    el.remove();
    target.classList.remove('bump');
    void target.offsetWidth;
    target.classList.add('bump');
    window.setTimeout(() => target.classList.remove('bump'), 500);
    after?.();
  };
}

/** A word read this long ago is still flown in from where it was; older (it waited behind a game or another card), the card just pops. */
const FROM_FRESH_MS = 2500;

/**
 * The new-word card over the world. It never blocks the world: only its button takes the pointer. A shot's cards hand over one after another.
 * A word read in a line of dialogue (`from`) lifts off that line and flies into the card's empty slot, and the card then goes into the Diário.
 */
function celebrate(m: QueuedWord<HTMLElement>) {
  // the first word of a fresh diary opens the journal itself (the arrivals hall's comissária, for a new player)
  if (wantsReveal()) {
    revealJournal(m, () => {
      if (m.print?.isConnected) flyInto(m.print);
      window.clearTimeout(pumping);
      pumping = window.setTimeout(pump, 300);
    });
    return;
  }
  document.getElementById('photo-celebrate')?.remove();
  const from = m.from && performance.now() - m.from.at < FROM_FRESH_MS && !reduceMotion() ? m.from : null;
  let timer = 0;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.clearTimeout(timer);
    chip?.remove();
    if (from && inner.isConnected) {
      // a heard word goes into the diary with its card
      card.classList.add('filing');
      flyInto(inner, 'btn-caderno', () => card.remove());
    } else {
      card.classList.add('leaving');
      window.setTimeout(() => card.remove(), 260);
    }
    if (m.print?.isConnected) flyInto(m.print);
    // the next card of the queue comes once this one is gone
    window.clearTimeout(pumping);
    pumping = window.setTimeout(pump, 300);
  };
  const word = h('b', { class: `celebrate-pt${from ? ' awaiting' : ''}`, id: 'photo-word', lang: 'pt-BR' }, m.pt);
  const burst = h('div', { class: `celebrate-burst${from ? ' held' : ''}`, 'aria-hidden': 'true' }, ...Array.from({ length: 10 }, (_, i) => h('i', { style: `--i:${i}` })));
  const inner = h(
    'div',
    { class: 'celebrate-card' },
    miniBook(),
    h('p', { class: 'celebrate-kicker' }, 'Nova palavra!', m.total > 1 ? h('span', { class: 'celebrate-count' }, `${m.index}/${m.total}`) : null),
    word,
    en(m.en),
    m.progress ? h('p', { class: 'celebrate-progress', id: 'photo-progress' }, `${m.areaPt ?? ''}: ${m.progress}`) : null,
    h('button', { type: 'button', class: 'primary', id: 'photo-close', onclick: close }, 'Que bom!'),
  );
  const card = h('div', { id: 'photo-celebrate', role: 'status', class: from ? 'heard' : '' }, burst, inner);
  document.getElementById('ui')?.append(card);
  const arrived = () => {
    word.classList.remove('awaiting');
    word.classList.add('arrived');
    burst.classList.remove('held');
    ambience.sting('caderno');
    timer = window.setTimeout(close, cardMs(m));
  };
  const chip = from
    ? flyWord(
        from,
        () => (word.isConnected ? word.getBoundingClientRect() : null),
        () => parseFloat(getComputedStyle(word).fontSize) || 48,
        arrived,
      )
    : null;
  if (!from) {
    ambience.sting('caderno');
    timer = window.setTimeout(close, cardMs(m));
  }
}

// ---------------------------------------------------------------- every new diary word gets the moment, one at a time

const queue = new WordQueue<HTMLElement>();
let gameOn: () => boolean = () => false;
let pumping = 0;

/** How the page says a game is on (escola practice, the tatame, Correria, damas): words found meanwhile wait for it to end. */
export function setWordGate(isGameOn: () => boolean) {
  gameOn = isGameOn;
}

/** A word reached the diary without the camera (a sign, a line, a game): the same card a photo gets, after any game on screen. */
export function celebrateWord(m: WordMoment) {
  queue.push(momentsOfShot([m]));
  pump();
}

/** Several words at once (the arrival card's): one card each, counting up, in order. */
export function celebrateWords(words: readonly WordMoment[]) {
  queue.push(momentsOfShot(words));
  pump();
}

function pump() {
  window.clearTimeout(pumping);
  if (!queue.length) return;
  const next = queue.take(!!document.getElementById('photo-celebrate'), gameOn());
  if (!next) {
    pumping = window.setTimeout(pump, 400);
    return;
  }
  celebrate(next);
}

type ShotMsg = { ok: boolean; pt: string; en: string; areaPt?: string; progress?: string; empty?: boolean; words?: WordMoment[] };

export function showPhoto(m: ShotMsg) {
  const print = pending?.el ?? null;
  if (pending) {
    window.clearTimeout(pending.timer);
    pending = null;
  }
  const words = m.ok ? (m.words?.length ? m.words : [m]) : [];
  if (print) {
    print.classList.remove('developing');
    print.classList.add(m.ok ? 'new-word' : m.empty ? 'saved' : 'known');
    const cap = print.querySelector('.print-cap');
    cap?.replaceChildren(
      ...(m.ok || m.empty ? [] : [h('span', { class: 'print-kicker' }, 'Já no diário')]),
      ...(words.length > 1 ? [h('span', { class: 'print-more' }, `+${words.length - 1}`)] : []),
      h('b', { class: 'print-pt', lang: 'pt-BR' }, m.pt),
      h('span', { class: 'print-en en plain' }, m.en),
    );
  }
  if (m.ok) {
    // every word the shot taught, in order; the print flies into the Diário when the last of them has been shown
    queue.push(momentsOfShot(words, print ?? undefined));
    pump();
    return;
  }
  if (print) window.setTimeout(() => print.isConnected && flyInto(print), m.empty ? 1300 : 1700);
}

export function syncCameraBanner() {
  const existing = document.getElementById('camera-banner');
  if (!game.cameraOn || !game.profile?.hasCamera) {
    game.cameraOn = false;
    existing?.remove();
    syncCameraFrame();
    return;
  }
  const n = game.profile.film ?? 0;
  const text = `Câmera aberta — ${n} filme${n === 1 ? '' : 's'}`;
  const gloss = 'Camera on — click takes a photo and does not walk';
  if (!existing) {
    document.getElementById('ui')?.append(h('div', { id: 'camera-banner', role: 'status' }, h('i', { class: 'rec-dot', 'aria-hidden': 'true' }), text, en(gloss)));
  } else {
    existing.replaceChildren(h('i', { class: 'rec-dot', 'aria-hidden': 'true' }), text, en(gloss));
  }
  syncCameraFrame();
}

/** Crop the world canvas to the viewfinder. Returns a jpeg data URL, or undefined if the canvas will not export. */
export function captureFrame(frame: { x: number; y: number; w: number; h: number }): string | undefined {
  const canvas = document.getElementById('world');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const r = canvas.getBoundingClientRect();
  const sx = ((frame.x - r.left) / r.width) * canvas.width;
  const sy = ((frame.y - r.top) / r.height) * canvas.height;
  const sw = (frame.w / r.width) * canvas.width;
  const sh = (frame.h / r.height) * canvas.height;
  if (sw < 2 || sh < 2) return;
  const out = document.createElement('canvas');
  out.width = 240;
  out.height = Math.max(1, Math.round(240 * (frame.h / frame.w)));
  const ctx = out.getContext('2d');
  if (!ctx) return;
  try {
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    // A jpeg over PHOTO_MAX_CHARS used to exceed the socket frame and drop the player on the shot.
    const candidates: string[] = [];
    for (const quality of [0.72, 0.58, 0.44]) {
      const url = out.toDataURL('image/jpeg', quality);
      candidates.push(url);
      if (url.startsWith('data:image/jpeg') && url.length <= PHOTO_MAX_CHARS) break;
    }
    return pickPhotoUrl(candidates);
  } catch {
    return;
  }
}
