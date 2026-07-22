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
const AUTH_NAVIGATION_FILE_PATH = 'src/auth/navigation.tsx';
const AUTH_OAUTH_RUNTIME_FILE_PATH = 'src/auth/oauth.ts';
const AUTH_SESSION_FILE_PATH = 'src/auth/session.ts';
const AUTH_BOOTSTRAP_ROUTE_FILE_PATH = 'src/app/_auth-bootstrap.tsx';
const DEFAULT_SIGN_IN_SCREEN_ID = 'screen-auth-sign-in';
const DEFAULT_SIGN_UP_SCREEN_ID = 'screen-auth-sign-up';
const PUBLIC_GUARDS = new Set(['public', 'guest']);
const PROTECTED_GUARDS = new Set(['protected', 'authenticated']);

export interface ResolveAuthLayoutPlanInput {
  manifest: AppManifest;
}

type AuthGeneratedFileKind =
  | 'adapter'
  | 'navigation'
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

type GeneratedRouteAccess = 'public' | 'protected' | 'auth';

interface AuthRouteAccessPlan {
  routeName: string;
  path: string;
  access: GeneratedRouteAccess;
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
  scope: 'global' | 'integrated';
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
  routeTopology: AuthRouteTopologyPlan;
  routeAccess: AuthRouteAccessPlan[];
}

export type AuthLayoutPlan = DisabledAuthLayoutPlan | EnabledAuthLayoutPlan;

export function resolveAuthLayoutPlan(input: ResolveAuthLayoutPlanInput): AuthLayoutPlan {
  const { manifest } = input;
  const { auth } = manifest.infra;
  if (auth?.provider !== 'supabase' || (auth.scope !== 'global' && auth.scope !== 'integrated')) {
    return createDisabledPlan();
  }

  assertNoCustomRoutePaths(manifest.navigator);

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
  const includeSignOutRoute = !hasRouteName(manifest.navigator.routes, signOutRouteName);
  const appNavigator = ensureAuthSignOutRoute(
    manifest.navigator,
    includeSignOutRoute,
    signOutRouteName,
  );
  const routeAccess = collectRouteAccessPlans(appNavigator, auth.scope);
  const publicRoutes = routeAccess
    .filter((route) => route.access === 'public')
    .map((route) => route.routeName);
  const authScreenFiles = buildAuthScreenFilePlans(signInRouteName, signUpRouteName);
  const routeTopology = createAuthRouteTopologyPlan({
    appNavigator,
    callbackRouteName: oauth?.callbackRouteName,
    flowUnauthorizedRoute: flow.unauthorizedRoute,
    postSignInRoute,
    routeAccess,
    signInRouteName,
    signUpRouteName,
  });

  return {
    enabled: true,
    scope: auth.scope,
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
    appNavigator,
    routeTopology,
    routeAccess,
    generatedFiles: [
      ...buildGeneratedFilePlans({
        includeSignOutRoute,
        signOutRouteName,
        signInRouteName,
        signUpRouteName,
        oauth,
      }),
      ...authScreenFiles,
    ],
    authScreenFiles,
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

function buildGeneratedFilePlans(args: {
  includeSignOutRoute: boolean;
  signOutRouteName: string;
  signInRouteName: string;
  signUpRouteName: string;
  oauth: AuthOAuthLayoutPlan | undefined;
}): AuthGeneratedFilePlan[] {
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
      path: AUTH_NAVIGATION_FILE_PATH,
      kind: 'navigation',
    },
    {
      path: AUTH_SESSION_FILE_PATH,
      kind: 'session',
    },
  ];

  if (args.oauth) {
    generatedFiles.push(
      {
        path: AUTH_OAUTH_RUNTIME_FILE_PATH,
        kind: 'oauth-runtime',
      },
      {
        path: resolveRootRouteScreenFilePath(args.oauth.callbackRouteName),
        kind: 'oauth-callback',
        routeName: args.oauth.callbackRouteName,
      },
    );
  }

  if (args.includeSignOutRoute) {
    generatedFiles.push({
      path: resolveGroupedAppRouteScreenFilePath(args.signOutRouteName),
      kind: 'sign-out',
      routeName: args.signOutRouteName,
    });
  }

  return generatedFiles;
}

function buildAuthScreenFilePlans(
  signInRouteName: string,
  signUpRouteName: string,
): AuthGeneratedFilePlan[] {
  return [
    {
      path: resolveRootRouteScreenFilePath(signInRouteName),
      kind: 'auth-screen',
      routeName: signInRouteName,
      screenId: DEFAULT_SIGN_IN_SCREEN_ID,
      authMode: 'signIn',
    },
    {
      path: resolveRootRouteScreenFilePath(signUpRouteName),
      kind: 'auth-screen',
      routeName: signUpRouteName,
      screenId: DEFAULT_SIGN_UP_SCREEN_ID,
      authMode: 'signUp',
    },
  ];
}

function resolveRootRouteScreenFilePath(routeName: string): string {
  return resolveRouteScreenFilePath(routeName);
}

function resolveGroupedAppRouteScreenFilePath(routeName: string): string {
  return resolveRouteScreenFilePath(path.join('(app)', routeName));
}

function resolveRouteScreenFilePath(routeRel: string): string {
  const fileName = `${path.basename(routeRel)}.tsx`;
  const dirRel = path.dirname(routeRel);
  const targetDirRel = dirRel === '.' ? '' : dirRel;
  return normalizeRel(path.join(APP_ROOT_REL, targetDirRel, fileName));
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

function collectRouteAccessPlans(
  navigator: NavigatorSpec,
  scope: 'global' | 'integrated',
): AuthRouteAccessPlan[] {
  const routeAccess = new Map<string, AuthRouteAccessPlan>();
  const defaultAccess: Extract<GeneratedRouteAccess, 'public' | 'protected'> =
    scope === 'global' ? 'protected' : 'public';

  const visit = (
    routes: readonly RouteDefinition[],
    parentSegments: readonly string[],
    inheritedAccess: Extract<GeneratedRouteAccess, 'public' | 'protected'>,
  ) => {
    for (const route of routes) {
      const routeSegments = [...parentSegments, route.name];
      const routePath = segmentsToHref(routeSegments);
      const routeName = routeSegments.filter((segment) => !isRouteGroup(segment)).join('/');
      const access = resolveRouteAccess(route, inheritedAccess);

      routeAccess.set(routePath, {
        routeName: routeName || 'index',
        path: routePath,
        access,
      });

      if (route.navigator?.routes) {
        visit(route.navigator.routes, routeSegments, access);
      }
    }
  };

  visit(navigator.routes, [], defaultAccess);
  return [...routeAccess.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function resolveRouteAccess(
  route: RouteDefinition,
  inheritedAccess: Extract<GeneratedRouteAccess, 'public' | 'protected'>,
): Extract<GeneratedRouteAccess, 'public' | 'protected'> {
  const guards = (route.guards ?? []).map((guard) => guard.trim().toLowerCase());
  if (guards.some((guard) => PROTECTED_GUARDS.has(guard))) {
    return 'protected';
  }
  if (guards.some((guard) => PUBLIC_GUARDS.has(guard))) {
    return 'public';
  }
  return inheritedAccess;
}

function createAuthRouteTopologyPlan(args: {
  appNavigator: NavigatorSpec;
  callbackRouteName: string | undefined;
  flowUnauthorizedRoute: string | undefined;
  postSignInRoute: string;
  routeAccess: readonly AuthRouteAccessPlan[];
  signInRouteName: string;
  signUpRouteName: string;
}): AuthRouteTopologyPlan {
  const appRoutePatterns = collectScreenRoutePatterns(args.appNavigator);
  const protectedRoutePatterns = uniqueRoutePatterns(
    args.routeAccess
      .filter((route) => route.access === 'protected')
      .map((route) => buildRoutePattern(route.path)),
  );
  const publicRoutePatterns = uniqueRoutePatterns(
    args.routeAccess
      .filter((route) => route.access === 'public')
      .map((route) => buildRoutePattern(route.path)),
  );
  const authEntryRoutePatterns = [
    buildRoutePattern(routeNameToHref(args.signInRouteName)),
    buildRoutePattern(routeNameToHref(args.signUpRouteName)),
  ];
  const callbackRoutePatterns = args.callbackRouteName
    ? [buildRoutePattern(routeNameToHref(args.callbackRouteName))]
    : [];
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

function collectScreenRoutePatterns(navigator: NavigatorSpec): AuthRoutePatternPlan[] {
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

function assertNoCustomRoutePaths(navigator: NavigatorSpec): void {
  const visit = (routes: readonly RouteDefinition[], parentSegments: readonly string[]) => {
    for (const route of routes) {
      const routePath = (route as { path?: unknown }).path;
      if (typeof routePath === 'string' && routePath.trim().length > 0) {
        const routeName = [...parentSegments, route.name]
          .filter((segment) => !isRouteGroup(segment))
          .join('/');
        throw new Error(
          `RouteDefinition.path is not supported by generated Expo Router layout yet for route "${routeName || route.name}". Use route.name until route.path support is implemented.`,
        );
      }

      if (route.navigator) {
        visit(route.navigator.routes, [...parentSegments, route.name]);
      }
    }
  };

  visit(navigator.routes, []);
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

function hasRouteName(routes: readonly RouteDefinition[], routeName: string): boolean {
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
