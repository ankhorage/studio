import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { GeneratedAppFileGenerator } from './layoutGenerator';

function createManifest(): AppManifest {
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { modules: [] },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Index',
        root: { id: 'root', type: 'Page' },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

function createAuthManifest(): AppManifest {
  return {
    ...createManifest(),
    infra: {
      modules: [],
      auth: {
        scope: 'global',
        provider: 'supabase',
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          postSignInRoute: 'dashboard',
          unauthorizedRoute: 'sign-in',
        },
        signIn: { identifiers: ['email'] },
        signUp: { requiredFields: ['email', 'password'] },
      },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', screenId: 'index' }],
    },
  };
}

function generateRootLayout(manifest: AppManifest): string {
  return (
    new GeneratedAppFileGenerator()
      .generateFiles('/tmp/demo', manifest, [], { includeStudio: true })
      .find((file) => file.path === 'src/app/_layout.tsx')?.content ?? ''
  );
}

test('omits obsolete useRef imports from generated root layouts', () => {
  expect(generateRootLayout(createManifest())).not.toContain('useRef');
  expect(generateRootLayout(createAuthManifest())).not.toContain('useRef');
});
