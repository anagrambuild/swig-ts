import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: ['node20'],
  platform: 'node',
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  bundle: true,
  noExternal: [
    '@swig-wallet/classic',
    '@swig-wallet/lib',
    '@swig-wallet/coder',
    '@swig-wallet/paymaster-classic',
    '@swig-wallet/paymaster-core',
    '@swig-wallet/api',
  ],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
