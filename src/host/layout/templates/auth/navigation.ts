import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { routeNameToGroupedHref, routeNameToHref } from '../utils/routes';

interface GetAuthNavigationTsArgs {
  signInRoute: string;
  signInRouteName: string;
  signUpRouteName: string;
  postSignInRoute: string;
  publicRoutes: string[];
}

function serializeStringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => `'${escapeStringLiteral(value)}'`).join(', ')}]`;
}

export function getAuthNavigationTs(args: GetAuthNavigationTsArgs): string {
  return `import { type Href, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { authAdapter } from './adapter';
import {
  bootstrapAuthSession,
  getStoredAuthSession,
  isAuthenticated,
  refreshAuthSessionIfNeeded,
  subscribeToAuthSessionChanges,
} from './session';

const AUTH_SIGN_IN_ROUTE_SEGMENT = '${escapeStringLiteral(args.signInRouteName)}';
const AUTH_SIGN_UP_ROUTE_SEGMENT = '${escapeStringLiteral(args.signUpRouteName)}';
const AUTH_SIGN_IN_ROUTE_PATH = '${escapeStringLiteral(routeNameToHref(args.signInRoute))}';
const AUTH_SIGN_IN_ROUTE_TARGET: Href = '${escapeStringLiteral(routeNameToGroupedHref(args.signInRoute, 'auth'))}';
const AUTH_POST_SIGN_IN_ROUTE_PATH = '${escapeStringLiteral(routeNameToHref(args.postSignInRoute))}';
const AUTH_POST_SIGN_IN_ROUTE_TARGET: Href = '${escapeStringLiteral(routeNameToGroupedHref(args.postSignInRoute, 'app'))}';
const AUTH_PUBLIC_ROUTES = ${serializeStringArrayLiteral(args.publicRoutes)};
const AUTH_DISABLE_IN_DEV = process.env.EXPO_PUBLIC_ANKH_AUTH_DISABLE_IN_DEV === 'true';

export type GeneratedAuthNavigationState = 'pending' | 'unauthenticated' | 'authenticated';

export function useGeneratedAuthNavigation() {
  const router = useRouter();
  const rootNavigationKey = getRootNavigationKey(useRootNavigationState());
  const pathname = usePathname();
  const session = useSyncExternalStore(
    subscribeToAuthSessionChanges,
    getStoredAuthSession,
    getStoredAuthSession,
  );
  const isAuthRuntimeReady = useGeneratedAuthRuntimeReady();
  const [isInnerContentReady, setIsInnerContentReady] = useState(false);
  const authenticated = session !== null && isAuthenticated();
  const authState = resolveAuthNavigationState(isAuthRuntimeReady, authenticated);
  const hasAuthenticatedSession = isAuthRuntimeReady && authenticated;
  useRefreshAuthSessionOnActive();
  useAuthRouteGuard({
    authenticated,
    isAuthRuntimeReady,
    isInnerContentReady,
    pathname,
    rootNavigationKey,
    router,
  });
  const handleInnerContentReady = useCallback(() => setIsInnerContentReady(true), []);
  return {
    authState,
    handleInnerContentReady,
    hasAuthenticatedSession,
    isAuthRuntimeReady,
    pathname,
  };
}

export function shouldMountAuthenticatedAppHeader(
  pathname: string,
  isAuthRuntimeReady: boolean,
): boolean {
  if (!isGeneratedAuthEnforced()) return true;
  if (!isAuthRuntimeReady || !isAuthenticated()) return false;
  return !isAuthRoute(pathname);
}

function useGeneratedAuthRuntimeReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void initializeGeneratedAuthRuntime().then(() => {
      if (!controller.signal.aborted) setReady(true);
    });
    return () => controller.abort();
  }, []);
  return ready;
}

async function initializeGeneratedAuthRuntime(): Promise<void> {
  try {
    await bootstrapAuthSession();
    await refreshAuthSessionIfNeeded(authAdapter);
  } catch {
    // Storage or adapter failures resolve to the unauthenticated route instead of a blank shell.
  }
}

function useRefreshAuthSessionOnActive(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshAuthSessionIfNeeded(authAdapter).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);
}

function resolveAuthNavigationState(
  ready: boolean,
  authenticated: boolean,
): GeneratedAuthNavigationState {
  if (!isGeneratedAuthEnforced()) return 'authenticated';
  if (!ready) return 'pending';
  return authenticated ? 'authenticated' : 'unauthenticated';
}

interface AuthRouteGuardInput {
  authenticated: boolean;
  isAuthRuntimeReady: boolean;
  isInnerContentReady: boolean;
  pathname: string;
  rootNavigationKey: string;
  router: ReturnType<typeof useRouter>;
}

function useAuthRouteGuard(args: AuthRouteGuardInput): void {
  const { router } = args;
  const target = resolveAuthRouteGuardTarget(args);
  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);
}

function resolveAuthRouteGuardTarget(args: AuthRouteGuardInput): Href | null {
  if (
    !args.isInnerContentReady ||
    !args.isAuthRuntimeReady ||
    args.rootNavigationKey.length === 0
  ) {
    return null;
  }
  if (!isGeneratedAuthEnforced()) return null;

  const activeTopLevelRoute = getTopLevelRoute(args.pathname);
  const currentPath = normalizeRoutePath(args.pathname);
  const postSignInPath = normalizeRoutePath(AUTH_POST_SIGN_IN_ROUTE_PATH);
  if (!args.authenticated) {
    return !AUTH_PUBLIC_ROUTES.includes(activeTopLevelRoute) &&
      currentPath !== normalizeRoutePath(AUTH_SIGN_IN_ROUTE_PATH)
      ? AUTH_SIGN_IN_ROUTE_TARGET
      : null;
  }
  if (currentPath === '/' && postSignInPath !== '/') return AUTH_POST_SIGN_IN_ROUTE_TARGET;
  const isAuthEntry =
    activeTopLevelRoute === AUTH_SIGN_IN_ROUTE_SEGMENT ||
    activeTopLevelRoute === AUTH_SIGN_UP_ROUTE_SEGMENT;
  return isAuthEntry && currentPath !== postSignInPath ? AUTH_POST_SIGN_IN_ROUTE_TARGET : null;
}

function isGeneratedAuthEnforced(): boolean {
  return !__DEV__ || !AUTH_DISABLE_IN_DEV;
}

function isAuthRoute(pathname: string): boolean {
  const activeTopLevelRoute = getTopLevelRoute(pathname);
  return (
    activeTopLevelRoute === AUTH_SIGN_IN_ROUTE_SEGMENT ||
    activeTopLevelRoute === AUTH_SIGN_UP_ROUTE_SEGMENT
  );
}

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
`;
}
