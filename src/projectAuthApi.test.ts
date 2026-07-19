import { describe, expect, test } from 'bun:test';

import {
  parseProjectAuthHealthResponse,
  parseProjectAuthHttpErrorResponse,
  ProjectAuthApiError,
} from './projectAuthApi';

describe('projectAuthApi', () => {
  test('parses metadata-only auth health and rejects nested raw secret fields', () => {
    expect(
      parseProjectAuthHealthResponse({
        ok: true,
        state: 'loaded',
        data: {
          status: 'healthy',
          diagnostics: [],
          providers: [
            {
              providerId: 'google',
              label: 'Google',
              enabled: true,
              credentialsRef: 'auth/oauth/google',
              status: 'configured',
              requiredFields: ['clientId', 'clientSecret'],
              configuredFields: ['clientId', 'clientSecret'],
              missingFields: [],
            },
          ],
          callbackUrls: { appCallbackRoute: '/auth/callback' },
        },
      }).providers[0]?.status,
    ).toBe('configured');

    expect(() =>
      parseProjectAuthHealthResponse({
        ok: true,
        state: 'loaded',
        data: {
          status: 'error',
          diagnostics: [{ code: 'x', severity: 'error', message: 'x' }],
          providers: [],
          callbackUrls: { appCallbackRoute: '/auth/callback' },
          nested: { privateKey: 'sentinel-phase2-secret-do-not-leak' },
        },
      }),
    ).toThrow('privateKey');
  });

  test('rejects raw secret fields in non-2xx auth responses', () => {
    const sentinel = 'sentinel-phase2-secret-do-not-leak';

    try {
      throw parseProjectAuthHttpErrorResponse(
        {
          ok: false,
          error: { code: 'invalid_config', message: 'Auth request failed.' },
          data: { nested: { payload: { token: sentinel } } },
        },
        400,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectAuthApiError);
      expect(error instanceof Error ? error.message : '').toContain(
        'Raw secret-shaped response field',
      );
      expect(error instanceof Error ? error.message : '').not.toContain(sentinel);
    }
  });
});
