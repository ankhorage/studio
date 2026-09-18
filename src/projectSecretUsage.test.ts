import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { findProjectSecretUsages } from './projectSecretUsage';

function createManifest(): AppManifest {
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      environments: {
        local: {
          deployment: {
            compute: { provider: 'local' },
            runtime: { provider: 'minikube' },
          },
          auth: {
            scope: 'global',
            provider: 'supabase',
            flow: { signInRoute: 'sign-in', postSignInRoute: '/' },
            signIn: { identifiers: ['email'] },
            oauth: {
              enabled: true,
              callbackRoute: '/auth/callback',
              providers: [
                {
                  id: 'google',
                  label: 'Google',
                  enabled: true,
                  credentialsRef: 'auth/oauth/google',
                },
                {
                  id: 'apple',
                  label: 'Apple',
                  enabled: false,
                  credentialsRef: 'auth/oauth/apple',
                },
              ],
            },
          },
        },
      },
      modules: {},
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: {
      default: {
        id: 'default',
        name: 'Default',
        light: { primaryColor: '#3366ff', harmony: 'analogous' },
        dark: { primaryColor: '#6699ff', harmony: 'analogous' },
      },
    },
    activeThemeId: 'default',
  };
}

describe('projectSecretUsage', () => {
  test('detects canonical OAuth credential references only', () => {
    const manifest = createManifest();
    const sentinel = 'sentinel-phase2-secret-do-not-leak';
    manifest.metadata.name = sentinel;

    expect(findProjectSecretUsages({ manifest, ref: 'auth/oauth/google' }).usages).toEqual([
      {
        ref: 'auth/oauth/google',
        path: 'infra.environments.local.auth.oauth.providers[google].credentialsRef',
        category: 'oauth-provider',
        label: 'Google OAuth provider',
        ownerId: 'google',
        breaksWhenMissing: true,
      },
    ]);

    expect(findProjectSecretUsages({ manifest, ref: sentinel }).usages).toEqual([]);
    expect(
      JSON.stringify(findProjectSecretUsages({ manifest, ref: 'auth/oauth/google' })),
    ).not.toContain(sentinel);
  });

  test('sorts and marks disabled provider usages deterministically', () => {
    expect(
      findProjectSecretUsages({ manifest: createManifest(), ref: 'auth/oauth/apple' }),
    ).toEqual({
      ref: 'auth/oauth/apple',
      usages: [
        {
          ref: 'auth/oauth/apple',
          path: 'infra.environments.local.auth.oauth.providers[apple].credentialsRef',
          category: 'oauth-provider',
          label: 'Apple OAuth provider',
          ownerId: 'apple',
          breaksWhenMissing: false,
        },
      ],
    });
  });
});
