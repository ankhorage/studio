import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { getRootLayoutTsx } from './rootLayout';

test('declares generated runtime registries before composing them', () => {
  const generated = getRootLayoutTsx({
    manifest: {
      navigator: {
        initialRouteName: 'index',
      },
    } as unknown as AppManifest,
    mutations: [],
    allImports: '',
    allHooks: '',
    innerNavigation: {
      declarations: '',
      jsx: '<></>',
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: false,
    },
    includeStudio: false,
    runtimeModuleDeclarations: `const APP_EXTENSION_COMPONENT_REGISTRY = {};
const ZORA_COMPONENT_REGISTRY = {};`,
  });

  const registryDeclarationIndex = generated.indexOf('const ZORA_COMPONENT_REGISTRY = {};');
  const registryCompositionIndex = generated.indexOf('const runtimeComponentRegistry = {');

  expect(registryDeclarationIndex).toBeGreaterThanOrEqual(0);
  expect(registryCompositionIndex).toBeGreaterThan(registryDeclarationIndex);
});

test('initializes the Studio provider with the runtime manifest', () => {
  const generated = getRootLayoutTsx({
    manifest: {
      navigator: {
        initialRouteName: 'index',
      },
    } as unknown as AppManifest,
    mutations: [],
    allImports: '',
    allHooks: '',
    innerNavigation: {
      declarations: '',
      jsx: '<></>',
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: false,
    },
    includeStudio: true,
    authRuntime: {
      signInRoute: 'sign-in',
      signInRouteName: 'sign-in',
      signUpRoute: 'sign-up',
      signUpRouteName: 'sign-up',
      postSignInRoute: 'products',
      publicRoutes: ['sign-in', 'sign-up'],
    },
  });

  expect(generated).toContain('initialManifest={runtimeManifest}');
  expect(generated).toContain('const appRouteSearchParams = useGlobalSearchParams();');
  expect(generated).toContain('const appLocation = useMemo(');
  expect(generated).toContain('resolveStudioLastNonAdminLocation({');
  expect(generated).toContain('setLastNonAdminLocation(nextAppLocation)');
  expect(generated).toContain('if (nextAppLocation) setLastNonAdminLocation(nextAppLocation)');
  expect(generated).toContain('const shouldMountAppHeader =');
  expect(generated).toContain('!isStudioAdminPath(appPathname) &&');
  expect(generated).not.toContain('studioAppBar.overlay');
  expect(generated).toContain(
    '<GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>',
  );
  expect(generated).toContain(
    '<GeneratedZoraProvider theme={activeStudioTheme} initialMode={activeStudioThemeMode}>',
  );
  expect(generated).toContain('function GeneratedZoraThemeConfigSync');
  expect(generated).toContain('setThemeConfig(themeConfig)');
  expect(generated).toContain('<GeneratedStatusBar />');
});

test('suppresses the normal Studio app header inside admin routes without auth runtime', () => {
  const generated = getRootLayoutTsx({
    manifest: {
      navigator: {
        initialRouteName: 'index',
      },
    } as unknown as AppManifest,
    mutations: [],
    allImports: '',
    allHooks: '',
    innerNavigation: {
      declarations: '',
      jsx: '<></>',
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: false,
    },
    includeStudio: true,
  });

  expect(generated).toContain('const shouldMountAppHeader =');
  expect(generated).toContain('!isStudioAdminPath(appPathname) &&');
  expect(generated).toContain('true;');
});
