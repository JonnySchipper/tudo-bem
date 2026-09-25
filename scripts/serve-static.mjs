#!/usr/bin/env node
/** Serve a static build under a base path, like GitHub Pages does:  node scripts/serve-static.mjs <dir> [port] [base] */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'apps/client/dist');
const port = Number(process.argv[3] ?? 4173);
const base = (process.argv[4] ?? '/').replace(/\/?$/, '/');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

http
  .createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!u.pathname.startsWith(base)) {
      res.writeHead(302, { location: base });
      return res.end();
    }
    let file = path.join(dir, decodeURIComponent(u.pathname.slice(base.length)));
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`static ${dir} at http://localhost:${port}${base}`));
