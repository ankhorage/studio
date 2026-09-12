import { defineParadoxConfig } from '@ankhorage/paradox';

export default defineParadoxConfig({
  mode: 'write',

  docs: {
    usage: {
      description: [
        'For local Studio development, run:',
        '',
        '```bash',
        'bun dev',
        '```',
        '',
        'This starts both the local Studio host and the first-party Studio web app.',
      ].join('\n'),
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
