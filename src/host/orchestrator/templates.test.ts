import type { ExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { describe, expect, it } from 'bun:test';

import {
  getAndroidRunTs,
  getAppConfigTs,
  getEslintConfigMjs,
  getEslintLocalConfigMjs,
  getPackageJson,
  getPrettierLocalConfigJs,
  getPrettierRcJs,
} from './templates';

const WEB_TARGETS = { web: { enabled: true } } as const;

describe('generated OAuth scaffold templates', () => {
  it('keeps generated Expo config plugin data outside the default export function', () => {
    const appConfig = getAppConfigTs({
      name: 'Generated app',
      slug: 'generated-app',
      targets: { web: { enabled: true } },
    });

    expect(appConfig).toContain("const GENERATED_PLUGINS: NonNullable<ExpoConfig['plugins']>");
    expect(appConfig).toContain('...(config.plugins ?? []), ...GENERATED_PLUGINS');
  });

  it('formats generated JSON and YAML serializers with their canonical output styles', () => {
    const prettierConfig = getPrettierRcJs();
    const localPrettierConfig = getPrettierLocalConfigJs();

    expect(prettierConfig).toContain("require('./prettier.local.config.js')");
    expect(prettierConfig).toContain('localConfig.overrides');
    expect(localPrettierConfig).toContain(
      "{ files: ['ankh.config.json', 'tsconfig.json'], options: { printWidth: 1 } }",
    );
    expect(localPrettierConfig).toContain(
      "{ files: 'infra/**/*.{yaml,yml}', options: { singleQuote: false } }",
    );
  });

  it('keeps the manifest-to-typed-route Href boundary lint-stable', () => {
    const eslintConfig = getEslintConfigMjs();
    const localConfig = getEslintLocalConfigMjs();

    expect(eslintConfig).toContain("import localConfig from './eslint.local.config.mjs'");
    expect(eslintConfig).toContain("files: ['src/**/*.{ts,tsx}']");
    expect(localConfig).toContain("files: ['src/app/_layout.tsx']");
    expect(localConfig).toContain("{ typesToIgnore: ['Href'] }");
    expect(localConfig).not.toContain("'@typescript-eslint/no-unnecessary-type-assertion': 'off'");
    expect(localConfig).not.toContain('createConfig');
  });

  it('pins the current generated app dependency baseline', () => {
    const pkg = getPackageJson({
      name: 'generated-app',
      includeStudio: true,
      targets: WEB_TARGETS,
    });
    const dependencies = pkg.dependencies as Record<string, string>;
    const devDependencies = pkg.devDependencies as Record<string, string>;

    expect(dependencies['@ankhorage/contracts']).toBe('^8.0.0');
    expect(dependencies['@ankhorage/data-sources']).toBe('^2.0.0');
    expect(dependencies['@ankhorage/expo-runtime']).toBe('^3.0.4');
    expect(dependencies['@ankhorage/permissions']).toBeUndefined();
    expect(dependencies['@react-navigation/bottom-tabs']).toBeUndefined();
    expect(dependencies['@react-navigation/drawer']).toBeUndefined();
    expect(dependencies['@ankhorage/runtime']).toBe('^2.2.0');
    expect(dependencies['@ankhorage/studio']).toBe('^2.0.2');
    expect(dependencies['@ankhorage/zora']).toBe('^3.0.0');
    expect(dependencies[EXPO_PLATFORM.runtime.expo.name]).toBe(EXPO_PLATFORM.runtime.expo.version);
    expect(dependencies[EXPO_PLATFORM.packages.camera.name]).toBeUndefined();
    expect(dependencies[EXPO_PLATFORM.packages.crypto.name]).toBeUndefined();
    expect(dependencies[EXPO_PLATFORM.packages.constants.name]).toBe(
      EXPO_PLATFORM.packages.constants.version,
    );
    expect(dependencies[EXPO_PLATFORM.packages.splashScreen.name]).toBe(
      EXPO_PLATFORM.packages.splashScreen.version,
    );
    expect(dependencies['expo-updates']).toBeUndefined();
    expect(dependencies['expo-modules-core']).toBeUndefined();
    expect(dependencies['@expo/vector-icons']).toBeUndefined();
    expect(dependencies['babel-preset-expo']).toBeUndefined();
    expect(devDependencies['@ankhorage/devtools']).toBe('^1.6.0');
    expect(devDependencies[EXPO_PLATFORM.tooling.expoDoctor.name]).toBe(
      EXPO_PLATFORM.tooling.expoDoctor.version,
    );
    expect(devDependencies['babel-plugin-module-resolver']).toBeUndefined();
    expect(devDependencies[EXPO_PLATFORM.tooling.typescript.name]).toBe(
      EXPO_PLATFORM.tooling.typescript.version,
    );
    expect(Object.values(dependencies)).not.toContain('latest');
  });

  it('pins the current auth and persistence adapter dependencies', () => {
    const pkg = getPackageJson({
      name: 'oauth-app',
      authProvider: 'supabase',
      storageProvider: 'supabase',
      targets: WEB_TARGETS,
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/utility']).toBe('^0.2.0');
    expect(dependencies['@ankhorage/supabase-auth']).toBe('^1.2.5');
    expect(dependencies['@ankhorage/supabase-storage']).toBe('^0.2.0');
    expect(dependencies[EXPO_PLATFORM.packages.crypto.name]).toBe(
      EXPO_PLATFORM.packages.crypto.version,
    );
    expect(dependencies[EXPO_PLATFORM.packages.secureStore.name]).toBe(
      EXPO_PLATFORM.packages.secureStore.version,
    );
    expect(dependencies[EXPO_PLATFORM.packages.webBrowser.name]).toBe(
      EXPO_PLATFORM.packages.webBrowser.version,
    );
  });

  it('adds camera dependencies only when the runtime plan requires them', () => {
    const runtimePlan: ExpoRuntimePlan = {
      capabilities: [],
      dependencies: [
        { name: '@ankhorage/permissions', reasons: ['permission:camera'], version: '^0.2.3' },
        {
          name: EXPO_PLATFORM.packages.camera.name,
          reasons: ['permission:camera'],
          version: EXPO_PLATFORM.packages.camera.version,
        },
      ],
      diagnostics: [],
      impliedPermissions: [],
      nativeConfig: { androidPermissions: [], configHints: [], plugins: [] },
      needsPermissionsProvider: true,
      permissions: [{ permission: 'camera' }],
      providers: ['permissions'],
      runtimeAdapters: [],
      usesExpoRuntimeRegistry: true,
    };
    const dependencies = getPackageJson({
      name: 'camera-app',
      runtimePlan,
      targets: WEB_TARGETS,
    }).dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/permissions']).toBe('^0.2.3');
    expect(dependencies[EXPO_PLATFORM.packages.camera.name]).toBe(
      EXPO_PLATFORM.packages.camera.version,
    );
  });

  it('requires the ZORA release with bounded SidebarLayout fill sizing', () => {
    const pkg = getPackageJson({
      name: 'studio-enabled-app',
      includeStudio: true,
      targets: WEB_TARGETS,
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies['@ankhorage/zora']).toBe('^3.0.0');
    expect(dependencies['@ankhorage/expo-runtime']).toBe('^3.0.4');
  });

  it('uses the owner-projected animation stack without explicit Babel configuration', () => {
    const pkg = getPackageJson({
      name: 'native-app',
      includeStudio: true,
      targets: WEB_TARGETS,
    });
    const dependencies = pkg.dependencies as Record<string, string>;

    expect(dependencies[EXPO_PLATFORM.animation.reanimated.name]).toBe(
      EXPO_PLATFORM.animation.reanimated.version,
    );
    expect(dependencies[EXPO_PLATFORM.animation.worklets.name]).toBe(
      EXPO_PLATFORM.animation.worklets.version,
    );
    expect(dependencies[EXPO_PLATFORM.animation.gestureHandler.name]).toBe(
      EXPO_PLATFORM.animation.gestureHandler.version,
    );
    expect(
      getPackageJson({
        name: 'second-native-app',
        includeStudio: true,
        targets: WEB_TARGETS,
      }).dependencies,
    ).toEqual(pkg.dependencies);
    expect(pkg.main).toBe('expo-router/entry');
  });

  it('generates a portable Android loopback bridge for local services', () => {
    const pkg = getPackageJson({
      name: 'native-app',
      targets: { android: { enabled: true, package: 'com.example.app', scheme: 'example-app' } },
    });
    const androidRun = getAndroidRunTs({ projectId: 'native-app', includeStudio: true });

    expect(pkg.scripts.android).toBe('bun scripts/ankh-android.ts');
    expect(androidRun).toContain("const PUBLIC_SUPABASE_URL = 'EXPO_PUBLIC_SUPABASE_URL'");
    expect(androidRun).toContain("const PUBLIC_STUDIO_API_URL = 'EXPO_PUBLIC_API_URL'");
    expect(androidRun).toContain("const DEFAULT_STUDIO_API_URL = 'http://127.0.0.1:3000/api'");
    expect(androidRun).toContain("const STUDIO_HOST_URL = 'ANKH_STUDIO_HOST_URL'");
    expect(androidRun).toContain("const projectId = 'native-app'");
    expect(androidRun).toContain('const includeStudio = true');
    expect(androidRun).toContain("new Set(['127.0.0.1', '::1', '[::1]', 'localhost'])");
    expect(androidRun).toContain("spawn('adb', ['track-devices', '-l']");
    expect(androidRun).toContain('resolveRequestedAndroidDevice(expoArgs)');
    expect(androidRun).toContain('let bufferedOutput: Buffer = Buffer.alloc(0)');
    expect(androidRun).toContain('if (argument === undefined) continue;');
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

  it('records standalone Android launchers without inventing a Studio API dependency', () => {
    const androidRun = getAndroidRunTs({ projectId: 'standalone-app', includeStudio: false });

    expect(androidRun).toContain('const includeStudio = false');
    expect(androidRun).toContain('const studioApiUrl = includeStudio');
    expect(androidRun).toContain('const studioApiMapping = includeStudio');
  });

  it('omits auth-specific packages when auth is not generated', () => {
    const pkg = getPackageJson({ name: 'public-app', targets: WEB_TARGETS });
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

  it('enables the default Expo Router and compiler configuration', () => {
    const pkg = getPackageJson({ name: 'generated-app', targets: WEB_TARGETS });
    const appConfig = getAppConfigTs({
      name: 'Generated App',
      slug: 'generated-app',
      targets: { web: { enabled: true } },
    });

    expect(pkg.main).toBe('expo-router/entry');
    expect(appConfig).toContain("'expo-router'");
    expect(appConfig).toContain('reactCompiler: true');
    expect(appConfig).toContain('typedRoutes: true');
    expect(appConfig).toContain("output: 'static'");
  });
});
