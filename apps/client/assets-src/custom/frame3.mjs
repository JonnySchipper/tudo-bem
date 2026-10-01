// Visual pass V3: the outer shell of an interior. Rooms used to float in a dark void with only a north band and a west strip; now the east and
// south walls close the room (a wall cap, and on the south the exterior face with its plinth), and a quiet night sidewalk surrounds the whole
// building so the outside reads as a street, not as nothing. Pack palette, navy outline, upper-left light.
import { blank, put, fillRect, mix, h2, NAVY } from './paint.mjs';
import { flipH } from '../../../../scripts/lib/pixel/img.mjs';
import { STYLES, westTile } from './walls.mjs';

const SHADOW = [70, 46, 26, 12];
const setA = (img, x, y, rgb, a) => { const i = (y * img.w + x) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = a; };

/** East wall cell: the west cell mirrored (cap on the outside, inner face next to the floor), floor shadow on its left. */
function eastTile(style, bottom) {
  return flipH(westTile(style, bottom));
}

/** South wall cell (16 wide): 4 rows of soft shadow cast up onto the floor, then the cap seen from above and the building's exterior face
 *  with a darker plinth. `corner` closes the west or east end with a navy edge. */
function southTile(style, corner) {
  const s = STYLES[style];
  const img = blank(16, 4 + 18);
  const y0 = 4;
  for (let i = 0; i < 4; i++) for (let x = 0; x < 16; x++) setA(img, x, i, [26, 16, 48], SHADOW[3 - i]);
  // cap (top surface): lit, body, shade
  fillRect(img, 0, y0, 16, 1, '#ffffff');
  fillRect(img, 0, y0 + 1, 16, 4, s.cap);
  fillRect(img, 0, y0 + 5, 16, 1, s.capLo);
  fillRect(img, 0, y0 + 6, 16, 1, mix(s.capLo, NAVY, 0.45));
  // exterior face: plaster with speckles, a trim line under the cap, a darker plinth
  const face = mix(s.face, s.trim, 0.2);
  for (let y = y0 + 7; y < y0 + 18; y++) for (let x = 0; x < 16; x++) put(img, x, y, h2(x, y, 11) < 0.06 ? mix(face, NAVY, 0.12) : face);
  fillRect(img, 0, y0 + 7, 16, 1, mix(face, NAVY, 0.3));
  fillRect(img, 0, y0 + 8, 16, 1, mix(face, NAVY, 0.12));
  fillRect(img, 0, y0 + 13, 16, 4, mix(s.base, face, 0.2));
  fillRect(img, 0, y0 + 13, 16, 1, mix(s.base, '#ffffff', 0.25));
  fillRect(img, 0, y0 + 17, 16, 1, NAVY);
  if (corner === 'w') { fillRect(img, 0, y0, 1, 18, NAVY); fillRect(img, 1, y0 + 1, 1, 5, '#ffffff'); }
  if (corner === 'e') { fillRect(img, 15, y0, 1, 18, NAVY); fillRect(img, 14, y0 + 7, 1, 10, mix(face, NAVY, 0.22)); }
  return img;
}

/** 64 x 64 dark sidewalk (a calm night version of the calçada wave): two close tones in wavy bands and a 2 px stone grid. */
function exterior() {
  const img = blank(64, 64);
  const tone = [['#211f31', '#252336'], ['#201e2f', '#242234']];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const tri = Math.abs(((x + 8) % 32) - 16) / 16; // 0..1 triangle, period 32
    const wave = Math.round(tri * 10);
    const band = Math.floor((y + wave) / 10) % 2;
    let c = tone[0][band];
    if (x % 4 === 0 && y % 4 === 0) c = mix(c, '#1a1928', 0.5);
    else if (h2(x, y, 3) < 0.03) c = mix(c, '#34324f', 0.35);
    put(img, x, y, c);
  }
  return img;
}

export function frameSet(_ctx, { style }) {
  return [
    { key: `walls/east_${style}`, img: eastTile(style, false), anchor: [4, 16], meta: { shadow: null } },
    { key: `walls/east_${style}_b`, img: eastTile(style, true), anchor: [4, 16], meta: { shadow: null } },
    { key: `walls/south_${style}_m`, img: southTile(style, null), anchor: [0, 4], meta: { shadow: null } },
    { key: `walls/south_${style}_w`, img: southTile(style, 'w'), anchor: [0, 4], meta: { shadow: null } },
    { key: `walls/south_${style}_e`, img: southTile(style, 'e'), anchor: [0, 4], meta: { shadow: null } },
  ];
}

export function exteriorPart() {
  return [{ img: exterior(), anchor: [0, 0], meta: { shadow: null } }];
}
