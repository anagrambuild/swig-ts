import { defineConfig, type Options } from 'tsup';

const entry = {
  browser: 'src/browser.ts',
  client: 'src/client/index.ts',
  core: 'src/core.ts',
  index: 'src/index.ts',
  nest: 'src/nest.ts',
  next: 'src/next.ts',
  server: 'src/server/index.ts',
  'server/fetch': 'src/server/fetch/index.ts',
  'server/nest': 'src/server/nest/index.ts',
  'server/next': 'src/server/next/index.ts',
  'server/typescript': 'src/server/typescript/index.ts',
};

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
    entry,
    dts: {
      entry,
    },
  },
]);
