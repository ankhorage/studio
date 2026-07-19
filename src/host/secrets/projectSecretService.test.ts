import type { AppManifest, AuthOAuthProviderConfig } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { applyStudioAuthSettings } from '../../authSettings';
import { ProjectSecretService } from './projectSecretService';

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

describe('ProjectSecretService guarded removal', () => {
  test('stores OAuth credentials without writing manifest state', async () => {
    let saveCount = 0;
    const service = new ProjectSecretService({
      workspaceRoot: '/tmp',
      projectManager: {
        getStudioManifest: () => Promise.resolve(createManifest()),
        getProjectManifest: () => Promise.resolve(createManifest()),
        saveStudioManifest: () => {
          saveCount += 1;
          return Promise.resolve({ success: true });
        },
      } as never,
      resolveDatabaseUrl: () => Promise.resolve('postgres://local'),
      createClient: () =>
        createQueuedClient(
          [],
          [],
          [{ id: '00000000-0000-0000-0000-000000000001' }],
          [
            {
              project_id: 'demo',
              environment: 'local',
              secret_ref: 'auth/oauth/google',
              kind: 'oauth',
              provider: 'google',
              configured_fields: ['clientId', 'clientSecret'],
              created_at: '2026-07-12T00:00:00.000Z',
              updated_at: '2026-07-12T00:00:00.000Z',
            },
          ],
        ) as never,
    });

    const result = await service.configureOAuthProvider({
      projectId: 'demo',
      environment: 'local',
      providerId: 'google',
      payload: { clientId: 'client-id', clientSecret: 'client-secret' },
    });

    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    expect(result.ok).toBe(true);
    expect(result.credentialsRef).toBe('auth/oauth/google');
    expect(saveCount).toBe(0);
  });

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

    manifest = withOAuthProvider(manifest, {
      id: 'google',
      enabled: true,
      credentialsRef: 'auth/oauth/google',
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
    const manifest = withOAuthProvider(createManifest(), {
      id: 'google',
      enabled: true,
      credentialsRef: 'auth/oauth/google',
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

function withOAuthProvider(manifest: AppManifest, provider: AuthOAuthProviderConfig): AppManifest {
  return applyStudioAuthSettings(manifest, {
    scope: 'none',
    provider: 'supabase',
    flow: {
      signInRoute: 'sign-in',
      signUpRoute: 'sign-up',
      signOutRoute: 'sign-out',
      forgotPasswordRoute: 'forgot-password',
      postSignInRoute: '/',
      unauthorizedRoute: 'sign-in',
    },
    signIn: { identifiers: ['email'] },
    oauth: {
      enabled: false,
      callbackRoute: '/auth/callback',
      providers: [provider],
    },
  });
}

function fakeQuery(sql: string) {
  if (sql.includes('returning vault_secret_id::text as id')) {
    return Promise.resolve({ rows: [{ id: '00000000-0000-0000-0000-000000000001' }] });
  }

  return Promise.resolve({ rows: [] });
}

function createQueuedClient(...queue: Record<string, unknown>[][]) {
  return {
    query: () => Promise.resolve({ rows: queue.shift() ?? [] }),
    transaction: (
      operation: (executor: { query: () => Promise<{ rows: unknown[] }> }) => Promise<unknown>,
    ) =>
      operation({
        query: () => Promise.resolve({ rows: queue.shift() ?? [] }),
      }),
    close: () => Promise.resolve(),
  };
}
