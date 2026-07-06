import { createKnipConfig } from '@ankhorage/devtools/knip';

export default createKnipConfig({
  workspaces: {
    '.': {
      entry: [
        'src/index.ts',
        'src/app/index.ts',
        'src/core/StudioContext.ts',
        'src/core/StudioProvider.ts',
        'src/core/studioPackageBoundary.ts',
        'src/ui/AnkhStudio.ts',
        'src/ui/useStudioAppBarAugmentation.ts',
        'src/utils/treeUtils.ts',
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
