import type { AppManifest, NavigatorSpec, RouteDefinition } from '@ankhorage/contracts';
import {
  type ExpoRuntimePlan,
  resolveExpoRuntimeLayoutIntegration,
} from '@ankhorage/expo-runtime/planning';
import path from 'path';

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

const SUPABASE_LOCAL_PORT_BASE = 55320;
const SUPABASE_LOCAL_PORT_BUCKET_SIZE = 10;
const SUPABASE_LOCAL_PORT_BUCKET_COUNT = 1000;
const SUPABASE_LOCAL_PORT_REFERENCE_PROJECT = 'my-app';
const DEFAULT_NAMESPACE = 'ankh-app';

function getPackageOwnedRuntimeImports(): string {
  return `import {
  createRuntimeDataSourceOperationExecutor,
  RuntimeRendererConfigProvider,
  useOptionalManifestContext,
} from '@ankhorage/runtime';
import {
  APP_EXTENSION_COMPONENT_REGISTRY as STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  createComponentRegistry,
  useRuntimeAction,
  ZORA_COMPONENT_REGISTRY as STUDIO_ZORA_COMPONENT_REGISTRY,
} from '@ankhorage/studio/runtime';
import { APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY } from '@/generated/appExtensionRegistry';`;
}

function getGeneratedRuntimeRegistryDeclarations(): string {
  return `const APP_EXTENSION_COMPONENT_REGISTRY = {
  ...STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  ...GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
};
const ZORA_COMPONENT_REGISTRY = createComponentRegistry(
  STUDIO_ZORA_COMPONENT_REGISTRY,
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
        {
          path: normalizeRel(path.join(appRootRel, 'ankh', 'apis.tsx')),
          content: getStudioAdminRouteTsx('apis'),
        },
        {
          path: normalizeRel(path.join(appRootRel, 'ankh', 'auth.tsx')),
          content: getStudioAdminRouteTsx('auth'),
        },
        {
          path: normalizeRel(path.join(appRootRel, 'ankh', 'properties', '[id].tsx')),
          content: getStudioAdminRouteTsx('properties'),
        },
        {
          path: normalizeRel(path.join(appRootRel, 'ankh', 'secrets.tsx')),
          content: getStudioAdminRouteTsx('secrets'),
        },
        {
          path: normalizeRel(path.join(appRootRel, 'ankh', 'theme.tsx')),
          content: getStudioAdminRouteTsx('theme'),
        },
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
              signInIdentifiers: manifest.infra.auth?.signIn?.identifiers ?? ['email'],
              signUpRequiredFields: manifest.infra.auth?.signUp?.requiredFields ?? [
                'email',
                'password',
              ],
              signUpOptionalFields: manifest.infra.auth?.signUp?.optionalFields ?? [],
              signUpPolicy: manifest.infra.auth?.signUp?.signUpPolicy ?? 'autoSignIn',
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
          content: this.getGeneratedAuthFileContent(generatedAuthFile, authLayoutPlan, manifest),
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
      `import { ${['AppShell', 'ZoraProvider', includeStudio ? 'AppBar' : '']
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      `import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';`,
      `import { StatusBar } from 'expo-status-bar';`,
      `import { useCallback, useEffect, useMemo, useState } from 'react';`,
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
    const needsTheme = innerNavigation.usesTheme;
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
        includeStudio ? 'AppBar' : '',
        needsZoraTabBar ? 'ZoraTabBar' : '',
        needsZoraDrawerContent ? 'ZoraDrawerContent' : '',
        needsTheme ? 'useZoraTheme' : '',
        needsIcon ? 'Icon' : '',
      ]
        .filter(Boolean)
        .join(', ')} } from '@ankhorage/zora';`,
      `import ankhConfig from '@root/ankh.config.json';`,
      rootNavigator.type === 'tabs'
        ? `import { Tabs${includeStudio ? ', usePathname' : ''} } from 'expo-router';`
        : rootNavigator.type === 'drawer'
          ? `${includeStudio ? `import { usePathname } from 'expo-router';\n` : ''}import { Drawer } from 'expo-router/drawer';`
          : `import { Stack${includeStudio ? ', usePathname' : ''} } from 'expo-router';`,
      `import { StatusBar } from 'expo-status-bar';`,
      `import React, { useMemo } from 'react';`,
      `import { GestureHandlerRootView } from 'react-native-gesture-handler';`,
      `import { SafeAreaProvider } from 'react-native-safe-area-context';`,
      '',
      getPackageOwnedRuntimeImports(),
      includeStudio
        ? `import { StudioProvider, AnkhStudio, useStudio, useStudioAppBarAugmentation } from '@ankhorage/studio';`
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
    manifest: AppManifest,
  ): string {
    switch (filePlan.kind) {
      case 'adapter':
        return getAuthAdapterTs({
          localSupabaseUrl: resolveGeneratedLocalSupabaseUrl(manifest),
        });
      case 'session':
        return getAuthSessionTs();
      case 'sign-out':
        return getSignOutScreenTsx();
      default:
        return getAuthSessionTs();
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
  return `import { Stack } from 'expo-router';

export default function AnkhLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
`;
}

type StudioAdminGeneratedRouteName = 'apis' | 'auth' | 'properties' | 'secrets' | 'theme';

function getStudioAdminRouteTsx(routeName: StudioAdminGeneratedRouteName): string {
  const titleByRouteName = {
    apis: 'APIs',
    auth: 'Auth',
    properties: 'Properties',
    secrets: 'Secrets',
    theme: 'Theme',
  } satisfies Record<StudioAdminGeneratedRouteName, string>;
  const title = titleByRouteName[routeName];

  return `export default function Ankh${title}Route() {
  return null;
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

function resolveGeneratedLocalSupabaseUrl(manifest: AppManifest): string {
  const namespace = resolveMinikubeNamespace(manifest);
  const port = resolveSupabaseLocalApiPort(namespace);
  return `http://127.0.0.1:${port}`;
}

function resolveMinikubeNamespace(manifest: AppManifest): string {
  const domain = manifest.infra.networking?.domain?.trim();
  const slug = manifest.metadata.slug.trim();
  const source = firstNonEmptyString(domain, slug) ?? DEFAULT_NAMESPACE;
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const safe = normalized.slice(0, 63).replace(/-+$/g, '');
  return firstNonEmptyString(safe) ?? DEFAULT_NAMESPACE;
}

function firstNonEmptyString(...values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0);
}

function resolveSupabaseLocalApiPort(namespace: string): number {
  return (
    SUPABASE_LOCAL_PORT_BASE +
    resolveSupabaseLocalPortBucket(namespace) * SUPABASE_LOCAL_PORT_BUCKET_SIZE +
    1
  );
}

function resolveSupabaseLocalPortBucket(namespace: string): number {
  const rawBucket = hashProjectId(namespace) - hashProjectId(SUPABASE_LOCAL_PORT_REFERENCE_PROJECT);
  return (rawBucket + SUPABASE_LOCAL_PORT_BUCKET_COUNT) % SUPABASE_LOCAL_PORT_BUCKET_COUNT;
}

function hashProjectId(value: string): number {
  const source = value.trim().length > 0 ? value.trim() : 'app';
  let hash = 0;

  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) % SUPABASE_LOCAL_PORT_BUCKET_COUNT;
  }

  return hash;
}
