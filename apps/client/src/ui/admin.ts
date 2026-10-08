/**
 * Hidden admin panel (opened from a plain-looking credits line). Login asks the server for the password;
 * once unlocked, kick players, pin the shared clock / weather, and grant RV to yourself.
 */
import { WEATHER_COPY, WEATHER_KINDS, formatClock, type AdminPlayerRow, type AdminSubscriberRow, type ClientMsg, type FeiraCartAdminGame, type FeiraGameId, type ServerMsg, type Weather } from '@tudobem/shared';
import { clock } from '../gameClock';
import { game } from '../state';
import { h, en } from './dom';
import { closeModal, modalId, openModal } from './modal.js';

export type AdminSend = (m: Extract<ClientMsg, { t: 'admin' }>) => void;

let sendAdmin: AdminSend | null = null;
let panelRoot: HTMLElement | null = null;
let playersEl: HTMLElement | null = null;
let feiraEl: HTMLElement | null = null;
let feiraFeaturedEl: HTMLElement | null = null;
let subsEl: HTMLElement | null = null;
let authError: HTMLElement | null = null;
let unlocked = false;

/** Wire the WebSocket sender (called once from main). */
export function bindAdmin(send: AdminSend): void {
  sendAdmin = send;
}

export function isAdminUnlocked(): boolean {
  return unlocked;
}

let onDesignAdmin: ((m: Extract<ServerMsg, { t: 'admin' }>) => void) | null = null;

/** Design mode (lazy chunk) hears admin replies without living in the main bundle. */
export function bindDesignAdmin(fn: (m: Extract<ServerMsg, { t: 'admin' }>) => void): void {
  onDesignAdmin = fn;
}

async function openDesignMode(): Promise<void> {
  if (!sendAdmin) return;
  const send = sendAdmin;
  closeModal();
  const { toggleDesignMode } = await import('./designMode.js');
  toggleDesignMode(send);
}

/** Handle `admin` and `sky` server messages. */
export function onAdminMsg(m: Extract<ServerMsg, { t: 'admin' } | { t: 'sky' }>): void {
  if (m.t === 'sky') {
    clock.syncServer(m.serverNow);
    clock.setWeather(m.weather);
    return;
  }
  onDesignAdmin?.(m);
  if (m.phase === 'disabled') {
    unlocked = false;
    showAuthError(m.pt);
    return;
  }
  if (m.phase === 'auth') {
    unlocked = m.ok;
    if (m.ok) openAdminPanel();
    else if (authError) showAuthError(m.pt);
    else if (modalId() === 'admin') {
      // Socket lost its admin flag (reconnect): bounce back to the password form.
      openAdminLogin();
      showAuthError(m.pt);
    }
    return;
  }
  if (m.phase === 'players') renderPlayers(m.players);
  if (m.phase === 'feiraCart') renderFeiraCart(m.day, m.featured, m.games);
  if (m.phase === 'subscribers') renderSubscribers(m.subscribers);
}

function showAuthError(pt: string): void {
  if (!authError) return;
  authError.hidden = false;
  authError.textContent = pt;
}

/** Open the admin login, or the panel again when this socket is already unlocked. */
export function openAdmin(): void {
  if (unlocked) {
    openAdminPanel();
    return;
  }
  openAdminLogin();
}

/** Login modal: password only. */
export function openAdminLogin(): void {
  authError = h('p', { class: 'admin-err', hidden: true, id: 'admin-auth-err' });
  const input = h('input', {
    type: 'password',
    id: 'admin-password',
    class: 'admin-password',
    autocomplete: 'current-password',
    placeholder: 'Senha',
    'aria-label': 'Senha de admin',
  }) as HTMLInputElement;
  const submit = () => {
    const password = input.value;
    if (!password || !sendAdmin) return;
    authError!.hidden = true;
    sendAdmin({ t: 'admin', action: 'login', password });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  openModal(
    'admin-login',
    h(
      'div',
      { class: 'panel admin-panel', role: 'dialog', 'aria-label': 'Admin' },
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, 'Admin'),
      en('Neighborhood ops — password required.'),
      h('label', { class: 'admin-label', for: 'admin-password' }, 'Senha', en('Password', true)),
      input,
      authError,
      h('button', { class: 'primary', id: 'admin-login-go', onclick: submit }, 'Entrar'),
    ),
  );
  queueMicrotask(() => input.focus());
}

function openAdminPanel(): void {
  playersEl = h('div', { class: 'admin-players', id: 'admin-players' }, h('p', { class: 'admin-empty' }, 'Carregando…'));
  const timeInput = h('input', {
    type: 'time',
    id: 'admin-time',
    class: 'admin-time',
    value: formatClock(clock.minutes()),
    'aria-label': 'Horário do bairro',
  }) as HTMLInputElement;

  const setWeather = (weather: Weather | null) => sendAdmin?.({ t: 'admin', action: 'weather', weather });
  const weatherRow = h(
    'div',
    { class: 'admin-weather', role: 'group', 'aria-label': 'Clima' },
    ...WEATHER_KINDS.map((w) =>
      h('button', { type: 'button', class: 'admin-wx', 'data-weather': w, onclick: () => setWeather(w) }, WEATHER_COPY[w].pt),
    ),
    h('button', { type: 'button', class: 'admin-wx ghost', onclick: () => setWeather(null) }, 'Auto'),
  );

  const money = (amount: number) => sendAdmin?.({ t: 'admin', action: 'money', amount });

  panelRoot = h(
    'div',
    { class: 'panel admin-panel', role: 'dialog', 'aria-label': 'Admin' },
    h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar' }, '✕'),
    h('h2', null, 'Admin'),
    en('Kick players, set the sky, add RV to yourself.'),
    h('h3', null, 'Jogadores'),
    en('Online now — kick frees their seat.', true),
    playersEl,
    h('button', { class: 'ghost', id: 'admin-refresh', onclick: () => sendAdmin?.({ t: 'admin', action: 'list' }) }, 'Atualizar lista'),
    h('h3', null, 'Horário'),
    en('Shared neighborhood clock.', true),
    h(
      'div',
      { class: 'admin-row' },
      timeInput,
      h(
        'button',
        {
          class: 'primary',
          id: 'admin-set-time',
          onclick: () => {
            const [hh, mm] = timeInput.value.split(':').map(Number);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
            sendAdmin?.({ t: 'admin', action: 'clock', minute: hh * 60 + mm });
          },
        },
        'Aplicar',
      ),
    ),
    h('h3', null, 'Clima'),
    en('Pins weather for everyone.', true),
    weatherRow,
    h('h3', { id: 'admin-feira' }, 'Feira — jogos do carrinho'),
    en('Turn each cart game on or off. Today’s pick rotates among the ones that are on.', true),
    (feiraFeaturedEl = h('p', { class: 'admin-feira-featured', id: 'admin-feira-featured' }, 'Hoje: …')),
    (feiraEl = h('div', { class: 'admin-feira-games', id: 'admin-feira-games' }, h('p', { class: 'admin-empty' }, 'Carregando…'))),
    h('h3', null, 'Assinaturas'),
    en('Test subscriptions. No payment. The founder badge and banner stay if you revoke.', true),
    (subsEl = h('div', { class: 'admin-subs', id: 'admin-subs' }, h('p', { class: 'admin-empty' }, '…'))),
    h('button', { class: 'ghost', id: 'admin-subs-refresh', type: 'button', onclick: () => sendAdmin?.({ t: 'admin', action: 'subscribers' }) }, 'Atualizar assinaturas'),
    h('h3', null, 'Modo design'),
    en('Move props in this room. Other players see it when you save.', true),
    h('button', { type: 'button', class: 'primary', id: 'admin-design-toggle', onclick: () => void openDesignMode() }, 'Modo design'),
    h('h3', null, 'Reais virtuais'),
    en('Adds RV to your own pocket.', true),
    h(
      'div',
      { class: 'admin-row admin-money' },
      h('button', { type: 'button', onclick: () => money(10) }, '+10'),
      h('button', { type: 'button', onclick: () => money(50) }, '+50'),
      h('button', { type: 'button', class: 'primary', onclick: () => money(100) }, '+100'),
    ),
    h(
      'button',
      {
        class: 'ghost',
        id: 'admin-logout',
        onclick: () => {
          unlocked = false;
          sendAdmin?.({ t: 'admin', action: 'logout' });
          closeModal();
        },
      },
      'Sair do modo admin',
    ),
  );

  openModal('admin', panelRoot);
  sendAdmin?.({ t: 'admin', action: 'list' });
  sendAdmin?.({ t: 'admin', action: 'feiraCart' });
  sendAdmin?.({ t: 'admin', action: 'subscribers' });
}

function feiraStateLabel(mode: FeiraCartAdminGame['mode']): string {
  if (mode === 'on') return 'Ligado';
  if (mode === 'rotation') return 'Agenda';
  return 'Desligado';
}

function renderFeiraCart(day: string, featured: FeiraGameId | null, games: FeiraCartAdminGame[]): void {
  if (feiraFeaturedEl) {
    const row = featured ? games.find((g) => g.id === featured) : undefined;
    feiraFeaturedEl.textContent = row ? `Hoje: ${row.pt}` : 'Hoje: fechado';
    feiraFeaturedEl.dataset.day = day;
    feiraFeaturedEl.dataset.featured = featured ?? '';
  }
  if (!feiraEl) return;
  feiraEl.replaceChildren();
  if (!games.length) {
    feiraEl.append(h('p', { class: 'admin-empty' }, 'Nenhum jogo no carrinho.'));
    return;
  }
  for (const g of games) {
    const on = g.mode !== 'off';
    feiraEl.append(
      h(
        'button',
        {
          type: 'button',
          class: 'admin-feira-switch',
          id: `admin-feira-${g.id}`,
          role: 'switch',
          'aria-checked': on ? 'true' : 'false',
          'data-mode': g.mode,
          'aria-label': `${g.pt} — ${feiraStateLabel(g.mode)}`,
          onclick: () => sendAdmin?.({ t: 'admin', action: 'feiraCartSet', game: g.id, mode: on ? 'off' : 'on' }),
        },
        h('span', { class: 'admin-feira-name' }, g.pt, en(g.en, true), g.implemented ? null : h('i', { class: 'admin-feira-soon' }, 'em breve', en('not playable yet', true))),
        h('span', { class: 'sw', 'aria-hidden': 'true' }),
        h('span', { class: 'admin-feira-state' }, feiraStateLabel(g.mode)),
      ),
    );
  }
}

function renderPlayers(players: AdminPlayerRow[]): void {
  if (!playersEl) return;
  playersEl.replaceChildren();
  if (!players.length) {
    playersEl.append(h('p', { class: 'admin-empty' }, 'Ninguém online.'));
    return;
  }
  const me = game.profile?.id ?? game.room?.selfId;
  for (const p of players) {
    const row = h(
      'div',
      { class: 'admin-player', 'data-player': p.id },
      h('div', { class: 'admin-player-who' }, h('b', null, p.name), h('span', { class: 'admin-player-room' }, p.roomName ?? '—')),
      p.id === me
        ? h('span', { class: 'admin-you' }, 'você')
        : h(
            'button',
            {
              type: 'button',
              class: 'admin-kick',
              onclick: () => sendAdmin?.({ t: 'admin', action: 'kick', targetId: p.id }),
            },
            'Kick',
          ),
    );
    playersEl.append(row);
  }
}

function renderSubscribers(rows: AdminSubscriberRow[]): void {
  if (!subsEl) return;
  subsEl.replaceChildren();
  if (!rows.length) {
    subsEl.append(h('p', { class: 'admin-empty' }, 'Nenhuma assinatura.'));
    return;
  }
  for (const row of rows) {
    const when = row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toISOString().slice(0, 10) : '—';
    subsEl.append(
      h(
        'div',
        { class: 'admin-player', 'data-sub': row.id },
        h(
          'div',
          { class: 'admin-player-who' },
          h('b', null, row.name),
          h('span', { class: 'admin-player-room' }, `${row.status} · ${when}${row.founderBadge ? ' · selo' : ''}`),
        ),
        h(
          'span',
          { class: 'admin-sub-actions' },
          h('button', { type: 'button', class: 'primary', 'data-grant': row.id, onclick: () => sendAdmin?.({ t: 'admin', action: 'grantSub', targetId: row.id }) }, 'Conceder'),
          h('button', { type: 'button', class: 'ghost', 'data-revoke': row.id, onclick: () => sendAdmin?.({ t: 'admin', action: 'revokeSub', targetId: row.id }) }, 'Revogar'),
        ),
      ),
    );
  }
}
