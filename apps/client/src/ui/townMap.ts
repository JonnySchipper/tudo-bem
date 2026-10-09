/**
 * The Mapa panel: one big picture of Vila Ipê, drawn from the game's own areas (`townMapArt.ts`). Each place is its own button (it lights up
 * on hover or the first tap on a phone, with its name in Portuguese and English); a click travels with the same `join` the game always used.
 * "Você está aqui" marks where you are; Praia and Fazenda sit fogged in their corner with an "Em breve" ribbon and a teaser. Data and rules:
 * `townMapData.ts`.
 */
import type { RoomId } from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { openModal } from './modal.js';
import { townMapCanvas } from './townMapArt';
import { MAP_H, MAP_W, hereSpotId, mapSpots, pinPlace, tagPlace, tapResult, type MapSpot } from './townMapData';

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Percent position inside the stage, from art pixels. */
const at = (x: number, y: number) => `left:${((x / MAP_W) * 100).toFixed(3)}%;top:${((y / MAP_H) * 100).toFixed(3)}%`;

export function openMap(go: (room: RoomId) => void) {
  const here = hereSpotId(game.room?.room);
  const spots = mapSpots();
  let selected: string | null = null;
  let touch = false;

  // the picture of the town, painted once and copied onto this opening's own canvas
  const picture = h('canvas', { class: 'tm-picture', width: MAP_W, height: MAP_H, 'aria-hidden': 'true' }) as HTMLCanvasElement;
  townMapCanvas()
    .then((art) => {
      picture.getContext('2d')?.drawImage(art, 0, 0);
      picture.classList.add('ready');
    })
    .catch(() => picture.classList.add('failed'));

  // the places: tap areas over the picture, in map pixels
  const svg = svgEl('svg', { viewBox: `0 0 ${MAP_W} ${MAP_H}`, class: 'tm-svg', role: 'group', 'aria-label': 'Mapa da Vila Ipê (Vila Ipê map)' });
  // the fog over the coming-soon corner: a dither of pale pixels
  const defs = svgEl('defs', {});
  const fog = svgEl('pattern', { id: 'tm-fog', width: 4, height: 4, patternUnits: 'userSpaceOnUse' });
  fog.append(svgEl('rect', { x: 0, y: 0, width: 4, height: 4, fill: 'rgba(246,240,230,0.28)' }), svgEl('rect', { x: 0, y: 0, width: 2, height: 2, fill: 'rgba(255,255,255,0.3)' }));
  defs.append(fog);
  svg.append(defs);

  const stage = h('div', { class: 'tm-stage' }, picture, svg);
  const labels = new Map<string, HTMLElement>();
  const groups = new Map<string, SVGGElement>();

  const teaser = h('div', { class: 'tm-teaser', hidden: true, role: 'dialog', 'aria-live': 'polite' });
  const showTeaser = (spot: MapSpot) => {
    teaser.replaceChildren(
      h('div', { class: 'tm-ribbon static' }, 'Em breve', h('span', null, ' · Coming soon')),
      h('h3', null, spot.pt, h('span', { class: 'tm-en' }, ` · ${spot.en}`)),
      h('p', { class: 'tm-teaser-pt' }, spot.soon!.pt),
      en(spot.soon!.en),
      h('div', { class: 'row' }, h('span', { class: 'spacer' }), h('button', { class: 'primary', 'data-teaser-ok': '', onclick: () => (teaser.hidden = true) }, 'Ok!')),
    );
    teaser.dataset.spot = spot.id;
    teaser.hidden = false;
  };

  const select = (id: string | null) => {
    selected = id;
    for (const [sid, g] of groups) g.classList.toggle('sel', sid === id);
    for (const [sid, l] of labels) l.classList.toggle('on', sid === id);
  };

  const act = (spot: MapSpot) => {
    const result = tapResult(spot, { touch, selected, here });
    if (result === 'teaser') {
      select(spot.id);
      showTeaser(spot);
    } else if (result === 'select') select(spot.id);
    else if (result === 'stay') close();
    else if (spot.room) {
      go(spot.room);
      close();
    }
  };

  for (const spot of spots) {
    const label = `${spot.pt} · ${spot.en}`;
    const g = svgEl('g', { class: `tm-spot${spot.soon ? ' soon' : ''}${spot.id === here ? ' here' : ''}`, 'data-spot': spot.id, role: 'button', tabindex: 0, 'aria-label': spot.soon ? `${label} — Em breve · Coming soon` : label });
    if (spot.room) g.setAttribute('data-room', spot.room);
    if (spot.soon) for (const [x, y, w, hh] of spot.hit) g.append(svgEl('rect', { x, y, width: w, height: hh, fill: 'url(#tm-fog)', class: 'tm-fog' }));
    // the frame that lights up round the place (inset so neighbouring frames never touch)
    for (const [x, y, w, hh] of spot.hit) g.append(svgEl('rect', { x: x + 3, y: y + 3, width: w - 6, height: hh - 6, rx: 6, class: 'tm-hit' }));
    g.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'));
    // only a real pointer hovers (an emulated mouse on a phone would leave a stray label up)
    g.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && matchMedia('(hover: hover)').matches && labels.get(spot.id)?.classList.add('hover'));
    g.addEventListener('pointerleave', () => labels.get(spot.id)?.classList.remove('hover'));
    g.addEventListener('focus', () => labels.get(spot.id)?.classList.add('hover'));
    g.addEventListener('blur', () => labels.get(spot.id)?.classList.remove('hover'));
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      act(spot);
    });
    g.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      touch = false;
      act(spot);
    });
    svg.append(g);
    groups.set(spot.id, g);

    const t = tagPlace(spot);
    const tag = h(
      'div',
      { class: `tm-label ${t.align}${spot.soon ? ' soon' : ''}`, 'data-for': spot.id, style: at(t.x, t.y), 'aria-hidden': 'true' },
      h('b', null, spot.pt),
      h('span', { class: 'tm-en' }, ` · ${spot.en}`),
      spot.room ? h('span', { class: 'tm-again' }, spot.id === here ? 'Você está aqui · You are here' : 'Toque de novo para ir · Tap again to go') : null,
    );
    labels.set(spot.id, tag);
    stage.append(tag);
    if (spot.soon) stage.append(h('div', { class: `tm-ribbon ${t.align}`, style: at(t.x, t.y), 'aria-hidden': 'true' }, h('b', null, spot.pt), h('span', null, 'Em breve · Coming soon')));
  }
  // you are here: a bouncing pin over the place
  const hereSpot = spots.find((s) => s.id === here);
  const pinAt = hereSpot ? pinPlace(hereSpot) : null;
  if (pinAt) stage.append(h('div', { class: 'tm-here', style: at(pinAt.x, pinAt.y), 'data-here': hereSpot!.id }, h('span', { class: 'tm-pin', 'aria-hidden': 'true' }), h('span', { class: 'tm-here-text' }, h('b', null, 'Você está aqui'), h('span', null, 'You are here'))));
  // a tap on the grass between places puts the selection down
  svg.addEventListener('click', () => select(null));

  const scroll = h('div', { class: 'tm-scroll' }, stage);
  // shown smaller than one screen pixel per game pixel (a small window), the picture is smoothed rather than losing whole rows of pixels
  // (the bounding box includes the panel's desktop zoom)
  const sharpness = new ResizeObserver(() => picture.classList.toggle('smooth', stage.getBoundingClientRect().width * devicePixelRatio < MAP_W - 1));
  sharpness.observe(stage);
  const close = openModal(
    'map',
    h(
      'div',
      { class: 'panel townmap' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar (Close)' }, '✕'),
      h('h2', null, 'Vila Ipê · São Paulo'),
      en('Tap a place to go there. Praia and Fazenda are coming soon.'),
      scroll,
      teaser,
    ),
    { onClose: () => sharpness.disconnect() },
  );
  // phones pan the map: start with "você" in view
  requestAnimationFrame(() => {
    if (!pinAt || scroll.scrollWidth <= scroll.clientWidth) return;
    scroll.scrollLeft = (pinAt.x / MAP_W) * stage.clientWidth - scroll.clientWidth / 2;
  });
}
