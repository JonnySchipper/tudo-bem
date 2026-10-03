/**
 * Plane arrival. A brand-new account lands in Brazil; Júlia hands over the camera and the cartela do bairro.
 * A postcard: the plane comes in over the city at golden hour and touches down, then Júlia slides in with the two things she gives you.
 * Taking them flies the camera to its HUD button and the card to the cartela chip.
 * Accounts that already finished it never see this again.
 */
import { CARTELA_COPY, CARTELA_GOAL, CARTELA_REWARD, FILM } from '@tudobem/shared';
import { game } from '../state';
import { h, en, ui } from './dom';
import { npcPortrait } from './pixelArt';
import { flyInto } from './diaryPanel';

let open = false;

/** A side-view airliner, one character per art pixel (K ink, W body, B windows, G stripe, Y tail and engine). */
const PLANE = [
  'KK..............................',
  'KYK.............................',
  'KYYK............................',
  'KWYYK...........................',
  'KWWWWKKKKKKKKKKKKKKKKKKKKKKKK...',
  'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWKK.',
  'KWWBWWBWWBWWBWWBWWBWWBWWBWWWBBWK',
  'KGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGK',
  '.KWWWWWWWWWWKKKKKKKWWWWWWWWWWWK.',
  '..KKKKKKKKKKKWWWWWKKKKKKKKKKKK..',
  '............KYYYYK..............',
  '.............KKKK...............',
];
const PLANE_INK: Record<string, string> = { K: '#2a2140', W: '#f6f1e7', B: '#4e6f86', G: '#2e8a55', Y: '#f2c230' };

function pixelSvg(rows: string[], ink: Record<string, string>, cls: string): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = ink[row[x]];
      if (!c) continue;
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      r.setAttribute('fill', c);
      svg.append(r);
    }
  });
  return svg;
}

/** São Paulo at a distance: a row of towers with a few lit windows (deterministic, one character per art pixel). */
function skylineRows(): string[] {
  const W = 120;
  const H = 22;
  const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  let x = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  while (x < W) {
    const w = 5 + Math.floor(rnd() * 8);
    const top = 3 + Math.floor(rnd() * 15);
    for (let xx = x; xx < Math.min(W, x + w); xx++) {
      for (let y = top; y < H; y++) {
        const win = xx > x && xx < x + w - 1 && (xx - x) % 2 === 1 && (y - top) % 3 === 2 && y < H - 2;
        rows[y][xx] = win ? (rnd() < 0.35 ? 'Y' : 'D') : y === top ? 'L' : 'S';
      }
    }
    x += w + (rnd() < 0.3 ? 1 : 0);
  }
  return rows.map((r) => r.join(''));
}
const SKYLINE_INK: Record<string, string> = { S: '#6b5a86', L: '#7f6d9a', D: '#5a4a72', Y: '#ffd98a' };

/** The sky, three clouds, the skyline, the runway with its lights, and the plane on its approach. */
function scene(): HTMLElement {
  return h(
    'div',
    { class: 'arrival-scene', 'aria-hidden': 'true' },
    h('i', { class: 'arr-sun' }),
    h('i', { class: 'arr-cloud c1' }),
    h('i', { class: 'arr-cloud c2' }),
    h('i', { class: 'arr-cloud c3' }),
    h('div', { class: 'arr-skyline' }, pixelSvg(skylineRows(), SKYLINE_INK, 'arr-skyline-svg')),
    h('i', { class: 'arr-runway' }, ...Array.from({ length: 9 }, (_, i) => h('b', { style: `--i:${i}` }))),
    h('div', { class: 'arr-plane' }, pixelSvg(PLANE, PLANE_INK, 'arr-plane-svg'), h('i', { class: 'arr-shadow' })),
  );
}

function cameraGift(): HTMLElement {
  return h(
    'div',
    { class: 'arrival-gift gift-camera', id: 'arrival-gift-camera' },
    h(
      'span',
      { class: 'gift-art' },
      h('i', { class: 'cam-body' }, h('i', { class: 'cam-lens' }), h('i', { class: 'cam-flash' })),
    ),
    h('b', null, 'Câmera'),
    h('small', null, `${FILM.starter} filmes`),
  );
}

function cartelaGift(): HTMLElement {
  return h(
    'div',
    { class: 'arrival-gift gift-cartela', id: 'arrival-gift-cartela' },
    h('span', { class: 'gift-art' }, h('i', { class: 'mini-card' }, ...Array.from({ length: CARTELA_GOAL }, () => h('i')))),
    h('b', null, CARTELA_COPY.title.pt),
    h('small', null, `Completa 7 e ganha +${CARTELA_REWARD} RV`),
  );
}

/** Lift the two gifts out of the postcard and fly them to the HUD while the postcard drops away. */
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
    // the camera button appears with the profile that answers `finish` (wait up to a second for it); on a phone the actions live
    // behind the menu key
    const shown = (id: string) => (document.getElementById(id)?.getBoundingClientRect().width ?? 0) > 0;
    let tries = 0;
    const go = () => {
      if (shown(to)) return flyInto(ghost, to);
      if (++tries < 8) return void window.setTimeout(go, 120);
      flyInto(ghost, shown('btn-burger') ? 'btn-burger' : to);
    };
    window.setTimeout(go, 360 + i * 160);
  });
}

export function syncArrival(finish: () => void) {
  const need = game.profile?.arrivalIntroDone === false && !!game.room;
  if (!need) {
    if (!open) return;
    const el = document.getElementById('arrival-intro');
    if (el && !el.classList.contains('leaving')) el.remove();
    open = false;
    if (!document.querySelector('[data-modal]')) game.modalOpen = false;
    return;
  }
  if (open) return;
  open = true;
  game.modalOpen = true;
  const done = h(
    'button',
    {
      type: 'button',
      class: 'primary',
      id: 'arrival-done',
      onclick: () => {
        done.setAttribute('disabled', '');
        const root = document.getElementById('arrival-intro');
        handOver();
        root?.classList.add('leaving');
        window.setTimeout(() => root?.remove(), 520);
        finish();
      },
    },
    'Pegar a câmera',
    en('Take the camera'),
  );
  ui().append(
    h(
      'div',
      { id: 'arrival-intro', role: 'dialog', 'aria-labelledby': 'arrival-title' },
      h(
        'div',
        { class: 'arrival-card' },
        scene(),
        h(
          'div',
          { class: 'arrival-head' },
          h('p', { class: 'arrival-kicker' }, 'Aeroporto'),
          h('h2', { id: 'arrival-title' }, 'Você chegou ao Brasil'),
          h('p', null, 'O avião acabou de pousar. Júlia te espera na praça.'),
          en('The plane just landed. Júlia is waiting for you in the square.'),
        ),
        h(
          'div',
          { class: 'arrival-julia' },
          npcPortrait('julia', 'feliz', 'arrival-portrait'),
          h(
            'div',
            { class: 'arrival-says' },
            h('b', { class: 'arrival-name' }, 'Júlia'),
            // needs_br: true (new line: the card is on this build now; was "A cartela de carimbos ainda não chegou…")
            h('p', null, 'Toma a câmera e a cartela do bairro.'),
            en('Here, take the camera and the neighborhood stamp card.'),
            h('p', null, 'Fotografe o que você vê e as palavras ficam no diário.'),
            en('Photograph what you see and the words stay in the diary.'),
          ),
        ),
        h('div', { class: 'arrival-gifts' }, cameraGift(), cartelaGift()),
        h('div', { class: 'arrival-actions' }, done),
      ),
    ),
  );
}
