import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { rewriteLegalRequestUrl } from '../server/src/legalPages';

const SERVER = process.env.TB_SERVER ?? 'http://localhost:8787';

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
