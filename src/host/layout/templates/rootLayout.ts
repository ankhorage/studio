import type { AppManifest } from '@ankhorage/contracts';

import type { LayoutMutation } from '../../modules/layout';
import type { GeneratedImportRequirement } from '../generatedImportComposer';
import type { BuiltNavigatorJsx } from './navigation';

interface RootLayoutAuthRuntimeConfig {
  signInRoute: string;
  signInRouteName: string;
  signUpRoute: string;
  signUpRouteName: string;
  postSignInRoute: string;
  publicRoutes: string[];
}

interface GetRootLayoutTsxArgs {
  manifest: AppManifest;
  mutations: LayoutMutation[];
  allImports: string;
  allHooks: string;
  innerNavigation: BuiltNavigatorJsx;
  includeStudio: boolean;
  authRuntime?: RootLayoutAuthRuntimeConfig;
  initialRouteNameOverride?: string;
  runtimeModuleDeclarations?: string;
  runtimeActionHookName?: string;
  runtimeProviderEnd?: string[];
  runtimeProviderStart?: string[];
  useStoredAuthSessionCredentialResolver?: boolean;
}

export function getRootLayoutImportRequirements(
  includeStudio: boolean,
): GeneratedImportRequirement[] {
  return [
    {
      source: 'react',
      namedImports: [
        { imported: 'ReactNode', typeOnly: true },
        ...(!includeStudio ? [{ imported: 'useCallback' }] : []),
      ],
    },
    ...(includeStudio
      ? [
          {
            source: 'react-native',
            namedImports: [],
          },
        ]
      : []),
    {
      source: '@ankhorage/expo-runtime/bundled-media',
      namedImports: [{ imported: 'createExpoBundledMediaResolver' }],
    },
    {
      source: '@/generated/bundledMediaRegistry',
      namedImports: [{ imported: 'bundledMediaRegistry' }],
    },
    ...(includeStudio
      ? [
          {
            source: '@ankhorage/expo-runtime/media-picker',
            namedImports: [{ imported: 'createExpoMediaPickerAdapter' }],
          },
        ]
      : []),
    ...(includeStudio
      ? [
          {
            source: '@ankhorage/studio/runtime',
            namedImports: [
              { imported: 'createStudioActionSuppressionConfig' },
              { imported: 'createStudioInteractionPolicyResolver' },
              { imported: 'createStudioStationarySelectionWrapNode' },
              { imported: 'StationaryTapSelector' },
            ],
          },
        ]
      : []),
  ];
}

function indentGeneratedBlock(content: string, indent = '  '): string {
  return content
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

export function getRootLayoutTsx(args: GetRootLayoutTsxArgs) {
  const {
    manifest,
    mutations,
    allImports,
    allHooks,
    innerNavigation,
    includeStudio,
    authRuntime,
    initialRouteNameOverride,
    runtimeModuleDeclarations,
    runtimeActionHookName = 'useRuntimeAction',
    runtimeProviderEnd = [],
    runtimeProviderStart = [],
    useStoredAuthSessionCredentialResolver = false,
  } = args;

  const moduleProvidersStart = mutations.flatMap((m) => m.providerStart);
  const moduleProvidersEnd = mutations.flatMap((m) => m.providerEnd).reverse();
  const innerThemeHook = innerNavigation.usesTheme ? '  const { theme } = useZoraTheme();\n' : '';

  const providersStart = [...runtimeProviderStart, ...moduleProvidersStart].join('\n    ');
  const providersEnd = [...moduleProvidersEnd, ...runtimeProviderEnd].join('\n    ');

  const finalJsx = providersStart ? `{${providersStart}{output}${providersEnd}}` : '{output}';
  const studioFinalJsx = finalJsx.replace('{output}', '{studioOutput}');

  const appHeaderHelpers = `
function findRouteByScreenId(navigator: NavigatorSpec, screenId: string): RouteDefinition | null {
  for (const route of navigator.routes) {
    if (route.screenId === screenId) {
      return route;
    }

    if (route.navigator) {
      const nestedRoute = findRouteByScreenId(route.navigator, screenId);
      if (nestedRoute) {
        return nestedRoute;
      }
    }
  }

  return null;
}

function resolveAppHeaderTitle(manifest: AppManifest, pathname: string): string {
  const screenId = resolveScreenIdForPathname(manifest.navigator, pathname, manifest.screens);
  const route = screenId ? findRouteByScreenId(manifest.navigator, screenId) : null;
  const screen = screenId ? manifest.screens[screenId] : undefined;
  return route?.label ?? screen?.title ?? screen?.name ?? route?.name ?? 'App';
}

function resolveAppHeaderTitleForScreenId(
  manifest: AppManifest,
  screenId: string | null | undefined,
): string | null {
  if (!screenId) return null;

  const screen = manifest.screens[screenId];
  if (!screen) return null;

  const route = findRouteByScreenId(manifest.navigator, screenId);
  return route?.label ?? screen.title ?? screen.name;
}

function resolveStudioAppHeaderTitle(args: {
  runtimeManifest: AppManifest;
  studioManifest: AppManifest | null;
  previewMode: boolean;
  activeScreenId: string | null;
  pathname: string;
}): string {
  const { runtimeManifest, studioManifest, previewMode, activeScreenId, pathname } = args;

  if (previewMode) {
    const previewTitle = resolveAppHeaderTitleForScreenId(
      studioManifest ?? runtimeManifest,
      activeScreenId,
    );
    if (previewTitle) return previewTitle;
  }

  return resolveAppHeaderTitle(runtimeManifest, pathname);
}
`;

  const authRuntimeHook = authRuntime
    ? includeStudio
      ? `
const { authState, handleInnerContentReady, isAuthRuntimeReady, pathname } =
  useGeneratedAuthNavigation({ isRouteGuardDisabled: isStudioAdminPath });
`
      : `
const { authState, handleInnerContentReady } = useGeneratedAuthNavigation();
`
    : '';
  const rootHookBlock = [allHooks, authRuntimeHook.trim()].filter(Boolean).join('\n\n');
  const indentedRootHookBlock =
    rootHookBlock.length > 0 ? `${indentGeneratedBlock(rootHookBlock)}\n\n` : '';

  const innerContentNode = authRuntime
    ? '<InnerContent authState={authState} onReady={handleInnerContentReady} />'
    : '<InnerContent />';
  const innerContentSignature = authRuntime
    ? `{\n  authState,\n  onReady,\n}: {\n  authState: GeneratedAuthNavigationState;\n  onReady?: () => void;\n}`
    : '';
  const innerContentReadyHook = authRuntime
    ? `
  useEffect(() => {
    onReady?.();
  }, [onReady]);`
    : '';
  const innerContentPendingBoundary =
    authRuntime && !includeStudio
      ? `
  if (authState === 'pending') {
    return null;
  }
`
      : '';
  const runtimeOperationHelpers = `
async function runtimeApiFetch(
  url: string,
  init: {
    readonly method: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: string;
  },
) {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text: () => response.text(),
  };
}
${
  useStoredAuthSessionCredentialResolver
    ? `
function resolveRuntimeOperationCredential(credential: { readonly kind?: string } | undefined) {
  if (credential?.kind !== 'bearer' && credential?.kind !== 'oauth2') return undefined;

  const session = getStoredAuthSession();
  if (!session?.accessToken) return undefined;

  return {
    headers: {
      Authorization: \`Bearer \${session.accessToken}\`,
    },
  };
}
`
    : ''
}
`;
  const runtimeContentDeclaration = `const { executeAction } = ${runtimeActionHookName}();

  const generatedRuntimeConfig = useMemo(
    () => ({
      executeAction,
      registry: runtimeComponentRegistry,
      executeOperation,
      mediaAssets: runtimeManifest.media?.assets,
      resolveMediaAsset: bundledMediaResolver,
    }),
    [executeAction, executeOperation, runtimeManifest.media?.assets],
  );

  const runtimeContent = (
    <RuntimeRendererConfigProvider value={generatedRuntimeConfig}>
      {appContent}
    </RuntimeRendererConfigProvider>
  );`;
  const outputDeclaration = includeStudio
    ? `${runtimeContentDeclaration}
  const output = __DEV__ ? (
    isStudioAdminPath(appPathname) ? (
      runtimeContent
    ) : (
      <AnkhStudio
        runtimeRegistry={runtimeComponentRegistry}
        runtimeConfig={generatedRuntimeConfig}
        bundledMediaRegistry={bundledMediaRegistry}
      >
        {runtimeContent}
      </AnkhStudio>
    )
  ) : (
    runtimeContent
  );`
    : `${runtimeContentDeclaration}
  const output = runtimeContent;`;
  const moduleLevelDeclarations = [
    runtimeModuleDeclarations?.trim(),
    'const bundledMediaResolver = createExpoBundledMediaResolver(bundledMediaRegistry);',
    runtimeOperationHelpers.trim(),
    includeStudio ? appHeaderHelpers.trim() : '',
    includeStudio ? 'const studioMediaPicker = createExpoMediaPickerAdapter();' : '',
    innerNavigation.declarations.trim(),
  ]
    .filter(Boolean)
    .join('\n\n');
  const studioRuntimeLines = includeStudio
    ? `const appPathname = ${authRuntime ? 'pathname' : 'usePathname()'};
const appRouteSearchParams = useGlobalSearchParams();
const appRouteSearchParamsKey = JSON.stringify(appRouteSearchParams);
const appLocation = useMemo(
  () => resolveStudioNavigableLocation(appPathname),
  [appPathname, appRouteSearchParamsKey],
);
const shouldMountAppHeader =
  !isStudioAdminPath(appPathname) &&
  ${authRuntime ? 'shouldMountAuthenticatedAppHeader(appPathname, isAuthRuntimeReady)' : 'true'};`
    : '';
  const indentedStudioRuntimeLines =
    studioRuntimeLines.length > 0 ? `\n${indentGeneratedBlock(studioRuntimeLines)}\n` : '\n';
  const handleInnerContentReadyDeclaration = '';
  const indentedHandleInnerContentReadyDeclaration =
    handleInnerContentReadyDeclaration.length > 0
      ? `${indentGeneratedBlock(handleInnerContentReadyDeclaration)}\n\n`
      : '';
  const studioShellBlock = includeStudio
    ? `if (__DEV__) {
  return (
    <GestureHandlerRootView style={rootViewStyle}>
      <StudioProvider
        projectId={ankhConfig.metadata.slug}
        initialManifest={runtimeManifest}
        activePathname={isStudioAdminPath(appPathname) ? undefined : appPathname}
        componentMeta={ZORA_COMPONENT_META}
        mediaPicker={studioMediaPicker}
      >
        <StudioShell
          output={output}
          activeTheme={activeTheme}
          activeThemeMode={activeThemeMode}
          runtimeManifest={runtimeManifest}
          appPathname={appPathname}
          appLocation={appLocation}
          shouldMountAppHeader={shouldMountAppHeader}
        />
      </StudioProvider>
    </GestureHandlerRootView>
  );
}`
    : '';
  const indentedStudioShellBlock =
    studioShellBlock.length > 0 ? `\n${indentGeneratedBlock(studioShellBlock)}\n` : '\n';
  const indentedInnerNavigationJsx = `    ${innerNavigation.jsx}`;
  const generatedAppShell =
    finalJsx === '{output}'
      ? '<AppShell>{output}</AppShell>'
      : `<AppShell>
          ${finalJsx}
        </AppShell>`;
  const runtimeCredentialResolver = useStoredAuthSessionCredentialResolver
    ? '\n        credentialResolver: resolveRuntimeOperationCredential,'
    : '';
  const runtimeComponentRegistryDeclaration = includeStudio
    ? `const runtimeComponentRegistry = createComponentRegistry(
  ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);`
    : `const runtimeComponentRegistry = {
  ...ZORA_COMPONENT_REGISTRY,
  ...APP_EXTENSION_COMPONENT_REGISTRY,
};`;
  return `
${allImports}

${moduleLevelDeclarations}

const fallbackManifest = ankhConfig as unknown as AppManifest;
${runtimeComponentRegistryDeclaration}
const rootViewStyle = { flex: 1 } as const;

function resolveZoraSurfaceThemeConfig(theme: AppManifest['themes'][number]) {
  return {
    ...theme,
    light: { ...theme.light },
    dark: { ...theme.dark },
  };
}

function resolveThemeMode(
  mode: AppManifest['activeThemeMode'],
  fallback: NonNullable<AppManifest['activeThemeMode']>,
): NonNullable<AppManifest['activeThemeMode']> {
  if (mode === 'dark' || mode === 'light') return mode;
  return fallback;
}

export const unstable_settings = {
  initialRouteName: '${initialRouteNameOverride ?? manifest.navigator.initialRouteName ?? 'index'}',
};

export default function RootLayout() {
${indentedRootHookBlock}  const manifestContext = useOptionalManifestContext();
  const runtimeManifest = manifestContext?.manifest ?? fallbackManifest;${indentedStudioRuntimeLines}
  const activeTheme =
    runtimeManifest.themes.find((theme) => theme.id === runtimeManifest.activeThemeId) ??
    runtimeManifest.themes[0];
  const activeThemeMode = resolveThemeMode(runtimeManifest.activeThemeMode, 'light');
  const executeOperation = useMemo(
    () =>
      createRuntimeApiOperationExecutor({
        fetch: runtimeApiFetch,${runtimeCredentialResolver}
      }),
    [],
  );
${indentedHandleInnerContentReadyDeclaration}  const appContent = ${innerContentNode};

  ${outputDeclaration}

  if (!activeTheme) return null;

  const shell = (
    <GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>
      <SafeAreaProvider>
        ${generatedAppShell}
        <GeneratedStatusBar />
      </SafeAreaProvider>
    </GeneratedZoraProvider>
  );
${indentedStudioShellBlock}  return <GestureHandlerRootView style={rootViewStyle}>{shell}</GestureHandlerRootView>;
}${
    includeStudio
      ? `
function StudioShell({
  output,
  activeTheme,
  activeThemeMode,
  runtimeManifest,
  appPathname,
  appLocation,
  shouldMountAppHeader,
}: {
  output: ReactNode;
  activeTheme: AppManifest['themes'][number];
  activeThemeMode: NonNullable<AppManifest['activeThemeMode']>;
  runtimeManifest: AppManifest;
  appPathname: string;
  appLocation: string;
  shouldMountAppHeader: boolean;
}) {
  const {
    activeCanvasDragNodeId,
    activeScreenId,
    componentMeta,
    manifest: studioManifest,
    moveNodeToPlacement,
    previewMode,
    rootNode,
    selectedNodeId,
    selectNode,
    setActiveCanvasDragNodeId,
    setLastNonAdminLocation,
  } = useStudio();
  useEffect(() => {
    const nextAppLocation = resolveStudioLastNonAdminLocation({
      pathname: appPathname,
      navigableLocation: appLocation,
    });
    if (nextAppLocation) setLastNonAdminLocation(nextAppLocation);
  }, [appLocation, appPathname, setLastNonAdminLocation]);

  const studioWrapNode = useMemo(
    () =>
      createStudioStationarySelectionWrapNode({
        previewMode,
        thirdPartySupport: APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
      }),
    [previewMode],
  );
  const studioResolveNodeProps = useMemo(
    () =>
      createStudioInteractionPolicyResolver({
        previewMode,
        thirdPartySupport: APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
      }),
    [previewMode],
  );
  const appHeaderTitle = resolveStudioAppHeaderTitle({
    runtimeManifest,
    studioManifest,
    previewMode,
    activeScreenId,
    pathname: appPathname,
  });
  const header = shouldMountAppHeader ? (
    <StudioAppHeader appHeaderTitle={appHeaderTitle} />
  ) : undefined;
  const studioRuntimeManifest = studioManifest ?? runtimeManifest;
  const activeStudioTheme =
    studioRuntimeManifest.themes.find(
      (theme) => theme.id === studioRuntimeManifest.activeThemeId,
    ) ?? activeTheme;
  const activeStudioThemeMode = resolveThemeMode(
    studioRuntimeManifest.activeThemeMode,
    activeThemeMode,
  );
  const studioRuntimeConfig = useMemo(
    () => ({
      ...createStudioActionSuppressionConfig(previewMode),
      wrapNode: studioWrapNode,
      resolveNodeProps: studioResolveNodeProps,
    }),
    [previewMode, studioWrapNode, studioResolveNodeProps],
  );
  const studioOutput = (
    <StationaryTapSelector
      canvasInteraction={{
        activeDragNodeId: activeCanvasDragNodeId,
        componentMeta,
        moveNodeToPlacement,
        rootNode,
        setActiveDragNodeId: setActiveCanvasDragNodeId,
      }}
      isEditMode={!previewMode}
      selectedNodeId={selectedNodeId}
      selectNode={selectNode}
    >
      <RuntimeRendererConfigProvider value={studioRuntimeConfig}>
        {output}
      </RuntimeRendererConfigProvider>
    </StationaryTapSelector>
  );

  return (
    <GeneratedZoraProvider theme={activeStudioTheme} initialMode={activeStudioThemeMode}>
      <SafeAreaProvider>
        <AppShell header={header}>
          ${studioFinalJsx}
        </AppShell>
        <GeneratedStatusBar />
      </SafeAreaProvider>
    </GeneratedZoraProvider>
  );
}

function StudioAppHeader({ appHeaderTitle }: { appHeaderTitle: string }) {
  const studioAppBar = useStudioAppBarAugmentation();

  return (
    <>
      <AppBar title={appHeaderTitle} actions={studioAppBar.actions} />
      {studioAppBar.overlays}
    </>
  );
}`
      : ''
  }

function GeneratedZoraProvider({
  children,
  theme,
  initialMode,
}: {
  children: ReactNode;
  theme: AppManifest['themes'][number];
  initialMode: NonNullable<AppManifest['activeThemeMode']>;
}) {
  const themeConfig = useMemo(() => resolveZoraSurfaceThemeConfig(theme), [theme]);

  return (
    <ZoraProvider themeConfig={themeConfig} initialMode={initialMode}>
      {children}
    </ZoraProvider>
  );
}

function GeneratedStatusBar() {
  const { mode } = useZoraTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

function InnerContent(${innerContentSignature}) {${innerContentReadyHook}
${innerContentPendingBoundary}${innerThemeHook}  return (
${indentedInnerNavigationJsx}
  );
}
`.trimStart();
}
