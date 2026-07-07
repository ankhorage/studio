import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  entry: ['src/root.ts'],
  workspaces: {
    '.': {
      entry: [
        'src/index.ts',
        'src/app/index.ts',
        'src/cli/index.ts',
        // ...
      ],
      project: ['src/**/*.ts', 'src/**/*.tsx', 'paradox.config.ts'],
      ignoreFiles: ['paradox.config.ts'],
    },
    'apps/studio': {
      entry: ['babel.config.js'],
      project: ['**/*.js', '**/*.ts', '**/*.tsx'],
      ignoreDependencies: ['babel-preset-expo', 'babel-plugin-module-resolver'],
    },
  },
});
