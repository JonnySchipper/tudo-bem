/**
 * Static client serving: MIME types, validators (ETag / Last-Modified → 304), byte ranges (iOS Safari will not play audio without 206),
 * precompressed `.br` / `.gz` siblings or on-the-fly gzip for text, and a 404 for missing files. Only extensionless navigation paths
 * fall back to the game shell (index.html).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { staticCacheControl } from './cacheControl.js';

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

/** Text types worth compressing. Images, fonts and audio are already compressed. */
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.map', '.svg', '.webmanifest', '.txt', '.xml']);
/** Below this, gzip framing costs more than it saves. */
const GZIP_MIN_BYTES = 1024;
/** Directories that only ever hold files. A miss under them is a 404, never the game shell. */
const ASSET_DIRS = /^\/(assets|pixel|audio|brand|icons)(\/|$)/;

/** gzip of a file, keyed by path + mtime + size so an edited file is recompressed. Bounded by total bytes. */
const gzipCache = new Map<string, Buffer>();
let gzipCacheBytes = 0;
const GZIP_CACHE_MAX_BYTES = 32 * 1024 * 1024;

function gzipped(file: string, st: fs.Stats): Buffer {
  const key = `${file}\0${st.mtimeMs}\0${st.size}`;
  const hit = gzipCache.get(key);
  if (hit) return hit;
  const buf = zlib.gzipSync(fs.readFileSync(file), { level: 6 });
  if (gzipCacheBytes + buf.length > GZIP_CACHE_MAX_BYTES) {
    gzipCache.clear();
    gzipCacheBytes = 0;
  }
  gzipCache.set(key, buf);
  gzipCacheBytes += buf.length;
  return buf;
}

/** Codings the client accepts (q=0 means refused). */
function acceptedEncodings(req: IncomingMessage): Set<string> {
  const out = new Set<string>();
  for (const part of String(req.headers['accept-encoding'] ?? '').split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (!name) continue;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    if (q && Number(q.slice(2)) === 0) continue;
    out.add(name);
  }
  return out;
}

function fileStat(file: string): fs.Stats | null {
  try {
    const st = fs.statSync(file);
    return st.isFile() ? st : null;
  } catch {
    return null;
  }
}

/** Strong ETag of one representation: size and mtime of the file on disk, plus the coding. */
export function etagFor(st: fs.Stats, coding = ''): string {
  return `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}${coding ? `-${coding}` : ''}"`;
}

function notModified(req: IncomingMessage, etag: string, mtime: Date): boolean {
  const inm = req.headers['if-none-match'];
  if (inm) {
    if (inm.trim() === '*') return true;
    return inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag);
  }
  const ims = Date.parse(String(req.headers['if-modified-since'] ?? ''));
  return Number.isFinite(ims) && Math.floor(mtime.getTime() / 1000) * 1000 <= ims;
}

/**
 * Parse a single `bytes=` range against `size`. `null` = no usable range (serve the whole file), `'unsatisfiable'` = 416.
 * Multi-range requests are answered with the whole file, which RFC 9110 allows.
 */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const m = /^bytes=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header.trim());
  if (!m) return null;
  const [, a, b] = m;
  if (!a && !b) return null;
  if (!a) {
    const n = Number(b);
    if (n === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(a);
  const end = b ? Math.min(Number(b), size - 1) : size - 1;
  if (b && Number(b) < start) return null;
  if (start >= size) return 'unsatisfiable';
  return { start, end };
}

function streamFile(res: ServerResponse, file: string, range?: { start: number; end: number }) {
  const s = fs.createReadStream(file, range);
  // The file can vanish between stat and read (a deploy swapping dist). Drop the socket rather than crash.
  s.on('error', (e) => {
    console.error('[static] read error', file, e.message);
    res.destroy();
  });
  s.pipe(res);
}

/** Serve `url` from `clientDist`. Answers every request it is given. */
export function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL, clientDist: string): void {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
    return void res.end('Method not allowed');
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    return void res.end('Bad request');
  }
  const root = path.resolve(clientDist);
  const rel = path.normalize(decoded).replace(/^([/\\])+/, '');
  let file = path.join(root, rel);
  const inside = file === root || file.startsWith(root + path.sep);
  let st = inside && !decoded.includes('\0') ? fileStat(file) : null;
  if (!st) {
    if (path.extname(decoded) || ASSET_DIRS.test(decoded)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
      return void res.end('Not found');
    }
    file = path.join(root, 'index.html');
    st = fileStat(file);
    if (!st) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' });
      return void res.end('Not found');
    }
  }
  const ext = path.extname(file).toLowerCase();
  const compressible = COMPRESSIBLE.has(ext);
  const base: Record<string, string> = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': staticCacheControl(url, ext),
    'last-modified': st.mtime.toUTCString(),
  };
  if (compressible) base.vary = 'Accept-Encoding';

  // Text: a precompressed sibling, else gzip on the fly. Ranges are only served on the identity representation.
  const rangeHeader = req.headers.range;
  if (compressible && !rangeHeader) {
    const enc = acceptedEncodings(req);
    for (const [coding, suffix] of [
      ['br', '.br'],
      ['gzip', '.gz'],
    ] as const) {
      if (!enc.has(coding)) continue;
      const sib = fileStat(file + suffix);
      if (!sib) continue;
      const etag = etagFor(st, coding);
      if (notModified(req, etag, st.mtime)) {
        res.writeHead(304, { ...base, etag });
        return void res.end();
      }
      res.writeHead(200, { ...base, etag, 'content-encoding': coding, 'content-length': String(sib.size) });
      if (method === 'HEAD') return void res.end();
      return streamFile(res, file + suffix);
    }
    if (enc.has('gzip') && st.size >= GZIP_MIN_BYTES) {
      const etag = etagFor(st, 'gzip');
      if (notModified(req, etag, st.mtime)) {
        res.writeHead(304, { ...base, etag });
        return void res.end();
      }
      const body = gzipped(file, st);
      res.writeHead(200, { ...base, etag, 'content-encoding': 'gzip', 'content-length': String(body.length) });
      return void res.end(method === 'HEAD' ? undefined : body);
    }
  }

  const etag = etagFor(st);
  const headers = { ...base, etag, 'accept-ranges': 'bytes' };
  if (notModified(req, etag, st.mtime)) {
    res.writeHead(304, headers);
    return void res.end();
  }
  // If-Range: only honour the range when the client's copy is this exact file.
  const ifRange = req.headers['if-range'] ? String(req.headers['if-range']).trim() : '';
  const rangeOk = !ifRange || ifRange === etag || ifRange === st.mtime.toUTCString();
  const range = rangeOk ? parseRange(rangeHeader, st.size) : null;
  if (range === 'unsatisfiable') {
    res.writeHead(416, { ...headers, 'content-range': `bytes */${st.size}` });
    return void res.end();
  }
  if (range) {
    res.writeHead(206, { ...headers, 'content-range': `bytes ${range.start}-${range.end}/${st.size}`, 'content-length': String(range.end - range.start + 1) });
    if (method === 'HEAD') return void res.end();
    return streamFile(res, file, range);
  }
  res.writeHead(200, { ...headers, 'content-length': String(st.size) });
  if (method === 'HEAD') return void res.end();
  streamFile(res, file);
}
