#!/usr/bin/env node
/**
 * Before/after contact sheets for the character redesign (docs/art/characters-v1).
 * Run after scripts/character-shots.mjs has filled before/ and after/.
 *
 *   node scripts/character-contact.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.env.DIR ?? 'docs/art/characters-v1');
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const img = (side, name) => {
  const f = path.join(DIR, side, `${name}.png`);
  return fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` : '';
};

const SHEETS = [
  {
    out: 'contact_required.png',
    title: 'TB Art acceptance #7 — required shots (after)',
    afterOnly: true,
    rows: [
      ['sheet_player', 'Player — front · 3/4 · back · hat on (Jeans + camiseta · Blusa + calça)'],
      ['07_carlos_zoom', 'Seu Carlos behind the counter (Padaria, morning light)'],
      ['03_julia_zoom', 'Júlia in the Praça (late afternoon)'],
      ['04_nanda_zoom', 'Nanda at the hat stall'],
      ['sheet_crowd', 'CPU lineup (authored wardrobe)'],
      ['02_crowd_zoom', 'CPU neighbors in the Praça'],
      ['sheet_hatfit', 'Hats × big hair silhouettes — no skull / hair clip'],
      ['10_kitnet_player_zoom', 'Player in Kitnet daylight'],
    ],
  },
  {
    out: 'contact_lineups.png',
    title: 'Character redesign v1 — lineups',
    rows: [
      ['sheet_npcs', 'Seu Carlos · Nanda · Júlia (front + back)'],
      ['sheet_closeup', 'Closeup 2× (NPCs + players)'],
      ['sheet_crowd', 'Praça CPU neighbors'],
      ['sheet_hats', 'All 12 hats worn'],
      ['sheet_creator', 'Creator range'],
      ['sheet_poses', 'Poses + emotes'],
    ],
  },
  {
    out: 'contact_ingame.png',
    title: 'Character redesign v1 — in game (solo Pages build, 1280×800, 2× closeups)',
    rows: [
      ['01_praca_zoom', 'Praça'],
      ['02_crowd_zoom', 'Crowd'],
      ['07_carlos_zoom', 'Seu Carlos behind the counter'],
      ['04_nanda_zoom', 'Nanda at the hat stall'],
      ['00_creator_preview', 'Creator preview'],
      ['05_hat_shop', 'Hat shop'],
    ],
  },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 })).newPage();

// Full-frame shots are kept at 1280 wide (closeups stay at 2× for detail).
for (const side of ['before', 'after']) {
  for (const name of ['00_creator', '01_praca', '05_hat_shop', '06_padaria', '08_carlos_dialogue']) {
    const f = path.join(DIR, side, `${name}.png`);
    if (!fs.existsSync(f)) continue;
    const out = await page.evaluate(async (src) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      if (im.naturalWidth <= 1280) return null;
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = Math.round((im.naturalHeight * 1280) / im.naturalWidth);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    }, `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
    if (out) fs.writeFileSync(f, Buffer.from(out.split(',')[1], 'base64'));
  }
}

for (const s of SHEETS) {
  const rows = s.rows
    .map(([name, label]) =>
      s.afterOnly
        ? `<section><h2>${label}</h2><figure class="after solo"><img src="${img('after', name)}"></figure></section>`
        : `<section><h2>${label}</h2><div class="pair">
        <figure><figcaption>Before</figcaption>${img('before', name) ? `<img src="${img('before', name)}">` : '<div class="none">—</div>'}</figure>
        <figure class="after"><figcaption>After</figcaption><img src="${img('after', name)}"></figure></div></section>`,
    )
    .join('');
  await page.setContent(`<!doctype html><html><head><style>
    body{margin:0;padding:28px;background:#f5e6d3;font-family:Nunito,system-ui,sans-serif;color:#2c2c2c;width:1744px}
    h1{margin:0 0 18px;color:#c45c26;font-size:30px}
    section{background:#fff8ec;border-radius:16px;padding:14px 16px 16px;margin-bottom:16px;box-shadow:0 6px 18px rgba(42,34,51,.12)}
    h2{margin:0 0 10px;font-size:18px}
    .pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
    figure{margin:0;background:#fff;border-radius:12px;padding:8px;border:2px solid #e3d3bd}
    figure.after{border-color:#2f5d50}
    figcaption{font-weight:800;font-size:13px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;color:#9a8a74}
    figure.after figcaption{color:#2f5d50}
    img{width:100%;display:block;border-radius:8px}
    .none{padding:40px;text-align:center;color:#9a8a74}
    figure.solo{max-width:1100px}
  </style></head><body><h1>${s.title}</h1>${rows}</body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, s.out), fullPage: true });
  console.log('  ·', s.out);
}
await browser.close();
