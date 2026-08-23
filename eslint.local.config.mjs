import { createConfig } from '@ankhorage/devtools/eslint';

const SCRIPT_FILES = ['scripts/**/*.ts'];
const STUDIO_FILES = ['src/**/*.{ts,tsx}', ...SCRIPT_FILES];

function legacyRuleExceptions(rule, files) {
  return { files, rules: { [rule]: 'off' } };
}

export default [
  {
    ignores: ['apps/**'],
  },
  ...createConfig({
    files: SCRIPT_FILES,
    profile: 'base',
    project: ['./tsconfig.json'],
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    files: STUDIO_FILES,
    rules: {
      complexity: [
        'error',
        {
          max: 100,
        },
      ],
      'max-lines': [
        'error',
        {
          max: 5000,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'error',
        {
          max: 1000,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
  legacyRuleExceptions('@typescript-eslint/no-misused-promises', [
    'src/app/CreateCategoriesScreen.tsx',
    'src/app/CreateCategoryTemplatesScreen.tsx',
    'src/app/CreateProjectFromTemplateScreen.tsx',
    'src/app/ProjectDetailScreen.tsx',
    'src/app/ProjectsOverviewScreen.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/no-unsafe-argument', [
    'src/ui/admin/pages/SecretsAdminPage.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/no-unsafe-assignment', [
    'src/app/CreateCategoriesScreen.tsx',
    'src/app/CreateProjectFromTemplateScreen.tsx',
    'src/app/ProjectDetailScreen.tsx',
    'src/app/ProjectsOverviewScreen.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/no-unnecessary-condition', [
    'src/ui/admin/pages/SecretsAdminPage.tsx',
    'src/ui/admin/pages/bindings/EventBindingComposer.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/no-unnecessary-type-assertion', [
    'src/ui/admin/pages/AuthAdminPage.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/prefer-destructuring', [
    'src/ui/admin/ModuleAdminViewHost.tsx',
    'src/ui/admin/pages/MediaAdminPage.tsx',
    'src/ui/admin/pages/OverviewAdminPage.tsx',
    'src/ui/admin/pages/ScreensAdminPage.tsx',
    'src/ui/admin/pages/ThemeRecipeAdminPage.tsx',
    'src/ui/admin/pages/deploy/DeploySummaryGrid.tsx',
    'src/ui/admin/pages/deploy/DeployTargetsCard.tsx',
    'src/ui/canvas/StudioCanvasDndOverlay.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/prefer-nullish-coalescing', [
    'src/ui/admin/pages/AuthAdminPage.tsx',
  ]),
  legacyRuleExceptions('@typescript-eslint/prefer-optional-chain', [
    'src/ui/admin/pages/ThemeRecipeAdminPage.tsx',
    'src/ui/admin/pages/deploy/DeployMonetizationSyncCard.tsx',
    'src/ui/admin/pages/deploy/DeployReleaseOperationsCard.tsx',
  ]),
  legacyRuleExceptions('react-hooks/refs', [
    'src/ui/admin/AuthAdminSession.tsx',
    'src/ui/admin/pages/AuthAdminPage.tsx',
  ]),
  legacyRuleExceptions('react-hooks/set-state-in-effect', [
    'src/ui/StudioInsertDialog.tsx',
    'src/ui/admin/pages/ModuleDetailAdminPage.tsx',
    'src/ui/admin/pages/ModulesAdminPage.tsx',
    'src/ui/admin/pages/PropertiesAdminPage.tsx',
    'src/ui/admin/pages/SecretsAdminPage.tsx',
    'src/ui/admin/pages/bindings/EventBindingComposer.tsx',
    'src/ui/admin/pages/deploy/DeployListingLocaleAuthoringCard.tsx',
    'src/ui/admin/pages/deploy/DeployMonetizationAuthoringCard.tsx',
    'src/ui/admin/pages/deploy/DeployPreparedReleaseAuthoringCard.tsx',
    'src/ui/canvas/StudioCanvasDndOverlay.tsx',
  ]),
  legacyRuleExceptions('react-native/no-unused-styles', [
    'src/app/workspace/WorkspacePrimitives.tsx',
    'src/ui/admin/adminPagePrimitives.tsx',
    'src/ui/admin/pages/ExternalApiAdminPrimitives.tsx',
  ]),
  legacyRuleExceptions('react-native/no-inline-styles', [
    'src/app/StudioApp.tsx',
    'src/app/workspace/WorkspacePrimitives.tsx',
    'src/ui/StudioInsertDialog.tsx',
    'src/ui/admin/AnkhAdminShell.tsx',
    'src/ui/admin/pages/MediaPropertyInput.tsx',
    'src/ui/admin/pages/SecretsAdminPage.tsx',
    'src/ui/admin/pages/ThemeModeEditorSelector.tsx',
    'src/ui/admin/pages/ThemeRecipeAdminPage.tsx',
    'src/ui/canvas/StudioCanvasDndOverlay.tsx',
  ]),
  legacyRuleExceptions('security/detect-object-injection', [
    'src/app/workspace/WorkspacePrimitives.tsx',
    'src/ui/admin/AnkhAdminPage.tsx',
    'src/ui/admin/pages/ApiOperationsCard.tsx',
    'src/ui/admin/pages/BindingsAdminPage.tsx',
    'src/ui/admin/pages/PropertiesAdminPage.tsx',
    'src/ui/admin/pages/ThemeNumericTokensAdminPage.tsx',
    'src/ui/admin/pages/ThemeRecipeAdminPage.tsx',
    'src/ui/admin/pages/ThemeTypographyHeadingEditor.tsx',
    'src/ui/admin/pages/ThemeTypographySizeEditor.tsx',
    'src/ui/admin/pages/ThemeTypographyWeightEditor.tsx',
    'src/ui/admin/pages/bindings/EventBindingComposer.tsx',
  ]),
  legacyRuleExceptions('simple-import-sort/imports', [
    'src/app/CreateCategoryTemplatesScreen.tsx',
    'src/app/CreateProjectFromTemplateScreen.tsx',
    'src/ui/StudioInsertDialog.tsx',
    'src/ui/admin/pages/ApiOperationsCard.tsx',
    'src/ui/admin/pages/AuthAdminPage.tsx',
    'src/ui/admin/pages/ExternalApiConnectCard.tsx',
    'src/ui/admin/pages/ManualRestApiCard.tsx',
    'src/ui/admin/pages/ModuleDetailAdminPage.tsx',
    'src/ui/admin/pages/ModulesAdminPage.tsx',
    'src/ui/admin/pages/ScreensAdminPage.tsx',
    'src/ui/admin/pages/SecretsAdminPage.tsx',
    'src/ui/admin/pages/ThemeRecipeAdminPage.tsx',
    'src/ui/admin/pages/bindings/PropertyBindingsCard.tsx',
    'src/ui/admin/pages/deploy/DeployStoreAssetAuthoringCard.tsx',
    'src/ui/canvas/StudioCanvasDndOverlay.tsx',
  ]),
  legacyRuleExceptions('unused-imports/no-unused-imports', [
    'src/ui/admin/pages/AuthAdminPage.tsx',
  ]),
  legacyRuleExceptions('unused-imports/no-unused-vars', [
    'src/ui/admin/pages/PropertiesAdminPage.tsx',
  ]),
];
