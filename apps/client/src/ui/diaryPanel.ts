/**
 * Camera viewfinder and the moment a photo teaches a new word.
 * The diary itself is the Caderno panel.
 */
import { game } from '../state';
import { h, en } from './dom';

export const FRAME_W = 220;
export const FRAME_H = 148;

export function cameraFrameAt(x: number, y: number) {
  return { x: x - FRAME_W / 2, y: y - FRAME_H / 2, w: FRAME_W, h: FRAME_H };
}

/** The rectangle that follows the pointer while the camera is open. */
export function syncCameraFrame(x?: number, y?: number) {
  let el = document.getElementById('camera-frame');
  if (!game.cameraOn || !game.profile?.hasCamera) {
    el?.remove();
    return;
  }
  if (!el) {
    el = h('div', { id: 'camera-frame', 'aria-hidden': 'true' }, h('span', { id: 'camera-film' }));
    document.getElementById('ui')?.append(el);
  }
  if (x != null && y != null) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  const n = game.profile.film ?? 0;
  const film = document.getElementById('camera-film');
  if (film) film.textContent = n === 1 ? '1 filme' : `${n} filmes`;
  el.classList.toggle('empty', n < 1);
}

export function showPhoto(m: { ok: boolean; pt: string; en: string; areaPt?: string; progress?: string; empty?: boolean }) {
  document.getElementById('photo-capture')?.remove();
  document.getElementById('photo-celebrate')?.remove();
  if (m.empty) return;
  if (m.ok) {
    const card = h(
      'div',
      { id: 'photo-celebrate', role: 'status' },
      h('div', { class: 'celebrate-burst', 'aria-hidden': 'true' }),
      h('p', { class: 'celebrate-kicker' }, 'Nova palavra!'),
      h('b', { class: 'celebrate-pt', id: 'photo-word' }, m.pt),
      en(m.en),
      m.progress ? h('p', { class: 'celebrate-progress', id: 'photo-progress' }, `${m.areaPt ?? ''}: ${m.progress}`) : null,
      h('button', { type: 'button', class: 'primary', id: 'photo-close', onclick: () => card.remove() }, 'Que bom!'),
    );
    document.getElementById('ui')?.append(card);
    window.setTimeout(() => card.remove(), 2800);
    return;
  }
  const card = h(
    'div',
    { id: 'photo-capture', role: 'status' },
    h(
      'div',
      { class: 'photo-frame' },
      h('p', { class: 'photo-kicker' }, 'Já no diário'),
      h('b', { class: 'photo-pt', id: 'photo-word' }, m.pt),
      en(m.en),
      h('button', { type: 'button', id: 'photo-close', onclick: () => card.remove() }, 'Ok'),
    ),
  );
  document.getElementById('ui')?.append(card);
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
    document.getElementById('ui')?.append(h('div', { id: 'camera-banner', role: 'status' }, text, en(gloss)));
  } else {
    existing.replaceChildren(text, en(gloss));
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
    const url = out.toDataURL('image/jpeg', 0.72);
    return url.startsWith('data:image/jpeg') ? url : undefined;
  } catch {
    return;
  }
}
