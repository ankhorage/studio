import type { AppManifest, ScreenSpec, UiNode } from '@ankhorage/contracts';

export function createExpo57NavigationFixtureManifest(
  baseManifest: AppManifest,
  options: {
    readonly auth: boolean;
    readonly authScope?: 'global' | 'integrated' | 'none';
    readonly name: string;
    readonly postSignInRoute?: 'about' | 'index';
    readonly rootNavigator?: 'drawer' | 'stack' | 'tabs';
    readonly slug: string;
  },
): AppManifest {
  const {
    auth,
    authScope = 'global',
    name,
    postSignInRoute = 'index',
    rootNavigator = 'stack',
    slug,
  } = options;
  const { auth: _baseAuth, ...baseInfra } = baseManifest.infra;

  return {
    ...baseManifest,
    metadata: { ...baseManifest.metadata, name, slug },
    infra: {
      ...baseInfra,
      ...(auth
        ? {
            auth: {
              scope: authScope,
              provider: 'supabase' as const,
              flow: {
                signInRoute: 'sign-in',
                signUpRoute: 'sign-up',
                signOutRoute: 'sign-out',
                postSignInRoute,
                unauthorizedRoute: 'sign-in',
              },
              signIn: { identifiers: ['email' as const] },
              signUp: { requiredFields: ['email' as const, 'password' as const] },
              oauth: { enabled: false, callbackRoute: 'auth/callback', providers: [] },
            },
          }
        : {}),
    },
    navigator:
      rootNavigator === 'stack'
        ? {
            type: 'stack',
            initialRouteName: '(tabs)',
            routes: [
              {
                name: '(tabs)',
                label: 'Application',
                navigator: {
                  type: 'tabs',
                  initialRouteName: 'index',
                  routes: [
                    {
                      name: 'index',
                      label: 'Home',
                      icon: { name: 'home-outline', provider: 'Ionicons' },
                      screenId: 'navigation-home',
                    },
                    {
                      name: 'profile/[id]',
                      label: 'Profile',
                      icon: { name: 'person-outline', provider: 'Ionicons' },
                      screenId: 'navigation-profile',
                    },
                    {
                      name: 'catalog',
                      label: 'Catalog',
                      icon: { name: 'list-outline', provider: 'Ionicons' },
                      navigator: {
                        type: 'drawer',
                        initialRouteName: 'index',
                        routes: [
                          {
                            name: 'index',
                            label: 'Catalog Home',
                            icon: { name: 'albums-outline', provider: 'Ionicons' },
                            screenId: 'navigation-catalog',
                          },
                          {
                            name: 'settings',
                            label: 'Catalog Settings',
                            icon: { name: 'settings-outline', provider: 'Ionicons' },
                            screenId: 'navigation-settings',
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                name: 'hidden-tabs',
                label: 'Hidden-route fixture',
                navigator: {
                  type: 'tabs',
                  initialRouteName: 'index',
                  routes: [
                    { name: 'index', label: 'Visible', screenId: 'navigation-visible' },
                    {
                      name: 'secret',
                      label: 'Secret',
                      screenId: 'navigation-secret',
                      showInPrimaryNavigation: false,
                    },
                  ],
                },
              },
              { name: 'about', label: 'About', screenId: 'navigation-about' },
            ],
          }
        : {
            type: rootNavigator,
            initialRouteName: 'index',
            routes: [
              {
                name: 'index',
                label: 'Home',
                icon: { name: 'home-outline', provider: 'Ionicons' },
                screenId: 'navigation-home',
              },
              {
                name: 'about',
                label: 'About',
                icon: { name: 'information-circle-outline', provider: 'Ionicons' },
                screenId: 'navigation-about',
              },
            ],
          },
    screens:
      rootNavigator === 'stack'
        ? {
            'navigation-about': createScreen(
              'navigation-about',
              'About',
              'Static About Route',
              createNavigationButton('about-home', 'Return Home', '/'),
            ),
            'navigation-catalog': createScreen(
              'navigation-catalog',
              'Catalog',
              'Catalog Drawer Route',
            ),
            'navigation-home': createScreen(
              'navigation-home',
              'Home',
              'Navigation Home',
              createNavigationButton('home-profile', 'Open Ada Profile', 'profile/[id]', {
                id: 'ada',
                source: 'internal',
              }),
            ),
            'navigation-profile': createScreen(
              'navigation-profile',
              'Profile',
              'Dynamic Profile Route',
              createNavigationButton(
                'profile-settings',
                'Open Catalog Settings',
                'catalog/settings',
                {
                  tab: 'advanced',
                },
              ),
            ),
            'navigation-secret': createScreen(
              'navigation-secret',
              'Secret',
              'Hidden Navigation Route',
            ),
            'navigation-settings': createScreen(
              'navigation-settings',
              'Settings',
              'Catalog Settings Route',
            ),
            'navigation-visible': createScreen(
              'navigation-visible',
              'Visible',
              'Visible Navigation Route',
            ),
          }
        : {
            'navigation-about': createScreen(
              'navigation-about',
              'About',
              'Root Navigator About Route',
              createNavigationButton('about-home', 'Return Home', '/'),
            ),
            'navigation-home': createScreen(
              'navigation-home',
              'Home',
              'Root Navigator Home Route',
              createNavigationButton('home-about', 'Open About', '/about'),
            ),
          },
  };
}

function createNavigationButton(
  id: string,
  label: string,
  route: string,
  params?: Record<string, number | string>,
): UiNode {
  return {
    id,
    type: 'Button',
    props: {
      children: label,
      onPress: { type: 'navigate', payload: { route, ...(params ? { params } : {}) } },
      testID: id,
    },
  };
}

function createScreen(id: string, name: string, text: string, action?: UiNode): ScreenSpec {
  return {
    id,
    name,
    root: {
      id: `${id}-root`,
      type: 'Screen',
      props: { testID: `${id}-screen` },
      children: [
        { id: `${id}-title`, type: 'Text', props: { children: text } },
        ...(action ? [action] : []),
      ],
    },
  };
}
