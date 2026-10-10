/**
 * Design mode: the admin level editor over the live world (issue #231).
 *
 * The world keeps drawing; the editor installs its working copy of the room's props into `ROOMS` on this client only, so what you see is
 * what players will walk once it is published. Nothing reaches the server until a draft autosave (private) or a publish (everyone, audited).
 *
 * Shell: top bar (room, undo / redo, save state, checks, zoom, preview, publish, exit), the asset palette on the left, the inspector / layers /
 * changes / checks on the right, a tool strip over the canvas. Pointer and keys are caught on `window` in the capture phase, so the game below
 * never sees a click meant for the editor.
 */
import {
  ROOMS,
  checkLayout,
  findPath,
  buildGrid,
  installRoomProps,
  isWalkable,
  layoutDiff,
  propPalette,
  serializeLayout,
  shiftProp,
  type LayoutIssue,
  type PropDef,
  type RoomId,
  type Tile,
} from '@tudobem/shared';
import { game } from '../../state';
import { h } from '../dom';
import { propArtKey } from '../../render/pixel/props';
import { arrowForKey, stepForHeld, stepTarget, type Arrow } from '../keys';
import { ApiError, designApi, type DesignState } from './api';
import { Art } from './art';
import { CATEGORIES, buildAssets, bumpRecent, matches, type Asset, type Category } from './assets';
import { renderInspector, type InspectorHost } from './inspector';
import {
  EditHistory,
  LAYERS,
  T,
  cloneProps,
  drawDepth,
  freshId,
  layerOf as layerOfSprite,
  marqueeIds,
  normBox,
  nudgePx,
  pasteAt,
  pickAt,
  propBox,
  restack,
  rotateProp,
  snapToGrid,
  type Box,
  type Layer,
} from './model';
import { Overlay, screenMap } from './overlay';
import '../../styles/designMode.css';

type LayerKey = Layer | 'collision';
type Tab = 'inspect' | 'layers' | 'changes' | 'checks';
type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

const PREFS_KEY = 'tb_design_prefs';
const FAVS_KEY = 'tb_design_favs';
const RECENT_KEY = 'tb_design_recent';
const CLIP_KEY = 'tb_design_clipboard';
const AUTOSAVE_MS = 1200;

const LAYER_LABEL: Record<LayerKey, { pt: string; en: string }> = {
  floor: { pt: 'Chão e decalques', en: 'Floor / decals' },
  objects: { pt: 'Objetos', en: 'Objects' },
  overhead: { pt: 'Por cima', en: 'Overhead' },
  collision: { pt: 'Colisão', en: 'Collision' },
};

const SHORTCUTS: [string, string, string][] = [
  ['V', 'Selecionar', 'Select tool'],
  ['H / Espaço + arrastar', 'Mover a vista', 'Pan tool / hold Space'],
  ['Shift + clique, arrastar no vazio', 'Seleção múltipla', 'Multi-select, marquee'],
  ['Setas', 'Mover 1 piso (Shift: 4)', 'Move 1 tile (Shift: 4)'],
  ['Alt + setas', 'Ajuste fino de 1 px', 'Fine nudge 1 px'],
  ['S', 'Grade magnética liga/desliga', 'Snap to grid on/off'],
  ['Alt + arrastar', 'Arrastar sem grade', 'Drag without snap'],
  ['R / F', 'Girar / espelhar', 'Rotate / flip'],
  ['] / [', 'Trazer para frente / mandar para trás', 'Bring forward / send back'],
  ['Ctrl + D', 'Duplicar', 'Duplicate'],
  ['Ctrl + C / X / V', 'Copiar / recortar / colar (entre salas)', 'Copy / cut / paste (across rooms)'],
  ['Delete', 'Apagar', 'Delete'],
  ['Ctrl + A', 'Selecionar tudo', 'Select all'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Desfazer / refazer', 'Undo / redo'],
  ['G / C / I / N', 'Grade / colisão / zonas / NPCs', 'Grid / collision / hotspots / NPC overlays'],
  ['+ / − / 0', 'Zoom / voltar ao normal', 'Zoom / reset view'],
  ['P', 'Pré-visualizar andando', 'Live preview (walk)'],
  ['Ctrl + S', 'Salvar rascunho agora', 'Save draft now'],
  ['Ctrl + Enter', 'Publicar…', 'Publish…'],
  ['\\', 'Esconder painéis', 'Toggle panels'],
  ['Esc', 'Cancelar / limpar seleção', 'Cancel / clear selection'],
  ['?', 'Esta lista', 'This cheat sheet'],
];

const readJson = <V>(k: string, fallback: V): V => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as V) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
};

type Tb = { clientToWorld?: (x: number, y: number) => { wx: number; wy: number } | null; renderer?: { avatarPos?: (a: unknown, now: number) => { tile: Tile; moving: boolean; dir: string } } };
const tb = (): Tb => (window as unknown as { __tb?: Tb }).__tb ?? {};

function btn(label: string | Node, title: string, onclick: (e: MouseEvent) => void, opts: { id?: string; cls?: string; pressed?: boolean; disabled?: boolean } = {}): HTMLButtonElement {
  const b = h('button', { type: 'button', title, 'aria-label': title, class: opts.cls ?? 'dm-btn', id: opts.id, onclick }, label);
  if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
  if (opts.disabled) b.disabled = true;
  return b;
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const same = (a: readonly PropDef[], b: readonly PropDef[]) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- the editor

class Editor {
  readonly def;
  objects: PropDef[];
  /** What is live now (the publish dialog and the change list compare against it). */
  baseline: PropDef[];
  baseRev: number;
  readonly history = new EditHistory();
  selected = new Set<string>();
  tool: 'select' | 'pan' = 'select';
  placing: Asset | null = null;
  pick: { id: string; field: 'interact' | 'gap' } | null = null;
  prefs = readJson(PREFS_KEY, { snap: true, grid: true, hotspots: true, npcs: true, left: true, right: true });
  layers: Record<LayerKey, { hidden: boolean; locked: boolean }> = {
    floor: { hidden: false, locked: false },
    objects: { hidden: false, locked: false },
    overhead: { hidden: false, locked: false },
    collision: { hidden: true, locked: false },
  };
  favs = new Set<string>(readJson<string[]>(FAVS_KEY, []));
  recent = readJson<string[]>(RECENT_KEY, []);
  tab: Tab = 'inspect';
  category: Category | 'all' | 'favs' | 'recent' = 'all';
  query = '';
  saveState: SaveState = 'clean';
  savedAt = 0;
  issues: LayoutIssue[] = [];
  hover: string | null = null;
  pointerTile: Tile | null = null;
  npcFocus: string | null = null;
  issueFocus: LayoutIssue | null = null;
  preview: Preview | null = null;
  private drag:
    | { kind: 'pan'; id: number; sx: number; sy: number; pan: { x: number; y: number } }
    | { kind: 'move'; id: number; wx: number; wy: number; sx: number; sy: number; snap: Map<string, PropDef>; moved: boolean }
    | { kind: 'marquee'; id: number; wx: number; wy: number; base: Set<string>; box: Box | null }
    | null = null;
  private space = false;
  private saveTimer = 0;
  private checkTimer = 0;
  private raf = 0;
  private painted = '';
  private lastSaved = '';
  private publishing = false;
  private offLayout: (() => void) | null = null;
  readonly assets: Asset[];
  readonly overlay: Overlay;
  readonly root: HTMLElement;
  private els: Record<string, HTMLElement> = {};

  constructor(
    readonly room: RoomId,
    readonly art: Art,
    public server: DesignState,
    private onExit: () => void,
  ) {
    this.def = ROOMS[room];
    this.baseline = structuredClone(server.live);
    this.baseRev = server.rev;
    this.objects = structuredClone(server.live);
    this.lastSaved = JSON.stringify(this.objects);
    this.layers.collision.hidden = !readJson(PREFS_KEY, { collision: false } as { collision?: boolean }).collision;
    this.assets = buildAssets(art.sprites, propPalette(), propArtKey);
    this.overlay = new Overlay(art);
    this.root = h('div', { class: 'dm-root', id: 'design-root' });
  }

  // ------------------------------------------------------------ helpers

  artKey = (p: PropDef) => propArtKey(p);
  layerOf = (p: PropDef): Layer => layerOfSprite(p, this.art.sprite(this.artKey(p)), this.artKey(p));
  boxOf = (p: PropDef): Box => propBox(p, this.art.sprite(this.artKey(p)));
  hiddenOrLocked = (p: PropDef) => {
    const l = this.layers[this.layerOf(p)];
    return l.hidden || l.locked;
  };
  selectedProps = () => this.objects.filter((p) => this.selected.has(p.id));
  byId = (id: string) => this.objects.find((p) => p.id === id);

  private worldAt(x: number, y: number) {
    return tb().clientToWorld?.(x, y) ?? null;
  }

  private tileAt(x: number, y: number): Tile | null {
    const w = this.worldAt(x, y);
    return w ? { x: Math.floor(w.wx / T), y: Math.floor(w.wy / T) } : null;
  }

  /** Every change goes through here: one history entry, then repaint, autosave, recheck, redraw panels. */
  edit(label: string, fn: (objects: PropDef[]) => void, mergeKey?: string): void {
    const before = structuredClone(this.objects);
    if (mergeKey) this.history.recordOrMerge(label, before, mergeKey);
    else this.history.record(label, before);
    fn(this.objects);
    for (const id of [...this.selected]) if (!this.byId(id)) this.selected.delete(id);
    this.changed();
  }

  private changed(panels = true): void {
    this.paint();
    this.markDirty();
    this.scheduleChecks();
    if (panels) this.renderPanels();
  }

  /** Install the visible layers of the working copy into the room (this client only) and rebuild the scene. */
  paint(force = false): void {
    const visible = this.preview ? this.objects : this.objects.filter((p) => !this.layers[this.layerOf(p)].hidden);
    const sig = JSON.stringify(visible);
    if (!force && sig === this.painted) return;
    this.painted = sig;
    installRoomProps(this.room, visible);
    game.bumpLayout();
  }

  // ------------------------------------------------------------ autosave and checks

  private markDirty(): void {
    const now = JSON.stringify(this.objects);
    if (now === this.lastSaved) {
      if (this.saveState === 'dirty') this.setSave('saved');
      return;
    }
    this.setSave('dirty');
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void this.saveNow(), AUTOSAVE_MS);
  }

  async saveNow(): Promise<void> {
    clearTimeout(this.saveTimer);
    const body = JSON.stringify(this.objects);
    if (body === this.lastSaved && this.saveState !== 'error') return;
    this.setSave('saving');
    try {
      // a draft that matches what is live is no draft: drop it so the room list stops flagging it
      if (same(this.objects, this.baseline)) await designApi.discardDraft(this.room);
      else await designApi.saveDraft(this.room, this.objects, this.baseRev);
      this.lastSaved = body;
      this.savedAt = Date.now();
      this.setSave(JSON.stringify(this.objects) === body ? 'saved' : 'dirty');
      if (this.saveState === 'dirty') this.saveTimer = window.setTimeout(() => void this.saveNow(), AUTOSAVE_MS);
    } catch (err) {
      this.setSave('error');
      if (err instanceof ApiError && err.status === 401) this.toast('A sessão de admin acabou. Entre de novo para salvar.', 'warn');
    }
  }

  /** On exit or a room switch: the last edits must not wait for the timer. `keepalive` lets it finish while the page unloads. */
  flushOnUnload(): void {
    if (JSON.stringify(this.objects) === this.lastSaved) return;
    const discard = same(this.objects, this.baseline);
    void fetch(discard ? '/api/admin/design/draft/discard' : '/api/admin/design/draft', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(discard ? { room: this.room } : { room: this.room, objects: this.objects, baseRev: this.baseRev }),
    }).catch(() => {});
  }

  private setSave(s: SaveState): void {
    this.saveState = s;
    const el = this.els.save;
    if (!el) return;
    const text: Record<SaveState, string> = {
      clean: 'Sem alterações',
      dirty: 'Alterado…',
      saving: 'Salvando rascunho…',
      saved: `Rascunho salvo ${this.savedAt ? fmtTime(this.savedAt) : ''}`.trim(),
      error: 'Erro ao salvar. Tentar de novo',
    };
    el.textContent = same(this.objects, this.baseline) && s !== 'error' && s !== 'saving' ? 'Igual ao publicado' : text[s];
    el.dataset.state = s;
    el.title = 'Draft autosave: only you see the draft until you publish.';
  }

  private scheduleChecks(): void {
    clearTimeout(this.checkTimer);
    this.checkTimer = window.setTimeout(() => {
      this.issues = checkLayout(this.room, this.objects, this.baseline);
      this.renderCheckBadge();
      if (this.tab === 'checks') this.renderPanels();
    }, 250);
  }

  // ------------------------------------------------------------ actions

  select(ids: Iterable<string>, add = false): void {
    if (!add) this.selected.clear();
    for (const id of ids) this.selected.add(id);
    this.npcFocus = null;
    if (this.selected.size && this.tab !== 'inspect') this.tab = 'inspect';
    this.renderPanels();
  }

  removeSelected(): void {
    if (!this.selected.size) return;
    const n = this.selected.size;
    this.edit(n === 1 ? `Apagar ${[...this.selected][0]}` : `Apagar ${n} objetos`, (o) => {
      for (let i = o.length - 1; i >= 0; i--) if (this.selected.has(o[i]!.id)) o.splice(i, 1);
    });
    this.selected.clear();
    this.renderPanels();
  }

  moveSelected(dx: number, dy: number, fine: boolean): void {
    const props = this.selectedProps().filter((p) => !this.hiddenOrLocked(p));
    if (!props.length) return;
    this.edit(fine ? 'Ajuste fino' : 'Mover', () => {
      for (const p of props) {
        if (fine) nudgePx(p, dx, dy);
        else shiftProp(p, dx, dy);
      }
    }, `move:${[...this.selected].join(',')}:${fine}`);
  }

  duplicate(): void {
    const src = this.selectedProps();
    if (!src.length) return;
    const copies = cloneProps(src, new Set(this.objects.map((p) => p.id)), 1, 1);
    this.edit(`Duplicar ${src.length}`, (o) => o.push(...copies));
    this.select(copies.map((p) => p.id));
  }

  copy(cut = false): void {
    const src = this.selectedProps();
    if (!src.length) return;
    writeJson(CLIP_KEY, { room: this.room, props: src });
    this.toast(`${src.length} ${src.length === 1 ? 'objeto copiado' : 'objetos copiados'}. Cole em qualquer sala.`);
    if (cut) this.removeSelected();
  }

  paste(): void {
    const clip = readJson<{ room: RoomId; props: PropDef[] } | null>(CLIP_KEY, null);
    if (!clip?.props?.length) return this.toast('Nada copiado ainda.');
    const at = this.pointerTile ?? this.viewCenterTile();
    const props = pasteAt(clip.props, new Set(this.objects.map((p) => p.id)), at);
    this.edit(`Colar ${props.length}${clip.room !== this.room ? ` de ${ROOMS[clip.room]?.name ?? clip.room}` : ''}`, (o) => o.push(...props));
    this.select(props.map((p) => p.id));
  }

  rotate(): void {
    const props = this.selectedProps();
    if (!props.length) return;
    let turned = 0;
    this.edit('Girar', () => {
      for (const p of props) if (rotateProp(p, this.art.has)) turned++;
    });
    if (!turned) {
      this.history.undo(this.objects);
      this.toast('Esse sprite não tem outras direções. Use espelhar (F).');
    }
  }

  flip(): void {
    const props = this.selectedProps();
    if (!props.length) return;
    this.edit('Espelhar', () => {
      for (const p of props) {
        if (p.flip) delete p.flip;
        else p.flip = true;
      }
    });
  }

  restack(dir: 1 | -1): void {
    if (!this.selected.size) return;
    this.edit(dir === 1 ? 'Trazer para frente' : 'Mandar para trás', (o) => restack(o, this.selected, dir, this.boxOf));
  }

  snapSelected(): void {
    const props = this.selectedProps();
    if (!props.length) return;
    this.edit('Alinhar à grade', () => props.forEach(snapToGrid));
  }

  place(asset: Asset, tile: Tile): void {
    const src = structuredClone(asset.template);
    const { w = 1, h = 1 } = src;
    // the pointer is the centre of the bottom row, like the sprite's anchor
    const x = tile.x - Math.floor((w - 1) / 2);
    const y = tile.y - (h - 1);
    shiftProp(src, x - src.x, y - src.y);
    delete src.ox;
    delete src.oy;
    src.id = freshId(src.id || src.kind, new Set(this.objects.map((p) => p.id)));
    this.edit(`Colocar ${asset.label}`, (o) => o.push(src));
    this.recent = bumpRecent(this.recent, asset.key);
    writeJson(RECENT_KEY, this.recent);
    this.select([src.id]);
  }

  ghostFor(asset: Asset, tile: Tile) {
    const w = asset.template.w ?? 1;
    const hh = asset.template.h ?? 1;
    const at = { x: tile.x - Math.floor((w - 1) / 2), y: tile.y - (hh - 1) };
    const grid = buildGrid({ ...this.def, props: this.objects });
    let ok = true;
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < hh; dy++) if (asset.template.blocks && !isWalkable(grid, at.x + dx, at.y + dy)) ok = false;
    return { sprite: asset.sprite, tile: at, w, h: hh, flip: asset.template.flip, ok };
  }

  undo(): void {
    const prev = this.history.undo(this.objects);
    if (!prev) return;
    this.objects = prev;
    for (const id of [...this.selected]) if (!this.byId(id)) this.selected.delete(id);
    this.changed();
  }

  redo(): void {
    const next = this.history.redo(this.objects);
    if (!next) return;
    this.objects = next;
    this.changed();
  }

  setTool(t: 'select' | 'pan'): void {
    this.tool = t;
    this.placing = null;
    this.pick = null;
    this.renderToolbar();
    this.renderPalette();
  }

  arm(asset: Asset | null): void {
    this.placing = this.placing?.key === asset?.key ? null : asset;
    this.pick = null;
    if (this.placing) this.selected.clear();
    this.renderPalette();
    this.renderPanels();
    this.renderToolbar();
  }

  startPick(id: string, field: 'interact' | 'gap'): void {
    this.pick = { id, field };
    this.placing = null;
    this.toast(field === 'interact' ? 'Toque no piso onde o jogador fica para usar.' : 'Toque nos pisos do portão (Esc para terminar).');
    this.renderToolbar();
  }

  private applyPick(tile: Tile, keep: boolean): void {
    const pk = this.pick;
    if (!pk) return;
    const p = this.byId(pk.id);
    if (!p) return void (this.pick = null);
    if (pk.field === 'interact') {
      this.edit(`Ponto de uso de ${p.id}`, () => (p.interact = { ...tile }));
      this.pick = null;
    } else {
      this.edit(`Portão de ${p.id}`, () => {
        const gaps = p.gaps ?? [];
        const i = gaps.findIndex((g) => g.x === tile.x && g.y === tile.y);
        if (i >= 0) gaps.splice(i, 1);
        else gaps.push({ ...tile });
        p.gaps = gaps;
      });
      if (!keep) this.pick = null;
    }
    this.renderToolbar();
  }

  zoom(step: number | null): void {
    game.designZoom = step === null ? 0 : Math.max(-2, Math.min(4, game.designZoom + step));
    if (step === null) game.designPan = { x: 0, y: 0 };
  }

  /** Pan so a world box sits in the middle of the free canvas between the panels. */
  focusBox(b: Box): void {
    const m = screenMap();
    if (!m) return;
    const left = this.els.left && this.prefs.left ? this.els.left.getBoundingClientRect().right : 0;
    const right = this.els.right && this.prefs.right ? this.els.right.getBoundingClientRect().left : window.innerWidth;
    const tx = (left + right) / 2;
    const ty = (56 + window.innerHeight) / 2;
    const px = m.ox + ((b.x0 + b.x1) / 2) * m.s;
    const py = m.oy + ((b.y0 + b.y1) / 2) * m.s;
    game.designPan = { x: game.designPan.x + (px - tx) / m.s, y: game.designPan.y + (py - ty) / m.s };
  }

  focusIds(ids: string[]): void {
    const boxes = ids.map((id) => this.byId(id)).filter((p): p is PropDef => !!p).map(this.boxOf);
    if (!boxes.length) return;
    this.focusBox({ x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) });
  }

  focusTiles(tiles: readonly Tile[]): void {
    if (!tiles.length) return;
    this.focusBox({ x0: Math.min(...tiles.map((t) => t.x)) * T, y0: Math.min(...tiles.map((t) => t.y)) * T, x1: (Math.max(...tiles.map((t) => t.x)) + 1) * T, y1: (Math.max(...tiles.map((t) => t.y)) + 1) * T });
  }

  viewCenterTile(): Tile {
    return this.tileAt(window.innerWidth / 2, window.innerHeight / 2) ?? { ...this.def.spawn };
  }

  // ------------------------------------------------------------ server actions

  async reload(): Promise<void> {
    this.server = await designApi.state(this.room);
    this.baseline = structuredClone(this.server.live);
    this.baseRev = this.server.rev;
  }

  private adopt(label: string, objects: PropDef[]): void {
    this.edit(label, (o) => o.splice(0, o.length, ...structuredClone(objects)));
    this.lastSaved = JSON.stringify(this.objects);
    this.setSave('clean');
  }

  async publish(force = false): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      const r = await designApi.publish(this.room, this.objects, this.baseRev, force);
      this.expectLayout = true;
      await this.reload();
      this.lastSaved = JSON.stringify(this.objects);
      this.setSave('clean');
      this.scheduleChecks();
      this.renderPanels();
      this.renderTop();
      this.toast(`Publicado (+${r.diff.added.length} −${r.diff.removed.length} ~${r.diff.changed.length}). Todo mundo já vê.`, 'ok');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.confirm({
          title: 'Alguém publicou esta sala',
          body: 'Someone published this room after you opened it. Publishing now replaces their version with yours (it stays in the history, so it can be reverted).',
          ok: 'Publicar mesmo assim',
          danger: true,
          onOk: () => void this.publish(true),
        });
      } else this.toast(err instanceof Error ? err.message : 'Não deu para publicar.', 'warn');
    } finally {
      this.publishing = false;
    }
  }

  async revertPublished(): Promise<void> {
    try {
      this.expectLayout = true;
      await designApi.revert(this.room);
      await this.reload();
      this.adopt('Voltar à publicação anterior', this.server.live);
      this.toast('A sala voltou à versão publicada antes.', 'ok');
    } catch (err) {
      this.toast(err instanceof Error ? err.message : 'Não deu.', 'warn');
    }
    this.renderTop();
  }

  async resetToCode(): Promise<void> {
    try {
      this.expectLayout = true;
      await designApi.reset(this.room);
      await this.reload();
      this.adopt('Voltar ao layout do código', this.server.live);
      this.toast('A sala voltou ao layout do código (dá para reverter).', 'ok');
    } catch (err) {
      this.toast(err instanceof Error ? err.message : 'Não deu.', 'warn');
    }
    this.renderTop();
  }

  async discardDraft(): Promise<void> {
    this.adopt('Descartar rascunho', this.baseline);
    await designApi.discardDraft(this.room).catch(() => {});
    this.toast('Rascunho descartado: de volta ao que está publicado.');
  }

  async pullRequest(): Promise<void> {
    this.toast('Preparando o arquivo…');
    try {
      const r = await designApi.pullRequest(this.room, this.objects);
      if (r.url) {
        this.confirm({ title: 'Pull request aberto', body: r.url, ok: 'Abrir no GitHub', onOk: () => window.open(r.url, '_blank', 'noopener') });
        return;
      }
      if (r.fallback && r.file) this.download(r.name ?? `${this.room}.json`, r.file);
      this.toast('Sem token do GitHub: arquivo baixado. Guarde em packages/shared/layouts/.', 'ok');
    } catch (err) {
      this.download(`${this.room}.json`, serializeLayout(this.room, this.objects));
      this.toast(`${err instanceof Error ? err.message : 'O GitHub falhou.'} Baixei o arquivo.`, 'warn');
    }
  }

  private download(name: string, text: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  expectLayout = false;

  /** The server pushed a layout for this room (our publish, or another admin's). */
  private onLayout(): void {
    const note = game.layoutNotice;
    if (!note || note.room !== this.room) return;
    if (this.expectLayout) {
      this.expectLayout = false;
    } else {
      void this.reload().then(() => {
        this.scheduleChecks();
        this.renderPanels();
      });
      this.toast('Outra pessoa publicou esta sala agora. Seu rascunho continua aqui; publicar vai pedir confirmação.', 'warn');
    }
    // the push re-installed the live props; keep showing the draft
    this.paint(true);
  }

  // ------------------------------------------------------------ pointer

  private inUi(e: Event): boolean {
    const t = e.target as Element | null;
    return !!t?.closest?.('.dm-ui');
  }

  onDown = (e: PointerEvent): void => {
    if (this.inUi(e) || e.isPrimary === false) return;
    if (this.preview) {
      e.preventDefault();
      e.stopPropagation();
      const t = this.tileAt(e.clientX, e.clientY);
      if (t && e.button === 0) this.preview.walkTo(t);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const w = this.worldAt(e.clientX, e.clientY);
    if (!w) return;
    const tile = { x: Math.floor(w.wx / T), y: Math.floor(w.wy / T) };
    if (e.button === 1 || e.button === 2 || this.tool === 'pan' || this.space) {
      this.drag = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, pan: { ...game.designPan } };
      document.body.classList.add('dm-panning');
      return;
    }
    if (e.button !== 0) return;
    if (this.pick) return this.applyPick(tile, e.shiftKey);
    if (this.placing) {
      this.place(this.placing, tile);
      if (!e.shiftKey && window.matchMedia('(pointer: coarse)').matches) this.arm(null);
      return;
    }
    const hit = pickAt(this.objects, w.wx, w.wy, this.boxOf, this.layerOf, this.hiddenOrLocked);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (hit) {
      if (additive) {
        if (this.selected.has(hit.id)) this.selected.delete(hit.id);
        else this.selected.add(hit.id);
        this.select([], true);
        if (!this.selected.has(hit.id)) return;
      } else if (!this.selected.has(hit.id)) this.select([hit.id]);
      const snap = new Map(this.selectedProps().filter((p) => !this.hiddenOrLocked(p)).map((p) => [p.id, structuredClone(p)]));
      this.drag = { kind: 'move', id: e.pointerId, wx: w.wx, wy: w.wy, sx: e.clientX, sy: e.clientY, snap, moved: false };
      return;
    }
    this.drag = { kind: 'marquee', id: e.pointerId, wx: w.wx, wy: w.wy, base: additive ? new Set(this.selected) : new Set(), box: null };
  };

  onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) {
      if (this.inUi(e) || this.preview) {
        this.hover = null;
        return;
      }
      const w = this.worldAt(e.clientX, e.clientY);
      this.pointerTile = w ? { x: Math.floor(w.wx / T), y: Math.floor(w.wy / T) } : null;
      const hit = w && !this.placing && !this.pick ? pickAt(this.objects, w.wx, w.wy, this.boxOf, this.layerOf, this.hiddenOrLocked) : null;
      this.hover = hit?.id ?? null;
      document.body.classList.toggle('dm-hovering', !!hit);
      return;
    }
    if (e.pointerId !== d.id) return;
    e.preventDefault();
    e.stopPropagation();
    if (d.kind === 'pan') {
      const s = screenMap()?.s || 1;
      game.designPan = { x: d.pan.x - (e.clientX - d.sx) / s, y: d.pan.y - (e.clientY - d.sy) / s };
      return;
    }
    const w = this.worldAt(e.clientX, e.clientY);
    if (!w) return;
    if (d.kind === 'marquee') {
      if (!d.box && Math.hypot(w.wx - d.wx, w.wy - d.wy) < 3) return;
      d.box = normBox({ x: d.wx, y: d.wy }, { x: w.wx, y: w.wy });
      this.selected = new Set([...d.base, ...marqueeIds(this.objects, d.box, this.boxOf, this.hiddenOrLocked)]);
      return;
    }
    if (!d.snap.size) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      this.history.record(d.snap.size === 1 ? `Mover ${[...d.snap.keys()][0]}` : `Mover ${d.snap.size} objetos`, this.objects);
      d.moved = true;
    }
    const snap = this.prefs.snap !== e.altKey;
    const dx = w.wx - d.wx;
    const dy = w.wy - d.wy;
    for (const [id, orig] of d.snap) {
      const p = this.byId(id);
      if (!p) continue;
      const fresh = structuredClone(orig);
      if (snap) shiftProp(fresh, Math.round(dx / T), Math.round(dy / T));
      else nudgePx(fresh, Math.round(dx), Math.round(dy));
      Object.keys(p).forEach((k) => delete (p as unknown as Record<string, unknown>)[k]);
      Object.assign(p, fresh);
    }
    this.paint();
    this.renderInspectorOnly();
  };

  onUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    document.body.classList.remove('dm-panning');
    if (d.kind === 'move' && d.moved) this.changed();
    if (d.kind === 'marquee') {
      if (!d.box && !d.base.size) this.selected.clear();
      this.select([], true);
    }
  };

  onWheel = (e: WheelEvent): void => {
    if (this.inUi(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      this.zoom(e.deltaY < 0 ? 1 : -1);
      return;
    }
    const s = screenMap()?.s || 1;
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    game.designPan = { x: game.designPan.x + dx / s, y: game.designPan.y + dy / s };
  };

  onContext = (e: MouseEvent): void => {
    if (!this.inUi(e)) e.preventDefault();
  };

  // ------------------------------------------------------------ keys

  onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (document.querySelector('.dm-modal')) {
      if (e.key === 'Escape') {
        stop();
        this.closeModal();
      }
      if (!typing) e.stopPropagation();
      return;
    }
    if (typing) {
      if (e.key === 'Escape') target!.blur();
      if (mod && (e.key === 's' || e.key === 'S')) {
        stop();
        void this.saveNow();
      }
      e.stopPropagation();
      return;
    }
    if (this.preview) {
      stop();
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') this.togglePreview();
      else this.preview.keyDown(e.key);
      return;
    }
    const k = e.key;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    stop();
    if (arrows[k]) {
      const [dx, dy] = arrows[k]!;
      if (!this.selected.size) {
        const s = e.shiftKey ? 4 : 1;
        game.designPan = { x: game.designPan.x + dx * T * s, y: game.designPan.y + dy * T * s };
      } else if (e.altKey) this.moveSelected(dx, dy, true);
      else this.moveSelected(dx * (e.shiftKey ? 4 : 1), dy * (e.shiftKey ? 4 : 1), false);
      return;
    }
    if (mod) {
      const lk = k.toLowerCase();
      if (lk === 'z') return e.shiftKey ? this.redo() : this.undo();
      if (lk === 'y') return this.redo();
      if (lk === 'c') return this.copy();
      if (lk === 'x') return this.copy(true);
      if (lk === 'v') return this.paste();
      if (lk === 'd') return this.duplicate();
      if (lk === 's') return void this.saveNow();
      if (lk === 'a') return this.select(this.objects.filter((p) => !this.hiddenOrLocked(p)).map((p) => p.id));
      if (k === 'Enter') return this.openPublish();
      return;
    }
    switch (k) {
      case 'Escape':
        if (this.pick) this.pick = null;
        else if (this.placing) this.arm(null);
        else this.select([]);
        this.renderToolbar();
        return;
      case 'Delete':
      case 'Backspace':
        return this.removeSelected();
      case 'v':
      case 'V':
        return this.setTool('select');
      case 'h':
      case 'H':
        return this.setTool('pan');
      case ' ':
        this.space = true;
        document.body.classList.add('dm-space');
        return;
      case 's':
      case 'S':
        return this.togglePref('snap');
      case 'g':
      case 'G':
        return this.togglePref('grid');
      case 'c':
      case 'C':
        return this.toggleLayer('collision', 'hidden');
      case 'i':
      case 'I':
        return this.togglePref('hotspots');
      case 'n':
      case 'N':
        return this.togglePref('npcs');
      case 'r':
      case 'R':
        return this.rotate();
      case 'f':
      case 'F':
        return this.flip();
      case ']':
        return this.restack(1);
      case '[':
        return this.restack(-1);
      case '+':
      case '=':
        return this.zoom(1);
      case '-':
      case '_':
        return this.zoom(-1);
      case '0':
        return this.zoom(null);
      case 'p':
      case 'P':
        return this.togglePreview();
      case '\\':
        this.prefs.left = this.prefs.right = !(this.prefs.left || this.prefs.right);
        return this.savePrefs();
      case '?':
        return this.openCheatSheet();
    }
  };

  onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === ' ') {
      this.space = false;
      document.body.classList.remove('dm-space');
    }
    this.preview?.keyUp(e.key);
  };

  togglePref(k: 'snap' | 'grid' | 'hotspots' | 'npcs'): void {
    this.prefs[k] = !this.prefs[k];
    this.savePrefs();
  }

  toggleLayer(k: LayerKey, what: 'hidden' | 'locked'): void {
    this.layers[k][what] = !this.layers[k][what];
    if (k !== 'collision') {
      for (const p of this.selectedProps()) if (this.hiddenOrLocked(p)) this.selected.delete(p.id);
      this.paint();
    } else writeJson(PREFS_KEY, { ...this.prefs, collision: !this.layers.collision.hidden });
    this.renderPanels();
    this.renderToolbar();
  }

  savePrefs(): void {
    writeJson(PREFS_KEY, { ...this.prefs, collision: !this.layers.collision.hidden });
    this.root.classList.toggle('dm-left-closed', !this.prefs.left);
    this.root.classList.toggle('dm-right-closed', !this.prefs.right);
    this.renderToolbar();
  }

  togglePreview(): void {
    if (this.preview) {
      this.preview.stop();
      this.preview = null;
      this.root.classList.remove('dm-previewing');
      this.paint(true);
    } else {
      this.placing = null;
      this.pick = null;
      this.preview = new Preview(this);
      this.root.classList.add('dm-previewing');
      this.paint(true);
      this.toast('Pré-visualização: ande com as setas/WASD ou tocando no chão. Só você vê. P ou Esc para voltar.');
    }
    this.renderTop();
  }

  // ------------------------------------------------------------ frame

  private frame = (): void => {
    this.raf = requestAnimationFrame(this.frame);
    this.preview?.tick();
    const issueTiles = this.issueFocus ? this.issueFocus.tiles : this.issues.filter((i) => i.severity === 'error').flatMap((i) => i.tiles);
    const npc = this.npcFocus ? this.def.npcs.find((n) => n.id === this.npcFocus) : null;
    this.overlay.draw({
      room: this.def,
      objects: this.objects,
      grid: this.prefs.grid,
      collision: !this.layers.collision.hidden,
      hotspots: this.prefs.hotspots,
      npcs: this.prefs.npcs,
      selected: this.selected,
      hover: this.hover,
      boxOf: this.boxOf,
      marquee: this.drag?.kind === 'marquee' ? this.drag.box : null,
      ghost: this.placing && this.pointerTile && !this.drag ? this.ghostFor(this.placing, this.pointerTile) : null,
      pickTile: this.pick ? this.pointerTile : null,
      issueTiles,
      npcFocus: npc
        ? {
            id: npc.id,
            points: [
              { tile: { x: npc.x, y: npc.y }, label: 'casa' },
              ...(npc.schedule ?? [])
                .filter((s) => s.room === this.room)
                .map((s) => ({ tile: s.tile, label: `${String(Math.floor(s.from / 60)).padStart(2, '0')}h ${s.activity}` })),
            ],
          }
        : null,
      preview: !!this.preview,
    });
  };

  // ------------------------------------------------------------ DOM

  mount(): void {
    const top = h('header', { class: 'dm-top dm-ui', role: 'toolbar', 'aria-label': 'Design mode' });
    const left = h('aside', { class: 'dm-left dm-ui dm-panel', 'aria-label': 'Paleta de objetos (asset palette)' });
    const right = h('aside', { class: 'dm-right dm-ui dm-panel', 'aria-label': 'Inspetor (inspector)' });
    const tools = h('div', { class: 'dm-tools dm-ui', role: 'toolbar', 'aria-label': 'Ferramentas (tools)' });
    const toasts = h('div', { class: 'dm-toasts dm-ui', 'aria-live': 'polite' });
    Object.assign(this.els, { top, left, right, tools, toasts });
    this.root.append(top, left, right, tools, toasts);
    document.body.append(this.overlay.canvas, this.root);
    document.body.classList.add('dm-active');
    this.savePrefs();
    this.renderTop();
    this.renderPalette();
    this.renderPanels();
    this.renderToolbar();
    window.addEventListener('pointerdown', this.onDown, true);
    window.addEventListener('pointermove', this.onMove, true);
    window.addEventListener('pointerup', this.onUp, true);
    window.addEventListener('pointercancel', this.onUp, true);
    window.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
    window.addEventListener('contextmenu', this.onContext, true);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('beforeunload', this.onUnload);
    this.offLayout = game.on('layout', () => this.onLayout());
    this.paint(true);
    this.scheduleChecks();
    this.raf = requestAnimationFrame(this.frame);
  }

  private onUnload = () => this.flushOnUnload();

  unmount(): void {
    this.preview?.stop();
    this.preview = null;
    this.flushOnUnload();
    clearTimeout(this.saveTimer);
    clearTimeout(this.checkTimer);
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointerdown', this.onDown, true);
    window.removeEventListener('pointermove', this.onMove, true);
    window.removeEventListener('pointerup', this.onUp, true);
    window.removeEventListener('pointercancel', this.onUp, true);
    window.removeEventListener('wheel', this.onWheel, true);
    window.removeEventListener('contextmenu', this.onContext, true);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('beforeunload', this.onUnload);
    this.offLayout?.();
    this.overlay.canvas.remove();
    this.root.remove();
    document.body.classList.remove('dm-active', 'dm-panning', 'dm-space', 'dm-hovering');
    // players' layout again on this client
    installRoomProps(this.room, this.server.live);
    game.bumpLayout();
  }

  exit(): void {
    this.onExit();
  }

  private renderTop(): void {
    const top = this.els.top!;
    const roomSel = h(
      'select',
      {
        id: 'design-room',
        class: 'dm-room',
        title: 'Room (opens it in design mode; your draft here is kept)',
        onchange: (e: Event) => {
          const id = (e.target as HTMLSelectElement).value as RoomId;
          if (id === this.room) return;
          this.flushOnUnload();
          const url = new URL(location.href);
          url.searchParams.set('design', id);
          location.href = url.toString();
        },
      },
      ...this.server.rooms.map((r) => h('option', { value: r.id, selected: r.id === this.room }, `${r.name}${r.draft && r.id !== this.room ? ' • rascunho' : ''}${r.override ? '' : ' (código)'}`)),
    );
    const save = h('button', { type: 'button', class: 'dm-save', id: 'design-save-state', onclick: () => void this.saveNow() });
    this.els.save = save;
    const checks = h('button', { type: 'button', class: 'dm-checks-badge', id: 'design-checks', title: 'Pre-publish checks', onclick: () => this.showTab('checks') });
    this.els.checks = checks;
    const more = this.menu('⋯', 'More: revert, reset, pull request, discard', [
      { label: 'Descartar rascunho', en: 'Discard draft (back to what is live)', run: () => this.confirm({ title: 'Descartar o rascunho?', body: 'Your edits since the last publish go away (undo can still bring them back in this session).', ok: 'Descartar', danger: true, onOk: () => void this.discardDraft() }) },
      {
        label: 'Voltar à publicação anterior',
        en: this.server.history.length ? `Revert live to the version before ${fmtDate(this.server.history.at(-1)!.at)}` : 'Nothing published before',
        disabled: !this.server.history.length,
        run: () =>
          this.confirm({
            title: 'Reverter a sala publicada?',
            body: `Everyone sees the room as it was before the last publish (${this.server.history.at(-1)?.objects === null ? 'the code layout' : `${this.server.history.at(-1)?.objects} objects`}). Goes to the audit log.`,
            ok: 'Reverter para todos',
            danger: true,
            onOk: () => void this.revertPublished(),
          }),
      },
      {
        label: 'Restaurar layout do código',
        en: this.server.source === 'override' ? 'Reset the live room to the code default' : 'Already the code layout',
        disabled: this.server.source !== 'override',
        run: () => this.confirm({ title: 'Voltar ao layout do código?', body: 'Everyone sees the layout shipped in the repo. What is live now stays in the history (revert brings it back). Goes to the audit log.', ok: 'Restaurar para todos', danger: true, onOk: () => void this.resetToCode() }),
      },
      { label: this.server.github ? 'Abrir PR com o layout' : 'Baixar JSON do layout', en: this.server.github ? 'Open a GitHub pull request with this layout' : 'No TB_GITHUB_TOKEN: download the file', run: () => void this.pullRequest() },
    ]);
    top.replaceChildren(
      btn('☰', 'Toggle the asset palette', () => ((this.prefs.left = !this.prefs.left), this.savePrefs()), { cls: 'dm-btn dm-icon', pressed: this.prefs.left }),
      h('div', { class: 'dm-brand' }, h('b', null, 'Modo design'), h('small', null, this.server.source === 'override' ? 'publicado' : 'layout do código')),
      roomSel,
      h(
        'div',
        { class: 'dm-group' },
        btn('↶', 'Undo (Ctrl+Z)', () => this.undo(), { id: 'design-undo', cls: 'dm-btn dm-icon', disabled: !this.history.canUndo }),
        btn('↷', 'Redo (Ctrl+Shift+Z)', () => this.redo(), { id: 'design-redo', cls: 'dm-btn dm-icon', disabled: !this.history.canRedo }),
      ),
      save,
      h('span', { class: 'dm-spacer' }),
      checks,
      h('div', { class: 'dm-group' }, btn('−', 'Zoom out (−)', () => this.zoom(-1), { cls: 'dm-btn dm-icon' }), btn('+', 'Zoom in (+)', () => this.zoom(1), { cls: 'dm-btn dm-icon' })),
      btn(this.preview ? '■ Parar' : '▶ Andar', 'Live preview: walk your avatar in the draft (P)', () => this.togglePreview(), { id: 'design-preview', cls: 'dm-btn dm-preview', pressed: !!this.preview }),
      btn('Publicar…', 'Publish to everyone (Ctrl+Enter)', () => this.openPublish(), { id: 'design-publish', cls: 'dm-btn dm-primary' }),
      more,
      btn('?', 'Keyboard shortcuts (?)', () => this.openCheatSheet(), { cls: 'dm-btn dm-icon', id: 'design-help' }),
      btn('Sair', 'Exit design mode', () => this.exit(), { id: 'design-exit', cls: 'dm-btn' }),
      btn('☰', 'Toggle the inspector', () => ((this.prefs.right = !this.prefs.right), this.savePrefs()), { cls: 'dm-btn dm-icon', pressed: this.prefs.right }),
    );
    this.setSave(this.saveState);
    this.renderCheckBadge();
  }

  private renderCheckBadge(): void {
    const el = this.els.checks;
    if (!el) return;
    const errors = this.issues.filter((i) => i.severity === 'error').length;
    const warns = this.issues.length - errors;
    el.textContent = errors ? `⚠ ${errors} ${errors === 1 ? 'erro' : 'erros'}${warns ? ` · ${warns}` : ''}` : warns ? `△ ${warns} ${warns === 1 ? 'aviso' : 'avisos'}` : '✓ Tudo certo';
    el.dataset.level = errors ? 'error' : warns ? 'warn' : 'ok';
    const undo = this.els.top?.querySelector<HTMLButtonElement>('#design-undo');
    const redo = this.els.top?.querySelector<HTMLButtonElement>('#design-redo');
    if (undo) undo.disabled = !this.history.canUndo;
    if (redo) redo.disabled = !this.history.canRedo;
  }

  private menu(label: string, title: string, items: { label: string; en: string; disabled?: boolean; run: () => void }[]): HTMLElement {
    const list = h('div', { class: 'dm-menu-list', role: 'menu', hidden: true });
    const wrap = h('div', { class: 'dm-menu' });
    const toggle = btn(label, title, () => {
      list.hidden = !list.hidden;
      if (!list.hidden) setTimeout(() => window.addEventListener('pointerdown', close, { capture: true, once: true }));
    }, { cls: 'dm-btn dm-icon', id: 'design-more' });
    const close = (e: Event) => {
      if (!wrap.contains(e.target as Node)) list.hidden = true;
      else window.addEventListener('pointerdown', close, { capture: true, once: true });
    };
    for (const it of items) {
      const b = h('button', { type: 'button', role: 'menuitem', class: 'dm-menu-item', disabled: !!it.disabled, onclick: () => ((list.hidden = true), it.run()) }, h('b', null, it.label), h('small', null, it.en));
      list.append(b);
    }
    wrap.append(toggle, list);
    return wrap;
  }

  renderToolbar(): void {
    const t = this.els.tools;
    if (!t) return;
    // "⬚ Selecionar": the icon stays on a narrow screen, the word goes
    const toggle = (label: string, title: string, on: boolean, run: () => void, id?: string) => {
      const [icon, ...word] = label.split(' ');
      const content = h('span', null, h('span', { class: 'dm-ico' }, icon!), word.length ? h('span', { class: 'dm-txt' }, ` ${word.join(' ')}`) : null);
      return btn(content, title, run, { cls: 'dm-btn dm-tool', pressed: on, id });
    };
    const sel = this.selected.size;
    t.replaceChildren(h(
      'div',
      { class: 'dm-tools-row' },
      h(
        'div',
        { class: 'dm-group' },
        toggle('⬚ Selecionar', 'Select tool (V)', this.tool === 'select' && !this.placing && !this.pick, () => this.setTool('select'), 'design-tool-select'),
        toggle('✋ Mover vista', 'Pan tool (H, or hold Space)', this.tool === 'pan', () => this.setTool('pan'), 'design-tool-pan'),
      ),
      h(
        'div',
        { class: 'dm-group' },
        toggle('# Grade magnética', 'Snap to the tile grid (S). Hold Alt while dragging to place freely.', this.prefs.snap, () => this.togglePref('snap'), 'design-snap'),
      ),
      h(
        'div',
        { class: 'dm-group' },
        toggle('▦', 'Grid overlay (G)', this.prefs.grid, () => this.togglePref('grid'), 'design-show-grid'),
        toggle('⛔', 'Collision / walkable overlay (C)', !this.layers.collision.hidden, () => this.toggleLayer('collision', 'hidden'), 'design-show-collision'),
        toggle('◆', 'Hotspots: use tiles, doors, seats, spawn (I)', this.prefs.hotspots, () => this.togglePref('hotspots'), 'design-show-hotspots'),
        toggle('☺', 'NPC spots (N)', this.prefs.npcs, () => this.togglePref('npcs'), 'design-show-npcs'),
      ),
      sel
        ? h(
            'div',
            { class: 'dm-group dm-sel-actions' },
            btn('⟳', 'Rotate (R)', () => this.rotate(), { cls: 'dm-btn dm-icon', id: 'design-rotate' }),
            btn('⇋', 'Flip (F)', () => this.flip(), { cls: 'dm-btn dm-icon', id: 'design-flip' }),
            btn('⤒', 'Bring forward (])', () => this.restack(1), { cls: 'dm-btn dm-icon', id: 'design-forward' }),
            btn('⤓', 'Send back ([)', () => this.restack(-1), { cls: 'dm-btn dm-icon', id: 'design-back' }),
            btn('⧉', 'Duplicate (Ctrl+D)', () => this.duplicate(), { cls: 'dm-btn dm-icon', id: 'design-duplicate' }),
            btn('🗑', 'Delete (Del)', () => this.removeSelected(), { cls: 'dm-btn dm-icon dm-danger', id: 'design-delete' }),
          )
        : null,
      this.placing ? h('span', { class: 'dm-hint' }, `Colocando: ${this.placing.label}. Clique no mapa (Shift para vários), Esc para parar.`) : null,
      this.pick ? h('span', { class: 'dm-hint' }, this.pick.field === 'interact' ? 'Clique no piso de uso.' : 'Clique nos pisos do portão. Esc termina.') : null,
    ));
  }

  // ---------------- palette

  renderPalette(): void {
    const left = this.els.left;
    if (!left) return;
    const search = h('input', {
      type: 'search',
      class: 'dm-search',
      id: 'design-search',
      placeholder: 'Buscar objetos… (search)',
      value: this.query,
      oninput: (e: Event) => {
        this.query = (e.target as HTMLInputElement).value;
        this.renderPaletteGrid();
      },
    });
    const chips = h('div', { class: 'dm-chips', role: 'tablist' });
    const chip = (id: Editor['category'], pt: string, en: string, n: number) =>
      chips.append(
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: 'dm-chip',
            title: en,
            'aria-selected': String(this.category === id),
            'data-cat': id,
            onclick: () => {
              this.category = id;
              this.renderPalette();
            },
          },
          pt,
          n >= 0 ? h('small', null, String(n)) : null,
        ),
      );
    chip('all', 'Tudo', 'All', this.assets.length);
    chip('favs', '★', 'Favorites', this.favs.size);
    chip('recent', 'Recentes', 'Recently used', this.recent.length);
    for (const c of CATEGORIES) chip(c.id, c.pt, c.en, c.id === 'npcs' ? this.def.npcs.length : this.assets.filter((a) => a.category === c.id).length);
    const grid = h('div', { class: 'dm-grid', id: 'design-palette' });
    this.els.grid = grid;
    left.replaceChildren(h('div', { class: 'dm-panel-head' }, h('h2', null, 'Paleta'), h('small', null, 'Asset palette')), search, chips, grid);
    this.renderPaletteGrid();
  }

  private renderPaletteGrid(): void {
    const grid = this.els.grid;
    if (!grid) return;
    grid.replaceChildren();
    if (this.category === 'npcs' && !this.query) {
      grid.classList.add('dm-list');
      if (!this.def.npcs.length) grid.append(h('p', { class: 'dm-empty' }, 'Nenhum NPC mora nesta sala. (No NPC spots in this room.)'));
      for (const n of this.def.npcs) {
        grid.append(
          h(
            'button',
            {
              type: 'button',
              class: 'dm-npc',
              'aria-pressed': String(this.npcFocus === n.id),
              onclick: () => {
                this.npcFocus = this.npcFocus === n.id ? null : n.id;
                this.selected.clear();
                this.prefs.npcs = true;
                this.focusTiles([{ x: n.x, y: n.y }]);
                this.renderPanels();
                this.renderPaletteGrid();
                this.renderToolbar();
              },
            },
            h('b', null, n.name),
            h('small', null, `${n.role.pt} · piso ${n.x},${n.y}${n.schedule ? ' · tem agenda' : ' · fixo'}`),
          ),
        );
      }
      return;
    }
    grid.classList.remove('dm-list');
    let list = this.assets;
    if (this.category === 'favs') list = list.filter((a) => this.favs.has(a.key));
    else if (this.category === 'recent') list = this.recent.map((k) => this.assets.find((a) => a.key === k)).filter((a): a is Asset => !!a);
    else if (this.category !== 'all' && this.category !== 'npcs') list = list.filter((a) => a.category === this.category);
    if (this.query) list = list.filter((a) => matches(a, this.query));
    if (!list.length) grid.append(h('p', { class: 'dm-empty' }, this.category === 'favs' ? 'Marque objetos com ★ para achá-los aqui.' : 'Nada encontrado.'));
    for (const a of list) {
      const fav = this.favs.has(a.key);
      const tile = h(
        'div',
        { class: 'dm-asset', role: 'button', tabindex: '0', title: `${a.label} (${a.sprite ?? a.template.kind})${a.template.action ? ` · ${a.template.action}` : ''}`, 'data-asset': a.key, 'aria-pressed': String(this.placing?.key === a.key) },
        this.art.thumb(a.sprite, 52, !!a.template.flip),
        h('span', { class: 'dm-asset-label' }, a.label),
        a.template.action || a.template.seat ? h('span', { class: 'dm-asset-tag' }, a.template.action ? '!' : 'h') : null,
        h(
          'button',
          {
            type: 'button',
            class: 'dm-fav',
            title: fav ? 'Remove from favorites' : 'Add to favorites',
            'aria-pressed': String(fav),
            onclick: (e: Event) => {
              e.stopPropagation();
              if (fav) this.favs.delete(a.key);
              else this.favs.add(a.key);
              writeJson(FAVS_KEY, [...this.favs]);
              this.renderPalette();
            },
          },
          fav ? '★' : '☆',
        ),
      );
      tile.addEventListener('click', () => this.arm(a));
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.arm(a);
      });
      // drag from the palette straight onto the map (mouse or touch)
      tile.addEventListener('pointerdown', (e) => this.dragFromPalette(e, a));
      grid.append(tile);
    }
  }

  private dragFromPalette(e: PointerEvent, a: Asset): void {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let dragging = false;
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
        dragging = true;
        this.placing = a;
      }
      if (dragging) this.pointerTile = this.tileAt(ev.clientX, ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      if (!dragging) return;
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      const t = this.tileAt(ev.clientX, ev.clientY);
      this.placing = null;
      if (t && !over?.closest('.dm-ui')) this.place(a, t);
      this.renderPalette();
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
  }

  // ---------------- right panel

  showTab(t: Tab): void {
    this.tab = t;
    if (!this.prefs.right) {
      this.prefs.right = true;
      this.savePrefs();
    }
    this.renderPanels();
  }

  renderPanels(): void {
    const right = this.els.right;
    if (!right) return;
    const tabs = h('div', { class: 'dm-tabs', role: 'tablist' });
    const tabBtn = (id: Tab, pt: string, en: string, badge?: string) =>
      tabs.append(h('button', { type: 'button', role: 'tab', class: 'dm-tab', title: en, 'aria-selected': String(this.tab === id), 'data-tab': id, onclick: () => this.showTab(id) }, pt, badge ? h('small', null, badge) : null));
    const diff = layoutDiff(this.baseline, this.objects);
    const nChanges = diff.added.length + diff.removed.length + diff.changed.length;
    tabBtn('inspect', 'Inspetor', 'Inspector');
    tabBtn('layers', 'Camadas', 'Layers');
    tabBtn('changes', 'Alterações', 'Changes', nChanges ? String(nChanges) : undefined);
    tabBtn('checks', 'Checagem', 'Checks', this.issues.length ? String(this.issues.length) : undefined);
    const body = h('div', { class: 'dm-panel-body', id: 'design-panel-body' });
    this.els.body = body;
    right.replaceChildren(tabs, body);
    if (this.tab === 'inspect') this.renderInspectorOnly();
    else if (this.tab === 'layers') this.renderLayers(body);
    else if (this.tab === 'changes') this.renderChanges(body, diff);
    else this.renderChecks(body);
    this.renderToolbar();
    this.renderCheckBadge();
  }

  renderInspectorOnly(): void {
    const body = this.els.body;
    if (!body || this.tab !== 'inspect') return;
    // typing in a field: keep it (the edit already landed), only refresh when focus is elsewhere
    if (body.contains(document.activeElement) && (document.activeElement as HTMLElement).tagName === 'INPUT') return;
    renderInspector(body, this.inspectorHost());
  }

  private inspectorHost(): InspectorHost {
    return {
      art: this.art,
      room: this.def,
      server: this.server,
      selected: this.selectedProps(),
      npcFocus: this.npcFocus,
      codeIds: new Set(this.server.code.map((p) => p.id)),
      allIds: new Set(this.objects.map((p) => p.id)),
      layerOf: this.layerOf,
      layerLocked: (l) => this.layers[l].locked,
      collisionLocked: this.layers.collision.locked,
      edit: (label, fn, mergeKey) => this.edit(label, () => this.selectedProps().forEach(fn), mergeKey),
      editOne: (id, label, fn, mergeKey) => {
        const p = this.byId(id);
        if (p) this.edit(label, () => fn(p), mergeKey);
      },
      rename: (id, next) => {
        const p = this.byId(id);
        if (!p) return;
        this.edit(`Renomear ${id}`, () => (p.id = next));
        this.selected.delete(id);
        this.selected.add(next);
        this.renderPanels();
      },
      startPick: (id, field) => this.startPick(id, field),
      select: (ids) => {
        this.select(ids);
        this.focusIds(ids);
      },
      focusTiles: (tiles) => this.focusTiles(tiles),
      focusNpc: (id) => {
        this.npcFocus = id;
        this.prefs.npcs = true;
        const n = this.def.npcs.find((x) => x.id === id);
        if (n) this.focusTiles([{ x: n.x, y: n.y }]);
        this.renderPanels();
      },
      rotate: () => this.rotate(),
      flip: () => this.flip(),
      restack: (d) => this.restack(d),
      duplicate: () => this.duplicate(),
      remove: () => this.removeSelected(),
      snap: () => this.snapSelected(),
      depthOf: drawDepth,
    };
  }

  private renderLayers(body: HTMLElement): void {
    const counts: Record<Layer, number> = { floor: 0, objects: 0, overhead: 0 };
    for (const p of this.objects) counts[this.layerOf(p)]++;
    const rows = ([...LAYERS, 'collision'] as LayerKey[]).map((k) => {
      const l = this.layers[k];
      const n = k === 'collision' ? this.objects.filter((p) => p.blocks).length : counts[k];
      return h(
        'div',
        { class: 'dm-layer', 'data-layer': k, 'data-hidden': String(l.hidden), 'data-locked': String(l.locked) },
        btn(l.hidden ? '◌' : '◉', `${l.hidden ? 'Show' : 'Hide'} ${LAYER_LABEL[k].en}`, () => this.toggleLayer(k, 'hidden'), { cls: 'dm-btn dm-icon', pressed: !l.hidden, id: `design-layer-${k}-eye` }),
        btn(l.locked ? '🔒' : '🔓', `${l.locked ? 'Unlock' : 'Lock'} ${LAYER_LABEL[k].en}`, () => this.toggleLayer(k, 'locked'), { cls: 'dm-btn dm-icon', pressed: l.locked, id: `design-layer-${k}-lock` }),
        h('span', { class: 'dm-layer-name' }, h('b', null, LAYER_LABEL[k].pt), h('small', null, `${LAYER_LABEL[k].en} · ${n}`)),
      );
    });
    body.replaceChildren(
      h('p', { class: 'dm-note' }, 'Esconder só muda a sua vista. Travar impede selecionar e mover. (Hide only changes your view; lock stops picking and moving.)'),
      ...rows,
      h('p', { class: 'dm-note' }, 'Colisão: escondida tira o mapa de pisos bloqueados; travada impede mudar "bloqueia". (Collision: the overlay, and whether "blocks" can change.)'),
    );
  }

  private renderChanges(body: HTMLElement, diff: ReturnType<typeof layoutDiff>): void {
    const entries = this.history.entries();
    const line = (id: string, kind: string, detail?: string) =>
      h('button', { type: 'button', class: `dm-change dm-change-${kind}`, onclick: () => this.byId(id) && this.inspectorHost().select([id]) }, h('b', null, { add: '+', del: '−', mod: '~' }[kind] ?? ''), h('span', null, id), detail ? h('small', null, detail) : null);
    const since =
      diff.added.length + diff.removed.length + diff.changed.length
        ? [...diff.added.map((id) => line(id, 'add')), ...diff.removed.map((id) => line(id, 'del')), ...diff.changed.map((c) => line(c.id, 'mod', c.fields.join(', ')))]
        : [h('p', { class: 'dm-empty' }, 'Igual ao que está publicado. (Same as live.)')];
    const hist = [...entries.done.map((e, i) => ({ ...e, i, done: true })), ...entries.undone.map((e, i) => ({ ...e, i, done: false }))];
    body.replaceChildren(
      h('h3', null, 'Desde a publicação', h('small', null, `Since publish (${this.server.source === 'override' ? 'live override' : 'code layout'})`)),
      h('div', { class: 'dm-changes' }, ...since),
      h('h3', null, 'Histórico da sessão', h('small', null, 'Session history: click to go back to that point')),
      h(
        'ol',
        { class: 'dm-history', reversed: true },
        ...hist.reverse().map((e) =>
          h(
            'li',
            { class: e.done ? '' : 'dm-undone' },
            h(
              'button',
              {
                type: 'button',
                onclick: () => {
                  // walk the stacks to that entry: done entries undo down to it, undone ones redo up to it
                  if (e.done) for (let n = entries.done.length - 1; n > e.i; n--) this.undo();
                  else for (let n = 0; n <= e.i; n++) this.redo();
                },
              },
              h('span', null, e.label),
              h('small', null, fmtTime(e.at)),
            ),
          ),
        ),
        hist.length ? null : h('li', { class: 'dm-empty' }, 'Nenhuma edição ainda.'),
      ),
      h('h3', null, 'Publicações', h('small', null, 'Published versions kept for revert')),
      h(
        'ul',
        { class: 'dm-pubs' },
        ...this.server.history
          .slice()
          .reverse()
          .map((v) => h('li', null, `${fmtDate(v.at)} · ${v.by || '—'} · antes: ${v.objects === null ? 'código' : `${v.objects} objetos`}`)),
        this.server.history.length ? null : h('li', { class: 'dm-empty' }, 'Nenhuma publicação guardada.'),
      ),
    );
  }

  private renderChecks(body: HTMLElement): void {
    const items = this.issues.map((i) =>
      h(
        'button',
        {
          type: 'button',
          class: `dm-issue dm-issue-${i.severity}`,
          'aria-pressed': String(this.issueFocus === i),
          onclick: () => {
            this.issueFocus = this.issueFocus === i ? null : i;
            if (i.ids.length) this.select(i.ids);
            if (i.tiles.length) this.focusTiles(i.tiles.slice(0, 40));
            else this.focusIds(i.ids);
            this.renderPanels();
          },
        },
        h('b', null, i.severity === 'error' ? '⚠' : '△'),
        h('span', null, i.pt, h('small', null, i.en)),
      ),
    );
    body.replaceChildren(
      h('p', { class: 'dm-note' }, 'Só aparece o que a sua edição mudou. Erros pedem confirmação para publicar. (Only problems your edit introduced; errors need a confirm to publish.)'),
      ...(items.length ? items : [h('p', { class: 'dm-ok' }, '✓ Portas livres, pontos de uso alcançáveis, nada novo fora do mapa ou sobreposto.')]),
    );
  }

  // ---------------- modals and toasts

  toast(text: string, level: 'info' | 'ok' | 'warn' = 'info'): void {
    const el = h('div', { class: `dm-toast dm-toast-${level}`, role: 'status' }, text);
    this.els.toasts?.append(el);
    setTimeout(() => el.classList.add('dm-out'), 4200);
    setTimeout(() => el.remove(), 4700);
  }

  closeModal(): void {
    document.querySelector('.dm-modal-back')?.remove();
  }

  modal(title: string, en: string, content: (Node | null)[], actions: HTMLElement[], cls = ''): void {
    this.closeModal();
    const back = h(
      'div',
      { class: 'dm-modal-back dm-ui', onclick: (e: Event) => e.target === back && this.closeModal() },
      h('div', { class: `dm-modal ${cls}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', null, title), en ? h('p', { class: 'dm-modal-en' }, en) : null, content, h('div', { class: 'dm-modal-actions' }, ...actions)),
    );
    this.root.append(back);
    back.querySelector<HTMLElement>('.dm-primary, .dm-danger-btn')?.focus();
  }

  confirm(o: { title: string; body: string; ok: string; danger?: boolean; onOk: () => void }): void {
    this.modal(o.title, '', [h('p', null, o.body)], [
      btn('Cancelar', 'Cancel', () => this.closeModal(), { cls: 'dm-btn' }),
      btn(o.ok, o.ok, () => (this.closeModal(), o.onOk()), { cls: o.danger ? 'dm-btn dm-danger-btn' : 'dm-btn dm-primary', id: 'design-confirm-ok' }),
    ]);
  }

  openPublish(): void {
    this.issues = checkLayout(this.room, this.objects, this.baseline);
    const diff = layoutDiff(this.baseline, this.objects);
    const errors = this.issues.filter((i) => i.severity === 'error');
    const total = diff.added.length + diff.removed.length + diff.changed.length;
    const confirmBox = h('input', { type: 'checkbox', id: 'design-publish-anyway' }) as HTMLInputElement;
    const ok = btn('Publicar para todos', 'Publish to every player now (goes to the audit log)', () => {
      if (errors.length && !confirmBox.checked) return;
      this.closeModal();
      void this.publish();
    }, { cls: 'dm-btn dm-primary', id: 'design-publish-go', disabled: !!errors.length || !total });
    confirmBox.addEventListener('change', () => (ok.disabled = !confirmBox.checked || !total));
    this.modal(
      `Publicar ${this.def.name}?`,
      'Everyone in the room sees it at once. The version live now is kept, so you can revert. The publish goes to the admin audit log.',
      [
        h(
          'div',
          { class: 'dm-diff-sum' },
          h('span', { class: 'dm-add' }, `+${diff.added.length} novos`),
          h('span', { class: 'dm-del' }, `−${diff.removed.length} apagados`),
          h('span', { class: 'dm-mod' }, `~${diff.changed.length} alterados`),
        ),
        total ? null : h('p', { class: 'dm-empty' }, 'Nada mudou desde a publicação. (Nothing to publish.)'),
        this.issues.length
          ? h('ul', { class: 'dm-issues-mini' }, ...this.issues.slice(0, 8).map((i) => h('li', { class: `dm-issue-${i.severity}` }, `${i.severity === 'error' ? '⚠' : '△'} ${i.pt}`)), this.issues.length > 8 ? h('li', null, `… +${this.issues.length - 8}`) : null)
          : h('p', { class: 'dm-ok' }, '✓ Checagem sem problemas.'),
        errors.length ? h('label', { class: 'dm-anyway' }, confirmBox, ` Publicar mesmo com ${errors.length} ${errors.length === 1 ? 'erro' : 'erros'} (players may get stuck)`) : null,
      ],
      [btn('Cancelar', 'Cancel', () => this.closeModal(), { cls: 'dm-btn' }), ok],
      'dm-publish',
    );
  }

  openCheatSheet(): void {
    this.modal(
      'Atalhos do teclado',
      'Keyboard shortcuts',
      [h('table', { class: 'dm-keys' }, ...SHORTCUTS.map(([k, pt, en]) => h('tr', null, h('th', null, h('kbd', null, k)), h('td', null, pt, h('small', null, en)))))],
      [btn('Fechar', 'Close', () => this.closeModal(), { cls: 'dm-btn dm-primary' })],
      'dm-cheats',
    );
  }
}

// ---------------------------------------------------------------- live preview

/**
 * Walk your own avatar on the draft, client side only: the path is planned on the draft's walk grid and fed straight to the avatar the
 * renderer draws. The server never hears of it (other players see you standing where you were), and stopping puts you back.
 */
class Preview {
  private saved: { from: Tile; path: Tile[]; start: number; dir: string } | null = null;
  private held: Arrow[] = [];
  private lastStep = 0;

  constructor(private ed: Editor) {
    const self = game.self;
    if (self) this.saved = { from: { ...self.from }, path: self.path.map((t) => ({ ...t })), start: self.start, dir: self.pub.dir };
    game.designPan = { x: 0, y: 0 };
  }

  private pos() {
    const self = game.self;
    if (!self) return null;
    const p = tb().renderer?.avatarPos?.(self, performance.now());
    return p ?? null;
  }

  private go(path: Tile[]): void {
    const self = game.self;
    const p = this.pos();
    if (!self || !p || !path.length) return;
    self.from = { ...p.tile };
    self.pub.dir = p.dir as typeof self.pub.dir;
    self.path = path;
    self.start = performance.now();
  }

  walkTo(t: Tile): void {
    const p = this.pos();
    if (!p) return;
    const grid = buildGrid(ROOMS[this.ed.room]);
    const path = findPath(grid, p.tile, t);
    if (path) this.go(path);
    else this.ed.toast('Não dá para chegar lá. (Unreachable.)', 'warn');
  }

  keyDown(key: string): void {
    const a = arrowForKey(key);
    if (a && !this.held.includes(a)) this.held.push(a);
  }

  keyUp(key: string): void {
    const a = arrowForKey(key);
    const i = a ? this.held.indexOf(a) : -1;
    if (i >= 0) this.held.splice(i, 1);
  }

  tick(): void {
    if (!this.held.length || performance.now() - this.lastStep < 140) return;
    const p = this.pos();
    if (!p || p.moving) return;
    const step = stepForHeld(this.held);
    if (!step) return;
    const grid = buildGrid(ROOMS[this.ed.room]);
    const to = stepTarget(p.tile, step, (x, y) => isWalkable(grid, x, y));
    if (!to) return;
    this.lastStep = performance.now();
    this.go([to]);
  }

  stop(): void {
    const self = game.self;
    // back to where the server has you: the walk it last sent, from the time it started (long finished by now)
    if (self && this.saved) {
      self.from = this.saved.from;
      self.path = this.saved.path;
      self.start = this.saved.start;
      self.pub.dir = this.saved.dir as typeof self.pub.dir;
    }
  }
}

// ---------------------------------------------------------------- entry

let current: Editor | null = null;
let opening = false;

export function designActive(): boolean {
  return !!current;
}

export function closeDesign(): void {
  const ed = current;
  if (!ed) return;
  current = null;
  ed.unmount();
  game.designMode = false;
  game.designPan = { x: 0, y: 0 };
  game.designZoom = 0;
}

/** Sign in with the dashboard's admin password when this browser has no admin session yet. Resolves false when the admin gives up. */
function signIn(): Promise<boolean> {
  return new Promise((resolve) => {
    const err = h('p', { class: 'dm-error', role: 'alert' });
    const name = h('input', { type: 'text', id: 'design-admin-name', autocomplete: 'username', placeholder: 'Seu nome (no log de auditoria)', value: localStorage.getItem('tb_admin_name') ?? '' }) as HTMLInputElement;
    const pw = h('input', { type: 'password', id: 'design-admin-password', autocomplete: 'current-password', placeholder: 'Senha de admin' }) as HTMLInputElement;
    const back = h('div', { class: 'dm-modal-back dm-ui dm-signin-back' });
    const done = (ok: boolean) => {
      back.remove();
      resolve(ok);
    };
    const go = async () => {
      err.textContent = '';
      try {
        await designApi.login(pw.value, name.value.trim());
        localStorage.setItem('tb_admin_name', name.value.trim());
        done(true);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        err.textContent =
          status === 401 ? 'Senha errada. (Wrong password.)' : status === 429 ? 'Tentativas demais. Espere 15 minutos.' : status === 404 ? 'Admin desligado neste servidor (TB_ADMIN_PASSWORD).' : 'Não deu para entrar.';
      }
    };
    const form = h(
      'form',
      {
        class: 'dm-modal dm-signin',
        onsubmit: (e: Event) => {
          e.preventDefault();
          void go();
        },
      },
      h('h2', null, 'Modo design'),
      h('p', { class: 'dm-modal-en' }, 'Admin only. Same sign-in as the admin dashboard; every publish is audited under this name.'),
      name,
      pw,
      err,
      h('div', { class: 'dm-modal-actions' }, btn('Cancelar', 'Cancel', () => done(false), { cls: 'dm-btn' }), h('button', { type: 'submit', class: 'dm-btn dm-primary', id: 'design-admin-go' }, 'Entrar')),
    );
    back.append(form);
    document.body.append(back);
    (name.value ? pw : name).focus();
  });
}

/** Open the editor on `room` (the room the player stands in). Checks the admin session first; the server checks it again on every call. */
export async function openDesign(room: RoomId): Promise<void> {
  if (current || opening) return;
  opening = true;
  try {
    try {
      await designApi.session();
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      if (!(await signIn())) return;
    }
    const [art, state] = await Promise.all([Art.load(), designApi.state(room)]);
    if (game.room?.room !== room) return;
    game.designMode = true;
    game.designPan = { x: 0, y: 0 };
    game.designZoom = 0;
    game.pending = null;
    const ed = new Editor(room, art, state, () => closeDesign());
    current = ed;
    ed.mount();
    const d = state.draft;
    if (d && !same(d.objects, state.live)) {
      if (d.baseRev === state.rev) {
        ed.objects = structuredClone(d.objects);
        ed.paint(true);
        ed.renderPanels();
        ed.toast(`Rascunho de ${fmtDate(d.at)} restaurado.`, 'ok');
      } else {
        ed.confirm({
          title: 'Rascunho antigo',
          body: `You have a draft from ${fmtDate(d.at)}, but the room was published after it. Open the draft (publishing it replaces the newer version), or start from what is live?`,
          ok: 'Abrir rascunho',
          onOk: () => {
            ed.edit('Abrir rascunho', (o) => o.splice(0, o.length, ...structuredClone(d.objects)));
          },
        });
      }
    }
  } catch (e) {
    console.error('[design] could not open', e);
  } finally {
    opening = false;
  }
}
