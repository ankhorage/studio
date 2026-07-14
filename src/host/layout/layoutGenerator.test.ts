import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function getGeneratedAuthAdapter(manifest: AppManifest): string {
  return (
    new LayoutGenerator()
      .generateAll('/tmp/demo', manifest, [], { includeStudio: false })
      .find((file) => file.path === 'src/auth/adapter.ts')?.content ?? ''
  );
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
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const adapter = files.find((file) => file.path === 'src/auth/adapter.ts')?.content ?? '';
    const oauth = files.find((file) => file.path === 'src/auth/oauth.ts')?.content ?? '';
    const session = files.find((file) => file.path === 'src/auth/session.ts')?.content ?? '';
    const authScreens = files
      .filter((file) => file.path.includes('(auth)') && file.path.endsWith('.tsx'))
      .map((file) => file.content)
      .join('\n');
    const allGeneratedSource = files.map((file) => file.content).join('\n');

    expect(callbackFiles).toHaveLength(1);
    expect(rootLayout).toContain("AppState.addEventListener('change'");
    expect(rootLayout).toContain('await bootstrapAuthSession()');
    expect(adapter).toContain('oauthProviders: generatedOAuthProviders');
    expect(adapter).toContain('["google"]');
    expect(oauth).toContain('WebBrowser.openAuthSessionAsync');
    expect(oauth).toContain('Linking.createURL');
    expect(oauth).toContain('callback_already_completed');
    expect(oauth).toContain('cancelOAuthAttempt');
    expect(oauth).toContain('configuredProvider');
    expect(oauth).toContain('GENERATED_OAUTH_PROVIDERS.find');
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

  test('generates a Supabase Auth adapter that only reads Expo public env statically', () => {
    const adapter = getGeneratedAuthAdapter(createOAuthManifest());

    expect(adapter).toContain('process.env.EXPO_PUBLIC_SUPABASE_URL');
    expect(adapter).toContain('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(adapter).toContain(
      "const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';",
    );
    expect(adapter).toContain(
      "const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';",
    );
    expect(adapter).toContain('supabaseUrl.length > 0 && supabaseAnonKey.length > 0');
    expect(adapter).toContain('url: supabaseUrl');
    expect(adapter).toContain('anonKey: supabaseAnonKey');
    expect(adapter).toContain('createMissingSupabaseAuthAdapter()');
    expect(adapter).toContain('missing-supabase-auth-env');
    expect(adapter).toContain(
      'Run generated Infra Up successfully, verify EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the app .env.local, then restart Expo.',
    );

    expect(adapter).not.toContain('readEnv(');
    expect(adapter).not.toContain('env[name]');
    expect(adapter).not.toContain('globalThis.process');
    expect(adapter).not.toContain('generatedLocalSupabaseUrl');
    expect(adapter).not.toContain('generatedLocalSupabaseAnonKey');
    expect(adapter).not.toContain('shouldUseGeneratedLocalSupabaseFallback');
    expect(adapter).not.toContain("readEnv('SUPABASE_URL')");
    expect(adapter).not.toContain("readEnv('SUPABASE_ANON_KEY')");
    expect(adapter).not.toContain('process.env.SUPABASE_URL');
    expect(adapter).not.toContain('process.env.SUPABASE_ANON_KEY');
    expect(adapter).not.toContain(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IjEyMzQ1Njc4OTAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTUxNjIzOTAyMn0.UYDs1JMK4NH23zXO1aEDLOO_iUYIrOHwzqDqaea-6FY',
    );
  });

  test('does not let namespace or networking domain affect generated Auth endpoint source', () => {
    const firstManifest = createOAuthManifest();
    const secondManifest = createOAuthManifest();
    secondManifest.infra.networking = { domain: 'local.example.test', cdn: false };

    expect(getGeneratedAuthAdapter(firstManifest)).toBe(getGeneratedAuthAdapter(secondManifest));
  });

  test('does not derive prior split identity values into generated Auth source', () => {
    const manifest = createOAuthManifest();
    manifest.metadata.slug = 'scanner';
    manifest.infra.networking = { domain: 'local.example.test', cdn: false };

    const adapter = getGeneratedAuthAdapter(manifest);

    expect(adapter).not.toContain('scanner');
    expect(adapter).not.toContain('local.example.test');
    expect(adapter).not.toContain('local-example-test');
    expect(adapter).not.toContain('127.0.0.1');
    expect(adapter).not.toMatch(/http:\/\/localhost:\d+/);
    expect(adapter).not.toMatch(/http:\/\/127\.0\.0\.1:\d+/);
  });

  test('does not retain Studio-owned local Supabase endpoint calculation', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'layoutGenerator.ts'),
      { encoding: 'utf8' },
    );

    expect(source).not.toContain('SUPABASE_LOCAL_PORT_BASE');
    expect(source).not.toContain('SUPABASE_LOCAL_PORT_BUCKET_SIZE');
    expect(source).not.toContain('SUPABASE_LOCAL_PORT_BUCKET_COUNT');
    expect(source).not.toContain('SUPABASE_LOCAL_PORT_REFERENCE_PROJECT');
    expect(source).not.toContain('resolveGeneratedLocalSupabaseUrl');
    expect(source).not.toContain('resolveMinikubeNamespace');
    expect(source).not.toContain('resolveSupabaseLocalApiPort');
    expect(source).not.toContain('resolveSupabaseLocalPortBucket');
    expect(source).not.toContain('hashProjectId');
    expect(source).not.toContain('localSupabaseUrl');
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
