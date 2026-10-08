import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// A focused browser entry: the historical React/Electron app is not imported.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  build: {
    target: 'es2020',
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/curious-world/index.ts', import.meta.url)),
      name: 'CuriousPocketWorld',
      formats: ['iife'],
      fileName: () => 'curious-world.js',
    },
    rolldownOptions: { output: { exports: 'named' } },
  },
});
