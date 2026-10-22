import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { getRootLayoutImportRequirements, getRootLayoutTsx } from './rootLayout';

test('keeps the native splash visible until generated content is ready', () => {
  expect(getRootLayoutImportRequirements(false)).toContainEqual({
    source: 'react',
    namedImports: [{ imported: 'ReactNode', typeOnly: true }, { imported: 'useEffect' }],
  });
  expect(getRootLayoutImportRequirements(false)).toContainEqual({
    source: 'expo-splash-screen',
    namespaceImport: 'SplashScreen',
  });

  const generated = getRootLayoutTsx({
    manifest: { navigator: { initialRouteName: 'index' } } as unknown as AppManifest,
    mutations: [],
    allImports: '',
    allHooks: '',
    innerNavigation: { declarations: '', jsx: '<></>', usesTheme: false },
    includeStudio: false,
  });

  expect(generated).toContain('void SplashScreen.preventAutoHideAsync();');
  expect(generated).toContain(`useEffect(() => {
    SplashScreen.hide();
  }, []);`);
});

test('keeps the native splash visible while generated auth is pending', () => {
  const generated = getRootLayoutTsx({
    manifest: { navigator: { initialRouteName: 'index' } } as unknown as AppManifest,
    mutations: [],
    allImports: '',
    allHooks: '',
    innerNavigation: { declarations: '', jsx: '<></>', usesTheme: false },
    includeStudio: false,
    authRuntime: {
      signInRoute: 'sign-in',
      signInRouteName: 'sign-in',
      signUpRoute: 'sign-up',
      signUpRouteName: 'sign-up',
      postSignInRoute: 'index',
      publicRoutes: ['sign-in', 'sign-up'],
    },
  });

  expect(generated).toContain(`useEffect(() => {
    if (authState === 'pending') return;
    onReady?.();
    SplashScreen.hide();
  }, [authState, onReady]);`);
});

test('delegates generated Runtime composition to the generated Runtime shell', () => {
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
    },
    includeStudio: false,
  });

  expect(generated).toContain('<GeneratedRuntimeShell runtimeManifest={runtimeManifest}>');
  expect(generated).not.toContain('const runtimeComponentRegistry = APP_COMPONENT_REGISTRY;');
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
  expect(generated).toContain('<GeneratedRuntimeShell runtimeManifest={runtimeManifest}>');
  expect(generated).toContain('componentMeta={ZORA_COMPONENT_META}');
  expect(generated).toContain('bindableComponentMeta={ZORA_BINDABLE_COMPONENT_META}');
  expect(generated).toContain(
    'activePathname={isStudioAdminPath(appPathname) ? undefined : appPathname}',
  );
  expect(generated).toContain('const appLocation = resolveStudioNavigableLocation(appPathname);');
  expect(generated).not.toContain('useGlobalSearchParams');
  expect(generated).toContain('const shouldMountAppHeader =');
  expect(generated).toContain('!isStudioAdminPath(appPathname) &&');
  expect(generated).toContain('const activeTheme = resolveManifestActiveTheme(runtimeManifest);');
  expect(generated).not.toContain('themes.find(');
  expect(generated).toContain('resolveManifestActiveTheme(runtimeManifest)');
  expect(generated).not.toContain("AppManifest['themes'][number]");
  expect(generated).not.toContain('?? activeTheme');
  expect(generated).toContain(
    '<GeneratedThemeShell theme={activeTheme} initialMode={activeThemeMode}>',
  );
  expect(generated).not.toContain('function GeneratedZoraThemeConfigSync');
  expect(generated).not.toContain('function resolveManifestActiveTheme(');
  expect(generated).not.toContain('resolveZoraProviderTheme');
  expect(generated).not.toContain('setThemeConfig');
  expect(generated).not.toContain('useRef(');
  expect(generated).toContain('<StudioShell');
  expect(generated).toContain('wrapOutput={(studioOutput) => <>{studioOutput}</>}');
  expect(generated).not.toContain('function StudioShell(');
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
    },
    includeStudio: true,
  });

  expect(generated).toContain('const shouldMountAppHeader =');
  expect(generated).toContain('!isStudioAdminPath(appPathname) &&');
  expect(generated).toContain('true;');
});

test('composes the Studio shell without embedding its selection behavior', () => {
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
    },
    includeStudio: true,
  });

  expect(generated).toContain('componentMeta={ZORA_COMPONENT_META}');
  expect(generated).toContain('<StudioShell');
  expect(generated).not.toContain('StationaryTapSelector');
  expect(generated).not.toContain('createStudioActionSuppressionConfig');
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
    },
    includeStudio: false,
  });

  expect(generated).toContain('<GeneratedRuntimeShell runtimeManifest={runtimeManifest}>');
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
    },
    includeStudio: false,
  });

  expect(generated).toContain(`return (
    <Stack>
      <Stack.Screen key="index" name="index" />
    </Stack>
  );`);
});

test('preserves formatter-stable indentation for generated provider composition', () => {
  const generated = getRootLayoutTsx({
    manifest: { navigator: {} } as AppManifest,
    mutations: [
      {
        imports: [],
        hooks: [],
        providerStart: ["<ExpoRuntimeProviders providers={['permissions']}>"],
        providerEnd: ['</ExpoRuntimeProviders>'],
      },
    ],
    allImports: '',
    allHooks: '',
    innerNavigation: { declarations: '', jsx: '<Slot />', usesTheme: false },
    includeStudio: false,
  });

  expect(generated).toContain(`      <AppShell>
        {<ExpoRuntimeProviders providers={['permissions']}>{output}</ExpoRuntimeProviders>}
      </AppShell>`);
});

test('calls themed navigator hooks before the global auth pending boundary', () => {
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
      usesTheme: true,
    },
    includeStudio: true,
    authRuntime: {
      signInRoute: 'sign-in',
      signInRouteName: 'sign-in',
      signUpRoute: 'sign-up',
      signUpRouteName: 'sign-up',
      postSignInRoute: 'index',
      publicRoutes: ['sign-in', 'sign-up'],
    },
  });
  const innerContent = generated.slice(generated.indexOf('function InnerContent('));
  const themeHookIndex = innerContent.indexOf('const { theme } = useZoraTheme();');
  const pendingBoundaryIndex = innerContent.indexOf("if (authState === 'pending') {");

  expect(themeHookIndex).toBeGreaterThanOrEqual(0);
  expect(pendingBoundaryIndex).toBeGreaterThan(themeHookIndex);
});

test('keeps Studio runtime selection implementation out of RootLayout', () => {
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
    },
    includeStudio: true,
  });

  expect(generated).toContain('<StudioShell');
  expect(generated).not.toContain('function StudioShell(');
  expect(generated).not.toContain('useStudio()');
  expect(generated).not.toContain('createStudioActionSuppressionConfig(previewMode)');
  expect(generated).not.toContain('wrapNode: wrapStudioRuntimeNode');
  expect(generated).toContain('<GeneratedRuntimeShell runtimeManifest={runtimeManifest}>');
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

test('leaves bundled-media resolution to the generated Runtime shell', () => {
  for (const includeStudio of [false, true]) {
    const imports = getRootLayoutImportRequirements(includeStudio);
    expect(imports).not.toContainEqual({
      source: '@ankhorage/expo-runtime/bundled-media',
      namedImports: [{ imported: 'createExpoBundledMediaResolver' }],
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
    },
    includeStudio: true,
  });

  expect(generated).toContain('<GeneratedRuntimeShell runtimeManifest={runtimeManifest}>');
  expect(generated).toContain('bundledMediaRegistry={bundledMediaRegistry}');
});

test('keeps standalone root layouts free of empty declaration whitespace', () => {
  const generated = getRootLayoutTsx({
    manifest: { navigator: {} } as AppManifest,
    mutations: [],
    allImports: "import { AppShell } from '@ankhorage/zora';",
    allHooks: '',
    innerNavigation: { declarations: '', jsx: '<Slot />', usesTheme: false },
    includeStudio: false,
  });

  expect(generated).not.toContain('\n\n\n');
  expect(generated.endsWith('\n')).toBe(true);
});

test('holds generated app output behind the shared Expo ZORA icon font boundary', () => {
  for (const includeStudio of [false, true]) {
    expect(getRootLayoutImportRequirements(includeStudio)).not.toContainEqual({
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
      },
      includeStudio,
    });

    expect(generated).not.toContain('<ExpoZoraIconFontProvider>');
    expect(generated).toContain('return <GeneratedRootShell>{shell}</GeneratedRootShell>;');
  }
});
