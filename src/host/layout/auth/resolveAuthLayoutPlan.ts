import {
  type AppManifest,
  type AuthOAuthProviderConfig,
  type IconSpec,
  type NavigatorNode,
  resolveAuthFlow,
  type RouteDefinition,
} from '@ankhorage/contracts';
import { getSupabaseOAuthProviderDefinition } from '@ankhorage/supabase-auth';
import path from 'path';

const APP_ROOT_REL = 'src/app';
const AUTH_ADAPTER_FILE_PATH = 'src/auth/adapter.ts';
const AUTH_FORM_FILE_PATH = 'src/auth/form.ts';
const AUTH_NAVIGATION_FILE_PATH = 'src/auth/navigation.ts';
const AUTH_OAUTH_COMPLETION_FILE_PATH = 'src/auth/oauth-completion.ts';
const AUTH_OAUTH_RUNTIME_FILE_PATH = 'src/auth/oauth.ts';
const AUTH_OAUTH_STATE_FILE_PATH = 'src/auth/oauth-state.ts';
const AUTH_SCREEN_RUNTIME_FILE_PATH = 'src/screens/auth-screen.tsx';
const AUTH_SCREEN_CONTROLLER_FILE_PATH = 'src/auth/screen-controller.ts';
const AUTH_SESSION_FILE_PATH = 'src/auth/session.ts';
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
  | 'form'
  | 'navigation'
  | 'session'
  | 'sign-out'
  | 'auth-screen'
  | 'screen-controller'
  | 'oauth-runtime'
  | 'oauth-completion'
  | 'oauth-state'
  | 'oauth-callback'
  | 'screen-runtime';

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
  appNavigator: NavigatorNode;
  authNavigator: NavigatorNode;
}

export type AuthLayoutPlan = DisabledAuthLayoutPlan | EnabledAuthLayoutPlan;

/***
 * Derive the generated auth/navigation/file plan for a Studio manifest with global Supabase Auth.
 * @todo Move auth generation planning from the host layout edge into the auth/routes application domain.
 */
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
  const publicRoutes = collectPublicRoutes(
    manifest,
    flow.unauthorizedRoute,
    signInRouteName,
    signUpRouteName,
    oauth?.callbackTopLevelRouteName,
  );
  const groupedNavigators = getGroupedAuthNavigators(manifest);
  const hasSignOutRoute = groupedNavigators
    ? groupedNavigators.appNavigator.routes.some((route) => route.name === signOutRouteName)
    : manifest.navigator.routes.some((route) => route.name === signOutRouteName);
  const includeSignOutRoute = !hasSignOutRoute;

  const partitionedNavigators = groupedNavigators
    ? {
        appNavigator: ensureAuthSignOutRoute(
          groupedNavigators.appNavigator,
          includeSignOutRoute,
          signOutRouteName,
        ),
        authNavigator: ensureGlobalAuthEntryRoutes(groupedNavigators.authNavigator, {
          signInRouteName,
          signUpRouteName,
        }),
      }
    : partitionRootNavigatorForAuth(
        manifest,
        signInRouteName,
        publicRoutes,
        includeSignOutRoute,
        signOutRouteName,
      );

  const authNavigator = groupedNavigators
    ? partitionedNavigators.authNavigator
    : ensureGlobalAuthEntryRoutes(partitionedNavigators.authNavigator, {
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

/*** Derive OAuth callback and provider generation metadata for enabled OAuth configuration. */
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

/*** Resolve one enabled auth provider into the generated OAuth provider contract. */
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

/***
 * Normalize and validate a canonical relative application route without query/hash or traversal segments.
 * @utility @ankhorage/utility/route
 */
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

/***
 * Trim values, remove empty entries, and preserve first-occurrence order while deduplicating.
 * @utility @ankhorage/utility/array
 */
function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/*** Create the explicit no-auth-generation plan. */
function createDisabledPlan(): DisabledAuthLayoutPlan {
  return {
    enabled: false,
    publicRoutes: [],
    generatedFiles: [],
    authScreenFiles: [],
  };
}

/*** Build the generated auth support-file plan for the active auth/OAuth configuration. */
function buildGeneratedFilePlans(
  includeSignOutRoute: boolean,
  signOutRouteName: string,
  oauth: AuthOAuthLayoutPlan | undefined,
): AuthGeneratedFilePlan[] {
  const generatedFiles: AuthGeneratedFilePlan[] = [
    { path: AUTH_ADAPTER_FILE_PATH, kind: 'adapter' },
    { path: AUTH_SESSION_FILE_PATH, kind: 'session' },
    { path: AUTH_NAVIGATION_FILE_PATH, kind: 'navigation' },
    { path: AUTH_FORM_FILE_PATH, kind: 'form' },
    { path: AUTH_SCREEN_CONTROLLER_FILE_PATH, kind: 'screen-controller' },
    { path: AUTH_SCREEN_RUNTIME_FILE_PATH, kind: 'screen-runtime' },
  ];

  if (oauth) {
    generatedFiles.push(
      { path: AUTH_OAUTH_COMPLETION_FILE_PATH, kind: 'oauth-completion' },
      { path: AUTH_OAUTH_STATE_FILE_PATH, kind: 'oauth-state' },
      { path: AUTH_OAUTH_RUNTIME_FILE_PATH, kind: 'oauth-runtime' },
      {
        path: normalizeRel(path.join(APP_ROOT_REL, `${oauth.callbackRouteName}.tsx`)),
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

/*** Collect route files that should render generated sign-in/sign-up screens. */
function collectAuthScreenFiles(
  navigator: NavigatorNode,
  currentRel: string,
  authRouteNames: {
    signInRouteName: string;
    signUpRouteName: string;
  },
): AuthGeneratedFilePlan[] {
  const { signInRouteName, signUpRouteName } = authRouteNames;
  const files: AuthGeneratedFilePlan[] = [];

  /*** Walk nested navigators while retaining the generated relative route path. */
  const visit = (node: NavigatorNode, parentRel: string) => {
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

/*** Resolve one leaf route's generated TSX file path under src/app. */
function resolveRouteScreenFilePath(routeRel: string): string {
  const fileName = `${path.basename(routeRel)}.tsx`;
  const dirRel = path.dirname(routeRel);
  const targetDirRel = dirRel === '.' ? '' : dirRel;
  return normalizeRel(path.join(APP_ROOT_REL, targetDirRel, fileName));
}

/*** Reuse already-grouped app/auth navigators when the manifest explicitly contains both groups. */
function getGroupedAuthNavigators(
  manifest: AppManifest,
): { appNavigator: NavigatorNode; authNavigator: NavigatorNode } | null {
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

/*** Ensure the authenticated navigator contains the generated sign-out route when required. */
function ensureAuthSignOutRoute(
  navigator: NavigatorNode,
  includeAuthSignOutRoute: boolean,
  signOutRouteName: string,
): NavigatorNode {
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
        ...(navigator.type === 'stack' ? {} : { showInPrimaryNavigation: false }),
      },
    ],
  };
}

/*** Ensure both canonical global-auth entry routes exist in the auth navigator. */
function ensureGlobalAuthEntryRoutes(
  navigator: NavigatorNode,
  authRouteNames: {
    signInRouteName: string;
    signUpRouteName: string;
  },
): NavigatorNode {
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

/*** Ensure one generated public auth entry route exists without replacing an authored route. */
function ensureGlobalAuthEntryRoute(
  navigator: NavigatorNode,
  args: {
    routeName: string;
    routeLabel: string;
    defaultScreenId: string;
  },
): NavigatorNode {
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

/*** Partition an ungrouped root navigator into authenticated app and public auth navigators. */
function partitionRootNavigatorForAuth(
  manifest: AppManifest,
  signInRoute: string,
  publicRoutes: string[],
  includeAuthSignOutRoute: boolean,
  signOutRouteName: string,
): { appNavigator: NavigatorNode; authNavigator: NavigatorNode } {
  const publicRouteSet = new Set(publicRoutes);
  const appRoutes = manifest.navigator.routes.filter((route) => !publicRouteSet.has(route.name));
  const authRoutes = manifest.navigator.routes.filter((route) => publicRouteSet.has(route.name));

  const appNavigator = ensureAuthSignOutRoute(
    {
      ...manifest.navigator,
      routes: [...appRoutes],
    },
    includeAuthSignOutRoute,
    signOutRouteName,
  );
  const authNavigator: NavigatorNode = {
    type: 'stack',
    initialRouteName: signInRoute,
    routes: [...authRoutes],
  };

  return { appNavigator, authNavigator };
}

/*** Construct one generated public auth route for the requested navigator type. */
function buildGeneratedAuthRoute(args: {
  routeName: string;
  routeLabel: string;
  screenId: string;
  navigatorType: NavigatorNode['type'];
}): RouteDefinition {
  const { routeName, routeLabel, screenId, navigatorType } = args;

  return {
    name: routeName,
    label: routeLabel,
    screenId,
    guards: [PUBLIC_GUARD],
    ...(navigatorType === 'tabs' ? { showInPrimaryNavigation: false } : {}),
  };
}

/*** Collect top-level routes that are public through auth-flow defaults or explicit public/guest guards. */
function collectPublicRoutes(
  manifest: AppManifest,
  unauthorizedRoute: string | undefined,
  signInRouteName: string,
  signUpRouteName: string,
  oauthCallbackTopLevelRouteName: string | undefined,
): string[] {
  const unauthorizedRouteName = authFlowPathToRouteName(
    unauthorizedRoute?.trim() ?? signInRouteName,
  );
  const publicRoutes = new Set<string>([
    signInRouteName,
    signUpRouteName,
    unauthorizedRouteName || signInRouteName,
  ]);
  if (oauthCallbackTopLevelRouteName) {
    publicRoutes.add(oauthCallbackTopLevelRouteName);
  }

  /*** Walk nested route definitions and collect routes explicitly guarded as public or guest. */
  const visit = (routes: RouteDefinition[]) => {
    for (const route of routes) {
      const normalizedGuards = (route.guards ?? []).map((guard) => guard.trim().toLowerCase());

      if (normalizedGuards.some((guard) => guard === 'public' || guard === 'guest')) {
        publicRoutes.add(route.name);
      }

      if (route.navigator?.routes) {
        visit(route.navigator.routes);
      }
    }
  };

  visit(manifest.navigator.routes);

  return [...publicRoutes];
}

/*** Return whether a route name exists anywhere in a nested route tree. */
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

/***
 * Convert a generated filesystem path to portable slash separators.
 * @utility @ankhorage/utility/node/path
 */
function normalizeRel(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/***
 * Normalize an application route path to its file-based route name, using index for the root route.
 * @utility @ankhorage/utility/route
 */
function authFlowPathToRouteName(routePath: string): string {
  const normalized = routePath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return normalized === '' ? 'index' : normalized;
}
