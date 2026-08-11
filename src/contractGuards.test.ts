import type { AppManifest } from '@ankhorage/contracts';
import { expect, test } from 'bun:test';

import { isAppManifest } from './contractGuards';

test('accepts manifests with valid optional domains', () => {
  expect(
    isAppManifest({
      ...createManifest(),
      splashScreen: {
        image: './assets/splash.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { resizeMode: 'cover', backgroundColor: '#111827' },
      },
      infra: {
        deployment: { target: 'minikube', monitoring: true },
        auth: {
          scope: 'global',
          provider: 'supabase',
          authorization: { kind: 'RBAC', engine: 'native' },
          signIn: { identifiers: ['email'] },
          signUp: {
            requiredFields: ['email', 'password'],
            optionalFields: ['displayName'],
            signUpPolicy: 'requireVerification',
          },
          oauth: {
            enabled: true,
            callbackRoute: 'auth/callback',
            providers: [{ id: 'github', scopes: ['read:user'] }],
          },
          profile: {
            fields: ['email', 'displayName'],
            primaryKey: 'authUserId',
            createStrategy: 'api',
            updateStrategy: 'app',
          },
        },
        database: { provider: 'supabase', tier: 'dev' },
        storage: { provider: 'auto', buckets: ['public'] },
        state: { provider: 'legend', persistence: 'local' },
        networking: { cdn: false },
        plugins: [],
      },
      generatedApis: {
        tasks: {
          id: 'tasks',
          protocol: 'rest',
          basePath: '/api/tasks',
          database: { id: 'primary-db', kind: 'database' },
          resources: [
            {
              id: 'tasks',
              path: '/tasks',
              collection: {
                name: 'tasks',
                primaryKey: 'id',
                fields: [{ name: 'id', type: 'uuid', required: true }],
              },
              operations: ['list', 'read'],
            },
          ],
        },
      },
      dataSources: {
        tasks: {
          id: 'tasks',
          kind: 'api',
          origin: 'external',
          protocol: 'rest',
          baseUrl: 'https://api.example.test',
          endpoints: {
            tasks: {
              id: 'tasks',
              kind: 'http',
              operations: {
                list: {
                  id: 'list',
                  protocol: 'http',
                  intent: 'read',
                  method: 'GET',
                },
              },
            },
          },
        },
      },
      dataBindings: {
        title: {
          componentId: 'title',
          props: {
            text: {
              source: { kind: 'literal', value: 'Release Monitor' },
            },
          },
        },
      },
    }),
  ).toBe(true);
});

test('rejects malformed optional manifest domains', () => {
  expect(isAppManifest(withPath('splashScreen.resizeMode', 'stretch'))).toBe(false);
  expect(isAppManifest(withPath('infra.storage.provider', 'disk'))).toBe(false);
  expect(isAppManifest(withPath('infra.networking.cdn', 'yes'))).toBe(false);
  expect(isAppManifest(withPath('dataSources', []))).toBe(false);
  expect(isAppManifest(withPath('generatedApis.tasks.protocol', 'graphql'))).toBe(false);
  expect(isAppManifest(withPath('dataSources.tasks.kind', 'managed-api'))).toBe(false);
  expect(isAppManifest(withPath('dataBindings.title.props.text.source.kind', 'unknown'))).toBe(
    false,
  );
});

test('validates canonical primary-navigation visibility', () => {
  const manifest = createManifest();
  manifest.navigator.routes = [
    { name: 'home', screenId: 'home' },
    { name: 'details', screenId: 'details', showInPrimaryNavigation: false },
  ];
  manifest.screens = {
    home: { id: 'home', name: 'Home', root: { id: 'home-root', type: 'Screen' } },
    details: { id: 'details', name: 'Details', root: { id: 'details-root', type: 'Screen' } },
  };

  expect(isAppManifest(manifest)).toBe(true);
  expect(
    isAppManifest(withPath('navigator.routes', [{ name: 'home', showInPrimaryNavigation: 0 }])),
  ).toBe(false);
});

function createManifest(): AppManifest {
  return {
    metadata: {
      name: 'Release Monitor',
      slug: 'release-monitor',
      version: '1.0.0',
      category: 'business_productivity',
      themeId: 'default',
    },
    themes: [
      {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#2563eb', harmony: 'analogous' },
        dark: { primaryColor: '#60a5fa', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'default',
    infra: {
      plugins: [],
      storage: { provider: 'auto', buckets: ['public'] },
      networking: { cdn: true },
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    dataBindings: {
      title: {
        componentId: 'title',
        props: {
          text: {
            source: { kind: 'literal', value: 'Release Monitor' },
          },
        },
      },
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
  };
}

function withPath(path: string, value: unknown): unknown {
  const manifest = structuredClone(createManifest()) as unknown as Record<string, unknown>;
  const parts = path.split('.');
  let target: Record<string, unknown> = manifest;

  for (const part of parts.slice(0, -1)) {
    const next = target[part];
    if (!next || typeof next !== 'object') {
      target[part] = {};
    }
    target = target[part] as Record<string, unknown>;
  }

  target[parts.at(-1) ?? ''] = value;
  return manifest;
}
