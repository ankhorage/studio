import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { LayoutGenerator } from './layoutGenerator';

function createManifest(): AppManifest {
  return {
    metadata: { name: 'Demo', slug: 'demo', version: '1.0.0', themeId: 'default' },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { plugins: [] },
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

function createOAuthManifest(): AppManifest {
  return {
    ...createManifest(),
    infra: {
      plugins: [],
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
        oauth: {
          enabled: true,
          callbackRoute: 'auth/callback',
          providers: [
            {
              id: 'google',
              label: 'Continue with Google',
              enabled: true,
              scopes: ['openid', 'email', 'profile'],
              queryParams: { prompt: 'select_account' },
              credentialsRef: 'sentinel-phase3-secret-do-not-leak',
            },
          ],
        },
      },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'dashboard',
      routes: [{ name: 'dashboard', screenId: 'index' }],
    },
  };
}

describe('LayoutGenerator', () => {
  test('generates canonical Studio admin route anchors', () => {
    const files = new LayoutGenerator().generateAll('/tmp/demo', createManifest(), []);
    const paths = files.map((file) => file.path).sort();

    expect(paths).toContain('src/app/ankh/_layout.tsx');
    expect(paths).toContain('src/app/ankh/apis.tsx');
    expect(paths).toContain('src/app/ankh/auth.tsx');
    expect(paths).toContain('src/app/ankh/secrets.tsx');
    expect(paths).toContain('src/app/ankh/properties/[id].tsx');
    expect(paths).toContain('src/app/ankh/theme.tsx');
  });

  test('generates one canonical OAuth runtime without secret references', () => {
    const files = new LayoutGenerator().generateAll('/tmp/demo', createOAuthManifest(), [], {
      includeStudio: false,
    });
    const callbackFiles = files.filter((file) => file.path === 'src/app/(auth)/auth/callback.tsx');
    const adapter = files.find((file) => file.path === 'src/auth/adapter.ts')?.content ?? '';
    const oauth = files.find((file) => file.path === 'src/auth/oauth.ts')?.content ?? '';
    const session = files.find((file) => file.path === 'src/auth/session.ts')?.content ?? '';
    const authScreens = files
      .filter((file) => file.path.includes('(auth)') && file.path.endsWith('.tsx'))
      .map((file) => file.content)
      .join('\n');
    const allGeneratedSource = files.map((file) => file.content).join('\n');

    expect(callbackFiles).toHaveLength(1);
    expect(adapter).toContain('oauthProviders: generatedOAuthProviders');
    expect(adapter).toContain('["google"]');
    expect(oauth).toContain('WebBrowser.openAuthSessionAsync');
    expect(oauth).toContain('Linking.createURL');
    expect(oauth).toContain('callback_already_completed');
    expect(authScreens).toContain('OAuthProviderList');
    expect(authScreens).toContain('startOAuthAuthorization');
    expect(session).toContain("import * as SecureStore from 'expo-secure-store'");
    expect(session).toContain("Platform.OS === 'ios' || Platform.OS === 'android'");
    expect(session).toContain("if (Platform.OS === 'web')");
    expect(allGeneratedSource).not.toContain('sentinel-phase3-secret-do-not-leak');
    expect(allGeneratedSource).not.toContain('credentialsRef');
    expect(allGeneratedSource).not.toContain('clientSecret');
    expect(allGeneratedSource).not.toContain('serviceRole');
  });

  test('does not generate OAuth artifacts when OAuth is disabled', () => {
    const manifest = createOAuthManifest();
    if (manifest.infra.auth?.oauth) manifest.infra.auth.oauth.enabled = false;
    const files = new LayoutGenerator().generateAll('/tmp/demo', manifest, [], {
      includeStudio: false,
    });
    const paths = files.map((file) => file.path);

    expect(paths).not.toContain('src/auth/oauth.ts');
    expect(paths).not.toContain('src/app/(auth)/auth/callback.tsx');
    expect(files.map((file) => file.content).join('\n')).not.toContain('OAuthProviderList');
  });
});
