import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  entry: [
    'src/index.ts',
    'src/app/index.ts',
    'apps/studio/app.config.ts',
    'apps/studio/babel.config.js',
    'apps/studio/index.js',
    'apps/studio/src/app/_layout.tsx',
    'apps/studio/src/app/index.tsx',
  ],
  project: [
    'src/**/*.ts',
    'src/**/*.tsx',
    'apps/studio/**/*.js',
    'apps/studio/**/*.ts',
    'apps/studio/**/*.tsx',
    'knip.config.ts',
    'paradox.config.ts',
  ],
  ignoreDependencies: ['babel-preset-expo', 'babel-plugin-module-resolver', '@types/react'],
  ignoreFiles: ['.prettierrc.cjs', 'eslint.config.mjs', 'paradox.config.ts'],
});
