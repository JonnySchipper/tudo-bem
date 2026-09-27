import { h } from './dom';

/**
 * Praça late-afternoon (golden hour) hero with the Padaria in the mid-ground (TB Art brief 2026-09-27).
 * One authored world (1600×1200 units) split into three depth layers (sky/skyline, street, praça)
 * so the camera can push, parallax and — on phones — pull back when the sign-in card arrives.
 * The camera picks a portrait or landscape window so 390 and desktop are each framed on purpose.
 */

export const SCENE_W = 1600;
export const SCENE_H = 1200;

/** World y of the Padaria awning — the camera keeps it at a fixed screen ratio. */
const AWNING_Y = 600;
const PADARIA_CX = 820;
/** Portrait auth framing: PADARIA sign top … fountain basin, squeezed between wordmark and card. */
const SIGN_TOP_Y = 588;
const FOUNTAIN_BASE_Y = 1004;
/** Widest world span the portrait pull-back may reveal (content is overscanned to ±300). */
const MAX_VIEW_W = 1700;
/** Below this the Padaria stops reading; short phones fall back to a sign-anchored framing. */
const MIN_AUTH_ZOOM = 0.46;

export type IntroPhase = 'title' | 'auth';

export interface SceneCamera {
  viewBox: [number, number, number, number];
  /** px the scene tilts up when the sign-in card arrives (portrait only). */
  authTiltPx: number;
  portrait: boolean;
}

export function sceneCamera(width: number, height: number): SceneCamera {
  const a = width / Math.max(1, height);
  if (a < 0.8) {
    const H = 1000;
    const W = a * H;
    const x = Math.min(SCENE_W - W, Math.max(0, PADARIA_CX - W / 2));
    const y = AWNING_Y - 0.56 * H;
    return { viewBox: [x, y, W, H], authTiltPx: 0.24 * H * (height / H), portrait: true };
  }
  const W = Math.min(SCENE_W, a * 1050);
  const H = W / a;
  const x = Math.max(0, (SCENE_W - W) / 2 + (a < 1.5 ? 40 : 0));
  const y = Math.max(0, AWNING_Y - 0.55 * H);
  return { viewBox: [x, y, W, H], authTiltPx: 0, portrait: false };
}

export interface AuthFraming {
  /** Camera scale (≤ 1 pulls back). */
  zoom: number;
  /** px applied before the scale; transform-origin is top-centre. */
  shiftPx: number;
}

/**
 * Portrait sign-in framing: pull the camera back so the Padaria sign, the fountain and the
 * ipês all sit in the strip between the wordmark and the card instead of under the card.
 */
export function portraitAuthFraming(cam: SceneCamera, viewportW: number, viewportH: number, cardTopPx: number, heroBottomPx: number): AuthFraming {
  if (!cam.portrait) return { zoom: 1, shiftPx: 0 };
  const [, vy, , H] = cam.viewBox;
  const s0 = viewportH / H;
  const room = cardTopPx - heroBottomPx - 6;
  const kMin = Math.max(MIN_AUTH_ZOOM, viewportW / (s0 * MAX_VIEW_W));
  const fit = room / ((FOUNTAIN_BASE_Y - SIGN_TOP_Y) * s0);
  if (fit < kMin) {
    // Too little room (short phones): keep the Padaria legible, sign just under the wordmark.
    return { zoom: kMin, shiftPx: heroBottomPx + 4 - kMin * (SIGN_TOP_Y - vy) * s0 };
  }
  const zoom = Math.min(1, fit);
  return { zoom, shiftPx: cardTopPx + 2 - zoom * (FOUNTAIN_BASE_Y - vy) * s0 };
}

const rnd = (() => {
  let s = 20260927;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
})();

function skylineFar(): string {
  let out = '';
  let x = -300;
  while (x < SCENE_W + 300) {
    const w = 38 + rnd() * 70;
    const top = 420 + rnd() * 120;
    out += `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="${(700 - top).toFixed(0)}"/>`;
    x += w - 6;
  }
  return out;
}

function skylineMid(): string {
  const towers: [number, number, number][] = [
    [-120, 450, 100],
    [40, 470, 90],
    [150, 430, 70],
    [470, 455, 80],
    [560, 488, 60],
    [1010, 440, 76],
    [1200, 470, 90],
    [1310, 420, 64],
    [1400, 462, 100],
    [1520, 440, 90],
    [1640, 470, 110],
  ];
  let out = '';
  for (const [x, top, w] of towers) {
    out += `<rect x="${x}" y="${top}" width="${w}" height="${700 - top}"/>`;
    for (let wy = top + 14; wy < 610; wy += 16) {
      const glint = rnd() > 0.82;
      out += `<rect class="${glint ? 'sk-win sk-glint' : 'sk-win'}" x="${x + 8}" y="${wy}" width="${w - 16}" height="5"/>`;
    }
    out += `<rect class="sk-rim" x="${x}" y="${top}" width="4" height="${620 - top}"/><rect class="sk-rim" x="${x}" y="${top}" width="${w}" height="2.5"/>`;
  }
  return out;
}

/** Copan's wave slab with horizontal brise-soleil, Edifício Itália, Banespa spire — sunlit from the left. */
function landmarks(): string {
  let louvers = '';
  for (let y = 404; y < 620; y += 7) louvers += `<path d="M600 ${y} H1000"/>`;
  return `
  <g class="lm-banespa">
    <rect x="262" y="360" width="64" height="340"/>
    <rect x="272" y="326" width="44" height="40"/>
    <rect x="282" y="300" width="24" height="30"/>
    <rect x="289" y="280" width="10" height="24"/>
    <path d="M294 280 V236" stroke-width="3"/>
    <path class="lm-sunlit" d="M263 620 V361 M273 360 V327 M283 326 V301"/>
  </g>
  <g class="lm-copan">
    <clipPath id="tb-copan-clip"><path d="M610 700 V430 C680 392 760 440 820 414 C880 388 950 398 994 424 V700 Z"/></clipPath>
    <path d="M610 700 V430 C680 392 760 440 820 414 C880 388 950 398 994 424 V700 Z"/>
    <g clip-path="url(#tb-copan-clip)" class="lm-copan-louvers">${louvers}</g>
    <path class="lm-copan-rim" d="M610 430 C680 392 760 440 820 414 C880 388 950 398 994 424"/>
    <path class="lm-sunlit" d="M611 620 V431"/>
  </g>
  <g class="lm-italia">
    <path d="M1112 700 V330 C1112 318 1170 312 1176 330 V700 Z"/>
    <rect x="1120" y="318" width="50" height="10" rx="3"/>
    <path class="lm-sunlit" d="M1113 620 V331"/>
  </g>`;
}

function blob(cx: number, cy: number, rx: number, ry: number, fill: string, extra = ''): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
}

/** Ipê / praça canopy: layered blobs, low sun on the left, blossom specks on top, long shadow to the right. */
function tree(cx: number, baseY: number, size: number, bloom: string, bloomLight: string, sway = true, cls = ''): string {
  const s = size;
  const trunk = `<path d="M${cx - 6 * s} ${baseY} C${cx - 4 * s} ${baseY - 60 * s} ${cx - 10 * s} ${baseY - 90 * s} ${cx - 22 * s} ${baseY - 120 * s} M${cx - 2 * s} ${baseY - 70 * s} C${cx + 8 * s} ${baseY - 96 * s} ${cx + 20 * s} ${baseY - 110 * s} ${cx + 30 * s} ${baseY - 126 * s}" class="tree-branch" stroke-width="${5 * s}"/>
    <path d="M${cx - 9 * s} ${baseY} C${cx - 7 * s} ${baseY - 50 * s} ${cx - 4 * s} ${baseY - 80 * s} ${cx} ${baseY - 110 * s} L${cx + 6 * s} ${baseY - 110 * s} C${cx + 5 * s} ${baseY - 70 * s} ${cx + 7 * s} ${baseY - 40 * s} ${cx + 10 * s} ${baseY} Z" class="tree-trunk"/>
    <path d="M${cx - 8 * s} ${baseY - 4 * s} C${cx - 6 * s} ${baseY - 50 * s} ${cx - 4 * s} ${baseY - 80 * s} ${cx - 1 * s} ${baseY - 106 * s}" class="tree-rim" stroke-width="${2 * s}"/>`;
  const cy = baseY - 150 * s;
  const shade = [
    blob(cx - 50 * s, cy + 20 * s, 70 * s, 48 * s, '#3a5d4a', 'opacity="0.9"'),
    blob(cx + 55 * s, cy + 16 * s, 66 * s, 46 * s, '#2f4a45', 'opacity="0.9"'),
    blob(cx, cy - 10 * s, 84 * s, 60 * s, '#3f6a55'),
  ].join('');
  const flowers = [
    blob(cx - 40 * s, cy - 6 * s, 62 * s, 42 * s, bloom),
    blob(cx + 44 * s, cy - 2 * s, 58 * s, 40 * s, bloom, 'opacity="0.92"'),
    blob(cx - 6 * s, cy - 36 * s, 66 * s, 40 * s, bloomLight),
    blob(cx - 58 * s, cy - 24 * s, 34 * s, 22 * s, bloomLight, 'opacity="0.85"'),
  ].join('');
  let specks = '';
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    specks += `<circle cx="${(cx + Math.cos(a) * r * 90 * s).toFixed(1)}" cy="${(cy - 10 * s + Math.sin(a) * r * 52 * s).toFixed(1)}" r="${(2 + rnd() * 3.2) * s}"/>`;
  }
  const rim = `<path class="tree-canopy-rim" d="M${cx - 98 * s} ${cy - 10 * s} C${cx - 96 * s} ${cy - 44 * s} ${cx - 60 * s} ${cy - 74 * s} ${cx - 10 * s} ${cy - 76 * s}" stroke-width="${7 * s}"/>`;
  return `<g class="${cls}">
    <path class="cast-shadow" d="M${cx - 30 * s} ${baseY + 4 * s} C${cx + 60 * s} ${baseY - 6 * s} ${cx + 260 * s} ${baseY - 2 * s} ${cx + 330 * s} ${baseY + 20 * s} C${cx + 250 * s} ${baseY + 34 * s} ${cx + 40 * s} ${baseY + 22 * s} ${cx - 30 * s} ${baseY + 4 * s} Z"/>
    <g class="tree${sway ? ' tree-sway' : ''}" style="transform-origin:${cx}px ${baseY}px">
      ${trunk}${shade}${flowers}${rim}
      <g class="tree-specks">${specks}</g>
      ${blob(cx + 40 * s, cy + 22 * s, 70 * s, 26 * s, 'rgba(70,40,60,0.18)')}
    </g>
  </g>`;
}

function windowArch(x: number, y: number, w: number, hgt: number, lit = false): string {
  return `<g class="win">
    <path d="M${x} ${y + hgt} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + hgt} Z" class="win-frame"/>
    <path d="M${x + 5} ${y + hgt - 4} V${y + w / 2 + 2} A${w / 2 - 5} ${w / 2 - 5} 0 0 1 ${x + w - 5} ${y + w / 2 + 2} V${y + hgt - 4} Z" class="${lit ? 'win-glass lit' : 'win-glass'}"/>
    <path d="M${x + w / 2} ${y + 8} V${y + hgt - 4} M${x + 5} ${y + hgt * 0.58} H${x + w - 5}" class="win-bars"/>
    <rect x="${x - 10}" y="${y + 6}" width="9" height="${hgt - 8}" rx="2" class="shutter"/>
    <rect x="${x + w + 1}" y="${y + 6}" width="9" height="${hgt - 8}" rx="2" class="shutter"/>
    <rect x="${x - 6}" y="${y + hgt}" width="${w + 12}" height="7" rx="2" class="sill"/>
  </g>`;
}

function flowerBox(x: number, y: number, w: number): string {
  let buds = '';
  for (let i = 0; i < w / 9; i++) {
    const c = i % 3 === 0 ? '#e889a8' : i % 3 === 1 ? '#f2c230' : '#c45c26';
    buds += `<circle cx="${x + 5 + i * 9}" cy="${y - 4 - (i % 2) * 3}" r="4" fill="${c}"/>`;
  }
  return `<g><ellipse cx="${x + w / 2}" cy="${y - 2}" rx="${w / 2 + 2}" ry="8" fill="#3f7a55"/>${buds}<rect x="${x}" y="${y}" width="${w}" height="10" rx="3" fill="#8b5e3c" class="edge"/></g>`;
}

/** Scalloped striped awning, lit from the left, with underside shadow. */
function awning(x0: number, x1: number, y: number, depth: number): string {
  const stripes: string[] = [];
  const n = 12;
  const sw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? 'url(#tb-awning-red)' : 'url(#tb-awning-cream)';
    stripes.push(`<path d="M${x0 + i * sw} ${y} L${x0 + (i + 1) * sw} ${y} L${x0 + (i + 1) * sw + 6} ${y + depth} L${x0 + i * sw + 6} ${y + depth} Z" fill="${c}"/>`);
  }
  let scallops = '';
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? '#b14f1f' : '#efdcc2';
    const sx = x0 + i * sw + 6;
    scallops += `<path d="M${sx} ${y + depth} Q${sx + sw / 2} ${y + depth + 22} ${sx + sw} ${y + depth} Z" fill="${c}" class="edge-soft"/>`;
  }
  return `<g class="awning">
    <path d="M${x0 + 4} ${y + depth + 6} H${x1 + 10} L${x1 + 30} ${y + depth + 40} H${x0 + 14} Z" fill="rgba(70,40,60,0.3)"/>
    ${stripes.join('')}${scallops}
    <path d="M${x0} ${y} H${x1}" class="edge" stroke-width="3"/>
    <path d="M${x0} ${y} L${x0 + 6} ${y + depth}" class="edge" stroke-width="2"/>
    <path d="M${x0 + 8} ${y + 4} H${x0 + (x1 - x0) * 0.62}" stroke="rgba(255,226,170,0.8)" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function breadShelf(x: number, y: number, w: number): string {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2" fill="#8b5e3c"/>`;
  let cx = x + 10;
  let i = 0;
  while (cx < x + w - 14) {
    if (i % 3 === 0) {
      out += `<ellipse cx="${cx + 10}" cy="${y - 6}" rx="16" ry="6" fill="#c98a45"/><path d="M${cx} ${y - 8} l6 -3 M${cx + 8} ${y - 9} l6 -3 M${cx + 16} ${y - 9} l6 -3" stroke="#f5d9a8" stroke-width="1.6" stroke-linecap="round"/>`;
      cx += 36;
    } else if (i % 3 === 1) {
      out += `<circle cx="${cx + 4}" cy="${y - 6}" r="6" fill="#e8b75a"/><circle cx="${cx + 16}" cy="${y - 6}" r="6" fill="#e3ad4d"/><circle cx="${cx + 10}" cy="${y - 14}" r="6" fill="#efc46a"/>`;
      cx += 30;
    } else {
      out += `<path d="M${cx} ${y} v-14 q12 -8 24 0 v14 Z" fill="#f5e6d3"/><path d="M${cx} ${y - 14} q12 -8 24 0" stroke="#c45c26" stroke-width="3" fill="none"/>`;
      cx += 32;
    }
    i++;
  }
  return out;
}

/** Soft wisps rising from a cup; staggered so there is always one fading in. */
function steam(x: number, y: number, n = 3, h = 34): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * 5;
    out += `<path class="steam-wisp" style="animation-delay:${(-i * 1.3).toFixed(1)}s" d="M${x + dx} ${y} c-5 ${-h * 0.2} 5 ${-h * 0.35} 0 ${-h * 0.55} c-5 ${-h * 0.2} 4 ${-h * 0.3} 0 ${-h * 0.45}"/>`;
  }
  return `<g class="steam">${out}</g>`;
}

/** Mesinha outside the Padaria: two cafezinhos, still steaming. */
function cafeTable(x: number): string {
  const cup = (cx: number) =>
    `<path d="M${cx - 5} 764 h10 l-1.5 8 h-7 Z" fill="#fffaf2" class="edge-soft"/><path d="M${cx + 5} 766 q4 1 0 4" stroke="#fffaf2" stroke-width="1.6" fill="none"/><ellipse cx="${cx}" cy="772.5" rx="7" ry="1.6" fill="#efe2cf"/>`;
  return `<g class="cafe-table">
    <path class="cast-shadow" d="M${x - 16} 806 L${x + 18} 806 L${x + 86} 816 L${x + 30} 818 Z"/>
    <path d="M${x} 776 V804 M${x - 12} 806 H${x + 12}" stroke="#2f4a40" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="${x}" cy="775" rx="24" ry="4.5" fill="#6f4829" class="edge-soft"/>
    ${cup(x - 9)}${cup(x + 10)}
    ${steam(x - 9, 762, 2, 30)}${steam(x + 10, 762, 2, 34)}
  </g>`;
}

function padaria(): string {
  const x0 = 610;
  const x1 = 1030;
  return `<g class="padaria">
    <rect x="${x0 - 8}" y="452" width="${x1 - x0 + 16}" height="18" rx="3" class="cornice"/>
    <rect x="${x0}" y="468" width="${x1 - x0}" height="302" fill="url(#tb-wall-cream)" class="edge"/>
    <rect x="${x1 - 70}" y="468" width="70" height="302" class="wall-shade"/>
    <rect x="${x0 + 1}" y="468" width="6" height="300" class="wall-sunlit"/>
    ${windowArch(646, 486, 58, 86, true)}
    ${windowArch(792, 486, 58, 86, true)}
    ${windowArch(938, 486, 58, 86, true)}
    ${flowerBox(640, 580, 70)}
    ${flowerBox(932, 580, 70)}
    <g class="sign">
      <rect x="704" y="588" width="232" height="46" rx="8" fill="url(#tb-wood)" class="edge" stroke-width="2.5"/>
      <text x="820" y="620" text-anchor="middle" class="sign-text">PADARIA</text>
      <circle cx="722" cy="611" r="5" fill="#f2c230"/><circle cx="918" cy="611" r="5" fill="#f2c230"/>
    </g>
    ${awning(x0 - 16, x1 + 6, 636, 30)}
    <rect x="${x0}" y="690" width="${x1 - x0}" height="80" fill="#e8d3b6"/>
    <g class="vitrine">
      <rect x="628" y="688" width="232" height="74" rx="4" fill="url(#tb-case-glow)" class="edge" stroke-width="2.5"/>
      ${breadShelf(636, 716, 216)}
      ${breadShelf(636, 748, 216)}
      <path d="M646 692 L700 692 L660 760 L628 760 Z" fill="rgba(255,255,255,0.22)"/>
      <path d="M716 692 L732 692 L700 760 L684 760 Z" fill="rgba(255,255,255,0.14)"/>
      <rect class="vitrine-glow" x="628" y="688" width="232" height="74" rx="4" fill="url(#tb-case-bloom)"/>
      ${steam(700, 712, 3, 20)}
    </g>
    <g class="door">
      <rect x="878" y="682" width="92" height="88" rx="6" fill="#2f5d50" class="edge" stroke-width="2.5"/>
      <rect x="888" y="692" width="72" height="54" rx="4" fill="url(#tb-case-glow)" opacity="0.9"/>
      <rect x="898" y="700" width="52" height="16" rx="4" fill="#f5e6d3" class="edge"/>
      <text x="924" y="712" text-anchor="middle" class="door-text">ABERTO</text>
      <circle cx="952" cy="740" r="3.5" fill="#d4a017"/>
    </g>
    <rect x="${x0 - 4}" y="766" width="${x1 - x0 + 8}" height="8" fill="#8b5e3c" class="edge"/>
    <g class="chalkboard">
      <path d="M990 820 L1004 768 L1032 768 L1046 820" stroke="#6f4829" stroke-width="4" fill="none" stroke-linecap="round"/>
      <rect x="996" y="772" width="44" height="40" rx="3" fill="#2c3a33" stroke="#8b5e3c" stroke-width="3"/>
      <text x="1018" y="788" text-anchor="middle" class="chalk">Café</text>
      <text x="1018" y="803" text-anchor="middle" class="chalk">R$ 3</text>
    </g>
  </g>`;
}

function sobrado(x: number, w: number, top: number, wall: string, trim: string, tiles: boolean): string {
  const wins: string[] = [];
  const cols = Math.max(1, Math.floor((w - 20) / 78));
  const gap = (w - cols * 46) / (cols + 1);
  for (let c = 0; c < cols; c++) {
    const wx = x + gap + c * (46 + gap);
    wins.push(windowArch(wx, top + 30, 46, 70, rnd() > 0.5));
    wins.push(windowArch(wx, top + 150, 46, 72, rnd() > 0.8));
  }
  return `<g class="sobrado">
    <rect x="${x - 6}" y="${top - 14}" width="${w + 12}" height="16" rx="3" fill="${trim}" class="edge"/>
    <rect x="${x}" y="${top}" width="${w}" height="${770 - top}" fill="${wall}" class="edge"/>
    ${tiles ? `<rect x="${x}" y="712" width="${w}" height="58" fill="url(#tb-azulejo)" opacity="0.9"/>` : ''}
    <rect x="${x + w - 44}" y="${top}" width="44" height="${770 - top}" class="wall-shade"/>
    <rect x="${x + 1}" y="${top}" width="6" height="${768 - top}" class="wall-sunlit"/>
    ${wins.join('')}
  </g>`;
}

/**
 * Distant passer-by: a senhora heading home with a sacola of pão, walking the sidewalk.
 * Local origin is between her feet.
 */
function passerBy(): string {
  return `<g class="passer" transform="translate(0 804)">
    <g class="passer-walk">
      <ellipse class="passer-shadow" cx="26" cy="1" rx="30" ry="3"/>
      <g class="passer-bob">
        <path class="passer-leg passer-leg-a" d="M-1 -22 V-1" />
        <path class="passer-leg passer-leg-b" d="M2 -22 V-1" />
        <path d="M-9 -24 L-6 -44 Q0 -48 6 -44 L9 -24 Z" fill="#3f7a6a" class="edge-soft"/>
        <path d="M-6 -42 Q0 -45 6 -42" stroke="rgba(255,226,170,0.7)" stroke-width="1.6" fill="none"/>
        <path class="passer-arm" d="M-5 -42 Q-10 -34 -9 -27" stroke="#c98a5e" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <rect x="-16" y="-31" width="10" height="12" rx="1.5" fill="#e3c08f" class="edge-soft"/>
        <path d="M-14 -31 q3 -4 6 0" stroke="#b98d63" stroke-width="1.2" fill="none"/>
        <path d="M-15 -33 q2 -4 4 0 M-12 -34 q2 -4 4 0" stroke="#c98a45" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <circle cx="0" cy="-51" r="5.6" fill="#c98a5e"/>
        <path d="M-5.6 -52 Q-4 -58 1 -57.5 Q6 -57 5.6 -51 Q3 -55 -1 -54.5 Z" fill="#3a2a20"/>
        <circle cx="4.6" cy="-56" r="2.8" fill="#3a2a20"/>
      </g>
    </g>
  </g>`;
}

function lamp(x: number, baseY: number, s = 1): string {
  return `<g class="lamp">
    <path class="cast-shadow" d="M${x - 4 * s} ${baseY} L${x + 4 * s} ${baseY} L${x + 190 * s} ${baseY + 30 * s} L${x + 176 * s} ${baseY + 32 * s} Z"/>
    <ellipse class="cast-shadow" cx="${x + 186 * s}" cy="${baseY + 31 * s}" rx="${26 * s}" ry="${5 * s}"/>
    <path d="M${x - 9 * s} ${baseY} h${18 * s} l-4 ${-18 * s} h${-10 * s} Z" fill="#2f4a40"/>
    <rect x="${x - 3 * s}" y="${baseY - 200 * s}" width="${6 * s}" height="${184 * s}" fill="#2f4a40"/>
    <rect x="${x - 3 * s}" y="${baseY - 196 * s}" width="${1.8 * s}" height="${176 * s}" class="pole-sunlit"/>
    <path d="M${x} ${baseY - 196 * s} q${22 * s} ${-6 * s} ${26 * s} ${8 * s}" stroke="#2f4a40" stroke-width="${4 * s}" fill="none"/>
    <path d="M${x} ${baseY - 196 * s} q${-22 * s} ${-6 * s} ${-26 * s} ${8 * s}" stroke="#2f4a40" stroke-width="${4 * s}" fill="none"/>
    ${[26, -26].map((dx) => `<g><circle class="lamp-glow" cx="${x + dx * s}" cy="${baseY - 178 * s}" r="${34 * s}" fill="url(#tb-lamp-glow)"/><path d="M${x + dx * s - 8 * s} ${baseY - 188 * s} h${16 * s} l-3 ${16 * s} h${-10 * s} Z" fill="#ffd98a" stroke="#2f4a40" stroke-width="${2.5 * s}"/></g>`).join('')}
  </g>`;
}

function bench(x: number, y: number, w: number): string {
  return `<g class="bench">
    <path class="cast-shadow" d="M${x - 2} ${y + 26} L${x + w + 2} ${y + 26} L${x + w + 120} ${y + 44} L${x + 96} ${y + 44} Z"/>
    <path d="M${x + 8} ${y + 28} v-16 M${x + w - 8} ${y + 28} v-16" stroke="#2f4a40" stroke-width="5" stroke-linecap="round"/>
    <rect x="${x}" y="${y - 22}" width="${w}" height="8" rx="3" fill="#a3714a" class="edge"/>
    <rect x="${x}" y="${y - 10}" width="${w}" height="8" rx="3" fill="#8b5e3c" class="edge"/>
    <rect x="${x - 4}" y="${y + 2}" width="${w + 8}" height="9" rx="3" fill="#a3714a" class="edge"/>
    <path d="M${x + 2} ${y - 21} H${x + w * 0.6}" stroke="rgba(255,220,160,0.75)" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

function fountain(cx: number, cy: number): string {
  return `<g class="fountain">
    <ellipse class="cast-shadow" cx="${cx + 120}" cy="${cy + 30}" rx="230" ry="36"/>
    <ellipse cx="${cx}" cy="${cy}" rx="170" ry="44" fill="#d6c2a2" class="edge" stroke-width="2.5"/>
    <path d="M${cx - 170} ${cy} v18 a170 44 0 0 0 340 0 v-18" fill="url(#tb-stone)" class="edge" stroke-width="2.5"/>
    <ellipse cx="${cx}" cy="${cy - 2}" rx="152" ry="34" fill="url(#tb-water)"/>
    <ellipse class="water-glint" cx="${cx - 40}" cy="${cy - 8}" rx="70" ry="9" fill="rgba(255,214,150,0.55)"/>
    <g class="ripples">
      <ellipse cx="${cx}" cy="${cy - 2}" rx="60" ry="12" fill="none" stroke="rgba(255,240,214,0.6)" stroke-width="2"/>
      <ellipse cx="${cx}" cy="${cy - 2}" rx="104" ry="22" fill="none" stroke="rgba(255,240,214,0.38)" stroke-width="2"/>
    </g>
    <path d="M${cx - 14} ${cy - 4} v-58 h28 v58" fill="url(#tb-stone)" class="edge" stroke-width="2.5"/>
    <ellipse cx="${cx}" cy="${cy - 62}" rx="58" ry="14" fill="#d6c2a2" class="edge" stroke-width="2.5"/>
    <ellipse cx="${cx}" cy="${cy - 64}" rx="48" ry="9" fill="url(#tb-water)"/>
    <path d="M${cx - 6} ${cy - 66} v-26 h12 v26" fill="url(#tb-stone)" class="edge" stroke-width="2"/>
    <g class="jets" fill="none" stroke-linecap="round">
      <path d="M${cx} ${cy - 94} q-34 -30 -56 28"/>
      <path d="M${cx} ${cy - 94} q34 -30 56 28"/>
      <path d="M${cx} ${cy - 94} q-8 -34 -22 26"/>
      <path d="M${cx} ${cy - 94} q8 -34 22 26"/>
      <path d="M${cx - 48} ${cy - 62} q-30 10 -46 54"/>
      <path d="M${cx + 48} ${cy - 62} q30 10 46 54"/>
    </g>
    <path d="M${cx - 150} ${cy - 10} a152 34 0 0 1 90 -22" stroke="rgba(255,232,190,0.9)" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>`;
}

/** Wavy calçada mosaic; spacing widens toward the viewer for cheap perspective. */
function calcada(): string {
  let out = '';
  let y = 812;
  let gap = 16;
  let amp = 5;
  let i = 0;
  while (y < SCENE_H + 200) {
    const wl = 70 + i * 6;
    let d = `M-320 ${y}`;
    for (let x = -320; x < SCENE_W + 340; x += wl) d += ` q${wl / 4} ${-amp} ${wl / 2} 0 t${wl / 2} 0`;
    out += `<path d="${d}"/>`;
    y += gap;
    gap *= 1.16;
    amp *= 1.14;
    i++;
  }
  return out;
}

function groundLeaves(): string {
  const cols = ['#e9b93a', '#d4a017', '#c45c26', '#b8743a', '#d98aa5'];
  let out = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * SCENE_W;
    const y = 800 + Math.pow(rnd(), 0.8) * 400;
    const s = 0.6 + ((y - 800) / 400) * 1.2;
    out += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(5 * s).toFixed(1)}" ry="${(2.4 * s).toFixed(1)}" transform="rotate(${(rnd() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${cols[i % cols.length]}" opacity="0.85"/>`;
  }
  return out;
}

function clouds(): string {
  const c = (x: number, y: number, s: number, cls: string) =>
    `<g class="cloud ${cls}" transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="0" rx="90" ry="26"/><ellipse cx="-40" cy="-14" rx="44" ry="26"/><ellipse cx="22" cy="-22" rx="52" ry="32"/><ellipse cx="66" cy="-6" rx="36" ry="20"/>
      <path class="cloud-rim" d="M-86 8 Q0 30 100 4"/>
    </g>`;
  return c(200, 250, 1.3, 'c1') + c(980, 190, 1, 'c2') + c(1400, 290, 1.5, 'c3') + c(620, 330, 0.8, 'c1') + c(-160, 300, 1.2, 'c2') + c(1720, 220, 1.1, 'c1');
}

const DEFS = `<defs>
    <linearGradient id="tb-haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c3b1b6"/><stop offset="1" stop-color="#dfc0a4"/>
    </linearGradient>
    <linearGradient id="tb-haze-mid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a89aa8"/><stop offset="1" stop-color="#c5a792"/>
    </linearGradient>
    <linearGradient id="tb-wall-cream" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffeed6"/><stop offset="0.7" stop-color="#f5e2c8"/><stop offset="1" stop-color="#e0c4a6"/>
    </linearGradient>
    <linearGradient id="tb-awning-red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#df6e30"/><stop offset="1" stop-color="#b14f1f"/>
    </linearGradient>
    <linearGradient id="tb-awning-cream" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff0d8"/><stop offset="1" stop-color="#e8cfae"/>
    </linearGradient>
    <linearGradient id="tb-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9c6a44"/><stop offset="1" stop-color="#6f4829"/>
    </linearGradient>
    <linearGradient id="tb-case-glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe3a8"/><stop offset="0.6" stop-color="#f7c66e"/><stop offset="1" stop-color="#e39f48"/>
    </linearGradient>
    <radialGradient id="tb-case-bloom" cx="0.5" cy="0.4" r="0.7">
      <stop offset="0" stop-color="rgba(255,236,190,0.6)"/><stop offset="1" stop-color="rgba(255,236,190,0)"/>
    </radialGradient>
    <radialGradient id="tb-lamp-glow">
      <stop offset="0" stop-color="rgba(255,214,130,0.85)"/><stop offset="0.45" stop-color="rgba(255,200,120,0.35)"/><stop offset="1" stop-color="rgba(255,200,120,0)"/>
    </radialGradient>
    <linearGradient id="tb-water" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f1cfa6"/><stop offset="0.35" stop-color="#a9c2c4"/><stop offset="1" stop-color="#6b93a3"/>
    </linearGradient>
    <linearGradient id="tb-stone" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e6cca4"/><stop offset="0.55" stop-color="#bfa582"/><stop offset="1" stop-color="#9c8470"/>
    </linearGradient>
    <linearGradient id="tb-praca" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ebc696"/><stop offset="0.5" stop-color="#d7a672"/><stop offset="1" stop-color="#b3825a"/>
    </linearGradient>
    <linearGradient id="tb-cloud" gradientUnits="userSpaceOnUse" x1="0" y1="-56" x2="0" y2="26">
      <stop offset="0" stop-color="#fff4e8"/><stop offset="0.55" stop-color="#fbdcc4"/><stop offset="1" stop-color="#f2b48e"/>
    </linearGradient>
    <pattern id="tb-azulejo" width="22" height="22" patternUnits="userSpaceOnUse">
      <rect width="22" height="22" fill="#e9f0ee"/>
      <path d="M11 2 L20 11 L11 20 L2 11 Z" fill="#6f9fb0"/><circle cx="11" cy="11" r="3" fill="#f5e6d3"/>
    </pattern>
  </defs>`;

function svgLayer(name: string, body: string, defs = ''): string {
  return `<svg class="intro-hero-svg intro-layer-${name}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="xMidYMid slice" role="presentation" focusable="false">${defs}${body}</svg>`;
}

/** Back: sky dressing + hazy skyline, backlit by the low sun. */
function backLayer(): string {
  return svgLayer(
    'back',
    `<g class="layer-clouds">${clouds()}</g>
  <g class="layer-far" fill="url(#tb-haze)">${skylineFar()}</g>
  <g class="layer-landmarks" fill="url(#tb-haze-mid)" stroke="#a597a6">${landmarks()}</g>
  <g class="layer-skyline" fill="url(#tb-haze-mid)">${skylineMid()}</g>
  <rect class="horizon-glow" x="-300" y="560" width="${SCENE_W + 600}" height="90"/>
  <g class="layer-treeline">
    ${[-120, 80, 190, 300, 1110, 1260, 1380, 1500, 1680].map((x, i) => blob(x, 640 + (i % 2) * 8, 80, 46, i % 3 === 0 ? '#76855a' : '#667c5c')).join('')}
    ${[120, 280, 1180, 1440].map((x, i) => blob(x, 610, 50, 30, i % 2 ? '#d08c9c' : '#e2a940', 'opacity="0.88"')).join('')}
    ${[-120, 80, 190, 300, 1110, 1260, 1380, 1500, 1680].map((x) => `<path class="treeline-rim" d="M${x - 76} ${636} Q${x - 60} ${598} ${x - 10} ${596}"/>`).join('')}
  </g>
  <rect x="-300" y="660" width="${SCENE_W + 600}" height="120" fill="#8f8a6c"/>`,
    DEFS,
  );
}

/** Street: sobrados, the Padaria, the sidewalk life. */
function streetLayer(): string {
  return svgLayer(
    'street',
    `<g class="layer-street">
    ${sobrado(-60, 200, 510, '#e9b9a0', '#c45c26', false)}
    ${sobrado(160, 190, 520, '#f0c68a', '#c98a45', false)}
    ${sobrado(380, 220, 490, '#b9d3c8', '#6f9fb0', true)}
    ${padaria()}
    ${sobrado(1050, 200, 500, '#e7b8a4', '#c45c26', false)}
    ${sobrado(1270, 230, 530, '#f3dcaa', '#d4a017', true)}
    ${sobrado(1520, 210, 505, '#b9d3c8', '#6f9fb0', false)}
    <rect x="-300" y="770" width="${SCENE_W + 600}" height="36" fill="#ecd6b4"/>
    ${cafeTable(668)}
    ${passerBy()}
    <rect x="-300" y="802" width="${SCENE_W + 600}" height="6" fill="#bfa27c"/>
    <rect x="-300" y="808" width="${SCENE_W + 600}" height="60" fill="#e5bf8e"/>
  </g>`,
  );
}

/** Praça foreground: calçada, fountain, benches, lamps, ipês. */
function groundLayer(): string {
  return svgLayer(
    'ground',
    `<rect x="-300" y="806" width="${SCENE_W + 600}" height="1400" fill="url(#tb-praca)"/>
  <g class="layer-calcada" fill="none" stroke="rgba(111,72,41,0.22)" stroke-width="5">${calcada()}</g>
  <g class="layer-ground-leaves">${groundLeaves()}</g>
  <g class="layer-praca">
    ${tree(1470, 800, 1.35, '#d08c9c', '#e8a9bb')}
    ${tree(452, 872, 0.92, '#e9b93a', '#f5cf3f', true, 'portrait-only')}
    ${tree(1196, 866, 0.84, '#d08c9c', '#e8a9bb', true, 'portrait-only')}
    ${lamp(560, 900, 1.05)}
    ${bench(380, 930, 150)}
    ${fountain(820, 960)}
    ${bench(1120, 950, 150)}
    ${lamp(1080, 920, 1.1)}
    ${tree(120, 1010, 1.55, '#e9b93a', '#f5cf3f')}
    ${[660, 700, 980].map((x) => `<g class="planter"><path class="cast-shadow" d="M${x} 902 H${x + 26} L${x + 80} 910 H${x + 30} Z"/><rect x="${x}" y="880" width="26" height="22" rx="4" fill="#c45c26" class="edge"/><ellipse cx="${x + 13}" cy="878" rx="18" ry="12" fill="#3f7a55"/></g>`).join('')}
  </g>`,
  );
}

const DEPTHS = [
  { name: 'back', push: 1.012, par: 5 },
  { name: 'street', push: 1.028, par: 11 },
  { name: 'ground', push: 1.05, par: 20 },
] as const;

/** World y of the awning scallops' lower edge. */
export const AWNING_BOTTOM_Y = 690;

/**
 * Portrait tilt so the awning lands just above the sign-in card; falls back to the
 * camera's default tilt when the card position is unknown.
 */
export function portraitTiltPx(cam: SceneCamera, viewportH: number, cardTopPx?: number): number {
  if (cam.authTiltPx <= 0) return 0;
  if (cardTopPx === undefined) return cam.authTiltPx;
  const [, y, , H] = cam.viewBox;
  const awningPx = (AWNING_BOTTOM_Y - y) * (viewportH / H);
  return Math.max(0, Math.min(viewportH * 0.4, awningPx - (cardTopPx - 6)));
}

export interface SceneLayout {
  /** px from the top of the gate to the sign-in card (in its resting layout). */
  cardTop: number;
  /** px from the top of the gate to the bottom of the wordmark + taglines (sign-in layout). */
  heroBottom: number;
}

export interface IntroHeroScene {
  el: HTMLElement;
  /** Re-frame for the current viewport; call on resize. */
  frame: (layout?: SceneLayout) => SceneCamera;
  /** Pointer parallax on fine pointers; returns teardown. */
  mountParallax: () => () => void;
}

export function createIntroHeroScene(): IntroHeroScene {
  const wrap = h('div', { class: 'intro-hero-scene', 'aria-hidden': 'true' });
  const layers = [backLayer(), streetLayer(), groundLayer()];
  wrap.innerHTML = `<div class="intro-sky"></div><div class="intro-sun"></div><div class="intro-rays"></div>
    <div class="intro-cam">${DEPTHS.map((d, i) => `<div class="intro-depth intro-depth-${d.name}" style="--push:${d.push}">${layers[i]}</div>`).join('')}</div>
    <div class="intro-grade intro-grade-warm"></div><div class="intro-grade intro-grade-light"></div>`;
  const svgs = [...wrap.querySelectorAll('svg')];
  const depthEls = [...wrap.querySelectorAll<HTMLElement>('.intro-depth')];
  const frame = (layout?: SceneLayout) => {
    const w = wrap.clientWidth || window.innerWidth;
    const hgt = wrap.clientHeight || window.innerHeight;
    const cam = sceneCamera(w, hgt);
    const vb = cam.viewBox.map((n) => n.toFixed(1)).join(' ');
    for (const svg of svgs) svg.setAttribute('viewBox', vb);
    wrap.classList.toggle('is-portrait', cam.portrait);
    const fr = layout ? portraitAuthFraming(cam, w, hgt, layout.cardTop, layout.heroBottom) : { zoom: 1, shiftPx: -portraitTiltPx(cam, hgt) };
    wrap.style.setProperty('--cam-shift', `${fr.shiftPx.toFixed(1)}px`);
    wrap.style.setProperty('--cam-zoom', fr.zoom.toFixed(4));
    return cam;
  };
  const mountParallax = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};
    let raf = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      raf = 0;
      DEPTHS.forEach((d, i) => {
        depthEls[i]!.style.translate = `${(-nx * d.par).toFixed(1)}px ${(-ny * d.par * 0.45).toFixed(1)}px`;
      });
    };
    const onMove = (e: PointerEvent) => {
      nx = (e.clientX / window.innerWidth) * 2 - 1;
      ny = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  };
  return { el: wrap, frame, mountParallax };
}
