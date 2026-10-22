/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'SpheraPlayer',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'sphera-player.es.js' : 'sphera-player.umd.cjs',
    },
    rollupOptions: {
      external: ['three', 'hls.js'],
      output: {
        globals: { three: 'THREE', 'hls.js': 'Hls' },
      },
    },
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
