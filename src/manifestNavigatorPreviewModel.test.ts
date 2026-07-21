import type {
  AppManifest,
  AuthFlowConfig,
  RouteDefinition,
  ScreenSpec,
} from '@ankhorage/contracts';
import { describe, expect, it } from 'bun:test';

import {
  buildManifestNavigatorPreviewModel,
  resolveLeafScreenIdForChromeRouteName,
  resolveLeafScreenIdForRoute,
} from './manifestNavigatorPreviewModel';

const TEST_AUTH_FLOW: AuthFlowConfig = {
  signInRoute: '/sign-in',
  signUpRoute: '/sign-up',
  signOutRoute: '/sign-out',
  forgotPasswordRoute: '/forgot-password',
  otpRoute: '/otp',
  unauthorizedRoute: '/sign-in',
  postSignInRoute: '/home',
};

function screen(id: string, title: string): ScreenSpec {
  return { id, name: title, title, root: { id: `${id}-root`, type: 'Page' } };
}

function manifest(args: {
  navigator: AppManifest['navigator'];
  screens: Record<string, ScreenSpec>;
  flow?: AuthFlowConfig | null;
}): AppManifest {
  const flow = args.flow === null ? undefined : (args.flow ?? TEST_AUTH_FLOW);

  return {
    metadata: {
      name: 'Test',
      slug: 'test',
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
        ...(flow ? { flow } : {}),
      },
      plugins: [],
    },
    navigator: args.navigator,
    screens: args.screens,
    settings: {
      localization: { defaultLocale: 'en', locales: ['en'] },
    },
  };
}

describe('manifest navigator preview model', () => {
  it('filters auth and hidden routes and builds route map', () => {
    const model = buildManifestNavigatorPreviewModel({
      manifest: manifest({
        screens: {
          home: screen('home', 'Home'),
          settings: screen('settings', 'Settings'),
          signIn: screen('sign-in', 'Sign In'),
          hidden: screen('hidden', 'Hidden'),
        },
        navigator: {
          type: 'tabs',
          initialRouteName: 'home',
          routes: [
            {
              name: 'home',
              screenId: 'home',
              icon: { name: 'home-outline', provider: 'Ionicons' },
            },
            { name: 'settings', screenId: 'settings' },
            { name: 'sign-in', screenId: 'sign-in' },
            { name: 'hidden', screenId: 'hidden', hideInTabBar: true },
          ],
        },
      }),
      activeScreenId: 'settings',
    });

    expect(model.visibleRoutes.map((route) => route.name)).toEqual(['home', 'settings']);
    expect(model.activeRouteName).toBe('settings');
    expect(model.routeMap.home?.label).toBe('Home');
    expect(model.routeMap.home?.icon).toEqual({ name: 'home-outline', provider: 'Ionicons' });
  });

  it('uses the contract default when infra auth has no explicit flow', () => {
    const model = buildManifestNavigatorPreviewModel({
      manifest: manifest({
        flow: null,
        screens: {
          home: screen('home', 'Home'),
          signIn: screen('sign-in', 'Sign In'),
        },
        navigator: {
          type: 'tabs',
          initialRouteName: 'home',
          routes: [
            { name: 'home', screenId: 'home' },
            { name: 'sign-in', screenId: 'sign-in' },
          ],
        },
      }),
    });

    expect(model.visibleRoutes.map((route) => route.name)).toEqual(['home']);
  });

  it('resolves leaf screen ids through nested navigators', () => {
    const route: RouteDefinition = {
      name: 'home',
      navigator: {
        type: 'stack',
        initialRouteName: 'index',
        routes: [
          { name: 'index', screenId: 'home-index' },
          { name: 'details', screenId: 'details' },
        ],
      },
    };

    expect(resolveLeafScreenIdForRoute(route)).toBe('home-index');
    expect(
      resolveLeafScreenIdForChromeRouteName({
        navigator: { type: 'tabs', routes: [route] },
        visibleRoutes: [{ name: 'home', label: 'Home', route }],
        routeName: 'home',
      }),
    ).toBe('home-index');
  });

  it('reports unknown icon providers', () => {
    const model = buildManifestNavigatorPreviewModel({
      manifest: manifest({
        screens: { home: screen('home', 'Home') },
        navigator: {
          type: 'tabs',
          routes: [{ name: 'home', screenId: 'home', icon: { name: 'home', provider: 'Unknown' } }],
        },
      }),
    });

    expect(model.iconDiagnostics.length).toBe(1);
    expect(model.iconDiagnostics[0]?.routeName).toBe('home');
  });
});
