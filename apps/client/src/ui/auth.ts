import { MIN_AGE, PASSWORD_MIN, validateEmail, validatePassword, type Bilingual } from '@tudobem/shared';
import { authApi } from '../auth';
import { h, en, ui } from './dom';
import { hero } from './onboarding';

/** Set after any successful sign-in so returning players land on “Entrar”, newcomers on “Criar conta”. */
const KNOWN_KEY = 'tb_has_account';
/** Pre-accounts browsers keep their avatar token; signing up here links that avatar to the account. */
const LEGACY_TOKEN_KEY = 'tb_token';

type Mode = 'login' | 'register';

export interface AuthScreenOptions {
  onAuthed: () => void;
  /** Shown above the form (e.g. session expired). */
  notice?: Bilingual;
}

export function runAuth(opts: AuthScreenOptions) {
  closeAuth();
  let mode: Mode = localStorage.getItem(KNOWN_KEY) ? 'login' : 'register';
  let busy = false;
  const root = h('div', { class: 'onboarding auth-screen' });
  ui().append(root);

  const email = h('input', { type: 'email', id: 'auth-email', autocomplete: 'email', inputmode: 'email', placeholder: 'voce@exemplo.com', 'aria-label': 'E-mail', maxLength: 254, required: true });
  const password = h('input', { type: 'password', id: 'auth-password', 'aria-label': 'Senha', maxLength: 128, required: true });
  const reveal = h('button', { type: 'button', class: 'ghost auth-reveal', 'aria-label': 'Mostrar senha', 'aria-pressed': 'false' }, 'mostrar');
  reveal.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    reveal.textContent = show ? 'esconder' : 'mostrar';
    reveal.setAttribute('aria-pressed', String(show));
  });
  const adult = h('input', { type: 'checkbox', id: 'auth-confirm-18' });
  const adultRow = h(
    'label',
    { class: 'adult-confirm', for: 'auth-confirm-18' },
    adult,
    h('span', null, `Confirmo que tenho ${MIN_AGE} anos ou mais.`, en(`I confirm I am ${MIN_AGE} or older. Tudo Bem is an adult world for now.`, true)),
  );
  const pwHint = h('div', { class: 'auth-hint' }, `Pelo menos ${PASSWORD_MIN} caracteres.`, en(`At least ${PASSWORD_MIN} characters.`, true));
  const err = h('div', { class: 'feedback s1 auth-error', id: 'auth-error', role: 'alert', style: 'display:none' });
  const submit = h('button', { class: 'primary auth-submit', type: 'submit', id: 'auth-submit' });
  const title = h('h2');
  const lead = h('p', { class: 'auth-lead' });
  const leadEn = en('');
  const tabLogin = h('button', { type: 'button', role: 'tab', id: 'auth-tab-login' }, 'Entrar');
  const tabRegister = h('button', { type: 'button', role: 'tab', id: 'auth-tab-register' }, 'Criar conta');
  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));
  const legacy = !!localStorage.getItem(LEGACY_TOKEN_KEY);
  const legacyNote = h(
    'div',
    { class: 'auth-legacy' },
    'Já jogou neste navegador? Crie sua conta aqui e seu avatar, suas RV e sua kitnet vêm junto.',
    en('Played in this browser before? Create your account here and your avatar, RV and kitnet come with you.', true),
  );

  const showError = (b: Bilingual | null) => {
    err.style.display = b ? 'inline-block' : 'none';
    err.replaceChildren(...(b ? [b.pt, h('br'), h('i', null, b.en)] : []));
  };

  const refresh = () => {
    const reg = mode === 'register';
    tabLogin.className = reg ? '' : 'on';
    tabRegister.className = reg ? 'on' : '';
    tabLogin.setAttribute('aria-selected', String(!reg));
    tabRegister.setAttribute('aria-selected', String(reg));
    title.textContent = reg ? 'Puxa uma cadeira!' : 'Que bom te ver de novo!';
    lead.textContent = reg ? 'Crie sua conta pra guardar seu avatar, suas RV e sua kitnet.' : 'Entre com seu e-mail e senha. O café tá passando.';
    leadEn.textContent = reg ? 'Create an account to keep your avatar, RV and apartment.' : 'Sign in with your email and password. Coffee’s brewing.';
    password.autocomplete = reg ? 'new-password' : 'current-password';
    adultRow.style.display = reg ? '' : 'none';
    pwHint.style.display = reg ? '' : 'none';
    legacyNote.style.display = reg && legacy ? '' : 'none';
    submit.replaceChildren(reg ? 'Criar conta e entrar →' : 'Entrar na Praça →');
    submit.disabled = busy || (reg && !adult.checked);
  };
  const setMode = (m: Mode) => {
    mode = m;
    showError(null);
    refresh();
    email.focus();
  };
  adult.addEventListener('change', refresh);

  const form = h('form', { class: 'auth-form', id: 'auth-form', novalidate: true });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const reg = mode === 'register';
    const e1 = validateEmail(email.value);
    if (!e1.ok) return showError(e1.reason);
    if (reg) {
      const p1 = validatePassword(password.value);
      if (!p1.ok) return showError(p1.reason);
      if (!adult.checked) return showError({ pt: `Confirme que você tem ${MIN_AGE} anos ou mais.`, en: `Please confirm you are ${MIN_AGE} or older.` });
    } else if (!password.value) return showError({ pt: 'Digite sua senha.', en: 'Enter your password.' });
    busy = true;
    refresh();
    showError(null);
    const r = reg ? await authApi.register(e1.value, password.value, true) : await authApi.login(e1.value, password.value);
    busy = false;
    if (r.ok) {
      localStorage.setItem(KNOWN_KEY, '1');
      closeAuth();
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
    lead,
    leadEn,
    ...(opts.notice ? [h('div', { class: 'auth-notice', role: 'status' }, opts.notice.pt, en(opts.notice.en, true))] : []),
    legacyNote,
    h('div', { class: 'field' }, h('label', { for: 'auth-email' }, 'E-mail', en('Email')), email),
    h('div', { class: 'field' }, h('label', { for: 'auth-password' }, 'Senha', en('Password')), h('div', { class: 'auth-password-row' }, password, reveal), pwHint),
    adultRow,
    err,
    h('div', { class: 'row', style: 'margin-top:12px' }, h('span', { class: 'spacer' }), submit),
  );

  root.append(
    hero(),
    h(
      'div',
      { class: 'panel auth-panel' },
      form,
      h('div', { class: 'legal' }, `Fase 0 · só para maiores de ${MIN_AGE} anos. Sua senha é guardada com hash — nunca em texto.`, en(`Phase 0 · adults (${MIN_AGE}+) only. Your password is stored hashed, never in plain text.`, true)),
    ),
  );
  refresh();
  email.focus();
}

export function closeAuth() {
  document.querySelector('.auth-screen')?.remove();
}
