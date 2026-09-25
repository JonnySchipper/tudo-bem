import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const SERVER = process.env.TB_SERVER ?? 'http://localhost:8787';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/ws': { target: SERVER, ws: true },
      '/healthz': { target: SERVER },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        art: fileURLToPath(new URL('./art.html', import.meta.url)),
      },
    },
  },
});
