import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
    rollupOptions: {
      input: {
        index: 'index.html',
        plugin: 'plugin.html',
      },
    },
  },
});
