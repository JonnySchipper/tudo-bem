/**
 * The Mapa panel: one big illustrated pixel map of Vila Ipê. Each place is its own button (it lifts and glows on hover or the first tap on a
 * phone, with its name in Portuguese and English); a click travels with the same `join` the game always used. "Você está aqui" marks
 * where you are; Praia and Fazenda sit fogged on the edges with an "Em breve" ribbon and a teaser. Data and rules: `townMapData.ts`.
 */
import type { RoomId } from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { openModal } from './modal.js';
import { MAP_H, MAP_W, backdropArt, hereSpotId, mapSpots, spotAnchor, tapResult, type MapSpot, type Px } from './townMapData';

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function paint(g: SVGGElement, art: Px[]) {
  for (const [x, y, w, hh, fill] of art) g.append(svgEl('rect', { x, y, width: w, height: hh, fill }));
}

/** Percent position inside the stage, from art pixels. */
const at = (x: number, y: number) => `left:${((x / MAP_W) * 100).toFixed(3)}%;top:${((y / MAP_H) * 100).toFixed(3)}%`;

export function openMap(go: (room: RoomId) => void) {
  const here = hereSpotId(game.room?.room);
  const spots = mapSpots();
  let selected: string | null = null;
  let touch = false;

  const svg = svgEl('svg', { viewBox: `0 0 ${MAP_W} ${MAP_H}`, 'shape-rendering': 'crispEdges', class: 'tm-svg', role: 'group', 'aria-label': 'Mapa da Vila Ipê' });
  // the fog over the coming-soon edges: a dither of pale pixels
  const defs = svgEl('defs', {});
  const fog = svgEl('pattern', { id: 'tm-fog', width: 4, height: 4, patternUnits: 'userSpaceOnUse' });
  fog.append(svgEl('rect', { x: 0, y: 0, width: 4, height: 4, fill: 'rgba(246,240,230,0.38)' }), svgEl('rect', { x: 0, y: 0, width: 2, height: 2, fill: 'rgba(255,255,255,0.35)' }));
  defs.append(fog);
  svg.append(defs);
  const back = svgEl('g', { class: 'tm-backdrop', 'aria-hidden': 'true' });
  paint(back, backdropArt());
  svg.append(back);

  const stage = h('div', { class: 'tm-stage' }, svg);
  const labels = new Map<string, HTMLElement>();
  const groups = new Map<string, SVGGElement>();

  const teaser = h('div', { class: 'tm-teaser', hidden: true, role: 'dialog', 'aria-live': 'polite' });
  const showTeaser = (spot: MapSpot) => {
    teaser.replaceChildren(
      h('div', { class: 'tm-ribbon static' }, 'Em breve', h('span', null, ' · Coming soon')),
      h('h3', null, spot.pt, h('span', { class: 'en plain' }, ` · ${spot.en}`)),
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
    const art = svgEl('g', { class: 'tm-art' });
    paint(art, spot.art);
    g.append(art);
    if (spot.soon) for (const [x, y, w, hh] of spot.hit) g.append(svgEl('rect', { x, y, width: w, height: hh, fill: 'url(#tm-fog)', class: 'tm-fog' }));
    for (const [x, y, w, hh] of spot.hit) g.append(svgEl('rect', { x, y, width: w, height: hh, fill: 'transparent', class: 'tm-hit' }));
    g.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'));
    g.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && labels.get(spot.id)?.classList.add('hover'));
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

    const a = spotAnchor(spot);
    const tag = h(
      'div',
      { class: `tm-label${spot.soon ? ' soon' : ''}`, 'data-for': spot.id, style: at(a.x, a.y), 'aria-hidden': 'true' },
      h('b', null, spot.pt),
      h('span', { class: 'tm-en' }, ` · ${spot.en}`),
      spot.room ? h('span', { class: 'tm-again' }, spot.id === here ? 'Você está aqui · You are here' : 'Toque de novo para ir · Tap again to go') : null,
    );
    labels.set(spot.id, tag);
    stage.append(tag);
    if (spot.soon) stage.append(h('div', { class: 'tm-ribbon', style: at(a.x, a.y - 16), 'aria-hidden': 'true' }, 'Em breve', h('span', null, ' · Coming soon')));
  }
  // you are here: a bouncing pin over the place
  const hereSpot = spots.find((s) => s.id === here);
  const pinAt = hereSpot ? spotAnchor(hereSpot) : null;
  if (pinAt) stage.append(h('div', { class: 'tm-here', style: at(pinAt.x, pinAt.top), 'data-here': hereSpot!.id }, h('span', { class: 'tm-pin', 'aria-hidden': 'true' }), h('span', { class: 'tm-here-text' }, h('b', null, 'Você está aqui'), h('span', null, 'You are here'))));
  // a tap on the grass between places puts the selection down
  svg.addEventListener('click', () => select(null));

  const scroll = h('div', { class: 'tm-scroll' }, stage);
  const close = openModal(
    'map',
    h(
      'div',
      { class: 'panel townmap' },
      h('button', { class: 'close ghost', onclick: () => close(), 'aria-label': 'Fechar' }, '✕'),
      h('h2', null, 'Vila Ipê · São Paulo'),
      en('Tap a place to go there. Praia and Fazenda are coming soon.'),
      scroll,
      teaser,
    ),
  );
  // phones pan the map: start with "você" in view
  requestAnimationFrame(() => {
    if (!pinAt || scroll.scrollWidth <= scroll.clientWidth) return;
    scroll.scrollLeft = (pinAt.x / MAP_W) * stage.clientWidth - scroll.clientWidth / 2;
  });
}
