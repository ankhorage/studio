import { describe, expect, it } from 'bun:test';

import { getAppConfigTs, getBabelConfigJs, getIndexJs, getPackageJson } from './templates';

describe('generated OAuth scaffold templates', () => {
  it('pins the current generated app dependency baseline', () => {
    const pkg = getPackageJson({ name: 'generated-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;
    const devDependencies = pkg.devDependencies as Record<string, string>;

    expect(dependencies['@ankhorage/contracts']).toBe('^8.0.0');
    expect(dependencies['@ankhorage/data-sources']).toBe('^2.0.0');
    expect(dependencies['@ankhorage/expo-runtime']).toBe('^2.6.0');
    expect(dependencies['@ankhorage/runtime']).toBe('^2.1.0');
    expect(dependencies['@ankhorage/studio']).toBe('^1.13.4');
    expect(dependencies['@ankhorage/zora']).toBe('^2.13.2');
    expect(dependencies.expo).toBe('~54.0.37');
    expect(dependencies['expo-constants']).toBe('~18.0.14');
    expect(dependencies['expo-splash-screen']).toBe('~31.0.13');
    expect(dependencies['expo-updates']).toBe('~29.0.20');
    expect(dependencies['expo-modules-core']).toBeUndefined();
    expect(devDependencies['@ankhorage/devtools']).toBe('^1.5.2');
    expect(devDependencies['babel-plugin-module-resolver']).toBe('^5.0.2');
    expect(devDependencies.typescript).toBe('~5.9.3');
    expect(Object.values(dependencies)).not.toContain('latest');
  });

  it('pins the current auth and persistence adapter dependencies', () => {
    const pkg = getPackageJson({
      name: 'oauth-app',
      authProvider: 'supabase',
      storageProvider: 'supabase',
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/utility']).toBe('^0.2.0');
    expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.2.1');
    expect(dependencies['@ankhorage/supabase-storage']).toBe('^0.2.0');
    expect(dependencies['expo-secure-store']).toBe('~15.0.8');
    expect(dependencies['expo-web-browser']).toBe('~15.0.11');
  });

  it('does not inject the removed generated database runtime adapter', () => {
    const pkg = getPackageJson({ name: 'plain-app' });

    expect(Object.hasOwn(pkg.dependencies, '@ankhorage/supabase-db')).toBe(false);
    expect(pkg.dependencies['@ankhorage/runtime']).toBe('^2.1.0');
    expect(pkg.dependencies['@ankhorage/expo-runtime']).toBe('^2.6.0');
  });

  it('requires the ZORA release with bounded SidebarLayout fill sizing', () => {
    const pkg = getPackageJson({ name: 'studio-enabled-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/zora']).toBe('^2.13.2');
    expect(dependencies['@ankhorage/expo-runtime']).toBe('^2.6.0');
  });

  it('uses the Expo SDK 54 supported animation dependencies without custom Babel wiring', () => {
    const pkg = getPackageJson({ name: 'native-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;
    const babelConfig = getBabelConfigJs();

    expect(dependencies['react-native-reanimated']).toBe('~4.1.1');
    expect(dependencies['react-native-worklets']).toBe('0.5.1');
    expect(getPackageJson({ name: 'second-native-app', includeStudio: true }).dependencies).toEqual(
      pkg.dependencies,
    );
    expect(babelConfig).toContain("presets: ['babel-preset-expo']");
    expect(babelConfig).not.toContain("'react-native-worklets/plugin'");
    expect(babelConfig).not.toContain("'react-native-reanimated/plugin'");
  });

  it('omits auth-specific packages when auth is not generated', () => {
    const pkg = getPackageJson({ name: 'public-app' });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/utility']).toBeUndefined();
    expect(dependencies['@ankhorage/supabase-auth']).toBeUndefined();
    expect(dependencies['expo-secure-store']).toBeUndefined();
    expect(dependencies['expo-web-browser']).toBeUndefined();
  });

  it('uses canonical target identities for generated native configuration', () => {
    const appConfig = getAppConfigTs({
      name: 'OAuth App',
      slug: 'renamed-oauth-app',
      targets: {
        web: { enabled: true },
        android: {
          enabled: true,
          package: 'com.example.stable.android',
          scheme: 'stable-android',
        },
        ios: {
          enabled: true,
          bundleIdentifier: 'com.example.stable.ios',
          scheme: 'stable-ios',
        },
      },
    });

    expect(appConfig).toContain("package: 'com.example.stable.android'");
    expect(appConfig).toContain("bundleIdentifier: 'com.example.stable.ios'");
    expect(appConfig).toContain("scheme: 'stable-android'");
    expect(appConfig).toContain("scheme: 'stable-ios'");
    expect(appConfig).not.toContain('com.ankh.renamedoauthapp');
  });

  it('uses the canonical Expo Router entry for cold deep links', () => {
    const entry = getIndexJs();

    expect(entry).toBe("import 'expo-router/entry';\n");
    expect(entry).not.toContain('ExpoRoot');
    expect(entry).not.toContain('require.context');
  });
});
