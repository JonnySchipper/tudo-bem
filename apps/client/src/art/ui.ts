/**
 * Generated UI chrome (SVG). Single source of truth for icons, coin, plate badge, logo mark and
 * surface patterns. Applied as CSS variables at boot and exported to /art/ui/*.svg by `pnpm art`.
 */
import { PALETTE as P, TB } from './palette';
import { SP_MAP } from '../render/room';

const svg = (w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

const stroke = `fill="none" stroke="${P.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

export const ICONS: Record<string, string> = {
  map: svg(24, 24, `<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" fill="${P.amarelo}" ${stroke.replace('fill="none" ', '')}/><path d="M9 4v14M15 6v14" ${stroke}/><circle cx="17.5" cy="9" r="2.2" fill="${P.terracota}"/>`),
  hat: svg(24, 24, `<ellipse cx="12" cy="16" rx="10" ry="3.6" fill="${P.palha}" stroke="${P.ink}" stroke-width="1.8"/><path d="M7 15.5c0-6 2-9 5-9s5 3 5 9" fill="${P.palha}" stroke="${P.ink}" stroke-width="1.8"/><path d="M7.2 13.5h9.6" stroke="${P.terracota}" stroke-width="2.4"/>`),
  friends: svg(24, 24, `<circle cx="8.5" cy="8" r="3.4" fill="${P.verde}" stroke="${P.ink}" stroke-width="1.6"/><circle cx="16" cy="9" r="3" fill="${P.azul}" stroke="${P.ink}" stroke-width="1.6"/><path d="M2.5 20c.6-4 3-6 6-6s5.4 2 6 6z" fill="${P.verde}" stroke="${P.ink}" stroke-width="1.6"/><path d="M13 20c.4-3.3 2-5 4.2-5s4 1.7 4.3 5z" fill="${P.azul}" stroke="${P.ink}" stroke-width="1.6"/>`),
  soundOn: svg(24, 24, `<path d="M4 9h4l5-4v14l-5-4H4z" fill="${P.amarelo}" stroke="${P.ink}" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11" ${stroke}/>`),
  soundOff: svg(24, 24, `<path d="M4 9h4l5-4v14l-5-4H4z" fill="#d9cfc0" stroke="${P.ink}" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 9l5 6M21 9l-5 6" ${stroke}/>`),
  musicOn: svg(24, 24, `<path d="M9 17.5V6.2l10-2v11" fill="none" stroke="${P.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="2.5" fill="${P.terracota}" stroke="${P.ink}" stroke-width="1.4"/><circle cx="17" cy="15.2" r="2.5" fill="${P.amarelo}" stroke="${P.ink}" stroke-width="1.4"/>`),
  musicOff: svg(24, 24, `<path d="M9 17.5V6.2l10-2v11" fill="none" stroke="${P.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="17.5" r="2.5" fill="#d9cfc0" stroke="${P.ink}" stroke-width="1.4"/><circle cx="17" cy="15.2" r="2.5" fill="#d9cfc0" stroke="${P.ink}" stroke-width="1.4"/><path d="M4 4l16 16" ${stroke}/>`),
  decor: svg(24, 24, `<rect x="3" y="11" width="18" height="6" rx="2" fill="${P.verde}" stroke="${P.ink}" stroke-width="1.8"/><path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3" fill="${P.verdeClaro}" stroke="${P.ink}" stroke-width="1.8"/><path d="M5 17v2M19 17v2" ${stroke}/>`),
  parrot: svg(24, 24, `<path d="M6 20l3-7" stroke="${P.verdeEscuro}" stroke-width="3" stroke-linecap="round"/><ellipse cx="11" cy="12" rx="5" ry="6.5" fill="${P.verde}" stroke="${P.ink}" stroke-width="1.6"/><circle cx="13" cy="6.5" r="4" fill="${P.verdeClaro}" stroke="${P.ink}" stroke-width="1.6"/><path d="M16.5 5.5c3 .3 3 3.5.5 4" fill="${P.laranja}" stroke="${P.ink}" stroke-width="1.4"/><circle cx="14" cy="6" r="1" fill="${P.ink}"/>`),
  send: svg(24, 24, `<path d="M3 11l18-8-6 18-3-7z" fill="${P.cream}" stroke="${P.cream}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 14l9-11" stroke="${P.terracota}" stroke-width="1.6"/>`),
  close: svg(24, 24, `<path d="M6 6l12 12M18 6L6 18" ${stroke} stroke-width="2.6"/>`),
  signup: svg(24, 24, `<circle cx="9.5" cy="8" r="3.6" fill="${P.verde}" stroke="${P.ink}" stroke-width="1.6"/><path d="M3 20c.6-4.2 3.2-6.4 6.5-6.4s5.9 2.2 6.5 6.4z" fill="${P.verde}" stroke="${P.ink}" stroke-width="1.6"/><path d="M18.5 7.5v6M15.5 10.5h6" stroke="${P.terracota}" stroke-width="2.2" stroke-linecap="round"/>`),
  logout: svg(24, 24, `<path d="M4 3.5h9v17H4z" fill="${P.terracota}" stroke="${P.ink}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10.5" cy="12" r="1" fill="${P.amarelo}"/><path d="M15 12h6.5M18.5 9l3 3-3 3" ${stroke}/>`),
  // Missão do dia steps (Cumprimenta · Pede · Monta) — same glyphs as the kiosk sign in the Praça.
  cumprimenta: svg(
    24,
    24,
    `<rect x="6" y="11" width="10" height="9" rx="3.5" fill="#f2c9a0" stroke="${TB.charcoal}" stroke-width="1.6"/>${[0, 1, 2, 3]
      .map((i) => `<rect x="${6 + i * 2.6}" y="${i === 0 || i === 3 ? 5.5 : 4}" width="2.3" height="9" rx="1.15" fill="#f2c9a0" stroke="${TB.charcoal}" stroke-width="1.4"/>`)
      .join('')}<path d="M19 5c1.6 1.4 1.6 4 0 5.5M21 3c2.4 2.4 2.4 7 0 9.4" fill="none" stroke="${TB.terracotta}" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  pede: svg(
    24,
    24,
    `<path d="M5 10h11l-1.2 9H6.2z" fill="${TB.creamWall}" stroke="${TB.charcoal}" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 12h1.5a2.5 2.5 0 010 5H15.4" fill="none" stroke="${TB.charcoal}" stroke-width="1.6"/><rect x="6" y="11" width="9" height="2" fill="#6b3f1f"/><path d="M8.5 7.5c-1-1.2 1-2.2 0-3.6M12 7.5c-1-1.2 1-2.2 0-3.6" fill="none" stroke="${TB.terracotta}" stroke-width="1.5" stroke-linecap="round"/><path d="M3.5 20.5h15" stroke="${TB.charcoal}" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  monta: svg(
    24,
    24,
    `<path d="M2.5 15.5h19l-2 4h-15z" fill="${TB.terracotta}" stroke="${TB.charcoal}" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="8.5" cy="12.5" rx="4.2" ry="2.8" fill="#d9913f" stroke="${TB.charcoal}" stroke-width="1.4"/><path d="M6.8 11.4l1 2M9.2 11.2l1 2" stroke="#9a5a22" stroke-width="1"/><rect x="14" y="7.5" width="5" height="7" rx="1.3" fill="${TB.creamWall}" stroke="${TB.charcoal}" stroke-width="1.4"/><rect x="14.8" y="9" width="3.4" height="1.6" fill="#6b3f1f"/>`,
  ),
};

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

export function icon(name: keyof typeof ICONS, size = 20): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ico';
  span.style.width = span.style.height = `${size}px`;
  span.innerHTML = ICONS[name];
  const el = span.firstElementChild as SVGElement | null;
  if (el) {
    el.setAttribute('width', String(size));
    el.setAttribute('height', String(size));
  }
  return span;
}

/** Install generated chrome as CSS custom properties. */
export function installUiArt() {
  const root = document.documentElement.style;
  root.setProperty('--art-azulejo', svgUrl(AZULEJO));
  root.setProperty('--art-calcada', svgUrl(CALCADA));
  root.setProperty('--art-skyline', svgUrl(SKYLINE));
  root.setProperty('--art-coin', svgUrl(COIN));
  root.setProperty('--art-seed', svgUrl(SEEDLING));
  root.setProperty('--art-logo', svgUrl(LOGO_MARK));
}

export const UI_EXPORTS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [`icon_${k}`, v])),
  coin_rv: COIN,
  seedling_verde: SEEDLING,
  logo_mark: LOGO_MARK,
  pattern_azulejo: AZULEJO,
  pattern_calcada: CALCADA,
  skyline_copan: SKYLINE,
};
