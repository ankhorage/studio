import { describe, expect, it } from 'bun:test';

import { getAppConfigTs, getPackageJson } from './templates';

describe('generated OAuth scaffold templates', () => {
  it('pins the canonical contracts, Supabase auth, and Expo persistence dependencies', () => {
    const pkg = getPackageJson({
      name: 'oauth-app',
      authProvider: 'supabase',
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/contracts']).toBe('^3.0.0');
    expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.0.0');
    expect(dependencies['expo-secure-store']).toBe('~15.0.8');
    expect(dependencies['expo-web-browser']).toBe('~15.0.11');
  });

  it('omits OAuth-specific packages when auth is not generated', () => {
    const pkg = getPackageJson({ name: 'public-app' });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/supabase-auth']).toBeUndefined();
    expect(dependencies['expo-secure-store']).toBeUndefined();
    expect(dependencies['expo-web-browser']).toBeUndefined();
  });

  it('generates one deterministic native scheme for callback deep links', () => {
    const appConfig = getAppConfigTs({
      name: 'OAuth App',
      slug: 'oauth-app',
      bundleSuffix: 'oauthapp',
    });

    expect(appConfig).toContain("scheme: 'ankh-oauthapp'");
    expect(appConfig).toContain("package: 'com.ankh.oauthapp'");
    expect(appConfig).toContain("bundleIdentifier: 'com.ankh.oauthapp'");
  });
});
