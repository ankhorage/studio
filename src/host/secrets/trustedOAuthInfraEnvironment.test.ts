import type { AppManifest } from '@ankhorage/contracts';
import type { SecretPayload, SecretStoreResult } from '@ankhorage/contracts/secrets';
import { expect, test } from 'bun:test';

import {
  resolveTrustedOAuthInfraEnvironment,
  resolveTrustedOAuthInfraEnvironmentForUp,
  type TrustedOAuthSecretResolver,
} from './trustedOAuthInfraEnvironment';

test('resolves enabled OAuth credentialsRef into GoTrue Infra environment', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: true,
    credentialsRef: 'auth/oauth/google',
  });
  const env = await resolveTrustedOAuthInfraEnvironment({
    projectId: 'demo',
    workspaceRoot: '/tmp',
    projectManager: createProjectManager(manifest),
    secretResolver: createSecretResolver({
      clientId: 'fake-google-client',
      clientSecret: 'fake-google-secret',
    }),
  });

  expect(env).toEqual({
    GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: 'fake-google-client',
    GOTRUE_EXTERNAL_GOOGLE_SECRET: 'fake-google-secret',
  });
});

test('ignores disabled OAuth providers', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: false,
    credentialsRef: 'auth/oauth/google',
  });
  const env = await resolveTrustedOAuthInfraEnvironment({
    projectId: 'demo',
    workspaceRoot: '/tmp',
    projectManager: createProjectManager(manifest),
    secretResolver: {
      resolve: () => Promise.reject(new Error('disabled provider should not resolve secrets')),
    },
  });

  expect(env).toEqual({});
});

test('fails clearly when enabled OAuth credentials cannot be resolved', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: true,
    credentialsRef: 'auth/oauth/google',
  });

  await expectRejects(
    () =>
      resolveTrustedOAuthInfraEnvironment({
        projectId: 'demo',
        workspaceRoot: '/tmp',
        projectManager: createProjectManager(manifest),
        secretResolver: {
          resolve: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'not_found', message: 'secret missing' },
            }),
        },
      }),
    /Failed to resolve trusted OAuth credentials.*secret missing/u,
  );
});

test('defers trusted OAuth env for Infra Up when the local secret store is unavailable', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: true,
    credentialsRef: 'auth/oauth/google',
  });

  const result = await resolveTrustedOAuthInfraEnvironmentForUp({
    projectId: 'demo',
    workspaceRoot: '/tmp',
    projectManager: createProjectManager(manifest),
    secretResolver: {
      resolve: () =>
        Promise.resolve({
          ok: false,
          error: {
            code: 'unavailable',
            message: 'local Vault is stopped',
          },
        }),
    },
  });

  expect(result).toEqual({
    deferred: true,
    env: {},
    reason:
      "Trusted OAuth secret store is unavailable for provider 'google' at 'auth/oauth/google': local Vault is stopped",
  });
});

test('does not defer non-unavailable trusted OAuth failures for Infra Up', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: true,
    credentialsRef: 'auth/oauth/google',
  });

  await expectRejects(
    () =>
      resolveTrustedOAuthInfraEnvironmentForUp({
        projectId: 'demo',
        workspaceRoot: '/tmp',
        projectManager: createProjectManager(manifest),
        secretResolver: {
          resolve: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'not_found', message: 'secret missing' },
            }),
        },
      }),
    /Failed to resolve trusted OAuth credentials.*secret missing/u,
  );
});

test('fails clearly when enabled OAuth credentials have invalid payload shape', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: true,
    credentialsRef: 'auth/oauth/google',
  });

  await expectRejects(
    () =>
      resolveTrustedOAuthInfraEnvironment({
        projectId: 'demo',
        workspaceRoot: '/tmp',
        projectManager: createProjectManager(manifest),
        secretResolver: createInvalidSecretResolver({
          clientId: 'fake-google-client',
          clientSecret: 123,
        }),
      }),
    /must include string clientId and clientSecret/u,
  );
});

test('does not serialize trusted OAuth secrets into project manifest', async () => {
  const manifest = createOAuthManifest({
    oauthEnabled: true,
    providerEnabled: true,
    credentialsRef: 'auth/oauth/google',
  });
  await resolveTrustedOAuthInfraEnvironment({
    projectId: 'demo',
    workspaceRoot: '/tmp',
    projectManager: createProjectManager(manifest),
    secretResolver: createSecretResolver({
      clientId: 'fake-google-client',
      clientSecret: 'sentinel-provider-secret',
    }),
  });

  const serialized = JSON.stringify(manifest);
  expect(serialized).toContain('auth/oauth/google');
  expect(serialized).not.toContain('fake-google-client');
  expect(serialized).not.toContain('sentinel-provider-secret');
});

function createProjectManager(manifest: AppManifest) {
  return {
    getStudioManifest: () => Promise.resolve(manifest),
    getProjectManifest: () => Promise.resolve(manifest),
  };
}

function createSecretResolver(payload: SecretPayload): TrustedOAuthSecretResolver {
  return {
    resolve: () => Promise.resolve({ ok: true, data: payload }),
  };
}

function createInvalidSecretResolver(payload: Record<string, unknown>): TrustedOAuthSecretResolver {
  return {
    resolve: () =>
      Promise.resolve({
        ok: true,
        data: payload,
      } as unknown as SecretStoreResult<SecretPayload>),
  };
}

function createOAuthManifest(args: {
  readonly oauthEnabled: boolean;
  readonly providerEnabled: boolean;
  readonly credentialsRef: string;
}): AppManifest {
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
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
      deployment: {
        target: 'minikube',
        monitoring: false,
      },
      auth: {
        scope: 'global',
        provider: 'supabase',
        oauth: {
          enabled: args.oauthEnabled,
          callbackRoute: '/auth/callback',
          providers: [
            {
              id: 'google',
              enabled: args.providerEnabled,
              credentialsRef: args.credentialsRef,
            },
          ],
        },
      },
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
          id: 'root',
          type: 'Page',
        },
      },
    },
    themes: [],
    activeThemeId: 'default',
  };
}

async function expectRejects(
  operation: () => Promise<unknown>,
  expectedMessage: RegExp,
): Promise<void> {
  try {
    await operation();
    throw new Error('Expected operation to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(expectedMessage);
  }
}
