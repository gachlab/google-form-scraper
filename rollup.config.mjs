export default {
  input: 'dist/esm/index.js',
  output: [
    {
      file: 'dist/google-form-scraper.js',
      format: 'iife',
      name: 'GoogleFormsScraper',
      globals: {
        'node-html-parser': 'htmlParser',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  external: ['node-html-parser'],
};
