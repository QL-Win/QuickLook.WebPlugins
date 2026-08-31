import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Inline KaTeX font files so single-file / plugin builds stay self-contained
    assetsInlineLimit: 100_000,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        plugin: path.resolve(__dirname, 'plugin.html'),
      },
    },
  },
});
