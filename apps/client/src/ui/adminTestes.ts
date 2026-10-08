/**
 * Testes section of the hidden admin panel. Every button is a server action; the password gate stays on the socket.
 */
import {
  ADMIN_TEST_ROOMS,
  BELT_LABELS,
  BELT_LADDER,
  ESCOLA_GOALS,
  adminTestRoomLabel,
  type AdminTestSnapshot,
  type Belt,
  type ClientMsg,
} from '@tudobem/shared';
import { h, en } from './dom';

type Send = (m: Extract<ClientMsg, { t: 'admin' }>) => void;

let sendAdmin: Send | null = null;
let snap: AdminTestSnapshot | null = null;
let resetArmed = false;
let readEl: HTMLElement | null = null;
let foundEl: HTMLElement | null = null;

export function bindAdminTestes(send: Send): void {
  sendAdmin = send;
}

export function adminTestesSection(): HTMLElement {
  readEl = h('p', { class: 'admin-test-read', id: 'admin-test-read' }, 'Carregando…');
  foundEl = h('p', { class: 'admin-test-found', id: 'admin-test-found' }, '');
  const user = h('input', {
    type: 'text',
    id: 'admin-test-user',
    class: 'admin-time',
    placeholder: 'seu perfil',
    'aria-label': 'Jogador (vazio = você)',
  }) as HTMLInputElement;
  const coins = h('input', { type: 'number', id: 'admin-test-coins', class: 'admin-time', min: '0', max: '1000000', value: '10', 'aria-label': 'RV' }) as HTMLInputElement;
  const xp = h('input', { type: 'number', id: 'admin-test-xp', class: 'admin-time', min: '1', max: '100000', value: '10', 'aria-label': 'XP' }) as HTMLInputElement;
  const streak = h('input', { type: 'number', id: 'admin-test-streak', class: 'admin-time', min: '0', max: '9999', value: '1', 'aria-label': 'Sequência' }) as HTMLInputElement;
  const words = h('input', { type: 'number', id: 'admin-test-words', class: 'admin-time', min: '0', value: '3', 'aria-label': 'Palavras' }) as HTMLInputElement;
  const time = h('input', { type: 'time', id: 'admin-test-time', class: 'admin-time', value: '10:30', 'aria-label': 'Hora do teste' }) as HTMLInputElement;
  const resetBtn = h('button', { type: 'button', class: 'ghost', id: 'admin-test-reset' }, 'Resetar meu perfil de teste');

  resetBtn.addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = 'Confirmar reset';
      return;
    }
    resetArmed = false;
    resetBtn.textContent = 'Resetar meu perfil de teste';
    go({ t: 'admin', action: 'testReset', confirm: true });
  });

  return h(
    'section',
    { class: 'admin-testes', id: 'admin-testes' },
    h('h3', null, 'Testes'),
    en('Your own profile, unless you type a username. Logged on the server. Hidden from other players.'),
    h('label', { class: 'admin-label', for: 'admin-test-user' }, 'Jogador', en('Username, empty = you', true)),
    user,
    readEl,
    h('h4', null, 'Faixa'),
    en('Sets the win count that rank already means. Stripe pace stays.'),
    h(
      'div',
      { class: 'admin-test-row', role: 'group', 'aria-label': 'Faixa' },
      ...BELT_LADDER.map((step) =>
        h(
          'button',
          {
            type: 'button',
            class: 'admin-test-belt',
            id: `admin-test-belt-${step.belt}`,
            onclick: () => go({ t: 'admin', action: 'testBelt', belt: step.belt }),
          },
          shortBelt(step.belt),
        ),
      ),
    ),
    h(
      'div',
      { class: 'admin-test-row' },
      h('button', { type: 'button', id: 'admin-test-stripe-minus', onclick: () => nudgeStripe(-1) }, '− grau'),
      h('button', { type: 'button', id: 'admin-test-stripe-plus', onclick: () => nudgeStripe(1) }, '+ grau'),
      h('button', { type: 'button', id: 'admin-test-wins-minus', onclick: () => go({ t: 'admin', action: 'testBelt', deltaWins: -1 }) }, '− vitória'),
      h('button', { type: 'button', id: 'admin-test-wins-plus', onclick: () => go({ t: 'admin', action: 'testBelt', deltaWins: 1 }) }, '+ vitória'),
    ),
    foundEl,
    h('h4', null, 'RV, XP e placa'),
    h(
      'div',
      { class: 'admin-test-row' },
      coins,
      h('button', { type: 'button', id: 'admin-test-coins-go', onclick: () => go({ t: 'admin', action: 'testCoins', coins: num(coins, 0) }) }, 'Definir RV'),
      xp,
      h('button', { type: 'button', id: 'admin-test-xp-go', onclick: () => go({ t: 'admin', action: 'testProgress', xp: num(xp, 1), tz: tz() }) }, 'Somar XP'),
      ...ESCOLA_GOALS.map((goal) =>
        h('button', { type: 'button', class: 'admin-test-goal', id: `admin-test-goal-${goal}`, onclick: () => go({ t: 'admin', action: 'testProgress', goal, tz: tz() }) }, `Meta ${goal}`),
      ),
      h('button', { type: 'button', id: 'admin-test-verde', onclick: () => go({ t: 'admin', action: 'testProgress', verde: !(snap?.verdeMode ?? false), tz: tz() }) }, 'Modo Verde'),
    ),
    h('h4', null, 'Escola'),
    h(
      'div',
      { class: 'admin-test-row' },
      streak,
      h('button', { type: 'button', id: 'admin-test-streak-go', onclick: () => go({ t: 'admin', action: 'testEscola', streak: num(streak, 0), tz: tz() }) }, 'Sequência'),
      words,
      h('button', { type: 'button', id: 'admin-test-words-go', onclick: () => go({ t: 'admin', action: 'testEscola', words: num(words, 0), tz: tz() }) }, 'Palavras'),
    ),
    h('h4', null, 'Sala e relógio'),
    h(
      'div',
      { class: 'admin-test-row', role: 'group', 'aria-label': 'Salas' },
      ...ADMIN_TEST_ROOMS.map((room) =>
        h(
          'button',
          { type: 'button', class: 'admin-test-room', id: `admin-test-room-${room}`, onclick: () => go({ t: 'admin', action: 'testTeleport', room }) },
          adminTestRoomLabel(room).pt,
        ),
      ),
    ),
    h(
      'div',
      { class: 'admin-test-row' },
      time,
      h(
        'button',
        {
          type: 'button',
          id: 'admin-test-clock-go',
          onclick: () => {
            const [hh, mm] = time.value.split(':').map(Number);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;
            go({ t: 'admin', action: 'testClock', minute: hh * 60 + mm });
          },
        },
        'Hora',
      ),
      h('button', { type: 'button', id: 'admin-test-day', onclick: () => go({ t: 'admin', action: 'testClock', rollDay: true }) }, 'Próximo dia'),
      h('button', { type: 'button', id: 'admin-test-caps', onclick: () => go({ t: 'admin', action: 'testCaps' }) }, 'Zerar limites de hoje'),
    ),
    h('p', { class: 'admin-test-note' }, 'Hora e próximo dia valem só para este perfil. O relógio do bairro fica no lugar.'),
    h('h4', null, 'Tutorial e padaria'),
    h(
      'div',
      { class: 'admin-test-row' },
      h('button', { type: 'button', id: 'admin-test-tutorial-reset', onclick: () => go({ t: 'admin', action: 'testTutorial', mode: 'reset' }) }, 'Resetar tutorial'),
      h('button', { type: 'button', id: 'admin-test-tutorial-skip', onclick: () => go({ t: 'admin', action: 'testTutorial', mode: 'skip' }) }, 'Pular tutorial'),
      h('button', { type: 'button', id: 'admin-test-menu-2', onclick: () => go({ t: 'admin', action: 'testPadaria', menu: 2 }) }, 'Menu 2'),
      h('button', { type: 'button', id: 'admin-test-menu-6', onclick: () => go({ t: 'admin', action: 'testPadaria', menu: 6 }) }, 'Menu 6'),
      h('button', { type: 'button', id: 'admin-test-menu-12', onclick: () => go({ t: 'admin', action: 'testPadaria', menu: 12 }) }, 'Menu 12'),
      h('button', { type: 'button', id: 'admin-test-stage-0', onclick: () => go({ t: 'admin', action: 'testPadaria', stage: 0 }) }, 'Sem padaria'),
      h('button', { type: 'button', id: 'admin-test-stage-1', onclick: () => go({ t: 'admin', action: 'testPadaria', stage: 1 }) }, 'Balcão'),
      h('button', { type: 'button', id: 'admin-test-stage-2', onclick: () => go({ t: 'admin', action: 'testPadaria', stage: 2 }) }, 'Padaria'),
      h('button', { type: 'button', id: 'admin-test-stage-3', onclick: () => go({ t: 'admin', action: 'testPadaria', stage: 3 }) }, 'Restaurante'),
    ),
    h('h4', null, 'Pet e balão'),
    h(
      'div',
      { class: 'admin-test-row' },
      h('button', { type: 'button', id: 'admin-test-perk-dog', onclick: () => go({ t: 'admin', action: 'testPerk', grant: true, pet: 'dog', bubble: 'sol' }) }, 'Conceder cão'),
      h('button', { type: 'button', id: 'admin-test-perk-cat', onclick: () => go({ t: 'admin', action: 'testPerk', grant: true, pet: 'cat', bubble: 'mar' }) }, 'Conceder gato'),
      h('button', { type: 'button', id: 'admin-test-perk-revoke', onclick: () => go({ t: 'admin', action: 'testPerk', revoke: true }) }, 'Revogar'),
    ),
    resetBtn,
  );
}

export function onAdminTestState(state: AdminTestSnapshot): void {
  snap = state;
  resetArmed = false;
  const resetBtn = document.getElementById('admin-test-reset');
  if (resetBtn) resetBtn.textContent = 'Resetar meu perfil de teste';
  if (readEl) {
    const belt = BELT_LABELS[state.belt].pt;
    readEl.textContent = `${state.name} · ${belt} ${state.stripes} · ${state.wins} vitórias · R$${state.coins} · XP ${state.dayXp}/${state.goal} · sequência ${state.streak} · ${state.words} palavras`;
  }
  if (foundEl) foundEl.textContent = state.canFound ? 'Pode fundar academia.' : 'Ainda não funda academia.';
  for (const step of BELT_LADDER) {
    document.getElementById(`admin-test-belt-${step.belt}`)?.classList.toggle('on', step.belt === state.belt);
  }
  document.getElementById('admin-test-verde')?.classList.toggle('on', state.verdeMode);
  for (const goal of ESCOLA_GOALS) document.getElementById(`admin-test-goal-${goal}`)?.classList.toggle('on', goal === state.goal);
  const coins = document.getElementById('admin-test-coins');
  if (coins instanceof HTMLInputElement && document.activeElement !== coins) coins.value = String(state.coins);
}

function go(msg: Extract<ClientMsg, { t: 'admin' }>): void {
  const typed = (document.getElementById('admin-test-user') as HTMLInputElement | null)?.value.trim();
  const out = typed ? { ...msg, username: typed } : msg;
  sendAdmin?.(out as Extract<ClientMsg, { t: 'admin' }>);
}

function nudgeStripe(delta: number): void {
  const cur = snap?.stripes ?? 0;
  go({ t: 'admin', action: 'testBelt', stripes: Math.max(0, Math.min(4, cur + delta)) });
}

function num(input: HTMLInputElement, fallback: number): number {
  const n = Math.floor(Number(input.value));
  return Number.isFinite(n) ? n : fallback;
}

function tz(): number {
  return -new Date().getTimezoneOffset();
}

function shortBelt(belt: Belt): string {
  return BELT_LABELS[belt].pt.replace('Faixa ', '');
}
