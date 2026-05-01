import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts({ rollupTypes: true, outDir: 'dist/esm' })],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'GoogleFormsScraper',
      formats: ['es', 'cjs'],
      fileName: (format) => {
        if (format === 'es') return 'esm/index.js';
        return 'index.cjs.js';
      },
    },
    rollupOptions: {
      external: ['node-html-parser'],
    },
    sourcemap: true,
  },
});
