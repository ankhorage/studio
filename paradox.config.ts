import { defineParadoxConfig } from '@ankhorage/paradox';

export default defineParadoxConfig({
  mode: 'write',

  docs: {
    title: '@ankhorage/studio',
    description: 'Standalone Studio authoring package for Ankhorage apps.',
    usage: {
      entrypoints: ['src/cli/index.ts'],
    },
  },

  package: {
    root: '.',
    entrypoints: ['src/index.ts'],
  },

  output: {
    dir: './paradox',
  },
});
