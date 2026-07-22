import type { AppManifest } from '@ankhorage/contracts';

import type { GeneratedImportRequirement } from '../generatedImportComposer';
import type { LayoutMutation } from '../../modules/layout';
import { escapeStringLiteral } from '../utils/escapeStringLiteral';
import type { BuiltNavigatorJsx } from './navigation';
import { routeNameToHref } from './utils/routes';

interface RootLayoutAuthRuntimeConfig {
  signInRoute: string;
  signInRouteName: string;
  signUpRoute: string;
  signUpRouteName: string;
  signOutRouteName: string;
  postSignInRoute: string;
  publicRoutes: string[];
  routeTopology: {
    appRoutePatterns: { path: string; pattern: string }[];
    protectedRoutePatterns: { path: string; pattern: string }[];
    publicRoutePatterns: { path: string; pattern: string }[];
    authEntryRoutePatterns: { path: string; pattern: string }[];
    callbackRoutePatterns: { path: string; pattern: string }[];
    unauthorizedRoutePath: string;
    postSignInRoutePath: string;
  };
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

export function getRootLayoutImportRequirements(
  includeStudio: boolean,
): GeneratedImportRequirement[] {
  return [
    {
      source: 'react',
      namedImports: [
        { imported: 'ReactNode', typeOnly: true },
        ...(includeStudio
          ? [{ imported: 'cloneElement' }, { imported: 'isValidElement' }, { imported: 'useState' }]
          : []),
      ],
    },
    ...(includeStudio
      ? [
          {
            source: 'react-native',
            namedImports: [
              { imported: 'Pressable' },
              { imported: 'GestureResponderEvent', typeOnly: true },
            ],
          },
        ]
      : []),
  ];
}

function serializeRoutePatternsLiteral(
  values: readonly { readonly path: string; readonly pattern: string }[],
): string {
  if (values.length === 0) {
    return '[]';
  }

  return `[
${values
  .map(
    (value) =>
      `  { path: '${escapeStringLiteral(value.path)}', pattern: '${escapeStringLiteral(value.pattern)}' },`,
  )
  .join('\n')}
]`;
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
  const studioFinalJsx = finalJsx.replace('{output}', '{studioOutput}');

  const authRuntimeConstants = authRuntime
    ? `
const AUTH_SIGN_IN_ROUTE_SEGMENT = '${escapeStringLiteral(authRuntime.signInRouteName)}';
const AUTH_SIGN_UP_ROUTE_SEGMENT = '${escapeStringLiteral(authRuntime.signUpRouteName)}';
const AUTH_SIGN_OUT_ROUTE_PATH = '${escapeStringLiteral(routeNameToHref(authRuntime.signOutRouteName))}';
const AUTH_POST_SIGN_IN_ROUTE_PATH = '${escapeStringLiteral(routeNameToHref(authRuntime.postSignInRoute))}';
const AUTH_POST_SIGN_IN_ROUTE_TARGET = AUTH_POST_SIGN_IN_ROUTE_PATH;
const AUTH_UNAUTHORIZED_ROUTE_TARGET = '${escapeStringLiteral(authRuntime.routeTopology.unauthorizedRoutePath)}';
const AUTH_APP_ROUTE_PATTERNS = ${serializeRoutePatternsLiteral(authRuntime.routeTopology.appRoutePatterns)};
const AUTH_PROTECTED_ROUTE_PATTERNS = ${serializeRoutePatternsLiteral(authRuntime.routeTopology.protectedRoutePatterns)};
const AUTH_PUBLIC_ROUTE_PATTERNS = ${serializeRoutePatternsLiteral(authRuntime.routeTopology.publicRoutePatterns)};
const AUTH_ENTRY_ROUTE_PATTERNS = ${serializeRoutePatternsLiteral(authRuntime.routeTopology.authEntryRoutePatterns)};
const AUTH_CALLBACK_ROUTE_PATTERNS = ${serializeRoutePatternsLiteral(authRuntime.routeTopology.callbackRoutePatterns)};
const PENDING_AUTH_REDIRECT_STORAGE_KEY = 'ankh.auth.pendingRedirect.v1';

function normalizeRoutePath(pathname: string): string {
  const [pathOnly = '/'] = pathname.split(/[?#]/u);
  const normalized = pathOnly.replace(/\\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

function normalizeRouteLocation(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return '/';
  const [pathWithMaybeSearch = '/', hash = ''] = trimmed.split('#');
  const [pathOnly = '/', search = ''] = pathWithMaybeSearch.split('?');
  const normalizedPath = normalizeRoutePath(pathOnly);
  const normalizedSearch = search ? \`?\${search}\` : '';
  const normalizedHash = hash ? \`#\${hash}\` : '';
  return \`\${normalizedPath}\${normalizedSearch}\${normalizedHash}\`;
}

function getTopLevelRoute(pathname: string): string {
  const normalized = normalizeRoutePath(pathname);
  if (normalized === '/') return 'index';
  const [, topLevelRoute = 'index'] = normalized.split('/');
  return topLevelRoute;
}

function matchesRoutePatterns(
  pathname: string,
  patterns: readonly { readonly pattern: string }[],
): boolean {
  const normalized = normalizeRoutePath(pathname);
  return patterns.some((routePattern) => new RegExp(routePattern.pattern).test(normalized));
}

function getRoutePatternParamNames(routePath: string): Set<string> {
  const paramNames = new Set<string>();
  for (const segment of routePath.split('/')) {
    if (segment.startsWith('[[...') && segment.endsWith(']]')) {
      paramNames.add(segment.slice(5, -2));
    } else if (segment.startsWith('[...') && segment.endsWith(']')) {
      paramNames.add(segment.slice(4, -1));
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      paramNames.add(segment.slice(1, -1));
    }
  }
  return paramNames;
}

function getMatchedRouteParamNames(
  pathname: string,
  patterns: readonly { readonly path: string; readonly pattern: string }[],
): Set<string> {
  const normalized = normalizeRoutePath(pathname);
  const matchedPattern = patterns.find((routePattern) =>
    new RegExp(routePattern.pattern).test(normalized),
  );
  return matchedPattern ? getRoutePatternParamNames(matchedPattern.path) : new Set<string>();
}

function createRouteSearch(
  params: Record<string, string | string[] | undefined>,
  excludedParamNames: ReadonlySet<string>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (excludedParamNames.has(key)) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === 'string') {
        search.append(key, item);
      }
    }
  }
  const serialized = search.toString();
  return serialized ? \`?\${serialized}\` : '';
}

function createCurrentAuthLocation(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const routeParamNames = getMatchedRouteParamNames(pathname, [
    ...AUTH_APP_ROUTE_PATTERNS,
    ...AUTH_PUBLIC_ROUTE_PATTERNS,
    ...AUTH_ENTRY_ROUTE_PATTERNS,
    ...AUTH_CALLBACK_ROUTE_PATTERNS,
  ]);
  return normalizeRouteLocation(\`\${normalizeRoutePath(pathname)}\${createRouteSearch(params, routeParamNames)}\`);
}

function createRouteLocationHref(
  location: string,
): string | { pathname: string; params: Record<string, string | string[]> } {
  const normalizedLocation = normalizeRouteLocation(location);
  const [pathWithSearch = '/'] = normalizedLocation.split('#');
  const [pathname = '/', search = ''] = pathWithSearch.split('?');
  if (!search) return normalizedLocation;

  const params: Record<string, string | string[]> = {};
  const searchParams = new URLSearchParams(search);
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    if (values.length === 1) {
      const [value = ''] = values;
      params[key] = value;
    } else {
      params[key] = values;
    }
  }

  return { pathname: normalizeRoutePath(pathname), params };
}

function replaceAuthRoute(router: ReturnType<typeof useRouter>, target: string): void {
  const href = createRouteLocationHref(target) as Parameters<typeof router.replace>[0];
  router.replace(href);
  scheduleWebAuthRouteLocationReconciliation(target);
}

function scheduleWebAuthRouteLocationReconciliation(target: string): void {
  const normalizedTarget = normalizeRouteLocation(target);
  if (Platform.OS !== 'web' || !normalizedTarget.includes('?')) return;

  const reconcile = () => reconcileWebAuthRouteLocation(normalizedTarget);
  const reconcileAfterRouteSettles = () => {
    setTimeout(reconcile, 0);
    setTimeout(reconcile, 50);
    setTimeout(reconcile, 250);
  };
  const requestAnimationFrame = Reflect.get(globalThis, 'requestAnimationFrame');
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(reconcileAfterRouteSettles);
    return;
  }

  reconcileAfterRouteSettles();
}

function reconcileWebAuthRouteLocation(target: string): void {
  const location = Reflect.get(globalThis, 'location');
  const history = Reflect.get(globalThis, 'history');
  if (typeof location !== 'object' || location === null) return;
  if (typeof history !== 'object' || history === null) return;

  const pathname = Reflect.get(location, 'pathname');
  const search = Reflect.get(location, 'search');
  if (typeof pathname !== 'string' || typeof search !== 'string') return;
  if (normalizeRoutePath(pathname) !== normalizeRoutePath(target)) return;

  const [targetWithoutHash = target] = target.split('#');
  if (\`\${pathname}\${search}\` === targetWithoutHash) return;

  const replaceState = Reflect.get(history, 'replaceState');
  if (typeof replaceState !== 'function') return;
  replaceState.call(history, Reflect.get(history, 'state'), '', target);
}

function shouldCapturePendingAuthRedirect(
  authState: GeneratedAuthNavigationState,
  location: string,
): boolean {
  if (authState === 'authenticated') return false;
  if (normalizeRoutePath(location) === AUTH_SIGN_OUT_ROUTE_PATH) return false;
  return matchesRoutePatterns(location, AUTH_PROTECTED_ROUTE_PATTERNS);
}

async function getStoredPendingAuthRedirect(): Promise<string | null> {
  const value = await authSessionStorage.getItem(PENDING_AUTH_REDIRECT_STORAGE_KEY);
  return value ? normalizeRouteLocation(value) : null;
}

function getStoredPendingAuthRedirectSnapshot(): string | null {
  if (Platform.OS !== 'web') return null;
  const storage = Reflect.get(globalThis, 'localStorage');
  if (typeof storage !== 'object' || storage === null) return null;
  const getItem = Reflect.get(storage, 'getItem');
  if (typeof getItem !== 'function') return null;
  const value = getItem.call(storage, PENDING_AUTH_REDIRECT_STORAGE_KEY);
  return typeof value === 'string' ? normalizeRouteLocation(value) : null;
}

async function setStoredPendingAuthRedirect(location: string): Promise<void> {
  if (!matchesRoutePatterns(location, AUTH_PROTECTED_ROUTE_PATTERNS)) return;
  await authSessionStorage.setItem(
    PENDING_AUTH_REDIRECT_STORAGE_KEY,
    normalizeRouteLocation(location),
  );
}

async function clearStoredPendingAuthRedirect(): Promise<void> {
  await authSessionStorage.removeItem(PENDING_AUTH_REDIRECT_STORAGE_KEY);
}

function resolveGeneratedAuthNavigationState(): GeneratedAuthNavigationState {
  return isAuthenticated() ? 'authenticated' : 'unauthenticated';
}

function resolveAuthenticatedRouteTarget(pathname: string, pendingRedirect: string | null): string | null {
  const normalized = normalizeRoutePath(pathname);
  if (
    pendingRedirect &&
    matchesRoutePatterns(pendingRedirect, AUTH_APP_ROUTE_PATTERNS) &&
    !matchesRoutePatterns(normalized, AUTH_APP_ROUTE_PATTERNS)
  ) {
    return pendingRedirect;
  }

  if (
    matchesRoutePatterns(normalized, AUTH_ENTRY_ROUTE_PATTERNS) ||
    matchesRoutePatterns(normalized, AUTH_CALLBACK_ROUTE_PATTERNS)
  ) {
    return AUTH_POST_SIGN_IN_ROUTE_TARGET;
  }

  return null;
}

function resolveUnauthenticatedRouteTarget(pathname: string): string | null {
  const normalized = normalizeRoutePath(pathname);
  if (
    matchesRoutePatterns(normalized, AUTH_ENTRY_ROUTE_PATTERNS) ||
    matchesRoutePatterns(normalized, AUTH_CALLBACK_ROUTE_PATTERNS) ||
    matchesRoutePatterns(normalized, AUTH_PUBLIC_ROUTE_PATTERNS)
  ) {
    return null;
  }

  return AUTH_UNAUTHORIZED_ROUTE_TARGET;
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
  const normalized = pathname.replace(/\\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

function getAppHeaderSegments(pathname: string): string[] {
  const normalized = normalizeAppHeaderPath(pathname);
  if (normalized === '/') return ['index'];
  return normalized.replace(/^\\/+/, '').split('/').filter(Boolean);
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
const pathname = usePathname();
const authRouteSearchParams = useGlobalSearchParams<
  Record<string, string | string[] | undefined>
>();
const authRouteSearchParamsKey = JSON.stringify(authRouteSearchParams);
const currentAuthLocation = useMemo(
  () => createCurrentAuthLocation(pathname, authRouteSearchParams),
  [authRouteSearchParams, authRouteSearchParamsKey, pathname],
);
const [authState, setAuthState] = useState<GeneratedAuthNavigationState>('pending');
const [pendingAuthRedirect, setPendingAuthRedirect] = useState<string | null>(null);
const [pendingAuthRedirectReady, setPendingAuthRedirectReady] = useState(false);
const pendingAuthRedirectLocationRef = useRef<string | null>(null);

if (shouldCapturePendingAuthRedirect(authState, currentAuthLocation)) {
  pendingAuthRedirectLocationRef.current = currentAuthLocation;
}

function applyResolvedAuthState(nextAuthState: GeneratedAuthNavigationState): void {
  const pendingRedirectSnapshot =
    pendingAuthRedirectLocationRef.current ?? getStoredPendingAuthRedirectSnapshot();
  if (
    nextAuthState === 'authenticated' &&
    pendingRedirectSnapshot &&
    matchesRoutePatterns(pendingRedirectSnapshot, AUTH_APP_ROUTE_PATTERNS)
  ) {
    setPendingAuthRedirect(pendingRedirectSnapshot);
    setPendingAuthRedirectReady(true);
  }

  setAuthState(nextAuthState);
}

useEffect(() => {
  const mountController = new AbortController();

  void (async () => {
    await bootstrapAuthSession();
    await refreshAuthSessionIfNeeded(authAdapter);
    if (mountController.signal.aborted) return;
    applyResolvedAuthState(resolveGeneratedAuthNavigationState());
  })();

  return () => {
    mountController.abort();
  };
}, []);

useEffect(() => {
  return subscribeToAuthSessionChanges(() => {
    applyResolvedAuthState(resolveGeneratedAuthNavigationState());
  });
}, []);

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') return;
    void refreshAuthSessionIfNeeded(authAdapter)
        .then(() => {
          applyResolvedAuthState(resolveGeneratedAuthNavigationState());
      })
      .catch(() => undefined);
  });

  return () => {
    subscription.remove();
  };
}, []);

useEffect(() => {
  const mountController = new AbortController();

  if (authState !== 'authenticated') {
    setPendingAuthRedirect(null);
    setPendingAuthRedirectReady(false);
    return;
  }

  setPendingAuthRedirectReady(false);
  if (
    pendingAuthRedirectLocationRef.current &&
    matchesRoutePatterns(pendingAuthRedirectLocationRef.current, AUTH_APP_ROUTE_PATTERNS)
  ) {
    setPendingAuthRedirect(pendingAuthRedirectLocationRef.current);
    setPendingAuthRedirectReady(true);
    return;
  }

  void getStoredPendingAuthRedirect()
    .then((storedRedirect) => {
      if (mountController.signal.aborted) return;
      setPendingAuthRedirect(storedRedirect);
      setPendingAuthRedirectReady(true);
    })
    .catch(() => {
      if (mountController.signal.aborted) return;
      setPendingAuthRedirect(null);
      setPendingAuthRedirectReady(true);
    });

  return () => {
    mountController.abort();
  };
}, [authState]);

const isAuthRuntimeReady = authState !== 'pending';
const isResolvingAuthenticatedRedirect =
  authState === 'authenticated' && !pendingAuthRedirectReady;
const authRedirectTarget =
  authState === 'pending' ||
  isResolvingAuthenticatedRedirect${includeStudio ? ' || isStudioAdminPath(pathname)' : ''}
    ? null
    : authState === 'authenticated'
      ? resolveAuthenticatedRouteTarget(pathname, pendingAuthRedirect)
      : resolveUnauthenticatedRouteTarget(pathname);
const shouldUseBootstrapAuthTree =
  authState === 'pending' ||
  isResolvingAuthenticatedRedirect ||
  authRedirectTarget !== null;
const effectiveAuthState: GeneratedAuthNavigationState =
  shouldUseBootstrapAuthTree ? 'pending' : authState;

useEffect(() => {
  if (authRedirectTarget === null) return;
  const redirectController = new AbortController();

  void (async () => {
    if (authState === 'unauthenticated') {
      await setStoredPendingAuthRedirect(
        pendingAuthRedirectLocationRef.current ?? currentAuthLocation,
      );
    } else if (authState === 'authenticated') {
      pendingAuthRedirectLocationRef.current = null;
      await clearStoredPendingAuthRedirect();
    }

    if (redirectController.signal.aborted) return;
    if (normalizeRoutePath(pathname) !== normalizeRoutePath(authRedirectTarget)) {
      replaceAuthRoute(router, authRedirectTarget);
    }
  })().catch(() => {
    if (redirectController.signal.aborted) return;
    if (normalizeRoutePath(pathname) !== normalizeRoutePath(authRedirectTarget)) {
      replaceAuthRoute(router, authRedirectTarget);
    }
  });

  return () => {
    redirectController.abort();
  };
}, [authRedirectTarget, authState, currentAuthLocation, pathname, router]);
`
    : '';
  const rootHookBlock = [allHooks, authRuntimeHook.trim()].filter(Boolean).join('\n\n');
  const indentedRootHookBlock = rootHookBlock.length > 0 ? indentGeneratedBlock(rootHookBlock) : '';

  const innerContentNode = authRuntime
    ? `<InnerContent
      authState={effectiveAuthState}
      isStudioAdminRoute={${includeStudio ? '__DEV__ && isStudioAdminPath(pathname)' : 'false'}}
    />`
    : '<InnerContent />';

  const innerContentSignature = authRuntime
    ? `{
  authState,
  isStudioAdminRoute,
}: {
  authState: GeneratedAuthNavigationState;
  isStudioAdminRoute: boolean;
}`
    : '';
  const innerContentReadyHook = '';
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
  const runtimeContentDeclaration = `const { executeAction } = useRuntimeAction();

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
  const indentedHandleInnerContentReadyDeclaration = '';
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
${allImports}

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
  const studioRuntimeConfig = useMemo(
    () => ({
      disableActions: !previewMode,
      wrapNode: wrapStudioRuntimeNode,
    }),
    [previewMode],
  );
  const studioOutput = (
    <RuntimeRendererConfigProvider value={studioRuntimeConfig}>
      {output}
    </RuntimeRendererConfigProvider>
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
