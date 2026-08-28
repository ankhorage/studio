import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { getRootLayoutImportRequirements, getRootLayoutTsx } from './rootLayout';

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
`,
  });

  const registryDeclarationIndex = generated.indexOf('const ZORA_COMPONENT_REGISTRY = {};');
  const registryCompositionIndex = generated.indexOf('const runtimeComponentRegistry = {');

  expect(registryDeclarationIndex).toBeGreaterThanOrEqual(0);
  expect(registryCompositionIndex).toBeGreaterThan(registryDeclarationIndex);
  expect(generated).toContain(`const runtimeComponentRegistry = {
  ...ZORA_COMPONENT_REGISTRY,
  ...APP_EXTENSION_COMPONENT_REGISTRY,
};`);
  expect(generated).not.toContain('createComponentRegistry');
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
  expect(generated).toContain(`const runtimeComponentRegistry = createComponentRegistry(
  ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);`);
  expect(generated).toContain('componentMeta={ZORA_COMPONENT_META}');
  expect(generated).toContain(
    'activePathname={isStudioAdminPath(appPathname) ? undefined : appPathname}',
  );
  expect(generated).toContain(
    'resolveScreenIdForPathname(manifest.navigator, pathname, manifest.screens)',
  );
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
  expect(generated).toContain(
    'const themeConfig = useMemo(() => resolveZoraSurfaceThemeConfig(theme), [theme]);',
  );
  expect(generated).toContain('<ZoraProvider themeConfig={themeConfig} initialMode={initialMode}>');
  expect(generated).not.toContain('function GeneratedZoraThemeConfigSync');
  expect(generated).not.toContain('resolveZoraProviderTheme');
  expect(generated).not.toContain('setThemeConfig');
  expect(generated).not.toContain('useRef(');
  expect(generated).toContain('<AppBar title={appHeaderTitle} actions={studioAppBar.actions} />');
  expect(generated).not.toContain('appMode={studioAppBar.appMode}');
  expect(generated).not.toContain('overflow={studioAppBar.overflow}');
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

test('generates the current root-owned stationary selection composition for edit mode', () => {
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

  expect(generated).toContain('StationaryTapSelector');
  expect(generated).toContain('createStudioStationarySelectionWrapNode');
  expect(generated).toContain('createStudioInteractionPolicyResolver');
  expect(generated).toContain('createStudioActionSuppressionConfig(previewMode)');
  expect(generated).toContain('resolveNodeProps: studioResolveNodeProps');
  expect(generated).toContain('wrapNode: studioWrapNode');
  expect(generated).toContain('selectedNodeId');
  expect(generated).toContain('selectNode');
  expect(generated).toContain('canvasInteraction={{');
  expect(generated).toContain('activeDragNodeId: activeCanvasDragNodeId');
  expect(generated).toContain('moveNodeToPlacement');
  expect(generated).toContain('setActiveDragNodeId: setActiveCanvasDragNodeId');
  expect(generated).toContain('APP_EXTENSION_INTERACTION_POLICY_SUPPORT');
  expect(generated).toContain('ZORA_COMPONENT_REGISTRY');
});

test('keeps non-Studio generated output Studio-independent', () => {
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

  expect(generated).toContain('const runtimeComponentRegistry = {');
  expect(generated).toContain('ZORA_COMPONENT_REGISTRY');
  expect(generated).not.toContain('createComponentRegistry');
  expect(generated).not.toContain('useStudio');
  expect(generated).not.toContain('StationaryTapSelector');
  expect(generated).not.toContain('disableActions');
  expect(generated).not.toContain('wrapNode: studioWrapNode');
});

test('preserves navigator-owned relative indentation in generated app output', () => {
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
      jsx: `<Stack>
      <Stack.Screen key="index" name="index" />
    </Stack>`,
      usesTheme: false,
      usesIcon: false,
      usesZoraTabBar: false,
      usesZoraDrawerContent: false,
      usesZoraNavigationRouteMap: false,
    },
    includeStudio: false,
  });

  expect(generated).toContain(`return (
    <Stack>
      <Stack.Screen key="index" name="index" />
    </Stack>
  );`);
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
  expect(rootLayoutSource).not.toContain('createStudioActionSuppressionConfig(previewMode)');
  expect(rootLayoutSource).not.toContain('wrapNode: wrapStudioRuntimeNode');
  expect(studioShellSource).toContain('const studioRuntimeConfig = useMemo(');
  expect(studioShellSource).toContain('const studioWrapNode = useMemo(');
  expect(studioShellSource).toContain('createStudioStationarySelectionWrapNode');
  expect(studioShellSource).toContain('APP_EXTENSION_INTERACTION_POLICY_SUPPORT');
  expect(studioShellSource).toContain('const studioResolveNodeProps = useMemo(');
  expect(studioShellSource).toContain('createStudioInteractionPolicyResolver');
  expect(studioShellSource).toContain('createStudioActionSuppressionConfig(previewMode)');
  expect(studioShellSource).toContain('wrapNode: studioWrapNode');
  expect(studioShellSource).not.toContain('registry: create');
  expect(
    generated.match(/const runtimeComponentRegistry = createComponentRegistry\(/gu),
  ).toHaveLength(1);
  expect(studioShellSource).toContain(
    '<RuntimeRendererConfigProvider value={studioRuntimeConfig}>',
  );
  expect(studioShellSource).toContain('const studioOutput = (');
  expect(studioShellSource).toContain('[previewMode, studioWrapNode, studioResolveNodeProps]');
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
  expect(generated).not.toContain('createStudioActionSuppressionConfig(previewMode)');
});

test('wires bundled media through generated runtime and Studio preview', () => {
  for (const includeStudio of [false, true]) {
    const imports = getRootLayoutImportRequirements(includeStudio);
    expect(imports).toContainEqual({
      source: '@ankhorage/expo-runtime/bundled-media',
      namedImports: [{ imported: 'createExpoBundledMediaResolver' }],
    });
    expect(imports).toContainEqual({
      source: '@/generated/bundledMediaRegistry',
      namedImports: [{ imported: 'bundledMediaRegistry' }],
    });
  }

  const generated = getRootLayoutTsx({
    manifest: { navigator: { initialRouteName: 'index' } } as unknown as AppManifest,
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

  expect(generated).toContain(
    'const bundledMediaResolver = createExpoBundledMediaResolver(bundledMediaRegistry);',
  );
  expect(generated).toContain('mediaAssets: runtimeManifest.media?.assets');
  expect(generated).toContain('resolveMediaAsset: bundledMediaResolver');
  expect(generated).toContain('bundledMediaRegistry={bundledMediaRegistry}');
});

test('holds generated app output behind the shared Expo ZORA icon font boundary', () => {
  for (const includeStudio of [false, true]) {
    expect(getRootLayoutImportRequirements(includeStudio)).toContainEqual({
      source: '@ankhorage/expo-runtime/icon-fonts',
      namedImports: [{ imported: 'ExpoZoraIconFontProvider' }],
    });
    expect(getRootLayoutImportRequirements(includeStudio)).not.toContainEqual({
      source: '@ankhorage/expo-runtime',
      namedImports: [{ imported: 'ExpoZoraIconFontProvider' }],
    });

    const generated = getRootLayoutTsx({
      manifest: { navigator: { initialRouteName: 'index' } } as unknown as AppManifest,
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
      includeStudio,
    });

    expect(generated).toContain('<ExpoZoraIconFontProvider>');
    expect(generated).toContain('</ExpoZoraIconFontProvider>');
    expect(generated.match(/<ExpoZoraIconFontProvider>/g)).toHaveLength(1);
    expect(generated).toContain(
      'function GeneratedRootView({ children }: { children: ReactNode })',
    );
    expect(generated).toContain('return <GeneratedRootView>{shell}</GeneratedRootView>;');
  }
});
