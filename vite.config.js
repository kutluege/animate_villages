import { defineConfig } from 'vite';

// Kök web/ ; veri web/public/data/ altından /data/*.json olarak sunulur.
// Port 5174 sabit (5173 başka oturumun) — doluysa başka porta kaçmaz, hata verir.
export default defineConfig({
  root: 'web',
  server: { port: 5174, strictPort: true, host: '127.0.0.1' },
  preview: { port: 5174, strictPort: true, host: '127.0.0.1' },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
});
