import type { AppManifest, NavigatorNode, RouteDefinition } from '@ankhorage/contracts';
import type { AppDeployTargets } from '@ankhorage/contracts/deploy';
import {
  type ExpoRuntimePlan,
  resolveExpoRuntimeLayoutIntegration,
  resolveExpoRuntimeNativeSchemeMap,
  resolveExpoRuntimePlan,
} from '@ankhorage/expo-runtime/planning';
import { toPortablePath } from '@ankhorage/utility/node/path';
import path from 'path';

import type { StudioAdminRouteId } from '../../index';
import {
  getStudioAdminRouteDefinition,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../studioAdminRouteModel';
import type { GeneratedFile } from '../../types/project-generation';
import type { LayoutMutation } from '../modules/layout';
import {
  type AuthGeneratedFilePlan,
  type EnabledAuthLayoutPlan,
  resolveAuthLayoutPlan,
} from './auth/resolveAuthLayoutPlan';
import { composeGeneratedImports } from './generatedImportComposer';
import { createNavigatorGenerationBindings } from './navigator/createNavigatorGenerationBindings';
import { generateNavigatorLayoutFiles } from './navigator/generateNavigatorLayoutFiles';
import {
  getAuthAdapterTs,
  getAuthFormTs,
  getAuthNavigationTs,
  getAuthOAuthCallbackTsx,
  getAuthOAuthCompletionTs,
  getAuthOAuthRuntimeTs,
  getAuthOAuthStateTs,
  getAuthScreenControllerTs,
  getAuthScreenRuntimeTsx,
  getAuthScreenTsx,
  getAuthSessionTs,
  getIndexRedirectRouteTsx,
  getRootLayoutImportRequirements,
  getRootLayoutTsx,
  getRootShellImportRequirements,
  getRootShellTsx,
  getRuntimeShellImportRequirements,
  getRuntimeShellTsx,
  getScreenTsx,
  getSignOutScreenTsx,
  getStudioAppHeaderImportRequirements,
  getStudioAppHeaderTsx,
  getStudioShellImportRequirements,
  getStudioShellTsx,
  type RootNavigationContent,
} from './templates';
import { routeNameToHref } from './templates/utils/routes';

export interface GeneratedAppFileGenerationOptions {
  includeStudio?: boolean;
  runtimePlan?: ExpoRuntimePlan;
}

/***
 * Build the generated Runtime component registry declaration from the selected published ZORA registry.
 */
function getGeneratedRuntimeRegistryDeclarations(zoraComponentRegistry: string): string {
  return `const APP_COMPONENT_REGISTRY = createComponentRegistry(
  ${zoraComponentRegistry},
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);`;
}

/*** Resolve the published ZORA runtime entrypoint and component registry from the canonical Expo capability plan. */
function resolveZoraRuntimeImports(runtimePlan: ExpoRuntimePlan): {
  readonly componentRegistry: 'ZORA_COMPONENT_REGISTRY' | 'ZORA_BASE_COMPONENT_REGISTRY';
  readonly entrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free';
} {
  const requiresReader = runtimePlan.capabilities.some(
    (requirement) => requirement.capability === 'ebookReader',
  );
  return requiresReader
    ? { componentRegistry: 'ZORA_COMPONENT_REGISTRY', entrypoint: '@ankhorage/zora' }
    : {
        componentRegistry: 'ZORA_BASE_COMPONENT_REGISTRY',
        entrypoint: '@ankhorage/zora/reader-free',
      };
}

/*** Generate the standalone application's capability executor from published owner descriptors. */
function getGeneratedRuntimeCapabilityExecutorTs(): string {
  return `import { CAPABILITIES as EXPO_RUNTIME_CAPABILITIES } from '@ankhorage/expo-runtime/capabilities';
import type {
  ExpoRuntimeCapabilityHandler,
  ExpoRuntimeCapabilityHandlerArgs,
} from '@ankhorage/expo-runtime/capability-bridge';
import { executeExpoRuntimeCapabilityAsync } from '@ankhorage/expo-runtime/capability-bridge';
import { CAPABILITIES as NAVIGATOR_CAPABILITIES } from '@ankhorage/navigator/capabilities';
import type {
  RuntimeCapabilityExecutionResult,
  RuntimeCapabilityExecutor,
} from '@ankhorage/runtime';
import { CAPABILITIES as SURFACE_CAPABILITIES } from '@ankhorage/surface/capabilities';

type GeneratedRuntimeHostCapability =
  | (typeof NAVIGATOR_CAPABILITIES)[number]
  | (typeof SURFACE_CAPABILITIES)[number]
  | (typeof EXPO_RUNTIME_CAPABILITIES)[number];

export interface GeneratedRuntimeCapabilityHost {
  readonly alert?: (message: string) => void;
  readonly navigate?: (input: unknown) => void;
  readonly setThemeMode?: (input: unknown) => void;
}

/*** Create the generated app executor from the published Expo Runtime, Navigator and Surface capability descriptors. */
export function createGeneratedRuntimeCapabilityExecutor(
  host: GeneratedRuntimeCapabilityHost,
): RuntimeCapabilityExecutor {
  return async ({ capability, input }): Promise<RuntimeCapabilityExecutionResult> => {
    const ownerCapability = findGeneratedRuntimeOwnerCapability(capability);
    if (!ownerCapability) return missingGeneratedRuntimeCapability(capability);
    if (!isGeneratedRuntimeHostInputValid(ownerCapability, input)) {
      return invalidGeneratedRuntimeHostInput(ownerCapability.id);
    }

    const result = await executeExpoRuntimeCapabilityAsync({
      alertImpl: host.alert,
      capability: ownerCapability,
      capabilityHandlers: createGeneratedRuntimeCapabilityHandlers(host),
      input,
    });

    return result.ok
      ? { data: null, ok: true }
      : {
          diagnostics: result.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            severity: 'error' as const,
          })),
          ok: false,
        };
  };
}

/*** Resolve a capability descriptor from its published Expo Runtime, Navigator or Surface owner. */
function findGeneratedRuntimeOwnerCapability(
  capability: string,
): GeneratedRuntimeHostCapability | undefined {
  return [...EXPO_RUNTIME_CAPABILITIES, ...NAVIGATOR_CAPABILITIES, ...SURFACE_CAPABILITIES].find(
    (candidate) => candidate.id === capability,
  );
}

/*** Validate host input with the schema semantics published by Navigator and Surface. */
function isGeneratedRuntimeHostInputValid(
  capability: GeneratedRuntimeHostCapability,
  input: unknown,
): boolean {
  if (capability.id === 'navigator.navigate') return isNavigatorNavigateInput(input);
  if (capability.id === 'theme.setMode') return isThemeSetModeInput(input);
  return true;
}

/*** Validate Navigator's published navigator.navigate object schema before the Router host runs. */
function isNavigatorNavigateInput(input: unknown): boolean {
  if (!isPlainRecord(input) || typeof input.route !== 'string') return false;
  return input.params === undefined || isPlainRecord(input.params);
}

/*** Validate Surface's published theme.setMode object schema before the theme host runs. */
function isThemeSetModeInput(input: unknown): boolean {
  return (
    isPlainRecord(input) &&
    Object.keys(input).length === 1 &&
    (input.mode === 'dark' || input.mode === 'light')
  );
}

/*** Identify serializable object input without accepting arrays or inherited host values. */
function isPlainRecord(input: unknown): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

/*** Create the Expo Runtime handler list from the generated app's available host callbacks. */
function createGeneratedRuntimeCapabilityHandlers(
  host: GeneratedRuntimeCapabilityHost,
): readonly ExpoRuntimeCapabilityHandler[] {
  return [
    ...(host.navigate === undefined
      ? []
      : [
          {
            capabilityId: 'navigator.navigate' as const,
            execute: ({ input }: ExpoRuntimeCapabilityHandlerArgs) => host.navigate?.(input),
          },
        ]),
    ...(host.setThemeMode === undefined
      ? []
      : [
          {
            capabilityId: 'theme.setMode' as const,
            execute: ({ input }: ExpoRuntimeCapabilityHandlerArgs) => host.setThemeMode?.(input),
          },
        ]),
  ];
}

/*** Report a capability that has no generated runtime-host executor. */
function missingGeneratedRuntimeCapability(capability: string): RuntimeCapabilityExecutionResult {
  return {
    diagnostics: [
      {
        code: 'missing-operation',
        message: \`Capability '\${capability}' has no generated application executor.\`,
        severity: 'error',
      },
    ],
    ok: false,
  };
}

/*** Report input rejected at the published Navigator or Surface schema boundary. */
function invalidGeneratedRuntimeHostInput(capability: string): RuntimeCapabilityExecutionResult {
  return {
    diagnostics: [
      {
        code: 'invalid-capability-input',
        message: \`Capability '\${capability}' received input that does not satisfy its published owner schema.\`,
        severity: 'error',
      },
    ],
    ok: false,
  };
}
`;
}

/***
 * Trim, discard empty and join generated module-level declaration blocks with a blank line.
 * Utility candidate: @ankhorage/utility/string
 */
function mergeRuntimeModuleDeclarations(...declarations: readonly string[]): string {
  return declarations
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .join('\n\n');
}

/***
 * Generate the complete current file set for one Studio-managed app from its manifest, layout mutations and runtime plan.
 * Follow-up: Move generated-app file orchestration out of the generic host/layout bucket into the projects/template generation owner.
 */
export class GeneratedAppFileGenerator {
  static readonly runtimeRevision = '2';

  /***
   * Walk the manifest navigators and compose root layouts, nested layouts, screens, auth runtime files and Studio admin routes into the generated project file set.
   */
  generateFiles(
    _projectRoot: string,
    manifest: AppManifest,
    mutations: LayoutMutation[],
    options: GeneratedAppFileGenerationOptions = {},
  ): GeneratedFile[] {
    const targets = manifest.deploy?.targets;
    if (!targets) {
      throw new Error(
        `Project '${manifest.metadata.slug}' is missing canonical deploy.targets generation state.`,
      );
    }
    const files: GeneratedFile[] = [];
    const { includeStudio = true, runtimePlan } = options;
    const resolvedRuntimePlan = runtimePlan ?? resolveExpoRuntimePlan(manifest);
    const zoraRuntimeImports = resolveZoraRuntimeImports(resolvedRuntimePlan);
    if (!includeStudio) {
      files.push({
        path: 'src/generated/runtimeCapabilityExecutor.ts',
        content: getGeneratedRuntimeCapabilityExecutorTs(),
      });
    }
    const authLayoutPlan = resolveAuthLayoutPlan({ manifest });
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(resolvedRuntimePlan);
    const authScreenPlansByPath = new Map(
      authLayoutPlan.authScreenFiles.map((file) => [file.path, file] as const),
    );

    const appRootRel = 'src/app';

    files.push({
      path: 'src/generated/runtimeShell.tsx',
      content: getRuntimeShellTsx({
        imports: composeGeneratedImports([
          ...getRuntimeShellImportRequirements(
            includeStudio,
            zoraRuntimeImports.entrypoint,
            authLayoutPlan.enabled,
          ),
          zoraRuntimeImports.componentRegistry === 'ZORA_COMPONENT_REGISTRY'
            ? `import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';`
            : `import { ZORA_BASE_COMPONENT_REGISTRY } from '@ankhorage/zora/registry';`,
        ]),
        includeStudio,
        runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(
          getGeneratedRuntimeRegistryDeclarations(zoraRuntimeImports.componentRegistry),
          ...runtimeLayoutIntegration.moduleDeclarations,
        ),
        useStoredAuthSessionCredentialResolver: authLayoutPlan.enabled,
        zoraEntrypoint: zoraRuntimeImports.entrypoint,
      }),
    });

    if (includeStudio) {
      files.push({
        path: 'src/generated/studioAppHeader.tsx',
        content: getStudioAppHeaderTsx(
          composeGeneratedImports(
            getStudioAppHeaderImportRequirements(zoraRuntimeImports.entrypoint),
          ),
        ),
      });
      files.push({
        path: 'src/generated/studioShell.tsx',
        content: getStudioShellTsx({
          imports: composeGeneratedImports(
            getStudioShellImportRequirements(
              zoraRuntimeImports.entrypoint,
              zoraRuntimeImports.componentRegistry,
            ),
          ),
          zoraComponentRegistry: zoraRuntimeImports.componentRegistry,
        }),
      });
    }
    files.push({
      path: 'src/generated/rootShell.tsx',
      content: getRootShellTsx(
        composeGeneratedImports(getRootShellImportRequirements(zoraRuntimeImports.entrypoint)),
      ),
    });

    const addStudioAdminRouteFiles = () => {
      if (!includeStudio) return;
      files.push(
        {
          path: toPortablePath(path.join(appRootRel, 'ankh', '_layout.tsx')),
          content: getStudioAdminLayoutTsx(),
        },
        ...createStudioAdminRouteGeneratedFiles(appRootRel),
      );
    };

    const walk = (node: NavigatorNode, currentRel: string) => {
      if (!Array.isArray(node.routes)) return;

      node.routes.forEach((route: RouteDefinition) => {
        const segment = route.name;
        const nextRel = currentRel ? path.join(currentRel, segment) : segment;

        if (route.navigator) {
          walk(route.navigator, nextRel);
          return;
        }

        const fileName = `${route.path === '/' ? 'index' : path.basename(nextRel)}.tsx`;
        const dirRel = path.dirname(nextRel);
        const targetDirRel = dirRel === '.' ? '' : dirRel;
        const targetPath = toPortablePath(path.join(appRootRel, targetDirRel, fileName));

        if (authLayoutPlan.enabled && authScreenPlansByPath.has(targetPath)) {
          const authScreenPlan = authScreenPlansByPath.get(targetPath);
          if (!authScreenPlan?.authMode) return;

          files.push({
            path: targetPath,
            content: getAuthScreenTsx({
              initialMode: authScreenPlan.authMode,
              screenName: authScreenPlan.authMode === 'signUp' ? 'SignUp' : 'SignIn',
              title: authScreenPlan.authMode === 'signUp' ? 'Sign up' : 'Sign in',
              signInRoute: authLayoutPlan.signInRoute,
              signUpRoute: authLayoutPlan.signUpRoute,
              postSignInRoute: authLayoutPlan.postSignInRoute,
              signInIdentifiers: manifest.infra.environments.local.auth?.signIn?.identifiers ?? [
                'email',
              ],
              signUpRequiredFields: manifest.infra.environments.local.auth?.signUp
                ?.requiredFields ?? ['email', 'password'],
              signUpOptionalFields:
                manifest.infra.environments.local.auth?.signUp?.optionalFields ?? [],
              signUpPolicy:
                manifest.infra.environments.local.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
              oauthProviders: authLayoutPlan.oauth?.providers,
            }),
          });
          return;
        }

        if (!route.screenId) return;

        const screenDef = manifest.screens[route.screenId];
        if (!screenDef) return;

        files.push({
          path: targetPath,
          content: getScreenTsx({
            screenId: route.screenId,
            screenDef,
            zoraEntrypoint: zoraRuntimeImports.entrypoint,
          }),
        });
      });
    };

    const navigatorRoots = authLayoutPlan.enabled
      ? [
          {
            navigator: authLayoutPlan.appNavigator,
            rootDirectory: 'src/app/(app)',
            externalHeaderVisible: includeStudio,
          },
          ...(authLayoutPlan.authNavigator.routes.length > 0
            ? [
                {
                  navigator: authLayoutPlan.authNavigator,
                  rootDirectory: 'src/app/(auth)',
                  externalHeaderVisible: false,
                },
              ]
            : []),
        ]
      : [
          {
            navigator: manifest.navigator,
            rootDirectory: 'src/app/(app)',
            externalHeaderVisible: includeStudio,
          },
        ];
    const navigatorBindings = createNavigatorGenerationBindings({
      authEnabled: authLayoutPlan.enabled,
      manifest,
      roots: navigatorRoots,
    });
    files.push(...navigatorBindings.files);
    for (const root of navigatorRoots) {
      files.push(
        ...generateNavigatorLayoutFiles({
          ...root,
          bindings: navigatorBindings.bindings,
          targets,
        }),
      );
    }

    if (authLayoutPlan.enabled) {
      files.push({
        path: toPortablePath(path.join('src/app/_layout.tsx')),
        content: this.getAuthShellLayoutContent(
          manifest,
          mutations,
          authLayoutPlan,
          includeStudio,
          resolvedRuntimePlan,
          zoraRuntimeImports,
        ),
      });

      const postSignInHref = routeNameToHref(authLayoutPlan.postSignInRoute);
      if (postSignInHref !== '/') {
        files.push({
          path: toPortablePath(path.join('src/app/index.tsx')),
          content: getIndexRedirectRouteTsx(postSignInHref),
        });
      }

      addStudioAdminRouteFiles();

      for (const generatedAuthFile of authLayoutPlan.generatedFiles) {
        files.push({
          path: generatedAuthFile.path,
          content: this.getGeneratedAuthFileContent(
            generatedAuthFile,
            authLayoutPlan,
            manifest,
            targets,
            zoraRuntimeImports.entrypoint,
          ),
        });
      }

      walk(authLayoutPlan.appNavigator, '(app)');

      if (authLayoutPlan.authNavigator.routes.length > 0) {
        walk(authLayoutPlan.authNavigator, '(auth)');
      }
    } else {
      files.push({
        path: toPortablePath(path.join('src/app/_layout.tsx')),
        content: this.getRootLayoutContent(
          manifest,
          mutations,
          includeStudio,
          resolvedRuntimePlan,
          zoraRuntimeImports,
        ),
      });

      addStudioAdminRouteFiles();
      walk(manifest.navigator, '(app)');
    }

    return files;
  }

  /***
   * Generate the authenticated root shell with protected app/auth/Admin routes and the canonical generated auth runtime files.
   */
  private getAuthShellLayoutContent(
    manifest: AppManifest,
    mutations: LayoutMutation[],
    authLayoutPlan: EnabledAuthLayoutPlan,
    includeStudio: boolean,
    runtimePlan: ExpoRuntimePlan,
    zoraRuntimeImports: ReturnType<typeof resolveZoraRuntimeImports>,
  ): string {
    const studioAdminStackScreen = includeStudio
      ? `
      <Stack.Protected guard={canAccessStudioAdmin}>
        <Stack.Screen key="ankh" name="ankh" />
      </Stack.Protected>`
      : '';
    const oauthCallbackStackScreen = authLayoutPlan.oauth
      ? `
      <Stack.Screen key="oauth-callback" name="${authLayoutPlan.oauth.callbackRouteName}" />`
      : '';
    const innerNavigationJsx = `<Stack screenOptions={rootStackScreenOptions}>
      <Stack.Protected guard={authState === 'authenticated'}>
        <Stack.Screen key="app" name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={authState === 'unauthenticated'}>
        <Stack.Screen key="auth" name="(auth)" />
      </Stack.Protected>${oauthCallbackStackScreen}${studioAdminStackScreen}
    </Stack>`;
    const innerNavigation: RootNavigationContent = {
      declarations: `const rootStackScreenOptions = {
  headerShown: false,
};`,
      jsx: innerNavigationJsx,
      usesTheme: false,
    };

    const moduleImports = mutations.flatMap((m) => m.imports);
    const moduleHooks = mutations.flatMap((m) => m.hooks);
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);

    const coreImports = [
      ...getRootLayoutImportRequirements(includeStudio),
      `import type { AppManifest } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      `import { ${[
        'AppShell',
        includeStudio ? 'ZORA_COMPONENT_META' : '',
        includeStudio ? 'ZORA_BINDABLE_COMPONENT_META' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '${zoraRuntimeImports.entrypoint}';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      `import { Stack } from 'expo-router';`,
      `import { useEffect } from 'react';`,
      `import { type GeneratedAuthNavigationState, ${
        includeStudio ? 'shouldMountAuthenticatedAppHeader, ' : ''
      }useGeneratedAuthNavigation } from '@/auth/navigation';`,
      `import { useOptionalManifestContext } from '@ankhorage/runtime';`,
      includeStudio
        ? `import { StudioProvider } from '@ankhorage/studio/core/StudioProvider';
import { AnkhStudio } from '@ankhorage/studio/ui/AnkhStudio';
import { StudioShell } from '@/generated/studioShell';`
        : '',
      `import { GeneratedRootShell, GeneratedStatusBar, GeneratedThemeShell, resolveManifestActiveTheme, resolveThemeMode } from '@/generated/rootShell';`,
      `import { ${includeStudio ? 'GeneratedRuntimeShell, bundledMediaRegistry, runtimeComponentRegistry' : 'GeneratedRuntimeShell'} } from '@/generated/runtimeShell';`,
      includeStudio
        ? `import { isStudioAdminPath, resolveStudioNavigableLocation } from '@ankhorage/studio/studioAdminRouteModel';`
        : '',
      ...moduleImports,
    ].filter((entry) => entry !== '');
    const allImports = composeGeneratedImports(coreImports);

    const allHooks = moduleHooks.join('\n  ');

    return getRootLayoutTsx({
      manifest,
      mutations,
      allImports,
      allHooks,
      innerNavigation,
      includeStudio,
      authRuntime: authLayoutPlan,
      initialRouteNameOverride: '(app)',
      runtimeProviderEnd: [...runtimeLayoutIntegration.providerEnd],
      runtimeProviderStart: [...runtimeLayoutIntegration.providerStart],
    });
  }

  /***
   * Generate the unauthenticated root layout by composing navigator requirements, runtime integration and optional Studio authoring imports.
   */
  private getRootLayoutContent(
    manifest: AppManifest,
    mutations: LayoutMutation[],
    includeStudio: boolean,
    runtimePlan: ExpoRuntimePlan,
    zoraRuntimeImports: ReturnType<typeof resolveZoraRuntimeImports>,
  ): string {
    const innerNavigation: RootNavigationContent = {
      declarations: '',
      jsx: '<Slot />',
      usesTheme: false,
    };
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);

    const coreImports = [
      `import type { AppManifest } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      `import { ${[
        'AppShell',
        includeStudio ? 'ZORA_COMPONENT_META' : '',
        includeStudio ? 'ZORA_BINDABLE_COMPONENT_META' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '${zoraRuntimeImports.entrypoint}';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      `import { Slot${includeStudio ? ', usePathname' : ''} } from 'expo-router';`,
      includeStudio ? `import { useEffect } from 'react';` : '',
      `import { useOptionalManifestContext } from '@ankhorage/runtime';`,
      includeStudio
        ? `import { StudioProvider } from '@ankhorage/studio/core/StudioProvider';
import { AnkhStudio } from '@ankhorage/studio/ui/AnkhStudio';
import { StudioShell } from '@/generated/studioShell';`
        : '',
      `import { GeneratedRootShell, GeneratedStatusBar, GeneratedThemeShell, resolveManifestActiveTheme, resolveThemeMode } from '@/generated/rootShell';`,
      `import { ${includeStudio ? 'GeneratedRuntimeShell, bundledMediaRegistry, runtimeComponentRegistry' : 'GeneratedRuntimeShell'} } from '@/generated/runtimeShell';`,
      includeStudio
        ? `import { isStudioAdminPath, resolveStudioNavigableLocation } from '@ankhorage/studio/studioAdminRouteModel';`
        : '',
    ].filter((entry): entry is string => entry.length > 0);

    const moduleImports = mutations.flatMap((m) => m.imports);
    const moduleHooks = mutations.flatMap((m) => m.hooks);

    const allImports = composeGeneratedImports([
      ...getRootLayoutImportRequirements(includeStudio),
      ...coreImports,
      ...moduleImports,
    ]);
    const allHooks = moduleHooks.join('\n  ');

    return getRootLayoutTsx({
      manifest,
      mutations,
      allImports,
      allHooks,
      innerNavigation,
      includeStudio,
      initialRouteNameOverride: '(app)',
      runtimeProviderEnd: [...runtimeLayoutIntegration.providerEnd],
      runtimeProviderStart: [...runtimeLayoutIntegration.providerStart],
    });
  }

  /***
   * Render one planned generated auth file through the canonical auth template for its plan kind.
   */
  private getGeneratedAuthFileContent(
    filePlan: AuthGeneratedFilePlan,
    authLayoutPlan: EnabledAuthLayoutPlan,
    manifest: AppManifest,
    targets: AppDeployTargets,
    zoraEntrypoint: '@ankhorage/zora' | '@ankhorage/zora/reader-free',
  ): string {
    switch (filePlan.kind) {
      case 'adapter':
        return getAuthAdapterTs({
          oauthProviders: authLayoutPlan.oauth?.providers.map((provider) => provider.id),
        });
      case 'form':
        return getAuthFormTs({ zoraEntrypoint });
      case 'navigation':
        return getAuthNavigationTs(authLayoutPlan);
      case 'session':
        return getAuthSessionTs();
      case 'oauth-runtime':
        if (!authLayoutPlan.oauth) {
          throw new Error('OAuth runtime generation requires an OAuth layout plan.');
        }
        return getAuthOAuthRuntimeTs({
          ...authLayoutPlan.oauth,
          nativeSchemes: resolveExpoRuntimeNativeSchemeMap(targets),
          zoraEntrypoint,
        });
      case 'oauth-completion':
        if (!authLayoutPlan.oauth) {
          throw new Error('OAuth completion generation requires an OAuth layout plan.');
        }
        return getAuthOAuthCompletionTs({
          callbackRoute: authLayoutPlan.oauth.callbackRoute,
          nativeSchemes: resolveExpoRuntimeNativeSchemeMap(targets),
        });
      case 'oauth-state':
        return getAuthOAuthStateTs();
      case 'screen-runtime':
        return getAuthScreenRuntimeTsx({
          signInRoute: authLayoutPlan.signInRoute,
          signUpRoute: authLayoutPlan.signUpRoute,
          postSignInRoute: authLayoutPlan.postSignInRoute,
          signInIdentifiers: manifest.infra.environments.local.auth?.signIn?.identifiers ?? [
            'email',
          ],
          signUpRequiredFields: manifest.infra.environments.local.auth?.signUp?.requiredFields ?? [
            'email',
            'password',
          ],
          signUpOptionalFields:
            manifest.infra.environments.local.auth?.signUp?.optionalFields ?? [],
          signUpPolicy:
            manifest.infra.environments.local.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
          oauthProviders: authLayoutPlan.oauth?.providers,
          zoraEntrypoint,
        });
      case 'screen-controller':
        return getAuthScreenControllerTs({
          signInRoute: authLayoutPlan.signInRoute,
          signUpRoute: authLayoutPlan.signUpRoute,
          postSignInRoute: authLayoutPlan.postSignInRoute,
          signInIdentifiers: manifest.infra.environments.local.auth?.signIn?.identifiers ?? [
            'email',
          ],
          signUpRequiredFields: manifest.infra.environments.local.auth?.signUp?.requiredFields ?? [
            'email',
            'password',
          ],
          signUpOptionalFields:
            manifest.infra.environments.local.auth?.signUp?.optionalFields ?? [],
          signUpPolicy:
            manifest.infra.environments.local.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
          oauthProviders: authLayoutPlan.oauth?.providers,
          zoraEntrypoint,
        });
      case 'oauth-callback':
        return getAuthOAuthCallbackTsx({
          signInRoute: authLayoutPlan.signInRoute,
          postSignInRoute: authLayoutPlan.postSignInRoute,
          zoraEntrypoint,
        });
      case 'sign-out':
        return getSignOutScreenTsx({ zoraEntrypoint });
      default:
        throw new Error(`Unsupported generated auth file kind: ${filePlan.kind}`);
    }
  }
}

/***
 * Generate the complete Studio Admin route file set from the canonical Admin route registry.
 */
function createStudioAdminRouteGeneratedFiles(appRootRel: string): GeneratedFile[] {
  return STUDIO_ADMIN_ROUTE_REGISTRY.flatMap((route) => {
    const routePath = resolveStudioAdminRouteFilePath(route.id);
    return [
      {
        path: toPortablePath(path.join(appRootRel, routePath)),
        content: getStudioAdminNativeRouteTsx(),
      },
      {
        path: toPortablePath(path.join(appRootRel, toWebRouteFilePath(routePath))),
        content: getStudioAdminWebRouteTsx(route.id),
      },
    ];
  });
}

/***
 * Resolve a canonical Studio Admin route definition to its generated Expo Router file path, preserving parent routes as index modules and dynamic parameters as bracket segments.
 */
function resolveStudioAdminRouteFilePath(routeId: StudioAdminRouteId): string {
  const route = getStudioAdminRouteDefinition(routeId);
  const segments = route.path
    .replace(/^\/ankh\/?/u, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? `[${segment.slice(1)}]` : segment));
  const hasChildren = STUDIO_ADMIN_ROUTE_REGISTRY.some(
    (candidate) => candidate.parentId === routeId,
  );

  if (segments.length === 0) return path.join('ankh', 'index.tsx');
  if (hasChildren) return path.join('ankh', ...segments, 'index.tsx');

  const fileName = `${segments[segments.length - 1]}.tsx`;
  return path.join('ankh', ...segments.slice(0, -1), fileName);
}

/*** Convert a generated route file path to Expo Router's web-specific module variant. */
function toWebRouteFilePath(routePath: string): string {
  return routePath.replace(/\.tsx$/u, '.web.tsx');
}

/*** Generate the native fallback for Studio Admin routes without importing Web/host administration modules. */
function getStudioAdminNativeRouteTsx(): string {
  return `import { Redirect } from 'expo-router';

export default function AnkhAdminNativeRoute() {
  return <Redirect href="/" />;
}
`;
}

/*** Generate the protected Studio Admin layout that loads administration workspace code only after the route is rendered. */
function getStudioAdminLayoutTsx(): string {
  return `import { Redirect, Slot } from 'expo-router';
import { lazy, Suspense } from 'react';

const StudioAdminWorkspace = lazy(async () => {
  const [{ WorkspaceNavigator }, { StudioAdminAccessGate, useStudioAdminWorkspace }] =
    await Promise.all([import('@ankhorage/navigator/workspace'), import('@ankhorage/studio')]);

  function StudioAdminWorkspaceContent() {
    const workspace = useStudioAdminWorkspace();
    return (
      <StudioAdminAccessGate>
        <WorkspaceNavigator {...workspace} />
      </StudioAdminAccessGate>
    );
  }

  return { default: StudioAdminWorkspaceContent };
});

export default function AnkhAdminLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Suspense fallback={<Slot />}>
      <StudioAdminWorkspace />
    </Suspense>
  );
}
`;
}

/*** Generate the Web-only Studio Admin route that loads page presentation only after the protected route renders. */
function getStudioAdminWebRouteTsx(routeName: StudioAdminRouteId): string {
  return `import { Redirect } from 'expo-router';
import { lazy, Suspense } from 'react';

const AnkhAdminPage = lazy(async () => {
  const module = await import('@ankhorage/studio');
  return { default: module.AnkhAdminPage };
});

export default function AnkhAdminWebRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Suspense fallback={null}>
      <AnkhAdminPage routeId="${routeName}" />
    </Suspense>
  );
}
`;
}
