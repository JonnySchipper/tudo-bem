import './studio.css';
import { allAssets, CATEGORY_LABELS, type ArtAsset, type ArtCategory } from './registry';
import { installUiArt, UI_EXPORTS } from './ui';
import { PALETTE } from './palette';

installUiArt();

const DISPLAY: Record<ArtCategory, number> = { rooms: 0.62, tiles: 1.3, props: 1.1, furniture: 1.1, hats: 1.6, food: 1.6, avatars: 1.5, characters: 2 };

function render(asset: ArtAsset, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(asset.bounds.w * scale);
  c.height = Math.ceil(asset.bounds.h * scale);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -asset.bounds.x * scale, -asset.bounds.y * scale);
  asset.draw(ctx);
  return c;
}

function cropAlpha(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d')!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { canvas: c, x: 0, y: 0 };
  x0 = Math.max(0, x0 - 2);
  y0 = Math.max(0, y0 - 2);
  x1 = Math.min(width - 1, x1 + 2);
  y1 = Math.min(height - 1, y1 + 2);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d')!.drawImage(c, -x0, -y0);
  return { canvas: out, x: x0, y: y0 };
}

async function main() {
  await Promise.all(['800 12px Nunito', '700 12px Nunito', 'italic 600 12px Nunito', '800 12px "Baloo 2"'].map((f) => document.fonts.load(f).catch(() => null)));
  await document.fonts.ready;
  const root = document.getElementById('studio')!;
  const assets = allAssets();
  const byCat = new Map<ArtCategory, ArtAsset[]>();
  for (const a of assets) byCat.set(a.category, [...(byCat.get(a.category) ?? []), a]);

  const head = document.createElement('header');
  head.innerHTML = `
    <div class="mark"></div>
    <div>
      <h1>Tudo Bem · Arte gerada</h1>
      <p>Every Phase 0 asset below is generated in-repo from code (canvas + SVG) by the build agent — no stock or third-party art.
      Runtime sprites are baked with <code>pnpm art</code> into <code>apps/client/public/art</code>; drop a hand-painted PNG with the same name to override.
      Animated pieces render live. <b>${assets.length}</b> assets · <b>${Object.keys(UI_EXPORTS).length}</b> UI SVGs.</p>
    </div>`;
  root.append(head);

  // Palette
  const pal = document.createElement('section');
  pal.dataset.cat = 'palette';
  pal.innerHTML = `<h2>Paleta <small>Palette — warm São Paulo afternoon</small></h2><div class="swatches">${Object.entries(PALETTE)
    .map(([k, v]) => `<div class="sw"><span style="background:${v}"></span><b>${k}</b><code>${v}</code></div>`)
    .join('')}</div>`;
  root.append(pal);

  // UI chrome
  const uiSec = document.createElement('section');
  uiSec.dataset.cat = 'ui';
  uiSec.innerHTML = `<h2>Interface <small>UI chrome — icons, coin, plate badge, logo, patterns (SVG)</small></h2><div class="grid ui">${Object.entries(UI_EXPORTS)
    .map(([k, v]) => `<figure class="${k.startsWith('pattern') || k.startsWith('skyline') ? 'wide' : ''}"><div class="svg">${v}</div><figcaption>${k}</figcaption></figure>`)
    .join('')}</div>`;
  root.append(uiSec);

  const order: ArtCategory[] = ['rooms', 'tiles', 'props', 'furniture', 'hats', 'food', 'avatars', 'characters'];
  for (const cat of order) {
    const list = byCat.get(cat) ?? [];
    const sec = document.createElement('section');
    sec.dataset.cat = cat;
    sec.innerHTML = `<h2>${CATEGORY_LABELS[cat].pt} <small>${CATEGORY_LABELS[cat].en} · ${list.length}</small></h2>`;
    const grid = document.createElement('div');
    grid.className = `grid ${cat}`;
    for (const a of list) {
      const d = DISPLAY[cat];
      const c = render(a, a.scale);
      const shown = a.crop ? cropAlpha(c).canvas : c;
      const s = d / a.scale;
      shown.style.width = `${shown.width * s}px`;
      shown.style.height = `${shown.height * s}px`;
      const fig = document.createElement('figure');
      fig.className = a.animated ? 'animated' : '';
      const cap = document.createElement('figcaption');
      cap.innerHTML = `<b>${a.label.pt}</b><i>${a.label.en}</i><code>${a.key}${a.runtime ? ' · runtime' : ''}</code>`;
      const holder = document.createElement('div');
      holder.className = 'art';
      holder.append(shown);
      fig.append(holder, cap);
      grid.append(fig);
    }
    sec.append(grid);
    root.append(sec);
  }

  (window as unknown as Record<string, unknown>).__artExport = () =>
    assets.map((a) => {
      const full = render(a, a.scale);
      const { canvas, x, y } = a.crop ? cropAlpha(full) : { canvas: full, x: 0, y: 0 };
      return {
        key: a.key,
        category: a.category,
        runtime: a.runtime,
        dataUrl: canvas.toDataURL('image/png'),
        meta: {
          w: +(canvas.width / a.scale).toFixed(2),
          h: +(canvas.height / a.scale).toFixed(2),
          ox: +(a.bounds.x + x / a.scale).toFixed(2),
          oy: +(a.bounds.y + y / a.scale).toFixed(2),
        },
      };
    });
  (window as unknown as Record<string, unknown>).__artUi = UI_EXPORTS;
  (window as unknown as Record<string, unknown>).__artReady = true;
}

void main();
