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
    runtimeModuleDeclarations: `const ZORA_COMPONENT_REGISTRY = {};
const APP_EXTENSION_COMPONENT_REGISTRY = {};
const createComponentRegistry = () => ({});`,
  });

  const registryDeclarationIndex = generated.indexOf('const ZORA_COMPONENT_REGISTRY = {};');
  const registryCompositionIndex = generated.indexOf(
    'const runtimeComponentRegistry = createComponentRegistry(',
  );

  expect(registryDeclarationIndex).toBeGreaterThanOrEqual(0);
  expect(registryCompositionIndex).toBeGreaterThan(registryDeclarationIndex);
  expect(generated).toContain(`const runtimeComponentRegistry = createComponentRegistry(
  ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);`);
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
  expect(generated).toContain(
    '<GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>',
  );
  expect(generated).toContain(
    '<GeneratedZoraProvider theme={activeStudioTheme} initialMode={activeStudioThemeMode}>',
  );
  expect(generated).toContain('function GeneratedZoraThemeConfigSync');
  expect(generated).toContain('const setThemeConfigRef = useRef(setThemeConfig);');
  expect(generated).toContain(
    'const themeConfigSignature = useMemo(() => JSON.stringify(themeConfig)',
  );
  expect(generated).toContain('lastSyncedThemeConfigSignatureRef.current === themeConfigSignature');
  expect(generated).toContain('setThemeConfigRef.current(themeConfig)');
  expect(generated).toContain('}, [themeConfig, themeConfigSignature]);');
  expect(generated).not.toContain('}, [setThemeConfig, themeConfig]);');
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

test('uses layout-neutral selection instrumentation and disables runtime actions outside preview', () => {
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

  expect(generated).toContain('disableActions: !previewMode');
  expect(generated).toContain('wrapNode: wrapStudioRuntimeNode');
  expect(generated).toContain('function wrapStudioRuntimeNode(args: {');
  expect(generated).toContain('function StudioRuntimeNodeWrapper(props: {');
  expect(generated).toContain(
    "const studioSelectionInteractionStyle = { display: 'contents' as const };",
  );
  expect(generated).toContain('<Pressable');
  expect(generated).toContain('style={studioSelectionInteractionStyle}');
  expect(generated).toContain('boxShadow:');
  expect(generated).toContain('style: [props.rendered.props.style, selectionStyle]');
  expect(generated).toContain('onPress: (event: GestureResponderEvent) => {');
  expect(generated).toContain('onPress={(event: GestureResponderEvent) => {');
  expect(generated).not.toContain('borderWidth:');
  expect(generated).not.toContain('(event: unknown)');
});

test('scopes Studio runtime selection config below StudioProvider', () => {
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

  const rootLayoutIndex = generated.indexOf('export default function RootLayout()');
  const studioShellIndex = generated.indexOf('function StudioShell({');
  const rootLayoutSource = generated.slice(rootLayoutIndex, studioShellIndex);
  const studioShellSource = generated.slice(studioShellIndex);

  expect(rootLayoutIndex).toBeGreaterThanOrEqual(0);
  expect(studioShellIndex).toBeGreaterThan(rootLayoutIndex);
  expect(rootLayoutSource).not.toContain('useStudio()');
  expect(rootLayoutSource).not.toContain('disableActions: !previewMode');
  expect(rootLayoutSource).not.toContain('wrapNode: wrapStudioRuntimeNode');
  expect(studioShellSource).toContain('const studioRuntimeConfig = useMemo(');
  expect(studioShellSource).toContain('disableActions: !previewMode');
  expect(studioShellSource).toContain('wrapNode: wrapStudioRuntimeNode');
  expect(studioShellSource).toContain(
    '<RuntimeRendererConfigProvider value={studioRuntimeConfig}>',
  );
  expect(studioShellSource).toContain('const studioOutput = (');
});

test('keeps generated apps Studio-independent when includeStudio is false', () => {
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
  });

  expect(generated).not.toContain('useStudio');
  expect(generated).not.toContain('wrapStudioRuntimeNode');
  expect(generated).not.toContain('selectionStyle');
  expect(generated).not.toContain('Pressable');
  expect(generated).not.toContain('GestureResponderEvent');
  expect(generated).not.toContain('disableActions: !previewMode');
});
