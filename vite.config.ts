import { defineConfig } from 'vitest/config';

// BUILD_SHA is set by CI (the commit) so the game can show which build is running.
const sha = (process.env.BUILD_SHA || 'dev').slice(0, 7);

export default defineConfig({
  define: { __BUILD__: JSON.stringify(sha) },
  server: {
    port: 5173,
    // In development the rooms server runs on 8790; the client talks to it through Vite.
    proxy: { '/ws': { target: 'ws://localhost:8790', ws: true }, '/api': 'http://localhost:8790' },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'] },
});
