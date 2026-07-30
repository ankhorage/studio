import { describe, expect, it } from 'bun:test';

import {
  GENERATED_ANIMATION_DEPENDENCY_PAIR,
  getAppConfigTs,
  getBabelConfigJs,
  getPackageJson,
} from './templates';

describe('generated OAuth scaffold templates', () => {
  it('pins the canonical runtime, ZORA, Supabase auth, and Expo persistence dependencies', () => {
    const pkg = getPackageJson({
      name: 'oauth-app',
      authProvider: 'supabase',
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/contracts']).toBe('^4.0.0');
    expect(dependencies['@ankhorage/runtime']).toBe('^0.3.0');
    expect(dependencies['@ankhorage/zora']).toBe('^2.9.0');
    expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.0.0');
    expect(dependencies['expo-secure-store']).toBe('~15.0.8');
    expect(dependencies['expo-web-browser']).toBe('~15.0.11');
  });

  it('requires the first ZORA release that enforces interactionPolicy', () => {
    const pkg = getPackageJson({ name: 'studio-enabled-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/zora']).toBe('^2.9.0');
  });

  it('pins the intentional Expo SDK 54 Reanimated and Worklets compatibility pair', () => {
    const pkg = getPackageJson({ name: 'native-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(GENERATED_ANIMATION_DEPENDENCY_PAIR).toEqual({
      expoSdk: '54',
      reanimated: '4.3.0',
      worklets: '0.8.3',
    });
    expect(dependencies['react-native-reanimated']).toBe(
      GENERATED_ANIMATION_DEPENDENCY_PAIR.reanimated,
    );
    expect(dependencies['react-native-worklets']).toBe(
      GENERATED_ANIMATION_DEPENDENCY_PAIR.worklets,
    );
    expect(getPackageJson({ name: 'second-native-app', includeStudio: true }).dependencies).toEqual(
      pkg.dependencies,
    );
    expect(getBabelConfigJs()).toContain("'react-native-worklets/plugin'");
    expect(getBabelConfigJs()).not.toContain("'react-native-reanimated/plugin'");
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
