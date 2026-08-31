import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // rst-compiler imports shiki only for optional highlighting / language labels.
      // We highlight with highlight.js and stub shiki to keep the browser bundle small.
      shiki: path.resolve(__dirname, 'src/shiki-stub.ts'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        plugin: path.resolve(__dirname, 'plugin.html'),
      },
    },
  },
});
