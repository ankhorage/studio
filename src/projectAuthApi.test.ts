import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings } from './authSettings';
import { parseProjectAuthSettingsResponse } from './projectAuthApi';

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
    expect(() =>
      parseProjectAuthSettingsResponse(
        {
          ok: true,
          state: 'loaded',
          data: {
            ...config,
            oauth: {
              ...config.oauth,
              providers: [{ ...config.oauth.providers[0], clientSecret: 'sentinel-secret' }],
            },
          },
        },
        'loaded',
      ),
    ).toThrow('clientSecret');
  });
});
