import { describe, expect, test } from 'bun:test';

import {
  configureProjectOAuthProvider,
  type ConfigureProjectOAuthProviderInput,
  parseConfigureProjectOAuthProviderResponse,
  parseProjectSecretListResponse,
  parseProjectSecretMetadataResponse,
  parseProjectSecretUsageSummaryResponse,
  ProjectSecretApiError,
} from './projectSecretApi';

const metadata = {
  ref: 'auth/oauth/google',
  scope: { projectId: 'demo', environment: 'local' },
  kind: 'oauth',
  provider: 'google',
  configuredFields: ['clientId', 'clientSecret'],
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
};

describe('projectSecretApi', () => {
  test('keeps the OAuth orchestration client surface available', () => {
    const input = {
      projectId: 'demo',
      providerId: 'google',
      payload: { clientId: 'id', clientSecret: 'secret' },
    } satisfies ConfigureProjectOAuthProviderInput;

    expect(typeof configureProjectOAuthProvider).toBe('function');
    expect(input.providerId).toBe('google');
  });

  test('parses metadata-only secret lists', () => {
    expect(parseProjectSecretListResponse({ ok: true, data: [metadata] })).toEqual([metadata]);
  });

  test('rejects raw secret fields in metadata responses', () => {
    const sentinel = 'sentinel-phase2-secret-do-not-leak';
    expect(() =>
      parseProjectSecretMetadataResponse({
        ok: true,
        data: { ...metadata, nested: { payload: { clientSecret: sentinel } } },
      }),
    ).toThrow('Raw secret-shaped response field');
    try {
      parseProjectSecretMetadataResponse({
        ok: true,
        data: { ...metadata, nested: { payload: { clientSecret: sentinel } } },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectSecretApiError);
      expect(error instanceof Error ? error.message : '').not.toContain(sentinel);
    }
  });

  test('parses metadata-only usage summaries', () => {
    expect(
      parseProjectSecretUsageSummaryResponse({
        ok: true,
        data: {
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
        },
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
  });

  test('parses saved OAuth orchestration without returning submitted values', () => {
    expect(
      parseConfigureProjectOAuthProviderResponse({
        ok: true,
        state: 'saved',
        metadata,
        credentialsRef: 'auth/oauth/google',
      }),
    ).toEqual({
      ok: true,
      state: 'saved',
      metadata,
      credentialsRef: 'auth/oauth/google',
    });
  });

  test('preserves recoverable partial-failure state', () => {
    expect(
      parseConfigureProjectOAuthProviderResponse({
        ok: false,
        state: 'secret_saved_manifest_failed',
        metadata,
        credentialsRef: 'auth/oauth/google',
        error: { code: 'manifest_write_failed', message: 'Retry the manifest save.' },
      }),
    ).toEqual({
      ok: false,
      state: 'secret_saved_manifest_failed',
      metadata,
      credentialsRef: 'auth/oauth/google',
      error: { code: 'manifest_write_failed', message: 'Retry the manifest save.' },
    });
  });
});
