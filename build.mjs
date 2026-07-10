// Builds the two distributables from src, matching the shape the previous
// Vite build shipped:
//   - dist/esm/index.js   bundled ESM (self-contained; loadable by native Node
//                          ESM — tsc's multi-file emit uses extensionless
//                          relative imports which "type": "module" rejects)
//   - dist/index.cjs      bundled CommonJS, for bundler/Node consumers
//
// tsc runs separately (--emitDeclarationOnly) to typecheck and emit the .d.ts.
// It replaces vite-plugin-dts, which can't run against the native TS7 compiler
// (no JS API). node-html-parser stays external in both builds.
import esbuild from 'esbuild';

const base = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  platform: 'node',
  target: 'node22',
  external: ['node-html-parser'],
};

await esbuild.build({ ...base, format: 'esm', outfile: 'dist/esm/index.js' });
await esbuild.build({ ...base, format: 'cjs', outfile: 'dist/index.cjs' });
