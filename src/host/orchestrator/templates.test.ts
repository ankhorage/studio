import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'bun:test';

import {
  getAndroidRunTs,
  getAppConfigTs,
  getBabelConfigJs,
  getIndexJs,
  getMetroConfigJs,
  getPackageJson,
} from './templates';

const NATIVE_SINGLETON_PACKAGES = [
  'react',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
] as const;

describe('generated Metro config', () => {
  it('resolves native singletons from the consuming Expo app root', () => {
    const metroConfig = getMetroConfigJs();

    expect(metroConfig).toContain(
      "const appResolutionAnchor = path.join(__dirname, 'package.json')",
    );
    expect(metroConfig).toContain('{ ...context, originModulePath: appResolutionAnchor }');
    expect(metroConfig).toContain('moduleName.startsWith(`${packageName}/`)');
    for (const packageName of NATIVE_SINGLETON_PACKAGES) {
      expect(metroConfig).toContain(`  '${packageName}',`);
    }
    expect(metroConfig).not.toContain('apps/nutrition');
    expect(metroConfig).not.toContain('/Users/');
  });

  it('keeps apps/studio on the generated-app singleton strategy', async () => {
    const repositoryRoot = path.resolve(import.meta.dir, '..', '..', '..');
    const studioMetroConfig = await readFile(
      path.join(repositoryRoot, 'apps', 'studio', 'metro.config.js'),
      'utf8',
    );

    expect(studioMetroConfig).toBe(getMetroConfigJs());
  });
});

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
    expect(dependencies.expo).toBe('~54.0.36');
    expect(dependencies['expo-constants']).toBe('~18.0.13');
    expect(dependencies['expo-splash-screen']).toBe('~31.0.13');
    expect(dependencies['expo-updates']).toBe('~29.0.19');
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

  it('uses the Android-validated animation dependencies and Worklets Babel plugin', () => {
    const pkg = getPackageJson({ name: 'native-app', includeStudio: true });
    const dependencies = pkg.dependencies as Record<string, string>;
    const babelConfig = getBabelConfigJs();

    expect(dependencies['react-native-reanimated']).toBe('4.3.0');
    expect(dependencies['react-native-worklets']).toBe('0.8.3');
    expect(dependencies['react-native-gesture-handler']).toBe('~2.28.0');
    expect(getPackageJson({ name: 'second-native-app', includeStudio: true }).dependencies).toEqual(
      pkg.dependencies,
    );
    expect(babelConfig).toContain("presets: ['babel-preset-expo']");
    expect(babelConfig).toContain("'react-native-worklets/plugin'");
    expect(babelConfig).not.toContain("'react-native-reanimated/plugin'");
  });

  it('generates a portable Android loopback bridge for local services', () => {
    const pkg = getPackageJson({
      name: 'native-app',
      targets: { android: { enabled: true, package: 'com.example.app', scheme: 'example-app' } },
    });
    const androidRun = getAndroidRunTs({ projectId: 'native-app' });

    expect(pkg.scripts.android).toBe('bun scripts/ankh-android.ts');
    expect(androidRun).toContain("const PUBLIC_SUPABASE_URL = 'EXPO_PUBLIC_SUPABASE_URL'");
    expect(androidRun).toContain("const PUBLIC_STUDIO_API_URL = 'EXPO_PUBLIC_API_URL'");
    expect(androidRun).toContain("const DEFAULT_STUDIO_API_URL = 'http://127.0.0.1:3000/api'");
    expect(androidRun).toContain("const STUDIO_HOST_URL = 'ANKH_STUDIO_HOST_URL'");
    expect(androidRun).toContain('const projectId = "native-app"');
    expect(androidRun).toContain("new Set(['127.0.0.1', '::1', '[::1]', 'localhost'])");
    expect(androidRun).toContain("spawn('adb', ['track-devices', '-l']");
    expect(androidRun).toContain('resolveRequestedAndroidDevice(expoArgs)');
    expect(androidRun).toContain('transport.serial !== selectedSerial');
    expect(androidRun).toContain("field.startsWith('transport_id:')");
    expect(androidRun).toContain("'reverse',\n          mapping.local,\n          mapping.remote");
    expect(androidRun).toContain("['-s', serial, 'reverse', '--list']");
    expect(androidRun).toContain('await fetch(healthUrl, { signal: AbortSignal.timeout(5_000) })');
    expect(androidRun).toContain("const healthUrl = new URL('/health', url.origin)");
    expect(androidRun).toContain('Studio Host is unavailable at');
    expect(androidRun).toContain('/infra/runtime/ensure');
    expect(androidRun).toContain('Run Infrastructure Up and try again');
    expect(androidRun).toContain("await runExpoCommand(expoExecutable, ['run:android'");
    expect(androidRun).not.toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(androidRun).not.toContain("from '@ankhorage/infra");
    expect(androidRun).not.toContain('kubectl');
    expect(androidRun).not.toContain('supabase-gateway');
    expect(androidRun).not.toContain('10.0.2.2');
    expect(androidRun).toContain('deduplicateReverseMappings([supabaseMapping, studioApiMapping])');
    expect(androidRun).not.toContain("'tcp:8081'");
    expect(androidRun).not.toContain('apps/nutrition');
    expect(androidRun).not.toContain('/Users/');
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
