import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5230 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
