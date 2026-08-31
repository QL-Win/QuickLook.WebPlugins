import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Inline all assets so make-singlefiles.js can produce
    // fully self-contained HTML files without any external asset requests.
    assetsInlineLimit: 100_000_000,
    // Silence the bundle-size warning — single-file output is intentionally large.
    chunkSizeWarningLimit: 10_000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        plugin: path.resolve(__dirname, 'plugin.html'),
      },
    },
  },
  // Ensure process.env shims are available for excalidraw
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@excalidraw/excalidraw'],
  },
});
