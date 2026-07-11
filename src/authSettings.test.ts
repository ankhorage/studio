import { describe, expect, test } from 'bun:test';
import type { AppManifest } from '@ankhorage/contracts';

import {
  applyStudioAuthSettings,
  readStudioAuthSettings,
  validateStudioAuthSettings,
} from './authSettings';

function createManifest(): AppManifest {
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
      plugins: [],
      auth: {
        scope: 'global',
        provider: 'supabase',
        authorization: { kind: 'RBAC', engine: 'native' },
        flow: {
          signInRoute: 'sign-in',
          signUpRoute: 'sign-up',
          signOutRoute: 'sign-out',
          forgotPasswordRoute: 'forgot-password',
          postSignInRoute: '/',
          unauthorizedRoute: 'sign-in',
        },
        signIn: { identifiers: ['email'] },
      },
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}

const validSettings = {
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
  signUp: {
    requiredFields: ['email', 'password'],
    optionalFields: ['displayName'],
    signUpPolicy: 'requireVerification',
  },
  oauth: {
    enabled: true,
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
  },
  profile: {
    table: 'profiles',
    fields: ['email', 'displayName', 'avatarUrl'],
    primaryKey: 'authUserId',
    createStrategy: 'trigger',
    updateStrategy: 'api',
  },
};

describe('authSettings', () => {
  test('validates and applies only canonical infra.auth settings', () => {
    const parsed = validateStudioAuthSettings(validSettings);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error.message);

    const next = applyStudioAuthSettings(createManifest(), parsed.data);
    expect(next.infra.auth?.flow?.forgotPasswordRoute).toBe('forgot-password');
    expect(next.infra.auth?.signUp?.signUpPolicy).toBe('requireVerification');
    expect(next.infra.auth?.oauth?.providers[0]?.credentialsRef).toBe('auth/oauth/google');
    expect(next.infra.auth?.profile?.table).toBe('profiles');
    expect(next.infra.auth?.authorization).toEqual({ kind: 'RBAC', engine: 'native' });
    expect('authFlow' in next.settings).toBe(false);
  });

  test('reads defaults for optional canonical flow and sign-in fields', () => {
    const manifest = createManifest();
    if (!manifest.infra.auth) throw new Error('Expected auth fixture.');
    delete manifest.infra.auth.flow;
    delete manifest.infra.auth.signIn;

    const settings = readStudioAuthSettings(manifest);
    expect(settings?.flow.signInRoute).toBe('sign-in');
    expect(settings?.signIn.identifiers).toEqual(['email']);
  });

  test('rejects inline provider secret values without echoing them', () => {
    const sentinel = 'sentinel-never-echo';
    const parsed = validateStudioAuthSettings({
      ...validSettings,
      oauth: {
        ...validSettings.oauth,
        providers: [{ ...validSettings.oauth.providers[0], clientSecret: sentinel }],
      },
    });

    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error('Expected inline secret rejection.');
    expect(parsed.error.message).toContain('clientSecret');
    expect(parsed.error.message).not.toContain(sentinel);
  });

  test('rejects authorization controls, users profile table, and unsupported fields', () => {
    expect(validateStudioAuthSettings({ ...validSettings, authorization: {} }).ok).toBe(false);
    expect(
      validateStudioAuthSettings({
        ...validSettings,
        profile: { ...validSettings.profile, table: 'users' },
      }).ok,
    ).toBe(false);
    expect(
      validateStudioAuthSettings({
        ...validSettings,
        profile: { ...validSettings.profile, fields: ['email', 'role'] },
      }).ok,
    ).toBe(false);
  });

  test('rejects enabled providers without references and duplicate provider ids', () => {
    expect(
      validateStudioAuthSettings({
        ...validSettings,
        oauth: {
          ...validSettings.oauth,
          providers: [{ id: 'google', enabled: true }],
        },
      }).ok,
    ).toBe(false);

    expect(
      validateStudioAuthSettings({
        ...validSettings,
        oauth: {
          ...validSettings.oauth,
          providers: [
            validSettings.oauth.providers[0],
            { ...validSettings.oauth.providers[0] },
          ],
        },
      }).ok,
    ).toBe(false);
  });
});
