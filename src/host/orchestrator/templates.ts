import type { SplashScreenSpec } from '@ankhorage/contracts';
import type {
  AppDeployAndroidTargetConfig,
  AppDeployIosTargetConfig,
  AppDeployTargets,
} from '@ankhorage/contracts/deploy';
import {
  type ExpoRuntimeConfigPluginOutput,
  type ExpoRuntimePlan,
  resolveExpoRuntimeDependencyMap,
  resolveExpoRuntimeNativeOutput,
  resolveExpoRuntimeNativeSchemeMap,
} from '@ankhorage/expo-runtime/planning';

import { EXPO_SDK_54_ANIMATION_COMPATIBILITY } from './expoSdk54AnimationCompatibility.js';

export type GeneratedAuthProvider = 'supabase' | null;
export type GeneratedStorageProvider = 'supabase' | null;
const EXPO_MODULES_CORE_VERSION = '~3.0.30';
const CONTRACTS_VERSION = '^8.0.0';
const DATA_SOURCES_VERSION = '^2.0.0';
const RUNTIME_VERSION = '^2.0.0';
const STUDIO_VERSION = '^1.12.5';
const UTILITY_VERSION = '^0.2.0';
const SUPABASE_AUTH_VERSION = '^1.2.1';
const SUPABASE_STORAGE_VERSION = '^0.2.0';
const ZORA_VERSION = '^2.13.2';
const EXPO_RUNTIME_VERSION = '^2.6.0';
const DEVTOOLS_VERSION = '^1.4.1';
const EXPO_VERSION = '~54.0.36';
const EXPO_DOCUMENT_PICKER_VERSION = '~14.0.8';
const EXPO_FILE_SYSTEM_VERSION = '~19.0.23';
const EXPO_IMAGE_PICKER_VERSION = '~17.0.11';
const EXPO_SECURE_STORE_VERSION = '~15.0.8';
const EXPO_UPDATES_VERSION = '~29.0.19';
const EXPO_WEB_BROWSER_VERSION = '~15.0.11';
const BABEL_MODULE_RESOLVER_VERSION = '^5.0.2';
const TYPESCRIPT_VERSION = '~5.9.3';
const LEGACY_WEB_ONLY_TARGETS: AppDeployTargets = { web: { enabled: true } };

function serializeStringLiteral(value: string): string {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')}'`;
}

function serializeJsValue(value: unknown, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);
  const nextIndent = '  '.repeat(indentLevel + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (
      value.every((entry) => ['string', 'number', 'boolean'].includes(typeof entry)) &&
      value.length <= 3
    ) {
      return `[${value.map((entry) => serializeJsValue(entry)).join(', ')}]`;
    }

    return `[\n${value
      .map((entry) => `${nextIndent}${serializeJsValue(entry, indentLevel + 1)}`)
      .join(',\n')}\n${indent}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return '{}';
    }

    return `{\n${entries
      .map(([key, entryValue]) => {
        const serializedKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) ? key : JSON.stringify(key);
        return `${nextIndent}${serializedKey}: ${serializeJsValue(entryValue, indentLevel + 1)}`;
      })
      .join(',\n')},\n${indent}}`;
  }

  if (typeof value === 'string') {
    return serializeStringLiteral(value);
  }

  return String(value);
}

function serializeSplashScreenPlugin(
  splashScreen: SplashScreenSpec | null | undefined,
): string | null {
  if (splashScreen == null) {
    return null;
  }

  const serializedConfig = serializeJsValue(splashScreen, 3);
  return `[
      'expo-splash-screen',
      ${serializedConfig},
    ]`;
}

function serializeRuntimePlugin(plugin: ExpoRuntimeConfigPluginOutput): string {
  if (typeof plugin === 'string') {
    return serializeJsValue(plugin);
  }

  const [name, options] = plugin;
  const serializedOptions = serializeJsValue(options, 3);
  return `[
      ${serializeJsValue(name)},
      ${serializedOptions},
    ]`;
}

function serializePluginsWithRuntimePlan(args: {
  splashScreen: SplashScreenSpec | null | undefined;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const entries = resolveExpoRuntimeNativeOutput(args.runtimePlan).configPlugins.map(
    serializeRuntimePlugin,
  );
  const splashPlugin = serializeSplashScreenPlugin(args.splashScreen);
  if (splashPlugin !== null) {
    entries.push(splashPlugin);
  }

  if (entries.length === 0) {
    return '[...(config.plugins ?? [])]';
  }

  return `[
    ...(config.plugins ?? []),
    ${entries.join(',\n    ')},
  ]`;
}

function serializeAndroidConfig(args: {
  target: AppDeployAndroidTargetConfig;
  scheme?: string;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const permissions = resolveExpoRuntimeNativeOutput(args.runtimePlan).androidPermissions;
  const extraLines =
    permissions.length > 0
      ? `
    permissions: ${serializeJsValue(permissions, 2)},`
      : '';
  const schemeLine = args.scheme
    ? `
    scheme: ${serializeStringLiteral(args.scheme)},`
    : '';

  return `{
    ...config.android,${extraLines}
    package: ${serializeStringLiteral(args.target.package)},${schemeLine}
  }`;
}

function serializeIosConfig(args: { target: AppDeployIosTargetConfig; scheme?: string }): string {
  const schemeLine = args.scheme
    ? `
    scheme: ${serializeStringLiteral(args.scheme)},`
    : '';

  return `{
    ...config.ios,
    bundleIdentifier: ${serializeStringLiteral(args.target.bundleIdentifier)},${schemeLine}
  }`;
}

function serializeTargetSections(args: {
  targets: AppDeployTargets;
  runtimePlan?: ExpoRuntimePlan;
}): string {
  const sections: string[] = [];
  const nativeSchemes = resolveExpoRuntimeNativeSchemeMap(args.targets);
  if (args.targets.android?.enabled) {
    sections.push(
      `  android: ${serializeAndroidConfig({ target: args.targets.android, scheme: nativeSchemes.android, runtimePlan: args.runtimePlan })},`,
    );
  }
  if (args.targets.ios?.enabled) {
    sections.push(
      `  ios: ${serializeIosConfig({ target: args.targets.ios, scheme: nativeSchemes.ios })},`,
    );
  }
  if (args.targets.web?.enabled) {
    sections.push(`  web: {
    ...config.web,
    output: 'static',
    favicon: './assets/favicon.png',
  },`);
  }
  return sections.length > 0
    ? String.fromCharCode(10) + sections.join(String.fromCharCode(10))
    : '';
}

export function getAppConfigTs({
  name,
  slug,
  targets,
  splashScreen = null,
  runtimePlan,
}: {
  name: string;
  slug: string;
  targets: AppDeployTargets;
  splashScreen?: SplashScreenSpec | null;
  runtimePlan?: ExpoRuntimePlan;
}) {
  const targetSections = serializeTargetSections({ targets, runtimePlan });
  return `import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = { ...config };
  delete baseConfig.scheme;
  delete baseConfig.android;
  delete baseConfig.ios;
  delete baseConfig.web;

  return {
    ...baseConfig,
    name: ${serializeStringLiteral(name)},
    slug: ${serializeStringLiteral(slug)},
    plugins: ${serializePluginsWithRuntimePlan({ splashScreen, runtimePlan })},${targetSections}
  };
};
`;
}

export function getMetroConfigJs() {
  const metroConfigJs = `const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
`;
  return metroConfigJs;
}

export function getBabelConfigJs() {
  return `module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@root': './',
          },
        },
      ],
      '${EXPO_SDK_54_ANIMATION_COMPATIBILITY.babelPlugin}',
    ],
  };
};
`;
}

export function getPackageJson(args: {
  name: string;
  includeStudio?: boolean;
  authProvider?: GeneratedAuthProvider;
  storageProvider?: GeneratedStorageProvider;
  runtimePlan?: ExpoRuntimePlan;
  targets?: AppDeployTargets;
}) {
  const {
    name,
    includeStudio = false,
    authProvider = null,
    storageProvider = null,
    runtimePlan,
    targets = LEGACY_WEB_ONLY_TARGETS,
  } = args;
  const runtimeDependencies = resolveExpoRuntimeDependencyMap(runtimePlan);
  const pkgJson = {
    name,
    main: 'index.js',
    packageManager: 'bun@1.3.14',
    version: '1.0.0',
    scripts: {
      start: 'expo start',
      ...(targets.android?.enabled ? { android: 'expo run:android' } : {}),
      ...(targets.ios?.enabled ? { ios: 'expo run:ios' } : {}),
      ...(targets.web?.enabled ? { web: 'expo start --web' } : {}),
      lint: 'ankhorage-eslint . --max-warnings=0',
      'lint:fix': 'ankhorage-eslint . --fix --max-warnings=0',
      format: 'ankhorage-prettier --write .',
      'format:check': 'ankhorage-prettier --check .',
    },
    dependencies: {
      '@ankhorage/contracts': CONTRACTS_VERSION,
      '@ankhorage/data-sources': DATA_SOURCES_VERSION,
      '@ankhorage/expo-runtime': EXPO_RUNTIME_VERSION,
      '@ankhorage/runtime': RUNTIME_VERSION,
      '@ankhorage/studio': STUDIO_VERSION,
      ...(authProvider !== null ? { '@ankhorage/utility': UTILITY_VERSION } : {}),
      ...(authProvider === 'supabase'
        ? {
            '@ankhorage/supabase-auth': SUPABASE_AUTH_VERSION,
            'expo-secure-store': EXPO_SECURE_STORE_VERSION,
            'expo-web-browser': EXPO_WEB_BROWSER_VERSION,
          }
        : {}),
      ...(storageProvider === 'supabase'
        ? { '@ankhorage/supabase-storage': SUPABASE_STORAGE_VERSION }
        : {}),
      '@ankhorage/zora': ZORA_VERSION,
      ...runtimeDependencies,
      ...(includeStudio
        ? {
            '@expo/vector-icons': '^15.0.3',
            '@react-native-picker/picker': '2.11.1',
            'expo-document-picker': EXPO_DOCUMENT_PICKER_VERSION,
            'expo-file-system': EXPO_FILE_SYSTEM_VERSION,
            'expo-image-picker': EXPO_IMAGE_PICKER_VERSION,
          }
        : {}),
      '@react-navigation/bottom-tabs': '^7.18.2',
      '@react-navigation/drawer': '^7.5.0',
      'babel-preset-expo': '^54.0.10',
      expo: EXPO_VERSION,
      'expo-constants': '~18.0.13',
      'expo-font': '~14.0.12',
      'expo-linear-gradient': '~15.0.8',
      'expo-linking': '~8.0.12',
      'expo-modules-core': EXPO_MODULES_CORE_VERSION,
      'expo-router': '~6.0.24',
      'expo-splash-screen': '~31.0.10',
      'expo-status-bar': '^3.0.9',
      'expo-updates': EXPO_UPDATES_VERSION,
      react: '19.1.0',
      'react-dom': '19.1.0',
      'react-native': '0.81.5',
      'react-native-gesture-handler': '~2.28.0',
      'react-native-reanimated': EXPO_SDK_54_ANIMATION_COMPATIBILITY.reanimated,
      'react-native-safe-area-context': '~5.6.0',
      'react-native-screens': '~4.16.0',
      'react-native-svg': '~15.12.1',
      'react-native-web': '^0.21.2',
      'react-native-worklets': EXPO_SDK_54_ANIMATION_COMPATIBILITY.worklets,
      'reanimated-color-picker': '^4.2.0',
    },
    devDependencies: {
      '@ankhorage/devtools': DEVTOOLS_VERSION,
      '@types/node': '^25.6.0',
      '@types/react': '~19.1.0',
      '@types/culori': '^4.0.1',
      'babel-plugin-module-resolver': BABEL_MODULE_RESOLVER_VERSION,
      typescript: TYPESCRIPT_VERSION,
    },
  };

  return pkgJson;
}

export function getEslintConfigMjs() {
  return `import { createConfig } from '@ankhorage/devtools/eslint';

export default createConfig({
  tsconfigRootDir: import.meta.dirname,
  project: ['./tsconfig.json'],
  files: [
    'app.config.ts',
    'src/app/**/*.{ts,tsx}',
    'src/auth/**/*.{ts,tsx}',
    'src/generated/**/*.{ts,tsx}',
    'src/modules/**/*.{ts,tsx}',
  ],
  additionalIgnores: [
    '**/*.js',
    '**/*.cjs',
    '**/*.mjs',
    'dist/**',
    '.expo/**',
  ],
});
`;
}

export function getPrettierRcJs() {
  return `module.exports = require('@ankhorage/devtools/prettier');
`;
}

export function getIndexJs() {
  return `import 'expo-router/entry';
`;
}

export function getTsConfigJson() {
  const tsConfigJson = `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-native",
    "outDir": "dist",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["node"],
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@root/*": ["./*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
`;
  return tsConfigJson;
}
