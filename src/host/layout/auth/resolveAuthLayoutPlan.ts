import {
  resolveAuthFlow,
  type AppManifest,
  type NavigatorSpec,
  type RouteDefinition,
} from '@ankhorage/contracts';
import path from 'path';

const APP_ROOT_REL = 'src/app';
const AUTH_ADAPTER_FILE_PATH = 'src/auth/adapter.ts';
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

type AuthGeneratedFileKind = 'adapter' | 'session' | 'sign-out' | 'auth-screen';

export interface AuthGeneratedFilePlan {
  path: string;
  kind: AuthGeneratedFileKind;
  routeName?: string;
  screenId?: string;
  authMode?: 'signIn' | 'signUp';
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
  appNavigator: NavigatorSpec;
  authNavigator: NavigatorSpec;
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

  const publicRoutes = collectPublicRoutes(
    manifest,
    flow.unauthorizedRoute,
    signInRouteName,
    signUpRouteName,
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
    publicRoutes,
    appNavigator: partitionedNavigators.appNavigator,
    authNavigator,
    generatedFiles: buildGeneratedFilePlans(includeSignOutRoute, signOutRouteName),
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
): AuthGeneratedFilePlan[] {
  const generatedFiles: AuthGeneratedFilePlan[] = [
    {
      path: AUTH_ADAPTER_FILE_PATH,
      kind: 'adapter',
    },
    {
      path: AUTH_SESSION_FILE_PATH,
      kind: 'session',
    },
  ];

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
  signInRoute: string,
  publicRoutes: string[],
  includeAuthSignOutRoute: boolean,
  signOutRouteName: string,
): { appNavigator: NavigatorSpec; authNavigator: NavigatorSpec } {
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
  const authNavigator: NavigatorSpec = {
    type: 'stack',
    initialRouteName: signInRoute,
    routes: [...authRoutes],
  };

  return { appNavigator, authNavigator };
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

function collectPublicRoutes(
  manifest: AppManifest,
  unauthorizedRoute: string | undefined,
  signInRouteName: string,
  signUpRouteName: string,
): string[] {
  const unauthorizedRouteName = authFlowPathToRouteName(
    unauthorizedRoute?.trim() ?? signInRouteName,
  );
  const publicRoutes = new Set<string>([
    signInRouteName,
    signUpRouteName,
    unauthorizedRouteName || signInRouteName,
  ]);

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
