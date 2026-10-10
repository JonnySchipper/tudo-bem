/**
 * The Praia's fishing on the client (PRAIA-PLAN.md 2.2, 4.2, 7.1): open a spot (a `pesca` prop), play on the stage, the server's answers;
 * Jô's fish tray; Dona Neide's Caderneta de pesca (the log as one page). The stage itself is `pescaStage.ts`.
 */
import { FISH, FISH_IDS, JO_SELL, isFreeWater, speciesCaught, type ClientMsg, type FishId, type PescaTrayRow, type ServerMsg, type WaterId } from '@tudobem/shared';
import { game } from '../../state';
import { speak } from '../../audio';
import { h, bi, en, rvPriceNote } from '../dom';
import { foodIcon } from '../pixelArt';
import { openModal, closeModal } from '../modal.js';
import { toast } from '../hud';
import { PescaStage } from './pescaStage';

let send: (m: ClientMsg) => void = () => {};
let stage: PescaStage | null = null;
let openSpotId: string | null = null;
let returnBoat: (() => void) | null = null;

/** Wire the network once (main.ts). `returnBoatFn` hands a rented boat back (Step D). */
export function bindPesca(sendFn: (m: ClientMsg) => void, returnBoatFn?: () => void) {
  send = sendFn;
  returnBoat = returnBoatFn ?? null;
  // DEV / e2e driver
  const tb = ((window as unknown as { __tb?: Record<string, unknown> }).__tb ??= {});
  tb.pesca = {
    open: (spotId: string) => openPescaSpot(spotId),
    stage: () => stage?.driver() ?? null,
    sell: (fish?: FishId) => send({ t: 'pesca', action: 'sell', ...(fish ? { fish } : {}) }),
  };
}

/** A click on a `pesca` spot: ask the server (proximity, the boat's trip). */
export function openPescaSpot(spotId: string) {
  openSpotId = spotId;
  send({ t: 'pesca', action: 'open', spotId });
}

const WATER_NAME: Record<WaterId, { pt: string; en: string }> = {
  praia: { pt: 'Pesca na praia', en: 'Beach fishing' },
  lagoa: { pt: 'Pesca na lagoa', en: 'Lagoon fishing' },
  remo: { pt: 'Barquinho a remo', en: 'Little rowboat' },
  pesca: { pt: 'Barco de pesca', en: 'Fishing boat' },
  alto_mar: { pt: 'Barco de alto-mar', en: 'Deep-sea boat' },
  festa: { pt: 'Barco de festa', en: 'Party boat' },
};

export function onPescaMsg(m: Extract<ServerMsg, { t: 'pesca' }>) {
  if (m.phase === 'spot') {
    if (!m.canCast) {
      toast('info', m.reason?.pt ?? 'Não dá pra pescar aqui agora.', m.reason?.en ?? 'You can’t fish here right now.');
      return;
    }
    if (stage) return;
    const firstCast = (game.profile?.pesca?.casts ?? 0) === 0;
    toast('info', WATER_NAME[m.water].pt, WATER_NAME[m.water].en);
    stage = new PescaStage(m.water, {
      firstCast,
      cast: (power) => send({ t: 'pesca', action: 'cast', spotId: m.spotId, power }),
      result: (seq, events) => send({ t: 'pesca', action: 'result', seq, events }),
      quit: () => send({ t: 'pesca', action: 'quit' }),
      closed: () => {
        stage = null;
      },
      ...(!isFreeWater(m.water) && m.water !== 'festa' && returnBoat ? { returnBoat: () => returnBoat!() } : {}),
    });
    return;
  }
  if (m.phase === 'cast') return stage?.onCast(m);
  if (m.phase === 'result') return stage?.onResult(m);
  if (m.phase === 'tray') return openTray(m.fish, m.capLeft);
  if (m.phase === 'sold') {
    speak(JO_SELL.sold.pt, { speaker: 'jo' });
    return openTray(m.fish, m.capLeft);
  }
}

/** The server refused a cast (busy, too soon): the stage aims again. */
export function onPescaRefused() {
  stage?.refused();
}

export const pescaStageOpen = () => !!stage;

// ---------------------------------------------------------------- Jô buys fish

/** Ask Jô what she pays (near her kiosk). */
export function askTray() {
  send({ t: 'pesca', action: 'tray' });
}

function openTray(rows: PescaTrayRow[], capLeft: number) {
  const empty = !rows.length;
  if (empty) speak(JO_SELL.empty.pt, { speaker: 'jo' });
  else if (capLeft <= 0) speak(JO_SELL.cap.pt, { speaker: 'jo' });
  const say = empty ? JO_SELL.empty : capLeft <= 0 ? JO_SELL.cap : { pt: 'Quero sim! Mostra o balde.', en: 'Sure I do! Show me the bucket.' };
  const list = h(
    'div',
    { class: 'pesca-tray' },
    ...rows.map((r) =>
      h(
        'div',
        { class: 'pesca-tray-row', 'data-fish': r.id },
        foodIcon(`peixe_${r.id}`, 3, r.pt),
        h('span', { class: 'pesca-tray-name' }, h('b', null, r.pt), en(r.en, true)),
        h('span', { class: 'pesca-tray-n' }, `× ${r.n}`),
        h('span', { class: 'pesca-tray-price' }, r.price ? `${r.price} RV` : bi('devolve', 'goes back')),
        h('button', { class: 'primary', disabled: !r.price || capLeft <= 0, onclick: () => send({ t: 'pesca', action: 'sell', fish: r.id }) }, bi('Vender', 'Sell')),
      ),
    ),
  );
  const panel = h(
    'div',
    { class: 'panel pesca-sell' },
    h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar (Close)' }, '✕'),
    h('h2', null, 'Compro peixe'),
    en('Jô buys your fish. She pays a little each day, more tomorrow.'),
    h('p', { class: 'pesca-jo-says' }, `Jô: “${say.pt}”`, en(say.en)),
    empty ? null : rvPriceNote(),
    list,
    empty ? null : h('button', { class: 'primary', id: 'btn-vender-tudo', disabled: capLeft <= 0, onclick: () => send({ t: 'pesca', action: 'sell' }) }, bi('Vender tudo', 'Sell everything')),
  );
  openModal('pesca-sell', panel);
}

// ---------------------------------------------------------------- Dona Neide's Caderneta de pesca

const WATERS_ORDER: WaterId[] = ['praia', 'lagoa', 'remo', 'pesca', 'alto_mar'];
/** Where each fish is first met (the shallowest water it lives in). */
const firstWater = (id: FishId): WaterId => WATERS_ORDER.find((w) => FISH[id].water.includes(w)) ?? 'alto_mar';

/** Every species as one page, grouped by where it is first met: caught ones with their record, silhouettes for the rest. Display only. */
export function openCaderneta() {
  const log = game.profile?.pesca?.log ?? {};
  const have = new Set(speciesCaught(game.profile?.pesca));
  const groups = WATERS_ORDER.map((w) => {
    const fish = FISH_IDS.filter((id) => firstWater(id) === w);
    if (!fish.length) return null;
    return h(
      'section',
      { class: 'pesca-cad-group' },
      h('h3', null, WATER_NAME[w].pt, en(` ${WATER_NAME[w].en}`, true)),
      h(
        'div',
        { class: 'pesca-cad-grid' },
        ...fish.map((id) => {
          const row = log[id];
          return h(
            'div',
            { class: `pesca-cad-fish ${have.has(id) ? 'caught' : 'unknown'}`, 'data-fish': id },
            foodIcon(`peixe_${id}`, 3, have.has(id) ? FISH[id].pt : '?'),
            h('b', null, have.has(id) ? FISH[id].pt : '?'),
            have.has(id) ? en(FISH[id].en, true) : en('not caught yet', true),
            // the journal is not a game: the record is the one number of the feature (PRAIA-PLAN.md 4.2)
            row ? h('span', { class: 'pesca-cad-rec' }, `Recorde: ${row.bestCm} cm`) : null,
          );
        }),
      ),
    );
  });
  openModal(
    'pesca-caderneta',
    h(
      'div',
      { class: 'panel pesca-caderneta' },
      h('button', { class: 'close ghost', onclick: () => closeModal(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, 'Caderneta de pesca'),
      en(`Dona Neide’s fishing log: ${have.size} of ${FISH_IDS.length} fish so far.`),
      ...groups,
    ),
  );
}
