#!/usr/bin/env node
/**
 * Bake every generated art asset to files.
 *
 *   pnpm art
 *
 * 1. builds the client (includes the /art.html studio),
 * 2. serves apps/client/dist on a local port and renders the studio in headless Chrome,
 * 3. writes PNG sprites + UI SVGs + manifest.json to apps/client/public/art,
 * 4. writes contact sheets for art review to docs/art,
 * 5. rebuilds the client so dist ships the fresh art.
 */
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps/client/dist');
const outDir = path.join(root, 'apps/client/public/art');
const sheets = path.join(root, 'docs/art');
const CHROME = process.env.CHROME_PATH ?? ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

function build() {
  execSync('pnpm --filter @tudobem/client build', { cwd: root, stdio: 'inherit' });
}

function serve() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let file = path.join(dist, decodeURIComponent(u.pathname));
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  if (!CHROME) throw new Error('Chrome/Chromium not found — set CHROME_PATH');
  build();
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`http://127.0.0.1:${port}/art.html?art=live`);
  await page.waitForFunction(() => window.__artReady, null, { timeout: 60_000 });

  const assets = await page.evaluate(() => window.__artExport());
  const ui = await page.evaluate(() => window.__artUi);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = { version: 1, scale: 3, generatedBy: 'scripts/bake-art.mjs (procedural, in-repo)', sprites: {} };
  let bytes = 0;
  for (const a of assets) {
    // Review-only large sheets (rooms, avatars, tiles) go to docs/art, not the runtime bundle.
    const target = a.runtime ? outDir : path.join(sheets, 'assets');
    const file = `${a.key}.png`;
    const abs = path.join(target, file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const buf = Buffer.from(a.dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(abs, buf);
    if (a.runtime) {
      bytes += buf.length;
      manifest.sprites[a.key] = { file, ...a.meta };
    }
  }
  fs.mkdirSync(path.join(outDir, 'ui'), { recursive: true });
  for (const [name, svg] of Object.entries(ui)) fs.writeFileSync(path.join(outDir, 'ui', `${name}.svg`), svg);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));

  // Contact sheets for TB Art review
  fs.mkdirSync(sheets, { recursive: true });
  for (const cat of ['palette', 'ui', 'rooms', 'tiles', 'props', 'furniture', 'hats', 'food', 'avatars']) {
    const el = await page.$(`section[data-cat="${cat}"]`);
    if (el) await el.screenshot({ path: path.join(sheets, `sheet_${cat}.png`) });
  }
  await browser.close();
  server.close();
  console.log(`\n  ✓ baked ${Object.keys(manifest.sprites).length} runtime sprites (${(bytes / 1024).toFixed(0)} KB), ${Object.keys(ui).length} UI SVGs, ${assets.length - Object.keys(manifest.sprites).length} review renders`);
  console.log(`    → ${path.relative(root, outDir)}  ·  contact sheets → ${path.relative(root, sheets)}\n`);
  build();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
