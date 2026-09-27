import { game } from '../state';
import { h, ui } from './dom';

let current: { el: HTMLElement; close: () => void; id: string } | null = null;

export function closeModal() {
  current?.close();
}

export function modalId() {
  return current?.id ?? null;
}

export function openModal(id: string, content: HTMLElement, opts: { onClose?: () => void; clear?: boolean; dismissable?: boolean } = {}) {
  closeModal();
  const mg = id === 'minigame';
  const backdrop = h('div', {
    class: `backdrop ${mg ? 'mg-backdrop' : ''} ${opts.clear ? 'clear' : ''}`,
    'data-modal': id,
  });
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
  (mg ? document.body : ui()).append(backdrop);
  current = { el: backdrop, close, id };
  game.modalOpen = true;
  return close;
}
