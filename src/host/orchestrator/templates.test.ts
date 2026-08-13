import { describe, expect, it } from 'bun:test';

import { EXPO_SDK_54_ANIMATION_COMPATIBILITY } from './expoSdk54AnimationCompatibility';
import { getAppConfigTs, getBabelConfigJs, getIndexJs, getPackageJson } from './templates';

describe('generated OAuth scaffold templates', () => {
  it('pins the canonical runtime, ZORA, utility, Supabase auth, and Expo persistence dependencies', () => {
    const pkg = getPackageJson({
      name: 'oauth-app',
      authProvider: 'supabase',
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/contracts']).toBe('^4.0.2');
    expect(dependencies['@ankhorage/data-sources']).toBe('^1.0.1');
    expect(dependencies['@ankhorage/expo-runtime']).toBe('^2.2.1');
    expect(dependencies['@ankhorage/runtime']).toBe('^1.0.0');
    expect(dependencies['@ankhorage/utility']).toBe('^0.2.0');
    expect(dependencies['@ankhorage/zora']).toBe('^2.9.0');
    expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.1.2');
    expect(dependencies['expo-secure-store']).toBe('~15.0.8');
    expect(dependencies['expo-web-browser']).toBe('~15.0.11');
  });

  it('adds the released Supabase DB adapter only for generated database runtime', () => {
    const generatedDb = getPackageJson({
      name: 'generated-db-app',
      databaseRuntimeProvider: 'supabase',
    });
    const plain = getPackageJson({ name: 'plain-app' });

    expect(generatedDb.dependencies['@ankhorage/supabase-db']).toBe('^1.0.0');
    expect(plain.dependencies['@ankhorage/supabase-db']).toBeUndefined();
    expect(plain.dependencies['@ankhorage/expo-runtime']).toBe('^2.2.1');
  });

  it('requires the first ZORA release that enforces interactionPolicy', () => {
    const pkg = getPackageJson({ name: 'studio-enabled-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/zora']).toBe('^2.9.0');
    expect(dependencies['@ankhorage/expo-runtime']).toBe('^2.2.1');
  });

  it('pins the intentional Expo SDK 54 Reanimated and Worklets compatibility pair', () => {
    const pkg = getPackageJson({ name: 'native-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(EXPO_SDK_54_ANIMATION_COMPATIBILITY).toEqual({
      babelPlugin: 'react-native-worklets/plugin',
      expoSdk: '54',
      reanimated: '4.3.0',
      worklets: '0.8.3',
    });
    expect(dependencies['react-native-reanimated']).toBe(
      EXPO_SDK_54_ANIMATION_COMPATIBILITY.reanimated,
    );
    expect(dependencies['react-native-worklets']).toBe(
      EXPO_SDK_54_ANIMATION_COMPATIBILITY.worklets,
    );
    expect(getPackageJson({ name: 'second-native-app', includeStudio: true }).dependencies).toEqual(
      pkg.dependencies,
    );
    expect(getBabelConfigJs()).toContain(`'${EXPO_SDK_54_ANIMATION_COMPATIBILITY.babelPlugin}'`);
    expect(getBabelConfigJs()).not.toContain("'react-native-reanimated/plugin'");
  });

  it('omits auth-specific packages when auth is not generated', () => {
    const pkg = getPackageJson({ name: 'public-app' });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/utility']).toBeUndefined();
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

  it('uses the canonical Expo Router entry for cold deep links', () => {
    const entry = getIndexJs();

    expect(entry).toBe("import 'expo-router/entry';\n");
    expect(entry).not.toContain('ExpoRoot');
    expect(entry).not.toContain('require.context');
  });
});
