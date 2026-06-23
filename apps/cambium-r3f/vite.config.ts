import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/three/')) return 'vendor-three';
          if (id.includes('/@react-three/')) return 'vendor-r3f';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
          if (id.includes('/coolshapes-react/')) return 'vendor-coolshapes';
          return 'vendor';
        },
      },
    },
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
