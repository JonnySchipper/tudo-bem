/**
 * Admin design mode. Loaded only after the admin password succeeds and the owner turns it on.
 * Walking and world clicks pause; Salvar is what other players see.
 */
import {
  ROOMS,
  installRoomProps,
  propPalette,
  serializeLayout,
  shiftProp,
  type PaletteEntry,
  type PropDef,
  type RoomId,
} from '@tudobem/shared';
import { game } from '../state';
import { h, en } from './dom';
import { bindDesignAdmin, type AdminSend } from './admin.js';
import '../styles/designMode.css';

const T = 16;

let send: AdminSend = () => {};
let active = false;
let roomId: RoomId | null = null;
let draft: PropDef[] = [];
let baseline: PropDef[] = [];
let selectedId: string | null = null;
let free = false;
let placing: PaletteEntry | null = null;
let undo: string[] = [];
let redo: string[] = [];
let dirty = false;
let awaitingSave = false;
let status = '';
let drag: { id: string; pointer: number; wx: number; wy: number; snap: PropDef; pushed: boolean } | null = null;
let root: HTMLElement | null = null;
let banner: HTMLElement | null = null;
let outline: HTMLElement | null = null;
let meta: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let raf = 0;
let offLayout: (() => void) | null = null;

type WorldPoint = { wx: number; wy: number };
type Tb = {
  clientToWorld?: (x: number, y: number) => WorldPoint | null;
  propClientRect?: (p: { x: number; y: number; w?: number; h?: number }) => { x: number; y: number; w: number; h: number } | null;
  renderer?: { cam?: { scale: number } };
};

const tb = (): Tb => (window as unknown as { __tb?: Tb }).__tb ?? {};

function clone<T>(v: T): T {
  return structuredClone(v);
}

function selected(): PropDef | undefined {
  return draft.find((p) => p.id === selectedId);
}

let painted = '';

/** Rebuild the room and its walk grid from the draft. Skips a rebuild when nothing moved. */
function paint(): void {
  if (!roomId) return;
  const sig = JSON.stringify(draft.map((p) => [p.id, p.x, p.y, p.ox ?? 0, p.oy ?? 0, p.w ?? 1, p.h ?? 1]));
  if (sig === painted) return;
  painted = sig;
  installRoomProps(roomId, draft);
  game.bumpLayout();
}

function pushUndo(): void {
  undo.push(JSON.stringify(draft));
  if (undo.length > 50) undo.shift();
  redo.length = 0;
}

function worldAt(x: number, y: number): WorldPoint | null {
  return tb().clientToWorld?.(x, y) ?? null;
}

function hits(p: PropDef, wx: number, wy: number): boolean {
  const w = (p.w ?? 1) * T;
  const footH = (p.h ?? 1) * T;
  const x0 = p.x * T + (p.ox ?? 0);
  const y1 = (p.y + (p.h ?? 1)) * T + (p.oy ?? 0);
  const y0 = y1 - Math.max(footH, T * 2) - T;
  return wx >= x0 && wx <= x0 + w && wy >= y0 && wy <= y1;
}

function pick(wx: number, wy: number): PropDef | null {
  let best: PropDef | null = null;
  let bestY = -Infinity;
  for (const p of draft) {
    if (!hits(p, wx, wy)) continue;
    const y1 = (p.y + (p.h ?? 1)) * T;
    if (y1 >= bestY) {
      best = p;
      bestY = y1;
    }
  }
  return best;
}

function freshId(kind: string): string {
  const ids = new Set(draft.map((p) => p.id));
  let id = `${kind}_novo`;
  let n = 2;
  while (ids.has(id)) id = `${kind}_novo_${n++}`;
  return id;
}

function placeAt(entry: PaletteEntry, x: number, y: number): PropDef {
  const src = clone(entry.template);
  const dx = x - src.x;
  const dy = y - src.y;
  src.id = freshId(src.kind);
  shiftProp(src, dx, dy);
  src.ox = undefined;
  src.oy = undefined;
  return src;
}

function applyFromSnap(dx: number, dy: number, ox: number, oy: number): void {
  if (!drag) return;
  const p = draft.find((q) => q.id === drag!.id);
  if (!p) return;
  const snap = clone(drag.snap);
  Object.assign(p, snap);
  shiftProp(p, dx, dy);
  if (ox) p.ox = ox;
  else delete p.ox;
  if (oy) p.oy = oy;
  else delete p.oy;
}

function onDown(e: PointerEvent): void {
  if (!active || e.button !== 0 || e.isPrimary === false) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('.design-panel, .design-banner')) return;
  e.preventDefault();
  e.stopPropagation();
  const w = worldAt(e.clientX, e.clientY);
  if (!w) return;
  if (placing) {
    pushUndo();
    const obj = placeAt(placing, Math.floor(w.wx / T), Math.floor(w.wy / T));
    draft.push(obj);
    selectedId = obj.id;
    placing = null;
    dirty = true;
    paint();
    renderMeta();
    return;
  }
  const hit = pick(w.wx, w.wy);
  selectedId = hit?.id ?? null;
  drag = hit ? { id: hit.id, pointer: e.pointerId, wx: w.wx, wy: w.wy, snap: clone(hit), pushed: false } : null;
  renderMeta();
}

function onMove(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointer) return;
  const w = worldAt(e.clientX, e.clientY);
  if (!w) return;
  const useFree = free || e.shiftKey;
  const pdx = w.wx - drag.wx;
  const pdy = w.wy - drag.wy;
  if (!drag.pushed && (Math.abs(pdx) > 2 || Math.abs(pdy) > 2)) {
    pushUndo();
    drag.pushed = true;
    dirty = true;
  }
  if (useFree) {
    const ox0 = drag.snap.ox ?? 0;
    const oy0 = drag.snap.oy ?? 0;
    let ox = ox0 + pdx;
    let oy = oy0 + pdy;
    const cx = Math.floor(ox / T);
    const cy = Math.floor(oy / T);
    ox -= cx * T;
    oy -= cy * T;
    applyFromSnap(cx, cy, Math.round(ox), Math.round(oy));
  } else {
    applyFromSnap(Math.round(pdx / T), Math.round(pdy / T), 0, 0);
  }
  if (drag.pushed) paint();
  renderMeta();
}

function onUp(e: PointerEvent): void {
  if (!drag || e.pointerId !== drag.pointer) return;
  if (drag.pushed) paint();
  drag = null;
  renderMeta();
}

function nudge(dx: number, dy: number): void {
  const p = selected();
  if (!p) return;
  pushUndo();
  dirty = true;
  if (free) {
    p.ox = (p.ox ?? 0) + dx;
    p.oy = (p.oy ?? 0) + dy;
    const cx = Math.floor((p.ox ?? 0) / T);
    const cy = Math.floor((p.oy ?? 0) / T);
    if (cx || cy) {
      shiftProp(p, cx, cy);
      p.ox = (p.ox ?? 0) - cx * T;
      p.oy = (p.oy ?? 0) - cy * T;
    }
    if (!p.ox) delete p.ox;
    if (!p.oy) delete p.oy;
  } else shiftProp(p, dx, dy);
  paint();
  renderMeta();
}

function removeSelected(): void {
  const p = selected();
  if (!p) return;
  pushUndo();
  dirty = true;
  draft = draft.filter((q) => q.id !== p.id);
  selectedId = null;
  paint();
  renderMeta();
}

function undoNow(): void {
  const prev = undo.pop();
  if (!prev) return;
  redo.push(JSON.stringify(draft));
  draft = JSON.parse(prev) as PropDef[];
  dirty = true;
  if (selectedId && !draft.some((p) => p.id === selectedId)) selectedId = null;
  paint();
  renderMeta();
}

function redoNow(): void {
  const next = redo.pop();
  if (!next) return;
  undo.push(JSON.stringify(draft));
  draft = JSON.parse(next) as PropDef[];
  dirty = true;
  paint();
  renderMeta();
}

function onKey(e: KeyboardEvent): void {
  if (!active) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const meta = e.metaKey || e.ctrlKey;
  if (meta && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) redoNow();
    else undoNow();
    return;
  }
  if (meta && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    e.stopPropagation();
    redoNow();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    e.stopPropagation();
    removeSelected();
    return;
  }
  const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const d = step[e.key];
  if (!d) return;
  e.preventDefault();
  e.stopPropagation();
  nudge(d[0], d[1]);
}

function setStatus(text: string): void {
  status = text;
  if (statusEl) statusEl.textContent = text;
}

function renderMeta(): void {
  if (!meta) return;
  const p = selected();
  meta.replaceChildren();
  if (!p) {
    meta.append(h('b', null, placing ? 'Toque no mapa para colocar' : 'Nada selecionado'));
    meta.append(h('small', null, placing ? placing.label : 'Clique num objeto.'));
    return;
  }
  meta.append(h('b', null, p.id));
  meta.append(h('small', null, `${p.kind}${p.art ? ` · ${p.art}` : ''}`));
  meta.append(h('small', null, `x ${p.x}   y ${p.y}${p.ox || p.oy ? ` · px ${p.ox ?? 0},${p.oy ?? 0}` : ''}`));
}

function frame(): void {
  raf = requestAnimationFrame(frame);
  if (!outline) return;
  const p = selected();
  const rect = p ? tb().propClientRect?.(p) : null;
  if (!p || !rect) {
    outline.hidden = true;
    return;
  }
  const scale = tb().renderer?.cam?.scale ?? 1;
  outline.hidden = false;
  outline.style.left = `${rect.x + (p.ox ?? 0) * scale}px`;
  outline.style.top = `${rect.y + (p.oy ?? 0) * scale}px`;
  outline.style.width = `${Math.max(8, rect.w)}px`;
  outline.style.height = `${Math.max(8, rect.h)}px`;
}

function exitDesign(): void {
  if (!active) return;
  const room = roomId;
  active = false;
  game.designMode = false;
  painted = '';
  if (room) installRoomProps(room, baseline);
  game.bumpLayout();
  drag = null;
  placing = null;
  selectedId = null;
  window.removeEventListener('pointerdown', onDown, true);
  window.removeEventListener('pointermove', onMove, true);
  window.removeEventListener('pointerup', onUp, true);
  window.removeEventListener('keydown', onKey, true);
  offLayout?.();
  offLayout = null;
  cancelAnimationFrame(raf);
  banner?.remove();
  outline?.remove();
  root?.remove();
  banner = outline = root = meta = statusEl = null;
}

function enterDesign(room: RoomId): void {
  if (active) exitDesign();
  roomId = room;
  draft = clone(ROOMS[room].props);
  baseline = clone(draft);
  selectedId = null;
  placing = null;
  undo = [];
  redo = [];
  dirty = false;
  awaitingSave = false;
  free = false;
  active = true;
  game.designMode = true;
  game.pending = null;
  game.bumpLayout();
  send({ t: 'admin', action: 'layoutGet', room });

  banner = h(
    'div',
    { class: 'design-banner', id: 'design-banner' },
    'DESIGN MODE',
    h('span', { id: 'design-room' }, ROOMS[room].name),
    h('button', { type: 'button', id: 'design-exit', onclick: () => exitDesign() }, 'Sair'),
  );
  outline = h('div', { class: 'design-select', id: 'design-select', hidden: true });
  meta = h('div', { class: 'design-meta', id: 'design-meta' });
  statusEl = h('p', { class: 'design-status', id: 'design-status' });
  const palette = h('div', { class: 'design-palette', id: 'design-palette' });
  for (const entry of propPalette()) {
    palette.append(
      h(
        'button',
        {
          type: 'button',
          'data-palette': entry.key,
          onclick: () => {
            placing = placing?.key === entry.key ? null : entry;
            selectedId = null;
            for (const b of palette.querySelectorAll('button')) b.classList.toggle('on', b.getAttribute('data-palette') === placing?.key);
            renderMeta();
          },
        },
        entry.label,
        h('small', null, entry.kind),
      ),
    );
  }
  root = h(
    'aside',
    { class: 'design-panel', id: 'design-panel' },
    h('h2', null, 'Modo design'),
    en(`Editing ${ROOMS[room].name}. Players keep walking the old layout until you save.`),
    meta,
    h(
      'div',
      { class: 'design-row' },
      h('button', { type: 'button', id: 'design-free', 'aria-pressed': 'false', onclick: (ev: Event) => {
        free = !free;
        (ev.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', free ? 'true' : 'false');
      } }, 'Livre'),
      h('button', { type: 'button', id: 'design-nudge-left', onclick: () => nudge(-1, 0) }, '←'),
      h('button', { type: 'button', id: 'design-nudge-right', onclick: () => nudge(1, 0) }, '→'),
      h('button', { type: 'button', id: 'design-nudge-up', onclick: () => nudge(0, -1) }, '↑'),
      h('button', { type: 'button', id: 'design-nudge-down', onclick: () => nudge(0, 1) }, '↓'),
    ),
    h(
      'div',
      { class: 'design-row' },
      h('button', { type: 'button', id: 'design-delete', onclick: () => removeSelected() }, 'Apagar'),
      h('button', { type: 'button', id: 'design-undo', onclick: () => undoNow() }, 'Desfazer'),
      h('button', { type: 'button', id: 'design-redo', onclick: () => redoNow() }, 'Refazer'),
    ),
    h(
      'div',
      { class: 'design-row' },
      h('button', { type: 'button', class: 'primary', id: 'design-save', onclick: () => {
        if (!roomId) return;
        awaitingSave = true;
        setStatus('Salvando…');
        send({ t: 'admin', action: 'layoutSave', room: roomId, objects: draft });
      } }, 'Salvar'),
      h('button', { type: 'button', id: 'design-discard', onclick: () => {
        draft = clone(baseline);
        dirty = false;
        selectedId = null;
        undo = [];
        redo = [];
        paint();
        setStatus('Descartado.');
        renderMeta();
      } }, 'Descartar'),
    ),
    h(
      'div',
      { class: 'design-row' },
      h('button', { type: 'button', id: 'design-revert', onclick: () => {
        if (!roomId) return;
        awaitingSave = true;
        dirty = false;
        setStatus('Voltando ao código…');
        send({ t: 'admin', action: 'layoutRevert', room: roomId });
      } }, 'Reverter para o código'),
      h('button', { type: 'button', class: 'primary', id: 'design-publish', onclick: () => {
        if (!roomId) return;
        setStatus('Enviando…');
        send({ t: 'admin', action: 'layoutPublish', room: roomId, objects: draft });
      } }, 'Enviar para o código'),
    ),
    statusEl,
    h('h2', null, 'Objetos'),
    en('Every prop sprite already in the game.'),
    palette,
  );
  document.body.append(banner, outline, root);
  renderMeta();
  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('keydown', onKey, true);
  offLayout = game.on('layout', () => {
    const note = game.layoutNotice;
    if (!active || !roomId || !note || note.room !== roomId) return;
    if (awaitingSave || !dirty) {
      awaitingSave = false;
      draft = clone(ROOMS[roomId].props);
      baseline = clone(draft);
      dirty = false;
      if (selectedId && !draft.some((p) => p.id === selectedId)) selectedId = null;
      setStatus(note.objects ? 'Salvo. Todo mundo já vê.' : 'De volta ao código.');
      renderMeta();
      return;
    }
    installRoomProps(roomId, draft);
    painted = '';
    game.bumpLayout();
  });
  raf = requestAnimationFrame(frame);
  bindDesignAdmin((m) => {
    if (!active) return;
    if (m.phase === 'layoutPublished') {
      setStatus(m.pt);
      if (m.fallback && roomId) {
        const blob = new Blob([serializeLayout(roomId, draft)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${roomId}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      if (m.url) setStatus(`${m.pt} ${m.url}`);
    }
    if (m.phase === 'auth' && !m.ok) exitDesign();
  });
}

/** Open or close design mode for the room the admin is standing in. */
export function toggleDesignMode(adminSend: AdminSend): void {
  send = adminSend;
  if (active) {
    exitDesign();
    return;
  }
  const room = game.room?.room;
  if (!room) return;
  enterDesign(room);
}

export function designModeActive(): boolean {
  return active;
}
