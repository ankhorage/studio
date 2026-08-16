import type { SecretPayload, SecretStoreResult } from '@ankhorage/contracts/secrets';
import { expect, test } from 'bun:test';

import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig';
import { createAuth5NativeOAuthSmokeManifest } from './createAuth5NativeOAuthSmokeManifest';
import {
  type Auth5NativeOAuthSmokeInfraDependencies,
  prepareAuth5NativeOAuthSmokeInfra,
} from './prepareAuth5NativeOAuthSmokeInfra';

const SOURCE_CREDENTIAL_REF = 'team/oauth/google';
const SMOKE_CREDENTIAL_REF = 'auth/oauth/google';

test('uses smoke-owned public runtime env after activating with a trusted source credential', async () => {
  const sourceManifest = createAuth5NativeOAuthSmokeManifest();
  const googleProvider = sourceManifest.infra.auth?.oauth?.providers.find(
    (provider) => provider.id === 'google',
  );
  if (!googleProvider) throw new Error('Google fixture provider is unavailable.');
  googleProvider.credentialsRef = SOURCE_CREDENTIAL_REF;

  const credential: SecretStoreResult<SecretPayload> = {
    ok: true,
    data: { clientId: 'web-client-id', clientSecret: 'trusted-client-secret' },
  };
  const resolvedSourceRefs: string[] = [];
  let smokeResolverWasUsed = false;

  const dependencies: Auth5NativeOAuthSmokeInfraDependencies = {
    readSmokePublicEnv: () =>
      Promise.resolve(
        [
          'EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:19601',
          'EXPO_PUBLIC_SUPABASE_ANON_KEY=smoke-public-anon-key',
          '',
        ].join('\n'),
      ),
    readSourceManifest: () => Promise.resolve(sourceManifest),
    resolveSourceCredential: (ref) => {
      resolvedSourceRefs.push(ref);
      return Promise.resolve(credential);
    },
    activateSmokeInfrastructure: async (secretResolver) => {
      const resolved = await secretResolver.resolve({
        projectId: AUTH5_NATIVE_OAUTH_SMOKE.projectId,
        ref: SMOKE_CREDENTIAL_REF,
      });
      expect(resolved).toEqual(credential);
      smokeResolverWasUsed = true;
      return { target: 'local' };
    },
  };

  const result = await prepareAuth5NativeOAuthSmokeInfra(
    {
      credentialsProjectId: 'nutri',
      smokeWorkspaceRoot: '/tmp/auth5-smoke',
      sourceWorkspaceRoot: '/workspace/studio',
    },
    dependencies,
  );

  expect(resolvedSourceRefs).toEqual([SOURCE_CREDENTIAL_REF]);
  expect(smokeResolverWasUsed).toBe(true);
  expect(result).toEqual({
    androidCallback: 'ankh-auth5-android://auth/callback',
    gatewayUrl: 'http://127.0.0.1:19601',
    iosCallback: 'ankh-auth5-ios://auth/callback',
    projectId: AUTH5_NATIVE_OAUTH_SMOKE.projectId,
    target: 'local',
  });
});

test('fails after Infra activation when the smoke public anon key is missing', async () => {
  const sourceManifest = createAuth5NativeOAuthSmokeManifest();
  let activated = false;
  const credential: SecretStoreResult<SecretPayload> = {
    ok: true,
    data: { clientId: 'web-client-id', clientSecret: 'trusted-client-secret' },
  };

  const dependencies: Auth5NativeOAuthSmokeInfraDependencies = {
    readSmokePublicEnv: () => Promise.resolve('EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:19601\n'),
    readSourceManifest: () => Promise.resolve(sourceManifest),
    resolveSourceCredential: () => Promise.resolve(credential),
    activateSmokeInfrastructure: () => {
      activated = true;
      return Promise.resolve({ target: 'local' });
    },
  };

  let caught: unknown;
  try {
    await prepareAuth5NativeOAuthSmokeInfra(
      {
        credentialsProjectId: 'nutri',
        smokeWorkspaceRoot: '/tmp/auth5-smoke',
        sourceWorkspaceRoot: '/workspace/studio',
      },
      dependencies,
    );
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  expect(activated).toBe(true);
});
