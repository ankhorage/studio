import type { AppManifest, AuthFlowConfig } from '@ankhorage/contracts';
import { describe, expect, it } from 'bun:test';

import { resolveAuthLayoutPlan } from './resolveAuthLayoutPlan';

function createManifest(flow?: AuthFlowConfig): AppManifest {
  return {
    metadata: {
      name: 'Auth app',
      slug: 'auth-app',
      version: '1.0.0',
      themeId: 'default',
    },
    themes: [],
    activeThemeId: 'default',
    infra: {
      auth: {
        scope: 'global',
        provider: 'supabase',
        ...(flow ? { flow } : {}),
      },
      plugins: [],
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', screenId: 'dashboard' }],
    },
    screens: {
      dashboard: {
        id: 'dashboard',
        name: 'Dashboard',
        root: { id: 'dashboard-root', type: 'Screen' },
      },
    },
    settings: {
      localization: { defaultLocale: 'en', locales: ['en'] },
    },
  };
}

describe('resolveAuthLayoutPlan', () => {
  it('uses the canonical contract default when auth flow is absent', () => {
    const plan = resolveAuthLayoutPlan({ manifest: createManifest() });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.signInRoute).toBe('sign-in');
    expect(plan.signUpRoute).toBe('sign-up');
    expect(plan.signOutRoute).toBe('sign-out');
    expect(plan.postSignInRoute).toBe('/');
  });

  it('uses only infra.auth.flow for generated auth routes', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({
        signInRoute: 'login',
        signUpRoute: 'register',
        signOutRoute: 'logout',
        forgotPasswordRoute: 'recover',
        postSignInRoute: 'dashboard',
        unauthorizedRoute: 'login',
      }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.signInRouteName).toBe('login');
    expect(plan.signUpRouteName).toBe('register');
    expect(plan.signOutRouteName).toBe('logout');
    expect(plan.postSignInRouteName).toBe('dashboard');
    expect(plan.publicRoutes).toContain('login');
    expect(plan.authNavigator.routes.map((route) => route.name)).toEqual(
      expect.arrayContaining(['login', 'register']),
    );
  });
});
