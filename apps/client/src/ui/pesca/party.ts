/**
 * The party boat on the client (PRAIA-PLAN.md 5.3 to 5.5): the invite modal ("Bora pro barco de festa?"), the HUD pill while aboard
 * (who is aboard and the time left as words, never a countdown, with one-tap "Desembarcar"), the trip card at the end, and the hooks
 * the Friends panel and the profile card use (invite a friend, send a guest ashore). Display names only, everywhere.
 */
import { FISH, PARTY_LINES, furnitureById, hatById, partyTimeWords, type ClientMsg, type PartySummary, type ServerMsg } from '@tudobem/shared';
import { game } from '../../state';
import { clock } from '../../gameClock';
import { speak } from '../../audio';
import { ambience } from '../../ambience';
import { h, bi, en } from '../dom';
import { foodIcon } from '../pixelArt';
import { openModal, closeModal } from '../modal.js';
import { toast } from '../hud';

type StateMsg = Extract<ServerMsg, { t: 'party'; phase: 'state' }>;

let send: (m: ClientMsg) => void = () => {};
let trip: StateMsg | null = null;
let pill: HTMLElement | null = null;
let pillTimer = 0;
/** the server's clock (trip times are server time) */
const serverNow = () => Date.now() + clock.skewMs;

export function bindParty(sendFn: (m: ClientMsg) => void) {
  send = sendFn;
  const tb = ((window as unknown as { __tb?: Record<string, unknown> }).__tb ??= {});
  tb.party = {
    create: () => createParty(),
    invite: (id: string) => inviteToBoat(id),
    accept: (tripId: string) => send({ t: 'party', action: 'accept', tripId }),
    leave: () => send({ t: 'party', action: 'leave' }),
    end: () => send({ t: 'party', action: 'end' }),
    state: () => trip,
  };
}

export const createParty = () => send({ t: 'party', action: 'create' });
export const inviteToBoat = (targetId: string) => send({ t: 'party', action: 'invite', targetId });
export const sendAshore = (targetId: string) => send({ t: 'party', action: 'remove', targetId });

/** Am I the host of a trip under way (the Friends panel's "Convidar pro barco")? */
export const hostingParty = () => !!trip && trip.hostId === game.room?.selfId;
/** Is this player aboard my trip (the profile card's "Desembarcar")? */
export const aboardMyParty = (id: string) => hostingParty() && id !== trip!.hostId && trip!.members.some((m) => m.id === id);

export function onPartyMsg(m: Extract<ServerMsg, { t: 'party' }>) {
  if (m.phase === 'invite') return showInvite(m);
  if (m.phase === 'state') {
    // the music starts when the second person boards (5.4): the win stinger swells over the deck's bed, once per trip
    if (m.music && !trip?.music && game.sound) ambience.sting('win');
    trip = m;
    return renderPill();
  }
  if (m.phase === 'ended') {
    trip = null;
    renderPill();
    // still on the deck: the move to the pier comes next and a room change closes every modal, so the card waits for it
    if (m.summary && game.room?.room === 'barco_festa') pendingSummary = m.summary;
    else if (m.summary) showSummary(m.summary);
    else if (document.querySelector('[data-modal="party-invite"]')) closeModal();
  }
}

let pendingSummary: PartySummary | null = null;

/** After a room state (main.ts): the trip card that was waiting for the walk ashore. */
export function onPartyRoomChanged() {
  if (!pendingSummary || game.room?.room === 'barco_festa') return;
  const sum = pendingSummary;
  pendingSummary = null;
  showSummary(sum);
}

/** Someone else aboard landed a fish: its name, said aloud (display name in the toast, never spoken). */
export function onAboardCatch(m: Extract<ServerMsg, { t: 'pesca'; phase: 'aboard' }>) {
  toast('reward', `${m.by} pescou: ${m.pt}!`, `${m.by} caught: ${m.en}!`);
  speak(m.pt, { speaker: 'ui' });
}

// ---------------------------------------------------------------- the invite

function showInvite(m: Extract<ServerMsg, { t: 'party'; phase: 'invite' }>) {
  speak(PARTY_LINES.bora.pt, { speaker: 'ui' });
  const close = () => closeModal();
  openModal(
    'party-invite',
    h(
      'div',
      { class: 'panel party-invite' },
      h('div', { class: 'party-invite-boat', 'aria-hidden': 'true' }),
      h('h2', null, PARTY_LINES.bora.pt),
      en(PARTY_LINES.bora.en),
      h('p', null, h('b', null, m.fromName), ' te chamou pro barco de festa.', en(` ${m.fromName} invited you to the party boat.`, true)),
      h(
        'div',
        { class: 'row', style: 'justify-content:center;gap:10px' },
        h('button', { class: 'primary', id: 'btn-party-accept', onclick: () => (close(), send({ t: 'party', action: 'accept', tripId: m.tripId })) }, bi('Aceitar', 'Accept')),
        h('button', { class: 'ghost', id: 'btn-party-decline', onclick: () => (close(), send({ t: 'party', action: 'decline', tripId: m.tripId })) }, bi('Agora não', 'Not now')),
      ),
    ),
  );
  // an unanswered invite quietly goes away
  window.setTimeout(() => {
    if (document.querySelector('[data-modal="party-invite"]')) closeModal();
  }, Math.max(0, m.expiresAt - serverNow()));
}

// ---------------------------------------------------------------- the pill

function renderPill() {
  window.clearInterval(pillTimer);
  if (!trip) {
    pill?.remove();
    pill = null;
    return;
  }
  if (!pill) {
    pill = h('div', { class: 'party-pill hud-slab', id: 'party-pill', role: 'status' });
    document.getElementById('ui')?.appendChild(pill);
  }
  const t = trip;
  const isHost = t.hostId === game.room?.selfId;
  const paint = () => {
    const words = partyTimeWords(t.endsAt, serverNow());
    pill!.replaceChildren(
      h('span', { class: 'party-pill-boat', 'aria-hidden': 'true' }),
      h('span', { class: 'party-pill-text' }, h('b', null, `Barco de festa · ${t.members.length} a bordo`), words ? h('i', { class: 'party-pill-late' }, ` · ${words.pt}`) : null, en(` Party boat · ${t.members.length} aboard${words ? ` · ${words.en}` : ''}`, true)),
      h('button', { class: 'ghost', id: 'btn-party-leave', type: 'button', onclick: () => leave(isHost) }, bi('Desembarcar', 'Go ashore')),
    );
  };
  paint();
  pillTimer = window.setInterval(paint, 15_000);
}

/** One tap for a guest; the host is asked first, because the whole boat goes back. */
function leave(isHost: boolean) {
  if (!isHost) return send({ t: 'party', action: 'leave' });
  openModal(
    'party-end',
    h(
      'div',
      { class: 'panel party-invite' },
      h('h2', null, PARTY_LINES.encerrar.pt),
      en(PARTY_LINES.encerrar.en),
      h(
        'div',
        { class: 'row', style: 'justify-content:center;gap:10px' },
        h('button', { class: 'primary', id: 'btn-party-end', onclick: () => (closeModal(), send({ t: 'party', action: 'end' })) }, bi('Encerrar', 'End it')),
        h('button', { class: 'ghost', onclick: () => closeModal() }, bi('Continuar a festa', 'Keep partying')),
      ),
    ),
  );
}

// ---------------------------------------------------------------- the trip card

const earnedName = (id: string) => hatById(id) ?? furnitureById(id);

function showSummary(sum: PartySummary) {
  speak(PARTY_LINES.voltou.pt, { speaker: 'ui' });
  const fish = h(
    'div',
    { class: 'party-sum-fish' },
    ...(sum.fish.length
      ? sum.fish.map((f) => h('div', { class: 'party-sum-catch' }, foodIcon(`peixe_${f.fish}`, 2, FISH[f.fish].pt), h('b', null, FISH[f.fish].pt), h('span', null, f.by)))
      : [h('p', { class: 'party-sum-none' }, 'Nenhum peixe dessa vez. A festa valeu mesmo assim!', en(' No fish this time. The party was worth it anyway!', true))]),
  );
  openModal(
    'party-summary',
    h(
      'div',
      { class: 'panel party-summary' },
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, PARTY_LINES.voltou.pt),
      en(PARTY_LINES.voltou.en),
      h('div', { class: 'section-title' }, 'A bordo', en(' Aboard', true)),
      h('p', { class: 'party-sum-members' }, sum.members.join(' · ')),
      h('div', { class: 'section-title' }, 'Peixes', en(' Fish', true)),
      fish,
      sum.words.length ? h('div', { class: 'section-title' }, 'Palavras da festa', en(' Words from the party', true)) : null,
      sum.words.length ? h('div', { class: 'party-sum-words' }, ...sum.words.map((w) => h('span', { class: 'party-sum-word' }, h('b', null, w.pt), en(` ${w.en}`, true)))) : null,
      sum.earned.length
        ? h(
            'div',
            { class: 'party-sum-earned' },
            h('div', { class: 'section-title' }, 'Você ganhou', en(' You earned', true)),
            ...sum.earned.map((id) => {
              const def = earnedName(id);
              return h('div', { class: 'party-sum-item', 'data-item': id }, h('b', null, def?.pt ?? id), en(` ${def?.en ?? ''}`, true));
            }),
          )
        : null,
    ),
  );
}
