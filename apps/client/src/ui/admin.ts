/**
 * Hidden admin panel (opened from a plain-looking credits line). Login asks the server for the password;
 * once unlocked, kick players, pin the shared clock / weather, and grant RV to yourself.
 */
import { WEATHER_COPY, WEATHER_KINDS, formatClock, type AdminPlayerRow, type ClientMsg, type ServerMsg, type Weather } from '@tudobem/shared';
import { clock } from '../gameClock';
import { game } from '../state';
import { h, en } from './dom';
import { closeModal, modalId, openModal } from './modal.js';

export type AdminSend = (m: Extract<ClientMsg, { t: 'admin' }>) => void;

let sendAdmin: AdminSend | null = null;
let panelRoot: HTMLElement | null = null;
let playersEl: HTMLElement | null = null;
let authError: HTMLElement | null = null;
let unlocked = false;

/** Wire the WebSocket sender (called once from main). */
export function bindAdmin(send: AdminSend): void {
  sendAdmin = send;
}

export function isAdminUnlocked(): boolean {
  return unlocked;
}

/** Handle `admin` and `sky` server messages. */
export function onAdminMsg(m: Extract<ServerMsg, { t: 'admin' } | { t: 'sky' }>): void {
  if (m.t === 'sky') {
    clock.syncServer(m.serverNow);
    clock.setWeather(m.weather);
    return;
  }
  if (m.phase === 'disabled') {
    unlocked = false;
    if (authError) {
      authError.hidden = false;
      authError.textContent = m.pt;
    }
    return;
  }
  if (m.phase === 'auth') {
    unlocked = m.ok;
    if (m.ok) openAdminPanel();
    else if (authError) {
      authError.hidden = false;
      authError.textContent = m.pt;
    } else if (modalId() === 'admin') {
      // Socket lost its admin flag (reconnect): bounce back to the password form.
      openAdminLogin();
      if (authError) {
        authError.hidden = false;
        authError.textContent = m.pt;
      }
    }
    return;
  }
  if (m.phase === 'players') renderPlayers(m.players);
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
