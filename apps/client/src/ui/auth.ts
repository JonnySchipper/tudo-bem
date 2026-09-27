/**
 * Entry screen: sign in / create account.
 *
 * Two layers, so visual work can replace the skin without touching auth:
 *
 *   mountAuthForm(el, opts)  — FORM LOGIC (stable). Validation, register/login calls, errors, 18+ tick.
 *   runAuth(opts)            — SHELL (replaceable). Lays out the regions and mounts the form into one.
 *
 * Regions (each is a `[data-region]` element inside `.auth-screen`):
 *   hero   — backdrop / motion stage
 *   brand  — logo + tagline
 *   form   — `mountAuthForm` renders here; nothing else should
 *   footer — legal / policy line
 *
 * DOM contract used by scripts/e2e.mjs (keep these ids when reskinning):
 *   #auth-form  #auth-tab-login  #auth-tab-register  #auth-email  #auth-password
 *   #auth-confirm-18  #auth-error  #auth-submit
 * The form toggles `data-mode="login|register"` on its root so skins can style each mode.
 */
import { MIN_AGE, PASSWORD_MIN, validateEmail, validatePassword, type Bilingual } from '@tudobem/shared';
import { authApi } from '../auth';
import { h, en, ui } from './dom';

/** Set after any successful sign-in so returning players land on “Entrar”, newcomers on “Criar conta”. */
const KNOWN_KEY = 'tb_has_account';
/** Pre-accounts browsers keep their avatar token; signing up here links that avatar to the account. */
const LEGACY_TOKEN_KEY = 'tb_token';

export type AuthMode = 'login' | 'register';

export interface AuthFormOptions {
  onAuthed: () => void;
  /** Shown above the fields (e.g. session expired). */
  notice?: Bilingual;
}

// ================================================================ FORM LOGIC (stable)

export function mountAuthForm(container: HTMLElement, opts: AuthFormOptions): void {
  let mode: AuthMode = localStorage.getItem(KNOWN_KEY) ? 'login' : 'register';
  let busy = false;

  const email = h('input', { type: 'email', id: 'auth-email', name: 'email', autocomplete: 'email', inputmode: 'email', maxLength: 254, required: true });
  const password = h('input', { type: 'password', id: 'auth-password', name: 'password', maxLength: 128, required: true });
  const reveal = h('button', { type: 'button', class: 'auth-reveal', 'aria-label': 'Mostrar senha', 'aria-pressed': 'false' }, 'mostrar');
  reveal.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    reveal.textContent = show ? 'esconder' : 'mostrar';
    reveal.setAttribute('aria-pressed', String(show));
  });
  const adult = h('input', { type: 'checkbox', id: 'auth-confirm-18', name: 'confirm18' });
  const adultRow = h(
    'label',
    { class: 'auth-adult', for: 'auth-confirm-18' },
    adult,
    h('span', null, `Tenho ${MIN_AGE} anos ou mais.`, en(`I am ${MIN_AGE}+. Optional — Tudo Bem is made for adults.`, true)),
  );
  const pwHint = h('small', { class: 'auth-hint' }, `Pelo menos ${PASSWORD_MIN} caracteres.`);
  const err = h('div', { class: 'auth-error', id: 'auth-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'primary auth-submit', type: 'submit', id: 'auth-submit' });
  const title = h('h2', { class: 'auth-title' });
  const tabLogin = h('button', { type: 'button', role: 'tab', id: 'auth-tab-login' }, 'Entrar');
  const tabRegister = h('button', { type: 'button', role: 'tab', id: 'auth-tab-register' }, 'Criar conta');
  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));
  const legacyNote = localStorage.getItem(LEGACY_TOKEN_KEY)
    ? h('p', { class: 'auth-legacy' }, 'Já jogou neste navegador? Crie sua conta aqui e seu avatar vem junto.')
    : null;

  const form = h('form', { class: 'auth-form', id: 'auth-form', novalidate: true });

  const showError = (b: Bilingual | null) => {
    err.hidden = !b;
    err.replaceChildren(...(b ? [b.pt, en(b.en, true)] : []));
  };

  const refresh = () => {
    const reg = mode === 'register';
    form.dataset.mode = mode;
    tabLogin.setAttribute('aria-selected', String(!reg));
    tabRegister.setAttribute('aria-selected', String(reg));
    tabLogin.classList.toggle('on', !reg);
    tabRegister.classList.toggle('on', reg);
    title.textContent = reg ? 'Criar conta' : 'Entrar';
    password.autocomplete = reg ? 'new-password' : 'current-password';
    adultRow.hidden = !reg;
    pwHint.hidden = !reg;
    if (legacyNote) legacyNote.hidden = !reg;
    submit.textContent = reg ? 'Criar conta' : 'Entrar';
    submit.disabled = busy;
  };
  const setMode = (m: AuthMode) => {
    mode = m;
    showError(null);
    refresh();
    email.focus();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const reg = mode === 'register';
    const e1 = validateEmail(email.value);
    if (!e1.ok) return showError(e1.reason);
    if (reg) {
      const p1 = validatePassword(password.value);
      if (!p1.ok) return showError(p1.reason);
    } else if (!password.value) return showError({ pt: 'Digite sua senha.', en: 'Enter your password.' });
    busy = true;
    refresh();
    showError(null);
    const r = reg ? await authApi.register(e1.value, password.value, adult.checked) : await authApi.login(e1.value, password.value);
    busy = false;
    if (r.ok) {
      localStorage.setItem(KNOWN_KEY, '1');
      opts.onAuthed();
      return;
    }
    if (r.code === 'taken') setMode('login');
    showError(r);
    refresh();
    (r.code === 'password' || r.code === 'credentials' ? password : email).focus();
  });

  form.append(
    h('div', { class: 'auth-tabs', role: 'tablist' }, tabLogin, tabRegister),
    title,
    opts.notice ? h('p', { class: 'auth-notice', role: 'status' }, opts.notice.pt) : '',
    legacyNote ?? '',
    h('label', { class: 'auth-field', for: 'auth-email' }, h('span', null, 'E-mail'), email),
    h('label', { class: 'auth-field', for: 'auth-password' }, h('span', null, 'Senha'), h('span', { class: 'auth-password-row' }, password, reveal), pwHint),
    adultRow,
    err,
    submit,
  );
  container.append(form);
  refresh();
  email.focus();
}

// ================================================================ SHELL (replaceable skin)

export function runAuth(opts: AuthFormOptions) {
  closeAuth();
  const formRegion = h('section', { 'data-region': 'form', class: 'auth-region-form' });
  const root = h(
    'div',
    { class: 'auth-screen' },
    h('div', { 'data-region': 'hero', class: 'auth-region-hero', 'aria-hidden': 'true' }),
    h('header', { 'data-region': 'brand', class: 'auth-region-brand' }, h('h1', null, 'Tudo Bem'), h('p', null, 'Um bairro brasileiro pra fazer amigos e aprender português.')),
    formRegion,
    h('footer', { 'data-region': 'footer', class: 'auth-region-footer' }, `Fase 0 · só para maiores de ${MIN_AGE} anos.`),
  );
  ui().append(root);
  mountAuthForm(formRegion, {
    ...opts,
    onAuthed: () => {
      closeAuth();
      opts.onAuthed();
    },
  });
}

export function closeAuth() {
  document.querySelector('.auth-screen')?.remove();
}
