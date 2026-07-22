import type { AppManifest, AuthFlowConfig, AuthOAuthConfig } from '@ankhorage/contracts';
import { describe, expect, it } from 'bun:test';

import { resolveAuthLayoutPlan } from './resolveAuthLayoutPlan';

function createManifest(
  args: {
    flow?: AuthFlowConfig;
    navigator?: AppManifest['navigator'];
    oauth?: AuthOAuthConfig;
    screens?: AppManifest['screens'];
  } = {},
): AppManifest {
  return {
    metadata: {
      name: 'Auth app',
      slug: 'auth-app',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    themes: [],
    activeThemeId: 'default',
    infra: {
      auth: {
        scope: 'global',
        provider: 'supabase',
        ...(args.flow ? { flow: args.flow } : {}),
        ...(args.oauth ? { oauth: args.oauth } : {}),
      },
      plugins: [],
    },
    navigator: args.navigator ?? {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', screenId: 'dashboard' }],
    },
    screens: args.screens ?? {
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

function createOAuth(overrides: Partial<AuthOAuthConfig> = {}): AuthOAuthConfig {
  return {
    enabled: true,
    callbackRoute: 'auth/callback',
    providers: [
      {
        id: 'google',
        enabled: true,
        credentialsRef: 'auth/oauth/google',
        scopes: ['openid', 'email'],
      },
    ],
    ...overrides,
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
    expect(plan.oauth).toBeUndefined();
  });

  it('uses only infra.auth.flow for generated auth routes', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({
        flow: {
          signInRoute: 'login',
          signUpRoute: 'register',
          signOutRoute: 'logout',
          forgotPasswordRoute: 'recover',
          postSignInRoute: 'dashboard',
          unauthorizedRoute: 'login',
        },
      }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.signInRouteName).toBe('login');
    expect(plan.signUpRouteName).toBe('register');
    expect(plan.signOutRouteName).toBe('logout');
    expect(plan.postSignInRouteName).toBe('dashboard');
    expect(plan.publicRoutes).toContain('login');
    expect(plan.authNavigator.routes.map((route) => route.name)).toEqual(['login', 'register']);
  });

  it('plans one sanitized OAuth runtime and callback from infra.auth.oauth', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({ oauth: createOAuth() }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.oauth).toEqual({
      callbackRoute: 'auth/callback',
      callbackRouteName: 'auth/callback',
      callbackTopLevelRouteName: 'auth',
      providers: [
        {
          id: 'google',
          label: 'Continue with Google',
          scopes: ['openid', 'email'],
          queryParams: {},
        },
      ],
    });
    expect(plan.publicRoutes).toContain('auth');
    expect(plan.generatedFiles).toContainEqual({
      path: 'src/auth/oauth.ts',
      kind: 'oauth-runtime',
    });
    expect(plan.generatedFiles).toContainEqual({
      path: 'src/auth/navigation.tsx',
      kind: 'navigation',
    });
    expect(plan.generatedFiles).toContainEqual({
      path: 'src/app/(auth)/auth/callback.tsx',
      kind: 'oauth-callback',
      routeName: 'auth/callback',
    });
    expect(JSON.stringify(plan)).not.toContain('auth/oauth/google');
  });

  it('does not generate OAuth artifacts when OAuth is disabled', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({ oauth: createOAuth({ enabled: false }) }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.oauth).toBeUndefined();
    expect(plan.generatedFiles.some((file) => file.kind.startsWith('oauth-'))).toBe(false);
  });

  it('fails generation for enabled providers without operational credentials', () => {
    expect(() =>
      resolveAuthLayoutPlan({
        manifest: createManifest({
          oauth: createOAuth({
            providers: [{ id: 'google', enabled: true }],
          }),
        }),
      }),
    ).toThrow('enabled but has no credentials reference');
  });

  it('fails generation for unsupported enabled providers', () => {
    expect(() =>
      resolveAuthLayoutPlan({
        manifest: createManifest({
          oauth: createOAuth({
            providers: [
              {
                id: 'github',
                enabled: true,
                credentialsRef: 'auth/oauth/github',
              },
            ],
          }),
        }),
      }),
    ).toThrow('not supported by Supabase Auth');
  });

  it('preserves nested app initial routes while marking app-only route access protected', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          postSignInRoute: 'products',
          unauthorizedRoute: 'sign-in',
        },
        navigator: {
          type: 'tabs',
          initialRouteName: 'products',
          routes: [
            {
              name: 'products',
              navigator: {
                type: 'stack',
                initialRouteName: 'index',
                routes: [
                  { name: 'index', screenId: 'products' },
                  { name: '[id]', screenId: 'product-detail' },
                  { name: 'create', screenId: 'product-create', hideInTabBar: true },
                ],
              },
            },
          ],
        },
        screens: {
          products: {
            id: 'products',
            name: 'Products',
            root: { id: 'products-root', type: 'Screen' },
          },
          'product-detail': {
            id: 'product-detail',
            name: 'Product detail',
            root: { id: 'product-detail-root', type: 'Screen' },
          },
          'product-create': {
            id: 'product-create',
            name: 'Product create',
            root: { id: 'product-create-root', type: 'Screen' },
          },
        },
      }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.appNavigator.initialRouteName).toBe('products');
    expect(
      plan.appNavigator.routes.find((route) => route.name === 'products')?.navigator,
    ).toMatchObject({
      type: 'stack',
      initialRouteName: 'index',
    });
    expect(plan.routeAccess).toContainEqual({ path: '/products', access: 'protected' });
    expect(plan.routeAccess).toContainEqual({ path: '/products/[id]', access: 'protected' });
    expect(plan.routeAccess).toContainEqual({ path: '/products/create', access: 'protected' });
  });
});
