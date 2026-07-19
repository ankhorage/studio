import type { AppManifest } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import { ProjectAuthService } from './projectAuthService';

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
    infra: { plugins: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}

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
  signUp: {
    requiredFields: ['email', 'password'],
    signUpPolicy: 'requireVerification',
  },
};

describe('ProjectAuthService', () => {
  test('rejects legacy server-side manifest writes after validating settings', async () => {
    let saveCount = 0;
    const manager = {
      getStudioManifest: () => Promise.reject(new Error('No draft')),
      getProjectManifest: () => Promise.resolve(createManifest()),
      saveStudioManifest: () => {
        saveCount += 1;
        return Promise.resolve({ success: true });
      },
    } as unknown as ConstructorParameters<typeof ProjectAuthService>[0];

    const result = await new ProjectAuthService(manager).configure('demo', config);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected disabled write failure.');
    expect(result.error.code).toBe('manifest_write_disabled');
    expect(saveCount).toBe(0);
  });

  test('does not write a manifest when inline secrets are submitted', async () => {
    let saveCount = 0;
    const manager = {
      getStudioManifest: () => Promise.resolve(createManifest()),
      getProjectManifest: () => Promise.resolve(createManifest()),
      saveStudioManifest: () => {
        saveCount += 1;
        return Promise.resolve({ success: true });
      },
    } as unknown as ConstructorParameters<typeof ProjectAuthService>[0];

    const result = await new ProjectAuthService(manager).configure('demo', {
      ...config,
      clientSecret: 'sentinel-secret',
    });

    expect(result.ok).toBe(false);
    expect(saveCount).toBe(0);
    if (result.ok) throw new Error('Expected validation failure.');
    expect(result.error.message).not.toContain('sentinel-secret');
  });
});
