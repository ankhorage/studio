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
          'src/features/administration/adapters/inbound/StudioAdminAccessGate.tsx',
          'src/features/administration/adapters/inbound/useStudioAdminWorkspace.ts',
          'src/runtime/index.ts',
          'src/runtime/actionSuppression.ts',
          'src/runtime/runtimeActions.ts',
          'src/runtime/useRuntimeAction.ts',
          'src/ui/admin/AnkhAdminPage.tsx',
          'src/ui/AnkhStudio.ts',
          'src/ui/useStudioAppBarAugmentation.ts',
          'src/utils/treeUtils.ts',
        ],
        project: ['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts', 'paradox.config.ts'],
        ignoreFiles: ['paradox.config.ts'],
      },
    },
  }),
};
