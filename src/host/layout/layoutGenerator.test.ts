import { describe, expect, test } from 'bun:test';

import type { AppManifest, NavigatorSpec, UiNode } from '@ankhorage/contracts';

import { GeneratedAppFileGenerator } from './layoutGenerator';

function createManifest(): AppManifest {
  return {
    schemaVersion: 1,
    id: 'demo',
    metadata: {
      name: 'Demo',
      slug: 'demo',
      category: 'developer_tools',
      version: '1.0.0',
      description: 'Demo app',
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'index' }],
    },
    screens: {
      index: {
        id: 'index',
        name: 'Index',
        root: {
          id: 'index-root',
          type: 'Screen',
          props: {},
          children: [],
        },
      },
    },
    actions: {},
    themes: [
      {
        id: 'default',
        name: 'Default',
        light: {
          primaryColor: '#6750A4',
          harmony: 'analogous',
          systemTone: 'system',
        },
        dark: {
          primaryColor: '#D0BCFF',
          harmony: 'analogous',
          systemTone: 'system',
        },
      },
    ],
    activeThemeId: 'default',
    activeThemeMode: 'light',
    dataSources: {},
    dataBindings: {},
    infra: {},
  };
}

function createScrollableScreenRoot(): UiNode {
  return {
    id: 'index-root',
    type: 'Screen',
    props: { scroll: true },
    children: [
      {
        id: 'index-heading',
        type: 'Heading',
        props: { children: 'Runtime owner' },
        children: [],
      },
    ],
  };
}

function createNestedNavigator(): NavigatorSpec {
  return {
    type: 'tabs',
    initialRouteName: 'home',
    routes: [
      { name: 'home', screenId: 'index' },
      {
        name: 'settings',
        navigator: {
          type: 'stack',
          initialRouteName: 'profile',
          routes: [{ name: 'profile', screenId: 'profile' }],
        },
      },
    ],
  };
}

describe('GeneratedAppFileGenerator', () => {
  test('generates canonical Studio admin route anchors', () => {
    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', createManifest(), []);
    const generatedPaths = new Set(files.map((file) => file.path));

    expect(generatedPaths.has('src/app/ankh/_layout.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/screens/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/screens/[screenId].tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/modules/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/modules/[moduleId].tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/apis/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/apis/data-sources.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/apis/operations.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/providers.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/routes.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/profile.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/secrets.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/theme.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/properties/[nodeId].tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/bindings/[nodeId].tsx')).toBe(true);
  });

  test('generates auth-independent and production-gated Studio admin routes', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const adminLayout = files.find((file) => file.path === 'src/app/ankh/_layout.tsx')?.content ?? '';

    expect(rootLayout).toContain('<Stack.Screen key="ankh" name="ankh" />');
    expect(rootLayout).toContain('!__DEV__ || !AUTH_DISABLE_IN_DEV');
    expect(adminLayout).toContain('AnkhAdminShell');
  });

  test('composes one React import for generated Auth plus Studio root layouts', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx')?.content ?? '';
    const reactImports = rootLayout.match(/^import .* from 'react';$/gmu) ?? [];

    expect(reactImports).toHaveLength(1);
    expect(reactImports[0]).toContain('useState');
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
      "import { AppShell, ZoraProvider, ZORA_COMPONENT_REGISTRY, ZORA_COMPONENT_META, useZoraTheme, AppBar, ThemeModeToggle } from '@ankhorage/zora';",
    );
    expect(rootLayout).toContain('createComponentRegistry');
    expect(rootLayout).toContain('STUDIO_APP_EXTENSION_COMPONENT_REGISTRY');
    expect(rootLayout).toContain('STUDIO_APP_EXTENSION_INTERACTION_POLICY_SUPPORT');
    expect(rootLayout).toContain(
      'APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY',
    );
    expect(rootLayout).toContain(
      'APP_EXTENSION_INTERACTION_POLICY_SUPPORT as GENERATED_APP_EXTENSION_INTERACTION_POLICY_SUPPORT',
    );
    expect(rootLayout).toContain(`const APP_EXTENSION_COMPONENT_REGISTRY = createComponentRegistry(
  STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
  GENERATED_APP_EXTENSION_COMPONENT_REGISTRY,
);`);
    expect(rootLayout).toContain(`const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {
  ...STUDIO_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
  ...GENERATED_APP_EXTENSION_INTERACTION_POLICY_SUPPORT,
} as const;`);
    expect(rootLayout).toContain(`const runtimeComponentRegistry = createComponentRegistry(
  ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);`);
    expect(rootLayout).toContain('registry: runtimeComponentRegistry');
    expect(rootLayout).toContain('<RuntimeRendererConfigProvider value={generatedRuntimeConfig}>');
    expect(screen).toContain('<RuntimeRenderer');
    expect(screen).not.toContain('createRuntimeRegistry');
  });

  test('derives Studio admin route files from the canonical registry', () => {
    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', createManifest(), []);
    const generatedPaths = new Set(files.map((file) => file.path));

    expect(generatedPaths.has('src/app/ankh/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/screens/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/screens/[screenId].tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/modules/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/modules/[moduleId].tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/apis/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/apis/data-sources.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/apis/operations.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/index.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/providers.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/routes.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/auth/profile.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/secrets.tsx')).toBe(true);
    expect(generatedPaths.has('src/app/ankh/theme.tsx')).toBe(true);
  });

  test('generates one canonical OAuth runtime without secret references', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
      oauth: {
        enabled: true,
        callbackRoute: '/auth/callback',
        providers: [
          {
            id: 'google',
            enabled: true,
            credentialsRef: 'secret://oauth-google',
          },
        ],
      },
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const generatedText = files.map((file) => file.content).join('\n');

    expect(generatedText).toContain("'google'");
    expect(generatedText).not.toContain('secret://oauth-google');
  });

  test('generates a Supabase Auth adapter that only reads Expo public env statically', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const authAdapter = files.find((file) => file.path === 'src/auth/adapter.ts')?.content ?? '';

    expect(authAdapter).toContain('process.env.EXPO_PUBLIC_SUPABASE_URL');
    expect(authAdapter).toContain('process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(authAdapter).not.toContain('process.env[key]');
  });

  test('does not let namespace or networking domain affect generated Auth endpoint source', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
    };
    manifest.infra.namespace = 'demo-namespace';
    manifest.infra.networking = {
      domain: 'example.test',
      https: false,
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const authAdapter = files.find((file) => file.path === 'src/auth/adapter.ts')?.content ?? '';

    expect(authAdapter).toContain('process.env.EXPO_PUBLIC_SUPABASE_URL');
    expect(authAdapter).not.toContain('demo-namespace');
    expect(authAdapter).not.toContain('example.test');
  });

  test('does not derive prior split identity values into generated Auth source', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
    };
    manifest.infra.namespace = 'legacy-split';

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const authAdapter = files.find((file) => file.path === 'src/auth/adapter.ts')?.content ?? '';

    expect(authAdapter).not.toContain('legacy-split');
  });

  test('does not retain Studio-owned local Supabase endpoint calculation', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const authAdapter = files.find((file) => file.path === 'src/auth/adapter.ts')?.content ?? '';

    expect(authAdapter).not.toContain('resolveGeneratedSupabaseAuthUrl');
    expect(authAdapter).not.toContain('127.0.0.1');
  });

  test('does not generate OAuth artifacts when OAuth is disabled', () => {
    const manifest = createManifest();
    manifest.infra.auth = {
      scope: 'required',
      provider: 'supabase',
      flow: {
        signInRoute: 'sign-in',
        signUpRoute: 'sign-up',
        postSignInRoute: 'index',
        publicRoutes: [],
      },
      signIn: { identifiers: ['email'] },
      oauth: {
        enabled: false,
        callbackRoute: '/auth/callback',
        providers: [],
      },
    };

    const files = new GeneratedAppFileGenerator().generateFiles('/tmp/demo', manifest, []);
    const paths = new Set(files.map((file) => file.path));

    expect(paths.has('src/auth/oauth.ts')).toBe(false);
    expect(paths.has('src/app/auth/callback.tsx')).toBe(false);
  });
});
