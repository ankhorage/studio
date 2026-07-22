import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AppManifest, UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

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

function createScrollableScreenRoot(): UiNode {
  return {
    id: 'root',
    type: 'Screen',
    props: {
      scroll: true,
      width: 'wide',
    },
    children: [
      {
        id: 'runtime-section',
        type: 'ScreenSection',
        props: {
          title: 'Scrollable Runtime Screen',
          description: 'Rendered through the generated-app runtime path.',
        },
        children: Array.from({ length: 12 }, (_, index) => ({
          id: `runtime-row-${index}`,
          type: 'Text',
          props: {
            children: `Runtime row ${index + 1}`,
          },
        })),
      },
    ],
  };
}

function getGeneratedAuthAdapter(manifest: AppManifest): string {
  return (
    new GeneratedAppFileGenerator()
      .generateFiles('/tmp/demo', manifest, [], { includeStudio: false })
      .find((file) => file.path === 'src/auth/adapter.ts')?.content ?? ''
  );
}

describe('GeneratedAppFileGenerator', () => {
  test('generates canonical Studio admin route anchors', () => {
    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', createManifest(), []);
    const paths = files.map((file) => file.path).sort();

    expect(paths).toContain('src/app/ankh/_layout.tsx');
    expect(paths).toContain('src/app/ankh/index.tsx');
    expect(paths).toContain('src/app/ankh/apis/index.tsx');
    expect(paths).toContain('src/app/ankh/apis/data-sources.tsx');
    expect(paths).toContain('src/app/ankh/apis/operations.tsx');
    expect(paths).toContain('src/app/ankh/auth/index.tsx');
    expect(paths).toContain('src/app/ankh/auth/providers.tsx');
    expect(paths).toContain('src/app/ankh/auth/routes.tsx');
    expect(paths).toContain('src/app/ankh/auth/profile.tsx');
    expect(paths).toContain('src/app/ankh/secrets.tsx');
    expect(paths).toContain('src/app/ankh/properties/[id].tsx');
    expect(paths).toContain('src/app/ankh/theme.tsx');

    const adminSources = files
      .filter((file) => file.path.startsWith('src/app/ankh/') && file.path.endsWith('.tsx'))
      .map((file) => file.content)
      .join('\n');

    expect(adminSources).toContain('AnkhAdminShell');
    expect(adminSources).toContain('AnkhAdminPage');
    expect(adminSources).toContain('routeId="auth-providers"');
    expect(adminSources).toContain('routeId="api-data-sources"');
    expect(adminSources).not.toContain('return null;');
  });

  test('generates auth-independent and production-gated Studio admin routes', () => {
    const files = new GeneratedAppFileGenerator().generateFiles(
      '/tmp/demo',
      createOAuthManifest(),
      [],
      {
        includeStudio: true,
      },
    );
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const adminLayout = files.find((file) => file.path === 'src/app/ankh/_layout.tsx')?.content;
    const adminPage = files.find(
      (file) => file.path === 'src/app/ankh/auth/providers.tsx',
    )?.content;

    expect(rootLayout).toContain('<Stack.Screen key="app" name="(app)" />');
    expect(rootLayout).toContain("type GeneratedAuthNavigationState = 'pending'");
    expect(rootLayout).toContain('<Stack.Screen key="app" name="(app)" />');
    expect(rootLayout).toContain(
      "<Stack.Protected guard={authState === 'pending' && !isStudioAdminRoute}>",
    );
    expect(rootLayout).toContain('const isResolvingAuthenticatedRedirect =');
    expect(rootLayout).toContain('const shouldUseBootstrapAuthTree =');
    expect(rootLayout).toContain("shouldUseBootstrapAuthTree ? 'pending' : authState");
    expect(rootLayout).not.toContain('if (isStudioAdminPath(pathname)) return;');
    expect(rootLayout).toContain('useGlobalSearchParams');
    expect(rootLayout).toContain('resolveStudioLastNonAdminLocation');
    expect(rootLayout).toContain('!isStudioAdminPath(appPathname) &&');
    expect(adminLayout).toContain('if (!__DEV__)');
    expect(adminLayout).toContain('<Redirect href="/" />');
    expect(adminLayout).toContain('<AnkhAdminShell />');
    expect(adminPage).toContain('if (!__DEV__)');
    expect(adminPage).toContain('<Redirect href="/" />');
    expect(adminPage).toContain('<AnkhAdminPage routeId="auth-providers" />');
  });

  test('composes one React import for generated Auth plus Studio root layouts', () => {
    const files = new GeneratedAppFileGenerator().generateFiles(
      '/tmp/demo',
      createOAuthManifest(),
      [],
      { includeStudio: true },
    );
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const reactImports = rootLayout.match(/^import .* from 'react';$/gmu) ?? [];

    expect(reactImports).toHaveLength(1);
    expect(reactImports[0]).toContain('useState');
    expect(reactImports[0]).toContain('cloneElement');
    expect(reactImports[0]).toContain('isValidElement');
    expect(reactImports[0]).toContain('type ReactNode');
    expect(reactImports[0]?.match(/\buseState\b/gu)?.length).toBe(1);
  });

  test('generates canonical ZORA registry ownership for the running app runtime path', () => {
    const manifest = createManifest();
    const indexScreen = manifest.screens.index;
    if (!indexScreen) {
      throw new Error('Test manifest is missing the index screen.');
    }
    indexScreen.root = createScrollableScreenRoot();

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, [], {
      includeStudio: true,
    });
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const screen = files.find((file) => file.path === 'src/app/index.tsx')?.content ?? '';

    expect(rootLayout).toContain(
      "import { AppShell, ZoraProvider, ZORA_COMPONENT_REGISTRY, useZoraTheme, AppBar } from '@ankhorage/zora';",
    );
    expect(rootLayout).toContain('createComponentRegistry');
    expect(rootLayout).toContain('STUDIO_APP_EXTENSION_COMPONENT_REGISTRY');
    expect(rootLayout).toContain(
      "import { APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY } from '@/generated/appExtensionRegistry';",
    );
    expect(rootLayout).toContain(`const APP_EXTENSION_COMPONENT_REGISTRY = createComponentRegistry(
  STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);`);
    expect(rootLayout).toContain(`const runtimeComponentRegistry = createComponentRegistry(
  ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);`);
    expect(rootLayout).toContain('registry: runtimeComponentRegistry');
    expect(rootLayout).toContain(
      '<GeneratedZoraProvider theme={activeTheme} initialMode={activeThemeMode}>',
    );
    expect(rootLayout).toContain('<RuntimeRendererConfigProvider value={generatedRuntimeConfig}>');
    expect(rootLayout).not.toContain('STUDIO_ZORA_COMPONENT_REGISTRY');
    expect(rootLayout).not.toContain('BASE_ZORA_COMPONENT_REGISTRY');
    expect(rootLayout).not.toContain('ZORA_COMPONENT_REGISTRY as STUDIO_ZORA_COMPONENT_REGISTRY');
    expect(rootLayout).not.toContain('ZORA_COMPONENT_REGISTRY as BASE_ZORA_COMPONENT_REGISTRY');
    expect(rootLayout).not.toContain('SURFACE_COMPONENT_REGISTRY');
    expect(screen).toContain('<RuntimeScreen');
    expect(screen).toContain('screen={screenConfig}');
    expect(screen).toContain('<RuntimeRendererConfigProvider value={runtimeRendererConfig}>');
  });

  test('derives Studio admin route files from the canonical registry', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'layoutGenerator.ts'),
      { encoding: 'utf8' },
    );

    expect(source).toContain('STUDIO_ADMIN_ROUTE_REGISTRY.map');
    expect(source).toContain('resolveStudioAdminRouteFilePath(route.id)');
    expect(source).not.toContain("path.join(appRootRel, 'ankh', 'auth', 'providers.tsx')");
    expect(source).not.toContain('type StudioAdminGeneratedRouteName =');
  });

  test('generates one canonical OAuth runtime without secret references', () => {
    const files = new GeneratedAppFileGenerator().generateFiles(
      '/tmp/demo',
      createOAuthManifest(),
      [],
      {
        includeStudio: false,
      },
    );
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

  test('generates an auth boundary that does not mount protected and auth trees together', () => {
    const files = new GeneratedAppFileGenerator().generateFiles(
      '/tmp/demo',
      createOAuthManifest(),
      [],
      {
        includeStudio: false,
      },
    );
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const bootstrap =
      files.find((file) => file.path === 'src/app/_auth-bootstrap.tsx')?.content ?? '';
    const signIn = files.find((file) => file.path === 'src/app/(auth)/sign-in.tsx')?.content ?? '';
    const callback =
      files.find((file) => file.path === 'src/app/(auth)/auth/callback.tsx')?.content ?? '';
    const signOut = files.find((file) => file.path === 'src/app/(app)/sign-out.tsx')?.content ?? '';

    expect(rootLayout).toContain("type GeneratedAuthNavigationState = 'pending'");
    expect(rootLayout).toContain("authState === 'pending'");
    expect(rootLayout).toContain('<Stack screenOptions={rootStackScreenOptions}>');
    expect(rootLayout).toContain(
      "<Stack.Protected guard={authState === 'pending' && !isStudioAdminRoute}>",
    );
    expect(rootLayout).toContain('<Stack.Screen key="bootstrap" name="_auth-bootstrap" />');
    expect(rootLayout).toContain("<Stack.Protected guard={authState === 'authenticated'}>");
    expect(rootLayout).toContain('<Stack.Screen key="app" name="(app)" />');
    expect(rootLayout).toContain("<Stack.Protected guard={authState === 'unauthenticated'}>");
    expect(rootLayout).toContain('<Stack.Screen key="auth" name="(auth)" />');
    expect(rootLayout).toContain('const isResolvingAuthenticatedRedirect =');
    expect(rootLayout).toContain('const shouldUseBootstrapAuthTree =');
    expect(rootLayout).toContain("shouldUseBootstrapAuthTree ? 'pending' : authState");
    expect(rootLayout).toContain(
      "const [authState, setAuthState] = useState<GeneratedAuthNavigationState>('pending');",
    );
    expect(rootLayout).toContain('authSessionStorage.getItem(PENDING_AUTH_REDIRECT_STORAGE_KEY)');
    expect(rootLayout).toContain('authSessionStorage.setItem(');
    expect(rootLayout).toContain(
      'authSessionStorage.removeItem(PENDING_AUTH_REDIRECT_STORAGE_KEY)',
    );
    expect(rootLayout).toContain(
      'const AUTH_POST_SIGN_IN_ROUTE_TARGET = AUTH_POST_SIGN_IN_ROUTE_PATH;',
    );
    expect(rootLayout).not.toContain("normalized === '/' && AUTH_POST_SIGN_IN_ROUTE_PATH !== '/'");
    expect(rootLayout).toContain('function createRouteLocationHref(');
    expect(rootLayout).toContain('new URLSearchParams(search)');
    expect(rootLayout).toContain('replaceAuthRoute(router, authRedirectTarget)');
    expect(rootLayout).toContain('!matchesRoutePatterns(normalized, AUTH_APP_ROUTE_PATTERNS)');
    expect(rootLayout).toContain("Platform.OS !== 'web'");
    expect(rootLayout).toContain("Reflect.get(history, 'replaceState')");
    expect(rootLayout).toContain('createCurrentAuthLocation(pathname, authRouteSearchParams)');
    expect(rootLayout).toContain(
      'shouldCapturePendingAuthRedirect(authState, currentAuthLocation)',
    );
    expect(rootLayout).toContain(
      'const pendingAuthRedirectLocationRef = useRef<string | null>(null)',
    );
    expect(rootLayout).toContain('function applyResolvedAuthState(');
    expect(rootLayout).toContain('applyResolvedAuthState(resolveGeneratedAuthNavigationState())');
    expect(rootLayout).toContain('getStoredPendingAuthRedirectSnapshot()');
    expect(rootLayout).toContain('pendingAuthRedirectLocationRef.current = currentAuthLocation');
    expect(rootLayout).toContain('setPendingAuthRedirect(pendingAuthRedirectLocationRef.current)');
    expect(rootLayout).toContain('pendingAuthRedirectLocationRef.current = null');
    expect(rootLayout).toContain('await setStoredPendingAuthRedirect(');
    expect(rootLayout).toContain('pendingAuthRedirectLocationRef.current ?? currentAuthLocation');
    expect(rootLayout).toContain('await clearStoredPendingAuthRedirect()');
    expect(rootLayout).toContain('redirectController.signal.aborted');
    expect(rootLayout).toContain('pendingAuthRedirectReady');
    expect(rootLayout).not.toContain('AUTH_DISABLE_IN_DEV');
    expect(rootLayout).not.toContain("return 'authenticated';");
    expect(rootLayout).not.toContain('window.sessionStorage');
    expect(bootstrap).toContain('function GeneratedAuthBootstrapRoute()');
    expect(bootstrap).toContain('<ActivityIndicator color={theme.colors.primary} />');
    expect(signIn).toContain('await setStoredAuthSession(result.data);');
    expect(signIn).not.toContain('POST_SIGN_IN_ROUTE');
    expect(signIn).not.toContain('router.replace(POST_SIGN_IN_ROUTE)');
    expect(callback).not.toContain('POST_SIGN_IN_ROUTE');
    expect(callback).not.toContain('router.replace(POST_SIGN_IN_ROUTE)');
    expect(signOut).toContain('await clearStoredAuthSession();');
    expect(signOut).not.toContain('useRouter');
    expect(signOut).not.toContain('router.replace');
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
    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, [], {
      includeStudio: false,
    });
    const paths = files.map((file) => file.path);

    expect(paths).not.toContain('src/auth/oauth.ts');
    expect(paths).not.toContain('src/app/(auth)/auth/callback.tsx');
    expect(files.map((file) => file.content).join('\n')).not.toContain('OAuthProviderList');
  });
});
