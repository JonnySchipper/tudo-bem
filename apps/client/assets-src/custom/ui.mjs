// Pixel UI kit for the DOM chrome (art2, Phase 4 restyle): a 9-slice paper panel, a speech bubble with a tail, a small button in three
// states, and the bouncing guide arrow. The LimeZu UI sheet (4_User_Interface_Elements/UI_16x16.png) has speech bubbles and a
// lavender bobbing arrow but no panel or button; the bubble is authored in the pack's style (navy outline, lit top-left rim), the arrow
// is authored after the pack's bobbing down arrow (chunkier, terracotta, 4 bounce offsets).
// Every piece is one PNG plus, for the 9-slice ones, the slice insets in the manifest so CSS can use
//   border-image: url(panel.png) <top> <right> <bottom> <left> fill / <top>px <right>px <bottom>px <left>px stretch;
// Display at an integer scale with image-rendering: pixelated.
import { blank, put, fillRect, shape, NAVY } from './paint.mjs';

const INK = '#573c2c'; // warm ink edge
const CREAM = '#f5e6d3', CREAM_HI = '#fbf3e6', CREAM_LO = '#e6d2b6', CREAM_LO2 = '#d9c19f';
const TERRA = '#c45c26', TERRA_HI = '#dc8446', TERRA_LO = '#a13a30';
const MUSTARD = '#d4a017';

/** Signed inset depth of pixel center (x, y) inside a rounded rect (w x h, radius r): < 0 outside, >= 0 inside (0 = the outermost row). */
function depth(x, y, w, h, r) {
  const px = Math.abs(x + 0.5 - w / 2) - (w / 2 - r), py = Math.abs(y + 0.5 - h / 2) - (h / 2 - r);
  const sdf = Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - r;
  return -sdf; // > 0 inside; the edge pixel row has ~0.5
}

// ------------------------------------------------------------------ panel
export const PANEL = { size: 20, slice: { top: 7, right: 7, bottom: 7, left: 7 } };
function panel() {
  const S = PANEL.size, img = blank(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = depth(x, y, S, S, 4.2);
    if (d <= 0) continue;
    const lit = x + y < S - 1; // upper-left half is lit
    let c;
    if (d < 1) c = INK;
    else if (d < 2) c = lit ? CREAM_HI : CREAM_LO;
    else if (d < 3) c = lit ? TERRA_HI : TERRA;
    else if (d < 4) c = lit ? CREAM_LO : CREAM_LO2;
    else c = CREAM;
    put(img, x, y, c);
  }
  // mustard rivets in the four corners (inside the corner slices, so they never stretch)
  for (const [x, y] of [[4, 4], [S - 5, 4], [4, S - 5], [S - 5, S - 5]]) { put(img, x, y, MUSTARD); }
  put(img, 4, 4, '#fff0a0');
  return img;
}

// ------------------------------------------------------------------ speech bubble
export const BUBBLE = { w: 30, h: 27, body: 22, slice: { top: 7, right: 7, bottom: 13, left: 16 } };
function bubble() {
  const { w, h, body } = BUBBLE;
  const img = blank(w, h);
  for (let y = 0; y < body; y++) for (let x = 0; x < w; x++) {
    const d = depth(x, y, w, body, 4.2);
    if (d <= 0) continue;
    let c = CREAM_HI;
    if (d < 1) c = NAVY;
    else if (d < 2) c = y <= 2 || x <= 2 ? '#ffffff' : y >= body - 3 || x >= w - 3 ? CREAM_LO : CREAM_HI;
    else if (y >= body - 4 || x >= w - 4) c = CREAM;
    put(img, x, y, c);
  }
  // tail hanging under the left part of the body (inside the left slice, so it never stretches), pointing down-left
  const rows = [[8, 15], [8, 14], [8, 12], [8, 10], [8, 9]];
  rows.forEach(([l, r], i) => {
    const y = body + i;
    for (let x = l; x <= r; x++) put(img, x, y, NAVY);
    if (i < rows.length - 1) for (let x = l + 1; x <= r - 1; x++) put(img, x, y, x <= l + 2 ? CREAM_HI : CREAM);
  });
  // open the body outline where the tail joins
  for (let x = 9; x <= 14; x++) put(img, x, body - 1, x <= 10 ? CREAM_HI : CREAM);
  return img;
}

// ------------------------------------------------------------------ buttons
export const BUTTON = { size: 16, slice: { top: 6, right: 6, bottom: 7, left: 6 } };
function button(state) {
  const S = BUTTON.size, img = blank(S, S);
  const fill = { normal: TERRA, hover: '#d2692f', pressed: '#b04f20' }[state];
  const rim = { normal: TERRA_HI, hover: '#f0a466', pressed: TERRA_LO }[state];
  const lip = { normal: TERRA_LO, hover: '#b4442a', pressed: '#b04f20' }[state];
  const bottomInset = state === 'pressed' ? 1 : 0; // pressed: the button sinks 1 px, no lip
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const yy = y - bottomInset;
    const d = depth(x, yy, S, S - bottomInset, 3.2);
    if (yy < 0 || d <= 0) continue;
    const isBottom = yy >= S - bottomInset - 3;
    let c;
    if (d < 1) c = INK;
    else if (d < 2 && (x + yy < S - 2)) c = rim; // lit rim on the upper-left
    else if (isBottom && state !== 'pressed') c = lip; // shaded lip along the bottom
    else c = fill;
    put(img, x, y, c);
  }
  if (state === 'pressed') for (let x = 3; x < S - 3; x++) put(img, x, 1, TERRA_LO); // inner shadow under the top edge
  return img;
}

// ------------------------------------------------------------------ guide arrow
// Authored (the pack's own bobbing arrow is only 8 px wide, too small over a door at world scale): a chunky terracotta down arrow
// with a mustard-lit upper-left edge and navy outline, 4 bounce offsets. The pack arrow was the reference for the outline and shading.
function arrowShape() {
  const img = blank(16, 16);
  const shaft = (x, y) => x >= 4.5 && x < 11.5 && y >= 0 && y < 7.5;
  const head = (x, y) => y >= 6.5 && y < 15 && Math.abs(x - 8) <= 7.4 - (y - 6.5) * 0.86;
  shape(img, (x, y) => shaft(x, y) || head(x, y), [8, 7, 7.5, 8], ['#a13a30', '#c45c26', '#dc8446', '#f7c27a'], { ol: NAVY, t: [1.0, 0.58, 0.12] });
  put(img, 6, 1, '#ffe0b8'); put(img, 6, 2, '#ffe0b8'); put(img, 3, 8, '#ffe0b8'); put(img, 4, 9, '#ffe0b8');
  return img;
}
async function arrowFrames() {
  const arrow = arrowShape();
  const offs = [4, 2, 0, 2]; // down, mid, up, mid
  return offs.map((dy) => {
    const f = blank(16, 20);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      if (!arrow.data[i + 3]) continue;
      const j = ((y + dy) * 16 + x) * 4;
      f.data[j] = arrow.data[i]; f.data[j + 1] = arrow.data[i + 1]; f.data[j + 2] = arrow.data[i + 2]; f.data[j + 3] = 255;
    }
    return f;
  });
}
/** Atlas sprite (Phaser, world guide arrow): 4 frames, anchored at the arrow tip's x center, bottom of the bounce range. */
export async function guideArrow(ctx) {
  const frames = await arrowFrames();
  return [{ frames, fps: 6, anchor: [8, 19] }];
}

// ------------------------------------------------------------------ parts for the import pipeline
export async function uiParts(ctx) {
  const frames = await arrowFrames();
  const strip = blank(64, 20);
  frames.forEach((f, i) => { for (let y = 0; y < 20; y++) for (let x = 0; x < 16; x++) { const s = (y * 16 + x) * 4, d = (y * 64 + i * 16 + x) * 4; strip.data.set(f.data.subarray(s, s + 4), d); } });
  const css = (sl) => `${sl.top} ${sl.right} ${sl.bottom} ${sl.left}`;
  return [
    { key: 'ui/panel', img: panel(), meta: { slice: PANEL.slice, css: css(PANEL.slice), demo: [[48, 32], [96, 56]], note: 'cream paper, warm-ink edge, terracotta trim; border-image slice with fill' } },
    { key: 'ui/bubble', img: bubble(), meta: { slice: BUBBLE.slice, css: css(BUBBLE.slice), demo: [[44, 32], [96, 44]], note: 'speech bubble, tail bottom-left inside the left slice; put the tail side under the speaker' } },
    { key: 'ui/button', img: button('normal'), meta: { slice: BUTTON.slice, css: css(BUTTON.slice), demo: [[40, 20], [72, 24]] } },
    { key: 'ui/button_hover', img: button('hover'), meta: { slice: BUTTON.slice, css: css(BUTTON.slice), demo: [[40, 20], [72, 24]] } },
    { key: 'ui/button_pressed', img: button('pressed'), meta: { slice: BUTTON.slice, css: css(BUTTON.slice), demo: [[40, 20], [72, 24]] } },
    { key: 'ui/guide_arrow_strip', img: strip, meta: { frames: 4, frameW: 16, fps: 6 } },
  ];
}

export async function preview() {
  return [panel(), bubble(), button('normal'), button('hover'), button('pressed')];
}
void fillRect;
