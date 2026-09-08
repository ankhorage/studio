import type { AppManifest, NavigatorNode, RouteDefinition } from '@ankhorage/contracts';
import type { AppDeployTargets } from '@ankhorage/contracts/deploy';
import {
  type ExpoRuntimePlan,
  resolveExpoRuntimeLayoutIntegration,
  resolveExpoRuntimeNativeSchemeMap,
} from '@ankhorage/expo-runtime/planning';
import path from 'path';

import type { StudioAdminRouteId } from '../../index';
import {
  getStudioAdminRouteDefinition,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../studioAdminRouteModel';
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
  getScreenTsx,
  getSignOutScreenTsx,
  type RootNavigationContent,
} from './templates';
import { routeNameToHref } from './templates/utils/routes';

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GeneratedAppFileGenerationOptions {
  includeStudio?: boolean;
  runtimePlan?: ExpoRuntimePlan;
}

/***
 * Build the generated root-layout imports that bridge Runtime, Expo Runtime and optional Studio authoring ownership.
 */
function getPackageOwnedRuntimeImports(includeStudio: boolean): string {
  const runtimeImports = `import {
  createComponentRegistry,
  createRuntimeApiOperationExecutor,
  ${includeStudio ? '' : 'type RuntimeActionExecutor,\n  '}
  RuntimeRendererConfigProvider,
  useOptionalManifestContext,
} from '@ankhorage/runtime';
${
  includeStudio
    ? `import {
  STUDIO_ZORA_PLUGIN_CATALOG,
  useRuntimeAction,
} from '@ankhorage/studio/runtime';`
    : `import { executeExpoRuntimeAction } from '@ankhorage/expo-runtime/action-bridge';`
}
import {
  APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
  ${includeStudio ? 'APP_EXTENSION_INTERACTION_POLICY_SUPPORT as GENERATED_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,' : ''}
  ${includeStudio ? '' : 'APP_ZORA_PLUGINS as GENERATED_APP_ZORA_PLUGINS,'}
} from '@/generated/appExtensionRegistry';`;

  return runtimeImports;
}

/***
 * Build generated runtime registry declarations for standalone apps or Studio-enabled authoring apps.
 */
function getGeneratedRuntimeRegistryDeclarations(includeStudio: boolean): string {
  if (!includeStudio) {
    return `const APP_ZORA_PLUGIN_CATALOG = composeZoraPlugins([
  ZORA_CORE_PLUGIN,
  ...GENERATED_APP_ZORA_PLUGINS,
]);
const APP_COMPONENT_REGISTRY = createComponentRegistry(
  APP_ZORA_PLUGIN_CATALOG.componentRegistry,
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);

function useGeneratedRuntimeAction() {
  const router = useRouter();
  const { mode, setMode } = useZoraTheme();
  const executeAction = useCallback<RuntimeActionExecutor>(
    ({ action }) =>
      executeExpoRuntimeAction({
        action,
        router: {
          push: (href) => router.push(href as Href),
        },
        mode,
        setMode,
      }),
    [mode, router, setMode],
  );
  return { executeAction };
}`;
  }

  return `const APP_COMPONENT_REGISTRY = createComponentRegistry(
  STUDIO_ZORA_PLUGIN_CATALOG.componentRegistry,
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);
const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {
  ...STUDIO_ZORA_PLUGIN_CATALOG.interactionPolicySupportedComponents,
  ...GENERATED_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
} as const;`;
}

/***
 * Trim, discard empty and join generated module-level declaration blocks with a blank line.
 * @utility @ankhorage/utility/string
 */
function mergeRuntimeModuleDeclarations(...declarations: readonly string[]): string {
  return declarations
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .join('\n\n');
}

/***
 * Generate the complete current file set for one Studio-managed app from its manifest, layout mutations and runtime plan.
 * @todo Move generated-app file orchestration out of the generic host/layout bucket into the projects/template generation owner.
 */
export class GeneratedAppFileGenerator {
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
    const authLayoutPlan = resolveAuthLayoutPlan({ manifest });
    const authScreenPlansByPath = new Map(
      authLayoutPlan.authScreenFiles.map((file) => [file.path, file] as const),
    );

    const appRootRel = 'src/app';

    const addStudioAdminRouteFiles = () => {
      if (!includeStudio) return;

      files.push(
        {
          path: normalizeRel(path.join(appRootRel, 'ankh', '_layout.tsx')),
          content: getStudioAdminLayoutTsx(authLayoutPlan.enabled),
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

        const fileName = `${path.basename(nextRel)}.tsx`;
        const dirRel = path.dirname(nextRel);
        const targetDirRel = dirRel === '.' ? '' : dirRel;
        const targetPath = normalizeRel(path.join(appRootRel, targetDirRel, fileName));

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
              signInIdentifiers: manifest.infra.auth?.signIn?.identifiers ?? ['email'],
              signUpRequiredFields: manifest.infra.auth?.signUp?.requiredFields ?? [
                'email',
                'password',
              ],
              signUpOptionalFields: manifest.infra.auth?.signUp?.optionalFields ?? [],
              signUpPolicy: manifest.infra.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
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
          content: getScreenTsx({ screenId: route.screenId, screenDef }),
        });
      });
    };

    const navigatorRoots = authLayoutPlan.enabled
      ? [
          { navigator: authLayoutPlan.appNavigator, rootDirectory: 'src/app/(app)' },
          ...(authLayoutPlan.authNavigator.routes.length > 0
            ? [{ navigator: authLayoutPlan.authNavigator, rootDirectory: 'src/app/(auth)' }]
            : []),
        ]
      : [{ navigator: manifest.navigator, rootDirectory: 'src/app/(app)' }];
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
        path: normalizeRel(path.join('src/app/_layout.tsx')),
        content: this.getAuthShellLayoutContent(
          manifest,
          mutations,
          authLayoutPlan,
          includeStudio,
          runtimePlan,
        ),
      });

      const postSignInHref = routeNameToHref(authLayoutPlan.postSignInRoute);
      if (postSignInHref !== '/') {
        files.push({
          path: normalizeRel(path.join('src/app/index.tsx')),
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
          ),
        });
      }

      walk(authLayoutPlan.appNavigator, '(app)');

      if (authLayoutPlan.authNavigator.routes.length > 0) {
        walk(authLayoutPlan.authNavigator, '(auth)');
      }
    } else {
      files.push({
        path: normalizeRel(path.join('src/app/_layout.tsx')),
        content: this.getRootLayoutContent(manifest, mutations, includeStudio, runtimePlan),
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
    runtimePlan?: ExpoRuntimePlan,
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

    const allImports = composeGeneratedImports([
      ...getRootLayoutImportRequirements(includeStudio),
      `import type { AppManifest${includeStudio ? ', NavigatorNode, RouteDefinition' : ''} } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      `import { ${[
        'AppShell',
        'ZoraProvider',
        includeStudio ? '' : 'composeZoraPlugins',
        includeStudio ? '' : 'ZORA_CORE_PLUGIN',
        'useZoraTheme',
        includeStudio ? 'AppBar' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      `import { Stack, ${includeStudio ? 'useGlobalSearchParams, usePathname' : 'type Href, useRouter'} } from 'expo-router';`,
      `import { StatusBar } from 'expo-status-bar';`,
      `import { useEffect, useMemo } from 'react';`,
      `import { GestureHandlerRootView } from 'react-native-gesture-handler';`,
      `import { SafeAreaProvider } from 'react-native-safe-area-context';`,
      `import { type GeneratedAuthNavigationState, ${
        includeStudio ? 'shouldMountAuthenticatedAppHeader, ' : ''
      }useGeneratedAuthNavigation } from '@/auth/navigation';`,
      `import { getStoredAuthSession } from '@/auth/session';`,
      getPackageOwnedRuntimeImports(includeStudio),
      includeStudio
        ? `import { StudioProvider, AnkhStudio, useStudio, useStudioAppBarAugmentation } from '@ankhorage/studio';`
        : '',
      includeStudio
        ? `import { isStudioAdminPath, resolveStudioLastNonAdminLocation, resolveStudioNavigableLocation } from '@ankhorage/studio/studioAdminRouteModel';`
        : '',
      includeStudio
        ? `import { resolveScreenIdForPathname } from '@ankhorage/studio/routeUtils';`
        : '',
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
      authRuntime: authLayoutPlan,
      initialRouteNameOverride: '(app)',
      runtimeActionHookName: includeStudio ? undefined : 'useGeneratedRuntimeAction',
      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(
        getGeneratedRuntimeRegistryDeclarations(includeStudio),
        ...runtimeLayoutIntegration.moduleDeclarations,
      ),
      runtimeProviderEnd: [...runtimeLayoutIntegration.providerEnd],
      runtimeProviderStart: [...runtimeLayoutIntegration.providerStart],
      useStoredAuthSessionCredentialResolver: true,
    });
  }

  /***
   * Generate the unauthenticated root layout by composing navigator requirements, runtime integration and optional Studio authoring imports.
   */
  private getRootLayoutContent(
    manifest: AppManifest,
    mutations: LayoutMutation[],
    includeStudio: boolean,
    runtimePlan?: ExpoRuntimePlan,
  ): string {
    const innerNavigation: RootNavigationContent = {
      declarations: '',
      jsx: '<Slot />',
      usesTheme: false,
    };
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);

    const coreImports = [
      `import type { AppManifest${includeStudio ? ', NavigatorNode, RouteDefinition' : ''} } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      `import { ${[
        'AppShell',
        'ZoraProvider',
        includeStudio ? '' : 'composeZoraPlugins',
        includeStudio ? '' : 'ZORA_CORE_PLUGIN',
        'useZoraTheme',
        includeStudio ? 'AppBar' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      `import { Slot${includeStudio ? ', useGlobalSearchParams, usePathname' : ', type Href, useRouter'} } from 'expo-router';`,
      `import { StatusBar } from 'expo-status-bar';`,
      `import React, { ${includeStudio ? 'useEffect, ' : ''}useMemo } from 'react';`,
      `import { GestureHandlerRootView } from 'react-native-gesture-handler';`,
      `import { SafeAreaProvider } from 'react-native-safe-area-context';`,
      getPackageOwnedRuntimeImports(includeStudio),
      includeStudio
        ? `import { StudioProvider, AnkhStudio, useStudio, useStudioAppBarAugmentation } from '@ankhorage/studio';`
        : '',
      includeStudio
        ? `import { isStudioAdminPath, resolveStudioLastNonAdminLocation, resolveStudioNavigableLocation } from '@ankhorage/studio/studioAdminRouteModel';`
        : '',
      includeStudio
        ? `import { resolveScreenIdForPathname } from '@ankhorage/studio/routeUtils';`
        : '',
    ];

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
      runtimeActionHookName: includeStudio ? undefined : 'useGeneratedRuntimeAction',
      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(
        getGeneratedRuntimeRegistryDeclarations(includeStudio),
        ...runtimeLayoutIntegration.moduleDeclarations,
      ),
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
  ): string {
    switch (filePlan.kind) {
      case 'adapter':
        return getAuthAdapterTs({
          oauthProviders: authLayoutPlan.oauth?.providers.map((provider) => provider.id),
        });
      case 'form':
        return getAuthFormTs();
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
          signInIdentifiers: manifest.infra.auth?.signIn?.identifiers ?? ['email'],
          signUpRequiredFields: manifest.infra.auth?.signUp?.requiredFields ?? [
            'email',
            'password',
          ],
          signUpOptionalFields: manifest.infra.auth?.signUp?.optionalFields ?? [],
          signUpPolicy: manifest.infra.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
          oauthProviders: authLayoutPlan.oauth?.providers,
        });
      case 'screen-controller':
        return getAuthScreenControllerTs({
          signInRoute: authLayoutPlan.signInRoute,
          signUpRoute: authLayoutPlan.signUpRoute,
          postSignInRoute: authLayoutPlan.postSignInRoute,
          signInIdentifiers: manifest.infra.auth?.signIn?.identifiers ?? ['email'],
          signUpRequiredFields: manifest.infra.auth?.signUp?.requiredFields ?? [
            'email',
            'password',
          ],
          signUpOptionalFields: manifest.infra.auth?.signUp?.optionalFields ?? [],
          signUpPolicy: manifest.infra.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
          oauthProviders: authLayoutPlan.oauth?.providers,
        });
      case 'oauth-callback':
        return getAuthOAuthCallbackTsx({
          signInRoute: authLayoutPlan.signInRoute,
          postSignInRoute: authLayoutPlan.postSignInRoute,
        });
      case 'sign-out':
        return getSignOutScreenTsx();
      default:
        throw new Error(`Unsupported generated auth file kind: ${filePlan.kind}`);
    }
  }
}

/***
 * Generate the Studio Admin route-group layout, redirecting when generated global auth is unavailable and guarding production builds from the development Admin shell.
 */
function getStudioAdminLayoutTsx(hasGeneratedGlobalAuth: boolean): string {
  if (!hasGeneratedGlobalAuth) {
    return `import { Redirect } from 'expo-router';

export default function AnkhLayout() {
  return <Redirect href="/" />;
}
`;
  }

  return `import { AnkhAdminShell } from '@ankhorage/studio';
import { Redirect } from 'expo-router';

export default function AnkhLayout() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <AnkhAdminShell />;
}
`;
}

/***
 * Generate the complete Studio Admin route file set from the canonical Admin route registry.
 */
function createStudioAdminRouteGeneratedFiles(appRootRel: string): GeneratedFile[] {
  return STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => ({
    path: normalizeRel(path.join(appRootRel, resolveStudioAdminRouteFilePath(route.id))),
    content: getStudioAdminRouteTsx(route.id),
  }));
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

/***
 * Generate one Studio Admin Expo Router module that development-gates and renders the requested Admin route.
 */
function getStudioAdminRouteTsx(routeName: StudioAdminRouteId): string {
  return `import { AnkhAdminPage } from '@ankhorage/studio';
import { Redirect } from 'expo-router';

export default function AnkhAdminRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <AnkhAdminPage routeId="${routeName}" />;
}
`;
}

/***
 * Normalize a relative filesystem path to forward-slash separators for generated project files.
 * @utility @ankhorage/utility/path
 */
function normalizeRel(p: string) {
  return p.replace(/\\/g, '/');
}
