import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { configureManifestOAuthProvider, ProjectSecretService } from './projectSecretService';

function createManifest(): AppManifest {
  return {
    metadata: {
      name: 'App',
      slug: 'app',
      version: '1.0.0',
      themeId: 'default',
    },
    settings: {
      localization: {
        defaultLocale: 'en',
        locales: ['en'],
      },
    },
    infra: {
      secretStore: {
        provider: 'supabase-vault',
      },
      plugins: [],
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
          type: 'Page',
        },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

describe('configureManifestOAuthProvider', () => {
  test('creates disabled canonical auth and OAuth configuration without inline values', () => {
    const next = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'google',
        label: 'Google',
        enabled: true,
        scopes: ['openid', 'email', 'profile'],
        credentialsRef: 'auth/oauth/google',
      },
    });

    expect(next.infra.auth?.authorization).toBeUndefined();
    expect(next.infra.auth?.scope).toBe('none');
    expect(next.infra.auth?.flow?.signInRoute).toBe('sign-in');
    expect(next.infra.auth?.oauth).toEqual({
      enabled: false,
      callbackRoute: '/auth/callback',
      providers: [
        {
          id: 'google',
          label: 'Google',
          enabled: true,
          scopes: ['openid', 'email', 'profile'],
          credentialsRef: 'auth/oauth/google',
        },
      ],
    });

    const serialized = JSON.stringify(next);
    expect(serialized).not.toContain('clientSecret');
    expect(serialized).not.toContain('sentinel-secret');
  });

  test('preserves disabled global Auth and OAuth intent for credential saves', () => {
    const next = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'google',
        label: 'Google',
        enabled: false,
        scopes: ['openid', 'email', 'profile'],
        credentialsRef: 'auth/oauth/google',
      },
    });

    expect(next.infra.auth?.scope).toBe('none');
    expect(next.infra.auth?.oauth?.enabled).toBe(false);
    expect(next.infra.auth?.oauth?.providers[0]?.enabled).toBe(false);
  });

  test('creates missing auth config without enabling runtime OAuth', () => {
    const next = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'apple',
        enabled: false,
        credentialsRef: 'auth/oauth/apple',
      },
    });

    expect(next.infra.auth).toMatchObject({
      provider: 'supabase',
      scope: 'none',
      oauth: {
        enabled: false,
        callbackRoute: '/auth/callback',
        providers: [
          {
            id: 'apple',
            enabled: false,
            credentialsRef: 'auth/oauth/apple',
          },
        ],
      },
    });
  });

  test('preserves persisted global auth and OAuth state while replacing one provider', () => {
    const initial = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'apple',
        enabled: false,
        credentialsRef: 'auth/oauth/apple',
      },
    });
    const manifest: AppManifest = {
      ...initial,
      infra: {
        ...initial.infra,
        auth: initial.infra.auth
          ? {
              ...initial.infra.auth,
              scope: 'global',
              oauth: initial.infra.auth.oauth
                ? {
                    ...initial.infra.auth.oauth,
                    enabled: true,
                    callbackRoute: '/custom/callback',
                  }
                : undefined,
            }
          : undefined,
      },
    };

    const next = configureManifestOAuthProvider(manifest, {
      provider: {
        id: 'apple',
        label: 'Apple',
        enabled: true,
        scopes: ['name', 'email'],
        credentialsRef: 'auth/oauth/apple',
      },
    });

    expect(next.infra.auth?.scope).toBe('global');
    expect(next.infra.auth?.oauth?.enabled).toBe(true);
    expect(next.infra.auth?.oauth?.callbackRoute).toBe('/custom/callback');
    expect(next.infra.auth?.oauth?.providers).toHaveLength(1);
    expect(next.infra.auth?.oauth?.providers[0]?.enabled).toBe(true);
  });
});

describe('ProjectSecretService guarded removal', () => {
  test('rechecks the latest editable manifest at delete time', async () => {
    let manifest = createManifest();
    let transactionCount = 0;
    const service = new ProjectSecretService({
      workspaceRoot: '/tmp',
      projectManager: {
        getStudioManifest: () => Promise.resolve(manifest),
        getProjectManifest: () => Promise.resolve(manifest),
      } as never,
      resolveDatabaseUrl: () => Promise.resolve('postgres://local'),
      createClient: () =>
        ({
          query: () => Promise.resolve({ rows: [] }),
          transaction: (operation: (executor: { query: typeof fakeQuery }) => Promise<unknown>) => {
            transactionCount += 1;
            return operation({ query: fakeQuery });
          },
          close: () => Promise.resolve(),
        }) as never,
    });

    expect(
      await service.getUsages({
        projectId: 'demo',
        environment: 'local',
        ref: 'auth/oauth/google',
      }),
    ).toEqual({ ref: 'auth/oauth/google', usages: [] });

    manifest = configureManifestOAuthProvider(manifest, {
      provider: {
        id: 'google',
        enabled: true,
        credentialsRef: 'auth/oauth/google',
      },
    });

    const blocked = await service.removeGuarded({
      projectId: 'demo',
      environment: 'local',
      ref: 'auth/oauth/google',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? undefined : blocked.error.code).toBe('secret_in_use');
    expect(blocked.ok ? [] : blocked.data?.usages).toHaveLength(1);
    expect(transactionCount).toBe(0);

    const removed = await service.removeGuarded({
      projectId: 'demo',
      environment: 'local',
      ref: 'auth/oauth/google',
      confirmBrokenReferences: true,
    });

    expect(removed.ok).toBe(true);
    expect(transactionCount).toBe(1);
    expect(manifest.infra.auth?.oauth?.providers[0]?.credentialsRef).toBe('auth/oauth/google');
  });

  test('normalizes refs before usage checks and removal', async () => {
    let transactionCount = 0;
    const manifest = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'google',
        enabled: true,
        credentialsRef: 'auth/oauth/google',
      },
    });
    const service = new ProjectSecretService({
      workspaceRoot: '/tmp',
      projectManager: {
        getStudioManifest: () => Promise.resolve(manifest),
        getProjectManifest: () => Promise.resolve(manifest),
      } as never,
      resolveDatabaseUrl: () => Promise.resolve('postgres://local'),
      createClient: () =>
        ({
          query: () => Promise.resolve({ rows: [] }),
          transaction: (operation: (executor: { query: typeof fakeQuery }) => Promise<unknown>) => {
            transactionCount += 1;
            return operation({ query: fakeQuery });
          },
          close: () => Promise.resolve(),
        }) as never,
    });

    expect(
      await service.getUsages({
        projectId: 'demo',
        environment: 'local',
        ref: ' /auth//oauth/google/ ',
      }),
    ).toEqual({
      ref: 'auth/oauth/google',
      usages: [
        {
          ref: 'auth/oauth/google',
          path: 'infra.auth.oauth.providers[google].credentialsRef',
          category: 'oauth-provider',
          label: 'Google OAuth provider',
          ownerId: 'google',
          breaksWhenMissing: true,
        },
      ],
    });

    const blocked = await service.removeGuarded({
      projectId: 'demo',
      environment: 'local',
      ref: ' /auth//oauth/google/ ',
    });

    expect(blocked.ok).toBe(false);
    expect(blocked.ok ? undefined : blocked.error.code).toBe('secret_in_use');
    expect(transactionCount).toBe(0);
  });
});

function fakeQuery(sql: string) {
  if (sql.includes('returning vault_secret_id::text as id')) {
    return Promise.resolve({ rows: [{ id: '00000000-0000-0000-0000-000000000001' }] });
  }

  return Promise.resolve({ rows: [] });
}
