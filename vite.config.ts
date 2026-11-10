import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  // Project Pages live under /Sandbox3d/; relative production assets work there
  // and in the local static preview of dist without hard-coding the repository name.
  base: mode === 'production' ? './' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    target: 'es2022',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    reportCompressedSize: true,
    rollupOptions: {
      input: 'app.html',
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
}));
