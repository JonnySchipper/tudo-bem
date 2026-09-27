import { signIn, signInOpsSmoke, signUp } from '../auth/client';
import { fetchPublicConfig } from '../auth/config';
import { introAlreadyPassed, markIntroPassed, readAuthSession, writeAuthSession } from '../auth/session';
import { h, ui } from './dom';
import { mountIntroParrots, type SkyBand } from './introParrots';
import { createIntroHeroScene } from './introHeroScene';
import { mountIntroAtmosphere } from './introAtmosphere';
import { runIntroTitleBeat } from './introTitleBeat';
import { ambience } from '../ambience';
import { icon } from '../art/ui';

type IntroMode = 'login' | 'register';

export interface IntroGateResult {
  mode: 'guest' | 'auth';
  email?: string;
}

/** Must match the split-layout media query in styles/intro.css. */
const WIDE_QUERY = '(min-width: 900px) and (min-aspect-ratio: 5/4), (min-width: 600px) and (min-aspect-ratio: 3/2) and (max-height: 520px)';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function field(pt: string, control: HTMLElement) {
  return h('div', { class: 'intro-field' }, h('label', { for: control.id }, pt), control);
}

function wordmark(text: string) {
  return h(
    'h1',
    { id: 'intro-title', class: 'intro-wordmark' },
    h('span', { class: 'intro-sr' }, text),
    ...[...text].map((ch, i) =>
      h('span', { class: ch === ' ' ? 'intro-letter intro-letter-space' : 'intro-letter', style: `--i:${i}`, 'aria-hidden': 'true' }, ch === ' ' ? '\u00a0' : ch),
    ),
  );
}

/**
 * Title-screen gate: Praça + parrot flock beat, then sign-in / register or continue as Phase 0 guest.
 * Resolves when the player may connect to the world socket. `guestEntersWorld: false` (the multiplayer
 * server) keeps the guest CTA but steers it to Criar conta instead of resolving.
 */
export function runIntroGate({ guestEntersWorld = true }: { guestEntersWorld?: boolean } = {}): Promise<IntroGateResult> {
  if (introAlreadyPassed()) {
    const session = readAuthSession();
    return Promise.resolve({ mode: session ? 'auth' : 'guest', email: session?.email });
  }

  return new Promise((resolve) => {
    const reduced = prefersReducedMotion();
    const root = h('div', { class: 'intro-gate', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'intro-title' });
    const atmosphere = h('canvas', { class: 'intro-particles', 'aria-hidden': 'true' });
    const heroScene = createIntroHeroScene();
    const veil = h('div', { class: 'intro-veil tb-world-veil', 'aria-hidden': 'true' });
    const glow = h('div', { class: 'intro-layer intro-glow', 'aria-hidden': 'true' });
    const skipBtn = h('button', { type: 'button', class: 'intro-skip', id: 'intro-skip' }, 'Pular', h('span', { class: 'intro-skip-arrow', 'aria-hidden': 'true' }, '›'));

    let enterDone = false;
    let resolveEnter!: () => void;
    const enterReady = new Promise<void>((r) => {
      resolveEnter = r;
    });
    const enterBtn = h(
      'button',
      { type: 'button', class: 'intro-enter primary intro-cta', id: 'intro-enter', 'aria-describedby': 'intro-enter-hint' },
      'Entrar',
      h('span', { class: 'en' }, 'Enter'),
    );
    const enterHint = h(
      'p',
      { id: 'intro-enter-hint', class: 'intro-enter-hint' },
      'Um toque para a praça — música e araras juntas.',
      h('span', { class: 'en' }, 'One tap — music and parrots together.'),
    );
    const enterLayer = h('div', { class: 'intro-enter-layer', role: 'group', 'aria-label': 'Começar' }, enterHint, enterBtn);

    // Music bed: the one switch is the saved tb_music choice (same as the HUD).
    const musicBtn = h('button', { type: 'button', class: 'intro-music', id: 'intro-music' });
    const renderMusic = () => {
      const on = ambience.enabled;
      const waiting = on && !ambience.running;
      musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      musicBtn.classList.toggle('is-waiting', waiting);
      musicBtn.title = on ? 'Música: sim / Music on' : 'Música: não / Music off';
      musicBtn.replaceChildren(
        icon(on ? 'musicOn' : 'musicOff', 18),
        h('span', { class: 'intro-music-label' }, waiting ? 'Tocar música' : on ? 'Música' : 'Sem música'),
      );
    };
    let audibleAtPress = false;
    const notePress = () => {
      audibleAtPress = ambience.enabled && ambience.running;
    };
    musicBtn.addEventListener('pointerdown', notePress);
    musicBtn.addEventListener('keydown', notePress);
    musicBtn.addEventListener('pointerup', (e) => e.stopPropagation());
    musicBtn.addEventListener('click', () => {
      if (ambience.enabled && !audibleAtPress) {
        // Autoplay was blocked: this first press starts the music rather than muting it.
        ambience.unlock();
      } else {
        ambience.setEnabled(!ambience.enabled);
        if (ambience.enabled) {
          ambience.unlock();
          if (root.classList.contains('intro-phase-auth')) ambience.introReveal();
        }
      }
      renderMusic();
    });
    renderMusic();

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
      placeholder: 'Sua senha',
    });
    const adult = h('input', { type: 'checkbox', id: 'intro-18', name: 'confirm18' });
    const adultRow = h(
      'label',
      { class: 'intro-adult', for: 'intro-18', style: 'display:none' },
      adult,
      h('span', null, 'Tenho 18 anos ou mais.', h('span', { class: 'en' }, 'I am 18 or older.')),
    );

    const tabLogin = h('button', { type: 'button', class: 'intro-tab on', id: 'intro-tab-login', role: 'tab', 'aria-selected': 'true' }, 'Entrar');
    const tabRegister = h('button', { type: 'button', class: 'intro-tab', id: 'intro-tab-register', role: 'tab', 'aria-selected': 'false' }, 'Criar conta');
    const submit = h('button', { type: 'submit', class: 'primary intro-submit intro-cta', id: 'intro-submit' }, 'Entrar');
    const panelTitle = h('h2', { id: 'intro-panel-title', tabindex: '-1' }, 'Bem-vindo de volta');
    const smoke = h(
      'button',
      { type: 'button', class: 'intro-smoke', id: 'intro-smoke', style: 'display:none' },
      'Entrar (Ops smoke)',
      h('span', { class: 'en' }, 'Ops smoke sign-in'),
    );
    const guest = h(
      'button',
      { type: 'button', class: 'intro-guest', id: 'intro-guest' },
      h('span', { class: 'intro-guest-pt' }, 'Explorar como visitante', h('span', { class: 'intro-guest-arrow', 'aria-hidden': 'true' }, '→')),
      guestEntersWorld
        ? h('span', { class: 'intro-guest-sub' }, 'Conheça a praça sem conta', h('span', { class: 'en' }, 'Try the square without an account'))
        : h('span', { class: 'intro-guest-sub' }, 'Pra jogar com a galera, crie uma conta', h('span', { class: 'en' }, 'To play with others, create an account')),
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
      tabsEl.classList.toggle('is-register', !login);
      submit.textContent = login ? 'Entrar' : 'Criar conta';
      panelTitle.textContent = login ? 'Bem-vindo de volta' : 'Crie sua conta';
      password.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
      password.placeholder = login ? 'Sua senha' : 'Crie uma senha';
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

    const teardowns: (() => void)[] = [];

    const finish = (result: IntroGateResult) => {
      markIntroPassed();
      ambience.setScene(null);
      for (const t of teardowns) t();
      root.classList.add('intro-exit');
      window.setTimeout(() => {
        root.remove();
        document.body.classList.remove('intro-active');
        resolve(result);
      }, reduced ? 0 : 420);
    };

    smoke.addEventListener('click', async () => {
      clearError();
      smoke.disabled = true;
      const result = await signInOpsSmoke();
      smoke.disabled = false;
      if (!result.ok) return setError(result.pt, result.en);
      finish({ mode: 'auth', email: result.session.email });
    });

    void fetchPublicConfig().then((cfg) => {
      if (cfg.opsSmoke) smoke.style.display = '';
    });

    guest.addEventListener('click', () => {
      if (guestEntersWorld) return finish({ mode: 'guest' });
      // Multiplayer is account-only (the server answers authRequired); visitors are pointed at Criar conta.
      mode = 'register';
      syncTabs();
      setError('Pra entrar na Praça com a galera, crie sua conta — é rapidinho.', 'To join the shared Praça, create an account — it only takes a moment.');
      email.focus({ preventScroll: true });
    });

    const tabsEl = h('div', { class: 'intro-tabs', role: 'tablist', 'aria-label': 'Entrar ou criar conta' }, h('span', { class: 'intro-tab-thumb', 'aria-hidden': 'true' }), tabLogin, tabRegister);

    const form = h(
      'form',
      { class: 'intro-form', novalidate: true },
      tabsEl,
      field('E-mail', email),
      field('Senha (8+ caracteres)', password),
      adultRow,
      err,
      h('div', { class: 'intro-actions' }, submit),
      h('div', { class: 'intro-or', 'aria-hidden': 'true' }, h('span', null, 'ou')),
      smoke,
      guest,
      h('p', { class: 'intro-legal' }, 'Fase 0 · sua conta guarda seu avatar, suas RV e sua kitnet.'),
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      submit.disabled = true;
      const creds = { email: email.value, password: password.value };
      // Only solo builds (no auth server) may fall back to a local stub session.
      const offlineStub = guestEntersWorld;
      const result = mode === 'login' ? await signIn(creds, { offlineStub }) : await signUp(creds, { confirm18: adult.checked, offlineStub });
      submit.disabled = false;
      if (!result.ok) return setError(result.pt, result.en);
      if (mode === 'register') writeAuthSession({ ...result.session, ageGateConfirmed: adult.checked });
      finish({ mode: 'auth', email: result.session.email });
    });

    const markWrap = h('div', { class: 'intro-mark-wrap', 'aria-hidden': 'true' }, h('div', { class: 'intro-mark-sun' }), h('div', { class: 'intro-mark' }));
    const title = wordmark('Tudo Bem');
    const taglines = h(
      'div',
      { class: 'intro-taglines' },
      h('p', { class: 'intro-tagline' }, 'Chega na praça — café, vizinhos e português no dia a dia.'),
      h('p', { class: 'intro-tagline en', 'aria-hidden': 'true' }, 'A friendly São Paulo square to learn Portuguese.'),
    );
    const hero = h('header', { class: 'intro-hero' }, markWrap, title, taglines);
    const panel = h(
      'section',
      { class: 'panel intro-panel tb-world-card', 'aria-labelledby': 'intro-panel-title' },
      h('div', { class: 'intro-card-awning', 'aria-hidden': 'true' }),
      panelTitle,
      form,
      h('div', { id: 'tb-idle-kick-slot', class: 'tb-idle-kick-slot', hidden: true, 'aria-hidden': 'true', 'data-tb-region': 'idle-kick-interstitial' }),
    );

    root.append(heroScene.el, glow, atmosphere, veil, musicBtn, skipBtn, h('div', { class: 'intro-shell' }, hero, panel), enterLayer);

    document.body.classList.add('intro-active');
    root.classList.add('intro-phase-enter');
    panel.inert = true;
    ui().append(root);

    let skyBand: SkyBand = { top: 24, bottom: 160 };
    /**
     * The wordmark's resting place is the sign-in layout; during the title beat it is
     * transformed to screen centre (FLIP) so the reveal is one continuous camera move.
     */
    const layoutHero = () => {
      root.classList.add('intro-hold', 'intro-measure');
      const rr = root.getBoundingClientRect();
      const r = hero.getBoundingClientRect();
      heroScene.frame({ cardTop: panel.getBoundingClientRect().top - rr.top, heroBottom: r.bottom - rr.top });
      const vh = rr.height;
      const wide = window.matchMedia(WIDE_QUERY).matches;
      // Wide screens keep the wordmark in its column (the Praça is the centrepiece); phones centre it.
      const s = wide ? 1.06 : 1.14;
      const cy = wide ? r.top - rr.top + r.height / 2 + vh * 0.04 : vh * 0.3;
      const dx = wide ? 0 : rr.width / 2 - (r.left - rr.left + r.width / 2);
      const dy = cy - (r.top - rr.top + r.height / 2);
      root.style.setProperty('--hero-dx', `${dx.toFixed(1)}px`);
      root.style.setProperty('--hero-dy', `${dy.toFixed(1)}px`);
      root.style.setProperty('--hero-s', String(s));
      const titleTop = cy - (r.height * s) / 2;
      const top = Math.max(18, vh * 0.035);
      skyBand = { top, bottom: Math.max(top + 96, titleTop - 12) };
      root.classList.remove('intro-measure');
      void hero.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('intro-hold')));
    };
    layoutHero();

    teardowns.push(ambience.onChange(renderMusic));
    teardowns.push(mountIntroAtmosphere(atmosphere, reduced));
    if (!reduced) teardowns.push(heroScene.mountParallax());
    const parrots = mountIntroParrots(root, panel, reduced, {
      band: () => skyBand,
      waitForStart: enterReady,
      // The painted parts only — the header box spans the whole empty left column on desktop.
      keepClear: () => [markWrap, title, taglines, root.classList.contains('intro-phase-auth') ? panel : null],
    });
    teardowns.push(parrots.teardown);

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        layoutHero();
        parrots.syncClip();
      });
    };
    window.addEventListener('resize', onResize);
    teardowns.push(() => {
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener('resize', onResize);
    });

    requestAnimationFrame(() => root.classList.add('intro-ready'));

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reveal = () => {
      panel.inert = false;
      ambience.introReveal();
      // Opening the soft keyboard on reveal would bury the Praça on phones.
      if (coarse) panelTitle.focus({ preventScroll: true });
      else email.focus({ preventScroll: true });
    };

    const beginIntro = () => {
      if (enterDone) return;
      enterDone = true;
      enterLayer.remove();
      root.classList.remove('intro-phase-enter');
      ambience.unlock();
      ambience.setScene('intro');
      renderMusic();
      resolveEnter();
      if (reduced) {
        root.classList.add('intro-phase-auth');
        reveal();
      } else {
        root.classList.add('intro-phase-title');
        teardowns.push(runIntroTitleBeat(root, reveal, false));
      }
    };

    enterBtn.addEventListener('click', beginIntro);
    const onEnterKey = (e: KeyboardEvent) => {
      if (enterDone) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if ((e.target as Element | null)?.closest?.('input, textarea, select, button:not(#intro-enter)')) return;
      e.preventDefault();
      beginIntro();
    };
    window.addEventListener('keydown', onEnterKey);
    teardowns.push(() => window.removeEventListener('keydown', onEnterKey));
    requestAnimationFrame(() => enterBtn.focus({ preventScroll: true }));
  });
}

export function closeIntroGate() {
  document.querySelector('.intro-gate')?.remove();
  document.body.classList.remove('intro-active');
}
