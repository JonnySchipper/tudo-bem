/**
 * Plane arrival. A brand-new account lands in Brazil; Júlia gives the camera.
 * The stamp card (cartela) is not on main, so the line says so and the server hook stays empty.
 * Accounts that already finished it never see this again.
 */
import { game } from '../state';
import { h, en, ui } from './dom';

let open = false;

export function syncArrival(finish: () => void) {
  const need = game.profile?.arrivalIntroDone === false && !!game.room;
  if (!need) {
    if (!open) return;
    document.getElementById('arrival-intro')?.remove();
    open = false;
    if (!document.querySelector('[data-modal]')) game.modalOpen = false;
    return;
  }
  if (open) return;
  open = true;
  game.modalOpen = true;
  const done = h(
    'button',
    {
      type: 'button',
      class: 'primary',
      id: 'arrival-done',
      onclick: () => {
        done.setAttribute('disabled', '');
        finish();
      },
    },
    'Pegar a câmera',
    en('Take the camera'),
  );
  // needs_br: true
  ui().append(
    h(
      'div',
      { id: 'arrival-intro', role: 'dialog', 'aria-labelledby': 'arrival-title' },
      h(
        'div',
        { class: 'arrival-card' },
        h('p', { class: 'arrival-kicker' }, 'Aeroporto'),
        h('h2', { id: 'arrival-title' }, 'Você chegou ao Brasil'),
        h('p', null, 'O avião acabou de pousar. Júlia te espera na praça.'),
        en('The plane just landed. Júlia is waiting for you in the square.'),
        h('p', null, 'A cartela de carimbos ainda não chegou. Quando ela existir, eu te entrego aqui.'),
        en('The stamp card isn’t here yet. When it exists, I’ll hand it to you here.'),
        h('p', null, 'Enquanto isso, toma a câmera. Fotografe o que você vê e as palavras ficam no diário.'),
        en('Until then, take the camera. Photograph what you see and the words stay in the diary.'),
        done,
      ),
    ),
  );
}
