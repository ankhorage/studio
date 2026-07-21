import type { AppManifest } from '@ankhorage/contracts';
import type { SecretMetadata } from '@ankhorage/contracts/secrets';
import { describe, expect, test } from 'bun:test';

import { analyzeProjectAuthHealth } from './projectAuthHealth';

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
      plugins: [],
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
              enabled: true,
              credentialsRef: 'auth/oauth/google',
            },
          ],
        },
      },
    },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}

const googleMetadata = {
  ref: 'auth/oauth/google',
  scope: { projectId: 'demo', environment: 'local' },
  kind: 'oauth',
  provider: 'google',
  configuredFields: ['clientId', 'clientSecret'],
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
} satisfies SecretMetadata;

describe('projectAuthHealth', () => {
  test('does not treat credentialsRef alone as configured', () => {
    const health = analyzeProjectAuthHealth({
      manifest: createManifest(),
      secretMetadata: [],
      secretStoreAvailable: true,
    });

    expect(health.providers[0]?.status).toBe('missing');
    expect(health.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'referenced_secret_missing',
    );
    expect(health.callbackUrls.providerRedirectUrl).toBeUndefined();
  });

  test('requires every registry field to be configured', () => {
    const incomplete = analyzeProjectAuthHealth({
      manifest: createManifest(),
      secretMetadata: [{ ...googleMetadata, configuredFields: ['clientId'] }],
      secretStoreAvailable: true,
    });
    expect(incomplete.providers[0]?.status).toBe('incomplete');
    expect(incomplete.providers[0]?.missingFields).toEqual(['clientSecret']);

    const complete = analyzeProjectAuthHealth({
      manifest: createManifest(),
      secretMetadata: [googleMetadata],
      secretStoreAvailable: true,
    });
    expect(complete.providers[0]?.status).toBe('configured');
    expect(JSON.stringify(complete)).not.toContain('sentinel-phase2-secret-do-not-leak');
  });

  test('reports unavailable secret store as a diagnostic', () => {
    const health = analyzeProjectAuthHealth({
      manifest: createManifest(),
      secretMetadata: [],
      secretStoreAvailable: false,
    });

    expect(health.status).toBe('error');
    expect(health.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'secret_store_unavailable',
    );
  });
});
