/**
 * The airport tutorial: where every new arrival starts (`ROOMS.aeroporto`). A checklist card (it takes the recado tracker's place while you
 * are in the airport) walks the player through everything the game asks of them, one step at a time, with a guide arrow in the world or a
 * pulse on the HUD button the step needs: walk, read a sign, Célia at the information desk (she hands over the camera, the cartela and
 * Júlia's note), a first photo, the Diário, the passport check, a seat, a wave, a pão de queijo, and the bus to the Vila.
 *
 * Steps are derived from what the server already knows (the profile's tutorial flags, the arrival, the diary) where it can; the few that
 * are only client-side (the Diário opened, the passport check, the snack, the bus) are remembered per profile in localStorage.
 * Needs_br: every Portuguese line here.
 */
import { AGENTE_LINES, CARTELA_COPY, CARTELA_GOAL, CARTELA_REWARD, CELIA_LINES, FILM, ARRIVAL_CARD, agenteAsk, celiaWelcome, greetingFor } from '@tudobem/shared';
import { AIRPORT_NEXT, AIRPORT_STEPS, airportDone, nextAirportStep, passportChips, thanksFor, type AirportFlags, type AirportGuide, type AirportStepId } from './airportTutorialLogic';
import { game } from '../state';
import { clock } from '../gameClock';
import { speak } from '../audio';
import { ambience } from '../ambience';
import { h, en, ui } from './dom';
import { toast } from './hud';
import { placeHud } from './hudLayout';
import { npcPortrait } from './pixelArt';
import { showDialogueBox, type BoxChip } from './dialogue';
import { closeDialogue } from './panels';
import { flyInto } from './diaryPanel';

export { AIRPORT_STEPS, airportDone, nextAirportStep } from './airportTutorialLogic';
export type { AirportFlags, AirportGuide, AirportStepId } from './airportTutorialLogic';

// ---------------------------------------------------------------- flags

const flagKey = () => `tb_aero:${game.profile?.id ?? 'guest'}`;
function readFlags(): AirportFlags {
  try {
    return JSON.parse(localStorage.getItem(flagKey()) ?? '{}') as AirportFlags;
  } catch {
    return {};
  }
}
let flags: AirportFlags = {};
let flagsFor = '';
function currentFlags(): AirportFlags {
  if (flagsFor !== flagKey()) {
    flags = readFlags();
    flagsFor = flagKey();
  }
  return flags;
}

/** A client-side step happened (the Diário opened, the passport stamped, a snack bought at the café, the bus taken). */
export function markAirportStep(id: keyof AirportFlags): void {
  const f = currentFlags();
  if (f[id]) return;
  f[id] = true;
  try {
    localStorage.setItem(flagKey(), JSON.stringify(f));
  } catch {
    /* private mode: the step still counts for this visit */
  }
  refreshPanel?.();
  stepped?.();
}

export const inAirport = (): boolean => game.room?.room === 'aeroporto';

/** The step the arrow points at right now (main.ts turns it into a guide), or null outside the airport and once everything is done. */
export function airportGuide(): AirportGuide | null {
  if (!inAirport()) return null;
  return nextAirportStep(airportDone(game.profile, currentFlags()))?.guide ?? null;
}

// ---------------------------------------------------------------- the checklist card

let refreshPanel: (() => void) | null = null;
/** The page's hook for a step that ticked on this side (main.ts moves the guide arrow on). */
let stepped: (() => void) | null = null;

/** The card under the top bar while you are in the airport (the recado tracker steps aside). `onStep` runs when a page-side step ticks. */
export function mountAirportTutorial(onStep?: () => void): { refresh: () => void } {
  stepped = onStep ?? null;
  const head = h('button', { class: 'rtrack-head aero-tut-head', type: 'button', 'aria-expanded': 'true', title: 'Primeiros passos — mostrar ou esconder / show or hide' });
  const now = h('div', { class: 'aero-tut-now' });
  const list = h('ol', { class: 'aero-tut-list' });
  const el = h('section', { class: 'rtrack aero-tut', id: 'aero-tut', role: 'region', 'aria-label': 'Primeiros passos no Brasil' }, head, now, list);
  ui().append(el);
  let folded = false;
  let prev: Set<AirportStepId> | null = null;
  let pulsing: string | null = null;
  head.addEventListener('click', () => {
    folded = !folded;
    render();
  });

  const pulse = (sel: string | null) => {
    if (pulsing === sel) return;
    if (pulsing) for (const b of document.querySelectorAll(pulsing)) b.classList.remove('tut-pulse');
    pulsing = sel;
    if (sel) for (const b of document.querySelectorAll(sel)) b.classList.add('tut-pulse');
  };

  const render = () => {
    const here = inAirport() && !!game.profile;
    const done = airportDone(game.profile, currentFlags());
    const next = nextAirportStep(done);
    document.body.classList.toggle('in-aeroporto', here);
    if (!here || !next) {
      el.hidden = true;
      pulse(null);
      prev = here ? done : null;
      placeHud();
      return;
    }
    // a step just ticked: a short "✓" and the recado sting (not for the ones that were done before this visit)
    if (prev) {
      for (const s of AIRPORT_STEPS) {
        if (!done.has(s.id) || prev.has(s.id)) continue;
        toast('reward', `✓ ${s.pt}`, s.en);
        ambience.sting('recado');
      }
    }
    prev = done;
    el.hidden = false;
    el.classList.toggle('collapsed', folded);
    head.setAttribute('aria-expanded', String(!folded));
    const n = AIRPORT_STEPS.indexOf(next) + 1;
    head.replaceChildren(
      h('span', { class: 'aero-tut-plane', 'aria-hidden': 'true' }, '✈'),
      h('b', null, 'Next steps'),
      h('small', null, `${done.size}/${AIRPORT_STEPS.length}`),
      h('span', { class: 'rtrack-caret', 'aria-hidden': 'true' }),
    );
    // English first (what to do, and how), the Portuguese of the step beside it
    now.replaceChildren(
      h('span', { class: 'aero-tut-n' }, String(n)),
      h('span', { class: 'aero-tut-text' }, h('b', null, next.en), h('span', { class: 'desemb-pt', lang: 'pt-BR' }, next.pt), h('span', { class: 'desemb-how' }, next.how.en)),
    );
    list.replaceChildren(
      ...AIRPORT_STEPS.map((s, i) =>
        h('li', { class: done.has(s.id) ? 'done' : s === next ? 'current' : '', 'data-step': s.id, title: s.pt }, h('span', { class: 'aero-tut-tick', 'aria-hidden': 'true' }, done.has(s.id) ? '✓' : String(i + 1)), h('span', null, s.en)),
      ),
    );
    pulse(next.hud ?? null);
    placeHud();
  };
  refreshPanel = render;
  game.on('profile', render);
  game.on('room', render);
  // the "what next" card belongs to the airport: leaving it (doors, bus, a skip) takes the card along
  game.on('room', () => {
    if (!inAirport()) document.getElementById('aero-next')?.remove();
  });
  game.on('hud', render);
  // a snack from the café is in your hand (the server puts it on your avatar)
  game.on('avatars', () => {
    const c = game.self?.pub.carry;
    if (inAirport() && (c === 'pao_de_queijo' || c === 'cafezinho')) markAirportStep('lanche');
  });
  render();
  return { refresh: render };
}

/** Out of the arrivals hall: a short card with where to go next (the checklist and the arrow carry on from there). */
export function showAirportNext(): void {
  document.getElementById('aero-next')?.remove();
  // it is shown a beat after the hall's doors: by then the player may already have gone on
  if (!inAirport()) return;
  const ok = h('button', { type: 'button', class: 'primary', id: 'aero-next-ok', onclick: () => card.remove() }, 'Let’s go!', h('span', { class: 'en' }, ' · Vamos!'));
  const card = h(
    'div',
    { class: 'tb-note aero-next', id: 'aero-next', role: 'dialog', 'aria-label': AIRPORT_NEXT.title },
    h('h3', null, AIRPORT_NEXT.title),
    h('p', { class: 'tb-note-small', lang: 'pt-BR' }, AIRPORT_NEXT.pt),
    ...AIRPORT_NEXT.goals.map((g, i) => h('div', { class: 'aero-next-goal' }, h('b', null, String(i + 1)), h('span', null, g))),
    h('div', { class: 'tb-note-foot' }, ok),
  );
  ui().append(card);
  ok.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- Célia: the hand-over

function gifts(): HTMLElement {
  return h(
    'div',
    { class: 'arrival-handover' },
    h(
      'div',
      { class: 'arrival-gifts' },
      h(
        'div',
        { class: 'arrival-gift gift-camera', id: 'arrival-gift-camera' },
        h('span', { class: 'gift-art' }, h('i', { class: 'cam-body' }, h('i', { class: 'cam-lens' }), h('i', { class: 'cam-flash' }))),
        h('b', null, 'Câmera', en(' Camera')),
        h('small', null, `${FILM.starter} filmes`, en(` ${FILM.starter} films`)),
      ),
      h(
        'div',
        { class: 'arrival-gift gift-cartela', id: 'arrival-gift-cartela' },
        h('span', { class: 'gift-art' }, h('i', { class: 'mini-card' }, ...Array.from({ length: CARTELA_GOAL }, () => h('i')))),
        h('b', null, CARTELA_COPY.title.pt, en(` ${CARTELA_COPY.title.en}`)),
        h('small', null, `Completa 7 e ganha +${CARTELA_REWARD} RV`, en(` Complete 7 and earn +${CARTELA_REWARD} RV`)),
      ),
    ),
    // Júlia's note: her four lines, in her hand
    h(
      'div',
      { class: 'arrival-julia arrival-note' },
      npcPortrait('julia', 'feliz', 'arrival-portrait'),
      h(
        'div',
        { class: 'arrival-says' },
        h('b', { class: 'arrival-name' }, 'Bilhete da Júlia', en(' Júlia\'s note')),
        h('p', null, `${ARRIVAL_CARD.title.pt}! ${ARRIVAL_CARD.landed.pt}`),
        en(`${ARRIVAL_CARD.title.en}! ${ARRIVAL_CARD.landed.en}`),
        h('p', null, `${ARRIVAL_CARD.camera.pt} ${ARRIVAL_CARD.diary.pt}`),
        en(`${ARRIVAL_CARD.camera.en} ${ARRIVAL_CARD.diary.en}`),
      ),
    ),
  );
}

/** Lift the two gifts out of the box and fly them to their HUD buttons (the camera button shows once the profile says `hasCamera`). */
function handOver() {
  const pairs: [string, string][] = [
    ['arrival-gift-camera', 'btn-camera'],
    ['arrival-gift-cartela', 'cartela-pill'],
  ];
  pairs.forEach(([from, to], i) => {
    const src = document.querySelector<HTMLElement>(`#${from} .gift-art`);
    if (!src) return;
    const r = src.getBoundingClientRect();
    const ghost = src.cloneNode(true) as HTMLElement;
    ghost.classList.add('arrival-flyer');
    Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    ui().append(ghost);
    // on a phone the actions live behind the menu key
    const shown = (id: string) => (document.getElementById(id)?.getBoundingClientRect().width ?? 0) > 0;
    let tries = 0;
    const go = () => {
      if (shown(to)) return flyInto(ghost, to);
      if (++tries < 8) return void window.setTimeout(go, 120);
      flyInto(ghost, shown('btn-burger') ? 'btn-burger' : to);
    };
    window.setTimeout(go, 200 + i * 160);
  });
}

export interface StaffHooks {
  /** Célia hands the package over (`{ t: 'arrival', action: 'finish' }`). */
  finish: () => void;
  /** A line over the NPC's head after the box closes. */
  say: (npc: 'celia' | 'agente', line: { pt: string; en: string }) => void;
}

/** Célia at the information desk: the package from Júlia the first time, then help with the next step. */
export function openCelia(hooks: StaffHooks): void {
  const p = game.profile;
  const box = (line: { pt: string; en: string; spoken?: string }, chips: BoxChip[], onChip: (i: number) => void, extras: HTMLElement | null = null, expression: 'feliz' | 'neutro' | 'pensativo' = 'feliz') => {
    speak(line.spoken ?? line.pt, { speaker: 'celia' });
    showDialogueBox({ key: 'talk-celia', npcId: 'celia', speaker: 'Célia', role: 'Informações · Information', expression, line, listen: line.spoken, chips, extras, onChip, onClose: closeDialogue });
  };
  if (p?.arrivalIntroDone === false) {
    box(
      celiaWelcome(p.name ?? ''),
      [thanksFor(p.pronoun)],
      () => {
        handOver();
        hooks.finish();
        closeDialogue();
        window.setTimeout(() => hooks.say('celia', CELIA_LINES.photo), 700);
      },
      gifts(),
    );
    return;
  }
  const menu = () =>
    box(
      CELIA_LINES.help,
      [
        { pt: 'Como tiro uma foto?', en: 'How do I take a photo?' },
        { pt: 'Onde fica o ônibus?', en: 'Where is the bus?' },
        { pt: 'O que é a cartela?', en: 'What is the stamp card?' },
        { pt: 'Tchau!', en: 'Bye!' },
      ],
      (i) => {
        const a = CELIA_LINES.answers[i];
        if (!a) return closeDialogue();
        box(a, [{ pt: 'Entendi!', en: 'Got it!' }, { pt: 'Tchau!', en: 'Bye!' }], (j) => (j === 0 ? menu() : closeDialogue()));
      },
    );
  menu();
}

// ---------------------------------------------------------------- Agente Paulo: the passport check

/** Passport control: greet by the hour, say why you came, get the stamp. */
export function openAgente(hooks: StaffHooks): void {
  const box = (line: { pt: string; en: string }, chips: BoxChip[], onChip: (i: number) => void, expression: 'feliz' | 'neutro' | 'pensativo' | 'surpreso' = 'neutro', extras: HTMLElement | null = null) => {
    speak(line.pt, { speaker: 'agente' });
    showDialogueBox({ key: 'talk-agente', npcId: 'agente', speaker: 'Agente Paulo', role: 'Polícia Federal · Federal Police', expression, line, chips, extras, onChip, onClose: closeDialogue });
  };
  const minute = clock.minutes();
  const g = greetingFor(minute);
  const { chips, right } = passportChips(minute);
  const stamped = () =>
    box(
      AGENTE_LINES.stamped,
      [thanksFor(game.profile?.pronoun)],
      () => {
        markAirportStep('passaporte');
        closeDialogue();
        hooks.say('agente', AGENTE_LINES.next);
      },
      'feliz',
      h('div', { class: 'aero-visto', 'aria-hidden': 'true' }, h('b', null, 'BRASIL'), h('span', null, 'ENTRADA'), h('small', null, `${String(clock.day() % 28 + 1).padStart(2, '0')} · 10 · 2026`)),
    );
  const reason = () =>
    box(
      AGENTE_LINES.reason,
      [
        { pt: 'Turismo.', en: 'Tourism.' },
        { pt: 'Estudo.', en: 'Studies.' },
        { pt: 'Trabalho.', en: 'Work.' },
      ],
      () => {
        ambience.sting('coin');
        stamped();
      },
    );
  const ask = (again: boolean) =>
    box(
      agenteAsk(g, again),
      chips,
      (i) => (i === right ? reason() : ask(true)),
      again ? 'pensativo' : 'neutro',
    );
  ask(false);
}
