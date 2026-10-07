import { fileURLToPath } from 'node:url';
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

export default defineConfig({
  plugins: [legalPages()],
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
