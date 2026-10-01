/**
 * Camera framing while the dialogue box is open (HOWTO Phase 7 step 1): one zoom step in, centred between the player and the NPC, above the
 * box. Pure (no Phaser): the scene feeds it the normal framing and the tween progress, and draws what comes back.
 */
import { cameraCenter, type Insets, type Rect } from './coords';

export interface Framing {
  zoom: number;
  cx: number;
  cy: number;
}

export interface DialogueFramingArgs {
  /** the framing without a dialogue (integer zoom) */
  base: Framing;
  view: { w: number; h: number };
  bounds: Rect;
  /** HUD insets in device px */
  insets: Insets;
  /** height of the dialogue box in device px: the two speakers stay above it */
  boxPx: number;
  /** world px of the player's head and of the NPC's head (null: no NPC, the player alone) */
  self: { x: number; y: number };
  npc: { x: number; y: number } | null;
  /** eased tween progress, 0 (no dialogue) .. 1 (fully zoomed in) */
  blend: number;
  /** extra device zoom at full blend (1 CSS zoom step = round(dpr) device px) */
  step: number;
}

/** The framing at tween progress `blend`; 0 gives back `base` untouched, 1 the dialogue framing (an integer zoom again). */
export function dialogueFraming(a: DialogueFramingArgs): Framing {
  if (a.blend <= 0) return a.base;
  const zoom2 = a.base.zoom + a.step;
  const mid = a.npc ? { x: (a.self.x + a.npc.x) / 2, y: (a.self.y + a.npc.y) / 2 } : a.self;
  // the speakers sit in the middle of the part of the screen the box leaves free (between the HUD and the box), not the middle of the screen
  const freeMid = (a.insets.top + a.view.h - a.boxPx) / 2;
  const focus = { x: mid.x, y: mid.y + (a.view.h / 2 - freeMid) / zoom2 };
  const c = cameraCenter({ w: a.view.w, h: a.view.h, zoom: zoom2 }, a.bounds, focus, { ...a.insets, bottom: a.boxPx });
  const e = Math.min(1, a.blend);
  // the zoom moves in whole device-pixel steps (it snaps half way); a fractional zoom would blur the sprites for a few frames. The centre still eases.
  return { zoom: a.base.zoom + Math.round((zoom2 - a.base.zoom) * e), cx: a.base.cx + (c.cx - a.base.cx) * e, cy: a.base.cy + (c.cy - a.base.cy) * e };
}

/** Tween progress after `dt` seconds toward `target` (0 or 1) over `seconds`; instant when `instant` (reduced motion, shots). */
export function stepBlend(blend: number, target: 0 | 1, dt: number, seconds = 0.28, instant = false): number {
  if (instant || seconds <= 0) return target;
  const d = target - blend;
  return blend + Math.sign(d) * Math.min(Math.abs(d), dt / seconds);
}

/** Ease-out of a linear 0..1 progress (what the scene actually draws with). */
export const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 2;
