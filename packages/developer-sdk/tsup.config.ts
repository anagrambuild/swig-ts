import { defineConfig, type Options } from 'tsup';

const commonCfg: Partial<Options> = {
  splitting: true,
  sourcemap: false,
  clean: true,
  format: ['cjs', 'esm'],
  target: ['esnext'],
};

export default defineConfig([
  {
    ...commonCfg,
    entry: [
      'src/index.ts',
      'src/browser.ts',
      'src/core.ts',
      'src/server.ts',
      'src/server/next.ts',
    ],
    dts: {
      entry: [
        'src/index.ts',
        'src/browser.ts',
        'src/core.ts',
        'src/server.ts',
        'src/server/next.ts',
      ],
    },
  },
]);
