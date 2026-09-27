import { signIn, signUp } from '../auth/client';
import { introAlreadyPassed, markIntroPassed, readAuthSession, writeAuthSession } from '../auth/session';
import { h, en, ui } from './dom';

type IntroMode = 'login' | 'register';

export interface IntroGateResult {
  mode: 'guest' | 'auth';
  email?: string;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function mountParticles(canvas: HTMLCanvasElement) {
  if (prefersReducedMotion()) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const dots: { x: number; y: number; r: number; vy: number; a: number }[] = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  const resize = () => {
    w = canvas.width = canvas.clientWidth;
    h = canvas.height = canvas.clientHeight;
    if (dots.length < 28) {
      for (let i = dots.length; i < 28; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 2.2,
          vy: 0.08 + Math.random() * 0.22,
          a: 0.15 + Math.random() * 0.35,
        });
      }
    }
  };
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.y -= d.vy;
      if (d.y < -4) {
        d.y = h + 4;
        d.x = Math.random() * w;
      }
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4);
      g.addColorStop(0, `rgba(255, 220, 150, ${d.a})`);
      g.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  };
  resize();
  draw();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

function field(pt: string, enText: string, control: HTMLElement) {
  return h('div', { class: 'intro-field' }, h('label', null, pt, en(enText)), control);
}

/**
 * Premium title-screen gate: sign-in / register scaffold, or continue as Phase 0 guest.
 * Resolves when the player may connect to the world socket.
 */
export function runIntroGate(): Promise<IntroGateResult> {
  if (introAlreadyPassed()) {
    const session = readAuthSession();
    return Promise.resolve({ mode: session ? 'auth' : 'guest', email: session?.email });
  }

  return new Promise((resolve) => {
    const root = h('div', { class: 'intro-gate', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'intro-title' });
    const particles = h('canvas', { class: 'intro-particles', 'aria-hidden': 'true' });
    const skylineNear = h('div', { class: 'intro-layer intro-skyline-near', 'aria-hidden': 'true' });
    const skylineFar = h('div', { class: 'intro-layer intro-skyline-far', 'aria-hidden': 'true' });
    const glow = h('div', { class: 'intro-layer intro-glow', 'aria-hidden': 'true' });
    const cafe = h('div', { class: 'intro-cafe-scene', 'aria-hidden': 'true' });

    let mode: IntroMode = 'login';
    const err = h('div', { class: 'intro-feedback', role: 'alert', style: 'display:none' });
    const email = h('input', {
      type: 'email',
      name: 'email',
      autocomplete: 'email',
      inputmode: 'email',
      id: 'intro-email',
      'aria-label': 'E-mail',
      placeholder: 'voce@email.com',
    });
    const password = h('input', {
      type: 'password',
      name: 'password',
      autocomplete: mode === 'login' ? 'current-password' : 'new-password',
      id: 'intro-password',
      'aria-label': 'Senha',
      placeholder: '••••••••',
    });
    const adult = h('input', { type: 'checkbox', id: 'intro-18', name: 'confirm18' });
    const adultRow = h(
      'label',
      { class: 'intro-adult', for: 'intro-18', style: 'display:none' },
      adult,
      h('span', null, 'Tenho 18 anos ou mais.'),
    );

    const tabLogin = h('button', { type: 'button', class: 'intro-tab on', id: 'intro-tab-login', role: 'tab', 'aria-selected': 'true' }, 'Entrar');
    const tabRegister = h('button', { type: 'button', class: 'intro-tab', id: 'intro-tab-register', role: 'tab', 'aria-selected': 'false' }, 'Criar conta');
    const submit = h('button', { type: 'submit', class: 'primary intro-submit', id: 'intro-submit' }, 'Entrar');
    const panelTitle = h('h2', { id: 'intro-panel-title' }, 'Bem-vindo de volta');
    const guest = h(
      'button',
      { type: 'button', class: 'intro-guest', id: 'intro-guest' },
      'Explorar como visitante',
      h('span', { class: 'en' }, 'Try the square without an account'),
    );

    const setError = (pt: string, enText: string) => {
      err.style.display = 'block';
      err.replaceChildren(pt, h('br'), h('i', null, enText));
    };
    const clearError = () => {
      err.style.display = 'none';
      err.replaceChildren();
    };

    const syncTabs = () => {
      const login = mode === 'login';
      tabLogin.classList.toggle('on', login);
      tabRegister.classList.toggle('on', !login);
      tabLogin.setAttribute('aria-selected', login ? 'true' : 'false');
      tabRegister.setAttribute('aria-selected', login ? 'false' : 'true');
      submit.textContent = login ? 'Entrar' : 'Criar conta';
      panelTitle.textContent = login ? 'Bem-vindo de volta' : 'Crie sua conta';
      password.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
      adultRow.style.display = login ? 'none' : 'flex';
      if (login) adult.checked = false;
    };

    tabLogin.addEventListener('click', () => {
      mode = 'login';
      syncTabs();
      clearError();
    });
    tabRegister.addEventListener('click', () => {
      mode = 'register';
      syncTabs();
      clearError();
    });

    let teardownParticles = () => {};
    teardownParticles = mountParticles(particles);

    const finish = (result: IntroGateResult) => {
      markIntroPassed();
      teardownParticles();
      root.classList.add('intro-exit');
      window.setTimeout(() => {
        root.remove();
        document.body.classList.remove('intro-active');
        resolve(result);
      }, prefersReducedMotion() ? 0 : 240);
    };

    guest.addEventListener('click', () => finish({ mode: 'guest' }));

    const form = h(
      'form',
      { class: 'intro-form', novalidate: true },
      h('div', { class: 'intro-tabs', role: 'tablist', 'aria-label': 'Entrar ou criar conta' }, tabLogin, tabRegister),
      field('E-mail', 'Email address', email),
      field('Senha', 'Password (8+ characters)', password),
      adultRow,
      err,
      h('div', { class: 'intro-actions' }, submit),
      guest,
      h('p', { class: 'intro-legal' }, 'Demonstração da Praça e da Padaria — contas completas em breve.'),
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      if (mode === 'register' && !adult.checked) {
        return setError('Marque “Tenho 18 anos ou mais” para criar sua conta.', 'Check “I am 18 or older” to register.');
      }
      submit.disabled = true;
      const creds = { email: email.value, password: password.value };
      const result = mode === 'login' ? await signIn(creds) : await signUp(creds);
      submit.disabled = false;
      if (!result.ok) return setError(result.pt, result.en);
      if (mode === 'register') writeAuthSession({ ...result.session, ageGateConfirmed: true });
      finish({ mode: 'auth', email: result.session.email });
    });

    root.append(
      particles,
      glow,
      skylineFar,
      skylineNear,
      cafe,
      h(
        'div',
        { class: 'intro-shell' },
        h(
          'header',
          { class: 'intro-hero' },
          h('div', { class: 'intro-mark', 'aria-hidden': 'true' }),
          h('h1', { id: 'intro-title' }, 'Tudo Bem'),
          h('p', { class: 'intro-tagline' }, 'Um cantinho de São Paulo para aprender português com café, praça e vizinhos.'),
          h('p', { class: 'intro-tagline en' }, 'A friendly Brazilian square to learn Portuguese together.'),
        ),
        h(
          'section',
          { class: 'panel intro-panel', 'aria-label': 'Entrar na conta' },
          panelTitle,
          form,
          h('div', { id: 'tb-idle-kick-slot', class: 'tb-idle-kick-slot', hidden: true, 'aria-hidden': 'true', 'data-tb-region': 'idle-kick-interstitial' }),
        ),
      ),
    );

    document.body.classList.add('intro-active');
    ui().append(root);
    requestAnimationFrame(() => root.classList.add('intro-ready'));

    email.focus();
  });
}

export function closeIntroGate() {
  document.querySelector('.intro-gate')?.remove();
  document.body.classList.remove('intro-active');
}
