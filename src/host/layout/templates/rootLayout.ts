import type { AppManifest } from '@ankhorage/contracts';

import type { LayoutMutation } from '../../modules/layout';
import { escapeStringLiteral } from '../utils/escapeStringLiteral';
import type { BuiltNavigatorJsx } from './navigation';
import { routeNameToGroupedHref, routeNameToHref } from './utils/routes';

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
  runtimeProviderEnd?: string[];
  runtimeProviderStart?: string[];
  useStoredAuthSessionCredentialResolver?: boolean;
}

function serializeStringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => `'${escapeStringLiteral(value)}'`).join(', ')}]`;
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
    runtimeProviderEnd = [],
    runtimeProviderStart = [],
    useStoredAuthSessionCredentialResolver = false,
  } = args;

  const pluginProvidersStart = mutations.flatMap((m) => m.providerStart);
  const pluginProvidersEnd = mutations.flatMap((m) => m.providerEnd).reverse();
  const innerThemeHook = innerNavigation.usesTheme ? '  const { theme } = useZoraTheme();\n' : '';

  const providersStart = [...runtimeProviderStart, ...pluginProvidersStart].join('\n    ');
  const providersEnd = [...pluginProvidersEnd, ...runtimeProviderEnd].join('\n    ');

  const finalJsx = providersStart ? `{${providersStart}{output}${providersEnd}}` : '{output}';

  const authRuntimeConstants = authRuntime
    ? `
const AUTH_SIGN_IN_ROUTE_SEGMENT = '${escapeStringLiteral(authRuntime.signInRouteName)}';
const AUTH_SIGN_UP_ROUTE_SEGMENT = '${escapeStringLiteral(authRuntime.signUpRouteName)}';
const AUTH_SIGN_IN_ROUTE_PATH = '${escapeStringLiteral(routeNameToHref(authRuntime.signInRoute))}';
const AUTH_SIGN_IN_ROUTE_TARGET = '${escapeStringLiteral(routeNameToGroupedHref(authRuntime.signInRoute, 'auth'))}';
const AUTH_POST_SIGN_IN_ROUTE_PATH = '${escapeStringLiteral(routeNameToHref(authRuntime.postSignInRoute))}';
const AUTH_POST_SIGN_IN_ROUTE_TARGET = '${escapeStringLiteral(routeNameToGroupedHref(authRuntime.postSignInRoute, 'app'))}';
const AUTH_PUBLIC_ROUTES = ${serializeStringArrayLiteral(authRuntime.publicRoutes)};
const AUTH_DISABLE_IN_DEV = process.env.EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV === 'true';

function normalizeRoutePath(pathname: string): string {
  const normalized = pathname.replace(/\\\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

function getTopLevelRoute(pathname: string): string {
  const normalized = normalizeRoutePath(pathname);
  if (normalized === '/') return 'index';
  const [, topLevelRoute = 'index'] = normalized.split('/');
  return topLevelRoute;
}

function getRootNavigationKey(state: { key?: string } | null | undefined): string {
  return state?.key ?? '';
}
${
  includeStudio
    ? `
function isAuthRoute(pathname: string): boolean {
  const activeTopLevelRoute = getTopLevelRoute(pathname);
  return (
    activeTopLevelRoute === AUTH_SIGN_IN_ROUTE_SEGMENT ||
    activeTopLevelRoute === AUTH_SIGN_UP_ROUTE_SEGMENT
  );
}

function shouldMountAuthenticatedAppHeader(pathname: string, isAuthRuntimeReady: boolean): boolean {
  const authEnforced = !__DEV__ || !AUTH_DISABLE_IN_DEV;
  if (!authEnforced) return true;
  if (!isAuthRuntimeReady) return false;
  if (!isAuthenticated()) return false;
  return !isAuthRoute(pathname);
}
`
    : ''
}
`
    : '';

  const appHeaderHelpers = `
function normalizeAppHeaderPath(pathname: string): string {
  const normalized = pathname.replace(/\\\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

function getAppHeaderSegments(pathname: string): string[] {
  const normalized = normalizeAppHeaderPath(pathname);
  if (normalized === '/') return ['index'];
  return normalized.replace(/^\\\/+/, '').split('/').filter(Boolean);
}

function findRouteBySegments(navigator: NavigatorSpec, segments: string[]): RouteDefinition | null {
  let current: NavigatorSpec | undefined = navigator;
  let match: RouteDefinition | undefined;

  for (const segment of segments) {
    if (!current) break;
    match = current.routes.find((route) => route.name === segment);
    if (!match) break;
    current = match.navigator ?? undefined;
  }

  return match ?? null;
}

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
  const segments = getAppHeaderSegments(pathname);
  const route = findRouteBySegments(manifest.navigator, segments);
  const screen = route?.screenId ? manifest.screens[route.screenId] : undefined;
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
    if (previewTitle) {
      return previewTitle;
    }
  }

  return resolveAppHeaderTitle(runtimeManifest, pathname);
}
`;

  const authRuntimeHook = authRuntime
    ? `
const router = useRouter();
const rootNavigationState = useRootNavigationState();
const pathname = usePathname();
const rootNavigationKey = getRootNavigationKey(rootNavigationState);
const [authSessionVersion, setAuthSessionVersion] = useState(0);
const [isAuthRuntimeReady, setIsAuthRuntimeReady] = useState(false);
const [isInnerContentReady, setIsInnerContentReady] = useState(false);

useEffect(() => {
  const mountController = new AbortController();

  void (async () => {
    await bootstrapAuthSession();
    await refreshAuthSessionIfNeeded(authAdapter);
    if (mountController.signal.aborted) return;
    setIsAuthRuntimeReady(true);
    setAuthSessionVersion((value) => value + 1);
  })();

  return () => {
    mountController.abort();
  };
}, []);

useEffect(() => {
  return subscribeToAuthSessionChanges(() => {
    setAuthSessionVersion((value) => value + 1);
  });
}, []);

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') return;
    void refreshAuthSessionIfNeeded(authAdapter).catch(() => undefined);
  });

  return () => {
    subscription.remove();
  };
}, []);

useEffect(() => {
  if (!isInnerContentReady || rootNavigationKey.length === 0 || !isAuthRuntimeReady) return;
  ${includeStudio ? 'if (isStudioAdminPath(pathname)) return;' : ''}

  const authEnforced = !__DEV__ || !AUTH_DISABLE_IN_DEV;
  if (!authEnforced) return;

  const authenticated = isAuthenticated();
  const activeTopLevelRoute = getTopLevelRoute(pathname);
  const isPublicRoute = AUTH_PUBLIC_ROUTES.includes(activeTopLevelRoute);
  const currentPath = normalizeRoutePath(pathname);
  const signInPath = normalizeRoutePath(AUTH_SIGN_IN_ROUTE_PATH);
  const postSignInPath = normalizeRoutePath(AUTH_POST_SIGN_IN_ROUTE_PATH);

  if (!authenticated && !isPublicRoute) {
    if (currentPath !== signInPath) {
      router.replace(AUTH_SIGN_IN_ROUTE_TARGET);
    }
    return;
  }

  if (authenticated && currentPath === '/' && postSignInPath !== '/') {
    router.replace(AUTH_POST_SIGN_IN_ROUTE_TARGET);
    return;
  }

  if (
    authenticated &&
    (activeTopLevelRoute === AUTH_SIGN_IN_ROUTE_SEGMENT ||
      activeTopLevelRoute === AUTH_SIGN_UP_ROUTE_SEGMENT)
  ) {
    if (currentPath !== postSignInPath) {
      router.replace(AUTH_POST_SIGN_IN_ROUTE_TARGET);
    }
  }
}, [
  router,
  isInnerContentReady,
  rootNavigationKey,
  pathname,
  authSessionVersion,
  isAuthRuntimeReady,
]);
`
    : '';
  const rootHookBlock = [allHooks, authRuntimeHook.trim()].filter(Boolean).join('\n\n');
  const indentedRootHookBlock = rootHookBlock.length > 0 ? indentGeneratedBlock(rootHookBlock) : '';

  const innerContentNode = authRuntime
    ? '<InnerContent onReady={handleInnerContentReady} />'
    : '<InnerContent />';

  const innerContentSignature = authRuntime ? '{ onReady }: { onReady?: () => void }' : '';
  const innerContentReadyHook = authRuntime
    ? `
  useEffect(() => {
    onReady?.();
  }, [onReady]);`
    : '';
  const rootLayoutTypeImports = includeStudio
    ? "import { cloneElement, isValidElement, useState, type ReactNode } from 'react';\nimport { Pressable, type GestureResponderEvent } from 'react-native';"
    : "import type { ReactNode } from 'react';";
  const runtimeOperationHelpers = `
async function runtimeDataSourceFetch(
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
  if (credential?.kind !== 'bearer' && credential?.kind !== 'oauth2') {
    return undefined;
  }

  const session = getStoredAuthSession();
  if (!session?.accessToken) {
    return undefined;
  }

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
  const runtimeContentDeclaration = includeStudio
    ? `const { executeAction } = useRuntimeAction();
  const { previewMode, selectedNodeId, selectNode } = useStudio();

  const generatedRuntimeConfig = useMemo(
    () => ({
      disableActions: !previewMode,
      executeAction,
      registry: runtimeComponentRegistry,
      executeOperation,
      wrapNode: wrapStudioRuntimeNode,
    }),
    [executeAction, executeOperation, previewMode],
  );

  const runtimeContent = (
    <RuntimeRendererConfigProvider value={generatedRuntimeConfig}>
      {appContent}
    </RuntimeRendererConfigProvider>
  );`
    : `const { executeAction } = useRuntimeAction();

  const generatedRuntimeConfig = useMemo(
    () => ({
      executeAction,
      registry: runtimeComponentRegistry,
      executeOperation,
    }),
    [executeAction, executeOperation],
  );

  const runtimeContent = (
    <RuntimeRendererConfigProvider value={generatedRuntimeConfig}>
      {appContent}
    </RuntimeRendererConfigProvider>
  );`;
  const outputDeclaration = includeStudio
    ? `${runtimeContentDeclaration}
  const output = __DEV__ ? (
    <AnkhStudio
      runtimeRegistry={runtimeComponentRegistry}
      runtimeConfig={generatedRuntimeConfig}
    >
      {runtimeContent}
    </AnkhStudio>
  ) : (
    runtimeContent
  );`
    : `${runtimeContentDeclaration}
  const output = runtimeContent;`;
  const moduleLevelDeclarations = [
    runtimeModuleDeclarations?.trim(),
    runtimeOperationHelpers.trim(),
    authRuntimeConstants.trim(),
    includeStudio ? appHeaderHelpers.trim() : '',
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
  const handleInnerContentReadyDeclaration = authRuntime
    ? `const handleInnerContentReady = useCallback(() => {
  setIsInnerContentReady(true);
}, []);`
    : '';
  const indentedHandleInnerContentReadyDeclaration =
    handleInnerContentReadyDeclaration.length > 0
      ? `${indentGeneratedBlock(handleInnerContentReadyDeclaration)}

`
      : '';
  const studioShellBlock = includeStudio
    ? `if (__DEV__) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StudioProvider
        projectId={ankhConfig.metadata.slug}
        initialManifest={runtimeManifest}
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
  const indentedInnerNavigationJsx = indentGeneratedBlock(innerNavigation.jsx, '    ');
  const studioSelectionRuntimeHelpers = includeStudio
    ? `const studioSelectionInteractionStyle = { display: 'contents' as const };

function wrapStudioRuntimeNode(args: {
  readonly node: { readonly id?: string };
  readonly rendered: ReactNode;
  readonly isRoot: boolean;
}): ReactNode {
  return (
    <StudioRuntimeNodeWrapper
      nodeId={args.node.id}
      rendered={args.rendered}
    />
  );
}

function StudioRuntimeNodeWrapper(props: {
  readonly nodeId?: string;
  readonly rendered: ReactNode;
}): ReactNode {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { previewMode, selectedNodeId, selectNode } = useStudio();
  const { theme } = useZoraTheme();

  if (previewMode || !props.nodeId) {
    return props.rendered;
  }

  const selected = selectedNodeId === props.nodeId;
  const selectionStyle = selected
    ? { boxShadow: \`0 0 0 2px \${theme.colors.primary}\` }
    : isFocused
      ? { boxShadow: \`0 0 0 2px \${theme.colors.primary}\` }
      : isHovered
        ? { boxShadow: \`0 0 0 1px \${theme.colors.primary}\` }
        : undefined;

  const renderedNode = isValidElement<{ readonly style?: unknown; readonly onPress?: unknown }>(
    props.rendered,
  )
    ? cloneElement(props.rendered, {
        style: [props.rendered.props.style, selectionStyle],
        onPress: (event: GestureResponderEvent) => {
          event.stopPropagation();
          selectNode(props.nodeId ?? null);
        },
      })
    : props.rendered;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={\`Select \${props.nodeId}\`}
      accessibilityState={{ selected }}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onPress={(event: GestureResponderEvent) => {
        event.stopPropagation();
        selectNode(props.nodeId ?? null);
      }}
      style={studioSelectionInteractionStyle}
    >
      {renderedNode}
    </Pressable>
  );
}

`
    : '';

  return `
${rootLayoutTypeImports ? `${rootLayoutTypeImports}\n` : ''}${allImports}

${moduleLevelDeclarations}

const fallbackManifest = ankhConfig as unknown as AppManifest;
const runtimeComponentRegistry = createComponentRegistry(
  ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);

${studioSelectionRuntimeHelpers}function resolveZoraProviderTheme(
  theme: AppManifest['themes'][number],
  mode: NonNullable<AppManifest['activeThemeMode']>,
) {
  const modeConfig = theme[mode];
  return {
    id: theme.id,
    name: theme.name,
    appCategory: 'developer_tools' as const,
    primaryColor: modeConfig.primaryColor,
    harmony: modeConfig.harmony,
  };
}

function resolveZoraSurfaceThemeConfig(theme: AppManifest['themes'][number]) {
  return {
    id: theme.id,
    name: theme.name,
    light: { ...theme.light },
    dark: { ...theme.dark },
  };
}

function resolveThemeMode(
  mode: AppManifest['activeThemeMode'],
  fallback: NonNullable<AppManifest['activeThemeMode']>,
): NonNullable<AppManifest['activeThemeMode']> {
  if (mode === 'dark' || mode === 'light') {
    return mode;
  }

  return fallback;
}

export const unstable_settings = {
  initialRouteName: '${initialRouteNameOverride ?? manifest.navigator.initialRouteName ?? 'index'}',
};

export default function RootLayout() {
${indentedRootHookBlock}

  const manifestContext = useOptionalManifestContext();
  const runtimeManifest = manifestContext?.manifest ?? fallbackManifest;${indentedStudioRuntimeLines}
  const activeTheme =
    runtimeManifest.themes.find((theme) => theme.id === runtimeManifest.activeThemeId) ??
    runtimeManifest.themes[0];
  if (!activeTheme) {
    return null;
  }

  const activeThemeMode = resolveThemeMode(runtimeManifest.activeThemeMode, 'light');
  const executeOperation = useMemo(
    () =>
      createRuntimeDataSourceOperationExecutor({
        fetch: runtimeDataSourceFetch,
        ${
          useStoredAuthSessionCredentialResolver
            ? 'credentialResolver: resolveRuntimeOperationCredential,'
            : ''
        }
      }),
    [],
  );
${indentedHandleInnerContentReadyDeclaration}  const appContent = ${innerContentNode};

  ${outputDeclaration}

  const shell = (
    <GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>
      <SafeAreaProvider>
        <AppShell>
          ${finalJsx}
        </AppShell>
        <GeneratedStatusBar />
      </SafeAreaProvider>
    </GeneratedZoraProvider>
  );
${indentedStudioShellBlock}  return <GestureHandlerRootView style={{ flex: 1 }}>{shell}</GestureHandlerRootView>;
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
    activeScreenId,
    manifest: studioManifest,
    previewMode,
    setLastNonAdminLocation,
  } = useStudio();
  useEffect(() => {
    const nextAppLocation = resolveStudioLastNonAdminLocation({
      pathname: appPathname,
      navigableLocation: appLocation,
    });
    if (nextAppLocation) setLastNonAdminLocation(nextAppLocation);
  }, [appLocation, appPathname, setLastNonAdminLocation]);
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

  return (
    <GeneratedZoraProvider theme={activeStudioTheme} initialMode={activeStudioThemeMode}>
      <SafeAreaProvider>
        <AppShell header={header}>
          ${finalJsx}
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
      <AppBar
        title={appHeaderTitle}
        appMode={studioAppBar.appMode}
        actions={studioAppBar.actions}
        overflow={studioAppBar.overflow}
      />
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
  const initialZoraTheme = useMemo(
    () => resolveZoraProviderTheme(theme, initialMode),
    [initialMode, theme],
  );

  return (
    <ZoraProvider theme={initialZoraTheme} initialMode={initialMode}>
      <GeneratedZoraThemeConfigSync theme={theme} />
      {children}
    </ZoraProvider>
  );
}

function GeneratedZoraThemeConfigSync({
  theme,
}: {
  theme: AppManifest['themes'][number];
}) {
  const { setThemeConfig } = useZoraTheme();
  const setThemeConfigRef = useRef(setThemeConfig);
  const themeConfig = useMemo(() => resolveZoraSurfaceThemeConfig(theme), [theme]);
  const themeConfigSignature = useMemo(() => JSON.stringify(themeConfig), [themeConfig]);
  const lastSyncedThemeConfigSignatureRef = useRef<string | null>(null);

  setThemeConfigRef.current = setThemeConfig;

  useEffect(() => {
    if (lastSyncedThemeConfigSignatureRef.current === themeConfigSignature) return;
    setThemeConfigRef.current(themeConfig);
    lastSyncedThemeConfigSignatureRef.current = themeConfigSignature;
  }, [themeConfig, themeConfigSignature]);

  return null;
}

function GeneratedStatusBar() {
  const { mode } = useZoraTheme();

  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

function InnerContent(${innerContentSignature}) {${innerContentReadyHook}
${innerThemeHook}  return (
${indentedInnerNavigationJsx}
  );
}
`.trimStart();
}
