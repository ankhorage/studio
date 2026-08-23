import { createKnipConfig } from '@ankhorage/devtools/knip';

export default {
  ...createKnipConfig({
    workspaces: {
      '.': {
        entry: [
          'src/root.ts',
          'src/index.ts',
          'src/app/index.ts',
          'src/cli/index.ts',
          'src/host/index.ts',
          'src/core/StudioContext.ts',
          'src/core/StudioProvider.ts',
          'src/core/studioPackageBoundary.ts',
          'src/runtime/index.ts',
          'src/runtime/actionSuppression.ts',
          'src/runtime/appExtensionRegistry.ts',
          'src/runtime/registry.tsx',
          'src/runtime/runtimeActions.ts',
          'src/runtime/useRuntimeAction.ts',
          'src/ui/AnkhStudio.ts',
          'src/ui/useStudioAppBarAugmentation.ts',
          'src/utils/treeUtils.ts',
        ],
        project: ['src/**/*.ts', 'src/**/*.tsx', 'paradox.config.ts'],
        ignoreFiles: ['paradox.config.ts'],
      },
      'apps/studio': {
        project: ['**/*.ts', '**/*.tsx'],
        ignoreDependencies: [
          '@react-native-vector-icons/fontawesome',
          '@react-native-vector-icons/fontawesome5',
          '@react-native-vector-icons/fontawesome6',
          '@react-native-vector-icons/ionicons',
          'expo-updates',
        ],
      },
    },
  }),
  ignoreWorkspaces: ['apps/nutrition'],
};
