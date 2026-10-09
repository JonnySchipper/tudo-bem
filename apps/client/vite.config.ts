import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';

const SERVER = process.env.TB_SERVER ?? 'http://localhost:8787';

/**
 * Dev and `vite preview` only. Production routing is `legalPageFile` in the server.
 * Extensionless `/privacy` and `/terms` must become the static files before the SPA fallback.
 */
function rewriteLegalRequestUrl(url: string): string {
  const q = url.indexOf('?');
  const pathOnly = q === -1 ? url : url.slice(0, q);
  const search = q === -1 ? '' : url.slice(q);
  const path = (pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`).replace(/\/+$/, '') || '/';
  const base = path.toLowerCase();
  if (base === '/privacy') return `/privacy.html${search}`;
  if (base === '/terms') return `/terms.html${search}`;
  return url;
}

/** `/privacy` and `/terms` are static HTML. Rewrite them before Vite's SPA fallback. */
function legalPages(): Plugin {
  const use = (middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void }) => {
    middlewares.use((req, _res, next) => {
      if (req.url) req.url = rewriteLegalRequestUrl(req.url);
      next();
    });
  };
  return {
    name: 'tudobem-legal-pages',
    configureServer(server) {
      use(server.middlewares);
    },
    configurePreviewServer(server) {
      use(server.middlewares);
    },
  };
}

const PRECOMPRESS = /\.(js|mjs|css|json|html|svg|webmanifest|txt|xml)$/i;
const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/**
 * Writes `.br` and `.gz` next to every text asset in dist (the server sends them when the browser accepts them). Build-time, so the
 * strongest settings are affordable. A file whose compressed copy is not smaller (tiny files) is left alone.
 */
function precompress(): Plugin {
  let outDir = '';
  let write = true;
  return {
    name: 'tudobem-precompress',
    apply: 'build',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
      write = cfg.build.write !== false;
    },
    async closeBundle() {
      // in-memory builds (write: false, e.g. academia-lock.test.ts) have nothing on disk to compress
      if (!write || !fs.existsSync(outDir)) return;
      const files = (fs.readdirSync(outDir, { recursive: true }) as string[]).map((f) => path.join(outDir, f)).filter((f) => PRECOMPRESS.test(f) && fs.statSync(f).isFile());
      let raw = 0;
      let br = 0;
      await Promise.all(
        files.map(async (file) => {
          const src = fs.readFileSync(file);
          if (src.length < 1024) return;
          const [b, g] = await Promise.all([
            brotli(src, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: src.length } }),
            gzip(src, { level: 9 }),
          ]);
          if (b.length < src.length) fs.writeFileSync(`${file}.br`, b);
          if (g.length < src.length) fs.writeFileSync(`${file}.gz`, g);
          raw += src.length;
          br += Math.min(b.length, src.length);
        }),
      );
      console.log(`[precompress] ${files.length} files: ${(raw / 1024).toFixed(0)} KB -> ${(br / 1024).toFixed(0)} KB brotli`);
    },
  };
}

export default defineConfig({
  plugins: [legalPages(), precompress()],
  // GitHub Pages serves under /<repo>/; set VITE_BASE=/tudo-bem/ for that build.
  base: process.env.VITE_BASE ?? '/',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/ws': { target: SERVER, ws: true },
      '/healthz': { target: SERVER },
      '/api/conversa': { target: SERVER },
      '/api/auth': { target: SERVER },
      '/api/config': { target: SERVER },
      '/api/feedback': { target: SERVER },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        lifesimFrame: fileURLToPath(new URL('./lifesim-frame.html', import.meta.url)),
      },
    },
  },
});
