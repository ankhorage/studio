import { describe, expect, test } from 'bun:test';

import {
  parseConfigureProjectOAuthProviderResponse,
  parseProjectSecretListResponse,
  parseProjectSecretMetadataResponse,
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
  test('parses metadata-only secret lists', () => {
    expect(parseProjectSecretListResponse({ ok: true, data: [metadata] })).toEqual([metadata]);
  });

  test('rejects raw secret fields in metadata responses', () => {
    expect(() =>
      parseProjectSecretMetadataResponse({
        ok: true,
        data: { ...metadata, payload: { clientSecret: 'sentinel-secret' } },
      }),
    ).toThrow('raw value field');
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
