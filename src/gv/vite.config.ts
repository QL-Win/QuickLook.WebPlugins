import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Inline WASM and other binary assets so make-singlefiles.js can produce
    // fully self-contained HTML files without any external asset requests.
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        plugin: path.resolve(__dirname, 'plugin.html'),
      },
    },
  },
});
