import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings } from './authSettings';
import {
  parseProjectAuthHealthResponse,
  parseProjectAuthHttpErrorResponse,
  parseProjectAuthSettingsResponse,
  ProjectAuthApiError,
} from './projectAuthApi';

const config = {
  scope: 'global',
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
    enabled: true,
    callbackRoute: '/auth/callback',
    providers: [
      {
        id: 'google',
        enabled: true,
        credentialsRef: 'auth/oauth/google',
      },
    ],
  },
} satisfies StudioAuthSettings;

describe('projectAuthApi', () => {
  test('parses loaded and saved canonical auth settings', () => {
    expect(
      parseProjectAuthSettingsResponse({ ok: true, state: 'loaded', data: config }, 'loaded'),
    ).toEqual(config);
    expect(
      parseProjectAuthSettingsResponse({ ok: true, state: 'saved', data: config }, 'saved'),
    ).toEqual(config);
  });

  test('allows an unconfigured project only for loaded responses', () => {
    expect(
      parseProjectAuthSettingsResponse({ ok: true, state: 'loaded', data: null }, 'loaded'),
    ).toBeNull();
    expect(() =>
      parseProjectAuthSettingsResponse({ ok: true, state: 'saved', data: null }, 'saved'),
    ).toThrow('unsupported fields');
  });

  test('rejects inline secret-shaped response fields', () => {
    const sentinel = 'sentinel-phase2-secret-do-not-leak';
    expect(() =>
      parseProjectAuthSettingsResponse(
        {
          ok: true,
          state: 'loaded',
          data: {
            ...config,
            oauth: {
              ...config.oauth,
              providers: [{ ...config.oauth.providers[0], clientSecret: sentinel }],
            },
          },
        },
        'loaded',
      ),
    ).toThrow('clientSecret');
  });

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
