import type { AppManifest, NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
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
import {
  composeGeneratedImports,
  type GeneratedImportRequirement,
} from './generatedImportComposer';
import {
  buildNavigatorJsx,
  type BuiltNavigatorJsx,
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
  getNestedLayoutTsx,
  getRootLayoutImportRequirements,
  getRootLayoutTsx,
  getScreenTsx,
  getSignOutScreenTsx,
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
  ${includeStudio ? 'createComponentRegistry,\n  ' : ''}createRuntimeApiOperationExecutor,
  ${includeStudio ? '' : 'type RuntimeActionExecutor,\n  '}
  RuntimeRendererConfigProvider,
  useOptionalManifestContext,
} from '@ankhorage/runtime';
${
  includeStudio
    ? `import {
  STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  STUDIO_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
  useRuntimeAction,
} from '@ankhorage/studio/runtime';`
    : `import { executeExpoRuntimeAction } from '@ankhorage/expo-runtime/action-bridge';`
}
import {
  APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,${
    includeStudio
      ? '\n  APP_EXTENSION_INTERACTION_POLICY_SUPPORT as GENERATED_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,'
      : ''
  }
} from '@/generated/appExtensionRegistry';`;

  return runtimeImports;
}

/***
 * Build generated runtime registry declarations for standalone apps or Studio-enabled authoring apps.
 */
function getGeneratedRuntimeRegistryDeclarations(includeStudio: boolean): string {
  if (!includeStudio) {
    return `const APP_EXTENSION_COMPONENT_REGISTRY = GENERATED_APP_EXTENSION_COMPONENT_REGISTRY;

function useGeneratedRuntimeAction() {
  const router = useRouter();
  const { mode, setMode } = useZoraTheme();
  const executeAction = useCallback<RuntimeActionExecutor>(
    ({ action }) =>
      executeExpoRuntimeAction({
        action,
        router: { push: (href) => router.push(href as Href) },
        mode,
        setMode,
      }),
    [mode, router, setMode],
  );
  return { executeAction };
}`;
  }

  return `const APP_EXTENSION_COMPONENT_REGISTRY = createComponentRegistry(
  STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);
const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {
  ...STUDIO_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
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

    const walk = (node: NavigatorSpec, currentRel: string) => {
      if (currentRel !== '') {
        files.push({
          path: normalizeRel(path.join(appRootRel, currentRel, '_layout.tsx')),
          content: this.getLayoutTemplate(node, manifest, includeStudio),
        });
      }

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

      walk(prepareNavigatorForGeneratedRoutes(authLayoutPlan.appNavigator), '(app)');

      if (authLayoutPlan.authNavigator.routes.length > 0) {
        walk(prepareNavigatorForGeneratedRoutes(authLayoutPlan.authNavigator), '(auth)');
      }
    } else {
      files.push({
        path: normalizeRel(path.join('src/app/_layout.tsx')),
        content: this.getRootLayoutContent(manifest, mutations, includeStudio, runtimePlan),
      });

      addStudioAdminRouteFiles();
      walk(prepareNavigatorForGeneratedRoutes(manifest.navigator), '');
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
    const innerNavigation: BuiltNavigatorJsx = {
      declarations: `const rootStackScreenOptions = {
  headerShown: false,
};`,
      jsx: innerNavigationJsx,
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: false,
    };

    const moduleImports = mutations.flatMap((m) => m.imports);
    const moduleHooks = mutations.flatMap((m) => m.hooks);
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);

    const allImports = composeGeneratedImports([
      ...getRootLayoutImportRequirements(includeStudio),
      `import type { AppManifest${includeStudio ? ', NavigatorSpec, RouteDefinition' : ''} } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      `import { ${[
        'AppShell',
        'ZoraProvider',
        'ZORA_COMPONENT_REGISTRY',
        includeStudio ? 'ZORA_COMPONENT_META' : '',
        'useZoraTheme',
        includeStudio ? 'AppBar' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      ...(!includeStudio
        ? [
            {
              source: 'expo-router',
              namedImports: [{ imported: 'Href', typeOnly: true }],
            },
          ]
        : []),
      `import { Stack, ${includeStudio ? 'useGlobalSearchParams, usePathname' : 'useRouter'} } from 'expo-router';`,
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
    const rootNavigator = prepareNavigatorForGeneratedRoutes(manifest.navigator);
    const innerNavigation = buildNavigatorJsx({
      navigator: rootNavigator,
      manifest,
      includeStudio,
    });
    const needsIcon = innerNavigation.usesIcon;
    const needsZoraTabBar = innerNavigation.usesZoraTabBar;
    const needsZoraDrawerContent = innerNavigation.usesZoraDrawerContent;
    const needsZoraNavigationRouteMap = innerNavigation.usesZoraNavigationRouteMap;
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);

    const coreImports = [
      `import type { AppManifest${includeStudio ? ', NavigatorSpec, RouteDefinition' : ''} } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      needsZoraNavigationRouteMap
        ? `import type { ZoraNavigationRouteMap } from '@ankhorage/zora';`
        : '',
      `import { ${[
        'AppShell',
        'ZoraProvider',
        'ZORA_COMPONENT_REGISTRY',
        includeStudio ? 'ZORA_COMPONENT_META' : '',
        'useZoraTheme',
        includeStudio ? 'AppBar' : '',
        needsZoraTabBar ? 'ZoraTabBar' : '',
        needsZoraDrawerContent ? 'ZoraDrawerContent' : '',
        needsIcon ? 'Icon' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      ...(!includeStudio
        ? [
            {
              source: 'expo-router',
              namedImports: [{ imported: 'Href', typeOnly: true }],
            } satisfies GeneratedImportRequirement,
          ]
        : []),
      needsZoraTabBar ? `import type { BottomTabBarProps } from 'expo-router/js-tabs';` : '',
      needsZoraDrawerContent
        ? `import type { DrawerContentComponentProps } from 'expo-router/drawer';`
        : '',
      rootNavigator.type === 'tabs'
        ? `import { ${includeStudio ? 'useGlobalSearchParams, usePathname' : 'useRouter'} } from 'expo-router';\nimport { Tabs } from 'expo-router/js-tabs';`
        : rootNavigator.type === 'drawer'
          ? `import { ${includeStudio ? 'useGlobalSearchParams, usePathname' : 'useRouter'} } from 'expo-router';\nimport { Drawer } from 'expo-router/drawer';`
          : `import { Stack${includeStudio ? ', useGlobalSearchParams, usePathname' : ', useRouter'} } from 'expo-router';`,
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

  /***
   * Generate one nested navigator layout module for a manifest navigator node.
   */
  private getLayoutTemplate(node: NavigatorSpec, manifest: AppManifest, includeStudio: boolean) {
    const navigator = buildNavigatorJsx({ navigator: node, manifest, includeStudio });
    return getNestedLayoutTsx({ node, navigator });
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

/***
 * Normalize a manifest navigator recursively for generated Expo Router routes and lift hidden tab routes behind a stack wrapper when required.
 */
function prepareNavigatorForGeneratedRoutes(navigator: NavigatorSpec): NavigatorSpec {
  const normalizedRoutes = navigator.routes.map((route) => prepareRouteForGeneratedRoutes(route));
  const normalizedInitialRouteName = resolveValidGeneratedInitialRouteName(
    navigator.initialRouteName
      ? normalizeGeneratedRouteName(navigator.initialRouteName)
      : undefined,
    normalizedRoutes,
  );
  const normalizedNavigator: NavigatorSpec = {
    ...navigator,
    ...(normalizedInitialRouteName ? { initialRouteName: normalizedInitialRouteName } : {}),
    routes: normalizedRoutes,
  };

  if (normalizedNavigator.type !== 'tabs') return normalizedNavigator;

  const visibleRoutes = normalizedNavigator.routes.filter(
    (route) => route.showInPrimaryNavigation !== false,
  );
  const hiddenRoutes = normalizedNavigator.routes.filter(
    (route) => route.showInPrimaryNavigation === false,
  );
  if (hiddenRoutes.length === 0) return normalizedNavigator;

  return {
    type: 'stack',
    initialRouteName: '(tabs)',
    routes: [
      {
        name: '(tabs)',
        navigator: {
          ...normalizedNavigator,
          initialRouteName: resolveValidGeneratedInitialRouteName(
            normalizedNavigator.initialRouteName,
            visibleRoutes,
          ),
          routes: visibleRoutes,
        },
      },
      ...hiddenRoutes,
    ],
  };
}

/***
 * Normalize one route name and recursively prepare its nested navigator for generated Expo Router output.
 */
function prepareRouteForGeneratedRoutes(route: RouteDefinition): RouteDefinition {
  return {
    ...route,
    name: normalizeGeneratedRouteName(route.name),
    ...(route.navigator ? { navigator: prepareNavigatorForGeneratedRoutes(route.navigator) } : {}),
  };
}

/***
 * Normalize an Expo Router route name by trimming whitespace and surrounding slashes, falling back to the index route when empty.
 * @utility @ankhorage/utility/route
 */
function normalizeGeneratedRouteName(routeName: string): string {
  const normalized = routeName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : 'index';
}

/***
 * Keep the requested generated initial route when it exists in the route set, otherwise fall back to the first generated route or index.
 */
function resolveValidGeneratedInitialRouteName(
  initialRouteName: string | undefined,
  routes: readonly RouteDefinition[],
): string {
  const routeNames = new Set(routes.map((route) => route.name));
  if (initialRouteName && routeNames.has(initialRouteName)) return initialRouteName;
  return routes[0]?.name ?? 'index';
}
