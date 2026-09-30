/**
 * The small 👁 cue that floats above a readable sign while you are within 3 tiles of it (HOWTO Phase 7 step 2). DOM over the canvas, reused per
 * hotspot id; the cue is clickable too (touch), and hides while a dialogue or any panel is open.
 */
import { HOTSPOT_READ_RANGE, hotspotCueSpot, hotspotTitle, hotspotsNear, type HotspotDef, type RoomId, type Tile } from '@tudobem/shared';
import { h, ui } from './dom';

/** At most this many cues at once (the nearest ones), so a crowded corner stays readable. */
export const MAX_CUES = 4;

export interface CueInput {
  room: RoomId | null;
  /** the local avatar's tile */
  tile: Tile | null;
  /** hide every cue (a dialogue or panel is open, decorate mode) */
  hidden: boolean;
  /** tile centre in client px */
  toClient: (x: number, y: number) => { px: number; py: number };
  /** CSS px per art px (the camera scale) */
  scale: number;
  viewport: { w: number; h: number };
}

/** The hotspots that get a cue right now: within the read range of the player, nearest first, capped. Pure. */
export function cueTargets(room: RoomId | null, tile: Tile | null, hidden: boolean, list?: readonly HotspotDef[]): HotspotDef[] {
  if (hidden || !room || !tile) return [];
  return hotspotsNear(room, tile, HOTSPOT_READ_RANGE, list).slice(0, MAX_CUES);
}

export class HotspotCues {
  private layer: HTMLElement | null = null;
  private els = new Map<string, { el: HTMLElement; at: string }>();

  constructor(private onOpen: (hs: HotspotDef) => void) {}

  private ensureLayer(): HTMLElement {
    if (!this.layer) {
      this.layer = h('div', { id: 'hotspot-cues', 'aria-hidden': 'false' });
      ui().append(this.layer);
    }
    return this.layer;
  }

  update(i: CueInput): void {
    const targets = cueTargets(i.room, i.tile, i.hidden);
    if (!targets.length && !this.els.size) return;
    const layer = this.ensureLayer();
    const live = new Set<string>();
    for (const t of targets) {
      const spot = hotspotCueSpot(t);
      const p = i.toClient(spot.x, spot.y);
      // above the top edge of the click box (the tile centre is half a tile below it), whole CSS px
      const x = Math.round(p.px - 13);
      const y = Math.round(p.py - 8 * i.scale - 30);
      if (x < -30 || y < -30 || x > i.viewport.w || y > i.viewport.h) continue;
      live.add(t.id);
      let e = this.els.get(t.id);
      if (!e) {
        const title = hotspotTitle(t);
        const el = h('button', { class: 'hotspot-cue', 'data-hotspot-cue': t.id, title: `${title.pt} · ler / read`, 'aria-label': `Ler: ${title.pt}`, onclick: (ev: Event) => (ev.stopPropagation(), this.onOpen(t)) }, h('span', { class: 'eye' }, '👁'));
        layer.append(el);
        e = { el, at: '' };
        this.els.set(t.id, e);
      }
      const at = `translate(${x}px, ${y}px)`;
      if (e.at !== at) {
        e.el.style.transform = at;
        e.at = at;
      }
    }
    for (const [id, e] of this.els) {
      if (live.has(id)) continue;
      e.el.remove();
      this.els.delete(id);
    }
  }

  /** The hotspot ids that have a cue on screen (tests and e2e). */
  get visible(): string[] {
    return [...this.els.keys()];
  }
}
