/**
 * HUD chrome. Icons are 16x16 pixel art (`public/pixel/ui/icon_<name>.png`, authored in `assets-src/custom/uiicons.mjs`) shown at an integer
 * zoom with `image-rendering: pixelated`. The coin, seedling, logo mark and the intro's patterns are still small SVGs applied as CSS variables
 * at boot.
 */
import { PALETTE as P, TB } from './palette';
import { imageUrl } from '../render/pixel/manifest';

/** The State of São Paulo outline (unit square), used by the calçada strip of the intro. */
const SP_MAP: [number, number][] = [
  [0.08, 0.47], [0.19, 0.37], [0.31, 0.34], [0.42, 0.26], [0.53, 0.24], [0.63, 0.15], [0.74, 0.16],
  [0.83, 0.24], [0.93, 0.29], [0.9, 0.41], [0.81, 0.5], [0.71, 0.59], [0.6, 0.67], [0.5, 0.78],
  [0.42, 0.73], [0.38, 0.62], [0.29, 0.58], [0.19, 0.56], [0.11, 0.53],
];

const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

export const ICON_NAMES = [
  'map', 'hat', 'friends', 'soundOn', 'soundOff', 'musicOn', 'musicOff', 'decor', 'parrot', 'send', 'close', 'info', 'logout', 'caderno', 'recados', 'coracao',
  // Missão do dia steps (Cumprimenta, Pede, Monta)
  'cumprimenta', 'pede', 'monta',
  // V4 HUD: settings gear, phone drawer, emote tray
  'gear', 'burger', 'emote', 'rv', 'verde', 'mark',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** RV coin — a gold real virtual with an ipê flower. */
export const COIN = svg(
  32,
  32,
  `<defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff0a8"/><stop offset=".55" stop-color="${P.amarelo}"/><stop offset="1" stop-color="#c38f10"/></radialGradient></defs>
  <circle cx="16" cy="16" r="14.5" fill="url(#g)" stroke="#9a6d08" stroke-width="2"/>
  <circle cx="16" cy="16" r="10.5" fill="none" stroke="#b8860b" stroke-width="1" stroke-dasharray="1.5 1.5"/>
  ${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="16" cy="11.2" rx="2.4" ry="3.6" fill="#fff4bf" stroke="#b8860b" stroke-width=".8" transform="rotate(${i * 72} 16 16)"/>`).join('')}
  <circle cx="16" cy="16" r="2.2" fill="${P.terracota}"/>`,
);

/** Verde nameplate seedling (icon + color, so it reads for colorblind players). */
export const SEEDLING = svg(16, 16, `<path d="M8 15V8" stroke="#e7ffd9" stroke-width="1.8" stroke-linecap="round"/><path d="M8 8C8 4.5 5.5 3 2 3c0 3.5 2.5 5 6 5z" fill="#c9f2b8"/><path d="M8 9c0-3.5 2.5-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5z" fill="#e7ffd9"/>`);

/** Logo mark: sun over a padaria awning — warm, São Paulo afternoon. */
export const LOGO_MARK = svg(
  40,
  40,
  `<circle cx="20" cy="17" r="11" fill="${P.amarelo}"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="19" y="1" width="2" height="4" rx="1" fill="${P.amarelo}" transform="rotate(${i * 45} 20 17)"/>`).join('')}
  <path d="M4 26h32l-2 6H6z" fill="${P.terracota}"/>
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M${4 + i * 6.4} 26h3.2l-.4 6h-3.2z" fill="${P.cream}"/>`).join('')}
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M${4 + i * 6.4} 32a3.2 3.2 0 006.4 0z" fill="${i % 2 ? P.cream : P.terracota}"/>`).join('')}`,
);

/** Glazed terracotta tile strip (repeatable) — the padaria wainscot, reused as panel trim. */
export const AZULEJO = svg(
  40,
  40,
  `<rect width="40" height="40" fill="${TB.creamWall}"/>
  ${[[0, 0], [40, 0], [0, 40], [40, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${TB.terracotta}"/><circle cx="${x}" cy="${y}" r="5" fill="${TB.creamWall}"/>`).join('')}
  ${[0, 1, 2, 3].map((i) => `<ellipse cx="20" cy="12.5" rx="3.6" ry="6.5" fill="${TB.terracotta}" transform="rotate(${i * 90} 20 20)"/>`).join('')}
  <circle cx="20" cy="20" r="3" fill="${TB.mustard}"/>
  <rect width="40" height="40" fill="none" stroke="rgba(139,94,60,.3)"/>`,
);

/** Calçada paulista — São Paulo state-map mosaic strip (repeat-x). Not the Copacabana wave. */
export const CALCADA = (() => {
  const map = (x0: number, y0: number, s: number) => `<path d="M${SP_MAP.map(([u, v]) => `${(x0 + u * s).toFixed(1)} ${(y0 + v * s).toFixed(1)}`).join(' L')}Z" fill="${P.calcadaEscura}"/>`;
  return svg(120, 48, `<rect width="120" height="48" fill="${P.calcadaClara}"/>${map(4, 2, 44)}${map(64, 2, 44)}<path d="M60 0V48" stroke="rgba(60,50,40,.18)"/>`);
})();

/** Skyline silhouette with a Copan-like curved tower, for onboarding. */
export const SKYLINE = (() => {
  const blocks: string[] = [];
  let x = 0;
  let k = 0;
  while (x < 600) {
    const w = 26 + ((k * 37) % 30);
    const h = 50 + ((k * 53) % 90);
    if (x > 250 && x < 380) {
      x += w;
      k++;
      continue;
    }
    blocks.push(`<rect x="${x}" y="${160 - h}" width="${w - 3}" height="${h}" fill="${k % 2 ? '#9aa6ab' : '#a9b2b3'}"/><rect x="${x}" y="${160 - h}" width="4" height="${h}" fill="#e9c9a4" opacity=".6"/>`);
    for (let wy = 160 - h + 8; wy < 152; wy += 12)
      for (let wx = x + 5; wx < x + w - 8; wx += 8) if ((wx * 7 + wy * 3 + k) % 5 < 2) blocks.push(`<rect x="${wx}" y="${wy}" width="3" height="5" fill="#f3dcb8" opacity=".75"/>`);
    x += w;
    k++;
  }
  const copan = `<path d="M262 160 V38 C290 22 318 44 346 30 C360 24 372 26 380 32 V160Z" fill="#b9c0c0"/>${Array.from({ length: 20 }, (_, i) => `<path d="M262 ${44 + i * 6} C290 ${30 + i * 6.5} 318 ${50 + i * 5.8} 380 ${38 + i * 6.1}" stroke="#8f9a9e" stroke-width="1.6" fill="none"/>`).join('')}`;
  return svg(600, 160, copan + blocks.join(''));
})();

export const svgUrl = (s: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`;

/**
 * A pixel icon. The art is 16 px; it is shown at the nearest whole zoom of `size` (16-23 px -> 1x, 24-39 px -> 2x) so it never blurs.
 */
export function icon(name: IconName, size = 20): HTMLElement {
  const zoom = Math.max(1, Math.round(size / 16));
  const box = 16 * zoom;
  const span = document.createElement('span');
  span.className = 'ico';
  span.style.width = span.style.height = `${box}px`;
  const img = document.createElement('img');
  img.src = imageUrl(`ui/icon_${name}`);
  img.alt = '';
  img.width = img.height = box;
  img.draggable = false;
  img.style.imageRendering = 'pixelated';
  span.append(img);
  return span;
}

/** Install generated chrome as CSS custom properties. */
export function installUiArt() {
  const root = document.documentElement.style;
  root.setProperty('--art-azulejo', svgUrl(AZULEJO));
  // pixel icons (the coin, the Verde sprout and the brand mark used to be smooth SVGs)
  const px = (name: string) => `url("${imageUrl(`ui/icon_${name}`)}")`;
  root.setProperty('--art-coin', px('rv'));
  root.setProperty('--art-seed', px('verde'));
  root.setProperty('--art-mark', px('mark'));
}

