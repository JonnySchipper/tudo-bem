/**
 * Design mode's inspector: real inputs for every field a layout prop has (validated like the server's `validateRoomLayout`), the room's doors
 * and NPC spots when nothing is selected, and the quick actions for a multi-selection.
 * Doors and NPCs are code (rooms.ts, schedules.ts): shown here and on the map, not edited, so gameplay stays as it is.
 */
import { LAYOUT_ACTIONS, LAYOUT_DIRS, LAYOUT_MAX_Z, LAYOUT_VENDORS, ROOMS, type PropAction, type PropDef, type RoomDef, type Tile } from '@tudobem/shared';
import { h } from '../dom';
import type { DesignState } from './api';
import type { Art } from './art';
import { isDir, type Layer } from './model';
import { propArtKey } from '../../render/pixel/props';

export interface InspectorHost {
  art: Art;
  room: RoomDef;
  server: DesignState;
  selected: PropDef[];
  npcFocus: string | null;
  /** Ids the code layout uses: other code may look them up (photos, signs, the mat), so they are not renamed. */
  codeIds: Set<string>;
  allIds: Set<string>;
  layerOf: (p: PropDef) => Layer;
  layerLocked: (l: Layer) => boolean;
  collisionLocked: boolean;
  /** Change every selected prop. `mergeKey`: repeated edits of one field are one history entry. */
  edit: (label: string, fn: (p: PropDef) => void, mergeKey?: string) => void;
  editOne: (id: string, label: string, fn: (p: PropDef) => void, mergeKey?: string) => void;
  rename: (id: string, next: string) => void;
  startPick: (id: string, field: 'interact' | 'gap') => void;
  select: (ids: string[]) => void;
  focusTiles: (tiles: Tile[]) => void;
  focusNpc: (id: string | null) => void;
  rotate: () => void;
  flip: () => void;
  restack: (dir: 1 | -1) => void;
  duplicate: () => void;
  remove: () => void;
  snap: () => void;
  depthOf: (p: PropDef) => number;
}

/** What each server action does, for the "linked interaction" picker. */
export const ACTION_LABELS: Record<PropAction, string> = {
  shop_hats: 'Loja de chapéus (hat shop)',
  minigame: 'Minijogo (mini-game)',
  kiosk: 'Quiosque (kiosk)',
  parrot_perch: 'Poleiro do papagaio (parrot perch)',
  catalog: 'Catálogo de móveis (furniture catalog)',
  bjj_roll: 'Treino de jiu-jitsu (BJJ roll)',
  feira_stall: 'Barraca da feira (market stall)',
  street_snack: 'Lanche de rua (street snack)',
  checkers: 'Damas (checkers)',
  buy_gi: 'Comprar kimono (buy a gi)',
  escola: 'Escola (school)',
  academy_elevator: 'Elevador da academia (academy lift)',
  academy_board: 'Quadro da academia (academy board)',
  padaria_door: 'Porta da padaria (bakery door)',
  padaria_counter: 'Balcão: Correria (bakery counter game)',
  feira_cart: 'Carrinho de jogos da feira (market game cart)',
  feira_sign: 'Placa da feira (market sign)',
  leaderboard: 'Placar (leaderboard)',
};

const LAYER_PT: Record<Layer, string> = { floor: 'Chão', objects: 'Objetos', overhead: 'Por cima' };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function section(title: string, en: string, ...children: (Node | null | false)[]): HTMLElement {
  return h('section', { class: 'dm-sec' }, h('h3', null, title, h('small', null, en)), ...children);
}

function row(label: string, title: string, ...inputs: (Node | null)[]): HTMLElement {
  return h('label', { class: 'dm-row', title }, h('span', null, label), ...inputs);
}

function num(value: number | undefined, o: { min: number; max: number; id?: string; step?: number; disabled?: boolean; placeholder?: string }, commit: (n: number | undefined) => void): HTMLInputElement {
  const el = h('input', { type: 'number', inputmode: 'numeric', min: String(o.min), max: String(o.max), step: String(o.step ?? 1), id: o.id, value: value === undefined ? '' : String(value), placeholder: o.placeholder ?? '' }) as HTMLInputElement;
  el.disabled = !!o.disabled;
  el.addEventListener('change', () => {
    if (el.value.trim() === '') return commit(undefined);
    const n = Math.round(Number(el.value));
    if (!Number.isFinite(n)) return;
    const v = Math.max(o.min, Math.min(o.max, n));
    el.value = String(v);
    commit(v);
  });
  return el;
}

function check(on: boolean, id: string, commit: (v: boolean) => void, disabled = false): HTMLInputElement {
  const el = h('input', { type: 'checkbox', id }) as HTMLInputElement;
  el.checked = on;
  el.disabled = disabled;
  el.addEventListener('change', () => commit(el.checked));
  return el;
}

function select<T extends string>(value: T | '', options: [T | '', string][], id: string, commit: (v: T | '') => void): HTMLSelectElement {
  const el = h('select', { id }, ...options.map(([v, label]) => h('option', { value: v, selected: v === value }, label))) as HTMLSelectElement;
  el.addEventListener('change', () => commit(el.value as T | ''));
  return el;
}

function text(value: string, id: string, placeholder: string, commit: (v: string) => void, max = 160): HTMLInputElement {
  const el = h('input', { type: 'text', id, value, placeholder, maxlength: String(max) }) as HTMLInputElement;
  el.addEventListener('change', () => commit(el.value.trim()));
  return el;
}

const mini = (label: string, title: string, run: () => void, id?: string) => h('button', { type: 'button', class: 'dm-btn dm-mini', title, id, onclick: run }, label);

function quickActions(host: InspectorHost): HTMLElement {
  return h(
    'div',
    { class: 'dm-quick' },
    mini('⟳ Girar', 'Rotate (R): seats and sprites with facings', host.rotate, 'design-insp-rotate'),
    mini('⇋ Espelhar', 'Flip (F)', host.flip, 'design-insp-flip'),
    mini('⤒ Frente', 'Bring forward (])', () => host.restack(1)),
    mini('⤓ Trás', 'Send back ([)', () => host.restack(-1)),
    mini('# Grade', 'Snap back onto the grid', host.snap),
    mini('⊞ Duplicar', 'Duplicate (Ctrl+D)', host.duplicate),
    mini('🗑 Apagar', 'Delete (Del)', host.remove, 'design-insp-delete'),
  );
}

const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function roomOverview(host: InspectorHost): HTMLElement[] {
  const { room, server } = host;
  // an edge of the map is one exit made of many tiles: one row for each target
  const exits = new Map<string, typeof room.portals>();
  for (const p of room.portals) {
    const k = p.edge ? `edge:${p.to}` : p.id;
    exits.set(k, [...(exits.get(k) ?? []), p]);
  }
  const doors = [...exits.values()].map((ps) => {
    const p = ps[0]!;
    const tiles = ps.map((q) => ({ x: q.x, y: q.y }));
    const where = ps.length > 1 ? `borda, ${ps.length} pisos de ${tiles[0]!.x},${tiles[0]!.y} a ${tiles.at(-1)!.x},${tiles.at(-1)!.y}` : `piso ${p.x},${p.y}${p.edge ? ' · borda' : ''}`;
    return h(
      'button',
      { type: 'button', class: 'dm-listrow', onclick: () => host.focusTiles(tiles) },
      h('b', null, `→ ${ROOMS[p.to]?.name ?? p.to}`),
      h('small', null, `${p.label.pt} · ${where} · chega em ${p.arrive.x},${p.arrive.y}`),
    );
  });
  const npcs = room.npcs.map((n) =>
    h('button', { type: 'button', class: 'dm-listrow', 'aria-pressed': String(host.npcFocus === n.id), onclick: () => host.focusNpc(n.id) }, h('b', null, n.name), h('small', null, `${n.role.pt} · piso ${n.x},${n.y}`)),
  );
  return [
    h('div', { class: 'dm-insp-head' }, h('div', null, h('b', null, room.name), h('small', null, `${room.cols} × ${room.rows} pisos · ${server.source === 'override' ? 'layout publicado' : 'layout do código'}`))),
    h('p', { class: 'dm-note' }, 'Clique num objeto para editar, ou arraste no vazio para selecionar vários. (Click an object, or drag a marquee.)'),
    section('Portas', 'Doors: target room and arrival (code, read-only)', ...(doors.length ? doors : [h('p', { class: 'dm-empty' }, 'Sem portas.')])),
    section('NPCs', 'NPC spots and schedule points (code, read-only)', ...(npcs.length ? npcs : [h('p', { class: 'dm-empty' }, 'Nenhum NPC mora aqui.')])),
  ];
}

function npcDetail(host: InspectorHost, id: string): HTMLElement[] {
  const n = host.room.npcs.find((x) => x.id === id);
  if (!n) return roomOverview(host);
  const slots = (n.schedule ?? []).map((s) =>
    h(
      'tr',
      { class: s.room === host.room.id ? 'dm-here' : '', onclick: () => s.room === host.room.id && host.focusTiles([s.tile]) },
      h('td', null, `${fmtMin(s.from)}–${fmtMin(s.to % 1440)}`),
      h('td', null, ROOMS[s.room]?.name ?? s.room),
      h('td', null, `${s.tile.x},${s.tile.y}`),
      h('td', null, s.activity),
    ),
  );
  return [
    h('div', { class: 'dm-insp-head' }, h('div', null, h('b', null, n.name), h('small', null, n.role.pt))),
    mini('← Sala', 'Back to the room overview', () => host.focusNpc(null)),
    section(
      'Lugar',
      'Spawn / home spot',
      h('p', null, `Piso ${n.x},${n.y} · virado para ${n.dir} · conversa de ${n.interact.x},${n.interact.y}`),
      h('p', { class: 'dm-note' }, n.schedule ? 'Anda pela agenda abaixo (o piso de casa é o reserva).' : 'Fica sempre aqui; o piso dele bloqueia.'),
    ),
    n.schedule
      ? section('Agenda', 'Path points over the game day (schedules.ts)', h('table', { class: 'dm-sched' }, h('tr', null, h('th', null, 'hora'), h('th', null, 'sala'), h('th', null, 'piso'), h('th', null, 'faz')), ...slots))
      : h('span'),
    h('p', { class: 'dm-note' }, 'NPCs e agendas são código (rooms.ts / schedules.ts) e regras do jogo: o editor mostra, não muda. (Read-only: gameplay data.)'),
  ];
}

function multi(host: InspectorHost): HTMLElement[] {
  const sel = host.selected;
  const blocks = sel.filter((p) => p.blocks).length;
  const mixed = blocks > 0 && blocks < sel.length;
  const b = check(blocks === sel.length, 'design-insp-blocks', (v) => host.edit(v ? 'Bloquear' : 'Liberar passagem', (p) => (p.blocks = v)), host.collisionLocked);
  b.indeterminate = mixed;
  return [
    h('div', { class: 'dm-insp-head' }, h('div', null, h('b', null, `${sel.length} objetos`), h('small', null, 'Multi-selection'))),
    quickActions(host),
    section('Colisão', 'Collision', row('Bloqueia a passagem', 'Blocks walking', b)),
    section(
      'Selecionados',
      'Click one to edit it alone',
      ...sel.slice(0, 60).map((p) => h('button', { type: 'button', class: 'dm-listrow', onclick: () => host.select([p.id]) }, host.art.thumb(propArtKey(p), 28, !!p.flip), h('span', null, p.id))),
      sel.length > 60 ? h('p', { class: 'dm-empty' }, `… +${sel.length - 60}`) : null,
    ),
  ];
}

function single(host: InspectorHost, p: PropDef): HTMLElement[] {
  const id = p.id;
  const key = propArtKey(p);
  const layer = host.layerOf(p);
  const k = (field: string) => `${id}.${field}`;
  const set = (label: string, field: string, fn: (q: PropDef) => void) => host.editOne(id, label, fn, k(field));
  const locked = host.layerLocked(layer);

  const idInput = text(id, 'design-insp-id', 'id', (v) => {
    if (v === id) return;
    if (!ID_RE.test(v) || host.allIds.has(v)) {
      idInput.value = id;
      idInput.setCustomValidity('Use letters, digits, _ or -, and a free id.');
      idInput.reportValidity();
      return;
    }
    host.rename(id, v);
  }, 64);
  const fromCode = host.codeIds.has(id);
  idInput.disabled = fromCode;

  const pos = [
    row('x', 'Tile column', num(p.x, { min: -16, max: host.room.cols + 15, id: 'design-insp-x' }, (v) => v !== undefined && set('Mover', 'x', (q) => shiftTo(q, v, q.y)))),
    row('y', 'Tile row', num(p.y, { min: -16, max: host.room.rows + 15, id: 'design-insp-y' }, (v) => v !== undefined && set('Mover', 'y', (q) => shiftTo(q, q.x, v)))),
    row('larg.', 'Footprint width in tiles', num(p.w ?? 1, { min: 1, max: 32, id: 'design-insp-w' }, (v) => set('Tamanho', 'w', (q) => (v && v > 1 ? (q.w = v) : delete q.w)))),
    row('alt.', 'Footprint height in tiles', num(p.h ?? 1, { min: 1, max: 32, id: 'design-insp-h' }, (v) => set('Tamanho', 'h', (q) => (v && v > 1 ? (q.h = v) : delete q.h)))),
    row('px →', 'Fine nudge right, art px', num(p.ox ?? 0, { min: -256, max: 256, id: 'design-insp-ox' }, (v) => set('Ajuste fino', 'ox', (q) => (v ? (q.ox = v) : delete q.ox)))),
    row('px ↓', 'Fine nudge down, art px', num(p.oy ?? 0, { min: -256, max: 256, id: 'design-insp-oy' }, (v) => set('Ajuste fino', 'oy', (q) => (v ? (q.oy = v) : delete q.oy)))),
  ];

  const look = [
    row('Camada', 'Layer (from the sprite)', h('span', { class: `dm-layer-badge dm-layer-${layer}` }, LAYER_PT[layer])),
    row('Espelhar', 'Flip the sprite left to right', check(!!p.flip, 'design-insp-flip-check', (v) => set(v ? 'Espelhar' : 'Desespelhar', 'flip', (q) => (v ? (q.flip = true) : delete q.flip)))),
    row(
      'Ordem',
      `Draw order bias in px (−${LAYOUT_MAX_Z}..${LAYOUT_MAX_Z}); depth now ${host.depthOf(p)}`,
      num(p.z ?? 0, { min: -LAYOUT_MAX_Z, max: LAYOUT_MAX_Z, id: 'design-insp-z' }, (v) => set('Ordem', 'z', (q) => (v ? (q.z = v) : delete q.z))),
      mini('⤒', 'Bring forward', () => host.restack(1)),
      mini('⤓', 'Send back', () => host.restack(-1)),
    ),
    p.seat
      ? row('Assento', 'Seat facing (turns the chair sprite)', select(p.seat, LAYOUT_DIRS.map((d) => [d, { SE: 'SE → leste', SW: 'SW → sul', NE: 'NE → norte', NW: 'NW → oeste' }[d]] as [string, string]), 'design-insp-seat', (v) => isDir(v) && set('Girar assento', 'seat', (q) => (q.seat = v))))
      : null,
    row('Luz à noite', 'Light source at night', check(!!p.lightAtNight, 'design-insp-light', (v) => set('Luz', 'light', (q) => (v ? (q.lightAtNight = true) : delete q.lightAtNight)))),
    p.kind === 'ipe' ? row('Ipê grande', 'Landmark scale', check(!!p.hero, 'design-insp-hero', (v) => set('Ipê grande', 'hero', (q) => (v ? (q.hero = true) : delete q.hero)))) : null,
  ];

  const interactTile = p.interact;
  const interaction = [
    row(
      'Ação',
      'What using this object does (server actions)',
      select<PropAction>(p.action ?? '', [['', '— nenhuma (decoração)'], ...LAYOUT_ACTIONS.map((a) => [a, ACTION_LABELS[a]] as [PropAction, string])], 'design-insp-action', (v) =>
        set('Ação', 'action', (q) => {
          if (v) {
            q.action = v;
            // an action needs a tile to stand on: default to the one in front (south) of the footprint
            q.interact ??= { x: q.x + Math.floor(((q.w ?? 1) - 1) / 2), y: q.y + (q.h ?? 1) };
          } else delete q.action;
        }),
      ),
    ),
    row(
      'Ponto de uso',
      'Tile the player walks to before the action fires',
      h('span', { class: 'dm-tile' }, interactTile ? `${interactTile.x}, ${interactTile.y}` : '—'),
      mini('◎ No mapa', 'Pick the tile on the map', () => host.startPick(id, 'interact'), 'design-insp-pick'),
      interactTile ? mini('✕', 'Clear', () => set('Ponto de uso', 'interact', (q) => delete q.interact)) : null,
    ),
    row('Rótulo PT', 'Label in Portuguese (signs, prompts)', text(p.label?.pt ?? '', 'design-insp-label-pt', 'ex.: Balcão', (v) => set('Rótulo', 'label', (q) => setLabel(q, 'pt', v)))),
    row('Rótulo EN', 'English gloss', text(p.label?.en ?? '', 'design-insp-label-en', 'e.g. Counter', (v) => set('Rótulo', 'label', (q) => setLabel(q, 'en', v)))),
    p.vendor || p.kind === 'feira' || p.kind === 'hortifruti'
      ? row('Quem atende', 'Vendor at this stall', select(p.vendor ?? '', [['', '—'], ...LAYOUT_VENDORS.map((v) => [v, v] as [string, string])], 'design-insp-vendor', (v) => set('Vendedor', 'vendor', (q) => (v ? (q.vendor = v as PropDef['vendor']) : delete q.vendor))))
      : null,
  ];

  const gaps =
    p.kind === 'cerca'
      ? section(
          'Portão',
          'Fence gaps: walkable tiles in the perimeter',
          h('p', { class: 'dm-tile' }, p.gaps?.length ? p.gaps.map((g) => `${g.x},${g.y}`).join('  ') : 'sem portão (cerca fechada)'),
          mini('◎ Marcar no mapa', 'Click perimeter tiles to toggle a gap', () => host.startPick(id, 'gap')),
          p.gaps ? mini('Fechar tudo', 'Remove the gaps (the whole inside is blocked again)', () => set('Portão', 'gaps', (q) => delete q.gaps)) : null,
        )
      : null;

  return [
    h(
      'div',
      { class: 'dm-insp-head' },
      host.art.thumb(key, 56, !!p.flip),
      h('div', null, h('b', null, id), h('small', null, `${p.kind}${key ? ` · ${key}` : ''}`)),
    ),
    locked ? h('p', { class: 'dm-note dm-warn' }, `A camada ${LAYER_PT[layer]} está travada. (Layer locked.)`) : null,
    quickActions(host),
    section('Identidade', 'Identity', row('id', fromCode ? 'Ids from the code layout are not renamed (code may look them up)' : 'Unique id', idInput), fromCode ? h('p', { class: 'dm-note' }, 'Id do layout do código: fica como está.') : null),
    section('Posição', 'Position (tiles; fine nudge in px)', h('div', { class: 'dm-grid2' }, ...pos)),
    section('Aparência', 'Layer, flip, draw order', ...look),
    section('Colisão', 'Collision', row('Bloqueia a passagem', 'Players cannot walk through its footprint', check(p.blocks, 'design-insp-blocks', (v) => set(v ? 'Bloquear' : 'Liberar passagem', 'blocks', (q) => (q.blocks = v)), host.collisionLocked))),
    section('Interação', 'Linked interaction', ...interaction),
    gaps,
  ].filter((n): n is HTMLElement => !!n);
}

function shiftTo(p: PropDef, x: number, y: number): void {
  const dx = x - p.x;
  const dy = y - p.y;
  p.x = x;
  p.y = y;
  if (p.interact) p.interact = { x: p.interact.x + dx, y: p.interact.y + dy };
  if (p.gaps) p.gaps = p.gaps.map((g) => ({ x: g.x + dx, y: g.y + dy }));
}

/** A label needs both languages (the server refuses half a label): an empty side copies the other, both empty drop it. */
function setLabel(p: PropDef, lang: 'pt' | 'en', v: string): void {
  const cur = { pt: p.label?.pt ?? '', en: p.label?.en ?? '' };
  cur[lang] = v.slice(0, 160);
  if (!cur.pt && !cur.en) return void delete p.label;
  p.label = { pt: cur.pt || cur.en, en: cur.en || cur.pt };
}

export function renderInspector(el: HTMLElement, host: InspectorHost): void {
  const sel = host.selected;
  let content: HTMLElement[];
  if (sel.length === 1) content = single(host, sel[0]!);
  else if (sel.length > 1) content = multi(host);
  else if (host.npcFocus) content = npcDetail(host, host.npcFocus);
  else content = roomOverview(host);
  el.replaceChildren(...content);
}
