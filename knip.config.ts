import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  workspaces: {
    '.': {
      entry: ['src/index.ts', 'src/app/index.ts'],
      project: ['src/**/*.ts', 'src/**/*.tsx', 'knip.config.ts', 'paradox.config.ts'],
      ignoreFiles: ['paradox.config.ts'],
    },
    'apps/studio': {
      entry: ['app.config.ts', 'babel.config.js', 'index.js', 'src/app/_layout.tsx', 'src/app/index.tsx'],
      project: ['**/*.js', '**/*.ts', '**/*.tsx'],
      ignoreDependencies: ['babel-preset-expo', 'babel-plugin-module-resolver'],
    },
  },
});
