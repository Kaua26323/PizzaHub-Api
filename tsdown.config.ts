import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main/server.ts'],

  outDir: 'dist',

  format: 'esm',
  platform: 'node',

  target: 'node22',

  fixedExtension: false,

  clean: true,
  sourcemap: true,
  minify: false,

  dts: false,

  deps: {
    neverBundle: true,
  },
});
