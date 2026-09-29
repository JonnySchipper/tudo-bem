// Shopfront edits: replace the pack's "STORE" plaque text with a Portuguese word (3x5 pixel font) and find the window glass
// rectangles (used as lit windows at night). The shopfront art itself is LimeZu's (Modern Exteriors, 9_Shopping_Center_and_Markets).
import { hexPx, setPx, hexToRgb } from '../../../../scripts/lib/pixel/img.mjs';
import { text3, text3Width } from './draw.mjs';

const PLAQUE = '#838897';
const GLASS = new Set(['#c4d7e3', '#e2f2f3', '#cce6ec', '#bad2e0', '#a4bbd5', '#8fa1c8', '#738ca8', '#b7ffee', '#95e3e3'].map((h) => hexToRgb(h).join(',')));

function bboxOf(img, pred) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (img.data[i + 3] && pred(img.data[i], img.data[i + 1], img.data[i + 2])) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Rewrites the plaque text. Returns the plaque bbox (sprite coordinates). */
export function patchSign(img, word) {
  const [pr, pg, pb] = hexToRgb(PLAQUE);
  // largest 4-connected region of the plaque body color, searched in the upper 70% of the sprite
  const seen = new Uint8Array(img.w * img.h);
  const isBody = (x, y) => { const i = (y * img.w + x) * 4; return img.data[i + 3] && img.data[i] === pr && img.data[i + 1] === pg && img.data[i + 2] === pb; };
  let bb = null, best = 0;
  for (let y = 0; y < img.h * 0.7; y++) for (let x = 0; x < img.w; x++) {
    if (seen[y * img.w + x] || !isBody(x, y)) continue;
    let x0 = x, y0 = y, x1 = x, y1 = y, area = 0;
    const st = [[x, y]];
    seen[y * img.w + x] = 1;
    while (st.length) {
      const [cx, cy] = st.pop();
      area++;
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen[ny * img.w + nx] || !isBody(nx, ny)) continue;
        seen[ny * img.w + nx] = 1;
        st.push([nx, ny]);
      }
    }
    if (area > best) { best = area; bb = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
  }
  if (!bb) throw new Error('shop: plaque not found');
  // the plaque is a rectangle of body color with a lighter glyph set inside; blank everything inside the bbox first
  for (let y = bb.y; y < bb.y + bb.h; y++) for (let x = bb.x; x < bb.x + bb.w; x++) setPx(img, x, y, hexPx(PLAQUE));
  const tw = text3Width(word);
  if (tw > bb.w - 1) throw new Error(`shop: '${word}' (${tw}px) does not fit the plaque (${bb.w}px)`);
  const x = bb.x + Math.floor((bb.w - tw) / 2);
  const y = bb.y + Math.floor((bb.h - 6) / 2);
  text3(img, x, y, word, '#ebe4f2', '#565972');
  return bb;
}

/** Bounding boxes of the glass panes (connected regions of the glass ramp, area >= 40). */
export function findGlass(img) {
  const seen = new Uint8Array(img.w * img.h);
  const isGlass = (x, y) => {
    const i = (y * img.w + x) * 4;
    return img.data[i + 3] > 0 && GLASS.has(img.data[i] + ',' + img.data[i + 1] + ',' + img.data[i + 2]);
  };
  const out = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (seen[y * img.w + x] || !isGlass(x, y)) continue;
    let x0 = x, y0 = y, x1 = x, y1 = y, area = 0;
    const st = [[x, y]];
    seen[y * img.w + x] = 1;
    while (st.length) {
      const [cx, cy] = st.pop();
      area++;
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen[ny * img.w + nx] || !isGlass(nx, ny)) continue;
        seen[ny * img.w + nx] = 1;
        st.push([nx, ny]);
      }
    }
    if (area >= 40) out.push([x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
  }
  return out;
}
