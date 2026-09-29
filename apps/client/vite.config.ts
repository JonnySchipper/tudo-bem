import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const SERVER = process.env.TB_SERVER ?? 'http://localhost:8787';

export default defineConfig({
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
