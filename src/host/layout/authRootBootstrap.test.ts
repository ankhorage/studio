import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { GeneratedAppFileGenerator } from './layoutGenerator';

function createAuthManifest(postSignInRoute: 'index' | 'products'): AppManifest {
  const routes =
    postSignInRoute === 'products'
      ? [{ name: 'products', screenId: 'products' }]
      : [{ name: 'index', screenId: 'index' }];

  return {
    metadata: {
      name: 'Auth bootstrap fixture',
      slug: 'auth-bootstrap-fixture',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    deploy: { targets: { web: { enabled: true } } },
    infra: {
      modules: [],
      auth: {
        scope: 'global',
        provider: 'supabase',
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          postSignInRoute,
          unauthorizedRoute: 'sign-in',
        },
      },
    },
    navigator: {
      type: 'tabs',
      initialRouteName: postSignInRoute,
      routes,
    },
    screens: {
      index: {
        id: 'index',
        name: 'Home',
        root: { id: 'home-root', type: 'Screen' },
      },
      products: {
        id: 'products',
        name: 'Products',
        root: { id: 'products-root', type: 'Screen' },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

function generateAuthFiles(postSignInRoute: 'index' | 'products') {
  return new GeneratedAppFileGenerator().generateFiles(
    '/tmp/auth-bootstrap-fixture',
    createAuthManifest(postSignInRoute),
    [],
    { includeStudio: true },
  );
}

describe('generated auth root bootstrap', () => {
  test('keeps Studio routes mounted while bootstrap gates both auth trees', () => {
    const files = generateAuthFiles('index');
    const paths = files.map((file) => file.path);
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const authNavigation =
      files.find((file) => file.path === 'src/auth/navigation.ts')?.content ?? '';

    expect(paths).not.toContain('src/app/index.tsx');
    expect(paths).toContain('src/app/(app)/(tabs)/index.tsx');
    expect(paths).toContain('src/app/(app)/sign-out.tsx');
    expect(authNavigation).toContain(
      "type GeneratedAuthNavigationState = 'pending' | 'unauthenticated' | 'authenticated';",
    );
    expect(authNavigation).toContain("if (!ready) return 'pending';");
    expect(rootLayout).toContain('<InnerContent authState={authState}');
    expect(rootLayout).not.toContain("if (authState === 'pending') {");
    expect(rootLayout).toContain("<Stack.Protected guard={authState === 'authenticated'}>");
    expect(rootLayout).toContain("<Stack.Protected guard={authState === 'unauthenticated'}>");
    expect(rootLayout).toContain('<Stack.Screen key="ankh" name="ankh" />');
    expect(rootLayout).toContain(`return (
    <Stack screenOptions={rootStackScreenOptions}>
      <Stack.Protected guard={authState === 'authenticated'}>
        <Stack.Screen key="app" name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={authState === 'unauthenticated'}>
        <Stack.Screen key="auth" name="(auth)" />
      </Stack.Protected>
      <Stack.Screen key="ankh" name="ankh" />
    </Stack>
  );`);
  });

  test('keeps non-root / matchable while the root layout alone canonicalizes navigation', () => {
    const files = generateAuthFiles('products');
    const paths = files.map((file) => file.path);
    const rootEntry = files.find((file) => file.path === 'src/app/index.tsx')?.content ?? '';
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const authNavigation =
      files.find((file) => file.path === 'src/auth/navigation.ts')?.content ?? '';
    const appLayout =
      files.find((file) => file.path === 'src/app/(app)/_layout.tsx')?.content ?? '';
    const tabsLayout =
      files.find((file) => file.path === 'src/app/(app)/(tabs)/_layout.tsx')?.content ?? '';

    expect(paths).toContain('src/app/index.tsx');
    expect(rootEntry).toContain("canonicalizes / to '/products'");
    expect(rootEntry).toContain('return null;');
    expect(rootEntry).not.toContain('expo-router');
    expect(rootEntry).not.toContain('Redirect');
    expect(rootEntry).not.toContain('withAnchor');
    expect(rootEntry).not.toContain('initial=');
    expect(authNavigation).toContain("currentPath === '/' && postSignInPath !== '/'");
    expect(authNavigation).toContain('AUTH_POST_SIGN_IN_ROUTE_TARGET');
    expect(rootLayout).toContain("initialRouteName: '(app)'");
    expect(appLayout).toContain("initialRouteName: '(tabs)'");
    expect(tabsLayout).toContain("initialRouteName: 'products'");
    expect(paths).toContain('src/app/(app)/(tabs)/products.tsx');
  });
});
