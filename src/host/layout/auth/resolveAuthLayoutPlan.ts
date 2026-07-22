import {
  type AppManifest,
  type AuthOAuthProviderConfig,
  type IconSpec,
  type NavigatorSpec,
  resolveAuthFlow,
  type RouteDefinition,
} from '@ankhorage/contracts';
import { getSupabaseOAuthProviderDefinition } from '@ankhorage/supabase-auth';
import path from 'path';

const APP_ROOT_REL = 'src/app';
const AUTH_ADAPTER_FILE_PATH = 'src/auth/adapter.ts';
const AUTH_OAUTH_RUNTIME_FILE_PATH = 'src/auth/oauth.ts';
const AUTH_SESSION_FILE_PATH = 'src/auth/session.ts';
const AUTH_BOOTSTRAP_ROUTE_FILE_PATH = 'src/app/_auth-bootstrap.tsx';
const AUTH_SIGN_OUT_FILE_PATH = 'src/app/(app)/sign-out.tsx';
const DEFAULT_SIGN_IN_SCREEN_ID = 'screen-auth-sign-in';
const DEFAULT_SIGN_IN_LABEL = 'Sign in';
const DEFAULT_SIGN_UP_SCREEN_ID = 'screen-auth-sign-up';
const DEFAULT_SIGN_UP_LABEL = 'Sign up';
const PUBLIC_GUARD = 'public';

export interface ResolveAuthLayoutPlanInput {
  manifest: AppManifest;
}

type AuthGeneratedFileKind =
  | 'adapter'
  | 'session'
  | 'sign-out'
  | 'auth-screen'
  | 'oauth-runtime'
  | 'oauth-callback'
  | 'auth-bootstrap';

export interface AuthGeneratedFilePlan {
  path: string;
  kind: AuthGeneratedFileKind;
  routeName?: string;
  screenId?: string;
  authMode?: 'signIn' | 'signUp';
}

export interface GeneratedOAuthProviderPlan {
  id: 'google' | 'apple';
  label: string;
  scopes: string[];
  queryParams: Record<string, string>;
  icon?: IconSpec;
}

export interface AuthOAuthLayoutPlan {
  callbackRoute: string;
  callbackRouteName: string;
  callbackTopLevelRouteName: string;
  providers: GeneratedOAuthProviderPlan[];
}

interface AuthRoutePatternPlan {
  path: string;
  pattern: string;
}

interface AuthRouteTopologyPlan {
  appRoutePatterns: AuthRoutePatternPlan[];
  protectedRoutePatterns: AuthRoutePatternPlan[];
  publicRoutePatterns: AuthRoutePatternPlan[];
  authEntryRoutePatterns: AuthRoutePatternPlan[];
  callbackRoutePatterns: AuthRoutePatternPlan[];
  unauthorizedRoutePath: string;
  postSignInRoutePath: string;
}

interface AuthPublicRoutePlan {
  routeName: string;
  path: string;
}

interface BaseAuthLayoutPlan {
  publicRoutes: string[];
  generatedFiles: AuthGeneratedFilePlan[];
  authScreenFiles: AuthGeneratedFilePlan[];
}

interface DisabledAuthLayoutPlan extends BaseAuthLayoutPlan {
  enabled: false;
}

export interface EnabledAuthLayoutPlan extends BaseAuthLayoutPlan {
  enabled: true;
  provider: 'supabase';
  signInRoute: string;
  signInRouteName: string;
  signUpRoute: string;
  signUpRouteName: string;
  signOutRoute: string;
  signOutRouteName: string;
  postSignInRoute: string;
  postSignInRouteName: string;
  oauth?: AuthOAuthLayoutPlan;
  appNavigator: NavigatorSpec;
  authNavigator: NavigatorSpec;
  routeTopology: AuthRouteTopologyPlan;
}

export type AuthLayoutPlan = DisabledAuthLayoutPlan | EnabledAuthLayoutPlan;

export function resolveAuthLayoutPlan(input: ResolveAuthLayoutPlanInput): AuthLayoutPlan {
  const { manifest } = input;
  const { auth } = manifest.infra;
  if (auth?.scope !== 'global' || auth.provider !== 'supabase') {
    return createDisabledPlan();
  }

  const flow = resolveAuthFlow(auth.flow);
  const signInRoute = flow.signInRoute.trim();
  const signUpRoute = flow.signUpRoute?.trim() ?? '';
  const signOutRoute = flow.signOutRoute?.trim() ?? '';
  const postSignInRoute = flow.postSignInRoute.trim();
  if (!signInRoute || !signUpRoute || !signOutRoute || !postSignInRoute) {
    return createDisabledPlan();
  }

  const signInRouteName = authFlowPathToRouteName(signInRoute);
  const signUpRouteName = authFlowPathToRouteName(signUpRoute);
  const signOutRouteName = authFlowPathToRouteName(signOutRoute);
  const postSignInRouteName = authFlowPathToRouteName(postSignInRoute);

  if (!signInRouteName || !signUpRouteName || !signOutRouteName || !postSignInRouteName) {
    return createDisabledPlan();
  }

  const oauth = resolveOAuthLayoutPlan(auth.oauth);
  const authRouteNames = {
    signInRouteName,
    signUpRouteName,
  };
  const publicRoutePlans = collectPublicRoutePlans(
    manifest,
    flow.unauthorizedRoute,
    signInRouteName,
    signUpRouteName,
  );
  const publicRoutes = publicRoutePlans.map((route) => route.routeName);
  const groupedNavigators = getGroupedAuthNavigators(manifest);
  const hasSignOutRoute = groupedNavigators
    ? groupedNavigators.appNavigator.routes.some((route) => route.name === signOutRouteName)
    : manifest.navigator.routes.some((route) => route.name === signOutRouteName);
  const includeSignOutRoute = !hasSignOutRoute;

  const partitionedNavigators = groupedNavigators
    ? partitionGroupedNavigatorsForAuth(groupedNavigators, {
        includeSignOutRoute,
        publicRoutePlans,
        signInRouteName,
        signUpRouteName,
        signOutRouteName,
      })
    : partitionRootNavigatorForAuth(
        manifest,
        authRouteNames,
        publicRoutePlans,
        includeSignOutRoute,
        signOutRouteName,
      );

  const authNavigator = groupedNavigators
    ? partitionedNavigators.authNavigator
    : ensureGlobalAuthEntryRoutes(partitionedNavigators.authNavigator, authRouteNames);
  const routeTopology = createAuthRouteTopologyPlan({
    appNavigator: partitionedNavigators.appNavigator,
    authNavigator,
    callbackRouteName: oauth?.callbackRouteName,
    flowUnauthorizedRoute: flow.unauthorizedRoute,
    postSignInRoute,
    publicRoutePlans,
    signInRouteName,
    signUpRouteName,
  });

  return {
    enabled: true,
    provider: 'supabase',
    signInRoute,
    signInRouteName,
    signUpRoute,
    signUpRouteName,
    signOutRoute,
    signOutRouteName,
    postSignInRoute,
    postSignInRouteName,
    ...(oauth ? { oauth } : {}),
    publicRoutes,
    appNavigator: partitionedNavigators.appNavigator,
    authNavigator,
    routeTopology,
    generatedFiles: buildGeneratedFilePlans(includeSignOutRoute, signOutRouteName, oauth),
    authScreenFiles: [
      ...collectAuthScreenFiles(partitionedNavigators.appNavigator, '(app)', {
        signInRouteName,
        signUpRouteName,
      }),
      ...collectAuthScreenFiles(authNavigator, '(auth)', {
        signInRouteName,
        signUpRouteName,
      }),
    ],
  };
}

function resolveOAuthLayoutPlan(
  oauth: AppManifest['infra']['auth'] extends infer _Auth
    ? NonNullable<AppManifest['infra']['auth']>['oauth']
    : never,
): AuthOAuthLayoutPlan | undefined {
  if (oauth?.enabled !== true) {
    return undefined;
  }

  const callbackRoute = normalizeCanonicalCallbackRoute(oauth.callbackRoute);
  const enabledProviders = oauth.providers.filter((provider) => provider.enabled === true);
  if (enabledProviders.length === 0) {
    throw new Error('OAuth is enabled but no provider is enabled.');
  }

  const providers = enabledProviders.map(resolveGeneratedOAuthProvider);
  const callbackRouteName = authFlowPathToRouteName(callbackRoute);
  const [callbackTopLevelRouteName = callbackRouteName] = callbackRouteName.split('/');

  return {
    callbackRoute,
    callbackRouteName,
    callbackTopLevelRouteName,
    providers,
  };
}

function resolveGeneratedOAuthProvider(
  provider: AuthOAuthProviderConfig,
): GeneratedOAuthProviderPlan {
  const definition = getSupabaseOAuthProviderDefinition(provider.id);
  if (definition === null) {
    throw new Error(`OAuth provider "${provider.id}" is not supported by Supabase Auth.`);
  }

  const credentialsRef = provider.credentialsRef?.trim() ?? '';
  if (credentialsRef.length === 0) {
    throw new Error(`OAuth provider "${provider.id}" is enabled but has no credentials reference.`);
  }

  const scopes = uniqueNonEmpty(provider.scopes ?? definition.defaultScopes);
  const configuredLabel = provider.label?.trim();
  const queryParams = Object.fromEntries(
    Object.entries(provider.queryParams ?? {})
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .filter(([key]) => key.length > 0),
  );

  return {
    id: definition.id,
    label:
      configuredLabel === undefined || configuredLabel.length === 0
        ? `Continue with ${definition.label}`
        : configuredLabel,
    scopes,
    queryParams,
    ...(provider.icon ? { icon: provider.icon } : {}),
  };
}

function normalizeCanonicalCallbackRoute(route: string): string {
  const normalized = route.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (
    normalized.length === 0 ||
    normalized.includes('?') ||
    normalized.includes('#') ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('OAuth callbackRoute must be a canonical relative application route.');
  }
  return segments.join('/');
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function createDisabledPlan(): DisabledAuthLayoutPlan {
  return {
    enabled: false,
    publicRoutes: [],
    generatedFiles: [],
    authScreenFiles: [],
  };
}

function buildGeneratedFilePlans(
  includeSignOutRoute: boolean,
  signOutRouteName: string,
  oauth: AuthOAuthLayoutPlan | undefined,
): AuthGeneratedFilePlan[] {
  const generatedFiles: AuthGeneratedFilePlan[] = [
    {
      path: AUTH_BOOTSTRAP_ROUTE_FILE_PATH,
      kind: 'auth-bootstrap',
    },
    {
      path: AUTH_ADAPTER_FILE_PATH,
      kind: 'adapter',
    },
    {
      path: AUTH_SESSION_FILE_PATH,
      kind: 'session',
    },
  ];

  if (oauth) {
    generatedFiles.push(
      {
        path: AUTH_OAUTH_RUNTIME_FILE_PATH,
        kind: 'oauth-runtime',
      },
      {
        path: normalizeRel(path.join(APP_ROOT_REL, '(auth)', `${oauth.callbackRouteName}.tsx`)),
        kind: 'oauth-callback',
        routeName: oauth.callbackRouteName,
      },
    );
  }

  if (includeSignOutRoute) {
    generatedFiles.push({
      path: AUTH_SIGN_OUT_FILE_PATH,
      kind: 'sign-out',
      routeName: signOutRouteName,
    });
  }

  return generatedFiles;
}

function collectAuthScreenFiles(
  navigator: NavigatorSpec,
  currentRel: string,
  authRouteNames: {
    signInRouteName: string;
    signUpRouteName: string;
  },
): AuthGeneratedFilePlan[] {
  const { signInRouteName, signUpRouteName } = authRouteNames;
  const files: AuthGeneratedFilePlan[] = [];

  const visit = (node: NavigatorSpec, parentRel: string) => {
    for (const route of node.routes) {
      const nextRel = parentRel ? path.join(parentRel, route.name) : route.name;

      if (route.navigator) {
        visit(route.navigator, nextRel);
        continue;
      }

      if (!route.screenId || (route.name !== signInRouteName && route.name !== signUpRouteName)) {
        continue;
      }

      files.push({
        path: resolveRouteScreenFilePath(nextRel),
        kind: 'auth-screen',
        routeName: route.name,
        screenId: route.screenId,
        authMode: route.name === signUpRouteName ? 'signUp' : 'signIn',
      });
    }
  };

  visit(navigator, currentRel);
  return files;
}

function resolveRouteScreenFilePath(routeRel: string): string {
  const fileName = `${path.basename(routeRel)}.tsx`;
  const dirRel = path.dirname(routeRel);
  const targetDirRel = dirRel === '.' ? '' : dirRel;
  return normalizeRel(path.join(APP_ROOT_REL, targetDirRel, fileName));
}

function getGroupedAuthNavigators(
  manifest: AppManifest,
): { appNavigator: NavigatorSpec; authNavigator: NavigatorSpec } | null {
  if (manifest.navigator.type !== 'stack') {
    return null;
  }

  const appGroup = manifest.navigator.routes.find((route) => route.name === '(app)');
  const authGroup = manifest.navigator.routes.find((route) => route.name === '(auth)');

  if (!appGroup?.navigator || !authGroup?.navigator) {
    return null;
  }

  return {
    appNavigator: appGroup.navigator,
    authNavigator: authGroup.navigator,
  };
}

function ensureAuthSignOutRoute(
  navigator: NavigatorSpec,
  includeAuthSignOutRoute: boolean,
  signOutRouteName: string,
): NavigatorSpec {
  if (
    !includeAuthSignOutRoute ||
    navigator.routes.some((route) => route.name === signOutRouteName)
  ) {
    return navigator;
  }

  return {
    ...navigator,
    routes: [
      ...navigator.routes,
      {
        name: signOutRouteName,
        ...(navigator.type === 'stack' ? {} : { hideInTabBar: true }),
      },
    ],
  };
}

function ensureGlobalAuthEntryRoutes(
  navigator: NavigatorSpec,
  authRouteNames: {
    signInRouteName: string;
    signUpRouteName: string;
  },
): NavigatorSpec {
  const withSignIn = ensureGlobalAuthEntryRoute(navigator, {
    routeName: authRouteNames.signInRouteName,
    routeLabel: DEFAULT_SIGN_IN_LABEL,
    defaultScreenId: DEFAULT_SIGN_IN_SCREEN_ID,
  });

  return ensureGlobalAuthEntryRoute(withSignIn, {
    routeName: authRouteNames.signUpRouteName,
    routeLabel: DEFAULT_SIGN_UP_LABEL,
    defaultScreenId: DEFAULT_SIGN_UP_SCREEN_ID,
  });
}

function ensureGlobalAuthEntryRoute(
  navigator: NavigatorSpec,
  args: {
    routeName: string;
    routeLabel: string;
    defaultScreenId: string;
  },
): NavigatorSpec {
  const { routeName, routeLabel, defaultScreenId } = args;
  if (hasRouteName(navigator.routes, routeName)) {
    return navigator;
  }

  return {
    ...navigator,
    routes: [
      ...navigator.routes,
      buildGeneratedAuthRoute({
        routeName,
        routeLabel,
        screenId: defaultScreenId,
        navigatorType: navigator.type,
      }),
    ],
  };
}

function partitionRootNavigatorForAuth(
  manifest: AppManifest,
  authRouteNames: {
    signInRouteName: string;
    signUpRouteName: string;
  },
  publicRoutePlans: readonly AuthPublicRoutePlan[],
  includeAuthSignOutRoute: boolean,
  signOutRouteName: string,
): { appNavigator: NavigatorSpec; authNavigator: NavigatorSpec } {
  const publicPathSet = new Set(publicRoutePlans.map((route) => route.path));
  const authEntryPathSet = new Set([
    routeNameToHref(authRouteNames.signInRouteName),
    routeNameToHref(authRouteNames.signUpRouteName),
  ]);
  const appNavigatorWithoutAuthEntries = filterNavigatorRoutesByPath(
    manifest.navigator,
    authEntryPathSet,
    'exclude',
  );
  const authNavigatorPublicRoutes = filterNavigatorRoutesByPath(
    manifest.navigator,
    publicPathSet,
    'include',
  );

  const appNavigator = ensureAuthSignOutRoute(
    appNavigatorWithoutAuthEntries,
    includeAuthSignOutRoute,
    signOutRouteName,
  );
  const authNavigator: NavigatorSpec = {
    type: 'stack',
    initialRouteName: authRouteNames.signInRouteName,
    routes: [...authNavigatorPublicRoutes.routes],
  };

  return { appNavigator, authNavigator };
}

function partitionGroupedNavigatorsForAuth(
  groupedNavigators: { appNavigator: NavigatorSpec; authNavigator: NavigatorSpec },
  args: {
    publicRoutePlans: readonly AuthPublicRoutePlan[];
    includeSignOutRoute: boolean;
    signInRouteName: string;
    signUpRouteName: string;
    signOutRouteName: string;
  },
): { appNavigator: NavigatorSpec; authNavigator: NavigatorSpec } {
  const publicPathSet = new Set(args.publicRoutePlans.map((route) => route.path));
  const authEntryPathSet = new Set([
    routeNameToHref(args.signInRouteName),
    routeNameToHref(args.signUpRouteName),
  ]);
  const appNavigator = ensureAuthSignOutRoute(
    filterNavigatorRoutesByPath(groupedNavigators.appNavigator, authEntryPathSet, 'exclude'),
    args.includeSignOutRoute,
    args.signOutRouteName,
  );
  const existingAuthPaths = new Set(
    collectRoutePatterns(groupedNavigators.authNavigator).map((route) => route.path),
  );
  const copiedPublicNavigator = filterNavigatorRoutesByPath(
    groupedNavigators.appNavigator,
    new Set([...publicPathSet].filter((routePath) => !existingAuthPaths.has(routePath))),
    'include',
  );
  const authNavigator = ensureGlobalAuthEntryRoutes(
    {
      ...groupedNavigators.authNavigator,
      routes: [...groupedNavigators.authNavigator.routes, ...copiedPublicNavigator.routes],
    },
    {
      signInRouteName: args.signInRouteName,
      signUpRouteName: args.signUpRouteName,
    },
  );

  return { appNavigator, authNavigator };
}

function filterNavigatorRoutesByPath(
  navigator: NavigatorSpec,
  routePathSet: ReadonlySet<string>,
  mode: 'include' | 'exclude',
): NavigatorSpec {
  const routes = filterRoutesByPath(navigator.routes, [], routePathSet, mode);
  return {
    ...navigator,
    ...(resolveNavigatorInitialRouteName(navigator.initialRouteName, routes)
      ? { initialRouteName: resolveNavigatorInitialRouteName(navigator.initialRouteName, routes) }
      : {}),
    routes,
  };
}

function filterRoutesByPath(
  routes: readonly RouteDefinition[],
  parentSegments: readonly string[],
  routePathSet: ReadonlySet<string>,
  mode: 'include' | 'exclude',
): RouteDefinition[] {
  const nextRoutes: RouteDefinition[] = [];

  for (const route of routes) {
    const routeSegments = [...parentSegments, route.name];
    const routePath = segmentsToHref(routeSegments);
    const routeMatches = route.screenId ? routePathSet.has(routePath) : false;
    const nextNavigator = route.navigator
      ? filterNavigatorRoutesByPathWithSegments(route.navigator, routeSegments, routePathSet, mode)
      : undefined;
    const hasKeptChildren = (nextNavigator?.routes.length ?? 0) > 0;
    const keepRoute =
      mode === 'include'
        ? routeMatches || hasKeptChildren
        : (!routeMatches && route.screenId !== undefined) ||
          hasKeptChildren ||
          (!route.screenId && !route.navigator);

    if (!keepRoute) continue;

    nextRoutes.push({
      ...route,
      ...(nextNavigator ? { navigator: nextNavigator } : {}),
    });
  }

  return nextRoutes;
}

function filterNavigatorRoutesByPathWithSegments(
  navigator: NavigatorSpec,
  parentSegments: readonly string[],
  routePathSet: ReadonlySet<string>,
  mode: 'include' | 'exclude',
): NavigatorSpec {
  const routes = filterRoutesByPath(navigator.routes, parentSegments, routePathSet, mode);
  return {
    ...navigator,
    ...(resolveNavigatorInitialRouteName(navigator.initialRouteName, routes)
      ? { initialRouteName: resolveNavigatorInitialRouteName(navigator.initialRouteName, routes) }
      : {}),
    routes,
  };
}

function resolveNavigatorInitialRouteName(
  initialRouteName: string | undefined,
  routes: readonly RouteDefinition[],
): string | undefined {
  if (initialRouteName && routes.some((route) => route.name === initialRouteName)) {
    return initialRouteName;
  }

  return routes[0]?.name;
}

function buildGeneratedAuthRoute(args: {
  routeName: string;
  routeLabel: string;
  screenId: string;
  navigatorType: NavigatorSpec['type'];
}): RouteDefinition {
  const { routeName, routeLabel, screenId, navigatorType } = args;

  return {
    name: routeName,
    label: routeLabel,
    screenId,
    guards: [PUBLIC_GUARD],
    ...(navigatorType === 'tabs' ? { hideInTabBar: true } : {}),
  };
}

function collectPublicRoutePlans(
  manifest: AppManifest,
  unauthorizedRoute: string | undefined,
  signInRouteName: string,
  signUpRouteName: string,
): AuthPublicRoutePlan[] {
  const unauthorizedRouteName = authFlowPathToRouteName(
    unauthorizedRoute?.trim() ?? signInRouteName,
  );
  const publicRoutes = new Map<string, AuthPublicRoutePlan>();
  addPublicRoutePlan(publicRoutes, signInRouteName);
  addPublicRoutePlan(publicRoutes, signUpRouteName);
  addPublicRoutePlan(publicRoutes, unauthorizedRouteName || signInRouteName);

  const visit = (
    routes: readonly RouteDefinition[],
    parentSegments: readonly string[],
    hasPublicAncestor: boolean,
  ) => {
    for (const route of routes) {
      const routeSegments = [...parentSegments, route.name];
      const routeName = routeSegments.filter((segment) => !isRouteGroup(segment)).join('/');
      const routePath = segmentsToHref(routeSegments);
      const normalizedGuards = (route.guards ?? []).map((guard) => guard.trim().toLowerCase());
      const isPublicRoute =
        hasPublicAncestor ||
        normalizedGuards.some((guard) => guard === 'public' || guard === 'guest');

      if (isPublicRoute && route.screenId) {
        publicRoutes.set(routePath, { routeName, path: routePath });
      }

      if (route.navigator?.routes) {
        visit(route.navigator.routes, routeSegments, isPublicRoute);
      }
    }
  };

  visit(manifest.navigator.routes, [], false);

  return [...publicRoutes.values()];
}

function addPublicRoutePlan(
  publicRoutes: Map<string, AuthPublicRoutePlan>,
  routeName: string,
): void {
  const path = routeNameToHref(routeName);
  publicRoutes.set(path, { routeName, path });
}

function createAuthRouteTopologyPlan(args: {
  appNavigator: NavigatorSpec;
  authNavigator: NavigatorSpec;
  callbackRouteName: string | undefined;
  flowUnauthorizedRoute: string | undefined;
  postSignInRoute: string;
  publicRoutePlans: readonly AuthPublicRoutePlan[];
  signInRouteName: string;
  signUpRouteName: string;
}): AuthRouteTopologyPlan {
  const appRoutePatterns = collectRoutePatterns(args.appNavigator);
  const authEntryPaths = new Set([
    routeNameToHref(args.signInRouteName),
    routeNameToHref(args.signUpRouteName),
  ]);
  const callbackRoutePatterns = args.callbackRouteName
    ? [buildRoutePattern(routeNameToHref(args.callbackRouteName))]
    : [];
  const publicRoutePatterns = uniqueRoutePatterns(
    args.publicRoutePlans
      .map((routePlan) => buildRoutePattern(routePlan.path))
      .filter((routePattern) => !authEntryPaths.has(routePattern.path)),
  );
  const authEntryRoutePatterns = [...authEntryPaths].map((routePath) =>
    buildRoutePattern(routePath),
  );
  const publicPathSet = new Set(publicRoutePatterns.map((routePattern) => routePattern.path));
  const protectedRoutePatterns = appRoutePatterns.filter(
    (routePattern) => !publicPathSet.has(routePattern.path),
  );
  const unauthorizedRoutePath = routeNameToHref(
    authFlowPathToRouteName(args.flowUnauthorizedRoute?.trim() ?? args.signInRouteName),
  );
  const postSignInRoutePath = routeNameToHref(authFlowPathToRouteName(args.postSignInRoute));

  assertRouteTarget('unauthorizedRoute', unauthorizedRoutePath, [
    ...authEntryRoutePatterns,
    ...publicRoutePatterns,
    ...callbackRoutePatterns,
  ]);
  assertRouteTarget('postSignInRoute', postSignInRoutePath, appRoutePatterns, {
    allowRoot: true,
  });

  return {
    appRoutePatterns,
    protectedRoutePatterns,
    publicRoutePatterns,
    authEntryRoutePatterns,
    callbackRoutePatterns,
    unauthorizedRoutePath,
    postSignInRoutePath,
  };
}

function collectRoutePatterns(navigator: NavigatorSpec): AuthRoutePatternPlan[] {
  const patterns: AuthRoutePatternPlan[] = [];

  const visit = (node: NavigatorSpec, parentSegments: string[]) => {
    for (const route of node.routes) {
      const routeSegments = [...parentSegments, route.name];
      if (route.screenId) {
        patterns.push(buildRoutePattern(segmentsToHref(routeSegments)));
      }

      if (route.navigator) {
        visit(route.navigator, routeSegments);
      }
    }
  };

  visit(navigator, []);
  return uniqueRoutePatterns(patterns);
}

function uniqueRoutePatterns(patterns: readonly AuthRoutePatternPlan[]): AuthRoutePatternPlan[] {
  const byPath = new Map<string, AuthRoutePatternPlan>();
  for (const pattern of patterns) {
    byPath.set(pattern.path, pattern);
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function segmentsToHref(segments: readonly string[]): string {
  const pathSegments = segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== 'index' && !isRouteGroup(segment));

  return pathSegments.length === 0 ? '/' : `/${pathSegments.join('/')}`;
}

function routeNameToHref(routeName: string): string {
  return segmentsToHref(routeName.split('/'));
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function buildRoutePattern(routePath: string): AuthRoutePatternPlan {
  const normalizedPath = normalizeRoutePath(routePath);
  if (normalizedPath === '/') {
    return { path: '/', pattern: '^/$' };
  }

  const patternSegments = normalizedPath.replace(/^\/+/, '').split('/').map(routeSegmentToPattern);

  return {
    path: normalizedPath,
    pattern: `^/${patternSegments.join('/')}$`,
  };
}

function routeSegmentToPattern(segment: string): string {
  if (segment.startsWith('[[...') && segment.endsWith(']]')) {
    return '.*';
  }

  if (segment.startsWith('[...') && segment.endsWith(']')) {
    return '.+';
  }

  if (segment.startsWith('[') && segment.endsWith(']')) {
    return '[^/]+';
  }

  return escapeRegExp(segment);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function normalizeRoutePath(routePath: string): string {
  const normalized = routePath.trim().replace(/\/+/gu, '/').replace(/\/+$/u, '');
  if (!normalized || normalized === 'index') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function assertRouteTarget(
  label: string,
  routePath: string,
  patterns: readonly AuthRoutePatternPlan[],
  options: { allowRoot?: boolean } = {},
): void {
  if (routePath === '/' && options.allowRoot === true) {
    return;
  }

  if (
    patterns.some(
      (pattern) => pattern.path === routePath || new RegExp(pattern.pattern).test(routePath),
    )
  ) {
    return;
  }

  throw new Error(`Auth ${label} "${routePath}" does not match a generated route.`);
}

function hasRouteName(routes: RouteDefinition[], routeName: string): boolean {
  for (const route of routes) {
    if (route.name === routeName) {
      return true;
    }

    if (route.navigator?.routes && hasRouteName(route.navigator.routes, routeName)) {
      return true;
    }
  }

  return false;
}

function normalizeRel(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function authFlowPathToRouteName(routePath: string): string {
  const normalized = routePath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized === '' ? 'index' : normalized;
}
