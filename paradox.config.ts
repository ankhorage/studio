import { defineParadoxConfig } from '@ankhorage/paradox';

export default defineParadoxConfig({
  mode: 'write',

  package: {
    root: '.',
    entrypoints: ['src/index.ts', 'src/apm.ts'],
  },

  output: {
    dir: './paradox',
  },
});
