import type { AppManifest, AuthFlowConfig, AuthOAuthConfig } from '@ankhorage/contracts';
import { describe, expect, it } from 'bun:test';

import { getProjectTemplate } from '../../templateRegistry';
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
    navigator: {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', screenId: 'dashboard' }],
    },
    ...(args.navigator ? { navigator: args.navigator } : {}),
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
    expect(plan.generatedFiles).toContainEqual({
      path: 'src/app/_auth-bootstrap.tsx',
      kind: 'auth-bootstrap',
    });
    expect(plan.publicRoutes).toContain('sign-in');
    expect(plan.generatedFiles).toContainEqual({
      path: 'src/auth/oauth.ts',
      kind: 'oauth-runtime',
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

  it('keeps public routes in both auth and app trees while protecting app-only routes', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({
        navigator: {
          type: 'tabs',
          initialRouteName: 'home',
          routes: [
            { name: 'home', screenId: 'home' },
            { name: 'about', screenId: 'about', guards: ['public'] },
          ],
        },
        screens: {
          home: {
            id: 'home',
            name: 'Home',
            root: { id: 'home-root', type: 'Page' },
          },
          about: {
            id: 'about',
            name: 'About',
            root: { id: 'about-root', type: 'Page' },
          },
        },
      }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.appNavigator.routes.map((route) => route.name)).toEqual([
      'home',
      'about',
      'sign-out',
    ]);
    expect(plan.authNavigator.routes.map((route) => route.name)).toEqual([
      'about',
      'sign-in',
      'sign-up',
    ]);
    expect(plan.routeTopology.publicRoutePatterns.map((route) => route.path)).toEqual(['/about']);
    expect(plan.routeTopology.protectedRoutePatterns.map((route) => route.path)).toEqual(['/home']);
  });

  it('creates dynamic route patterns and preserves nested initial route topology', () => {
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
            { name: 'profile', screenId: 'profile', guards: ['guest'] },
          ],
        },
        screens: {
          products: {
            id: 'products',
            name: 'Products',
            root: { id: 'products-root', type: 'Page' },
          },
          'product-detail': {
            id: 'product-detail',
            name: 'Product detail',
            root: { id: 'product-detail-root', type: 'Page' },
          },
          'product-create': {
            id: 'product-create',
            name: 'Product create',
            root: { id: 'product-create-root', type: 'Page' },
          },
          profile: {
            id: 'profile',
            name: 'Profile',
            root: { id: 'profile-root', type: 'Page' },
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
    expect(plan.routeTopology.appRoutePatterns).toContainEqual({
      path: '/products/[id]',
      pattern: '^/products/[^/]+$',
    });
    expect(plan.routeTopology.appRoutePatterns).toContainEqual({
      path: '/products/create',
      pattern: '^/products/create$',
    });
    expect(plan.routeTopology.publicRoutePatterns).toContainEqual({
      path: '/profile',
      pattern: '^/profile$',
    });
  });

  it('copies nested public routes by path without colliding on duplicate segment names', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          postSignInRoute: 'account/settings',
          unauthorizedRoute: 'sign-in',
        },
        navigator: {
          type: 'stack',
          initialRouteName: 'account',
          routes: [
            {
              name: 'account',
              navigator: {
                type: 'stack',
                initialRouteName: 'settings',
                routes: [
                  { name: 'settings', screenId: 'account-settings' },
                  { name: 'help', screenId: 'account-help', guards: ['public'] },
                ],
              },
            },
            {
              name: 'marketing',
              navigator: {
                type: 'stack',
                initialRouteName: 'help',
                routes: [{ name: 'help', screenId: 'marketing-help' }],
              },
            },
          ],
        },
        screens: {
          'account-settings': {
            id: 'account-settings',
            name: 'Account settings',
            root: { id: 'account-settings-root', type: 'Page' },
          },
          'account-help': {
            id: 'account-help',
            name: 'Account help',
            root: { id: 'account-help-root', type: 'Page' },
          },
          'marketing-help': {
            id: 'marketing-help',
            name: 'Marketing help',
            root: { id: 'marketing-help-root', type: 'Page' },
          },
        },
      }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    const authAccount = plan.authNavigator.routes.find((route) => route.name === 'account');
    const authMarketing = plan.authNavigator.routes.find((route) => route.name === 'marketing');

    expect(authAccount?.navigator?.routes.map((route) => route.name)).toEqual(['help']);
    expect(authAccount?.navigator?.initialRouteName).toBe('help');
    expect(authMarketing).toBeUndefined();
    expect(plan.routeTopology.publicRoutePatterns).toContainEqual({
      path: '/account/help',
      pattern: '^/account/help$',
    });
    expect(plan.routeTopology.publicRoutePatterns).not.toContainEqual({
      path: '/marketing/help',
      pattern: '^/marketing/help$',
    });
    expect(plan.routeTopology.protectedRoutePatterns).toContainEqual({
      path: '/account/settings',
      pattern: '^/account/settings$',
    });
  });

  it('validates concrete redirect targets against dynamic route patterns', () => {
    const plan = resolveAuthLayoutPlan({
      manifest: createManifest({
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          postSignInRoute: 'products/sample-product',
          unauthorizedRoute: 'sign-in',
        },
        navigator: {
          type: 'stack',
          initialRouteName: 'products',
          routes: [
            {
              name: 'products',
              navigator: {
                type: 'stack',
                initialRouteName: '[id]',
                routes: [{ name: '[id]', screenId: 'product-detail' }],
              },
            },
          ],
        },
        screens: {
          'product-detail': {
            id: 'product-detail',
            name: 'Product detail',
            root: { id: 'product-detail-root', type: 'Page' },
          },
        },
      }),
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.routeTopology.postSignInRoutePath).toBe('/products/sample-product');
  });

  it('rejects redirect targets that do not resolve to generated route topology', () => {
    expect(() =>
      resolveAuthLayoutPlan({
        manifest: createManifest({
          flow: {
            signInRoute: 'sign-in',
            signUpRoute: 'sign-up',
            signOutRoute: 'sign-out',
            postSignInRoute: 'missing',
            unauthorizedRoute: 'sign-in',
          },
        }),
      }),
    ).toThrow('postSignInRoute "/missing" does not match a generated route');
  });

  it('uses Nutrition Scanner only as a regression fixture for nested products stack topology', () => {
    const manifest = getProjectTemplate({
      category: 'food_drink',
      templateId: 'nutrition-catalog-scan',
    });
    const plan = resolveAuthLayoutPlan({
      manifest: {
        ...manifest,
        infra: {
          ...manifest.infra,
          auth: {
            scope: 'global',
            provider: 'supabase',
            flow: {
              signInRoute: 'sign-in',
              signUpRoute: 'sign-up',
              signOutRoute: 'sign-out',
              postSignInRoute: 'products',
              unauthorizedRoute: 'sign-in',
            },
          },
        },
      },
    });

    expect(plan.enabled).toBe(true);
    if (!plan.enabled) throw new Error('Expected auth layout to be enabled.');
    expect(plan.appNavigator.type).toBe('tabs');
    expect(plan.appNavigator.initialRouteName).toBe('products');
    const productsRoute = plan.appNavigator.routes.find((route) => route.name === 'products');
    expect(productsRoute?.navigator?.type).toBe('stack');
    expect(productsRoute?.navigator?.initialRouteName).toBe('index');
    expect(plan.routeTopology.appRoutePatterns).toContainEqual({
      path: '/products',
      pattern: '^/products$',
    });
    expect(plan.routeTopology.appRoutePatterns).toContainEqual({
      path: '/products/[id]',
      pattern: '^/products/[^/]+$',
    });
    expect(plan.routeTopology.appRoutePatterns).toContainEqual({
      path: '/products/create',
      pattern: '^/products/create$',
    });
  });
});
