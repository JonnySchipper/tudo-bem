/**
 * Conta / Account: the gear-menu panel next to Sair. Change the password, sign out on every device,
 * download what the server keeps, and delete the account. No email provider: nothing here sends mail.
 */
import { ACCOUNT_EXPORT_URL, changePassword, deleteAccount, fetchAccount, signOutEverywhere, type AccountCallResult } from '../auth/client';
import { INTRO_PASSED_KEY } from '../auth/session';
import { h, en } from './dom';
import { openModal } from './modal.js';

export const SUPPORT_EMAIL = 'team@playtudobem.com';

/** Back to the title screen's sign-in card (same as the HUD's Sair). */
function backToSignIn() {
  try {
    localStorage.removeItem('tb_token');
    sessionStorage.removeItem(INTRO_PASSED_KEY);
  } catch {
    /* storage blocked: the reload still lands on the sign-in card once the cookie is gone */
  }
  location.reload();
}

type Shown = AccountCallResult | { ok: true; pt: string; en: string };

/** A status line under an action, with a `show` that fills it. */
function note(): HTMLElement & { show(r: Shown): void } {
  const el = h('p', { class: 'account-note', role: 'status', hidden: true });
  return Object.assign(el, {
    show(r: Shown) {
      el.hidden = false;
      el.classList.toggle('bad', !r.ok);
      if ('pt' in r) el.replaceChildren(r.pt, en(r.en));
    },
  });
}

function field(id: string, pt: string, enText: string, input: HTMLElement) {
  return h('label', { class: 'feedback-label', for: id }, h('span', null, pt, en(enText, true)), input);
}

function input(id: string, type: string, autocomplete: string) {
  return h('input', { id, type, class: 'feedback-field', autocomplete }) as HTMLInputElement;
}

export function openAccount(): void {
  const body = h('div', { class: 'account-body' }, h('p', { class: 'feedback-lead' }, 'Carregando…', en('Loading…')));
  const close = openModal(
    'account',
    h(
      'div',
      { class: 'panel feedback-panel account-panel', role: 'dialog', 'aria-labelledby': 'account-title' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', { id: 'account-title' }, 'Sua conta'),
      en('Your account'),
      body,
    ),
  );

  void fetchAccount().then((account) => {
    if (!account) {
      body.replaceChildren(h('p', { class: 'feedback-lead' }, 'Entre na sua conta pra continuar.', en('Sign in to continue.')));
      return;
    }
    body.replaceChildren(
      h('p', { class: 'account-email' }, account.email, account.google ? en(' · entra com Google (signs in with Google)', true) : null),
      account.google ? googlePassword() : passwordSection(),
      everywhereSection(),
      exportSection(),
      deleteSection(account.email, account.google),
      h(
        'p',
        { class: 'account-legal' },
        h('a', { href: '/privacy', target: '_blank', rel: 'noopener' }, 'Privacidade'),
        ' · ',
        h('a', { href: '/terms', target: '_blank', rel: 'noopener' }, 'Termos'),
        ' · ',
        h('a', { href: `mailto:${SUPPORT_EMAIL}` }, SUPPORT_EMAIL),
        en('Privacy · Terms · contact', true),
      ),
    );
  });
}

function googlePassword(): HTMLElement {
  return h(
    'section',
    { class: 'account-section' },
    h('h3', null, 'Senha', en('Password', true)),
    h('p', null, 'Você entra com Google, então não há senha pra trocar aqui.', en('You sign in with Google, so there is no password to change here.')),
  );
}

function passwordSection(): HTMLElement {
  const current = input('account-current', 'password', 'current-password');
  const next = input('account-next', 'password', 'new-password');
  const msg = note();
  const btn = h('button', { type: 'button', class: 'primary', id: 'account-password-save' }, 'Trocar senha', en('Change password', true)) as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await changePassword(current.value, next.value);
    btn.disabled = false;
    if (!r.ok) return msg.show(r);
    current.value = '';
    next.value = '';
    msg.show({ ok: true, pt: 'Senha trocada. Os outros aparelhos saíram da conta.', en: 'Password changed. Your other devices were signed out.' });
  });
  return h(
    'section',
    { class: 'account-section' },
    h('h3', null, 'Trocar senha', en('Change password', true)),
    field('account-current', 'Senha atual', 'Current password', current),
    field('account-next', 'Nova senha (8+ caracteres)', 'New password (8+ characters)', next),
    btn,
    msg,
  );
}

function everywhereSection(): HTMLElement {
  const msg = note();
  const btn = h('button', { type: 'button', id: 'account-logout-all' }, 'Sair de todos os aparelhos', en('Sign out on every device', true)) as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await signOutEverywhere();
    btn.disabled = false;
    if (!r.ok) return msg.show(r);
    backToSignIn();
  });
  return h(
    'section',
    { class: 'account-section' },
    h('h3', null, 'Aparelhos', en('Devices', true)),
    h('p', null, 'Esqueceu a conta aberta em outro lugar? Isto encerra todas as sessões, inclusive esta.', en('Left it signed in somewhere else? This ends every session, this one too.')),
    btn,
    msg,
  );
}

function exportSection(): HTMLElement {
  return h(
    'section',
    { class: 'account-section' },
    h('h3', null, 'Seus dados', en('Your data', true)),
    h('p', null, 'Um arquivo JSON com a conta, o personagem e o progresso.', en('A JSON file with your account, character and progress.')),
    h('a', { class: 'account-download', id: 'account-export', href: ACCOUNT_EXPORT_URL, download: 'tudo-bem.json' }, 'Baixar meus dados', en(' Download my data', true)),
  );
}

function deleteSection(email: string, google: boolean): HTMLElement {
  const proof = google ? input('account-delete-proof', 'email', 'off') : input('account-delete-proof', 'password', 'current-password');
  const msg = note();
  const btn = h('button', { type: 'button', class: 'primary account-danger', id: 'account-delete' }, 'Apagar para sempre', en('Delete forever', true)) as HTMLButtonElement;
  btn.addEventListener('click', async () => {
    if (!proof.value) return proof.focus();
    btn.disabled = true;
    const r = await deleteAccount(google ? { confirmEmail: proof.value } : { password: proof.value });
    btn.disabled = false;
    if (!r.ok) return msg.show(r);
    msg.show({ ok: true, pt: 'Conta apagada. Até a próxima!', en: 'Account deleted. See you around!' });
    window.setTimeout(backToSignIn, 1200);
  });
  return h(
    'details',
    { class: 'account-section account-delete' },
    h('summary', null, 'Apagar conta', en(' Delete account', true)),
    h(
      'p',
      null,
      'Apaga a conta, o personagem, as fotos, a kitnet, academias e padarias que você fundou, seus recados de feedback e as amizades. Não dá pra desfazer.',
      en('Deletes the account, character, photos, apartment, academies and bakeries you founded, your feedback notes and friendships. This cannot be undone.'),
    ),
    google
      ? field('account-delete-proof', `Digite ${email} pra confirmar`, `Type ${email} to confirm`, proof)
      : field('account-delete-proof', 'Sua senha', 'Your password', proof),
    btn,
    msg,
  );
}
