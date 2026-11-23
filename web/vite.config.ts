import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps the build portable: works at /PulsePlay/app/, at a domain root, or on any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
