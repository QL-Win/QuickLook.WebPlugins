import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    // Prefer the browser build of @asciidoctor/core
    conditions: ['browser', 'import', 'module', 'default'],
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Asciidoctor browser bundle is large; silence noisy size warnings
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        plugin: path.resolve(__dirname, 'plugin.html'),
      },
    },
  },
  // Stub Node builtins that the browser build still references for include:: I/O
  optimizeDeps: {
    exclude: [],
  },
});
