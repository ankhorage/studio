import type { AppManifest, NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
import {
  type ExpoRuntimePlan,
  resolveExpoRuntimeLayoutIntegration,
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
  buildNavigatorJsx,
  type BuiltNavigatorJsx,
  getAuthAdapterTs,
  getAuthOAuthCallbackTsx,
  getAuthOAuthRuntimeTs,
  getAuthScreenTsx,
  getAuthSessionTs,
  getIndexRedirectRouteTsx,
  getNestedLayoutTsx,
  getRootLayoutTsx,
  getScreenTsx,
  getSignOutScreenTsx,
} from './templates';

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface LayoutGenerationOptions {
  includeStudio?: boolean;
  runtimePlan?: ExpoRuntimePlan;
}

function getPackageOwnedRuntimeImports(): string {
  return `import {
  createComponentRegistry,
  createRuntimeDataSourceOperationExecutor,
  RuntimeRendererConfigProvider,
  useOptionalManifestContext,
} from '@ankhorage/runtime';
import {
  STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  useRuntimeAction,
} from '@ankhorage/studio/runtime';
import { APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY } from '@/generated/appExtensionRegistry';`;
}

function getGeneratedRuntimeRegistryDeclarations(): string {
  return `const APP_EXTENSION_COMPONENT_REGISTRY = createComponentRegistry(
  STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);`;
}

function mergeRuntimeModuleDeclarations(...declarations: readonly string[]): string {
  return declarations
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .join('\n\n');
}

export class LayoutGenerator {
  generateAll(
    _projectRoot: string,
    manifest: AppManifest,
    mutations: LayoutMutation[],
    options: LayoutGenerationOptions = {},
  ): GeneratedFile[] {
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
          content: getStudioAdminLayoutTsx(),
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
          if (!authScreenPlan?.authMode) {
            return;
          }

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

      if (authLayoutPlan.postSignInRoute !== '/') {
        files.push({
          path: normalizeRel(path.join('src/app/index.tsx')),
          content: getIndexRedirectRouteTsx(authLayoutPlan.postSignInRoute),
        });
      }

      addStudioAdminRouteFiles();

      for (const generatedAuthFile of authLayoutPlan.generatedFiles) {
        files.push({
          path: generatedAuthFile.path,
          content: this.getGeneratedAuthFileContent(generatedAuthFile, authLayoutPlan),
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

  private getAuthShellLayoutContent(
    manifest: AppManifest,
    mutations: LayoutMutation[],
    authLayoutPlan: EnabledAuthLayoutPlan,
    includeStudio: boolean,
    runtimePlan?: ExpoRuntimePlan,
  ): string {
    const studioAdminStackScreen = includeStudio
      ? `
  <Stack.Screen key="ankh" name="ankh" />`
      : '';
    const innerNavigationJsx = `<Stack screenOptions={rootStackScreenOptions}>
  <Stack.Screen key="app" name="(app)" />
  <Stack.Screen key="auth" name="(auth)" />${studioAdminStackScreen}
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

    const pluginImports = mutations.flatMap((m) => m.imports);
    const pluginHooks = mutations.flatMap((m) => m.hooks);
    const runtimeLayoutIntegration = resolveExpoRuntimeLayoutIntegration(runtimePlan);

    const allImports = [
      `import type { AppManifest${includeStudio ? ', NavigatorSpec, RouteDefinition' : ''} } from '@ankhorage/contracts';`,
      ...runtimeLayoutIntegration.imports,
      `import { ${[
        'AppShell',
        'ZoraProvider',
        'ZORA_COMPONENT_REGISTRY',
        'useZoraTheme',
        includeStudio ? 'AppBar' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      `import { Stack, ${includeStudio ? 'useGlobalSearchParams, ' : ''}usePathname, useRootNavigationState, useRouter } from 'expo-router';`,
      `import { StatusBar } from 'expo-status-bar';`,
      `import { useCallback, useEffect, useMemo, useRef, useState } from 'react';`,
      `import { AppState } from 'react-native';`,
      `import { GestureHandlerRootView } from 'react-native-gesture-handler';`,
      `import { SafeAreaProvider } from 'react-native-safe-area-context';`,
      `
import { authAdapter } from '@/auth/adapter';`,
      `import {
  bootstrapAuthSession,
  getStoredAuthSession,
  isAuthenticated,
  refreshAuthSessionIfNeeded,
  subscribeToAuthSessionChanges,
} from '@/auth/session';`,
      getPackageOwnedRuntimeImports(),
      includeStudio
        ? `import { StudioProvider, AnkhStudio, useStudio, useStudioAppBarAugmentation } from '@ankhorage/studio';`
        : '',
      includeStudio
        ? `import { isStudioAdminPath, resolveStudioLastNonAdminLocation, resolveStudioNavigableLocation } from '@ankhorage/studio/studioAdminRouteModel';`
        : '',
      ...pluginImports,
    ]
      .filter(Boolean)
      .join('\n');

    const allHooks = pluginHooks.join('\n  ');

    return getRootLayoutTsx({
      manifest,
      mutations,
      allImports,
      allHooks,
      innerNavigation,
      includeStudio,
      authRuntime: authLayoutPlan,
      initialRouteNameOverride: '(app)',
      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(
        getGeneratedRuntimeRegistryDeclarations(),
        ...runtimeLayoutIntegration.moduleDeclarations,
      ),
      runtimeProviderEnd: [...runtimeLayoutIntegration.providerEnd],
      runtimeProviderStart: [...runtimeLayoutIntegration.providerStart],
      useStoredAuthSessionCredentialResolver: true,
    });
  }

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
        'useZoraTheme',
        includeStudio ? 'AppBar' : '',
        needsZoraTabBar ? 'ZoraTabBar' : '',
        needsZoraDrawerContent ? 'ZoraDrawerContent' : '',
        needsIcon ? 'Icon' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      rootNavigator.type === 'tabs'
        ? `import { Tabs${includeStudio ? ', useGlobalSearchParams, usePathname' : ''} } from 'expo-router';`
        : rootNavigator.type === 'drawer'
          ? `${includeStudio ? `import { useGlobalSearchParams, usePathname } from 'expo-router';\n` : ''}import { Drawer } from 'expo-router/drawer';`
          : `import { Stack${includeStudio ? ', useGlobalSearchParams, usePathname' : ''} } from 'expo-router';`,
      `import { StatusBar } from 'expo-status-bar';`,
      `import React, { useEffect, useMemo, useRef } from 'react';`,
      `import { GestureHandlerRootView } from 'react-native-gesture-handler';`,
      `import { SafeAreaProvider } from 'react-native-safe-area-context';`,
      '',
      getPackageOwnedRuntimeImports(),
      includeStudio
        ? `import { StudioProvider, AnkhStudio, useStudio, useStudioAppBarAugmentation } from '@ankhorage/studio';`
        : '',
      includeStudio
        ? `import { isStudioAdminPath, resolveStudioLastNonAdminLocation, resolveStudioNavigableLocation } from '@ankhorage/studio/studioAdminRouteModel';`
        : '',
    ];

    const pluginImports = mutations.flatMap((m) => m.imports);
    const pluginHooks = mutations.flatMap((m) => m.hooks);

    const allImports = [...coreImports, ...pluginImports]
      .filter((value) => value !== '')
      .join('\n');

    const allHooks = pluginHooks.join('\n  ');

    return getRootLayoutTsx({
      manifest,
      mutations,
      allImports,
      allHooks,
      innerNavigation,
      includeStudio,
      runtimeModuleDeclarations: mergeRuntimeModuleDeclarations(
        getGeneratedRuntimeRegistryDeclarations(),
        ...runtimeLayoutIntegration.moduleDeclarations,
      ),
      runtimeProviderEnd: [...runtimeLayoutIntegration.providerEnd],
      runtimeProviderStart: [...runtimeLayoutIntegration.providerStart],
    });
  }

  private getGeneratedAuthFileContent(
    filePlan: AuthGeneratedFilePlan,
    authLayoutPlan: EnabledAuthLayoutPlan,
  ): string {
    switch (filePlan.kind) {
      case 'adapter':
        return getAuthAdapterTs({
          oauthProviders: authLayoutPlan.oauth?.providers.map((provider) => provider.id),
        });
      case 'session':
        return getAuthSessionTs();
      case 'oauth-runtime':
        if (!authLayoutPlan.oauth) {
          throw new Error('OAuth runtime generation requires an OAuth layout plan.');
        }
        return getAuthOAuthRuntimeTs(authLayoutPlan.oauth);
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

  private getLayoutTemplate(node: NavigatorSpec, manifest: AppManifest, includeStudio: boolean) {
    const navigator = buildNavigatorJsx({ navigator: node, manifest, includeStudio });
    return getNestedLayoutTsx({
      node,
      navigator,
    });
  }
}

function getStudioAdminLayoutTsx(): string {
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

function createStudioAdminRouteGeneratedFiles(appRootRel: string): GeneratedFile[] {
  return STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => ({
    path: normalizeRel(path.join(appRootRel, resolveStudioAdminRouteFilePath(route.id))),
    content: getStudioAdminRouteTsx(route.id),
  }));
}

function resolveStudioAdminRouteFilePath(routeId: StudioAdminRouteId): string {
  const route = getStudioAdminRouteDefinition(routeId);
  const segments = route.path
    .replace(/^\/ankh\/?/u, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? '[id]' : segment));
  const hasChildren = STUDIO_ADMIN_ROUTE_REGISTRY.some(
    (candidate) => candidate.parentId === routeId,
  );

  if (segments.length === 0) {
    return path.join('ankh', 'index.tsx');
  }

  if (hasChildren) {
    return path.join('ankh', ...segments, 'index.tsx');
  }

  const fileName = `${segments[segments.length - 1]}.tsx`;
  return path.join('ankh', ...segments.slice(0, -1), fileName);
}

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

function normalizeRel(p: string) {
  return p.replace(/\\/g, '/');
}

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

  if (normalizedNavigator.type !== 'tabs') {
    return normalizedNavigator;
  }

  const visibleRoutes = normalizedNavigator.routes.filter((route) => route.hideInTabBar !== true);
  const hiddenRoutes = normalizedNavigator.routes.filter((route) => route.hideInTabBar === true);
  if (hiddenRoutes.length === 0) {
    return normalizedNavigator;
  }

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

function prepareRouteForGeneratedRoutes(route: RouteDefinition): RouteDefinition {
  return {
    ...route,
    name: normalizeGeneratedRouteName(route.name),
    ...(route.navigator ? { navigator: prepareNavigatorForGeneratedRoutes(route.navigator) } : {}),
  };
}

function normalizeGeneratedRouteName(routeName: string): string {
  const normalized = routeName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : 'index';
}

function resolveValidGeneratedInitialRouteName(
  initialRouteName: string | undefined,
  routes: readonly RouteDefinition[],
): string {
  const routeNames = new Set(routes.map((route) => route.name));

  if (initialRouteName && routeNames.has(initialRouteName)) {
    return initialRouteName;
  }

  return routes[0]?.name ?? 'index';
}
