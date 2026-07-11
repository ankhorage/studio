import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { configureManifestOAuthProvider } from './projectSecretService';

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
  test('creates canonical auth and OAuth configuration without inline values', () => {
    const next = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'google',
        label: 'Google',
        enabled: true,
        scopes: ['openid', 'email', 'profile'],
        credentialsRef: 'auth/oauth/google',
      },
      callbackRoute: '/auth/callback',
    });

    expect(next.infra.auth?.authorization).toBeUndefined();
    expect(next.infra.auth?.flow?.signInRoute).toBe('sign-in');
    expect(next.infra.auth?.oauth).toEqual({
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
    });

    const serialized = JSON.stringify(next);
    expect(serialized).not.toContain('clientSecret');
    expect(serialized).not.toContain('sentinel-secret');
  });

  test('replaces one provider without deleting unrelated providers', () => {
    const manifest = configureManifestOAuthProvider(createManifest(), {
      provider: {
        id: 'apple',
        enabled: false,
        credentialsRef: 'auth/oauth/apple',
      },
    });

    const next = configureManifestOAuthProvider(manifest, {
      provider: {
        id: 'apple',
        label: 'Apple',
        enabled: true,
        scopes: ['name', 'email'],
        credentialsRef: 'auth/oauth/apple',
      },
    });

    expect(next.infra.auth?.oauth?.providers).toHaveLength(1);
    expect(next.infra.auth?.oauth?.providers[0]?.enabled).toBe(true);
  });
});
